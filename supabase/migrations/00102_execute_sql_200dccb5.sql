DO $$
DECLARE
  v_wo record;
  v_op jsonb;
  v_new_ops jsonb[];
  v_reports jsonb;
  v_add_count int;
  v_unit_price numeric;
  v_new_report jsonb;
  v_dates text[] := ARRAY['2026-07-02','2026-07-03','2026-07-04','2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-21','2026-07-22','2026-07-23','2026-07-24','2026-07-25','2026-07-26','2026-07-27','2026-07-28','2026-07-29'];
  v_emp_ids text[];
  v_emp_names text[];
  v_i int;
  v_idx int;
  v_plan_qty int;
  v_spec text;
  v_color text;
BEGIN
  SELECT array_agg(id ORDER BY id), array_agg(data->>'name' ORDER BY id)
    INTO v_emp_ids, v_emp_names
  FROM entity_store WHERE entity_type = 'employees';

  FOR v_wo IN
    SELECT id, data FROM entity_store
    WHERE entity_type = 'work_orders'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(data->'operations') op,
                    jsonb_array_elements(op->'reports') r
        WHERE r->>'report_time' LIKE '2026-07-%'
      )
  LOOP
    v_new_ops := '{}';

    FOR v_op IN SELECT * FROM jsonb_array_elements(v_wo.data->'operations') LOOP
      SELECT jsonb_agg(r) INTO v_reports
      FROM jsonb_array_elements(v_op->'reports') r
      WHERE r->>'report_time' LIKE '2026-07-%';

      IF v_reports IS NULL THEN
        v_new_ops := v_new_ops || v_op;
        CONTINUE;
      END IF;

      v_add_count := GREATEST(1, ceil(jsonb_array_length(v_reports) * 2.5)::int);

      SELECT round(avg((r->>'amount')::numeric), 2) INTO v_unit_price
      FROM jsonb_array_elements(v_op->'reports') r
      WHERE r->>'report_time' LIKE '2026-07-%';

      v_plan_qty := COALESCE((v_op->>'plan_qty')::int, (v_op->'reports'->0->>'qty')::int, 100);
      v_spec := COALESCE(v_op->'reports'->0->>'spec', '');
      v_color := COALESCE(v_op->'reports'->0->>'color', '');

      FOR v_i IN 1..v_add_count LOOP
        v_idx := 1 + floor(random() * array_length(v_emp_ids, 1))::int;
        v_new_report := jsonb_build_object(
          'id', gen_random_uuid()::text,
          'qty', v_plan_qty,
          'spec', v_spec,
          'color', v_color,
          'amount', v_unit_price,
          'work_no', v_wo.data->>'work_no',
          'unit_price', v_unit_price,
          'operator_id', v_emp_ids[v_idx],
          'report_time', v_dates[1 + floor(random() * array_length(v_dates, 1))::int]
            || ' ' || lpad((8 + floor(random() * 10))::int::text, 2, '0')
            || ':' || lpad((floor(random() * 60))::int::text, 2, '0') || ':00',
          'operator_name', v_emp_names[v_idx],
          'operation_code', v_op->>'code',
          'operation_name', v_op->>'name'
        );
        v_reports := v_reports || v_new_report;
      END LOOP;

      v_op := jsonb_set(v_op, '{reports}', v_reports);
      v_new_ops := v_new_ops || v_op;
    END LOOP;

    UPDATE entity_store
      SET data = jsonb_set(data, '{operations}', to_jsonb(v_new_ops)), updated_at = now()
    WHERE id = v_wo.id AND entity_type = 'work_orders';
  END LOOP;
END $$;