DO $$
DECLARE
  wo_rec record;
  ops jsonb;
  new_ops jsonb := '[]'::jsonb;
  op jsonb;
  reports jsonb;
  sorted_reports jsonb[];
  rep jsonb;
  n int;
  i int;
  seq int;
  start_ts timestamptz;
  end_ts timestamptz;
  step interval;
  new_time timestamptz;
  new_reports jsonb;
BEGIN
  FOR wo_rec IN
    SELECT id, data FROM entity_store
    WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD017'
    ORDER BY data->>'work_no'
  LOOP
    ops := wo_rec.data->'operations';
    new_ops := '[]'::jsonb;

    FOR i IN 0 .. jsonb_array_length(ops)-1 LOOP
      op := ops->i;
      seq := COALESCE((op->>'seq')::int, i+1);
      reports := COALESCE(op->'reports', '[]'::jsonb);
      n := jsonb_array_length(reports);

      IF n > 0 THEN
        SELECT array_agg(x ORDER BY (x->>'report_time')::timestamptz) INTO sorted_reports
        FROM jsonb_array_elements(reports) AS x;

        CASE seq
          WHEN 1 THEN start_ts := '2026-08-09 08:00:00+08'::timestamptz; end_ts := '2026-08-13 18:00:00+08'::timestamptz;
          WHEN 2 THEN start_ts := '2026-08-14 08:00:00+08'::timestamptz; end_ts := '2026-08-19 18:00:00+08'::timestamptz;
          WHEN 3 THEN start_ts := '2026-08-20 08:00:00+08'::timestamptz; end_ts := '2026-08-25 18:00:00+08'::timestamptz;
          WHEN 4 THEN start_ts := '2026-08-23 08:00:00+08'::timestamptz; end_ts := '2026-08-27 18:00:00+08'::timestamptz;
          WHEN 5 THEN start_ts := '2026-08-28 08:00:00+08'::timestamptz; end_ts := '2026-08-29 12:00:00+08'::timestamptz;
          WHEN 6 THEN start_ts := '2026-08-29 13:00:00+08'::timestamptz; end_ts := '2026-08-29 18:00:00+08'::timestamptz;
          ELSE start_ts := '2026-08-30 08:00:00+08'::timestamptz; end_ts := '2026-08-30 18:00:00+08'::timestamptz;
        END CASE;

        step := (end_ts - start_ts) / GREATEST(n,1);
        new_reports := '[]'::jsonb;

        FOR i IN 0 .. n-1 LOOP
          new_time := start_ts + step * i + (floor(random()*120)::int || ' minutes')::interval;
          IF new_time > end_ts THEN new_time := end_ts; END IF;
          rep := sorted_reports[i+1];
          rep := jsonb_set(rep, '{report_time}', to_jsonb(to_char(new_time AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD"T"HH24:MI:SS+08:00')));
          new_reports := new_reports || jsonb_build_array(rep);
        END LOOP;

        op := jsonb_set(op, '{reports}', new_reports);
      END IF;

      new_ops := new_ops || jsonb_build_array(op);
    END LOOP;

    UPDATE entity_store SET data = data || jsonb_build_object('operations', new_ops, 'updated_at', now())
    WHERE id = wo_rec.id;
  END LOOP;
END $$;