/* 
   IMPORTANT: RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX PERMISSIONS AND RESTORE ACCESS.
   
   This script does 3 things:
   1. Fixes the "Infinite Recursion" error by using SECURITY DEFINER functions.
   2. Clears ALL old policies (including Public Read) to avoid "already exists" errors.
   3. INSERTS your admin user (admin@gridify.in) into the table so you can actually use the system.
*/

-- 1. Reset Policies to avoid conflicts - DROPPING EVERYTHING FIRST
-- Admin Users Table
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Admins can add new admins" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage admins" ON admin_users;
DROP POLICY IF EXISTS "Allow read own" ON admin_users;

-- Participants Table
DROP POLICY IF EXISTS "Admin Full Access" ON participants;
DROP POLICY IF EXISTS "Public Read" ON participants;
DROP POLICY IF EXISTS "User Insert" ON participants;

-- Colleges Table
DROP POLICY IF EXISTS "Admin Full Access Colleges" ON colleges;
DROP POLICY IF EXISTS "Public Read Colleges" ON colleges;
DROP POLICY IF EXISTS "Public Read" ON colleges; -- Just in case of naming variation

-- 2. Update functions to prevent infinite recursion
-- The SECURITY DEFINER clause is Critical here.
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

CREATE OR REPLACE FUNCTION public.is_super_admin()
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
    AND role = 'super admin'
  );
END;
$$;

-- 3. Update Table Structure (if needed)
CREATE TABLE IF NOT EXISTS admin_users (
    email TEXT PRIMARY KEY,
    role TEXT DEFAULT 'volunteer' CHECK (role IN ('super admin', 'admin', 'coordinator', 'volunteer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Force add the role column if it was missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='role') THEN
        ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'volunteer';
        ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('super admin', 'admin', 'coordinator', 'volunteer'));
    END IF;
END $$;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 4. INSERT THE INITIAL ADMIN (CRITICAL STEP)
-- We insert 'admin@gridify.in' as a super admin. 
-- This ensures that is_admin() returns TRUE for you, allowing you to bypass the RLS policies.
INSERT INTO admin_users (email, role)
VALUES ('admin@gridify.in', 'super admin')
ON CONFLICT (email) 
DO UPDATE SET role = 'super admin';

-- 5. Re-apply Policies using the safe is_admin() function

-- A. Policies for admin_users table
CREATE POLICY "Allow read own"
ON admin_users FOR SELECT
TO authenticated
USING ( email = (auth.jwt() ->> 'email') );

CREATE POLICY "Admins can manage admins"
ON admin_users FOR ALL
TO authenticated
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- B. Policies for participants table
CREATE POLICY "Public Read" 
ON participants FOR SELECT 
USING (true);

CREATE POLICY "User Insert" 
ON participants FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin Full Access" 
ON participants FOR ALL 
TO authenticated 
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- C. Policies for colleges table
CREATE POLICY "Public Read Colleges" 
ON colleges FOR SELECT 
USING (true);

CREATE POLICY "Admin Full Access Colleges" 
ON colleges FOR ALL 
TO authenticated 
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- 6. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
