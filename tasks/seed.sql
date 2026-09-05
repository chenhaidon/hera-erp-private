-- 浦江家纺智造管理平台 - 示例数据

INSERT INTO products (code, name, category, fabric_type, fabric_composition, lining_type, filling_type, filling_weight, sizes, quilt_process, quilt_pattern, standard, standard_hours, process_list, images, status) VALUES
('JF-2026-001', '北欧风绗缝被', '绗缝被', '棉', '100%棉', '涤棉', '喷胶棉', 300, '["150×200cm","180×220cm","200×230cm"]', '电脑绗缝', '波浪纹', 'GB/T 22796-2021', 320, '["面料检验","裁剪","拼接","绗缝","包边","水洗","整烫定型","检验","包装"]', '["https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg","https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_bf65d999-426a-49ba-ac54-8b059cb61589.jpg"]', 'active'),
('JF-2026-002', '亲肤四件套', '四件套', '棉', '60支长绒棉', '纯棉', NULL, NULL, '["1.5m床","1.8m床","2.0m床"]', NULL, NULL, 'GB/T 22844-2008', 120, '["面料检验","裁剪","缝制","整烫","包装"]', '["https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_d830d123-4c83-4c21-9b36-cbc29a27b27d.jpg"]', 'active'),
('JF-2026-003', '云朵沙发垫', '沙发垫', '绒布', '聚酯纤维', '无纺布', '海绵', 500, '["70×70cm","90×90cm"]', '多针绗缝', '方格纹', 'FZ/T 62031-2015', 210, '["面料检验","裁剪","绗缝","包边","检验","包装"]', '["https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_ac3ea6fc-b63f-4036-bc6c-1eadd52cd78a.jpg"]', 'active'),
('JF-2026-004', '儿童绗缝童被', '童被套件', '棉', '双层纱', '纯棉', '聚酯纤维', 200, '["120×150cm"]', '电脑绗缝', '星星纹', 'GB/T 22796-2021', 280, '["面料检验","裁剪","拼接","绣花","绗缝","包边","水洗","整烫","检验","包装"]', '["https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b22959d2-67cb-435c-9234-5f55fd8aa064.jpg"]', 'active');

INSERT INTO customers (name, contact, phone, address, country, cooperation_years, credit_level, customer_type) VALUES
('欧美家纺贸易公司', 'Tom Brown', '+1-555-0101', 'New York, USA', '美国', 5, 'A', '贸易商'),
('东南亚家居品牌', 'Lee Wei', '+65-9012-3456', 'Singapore', '新加坡', 3, 'B', '品牌商'),
('天猫旗舰店', '张敏', '13800138000', '杭州余杭', '中国', 2, 'A', '电商平台'),
('中东进口商', 'Ahmed Ali', '+971-50-1234567', 'Dubai, UAE', '阿联酋', 4, 'B', '贸易商');

INSERT INTO sales_orders (order_no, order_type, channel, customer_id, customer_name, currency, trade_term, destination, delivery_date, total_amount, status, items) VALUES
('SO-2026-0001', '外贸', '欧美', (SELECT id FROM customers WHERE name='欧美家纺贸易公司'), '欧美家纺贸易公司', 'USD', 'FOB', 'Los Angeles', '2026-07-20', 25800.00, 'confirmed', '[{"product_code":"JF-2026-001","product_name":"北欧风绗缝被","quantity":500,"unit":"件","unit_price":25.80,"amount":12900.00,"image":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg"},{"product_code":"JF-2026-003","product_name":"云朵沙发垫","quantity":300,"unit":"件","unit_price":43.00,"amount":12900.00,"image":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_ac3ea6fc-b63f-4036-bc6c-1eadd52cd78a.jpg"}]'::jsonb),
('SO-2026-0002', '电商', '天猫', (SELECT id FROM customers WHERE name='天猫旗舰店'), '天猫旗舰店', 'CNY', NULL, NULL, '2026-07-15', 16800.00, 'confirmed', '[{"product_code":"JF-2026-002","product_name":"亲肤四件套","quantity":120,"unit":"套","unit_price":140.00,"amount":16800.00,"image":"https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_d830d123-4c83-4c21-9b36-cbc29a27b27d.jpg"}]'::jsonb),
('SO-2026-0003', '外贸', '中东', (SELECT id FROM customers WHERE name='中东进口商'), '中东进口商', 'USD', 'CIF', 'Dubai', '2026-07-25', 32000.00, 'pending', '[{"product_code":"JF-2026-004","product_name":"儿童绗缝童被","quantity":800,"unit":"件","unit_price":40.00,"amount":32000.00,"image":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b22959d2-67cb-435c-9234-5f55fd8aa064.jpg"}]'::jsonb);

