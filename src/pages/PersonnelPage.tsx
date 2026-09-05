import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useState, useMemo, useRef } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionField } from "@/components/common/PermissionField";
import { useAppStore } from "@/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { useFieldPermission, canWrite } from "@/lib/permissions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SKILL_TAGS } from "@/lib/data";
import { calcLevelFromConfig } from "@/lib/performanceGrade";
import { PerformanceGradeConfigPanel } from "@/pages/personnel/PerformanceGradeConfigPanel";
import {
  Plus,
  Users,
  UserCheck,
  CalendarDays,
  Star,
  BookOpen,
  Banknote,
  Search,
  Factory,
  CheckCircle,
  QrCode,
  Download,
  Upload,
  ChevronDown,
  Trash2,
  Eye,
  Settings2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  downloadEmployeeTemplate,
  parseEmployeeExcel,
  type EmployeeImportError,
} from "@/lib/employeeImport";
import {
  downloadAttendanceTemplate,
  parseAttendanceExcel,
  type AttendanceImportError,
} from "@/lib/attendanceImport";
import type {
  Employee,
  AttendanceRecord,
  LeaveRecord,
  PerformanceRecord,
  TrainingRecord,
} from "@/types";
import { nanoid } from "@/lib/utils";
import QRCodeDataUrl from "@/components/ui/qrcodedataurl";

export function PersonnelPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="人员管理"
        description="员工档案、考勤、请假、绩效、培训与工资"
      />
      <ControlledTabs modulePath="/personnel" defaultTab="employee">
        <TabsList className="bg-muted">
          <TabsTrigger value="employee">员工档案</TabsTrigger>
          <TabsTrigger value="attendance">考勤管理</TabsTrigger>
          <TabsTrigger value="leave">请假管理</TabsTrigger>
          <TabsTrigger value="performance">绩效考核</TabsTrigger>
          <TabsTrigger value="training">培训记录</TabsTrigger>
          <TabsTrigger value="salary">工资汇总</TabsTrigger>
        </TabsList>
        <EmployeeTab />
        <AttendanceTab />
        <LeaveTab />
        <PerformanceTab />
        <TrainingTab />
        <SalaryTab />
      </ControlledTabs>
    </div>
  );
}

/* ─── 员工档案 ───────────────────────────────────────────── */

