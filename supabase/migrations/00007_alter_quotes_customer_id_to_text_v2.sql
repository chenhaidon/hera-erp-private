-- 先移除外键约束
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_converted_order_id_fkey;

-- 报价单客户ID/订单ID使用与前端一致的字符串ID
ALTER TABLE quotes ALTER COLUMN customer_id TYPE text;
ALTER TABLE quotes ALTER COLUMN converted_order_id TYPE text;