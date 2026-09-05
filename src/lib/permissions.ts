import { useAppStore } from '@/store';

export type AppRole = 'admin' | 'production' | 'planner' | 'worker' | 'quality' | 'warehouse' | 'finance' | 'sales' | 'procurement' | 'outsourcing' | 'hr' | 'maintenance';

export function hasPermission(role: AppRole, allowedRoles: AppRole[]): boolean {
  return allowedRoles.includes(role);
}

export type FieldPermission = 'hidden' | 'read' | 'write';

export interface FieldRule {
  resource: string;
  field: string;
  roles: Record<AppRole, FieldPermission>;
}

export interface ResourceRules {
  [field: string]: Record<AppRole, FieldPermission>;
}

const ALL_ROLES: AppRole[] = ['admin', 'production', 'planner', 'worker', 'quality', 'warehouse', 'finance', 'sales', 'procurement', 'outsourcing', 'hr', 'maintenance'];

function fillRoles(overrides: Partial<Record<AppRole, FieldPermission>>): Record<AppRole, FieldPermission> {
  const result = {} as Record<AppRole, FieldPermission>;
  for (const r of ALL_ROLES) {
    result[r] = overrides[r] ?? 'hidden';
  }
  return result;
}

export function getDefaultEmployeePermissions(): ResourceRules {
  return {
    name: fillRoles({ admin: 'write', production: 'read', worker: 'read', quality: 'read', warehouse: 'read', finance: 'read', sales: 'read', hr: 'read', procurement: 'read', outsourcing: 'read' }),
    department: fillRoles({ admin: 'write', production: 'read', worker: 'read', quality: 'read', warehouse: 'read', finance: 'hidden', sales: 'hidden', hr: 'read' }),
    position: fillRoles({ admin: 'write', production: 'read', worker: 'read', quality: 'read', warehouse: 'read', finance: 'hidden', sales: 'hidden', hr: 'read' }),
    skill_level: fillRoles({ admin: 'write', production: 'write', worker: 'read', quality: 'read', warehouse: 'hidden', finance: 'hidden', sales: 'hidden', hr: 'write' }),
    skill_tags: fillRoles({ admin: 'write', production: 'write', worker: 'read', quality: 'read', warehouse: 'hidden', finance: 'hidden', sales: 'hidden', hr: 'write' }),
    hire_date: fillRoles({ admin: 'write', production: 'read', worker: 'read', quality: 'read', warehouse: 'read', finance: 'read', sales: 'read', hr: 'read', procurement: 'read', outsourcing: 'read' }),
    phone: fillRoles({ admin: 'write', production: 'hidden', worker: 'hidden', quality: 'hidden', warehouse: 'hidden', finance: 'read', sales: 'read', hr: 'write' }),
    status: fillRoles({ admin: 'write', production: 'read', worker: 'read', quality: 'read', warehouse: 'read', finance: 'read', sales: 'read', hr: 'read', procurement: 'read', outsourcing: 'read' }),
  };
}

export const EMPLOYEE_PERMISSIONS = getDefaultEmployeePermissions();

export function getFieldPermission(resource: ResourceRules, field: string, role: AppRole): FieldPermission {
  return resource[field]?.[role] ?? 'read';
}

export function canWrite(resource: ResourceRules, field: string, role: AppRole): boolean {
  return getFieldPermission(resource, field, role) === 'write';
}

export function canRead(resource: ResourceRules, field: string, role: AppRole): boolean {
  const p = getFieldPermission(resource, field, role);
  return p === 'read' || p === 'write';
}

export function isVisible(resource: ResourceRules, field: string, role: AppRole): boolean {
  return getFieldPermission(resource, field, role) !== 'hidden';
}

export function useFieldPermission(resourceName: string): ResourceRules {
  const { fieldPermissions } = useAppStore();
  return fieldPermissions[resourceName] ?? {};
}
