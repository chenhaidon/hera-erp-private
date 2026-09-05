-- 导入 26JLWJ025 合同/销售订单/采购投料单
DO $$
DECLARE
  customer_id UUID := '7c140f7c-561d-4356-9cfe-c5da68da3c88';
  contract_id UUID := 'bfe4c9ed-99b1-4676-b3d0-f7a6cb75c0d9';
  sales_order_id UUID := 'f5322098-0e12-4f20-9a7e-e03d652fc02b';
  supplier_id UUID := '56b1f74f-f81b-438d-91d6-ace9f4d0a107';
  purchase_order_id UUID := '92a9200b-2478-4262-ab7a-b8ba5eb93856';
  product_ha08 UUID := 'f3b212b6-5248-463c-b71a-8eb14a51aba1';
  product_ha09 UUID := '4bceb42c-0a7c-4f42-bdc4-ccffced5af1f';
  product_ha10 UUID := 'c7d40593-4d4b-4214-822a-4ec0917c8e08';
BEGIN
  -- 客户
  IF NOT EXISTS (SELECT 1 FROM customers WHERE name = '厦门旺鲸国际贸易有限公司') THEN
    INSERT INTO customers (id, name, contact, phone, address, country, cooperation_years, credit_level, customer_type, created_at)
    VALUES (customer_id, '厦门旺鲸国际贸易有限公司', '', '', '', '中国', 0, 'A', '贸易商', now());
  ELSE
    SELECT id INTO customer_id FROM customers WHERE name = '厦门旺鲸国际贸易有限公司';
  END IF;

  -- 合同
  IF NOT EXISTS (SELECT 1 FROM contracts WHERE contract_no = 'HF20260601-02-JLGY') THEN
    INSERT INTO contracts (id, contract_no, title, customer_id, customer_name, contact_name, contact_phone, customer_address, contract_type, customer_level, amount, currency, sign_date, effective_date, payment_terms, status, remark, version, items, clauses, approval_logs, performance_nodes, version_logs, attachments, reminders, created_by, created_at, updated_at)
    VALUES (
      contract_id, 'HF20260601-02-JLGY', '圆宝系列被子三件套（内部合同号：26JLWJ025）',
      customer_id, '厦门旺鲸国际贸易有限公司', '', '', '',
      'export', 'normal', 238506, 'CNY', '2026-06-01', '2026-06-01',
      '每月发货款项，每两个月结算一次（下下月月底）', 'effective',
      '交货期：60天。1. 订购内容：被子三件套成品；面料为全棉32支、68×64、90g重，填充为80g棉、20%其他，200g/平方米。2. 尺寸：中码230×245cm/50×71cm×2；大码270×245cm/50×91cm×2；加大码300×270cm/50×91cm×2。3. 付款方式：每月发货款项，每两个月结算一次（下下月月底）。4. 质量与包装：按合同要求，产品清洁、包装美观整齐。',
      '1', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '系统导入', now(), now()
    );
  END IF;

  -- 产品 HA08
  IF NOT EXISTS (SELECT 1 FROM products WHERE code = 'HA08') THEN
    INSERT INTO products (id, code, name, category, fabric_type, fabric_composition, lining_type, filling_type, filling_weight, sizes, quilt_process, quilt_pattern, standard, standard_hours, process_list, images, status, created_at)
    VALUES (product_ha08, 'HA08', '圆宝--烟灰', '绗缝被', '棉', '全棉32支、68×64、90g重', '棉', '喷胶棉', 200,
      '["230×245cm / 50×71cm×2","270×245cm / 50×91cm×2","300×270cm / 50×91cm×2"]',
      '电脑绗缝', '18-4006TPG 圆宝', 'GB/T 22796-2021', 320,
      '["面料检验","裁剪","拼接","绗缝","包边","水洗","整烫定型","检验","包装"]',
      '[]'::jsonb, 'active', now());
  END IF;

  -- 产品 HA09
  IF NOT EXISTS (SELECT 1 FROM products WHERE code = 'HA09') THEN
    INSERT INTO products (id, code, name, category, fabric_type, fabric_composition, lining_type, filling_type, filling_weight, sizes, quilt_process, quilt_pattern, standard, standard_hours, process_list, images, status, created_at)
    VALUES (product_ha09, 'HA09', '圆宝--亮黄', '绗缝被', '棉', '全棉32支、68×64、90g重', '棉', '喷胶棉', 200,
      '["230×245cm / 50×71cm×2","270×245cm / 50×91cm×2","300×270cm / 50×91cm×2"]',
      '电脑绗缝', '13-0755TPG 圆宝', 'GB/T 22796-2021', 320,
      '["面料检验","裁剪","拼接","绗缝","包边","水洗","整烫定型","检验","包装"]',
      '[]'::jsonb, 'active', now());
  END IF;

  -- 产品 HA10
  IF NOT EXISTS (SELECT 1 FROM products WHERE code = 'HA10') THEN
    INSERT INTO products (id, code, name, category, fabric_type, fabric_composition, lining_type, filling_type, filling_weight, sizes, quilt_process, quilt_pattern, standard, standard_hours, process_list, images, status, created_at)
    VALUES (product_ha10, 'HA10', '圆宝--卡其', '绗缝被', '棉', '全棉32支、68×64、90g重', '棉', '喷胶棉', 200,
      '["230×245cm / 50×71cm×2","270×245cm / 50×91cm×2","300×270cm / 50×91cm×2"]',
      '电脑绗缝', '12-0709TPG 圆宝', 'GB/T 22796-2021', 320,
      '["面料检验","裁剪","拼接","绗缝","包边","水洗","整烫定型","检验","包装"]',
      '[]'::jsonb, 'active', now());
  END IF;

  -- 销售订单
  IF NOT EXISTS (SELECT 1 FROM sales_orders WHERE order_no = 'SO-20260807-0829') THEN
    INSERT INTO sales_orders (id, order_no, order_type, channel, customer_id, customer_name, currency, trade_term, destination, delivery_date, total_amount, status, items, created_at)
    VALUES (
      sales_order_id, 'SO-20260807-0829', '外贸', '厦门',
      customer_id, '厦门旺鲸国际贸易有限公司', 'CNY', '', '', '2026-07-31', 238506, 'confirmed',
      '[{"product_id":"f3b212b6-5248-463c-b71a-8eb14a51aba1","product_code":"HA08","product_name":"圆宝--烟灰","sku_summary":"230×245cm / 50×71cm×2","specification":"230×245cm / 50×71cm×2","color":"烟灰","quantity":150,"unit":"套","unit_price":149,"amount":22350},{"product_id":"f3b212b6-5248-463c-b71a-8eb14a51aba1","product_code":"HA08","product_name":"圆宝--烟灰","sku_summary":"270×245cm / 50×91cm×2","specification":"270×245cm / 50×91cm×2","color":"烟灰","quantity":152,"unit":"套","unit_price":177,"amount":26904},{"product_id":"f3b212b6-5248-463c-b71a-8eb14a51aba1","product_code":"HA08","product_name":"圆宝--烟灰","sku_summary":"300×270cm / 50×91cm×2","specification":"300×270cm / 50×91cm×2","color":"烟灰","quantity":152,"unit":"套","unit_price":199,"amount":30248},{"product_id":"4bceb42c-0a7c-4f42-bdc4-ccffced5af1f","product_code":"HA09","product_name":"圆宝--亮黄","sku_summary":"230×245cm / 50×71cm×2","specification":"230×245cm / 50×71cm×2","color":"亮黄","quantity":150,"unit":"套","unit_price":149,"amount":22350},{"product_id":"4bceb42c-0a7c-4f42-bdc4-ccffced5af1f","product_code":"HA09","product_name":"圆宝--亮黄","sku_summary":"270×245cm / 50×91cm×2","specification":"270×245cm / 50×91cm×2","color":"亮黄","quantity":152,"unit":"套","unit_price":177,"amount":26904},{"product_id":"4bceb42c-0a7c-4f42-bdc4-ccffced5af1f","product_code":"HA09","product_name":"圆宝--亮黄","sku_summary":"300×270cm / 50×91cm×2","specification":"300×270cm / 50×91cm×2","color":"亮黄","quantity":152,"unit":"套","unit_price":199,"amount":30248},{"product_id":"c7d40593-4d4b-4214-822a-4ec0917c8e08","product_code":"HA10","product_name":"圆宝--卡其","sku_summary":"230×245cm / 50×71cm×2","specification":"230×245cm / 50×71cm×2","color":"卡其","quantity":150,"unit":"套","unit_price":149,"amount":22350},{"product_id":"c7d40593-4d4b-4214-822a-4ec0917c8e08","product_code":"HA10","product_name":"圆宝--卡其","sku_summary":"270×245cm / 50×91cm×2","specification":"270×245cm / 50×91cm×2","color":"卡其","quantity":152,"unit":"套","unit_price":177,"amount":26904},{"product_id":"c7d40593-4d4b-4214-822a-4ec0917c8e08","product_code":"HA10","product_name":"圆宝--卡其","sku_summary":"300×270cm / 50×91cm×2","specification":"300×270cm / 50×91cm×2","color":"卡其","quantity":152,"unit":"套","unit_price":199,"amount":30248}]'::jsonb,
      now()
    );
  END IF;

  -- 供应商
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE name = '浙江浦江金龙工艺有限公司') THEN
    INSERT INTO suppliers (id, name, contact, phone, address, supply_categories, status, qualification_files, created_at)
    VALUES (supplier_id, '浙江浦江金龙工艺有限公司', '', '', '', '["面料","辅料"]'::jsonb, 'active', '[]'::jsonb, now());
  END IF;

  -- 物料（8 条）
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-1F6B47E9') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('c132e9be-d0c4-4189-9443-343983dc2c61', 'MT-1F6B47E9', '32S 68/64 全棉色布 烟灰 HA08', '32S 68/64 全棉色布', '幅宽2.8m', '米', '', '烟灰 HA08', '', '100%棉', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-25732D08') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('1fc6d063-b38b-4be8-a580-98ca1fefe2c6', 'MT-25732D08', '32S 68/64 全棉色布 烟灰 HA08', '32S 68/64 全棉色布', '幅宽3m', '米', '', '烟灰 HA08', '', '100%棉', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-E6EA7C4B') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('6c564dcb-f88b-4473-a10f-4563d0ca7925', 'MT-E6EA7C4B', '32S 68/64 全棉色布 亮黄 HA09', '32S 68/64 全棉色布', '幅宽2.8m', '米', '', '亮黄 HA09', '', '100%棉', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-4111137C') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('8ac02f0a-576c-4478-82ee-d9bcffb1f69f', 'MT-4111137C', '32S 68/64 全棉色布 亮黄 HA09', '32S 68/64 全棉色布', '幅宽3m', '米', '', '亮黄 HA09', '', '100%棉', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-29ECF51C') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('3e73a237-9622-4700-a995-cd209c368e10', 'MT-29ECF51C', '32S 68/64 全棉色布 卡其 HA10', '32S 68/64 全棉色布', '幅宽2.8m', '米', '', '卡其 HA10', '', '100%棉', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-F67F3248') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('370e2e5a-e28e-428c-8540-f9642babcfee', 'MT-F67F3248', '32S 68/64 全棉色布 卡其 HA10', '32S 68/64 全棉色布', '幅宽3m', '米', '', '卡其 HA10', '', '100%棉', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-D2115D11') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('c6a0d864-c86c-4e2f-b843-2e0d9d03a498', 'MT-D2115D11', '春亚纺', '春亚纺', '幅宽2.8m', '米', '', '', '', '聚酯纤维', NULL, NULL, 0, 0, 'active', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM materials WHERE code = 'MT-8B0E554B') THEN
    INSERT INTO materials (id, code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock, status, created_at)
    VALUES ('8e3b7943-3ec0-42d6-9159-1c2e8d50a44c', 'MT-8B0E554B', '春亚纺', '春亚纺', '幅宽3m', '米', '', '', '', '聚酯纤维', NULL, NULL, 0, 0, 'active', now());
  END IF;

  -- 采购订单
  IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE order_no = 'PO-20260807-0829') THEN
    INSERT INTO purchase_orders (id, order_no, supplier_id, supplier_name, total_amount, status, expected_date, items, created_at)
    VALUES (
      purchase_order_id, 'PO-20260807-0829', supplier_id, '浙江浦江金龙工艺有限公司', 0, 'draft', '2026-07-10',
      '[{"material_id":"c132e9be-d0c4-4189-9443-343983dc2c61","material_code":"MT-1F6B47E9","material_name":"32S 68/64 全棉色布 烟灰 HA08","specification":"幅宽2.8m 烟灰 HA08","quantity":2070,"unit":"米","unit_price":0,"amount":0},{"material_id":"1fc6d063-b38b-4be8-a580-98ca1fefe2c6","material_code":"MT-25732D08","material_name":"32S 68/64 全棉色布 烟灰 HA08","specification":"幅宽3m 烟灰 HA08","quantity":1200,"unit":"米","unit_price":0,"amount":0},{"material_id":"6c564dcb-f88b-4473-a10f-4563d0ca7925","material_code":"MT-E6EA7C4B","material_name":"32S 68/64 全棉色布 亮黄 HA09","specification":"幅宽2.8m 亮黄 HA09","quantity":2070,"unit":"米","unit_price":0,"amount":0},{"material_id":"8ac02f0a-576c-4478-82ee-d9bcffb1f69f","material_code":"MT-4111137C","material_name":"32S 68/64 全棉色布 亮黄 HA09","specification":"幅宽3m 亮黄 HA09","quantity":1200,"unit":"米","unit_price":0,"amount":0},{"material_id":"3e73a237-9622-4700-a995-cd209c368e10","material_code":"MT-29ECF51C","material_name":"32S 68/64 全棉色布 卡其 HA10","specification":"幅宽2.8m 卡其 HA10","quantity":2070,"unit":"米","unit_price":0,"amount":0},{"material_id":"370e2e5a-e28e-428c-8540-f9642babcfee","material_code":"MT-F67F3248","material_name":"32S 68/64 全棉色布 卡其 HA10","specification":"幅宽3m 卡其 HA10","quantity":1200,"unit":"米","unit_price":0,"amount":0},{"material_id":"c6a0d864-c86c-4e2f-b843-2e0d9d03a498","material_code":"MT-D2115D11","material_name":"春亚纺","specification":"幅宽2.8m","quantity":355,"unit":"米","unit_price":0,"amount":0},{"material_id":"8e3b7943-3ec0-42d6-9159-1c2e8d50a44c","material_code":"MT-8B0E554B","material_name":"春亚纺","specification":"幅宽3m","quantity":202,"unit":"米","unit_price":0,"amount":0}]'::jsonb,
      now()
    );
  END IF;
END $$;