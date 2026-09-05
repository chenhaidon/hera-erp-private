ALTER TABLE public.process_routes ADD COLUMN status text DEFAULT 'active';
UPDATE public.process_routes SET status = 'active' WHERE status IS NULL;
ALTER TABLE public.process_routes ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.process_routes ALTER COLUMN status SET DEFAULT 'active';