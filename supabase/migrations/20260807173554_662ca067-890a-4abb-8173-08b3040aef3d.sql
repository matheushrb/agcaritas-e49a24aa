ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS service_label text;

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ym text; next_seq int; used int[]; i int;
BEGIN
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF NEW.number IS NULL OR NEW.number = '' THEN
    ym := to_char(COALESCE(NEW.issue_date, CURRENT_DATE), 'YYYYMM');
    SELECT COALESCE(array_agg(substring(number from 7)::int ORDER BY substring(number from 7)::int), '{}')
      INTO used
    FROM public.invoices
    WHERE organization_id = NEW.organization_id
      AND number ~ '^[0-9]{6}[0-9]{3,}$';

    next_seq := 140;
    FOREACH i IN ARRAY used LOOP
      IF i < next_seq THEN CONTINUE; END IF;
      IF i = next_seq THEN next_seq := next_seq + 1; END IF;
    END LOOP;

    NEW.number := ym || LPAD(next_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;