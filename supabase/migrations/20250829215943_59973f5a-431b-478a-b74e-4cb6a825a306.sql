-- Create storage bucket for club assets
INSERT INTO storage.buckets (id, name, public) VALUES ('club-assets', 'club-assets', true);

-- Create policies for club asset uploads
CREATE POLICY "Club assets are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'club-assets');

CREATE POLICY "Club admins can upload assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'club-assets' 
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    JOIN public.club_members cm ON c.id = cm.club_id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

CREATE POLICY "Club admins can update their assets" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'club-assets' 
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    JOIN public.club_members cm ON c.id = cm.club_id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

CREATE POLICY "Club admins can delete their assets" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'club-assets' 
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    JOIN public.club_members cm ON c.id = cm.club_id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);