ALTER TABLE outsource_returns 
  DROP CONSTRAINT IF EXISTS outsource_returns_inspection_status_check RESTRICT; ALTER TABLE outsource_returns 
  ADD CONSTRAINT outsource_returns_inspection_status_check 
    CHECK (inspection_status IN ('pending', 'inspecting', 'qualified', 'partial', 'unqualified'));