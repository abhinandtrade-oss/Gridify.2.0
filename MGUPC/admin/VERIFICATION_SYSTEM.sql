-- Migration: Add verification fields to participants and create verification_setup table

-- 1. Update participants table
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Approved', 'Rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Create verification_setup table
CREATE TABLE IF NOT EXISTS verification_setup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    column_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Initial setup for verification columns
INSERT INTO verification_setup (column_name, display_name) VALUES
('full_name', 'Full Name'),
('college_name', 'College Name'),
('dob', 'Date of Birth'),
('register_number', 'University Register Number'),
('gender', 'Gender'),
('weight_category', 'Weight Category'),
('phone', 'Phone Number'),
('emergency_contact', 'Emergency Contact')
ON CONFLICT (column_name) DO NOTHING;

-- 4. Enable RLS for verification_setup
ALTER TABLE verification_setup ENABLE ROW LEVEL SECURITY;

-- Remove old policies if they exist to avoid errors
DROP POLICY IF EXISTS "Allow authenticated users to read verification_setup" ON verification_setup;
DROP POLICY IF EXISTS "Allow admins to manage verification_setup" ON verification_setup;

-- Allow all authenticated users to read setup (needed for profile page)
CREATE POLICY "Allow authenticated users to read verification_setup" 
ON verification_setup FOR SELECT 
TO authenticated
USING (true);

-- Allow admins to manage verification_setup using the is_admin() helper function
CREATE POLICY "Allow admins to manage verification_setup" 
ON verification_setup FOR ALL 
TO authenticated
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- 5. Update participants policies if needed (though they should already allow admin access if FIX_ADMIN_ACCESS.sql was run)
-- But let's make sure our new columns are manageable
-- Any existing "Admin Full Access" policy on participants likely covers this if it uses 'FOR ALL'.
