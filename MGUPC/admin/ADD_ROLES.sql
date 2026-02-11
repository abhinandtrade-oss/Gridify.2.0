-- 1. Add role column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'volunteer';

-- 2. Add constraint to ensure only valid roles are used
ALTER TABLE admin_users 
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('super admin', 'admin', 'coordinator', 'volunteer'));

-- 3. Set the initial user (you) as super admin (optional but good practice)
-- Replace 'your_admin_email@example.com' with the email you used in FIX_PERMISSIONS.sql if you know it, 
-- otherwise this checks for any existing user and upgrades them if they are the only one, or you can run it manually.
-- For now, we will just leave the default as volunteer for new inserts unless specified.

-- 4. Update the is_admin function if we want to restricted access based on roles later. 
-- For now, the existing is_admin() checks for *presence* in the table. 
-- If we want to restrict "User Management" page to only 'super admin', we might need a new function is_super_admin().

-- Let's create is_super_admin helper for future use or immediate UI protection
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
