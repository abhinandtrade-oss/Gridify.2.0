-- Create sponsors table
CREATE TABLE IF NOT EXISTS public.sponsors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    website_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.sponsors
    FOR SELECT USING (is_active = true);

-- Allow admins full access (using service role or if we have an auth check)
-- For now, we'll assume the admin authenticated via Supabase Auth is doing the operations
CREATE POLICY "Allow admins full access" ON public.sponsors
    FOR ALL USING (auth.role() = 'authenticated');
