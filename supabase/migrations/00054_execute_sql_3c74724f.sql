CREATE OR REPLACE FUNCTION gen_stock_from_requisitions() RETURNS void AS $$
DECLARE
  r record;
  item record;
  rec_id uuid;
  idx int;
BEGIN
  FOR r IN SELECT id, data FROM entity_store WHERE entity_type='material_requisitions'
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
          'type', 'out',
          'subtype', '生产领料',
          'material_id', item.value->>'material_id',
          'material_code', item.value->>'material_code',
          'material_name', item.value->>'material_name',
          'quantity', (item.value->>'issued_qty')::numeric,
          'actual_qty', (item.value->>'issued_qty')::numeric,
          'warehouse', item.value->>'warehouse',
          'location_id', CASE item.value->>'warehouse'
            WHEN '面料仓' THEN 'loc-fabric-1'
            WHEN '填充仓' THEN 'loc-filling-1'
            WHEN '辅料仓' THEN 'loc-aux-1'
            WHEN '配件仓' THEN 'loc-parts-1'
            ELSE 'loc-1'
          END,
          'related_order', r.data->>'code',
          'related_order_id', r.id,
          'contract_no', r.data->>'contract_no',
          'handler', COALESCE(r.data->>'applicant', '生产部'),
          'record_date', COALESCE(r.data->>'issued_at', r.data->>'created_at')::date,
          'remark', '工单 ' || COALESCE(r.data->>'work_order_no', r.data->>'related_work_order_no') || ' 领料出库'
        ),
        now(),
        now()
      );
      idx := idx + 1;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_stock_from_requisitions();