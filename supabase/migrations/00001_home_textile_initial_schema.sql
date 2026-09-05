-- 浦江家纺智造管理平台 - 基础数据表
-- 使用 JSONB 存放列表型数据，减少表数量

-- 成品档案
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  fabric_type text,
  fabric_composition text,
  lining_type text,
  filling_type text,
  filling_weight integer,
  sizes jsonb DEFAULT '[]'::jsonb,
  quilt_process text,
  quilt_pattern text,
  standard text,
  standard_hours integer,
  process_list jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 客户
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  phone text,
  address text,
  country text,
  cooperation_years integer DEFAULT 0,
  credit_level text,
  customer_type text,
  created_at timestamptz DEFAULT now()
);

-- 销售订单
CREATE TABLE sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text UNIQUE NOT NULL,
  order_type text NOT NULL,
  channel text,
  customer_id uuid REFERENCES customers(id),
  customer_name text,
  currency text DEFAULT 'CNY',
  trade_term text,
  destination text,
  delivery_date date,
  total_amount numeric(14,2) DEFAULT 0,
  status text DEFAULT 'pending',
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 主生产计划
CREATE TABLE production_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_no text UNIQUE NOT NULL,
  cycle text,
  product_name text,
  category text,
  plan_quantity integer DEFAULT 0,
  start_date date,
  end_date date,
  load_rate numeric(5,2) DEFAULT 0,
  bottleneck_load_rate numeric(5,2) DEFAULT 0,
  status text DEFAULT 'draft',
  work_orders jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 生产工单
CREATE TABLE work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_no text UNIQUE NOT NULL,
  plan_id uuid REFERENCES production_plans(id),
  product_id uuid REFERENCES products(id),
  product_code text,
  product_name text,
  product_images jsonb DEFAULT '[]'::jsonb,
  plan_quantity integer DEFAULT 0,
  completed_quantity integer DEFAULT 0,
  progress integer DEFAULT 0,
  status text DEFAULT 'pending',
  operations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 工艺路线
CREATE TABLE process_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 质检标准
CREATE TABLE quality_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  fiber_content jsonb DEFAULT '{}'::jsonb,
  chemical jsonb DEFAULT '{}'::jsonb,
  physical jsonb DEFAULT '{}'::jsonb,
  appearance jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 检验记录（来料/过程/成品）
CREATE TABLE quality_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no text UNIQUE NOT NULL,
  type text NOT NULL,
  work_order_id uuid REFERENCES work_orders(id),
  material_id uuid,
  product_id uuid REFERENCES products(id),
  result text DEFAULT 'pending',
  details jsonb DEFAULT '{}'::jsonb,
  qualified_qty integer DEFAULT 0,
  unqualified_qty integer DEFAULT 0,
  defect_reason text,
  created_at timestamptz DEFAULT now()
);

-- 设备
CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  model text,
  manufacturer text,
  purchase_date date,
  status text DEFAULT 'normal',
  workshop text,
  category text,
  is_digital boolean DEFAULT false,
  is_networked boolean DEFAULT false,
  running_hours integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 设备保养/维修记录
CREATE TABLE equipment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id),
  type text NOT NULL,
  record_date timestamptz DEFAULT now(),
  description text,
  duration integer,
  loss_output integer DEFAULT 0,
  maintainer text,
  created_at timestamptz DEFAULT now()
);

-- 安全记录
CREATE TABLE safety_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  record_date date,
  area text,
  description text,
  rectification_status text,
  completion_date date,
  topic text,
  participants jsonb DEFAULT '[]'::jsonb,
  loss text,
  outcome text,
  created_at timestamptz DEFAULT now()
);

-- 物料
CREATE TABLE materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  specification text,
  unit text,
  default_supplier text,
  color text,
  pattern_code text,
  composition text,
  weight integer,
  resilience_level text,
  safety_stock integer DEFAULT 0,
  stock integer DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 库存记录
CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  material_id uuid REFERENCES materials(id),
  type text NOT NULL,
  quantity integer DEFAULT 0,
  min_stock integer DEFAULT 0,
  max_stock integer DEFAULT 0,
  warehouse text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_one_target CHECK (
    (type = 'product' AND product_id IS NOT NULL AND material_id IS NULL) OR
    (type = 'material' AND material_id IS NOT NULL AND product_id IS NULL)
  )
);

-- 入出库/盘点记录
CREATE TABLE stock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_no text UNIQUE NOT NULL,
  type text NOT NULL,
  subtype text,
  product_id uuid REFERENCES products(id),
  material_id uuid REFERENCES materials(id),
  quantity integer DEFAULT 0,
  warehouse text,
  related_order text,
  handler text,
  record_date date,
  actual_qty integer,
  profit_loss integer,
  created_at timestamptz DEFAULT now()
);

