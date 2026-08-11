CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  folder text,
  item_type text NOT NULL DEFAULT 'file',
  storage_path text,
  external_url text,
  mime_type text,
  size_bytes bigint,
  version text NOT NULL DEFAULT 'v1',
  tags text[] NOT NULL DEFAULT '{}',
  description text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage project files"
ON public.project_files FOR ALL TO authenticated
USING (organization_id = public.current_organization_id())
WITH CHECK (organization_id = public.current_organization_id());

CREATE INDEX project_files_project_idx ON public.project_files(project_id);

CREATE TRIGGER project_files_set_updated_at
BEFORE UPDATE ON public.project_files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();