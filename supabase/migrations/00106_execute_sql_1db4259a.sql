BEGIN; DO $$
DECLARE
  v_wo_id text; v_work_no text; v_pcode text; v_pname text; v_color text; v_sku text;
  v_op jsonb; v_mr_id text; v_mr_code text; v_inv_id text; v_inv_qty int; v_remaining int;
BEGIN
  -- WO-2026-0016-1
  v_wo_id := 'f1f8a770-a6a5-4fad-816d-25deb35be6a3';
  v_work_no := 'WO-2026-0016-1'; v_pcode := 'SZ98870'; v_pname := '希腊绒机绗被'; v_color := ''; v_sku := 'sz98870-ok';
  v_mr_id := gen_random_uuid()::text; v_mr_code := 'MR-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
  INSERT INTO entity_store (id, entity_type, data) VALUES (v_mr_id, 'material_requisitions', jsonb_build_object(
    'id', v_mr_id, 'code', v_mr_code, 'work_order_id', v_wo_id, 'work_order_no', v_work_no,
    'contract_no', '26JLHD014', 'related_work_order_no', v_work_no, 'applicant', '应巧凤',
    'department', '生产部', 'status', 'completed', 'required_date', '2026-08-25',
    'issued_at', '2026-08-25 09:00:00', 'created_at', '2026-08-25 09:00:00', 'updated_at', now(),
    'remark', '按工单BOM发料',
    'items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-a-greek-220','material_code','MAT-A-GREEK-220','material_name','A#220g希腊绒','unit','m','color',v_color,'required_qty',403.32,'issued_qty',403.32,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-b-cotton-40s','material_code','MAT-B-COTTON-40S','material_name','B#40S110/90棉布','unit','m','color',v_color,'required_qty',181.2,'issued_qty',181.2,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-nonwoven-25g','material_code','MAT-NONWOVEN-25G','material_name','25g无纺布','unit','m','color',v_color,'required_qty',15.12,'issued_qty',15.12,'warehouse','辅料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-c150-down','material_code','MAT-C150-DOWN','material_name','150g羽丝棉','unit','kg','color',v_color,'required_qty',75.06,'issued_qty',75.06,'warehouse','填充仓','specification','')
    )
  ));
  FOR v_op IN SELECT * FROM jsonb_array_elements((SELECT data->'items' FROM entity_store WHERE id=v_mr_id AND entity_type='material_requisitions')) LOOP
    v_remaining := (v_op->>'issued_qty')::int;
    FOR v_inv_id, v_inv_qty IN
      SELECT id, COALESCE((data->>'quantity')::int,0) FROM entity_store
      WHERE entity_type='inventory' AND data->>'material_id'=v_op->>'material_id' ORDER BY COALESCE((data->>'quantity')::int,0) DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_inv_qty >= v_remaining THEN
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', v_inv_qty - v_remaining) WHERE id = v_inv_id;
        v_remaining := 0;
      ELSE
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', 0) WHERE id = v_inv_id;
        v_remaining := v_remaining - v_inv_qty;
      END IF;
    END LOOP;
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'MO-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'out', 'subtype', '生产领料', 'material_id', v_op->>'material_id', 'material_code', v_op->>'material_code',
      'material_name', v_op->>'material_name', 'quantity', (v_op->>'issued_qty')::numeric, 'unit', v_op->>'unit',
      'warehouse', v_op->>'warehouse', 'handler', '仓库管理员', 'record_date', '2026-08-25',
      'related_order', v_work_no, 'related_order_id', v_wo_id, 'contract_no', '26JLHD014',
      'remark', '工单发料', 'created_at', '2026-08-25T09:00:00+08:00'
    ));
  END LOOP;

  -- WO-2026-0016-2
  v_wo_id := '0614dbb6-8479-4595-bafd-c8ab879c59fa';
  v_work_no := 'WO-2026-0016-2'; v_pcode := 'SZ26008'; v_pname := '纯棉素色密绗被'; v_color := '米色'; v_sku := 'sz26008-ok';
  v_mr_id := gen_random_uuid()::text; v_mr_code := 'MR-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
  INSERT INTO entity_store (id, entity_type, data) VALUES (v_mr_id, 'material_requisitions', jsonb_build_object(
    'id', v_mr_id, 'code', v_mr_code, 'work_order_id', v_wo_id, 'work_order_no', v_work_no,
    'contract_no', '26JLHD014', 'related_work_order_no', v_work_no, 'applicant', '应巧凤',
    'department', '生产部', 'status', 'completed', 'required_date', '2026-08-25',
    'issued_at', '2026-08-25 09:00:00', 'created_at', '2026-08-25 09:00:00', 'updated_at', now(),
    'remark', '按工单BOM发料',
    'items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-cotton-32s','material_code','MAT-COTTON-32S','material_name','32S68×62全棉素色布','unit','m','color',v_color,'required_qty',203.4,'issued_qty',203.4,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-nonwoven-25g','material_code','MAT-NONWOVEN-25G','material_name','25g无纺布','unit','m','color',v_color,'required_qty',190.8,'issued_qty',190.8,'warehouse','辅料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-c200-cotton','material_code','MAT-C200-COTTON','material_name','200g 90%漂白针刺棉','unit','kg','color',v_color,'required_qty',115.8,'issued_qty',115.8,'warehouse','填充仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-quilt-thread','material_code','MAT-QUILT-THREAD','material_name','配色绗线','unit','万针','color',v_color,'required_qty',2580,'issued_qty',2580,'warehouse','辅料仓','specification','')
    )
  ));
  FOR v_op IN SELECT * FROM jsonb_array_elements((SELECT data->'items' FROM entity_store WHERE id=v_mr_id AND entity_type='material_requisitions')) LOOP
    v_remaining := (v_op->>'issued_qty')::int;
    FOR v_inv_id, v_inv_qty IN
      SELECT id, COALESCE((data->>'quantity')::int,0) FROM entity_store
      WHERE entity_type='inventory' AND data->>'material_id'=v_op->>'material_id' ORDER BY COALESCE((data->>'quantity')::int,0) DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_inv_qty >= v_remaining THEN
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', v_inv_qty - v_remaining) WHERE id = v_inv_id;
        v_remaining := 0;
      ELSE
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', 0) WHERE id = v_inv_id;
        v_remaining := v_remaining - v_inv_qty;
      END IF;
    END LOOP;
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'MO-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'out', 'subtype', '生产领料', 'material_id', v_op->>'material_id', 'material_code', v_op->>'material_code',
      'material_name', v_op->>'material_name', 'quantity', (v_op->>'issued_qty')::numeric, 'unit', v_op->>'unit',
      'warehouse', v_op->>'warehouse', 'handler', '仓库管理员', 'record_date', '2026-08-25',
      'related_order', v_work_no, 'related_order_id', v_wo_id, 'contract_no', '26JLHD014',
      'remark', '工单发料', 'created_at', '2026-08-25T09:00:00+08:00'
    ));
  END LOOP;
END $$; COMMIT;