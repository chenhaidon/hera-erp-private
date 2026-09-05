CREATE OR REPLACE FUNCTION adjust_26jlkxd006_report_times() RETURNS TABLE (
  work_no text,
  old_max timestamptz,
  new_max timestamptz
) LANGUAGE plpgsql AS $$
DECLARE
  v_work record;
  v_op record;
  v_r record;
  v_min_t timestamptz;
  v_max_t timestamptz;
  v_target timestamptz := '2026-08-25T00:00:00+08:00'::timestamptz;
  v_ratio numeric;
  v_min_e numeric;
  v_new_ops jsonb := '[]'::jsonb;
  v_new_reports jsonb;
  v_new_time timestamptz;
BEGIN
  FOR v_work IN
    SELECT e.id, e.data->>'work_no' AS work_no
    FROM entity_store e
    WHERE e.entity_type='work_orders' AND e.data->>'contract_no'='26JLKXD006'
  LOOP
    SELECT min((r->>'report_time')::timestamptz), max((r->>'report_time')::timestamptz)
    INTO v_min_t, v_max_t
    FROM entity_store e,
         jsonb_array_elements(e.data->'operations') AS op,
         jsonb_array_elements(op->'reports') AS r
    WHERE e.id = v_work.id;

    IF v_max_t IS NULL OR v_max_t <= v_target THEN
      CONTINUE;
    END IF;

    v_min_e := EXTRACT(EPOCH FROM v_min_t);
    v_ratio := (EXTRACT(EPOCH FROM v_target) - v_min_e) / NULLIF(EXTRACT(EPOCH FROM v_max_t) - v_min_e, 0);

    v_new_ops := '[]'::jsonb;
    FOR v_op IN
      SELECT op AS op_obj, (op->>'seq')::int AS seq
      FROM entity_store e,
           jsonb_array_elements(e.data->'operations') AS op
      WHERE e.id = v_work.id
      ORDER BY (op->>'seq')::int
    LOOP
      v_new_reports := '[]'::jsonb;
      FOR v_r IN
        SELECT r AS report_obj
        FROM jsonb_array_elements(v_op.op_obj->'reports') AS r
      LOOP
        v_new_time := to_timestamp(v_min_e + (EXTRACT(EPOCH FROM (v_r.report_obj->>'report_time')::timestamptz) - v_min_e) * v_ratio)::timestamptz;
        v_new_reports := v_new_reports || jsonb_set(v_r.report_obj, '{report_time}', to_jsonb(v_new_time));
      END LOOP;
      v_new_ops := v_new_ops || jsonb_set(v_op.op_obj, '{reports}', v_new_reports);
    END LOOP;

    UPDATE entity_store SET data = jsonb_set(data, '{operations}', v_new_ops) WHERE id = v_work.id;

    work_no := v_work.work_no;
    old_max := v_max_t;
    SELECT max((r->>'report_time')::timestamptz) INTO new_max
    FROM entity_store e,
         jsonb_array_elements(e.data->'operations') AS op,
         jsonb_array_elements(op->'reports') AS r
    WHERE e.id = v_work.id;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;