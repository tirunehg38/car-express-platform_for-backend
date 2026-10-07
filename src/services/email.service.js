const https = require("https");
const config = require("../config/config");

class EmailService {
  constructor() {
    this.from = config.email.from || "Car Express <onboarding@resend.dev>";
    this.frontendUrl = (config.email.frontendUrl || "http://localhost:5173").replace(/\/+$/, "");
  }

  isConfigured() {
    const key = config.email.resendApiKey;
    return Boolean(key && !key.includes("your_") && !key.includes("<"));
  }

  /**
   * Low-level send method to Resend API
   */
  async sendEmail({ to, subject, html, text, reply_to }) {
    if (!this.isConfigured()) {
      console.warn(
        `[EmailService] Resend API key is not configured. Email to ${to} was skipped. Configure RESEND_API_KEY in backend/.env to send real emails.`
      );
      return {
        success: false,
        skipped: true,
        error: "Resend API key is not configured in backend/.env",
      };
    }

    const payload = JSON.stringify({
      from: this.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: reply_to || undefined,
    });

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "api.resend.com",
          path: "/emails",
          method: "POST",
          family: 4,
          timeout: 10000,
          headers: {
            Authorization: `Bearer ${config.email.resendApiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}");
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(
                  `[EmailService] Notification email delivered successfully to ${to} (ID: ${parsed.id})`
                );
                return resolve({ success: true, messageId: parsed.id });
              }
              const errMsg =
                parsed.message ||
                parsed.error?.message ||
                `Resend returned HTTP ${res.statusCode}`;
              console.error(`[EmailService] Resend returned error for ${to}:`, errMsg);
              return resolve({ success: false, error: errMsg });
            } catch {
              const errMsg = `Resend returned invalid response (status ${res.statusCode})`;
              console.error(`[EmailService] ${errMsg}`);
              return resolve({ success: false, error: errMsg });
            }
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        console.error(`[EmailService] Request timed out for ${to}`);
        resolve({ success: false, error: "Email delivery timed out after 10 seconds" });
      });

      req.on("error", (err) => {
        console.error(`[EmailService] Network error sending to ${to}:`, err.message);
        resolve({ success: false, error: err.message || "Failed to connect to email provider" });
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Send seller notification for a new car inquiry
   * @param {Object} params
   * @param {Object} params.seller - Seller object with name, email
   * @param {Object} params.buyer - Buyer object with name, email, phone
   * @param {Object} params.car - Car object with id, brand_name, model, year, price
   * @param {Object} params.inquiry - Inquiry object with id, message, created_at
   * @returns {Promise<{success: boolean, messageId?: string, skipped?: boolean, error?: string}>}
   */
  async sendSellerInquiryNotification({ seller, buyer, car, inquiry }) {
    if (!seller || !seller.email) {
      return {
        success: false,
        error: "Seller email address is missing",
      };
    }

    const carName = `${car.brand_name || car.brand || ""} ${car.model} ${car.year}`.trim();
    const subject = `New Buyer Inquiry – ${carName}`;
    const listingUrl = `${this.frontendUrl}/inventory/${car.id}`;
    const formattedPrice = car.price
      ? `ETB ${Number(car.price).toLocaleString()}`
      : "Price upon request";
    const inquiryDate = new Date(inquiry.created_at || Date.now()).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px;">CAR EXPRESS <span style="color: #ffffff; font-weight: 400; font-size: 14px;">ETHIOPIA</span></span>
                    <h1 style="margin: 12px 0 0 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.3;">New Buyer Lead Received</h1>
                    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 14px;">A potential buyer is interested in your listing</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155;">
                Hello <strong>${seller.name || "Seller"}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                You have received a new inquiry on Car Express for your listing <strong>${carName}</strong>.
              </p>

              <!-- Vehicle Summary Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div style="font-size: 12px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Vehicle Inquired</div>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${carName}</div>
                    <table role="presentation" width="100%" style="margin-top: 10px; font-size: 14px; color: #475569;" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 3px 0; width: 50%;"><strong>Price:</strong> ${formattedPrice}</td>
                        <td style="padding: 3px 0; width: 50%;"><strong>Reference ID:</strong> #CAR-${car.id}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Buyer Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Buyer Contact Details</div>
                    <table role="presentation" width="100%" style="font-size: 14px; color: #1e293b;" cellspacing="0" cellpadding="4">
                      <tr>
                        <td style="width: 120px; color: #64748b;"><strong>Full Name:</strong></td>
                        <td style="font-weight: 600;">${buyer.name}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;"><strong>Email:</strong></td>
                        <td><a href="mailto:${buyer.email}" style="color: #0284c7; text-decoration: none; font-weight: 500;">${buyer.email}</a></td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;"><strong>Phone:</strong></td>
                        <td><a href="tel:${buyer.phone}" style="color: #0284c7; text-decoration: none; font-weight: 500;">${buyer.phone || "Not provided"}</a></td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;"><strong>Inquiry Date:</strong></td>
                        <td style="color: #64748b;">${inquiryDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Buyer Message Box -->
              <div style="margin-bottom: 28px;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Message from Buyer</div>
                <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px 20px; border-radius: 0 8px 8px 0; font-size: 15px; color: #1e293b; font-style: italic; white-space: pre-line;">
"${inquiry.message}"
                </div>
              </div>

              <!-- Call to Action Buttons -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="border-radius: 9999px; background-color: #0284c7;">
                          <a href="${listingUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 9999px;">
                            View Listing on Car Express &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">
                Tip: You can reply directly to this email to contact <strong>${buyer.name}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 6px 0;">This email was sent by Car Express Ethiopia Marketplace.</p>
              <p style="margin: 0;">Addis Ababa, Ethiopia &bull; <a href="${this.frontendUrl}" style="color: #64748b; text-decoration: underline;">car-express.et</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    const text = `
New Buyer Inquiry – ${carName}
Car Express Ethiopia

Hello ${seller.name || "Seller"},

You have received a new inquiry on Car Express for your listing: ${carName}

Vehicle Details:
- Model: ${carName}
- Price: ${formattedPrice}
- Reference ID: #CAR-${car.id}
- View Listing: ${listingUrl}

Buyer Details:
- Name: ${buyer.name}
- Email: ${buyer.email}
- Phone: ${buyer.phone || "Not provided"}
- Date: ${inquiryDate}

Message:
"${inquiry.message}"

You can reply directly to this email to get in touch with the buyer.
`.trim();

    return await this.sendEmail({
      to: seller.email,
      reply_to: buyer.email,
      subject,
      html,
      text,
    });
  }
}

module.exports = new EmailService();
