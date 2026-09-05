DROP FUNCTION IF EXISTS update_26jlkxd006_inventory(); CREATE OR REPLACE FUNCTION update_26jlkxd006_inventory() RETURNS TABLE (
  action text,
  detail text
) LANGUAGE plpgsql AS $$
DECLARE
  v_work_order record;
  v_sku_id text;
  v_plan_qty int;
  v_work_no text;
  v_color text;
  v_existing int;
  v_inventory record;
  v_mat_inventory record;
  v_sku_summary text;
  v_face_dosage numeric;
  v_mat_consume numeric;
  v_mat_id text;
  v_mat_name text;
  v_record_no text;
  v_warehouse text := '成品仓';
  v_handler text := '仓库管理员';
  v_record_date date := '2026-08-27'::date;

  v_bom jsonb := jsonb_build_object(
    'sz98870-t', jsonb_build_object(
      'face_regular', 1.97, 'face_special', 1.89,
      'bottom', 1.84, 'nonwoven', 0.19, 'binding', 0.2, 'filling', 0.65
    ),
    'sz98870-qxl', jsonb_build_object(
      'face_regular', 2.89, 'face_special', 2.88,
      'bottom', 2.64, 'nonwoven', 0.24, 'binding', 0.25, 'filling', 1.01
    ),
    'sz98870-kxl', jsonb_build_object(
      'face_regular', 3.16, 'face_special', 3.15,
      'bottom', 2.9, 'nonwoven', 0.25, 'binding', 0.26, 'filling', 1.12
    ),
    'sz98870-ok', jsonb_build_object(
      'face_regular', 3.27, 'face_special', 3.27,
      'bottom', 3.02, 'nonwoven', 0.252, 'binding', 0.252, 'filling', 1.251
    )
  );

  v_bom_item jsonb;
  v_bom_items text[] := ARRAY['mat-a-greek-220','mat-b-cotton-40s','mat-nonwoven-25g','mat-c150-down'];
  v_bom_names text[] := ARRAY['A#220g希腊绒','B#40S110/90棉布','25g无纺布','150g羽丝棉'];
  v_bom_keys text[] := ARRAY['greek','bottom','nonwoven','filling'];
  v_warehouses text[] := ARRAY['面料仓','面料仓','辅料仓','填充仓'];
  v_i int;
