CREATE OR REPLACE FUNCTION adjust_outsource_dates_26jlkxd006() RETURNS TABLE (
  shipment_no text,
  new_ship_date date,
  new_return_date date
) LANGUAGE plpgsql AS $$
DECLARE
  v_s record;
  v_op_max date;
  v_ship date;
  v_return date;
BEGIN
  FOR v_s IN
    SELECT s.id, s.shipment_no, s.operation_code, s.work_order_id::text AS work_id
    FROM outsource_shipments s
    WHERE s.work_order_no LIKE 'WO-2026-0006-%'
  LOOP
    SELECT max((rr->>'report_time')::timestamptz)::date
    INTO v_op_max
    FROM entity_store e,
         jsonb_array_elements(e.data->'operations') AS op,
         jsonb_array_elements(op->'reports') AS rr
    WHERE e.id = v_s.work_id AND op->>'code' = v_s.operation_code;

    IF v_op_max IS NULL THEN CONTINUE; END IF;

    v_ship := v_op_max - 2;
    v_return := v_op_max + 1;

    UPDATE outsource_shipments SET shipment_date = v_ship WHERE id = v_s.id;
    UPDATE outsource_returns SET return_date = v_return WHERE shipment_id = v_s.id;

    shipment_no := v_s.shipment_no;
    new_ship_date := v_ship;
    new_return_date := v_return;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;