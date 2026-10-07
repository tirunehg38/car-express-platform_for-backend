BEGIN;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT;

ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('new', 'contacted', 'read', 'replied', 'closed'));

CREATE INDEX IF NOT EXISTS inquiries_car_created_at_idx ON inquiries (car_id, created_at DESC);

COMMIT;
