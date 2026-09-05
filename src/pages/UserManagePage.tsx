import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Search, ChevronDown, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/lib/pagination";
import { supabase } from "@/db/supabase";
import type { SystemUser, Employee } from "@/types";
import { Pagination } from "@/components/common/Pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, uuid } from "@/lib/utils";

const ROLE_OPTIONS = [
  "管理员",
  "生产主管",
  "生产人员",
  "质检员",
  "仓库管理员",
  "财务人员",
  "销售",
  "外协管理",
  "设备运维",
];

function getUserRoles(user: SystemUser): string[] {
  return user.roles?.length ? user.roles : user.role ? [user.role] : [];
}

function formatRoleLabel(role: string) {
  return role;
}

const ROLE_TO_APP_ROLE: Record<string, string> = {
  管理员: "admin",
  生产主管: "production",
  生产人员: "worker",
  质检员: "quality",
  仓库管理员: "warehouse",
  财务人员: "finance",
  销售: "sales",
  外协管理: "outsourcing",
  设备运维: "maintenance",
};

const APP_ROLE_TO_LABEL: Record<string, string> = {
  admin: "管理员",
  production: "生产主管",
  worker: "生产人员",
  quality: "质检员",
  warehouse: "仓库管理员",
  finance: "财务人员",
  sales: "销售",
  outsourcing: "外协管理",
  maintenance: "设备运维",
};

async function loadProfiles(): Promise<SystemUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, email, role, status, employee_id, employees(name), created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[UserManage] 加载用户失败', error);
    toast.error('加载用户列表失败');
    return [];
  }
  return (data || []).map((p) => {
    const label = APP_ROLE_TO_LABEL[p.role] || p.role || '生产人员';
    const emailName = p.email ? p.email.replace(/@miaoda\.com$/i, '') : '';
    const account = p.username || emailName || p.id;
    const employee = (p as unknown as { employees?: { name?: string } | { name?: string }[] }).employees;
    const employeeName = Array.isArray(employee) ? employee[0]?.name : employee?.name;
    return {
      id: p.id,
      name: p.full_name || account,
      account,
      role: label,
      roles: [label],
      status: p.status === 'inactive' ? 'inactive' : 'active',
      employee_id: p.employee_id,
      employee_name: employeeName,
      last_login: p.updated_at ? p.updated_at.replace('T', ' ').slice(0, 16) : '-',
    } as SystemUser;
  });
}

async function updateProfileRole(profileId: string, appRole: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role: appRole })
    .eq('id', profileId);
  if (error) throw error;
}

interface UserManagePageProps {
  embedded?: boolean;
}

