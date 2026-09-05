CREATE OR REPLACE FUNCTION gen_shipment_outbound_stock() RETURNS void AS $$
DECLARE
  sh record;
  idx int;
  item record;
  rec_id uuid;
  inv record;
  qty numeric;
BEGIN
  -- 删除旧销售出库记录
  DELETE FROM entity_store WHERE entity_type = 'stock_records' AND data->>'subtype' = '销售出库';

  FOR sh IN SELECT id, data FROM entity_store WHERE entity_type = 'shipments'
  LOOP
    idx := 1;
    FOR item IN SELECT value FROM jsonb_array_elements(sh.data->'items')
    LOOP
      rec_id := gen_random_uuid();
      qty := (item.value->>'quantity')::numeric;
      INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
      VALUES (
        rec_id,
        'stock_records',
        jsonb_build_object(
          'id', rec_id,
          'record_no', 'SR-' || (sh.data->>'shipment_no') || '-' || idx,
          'type', 'out',
          'subtype', '销售出库',
          'product_id', item.value->>'product_id',
          'product_code', item.value->>'product_code',
          'product_name', item.value->>'product_name',
          'quantity', qty,
          'actual_qty', qty,
          'warehouse', '成品仓',
          'location_id', 'loc-finished-1',
          'related_order', sh.data->>'shipment_no',
          'related_order_id', sh.id,
          'contract_no', sh.data->>'contract_no',
          'handler', '系统管理员',
          'record_date', (sh.data->>'shipment_date')::date,
          'remark', '发货出库 ' || (sh.data->>'shipment_no') || ' / ' || (sh.data->>'order_no')
        ),
        now(),
        now()
      );
      idx := idx + 1;

      -- 扣减成品库存
      SELECT id, data INTO inv
      FROM entity_store
      WHERE entity_type = 'inventory'
        AND data->>'type' = 'product'
        AND data->>'product_id' = item.value->>'product_id'
        AND data->>'warehouse' = '成品仓'
      LIMIT 1;

      IF inv.id IS NOT NULL THEN
        UPDATE entity_store
        SET data = jsonb_set(data, '{quantity}', to_jsonb(GREATEST(0, (data->>'quantity')::numeric - qty)), true)
        WHERE id = inv.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_shipment_outbound_stock();