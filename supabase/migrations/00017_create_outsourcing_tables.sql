CREATE TABLE public.outsource_factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_name text NOT NULL,
  contact_person text NOT NULL,
  contact_phone text NOT NULL,
  processing_capability text,
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

CREATE TABLE public.outsource_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_no text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL references public.work_orders(id),
  operation_code text,
  operation_name text,
  product_code text NOT NULL,
  product_name text NOT NULL,
  factory_id uuid NOT NULL references public.outsource_factories(id),
  shipment_date date NOT NULL,
  shipment_quantity integer NOT NULL CHECK (shipment_quantity > 0),
  logistics_company text,
  logistics_no text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'returning', 'returned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

CREATE TABLE public.outsource_shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL references public.outsource_shipments(id) ON DELETE CASCADE,
  material_code text NOT NULL,
  material_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.outsource_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no text NOT NULL UNIQUE,
  shipment_id uuid NOT NULL references public.outsource_shipments(id),
  work_order_id uuid NOT NULL references public.work_orders(id),
  product_code text NOT NULL,
  product_name text NOT NULL,
  factory_id uuid NOT NULL references public.outsource_factories(id),
  return_date date NOT NULL,
  return_quantity integer NOT NULL CHECK (return_quantity > 0),
  qualified_quantity integer NOT NULL DEFAULT 0 CHECK (qualified_quantity >= 0),
  defective_quantity integer NOT NULL DEFAULT 0 CHECK (defective_quantity >= 0),
  inspection_status text NOT NULL DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'inspecting', 'qualified', 'unqualified')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'returned', 'stored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

CREATE TABLE public.outsource_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL references public.outsource_returns(id) ON DELETE CASCADE,
  material_code text NOT NULL,
  material_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.set_outsourcing_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outsource_factories_updated_at BEFORE UPDATE ON public.outsource_factories FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();
CREATE TRIGGER trg_outsource_shipments_updated_at BEFORE UPDATE ON public.outsource_shipments FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();
CREATE TRIGGER trg_outsource_shipment_items_updated_at BEFORE UPDATE ON public.outsource_shipment_items FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();
CREATE TRIGGER trg_outsource_returns_updated_at BEFORE UPDATE ON public.outsource_returns FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();
CREATE TRIGGER trg_outsource_return_items_updated_at BEFORE UPDATE ON public.outsource_return_items FOR EACH ROW EXECUTE FUNCTION public.set_outsourcing_updated_at();

ALTER TABLE public.outsource_factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outsource_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outsource_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outsource_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outsource_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outsource_factories_select_anon" ON public.outsource_factories FOR SELECT TO anon USING (true);
CREATE POLICY "outsource_factories_all_authenticated" ON public.outsource_factories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "outsource_shipments_select_anon" ON public.outsource_shipments FOR SELECT TO anon USING (true);
CREATE POLICY "outsource_shipments_all_authenticated" ON public.outsource_shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "outsource_shipment_items_select_anon" ON public.outsource_shipment_items FOR SELECT TO anon USING (true);
CREATE POLICY "outsource_shipment_items_all_authenticated" ON public.outsource_shipment_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "outsource_returns_select_anon" ON public.outsource_returns FOR SELECT TO anon USING (true);
CREATE POLICY "outsource_returns_all_authenticated" ON public.outsource_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "outsource_return_items_select_anon" ON public.outsource_return_items FOR SELECT TO anon USING (true);
CREATE POLICY "outsource_return_items_all_authenticated" ON public.outsource_return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.outsource_factories (factory_name, contact_person, contact_phone, processing_capability, status)
VALUES ('浦江绣花外协厂', '张工', '13800138000', '绣花、特种绗缝', 'enabled');
