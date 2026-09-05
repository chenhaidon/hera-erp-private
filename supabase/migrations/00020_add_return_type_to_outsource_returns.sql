ALTER TABLE public.outsource_returns ADD COLUMN IF NOT EXISTS return_type text NOT NULL DEFAULT 'finished' CHECK (return_type IN ('semi_finished', 'finished'));
