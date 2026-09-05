CREATE TABLE IF NOT EXISTS public.outsource_processing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL references public.work_orders(id),
  work_order_no text,
  operation_code text,
  operation_name text,
  product_code text NOT NULL,
  product_name text NOT NULL,
  product_spec text,
  product_color text,
  factory_id uuid NOT NULL references public.outsource_factories(id),
  factory_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid')),
  payment_date date,
  payment_amount numeric,
  payment_method text,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_outsource_processing_payments_updated_at'
  ) THEN
    CREATE TRIGGER trg_outsource_processing_payments_updated_at
    BEFORE UPDATE ON public.outsource_processing_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();
  END IF;
END
$$;

ALTER TABLE public.outsource_processing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all outsource_processing_payments" ON public.outsource_processing_payments;
CREATE POLICY "Allow all outsource_processing_payments"
ON public.outsource_processing_payments
FOR ALL
TO public
USING (true)
WITH CHECK (true);