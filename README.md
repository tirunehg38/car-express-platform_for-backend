# Car Express API

Base URL used below: `http://localhost:5000`. Protected routes use a bearer
token returned by registration or login. Replace the example IDs with real
database IDs. Administrator endpoints require a user whose stored `role` is
`admin`.

## Database tables used

The PostgreSQL schema is defined in `migrations/schema.sql`. The table columns
used by the API are:

| Table | Columns used |
| --- | --- |
| `users` | `id`, `name`, `email`, `password_hash`, `phone`, `avatar_url`, `role`, `created_at`, `updated_at` |
| `brands` | `id`, `name` |
| `cars` | `id`, `owner_id`, `brand_id`, `model`, `year`, `price`, `mileage`, `vehicle_condition`, `fuel_type`, `transmission`, `body_type`, `engine_size`, `color`, `city`, `area`, `description`, `features`, `status`, `created_at`, `updated_at` |
| `car_images` | `id`, `car_id`, `image_url`, `public_id`, `is_primary`, `sort_order`, `created_at` |
| `favorites` | `user_id`, `car_id`, `created_at` |
| `inquiries` | `id`, `user_id`, `car_id`, `type`, `name`, `email`, `phone`, `message`, `status`, `email_sent`, `email_sent_at`, `email_error`, `created_at`, `updated_at` |
| `reviews` | `id`, `user_id`, `car_id`, `rating`, `title`, `body`, `created_at`, `updated_at` |

Relevant database-enforced values are `users.role` (`buyer`, `seller`,
`admin`), `cars.vehicle_condition` (`new`, `used`, `certified`),
`cars.fuel_type` (`petrol`, `diesel`, `hybrid`, `electric`),
`cars.transmission` (`manual`, `automatic`, `cvt`), `cars.status`
(`pending`, `approved`, `rejected`, `sold`), `inquiries.type` (`contact`,
`financing`), and `inquiries.status` (`new`, `contacted`, `read`, `replied`, `closed`).
Emails, non-null phones, and `(favorites.user_id, favorites.car_id)` are
unique. Each car can have up to 10 image records and at most one primary image.
`public_id` stores Cloudinary metadata; image bytes are never stored in
PostgreSQL.

## Create and seed the database

Create an empty PostgreSQL database, then run these commands from the
repository root (set `DB_NAME`, `PGHOST`, `PGPORT`, and `PGUSER` for your
connection as needed):

```sh
createdb "$DB_NAME"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f backend/migrations/schema.sql
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f backend/migrations/002_car_images_cloudinary.sql
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f backend/seeds/seed.sql
```

The schema creates the tables and image columns for a fresh database. The
second migration safely adds Cloudinary IDs and primary-image metadata to an
existing `car_images` table and can be rerun. Run it on existing installations
before starting the updated API. The seed script can also be rerun: it adds the
listed brands and approved demo cars only once, along with one image per demo
listing. Demo cars have no owner account, so they appear in public inventory
but cannot be edited as a seller. Listing prices are in Ethiopian birr (ETB).

## Cloudinary configuration

Set these variables in `backend/.env` (the file is ignored by Git):

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Only the backend reads these credentials. Never add the Cloudinary API secret
to a frontend environment file or expose it through a `VITE_` variable.
Uploads use in-memory Multer storage and are limited to 10 images per request
and 10 MB per image.

## Resend email configuration & notifications (Step 5)

