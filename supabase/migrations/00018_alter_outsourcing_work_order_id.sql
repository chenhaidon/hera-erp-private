ALTER TABLE public.outsource_shipments DROP CONSTRAINT IF EXISTS outsource_shipments_work_order_id_fkey;
ALTER TABLE public.outsource_returns DROP CONSTRAINT IF EXISTS outsource_returns_work_order_id_fkey;

ALTER TABLE public.outsource_shipments ALTER COLUMN work_order_id TYPE text;
ALTER TABLE public.outsource_returns ALTER COLUMN work_order_id TYPE text;