INSERT INTO production_plans (plan_no, cycle, product_name, category, plan_quantity, start_date, end_date, load_rate, bottleneck_load_rate, status, work_orders) VALUES
('PL-2026-001', '周', '北欧风绗缝被', '绗缝被', 500, '2026-07-05', '2026-07-11', 78.50, 92.00, 'published', '["WO-2026-0001","WO-2026-0002"]'),
('PL-2026-002', '周', '亲肤四件套', '四件套', 120, '2026-07-06', '2026-07-12', 45.00, 0.00, 'published', '["WO-2026-0003"]');

INSERT INTO work_orders (work_no, plan_id, product_id, product_code, product_name, product_images, plan_quantity, completed_quantity, progress, status, operations) VALUES
('WO-2026-0001', (SELECT id FROM production_plans WHERE plan_no='PL-2026-001'), (SELECT id FROM products WHERE code='JF-2026-001'), 'JF-2026-001', '北欧风绗缝被', '["https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg"]', 500, 320, 64, 'producing', '[{"name":"面料检验","completed":true},{"name":"裁剪","completed":true},{"name":"拼接","completed":true},{"name":"绗缝","completed":false,"is_bottleneck":true,"completed_qty":320},{"name":"包边","completed":false},{"name":"水洗","completed":false},{"name":"整烫定型","completed":false},{"name":"检验","completed":false},{"name":"包装","completed":false}]'::jsonb),
('WO-2026-0002', (SELECT id FROM production_plans WHERE plan_no='PL-2026-001'), (SELECT id FROM products WHERE code='JF-2026-003'), 'JF-2026-003', '云朵沙发垫', '["https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_ac3ea6fc-b63f-4036-bc6c-1eadd52cd78a.jpg"]', 300, 180, 60, 'producing', '[{"name":"面料检验","completed":true},{"name":"裁剪","completed":true},{"name":"绗缝","completed":false,"is_bottleneck":true,"completed_qty":180},{"name":"包边","completed":false},{"name":"检验","completed":false},{"name":"包装","completed":false}]'::jsonb),
('WO-2026-0003', (SELECT id FROM production_plans WHERE plan_no='PL-2026-002'), (SELECT id FROM products WHERE code='JF-2026-002'), 'JF-2026-002', '亲肤四件套', '["https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_d830d123-4c83-4c21-9b36-cbc29a27b27d.jpg"]', 120, 80, 67, 'producing', '[{"name":"面料检验","completed":true},{"name":"裁剪","completed":true},{"name":"缝制","completed":true},{"name":"整烫","completed":false},{"name":"包装","completed":false}]'::jsonb);

INSERT INTO equipment (code, name, model, manufacturer, purchase_date, status, workshop, category, is_digital, is_networked, running_hours) VALUES
('EQ-001', '电脑绗缝机 A', 'HF-2024A', '华纺智能', '2024-03-15', 'normal', '绗缝车间', '绗缝设备', true, true, 1850),
('EQ-002', '多针绗缝机 B', 'DZ-3200', '东振机械', '2023-08-20', 'normal', '绗缝车间', '绗缝设备', true, false, 2400),
('EQ-003', '绣花机', 'XH-1506', '禾丰科技', '2024-01-10', 'normal', '绣花车间', '绣花设备', true, true, 980),
('EQ-004', '水洗机', 'SX-100', '清河环保', '2022-11-05', 'normal', '水洗车间', '水洗设备', true, true, 3200),
('EQ-005', '裁剪台', 'CT-200', '金裁机械', '2023-05-12', 'normal', '裁剪车间', '裁剪设备', false, false, 1200);

