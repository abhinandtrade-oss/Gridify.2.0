-- Create a storage bucket for images if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow public read access
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'images' );

-- Storage Policy: Allow authenticated uploads
CREATE POLICY "Authenticated Uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'images' );

-- Ensure policies are enabled (rls needs to be enabled on storage.objects, usually is by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
