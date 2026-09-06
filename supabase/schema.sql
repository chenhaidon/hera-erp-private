-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "public";


--
-- Name: EXTENSION "pg_cron"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";


--
-- Name: EXTENSION "pg_net"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";


--
-- Name: EXTENSION "pg_graphql"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_graphql" IS 'pg_graphql: GraphQL support';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'production',
    'quality',
    'warehouse',
    'finance',
    'sales',
    'outsourcing',
    'maintenance',
    'worker'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: advance_contract("text", "text", "date", "date", "date"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."advance_contract"("p_contract_no" "text", "p_order_no" "text", "p_ship_date" "date", "p_sign_date" "date", "p_settle_date" "date") RETURNS TABLE("work_no" "text", "action" "text", "detail" "text")
    LANGUAGE "plpgsql"
    AS $$
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


--
-- Name: complete_26jlkxd006(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."complete_26jlkxd006"() RETURNS TABLE("work_no" "text", "action" "text", "detail" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_work_order record;
  v_op jsonb;
  v_ops jsonb := '[]'::jsonb;
  v_new_ops jsonb := '[]'::jsonb;
  v_report jsonb;
  v_new_reports jsonb;
  v_plan_qty int;
  v_completed_qty int;
  v_target_qty int;
  v_remaining int;
  v_batch_qty int;
  v_report_time timestamptz;
  v_last_time timestamptz;
  v_op_price numeric;
  v_op_outsource_price numeric;
  v_operator_name text;
  v_qc_name text;
  v_factory_id uuid;
  v_factory_name text;
  v_shipment_date date;
  v_return_date date;
  v_shipment_id uuid;
  v_defective int;
  v_qualified int;
  v_inspection_status text;
  v_defect_reason text;
  v_pi_code text;
  v_pi_id text;
  v_op_name text;
  v_op_code text;
  v_seq int;
  v_op_status text;
  v_op_category text;
  v_i int;
  v_j int;
  v_op_idx int;
  v_product_steps jsonb;
  v_step jsonb;
  v_color text;
  v_spec text;
  v_work_id text;
  v_work_no text;
  v_product_code text;
  v_product_name text;
  v_customer_name text;
  v_sales_id text;
  v_total_amount numeric;
  v_ship_date date;
  v_sign_date date;
  v_now timestamptz := now();
  v_workers text[];
  v_qcs text[];
BEGIN
  SELECT array_agg(e.data->>'name' ORDER BY random())
  INTO v_workers
  FROM entity_store e
  WHERE e.entity_type = 'employees'
    AND e.data->>'department' = '生产部'
    AND e.data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');

  SELECT array_agg(e.data->>'name' ORDER BY random())
  INTO v_qcs
  FROM entity_store e
  WHERE e.entity_type = 'employees'
    AND (e.data->>'position' ILIKE '%质检%' OR e.data->>'position' = '质检车间主任');

  IF v_qcs IS NULL OR array_length(v_qcs, 1) IS NULL THEN
    SELECT array_agg(e.data->>'name' ORDER BY random())
    INTO v_qcs
    FROM entity_store e
    WHERE e.entity_type = 'employees'
      AND e.data->>'position' IN ('质检车间主任','生产厂长','包装车间主任');
  END IF;

  FOR v_work_order IN
    SELECT e.id, e.data
    FROM entity_store e
    WHERE e.entity_type = 'work_orders'
      AND e.data->>'contract_no' = '26JLKXD006'
      AND e.data->>'status' IN ('producing','inbound')
    ORDER BY e.data->>'work_no'
  LOOP
    v_work_id := v_work_order.id;
    v_work_no := v_work_order.data->>'work_no';
    v_plan_qty := COALESCE((v_work_order.data->>'plan_quantity')::int, 0);
    v_completed_qty := COALESCE((v_work_order.data->>'completed_quantity')::int, 0);
    v_color := COALESCE(v_work_order.data->>'color', '');
    v_spec := COALESCE(v_work_order.data->>'sku_summary', v_work_order.data->>'specification', '');
    v_product_code := v_work_order.data->>'product_code';
    v_product_name := v_work_order.data->>'product_name';
    v_ops := v_work_order.data->'operations';
    v_new_ops := '[]'::jsonb;
    v_last_time := COALESCE((v_work_order.data->>'issued_at')::timestamptz, '2026-08-01 08:00:00+08'::timestamptz);

    SELECT p.data->'process_steps' INTO v_product_steps
    FROM entity_store p
    WHERE p.entity_type = 'products' AND p.data->>'code' = v_product_code
    LIMIT 1;

    FOR v_op_idx IN 0 .. jsonb_array_length(v_ops) - 1 LOOP
      v_op := v_ops->v_op_idx;
      v_op_code := v_op->>'code';
      v_op_name := v_op->>'name';
      v_seq := COALESCE((v_op->>'seq')::int, v_op_idx + 1);
      v_op_status := v_op->>'status';
      v_op_category := v_op->>'category';
      v_op_price := 0;
      v_op_outsource_price := 0;

      IF v_product_steps IS NOT NULL THEN
        FOR v_i IN 0 .. jsonb_array_length(v_product_steps) - 1 LOOP
          v_step := v_product_steps->v_i;
          IF v_step->>'code' = v_op_code THEN
            v_op_price := COALESCE((v_step->>'price')::numeric, 0);
            v_op_outsource_price := COALESCE((v_step->>'outsourcing_price')::numeric, 0);
            EXIT;
          END IF;
        END LOOP;
      END IF;

      IF v_op_status IN ('pending','running') AND v_op_category = 'internal' THEN
        v_completed_qty := COALESCE((v_op->>'completed_qty')::int, 0);
        v_target_qty := COALESCE((v_op->>'plan_qty')::int, v_plan_qty) - v_completed_qty;
        v_remaining := v_target_qty;
        v_new_reports := COALESCE(v_op->'reports', '[]'::jsonb);

        SELECT max((r->>'report_time')::timestamptz)
        INTO v_last_time
        FROM jsonb_array_elements(v_ops) WITH ORDINALITY AS o(op, n)
        CROSS JOIN LATERAL jsonb_array_elements(o.op->'reports') AS r
        WHERE o.n <= v_op_idx + 1;

        IF jsonb_array_length(v_new_reports) > 0 THEN
          v_report_time := COALESCE((v_new_reports->-1->>'report_time')::timestamptz, v_last_time);
        ELSE
          v_report_time := COALESCE(v_last_time, '2026-08-01 08:00:00+08'::timestamptz);
        END IF;

        WHILE v_remaining > 0 LOOP
          v_batch_qty := LEAST(v_remaining, 8 + floor(random() * 8)::int);
          IF v_batch_qty <= 0 THEN v_batch_qty := v_remaining; END IF;
          v_operator_name := v_workers[1 + floor(random() * array_length(v_workers, 1))::int];
          v_report_time := v_report_time + (floor(random() * 180 + 120)::int || ' minutes')::interval;

          v_report := jsonb_build_object(
            'id', gen_random_uuid()::text,
            'operation_code', v_op_code,
            'operation_name', v_op_name,
            'operator_id', '',
            'operator_name', v_operator_name,
            'qty', v_batch_qty,
            'quantity', v_batch_qty,
            'unit_price', v_op_price,
            'amount', round(v_batch_qty * v_op_price, 2),
            'report_time', v_report_time,
            'work_no', v_work_no,
            'color', v_color,
            'spec', v_spec,
            'remark', '计件报工'
          );
          v_new_reports := v_new_reports || jsonb_build_array(v_report);
          v_remaining := v_remaining - v_batch_qty;
        END LOOP;

        v_op := jsonb_set(v_op, '{reports}', v_new_reports);
        v_op := jsonb_set(v_op, '{completed_qty}', to_jsonb(v_plan_qty));
        v_op := jsonb_set(v_op, '{status}', '"completed"'::jsonb);
        v_op := jsonb_set(v_op, '{completed}', 'true'::jsonb);
        IF (v_op->>'pqc_inspection_id') IS NULL OR v_op->>'pqc_inspection_id' = '' THEN
          v_op := jsonb_set(v_op, '{pqc_inspection_id}', to_jsonb(gen_random_uuid()::text));
        END IF;
        v_last_time := v_report_time;
      END IF;

      SELECT COUNT(*) INTO v_j
      FROM entity_store pi
      WHERE pi.entity_type = 'process_inspections'
        AND pi.data->>'work_no' = v_work_no
        AND pi.data->>'operation_code' = v_op_code;

      IF v_j = 0 THEN
        v_qc_name := v_qcs[1 + floor(random() * array_length(v_qcs, 1))::int];
        v_defective := CASE WHEN random() < 0.15 THEN 1 + floor(random() * 2)::int ELSE 0 END;
        v_qualified := v_plan_qty - v_defective;
        v_inspection_status := CASE WHEN v_defective > 0 THEN 'partial' ELSE 'qualified' END;
        v_defect_reason := CASE WHEN v_defective > 0 THEN '外观轻微瑕疵' ELSE '' END;
        v_pi_code := 'PI-' || v_work_id || '-' || v_op_code;
        v_pi_id := gen_random_uuid()::text;

        INSERT INTO entity_store (id, entity_type, data)
        VALUES (
          gen_random_uuid()::text,
          'process_inspections',
          jsonb_build_object(
            'id', v_pi_id,
            'code', v_pi_code,
            'contract_no', '26JLKXD006',
            'work_id', v_work_id,
            'work_no', v_work_no,
            'work_order_id', v_work_id,
            'work_order_no', v_work_no,
            'operation_code', v_op_code,
            'operation_name', v_op_name,
            'product_code', v_product_code,
            'product_name', v_product_name,
            'check_date', (v_last_time + interval '1 hour')::date,
            'check_qty', v_plan_qty,
            'qualified_qty', v_qualified,
            'unqualified_qty', v_defective,
            'qualified_rate', round(v_qualified::numeric / NULLIF(v_plan_qty, 0) * 100, 2)::text || '%',
            'result', v_inspection_status,
            'status', 'inspected',
            'defect_reason', v_defect_reason,
            'inspector', v_qc_name,
            'items', jsonb_build_array(
              jsonb_build_object('name','外观缺陷','category','appearance','standard',0,'actual',0,'unit','处','lower',0,'upper',1,'result','qualified'),
              jsonb_build_object('name','尺寸偏差','category','physical','standard',0,'actual', CASE WHEN v_defective > 0 THEN 1 ELSE 0 END,'unit','mm','lower',-2,'upper',2,'result','qualified')
            ),
            'created_at', v_last_time + interval '1 hour',
            'updated_at', v_last_time + interval '2 hour'
          )
        );
      END IF;

      IF v_op_category = 'outsourcing' THEN
        SELECT min((r->>'report_time')::timestamptz),
               max((r->>'report_time')::timestamptz)
        INTO v_shipment_date, v_return_date
        FROM jsonb_array_elements(v_op->'reports') AS r;

        IF v_shipment_date IS NOT NULL THEN
          v_shipment_date := (v_shipment_date - interval '2 days')::date;
          v_return_date := (v_return_date + (floor(random() * 2 + 1)::int || ' days')::interval)::date;

          IF v_op_code = 'G-008' THEN
            SELECT of.id, of.factory_name INTO v_factory_id, v_factory_name
            FROM outsource_factories of
            WHERE of.processing_capability ILIKE '%绣花%'
            ORDER BY random() LIMIT 1;
          ELSIF v_op_code = 'G-010' THEN
            SELECT of.id, of.factory_name INTO v_factory_id, v_factory_name
            FROM outsource_factories of
            WHERE of.processing_capability ILIKE '%水洗%'
            ORDER BY random() LIMIT 1;
          ELSE
            SELECT of.id, of.factory_name INTO v_factory_id, v_factory_name
            FROM outsource_factories of
            ORDER BY random() LIMIT 1;
          END IF;

          v_defective := CASE WHEN random() < 0.1 THEN 1 ELSE 0 END;
          v_qualified := v_plan_qty - v_defective;
          v_inspection_status := CASE WHEN v_defective > 0 THEN 'partial' ELSE 'qualified' END;

          INSERT INTO outsource_shipments (
            id, shipment_no, work_order_id, work_order_no, operation_code, operation_name,
            product_code, product_name, factory_id, factory_name, shipment_date,
            shipment_quantity, logistics_company, logistics_no, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            'OS-' || v_work_id || '-' || v_op_code,
            v_work_id,
            v_work_no,
            v_op_code,
            v_op_name,
            v_product_code,
            v_product_name,
            v_factory_id,
            v_factory_name,
            v_shipment_date,
            v_plan_qty,
            '安能物流',
            'LOG-' || v_work_id || '-' || v_op_code,
            'shipped',
            v_now,
            v_now
          )
          RETURNING id INTO v_shipment_id;

          INSERT INTO outsource_returns (
            id, return_no, shipment_no, shipment_id, work_order_id, work_order_no, operation_code, operation_name,
            product_code, product_name, factory_id, factory_name, return_date,
            return_quantity, qualified_quantity, defective_quantity, inspection_status,
            status, return_type, defect_reason, inspector, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            'OR-' || v_work_id || '-' || v_op_code,
            'OS-' || v_work_id || '-' || v_op_code,
            v_shipment_id,
            v_work_id,
            v_work_no,
            v_op_code,
            v_op_name,
            v_product_code,
            v_product_name,
            v_factory_id,
            v_factory_name,
            v_return_date,
            v_plan_qty,
            v_qualified,
            v_defective,
            v_inspection_status,
            'returned',
            'semi_finished',
            CASE WHEN v_defective > 0 THEN '尺寸轻微偏差' ELSE '' END,
            v_qc_name,
            v_now,
            v_now
          );

          INSERT INTO outsource_processing_payments (
            id, payment_no, work_order_id, work_order_no, operation_code, operation_name,
            product_code, product_name, product_spec, product_color, factory_id, factory_name,
            quantity, unit_price, amount, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            'OP-' || v_work_id || '-' || v_op_code,
            gen_random_uuid(),
            v_work_no,
            v_op_code,
            v_op_name,
            v_product_code,
            v_product_name,
            v_spec,
            v_color,
            v_factory_id,
            v_factory_name,
            v_plan_qty,
            v_op_outsource_price,
            round(v_plan_qty * v_op_outsource_price, 2),
            'pending',
            v_now,
            v_now
          );
        END IF;
      END IF;

      v_new_ops := v_new_ops || jsonb_build_array(v_op);
    END LOOP;

    UPDATE entity_store
    SET data = data
      || jsonb_build_object(
           'status', 'completed',
           'completed_quantity', v_plan_qty,
           'progress', 100,
           'completed_at', v_now,
           'updated_at', v_now,
           'operations', v_new_ops
         )
    WHERE id = v_work_order.id;

    work_no := v_work_no;
    action := 'completed';
    detail := 'plan_qty=' || v_plan_qty::text;
    RETURN NEXT;
  END LOOP;

  SELECT s.data, s.data->>'id', s.data->>'customer_name', s.data->>'total_amount'
  INTO v_sales_id, v_sales_id, v_customer_name, v_total_amount
  FROM entity_store s
  WHERE s.entity_type = 'sales_orders' AND s.data->>'order_no' = 'SO-26JLKXD006'
  LIMIT 1;

  IF v_sales_id IS NOT NULL THEN
    v_ship_date := '2026-08-27'::date;
    v_sign_date := '2026-08-31'::date;

    UPDATE entity_store
    SET data = data
      || jsonb_build_object(
           'status', 'signed',
           'ship_date', v_ship_date,
           'delivery_date', v_ship_date,
           'shipped_quantity', (COALESCE((data->>'shipped_quantity')::int, 0) + 730),
           'delivery_progress', jsonb_build_object('shipped', 730, 'total', 730)
         )
    WHERE entity_type = 'sales_orders' AND data->>'order_no' = 'SO-26JLKXD006';

    INSERT INTO entity_store (id, entity_type, data)
    VALUES (
      gen_random_uuid()::text,
      'shipments',
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'shipment_no', 'SH-26JLKXD006-001',
        'order_id', v_sales_id,
        'order_no', 'SO-26JLKXD006',
        'contract_no', '26JLKXD006',
        'customer_id', '',
        'customer_name', v_customer_name,
        'shipment_date', v_ship_date,
        'sign_time', v_sign_date,
        'status', 'signed',
        'tracking_no', 'SH-26JLKXD006-001-TRK',
        'logistics_company', '安能物流',
        'creator', '蒋佳男',
        'remark', '合计 730 件，已签收',
        'delivery_records', jsonb_build_array(
          jsonb_build_object('status','shipped','time', v_ship_date || ' 10:00:00','remark','已发货'),
          jsonb_build_object('status','signed','time', v_sign_date || ' 14:30:00','remark','客户已签收')
        ),
        'items', (SELECT data->'items' FROM entity_store WHERE entity_type='sales_orders' AND data->>'order_no'='SO-26JLKXD006' LIMIT 1),
        'boxes', jsonb_build_array(
          jsonb_build_object('box_no','CTN-001','product_code','SZ98870','quantity',730,'gross_weight',500,'net_weight',480,'volume','12.5')
        ),
        'created_at', v_now
      )
    );

    INSERT INTO finance_records (id, type, counterparty, currency, amount, paid_amount, created_at)
    VALUES (
      gen_random_uuid(),
      '应收',
      v_customer_name,
      'CNY',
      COALESCE(v_total_amount, '0')::numeric,
      COALESCE(v_total_amount, '0')::numeric,
      v_sign_date + interval '2 days'
    );

    work_no := 'SO-26JLKXD006';
    action := 'shipment_signed';
    detail := 'amount=' || COALESCE(v_total_amount, 0)::text;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;


--
-- Name: compress_contract_reports("text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."compress_contract_reports"("p_contract_no" "text", "p_target" timestamp with time zone) RETURNS TABLE("work_no" "text", "old_max" timestamp with time zone, "new_max" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_work record; v_op record; v_r record;
  v_min_t timestamptz; v_max_t timestamptz; v_old_t timestamptz;
  v_ratio numeric; v_min_e numeric; v_shift interval;
  v_new_ops jsonb; v_new_reports jsonb; v_new_time timestamptz;
BEGIN
  FOR v_work IN SELECT e.id, e.data->>'work_no' AS work_no FROM entity_store e WHERE e.entity_type='work_orders' AND e.data->>'contract_no'=p_contract_no LOOP
    SELECT min((r->>'report_time')::timestamptz), max((r->>'report_time')::timestamptz)
    INTO v_min_t, v_max_t
    FROM entity_store e, jsonb_array_elements(e.data->'operations') AS op, jsonb_array_elements(op->'reports') AS r WHERE e.id=v_work.id;
    IF v_max_t IS NULL OR v_max_t <= p_target THEN CONTINUE; END IF;

    v_min_e := EXTRACT(EPOCH FROM v_min_t);
    IF v_min_t < p_target THEN
      v_ratio := (EXTRACT(EPOCH FROM p_target) - v_min_e) / NULLIF(EXTRACT(EPOCH FROM v_max_t) - v_min_e, 0);
    ELSE
      v_shift := p_target - v_max_t;
    END IF;

    v_new_ops := '[]'::jsonb;
    FOR v_op IN SELECT op AS op_obj FROM entity_store e, jsonb_array_elements(e.data->'operations') AS op WHERE e.id=v_work.id ORDER BY (op->>'seq')::int LOOP
      v_new_reports := '[]'::jsonb;
      FOR v_r IN SELECT r AS report_obj FROM jsonb_array_elements(v_op.op_obj->'reports') AS r LOOP
        v_old_t := (v_r.report_obj->>'report_time')::timestamptz;
        IF v_min_t < p_target THEN
          v_new_time := to_timestamp(v_min_e + (EXTRACT(EPOCH FROM v_old_t) - v_min_e)*v_ratio)::timestamptz;
        ELSE
          v_new_time := v_old_t + v_shift;
        END IF;
        v_new_reports := v_new_reports || jsonb_set(v_r.report_obj, '{report_time}', to_jsonb(v_new_time));
      END LOOP;
      v_new_ops := v_new_ops || jsonb_set(v_op.op_obj, '{reports}', v_new_reports);
    END LOOP;
    UPDATE entity_store SET data = jsonb_set(data, '{operations}', v_new_ops) WHERE id=v_work.id;

    SELECT max((r->>'report_time')::timestamptz) INTO new_max
    FROM entity_store e, jsonb_array_elements(e.data->'operations') AS op, jsonb_array_elements(op->'reports') AS r WHERE e.id=v_work.id;

    UPDATE entity_store pi SET data = pi.data || jsonb_build_object(
      'check_date', (new_max + interval '1 hour')::date,
      'created_at', new_max + interval '1 hour', 'updated_at', new_max + interval '2 hour')
    WHERE pi.entity_type='process_inspections' AND pi.data->>'work_no'=v_work.work_no;

    work_no := v_work.work_no; old_max := v_max_t; RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;


--
-- Name: execute_sql("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."execute_sql"("sql_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  stmt text;
BEGIN
  FOR stmt IN SELECT btrim(s) FROM unnest(string_to_array(sql_text, ';')) AS s WHERE btrim(s) <> ''
  LOOP
    EXECUTE stmt;
  END LOOP;
END;
$$;


--
-- Name: get_user_role("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_role"("uid" "uuid") RETURNS "public"."user_role"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    email,
    phone,
    role,
    openid
  )
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'username')::text,
    NEW.email,
    NEW.phone,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'production'::public.user_role),
    (NEW.raw_user_meta_data->>'openid')::text
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    openid = EXCLUDED.openid,
    updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: is_admin_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' = 'admin'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
$$;


--
-- Name: minimize_defects("text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."minimize_defects"("p_contract_no" "text", "p_keep" integer) RETURNS TABLE("kept" integer, "cleared" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_ids text[]; v_keep_ids text[]; v_id text; v_check int; v_def int;
  v_k int := 0; v_c int := 0;
BEGIN
  SELECT array_agg(id::text ORDER BY random()) INTO v_ids
  FROM entity_store
  WHERE entity_type='process_inspections' AND data->>'contract_no'=p_contract_no
    AND (COALESCE((data->>'unqualified_qty')::int,0) > 0 OR data->>'result' IN ('partial','unqualified'));
  IF v_ids IS NULL THEN kept:=0; cleared:=0; RETURN NEXT; RETURN; END IF;

  v_keep_ids := v_ids[1:LEAST(p_keep, array_length(v_ids,1))];
  FOREACH v_id IN ARRAY v_ids LOOP
    IF v_id = ANY(v_keep_ids) THEN
      v_check := COALESCE((SELECT (data->>'check_qty')::int FROM entity_store WHERE id::text=v_id),0);
      v_def := LEAST(1 + floor(random()*2)::int, GREATEST(v_check-1,1));
      UPDATE entity_store SET data = data || jsonb_build_object(
        'unqualified_qty', v_def, 'qualified_qty', GREATEST(v_check-v_def,0),
        'qualified_rate', round(GREATEST(v_check-v_def,0)::numeric/NULLIF(v_check,0)*100,2)::text || '%',
        'result','partial', 'defect_reason','外观轻微瑕疵')
      WHERE id::text=v_id;
      v_k := v_k + 1;
    ELSE
      UPDATE entity_store SET data = data || jsonb_build_object(
        'unqualified_qty',0,'qualified_qty',COALESCE((data->>'check_qty')::int,0),
        'qualified_rate','100%','result','qualified','defect_reason','')
      WHERE id::text=v_id;
      v_c := v_c + 1;
    END IF;
  END LOOP;
  kept := v_k; cleared := v_c; RETURN NEXT;
  RETURN;
END;
$$;


--
-- Name: rbac_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."rbac_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'admin');
$$;


--
-- Name: rbac_write_allowed("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."rbac_write_allowed"("p_entity_type" "text", "p_action" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    case
      -- 日志类放行（含匿名登录失败记录场景）
      when p_entity_type in ('operation_logs', 'login_logs') then true
      -- 管理员恒放行
      when rbac_is_admin() then true
      -- 当前用户角色未配置任何按钮权限 → 放行（兼容未接入 RBAC 的角色）
      when not exists (
        select 1 from sys_role_menu_buttons b
        where b.role_key = (select role::text from profiles where id = auth.uid())
      ) then true
      -- 实体类型无映射 → 放行
      when not exists (select 1 from rbac_entity_menu_map m where m.entity_type = p_entity_type) then true
      -- 严格校验：角色需持有该菜单对应按钮权限
      else exists (
        select 1
        from sys_role_menu_buttons b
        join rbac_entity_menu_map m on m.menu_key = b.menu_key
        where b.role_key = (select role::text from profiles where id = auth.uid())
          and m.entity_type = p_entity_type
          and b.button_key = case p_action
            when 'insert' then 'create'
            when 'update' then 'edit'
            when 'delete' then 'delete'
            else p_action
          end
      )
    end
$$;


--
-- Name: reorder_contract_reports("text", timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."reorder_contract_reports"("p_contract_no" "text", "p_start" timestamp with time zone, "p_end" timestamp with time zone) RETURNS TABLE("work_no" "text", "total_reports" integer)
    LANGUAGE "plpgsql"
    AS $$
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


--
-- Name: set_few_defects("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."set_few_defects"("p_contract_no" "text") RETURNS TABLE("id" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE entity_store p
  SET data = data || jsonb_build_object(
    'unqualified_qty', 1,
    'qualified_qty', (data->>'check_qty')::int - 1,
    'qualified_rate', round(((data->>'check_qty')::int - 1)::numeric / NULLIF((data->>'check_qty')::int,0) * 100, 2)::text || '%',
    'result','partial','defect_reason','尺寸轻微偏差',
    'items', jsonb_build_array(
      jsonb_build_object('category','appearance','name','外观缺陷','standard',0,'actual',0,'unit','处','lower',0,'upper',1,'result','qualified'),
      jsonb_build_object('category','physical','name','尺寸偏差','standard',0,'actual',1,'unit','mm','lower',-2,'upper',2,'result','unqualified')
    )
  )
  WHERE p.entity_type='process_inspections' AND p.data->>'contract_no'=p_contract_no AND random() < 0.08;
  RETURN;
END;
$$;


--
-- Name: set_outsourcing_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."set_outsourcing_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: sync_outsource_dates("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."sync_outsource_dates"("p_contract_no" "text") RETURNS TABLE("shipment_no" "text", "new_ship_date" "date", "new_return_date" "date")
    LANGUAGE "plpgsql"
    AS $$
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


--
-- Name: update_26jlkxd006_inventory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_26jlkxd006_inventory"() RETURNS TABLE("action" "text", "detail" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_work_order record;
  v_sku_id text;
  v_plan_qty int;
  v_work_no text;
  v_color text;
  v_existing int;
  v_inventory record;
  v_mat_inventory record;
  v_sku_summary text;
  v_face_dosage numeric;
  v_mat_consume numeric;
  v_mat_id text;
  v_mat_name text;
  v_record_no text;
  v_warehouse text := '成品仓';
  v_handler text := '仓库管理员';
  v_record_date date := '2026-08-27'::date;

  v_bom jsonb := jsonb_build_object(
    'sz98870-t', jsonb_build_object(
      'face_regular', 1.97, 'face_special', 1.89,
      'bottom', 1.84, 'nonwoven', 0.19, 'binding', 0.2, 'filling', 0.65
    ),
    'sz98870-qxl', jsonb_build_object(
      'face_regular', 2.89, 'face_special', 2.88,
      'bottom', 2.64, 'nonwoven', 0.24, 'binding', 0.25, 'filling', 1.01
    ),
    'sz98870-kxl', jsonb_build_object(
      'face_regular', 3.16, 'face_special', 3.15,
      'bottom', 2.9, 'nonwoven', 0.25, 'binding', 0.26, 'filling', 1.12
    ),
    'sz98870-ok', jsonb_build_object(
      'face_regular', 3.27, 'face_special', 3.27,
      'bottom', 3.02, 'nonwoven', 0.252, 'binding', 0.252, 'filling', 1.251
    )
  );

  v_bom_item jsonb;
  v_bom_items text[] := ARRAY['mat-a-greek-220','mat-b-cotton-40s','mat-nonwoven-25g','mat-c150-down'];
  v_bom_names text[] := ARRAY['A#220g希腊绒','B#40S110/90棉布','25g无纺布','150g羽丝棉'];
  v_bom_keys text[] := ARRAY['greek','bottom','nonwoven','filling'];
  v_warehouses text[] := ARRAY['面料仓','面料仓','辅料仓','填充仓'];
  v_i int;
BEGIN
  FOR v_work_order IN
    SELECT e.id, e.data
    FROM entity_store e
    WHERE e.entity_type = 'work_orders'
      AND e.data->>'contract_no' = '26JLKXD006'
      AND e.data->>'status' = 'completed'
    ORDER BY e.data->>'work_no'
  LOOP
    v_work_no := v_work_order.data->>'work_no';
    v_sku_summary := COALESCE(v_work_order.data->>'sku_summary', '');
    v_plan_qty := COALESCE((v_work_order.data->>'plan_quantity')::int, 0);
    v_color := COALESCE(v_work_order.data->>'color', '');

    v_sku_id := CASE
      WHEN v_sku_summary ILIKE '68×86in%' THEN 'sz98870-t'
      WHEN v_sku_summary ILIKE '98×98in%' THEN 'sz98870-qxl'
      WHEN v_sku_summary ILIKE '108×98in%' THEN 'sz98870-kxl'
      WHEN v_sku_summary ILIKE '112×106in%' THEN 'sz98870-ok'
      ELSE NULL
    END;

    IF v_sku_id IS NULL OR v_plan_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM entity_store sr
    WHERE sr.entity_type = 'stock_records'
      AND sr.data->>'related_order' = v_work_no
      AND sr.data->>'subtype' = '生产入库';

    IF v_existing > 0 THEN
      action := 'skip_inbound';
      detail := v_work_no || ' ' || v_sku_id || ' qty=' || v_plan_qty::text;
      RETURN NEXT;
      CONTINUE;
    END IF;

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
        'quantity', v_plan_qty,
        'warehouse', v_warehouse,
        'handler', v_handler,
        'record_date', v_record_date,
        'related_order', v_work_no,
        'related_order_id', v_work_order.id,
        'remark', '工单完工入库',
        'created_at', now()
      )
    );

    SELECT id, data INTO v_inventory
    FROM entity_store inv
    WHERE inv.entity_type = 'inventory'
      AND inv.data->>'product_id' = 'product-sz98870'
      AND inv.data->>'sku_id' = v_sku_id
    LIMIT 1;

    IF FOUND THEN
      UPDATE entity_store
      SET data = data || jsonb_build_object(
        'quantity', COALESCE((data->>'quantity')::int, 0) + v_plan_qty,
        'updated_at', now()
      )
      WHERE id = v_inventory.id;
    ELSE
      INSERT INTO entity_store (id, entity_type, data)
      VALUES (
        gen_random_uuid()::text,
        'inventory',
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'product',
          'product_id', 'product-sz98870',
          'sku_id', v_sku_id,
          'quantity', v_plan_qty,
          'warehouse', v_warehouse,
          'location_id', 'loc-finished-1',
          'min_stock', 150,
          'max_stock', 10000,
          'created_at', now()
        )
      );
    END IF;

    action := 'inbound';
    detail := v_work_no || ' ' || v_sku_id || ' +' || v_plan_qty::text;
    RETURN NEXT;

    v_bom_item := v_bom->v_sku_id;
    IF v_bom_item IS NOT NULL THEN
      v_face_dosage := CASE WHEN v_color IN ('亮白色','深绿色','橄榄绿')
        THEN COALESCE((v_bom_item->>'face_special')::numeric, 0)
        ELSE COALESCE((v_bom_item->>'face_regular')::numeric, 0)
      END;

      FOR v_i IN 1 .. array_length(v_bom_items, 1) LOOP
        v_mat_id := v_bom_items[v_i];
        v_mat_consume := CASE v_i
          WHEN 1 THEN (v_face_dosage + COALESCE((v_bom_item->>'binding')::numeric, 0)) * v_plan_qty
          WHEN 2 THEN COALESCE((v_bom_item->>'bottom')::numeric, 0) * v_plan_qty
          WHEN 3 THEN COALESCE((v_bom_item->>'nonwoven')::numeric, 0) * v_plan_qty
          WHEN 4 THEN COALESCE((v_bom_item->>'filling')::numeric, 0) * v_plan_qty
        END;

        IF v_mat_consume <= 0 THEN CONTINUE; END IF;

        SELECT id, data INTO v_mat_inventory
        FROM entity_store inv
        WHERE inv.entity_type = 'inventory'
          AND inv.data->>'material_id' = v_mat_id
        LIMIT 1;

        IF FOUND THEN
          UPDATE entity_store
          SET data = data || jsonb_build_object(
            'quantity', COALESCE((data->>'quantity')::int, 0) - round(v_mat_consume)::int,
            'updated_at', now()
          )
          WHERE id = v_mat_inventory.id;
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
            'material_id', v_mat_id,
            'material_name', v_bom_names[v_i],
            'quantity', round(v_mat_consume)::int,
            'warehouse', v_warehouses[v_i],
            'handler', v_handler,
            'record_date', v_record_date,
            'related_order', v_work_no,
            'related_order_id', v_work_order.id,
            'remark', 'BOM 领料',
            'created_at', now()
          )
        );
      END LOOP;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_existing
  FROM entity_store sr
  WHERE sr.entity_type = 'stock_records'
    AND sr.data->>'related_order' = 'SO-26JLKXD006'
    AND sr.data->>'subtype' = '销售出库';

  IF v_existing = 0 THEN
    FOR v_work_order IN
      SELECT (item->>'sku_id')::text AS sku_id, (item->>'quantity')::int AS qty
      FROM entity_store,
           jsonb_array_elements(data->'items') AS item
      WHERE entity_type = 'sales_orders'
        AND data->>'order_no' = 'SO-26JLKXD006'
    LOOP
      v_sku_id := v_work_order.sku_id;
      v_plan_qty := v_work_order.qty;

      IF v_plan_qty IS NULL OR v_plan_qty <= 0 THEN CONTINUE; END IF;

      v_record_no := 'SO-' || floor(random() * 900000 + 100000)::int::text;

      INSERT INTO entity_store (id, entity_type, data)
      VALUES (
        gen_random_uuid()::text,
        'stock_records',
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'record_no', v_record_no,
          'type', 'out',
          'subtype', '销售出库',
          'product_id', 'product-sz98870',
          'product_code', 'SZ98870',
          'product_name', '希腊绒机绗被',
          'sku_id', v_sku_id,
          'quantity', v_plan_qty,
          'warehouse', v_warehouse,
          'handler', v_handler,
          'record_date', v_record_date,
          'related_order', 'SO-26JLKXD006',
          'remark', '销售发货出库',
          'created_at', now()
        )
      );

      SELECT id, data INTO v_inventory
      FROM entity_store inv
      WHERE inv.entity_type = 'inventory'
        AND inv.data->>'product_id' = 'product-sz98870'
        AND inv.data->>'sku_id' = v_sku_id
      LIMIT 1;

      IF FOUND THEN
        UPDATE entity_store
        SET data = data || jsonb_build_object(
          'quantity', COALESCE((data->>'quantity')::int, 0) - v_plan_qty,
          'updated_at', now()
        )
        WHERE id = v_inventory.id;
      END IF;

      action := 'outbound';
      detail := 'SO-26JLKXD006 ' || v_sku_id || ' -' || v_plan_qty::text;
      RETURN NEXT;
    END LOOP;
  ELSE
    action := 'skip_outbound';
    detail := 'SO-26JLKXD006 销售出库已存在';
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;


