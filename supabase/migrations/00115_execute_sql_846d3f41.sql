CREATE OR REPLACE FUNCTION execute_sql(
  sql_text text
) RETURNS void AS $$
BEGIN
  EXECUTE sql_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;