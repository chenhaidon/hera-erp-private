DO $$
DECLARE
  rec record;
  ops jsonb;
  wash_idx int;
  wash_op jsonb;
  inspect_op jsonb;
  new_ops jsonb;
  i int;
  proc jsonb;
BEGIN
  SELECT data INTO proc FROM entity_store WHERE entity_type = 'processes' AND data->>'code' = 'G-011' LIMIT 1;
  IF proc IS NULL THEN
    RAISE EXCEPTION 'G-011 检验工序不存在';
  END IF;

  FOR rec IN
    SELECT es.id, es.data
    FROM entity_store es
    WHERE es.entity_type = 'work_orders'
      AND es.data->>'contract_no' = '26JLKXD007'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(es.data->'operations') op
        WHERE op->>'name' = '水洗' OR op->>'code' = 'G-010'
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(es.data->'operations') op
        WHERE op->>'name' LIKE '%检验%' OR op->>'code' = 'G-011' OR op->>'code' = 'G-005'
      )
  LOOP
    ops := rec.data->'operations';
    wash_idx := -1;
    FOR i IN 0 .. jsonb_array_length(ops) - 1 LOOP
      IF (ops->i->>'name' = '水洗' OR ops->i->>'code' = 'G-010') THEN
        wash_idx := i;
        EXIT;
      END IF;
    END LOOP;

    IF wash_idx = -1 THEN
      CONTINUE;
    END IF;

    wash_op := ops->wash_idx;
    inspect_op := jsonb_build_object(
      'seq', (wash_op->>'seq')::int + 1,
      'code', proc->>'code',
      'name', proc->>'name',
      'plan_qty', COALESCE(wash_op->>'plan_qty', rec.data->>'total_quantity', '0'),
      'completed_qty', 0,
      'status', 'pending',
      'completed', false,
      'is_bottleneck', false,
      'device', COALESCE(proc->>'device', ''),
      'skill', COALESCE(proc->>'skill', ''),
      'category', COALESCE(proc->>'category', 'internal'),
      'process_id', proc->>'id'
    );

    new_ops := '[]'::jsonb;
    FOR i IN 0 .. jsonb_array_length(ops) - 1 LOOP
      IF i = wash_idx + 1 THEN
        new_ops := new_ops || inspect_op;
      END IF;
      new_ops := new_ops || jsonb_set(ops->i, '{seq}', to_jsonb(i + 1 + (CASE WHEN i > wash_idx THEN 1 ELSE 0 END)));
    END LOOP;
    -- if inspection is to be appended at the end
    IF wash_idx + 1 = jsonb_array_length(ops) THEN
      new_ops := new_ops || inspect_op;
    END IF;

    UPDATE entity_store
    SET data = jsonb_set(rec.data, '{operations}', new_ops, false),
        updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END $$;