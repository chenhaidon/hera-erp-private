CREATE OR REPLACE FUNCTION gen_finished_goods_inbounds() RETURNS void AS $$
DECLARE
  wo record;
  rec_id uuid;
  inbound_no text;
  record_no text;
  inv_id text;
  inv_qty numeric;
BEGIN
  FOR wo IN SELECT id, data FROM entity_store WHERE entity_type='work_orders' AND data->>'status' = 'completed'
  LOOP
    -- 跳过已存在完工入库的工单
    IF EXISTS (
      SELECT 1 FROM entity_store
      WHERE entity_type = 'finished_goods_inbounds'
        AND data->>'work_no' = wo.data->>'work_no'
    ) THEN
      CONTINUE;
    END IF;

    rec_id := gen_random_uuid();
    inbound_no := 'RKS-' || (wo.data->>'work_no');
    record_no := 'WI-' || (wo.data->>'work_no');

    -- 生成成品入库单
    INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
    VALUES (
      rec_id,
      'finished_goods_inbounds',
      jsonb_build_object(
        'id', rec_id,
        'inbound_no', inbound_no,
        'status', 'inbound',
        'work_id', wo.id,
        'work_no', wo.data->>'work_no',
        'product_id', wo.data->>'product_id',
        'product_code', wo.data->>'product_code',
        'product_name', wo.data->>'product_name',
        'sku_summary', wo.data->>'sku_summary',
        'color', wo.data->>'color',
        'quantity', (wo.data->>'completed_quantity')::numeric,
        'warehouse', '成品仓',
        'location_id', 'loc-finished-1',
        'inbound_date', (wo.data->>'completed_at')::date,
        'created_at', now(),
        'created_by', '系统'
      ),
      now(),
      now()
    );

    -- 生成出入库记录
    INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'stock_records',
      jsonb_build_object(
        'id', gen_random_uuid(),
        'record_no', record_no,
        'type', 'in',
        'subtype', '生产入库',
        'product_id', wo.data->>'product_id',
        'product_code', wo.data->>'product_code',
        'product_name', wo.data->>'product_name',
        'quantity', (wo.data->>'completed_quantity')::numeric,
        'actual_qty', (wo.data->>'completed_quantity')::numeric,
        'warehouse', '成品仓',
        'location_id', 'loc-finished-1',
        'related_order', wo.data->>'work_no',
        'related_order_id', wo.id,
        'contract_no', wo.data->>'contract_no',
        'handler', '系统管理员',
        'record_date', (wo.data->>'completed_at')::date,
        'remark', '工单 ' || (wo.data->>'work_no') || ' 完工入库'
      ),
      now(),
      now()
    );

    -- 更新或创建成品库存
    SELECT id, COALESCE((data->>'quantity')::numeric, 0) INTO inv_id, inv_qty
    FROM entity_store
    WHERE entity_type = 'inventory'
      AND data->>'type' = 'product'
      AND data->>'product_id' = wo.data->>'product_id'
      AND data->>'warehouse' = '成品仓'
    LIMIT 1;

    IF inv_id IS NOT NULL THEN
      UPDATE entity_store
      SET data = jsonb_set(data, '{quantity}', to_jsonb(inv_qty + (wo.data->>'completed_quantity')::numeric), true)
      WHERE id = inv_id;
    ELSE
      INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'inventory',
        jsonb_build_object(
          'type', 'product',
          'product_id', wo.data->>'product_id',
          'product_code', wo.data->>'product_code',
          'product_name', wo.data->>'product_name',
          'warehouse', '成品仓',
          'location_id', 'loc-finished-1',
          'quantity', (wo.data->>'completed_quantity')::numeric,
          'min_stock', 0,
          'max_stock', 10000
        ),
        now(),
        now()
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_finished_goods_inbounds();