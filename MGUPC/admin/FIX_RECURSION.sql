/* 
   IMPORTANT: RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX THE "INFINITE RECURSION" ERROR.

   This script cleans up all policies and functions related to permissions and re-establishes them 
   correctly using SECURITY DEFINER to prevent loops.
*/

-- 1. Drop existing policies to clear the conflict
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Admins can add new admins" ON admin_users;
DROP POLICY IF EXISTS "Allow read own" ON admin_users;
DROP POLICY IF EXISTS "Admin Full Access" ON participants;
DROP POLICY IF EXISTS "Admin Full Access Colleges" ON colleges;
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_super_admin();

-- 2. Ensure admin_users table is correct
CREATE TABLE IF NOT EXISTS admin_users (
    email TEXT PRIMARY KEY,
    role TEXT DEFAULT 'volunteer' CHECK (role IN ('super admin', 'admin', 'coordinator', 'volunteer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Re-create Helper Functions with SECURITY DEFINER
-- SECURITY DEFINER means the function runs with the privileges of the CREATOR (you/postgres),
-- effectively bypassing RLS on the table it queries to avoid the recursion loop.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Runs as table owner, bypassing RLS
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
  -- Runs as table owner, bypassing RLS
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE email = (auth.jwt() ->> 'email')
    AND role = 'super admin'
  );
END;
$$;

-- 4. Define Policies for ADMIN_USERS
-- Policy A: Allow users to read their own row (Helper for frontend, and technically safe)
CREATE POLICY "Allow read own"
ON admin_users FOR SELECT
TO authenticated
USING ( email = (auth.jwt() ->> 'email') );

-- Policy B: Admins can view ALL admin users
CREATE POLICY "Admins can view admin list"
ON admin_users FOR SELECT
TO authenticated
USING ( is_admin() );

-- Policy C: Only Super Admins (or Admins?) can INSERT/UPDATE/DELETE
-- Let's allow 'admin' and 'super admin' to manage users for now based on your UI
CREATE POLICY "Admins can manage admins"
ON admin_users FOR ALL
TO authenticated
USING ( is_admin() )
WITH CHECK ( is_admin() );


-- 5. Define Policies for PARTICIPANTS (referencing is_admin)
-- Clean up old potentially conflicting policies
DROP POLICY IF EXISTS "Public Read" ON participants;
DROP POLICY IF EXISTS "User Insert" ON participants;

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

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


-- 6. Define Policies for COLLEGES
DROP POLICY IF EXISTS "Public Read Colleges" ON colleges;
DROP POLICY IF EXISTS "Admin Full Access Colleges" ON colleges;

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Colleges" 
ON colleges FOR SELECT 
USING (true);

CREATE POLICY "Admin Full Access Colleges" 
ON colleges FOR ALL 
TO authenticated 
USING ( is_admin() )
WITH CHECK ( is_admin() );


-- 7. Grant permissions to public/authenticated just in case
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
