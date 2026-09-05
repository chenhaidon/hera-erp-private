-- 报价单ID使用与前端 nanoid 一致的字符串ID
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_pkey;
ALTER TABLE quotes ALTER COLUMN id TYPE text;
ALTER TABLE quotes ADD PRIMARY KEY (id);