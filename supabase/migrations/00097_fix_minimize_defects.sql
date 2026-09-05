DROP FUNCTION IF EXISTS minimize_defects(text, int);
CREATE OR REPLACE FUNCTION minimize_defects(p_contract_no text, p_keep int)
RETURNS TABLE(kept int, cleared int)
LANGUAGE plpgsql AS $$
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