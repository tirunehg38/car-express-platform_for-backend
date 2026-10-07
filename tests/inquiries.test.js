const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../src/app");
const pool = require("../src/config/db");
const InquiriesService = require("../src/services/inquiries.service");
const Inquiry = require("../src/models/inquiry.model");
const User = require("../src/models/user.model");
const EmailService = require("../src/services/email.service");
const { resetRateLimiter } = require("../src/middleware/rateLimit.middleware");
const AuthService = require("../src/services/auth.service");
const config = require("../src/config/config");

let server;
let baseUrl;
let testSellerId;
let testCarWithSellerId;
let testCarWithoutSellerId;
let testBrandId;
let validAuthToken;

// Helper to make HTTP requests to the test server
const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: json };
};

test.before(async () => {
  // 1. Start ephemeral HTTP server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 2. Setup test data in PostgreSQL
  // Find or insert brand
  const brandResult = await pool.query(
    "INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
    ["TestBrand_Inquiries"]
  );
  testBrandId = brandResult.rows[0].id;

  // Find or insert seller user
  const sellerEmail = `test_seller_${Date.now()}@example.com`;
  const sellerResult = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role`,
    ["Test Seller", sellerEmail, "$2b$10$abcdefghijklmnopqrstuu", "+251911998877", "seller"]
  );
  testSellerId = sellerResult.rows[0].id;

  validAuthToken = AuthService.createToken({ id: testSellerId });

  // Insert car with assigned seller
  const carWithSellerResult = await pool.query(
    `INSERT INTO cars (owner_id, brand_id, model, year, price, mileage, vehicle_condition, fuel_type, transmission, city, area, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      testSellerId,
      testBrandId,
      "Camry Hybrid",
      2023,
      3500000,
      12000,
      "used",
      "hybrid",
      "automatic",
      "Addis Ababa",
      "Bole",
      "Test listing for inquiries test",
      "approved",
    ]
  );
  testCarWithSellerId = carWithSellerResult.rows[0].id;

  // Insert car without seller (owner_id IS NULL)
  const carWithoutSellerResult = await pool.query(
    `INSERT INTO cars (owner_id, brand_id, model, year, price, mileage, vehicle_condition, fuel_type, transmission, city, area, description, status)
     VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      testBrandId,
      "Orphan Car",
      2021,
      2000000,
      45000,
      "used",
      "petrol",
      "manual",
      "Hawassa",
      "Center",
      "Test listing without seller",
      "approved",
    ]
  );
  testCarWithoutSellerId = carWithoutSellerResult.rows[0].id;
});

test.after(async () => {
  // Clean up test data
  try {
    if (testCarWithSellerId || testCarWithoutSellerId) {
      await pool.query("DELETE FROM inquiries WHERE car_id IN ($1, $2)", [
        testCarWithSellerId,
        testCarWithoutSellerId,
      ]);
      await pool.query("DELETE FROM cars WHERE id IN ($1, $2)", [
        testCarWithSellerId,
        testCarWithoutSellerId,
      ]);
    }
    if (testSellerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [testSellerId]);
    }
    if (testBrandId) {
      await pool.query("DELETE FROM brands WHERE id = $1", [testBrandId]);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }

  // Close HTTP server
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test.beforeEach(() => {
  resetRateLimiter();
});

test("1. Valid inquiry: creates inquiry, delivers notification, returns 201", async () => {
  // Spy on EmailService.sendSellerInquiryNotification to prevent actual Resend network call during unit tests
  const originalSend = EmailService.sendSellerInquiryNotification;
  let emailPayloadCaptured = null;
  EmailService.sendSellerInquiryNotification = async (payload) => {
    emailPayloadCaptured = payload;
    return { success: true, messageId: "msg_test_12345" };
  };

  try {
    const res = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Abebe Kebede",
        buyerEmail: "abebe@example.com",
        buyerPhone: "+251912345678",
        message: "Is this car still available? I would like to schedule an inspection.",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(
      res.body.message,
      "Your inquiry has been sent to the seller successfully."
    );
    assert.ok(res.body.data);
    assert.equal(res.body.data.name, "Abebe Kebede");
    assert.equal(res.body.data.email, "abebe@example.com");
    assert.equal(res.body.data.phone, "+251912345678");
    assert.equal(res.body.data.car_id, testCarWithSellerId);
    assert.equal(res.body.data.status, "new");

    // Verify email payload sent to seller
    assert.ok(emailPayloadCaptured);
    assert.equal(emailPayloadCaptured.seller.id, testSellerId);
    assert.equal(emailPayloadCaptured.buyer.name, "Abebe Kebede");
    assert.equal(emailPayloadCaptured.buyer.email, "abebe@example.com");
  } finally {
    EmailService.sendSellerInquiryNotification = originalSend;
  }
});

test("2. Invalid car ID: returns 400 for malformed ID and 404 for nonexistent car", async () => {
  // Malformed carId
  const resMalformed = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: "not-a-number",
      buyerName: "Abebe Kebede",
      buyerEmail: "abebe@example.com",
      buyerPhone: "0912345678",
      message: "Testing invalid ID",
    },
  });
  assert.equal(resMalformed.status, 400);
  assert.equal(resMalformed.body.success, false);
  assert.match(resMalformed.body.message, /Invalid car ID/i);

  resetRateLimiter();

  // Nonexistent carId
  const resNotFound = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: 999999999,
      buyerName: "Abebe Kebede",
      buyerEmail: "abebe@example.com",
      buyerPhone: "0912345678",
      message: "Testing non-existent car",
    },
  });
  assert.equal(resNotFound.status, 404);
  assert.equal(resNotFound.body.success, false);
  assert.match(resNotFound.body.message, /Car not found/i);
});

test("3. Missing buyer name: returns 400 validation error", async () => {
  const res = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: testCarWithSellerId,
      buyerName: "",
      buyerEmail: "abebe@example.com",
      buyerPhone: "0912345678",
      message: "Is this car available?",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Buyer name is required/i);
});

test("4. Invalid email: returns 400 validation error", async () => {
  const res = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: testCarWithSellerId,
      buyerName: "Abebe Kebede",
      buyerEmail: "not-a-valid-email",
      buyerPhone: "0912345678",
      message: "Is this car available?",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /valid email address is required/i);
});

test("5. Invalid phone: returns 400 validation error", async () => {
  // Invalid format
  const resInvalid = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: testCarWithSellerId,
      buyerName: "Abebe Kebede",
      buyerEmail: "abebe@example.com",
      buyerPhone: "invalid#phone@@@",
      message: "Is this car available?",
    },
  });
  assert.equal(resInvalid.status, 400);
  assert.equal(resInvalid.body.success, false);
  assert.match(resInvalid.body.message, /Buyer phone number must be a valid format/i);

  resetRateLimiter();

  // Missing phone for a car inquiry
  const resMissing = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: testCarWithSellerId,
      buyerName: "Abebe Kebede",
      buyerEmail: "abebe@example.com",
      buyerPhone: "",
      message: "Is this car available?",
    },
  });
  assert.equal(resMissing.status, 400);
  assert.equal(resMissing.body.success, false);
  assert.match(resMissing.body.message, /Buyer phone number is required/i);
});

test("6. Empty message: returns 400 validation error", async () => {
  const res = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: testCarWithSellerId,
      buyerName: "Abebe Kebede",
      buyerEmail: "abebe@example.com",
      buyerPhone: "0912345678",
      message: "     ",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /A non-empty message is required/i);
});

test("7. Car without seller: returns 400 validation error", async () => {
  const res = await request("/api/inquiries", {
    method: "POST",
    body: {
      carId: testCarWithoutSellerId,
      buyerName: "Abebe Kebede",
      buyerEmail: "abebe@example.com",
      buyerPhone: "0912345678",
      message: "Inquiring about orphan car",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /does not have an assigned seller/i);
});

test("8. Seller without email: returns 400 validation error", async () => {
  // Test with mock User.findById returning seller without email
  const originalFindById = User.findById;
  User.findById = async () => ({ id: 9999, name: "No Email Seller", email: null });

  try {
    const res = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Abebe Kebede",
        buyerEmail: "abebe@example.com",
        buyerPhone: "0912345678",
        message: "Inquiring about car with seller without email",
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /seller does not have a registered email address/i);
  } finally {
    User.findById = originalFindById;
  }
});

test("9. Database failure: handled safely without crashing server", async () => {
  const originalCreate = Inquiry.create;
  Inquiry.create = async () => {
    const err = new Error("Connection terminated unexpectedly");
    err.code = "ECONNRESET";
    throw err;
  };

  try {
    const res = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Abebe Kebede",
        buyerEmail: "abebe@example.com",
        buyerPhone: "0912345678",
        message: "Testing database resilience",
      },
    });
    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
  } finally {
    Inquiry.create = originalCreate;
  }
});

test("10. Email failure: preserves saved inquiry in PostgreSQL and records email_error", async () => {
  const originalSend = EmailService.sendSellerInquiryNotification;
  EmailService.sendSellerInquiryNotification = async () => {
    return { success: false, error: "Resend API connection timed out" };
  };

  try {
    const res = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Resilient Buyer",
        buyerEmail: "resilient@example.com",
        buyerPhone: "0912345678",
        message: "Inquiry should be saved even if email provider is down.",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(
      res.body.message,
      "Your inquiry has been sent to the seller successfully."
    );

    const savedId = res.body.data.id;
    assert.ok(savedId);

    // Verify inquiry is preserved in DB with email_sent = false and email_error recorded
    const dbRecord = await pool.query(
      "SELECT id, email_sent, email_error FROM inquiries WHERE id = $1",
      [savedId]
    );
    assert.equal(dbRecord.rows.length, 1);
    assert.equal(dbRecord.rows[0].email_sent, false);
    assert.equal(dbRecord.rows[0].email_error, "Resend API connection timed out");
  } finally {
    EmailService.sendSellerInquiryNotification = originalSend;
  }
});

test("11. Unauthorized request if authentication is required: protected routes reject without token", async () => {
  // GET /api/inquiries requires authentication
  const getUnauth = await request("/api/inquiries");
  assert.equal(getUnauth.status, 401);
  assert.equal(getUnauth.body.success, false);
  assert.match(getUnauth.body.message, /Authentication.*required/i);

  // PATCH /api/inquiries/:id/status requires authentication
  const patchUnauth = await request("/api/inquiries/1/status", {
    method: "PATCH",
    body: { status: "contacted" },
  });
  assert.equal(patchUnauth.status, 401);
  assert.equal(patchUnauth.body.success, false);

  // Authenticated GET succeeds
  const getAuth = await request("/api/inquiries", {
    headers: { Authorization: `Bearer ${validAuthToken}` },
  });
  assert.equal(getAuth.status, 200);
  assert.equal(getAuth.body.success, true);
});

test("12. Rate limiting: rejects rapid duplicate submissions and excessive requests", async () => {
  const originalSend = EmailService.sendSellerInquiryNotification;
  EmailService.sendSellerInquiryNotification = async () => ({ success: true, messageId: "msg_rate_test" });

  try {
    resetRateLimiter();

    // 1st request succeeds
    const res1 = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Spam Checker",
        buyerEmail: "spam@example.com",
        buyerPhone: "0911223344",
        message: "First inquiry",
      },
    });
    assert.equal(res1.status, 201);

    // Immediate duplicate (same carId, email) is rejected with 429
    const resDuplicate = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Spam Checker",
        buyerEmail: "spam@example.com",
        buyerPhone: "0911223344",
        message: "Duplicate rapid inquiry",
      },
    });
    assert.equal(resDuplicate.status, 429);
    assert.equal(resDuplicate.body.success, false);
    assert.match(resDuplicate.body.message, /duplicate inquiry was recently submitted/i);

    // Exceeding total requests limit (10 per window)
    resetRateLimiter();
    for (let i = 0; i < 10; i++) {
      const r = await request("/api/inquiries", {
        method: "POST",
        body: {
          carId: testCarWithSellerId,
          buyerName: `Buyer ${i}`,
          buyerEmail: `unique_${i}_@example.com`,
          buyerPhone: `091100000${i}`,
          message: `Inquiry ${i}`,
        },
      });
      assert.equal(r.status, 201);
    }

    // 11th request triggers rate limit 429
    const res11 = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName: "Buyer 11",
        buyerEmail: "unique_11_@example.com",
        buyerPhone: "0911000011",
        message: "Inquiry 11",
      },
    });
    assert.equal(res11.status, 429);
    assert.equal(res11.body.success, false);
    assert.match(res11.body.message, /Too many inquiry requests/i);
  } finally {
    EmailService.sendSellerInquiryNotification = originalSend;
  }
});

test("13. Successful inquiry persistence in PostgreSQL: verifies DB fields and constraints", async () => {
  const originalSend = EmailService.sendSellerInquiryNotification;
  EmailService.sendSellerInquiryNotification = async () => ({ success: true, messageId: "msg_persistence_test" });

  try {
    resetRateLimiter();

    const buyerName = "Almaz Ayana";
    const buyerEmail = "almaz.ayana@example.com";
    const buyerPhone = "+251922334455";
    const message = "Is the price negotiable for cash payment?";

    const res = await request("/api/inquiries", {
      method: "POST",
      body: {
        carId: testCarWithSellerId,
        buyerName,
        buyerEmail,
        buyerPhone,
        message,
      },
    });

    assert.equal(res.status, 201);
    const createdId = res.body.data.id;
    assert.ok(createdId);

    // Directly query PostgreSQL to verify all fields persisted
    const dbResult = await pool.query(
      `SELECT id, car_id, name, email, phone, message, status, email_sent, email_sent_at, email_error, created_at, updated_at
       FROM inquiries
       WHERE id = $1`,
      [createdId]
    );

    assert.equal(dbResult.rows.length, 1);
    const row = dbResult.rows[0];
    assert.equal(row.car_id, testCarWithSellerId);
    assert.equal(row.name, buyerName);
    assert.equal(row.email, buyerEmail);
    assert.equal(row.phone, buyerPhone);
    assert.equal(row.message, message);
    assert.equal(row.status, "new");
    assert.equal(row.email_sent, true);
    assert.ok(row.email_sent_at);
    assert.equal(row.email_error, null);
    assert.ok(row.created_at);
    assert.ok(row.updated_at);
  } finally {
    EmailService.sendSellerInquiryNotification = originalSend;
  }
});
