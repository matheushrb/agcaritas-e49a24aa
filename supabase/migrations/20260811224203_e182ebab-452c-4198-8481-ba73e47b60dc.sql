CREATE POLICY "project files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-files');
CREATE POLICY "project files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');
CREATE POLICY "project files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'project-files');
CREATE POLICY "project files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-files');