DO $$
DECLARE
  c_id uuid := gen_random_uuid();
  so_id uuid := gen_random_uuid();
  po_id uuid := gen_random_uuid();
  c_data jsonb;
  so_data jsonb;
  po_data jsonb;
BEGIN
  -- 合同数据
  c_data := jsonb_build_object(
    'id', c_id,
    'contract_no', '26JLKXD03',
    'original_contract_no', '26KHM003',
    'title', '希腊绒机绗被采购合同（山东凯信达）',
    'type', '销售合同',
    'customer_name', '山东凯信达工贸有限公司',
    'amount', 75520,
    'currency', 'CNY',
    'sign_date', '2026-05-26',
    'delivery_date', '2026-07-10',
    'effective_date', '2026-05-26',
    'status', 'executing',
    'payment_terms', '款到发货',
    'payment_progress', 0,
    'progress', 60,
    'remark', '客户合同号：26KHM003；产品：希腊绒机绗被；OVS KI 112×106英寸；面布220g希腊绒，底布40S全棉布，填充150gsm仿羽丝棉；绗缝10×10cm正方格；成品水洗，符合亚马逊标准。',
    'items', '[{"sku":"KWX2606-BW-OK X004ZRPDY3","product_name":"希腊绒机绗被","color":"亮白色 BRILLIANT WHITE","spec":"OVS KI","size":"112×106英寸 + 20×36英寸×2","quantity":60,"unit_price":236,"amount":14160,"unit":"套"},{"sku":"KWX2606-WW-OK X004ZRPDXJ","product_name":"希腊绒机绗被","color":"柔白色 WHISPER WHITE","spec":"OVS KI","size":"112×106英寸 + 20×36英寸×2","quantity":160,"unit_price":236,"amount":37760,"unit":"套"},{"sku":"KWX2606-SS-OK X004ZRHN0B","product_name":"希腊绒机绗被","color":"贝壳沙色 SAND SHELL","spec":"OVS KI","size":"112×106英寸 + 20×36英寸×2","quantity":100,"unit_price":236,"amount":23600,"unit":"套"}]'::jsonb,
    'performance_nodes', '[{"id":"1","name":"合同签订","type":"sign","planned_date":"2026-05-26","status":"completed"},{"id":"2","name":"交付完成","type":"delivery","planned_date":"2026-07-10","status":"pending"},{"id":"3","name":"回款完成","type":"payment","planned_date":"2026-07-10","status":"pending"}]'::jsonb,
    'attachments', '[]'::jsonb,
    'clauses', '[]'::jsonb,
    'payments', '[]'::jsonb,
    'version_logs', '[]'::jsonb,
    'created_at', '2026-05-26T00:00:00.000Z',
    'updated_at', '2026-05-26T00:00:00.000Z'
  );

  -- 销售订单数据
  so_data := jsonb_build_object(
    'id', so_id,
    'order_no', 'SO-26JLKXD03-001',
    'order_type', '外贸',
    'channel', '批发',
    'customer_name', '山东凯信达工贸有限公司',
    'currency', 'CNY',
    'delivery_date', '2026-07-10',
    'total_amount', 75520,
    'status', 'confirmed',
    'contract_no', '26JLKXD03',
    'contract_id', c_id,
    'trade_term', '',
    'destination', '',
    'items', '[{"sku":"KWX2606-BW-OK X004ZRPDY3","product_name":"希腊绒机绗被","color":"亮白色 BRILLIANT WHITE","spec":"OVS KI","sku_summary":"亮白色 OVS KI 112×106英寸","specification":"112×106英寸 + 20×36英寸×2","quantity":60,"unit_price":236,"amount":14160,"unit":"套"},{"sku":"KWX2606-WW-OK X004ZRPDXJ","product_name":"希腊绒机绗被","color":"柔白色 WHISPER WHITE","spec":"OVS KI","sku_summary":"柔白色 OVS KI 112×106英寸","specification":"112×106英寸 + 20×36英寸×2","quantity":160,"unit_price":236,"amount":37760,"unit":"套"},{"sku":"KWX2606-SS-OK X004ZRHN0B","product_name":"希腊绒机绗被","color":"贝壳沙色 SAND SHELL","spec":"OVS KI","sku_summary":"贝壳沙色 OVS KI 112×106英寸","specification":"112×106英寸 + 20×36英寸×2","quantity":100,"unit_price":236,"amount":23600,"unit":"套"}]'::jsonb,
    'logs', '[{"status":"confirmed","operator":"导入","remark":"由合同26JLKXD03导入","time":"2026-05-26T00:00:00"}]'::jsonb,
    'created_at', '2026-05-26T00:00:00.000Z',
    'updated_at', '2026-05-26T00:00:00.000Z'
  );

  -- 采购订单数据
  po_data := jsonb_build_object(
    'id', po_id,
    'order_no', 'PO-26JLKXD03-001',
    'supplier_name', '纺大',
    'supplier_id', '1ee25053-2192-4d43-81ea-43ef7a4232ad',
    'total_amount', 0,
    'status', 'approved',
    'payment_status', 'unpaid',
    'expected_date', '2026-06-15',
    'contract_no', '26JLKXD03',
    'request_code', '',
    'items', '[{"material_name":"面料：希腊绒","color":"亮白色","specification":"2.8m门幅","quantity":3000,"unit":"m","unit_price":0,"amount":0,"remark":"优先做亮白色"},{"material_name":"面料：希腊绒","color":"柔白色","specification":"2.8m门幅","quantity":3000,"unit":"m","unit_price":0,"amount":0,"remark":""},{"material_name":"面料：希腊绒","color":"贝壳沙色","specification":"2.8m门幅","quantity":3000,"unit":"m","unit_price":0,"amount":0,"remark":"注意颜色"}]'::jsonb,
    'created_at', '2026-06-01T00:00:00.000Z',
    'updated_at', '2026-06-01T00:00:00.000Z'
  );

  INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
  VALUES
    (c_id,  'contracts',       c_data,  '2026-05-26T00:00:00.000Z', now()),
    (so_id, 'sales_orders',    so_data, '2026-05-26T00:00:00.000Z', now()),
    (po_id, 'purchase_orders', po_data, '2026-06-01T00:00:00.000Z', now());
END $$;