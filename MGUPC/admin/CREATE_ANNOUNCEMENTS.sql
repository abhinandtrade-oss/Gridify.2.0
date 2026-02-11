-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('text', 'image')),
    content TEXT NOT NULL,
    link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.announcements
    FOR SELECT USING (is_active = true);

-- Allow admins full access (using service role or if we have an auth check)
CREATE POLICY "Allow admins full access" ON public.announcements
    FOR ALL USING (auth.role() = 'authenticated');
