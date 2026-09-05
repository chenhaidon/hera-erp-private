DO $$
DECLARE
  p record;
  skuArr jsonb;
  sizes text[];
  s text;
  i int;
  productJson jsonb;
BEGIN
  FOR p IN SELECT * FROM products WHERE code LIKE 'JF-2026-%' ORDER BY code
  LOOP
    sizes := ARRAY(SELECT jsonb_array_elements_text(p.sizes));
    skuArr := '[]'::jsonb;
    i := 1;
    FOREACH s IN ARRAY sizes
    LOOP
      skuArr := skuArr || jsonb_build_object(
        'id', 'sku-' || p.id || '-' || i,
        'specification', p.name || ' ' || s,
        'size', s,
        'color', '默认',
        'pattern', p.quilt_pattern,
        'filling_weight', p.filling_weight,
        'quilt_pattern', p.quilt_pattern,
        'quilt_process', p.quilt_process,
        'weight', 0,
        'barcode', '',
        'suggested_price', 0
      );
      i := i + 1;
    END LOOP;
    productJson := jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'name', p.name,
      'category', p.category,
      'specification', p.quilt_pattern,
      'unit', '件',
      'description', p.fabric_type || ' ' || p.fabric_composition,
      'images', '[]'::jsonb,
      'process_list', p.process_list,
      'status', 'active',
      'skus', skuArr,
      'boms', '[]'::jsonb,
      'pricing_strategy', jsonb_build_object('markup_rate', 0.25, 'target_profit_rate', 0.15, 'min_price', 0, 'suggested_price', 0),
      'packaging_cost_per_unit', 0,
      'logistics_cost_per_unit', 0,
      'other_cost_per_unit', 0
    );
    INSERT INTO entity_store (entity_type, data, created_at, updated_at)
    VALUES ('products', productJson, now(), now())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;