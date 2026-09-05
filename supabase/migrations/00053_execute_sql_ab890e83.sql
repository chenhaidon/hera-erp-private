CREATE OR REPLACE FUNCTION split_work_reports() RETURNS void AS $$
DECLARE
  r record;
  ops jsonb;
  op jsonb;
  new_ops jsonb;
  rep jsonb;
  total int;
  days int;
  base_date date;
  unit_price numeric;
  operator jsonb;
  i int;
  qty int;
  report_id text;
  new_report jsonb;
  report_time text;
BEGIN
  FOR r IN SELECT id, data FROM entity_store WHERE entity_type='work_orders'
  LOOP
    ops := r.data->'operations';
    IF ops IS NULL OR jsonb_array_length(ops) = 0 THEN
      CONTINUE;
    END IF;
    new_ops := '[]'::jsonb;
    FOR op IN SELECT jsonb_array_elements(ops)
    LOOP
      IF (op->>'category') = 'outsourcing' OR op->'reports' IS NULL OR jsonb_array_length(op->'reports') = 0 THEN
        new_ops := new_ops || jsonb_build_array(op);
        CONTINUE;
      END IF;
      total := (SELECT sum((x->>'qty')::int) FROM jsonb_array_elements(op->'reports') AS x);
      unit_price := ((op->'reports'->0->>'unit_price')::numeric);
      base_date := (op->'reports'->0->>'report_time')::date;
      operator := op->'reports'->0;
      days := CASE WHEN total <= 10 THEN 1 WHEN total <= 80 THEN 2 ELSE 3 END;
      IF days <= 1 THEN
        new_ops := new_ops || jsonb_build_array(op);
        CONTINUE;
      END IF;
      rep := '[]'::jsonb;
      FOR i IN 0..days-1 LOOP
        qty := CASE WHEN i = days-1 THEN total - (total/days)*(days-1) ELSE total/days END;
        report_id := gen_random_uuid()::text;
        IF i = 0 THEN report_time := base_date::text || ' 08:00:00'; END IF;
        IF i = 1 THEN report_time := (base_date + 1)::text || ' 10:00:00'; END IF;
        IF i > 1 THEN report_time := (base_date + i)::text || ' 12:00:00'; END IF;
        new_report := jsonb_build_object(
          'id', report_id,
          'qty', qty,
          'spec', operator->>'spec',
          'color', operator->>'color',
          'amount', round((qty * unit_price)::numeric, 2),
          'work_no', operator->>'work_no',
          'unit_price', unit_price,
          'operator_id', operator->>'operator_id',
          'operator_name', operator->>'operator_name',
          'report_time', report_time,
          'operation_code', operator->>'operation_code',
          'operation_name', operator->>'operation_name'
        );
        rep := rep || jsonb_build_array(new_report);
      END LOOP;
      op := jsonb_set(op, '{reports}', rep, true);
      new_ops := new_ops || jsonb_build_array(op);
    END LOOP;
    UPDATE entity_store SET data = jsonb_set(data, '{operations}', new_ops, true) WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS split_work_reports();