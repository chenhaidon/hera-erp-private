import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { useProductCategoryOptions } from "@/hooks/useDictionaryOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { useVisibleTabs } from "@/lib/moduleVisibility";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nanoid, formatBeijingTime } from "@/lib/utils";
import {
  Settings2,
  SlidersHorizontal,
  Layers,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  BookOpen,
  GitCompare,
  ExternalLink,
  FileText,
  List,
} from "lucide-react";
import type {
  ProcessItem,
  ProcessRoute,
  ProcessStep,
  ProcessParamTemplate,
  ProcessParamItem,
  ProcessVersion,
  ProcessKnowledge,
} from "@/types";

export function ProcessPage() {
  const { activeTab, setActiveTab } = useVisibleTabs("/process", "processes");
  const [knowledgeFilter, setKnowledgeFilter] = useState<{
    tag?: string;
    process?: string;
  }>({});

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="工艺管理"
        description="工艺路线库、参数模板、版本、效率分析、知识库与版本对比"
      />
      <ControlledTabs
        modulePath="/process"
        defaultTab="processes"
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
      >
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          <TabsTrigger value="processes" className="gap-2">
            <List className="h-4 w-4" />
            工序库
          </TabsTrigger>
          <TabsTrigger value="routes" className="gap-2">
            <Settings2 className="h-4 w-4" />
            工艺路线库
          </TabsTrigger>
          <TabsTrigger value="params" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            工艺参数管理
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-2">
            <Layers className="h-4 w-4" />
            工艺版本管理
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            工艺效率分析
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="h-4 w-4" />
            工艺知识库
          </TabsTrigger>
          <TabsTrigger value="diff" className="gap-2">
            <GitCompare className="h-4 w-4" />
            版本对比
          </TabsTrigger>
        </TabsList>
        <TabsContent value="processes">
          <ProcessLibraryTab />
        </TabsContent>
        <TabsContent value="routes">
          <RoutesTab />
        </TabsContent>
        <TabsContent value="params">
          <ParamsTab
            onReference={(tag) => {
              setKnowledgeFilter({ tag, process: tag });
              setActiveTab("knowledge");
            }}
          />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab />
        </TabsContent>
        <TabsContent value="efficiency">
          <EfficiencyTab
            onReference={(process) => {
              setKnowledgeFilter({ tag: "瓶颈", process });
              setActiveTab("knowledge");
            }}
          />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab initialFilter={knowledgeFilter} />
        </TabsContent>
        <TabsContent value="diff">
          <VersionDiffTab />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

function generateProcessCode(processes: ProcessItem[]) {
  const nums = processes.map((p) => Number(p.code.replace("G-", "")) || 0);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(3, "0");
  return `G-${next}`;
}

function generateRouteCode(routes: ProcessRoute[]) {
  const nums = routes.map((r) => Number(r.code.replace("R-", "")) || 0);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(3, "0");
  return `R-${next}`;
}

function processIsUsed(p: ProcessItem, routes: ProcessRoute[]) {
  return routes.some((r) =>
    r.steps.some(
      (s) => s.process_id === p.id || (s.name === p.name && s.code === p.code),
    ),
  );
}

function ProcessLibraryTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessItem | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "internal" | "outsourcing"
  >("all");

  const filtered = store.processes.filter((p) => {
    const matchSearch =
      !search || p.name.includes(search) || p.code.includes(search);
    const matchCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  function toggleStatus(p: ProcessItem) {
    store.updateProcess({
      ...p,
      status: p.status === "active" ? "inactive" : "active",
      updated_at: now(),
    });
  }

  async function removeProcess(p: ProcessItem) {
    if (processIsUsed(p, store.processRoutes)) {
      return;
    }
    await store.deleteProcess(p.id);
  }

  const {
    paginatedItems: filteredPaginated,
    currentPage: filteredCurrentPage,
    pageSize: filteredPageSize,
    totalPages: filteredTotalPages,
    totalItems: filteredTotalItems,
    setPage: setFilteredPage,
    setPageSize: setFilteredPageSize,
  } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="搜索工序名称/编码"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-56"
          />
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
          >
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="全部类别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类别</SelectItem>
              <SelectItem value="internal">内部</SelectItem>
              <SelectItem value="outsourcing">外协</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新增工序
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">工序编码</TableHead>
                <TableHead className="whitespace-nowrap">工序名称</TableHead>
                <TableHead className="whitespace-nowrap">工序类别</TableHead>
                <TableHead className="whitespace-nowrap">
                  内部计件单价(元)
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  计件单价(元/件)
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  外协加工单价(元)
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  标准工时(分钟)
                </TableHead>
                <TableHead className="whitespace-nowrap">所需设备</TableHead>
                <TableHead className="whitespace-nowrap">所需技能</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{p.code}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {p.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        p.category === "internal" ? "default" : "outline"
                      }
                    >
                      {p.category === "internal" ? "内部" : "外协"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.category === "internal" ? p.price : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.piece_price ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.category === "outsourcing"
                      ? (p.outsourcing_price ?? "-")
                      : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.standard_minutes}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.device || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.skill || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={p.status === "active" ? "default" : "secondary"}
                    >
                      {p.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProcess(p)}
                      disabled={processIsUsed(p, store.processRoutes)}
                      title={
                        processIsUsed(p, store.processRoutes)
                          ? "已被工艺路线引用，不可删除"
                          : "删除"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStatus(p)}
                      title="启用/停用"
                    >
                      <Switch checked={p.status === "active"} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="p-4 text-center text-muted-foreground"
                  >
                    暂无工序
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={filteredCurrentPage}
            totalPages={filteredTotalPages}
            pageSize={filteredPageSize}
            totalItems={filteredTotalItems}
            onPageChange={setFilteredPage}
            onPageSizeChange={setFilteredPageSize}
          />
        </CardContent>
      </Card>
      <ProcessDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function ProcessDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProcessItem | null;
}) {
  const store = useAppStore();
  const [form, setForm] = useState<Partial<ProcessItem>>({
    status: "active",
    category: "internal",
    price: 0,
    piece_price: 0,
    standard_minutes: 0,
  });

  useEffect(() => {
    if (open)
      setForm(
        editing
          ? { ...editing }
          : {
              status: "active",
              category: "internal",
              price: 0,
              piece_price: 0,
              standard_minutes: 0,
            },
      );
  }, [open, editing]);

  function save() {
    if (!form.name || !form.category) return;
    const minutes = Number(form.standard_minutes || 0);
    if (minutes < 0) return;
    const isInternal = form.category === "internal";
    const price = isInternal ? Number(form.price || 0) : 0;
    const piecePrice = Number(form.piece_price || 0);
    const outsourcingPrice = isInternal
      ? undefined
      : Number(form.outsourcing_price || 0);
    if (price < 0 || piecePrice < 0 || (outsourcingPrice ?? 0) < 0) return;
    const item: ProcessItem = {
      id: editing?.id || nanoid(),
      code: editing?.code || generateProcessCode(store.processes),
      name: form.name,
      price,
      piece_price: piecePrice,
      outsourcing_price: outsourcingPrice,
      standard_minutes: minutes,
      category: form.category as "internal" | "outsourcing",
      device: form.device || "",
      skill: form.skill || "",
      status: (form.status as "active" | "inactive") || "active",
      created_at: editing?.created_at || now(),
      updated_at: now(),
    };
    if (editing) store.updateProcess(item);
    else store.addProcess(item);
    onClose();
    setForm({
      status: "active",
      category: "internal",
      price: 0,
      piece_price: 0,
      standard_minutes: 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑工序" : "新增工序"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>工序编码</Label>
              <Input
                value={editing?.code || generateProcessCode(store.processes)}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>工序名称</Label>
              <Input
                value={form.name || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="请输入工序名称"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>工序类别</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    category: v as "internal" | "outsourcing",
                    price: v === "internal" ? f.price || 0 : 0,
                    outsourcing_price:
                      v === "outsourcing"
                        ? f.outsourcing_price || 0
                        : undefined,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">内部</SelectItem>
                  <SelectItem value="outsourcing">外协</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.category === "internal"
                  ? "内部工序：工人报工后按件计内部工资"
                  : "外协工序：工单流转到此处时进入外协发料流程"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>标准工时（分钟）</Label>
              <Input
                type="number"
                min={0}
                value={form.standard_minutes || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    standard_minutes: Number(e.target.value),
                  }))
                }
                placeholder="分钟"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {form.category === "internal" ? (
              <div className="space-y-2">
                <Label>内部计件单价（元）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: Number(e.target.value) }))
                  }
                  placeholder="元"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>外协加工单价（元）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.outsourcing_price ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      outsourcing_price: Number(e.target.value),
                    }))
                  }
                  placeholder="元"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>计件单价（元/件）</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.piece_price ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, piece_price: Number(e.target.value) }))
                }
                placeholder="元/件"
              />
            </div>
            <div className="space-y-2">
              <Label>所需设备</Label>
              <Input
                value={form.device || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, device: e.target.value }))
                }
                placeholder="选填"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>所需技能</Label>
            <Input
              value={form.skill || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, skill: e.target.value }))
              }
              placeholder="选填"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.status === "active"}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, status: v ? "active" : "inactive" }))
              }
            />
            <Label>启用</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoutesTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessRoute | null>(null);
  const [search, setSearch] = useState("");

  const routes = store.processRoutes.filter(
    (r) =>
      !search ||
      r.name.includes(search) ||
      r.category.includes(search) ||
      r.code.includes(search),
  );

  function toggleStatus(r: ProcessRoute) {
    store.updateProcessRoute({
      ...r,
      status: r.status === "active" ? "inactive" : "active",
      updated_at: now(),
    });
  }

  async function removeRoute(r: ProcessRoute) {
    const used = store.processVersions.some((v) => v.route_id === r.id);
    if (used) return;
    await store.deleteProcessRoute(r.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="搜索路线编号/名称/类别"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-72"
        />
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新建工艺路线
        </Button>
      </div>
      <div className="space-y-4">
        {routes.map((route) => (
          <Card key={route.id}>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {route.name}
                  <Badge
                    variant={
                      route.status === "active" ? "default" : "secondary"
                    }
                  >
                    {route.status === "active" ? "启用" : "停用"}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {route.code} · 适用类别：{route.category} ·{" "}
                  {route.steps.length} 道工序
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  已绑定产品：
                  {store.products
                    .filter((p) => p.route_binding?.route_id === route.id)
                    .map((p) => p.name)
                    .join("、") || "无"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(route);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRoute(route)}
                  disabled={store.processVersions.some(
                    (v) => v.route_id === route.id,
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleStatus(route)}
                  title="启用/停用"
                >
                  <Switch checked={route.status === "active"} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">序号</TableHead>
                    <TableHead className="whitespace-nowrap">
                      工序名称
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      工序类型
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      工序编号
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      标准工时(小时)
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      所需设备
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      所需技能
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      计件单价(元)
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      绗缝参数
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {route.steps
                    .sort((a, b) => a.seq - b.seq)
                    .map((step) => {
                      const process = store.processes.find(
                        (p) => p.name === step.name || p.code === step.code,
                      );
                      const isOutsource =
                        step.category === "outsourcing" ||
                        process?.category === "outsourcing";
                      return (
                        <TableRow
                          key={step.code}
                          className={step.is_bottleneck ? "bg-amber-50" : ""}
                        >
                          <TableCell className="whitespace-nowrap">
                            {step.seq}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            {step.name}
                            {step.optional && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                可选
                              </span>
                            )}
                            {step.is_bottleneck && (
                              <Badge variant="destructive" className="ml-2">
                                瓶颈
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {isOutsource ? (
                              <Badge variant="outline">外协</Badge>
                            ) : (
                              <Badge variant="secondary">内部</Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {step.code}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {step.hours}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {step.device}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {step.skill}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {isOutsource
                              ? step.outsourcing_price
                              : (step.piece_price ?? step.price)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {step.quilt_params
                              ? `${step.quilt_params.needle_density || ""} ${step.quilt_params.pattern || ""}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
        {routes.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              暂无工艺路线
            </CardContent>
          </Card>
        )}
      </div>
      <RouteDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function RouteDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProcessRoute | null;
}) {
  const store = useAppStore();
  const [form, setForm] = useState<Partial<ProcessRoute>>(() =>
    editing
      ? { ...editing }
      : {
          code: generateRouteCode(store.processRoutes),
          name: "",
          category: "",
          status: "active",
          steps: [],
        },
  );
  const [stepDraft, setStepDraft] = useState<Partial<ProcessStep>>({});
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "category" | "steps", string>>
  >({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { ...editing }
          : {
              code: generateRouteCode(store.processRoutes),
              name: "",
              category: "",
              status: "active",
              steps: [],
            },
      );
      setStepDraft({});
      setErrors({});
    }
  }, [open, editing, store.processRoutes]);

  const categories = useProductCategoryOptions();

  function addStep() {
    if (!stepDraft.process_id || !stepDraft.name || !stepDraft.code) return;
    const s: ProcessStep = {
      seq: (form.steps?.length || 0) + 1,
      code: stepDraft.code,
      name: stepDraft.name,
      price: Number(stepDraft.price || 0),
      piece_price: Number(stepDraft.piece_price || 0),
      hours: Number(stepDraft.hours || 0),
      device: stepDraft.device || "",
      skill: stepDraft.skill || "",
      process_id: stepDraft.process_id,
      category: stepDraft.category,
      outsourcing_price: stepDraft.outsourcing_price,
      optional: stepDraft.optional || false,
      is_bottleneck: stepDraft.is_bottleneck || false,
      quilt_params: stepDraft.is_bottleneck
        ? {
            needle_density: stepDraft.quilt_params?.needle_density || "",
            pattern: stepDraft.quilt_params?.pattern || "",
          }
        : undefined,
    };
    setForm((f) => ({ ...f, steps: [...(f.steps || []), s] }));
    setStepDraft({});
  }

  function moveStep(index: number, dir: -1 | 1) {
    const steps = [...(form.steps || [])];
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const [moved] = steps.splice(index, 1);
    steps.splice(newIndex, 0, moved);
    steps.forEach((s, i) => (s.seq = i + 1));
    setForm((f) => ({ ...f, steps }));
  }

  function removeStep(index: number) {
    const steps = [...(form.steps || [])];
    steps.splice(index, 1);
    steps.forEach((s, i) => (s.seq = i + 1));
    setForm((f) => ({ ...f, steps }));
  }

  function save() {
    const nextErrors: Partial<Record<"name" | "category" | "steps", string>> =
      {};
    if (!form.name?.trim()) nextErrors.name = "请输入路线名称";
    if (!form.category) nextErrors.category = "请选择适用产品类别";
    if (!form.steps?.length) nextErrors.steps = "请至少添加一道工序";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const route: ProcessRoute = {
      id: editing?.id || nanoid(),
      code: form.code || generateRouteCode(store.processRoutes),
      name: form.name!.trim(),
      category: form.category!,
      status: (form.status as ProcessRoute["status"]) || "active",
      steps: form.steps!,
      created_at: editing?.created_at || now(),
      updated_at: now(),
    };
    if (editing) store.updateProcessRoute(route);
    else store.addProcessRoute(route);
    onClose();
    setForm({ code: "", name: "", category: "", status: "active", steps: [] });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑工艺路线" : "新建工艺路线"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>路线编号</Label>
              <Input value={form.code || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>路线名称</Label>
              <Input
                value={form.name || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="请输入路线名称"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>适用产品类别</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类别" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category}</p>
              )}
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">添加工序</CardTitle>
              <p className="text-xs text-muted-foreground">
                从工序库选择工序后，系统会自动带入标准工时、单价、设备和技能；外协工序的计件单价固定为
                0。
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs">选择工序</Label>
                  <Select
                    value={stepDraft.process_id}
                    onValueChange={(v) => {
                      const p = store.processes.find((x) => x.id === v);
                      if (!p) return;
                      setStepDraft((d) => ({
                        ...d,
                        process_id: p.id,
                        name: p.name,
                        code: p.code,
                        price: p.category === "outsourcing" ? 0 : p.price,
                        piece_price:
                          p.piece_price ||
                          (p.category === "internal" ? p.price : 0),
                        outsourcing_price:
                          p.category === "outsourcing"
                            ? p.outsourcing_price
                            : undefined,
                        hours: Number((p.standard_minutes / 60).toFixed(3)),
                        device: p.device || "",
                        skill: p.skill || "",
                        category: p.category,
                        is_bottleneck: p.name.includes("绗缝"),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择工序库工序" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.processes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono">{p.code}</span> {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">标准工时（小时）</Label>
                  <Input
                    placeholder="小时"
                    type="number"
                    value={stepDraft.hours || ""}
                    onChange={(e) =>
                      setStepDraft((d) => ({
                        ...d,
                        hours: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">内部计件单价（元）</Label>
                  <Input
                    placeholder="元"
                    type="number"
                    value={stepDraft.price || ""}
                    onChange={(e) =>
                      setStepDraft((d) => ({
                        ...d,
                        price: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">计件单价（元/件）</Label>
                  <Input
                    placeholder="元/件"
                    type="number"
                    value={stepDraft.piece_price || ""}
                    onChange={(e) =>
                      setStepDraft((d) => ({
                        ...d,
                        piece_price: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">所需设备</Label>
                  <Input
                    placeholder="选填"
                    value={stepDraft.device || ""}
                    onChange={(e) =>
                      setStepDraft((d) => ({ ...d, device: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs">所需技能</Label>
                  <Input
                    placeholder="选填"
                    value={stepDraft.skill || ""}
                    onChange={(e) =>
                      setStepDraft((d) => ({ ...d, skill: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!stepDraft.optional}
                    onCheckedChange={(v) =>
                      setStepDraft((d) => ({ ...d, optional: v }))
                    }
                  />
                  <Label>可选</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!stepDraft.is_bottleneck}
                    onCheckedChange={(v) =>
                      setStepDraft((d) => ({ ...d, is_bottleneck: v }))
                    }
                  />
                  <Label>瓶颈</Label>
                </div>
                {stepDraft.name === "绗缝" && (
                  <>
                    <Input
                      placeholder="针距密度"
                      value={stepDraft.quilt_params?.needle_density || ""}
                      onChange={(e) =>
                        setStepDraft((d) => ({
                          ...d,
                          quilt_params: {
                            ...d.quilt_params,
                            needle_density: e.target.value,
                          },
                        }))
                      }
                    />
                    <Input
                      placeholder="花型"
                      value={stepDraft.quilt_params?.pattern || ""}
                      onChange={(e) =>
                        setStepDraft((d) => ({
                          ...d,
                          quilt_params: {
                            ...d.quilt_params,
                            pattern: e.target.value,
                          },
                        }))
                      }
                    />
                  </>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addStep}
                disabled={!stepDraft.process_id}
              >
                添加工序
              </Button>
            </CardContent>
          </Card>
          {errors.steps && (
            <p className="text-xs text-destructive">{errors.steps}</p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">序号</TableHead>
                  <TableHead className="whitespace-nowrap">工序</TableHead>
                  <TableHead className="whitespace-nowrap">类别</TableHead>
                  <TableHead className="whitespace-nowrap">工时</TableHead>
                  <TableHead className="whitespace-nowrap">
                    单价（元）
                  </TableHead>
                  <TableHead className="whitespace-nowrap">设备</TableHead>
                  <TableHead className="whitespace-nowrap">技能</TableHead>
                  <TableHead className="whitespace-nowrap">瓶颈</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    排序
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.steps?.map((s, i) => (
                  <TableRow key={s.code}>
                    <TableCell className="whitespace-nowrap">{s.seq}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {s.name}
                      {s.optional && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          可选
                        </span>
                      )}
                      {s.category === "outsourcing" && (
                        <Badge variant="outline" className="ml-2">
                          外协
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={
                          s.category === "outsourcing" ? "outline" : "default"
                        }
                      >
                        {s.category === "outsourcing" ? "外协" : "内部"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.hours}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.category === "outsourcing"
                        ? s.outsourcing_price
                        : s.price}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.device}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.skill}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.is_bottleneck ? "是" : "否"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStep(i, 1)}
                        disabled={i === (form.steps?.length || 0) - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParamsTab({ onReference }: { onReference?: (tag: string) => void }) {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessParamTemplate | null>(null);
  const [paramDraft, setParamDraft] = useState<Partial<ProcessParamItem>>({});

  function toggleStatus(t: ProcessParamTemplate) {
    store.updateProcessParamTemplate({
      ...t,
      status: t.status === "active" ? "inactive" : "active",
      updated_at: now(),
    });
  }

  function removeTemplate(t: ProcessParamTemplate) {
    store.setProcessParamTemplates(
      store.processParamTemplates.filter((x) => x.id !== t.id),
    );
  }

  const {
    paginatedItems: store_processParamTemplatesPaginated,
    currentPage: store_processParamTemplatesCurrentPage,
    pageSize: store_processParamTemplatesPageSize,
    totalPages: store_processParamTemplatesTotalPages,
    totalItems: store_processParamTemplatesTotalItems,
    setPage: setStore_processParamTemplatesPage,
    setPageSize: setStore_processParamTemplatesPageSize,
  } = usePagination(store.processParamTemplates);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
        {onReference && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReference("绗缝")}
          >
            <BookOpen className="mr-1 h-4 w-4" />
            引用知识库
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新建参数模板
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">模板编号</TableHead>
                <TableHead className="whitespace-nowrap">模板名称</TableHead>
                <TableHead className="whitespace-nowrap">适用工序</TableHead>
                <TableHead className="whitespace-nowrap">参数项</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store_processParamTemplatesPaginated.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{t.code}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {t.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.process_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.params.map((p) => p.name).join("、")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={t.status === "active" ? "default" : "secondary"}
                    >
                      {t.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(t);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTemplate(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStatus(t)}
                    >
                      <Switch checked={t.status === "active"} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {store.processParamTemplates.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    暂无参数模板
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={store_processParamTemplatesCurrentPage}
            totalPages={store_processParamTemplatesTotalPages}
            pageSize={store_processParamTemplatesPageSize}
            totalItems={store_processParamTemplatesTotalItems}
            onPageChange={setStore_processParamTemplatesPage}
            onPageSizeChange={setStore_processParamTemplatesPageSize}
          />
        </CardContent>
      </Card>
      <ParamTemplateDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function ParamTemplateDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProcessParamTemplate | null;
}) {
  const store = useAppStore();
  const [form, setForm] = useState<Partial<ProcessParamTemplate>>(() =>
    editing
      ? { ...editing }
      : { code: "", name: "", process_name: "", status: "active", params: [] },
  );
  const [draft, setDraft] = useState<Partial<ProcessParamItem>>({});

  function addParam() {
    if (!draft.name) return;
    if ((draft.upper || 0) < (draft.lower || 0)) return;
    const p: ProcessParamItem = {
      name: draft.name,
      standard: Number(draft.standard || 0),
      upper: Number(draft.upper || 0),
      lower: Number(draft.lower || 0),
      unit: draft.unit || "",
    };
    setForm((f) => ({ ...f, params: [...(f.params || []), p] }));
    setDraft({});
  }

  function removeParam(i: number) {
    const params = [...(form.params || [])];
    params.splice(i, 1);
    setForm((f) => ({ ...f, params }));
  }

  function save() {
    if (!form.code || !form.name || !form.process_name) return;
    const t: ProcessParamTemplate = {
      id: editing?.id || nanoid(),
      code: form.code,
      name: form.name,
      process_name: form.process_name,
      status: (form.status as ProcessParamTemplate["status"]) || "active",
      params: form.params || [],
      created_at: editing?.created_at || now(),
      updated_at: now(),
    };
    if (editing) store.updateProcessParamTemplate(t);
    else store.addProcessParamTemplate(t);
    onClose();
    setForm({
      code: "",
      name: "",
      process_name: "",
      status: "active",
      params: [],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑参数模板" : "新建参数模板"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>模板编号</Label>
              <Input
                value={form.code || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>模板名称</Label>
              <Input
                value={form.name || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>适用工序</Label>
              <Select
                value={form.process_name}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, process_name: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工序" />
                </SelectTrigger>
                <SelectContent>
                  {store.processes.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">参数配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-5">
                <Input
                  placeholder="参数名称"
                  value={draft.name || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
                <Input
                  placeholder="标准值"
                  type="number"
                  value={draft.standard || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      standard: Number(e.target.value),
                    }))
                  }
                />
                <Input
                  placeholder="下限"
                  type="number"
                  value={draft.lower || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, lower: Number(e.target.value) }))
                  }
                />
                <Input
                  placeholder="上限"
                  type="number"
                  value={draft.upper || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, upper: Number(e.target.value) }))
                  }
                />
                <Input
                  placeholder="单位"
                  value={draft.unit || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, unit: e.target.value }))
                  }
                />
              </div>
              <Button size="sm" variant="outline" onClick={addParam}>
                添加参数
              </Button>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">参数</TableHead>
                      <TableHead className="whitespace-nowrap">
                        标准值
                      </TableHead>
                      <TableHead className="whitespace-nowrap">范围</TableHead>
                      <TableHead className="whitespace-nowrap text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.params?.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">
                          {p.name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {p.standard} {p.unit}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {p.lower} ~ {p.upper} {p.unit}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParam(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionsTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessVersion | null>(null);

  function toggleStatus(v: ProcessVersion) {
    store.updateProcessVersion({
      ...v,
      status: v.status === "active" ? "inactive" : "active",
      updated_at: now(),
    });
  }

  function removeVersion(v: ProcessVersion) {
    store.setProcessVersions(
      store.processVersions.filter((x) => x.id !== v.id),
    );
  }

  const {
    paginatedItems: store_processVersionsPaginated,
    currentPage: store_processVersionsCurrentPage,
    pageSize: store_processVersionsPageSize,
    totalPages: store_processVersionsTotalPages,
    totalItems: store_processVersionsTotalItems,
    setPage: setStore_processVersionsPage,
    setPageSize: setStore_processVersionsPageSize,
  } = usePagination(store.processVersions);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新建工艺版本
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">版本号</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">工艺路线</TableHead>
                <TableHead className="whitespace-nowrap">生效日期</TableHead>
                <TableHead className="whitespace-nowrap">失效日期</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store_processVersionsPaginated.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {v.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {v.product_name}({v.product_code})
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {v.route_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {v.effective_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {v.expiry_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={v.status === "active" ? "default" : "secondary"}
                    >
                      {v.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(v);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVersion(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStatus(v)}
                    >
                      <Switch checked={v.status === "active"} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {store.processVersions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="p-4 text-center text-muted-foreground"
                  >
                    暂无工艺版本
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={store_processVersionsCurrentPage}
            totalPages={store_processVersionsTotalPages}
            pageSize={store_processVersionsPageSize}
            totalItems={store_processVersionsTotalItems}
            onPageChange={setStore_processVersionsPage}
            onPageSizeChange={setStore_processVersionsPageSize}
          />
        </CardContent>
      </Card>
      <VersionDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function VersionDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProcessVersion | null;
}) {
  const store = useAppStore();
  const [form, setForm] = useState<Partial<ProcessVersion>>(() =>
    editing
      ? { ...editing }
      : { code: "", effective_date: "", expiry_date: "", status: "active" },
  );

  const selectedProduct = store.products.find((p) => p.id === form.product_id);
  const selectedRoute = store.processRoutes.find((r) => r.id === form.route_id);

  function save() {
    if (
      !form.code ||
      !form.product_id ||
      !form.route_id ||
      !form.effective_date ||
      !form.expiry_date
    )
      return;
    const v: ProcessVersion = {
      id: editing?.id || nanoid(),
      code: form.code,
      product_id: form.product_id,
      product_code: selectedProduct!.code,
      product_name: selectedProduct!.name,
      route_id: form.route_id,
      route_name: selectedRoute!.name,
      effective_date: form.effective_date,
      expiry_date: form.expiry_date,
      status: (form.status as ProcessVersion["status"]) || "active",
      created_at: editing?.created_at || now(),
      updated_at: now(),
    };
    if (editing) store.updateProcessVersion(v);
    else store.addProcessVersion(v);
    onClose();
    setForm({
      code: "",
      effective_date: "",
      expiry_date: "",
      status: "active",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑工艺版本" : "新建工艺版本"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>版本号</Label>
            <Input
              value={form.code || ""}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>产品</Label>
            <Select
              value={form.product_id}
              onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择产品" />
              </SelectTrigger>
              <SelectContent>
                {store.products
                  .filter((p) => p.status === "active")
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}({p.code})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>工艺路线</Label>
            <Select
              value={form.route_id}
              onValueChange={(v) => setForm((f) => ({ ...f, route_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择工艺路线" />
              </SelectTrigger>
              <SelectContent>
                {store.processRoutes
                  .filter((r) => r.status === "active")
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>生效日期</Label>
              <Input
                type="date"
                value={form.effective_date || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>失效日期</Label>
              <Input
                type="date"
                value={form.expiry_date || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiry_date: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EfficiencyTab({
  onReference,
}: {
  onReference?: (process: string) => void;
}) {
  const store = useAppStore();
  const stats = useMemo(() => {
    const map: Record<
      string,
      { standard_hours: number; actual_hours: number; completed_qty: number }
    > = {};
    store.workOrders.forEach((wo) => {
      const route = store.processRoutes.find(
        (r) =>
          r.id ===
            store.productionPlans.find((p) => p.id === wo.plan_id)
              ?.product_id &&
          r.category ===
            store.products.find((p) => p.id === wo.product_id)?.category,
      );
      const product = store.products.find((p) => p.id === wo.product_id);
      const actualHoursPerUnit = 2.8; // 示例：实际平均工时
      (route?.steps || []).forEach((step) => {
        if (!map[step.name])
          map[step.name] = {
            standard_hours: 0,
            actual_hours: 0,
            completed_qty: 0,
          };
        map[step.name].standard_hours += step.hours * wo.completed_quantity;
        map[step.name].actual_hours +=
          step.hours * actualHoursPerUnit * wo.completed_quantity;
        map[step.name].completed_qty += wo.completed_quantity;
      });
    });
    return Object.entries(map).map(([process_name, v]) => ({
      process_name,
      ...v,
      rate: v.actual_hours > 0 ? (v.standard_hours / v.actual_hours) * 100 : 0,
    }));
  }, [
    store.workOrders,
    store.processRoutes,
    store.productionPlans,
    store.products,
  ]);

  const bottleneck = stats.filter((s) => s.rate < 80);

  const {
    paginatedItems: statsPaginated,
    currentPage: statsCurrentPage,
    pageSize: statsPageSize,
    totalPages: statsTotalPages,
    totalItems: statsTotalItems,
    setPage: setStatsPage,
    setPageSize: setStatsPageSize,
  } = usePagination(stats);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            工序效率统计
          </CardTitle>
          {onReference && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onReference(
                  stats.find((s) => s.rate < 80)?.process_name || "绗缝",
                )
              }
            >
              <BookOpen className="mr-1 h-4 w-4" />
              引用知识库
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">工序名称</TableHead>
                <TableHead className="whitespace-nowrap">标准工时</TableHead>
                <TableHead className="whitespace-nowrap">实际工时</TableHead>
                <TableHead className="whitespace-nowrap">完成数量</TableHead>
                <TableHead className="whitespace-nowrap">效率达成率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsPaginated.map((s) => (
                <TableRow
                  key={s.process_name}
                  className={s.rate < 80 ? "bg-red-50" : ""}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {s.process_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.standard_hours.toFixed(2)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.actual_hours.toFixed(2)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.completed_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(s.rate, 100)}
                        className="h-2 w-20"
                      />
                      <span
                        className={`text-xs ${s.rate < 80 ? "text-destructive font-semibold" : ""}`}
                      >
                        {s.rate.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {stats.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="p-4 text-center text-muted-foreground"
                  >
                    暂无报工数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={statsCurrentPage}
            totalPages={statsTotalPages}
            pageSize={statsPageSize}
            totalItems={statsTotalItems}
            onPageChange={setStatsPage}
            onPageSizeChange={setStatsPageSize}
          />
        </CardContent>
      </Card>
      {bottleneck.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              瓶颈工序识别
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bottleneck.map((s) => (
              <div
                key={s.process_name}
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <div className="font-medium">
                  {s.process_name} · 效率达成率 {s.rate.toFixed(1)}%
                </div>
                <div className="mt-1 text-muted-foreground">
                  改善建议：增加设备、增加熟练人员、优化工艺参数
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KnowledgeTab({
  initialFilter,
}: {
  initialFilter?: { tag?: string; process?: string };
}) {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessKnowledge | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState(initialFilter?.tag || "全部");
  const [processFilter, setProcessFilter] = useState(
    initialFilter?.process || "全部",
  );

  const tags = Array.from(
    new Set(store.processKnowledge.flatMap((k) => k.tags)),
  );
  const processes = Array.from(
    new Set(store.processKnowledge.map((k) => k.process_name)),
  );

  const items = store.processKnowledge.filter((k) => {
    const matchSearch =
      !search ||
      k.title.includes(search) ||
      k.problem.includes(search) ||
      k.solution.includes(search);
    const matchTag = tagFilter === "全部" || k.tags.includes(tagFilter);
    const matchProcess =
      processFilter === "全部" || k.process_name === processFilter;
    return matchSearch && matchTag && matchProcess;
  });

  function removeKnowledge(k: ProcessKnowledge) {
    store.setProcessKnowledge(
      store.processKnowledge.filter((x) => x.id !== k.id),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索标题/问题/解决方案"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              {["全部", ...tags].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={processFilter} onValueChange={setProcessFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="工序" />
            </SelectTrigger>
            <SelectContent>
              {["全部", ...processes].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新增经验
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((k) => (
          <Card key={k.id}>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {k.title}
                  <span className="text-xs font-normal text-muted-foreground">
                    {k.code}
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {k.process_name} · {k.device} · {k.creator} · {formatBeijingTime(k.created_at)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(k);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeKnowledge(k)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {k.tags.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    问题：
                  </span>
                  {k.problem}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    方案：
                  </span>
                  {k.solution}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    效果：
                  </span>
                  {k.effect}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="p-6 text-center text-muted-foreground">
              暂无经验条目
            </CardContent>
          </Card>
        )}
      </div>
      <KnowledgeDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function KnowledgeDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProcessKnowledge | null;
}) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [form, setForm] = useState<Partial<ProcessKnowledge>>(() =>
    editing
      ? { ...editing }
      : {
          code: "",
          title: "",
          process_name: "",
          device: "",
          tags: [],
          problem: "",
          solution: "",
          effect: "",
          creator: currentUserName,
        },
  );

  function toggleTag(tag: string) {
    const tags = new Set(form.tags || []);
    if (tags.has(tag)) tags.delete(tag);
    else tags.add(tag);
    setForm((f) => ({ ...f, tags: Array.from(tags) }));
  }

  function save() {
    if (
      !form.code ||
      !form.title ||
      !form.process_name ||
      !form.problem ||
      !form.solution
    )
      return;
    const k: ProcessKnowledge = {
      id: editing?.id || nanoid(),
      code: form.code,
      title: form.title,
      process_name: form.process_name,
      device: form.device || "",
      tags: form.tags || [],
      problem: form.problem,
      solution: form.solution,
      effect: form.effect || "",
      creator: form.creator || currentUserName || "当前用户",
      created_at: editing?.created_at || now(),
      updated_at: now(),
    };
    if (editing) store.updateProcessKnowledge(k);
    else store.addProcessKnowledge(k);
    onClose();
    setForm({
      code: "",
      title: "",
      process_name: "",
      device: "",
      tags: [],
      problem: "",
      solution: "",
      effect: "",
      creator: currentUserName,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑经验条目" : "新增经验条目"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>条目编号</Label>
              <Input
                value={form.code || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                value={form.title || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>适用工序</Label>
              <Select
                value={form.process_name}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, process_name: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工序" />
                </SelectTrigger>
                <SelectContent>
                  {store.processes.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>适用设备</Label>
              <Input
                value={form.device || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, device: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex flex-wrap gap-2">
              {[
                "绗缝",
                "水洗",
                "整烫",
                "裁剪",
                "品质",
                "效率",
                "缩水率",
                "瓶颈",
              ].map((tag) => (
                <Badge
                  key={tag}
                  variant={
                    (form.tags || []).includes(tag) ? "default" : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>问题描述</Label>
            <Textarea
              value={form.problem || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, problem: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>解决方案</Label>
            <Textarea
              value={form.solution || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, solution: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>效果说明</Label>
            <Textarea
              value={form.effect || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, effect: e.target.value }))
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionDiffTab() {
  const store = useAppStore();
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const left = store.processVersions.find((v) => v.id === leftId);
  const right = store.processVersions.find((v) => v.id === rightId);
  const routeLeft = store.processRoutes.find((r) => r.id === left?.route_id);
  const routeRight = store.processRoutes.find((r) => r.id === right?.route_id);

  const stepDiff = useMemo(() => {
    if (!left || !right) return [];
    const a = routeLeft?.steps || [];
    const b = routeRight?.steps || [];
    const codes = Array.from(
      new Set([...a.map((s) => s.code), ...b.map((s) => s.code)]),
    );
    return codes.map((code) => {
      const sa = a.find((s) => s.code === code);
      const sb = b.find((s) => s.code === code);
      if (sa && !sb) return { code, type: "removed", left: sa, right: null };
      if (!sa && sb) return { code, type: "added", left: null, right: sb };
      const changed =
        sa?.name !== sb?.name ||
        sa?.hours !== sb?.hours ||
        sa?.device !== sb?.device ||
        sa?.skill !== sb?.skill ||
        sa?.price !== sb?.price ||
        sa?.seq !== sb?.seq;
      return {
        code,
        type: changed ? "changed" : "same",
        left: sa!,
        right: sb!,
      };
    });
  }, [left, right, routeLeft, routeRight]);

  const paramDiff = useMemo(() => {
    if (!left || !right) return [];
    const templatesLeft = store.processParamTemplates.filter(
      (t) =>
        t.process_name ===
        (routeLeft?.steps.some((s) => s.name === t.process_name)
          ? t.process_name
          : ""),
    );
    const templatesRight = store.processParamTemplates.filter(
      (t) =>
        t.process_name ===
        (routeRight?.steps.some((s) => s.name === t.process_name)
          ? t.process_name
          : ""),
    );
    const paramsA = templatesLeft.flatMap((t) =>
      t.params.map((p) => ({ ...p, process_name: t.process_name })),
    );
    const paramsB = templatesRight.flatMap((t) =>
      t.params.map((p) => ({ ...p, process_name: t.process_name })),
    );
    const keys = Array.from(
      new Set([
        ...paramsA.map((p) => `${p.process_name}-${p.name}`),
        ...paramsB.map((p) => `${p.process_name}-${p.name}`),
      ]),
    );
    return keys.map((key) => {
      const pa = paramsA.find((p) => `${p.process_name}-${p.name}` === key);
      const pb = paramsB.find((p) => `${p.process_name}-${p.name}` === key);
      if (pa && !pb) return { key, type: "removed", left: pa, right: null };
      if (!pa && pb) return { key, type: "added", left: null, right: pb };
      const changed =
        pa?.standard !== pb?.standard ||
        pa?.upper !== pb?.upper ||
        pa?.lower !== pb?.lower ||
        pa?.unit !== pb?.unit;
      return { key, type: changed ? "changed" : "same", left: pa!, right: pb! };
    });
  }, [left, right, routeLeft, routeRight, store.processParamTemplates]);

  function exportSummary() {
    if (!left || !right) return;
    const lines = [
      "工艺版本对比摘要",
      `版本A: ${left.code} / ${left.product_code} / ${left.route_name} / 生效 ${left.effective_date} ~ ${left.expiry_date}`,
      `版本B: ${right.code} / ${right.product_code} / ${right.route_name} / 生效 ${right.effective_date} ~ ${right.expiry_date}`,
      "",
      "工序清单差异",
      ...stepDiff.map(
        (d) =>
          `${diffText(d.type)} ${d.left?.name || d.right?.name} 工时:${d.left?.hours ?? "-"}→${d.right?.hours ?? "-"} 设备:${d.left?.device ?? "-"}→${d.right?.device ?? "-"}`,
      ),
      "",
      "工艺参数差异",
      ...paramDiff.map(
        (d) =>
          `${diffText(d.type)} ${d.left?.process_name || d.right?.process_name} ${d.left?.name || d.right?.name} 标准值:${d.left?.standard ?? "-"}→${d.right?.standard ?? "-"}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `版本对比_${left.code}_${right.code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const {
    paginatedItems: paramDiffPaginated,
    currentPage: paramDiffCurrentPage,
    pageSize: paramDiffPageSize,
    totalPages: paramDiffTotalPages,
    totalItems: paramDiffTotalItems,
    setPage: setParamDiffPage,
    setPageSize: setParamDiffPageSize,
  } = usePagination(paramDiff);

  const {
    paginatedItems: stepDiffPaginated,
    currentPage: stepDiffCurrentPage,
    pageSize: stepDiffPageSize,
    totalPages: stepDiffTotalPages,
    totalItems: stepDiffTotalItems,
    setPage: setStepDiffPage,
    setPageSize: setStepDiffPageSize,
  } = usePagination(stepDiff);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            选择版本进行对比
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Select value={leftId} onValueChange={setLeftId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择版本 A" />
            </SelectTrigger>
            <SelectContent>
              {store.processVersions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code} · {v.product_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rightId} onValueChange={setRightId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择版本 B" />
            </SelectTrigger>
            <SelectContent>
              {store.processVersions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code} · {v.product_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!left || !right || left.product_id !== right.product_id}
            onClick={exportSummary}
          >
            <FileText className="mr-1 h-4 w-4" />
            导出摘要
          </Button>
        </CardContent>
      </Card>
      {left && right && left.product_id !== right.product_id && (
        <div className="text-sm text-destructive">
          请选择同一产品的两个版本进行对比
        </div>
      )}
      {left && right && left.product_id === right.product_id && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">版本基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">版本A: {left.code}</div>
                  <div className="text-muted-foreground">
                    {left.route_name} · {left.effective_date} ~{" "}
                    {left.expiry_date}
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">版本B: {right.code}</div>
                  <div className="text-muted-foreground">
                    {right.route_name} · {right.effective_date} ~{" "}
                    {right.expiry_date}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">工序清单差异</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">差异</TableHead>
                    <TableHead className="whitespace-nowrap">
                      版本A 工序
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      版本A 工时/设备/技能
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      版本B 工序
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      版本B 工时/设备/技能
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stepDiffPaginated.map((d) => (
                    <TableRow
                      key={d.code}
                      className={
                        d.type === "added"
                          ? "bg-green-50"
                          : d.type === "removed"
                            ? "bg-red-50"
                            : d.type === "changed"
                              ? "bg-yellow-50"
                              : ""
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">{diffText(d.type)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.left ? `${d.left.seq}.${d.left.name}` : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.left
                          ? `${d.left.hours}h / ${d.left.device} / ${d.left.skill}`
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.right ? `${d.right.seq}.${d.right.name}` : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.right
                          ? `${d.right.hours}h / ${d.right.device} / ${d.right.skill}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={stepDiffCurrentPage}
                totalPages={stepDiffTotalPages}
                pageSize={stepDiffPageSize}
                totalItems={stepDiffTotalItems}
                onPageChange={setStepDiffPage}
                onPageSizeChange={setStepDiffPageSize}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">工艺参数差异</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">差异</TableHead>
                    <TableHead className="whitespace-nowrap">工序</TableHead>
                    <TableHead className="whitespace-nowrap">参数</TableHead>
                    <TableHead className="whitespace-nowrap">版本A</TableHead>
                    <TableHead className="whitespace-nowrap">版本B</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paramDiffPaginated.map((d) => (
                    <TableRow
                      key={d.key}
                      className={
                        d.type === "added"
                          ? "bg-green-50"
                          : d.type === "removed"
                            ? "bg-red-50"
                            : d.type === "changed"
                              ? "bg-yellow-50"
                              : ""
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">{diffText(d.type)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.left?.process_name || d.right?.process_name || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.left?.name || d.right?.name || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.left
                          ? `${d.left.standard} (${d.left.lower}~${d.left.upper}${d.left.unit})`
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.right
                          ? `${d.right.standard} (${d.right.lower}~${d.right.upper}${d.right.unit})`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={paramDiffCurrentPage}
                totalPages={paramDiffTotalPages}
                pageSize={paramDiffPageSize}
                totalItems={paramDiffTotalItems}
                onPageChange={setParamDiffPage}
                onPageSizeChange={setParamDiffPageSize}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function diffText(type: string) {
  if (type === "added") return "新增";
  if (type === "removed") return "删除";
  if (type === "changed") return "变更";
  return "相同";
}

function now() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}