--
-- Name: update_ecommerce_platform_auth_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_ecommerce_platform_auth_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: approval_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."approval_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_no" "text",
    "module" "text" NOT NULL,
    "target_id" "text",
    "target_no" "text",
    "title" "text" NOT NULL,
    "submitter_id" "uuid",
    "submitter_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result" "text",
    "remark" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."attendance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "record_date" "date",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: contract_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."contract_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "reminder_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "trigger_date" "date" NOT NULL,
    "status" "text" DEFAULT 'unsent'::"text" NOT NULL,
    "receiver" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contract_reminders_status_check" CHECK (("status" = ANY (ARRAY['unsent'::"text", 'sent'::"text"])))
);


--
-- Name: contract_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."contract_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contract_type" "text" DEFAULT 'domestic'::"text" NOT NULL,
    "customer_level" "text" DEFAULT 'normal'::"text" NOT NULL,
    "clauses" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contract_templates_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['domestic'::"text", 'export'::"text", 'processing'::"text"]))),
    CONSTRAINT "contract_templates_customer_level_check" CHECK (("customer_level" = ANY (ARRAY['normal'::"text", 'vip'::"text", 'strategic'::"text"]))),
    CONSTRAINT "contract_templates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_no" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "customer_id" "text",
    "customer_name" "text" DEFAULT ''::"text" NOT NULL,
    "contact_name" "text" DEFAULT ''::"text" NOT NULL,
    "contact_phone" "text" DEFAULT ''::"text" NOT NULL,
    "customer_address" "text" DEFAULT ''::"text" NOT NULL,
    "contract_type" "text" DEFAULT 'domestic'::"text" NOT NULL,
    "customer_level" "text" DEFAULT 'normal'::"text" NOT NULL,
    "quotation_id" "text",
    "quotation_no" "text",
    "amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'CNY'::"text" NOT NULL,
    "sign_date" "date",
    "effective_date" "date",
    "delivery_date" "date",
    "actual_delivery_date" "date",
    "payment_terms" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "sign_method" "text",
    "sign_date_record" "date",
    "signer" "text",
    "signed_file_url" "text",
    "remark" "text" DEFAULT ''::"text" NOT NULL,
    "version" "text" DEFAULT 'V1.0'::"text" NOT NULL,
    "parent_contract_id" "uuid",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "clauses" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "approval_logs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "performance_nodes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "version_logs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reminders" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contracts_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['domestic'::"text", 'export'::"text", 'processing'::"text"]))),
    CONSTRAINT "contracts_customer_level_check" CHECK (("customer_level" = ANY (ARRAY['normal'::"text", 'vip'::"text", 'strategic'::"text"]))),
    CONSTRAINT "contracts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'effective'::"text", 'executing'::"text", 'completed'::"text", 'terminated'::"text"])))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact" "text",
    "phone" "text",
    "address" "text",
    "country" "text",
    "cooperation_years" integer DEFAULT 0,
    "credit_level" "text",
    "customer_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: ecommerce_alert_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ecommerce_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid",
    "platform_code" "text",
    "shop_name" "text",
    "alert_type" "text" NOT NULL,
    "alert_reason" "text",
    "alert_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone
);


