DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'supplier_type'
  ) THEN
    ALTER TABLE public.suppliers ADD COLUMN supplier_type text NOT NULL DEFAULT '常规供应商';
    ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_supplier_type_check
      CHECK (supplier_type IN ('常规供应商', '电商渠道'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.ecommerce_purchase_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL references public.suppliers(id),
  product_id uuid NOT NULL references public.products(id),
  order_quantity integer NOT NULL CHECK (order_quantity > 0),
  cutting_quantity integer NOT NULL DEFAULT 0 CHECK (cutting_quantity >= 0),
  production_quantity integer NOT NULL DEFAULT 0 CHECK (production_quantity >= 0),
  shipment_quantity integer NOT NULL DEFAULT 0 CHECK (shipment_quantity >= 0),
  return_quantity integer NOT NULL DEFAULT 0 CHECK (return_quantity >= 0),
  platform_merchant_name text NOT NULL,
  record_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ecommerce_purchase_tracking_updated_at'
  ) THEN
    CREATE TRIGGER trg_ecommerce_purchase_tracking_updated_at
    BEFORE UPDATE ON public.ecommerce_purchase_tracking
    FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();
  END IF;
END
$$;

ALTER TABLE public.ecommerce_purchase_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all ecommerce_purchase_tracking" ON public.ecommerce_purchase_tracking;
CREATE POLICY "Allow all ecommerce_purchase_tracking"
ON public.ecommerce_purchase_tracking
FOR ALL
TO public
USING (true)
WITH CHECK (true);