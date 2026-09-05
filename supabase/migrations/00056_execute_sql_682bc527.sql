CREATE OR REPLACE FUNCTION regenerate_arrival_inbounds() RETURNS void AS $$
DECLARE
  rec record;
  r record;
  item record;
  rec_id uuid;
  idx int;
BEGIN
  -- 1. 汇总旧采购入库数量并从库存扣减
  FOR rec IN
    SELECT data->>'material_id' AS material_id, data->>'warehouse' AS warehouse, SUM((data->>'quantity')::numeric) AS total
    FROM entity_store
    WHERE entity_type = 'stock_records' AND data->>'subtype' = '采购入库'
    GROUP BY data->>'material_id', data->>'warehouse'
  LOOP
    UPDATE entity_store inv
    SET data = jsonb_set(inv.data, '{quantity}', to_jsonb(GREATEST(0, (inv.data->>'quantity')::numeric - rec.total)), true)
    WHERE inv.entity_type = 'inventory'
      AND inv.data->>'material_id' = rec.material_id
      AND inv.data->>'warehouse' = rec.warehouse;
  END LOOP;

  -- 2. 删除旧采购入库记录
  DELETE FROM entity_store WHERE entity_type = 'stock_records' AND data->>'subtype' = '采购入库';

  -- 3. 根据当前采购到货单重新生成入库记录
  FOR r IN SELECT id, data FROM entity_store WHERE entity_type='purchase_arrivals'
  LOOP
    idx := 1;
    FOR item IN SELECT value FROM jsonb_array_elements(r.data->'items')
    LOOP
      rec_id := gen_random_uuid();
      INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
      VALUES (
        rec_id,
        'stock_records',
        jsonb_build_object(
          'id', rec_id,
          'record_no', 'SR-' || (r.data->>'code') || '-' || idx,
          'type', 'in',
          'subtype', '采购入库',
          'material_id', item.value->>'material_id',
          'material_code', item.value->>'material_code',
          'material_name', item.value->>'material_name',
          'quantity', (item.value->>'qualified_qty')::numeric,
          'actual_qty', (item.value->>'qualified_qty')::numeric,
          'warehouse', item.value->>'warehouse',
          'location_id', COALESCE(item.value->>'location_id', 'loc-1'),
          'related_order', r.data->>'code',
          'related_order_id', r.id,
          'contract_no', r.data->>'contract_no',
          'handler', COALESCE(r.data->>'inspector', '采购部'),
          'record_date', (r.data->>'arrival_date')::date,
          'remark', '采购到货 ' || (r.data->>'order_no') || ' 入库'
        ),
        now(),
        now()
      );
      idx := idx + 1;
    END LOOP;
  END LOOP;

  -- 4. 将新采购入库数量加回库存
  FOR rec IN
    SELECT data->>'material_id' AS material_id, data->>'warehouse' AS warehouse, SUM((data->>'quantity')::numeric) AS total
    FROM entity_store
    WHERE entity_type = 'stock_records' AND data->>'subtype' = '采购入库'
    GROUP BY data->>'material_id', data->>'warehouse'
  LOOP
    UPDATE entity_store inv
    SET data = jsonb_set(inv.data, '{quantity}', to_jsonb((inv.data->>'quantity')::numeric + rec.total), true)
    WHERE inv.entity_type = 'inventory'
      AND inv.data->>'material_id' = rec.material_id
      AND inv.data->>'warehouse' = rec.warehouse;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS regenerate_arrival_inbounds();