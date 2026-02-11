-- Create a table for live score updates/logs
CREATE TABLE IF NOT EXISTS public.score_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID REFERENCES public.live_scores(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL, -- Storing name directly for snapshot
    candidate_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    score_update TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.score_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access" ON public.score_logs
    FOR SELECT USING (true);

CREATE POLICY "Admin full access" ON public.score_logs
    FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.score_logs;

-- Add a column to live_scores to track current active slide if needed, 
-- or just query score_logs descending.
