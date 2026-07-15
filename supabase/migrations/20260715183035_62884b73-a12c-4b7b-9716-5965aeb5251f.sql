
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- New signups start with a blank name so onboarding fills it in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  meta_name text;
BEGIN
  meta_name := NULLIF(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Caritas Agência'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organization_id, full_name, onboarding_completed)
  VALUES (NEW.id, new_org_id, meta_name, false);

  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, 'admin', new_org_id);

  RETURN NEW;
END;
$$;