function EmployeeTab() {
  const store = useAppStore();
  const role = store.currentRole;
  const employeePermissions = useFieldPermission("employee");
  const canEditName = canWrite(employeePermissions, "name", role);
  const canEditAny = Object.keys(employeePermissions).some((field) =>
    canWrite(employeePermissions, field, role),
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Employee>>({
    status: "active",
    skill_tags: [],
    skill_level: "中级",
  });
  const [search, setSearch] = useState("");
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [badgeEmployee, setBadgeEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [importErrors, setImportErrors] = useState<EmployeeImportError[]>([]);
  const [importProgress, setImportProgress] = useState<{
    open: boolean;
    status: "running" | "done";
    current: number;
    total: number;
    success: number;
    failed: number;
    failedCodes: string[];
  }>({
    open: false,
    status: "running",
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    failedCodes: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const employees = useMemo(() => {
    let list = store.employees;
    if (search)
      list = list.filter(
        (e) => e.name.includes(search) || e.code.includes(search),
      );
    return [...list].sort((a, b) => (a.code || "").localeCompare(b.code || "", "zh-Hans-CN", { numeric: true }));
  }, [store.employees, search]);

  function save() {
    if (!editing.name) return;
    const payload: Employee = editing.id
      ? ({ ...editing } as Employee)
      : ({
          ...editing,
          id: nanoid(),
          code: `E${String(store.employees.length + 1).padStart(3, "0")}`,
        } as Employee);
    if (editing.id) store.updateEmployee(payload);
    else store.addEmployee(payload);
    setOpen(false);
    setEditing({ status: "active", skill_tags: [], skill_level: "中级" });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    store.deleteEmployee(deleteTarget.id);
    toast.success(`已删除员工「${deleteTarget.name}」`);
    setDeleteTarget(null);
  }

  function toggleSkill(skill: string) {
    const tags = new Set(editing.skill_tags || []);
    if (tags.has(skill)) tags.delete(skill);
    else tags.add(skill);
    setEditing({ ...editing, skill_tags: Array.from(tags) });
  }

  const {
    paginatedItems: employeesPaginated,
    currentPage: employeesCurrentPage,
    pageSize: employeesPageSize,
    totalPages: employeesTotalPages,
    totalItems: employeesTotalItems,
    setPage: setEmployeesPage,
    setPageSize: setEmployeesPageSize,
  } = usePagination(employees);

  function closeImportProgress() {
    setImportProgress({
      open: false,
      status: "running",
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      failedCodes: [],
    });
  }

  function handleDownloadTemplate() {
    downloadEmployeeTemplate();
    toast.success("员工导入模板已开始下载");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const result = await parseEmployeeExcel(file, store.employees);
    if (!result.success) {
      setImportErrors(result.errors);
      return;
    }

    setImportProgress({
      open: true,
      status: "running",
      current: 0,
      total: result.employees.length,
      success: 0,
      failed: 0,
      failedCodes: [],
    });

    const failedCodes: string[] = [];
    for (let i = 0; i < result.employees.length; i++) {
      const employee = result.employees[i];
      try {
        await store.addEmployee(employee);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          success: prev.success + 1,
        }));
      } catch (err) {
        failedCodes.push(employee.code);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          failed: prev.failed + 1,
          failedCodes: [...prev.failedCodes, employee.code],
        }));
      }
    }

    setImportProgress((prev) => ({ ...prev, status: "done" }));
    toast.success(
      `员工导入完成，成功创建 ${result.employees.length - failedCodes.length}/${result.employees.length} 个员工`,
    );
  }

  return (
    <TabsContent value="employee" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">在职员工</p>
              <p className="text-xl font-bold">
                {employees.filter((e) => e.status === "active").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">高级技工</p>
              <p className="text-xl font-bold">
                {employees.filter((e) => e.skill_level === "高级").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">部门数</p>
              <p className="text-xl font-bold">
                {new Set(employees.map((e) => e.department || "")).size}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">本月新入职</p>
              <p className="text-xl font-bold">
                {
                  employees.filter((e) =>
                    e.hire_date?.startsWith(
                      new Date().toISOString().slice(0, 7),
                    ),
                  ).length
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名/工号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {canEditName && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="mr-1 h-4 w-4" />
                  批量导入
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  下载导入模板
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  导入员工 Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              onClick={() => {
                setEditing({
                  status: "active",
                  skill_tags: [],
                  skill_level: "中级",
                });
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新增员工
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">工号</TableHead>
                <TableHead className="whitespace-nowrap">姓名</TableHead>
                <TableHead className="whitespace-nowrap">部门</TableHead>
                <TableHead className="whitespace-nowrap">技能等级</TableHead>
                <TableHead className="whitespace-nowrap">联系方式</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesPaginated.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {e.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{e.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.department || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        e.skill_level === "高级"
                          ? "default"
                          : e.skill_level === "中级"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {e.skill_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{e.phone}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={e.status === "active" ? "default" : "secondary"}
                      className={e.status === "active" ? "bg-green-500" : ""}
                    >
                      {e.status === "active" ? "在职" : "离职"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBadgeEmployee(e);
                          setBadgeOpen(true);
                        }}
                      >
                        <QrCode className="mr-1 h-3 w-3" />
                        生成工牌码
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailEmployee(e)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        详情
                      </Button>
                      {canEditName && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing({ ...e });
                            setOpen(true);
                          }}
                        >
                          编辑
                        </Button>
                      )}
                      {canEditName && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(e)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无员工信息
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={employeesCurrentPage}
            totalPages={employeesTotalPages}
            pageSize={employeesPageSize}
            totalItems={employeesTotalItems}
            onPageChange={setEmployeesPage}
            onPageSizeChange={setEmployeesPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={badgeOpen}
        onOpenChange={(v) => {
          setBadgeOpen(v);
          if (!v) setBadgeEmployee(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>员工工牌码</DialogTitle>
          </DialogHeader>
          {badgeEmployee && (
            <div className="flex flex-col items-center py-4">
              <div className="text-center mb-4">
                <p className="text-lg font-bold">{badgeEmployee.name}</p>
                <p className="text-sm text-muted-foreground">
                  工号：{badgeEmployee.code}
                </p>
                <p className="text-sm text-muted-foreground">
                  {badgeEmployee.department || "-"}
                </p>
              </div>
              <QRCodeDataUrl
                text={`jinlong:employee:${badgeEmployee.id}`}
                width={200}
              />
              <p className="mt-3 text-xs text-muted-foreground text-center max-w-[200px] break-all">
                {`jinlong:employee:${badgeEmployee.id}`}
              </p>
              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                >
                  打印
                </Button>
                <Button
                  onClick={() => {
                    const canvas = document.querySelector(
                      "[data-qr-download] canvas, .qr-code-container img",
                    ) as HTMLCanvasElement | HTMLImageElement | null;
                    if (canvas) {
                      const link = document.createElement("a");
                      link.download = `工牌码_${badgeEmployee.code}_${badgeEmployee.name}.png`;
                      link.href =
                        canvas instanceof HTMLCanvasElement
                          ? canvas.toDataURL("image/png")
                          : (canvas as HTMLImageElement).src;
                      link.click();
                    }
                  }}
                >
                  <Download className="mr-1 h-4 w-4" />
                  下载
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailEmployee}
        onOpenChange={(v) => {
          if (!v) setDetailEmployee(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>员工详情</DialogTitle>
          </DialogHeader>
          {detailEmployee && (
            <div className="grid gap-3 py-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground">工号</Label>
                <p className="font-medium">{detailEmployee.code}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">姓名</Label>
                <p className="font-medium">{detailEmployee.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">部门</Label>
                <p className="font-medium">{detailEmployee.department || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">技能等级</Label>
                <p className="font-medium">{detailEmployee.skill_level || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">入职日期</Label>
                <p className="font-medium">{detailEmployee.hire_date || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">联系方式</Label>
                <p className="font-medium">{detailEmployee.phone || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">状态</Label>
                <p className="font-medium">
                  {detailEmployee.status === "active" ? "在职" : "离职"}
                </p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-muted-foreground">技能标签</Label>
                <p className="font-medium">
                  {detailEmployee.skill_tags?.join(", ") || "-"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除员工</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除员工「{deleteTarget?.name}」（工号：
              {deleteTarget?.code}）吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setEditing({
              status: "active",
              skill_tags: [],
              skill_level: "中级",
            });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "编辑员工" : "新增员工"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <PermissionField
              resource={employeePermissions}
              field="name"
              role={role}
              label="姓名"
              readOnlyDisplay={editing.name || "-"}
            >
              <Input
                value={editing.name || ""}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </PermissionField>
            <PermissionField
              resource={employeePermissions}
              field="department"
              role={role}
              label="部门"
              readOnlyDisplay={editing.department || "-"}
            >
              <Input
                value={editing.department || ""}
                onChange={(e) =>
                  setEditing({ ...editing, department: e.target.value })
                }
              />
            </PermissionField>
            <PermissionField
              resource={employeePermissions}
              field="skill_level"
              role={role}
              label="技能等级"
              readOnlyDisplay={editing.skill_level || "-"}
            >
              <Select
                value={editing.skill_level || "中级"}
                onValueChange={(v) =>
                  setEditing({ ...editing, skill_level: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="初级">初级</SelectItem>
                  <SelectItem value="中级">中级</SelectItem>
                  <SelectItem value="高级">高级</SelectItem>
                </SelectContent>
              </Select>
            </PermissionField>
            <PermissionField
              resource={employeePermissions}
              field="hire_date"
              role={role}
              label="入职日期"
              readOnlyDisplay={editing.hire_date || "-"}
            >
              <Input
                type="date"
                value={editing.hire_date || ""}
                onChange={(e) =>
                  setEditing({ ...editing, hire_date: e.target.value })
                }
              />
            </PermissionField>
            <PermissionField
              resource={employeePermissions}
              field="phone"
              role={role}
              label="联系方式"
              readOnlyDisplay={editing.phone || "-"}
            >
              <Input
                value={editing.phone || ""}
                onChange={(e) =>
                  setEditing({ ...editing, phone: e.target.value })
                }
              />
            </PermissionField>
            <PermissionField
              resource={employeePermissions}
              field="status"
              role={role}
              label="状态"
              readOnlyDisplay={editing.status === "active" ? "在职" : "离职"}
            >
              <Select
                value={editing.status || "active"}
                onValueChange={(v) =>
                  setEditing({ ...editing, status: v as "active" | "inactive" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">在职</SelectItem>
                  <SelectItem value="inactive">离职</SelectItem>
                </SelectContent>
              </Select>
            </PermissionField>
            <PermissionField
              resource={employeePermissions}
              field="skill_tags"
              role={role}
              label="技能标签"
              className="md:col-span-2"
              readOnlyDisplay={editing.skill_tags?.join(", ") || "-"}
            >
              <div className="flex flex-wrap gap-2">
                {SKILL_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      canWrite(employeePermissions, "skill_tags", role) &&
                      toggleSkill(tag)
                    }
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${(editing.skill_tags || []).includes(tag) ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"} ${!canWrite(employeePermissions, "skill_tags", role) ? "cursor-default opacity-60" : ""}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </PermissionField>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            {canEditAny && (
              <Button onClick={save}>
                <Users className="mr-2 h-4 w-4" />
                保存
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importErrors.length > 0}
        onOpenChange={(v) => !v && setImportErrors([])}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入校验失败</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              请根据以下错误修正后重新上传：
            </p>
            <ScrollArea className="h-64">
              <ul className="space-y-1 pr-4 text-sm">
                {importErrors.map((err, idx) => (
                  <li key={idx} className="rounded-md border p-2">
                    <span className="font-medium">第 {err.row} 行：</span>
                    {err.message}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => setImportErrors([])}>我知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importProgress.open}
        onOpenChange={(v) => !v && closeImportProgress()}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {importProgress.status === "running"
                ? "正在导入员工"
                : "导入完成"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                进度 {importProgress.current}/{importProgress.total}
              </span>
              <span className="font-medium">
                {Math.round(
                  importProgress.total > 0
                    ? (importProgress.current / importProgress.total) * 100
                    : 0,
                )}%
              </span>
            </div>
            <Progress
              value={
                importProgress.total > 0
                  ? (importProgress.current / importProgress.total) * 100
                  : 0
              }
            />
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/30">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {importProgress.success}
                </div>
                <div className="text-muted-foreground">成功</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {importProgress.failed}
                </div>
                <div className="text-muted-foreground">失败</div>
              </div>
            </div>
            {importProgress.status === "done" &&
              importProgress.failedCodes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">失败工号：</p>
                  <ScrollArea className="h-32">
                    <ul className="space-y-1 pr-4 text-sm">
                      {importProgress.failedCodes.map((code, idx) => (
                        <li key={idx} className="text-destructive">
                          {code}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
          </div>
          <DialogFooter>
            {importProgress.status === "done" && (
              <Button onClick={closeImportProgress}>我知道了</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 考勤管理 ───────────────────────────────────────────── */

function AttendanceTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<AttendanceRecord>>({
    status: "normal",
  });
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "normal" | "late" | "absent"
  >("all");
  const [importErrors, setImportErrors] = useState<AttendanceImportError[]>([]);
  const [importProgress, setImportProgress] = useState<{
    open: boolean;
    status: "running" | "done";
    current: number;
    total: number;
    success: number;
    failed: number;
    failedRows: string[];
  }>({
    open: false,
    status: "running",
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    failedRows: [],
  });
  const attendanceImportRef = useRef<HTMLInputElement>(null);

  const monthRecords = useMemo(() => {
    return store.attendanceRecords
      .filter((r) => r.record_date.startsWith(monthFilter))
      .sort((a, b) => b.record_date.localeCompare(a.record_date));
  }, [store.attendanceRecords, monthFilter]);

  const normalCount = monthRecords.filter((r) => r.status === "normal").length;
  const lateCount = monthRecords.filter((r) => r.status === "late").length;
  const absentCount = monthRecords.filter((r) => r.status === "absent").length;

  const records = useMemo(() => {
    if (filterStatus === "all") return monthRecords;
    return monthRecords.filter((r) => r.status === filterStatus);
  }, [monthRecords, filterStatus]);

  function save() {
    if (!form.employee_id || !form.record_date) return;
    const emp = store.employees.find((e) => e.id === form.employee_id);
    const payload: AttendanceRecord = {
      ...(form as AttendanceRecord),
      id: nanoid(),
      employee_name: emp?.name,
    };
    store.addAttendanceRecord(payload);
    setOpen(false);
    setForm({ status: "normal" });
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      normal: { label: "正常", cls: "bg-green-500" },
      late: { label: "迟到", cls: "bg-orange-500" },
      early: { label: "早退", cls: "" },
      absent: { label: "缺勤", cls: "" },
      leave: { label: "请假", cls: "" },
    };
    const s = map[status] || { label: status, cls: "" };
    return (
      <Badge
        variant={
          status === "normal"
            ? "default"
            : status === "absent"
              ? "destructive"
              : "secondary"
        }
        className={s.cls}
      >
        {s.label}
      </Badge>
    );
  }

  const {
    paginatedItems: recordsPaginated,
    currentPage: recordsCurrentPage,
    pageSize: recordsPageSize,
    totalPages: recordsTotalPages,
    totalItems: recordsTotalItems,
    setPage: setRecordsPage,
    setPageSize: setRecordsPageSize,
  } = usePagination(records);

  function toggleStatusFilter(status: typeof filterStatus) {
    setFilterStatus((prev) => (prev === status ? "all" : status));
    setRecordsPage(1);
  }

  function clearStatusFilter() {
    setFilterStatus("all");
    setRecordsPage(1);
  }

  function closeImportProgress() {
    setImportProgress({
      open: false,
      status: "running",
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      failedRows: [],
    });
  }

  function handleDownloadTemplate() {
    downloadAttendanceTemplate();
    toast.success("考勤导入模板已开始下载");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attendanceImportRef.current) attendanceImportRef.current.value = "";

    const result = await parseAttendanceExcel(file, store.employees);
    if (!result.success) {
      setImportErrors(result.errors);
      return;
    }

    setImportProgress({
      open: true,
      status: "running",
      current: 0,
      total: result.records.length,
      success: 0,
      failed: 0,
      failedRows: [],
    });

    const failedRows: string[] = [];
    for (let i = 0; i < result.records.length; i++) {
      const record = result.records[i];
      try {
        await store.addAttendanceRecord(record);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          success: prev.success + 1,
        }));
      } catch (err) {
        failedRows.push(`${record.employee_name} ${record.record_date}`);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          failed: prev.failed + 1,
          failedRows: [...prev.failedRows, `${record.employee_name} ${record.record_date}`],
        }));
      }
    }

    setImportProgress((prev) => ({ ...prev, status: "done" }));
    toast.success(
      `考勤导入完成，成功 ${result.records.length - failedRows.length}/${result.records.length} 条`,
    );
  }

  return (
    <TabsContent value="attendance" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${
            filterStatus === "normal" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => toggleStatusFilter("normal")}
        >
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">正常出勤</p>
            <p className="text-xl font-bold text-green-600">{normalCount}</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${
            filterStatus === "late" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => toggleStatusFilter("late")}
        >
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">迟到</p>
            <p className="text-xl font-bold text-orange-500">{lateCount}</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${
            filterStatus === "absent" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => toggleStatusFilter("absent")}
        >
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">缺勤</p>
            <p className="text-xl font-bold text-destructive">{absentCount}</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label>月份</Label>
            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setRecordsPage(1);
              }}
              className="w-40"
            />
          </div>
          {filterStatus !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearStatusFilter}
            >
              清空筛选
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-1 h-4 w-4" />
                导入考勤
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                下载导入模板
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => attendanceImportRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                导入 Excel/CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={attendanceImportRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            录入考勤
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">姓名</TableHead>
                <TableHead className="whitespace-nowrap">日期</TableHead>
                <TableHead className="whitespace-nowrap">
                  打卡时间（上班）
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  打卡时间（下班）
                </TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.employee_name || r.employee_id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.record_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.check_in || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.check_out || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {statusBadge(r.status)}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {filterStatus === "all"
                      ? "暂无考勤记录"
                      : `暂无${filterStatus === "normal" ? "正常出勤" : filterStatus === "late" ? "迟到" : "缺勤"}记录`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={recordsCurrentPage}
            totalPages={recordsTotalPages}
            pageSize={recordsPageSize}
            totalItems={recordsTotalItems}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ status: "normal" });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>录入考勤</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>员工</Label>
              <Select
                value={form.employee_id || ""}
                onValueChange={(v) => setForm({ ...form, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择员工" />
                </SelectTrigger>
                <SelectContent>
                  {store.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={form.record_date || ""}
                onChange={(e) =>
                  setForm({ ...form, record_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>上班时间</Label>
              <Input
                type="time"
                value={form.check_in || ""}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>下班时间</Label>
              <Input
                type="time"
                value={form.check_out || ""}
                onChange={(e) =>
                  setForm({ ...form, check_out: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status || "normal"}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as AttendanceRecord["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">正常</SelectItem>
                  <SelectItem value="late">迟到</SelectItem>
                  <SelectItem value="early">早退</SelectItem>
                  <SelectItem value="absent">缺勤</SelectItem>
                  <SelectItem value="leave">请假</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <CalendarDays className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importProgress.open}
        onOpenChange={(v) => !v && closeImportProgress()}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {importProgress.status === "running" ? "正在导入考勤" : "导入完成"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                进度 {importProgress.current}/{importProgress.total}
              </span>
              <span className="font-medium">
                {Math.round(
                  importProgress.total > 0
                    ? (importProgress.current / importProgress.total) * 100
                    : 0,
                )}%
              </span>
            </div>
            <Progress
              value={
                importProgress.total > 0
                  ? (importProgress.current / importProgress.total) * 100
                  : 0
              }
            />
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/30">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {importProgress.success}
                </div>
                <div className="text-muted-foreground">成功</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {importProgress.failed}
                </div>
                <div className="text-muted-foreground">失败</div>
              </div>
            </div>
            {importProgress.status === "done" &&
              importProgress.failedRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">失败记录：</p>
                  <ScrollArea className="h-32">
                    <ul className="space-y-1 pr-4 text-sm">
                      {importProgress.failedRows.map((row, idx) => (
                        <li key={idx} className="text-destructive">
                          {row}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
          </div>
          <DialogFooter>
            {importProgress.status === "done" && (
              <Button onClick={closeImportProgress}>我知道了</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={importErrors.length > 0}
        onOpenChange={(v) => !v && setImportErrors([])}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>导入校验失败</AlertDialogTitle>
            <AlertDialogDescription>
              请修正以下错误后重新上传
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea className="h-48">
            <ul className="space-y-2 pr-4 text-sm">
              {importErrors.map((err, idx) => (
                <li key={idx} className="text-destructive">
                  第 {err.row} 行：{err.message}
                </li>
              ))}
            </ul>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportErrors([])}>
              我知道了
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}

/* ─── 请假管理 ───────────────────────────────────────────── */

function LeaveTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<LeaveRecord>>({
    leave_type: "annual",
    status: "pending",
  });

  const leaves = useMemo(
    () =>
      store.leaveRecords
        .slice()
        .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [store.leaveRecords],
  );

  function save() {
    if (!form.employee_id || !form.start_date) return;
    const emp = store.employees.find((e) => e.id === form.employee_id);
    const payload: LeaveRecord = {
      ...(form as LeaveRecord),
      id: nanoid(),
      employee_name: emp?.name,
      status: "pending",
    };
    store.addLeaveRecord(payload);
    setOpen(false);
    setForm({ leave_type: "annual", status: "pending" });
  }

  const LEAVE_LABELS: Record<string, string> = {
    annual: "年假",
    sick: "病假",
    personal: "事假",
    other: "其他",
  };

  const {
    paginatedItems: leavesPaginated,
    currentPage: leavesCurrentPage,
    pageSize: leavesPageSize,
    totalPages: leavesTotalPages,
    totalItems: leavesTotalItems,
    setPage: setLeavesPage,
    setPageSize: setLeavesPageSize,
  } = usePagination(leaves);

  return (
    <TabsContent value="leave" className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          申请请假
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">员工</TableHead>
                <TableHead className="whitespace-nowrap">假别</TableHead>
                <TableHead className="whitespace-nowrap">开始日期</TableHead>
                <TableHead className="whitespace-nowrap">结束日期</TableHead>
                <TableHead className="whitespace-nowrap">天数</TableHead>
                <TableHead className="whitespace-nowrap">原因</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leavesPaginated.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {l.employee_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {LEAVE_LABELS[l.leave_type] || l.leave_type}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.start_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.end_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.days} 天
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.reason}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.status === "approved" ? (
                      <Badge variant="default" className="bg-green-500">
                        已批准
                      </Badge>
                    ) : l.status === "rejected" ? (
                      <Badge variant="destructive">已驳回</Badge>
                    ) : (
                      <Badge variant="secondary">待审批</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            store.updateLeaveRecord({
                              ...l,
                              status: "approved",
                            })
                          }
                        >
                          批准
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            store.updateLeaveRecord({
                              ...l,
                              status: "rejected",
                            })
                          }
                        >
                          驳回
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {leaves.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无请假记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={leavesCurrentPage}
            totalPages={leavesTotalPages}
            pageSize={leavesPageSize}
            totalItems={leavesTotalItems}
            onPageChange={setLeavesPage}
            onPageSizeChange={setLeavesPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ leave_type: "annual", status: "pending" });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>申请请假</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>员工</Label>
              <Select
                value={form.employee_id || ""}
                onValueChange={(v) => setForm({ ...form, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择员工" />
                </SelectTrigger>
                <SelectContent>
                  {store.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>假别</Label>
              <Select
                value={form.leave_type || "annual"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    leave_type: v as LeaveRecord["leave_type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">年假</SelectItem>
                  <SelectItem value="sick">病假</SelectItem>
                  <SelectItem value="personal">事假</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={form.start_date || ""}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={form.end_date || ""}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>天数</Label>
              <Input
                type="number"
                value={form.days || ""}
                onChange={(e) =>
                  setForm({ ...form, days: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>请假原因</Label>
              <Textarea
                value={form.reason || ""}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>提交申请</Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 绩效考核 ───────────────────────────────────────────── */

function PerformanceTab() {
  const store = useAppStore();
  const role = store.currentRole;
  const isAdmin = role === 'admin';
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [form, setForm] = useState<Partial<PerformanceRecord>>({
    period: new Date().toISOString().slice(0, 7),
  });

  const records = useMemo(
    () =>
      store.performanceRecords
        .slice()
        .sort((a, b) => b.period.localeCompare(a.period)),
    [store.performanceRecords],
  );

  function calcLevel(total: number): "A" | "B" | "C" | "D" {
    return calcLevelFromConfig(total, store.performanceGradeConfig);
  }

  function save() {
    if (!form.employee_id) return;
    const emp = store.employees.find((e) => e.id === form.employee_id);
    const total = Math.round(
      ((form.productivity_score || 0) +
        (form.quality_score || 0) +
        (form.attendance_score || 0) +
        (form.safety_score || 0)) /
        4,
    );
    const payload: PerformanceRecord = {
      ...(form as PerformanceRecord),
      id: nanoid(),
      employee_name: emp?.name,
      total_score: total,
      level: calcLevel(total),
    };
    store.addPerformanceRecord(payload);
    setOpen(false);
    setForm({ period: new Date().toISOString().slice(0, 7) });
  }

  function levelBadge(level: string) {
    const cls =
      level === "A"
        ? "bg-green-500"
        : level === "B"
          ? ""
          : level === "C"
            ? "bg-orange-500"
            : "";
    const variant =
      level === "D" ? ("destructive" as const) : ("default" as const);
    return (
      <Badge variant={variant} className={cls}>
        {level}级
      </Badge>
    );
  }

  const {
    paginatedItems: recordsPaginated,
    currentPage: recordsCurrentPage,
    pageSize: recordsPageSize,
    totalPages: recordsTotalPages,
    totalItems: recordsTotalItems,
    setPage: setRecordsPage,
    setPageSize: setRecordsPageSize,
  } = usePagination(records);

  return (
    <TabsContent value="performance" className="space-y-4">
      <div className="flex justify-end gap-2">
        {isAdmin && (
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            等级配置
          </Button>
        )}
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增绩效
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">员工</TableHead>
                <TableHead className="whitespace-nowrap">考核月份</TableHead>
                <TableHead className="whitespace-nowrap">产能分</TableHead>
                <TableHead className="whitespace-nowrap">质量分</TableHead>
                <TableHead className="whitespace-nowrap">出勤分</TableHead>
                <TableHead className="whitespace-nowrap">安全分</TableHead>
                <TableHead className="whitespace-nowrap">综合分</TableHead>
                <TableHead className="whitespace-nowrap">等级</TableHead>
                <TableHead className="whitespace-nowrap">评价</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.employee_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.period}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.productivity_score}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.quality_score}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.attendance_score}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.safety_score}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-semibold">
                    {r.total_score}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {levelBadge(r.level)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.comment || "-"}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无绩效记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={recordsCurrentPage}
            totalPages={recordsTotalPages}
            pageSize={recordsPageSize}
            totalItems={recordsTotalItems}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ period: new Date().toISOString().slice(0, 7) });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>绩效考核录入</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>员工</Label>
              <Select
                value={form.employee_id || ""}
                onValueChange={(v) => setForm({ ...form, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择员工" />
                </SelectTrigger>
                <SelectContent>
                  {store.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>考核月份</Label>
              <Input
                type="month"
                value={form.period || ""}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>产能分（0-100）</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.productivity_score || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    productivity_score: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>质量分（0-100）</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.quality_score || ""}
                onChange={(e) =>
                  setForm({ ...form, quality_score: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>出勤分（0-100）</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.attendance_score || ""}
                onChange={(e) =>
                  setForm({ ...form, attendance_score: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>安全分（0-100）</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.safety_score || ""}
                onChange={(e) =>
                  setForm({ ...form, safety_score: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>评语</Label>
              <Textarea
                value={form.comment || ""}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>评估人</Label>
              <Input
                value={form.evaluator || ""}
                onChange={(e) =>
                  setForm({ ...form, evaluator: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <Star className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>绩效等级配置</DialogTitle>
          </DialogHeader>
          <PerformanceGradeConfigPanel onSaved={() => setConfigOpen(false)} />
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 培训记录 ───────────────────────────────────────────── */

function TrainingTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TrainingRecord | null>(null);
  const [form, setForm] = useState<Partial<TrainingRecord>>({
    type: "skill",
    status: "planned",
    participants: [],
  });

  const records = useMemo(
    () =>
      store.trainingRecords
        .slice()
        .sort((a, b) => b.training_date.localeCompare(a.training_date)),
    [store.trainingRecords],
  );

  function save() {
    if (!form.title) return;
    const payload: TrainingRecord = {
      ...(form as TrainingRecord),
      id: nanoid(),
    };
    store.addTrainingRecord(payload);
    setOpen(false);
    setForm({ type: "skill", status: "planned", participants: [] });
  }

  const TYPE_MAP: Record<string, string> = {
    skill: "技能培训",
    safety: "安全培训",
    quality: "质量培训",
    management: "管理培训",
  };

  const {
    paginatedItems: recordsPaginated,
    currentPage: recordsCurrentPage,
    pageSize: recordsPageSize,
    totalPages: recordsTotalPages,
    totalItems: recordsTotalItems,
    setPage: setRecordsPage,
    setPageSize: setRecordsPageSize,
  } = usePagination(records);

  return (
    <TabsContent value="training" className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增培训
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">培训主题</TableHead>
                <TableHead className="whitespace-nowrap">类型</TableHead>
                <TableHead className="whitespace-nowrap">讲师</TableHead>
                <TableHead className="whitespace-nowrap">培训日期</TableHead>
                <TableHead className="whitespace-nowrap">时长(h)</TableHead>
                <TableHead className="whitespace-nowrap">参与人数</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.title}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {TYPE_MAP[r.type] || r.type}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.trainer}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.training_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.duration}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.participants.length}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        r.status === "completed" ? "default" : "secondary"
                      }
                      className={r.status === "completed" ? "bg-green-500" : ""}
                    >
                      {r.status === "completed" ? "已完成" : "计划中"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDetail(r)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无培训记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={recordsCurrentPage}
            totalPages={recordsTotalPages}
            pageSize={recordsPageSize}
            totalItems={recordsTotalItems}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setForm({ type: "skill", status: "planned", participants: [] });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增培训记录</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label>培训主题</Label>
              <Input
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>培训类型</Label>
              <Select
                value={form.type || "skill"}
                onValueChange={(v) =>
                  setForm({ ...form, type: v as TrainingRecord["type"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skill">技能</SelectItem>
                  <SelectItem value="safety">安全</SelectItem>
                  <SelectItem value="quality">质量</SelectItem>
                  <SelectItem value="management">管理</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>讲师</Label>
              <Input
                value={form.trainer || ""}
                onChange={(e) => setForm({ ...form, trainer: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>培训日期</Label>
              <Input
                type="date"
                value={form.training_date || ""}
                onChange={(e) =>
                  setForm({ ...form, training_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>时长(小时)</Label>
              <Input
                type="number"
                value={form.duration || ""}
                onChange={(e) =>
                  setForm({ ...form, duration: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>参与人员</Label>
              <Select
                value={form.participant_ids?.[0] || "none"}
                onValueChange={(v) => {
                  const emp = store.employees.find((x) => x.id === v);
                  const ids = emp ? [emp.id] : [];
                  setForm({
                    ...form,
                    participant_ids: ids,
                    participants: ids.map(
                      (id) =>
                        store.employees.find((x) => x.id === id)?.name || id,
                    ),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择参与人员" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {store.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status || "planned"}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as TrainingRecord["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">计划中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <BookOpen className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>培训详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <p className="text-sm text-muted-foreground">培训主题</p>
                  <p className="font-medium">{detail.title}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm text-muted-foreground">培训类型</p>
                  <p className="font-medium">
                    {TYPE_MAP[detail.type] || detail.type}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm text-muted-foreground">讲师</p>
                  <p className="font-medium">{detail.trainer}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm text-muted-foreground">培训日期</p>
                  <p className="font-medium">{detail.training_date}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm text-muted-foreground">时长</p>
                  <p className="font-medium">{detail.duration} 小时</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-sm text-muted-foreground">参与人数</p>
                  <p className="font-medium">{detail.participants.length} 人</p>
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">培训备注</p>
                <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                  {detail.notes || "暂无备注"}
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">参与人员</p>
                <div className="rounded-md border bg-muted/50 p-3 text-sm max-h-40 overflow-y-auto">
                  {detail.participants.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {detail.participants.map((name, idx) => (
                        <Badge key={idx} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">暂无参与人员</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetail(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 工资汇总 ───────────────────────────────────────────── */

function SalaryTab() {
  const store = useAppStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const salaries = useMemo(
    () =>
      store.financeRecords.filter(
        (f) => f.type === "salary" && f.month === month,
      ),
    [store.financeRecords, month],
  );

  const reportSummary = useMemo(() => {
    const map: Record<
      string,
      { employee_id?: string; name: string; qty: number; amount: number }
    > = {};
    store.workOrders.forEach((wo) => {
      wo.operations.forEach((op) => {
        if (!op) return;
        op.reports?.forEach((r) => {
          const reportMonth = (r.report_time || "").slice(0, 7);
          if (reportMonth === month) {
            if (!map[r.operator_name])
              map[r.operator_name] = {
                employee_id: r.operator_id,
                name: r.operator_name,
                qty: 0,
                amount: 0,
              };
            map[r.operator_name].qty += r.qty;
            map[r.operator_name].amount += r.amount;
          }
        });
      });
    });
    return Object.values(map)
      .map((v) => ({
        ...v,
        amount: Number(v.amount.toFixed(2)),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [store.workOrders, month]);

  const totalSalary = reportSummary.reduce((s, r) => s + r.amount, 0);

  function generateSalary() {
    let createdCount = 0;
    reportSummary.forEach((item) => {
      const existing = store.financeRecords.find(
        (f) =>
          f.type === "salary" &&
          f.month === month &&
          f.employee_id === item.employee_id,
      );
      const payload: import("@/types").FinanceRecord = {
        id: existing?.id || nanoid(),
        type: "salary",
        counterparty: item.name,
        employee_id: item.employee_id,
        month,
        amount: item.amount,
        paid_amount: existing?.paid_amount || 0,
        currency: "CNY",
        record_date: new Date().toISOString().slice(0, 10),
        status: existing?.status || "unsettled",
        cost_breakdown: { piecework: item.amount, quantity: item.qty },
      };
      if (existing) store.updateFinanceRecord(payload);
      else {
        store.addFinanceRecord(payload);
        createdCount++;
      }
    });
    alert(`已根据工序报工为 ${createdCount} 位员工生成计件工资单`);
  }

function paySalary(record: import("@/types").FinanceRecord) {
    if (record.status === "settled") return;
    store.updateFinanceRecord({
      ...record,
      status: "settled",
      paid_amount: record.amount,
    });
  }

  function payAllSalaries() {
    const pending = salaries.filter((f) => f.status !== "settled");
    if (pending.length === 0) {
      alert("本月没有待发放的工资");
      return;
    }
    if (!confirm(`确定要为 ${pending.length} 位员工发放工资吗？`)) return;
    pending.forEach((f) =>
      store.updateFinanceRecord({
        ...f,
        status: "settled",
        paid_amount: f.amount,
      }),
    );
    alert(`已成功发放 ${pending.length} 位员工的工资`);
  }

  const {
    paginatedItems: reportSummaryPaginated,
    currentPage: reportSummaryCurrentPage,
    pageSize: reportSummaryPageSize,
    totalPages: reportSummaryTotalPages,
    totalItems: reportSummaryTotalItems,
    setPage: setReportSummaryPage,
    setPageSize: setReportSummaryPageSize,
  } = usePagination(reportSummary);

  return (
    <TabsContent value="salary" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Banknote className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">本月工资总额</p>
              <p className="text-xl font-bold">
                ¥{totalSalary.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Factory className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">报工人员</p>
              <p className="text-xl font-bold">{reportSummary.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Label>月份</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateSalary}>一键核算计件工资</Button>
          <Button
            variant="default"
            onClick={payAllSalaries}
            disabled={salaries.filter((f) => f.status !== "settled").length === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            全部发放
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">工序报工汇总（本月）</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">员工</TableHead>
                <TableHead className="whitespace-nowrap">报工数量</TableHead>
                <TableHead className="whitespace-nowrap">工资金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportSummaryPaginated.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.qty}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold">
                    ¥{r.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {reportSummary.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-sm text-muted-foreground"
                  >
                    本月暂无报工记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={reportSummaryCurrentPage}
            totalPages={reportSummaryTotalPages}
            pageSize={reportSummaryPageSize}
            totalItems={reportSummaryTotalItems}
            onPageChange={setReportSummaryPage}
            onPageSizeChange={setReportSummaryPageSize}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
