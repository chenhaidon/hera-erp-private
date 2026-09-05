DO $$
DECLARE
  rec record;
  op record;
  report_time text;
  report_date date;
  ship_date date;
  ret_date date;
  v_factory_id uuid;
  v_factory_name text;
  qty int;
  ship_id uuid;
  ret_id uuid;
  ship_no text;
  ret_no text;
  op_index int;
  cnt int := 0;
BEGIN
  FOR rec IN
    SELECT id, data
    FROM entity_store
    WHERE entity_type = 'work_orders'
      AND data->>'contract_no' IN ('26JLHD010','26JLHD012','26JLHD011','26JLKXD005','26JLKXD008','26JLHD013')
  LOOP
    op_index := 0;
    FOR op IN SELECT * FROM jsonb_array_elements(rec.data->'operations')
    LOOP
      IF (op.value->>'category') = 'outsourcing' THEN
        IF (op.value->'reports') IS NOT NULL AND jsonb_array_length(op.value->'reports') > 0 THEN
          report_time := op.value->'reports'->0->>'report_time';
          report_date := (report_time::timestamp)::date;
          ship_date := report_date - interval '2 days';
          ret_date := report_date + interval '1 day';
          qty := COALESCE((op.value->>'completed_qty')::int, (op.value->>'plan_qty')::int, 0);

          SELECT f.id, f.factory_name INTO v_factory_id, v_factory_name
          FROM outsource_factories f
          WHERE f.status = 'enabled'
            AND f.processing_capability = CASE op.value->>'name'
              WHEN '电脑绣' THEN '电脑绣花'
              WHEN '水洗' THEN '水洗整烫'
              ELSE f.processing_capability
            END
          ORDER BY f.created_at
          LIMIT 1;

          IF v_factory_id IS NULL THEN
            SELECT f.id, f.factory_name INTO v_factory_id, v_factory_name FROM outsource_factories f WHERE f.status='enabled' ORDER BY f.created_at LIMIT 1;
          END IF;

          ship_id := gen_random_uuid();
          ret_id := gen_random_uuid();
          ship_no := 'OS-' || to_char(now(), 'YYYYMMDDHH24MISS') || lpad(cnt::text, 4, '0');
          ret_no := 'OR-' || to_char(now(), 'YYYYMMDDHH24MISS') || lpad(cnt::text, 4, '0');

          INSERT INTO outsource_shipments (id, shipment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, shipment_date, shipment_quantity, logistics_company, logistics_no, status, created_at, updated_at)
          VALUES (ship_id, ship_no, rec.data->>'id', rec.data->>'work_no', op.value->>'code', op.value->>'name', rec.data->>'product_code', rec.data->>'product_name', v_factory_id, v_factory_name, ship_date, qty, '', '', 'shipped', now(), now());

          INSERT INTO outsource_shipment_items (id, shipment_id, material_code, material_name, quantity, unit, created_at, updated_at)
          VALUES (gen_random_uuid(), ship_id, rec.data->>'product_code', COALESCE(rec.data->>'product_name', '半成品'), qty, '件', now(), now());

          INSERT INTO outsource_returns (id, return_no, shipment_id, shipment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, return_date, return_type, return_quantity, qualified_quantity, defective_quantity, inspection_status, status, created_at, updated_at)
          VALUES (ret_id, ret_no, ship_id, ship_no, rec.data->>'id', rec.data->>'work_no', op.value->>'code', op.value->>'name', rec.data->>'product_code', rec.data->>'product_name', v_factory_id, v_factory_name, ret_date, 'semi_finished', qty, qty, 0, 'qualified', 'stored', now(), now());

          INSERT INTO outsource_return_items (id, return_id, material_code, material_name, quantity, unit, created_at, updated_at)
          VALUES (gen_random_uuid(), ret_id, rec.data->>'product_code', COALESCE(rec.data->>'product_name', '半成品'), qty, '件', now(), now());

          UPDATE entity_store SET data = jsonb_set(data, ARRAY['operations', op_index::text, 'outsourcing_status'], '"received"', true), updated_at = now() WHERE id = rec.id;

          cnt := cnt + 1;
        END IF;
      END IF;
      op_index := op_index + 1;
    END LOOP;
  END LOOP;
END $$;