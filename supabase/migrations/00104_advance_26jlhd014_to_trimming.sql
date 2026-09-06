-- 本地部署：该迁移为一次性业务数据修复，其效果已包含在导出的最终业务数据中，跳过
DO $$ BEGIN RAISE NOTICE 'skip 00104_advance_26jlhd014_to_trimming.sql (data fix, covered by final CSV import)'; END $$;
