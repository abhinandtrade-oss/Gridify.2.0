-- Add previous_data column to products table for storing version history
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'previous_data') THEN
        ALTER TABLE products ADD COLUMN previous_data JSONB;
    END IF;
END $$;
