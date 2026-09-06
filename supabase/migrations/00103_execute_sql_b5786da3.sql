-- 本地部署修复：原文件为占位符 "BEGIN; DO $$ ... $$; COMMIT;"（无效 SQL），替换为空操作
DO $$ BEGIN
  RAISE NOTICE '00103 为占位迁移，本地部署跳过';
END $$;
