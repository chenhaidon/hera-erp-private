DROP FUNCTION IF EXISTS advance_contract(text, text, date, date, date);
CREATE OR REPLACE FUNCTION advance_contract(
  p_contract_no text, p_order_no text, p_ship_date date, p_sign_date date, p_settle_date date
) RETURNS TABLE(work_no text, action text, detail text)
LANGUAGE plpgsql AS $$
DECLARE
  v_work_order record; v_op jsonb; v_ops jsonb; v_new_ops jsonb;
  v_report jsonb; v_new_reports jsonb;
  v_plan_qty int; v_completed_qty int; v_target_qty int; v_remaining int; v_batch_qty int;
  v_report_time timestamptz; v_last_time timestamptz;
  v_op_price numeric; v_op_outsource_price numeric;
  v_operator_name text; v_qc_name text;
  v_factory_id uuid; v_factory_name text;
  v_shipment_date date; v_return_date date; v_shipment_id uuid;
  v_defective int; v_qualified int; v_inspection_status text; v_defect_reason text;
  v_pi_code text; v_pi_id text;
  v_op_name text; v_op_code text; v_seq int; v_op_status text; v_op_category text;
  v_i int; v_j int; v_op_idx int;
  v_product_steps jsonb; v_step jsonb;
  v_color text; v_spec text; v_work_id text; v_work_no text;
  v_product_code text; v_product_name text; v_product_id text;
  v_customer_name text; v_sales_id text; v_total_amount numeric;
  v_now timestamptz := now();
  v_workers text[]; v_qcs text[];
  v_ship_qty int; v_sku_id text; v_inv_product_id text; v_location_id text;
  v_record_no text; v_existing int; v_inventory record;
  v_fi_count int; v_fgi_count int; v_so_item record;
  v_phys_wo_id uuid;
