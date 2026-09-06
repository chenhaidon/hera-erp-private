-- 本地部署：该迁移为一次性业务数据修复，其效果已包含在导出的最终业务数据中，跳过
DO $$ BEGIN RAISE NOTICE 'skip 00105_execute_sql_58ff0098.sql (data fix, covered by final CSV import)'; END $$;
