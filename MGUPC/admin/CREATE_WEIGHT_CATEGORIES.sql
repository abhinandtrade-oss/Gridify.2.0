-- Create weight_categories table
CREATE TABLE IF NOT EXISTS public.weight_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    gender TEXT NOT NULL, -- Men, Women
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weight_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.weight_categories
    FOR SELECT USING (true);

-- Allow authenticated users (admins) full access
CREATE POLICY "Allow admins full access" ON public.weight_categories
    FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.weight_categories;

-- Initial data based on standard categories previous seen
INSERT INTO public.weight_categories (name, gender) VALUES
('59kg', 'Men'), ('66kg', 'Men'), ('74kg', 'Men'), ('83kg', 'Men'), ('93kg', 'Men'), ('105kg', 'Men'), ('120kg', 'Men'), ('120+kg', 'Men'),
('47kg', 'Women'), ('52kg', 'Women'), ('57kg', 'Women'), ('63kg', 'Women'), ('72kg', 'Women'), ('84kg', 'Women'), ('84+kg', 'Women')
ON CONFLICT (name) DO NOTHING;
