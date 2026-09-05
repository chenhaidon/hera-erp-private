ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS contract_no text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS contract_no text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS request_code text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';