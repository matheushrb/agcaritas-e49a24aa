CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.team_members (organization_id, user_id, name, email, role, status, cost_mode, monthly_hours)
  VALUES (new_org_id, NEW.id, COALESCE(meta_name, split_part(NEW.email, '@', 1)), NEW.email, 'Administrador', 'active', 'internal_fixed', 160);

  RETURN NEW;
END;
$function$;