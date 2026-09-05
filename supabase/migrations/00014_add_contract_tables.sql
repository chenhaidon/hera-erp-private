-- 合同主表
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT '',
  customer_id text,
  customer_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  customer_address text NOT NULL DEFAULT '',
  contract_type text NOT NULL DEFAULT 'domestic' CHECK (contract_type IN ('domestic','export','processing')),
  customer_level text NOT NULL DEFAULT 'normal' CHECK (customer_level IN ('normal','vip','strategic')),
  quotation_id text,
  quotation_no text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CNY',
  sign_date date,
  effective_date date,
  delivery_date date,
  actual_delivery_date date,
  payment_terms text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','effective','executing','completed','terminated')),
  sign_method text,
  sign_date_record date,
  signer text,
  signed_file_url text,
  remark text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT 'V1.0',
  parent_contract_id uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  performance_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  version_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reminders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 合同模板表
CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contract_type text NOT NULL DEFAULT 'domestic' CHECK (contract_type IN ('domestic','export','processing')),
  customer_level text NOT NULL DEFAULT 'normal' CHECK (customer_level IN ('normal','vip','strategic')),
  clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 合同提醒记录表
CREATE TABLE IF NOT EXISTS contract_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  content text NOT NULL,
  trigger_date date NOT NULL,
  status text NOT NULL DEFAULT 'unsent' CHECK (status IN ('unsent','sent')),
  receiver text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_reminders ENABLE ROW LEVEL SECURITY;

-- 匿名用户
CREATE POLICY "anon_select_contracts" ON contracts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_contracts" ON contracts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_contracts" ON contracts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_contracts" ON contracts FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_contract_templates" ON contract_templates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_contract_templates" ON contract_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_contract_templates" ON contract_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_contract_templates" ON contract_templates FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_contract_reminders" ON contract_reminders FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_contract_reminders" ON contract_reminders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_contract_reminders" ON contract_reminders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_contract_reminders" ON contract_reminders FOR DELETE TO anon USING (true);

-- 已认证用户
CREATE POLICY "auth_select_contracts" ON contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_contracts" ON contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_contracts" ON contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_contracts" ON contracts FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_contract_templates" ON contract_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_contract_templates" ON contract_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_contract_templates" ON contract_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_contract_templates" ON contract_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_contract_reminders" ON contract_reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_contract_reminders" ON contract_reminders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_contract_reminders" ON contract_reminders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_contract_reminders" ON contract_reminders FOR DELETE TO authenticated USING (true);

-- 服务角色管理员
CREATE POLICY "service_all_contracts" ON contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_contract_templates" ON contract_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_contract_reminders" ON contract_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
