ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS accounting_nature text;

UPDATE public.charges
   SET accounting_nature = CASE WHEN COALESCE(nature, 'revenue') = 'expense' THEN 'custo_variavel' ELSE 'recebimento_cliente' END
 WHERE accounting_nature IS NULL;