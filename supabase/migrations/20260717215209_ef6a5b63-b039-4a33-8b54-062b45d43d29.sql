
-- ============================================================
-- project_types
-- ============================================================
CREATE TABLE public.project_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  slug text,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'Folder',
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_types TO authenticated;
GRANT ALL ON public.project_types TO service_role;

ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage project_types"
  ON public.project_types FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_project_types_updated_at
  BEFORE UPDATE ON public.project_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- platforms
-- ============================================================
CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  slug text,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'Globe',
  category text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;

ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage platforms"
  ON public.platforms FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_platforms_updated_at
  BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Seed default project_types + platforms for every existing org
-- ============================================================
INSERT INTO public.project_types (organization_id, name, slug, color, icon, sort_order)
SELECT o.id, x.name, x.slug, x.color, x.icon, x.ord
FROM public.organizations o
CROSS JOIN (VALUES
  ('Marketing Digital', 'marketing',   '#3B82F6', 'Megaphone', 1),
  ('Social Media',      'social_media','#EC4899', 'Share2',    2),
  ('Tráfego Pago',      'traffic',     '#F59E0B', 'Target',    3),
  ('Branding',          'branding',    '#8B5CF6', 'Palette',   4),
  ('Site / Landing',    'web',         '#10B981', 'Globe',     5),
  ('Conteúdo / Copy',   'content',     '#06B6D4', 'PenTool',   6),
  ('Consultoria',       'consulting',  '#64748B', 'Briefcase', 7)
) AS x(name, slug, color, icon, ord);

INSERT INTO public.platforms (organization_id, name, slug, color, icon, category, sort_order)
SELECT o.id, x.name, x.slug, x.color, x.icon, x.cat, x.ord
FROM public.organizations o
CROSS JOIN (VALUES
  ('Instagram',   'instagram',  '#E1306C', 'Instagram', 'Rede social', 1),
  ('TikTok',      'tiktok',     '#000000', 'Music2',    'Rede social', 2),
  ('YouTube',     'youtube',    '#FF0000', 'Youtube',   'Rede social', 3),
  ('Facebook',    'facebook',   '#1877F2', 'Facebook',  'Rede social', 4),
  ('LinkedIn',    'linkedin',   '#0A66C2', 'Linkedin',  'Rede social', 5),
  ('X (Twitter)', 'x',          '#000000', 'Twitter',   'Rede social', 6),
  ('Threads',     'threads',    '#000000', 'AtSign',    'Rede social', 7),
  ('Pinterest',   'pinterest',  '#E60023', 'Image',     'Rede social', 8),
  ('Kwai',        'kwai',       '#FF6600', 'Video',     'Rede social', 9),
  ('Snapchat',    'snapchat',   '#FFFC00', 'Ghost',     'Rede social', 10),
  ('WhatsApp',    'whatsapp',   '#25D366', 'MessageCircle', 'Mensageria', 11),
  ('Telegram',    'telegram',   '#26A5E4', 'Send',      'Mensageria',  12),
  ('Site / Blog', 'site',       '#10B981', 'Globe',     'Web',         13),
  ('E-mail',      'email',      '#6366F1', 'Mail',      'Web',         14),
  ('Meta Ads',    'meta_ads',   '#1877F2', 'Target',    'Mídia paga',  15),
  ('Google Ads',  'google_ads', '#4285F4', 'Target',    'Mídia paga',  16),
  ('TikTok Ads',  'tiktok_ads', '#000000', 'Target',    'Mídia paga',  17),
  ('LinkedIn Ads','linkedin_ads','#0A66C2','Target',    'Mídia paga',  18)
) AS x(name, slug, color, icon, cat, ord);
