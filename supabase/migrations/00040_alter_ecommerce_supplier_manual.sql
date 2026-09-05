ALTER TABLE public.ecommerce_purchase_tracking
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ALTER COLUMN supplier_id DROP NOT NULL;

UPDATE public.ecommerce_purchase_tracking
SET supplier_name = COALESCE(
  (SELECT name FROM public.suppliers WHERE public.suppliers.id = public.ecommerce_purchase_tracking.supplier_id),
  ''
)
WHERE supplier_name IS NULL OR supplier_name = '';