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
      FOR v_r IN SELECT r AS report_obj FROM jsonb_array_elements(v_op.op_obj->'reports') AS r LOOP
        v_t := v_t + make_interval(secs => v_step);
        v_new_reports := v_new_reports || jsonb_set(v_r.report_obj, '{report_time}', to_jsonb(v_t));
        v_max_op_time := v_t;
      END LOOP;
      v_new_ops := v_new_ops || jsonb_set(v_op.op_obj, '{reports}', v_new_reports);
      -- 过程检查时间跟随该工序最后报工时间
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

-- 重新同步外协发料/回货日期（基于重排后的报工时间）
DROP FUNCTION IF EXISTS sync_outsource_dates(text);
CREATE OR REPLACE FUNCTION sync_outsource_dates(p_contract_no text)
RETURNS TABLE(shipment_no text, new_ship_date date, new_return_date date)
LANGUAGE plpgsql AS $$
DECLARE
  v_s record; v_op_max date; v_ship date; v_return date;
BEGIN
  FOR v_s IN
    SELECT s.id, s.shipment_no, s.operation_code, s.work_order_id AS work_id
    FROM outsource_shipments s
    WHERE s.work_order_no IN (SELECT e.data->>'work_no' FROM entity_store e WHERE e.entity_type='work_orders' AND e.data->>'contract_no'=p_contract_no)
  LOOP
    SELECT max((rr->>'report_time')::timestamptz)::date INTO v_op_max
    FROM entity_store e, jsonb_array_elements(e.data->'operations') AS op, jsonb_array_elements(op->'reports') AS rr
    WHERE e.id=v_s.work_id AND op->>'code'=v_s.operation_code;
    IF v_op_max IS NULL THEN CONTINUE; END IF;
    v_ship := v_op_max - 2;
    v_return := v_op_max + 1;
    UPDATE outsource_shipments SET shipment_date=v_ship WHERE id=v_s.id;
    UPDATE outsource_returns SET return_date=v_return WHERE shipment_id=v_s.id;
    shipment_no := v_s.shipment_no; new_ship_date := v_ship; new_return_date := v_return; RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;