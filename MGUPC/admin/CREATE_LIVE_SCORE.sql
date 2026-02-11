-- Create live_scores table
CREATE TABLE IF NOT EXISTS public.live_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_name TEXT NOT NULL UNIQUE,
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    score1 TEXT DEFAULT '0',
    score2 TEXT DEFAULT '0',
    status TEXT DEFAULT 'Ongoing', -- Ongoing, Completed, Upcoming
    winner_name TEXT,
    event_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_scores ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.live_scores
    FOR SELECT USING (true);

-- Allow authenticated users (admins) full access
CREATE POLICY "Allow admins full access" ON public.live_scores
    FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_scores;