-- 供应商
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  phone text,
  address text,
  supply_categories jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active',
  qualification_files jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 采购订单
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text,
  total_amount numeric(14,2) DEFAULT 0,
  status text DEFAULT 'draft',
  expected_date date,
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 财务记录
CREATE TABLE finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  counterparty text,
  currency text DEFAULT 'CNY',
  amount numeric(14,2) DEFAULT 0,
  paid_amount numeric(14,2) DEFAULT 0,
  work_order_id uuid REFERENCES work_orders(id),
  employee_id uuid,
  month text,
  cost_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 员工
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  position text,
  skill_level text,
  skill_tags jsonb DEFAULT '[]'::jsonb,
  hire_date date,
  phone text,
  created_at timestamptz DEFAULT now()
);

-- 考勤
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  record_date date,
  status text,
  created_at timestamptz DEFAULT now()
);

-- 评测对标
CREATE TABLE evaluation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene text NOT NULL,
  level integer DEFAULT 2,
  status text DEFAULT '达标',
  evidence_files jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 启用 RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_items ENABLE ROW LEVEL SECURITY;

-- 简化策略：authenticated 用户拥有全部读写权限，anon 只读
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'products','customers','sales_orders','production_plans','work_orders',
        'process_routes','quality_standards','quality_inspections','equipment',
        'equipment_records','safety_records','materials','inventory','stock_records',
        'suppliers','purchase_orders','finance_records','employees','attendance_records',
        'evaluation_items'
      )
  LOOP
    EXECUTE format('CREATE POLICY "%1$s_all_authenticated" ON %1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl);
    EXECUTE format('CREATE POLICY "%1$s_select_anon" ON %1$s FOR SELECT TO anon USING (true);', tbl);
  END LOOP;
END $$;

-- 初始化枚举数据
INSERT INTO process_routes (name, category, steps) VALUES
('绗缝被标准工艺', '绗缝被', '[
  {"seq":1,"name":"面料检验","code":"MI-01","price":0.5,"hours":10,"device":"验布机","skill":"检验员"},
  {"seq":2,"name":"裁剪","code":"CT-01","price":1.2,"hours":20,"device":"裁剪台","skill":"裁剪工"},
  {"seq":3,"name":"拼接","code":"AS-01","price":1.5,"hours":30,"device":"缝纫机","skill":"缝纫工"},
  {"seq":4,"name":"绣花","code":"EM-01","price":3.0,"hours":60,"device":"绣花机","skill":"绣花工","optional":true},
  {"seq":5,"name":"绗缝","code":"QU-01","price":4.0,"hours":90,"device":"电脑绗缝机","skill":"绗缝工","is_bottleneck":true,"quilt_params":{"needle_density":"5针/3cm","pattern":"波浪纹"}},
  {"seq":6,"name":"包边","code":"ED-01","price":1.0,"hours":15,"device":"包边机","skill":"缝纫工"},
  {"seq":7,"name":"水洗","code":"WS-01","price":2.0,"hours":40,"device":"水洗机","skill":"水洗工"},
  {"seq":8,"name":"整烫定型","code":"IR-01","price":1.5,"hours":25,"device":"整烫机","skill":"整烫工"},
  {"seq":9,"name":"检验","code":"QC-01","price":0.8,"hours":20,"device":"检验台","skill":"检验员"},
  {"seq":10,"name":"包装","code":"PK-01","price":0.6,"hours":15,"device":"包装台","skill":"包装工"}
]'::jsonb);

INSERT INTO quality_standards (category, fiber_content, chemical, physical, appearance) VALUES
('绗缝被', '{"cotton":"≥95%","polyester":"≤5%"}'::jsonb, '{"ph":"4.0-8.5","formaldehyde":"≤75mg/kg","aromatic_amine":"禁用"}'::jsonb, '{"shrinkage":"≤3%","color_fastness":"≥3级","breaking_strength":"≥250N"}'::jsonb, '{"needle_density":"5针/3cm","symmetry":"≥95%","flatness":"无明显褶皱"}'::jsonb);

INSERT INTO evaluation_items (scene, level, status) VALUES
('工艺设计', 2, '达标'),
('营销管理', 2, '达标'),
('生产管控', 2, '达标'),
('质量管理', 2, '达标'),
('设备管理', 2, '达标'),
('安全生产', 2, '达标'),
('仓储物流', 2, '达标'),
('财务管理', 2, '达标'),
('计划排程', 2, '达标'),
('采购管理', 2, '达标');