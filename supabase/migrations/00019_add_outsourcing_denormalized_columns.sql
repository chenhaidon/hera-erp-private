ALTER TABLE public.outsource_shipments ADD COLUMN IF NOT EXISTS work_order_no text;
ALTER TABLE public.outsource_shipments ADD COLUMN IF NOT EXISTS factory_name text;

ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS shipment_no text;
ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS work_order_no text;
ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS factory_name text;
ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS operation_code text;
ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS inspector text;
ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS defect_reason text;
