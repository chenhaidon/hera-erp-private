CREATE OR REPLACE FUNCTION assign_finished_inspectors() RETURNS void AS $$
DECLARE
  names text[] := ARRAY[
    '陈红星','杨云岩','方自伟','于娟英','应巧凤','金家华','季项农','陈恒','于松灰','张梦瑶','黄超灵','金灵芳','黄闰壻','张伟嫦','于能静','赵燕萍','于裕民'
  ];
  r record;
  picked text;
BEGIN
  FOR r IN SELECT id, data FROM entity_store WHERE entity_type='finished_inspections'
  LOOP
    picked := names[floor(random() * array_length(names, 1) + 1)::int];
    UPDATE entity_store
    SET data = jsonb_set(data, '{inspector}', to_jsonb(picked), true)
    WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS assign_finished_inspectors();