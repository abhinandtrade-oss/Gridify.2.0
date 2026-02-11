-- Insert standard MGUPC weight categories into the live_scores table
-- These are based on the categories used in the registration form

INSERT INTO public.live_scores (match_name, player1_name, player2_name, score1, score2, status, event_details)
VALUES 
    ('Men 59kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 66kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 74kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 83kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 93kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 105kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 120kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Men 120+kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 47kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 52kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 57kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 63kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 72kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 84kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending'),
    ('Women 84+kg', 'TBD', 'TBD', '0', '0', 'Upcoming', 'Session pending')
ON CONFLICT (match_name) DO NOTHING; -- Ensure we don't duplicate if they already exist
