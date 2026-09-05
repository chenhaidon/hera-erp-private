BEGIN; DO $$
DECLARE
  v_workers jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'name', data->>'name')) INTO v_workers
  FROM entity_store WHERE entity_type='employees' AND data->>'department'='生产部'
    AND data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');

  -- WO-2026-0016-1 SZ98870
  INSERT INTO entity_store (id, entity_type, data) VALUES ('f1f8a770-a6a5-4fad-816d-25deb35be6a3', 'work_orders', jsonb_build_object(
    'id','f1f8a770-a6a5-4fad-816d-25deb35be6a3','work_no','WO-2026-0016-1','contract_no','26JLHD014',
    'order_id','d37d1c82-85a9-443b-96a6-7937a1cebcee','order_no','SO-26JLHD014',
    'product_id','product-sz98870','product_code','SZ98870','product_name','希腊绒机绗被',
    'sku_id','sz98870-ok','sku_summary','112×106in + 20×36in×2','color','','plan_quantity',60,
    'completed_quantity',60,'status','running','progress',38,'source','plan','priority','medium',
    'start_date','2026-08-25','end_date','2026-09-26','issued_at','2026-08-25 08:00:00+08',
    'created_at','2026-08-25 08:00:00+08','updated_at',now(),'picking_status','completed',
    'operations', jsonb_build_array(
      jsonb_build_object('seq',1,'code','G-001','name','开料','skill','裁剪','device','裁剪机','category','internal','price',0.5,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',2,'code','G-008','name','电脑绣','skill','绣花','device','绣花机','category','outsourcing','price',0,'out_price',2,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','returned'),
      jsonb_build_object('seq',3,'code','G-002','name','剪边','skill','裁剪','device','剪边机','category','internal','price',0.3,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',4,'code','G-003','name','包边','skill','缝制','device','包边机','category','internal','price',0.6,'status','running','completed',false,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',5,'code','G-010','name','水洗','skill','水洗','device','水洗机','category','outsourcing','price',0,'out_price',1,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','pending'),
      jsonb_build_object('seq',6,'code','G-011','name','检验','skill','','device','','category','internal','price',0.5,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',7,'code','G-006','name','修补','skill','缝制','device','平缝机','category','internal','price',0.4,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',8,'code','G-007','name','包装','skill','包装','device','包装线','category','internal','price',0.3,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','')
    ),'product_category','SZ98870'
  ));
  INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, source, priority, start_date, end_date, sku_id, sku_summary, issued_at, created_at, updated_at)
  VALUES ('WO-2026-0016-1','SZ98870','希腊绒机绗被',60,60,38,'running','plan','medium','2026-08-25','2026-09-26','sz98870-ok','112×106in + 20×36in×2','2026-08-25 08:00:00+08','2026-08-25 08:00:00+08',now());

  -- WO-2026-0016-2 SZ26008
  INSERT INTO entity_store (id, entity_type, data) VALUES ('0614dbb6-8479-4595-bafd-c8ab879c59fa', 'work_orders', jsonb_build_object(
    'id','0614dbb6-8479-4595-bafd-c8ab879c59fa','work_no','WO-2026-0016-2','contract_no','26JLHD014',
    'order_id','d37d1c82-85a9-443b-96a6-7937a1cebcee','order_no','SO-26JLHD014',
    'product_id','product-sz26008','product_code','SZ26008','product_name','纯棉素色密绗被',
    'sku_id','sz26008-ok','sku_summary','112×106英寸 + 20×36英寸×2','color','米色','plan_quantity',60,
    'completed_quantity',60,'status','running','progress',38,'source','plan','priority','medium',
    'start_date','2026-08-25','end_date','2026-09-26','issued_at','2026-08-25 08:00:00+08',
    'created_at','2026-08-25 08:00:00+08','updated_at',now(),'picking_status','completed',
    'operations', jsonb_build_array(
      jsonb_build_object('seq',1,'code','G-001','name','开料','skill','裁剪','device','裁剪机','category','internal','price',0.5,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',2,'code','G-008','name','电脑绣','skill','绣花','device','绣花机','category','outsourcing','price',0,'out_price',2,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','returned'),
      jsonb_build_object('seq',3,'code','G-002','name','剪边','skill','裁剪','device','剪边机','category','internal','price',0.3,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',4,'code','G-003','name','包边','skill','缝制','device','包边机','category','internal','price',0.6,'status','running','completed',false,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',5,'code','G-010','name','水洗','skill','水洗','device','水洗机','category','outsourcing','price',0,'out_price',1,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','pending'),
      jsonb_build_object('seq',6,'code','G-011','name','检验','skill','','device','','category','internal','price',0.5,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',7,'code','G-006','name','修补','skill','缝制','device','平缝机','category','internal','price',0.4,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',8,'code','G-007','name','包装','skill','包装','device','包装线','category','internal','price',0.3,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','')
    ),'product_category','SZ26008'
  ));
  INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, source, priority, start_date, end_date, sku_id, sku_summary, issued_at, created_at, updated_at)
  VALUES ('WO-2026-0016-2','SZ26008','纯棉素色密绗被',60,60,38,'running','plan','medium','2026-08-25','2026-09-26','sz26008-ok','112×106英寸 + 20×36英寸×2','2026-08-25 08:00:00+08','2026-08-25 08:00:00+08',now());
END $$; COMMIT;