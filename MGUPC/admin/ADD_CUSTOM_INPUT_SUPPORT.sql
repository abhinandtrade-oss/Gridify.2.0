-- Migration: Add input_type to verification steps

-- 1. Add 'input_type' column to verification_setup
ALTER TABLE verification_setup 
ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'checkbox' CHECK (input_type IN ('checkbox', 'text'));

-- 2. Update existing records
UPDATE verification_setup SET input_type = 'checkbox' WHERE input_type IS NULL;

-- 3. Add column to store custom responses in participants table
-- Since the quantity of custom steps might vary, we can store them in a JSONB column
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS verification_responses JSONB DEFAULT '{}';
