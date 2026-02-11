-- Migration: Add support for custom verification questions/steps (FIXED)

-- 1. Add 'type' column to distinguish between registration fields and custom steps
ALTER TABLE verification_setup 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'field' CHECK (type IN ('field', 'custom'));

-- 2. Update existing records to 'field' type
UPDATE verification_setup SET type = 'field' WHERE type IS NULL;

-- 3. Relax UNIQUE constraint on column_name to allow NULL for custom steps
-- We drop the constraint and create a partial unique index instead
ALTER TABLE verification_setup ALTER COLUMN column_name DROP NOT NULL;

-- Dropping the constraint (which also drops the backing index)
ALTER TABLE verification_setup DROP CONSTRAINT IF EXISTS verification_setup_column_name_key;

-- Create a unique index that only applies to non-null values (partial index)
-- This allows multiple 'custom' steps (which have NULL column_name) 
-- while still ensuring registration fields aren't duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS verification_setup_column_name_idx 
ON verification_setup (column_name) 
WHERE column_name IS NOT NULL;