--
-- Name: ecommerce_api_rate_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ecommerce_api_rate_limit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid",
    "platform_code" "text" NOT NULL,
    "call_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "call_count" integer DEFAULT 0 NOT NULL,
    "daily_limit" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: ecommerce_order_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ecommerce_order_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid",
    "platform_code" "text",
    "platform_name" "text",
    "shop_name" "text",
    "sync_status" "text" DEFAULT 'success'::"text" NOT NULL,
    "synced_orders" integer DEFAULT 0,
    "new_orders" integer DEFAULT 0,
    "updated_orders" integer DEFAULT 0,
    "failed_reason" "text",
    "execution_time_ms" integer,
    "request_params" "jsonb",
    "response_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: ecommerce_platform_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ecommerce_platform_auth" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform_code" "text" NOT NULL,
    "platform_name" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "app_key" "text",
    "app_secret" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "auth_status" "text" DEFAULT 'unauthorized'::"text" NOT NULL,
    "authorized_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone,
    "total_synced_orders" integer DEFAULT 0
);


--
-- Name: TABLE "ecommerce_platform_auth"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."ecommerce_platform_auth" IS '电商平台店铺授权信息';


--
-- Name: ecommerce_purchase_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ecommerce_purchase_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid",
    "product_id" "uuid",
    "order_quantity" integer NOT NULL,
    "cutting_quantity" integer DEFAULT 0 NOT NULL,
    "production_quantity" integer DEFAULT 0 NOT NULL,
    "shipment_quantity" integer DEFAULT 0 NOT NULL,
    "return_quantity" integer DEFAULT 0 NOT NULL,
    "platform_merchant_name" "text" NOT NULL,
    "record_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "product_name" "text" NOT NULL,
    "product_specification" "text",
    "product_image_url" "text",
    "supplier_name" "text",
    "platform_order_no" "text",
    "platform_code" "text",
    "platform_name" "text",
    "order_status" "text",
    "buyer_nickname" "text",
    CONSTRAINT "ecommerce_purchase_tracking_cutting_quantity_check" CHECK (("cutting_quantity" >= 0)),
    CONSTRAINT "ecommerce_purchase_tracking_order_quantity_check" CHECK (("order_quantity" > 0)),
    CONSTRAINT "ecommerce_purchase_tracking_production_quantity_check" CHECK (("production_quantity" >= 0)),
    CONSTRAINT "ecommerce_purchase_tracking_return_quantity_check" CHECK (("return_quantity" >= 0)),
    CONSTRAINT "ecommerce_purchase_tracking_shipment_quantity_check" CHECK (("shipment_quantity" >= 0))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "position" "text",
    "skill_level" "text",
    "skill_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "hire_date" "date",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: entity_store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."entity_store" (
    "id" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "model" "text",
    "manufacturer" "text",
    "purchase_date" "date",
    "status" "text" DEFAULT 'normal'::"text",
    "workshop" "text",
    "category" "text",
    "is_digital" boolean DEFAULT false,
    "is_networked" boolean DEFAULT false,
    "running_hours" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: equipment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."equipment_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid",
    "type" "text" NOT NULL,
    "record_date" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "duration" integer,
    "loss_output" integer DEFAULT 0,
    "maintainer" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: evaluation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."evaluation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scene" "text" NOT NULL,
    "level" integer DEFAULT 2,
    "status" "text" DEFAULT '达标'::"text",
    "evidence_files" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: finance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."finance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "counterparty" "text",
    "currency" "text" DEFAULT 'CNY'::"text",
    "amount" numeric(14,2) DEFAULT 0,
    "paid_amount" numeric(14,2) DEFAULT 0,
    "work_order_id" "uuid",
    "employee_id" "uuid",
    "month" "text",
    "cost_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "material_id" "uuid",
    "type" "text" NOT NULL,
    "quantity" integer DEFAULT 0,
    "min_stock" integer DEFAULT 0,
    "max_stock" integer DEFAULT 0,
    "warehouse" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_one_target" CHECK (((("type" = 'product'::"text") AND ("product_id" IS NOT NULL) AND ("material_id" IS NULL)) OR (("type" = 'material'::"text") AND ("material_id" IS NOT NULL) AND ("product_id" IS NULL))))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "specification" "text",
    "unit" "text",
    "default_supplier" "text",
    "color" "text",
    "pattern_code" "text",
    "composition" "text",
    "weight" integer,
    "resilience_level" "text",
    "safety_stock" integer DEFAULT 0,
    "stock" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: outsource_factories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."outsource_factories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "factory_name" "text" NOT NULL,
    "contact_person" "text" NOT NULL,
    "contact_phone" "text" NOT NULL,
    "processing_capability" "text",
    "status" "text" DEFAULT 'enabled'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "outsource_factories_status_check" CHECK (("status" = ANY (ARRAY['enabled'::"text", 'disabled'::"text"])))
);


