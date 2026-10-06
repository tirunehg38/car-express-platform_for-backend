BEGIN;

ALTER TABLE car_images
  ADD COLUMN IF NOT EXISTS public_id TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE car_images AS image
SET is_primary = TRUE
WHERE image.id = (
  SELECT candidate.id
  FROM car_images AS candidate
  WHERE candidate.car_id = image.car_id
  ORDER BY candidate.sort_order, candidate.id
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM car_images AS current_primary
  WHERE current_primary.car_id = image.car_id
    AND current_primary.is_primary
);

CREATE UNIQUE INDEX IF NOT EXISTS car_images_one_primary_per_car_idx
  ON car_images (car_id)
  WHERE is_primary;

COMMIT;
