CREATE OR REPLACE FUNCTION gen_stock_from_arrivals() RETURNS void AS $$
DECLARE
  r record;
  item record;
  rec_id uuid;
  idx int;
BEGIN
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
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_stock_from_arrivals();