--
-- Name: outsource_processing_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."outsource_processing_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_no" "text" NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "work_order_no" "text",
    "operation_code" "text",
    "operation_name" "text",
    "product_code" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "product_spec" "text",
    "product_color" "text",
    "factory_id" "uuid" NOT NULL,
    "factory_name" "text",
    "quantity" integer NOT NULL,
    "unit_price" numeric NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_date" "date",
    "payment_amount" numeric,
    "payment_method" "text",
    "remark" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "outsource_processing_payments_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "outsource_processing_payments_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "outsource_processing_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'paid'::"text"]))),
    CONSTRAINT "outsource_processing_payments_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


--
-- Name: outsource_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."outsource_return_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "return_id" "uuid" NOT NULL,
    "material_code" "text" NOT NULL,
    "material_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "outsource_return_items_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: outsource_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."outsource_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "return_no" "text" NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "work_order_id" "text" NOT NULL,
    "product_code" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "factory_id" "uuid" NOT NULL,
    "return_date" "date" NOT NULL,
    "return_quantity" integer NOT NULL,
    "qualified_quantity" integer DEFAULT 0 NOT NULL,
    "defective_quantity" integer DEFAULT 0 NOT NULL,
    "inspection_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "shipment_no" "text",
    "work_order_no" "text",
    "factory_name" "text",
    "operation_code" "text",
    "inspector" "text",
    "defect_reason" "text",
    "return_type" "text" DEFAULT 'finished'::"text" NOT NULL,
    "operation_name" "text",
    CONSTRAINT "outsource_returns_defective_quantity_check" CHECK (("defective_quantity" >= 0)),
    CONSTRAINT "outsource_returns_inspection_status_check" CHECK (("inspection_status" = ANY (ARRAY['pending'::"text", 'inspecting'::"text", 'qualified'::"text", 'partial'::"text", 'unqualified'::"text"]))),
    CONSTRAINT "outsource_returns_qualified_quantity_check" CHECK (("qualified_quantity" >= 0)),
    CONSTRAINT "outsource_returns_return_quantity_check" CHECK (("return_quantity" > 0)),
    CONSTRAINT "outsource_returns_return_type_check" CHECK (("return_type" = ANY (ARRAY['semi_finished'::"text", 'finished'::"text"]))),
    CONSTRAINT "outsource_returns_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'returned'::"text", 'stored'::"text"])))
);


--
-- Name: outsource_shipment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."outsource_shipment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "material_code" "text" NOT NULL,
    "material_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "outsource_shipment_items_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: outsource_shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."outsource_shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_no" "text" NOT NULL,
    "work_order_id" "text" NOT NULL,
    "operation_code" "text",
    "operation_name" "text",
    "product_code" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "factory_id" "uuid" NOT NULL,
    "shipment_date" "date" NOT NULL,
    "shipment_quantity" integer NOT NULL,
    "logistics_company" "text",
    "logistics_no" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "work_order_no" "text",
    "factory_name" "text",
    CONSTRAINT "outsource_shipments_shipment_quantity_check" CHECK (("shipment_quantity" > 0)),
    CONSTRAINT "outsource_shipments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'shipped'::"text", 'returning'::"text", 'returned'::"text"])))
);


--
-- Name: permission_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."permission_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "operator" "text",
    "summary" "text",
    "diff" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "module" "text" NOT NULL,
    "menu" "text" NOT NULL,
    "action" "text" DEFAULT 'view'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: process_inspection_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."process_inspection_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid",
    "work_no" "text" NOT NULL,
    "process_name" "text" NOT NULL,
    "result" "text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "remark" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "process_inspection_records_result_check" CHECK (("result" = ANY (ARRAY['qualified'::"text", 'unqualified'::"text"])))
);


--
-- Name: process_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."process_knowledge" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "process_name" "text" NOT NULL,
    "device" "text" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "problem" "text" NOT NULL,
    "solution" "text" NOT NULL,
    "effect" "text" NOT NULL,
    "creator" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "process_knowledge"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."process_knowledge" IS '工艺知识库';


--
-- Name: process_param_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."process_param_templates" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "process_name" "text" NOT NULL,
    "params" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "process_param_templates"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."process_param_templates" IS '工艺参数模板';