BEGIN
  SELECT array_agg(e.data->>'name' ORDER BY random()) INTO v_workers
  FROM entity_store e
  WHERE e.entity_type='employees' AND e.data->>'department'='生产部'
    AND e.data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');
  IF v_workers IS NULL OR array_length(v_workers,1) IS NULL THEN v_workers := ARRAY['工人']; END IF;

  SELECT array_agg(e.data->>'name' ORDER BY random()) INTO v_qcs
  FROM entity_store e
  WHERE e.entity_type='employees' AND (e.data->>'position' ILIKE '%质检%' OR e.data->>'position'='质检车间主任');
  IF v_qcs IS NULL OR array_length(v_qcs,1) IS NULL THEN
    SELECT array_agg(e.data->>'name' ORDER BY random()) INTO v_qcs
    FROM entity_store e WHERE e.entity_type='employees'
      AND e.data->>'position' IN ('质检车间主任','生产厂长','包装车间主任');
  END IF;
  IF v_qcs IS NULL OR array_length(v_qcs,1) IS NULL THEN v_qcs := ARRAY['质检员']; END IF;

  FOR v_work_order IN
    SELECT e.id, e.data
    FROM entity_store e
    WHERE e.entity_type='work_orders' AND e.data->>'contract_no'=p_contract_no AND e.data->>'status' <> 'completed'
    ORDER BY e.data->>'work_no', e.id
  LOOP
    v_work_id := v_work_order.data->>'id';
    v_work_no := v_work_order.data->>'work_no';
    v_plan_qty := COALESCE((v_work_order.data->>'plan_quantity')::int,0);
    v_color := COALESCE(v_work_order.data->>'color','');
    v_spec := COALESCE(v_work_order.data->>'sku_summary', v_work_order.data->>'specification','');
    v_product_code := v_work_order.data->>'product_code';
    v_product_name := v_work_order.data->>'product_name';
    v_product_id := v_work_order.data->>'product_id';
    v_ops := v_work_order.data->'operations';
    v_new_ops := '[]'::jsonb;
    v_last_time := COALESCE((v_work_order.data->>'issued_at')::timestamptz, '2026-08-01 08:00:00+08'::timestamptz);

    SELECT p.data->'process_steps' INTO v_product_steps
    FROM entity_store p WHERE p.entity_type='products' AND p.data->>'code'=v_product_code LIMIT 1;

    FOR v_op_idx IN 0 .. jsonb_array_length(v_ops)-1 LOOP
      v_op := v_ops->v_op_idx;
      v_op_code := v_op->>'code'; v_op_name := v_op->>'name';
      v_seq := COALESCE((v_op->>'seq')::int, v_op_idx+1);
      v_op_status := v_op->>'status'; v_op_category := v_op->>'category';
      v_op_price := 0; v_op_outsource_price := 0;

      IF v_product_steps IS NOT NULL THEN
        FOR v_i IN 0 .. jsonb_array_length(v_product_steps)-1 LOOP
          v_step := v_product_steps->v_i;
          IF v_step->>'code' = v_op_code THEN
            v_op_price := COALESCE((v_step->>'price')::numeric,0);
            v_op_outsource_price := COALESCE((v_step->>'outsourcing_price')::numeric,0);
            EXIT;
          END IF;
        END LOOP;
      END IF;

      IF v_op_status <> 'completed' AND v_op_category IN ('internal','outsourcing') THEN
        v_completed_qty := COALESCE((v_op->>'completed_qty')::int,0);
        v_target_qty := COALESCE((v_op->>'plan_qty')::int, v_plan_qty) - v_completed_qty;
        v_remaining := v_target_qty;
        v_new_reports := COALESCE(v_op->'reports','[]'::jsonb);

        SELECT max((r->>'report_time')::timestamptz) INTO v_last_time
        FROM jsonb_array_elements(v_new_reports) AS r;
        v_last_time := COALESCE(v_last_time, v_last_time);

        IF jsonb_array_length(v_new_reports) > 0 THEN
          v_report_time := COALESCE((v_new_reports->-1->>'report_time')::timestamptz, v_last_time);
        ELSE
          v_report_time := COALESCE(v_last_time, '2026-08-01 08:00:00+08'::timestamptz);
        END IF;

        WHILE v_remaining > 0 LOOP
          v_batch_qty := LEAST(v_remaining, 20 + floor(random()*30)::int);
          IF v_batch_qty <= 0 THEN v_batch_qty := v_remaining; END IF;
          v_operator_name := v_workers[1 + floor(random()*array_length(v_workers,1))::int];
          v_report_time := v_report_time + (floor(random()*180+120)::int || ' minutes')::interval;
          v_report := jsonb_build_object(
            'id', gen_random_uuid()::text, 'operation_code', v_op_code, 'operation_name', v_op_name,
            'operator_id','', 'operator_name', v_operator_name,
            'qty', v_batch_qty, 'quantity', v_batch_qty,
            'unit_price', v_op_price, 'amount', round(v_batch_qty*v_op_price,2),
            'report_time', v_report_time, 'work_no', v_work_no,
            'color', v_color, 'spec', v_spec, 'remark','计件报工'
          );
          v_new_reports := v_new_reports || jsonb_build_array(v_report);
          v_remaining := v_remaining - v_batch_qty;
        END LOOP;

        v_op := jsonb_set(v_op, '{reports}', v_new_reports);
        v_op := jsonb_set(v_op, '{completed_qty}', to_jsonb(v_plan_qty));
        v_op := jsonb_set(v_op, '{status}', '"completed"'::jsonb);
        v_op := jsonb_set(v_op, '{completed}', 'true'::jsonb);
        IF (v_op->>'pqc_inspection_id') IS NULL OR v_op->>'pqc_inspection_id'='' THEN
          v_op := jsonb_set(v_op, '{pqc_inspection_id}', to_jsonb(gen_random_uuid()::text));
        END IF;
        v_last_time := v_report_time;
      END IF;

      SELECT COUNT(*) INTO v_j FROM entity_store pi
      WHERE pi.entity_type='process_inspections' AND pi.data->>'work_no'=v_work_no AND pi.data->>'operation_code'=v_op_code;
      IF v_j = 0 THEN
        v_qc_name := v_qcs[1 + floor(random()*array_length(v_qcs,1))::int];
        v_defective := CASE WHEN random() < 0.12 THEN 1 + floor(random()*2)::int ELSE 0 END;
        v_qualified := GREATEST(v_plan_qty - v_defective, 0);
        v_inspection_status := CASE WHEN v_defective > 0 THEN 'partial' ELSE 'qualified' END;
        v_defect_reason := CASE WHEN v_defective > 0 THEN '外观轻微瑕疵' ELSE '' END;
        v_pi_code := 'PI-' || v_work_id || '-' || v_op_code;
        v_pi_id := gen_random_uuid()::text;
        INSERT INTO entity_store (id, entity_type, data) VALUES (
          gen_random_uuid()::text, 'process_inspections',
          jsonb_build_object(
            'id', v_pi_id, 'code', v_pi_code, 'contract_no', p_contract_no,
            'work_id', v_work_id, 'work_no', v_work_no, 'work_order_id', v_work_id, 'work_order_no', v_work_no,
            'operation_code', v_op_code, 'operation_name', v_op_name,
            'product_code', v_product_code, 'product_name', v_product_name,
            'check_date', (v_last_time + interval '1 hour')::date,
            'check_qty', v_plan_qty, 'qualified_qty', v_qualified, 'unqualified_qty', v_defective,
            'qualified_rate', round(v_qualified::numeric/NULLIF(v_plan_qty,0)*100,2)::text || '%',
            'result', v_inspection_status, 'status','inspected',
            'defect_reason', v_defect_reason, 'inspector', v_qc_name,
            'items', jsonb_build_array(
              jsonb_build_object('name','外观缺陷','category','appearance','standard',0,'actual',0,'unit','处','lower',0,'upper',1,'result','qualified'),
              jsonb_build_object('name','尺寸偏差','category','physical','standard',0,'actual', CASE WHEN v_defective>0 THEN 1 ELSE 0 END,'unit','mm','lower',-2,'upper',2,'result','qualified')
            ),
            'created_at', v_last_time + interval '1 hour', 'updated_at', v_last_time + interval '2 hour'
          )
        );
      END IF;

      IF v_op_category = 'outsourcing' THEN
        SELECT COUNT(*) INTO v_j FROM outsource_shipments os
        WHERE os.work_order_id = v_work_id AND os.operation_code = v_op_code;
        IF v_j = 0 THEN
          SELECT min((r->>'report_time')::timestamptz), max((r->>'report_time')::timestamptz)
          INTO v_shipment_date, v_return_date
          FROM jsonb_array_elements(v_op->'reports') AS r;
          IF v_shipment_date IS NOT NULL THEN
            v_shipment_date := (v_shipment_date - interval '2 days')::date;
            v_return_date := (v_return_date + (floor(random()*2+1)::int || ' days')::interval)::date;
            IF v_op_code = 'G-008' THEN
              SELECT of.id, of.factory_name INTO v_factory_id, v_factory_name FROM outsource_factories of WHERE of.processing_capability ILIKE '%绣花%' ORDER BY random() LIMIT 1;
            ELSIF v_op_code = 'G-010' THEN
              SELECT of.id, of.factory_name INTO v_factory_id, v_factory_name FROM outsource_factories of WHERE of.processing_capability ILIKE '%水洗%' ORDER BY random() LIMIT 1;
            ELSE
              SELECT of.id, of.factory_name INTO v_factory_id, v_factory_name FROM outsource_factories of ORDER BY random() LIMIT 1;
            END IF;
            v_defective := CASE WHEN random() < 0.1 THEN 1 ELSE 0 END;
            v_qualified := GREATEST(v_plan_qty - v_defective,0);
            v_inspection_status := CASE WHEN v_defective>0 THEN 'partial' ELSE 'qualified' END;
            SELECT id INTO v_phys_wo_id FROM work_orders WHERE work_orders.work_no = v_work_no LIMIT 1;
            IF v_phys_wo_id IS NULL THEN
              INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, status, source, priority)
              VALUES (v_work_no, v_product_code, v_product_name, v_plan_qty, 'completed','plan','medium')
              RETURNING id INTO v_phys_wo_id;
            END IF;
            INSERT INTO outsource_shipments (id, shipment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, shipment_date, shipment_quantity, logistics_company, logistics_no, status, created_at, updated_at)
            VALUES (gen_random_uuid(), 'OS-'||v_work_id||'-'||v_op_code, v_work_id, v_work_no, v_op_code, v_op_name, v_product_code, v_product_name, v_factory_id, v_factory_name, v_shipment_date, v_plan_qty, '安能物流', 'LOG-'||v_work_id||'-'||v_op_code, 'shipped', v_now, v_now)
            RETURNING id INTO v_shipment_id;
            INSERT INTO outsource_returns (id, return_no, shipment_no, shipment_id, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, return_date, return_quantity, qualified_quantity, defective_quantity, inspection_status, status, return_type, defect_reason, inspector, created_at, updated_at)
            VALUES (gen_random_uuid(), 'OR-'||v_work_id||'-'||v_op_code, 'OS-'||v_work_id||'-'||v_op_code, v_shipment_id, v_work_id, v_work_no, v_op_code, v_op_name, v_product_code, v_product_name, v_factory_id, v_factory_name, v_return_date, v_plan_qty, v_qualified, v_defective, v_inspection_status, 'returned', 'semi_finished', CASE WHEN v_defective>0 THEN '尺寸轻微偏差' ELSE '' END, v_qc_name, v_now, v_now);
            INSERT INTO outsource_processing_payments (id, payment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, product_spec, product_color, factory_id, factory_name, quantity, unit_price, amount, status, created_at, updated_at)
            VALUES (gen_random_uuid(), 'OP-'||v_work_id||'-'||v_op_code, v_phys_wo_id, v_work_no, v_op_code, v_op_name, v_product_code, v_product_name, v_spec, v_color, v_factory_id, v_factory_name, v_plan_qty, v_op_outsource_price, round(v_plan_qty*v_op_outsource_price,2), 'pending', v_now, v_now);
          END IF;
        END IF;
      END IF;

      v_new_ops := v_new_ops || jsonb_build_array(v_op);
    END LOOP;

    UPDATE entity_store SET data = data || jsonb_build_object(
      'status','completed','completed_quantity',v_plan_qty,'progress',100,'completed_at',v_now,'updated_at',v_now,'operations',v_new_ops)
    WHERE id = v_work_order.id;
    work_no := v_work_no; action := 'completed'; detail := 'plan_qty='||v_plan_qty::text; RETURN NEXT;
  END LOOP;

  FOR v_work_order IN
    SELECT e.id, e.data, row_number() OVER (ORDER BY e.data->>'work_no', e.id) AS rn
    FROM entity_store e WHERE e.entity_type='work_orders' AND e.data->>'contract_no'=p_contract_no
  LOOP
    v_work_id := v_work_order.data->>'id';
    v_work_no := v_work_order.data->>'work_no';
    v_plan_qty := COALESCE((v_work_order.data->>'completed_quantity')::int, (v_work_order.data->>'plan_quantity')::int, 0);
    v_product_code := v_work_order.data->>'product_code';
    v_product_name := v_work_order.data->>'product_name';
    v_product_id := v_work_order.data->>'product_id';
    v_color := COALESCE(v_work_order.data->>'color','');

    SELECT COUNT(*) INTO v_fi_count FROM entity_store fi WHERE fi.entity_type='finished_inspections' AND fi.data->>'work_id'=v_work_id;
    IF v_fi_count = 0 THEN
      INSERT INTO entity_store (id, entity_type, data) VALUES (
        gen_random_uuid()::text, 'finished_inspections',
        jsonb_build_object(
          'id', gen_random_uuid()::text, 'code', 'FI-'||p_contract_no||'-'||LPAD(v_work_order.rn::text,3,'0'),
          'work_id', v_work_id, 'work_no', v_work_no, 'product_id', v_product_id, 'product_code', v_product_code, 'product_name', v_product_name,
          'color', v_color, 'batch', 'FB-'||p_contract_no||'-'||LPAD(v_work_order.rn::text,3,'0'),
          'check_qty', v_plan_qty, 'qualified_qty', v_plan_qty, 'unqualified_qty', 0, 'result','qualified','status','inspected',
          'inspector', v_qcs[1 + floor(random()*array_length(v_qcs,1))::int],
          'created_at', '2026-08-27T16:00:00+08', 'contract_no', p_contract_no,
          'items', jsonb_build_array(
            jsonb_build_object('category','appearance','name','外观质量','standard',4,'lower',3,'upper',5,'actual',4.5,'result','qualified','unit','级'),
            jsonb_build_object('category','physical','name','尺寸偏差','standard',2,'lower',0,'upper',3,'actual',1.2,'result','qualified','unit','%'),
            jsonb_build_object('category','physical','name','缝制牢度','standard',100,'lower',80,'upper',150,'actual',120,'result','qualified','unit','N'),
            jsonb_build_object('category','physical','name','填充物质量','standard',4,'lower',3,'upper',5,'actual',4.5,'result','qualified','unit','级')
          ), 'defect_reason',''
        )
      );
    END IF;

    SELECT COUNT(*) INTO v_fgi_count FROM entity_store fgi WHERE fgi.entity_type='finished_goods_inbounds' AND fgi.data->>'work_id'=v_work_id;
    IF v_fgi_count = 0 THEN
      v_location_id := CASE
        WHEN v_product_name LIKE '%108×98%' THEN 'loc-finished-3'
        WHEN v_product_name LIKE '%112×106%' THEN 'loc-finished-1'
        WHEN v_product_name LIKE '%98×98%' THEN 'loc-finished-2'
        WHEN v_product_name LIKE '%68×86%' THEN 'loc-finished-1'
        ELSE 'loc-finished-1' END;
      INSERT INTO entity_store (id, entity_type, data) VALUES (
        gen_random_uuid()::text, 'finished_goods_inbounds',
        jsonb_build_object(
          'id', gen_random_uuid()::text, 'inbound_no', 'RKS-'||p_contract_no||'-'||LPAD(v_work_order.rn::text,3,'0'),
          'work_id', v_work_id, 'work_no', v_work_no, 'product_id', v_product_id, 'product_code', v_product_code, 'product_name', v_product_name,
          'quantity', v_plan_qty, 'status','inbound','warehouse','成品仓','location_id', v_location_id,
          'inbound_date', '2026-08-27T08:00:00+08', 'created_at', '2026-08-27T08:00:00+08'
        )
      );
    END IF;
  END LOOP;

  SELECT s.data->>'id', s.data->>'customer_name', s.data->>'total_amount'
  INTO v_sales_id, v_customer_name, v_total_amount
  FROM entity_store s WHERE s.entity_type='sales_orders' AND s.data->>'order_no'=p_order_no LIMIT 1;

  IF v_sales_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing FROM entity_store sh WHERE sh.entity_type='shipments' AND sh.data->>'order_no'=p_order_no;
    IF v_existing = 0 THEN
      SELECT COALESCE(sum((item->>'quantity')::int),0) INTO v_ship_qty
      FROM entity_store, jsonb_array_elements(data->'items') AS item
      WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no;

      INSERT INTO entity_store (id, entity_type, data)
      SELECT gen_random_uuid()::text, 'shipments',
        jsonb_build_object(
          'id', gen_random_uuid()::text, 'shipment_no', 'SH-'||p_contract_no||'-001',
          'order_id', v_sales_id, 'order_no', p_order_no, 'contract_no', p_contract_no,
          'customer_id', '', 'customer_name', v_customer_name,
          'shipment_date', p_ship_date, 'sign_time', p_sign_date, 'status','signed',
          'tracking_no', 'SH-'||p_contract_no||'-001-TRK', 'logistics_company','安能物流',
          'creator','蒋佳男', 'remark', '合计 '||v_ship_qty||' 件，已签收',
          'delivery_records', jsonb_build_array(
            jsonb_build_object('status','shipped','time', p_ship_date::text || ' 10:00:00','remark','已发货'),
            jsonb_build_object('status','signed','time', p_sign_date::text || ' 14:30:00','remark','客户已签收')
          ),
          'items', (SELECT data->'items' FROM entity_store WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no LIMIT 1),
          'boxes', (SELECT jsonb_agg(box) FROM (SELECT jsonb_build_object('box_no','CTN-'||LPAD(row_number() OVER ()::text,3,'0'), 'product_code', item->>'product_code', 'quantity', item->>'quantity', 'gross_weight', round((item->>'quantity')::numeric*0.7,2), 'net_weight', round((item->>'quantity')::numeric*0.65,2), 'volume', round((item->>'quantity')::numeric*0.02,2)::text) AS box FROM entity_store, jsonb_array_elements(data->'items') AS item WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no) sub),
          'created_at', v_now
        )
      FROM entity_store WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no LIMIT 1;
    END IF;

    SELECT COUNT(*) INTO v_existing FROM entity_store fr
    WHERE fr.entity_type='finance_records' AND fr.data->>'contract_no'=p_contract_no AND fr.data->>'type'='应收';
    IF v_existing = 0 THEN
      INSERT INTO entity_store (id, entity_type, data) VALUES (
        gen_random_uuid()::text, 'finance_records',
        jsonb_build_object(
          'id', gen_random_uuid()::text, 'type','应收', 'counterparty', v_customer_name, 'currency','CNY',
          'amount', COALESCE(v_total_amount,0), 'paid_amount', COALESCE(v_total_amount,0),
          'customer_id', (SELECT data->>'customer_id' FROM entity_store WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no LIMIT 1),
          'related_order_id', v_sales_id, 'contract_no', p_contract_no, 'related_order', p_order_no,
          'record_date', p_sign_date, 'month', to_char(p_settle_date,'YYYY-MM'),
          'status','settled','settled_date', p_settle_date, 'remark','发货单 SH-'||p_contract_no||'-001 已结清'
        )
      );
    END IF;

    UPDATE entity_store SET data = data || jsonb_build_object(
      'status','completed','payment_date', p_settle_date, 'payment_status','paid',
      'ship_date', p_ship_date, 'delivery_date', p_ship_date,
      'shipped_quantity', COALESCE((data->>'shipped_quantity')::int,0),
      'sign_time', p_sign_date,
      'logs', COALESCE(data->'logs','[]'::jsonb) || jsonb_build_array(jsonb_build_object('status','completed','operator','邵常青','time', to_char(p_settle_date,'YYYY-MM-DD')||' 16:00','remark','应收账款已结清，销售订单回款完成'))
    ) WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no;

    work_no := p_order_no; action := 'shipment_signed'; detail := 'amount='||COALESCE(v_total_amount,0)::text; RETURN NEXT;
  END IF;

  FOR v_work_order IN
    SELECT e.id, e.data FROM entity_store e
    WHERE e.entity_type='work_orders' AND e.data->>'contract_no'=p_contract_no AND e.data->>'status'='completed'
    ORDER BY e.data->>'work_no', e.id
  LOOP
    v_work_no := v_work_order.data->>'work_no';
    v_plan_qty := COALESCE((v_work_order.data->>'plan_quantity')::int,0);
    v_spec := COALESCE(v_work_order.data->>'sku_summary','');
    v_color := COALESCE(v_work_order.data->>'color','');
    v_product_code := v_work_order.data->>'product_code';

    v_sku_id := CASE
      WHEN v_product_code='SZ98870' AND v_spec ILIKE '112×106%' THEN 'sz98870-ok'
      WHEN v_product_code='SZ98870' AND v_spec ILIKE '108×98%' THEN 'sz98870-kxl'
      WHEN v_product_code='SZ98870' AND v_spec ILIKE '98×98%' THEN 'sz98870-qxl'
      WHEN v_product_code='SZ98870' AND v_spec ILIKE '68×86%' THEN 'sz98870-t'
      WHEN v_color='米色' AND v_spec ILIKE '98×98%' THEN 'sz26008-qxl'
      WHEN v_color='米色' AND v_spec ILIKE '108×98%' THEN 'sz26008-kxl'
      WHEN v_color='米色' AND v_spec ILIKE '112×106%' THEN 'sz26008-ok'
      WHEN v_color='深绿色' AND v_spec ILIKE '98×98%' THEN 'sz26007-qxl'
      WHEN v_color='深绿色' AND v_spec ILIKE '108×98%' THEN 'sz26007-kxl'
      WHEN v_color='深绿色' AND v_spec ILIKE '112×106%' THEN 'sz26007-ok'
      WHEN v_color='蓝色' AND v_spec ILIKE '98×98%' THEN 'sz26009-qxl'
      WHEN v_color='蓝色' AND v_spec ILIKE '108×98%' THEN 'sz26009-kxl'
      WHEN v_color='蓝色' AND v_spec ILIKE '112×106%' THEN 'sz26009-ok'
      ELSE NULL END;
    v_inv_product_id := CASE
      WHEN v_color='深绿色' THEN 'product-sz26007'
      WHEN v_color='蓝色' THEN 'product-sz26009'
      ELSE v_work_order.data->>'product_id' END;

    IF v_sku_id IS NULL OR v_plan_qty <= 0 THEN
      work_no := v_work_no; action := 'skip_inbound_nomap'; detail := v_spec; RETURN NEXT;
    ELSE
      SELECT COUNT(*) INTO v_existing FROM entity_store sr
      WHERE sr.entity_type='stock_records' AND sr.data->>'related_order'=v_work_no AND sr.data->>'subtype'='生产入库';
      IF v_existing = 0 THEN
        v_record_no := 'WI-'||floor(random()*900000+100000)::int::text;
        INSERT INTO entity_store (id, entity_type, data) VALUES (
          gen_random_uuid()::text, 'stock_records',
          jsonb_build_object(
            'id', gen_random_uuid()::text, 'record_no', v_record_no, 'type','in','subtype','生产入库',
            'product_id', v_inv_product_id, 'product_code', v_product_code, 'product_name', v_work_order.data->>'product_name',
            'sku_id', v_sku_id, 'quantity', v_plan_qty, 'warehouse','成品仓','handler','仓库管理员',
            'record_date','2026-08-27','related_order', v_work_no, 'related_order_id', v_work_order.id,
            'remark','工单完工入库','created_at', v_now
          )
        );
        SELECT id, data INTO v_inventory FROM entity_store inv
        WHERE inv.entity_type='inventory' AND inv.data->>'product_id'=v_inv_product_id AND inv.data->>'sku_id'=v_sku_id LIMIT 1;
        IF FOUND THEN
          UPDATE entity_store SET data = data || jsonb_build_object('quantity', COALESCE((data->>'quantity')::int,0)+v_plan_qty, 'updated_at', v_now) WHERE id=v_inventory.id;
        ELSE
          INSERT INTO entity_store (id, entity_type, data) VALUES (
            gen_random_uuid()::text, 'inventory',
            jsonb_build_object('id', gen_random_uuid()::text, 'type','product','product_id', v_inv_product_id, 'sku_id', v_sku_id, 'quantity', v_plan_qty, 'warehouse','成品仓','location_id','loc-finished-1','min_stock',150,'max_stock',10000,'created_at', v_now)
          );
        END IF;
        work_no := v_work_no; action := 'inbound'; detail := v_sku_id||' +'||v_plan_qty::text; RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_existing FROM entity_store sr
  WHERE sr.entity_type='stock_records' AND sr.data->>'related_order'=p_order_no AND sr.data->>'subtype'='销售出库';
  IF v_existing = 0 THEN
    FOR v_so_item IN
      SELECT (item->>'sku_id')::text AS sku_id, (item->>'quantity')::int AS qty, item->>'product_id' AS pid, item->>'product_code' AS pcode
      FROM entity_store, jsonb_array_elements(data->'items') AS item
      WHERE entity_type='sales_orders' AND data->>'order_no'=p_order_no
    LOOP
      IF v_so_item.qty IS NULL OR v_so_item.qty <= 0 THEN CONTINUE; END IF;
      v_record_no := 'SO-'||floor(random()*900000+100000)::int::text;
      INSERT INTO entity_store (id, entity_type, data) VALUES (
        gen_random_uuid()::text, 'stock_records',
        jsonb_build_object(
          'id', gen_random_uuid()::text, 'record_no', v_record_no, 'type','out','subtype','销售出库',
          'product_id', v_so_item.pid, 'product_code', v_so_item.pcode, 'product_name','产品',
          'sku_id', v_so_item.sku_id, 'quantity', v_so_item.qty, 'warehouse','成品仓','handler','仓库管理员',
          'record_date', p_ship_date, 'related_order', p_order_no, 'remark','销售发货出库','created_at', v_now
        )
      );
      SELECT id, data INTO v_inventory FROM entity_store inv
      WHERE inv.entity_type='inventory' AND inv.data->>'product_id'=v_so_item.pid AND inv.data->>'sku_id'=v_so_item.sku_id LIMIT 1;
      IF FOUND THEN
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', GREATEST(COALESCE((data->>'quantity')::int,0)-v_so_item.qty,0), 'updated_at', v_now) WHERE id=v_inventory.id;
      END IF;
      work_no := p_order_no; action := 'outbound'; detail := v_so_item.sku_id||' -'||v_so_item.qty::text; RETURN NEXT;
    END LOOP;
  END IF;

  RETURN;
END;
$$;