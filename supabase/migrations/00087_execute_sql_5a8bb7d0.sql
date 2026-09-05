ALTER TABLE outsource_processing_payments 
  ADD CONSTRAINT outsource_processing_payments_work_order_id_fkey
    FOREIGN KEY(work_order_id)
    REFERENCES work_orders (id);