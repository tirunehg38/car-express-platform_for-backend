BEGIN;

INSERT INTO brands (name)
VALUES
  ('Toyota'),
  ('Ford'),
  ('BMW'),
  ('Hyundai'),
  ('Honda'),
  ('Mercedes-Benz'),
  ('Nissan'),
  ('Kia'),
  ('Tesla'),
  ('Volkswagen'),
  ('Subaru'),
  ('Lexus')
ON CONFLICT (name) DO NOTHING;

WITH demo_cars (
  brand_name, model, year, price, mileage, vehicle_condition, fuel_type,
  transmission, body_type, engine_size, color, city, area, description, features
) AS (
  VALUES
    (
      'Toyota', 'Vitz', 2021, 1900000, 10300, 'used', 'petrol',
      'automatic', 'hatchback', '1.0L', 'Silver', 'Addis Ababa', 'Bole',
      'Demo listing: fuel-efficient Toyota Vitz for city driving.',
      ARRAY['Automatic transmission', 'Air conditioning', 'Reverse camera']::TEXT[]
    ),
    (
      'Toyota', 'Hilux', 2020, 4200000, 48000, 'used', 'diesel',
      'manual', 'pickup', '2.4L', 'White', 'Addis Ababa', 'CMC',
      'Demo listing: dependable Toyota Hilux with a practical pickup bed.',
      ARRAY['4WD', 'Diesel engine', 'Double cab']::TEXT[]
    ),
    (
      'Ford', 'Ranger', 2021, 5100000, 39000, 'used', 'diesel',
      'automatic', 'pickup', '2.0L', 'Blue', 'Addis Ababa', 'Kazanchis',
      'Demo listing: versatile Ford Ranger for work and weekend travel.',
      ARRAY['Automatic transmission', '4WD', 'Bluetooth']::TEXT[]
    ),
    (
      'BMW', '320i', 2019, 6200000, 52000, 'used', 'petrol',
      'automatic', 'sedan', '2.0L', 'Black', 'Addis Ababa', 'Bole',
      'Demo listing: well-kept BMW 320i with a comfortable premium cabin.',
      ARRAY['Leather interior', 'Sunroof', 'Parking sensors']::TEXT[]
    ),
    (
      'Hyundai', 'Tucson', 2022, 5600000, 27500, 'used', 'petrol',
      'automatic', 'SUV', '2.0L', 'White', 'Addis Ababa', 'Megenagna',
      'Demo listing: spacious Hyundai Tucson suited to family travel.',
      ARRAY['Automatic transmission', 'Apple CarPlay', 'Backup camera']::TEXT[]
    ),
    (
      'Honda', 'Civic', 2023, 4900000, 12500, 'certified', 'petrol',
      'cvt', 'sedan', '1.5L', 'Red', 'Bishoftu', 'Town Center',
      'Demo listing: low-mileage certified Honda Civic with CVT transmission.',
      ARRAY['CVT transmission', 'Cruise control', 'Lane assist']::TEXT[]
    ),
    (
      'Nissan', 'X-Trail', 2020, 4700000, 44500, 'used', 'petrol',
      'cvt', 'SUV', '2.5L', 'Gray', 'Adama', 'Central',
      'Demo listing: practical Nissan X-Trail with room for the whole family.',
      ARRAY['All-wheel drive', 'Third-row seating', 'Reverse camera']::TEXT[]
    ),
    (
      'Kia', 'Sportage', 2022, 5200000, 22000, 'used', 'petrol',
      'automatic', 'SUV', '2.0L', 'Silver', 'Addis Ababa', 'Summit',
      'Demo listing: modern Kia Sportage with a comfortable and spacious cabin.',
      ARRAY['Touchscreen display', 'Bluetooth', 'Parking sensors']::TEXT[]
    ),
    (
      'Tesla', 'Model 3', 2022, 8900000, 18000, 'used', 'electric',
      'automatic', 'sedan', 'Electric', 'White', 'Addis Ababa', 'Bole',
      'Demo listing: fully electric Tesla Model 3 with a minimalist interior.',
      ARRAY['Electric drivetrain', 'Glass roof', 'Rear camera']::TEXT[]
    ),
    (
      'Mercedes-Benz', 'C-Class', 2019, 7100000, 57000, 'used', 'petrol',
      'automatic', 'sedan', '2.0L', 'Black', 'Addis Ababa', 'Old Airport',
      'Demo listing: Mercedes-Benz C-Class offering a refined daily drive.',
      ARRAY['Leather seats', 'Automatic transmission', 'Parking sensors']::TEXT[]
    )
)
INSERT INTO cars (
  brand_id, model, year, price, mileage, vehicle_condition, fuel_type,
  transmission, body_type, engine_size, color, city, area, description,
  features, status
)
SELECT
  b.id, d.model, d.year, d.price, d.mileage, d.vehicle_condition, d.fuel_type,
  d.transmission, d.body_type, d.engine_size, d.color, d.city, d.area,
  d.description, d.features, 'approved'
FROM demo_cars d
JOIN brands b ON b.name = d.brand_name
WHERE NOT EXISTS (
  SELECT 1
  FROM cars existing
  WHERE existing.brand_id = b.id
    AND existing.model = d.model
    AND existing.year = d.year
    AND existing.city = d.city
    AND existing.area = d.area
    AND existing.description = d.description
);

INSERT INTO car_images (car_id, image_url, is_primary, sort_order)
SELECT c.id, image.image_url, TRUE, 0
FROM (
  VALUES
    ('Toyota', 'Vitz', 2021, 'Addis Ababa', 'Bole', 'Demo listing: fuel-efficient Toyota Vitz for city driving.',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'),
    ('Toyota', 'Hilux', 2020, 'Addis Ababa', 'CMC', 'Demo listing: dependable Toyota Hilux with a practical pickup bed.',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
    ('Ford', 'Ranger', 2021, 'Addis Ababa', 'Kazanchis', 'Demo listing: versatile Ford Ranger for work and weekend travel.',
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80'),
    ('BMW', '320i', 2019, 'Addis Ababa', 'Bole', 'Demo listing: well-kept BMW 320i with a comfortable premium cabin.',
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'),
    ('Hyundai', 'Tucson', 2022, 'Addis Ababa', 'Megenagna', 'Demo listing: spacious Hyundai Tucson suited to family travel.',
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80'),
    ('Honda', 'Civic', 2023, 'Bishoftu', 'Town Center', 'Demo listing: low-mileage certified Honda Civic with CVT transmission.',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'),
    ('Nissan', 'X-Trail', 2020, 'Adama', 'Central', 'Demo listing: practical Nissan X-Trail with room for the whole family.',
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80'),
    ('Kia', 'Sportage', 2022, 'Addis Ababa', 'Summit', 'Demo listing: modern Kia Sportage with a comfortable and spacious cabin.',
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80'),
    ('Tesla', 'Model 3', 2022, 'Addis Ababa', 'Bole', 'Demo listing: fully electric Tesla Model 3 with a minimalist interior.',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'),
    ('Mercedes-Benz', 'C-Class', 2019, 'Addis Ababa', 'Old Airport', 'Demo listing: Mercedes-Benz C-Class offering a refined daily drive.',
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80')
) AS image (brand_name, model, year, city, area, description, image_url)
JOIN brands b ON b.name = image.brand_name
JOIN cars c
  ON c.brand_id = b.id
 AND c.model = image.model
 AND c.year = image.year
 AND c.city = image.city
 AND c.area = image.area
 AND c.description = image.description
ON CONFLICT (car_id, sort_order) DO UPDATE
SET image_url = EXCLUDED.image_url;

COMMIT;