INSERT INTO materials (code, name, category, specification, unit, default_supplier, color, pattern_code, composition, weight, resilience_level, safety_stock, stock) VALUES
('MT-001', '纯棉面料', '面料', '幅宽240cm 克重120g', '米', '华纺原料', '米白', 'P-001', '100%棉', 120, NULL, 500, 1200),
('MT-002', '绒布面料', '面料', '幅宽220cm 克重200g', '米', '金绒纺织', '浅灰', 'P-002', '100%聚酯', 200, NULL, 300, 450),
('MT-003', '喷胶棉', '填充物', '克重300g/㎡', 'kg', '新棉填充', NULL, NULL, '聚酯纤维', 300, '高', 200, 380),
('MT-004', '羽绒', '填充物', '80%白鸭绒', 'kg', '羽绒之家', NULL, NULL, '鸭绒', 0, '高', 50, 80),
('MT-005', '拉链', '辅料', '3号尼龙拉链', '条', '顺达辅料', NULL, NULL, NULL, 0, NULL, 1000, 2500);

INSERT INTO inventory (product_id, material_id, type, quantity, min_stock, max_stock, warehouse) VALUES
((SELECT id FROM products WHERE code='JF-2026-001'), NULL, 'product', 320, 100, 1000, '成品仓'),
((SELECT id FROM products WHERE code='JF-2026-002'), NULL, 'product', 85, 50, 500, '成品仓'),
((SELECT id FROM products WHERE code='JF-2026-003'), NULL, 'product', 60, 30, 300, '成品仓'),
(NULL, (SELECT id FROM materials WHERE code='MT-001'), 'material', 1200, 500, 3000, '面料仓'),
(NULL, (SELECT id FROM materials WHERE code='MT-003'), 'material', 380, 200, 1000, '填充仓');

INSERT INTO suppliers (name, contact, phone, address, supply_categories, status) VALUES
('华纺原料', '王经理', '0579-12345678', '浦江县开发区', '["面料"]', 'active'),
('新棉填充', '李厂长', '0579-87654321', '浦江县白马镇', '["填充物"]', 'active'),
('顺达辅料', '赵小姐', '0579-11223344', '义乌市稠江街道', '["辅料"]', 'active');

INSERT INTO employees (code, name, position, skill_level, skill_tags, hire_date, phone) VALUES
('E001', '陈秀英', '绗缝工', '高级', '["绗缝","拼接"]', '2018-03-01', '13900139001'),
('E002', '王建国', '裁剪工', '中级', '["裁剪","检验"]', '2019-06-15', '13900139002'),
('E003', '李小红', '绣花工', '高级', '["绣花","整烫"]', '2020-02-10', '13900139003'),
('E004', '张伟', '水洗工', '中级', '["水洗","包装"]', '2021-08-22', '13900139004');

INSERT INTO finance_records (type, counterparty, currency, amount, paid_amount) VALUES
('应收', '欧美家纺贸易公司', 'USD', 25800.00, 10000.00),
('应收', '天猫旗舰店', 'CNY', 16800.00, 16800.00),
('应付', '华纺原料', 'CNY', 45000.00, 20000.00),
('应付', '新棉填充', 'CNY', 18000.00, 10000.00);

INSERT INTO quality_inspections (inspection_no, type, work_order_id, result, qualified_qty, unqualified_qty, details) VALUES
('QC-2026-0001', 'incoming', NULL, 'qualified', 1200, 0, '{"material_code":"MT-001","item":"色差","result":"合格"}'::jsonb),
('QC-2026-0002', 'process', (SELECT id FROM work_orders WHERE work_no='WO-2026-0001'), 'qualified', 320, 5, '{"operation":"绗缝","needle_density":"5.2针/3cm","alignment":"合格"}'::jsonb);

INSERT INTO equipment_records (equipment_id, type, description, duration, loss_output, maintainer) VALUES
((SELECT id FROM equipment WHERE code='EQ-001'), '保养', '更换绗缝机针杆润滑油，清洁旋梭', 2, 0, '维修组'),
((SELECT id FROM equipment WHERE code='EQ-002'), '维修', '多针绗缝机断针，更换针板', 4, 120, '维修组');

INSERT INTO safety_records (type, record_date, area, description, rectification_status, completion_date) VALUES
('hazard', '2026-07-01', '绗缝区', '部分电源插座未接地', '已整改', '2026-07-02');
