DROP FUNCTION IF EXISTS reorder_contract_reports(text, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION reorder_contract_reports(p_contract_no text, p_start timestamptz, p_end timestamptz)
RETURNS TABLE(work_no text, total_reports int)
LANGUAGE plpgsql AS $$
DECLARE
  v_work record; v_total int; v_step numeric; v_t timestamptz;
  v_new_ops jsonb; v_new_reports jsonb; v_r jsonb;
  v_op record; v_max_op_time timestamptz;
BEGIN
  FOR v_work IN SELECT e.id, e.data->>'work_no' AS work_no FROM entity_store e WHERE e.entity_type='work_orders' AND e.data->>'contract_no'=p_contract_no ORDER BY e.data->>'work_no', e.id LOOP
    SELECT count(*) INTO v_total
    FROM entity_store e, jsonb_array_elements(e.data->'operations') AS op, jsonb_array_elements(op->'reports') AS r WHERE e.id=v_work.id;
    IF v_total = 0 THEN CONTINUE; END IF;
    v_step := GREATEST(EXTRACT(EPOCH FROM (p_end - p_start)) / v_total, 60);
    v_t := p_start;
    v_new_ops := '[]'::jsonb;

    FOR v_op IN SELECT op AS op_obj FROM entity_store e, jsonb_array_elements(e.data->'operations') AS op WHERE e.id=v_work.id ORDER BY COALESCE((op->>'seq')::int,0), op->>'code' LOOP
      v_new_reports := '[]'::jsonb;
      v_max_op_time := v_t;
      FOR v_r IN SELECT r FROM jsonb_array_elements(v_op.op_obj->'reports') AS r LOOP
        v_t := v_t + make_interval(secs => v_step);
        v_new_reports := v_new_reports || jsonb_set(v_r, '{report_time}', to_jsonb(v_t));
        v_max_op_time := v_t;
      END LOOP;
      v_new_ops := v_new_ops || jsonb_set(v_op.op_obj, '{reports}', v_new_reports);
      UPDATE entity_store pi SET data = pi.data || jsonb_build_object(
        'check_date', (v_max_op_time + interval '1 hour')::date,
        'created_at', v_max_op_time + interval '1 hour', 'updated_at', v_max_op_time + interval '2 hour')
      WHERE pi.entity_type='process_inspections' AND pi.data->>'work_no'=v_work.work_no AND pi.data->>'operation_code'=v_op.op_obj->>'code';
    END LOOP;

    UPDATE entity_store SET data = jsonb_set(data, '{operations}', v_new_ops) WHERE id=v_work.id;
    work_no := v_work.work_no; total_reports := v_total; RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;