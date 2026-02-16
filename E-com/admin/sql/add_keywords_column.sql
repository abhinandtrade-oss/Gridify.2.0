-- Add keywords column to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'keywords') THEN
        ALTER TABLE products ADD COLUMN keywords TEXT;
    END IF;
END $$;
