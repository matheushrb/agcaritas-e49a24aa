
CREATE TABLE public.client_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_segments TO authenticated;
GRANT ALL ON public.client_segments TO service_role;

ALTER TABLE public.client_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage segments of their org"
  ON public.client_segments FOR ALL
  TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER client_segments_updated_at
  BEFORE UPDATE ON public.client_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults for existing organizations
INSERT INTO public.client_segments (organization_id, name)
SELECT o.id, s.name
FROM public.organizations o
CROSS JOIN (VALUES
  ('Tecnologia'),('Saúde'),('Educação'),('Varejo'),('Alimentação'),('Construção'),
  ('Financeiro'),('Jurídico'),('Marketing'),('Moda'),('Beleza'),('Automotivo'),
  ('Imobiliário'),('Entretenimento'),('Indústria'),('Serviços'),('Outro')
) AS s(name)
ON CONFLICT DO NOTHING;
