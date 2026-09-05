ALTER TABLE public.ecommerce_purchase_tracking
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_specification text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ALTER COLUMN product_id DROP NOT NULL;

UPDATE public.ecommerce_purchase_tracking
SET product_name = COALESCE(
  (SELECT name FROM public.products WHERE public.products.id = public.ecommerce_purchase_tracking.product_id),
  ''
)
WHERE product_name IS NULL;

ALTER TABLE public.ecommerce_purchase_tracking
  ALTER COLUMN product_name SET NOT NULL;