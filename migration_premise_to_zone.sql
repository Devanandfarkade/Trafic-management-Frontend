-- ============================================================
-- COMPREHENSIVE MIGRATION: premises -> zones / premise_id -> zone_id
-- STATUS: ALREADY APPLIED on 2026-09-11
-- ============================================================

-- STEP 1: Rename the premises table to zones
ALTER TABLE premises RENAME TO zones;

-- STEP 2: Rename primary key column in zones (was premise_id)
ALTER TABLE zones RENAME COLUMN premise_id TO zone_id;

-- STEP 3: Rename FK column in locations table
ALTER TABLE locations RENAME COLUMN premise_id TO zone_id;

-- STEP 4: Rename FK column in cameras table
ALTER TABLE cameras RENAME COLUMN premise_id TO zone_id;

-- STEP 5: Rename primary key constraint
ALTER INDEX IF EXISTS premises_pkey RENAME TO zones_pkey;

-- STEP 6: Rename the sequence
ALTER SEQUENCE IF EXISTS premises_premise_id_seq RENAME TO zones_zone_id_seq;

-- STEP 7: Rename FK constraint on locations -> zones
ALTER TABLE locations RENAME CONSTRAINT fk_locations_premise TO fk_locations_zone;

-- STEP 8: Rename unique constraint on locations (zone_id, name)
ALTER INDEX IF EXISTS uq_locations_premise_name RENAME TO uq_locations_zone_name;

-- STEP 9: Rename the index on cameras.zone_id
ALTER INDEX IF EXISTS idx_cameras_premise_id RENAME TO idx_cameras_zone_id;

-- STEP 10: Rename the index on locations.zone_id
ALTER INDEX IF EXISTS idx_locations_premise_id RENAME TO idx_locations_zone_id;

-- STEP 11: Rename NOT NULL constraints
ALTER TABLE zones RENAME CONSTRAINT premises_premise_id_not_null TO zones_zone_id_not_null;
ALTER TABLE zones RENAME CONSTRAINT premises_name_not_null TO zones_name_not_null;
ALTER TABLE zones RENAME CONSTRAINT premises_isactive_not_null TO zones_isactive_not_null;
ALTER TABLE locations RENAME CONSTRAINT locations_premise_id_not_null TO locations_zone_id_not_null;

-- STEP 12: Rename unique constraint on zones (was uq_premises_name)
ALTER INDEX IF EXISTS uq_premises_name RENAME TO uq_zones_name;