--
-- Name: process_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."process_routes" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "process_routes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."process_routes" IS '工艺路线';


--
-- Name: process_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."process_versions" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "product_id" "text" NOT NULL,
    "product_code" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "route_id" "text" NOT NULL,
    "route_name" "text" NOT NULL,
    "effective_date" "text" NOT NULL,
    "expiry_date" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "process_versions"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."process_versions" IS '工艺版本';


--
-- Name: production_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."production_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_no" "text" NOT NULL,
    "cycle" "text",
    "product_name" "text",
    "category" "text",
    "plan_quantity" integer DEFAULT 0,
    "start_date" "date",
    "end_date" "date",
    "load_rate" numeric(5,2) DEFAULT 0,
    "bottleneck_load_rate" numeric(5,2) DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "work_orders" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sku_items" "jsonb" DEFAULT '[]'::"jsonb"
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "fabric_type" "text",
    "fabric_composition" "text",
    "lining_type" "text",
    "filling_type" "text",
    "filling_weight" integer,
    "sizes" "jsonb" DEFAULT '[]'::"jsonb",
    "quilt_process" "text",
    "quilt_pattern" "text",
    "standard" "text",
    "standard_hours" integer,
    "process_list" "jsonb" DEFAULT '[]'::"jsonb",
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "role" "public"."user_role" DEFAULT 'production'::"public"."user_role",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "openid" "text",
    "login_expires_at" timestamp with time zone,
    "nav_order" "jsonb",
    "employee_id" "uuid"
);


--
-- Name: COLUMN "profiles"."login_expires_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."login_expires_at" IS '登录会话过期时间，超过后需重新登录';


--
-- Name: COLUMN "profiles"."nav_order"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."nav_order" IS '用户自定义左侧导航排序，存储导航路径数组';


--
-- Name: COLUMN "profiles"."employee_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."employee_id" IS '关联的员工档案ID';


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_no" "text" NOT NULL,
    "supplier_id" "uuid",
    "supplier_name" "text",
    "total_amount" numeric(14,2) DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "expected_date" "date",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "contract_no" "text",
    "request_code" "text",
    "payment_status" "text" DEFAULT 'unpaid'::"text"
);


--
-- Name: quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."quality_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inspection_no" "text" NOT NULL,
    "type" "text" NOT NULL,
    "work_order_id" "uuid",
    "material_id" "uuid",
    "product_id" "uuid",
    "result" "text" DEFAULT 'pending'::"text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "qualified_qty" integer DEFAULT 0,
    "unqualified_qty" integer DEFAULT 0,
    "defect_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "photos" "jsonb" DEFAULT '[]'::"jsonb"
);


--
-- Name: quality_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."quality_standards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "fiber_content" "jsonb" DEFAULT '{}'::"jsonb",
    "chemical" "jsonb" DEFAULT '{}'::"jsonb",
    "physical" "jsonb" DEFAULT '{}'::"jsonb",
    "appearance" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_no" "text" NOT NULL,
    "customer_id" "text",
    "customer_name" "text",
    "contact" "text",
    "phone" "text",
    "currency" "text" DEFAULT 'CNY'::"text",
    "exchange_rate" numeric(10,4) DEFAULT 1,
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "total_amount" numeric(14,2) DEFAULT 0,
    "effective_date" "date",
    "expiry_date" "date",
    "status" "text" DEFAULT 'draft'::"text",
    "remark" "text",
    "created_by" "text",
    "approved_by" "text",
    "approved_at" timestamp with time zone,
    "converted_order_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: rbac_entity_menu_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."rbac_entity_menu_map" (
    "entity_type" "text" NOT NULL,
    "menu_key" "text" NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: safety_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."safety_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "record_date" "date",
    "area" "text",
    "description" "text",
    "rectification_status" "text",
    "completion_date" "date",
    "topic" "text",
    "participants" "jsonb" DEFAULT '[]'::"jsonb",
    "loss" "text",
    "outcome" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_no" "text" NOT NULL,
    "order_type" "text" NOT NULL,
    "channel" "text",
    "customer_id" "uuid",
    "customer_name" "text",
    "currency" "text" DEFAULT 'CNY'::"text",
    "trade_term" "text",
    "destination" "text",
    "delivery_date" "date",
    "total_amount" numeric(14,2) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "contract_no" "text"
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


--
-- Name: stock_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."stock_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_no" "text" NOT NULL,
    "type" "text" NOT NULL,
    "subtype" "text",
    "product_id" "uuid",
    "material_id" "uuid",
    "quantity" integer DEFAULT 0,
    "warehouse" "text",
    "related_order" "text",
    "handler" "text",
    "record_date" "date",
    "actual_qty" integer,
    "profit_loss" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact" "text",
    "phone" "text",
    "address" "text",
    "supply_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "qualification_files" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "supplier_type" "text" DEFAULT '常规供应商'::"text" NOT NULL,
    CONSTRAINT "suppliers_supplier_type_check" CHECK (("supplier_type" = ANY (ARRAY['常规供应商'::"text", '电商渠道'::"text"])))
);


--
-- Name: sys_role_menu_buttons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."sys_role_menu_buttons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_key" "text" NOT NULL,
    "menu_key" "text" NOT NULL,
    "button_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: sys_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."sys_roles" (
    "role_key" "text" NOT NULL,
    "role_name" "text" NOT NULL,
    "data_scopes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: work_order_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."work_order_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid",
    "work_no" "text" NOT NULL,
    "qr_text" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_no" "text" NOT NULL,
    "plan_id" "uuid",
    "product_id" "uuid",
    "product_code" "text",
    "product_name" "text",
    "product_images" "jsonb" DEFAULT '[]'::"jsonb",
    "plan_quantity" integer DEFAULT 0,
    "completed_quantity" integer DEFAULT 0,
    "progress" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "operations" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'plan'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "start_date" "text",
    "end_date" "text",
    "issued_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "remark" "text",
    "sku_id" "text",
    "sku_summary" "text"
);


--
-- Name: COLUMN "work_orders"."source"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."work_orders"."source" IS '工单来源：plan-计划排程，manual-手动新建';


--
-- Name: COLUMN "work_orders"."priority"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."work_orders"."priority" IS '优先级：urgent-紧急，high-高，medium-中，low-低';


--
-- Name: COLUMN "work_orders"."remark"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."work_orders"."remark" IS '备注信息';


