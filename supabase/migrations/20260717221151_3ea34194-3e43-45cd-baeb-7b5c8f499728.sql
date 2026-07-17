CREATE POLICY "platform icons read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'platform-icons');
CREATE POLICY "platform icons insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'platform-icons');
CREATE POLICY "platform icons update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'platform-icons');
CREATE POLICY "platform icons delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'platform-icons');