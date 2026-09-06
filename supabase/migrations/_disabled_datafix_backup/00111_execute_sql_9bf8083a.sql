BEGIN; DO $$
DECLARE
  v_wo record;
  v_ops jsonb; v_op jsonb; v_reports jsonb; v_rep jsonb;
  v_new_reports jsonb;
  v_max_time timestamptz; v_target_id text; v_new_time timestamptz;
  v_j int; v_k int;
BEGIN
  FOR v_wo IN
    SELECT id, data->>'work_no' AS work_no FROM entity_store
    WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD014'
  LOOP
    v_ops := (SELECT data->'operations' FROM entity_store WHERE id=v_wo.id);
    FOR v_j IN 0..jsonb_array_length(v_ops)-1 LOOP
      v_op := v_ops->v_j;
      CONTINUE WHEN v_op->>'code' != 'G-002';
      v_reports := v_op->'reports';
      -- find the report with the latest report_time
      SELECT r->>'id', (r->>'report_time')::timestamptz INTO v_target_id, v_max_time
      FROM jsonb_array_elements(v_reports) r
      ORDER BY (r->>'report_time')::timestamptz DESC LIMIT 1;
      -- build new reports array with that report moved to 2026-09-06 keeping same time-of-day
      v_new_reports := '[]'::jsonb;
      FOR v_k IN 0..jsonb_array_length(v_reports)-1 LOOP
        v_rep := v_reports->v_k;
        IF v_rep->>'id' = v_target_id THEN
          v_new_time := '2026-09-06'::date + (v_max_time AT TIME ZONE 'Asia/Shanghai')::time AT TIME ZONE 'Asia/Shanghai';
          v_rep := jsonb_set(v_rep, '{report_time}', to_jsonb(to_char(v_new_time AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"')));
        END IF;
        v_new_reports := v_new_reports || jsonb_build_array(v_rep);
      END LOOP;
      v_op := jsonb_set(v_op, '{reports}', v_new_reports);
      v_ops := jsonb_set(v_ops, ('{'||v_j||'}')::text[], v_op);
    END LOOP;
    UPDATE entity_store SET data = data || jsonb_build_object('operations', v_ops, 'updated_at', now())
    WHERE id=v_wo.id AND entity_type='work_orders';
  END LOOP;
END $$; COMMIT;