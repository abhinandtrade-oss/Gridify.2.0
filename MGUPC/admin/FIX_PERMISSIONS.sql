/* 
   IMPORTANT: RUN THIS SCRIPT IN YOUR SUPABASE DASHBOARD -> SQL EDITOR 
   
   FIX 3.0: Solves "Infinite Recursion" error.
   
   The previous error happened because the policy was checking the 'admin_users' table 
   while trying to read from the 'admin_users' table, creating an infinite loop.
   We fix this by using a special "Security Definer" function.

   INSTRUCTIONS:
   1. Copy this entire script.
   2. Go to Supabase > SQL Editor.
   3. REPLACE 'your_admin_email@example.com' with your actual email address in the INSERT statement below.
   4. Run the script.
*/

-- 1. Create table for admin emails
CREATE TABLE IF NOT EXISTS admin_users (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Create Helper Function to Check Admin Status
-- This function runs with high privileges (SECURITY DEFINER) to safely check the table
-- without causing a permission loop (recursion).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE email = (auth.jwt() ->> 'email')
  );
END;
$$;

-- 4. Clean up old policies to ensure a fresh start
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Admins can add new admins" ON admin_users;
DROP POLICY IF EXISTS "Admin Full Access" ON participants;
DROP POLICY IF EXISTS "Admin Full Access Colleges" ON colleges;
-- Clean up potentially conflicting policies from previous attempts
DROP POLICY IF EXISTS "Public Read" ON participants;
DROP POLICY IF EXISTS "User Insert" ON participants;
DROP POLICY IF EXISTS "Public Read Colleges" ON colleges;


-- 5. Define Policies for ADMIN_USERS table
-- Only people who pass checks in is_admin() can view the list
CREATE POLICY "Admins can view admin list" 
ON admin_users FOR SELECT 
TO authenticated 
USING ( is_admin() );

-- Only admins can add new admins
CREATE POLICY "Admins can add new admins" 
ON admin_users FOR INSERT 
TO authenticated 
WITH CHECK ( is_admin() );


-- 6. Add YOUR Initial Admin Email (IMPORTANT: CHANGE THIS)
INSERT INTO admin_users (email) 
VALUES ('your_admin_email@example.com')
ON CONFLICT (email) DO NOTHING;


-- 7. Define Policies for PARTICIPANTS table
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Public Read (Leaderboard)
CREATE POLICY "Public Read" 
ON participants FOR SELECT 
USING (true);

-- User Insert (Registration)
CREATE POLICY "User Insert" 
ON participants FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Admin Full Access (Using the new safe function)
CREATE POLICY "Admin Full Access" 
ON participants FOR ALL 
TO authenticated 
USING ( is_admin() )
WITH CHECK ( is_admin() );


-- 8. Define Policies for COLLEGES table
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;

-- Public Read
CREATE POLICY "Public Read Colleges" 
ON colleges FOR SELECT 
USING (true);

-- Admin Full Access
CREATE POLICY "Admin Full Access Colleges" 
ON colleges FOR ALL 
TO authenticated 
USING ( is_admin() )
WITH CHECK ( is_admin() );