function RoleMultiSelect({
  roles,
  onChange,
}: {
  roles: string[];
  onChange: (roles: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allRoles = ROLE_OPTIONS;

  function toggle(role: string) {
    const next = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role];
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-auto min-h-[2.25rem] w-48 justify-between px-3 py-1",
            roles.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="flex flex-wrap gap-1">
            {roles.length === 0 && "选择角色"}
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-xs">
                {r}
              </Badge>
            ))}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-2">
          {allRoles.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
            >
              <Checkbox
                checked={roles.includes(r)}
                onCheckedChange={() => toggle(r)}
              />
              <span className="text-sm">{r}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function UserManagePage({ embedded }: UserManagePageProps = {}) {
  const store = useAppStore();
  const [usersState, setUsersState] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  if (store.currentRole !== "admin") {
    return (
      <div className="space-y-4">
        {!embedded && (
          <PageHeader
            title="用户管理"
            description="管理系统账号、角色与启用状态"
          />
        )}
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            当前角色无权限访问用户管理，请联系管理员。
          </CardContent>
        </Card>
      </div>
    );
  }
  const users = useMemo<SystemUser[]>(() => usersState, [usersState]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<Partial<SystemUser>>({});
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [linkUser, setLinkUser] = useState<SystemUser | null>(null);
  const [linkEmployeeId, setLinkEmployeeId] = useState<string | undefined>();
  const [linkSearch, setLinkSearch] = useState("");

  const filtered: SystemUser[] = useMemo(
    () => users.filter((u) => {
      const keyword = search.trim();
      if (!keyword) return true;
      return (
        u.name.includes(keyword) ||
        u.account.includes(keyword) ||
        (u.employee_name || "").includes(keyword)
      );
    }),
    [users, search]
  );
  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(filtered);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingUsers(true);
      const list = await loadProfiles();
      if (mounted) setUsersState(list);
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted && user) setCurrentUserId(user.id);
      setLoadingUsers(false);
    }
    void load();
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="用户管理"
          description="管理系统账号、角色与启用状态"
        />
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">用户列表</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索姓名/账号/员工"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-56"
                />
              </div>
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setForm({
                    name: "",
                    account: "",
                    role: "生产人员",
                    roles: ["生产人员"],
                    status: "active",
                    employee_id: "",
                    password: "123456",
                  });
                  setDialogOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                新增用户
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">姓名</TableHead>
                <TableHead className="whitespace-nowrap">账号</TableHead>
                <TableHead className="whitespace-nowrap">角色</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">关联员工档案</TableHead>
                <TableHead className="whitespace-nowrap">最近登录</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((u) => {
                return (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {u.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {u.account}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <RoleMultiSelect
                        roles={getUserRoles(u)}
                        onChange={async (newRoles) => {
                          const primary = newRoles[0] || u.role;
                          const appRole = ROLE_TO_APP_ROLE[primary];
                          if (!appRole) return;
                          try {
                            await updateProfileRole(u.id, appRole);
                            setUsersState((prev) =>
                              prev.map((item) =>
                                item.id === u.id
                                  ? { ...item, role: primary, roles: newRoles }
                                  : item
                              )
                            );
                            toast.success('角色已保存');
                          } catch {
                            toast.error('角色保存失败');
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={
                          u.status === "active" ? "default" : "secondary"
                        }
                      >
                        {u.status === "active" ? "启用" : "禁用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-auto px-2 py-1 text-xs",
                          u.employee_id ? "text-foreground hover:text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                          setLinkUser(u);
                          setLinkEmployeeId(u.employee_id);
                          setLinkSearch("");
                        }}
                      >
                        {u.employee_id ? (
                          <span className="font-medium">{u.employee_name || "已关联"}</span>
                        ) : (
                          <span>未关联 · 去关联</span>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {u.last_login}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(u);
                            setForm({ ...u });
                            setDialogOpen(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setResetTarget(u)}
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1" />
                          重置密码
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无用户
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="border-t-0 rounded-t-none"
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "编辑用户" : "新增用户"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                姓名 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="请输入用户姓名"
                value={form.name || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                账号 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="请输入登录账号"
                value={form.account || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, account: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <RoleMultiSelect
                roles={form.roles?.length ? form.roles : form.role ? [form.role] : []}
                onChange={(next) =>
                  setForm((prev) => ({
                    ...prev,
                    roles: next,
                    role: next[0] || prev.role,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={form.status || "active"}
                onValueChange={(status) =>
                  setForm((prev) => ({
                    ...prev,
                    status: status as SystemUser["status"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>关联员工档案</Label>
              <Select
                value={form.employee_id || "none"}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    employee_id: v === "none" ? undefined : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择员工档案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {store.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}（{e.code}{e.position ? ` · ${e.position}` : ""}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                const name = (form.name || "").trim();
                const account = (form.account || "").trim();
                if (!name || !account) {
                  toast.error("请填写姓名和账号");
                  return;
                }
                const accountConflict = users.find(
                  (u) =>
                    u.account.toLowerCase() === account.toLowerCase() &&
                    u.id !== editingUser?.id,
                );
                if (accountConflict) {
                  toast.error(`账号"${account}"已存在，请使用其他账号。`);
                  return;
                }
                let employeeId = form.employee_id;
                if (employeeId && !store.employees.some((e) => e.id === employeeId)) {
                  employeeId = undefined;
                  toast.info("原关联的员工档案已不存在，已自动解除关联");
                }
                if (employeeId) {
                  const conflict = users.find(
                    (u) =>
                      u.employee_id === employeeId &&
                      u.id !== editingUser?.id,
                  );
                  if (conflict) {
                    const employee = store.employees.find(
                      (e) => e.id === employeeId,
                    );
                    toast.error(
                      `员工档案"${employee?.name || employeeId}"已被账号"${conflict.account}"关联，请选择其他员工档案。`,
                    );
                    return;
                  }
                }
                try {
                  const primaryRole =
                    form.roles?.[0] || form.role || "销售";
                  const appRole = ROLE_TO_APP_ROLE[primaryRole];
                  if (!appRole) {
                    toast.error("未知角色");
                    return;
                  }
                  if (editingUser) {
                    const { error } = await supabase
                      .from('profiles')
                      .update({
                        username: account,
                        full_name: name,
                        role: appRole,
                        status: form.status || 'active',
                        employee_id: employeeId || null,
                      })
                      .eq('id', editingUser.id);
                    if (error) throw error;
                    const linkedEmployee = employeeId
                      ? store.employees.find((e) => e.id === employeeId)
                      : undefined;
                    setUsersState((prev) =>
                      prev.map((item) =>
                        item.id === editingUser.id
                          ? {
                              ...item,
                              name,
                              account,
                              role: primaryRole,
                              roles: [primaryRole],
                              status: form.status || 'active',
                              employee_id: employeeId || undefined,
                              employee_name: linkedEmployee?.name,
                            }
                          : item
                      )
                    );
                  } else {
                    const profileId = uuid();
                    const { error } = await supabase
                      .from('profiles')
                      .upsert({
                        id: profileId,
                        username: account,
                        full_name: name,
                        role: appRole,
                        status: form.status || 'active',
                        employee_id: employeeId || null,
                      }, { onConflict: 'username' });
                    if (error) throw error;
                    const { data: inserted } = await supabase
                      .from('profiles')
                      .select('id, username, full_name, role, status, employee_id, employees(name), created_at, updated_at')
                      .eq('id', profileId)
                      .single();
                    if (inserted) {
                      const insertedEmployee = (inserted as unknown as { employees?: { name?: string } | { name?: string }[] }).employees;
                      const insertedEmployeeName = Array.isArray(insertedEmployee) ? insertedEmployee[0]?.name : insertedEmployee?.name;
                      setUsersState((prev) => [
                        {
                          id: inserted.id,
                          name: inserted.full_name || inserted.username,
                          account: inserted.username,
                          role: primaryRole,
                          roles: [primaryRole],
                          status: inserted.status === 'inactive' ? 'inactive' : 'active',
                          last_login: '-',
                          employee_id: inserted.employee_id,
                          employee_name: insertedEmployeeName,
                        } as SystemUser,
                        ...prev,
                      ]);
                    }
                  }
                  toast.success("保存成功");
                  setDialogOpen(false);
                } catch (err) {
                  console.error('[UserManage] 保存失败', err);
                  toast.error("保存失败，请重试");
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关联员工档案弹窗 */}
      <Dialog
        open={!!linkUser}
        onOpenChange={(v) => { if (!v) setLinkUser(null); }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md max-h-[80dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>关联员工档案</DialogTitle>
            <DialogDescription>
              为用户 <span className="font-semibold text-foreground">{linkUser?.name}</span> 选择对应的员工档案
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 flex-1 min-h-0 flex flex-col">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索姓名/工号"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
              <div className="p-1 space-y-1">
                <Button
                  variant={linkEmployeeId ? "ghost" : "secondary"}
                  size="sm"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => setLinkEmployeeId(undefined)}
                >
                  <span className="text-muted-foreground">不关联</span>
                </Button>
                {store.employees
                  .filter((e) => {
                    const kw = linkSearch.trim();
                    if (!kw) return true;
                    return e.name.includes(kw) || e.code.includes(kw) || (e.position || "").includes(kw);
                  })
                  .map((e) => (
                    <Button
                      key={e.id}
                      variant={linkEmployeeId === e.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => setLinkEmployeeId(e.id)}
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className="text-muted-foreground ml-2">({e.code}{e.position ? ` · ${e.position}` : ""})</span>
                    </Button>
                  ))}
                {store.employees.filter((e) => {
                  const kw = linkSearch.trim();
                  if (!kw) return true;
                  return e.name.includes(kw) || e.code.includes(kw) || (e.position || "").includes(kw);
                }).length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4">未找到匹配的员工档案</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkUser(null)}>取消</Button>
            <Button
              onClick={async () => {
                if (!linkUser) return;
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ employee_id: linkEmployeeId || null })
                    .eq('id', linkUser.id);
                  if (error) throw error;
                  const linked = linkEmployeeId ? store.employees.find((e) => e.id === linkEmployeeId) : undefined;
                  setUsersState((prev) =>
                    prev.map((u) =>
                      u.id === linkUser.id
                        ? { ...u, employee_id: linkEmployeeId || undefined, employee_name: linked?.name }
                        : u
                    )
                  );
                  toast.success(linkEmployeeId ? '关联成功' : '已解除关联');
                  setLinkUser(null);
                } catch (err) {
                  console.error('[UserManage] 关联员工档案失败', err);
                  toast.error('保存失败，请稍后重试');
                }
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码确认弹窗 */}
      <AlertDialog
        open={!!resetTarget}
        onOpenChange={(v) => { if (!v) setResetTarget(null); }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>重置密码</AlertDialogTitle>
            <AlertDialogDescription>
              确认将用户 <span className="font-semibold text-foreground">{resetTarget?.name}</span>（账号：{resetTarget?.account}）的密码重置为 <span className="font-semibold text-foreground">123456</span>？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!resetTarget) return;
                // 重置密码需要修改 auth.users，前端无 service role，暂由管理员在 Supabase 后台操作
                toast.info(`用户"${resetTarget.name}"密码重置需联系管理员在认证后台操作`);
                setResetTarget(null);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除用户确认弹窗 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除用户 <span className="font-semibold text-foreground">{deleteTarget?.name}</span>（账号：{deleteTarget?.account}）吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                if (deleteTarget.id === currentUserId) {
                  toast.error('无法删除当前登录用户');
                  return;
                }
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .delete()
                    .eq('id', deleteTarget.id);
                  if (error) throw error;
                  setUsersState((prev) => prev.filter((u) => u.id !== deleteTarget.id));
                  toast.success('用户删除成功');
                  setDeleteTarget(null);
                } catch (err) {
                  console.error('[UserManage] 删除失败', err);
                  toast.error('删除失败，请稍后重试');
                }
              }}
            >
              确认删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