Car Express Ethiopia uses [Resend](https://resend.com) for transactional lead delivery emails to sellers when buyers submit vehicle inquiries.

### 1. How to create a Resend account
1. Navigate to [resend.com](https://resend.com) and sign up for a free account.
2. Complete email verification to activate your account.

### 2. How to create the API key
1. In the Resend dashboard, open the **API Keys** tab (`https://resend.com/api-keys`).
2. Click **Create API Key**.
3. Set the name (e.g. `car-express-ethiopia`), choose permission `Full access`, and click **Add**.
4. Copy the generated key starting with `re_` immediately.

### 3. How to verify the sending domain / email
- **Development & Testing:** Resend provides a sandbox domain (`onboarding@resend.dev`) out-of-the-box. It can send test notifications directly to the email address registered with your Resend account without requiring custom DNS configuration.
- **Production Deployment:**
  1. Go to **Domains** in the Resend dashboard (`https://resend.com/domains`) and click **Add Domain**.
  2. Enter your custom domain (e.g., `carexpress.et`).
  3. Resend will provide DNS records (DKIM, SPF TXT records, and MX records). Add these records in your DNS provider (Cloudflare, Namecheap, Route 53, etc.).
  4. Once verified, configure `EMAIL_FROM` with your verified domain (e.g. `Car Express Ethiopia <notifications@carexpress.et>`).

### 4. Where to put the credentials
Add these variables to `backend/.env` (which is git-ignored and never committed):

```dotenv
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Car Express <onboarding@resend.dev>
FRONTEND_URL=http://localhost:5173
```

> **Security rule:** Never place `RESEND_API_KEY` in frontend `.env` files or prefix it with `VITE_`. Email sending and API keys must remain strictly server-side.

### 5. How to test the inquiry email
- **Automated test suite:**
  ```sh
  cd backend
  npm test
  ```
  Runs all 13 test scenarios including validation, email resilience, rate limiting, and database persistence.
- **Manual API test via curl:**
  ```sh
  curl -X POST http://localhost:5000/api/inquiries \
    -H "Content-Type: application/json" \
    -d '{
      "carId": 1,
      "buyerName": "Abebe Kebede",
      "buyerEmail": "abebe@example.com",
      "buyerPhone": "0911223344",
      "message": "Hello, is this car still available? I would like to schedule a viewing."
    }'
  ```
- **In-browser test:**
  Navigate to any car details page at `http://localhost:5173/inventory/:id`, fill out the "Contact Seller / Send Inquiry" form, and click **Send Inquiry**.

### 6. Buyer → Backend → Database → Seller email flow
```
[Buyer on CarDetails.jsx]
       │
       ▼ (POST /api/inquiries with buyerName, buyerEmail, buyerPhone, message, carId)
[inquiryRateLimiter Middleware] (Prevents rapid duplicate inquiries & spam flood)
       │
       ▼
[inquiries.controller.js]
       │
       ▼
[inquiries.service.js]
       ├─► 1. Validates buyer data (name, email format, phone format, message length <= 2000)
       ├─► 2. Resolves Car & Owner in PostgreSQL (ensures car exists, fetches seller email)
       │      * Security: Seller email is strictly derived from DB (car -> owner -> email),
       │                  never trusted from client input.
       ├─► 3. Saves inquiry into PostgreSQL (status: 'new', email_sent: false)
       │      * PostgreSQL is the authoritative source of truth.
       ├─► 4. Dispatches HTML lead email via EmailService (Resend API)
       │      * Reply-To set to buyer.email for 1-click seller response
       │      * Includes vehicle specs, price in ETB, reference ID, and CTA link
       ├─► 5. Updates inquiry email delivery status (email_sent: true, email_sent_at)
       │      * If email fails, error is recorded in email_error without rolling back the DB
       ▼
[Response 201 Created] -> "Your inquiry has been sent to the seller successfully."
       │
       ▼
[Frontend CarDetails.jsx] Displays success banner & allows sending another message
```

## Endpoint access

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/users` | Admin |
| GET, PUT, DELETE | `/api/users/:id` | Owner or admin |
| GET | `/api/cars` | Public (approved listings; admins may filter status); authenticated users may pass `mine=true` for their own listings |
| GET | `/api/cars/:id` | Public for approved listings; owner/admin can view other statuses |
| POST | `/api/cars` | Authenticated |
| PUT, DELETE | `/api/cars/:id` | Listing owner or admin |
| POST | `/api/cars/:id/images` | Listing owner or admin |
| PUT | `/api/cars/:carId/images/:imageId/primary` | Listing owner or admin |
| DELETE | `/api/cars/:carId/images/:imageId` | Listing owner or admin |
| GET | `/api/brands`, `/api/brands/:id` | Public |
| POST, PUT, DELETE | `/api/brands`, `/api/brands/:id` | Admin |
| GET, POST, DELETE | `/api/favorites`, `/api/favorites/:carId` | Authenticated |
| POST | `/api/inquiries` | Public; optional bearer token associates the user |
| GET, PUT, DELETE | `/api/inquiries`, `/api/inquiries/:id` | Owner or admin (list is user-scoped; admin sees all) |

Car listing filters include `brand_id`, `year`, `fuel_type`, `transmission`,
`vehicle_condition`, `city`, `q`, `min_price`, `max_price`, `page`, `limit`,
`sort` (`created_at`, `price`, `year`), and `order` (`asc`, `desc`). The
`mine=true` option requires authentication and limits results to the current
user, including listings that are not yet approved.
Pagination defaults to 20 records and is capped at 100.

## curl examples

```sh
BASE=http://localhost:5000
TOKEN='<user-token>'
ADMIN_TOKEN='<admin-token>'
USER_ID=1
CAR_ID=1
BRAND_ID=1
INQUIRY_ID=1
```

### Authentication

```sh
curl -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Abebe Bekele","email":"abebe@example.com","password":"strong-password-123","phone":"+251911000000"}'
curl -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"abebe@example.com","password":"strong-password-123"}'
curl "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

### Users

```sh
curl "$BASE/api/users" -H "Authorization: Bearer $ADMIN_TOKEN"
curl "$BASE/api/users/$USER_ID" -H "Authorization: Bearer $TOKEN"
curl -X PUT "$BASE/api/users/$USER_ID" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Abebe B."}'
curl -X DELETE "$BASE/api/users/$USER_ID" -H "Authorization: Bearer $TOKEN"
```

### Cars

```sh
curl "$BASE/api/cars?page=1&limit=10&city=Addis%20Ababa"
curl "$BASE/api/cars/$CAR_ID"
curl -X POST "$BASE/api/cars" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"brand_id":1,"model":"Corolla","year":2020,"price":2500000,"mileage":35000,"vehicle_condition":"used","fuel_type":"petrol","transmission":"automatic","body_type":"sedan","engine_size":"1.8L","color":"white","city":"Addis Ababa","area":"Bole","description":"Well maintained","features":["AC","Bluetooth"]}'
curl -X PUT "$BASE/api/cars/$CAR_ID" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"price":2400000}'
curl -X DELETE "$BASE/api/cars/$CAR_ID" -H "Authorization: Bearer $TOKEN"
```

New non-admin listings start as `pending`; only approved cars appear in public
search and can be favorited. Create a listing first, then send one or more
image files in the `images` multipart field. `primary_index` is the zero-based
index of the cover image within that upload batch; `primary_image_id` can
instead select an already saved image as the cover.

```sh
curl -X POST "$BASE/api/cars/$CAR_ID/images" \
  -H "Authorization: ******" \
  -F "images=@./front.jpg" \
  -F "images=@./interior.jpg" \
  -F "primary_index=0"
curl -X PUT "$BASE/api/cars/$CAR_ID/images/1/primary" \
  -H "Authorization: ******"
curl -X DELETE "$BASE/api/cars/$CAR_ID/images/2" \
  -H "Authorization: ******"
```

The upload endpoint returns the stored image URLs and metadata. If an upload
or PostgreSQL insert fails, successfully uploaded Cloudinary assets are
removed where possible. The React seller form creates or updates the car
record first, then uploads its selected images.

### Brands

```sh
curl "$BASE/api/brands"
curl "$BASE/api/brands/$BRAND_ID"
curl -X POST "$BASE/api/brands" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Toyota"}'
curl -X PUT "$BASE/api/brands/$BRAND_ID" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Toyota Motor"}'
curl -X DELETE "$BASE/api/brands/$BRAND_ID" -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Favorites

```sh
curl "$BASE/api/favorites" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE/api/favorites/$CAR_ID" -H "Authorization: Bearer $TOKEN"
curl -X DELETE "$BASE/api/favorites/$CAR_ID" -H "Authorization: Bearer $TOKEN"
```

### Inquiries

```sh
curl "$BASE/api/inquiries" -H "Authorization: Bearer $TOKEN"
curl "$BASE/api/inquiries/$INQUIRY_ID" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE/api/inquiries" -H 'Content-Type: application/json' \
  -d '{"type":"contact","name":"Abebe Bekele","email":"abebe@example.com","message":"Is this car available?","car_id":1}'
curl -X PUT "$BASE/api/inquiries/$INQUIRY_ID" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"message":"Please contact me after 5 PM."}'
curl -X DELETE "$BASE/api/inquiries/$INQUIRY_ID" -H "Authorization: Bearer $TOKEN"
```

All API responses use `{ "success": boolean, "message": string, "data": ... }`.
User responses omit password hashes. The inquiry endpoint accepts guest
submissions; GET/PUT/DELETE inquiry operations require authentication.

## Request flow

- Authentication: `auth.routes.js` → `auth.controller.js` → `auth.service.js` → `user.model.js` → PostgreSQL. Token verification also runs through `auth.service.js`.
- Users: `users.routes.js` → `users.controller.js` → `users.service.js` → `user.model.js` → PostgreSQL.
- Cars: `cars.routes.js` → `cars.controller.js` → `cars.service.js` → `car.model.js` / `car-image.model.js` → PostgreSQL. Image uploads additionally use `upload.middleware.js` and `cloudinary.service.js`.
- Brands: `brands.routes.js` → `brands.controller.js` → `brands.service.js` → `brand.model.js` → PostgreSQL.
- Favorites: `favorites.routes.js` → `favorites.controller.js` → `favorites.service.js` → `favorite.model.js` and `car.model.js` → PostgreSQL.
- Inquiries: `inquiries.routes.js` → `inquiries.controller.js` → `inquiries.service.js` → `inquiry.model.js` and `car.model.js` → PostgreSQL.

Services accept plain data and user identity/role values; they do not access
Express request/response objects or set HTTP status codes. Models own SQL
access, while controllers translate service results into HTTP responses.
# car-express-platform_for-backend
