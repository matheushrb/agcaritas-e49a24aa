CREATE OR REPLACE FUNCTION public.assign_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ym text; next_seq int;
BEGIN
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF NEW.number IS NULL OR NEW.number = '' THEN
    ym := to_char(COALESCE(NEW.issue_date, CURRENT_DATE), 'YYYYMM');
    SELECT COALESCE(MAX(substring(number from 7)::int), 139) + 1
      INTO next_seq
    FROM public.invoices
    WHERE organization_id = NEW.organization_id
      AND number ~ '^[0-9]{6}[0-9]{3,}$';
    NEW.number := ym || LPAD(next_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;