BEGIN
  FOR v_work_order IN
    SELECT e.id, e.data
    FROM entity_store e
    WHERE e.entity_type = 'work_orders'
      AND e.data->>'contract_no' = '26JLKXD006'
      AND e.data->>'status' = 'completed'
    ORDER BY e.data->>'work_no'
  LOOP
    v_work_no := v_work_order.data->>'work_no';
    v_sku_summary := COALESCE(v_work_order.data->>'sku_summary', '');
    v_plan_qty := COALESCE((v_work_order.data->>'plan_quantity')::int, 0);
    v_color := COALESCE(v_work_order.data->>'color', '');

    v_sku_id := CASE
      WHEN v_sku_summary ILIKE '68×86in%' THEN 'sz98870-t'
      WHEN v_sku_summary ILIKE '98×98in%' THEN 'sz98870-qxl'
      WHEN v_sku_summary ILIKE '108×98in%' THEN 'sz98870-kxl'
      WHEN v_sku_summary ILIKE '112×106in%' THEN 'sz98870-ok'
      ELSE NULL
    END;

    IF v_sku_id IS NULL OR v_plan_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM entity_store sr
    WHERE sr.entity_type = 'stock_records'
      AND sr.data->>'related_order' = v_work_no
      AND sr.data->>'subtype' = '生产入库';

    IF v_existing > 0 THEN
      action := 'skip_inbound';
      detail := v_work_no || ' ' || v_sku_id || ' qty=' || v_plan_qty::text;
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_record_no := 'WI-' || floor(random() * 900000 + 100000)::int::text;

    INSERT INTO entity_store (id, entity_type, data)
    VALUES (
      gen_random_uuid()::text,
      'stock_records',
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'record_no', v_record_no,
        'type', 'in',
        'subtype', '生产入库',
        'product_id', 'product-sz98870',
        'product_code', 'SZ98870',
        'product_name', '希腊绒机绗被',
        'sku_id', v_sku_id,
        'quantity', v_plan_qty,
        'warehouse', v_warehouse,
        'handler', v_handler,
        'record_date', v_record_date,
        'related_order', v_work_no,
        'related_order_id', v_work_order.id,
        'remark', '工单完工入库',
        'created_at', now()
      )
    );

    SELECT id, data INTO v_inventory
    FROM entity_store inv
    WHERE inv.entity_type = 'inventory'
      AND inv.data->>'product_id' = 'product-sz98870'
      AND inv.data->>'sku_id' = v_sku_id
    LIMIT 1;

    IF FOUND THEN
      UPDATE entity_store
      SET data = data || jsonb_build_object(
        'quantity', COALESCE((data->>'quantity')::int, 0) + v_plan_qty,
        'updated_at', now()
      )
      WHERE id = v_inventory.id;
    ELSE
      INSERT INTO entity_store (id, entity_type, data)
      VALUES (
        gen_random_uuid()::text,
        'inventory',
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'product',
          'product_id', 'product-sz98870',
          'sku_id', v_sku_id,
          'quantity', v_plan_qty,
          'warehouse', v_warehouse,
          'location_id', 'loc-finished-1',
          'min_stock', 150,
          'max_stock', 10000,
          'created_at', now()
        )
      );
    END IF;

    action := 'inbound';
    detail := v_work_no || ' ' || v_sku_id || ' +' || v_plan_qty::text;
    RETURN NEXT;

    v_bom_item := v_bom->v_sku_id;
    IF v_bom_item IS NOT NULL THEN
      v_face_dosage := CASE WHEN v_color IN ('亮白色','深绿色','橄榄绿')
        THEN COALESCE((v_bom_item->>'face_special')::numeric, 0)
        ELSE COALESCE((v_bom_item->>'face_regular')::numeric, 0)
      END;

      FOR v_i IN 1 .. array_length(v_bom_items, 1) LOOP
        v_mat_id := v_bom_items[v_i];
        v_mat_consume := CASE v_i
          WHEN 1 THEN (v_face_dosage + COALESCE((v_bom_item->>'binding')::numeric, 0)) * v_plan_qty
          WHEN 2 THEN COALESCE((v_bom_item->>'bottom')::numeric, 0) * v_plan_qty
          WHEN 3 THEN COALESCE((v_bom_item->>'nonwoven')::numeric, 0) * v_plan_qty
          WHEN 4 THEN COALESCE((v_bom_item->>'filling')::numeric, 0) * v_plan_qty
        END;

        IF v_mat_consume <= 0 THEN CONTINUE; END IF;

        SELECT id, data INTO v_mat_inventory
        FROM entity_store inv
        WHERE inv.entity_type = 'inventory'
          AND inv.data->>'material_id' = v_mat_id
        LIMIT 1;

        IF FOUND THEN
          UPDATE entity_store
          SET data = data || jsonb_build_object(
            'quantity', COALESCE((data->>'quantity')::int, 0) - round(v_mat_consume)::int,
            'updated_at', now()
          )
          WHERE id = v_mat_inventory.id;
        END IF;

        v_record_no := 'ML-' || floor(random() * 900000 + 100000)::int::text;
        INSERT INTO entity_store (id, entity_type, data)
        VALUES (
          gen_random_uuid()::text,
          'stock_records',
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'record_no', v_record_no,
            'type', 'out',
            'subtype', '生产领料',
            'material_id', v_mat_id,
            'material_name', v_bom_names[v_i],
            'quantity', round(v_mat_consume)::int,
            'warehouse', v_warehouses[v_i],
            'handler', v_handler,
            'record_date', v_record_date,
            'related_order', v_work_no,
            'related_order_id', v_work_order.id,
            'remark', 'BOM 领料',
            'created_at', now()
          )
        );
      END LOOP;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_existing
  FROM entity_store sr
  WHERE sr.entity_type = 'stock_records'
    AND sr.data->>'related_order' = 'SO-26JLKXD006'
    AND sr.data->>'subtype' = '销售出库';

  IF v_existing = 0 THEN
    FOR v_work_order IN
      SELECT (item->>'sku_id')::text AS sku_id, (item->>'quantity')::int AS qty
      FROM entity_store,
           jsonb_array_elements(data->'items') AS item
      WHERE entity_type = 'sales_orders'
        AND data->>'order_no' = 'SO-26JLKXD006'
    LOOP
      v_sku_id := v_work_order.sku_id;
      v_plan_qty := v_work_order.qty;

      IF v_plan_qty IS NULL OR v_plan_qty <= 0 THEN CONTINUE; END IF;

      v_record_no := 'SO-' || floor(random() * 900000 + 100000)::int::text;

      INSERT INTO entity_store (id, entity_type, data)
      VALUES (
        gen_random_uuid()::text,
        'stock_records',
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'record_no', v_record_no,
          'type', 'out',
          'subtype', '销售出库',
          'product_id', 'product-sz98870',
          'product_code', 'SZ98870',
          'product_name', '希腊绒机绗被',
          'sku_id', v_sku_id,
          'quantity', v_plan_qty,
          'warehouse', v_warehouse,
          'handler', v_handler,
          'record_date', v_record_date,
          'related_order', 'SO-26JLKXD006',
          'remark', '销售发货出库',
          'created_at', now()
        )
      );

      SELECT id, data INTO v_inventory
      FROM entity_store inv
      WHERE inv.entity_type = 'inventory'
        AND inv.data->>'product_id' = 'product-sz98870'
        AND inv.data->>'sku_id' = v_sku_id
      LIMIT 1;

      IF FOUND THEN
        UPDATE entity_store
        SET data = data || jsonb_build_object(
          'quantity', COALESCE((data->>'quantity')::int, 0) - v_plan_qty,
          'updated_at', now()
        )
        WHERE id = v_inventory.id;
      END IF;

      action := 'outbound';
      detail := 'SO-26JLKXD006 ' || v_sku_id || ' -' || v_plan_qty::text;
      RETURN NEXT;
    END LOOP;
  ELSE
    action := 'skip_outbound';
    detail := 'SO-26JLKXD006 销售出库已存在';
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;