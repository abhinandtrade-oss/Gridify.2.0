-- 1. Create live_scores table (Matches/Categories)
CREATE TABLE IF NOT EXISTS public.live_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_name TEXT NOT NULL UNIQUE,
    player1_name TEXT DEFAULT 'TBD',
    player2_name TEXT DEFAULT 'TBD',
    score1 TEXT DEFAULT '0',
    score2 TEXT DEFAULT '0',
    status TEXT DEFAULT 'Upcoming', -- Ongoing, Completed, Upcoming
    winner_name TEXT,
    event_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create score_logs table (Live Updates)
CREATE TABLE IF NOT EXISTS public.score_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID REFERENCES public.live_scores(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    candidate_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    score_update TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.live_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies for live_scores
DROP POLICY IF EXISTS "Public read access live_scores" ON public.live_scores;
CREATE POLICY "Public read access live_scores" ON public.live_scores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin full access live_scores" ON public.live_scores;
CREATE POLICY "Admin full access live_scores" ON public.live_scores
    FOR ALL USING (auth.role() = 'authenticated');

-- 5. Policies for score_logs
DROP POLICY IF EXISTS "Public read access score_logs" ON public.score_logs;
CREATE POLICY "Public read access score_logs" ON public.score_logs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin full access score_logs" ON public.score_logs;
CREATE POLICY "Admin full access score_logs" ON public.score_logs
    FOR ALL USING (auth.role() = 'authenticated');

-- 6. Enable Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.live_scores, public.score_logs;
COMMIT;

-- 7. Ensure Unique Constraint on match_name exists (fix for ON CONFLICT error)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.conname = 'live_scores_match_name_key' AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.live_scores ADD CONSTRAINT live_scores_match_name_key UNIQUE (match_name);
    END IF;
END $$;

-- 8. Initialize Matches dynamically from weight_categories
-- 8. Initialize Matches dynamically from weight_categories
INSERT INTO public.live_scores (match_name, player1_name, player2_name, status, event_details)
SELECT 
    (gender || ' ' || name) as match_name,
    'TBD',
    'TBD',
    'Upcoming',
    'Session Pending'
FROM public.weight_categories
ON CONFLICT (match_name) DO NOTHING;
