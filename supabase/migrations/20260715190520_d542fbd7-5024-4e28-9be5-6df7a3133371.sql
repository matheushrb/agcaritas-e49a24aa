CREATE TABLE public.dashboard_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_preferences TO authenticated;
GRANT ALL ON public.dashboard_preferences TO service_role;

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboard preferences"
ON public.dashboard_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER dashboard_preferences_set_updated_at
BEFORE UPDATE ON public.dashboard_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();