ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS employee_id uuid NULL
REFERENCES employees(id)
ON DELETE SET NULL;

COMMENT ON COLUMN profiles.employee_id IS '关联的员工档案ID';