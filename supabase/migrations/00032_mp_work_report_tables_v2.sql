-- 生产工单报工小程序数据表

-- 生产流转卡
CREATE TABLE IF NOT EXISTS work_order_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id),
  work_no text UNIQUE NOT NULL,
  qr_text text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- 报工记录
CREATE TABLE IF NOT EXISTS work_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id),
  work_no text NOT NULL,
  process_name text NOT NULL,
  completed_qty integer NOT NULL DEFAULT 0,
  operator_role text,
  remark text,
  created_at timestamptz DEFAULT now()
);

-- 工序质检记录
CREATE TABLE IF NOT EXISTS process_inspection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id),
  work_no text NOT NULL,
  process_name text NOT NULL,
  result text NOT NULL CHECK (result IN ('qualified', 'unqualified')),
  items jsonb DEFAULT '[]'::jsonb,
  remark text,
  created_at timestamptz DEFAULT now()
);

-- 二维码存储 bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('qrcodes', 'qrcodes', true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE work_order_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_inspection_records ENABLE ROW LEVEL SECURITY;

-- 匿名用户无权限
CREATE POLICY "anon_no_work_order_cards" ON work_order_cards
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "anon_no_work_reports" ON work_reports
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "anon_no_process_inspection_records" ON process_inspection_records
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- 已认证用户可读写
CREATE POLICY "auth_all_work_order_cards" ON work_order_cards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_work_reports" ON work_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_process_inspection_records" ON process_inspection_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- storage policies for qrcodes
CREATE POLICY "anon_read_qrcodes" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'qrcodes');
CREATE POLICY "auth_insert_qrcodes" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'qrcodes');