--
-- Name: work_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."work_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid",
    "work_no" "text" NOT NULL,
    "process_name" "text" NOT NULL,
    "completed_qty" integer DEFAULT 0 NOT NULL,
    "operator_role" "text",
    "remark" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: approval_tasks approval_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'approval_tasks_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'approval_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."approval_tasks"
    ADD CONSTRAINT "approval_tasks_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'attendance_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'attendance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders contract_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'contract_reminders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."contract_reminders"
    ADD CONSTRAINT "contract_reminders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'contract_templates_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."contract_templates"
    ADD CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts contracts_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'contracts_contract_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_contract_no_key" UNIQUE ("contract_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'contracts_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'customers_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_alert_log ecommerce_alert_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_alert_log_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_alert_log'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_alert_log"
    ADD CONSTRAINT "ecommerce_alert_log_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_api_rate_limit ecommerce_api_rate_limit_auth_id_call_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_api_rate_limit_auth_id_call_date_key'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_api_rate_limit'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_api_rate_limit"
    ADD CONSTRAINT "ecommerce_api_rate_limit_auth_id_call_date_key" UNIQUE ("auth_id", "call_date");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_api_rate_limit ecommerce_api_rate_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_api_rate_limit_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_api_rate_limit'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_api_rate_limit"
    ADD CONSTRAINT "ecommerce_api_rate_limit_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_order_sync_log ecommerce_order_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_order_sync_log_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_order_sync_log'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_order_sync_log"
    ADD CONSTRAINT "ecommerce_order_sync_log_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_platform_auth ecommerce_platform_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_platform_auth_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_platform_auth'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_platform_auth"
    ADD CONSTRAINT "ecommerce_platform_auth_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_purchase_tracking ecommerce_purchase_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_purchase_tracking_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_purchase_tracking'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_purchase_tracking"
    ADD CONSTRAINT "ecommerce_purchase_tracking_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: entity_store entity_store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'entity_store_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'entity_store'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."entity_store"
    ADD CONSTRAINT "entity_store_pkey" PRIMARY KEY ("id", "entity_type");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment equipment_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'equipment_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'equipment'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'equipment_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'equipment'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment_records equipment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'equipment_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'equipment_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."equipment_records"
    ADD CONSTRAINT "equipment_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: evaluation_items evaluation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'evaluation_items_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'evaluation_items'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."evaluation_items"
    ADD CONSTRAINT "evaluation_items_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: finance_records finance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'finance_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'finance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."finance_records"
    ADD CONSTRAINT "finance_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'inventory_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'inventory'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: materials materials_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'materials_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'materials'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'materials_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'materials'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_factories outsource_factories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_factories_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_factories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_factories"
    ADD CONSTRAINT "outsource_factories_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments outsource_processing_payments_payment_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_processing_payments_payment_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_processing_payments"
    ADD CONSTRAINT "outsource_processing_payments_payment_no_key" UNIQUE ("payment_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments outsource_processing_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_processing_payments_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_processing_payments"
    ADD CONSTRAINT "outsource_processing_payments_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_return_items outsource_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_return_items_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_return_items'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_return_items"
    ADD CONSTRAINT "outsource_return_items_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_returns_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_returns"
    ADD CONSTRAINT "outsource_returns_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_return_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_returns_return_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_returns"
    ADD CONSTRAINT "outsource_returns_return_no_key" UNIQUE ("return_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipment_items outsource_shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipment_items_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipment_items'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipment_items"
    ADD CONSTRAINT "outsource_shipment_items_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments outsource_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipments_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipments"
    ADD CONSTRAINT "outsource_shipments_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments outsource_shipments_shipment_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipments_shipment_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipments"
    ADD CONSTRAINT "outsource_shipments_shipment_no_key" UNIQUE ("shipment_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permission_history permission_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'permission_history_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'permission_history'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."permission_history"
    ADD CONSTRAINT "permission_history_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'permissions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'permissions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permissions permissions_role_id_module_menu_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'permissions_role_id_module_menu_action_key'
      AND n.nspname = 'public'
      AND c.relname = 'permissions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_role_id_module_menu_action_key" UNIQUE ("role_id", "module", "menu", "action");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_inspection_records process_inspection_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_inspection_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'process_inspection_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_inspection_records"
    ADD CONSTRAINT "process_inspection_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_knowledge process_knowledge_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_knowledge_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_knowledge"
    ADD CONSTRAINT "process_knowledge_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_knowledge process_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_knowledge_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_knowledge"
    ADD CONSTRAINT "process_knowledge_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates process_param_templates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_param_templates_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_param_templates"
    ADD CONSTRAINT "process_param_templates_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates process_param_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_param_templates_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_param_templates"
    ADD CONSTRAINT "process_param_templates_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes process_routes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_routes_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_routes"
    ADD CONSTRAINT "process_routes_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes process_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_routes_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_routes"
    ADD CONSTRAINT "process_routes_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions process_versions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_versions_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_versions"
    ADD CONSTRAINT "process_versions_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions process_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_versions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_versions"
    ADD CONSTRAINT "process_versions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: production_plans production_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'production_plans_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'production_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."production_plans"
    ADD CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: production_plans production_plans_plan_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'production_plans_plan_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'production_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."production_plans"
    ADD CONSTRAINT "production_plans_plan_no_key" UNIQUE ("plan_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products products_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'products_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'products_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_username_key'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: purchase_orders purchase_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'purchase_orders_order_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'purchase_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_order_no_key" UNIQUE ("order_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'purchase_orders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'purchase_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_inspections quality_inspections_inspection_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quality_inspections_inspection_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'quality_inspections'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quality_inspections"
    ADD CONSTRAINT "quality_inspections_inspection_no_key" UNIQUE ("inspection_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_inspections quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quality_inspections_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'quality_inspections'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quality_inspections"
    ADD CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_standards quality_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quality_standards_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'quality_standards'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quality_standards"
    ADD CONSTRAINT "quality_standards_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quotes_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'quotes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quotes quotes_quote_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quotes_quote_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'quotes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_quote_no_key" UNIQUE ("quote_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: rbac_entity_menu_map rbac_entity_menu_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'rbac_entity_menu_map_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'rbac_entity_menu_map'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."rbac_entity_menu_map"
    ADD CONSTRAINT "rbac_entity_menu_map_pkey" PRIMARY KEY ("entity_type");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'roles_name_key'
      AND n.nspname = 'public'
      AND c.relname = 'roles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'roles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'roles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: safety_records safety_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'safety_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'safety_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."safety_records"
    ADD CONSTRAINT "safety_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales_orders sales_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sales_orders_order_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'sales_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_order_no_key" UNIQUE ("order_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sales_orders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'sales_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'site_settings_key_key'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_key_key" UNIQUE ("key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'site_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_records stock_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'stock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_records"
    ADD CONSTRAINT "stock_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_records stock_records_record_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_records_record_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'stock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_records"
    ADD CONSTRAINT "stock_records_record_no_key" UNIQUE ("record_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'suppliers_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'suppliers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_role_menu_buttons sys_role_menu_buttons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sys_role_menu_buttons_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'sys_role_menu_buttons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sys_role_menu_buttons"
    ADD CONSTRAINT "sys_role_menu_buttons_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_role_menu_buttons sys_role_menu_buttons_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sys_role_menu_buttons_uq'
      AND n.nspname = 'public'
      AND c.relname = 'sys_role_menu_buttons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sys_role_menu_buttons"
    ADD CONSTRAINT "sys_role_menu_buttons_uq" UNIQUE ("role_key", "menu_key", "button_key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_roles sys_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sys_roles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'sys_roles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sys_roles"
    ADD CONSTRAINT "sys_roles_pkey" PRIMARY KEY ("role_key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_order_cards work_order_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_order_cards_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_order_cards'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_order_cards"
    ADD CONSTRAINT "work_order_cards_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_order_cards work_order_cards_work_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_order_cards_work_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'work_order_cards'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_order_cards"
    ADD CONSTRAINT "work_order_cards_work_no_key" UNIQUE ("work_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_orders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_orders work_orders_work_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_orders_work_no_key'
      AND n.nspname = 'public'
      AND c.relname = 'work_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_work_no_key" UNIQUE ("work_no");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_reports work_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_reports_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_reports'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_reports"
    ADD CONSTRAINT "work_reports_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: idx_ecommerce_purchase_tracking_platform_order_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_ecommerce_purchase_tracking_platform_order_no" ON "public"."ecommerce_purchase_tracking" USING "btree" ("platform_order_no");


--
-- Name: idx_entity_store_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_entity_store_type" ON "public"."entity_store" USING "btree" ("entity_type");


--
-- Name: ecommerce_platform_auth trg_ecommerce_platform_auth_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_ecommerce_platform_auth_updated_at" BEFORE UPDATE ON "public"."ecommerce_platform_auth" FOR EACH ROW EXECUTE FUNCTION "public"."update_ecommerce_platform_auth_updated_at"();


--
-- Name: ecommerce_purchase_tracking trg_ecommerce_purchase_tracking_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_ecommerce_purchase_tracking_updated_at" BEFORE UPDATE ON "public"."ecommerce_purchase_tracking" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: outsource_factories trg_outsource_factories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_outsource_factories_updated_at" BEFORE UPDATE ON "public"."outsource_factories" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: outsource_processing_payments trg_outsource_processing_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_outsource_processing_payments_updated_at" BEFORE UPDATE ON "public"."outsource_processing_payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: outsource_return_items trg_outsource_return_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_outsource_return_items_updated_at" BEFORE UPDATE ON "public"."outsource_return_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: outsource_returns trg_outsource_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_outsource_returns_updated_at" BEFORE UPDATE ON "public"."outsource_returns" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: outsource_shipment_items trg_outsource_shipment_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_outsource_shipment_items_updated_at" BEFORE UPDATE ON "public"."outsource_shipment_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: outsource_shipments trg_outsource_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_outsource_shipments_updated_at" BEFORE UPDATE ON "public"."outsource_shipments" FOR EACH ROW EXECUTE FUNCTION "public"."set_outsourcing_updated_at"();


--
-- Name: approval_tasks approval_tasks_submitter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'approval_tasks_submitter_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'approval_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."approval_tasks"
    ADD CONSTRAINT "approval_tasks_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "public"."profiles"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: attendance_records attendance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'attendance_records_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'attendance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders contract_reminders_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'contract_reminders_contract_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."contract_reminders"
    ADD CONSTRAINT "contract_reminders_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_alert_log ecommerce_alert_log_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_alert_log_auth_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_alert_log'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_alert_log"
    ADD CONSTRAINT "ecommerce_alert_log_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "public"."ecommerce_platform_auth"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_api_rate_limit ecommerce_api_rate_limit_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_api_rate_limit_auth_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_api_rate_limit'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_api_rate_limit"
    ADD CONSTRAINT "ecommerce_api_rate_limit_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "public"."ecommerce_platform_auth"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_order_sync_log ecommerce_order_sync_log_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_order_sync_log_auth_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_order_sync_log'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_order_sync_log"
    ADD CONSTRAINT "ecommerce_order_sync_log_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "public"."ecommerce_platform_auth"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_purchase_tracking ecommerce_purchase_tracking_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_purchase_tracking_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_purchase_tracking'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_purchase_tracking"
    ADD CONSTRAINT "ecommerce_purchase_tracking_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_purchase_tracking ecommerce_purchase_tracking_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_purchase_tracking_product_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_purchase_tracking'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_purchase_tracking"
    ADD CONSTRAINT "ecommerce_purchase_tracking_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_purchase_tracking ecommerce_purchase_tracking_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_purchase_tracking_supplier_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_purchase_tracking'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_purchase_tracking"
    ADD CONSTRAINT "ecommerce_purchase_tracking_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_purchase_tracking ecommerce_purchase_tracking_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ecommerce_purchase_tracking_updated_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_purchase_tracking'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ecommerce_purchase_tracking"
    ADD CONSTRAINT "ecommerce_purchase_tracking_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment_records equipment_records_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'equipment_records_equipment_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'equipment_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."equipment_records"
    ADD CONSTRAINT "equipment_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: finance_records finance_records_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'finance_records_work_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'finance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."finance_records"
    ADD CONSTRAINT "finance_records_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: inventory inventory_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'inventory_material_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'inventory'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'inventory_product_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'inventory'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_factories outsource_factories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_factories_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_factories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_factories"
    ADD CONSTRAINT "outsource_factories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_factories outsource_factories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_factories_updated_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_factories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_factories"
    ADD CONSTRAINT "outsource_factories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments outsource_processing_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_processing_payments_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_processing_payments"
    ADD CONSTRAINT "outsource_processing_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments outsource_processing_payments_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_processing_payments_factory_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_processing_payments"
    ADD CONSTRAINT "outsource_processing_payments_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "public"."outsource_factories"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments outsource_processing_payments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_processing_payments_updated_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_processing_payments"
    ADD CONSTRAINT "outsource_processing_payments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments outsource_processing_payments_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_processing_payments_work_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_processing_payments"
    ADD CONSTRAINT "outsource_processing_payments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_return_items outsource_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_return_items_return_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_return_items'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_return_items"
    ADD CONSTRAINT "outsource_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "public"."outsource_returns"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_returns_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_returns"
    ADD CONSTRAINT "outsource_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_returns_factory_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_returns"
    ADD CONSTRAINT "outsource_returns_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "public"."outsource_factories"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_returns_shipment_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_returns"
    ADD CONSTRAINT "outsource_returns_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."outsource_shipments"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_returns_updated_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_returns"
    ADD CONSTRAINT "outsource_returns_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipment_items outsource_shipment_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipment_items_shipment_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipment_items'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipment_items"
    ADD CONSTRAINT "outsource_shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."outsource_shipments"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments outsource_shipments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipments_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipments"
    ADD CONSTRAINT "outsource_shipments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments outsource_shipments_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipments_factory_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipments"
    ADD CONSTRAINT "outsource_shipments_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "public"."outsource_factories"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments outsource_shipments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'outsource_shipments_updated_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."outsource_shipments"
    ADD CONSTRAINT "outsource_shipments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permission_history permission_history_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'permission_history_role_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'permission_history'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."permission_history"
    ADD CONSTRAINT "permission_history_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permissions permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'permissions_role_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'permissions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_inspection_records process_inspection_records_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'process_inspection_records_work_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'process_inspection_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."process_inspection_records"
    ADD CONSTRAINT "process_inspection_records_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'purchase_orders_supplier_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'purchase_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_inspections quality_inspections_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quality_inspections_product_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'quality_inspections'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quality_inspections"
    ADD CONSTRAINT "quality_inspections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_inspections quality_inspections_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'quality_inspections_work_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'quality_inspections'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."quality_inspections"
    ADD CONSTRAINT "quality_inspections_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sales_orders_customer_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'sales_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'site_settings_updated_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_records stock_records_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_records_material_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'stock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_records"
    ADD CONSTRAINT "stock_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_records stock_records_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'stock_records_product_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'stock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."stock_records"
    ADD CONSTRAINT "stock_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_order_cards work_order_cards_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_order_cards_work_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_order_cards'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_order_cards"
    ADD CONSTRAINT "work_order_cards_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_orders work_orders_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_orders_plan_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."production_plans"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_orders work_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_orders_product_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_reports work_reports_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'work_reports_work_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'work_reports'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."work_reports"
    ADD CONSTRAINT "work_reports_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permission_history Admins have full access to permission_history; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to permission_history'
      AND n.nspname = 'public'
      AND c.relname = 'permission_history'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to permission_history" ON "public"."permission_history" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permissions Admins have full access to permissions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to permissions'
      AND n.nspname = 'public'
      AND c.relname = 'permissions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to permissions" ON "public"."permissions" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Admins have full access to profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to profiles" ON "public"."profiles" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: roles Admins have full access to roles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to roles'
      AND n.nspname = 'public'
      AND c.relname = 'roles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to roles" ON "public"."roles" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_alert_log Allow all ecommerce_alert_log; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all ecommerce_alert_log'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_alert_log'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all ecommerce_alert_log" ON "public"."ecommerce_alert_log" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_api_rate_limit Allow all ecommerce_api_rate_limit; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all ecommerce_api_rate_limit'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_api_rate_limit'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all ecommerce_api_rate_limit" ON "public"."ecommerce_api_rate_limit" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_order_sync_log Allow all ecommerce_order_sync_log; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all ecommerce_order_sync_log'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_order_sync_log'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all ecommerce_order_sync_log" ON "public"."ecommerce_order_sync_log" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_platform_auth Allow all ecommerce_platform_auth; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all ecommerce_platform_auth'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_platform_auth'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all ecommerce_platform_auth" ON "public"."ecommerce_platform_auth" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_purchase_tracking Allow all ecommerce_purchase_tracking; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all ecommerce_purchase_tracking'
      AND n.nspname = 'public'
      AND c.relname = 'ecommerce_purchase_tracking'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all ecommerce_purchase_tracking" ON "public"."ecommerce_purchase_tracking" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments Allow all outsource_processing_payments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all outsource_processing_payments'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_processing_payments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all outsource_processing_payments" ON "public"."outsource_processing_payments" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: roles Authenticated users can view active roles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can view active roles'
      AND n.nspname = 'public'
      AND c.relname = 'roles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can view active roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (("status" = 'active'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permission_history Authenticated users can view permission_history; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can view permission_history'
      AND n.nspname = 'public'
      AND c.relname = 'permission_history'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can view permission_history" ON "public"."permission_history" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permissions Authenticated users can view permissions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can view permissions'
      AND n.nspname = 'public'
      AND c.relname = 'permissions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can view permissions" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((NOT ("role" IS DISTINCT FROM "public"."get_user_role"("auth"."uid"()))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders anon_delete_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_delete_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_delete_contract_reminders" ON "public"."contract_reminders" FOR DELETE TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates anon_delete_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_delete_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_delete_contract_templates" ON "public"."contract_templates" FOR DELETE TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts anon_delete_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_delete_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_delete_contracts" ON "public"."contracts" FOR DELETE TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders anon_insert_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_insert_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_insert_contract_reminders" ON "public"."contract_reminders" FOR INSERT TO "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates anon_insert_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_insert_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_insert_contract_templates" ON "public"."contract_templates" FOR INSERT TO "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts anon_insert_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_insert_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_insert_contracts" ON "public"."contracts" FOR INSERT TO "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_inspection_records anon_no_process_inspection_records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_no_process_inspection_records'
      AND n.nspname = 'public'
      AND c.relname = 'process_inspection_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_no_process_inspection_records" ON "public"."process_inspection_records" TO "anon" USING (false) WITH CHECK (false);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_order_cards anon_no_work_order_cards; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_no_work_order_cards'
      AND n.nspname = 'public'
      AND c.relname = 'work_order_cards'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_no_work_order_cards" ON "public"."work_order_cards" TO "anon" USING (false) WITH CHECK (false);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_reports anon_no_work_reports; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_no_work_reports'
      AND n.nspname = 'public'
      AND c.relname = 'work_reports'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_no_work_reports" ON "public"."work_reports" TO "anon" USING (false) WITH CHECK (false);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders anon_select_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_select_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_select_contract_reminders" ON "public"."contract_reminders" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates anon_select_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_select_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_select_contract_templates" ON "public"."contract_templates" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts anon_select_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_select_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_select_contracts" ON "public"."contracts" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders anon_update_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_update_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_update_contract_reminders" ON "public"."contract_reminders" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates anon_update_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_update_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_update_contract_templates" ON "public"."contract_templates" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts anon_update_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_update_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "anon_update_contracts" ON "public"."contracts" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: approval_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."approval_tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."attendance_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records attendance_records_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'attendance_records_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'attendance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "attendance_records_all_authenticated" ON "public"."attendance_records" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: attendance_records attendance_records_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'attendance_records_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'attendance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "attendance_records_select_anon" ON "public"."attendance_records" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_inspection_records auth_all_process_inspection_records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_all_process_inspection_records'
      AND n.nspname = 'public'
      AND c.relname = 'process_inspection_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_all_process_inspection_records" ON "public"."process_inspection_records" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_order_cards auth_all_work_order_cards; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_all_work_order_cards'
      AND n.nspname = 'public'
      AND c.relname = 'work_order_cards'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_all_work_order_cards" ON "public"."work_order_cards" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_reports auth_all_work_reports; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_all_work_reports'
      AND n.nspname = 'public'
      AND c.relname = 'work_reports'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_all_work_reports" ON "public"."work_reports" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders auth_delete_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_delete_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_delete_contract_reminders" ON "public"."contract_reminders" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates auth_delete_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_delete_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_delete_contract_templates" ON "public"."contract_templates" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts auth_delete_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_delete_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_delete_contracts" ON "public"."contracts" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders auth_insert_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_insert_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_insert_contract_reminders" ON "public"."contract_reminders" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates auth_insert_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_insert_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_insert_contract_templates" ON "public"."contract_templates" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts auth_insert_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_insert_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_insert_contracts" ON "public"."contracts" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders auth_select_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_select_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_select_contract_reminders" ON "public"."contract_reminders" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates auth_select_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_select_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_select_contract_templates" ON "public"."contract_templates" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts auth_select_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_select_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_select_contracts" ON "public"."contracts" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders auth_update_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_update_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_update_contract_reminders" ON "public"."contract_reminders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates auth_update_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_update_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_update_contract_templates" ON "public"."contract_templates" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts auth_update_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_update_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "auth_update_contracts" ON "public"."contracts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."contract_reminders" ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."contract_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'customers_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "customers_all_authenticated" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: customers customers_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'customers_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'customers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "customers_select_anon" ON "public"."customers" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ecommerce_alert_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ecommerce_alert_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecommerce_api_rate_limit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ecommerce_api_rate_limit" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecommerce_order_sync_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ecommerce_order_sync_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecommerce_platform_auth; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ecommerce_platform_auth" ENABLE ROW LEVEL SECURITY;

--
-- Name: ecommerce_purchase_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ecommerce_purchase_tracking" ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'employees_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "employees_all_authenticated" ON "public"."employees" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'employees_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "employees_select_anon" ON "public"."employees" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: entity_store; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."entity_store" ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_store entity_store_anon_insert_logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'entity_store_anon_insert_logs'
      AND n.nspname = 'public'
      AND c.relname = 'entity_store'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "entity_store_anon_insert_logs" ON "public"."entity_store" FOR INSERT TO "anon" WITH CHECK (("entity_type" = 'login_logs'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: entity_store entity_store_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'entity_store_delete'
      AND n.nspname = 'public'
      AND c.relname = 'entity_store'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "entity_store_delete" ON "public"."entity_store" FOR DELETE TO "authenticated" USING ("public"."rbac_write_allowed"("entity_type", 'delete'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: entity_store entity_store_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'entity_store_insert'
      AND n.nspname = 'public'
      AND c.relname = 'entity_store'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "entity_store_insert" ON "public"."entity_store" FOR INSERT TO "authenticated" WITH CHECK ("public"."rbac_write_allowed"("entity_type", 'insert'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: entity_store entity_store_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'entity_store_select'
      AND n.nspname = 'public'
      AND c.relname = 'entity_store'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "entity_store_select" ON "public"."entity_store" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: entity_store entity_store_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'entity_store_update'
      AND n.nspname = 'public'
      AND c.relname = 'entity_store'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "entity_store_update" ON "public"."entity_store" FOR UPDATE TO "authenticated" USING ("public"."rbac_write_allowed"("entity_type", 'update'::"text")) WITH CHECK ("public"."rbac_write_allowed"("entity_type", 'update'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment equipment_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'equipment_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'equipment'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "equipment_all_authenticated" ON "public"."equipment" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."equipment_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_records equipment_records_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'equipment_records_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'equipment_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "equipment_records_all_authenticated" ON "public"."equipment_records" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment_records equipment_records_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'equipment_records_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'equipment_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "equipment_records_select_anon" ON "public"."equipment_records" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: equipment equipment_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'equipment_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'equipment'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "equipment_select_anon" ON "public"."equipment" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: evaluation_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."evaluation_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluation_items evaluation_items_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'evaluation_items_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'evaluation_items'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "evaluation_items_all_authenticated" ON "public"."evaluation_items" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: evaluation_items evaluation_items_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'evaluation_items_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'evaluation_items'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "evaluation_items_select_anon" ON "public"."evaluation_items" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: finance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."finance_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_records finance_records_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'finance_records_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'finance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "finance_records_all_authenticated" ON "public"."finance_records" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: finance_records finance_records_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'finance_records_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'finance_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "finance_records_select_anon" ON "public"."finance_records" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory inventory_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'inventory_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'inventory'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "inventory_all_authenticated" ON "public"."inventory" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: inventory inventory_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'inventory_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'inventory'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "inventory_select_anon" ON "public"."inventory" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;

--
-- Name: materials materials_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'materials_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'materials'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "materials_all_authenticated" ON "public"."materials" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: materials materials_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'materials_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'materials'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "materials_select_anon" ON "public"."materials" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_factories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."outsource_factories" ENABLE ROW LEVEL SECURITY;

--
-- Name: outsource_factories outsource_factories_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_factories_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_factories'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_factories_all_authenticated" ON "public"."outsource_factories" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_factories outsource_factories_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_factories_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_factories'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_factories_select_anon" ON "public"."outsource_factories" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_processing_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."outsource_processing_payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: outsource_return_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."outsource_return_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: outsource_return_items outsource_return_items_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_return_items_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_return_items'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_return_items_all_authenticated" ON "public"."outsource_return_items" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_return_items outsource_return_items_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_return_items_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_return_items'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_return_items_select_anon" ON "public"."outsource_return_items" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."outsource_returns" ENABLE ROW LEVEL SECURITY;

--
-- Name: outsource_returns outsource_returns_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_returns_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_returns_all_authenticated" ON "public"."outsource_returns" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_returns outsource_returns_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_returns_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_returns'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_returns_select_anon" ON "public"."outsource_returns" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipment_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."outsource_shipment_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: outsource_shipment_items outsource_shipment_items_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_shipment_items_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipment_items'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_shipment_items_all_authenticated" ON "public"."outsource_shipment_items" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipment_items outsource_shipment_items_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_shipment_items_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipment_items'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_shipment_items_select_anon" ON "public"."outsource_shipment_items" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."outsource_shipments" ENABLE ROW LEVEL SECURITY;

--
-- Name: outsource_shipments outsource_shipments_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_shipments_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_shipments_all_authenticated" ON "public"."outsource_shipments" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: outsource_shipments outsource_shipments_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'outsource_shipments_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'outsource_shipments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "outsource_shipments_select_anon" ON "public"."outsource_shipments" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: permission_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."permission_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: process_inspection_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."process_inspection_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: process_knowledge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."process_knowledge" ENABLE ROW LEVEL SECURITY;

--
-- Name: process_knowledge process_knowledge_anon_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_knowledge_anon_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_knowledge_anon_select" ON "public"."process_knowledge" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_knowledge process_knowledge_auth_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_knowledge_auth_delete'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_knowledge_auth_delete" ON "public"."process_knowledge" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_knowledge process_knowledge_auth_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_knowledge_auth_insert'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_knowledge_auth_insert" ON "public"."process_knowledge" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_knowledge process_knowledge_auth_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_knowledge_auth_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_knowledge_auth_select" ON "public"."process_knowledge" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_knowledge process_knowledge_auth_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_knowledge_auth_update'
      AND n.nspname = 'public'
      AND c.relname = 'process_knowledge'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_knowledge_auth_update" ON "public"."process_knowledge" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."process_param_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: process_param_templates process_param_templates_anon_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_param_templates_anon_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_param_templates_anon_select" ON "public"."process_param_templates" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates process_param_templates_auth_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_param_templates_auth_delete'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_param_templates_auth_delete" ON "public"."process_param_templates" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates process_param_templates_auth_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_param_templates_auth_insert'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_param_templates_auth_insert" ON "public"."process_param_templates" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates process_param_templates_auth_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_param_templates_auth_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_param_templates_auth_select" ON "public"."process_param_templates" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_param_templates process_param_templates_auth_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_param_templates_auth_update'
      AND n.nspname = 'public'
      AND c.relname = 'process_param_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_param_templates_auth_update" ON "public"."process_param_templates" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."process_routes" ENABLE ROW LEVEL SECURITY;

--
-- Name: process_routes process_routes_anon_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_routes_anon_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_routes_anon_select" ON "public"."process_routes" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes process_routes_auth_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_routes_auth_delete'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_routes_auth_delete" ON "public"."process_routes" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes process_routes_auth_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_routes_auth_insert'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_routes_auth_insert" ON "public"."process_routes" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes process_routes_auth_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_routes_auth_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_routes_auth_select" ON "public"."process_routes" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_routes process_routes_auth_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_routes_auth_update'
      AND n.nspname = 'public'
      AND c.relname = 'process_routes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_routes_auth_update" ON "public"."process_routes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."process_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: process_versions process_versions_anon_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_versions_anon_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_versions_anon_select" ON "public"."process_versions" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions process_versions_auth_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_versions_auth_delete'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_versions_auth_delete" ON "public"."process_versions" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions process_versions_auth_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_versions_auth_insert'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_versions_auth_insert" ON "public"."process_versions" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions process_versions_auth_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_versions_auth_select'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_versions_auth_select" ON "public"."process_versions" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: process_versions process_versions_auth_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'process_versions_auth_update'
      AND n.nspname = 'public'
      AND c.relname = 'process_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "process_versions_auth_update" ON "public"."process_versions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: production_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."production_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: production_plans production_plans_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'production_plans_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'production_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "production_plans_all_authenticated" ON "public"."production_plans" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: production_plans production_plans_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'production_plans_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'production_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "production_plans_select_anon" ON "public"."production_plans" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'products_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "products_all_authenticated" ON "public"."products" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: products products_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'products_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'products'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "products_select_anon" ON "public"."products" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders purchase_orders_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'purchase_orders_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'purchase_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "purchase_orders_all_authenticated" ON "public"."purchase_orders" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: purchase_orders purchase_orders_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'purchase_orders_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'purchase_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "purchase_orders_select_anon" ON "public"."purchase_orders" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."quality_inspections" ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_inspections quality_inspections_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quality_inspections_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'quality_inspections'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quality_inspections_all_authenticated" ON "public"."quality_inspections" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_inspections quality_inspections_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quality_inspections_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'quality_inspections'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quality_inspections_select_anon" ON "public"."quality_inspections" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."quality_standards" ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_standards quality_standards_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quality_standards_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'quality_standards'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quality_standards_all_authenticated" ON "public"."quality_standards" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quality_standards quality_standards_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quality_standards_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'quality_standards'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quality_standards_select_anon" ON "public"."quality_standards" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes quotes_admin_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quotes_admin_all'
      AND n.nspname = 'public'
      AND c.relname = 'quotes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quotes_admin_all" ON "public"."quotes" TO "authenticated" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quotes quotes_anon_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quotes_anon_select'
      AND n.nspname = 'public'
      AND c.relname = 'quotes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quotes_anon_select" ON "public"."quotes" FOR SELECT TO "anon" USING (("status" = 'approved'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: quotes quotes_auth_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'quotes_auth_all'
      AND n.nspname = 'public'
      AND c.relname = 'quotes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "quotes_auth_all" ON "public"."quotes" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: rbac_entity_menu_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rbac_entity_menu_map" ENABLE ROW LEVEL SECURITY;

--
-- Name: rbac_entity_menu_map rbac_entity_menu_map_admin_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'rbac_entity_menu_map_admin_all'
      AND n.nspname = 'public'
      AND c.relname = 'rbac_entity_menu_map'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "rbac_entity_menu_map_admin_all" ON "public"."rbac_entity_menu_map" TO "authenticated" USING ("public"."rbac_is_admin"()) WITH CHECK ("public"."rbac_is_admin"());
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: rbac_entity_menu_map rbac_entity_menu_map_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'rbac_entity_menu_map_select'
      AND n.nspname = 'public'
      AND c.relname = 'rbac_entity_menu_map'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "rbac_entity_menu_map_select" ON "public"."rbac_entity_menu_map" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."safety_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_records safety_records_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'safety_records_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'safety_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "safety_records_all_authenticated" ON "public"."safety_records" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: safety_records safety_records_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'safety_records_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'safety_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "safety_records_select_anon" ON "public"."safety_records" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_orders sales_orders_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sales_orders_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'sales_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "sales_orders_all_authenticated" ON "public"."sales_orders" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sales_orders sales_orders_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sales_orders_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'sales_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "sales_orders_select_anon" ON "public"."sales_orders" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_reminders service_all_contract_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'service_all_contract_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'contract_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "service_all_contract_reminders" ON "public"."contract_reminders" TO "service_role" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contract_templates service_all_contract_templates; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'service_all_contract_templates'
      AND n.nspname = 'public'
      AND c.relname = 'contract_templates'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "service_all_contract_templates" ON "public"."contract_templates" TO "service_role" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contracts service_all_contracts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'service_all_contracts'
      AND n.nspname = 'public'
      AND c.relname = 'contracts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "service_all_contracts" ON "public"."contracts" TO "service_role" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings site_settings_delete_admin; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'site_settings_delete_admin'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "site_settings_delete_admin" ON "public"."site_settings" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_insert_admin; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'site_settings_insert_admin'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "site_settings_insert_admin" ON "public"."site_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_select_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'site_settings_select_all'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "site_settings_select_all" ON "public"."site_settings" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'site_settings_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "site_settings_select_anon" ON "public"."site_settings" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_update_admin; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'site_settings_update_admin'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "site_settings_update_admin" ON "public"."site_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."stock_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_records stock_records_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'stock_records_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'stock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "stock_records_all_authenticated" ON "public"."stock_records" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: stock_records stock_records_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'stock_records_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'stock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "stock_records_select_anon" ON "public"."stock_records" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'suppliers_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'suppliers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "suppliers_all_authenticated" ON "public"."suppliers" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: suppliers suppliers_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'suppliers_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'suppliers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "suppliers_select_anon" ON "public"."suppliers" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_role_menu_buttons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sys_role_menu_buttons" ENABLE ROW LEVEL SECURITY;

--
-- Name: sys_role_menu_buttons sys_role_menu_buttons_admin_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sys_role_menu_buttons_admin_all'
      AND n.nspname = 'public'
      AND c.relname = 'sys_role_menu_buttons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "sys_role_menu_buttons_admin_all" ON "public"."sys_role_menu_buttons" TO "authenticated" USING ("public"."rbac_is_admin"()) WITH CHECK ("public"."rbac_is_admin"());
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_role_menu_buttons sys_role_menu_buttons_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sys_role_menu_buttons_select'
      AND n.nspname = 'public'
      AND c.relname = 'sys_role_menu_buttons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "sys_role_menu_buttons_select" ON "public"."sys_role_menu_buttons" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sys_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: sys_roles sys_roles_admin_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sys_roles_admin_all'
      AND n.nspname = 'public'
      AND c.relname = 'sys_roles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "sys_roles_admin_all" ON "public"."sys_roles" TO "authenticated" USING ("public"."rbac_is_admin"()) WITH CHECK ("public"."rbac_is_admin"());
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sys_roles sys_roles_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sys_roles_select'
      AND n.nspname = 'public'
      AND c.relname = 'sys_roles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "sys_roles_select" ON "public"."sys_roles" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_order_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_order_cards" ENABLE ROW LEVEL SECURITY;

--
-- Name: work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: work_orders work_orders_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'work_orders_all_authenticated'
      AND n.nspname = 'public'
      AND c.relname = 'work_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "work_orders_all_authenticated" ON "public"."work_orders" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_orders work_orders_select_anon; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'work_orders_select_anon'
      AND n.nspname = 'public'
      AND c.relname = 'work_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "work_orders_select_anon" ON "public"."work_orders" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: work_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_tasks 允许已认证用户更新审批任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '允许已认证用户更新审批任务'
      AND n.nspname = 'public'
      AND c.relname = 'approval_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "允许已认证用户更新审批任务" ON "public"."approval_tasks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: approval_tasks 允许已认证用户查看审批任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '允许已认证用户查看审批任务'
      AND n.nspname = 'public'
      AND c.relname = 'approval_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "允许已认证用户查看审批任务" ON "public"."approval_tasks" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- auth.users trigger: on_auth_user_created
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow all ecommerce-images" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all ecommerce-images'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all ecommerce-images" ON storage.objects AS PERMISSIVE FOR ALL TO PUBLIC USING ((bucket_id = ''ecommerce-images''::text)) WITH CHECK ((bucket_id = ''ecommerce-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow anon select" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anon select'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anon select" ON storage.objects AS PERMISSIVE FOR SELECT TO anon USING ((bucket_id = ''quality-defects''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow anon uploads" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anon uploads'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anon uploads" ON storage.objects AS PERMISSIVE FOR INSERT TO anon WITH CHECK ((bucket_id = ''quality-defects''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated delete quality-reports" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated delete quality-reports'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated delete quality-reports" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = ''quality-reports''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated select" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated select'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated select" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = ''quality-defects''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated update quality-reports" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated update quality-reports'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated update quality-reports" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = ''quality-reports''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated upload quality-reports" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated upload quality-reports'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated upload quality-reports" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''quality-reports''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated uploads" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated uploads'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated uploads" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''quality-defects''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow public read quality-reports" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public read quality-reports'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow public read quality-reports" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''quality-reports''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: anon_read_qrcodes on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'anon_read_qrcodes'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY anon_read_qrcodes ON storage.objects AS PERMISSIVE FOR SELECT TO anon USING ((bucket_id = ''qrcodes''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: auth_insert_qrcodes on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'auth_insert_qrcodes'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY auth_insert_qrcodes ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''qrcodes''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: invoice_files_anon_select on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'invoice_files_anon_select'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY invoice_files_anon_select ON storage.objects AS PERMISSIVE FOR SELECT TO anon USING ((bucket_id = ''invoice-files''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: invoice_files_auth_all on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'invoice_files_auth_all'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY invoice_files_auth_all ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING ((bucket_id = ''invoice-files''::text)) WITH CHECK ((bucket_id = ''invoice-files''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: product_images_anon_select on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'product_images_anon_select'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY product_images_anon_select ON storage.objects AS PERMISSIVE FOR SELECT TO anon USING ((bucket_id = ''product-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: product_images_auth_all on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'product_images_auth_all'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY product_images_auth_all ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING ((bucket_id = ''product-images''::text)) WITH CHECK ((bucket_id = ''product-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.entity_store
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.entity_store')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_store;';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('ecommerce-images', 'ecommerce-images', NULL, '2026-08-09 07:59:28.348488+00', '2026-08-09 07:59:28.348488+00', 'true', 'false', '1048576', '{image/png,image/jpeg,image/webp,image/avif,image/gif}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('invoice-files', 'invoice-files', NULL, '2026-08-03 01:16:51.495804+00', '2026-08-03 01:16:51.495804+00', 'true', 'false', '10485760', '{application/pdf,image/png,image/jpeg,image/webp}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('product-images', 'product-images', NULL, '2026-07-05 06:49:53.383663+00', '2026-07-05 06:49:53.383663+00', 'true', 'false', '1048576', '{image/png,image/jpeg,image/gif,image/webp,image/avif}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('qrcodes', 'qrcodes', NULL, '2026-08-05 18:28:48.351003+00', '2026-08-05 18:28:48.351003+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('quality-defects', 'quality-defects', NULL, '2026-08-02 14:21:20.77766+00', '2026-08-02 14:21:20.77766+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('quality-reports', 'quality-reports', NULL, '2026-08-01 01:50:20.825563+00', '2026-08-01 01:50:20.825563+00', 'true', 'false', '1048576', '{image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";

-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

DO $pg_cron_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ecommerce-sync-orders') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ecommerce-sync-orders'),
      schedule := '*/15 * * * *',
      command := '
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/ecommerce-sync-orders'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''apikey'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''publishable_key'')
    ),
    body := jsonb_build_object(''triggered_at'', now())
  ) AS request_id;
  ',
      active := true
    );
  ELSE
    PERFORM cron.schedule('ecommerce-sync-orders', '*/15 * * * *', '
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/ecommerce-sync-orders'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''apikey'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''publishable_key'')
    ),
    body := jsonb_build_object(''triggered_at'', now())
  ) AS request_id;
  ');
  END IF;
END
$pg_cron_restore$;
DO $pg_cron_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ecommerce-refresh-tokens') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ecommerce-refresh-tokens'),
      schedule := '0 * * * *',
      command := '
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/ecommerce-refresh-tokens'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''apikey'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''publishable_key'')
    ),
    body := jsonb_build_object(''triggered_at'', now())
  ) AS request_id;
  ',
      active := true
    );
  ELSE
    PERFORM cron.schedule('ecommerce-refresh-tokens', '0 * * * *', '
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/ecommerce-refresh-tokens'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''apikey'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''publishable_key'')
    ),
    body := jsonb_build_object(''triggered_at'', now())
  ) AS request_id;
  ');
  END IF;
END
$pg_cron_restore$;
