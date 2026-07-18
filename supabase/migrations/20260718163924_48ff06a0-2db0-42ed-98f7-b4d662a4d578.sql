
CREATE TABLE public.dashboard_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_news TO authenticated;
GRANT ALL ON public.dashboard_news TO service_role;

ALTER TABLE public.dashboard_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read org news"
  ON public.dashboard_news FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY "Admins/managers write org news"
  ON public.dashboard_news FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER dashboard_news_updated_at
  BEFORE UPDATE ON public.dashboard_news
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Auth read dashboard-news"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dashboard-news');

CREATE POLICY "Auth upload dashboard-news"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dashboard-news');

CREATE POLICY "Auth update dashboard-news"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dashboard-news');

CREATE POLICY "Auth delete dashboard-news"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dashboard-news');
