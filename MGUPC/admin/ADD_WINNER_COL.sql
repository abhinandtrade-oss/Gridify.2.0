-- Add winner_name column to live_scores table
ALTER TABLE public.live_scores ADD COLUMN IF NOT EXISTS winner_name TEXT;
