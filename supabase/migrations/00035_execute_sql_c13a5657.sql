DO $$
DECLARE
  rec RECORD;
  new_id UUID;
  contract_no_map JSONB := '{}';
BEGIN
  FOR rec IN
    SELECT id AS row_id, data
    FROM entity_store
    WHERE entity_type = 'contracts'
      AND (data->>'id' IS NULL OR data->>'id' = '')
  LOOP
    new_id := gen_random_uuid();
    contract_no_map := contract_no_map || jsonb_build_object(rec.data->>'contract_no', new_id::text);
    UPDATE entity_store
    SET data = jsonb_set(rec.data, '{id}', to_jsonb(new_id::text), true)
    WHERE id = rec.row_id;
  END LOOP;

  FOR rec IN
    SELECT id AS row_id, data
    FROM entity_store
    WHERE entity_type = 'sales_orders'
      AND (data->>'contract_id' IS NULL OR data->>'contract_id' = '')
      AND (data->>'contract_no' IS NOT NULL AND data->>'contract_no' != '')
  LOOP
    new_id := (contract_no_map ->> (rec.data->>'contract_no'))::UUID;
    IF new_id IS NOT NULL THEN
      UPDATE entity_store
      SET data = jsonb_set(rec.data, '{contract_id}', to_jsonb(new_id::text), true)
      WHERE id = rec.row_id;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT id AS row_id, data
    FROM entity_store
    WHERE entity_type = 'purchase_orders'
      AND (data->>'contract_id' IS NULL OR data->>'contract_id' = '')
      AND (data->>'contract_no' IS NOT NULL AND data->>'contract_no' != '')
  LOOP
    new_id := (contract_no_map ->> (rec.data->>'contract_no'))::UUID;
    IF new_id IS NOT NULL THEN
      UPDATE entity_store
      SET data = jsonb_set(rec.data, '{contract_id}', to_jsonb(new_id::text), true)
      WHERE id = rec.row_id;
    END IF;
  END LOOP;

  UPDATE entity_store
  SET data = jsonb_set(data, '{id}', to_jsonb(gen_random_uuid()::text), true)
  WHERE entity_type IN ('sales_orders', 'purchase_orders')
    AND (data->>'id' IS NULL OR data->>'id' = '');
END $$;