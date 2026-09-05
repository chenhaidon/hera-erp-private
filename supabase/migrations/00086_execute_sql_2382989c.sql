DO $$
DECLARE
  v_inv record;
  v_mat_inv record;
  v_qty int := 225;
  v_color text := '深绿色';
  v_sku_id text := 'sz98870-ok';
  v_work_no text := 'WO-2026-0006-10';
  v_entity_id text := 'i-vB0avqzN-deWTXkkOVk';
  v_record_no text;
  v_bom jsonb := jsonb_build_object(
    'face_special', 3.27, 'binding', 0.252,
    'bottom', 3.02, 'nonwoven', 0.252, 'filling', 1.251
  );
  v_mat_consume numeric;
  v_mat_ids text[] := ARRAY['mat-a-greek-220','mat-b-cotton-40s','mat-nonwoven-25g','mat-c150-down'];
  v_mat_names text[] := ARRAY['A#220g希腊绒','B#40S110/90棉布','25g无纺布','150g羽丝棉'];
  v_warehouses text[] := ARRAY['面料仓','面料仓','辅料仓','填充仓'];
  v_i int;
BEGIN
  -- 成品入库记录（第二个重复工单）
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
      'quantity', v_qty,
      'warehouse', '成品仓',
      'handler', '仓库管理员',
      'record_date', '2026-08-27',
      'related_order', v_work_no || '-2',
      'related_order_id', v_entity_id,
      'remark', '工单完工入库（重复行）',
      'created_at', now()
    )
  );

  SELECT id INTO v_inv FROM entity_store WHERE entity_type='inventory' AND data->>'product_id'='product-sz98870' AND data->>'sku_id'=v_sku_id LIMIT 1;
  IF FOUND THEN
    UPDATE entity_store SET data = data || jsonb_build_object('quantity', COALESCE((data->>'quantity')::int,0) + v_qty, 'updated_at', now()) WHERE id = v_inv.id;
  END IF;

  -- 补原材料出库记录及库存扣减
  FOR v_i IN 1 .. array_length(v_mat_ids, 1) LOOP
    v_mat_consume := CASE v_i
      WHEN 1 THEN ((v_bom->>'face_special')::numeric + (v_bom->>'binding')::numeric) * v_qty
      WHEN 2 THEN (v_bom->>'bottom')::numeric * v_qty
      WHEN 3 THEN (v_bom->>'nonwoven')::numeric * v_qty
      WHEN 4 THEN (v_bom->>'filling')::numeric * v_qty
    END;

    SELECT id INTO v_mat_inv FROM entity_store WHERE entity_type='inventory' AND data->>'material_id' = v_mat_ids[v_i] LIMIT 1;
    IF FOUND THEN
      UPDATE entity_store SET data = data || jsonb_build_object('quantity', COALESCE((data->>'quantity')::int,0) - round(v_mat_consume)::int, 'updated_at', now()) WHERE id = v_mat_inv.id;
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
        'material_id', v_mat_ids[v_i],
        'material_name', v_mat_names[v_i],
        'quantity', round(v_mat_consume)::int,
        'warehouse', v_warehouses[v_i],
        'handler', '仓库管理员',
        'record_date', '2026-08-27',
        'related_order', v_work_no || '-2',
        'related_order_id', v_entity_id,
        'remark', 'BOM 领料（重复行）',
        'created_at', now()
      )
    );
  END LOOP;
END $$;