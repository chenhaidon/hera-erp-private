CREATE OR REPLACE FUNCTION public.execute_sql(
  sql_text text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stmt text;
BEGIN
  FOR stmt IN SELECT btrim(s) FROM unnest(string_to_array(sql_text, ';')) AS s WHERE btrim(s) <> ''
  LOOP
    EXECUTE stmt;
  END LOOP;
END;
$$;