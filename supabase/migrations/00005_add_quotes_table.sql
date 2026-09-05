-- 报价单表
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_name text,
  contact text,
  phone text,
  currency text DEFAULT 'CNY',
  exchange_rate numeric(10,4) DEFAULT 1,
  items jsonb DEFAULT '[]'::jsonb,
  total_amount numeric(14,2) DEFAULT 0,
  effective_date date,
  expiry_date date,
  status text DEFAULT 'draft',
  remark text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  converted_order_id uuid REFERENCES sales_orders(id),
  created_at timestamptz DEFAULT now()
);

-- 管理员角色判断辅助函数
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' = 'admin'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
$$;

-- RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- 匿名用户：仅查看已审批报价
CREATE POLICY "quotes_anon_select"
  ON quotes FOR SELECT TO anon USING (status = 'approved');

-- 已认证用户：全部操作
CREATE POLICY "quotes_auth_all"
  ON quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 管理员：全部操作（兜底）
CREATE POLICY "quotes_admin_all"
  ON quotes FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());