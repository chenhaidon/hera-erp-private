import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  ShieldCheck,
  Search,
  BookOpen,
  FlaskConical,
  PackageCheck,
  GitBranch,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  X,
  Wand2,
  Eye,
} from "lucide-react";
import { nanoid, formatBeijingTime, formatBeijingDate, beijingNow } from "@/lib/utils";

function sortByCreatedDesc<T extends { created_at?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

function useCurrentUserName() {
  const { profile, user } = useAuth();
  return profile?.full_name || profile?.username || user?.email?.split("@")[0] || "";
}

function useInspectorUsers() {
  const store = useAppStore();
  return useMemo(() => {
    return store.employees.filter(
      (e) => e.status === "active" && e.department === "生产部",
    );
  }, [store.employees]);
}

function defaultInspector(currentUserName: string, inspectors: { name: string }[]) {
  const match = inspectors.find((u) => u.name === currentUserName);
  return match ? currentUserName : inspectors[0]?.name || "";
}

function clampQuantity(value: number, max: number) {
  return Math.max(0, Math.min(value, max));
}

function updateQuantities<F extends { check_qty?: number; qualified_qty?: number; unqualified_qty?: number }>(
  form: F,
  field: "qualified_qty" | "unqualified_qty",
  value: number,
) {
  const check = clampQuantity(Number(form.check_qty) || 0, Infinity);
  const otherField = field === "qualified_qty" ? "unqualified_qty" : "qualified_qty";
  const otherValue = clampQuantity(Number(form[otherField]) || 0, Infinity);
  const clamped = clampQuantity(value, check);
  const total = clamped + otherValue;
  if (total > check) {
    return { ...form, [field]: clamped, [otherField]: check - clamped };
  }
  return { ...form, [field]: clamped };
}

function validateQuantities(check: number, qualified: number, unqualified: number) {
  if (qualified > check) return "合格数量不能超过检验数量";
  if (unqualified > check) return "不合格数量不能超过检验数量";
  if (qualified + unqualified > check) return "合格数量与不合格数量之和不能超过检验数量";
  return null;
}

function evaluateItem(item: QualityInspectionItem): QualityInspectionItem["result"] {
  if (item.actual === undefined) return "pending";
  return item.actual >= item.lower && item.actual <= item.upper ? "qualified" : "unqualified";
}

function buildFinishedItems(
  standards: QualityStandard[],
  product?: { category?: string },
): QualityInspectionItem[] {
  const standard =
    standards.find(
      (s) => s.status === "active" && product?.category && s.category === product.category,
    ) ||
    standards.find((s) => s.status === "active");
  return (standard?.items || []).map((si) => ({
    ...si,
    actual: undefined,
    result: "pending" as const,
  }));
}

function hasPendingItem(items: QualityInspectionItem[]) {
  return items.some((i) => i.result === "pending");
}

function deriveResultFromItems(items: QualityInspectionItem[]): Exclude<FinishedInspection["result"], undefined> {
  if (!items.length) return "qualified";
  if (items.some((i) => i.result === "unqualified")) return "unqualified";
  return "qualified";
}

import {
  unlockNextOperation,
  recalcWorkOrderFromOperations,
  createFinishedGoodsInbound,
  createPendingFinishedInspection,
  isFinishedInspectionQualified,
} from "@/lib/production";
import type {
  QualityStandard,
  QualityStandardItem,
  MaterialInspection,
  ProcessInspection,
  ProcessInspectionStandard,
  FinishedInspection,
  QualityInspectionItem,
} from "@/types";

// 扩展 QualityInspectionItem，用于表单编辑时保持可空结果
interface EditableInspectionItem extends QualityInspectionItem {
  category?: "chemical" | "physical" | "appearance";
}

const TABS = [
  { value: "standards", label: "质检标准库", icon: BookOpen },
  { value: "incoming", label: "来料检验", icon: ShieldCheck },
  { value: "process", label: "过程巡检", icon: FlaskConical },
  { value: "finished", label: "成品检验", icon: PackageCheck },
  { value: "trace", label: "质量追溯", icon: GitBranch },
];

/* ─── 产品质检标准 ──────────────────────────────────────────── */

interface ProductStandardsSectionProps {
  search: string;
  setSearch: (v: string) => void;
  filterCat: string;
  setFilterCat: (v: string) => void;
}

function ProductStandardsSection({
  search,
  setSearch,
  filterCat,
  setFilterCat,
}: ProductStandardsSectionProps) {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QualityStandard | null>(null);
  const [form, setForm] = useState<Partial<QualityStandard>>({
    name: "",
    category: "",
    status: "active",
    items: [],
  });
  const [standardItems, setStandardItems] = useState<QualityStandardItem[]>([]);

  const filtered = store.qualityStandards.filter((s) => {
    const matchSearch =
      !search || s.code.includes(search) || s.name.includes(search);
    const matchCat = filterCat === "全部" || s.category === filterCat;
    return matchSearch && matchCat;
  });

  function openNew() {
    setEditing(null);
    const defaultItems: QualityStandardItem[] = [
      {
        name: "纤维含量",
        standard: 100,
        lower: 95,
        upper: 100,
        unit: "%",
        category: "physical",
      },
      {
        name: "pH值",
        standard: 6.5,
        lower: 4.0,
        upper: 8.5,
        unit: "",
        category: "chemical",
      },
      {
        name: "甲醛限值",
        standard: 20,
        lower: 0,
        upper: 75,
        unit: "mg/kg",
        category: "chemical",
      },
      {
        name: "水洗尺寸变化率",
        standard: -3,
        lower: -5,
        upper: 0,
        unit: "%",
        category: "physical",
      },
      {
        name: "色牢度",
        standard: 3,
        lower: 3,
        upper: 5,
        unit: "级",
        category: "physical",
      },
      {
        name: "绗缝针距密度",
        standard: 7,
        lower: 6,
        upper: 8,
        unit: "针/3cm",
        category: "appearance",
      },
      {
        name: "花型对称度",
        standard: 2,
        lower: 0,
        upper: 3,
        unit: "mm",
        category: "appearance",
      },
      {
        name: "平整度",
        standard: 1.5,
        lower: 0,
        upper: 3,
        unit: "级",
        category: "appearance",
      },
    ];
    setStandardItems(defaultItems);
    setForm({ name: "", category: "绗缝被", status: "active", items: [] });
    setOpen(true);
  }

  function openEdit(s: QualityStandard) {
    setEditing(s);
    setStandardItems([...s.items]);
    setForm({ ...s });
    setOpen(true);
  }

  function save() {
    if (!form.name || !form.category) return;
    const std: QualityStandard = {
      id: editing?.id || nanoid(),
      code: editing?.code || `QS-${Date.now().toString().slice(-6)}`,
      name: form.name,
      category: form.category,
      status: (form.status as QualityStandard["status"]) || "active",
      items: standardItems,
    };
    if (editing)
      store.setQualityStandards(
        store.qualityStandards.map((s) => (s.id === std.id ? std : s)),
      );
    else store.setQualityStandards([...store.qualityStandards, std]);
    setOpen(false);
  }

  function remove(id: string) {
    store.setQualityStandards(
      store.qualityStandards.filter((s) => s.id !== id),
    );
  }

  function updateItem(
    idx: number,
    field: keyof QualityStandardItem,
    value: string | number,
  ) {
    setStandardItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }

  function removeItem(idx: number) {
    setStandardItems((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }

  const categories = ["绗缝被", "四件套", "枕垫", "毛毯", "窗帘"];

  const {
    paginatedItems: standardItemsPaginated,
    currentPage: standardItemsCurrentPage,
    pageSize: standardItemsPageSize,
    totalPages: standardItemsTotalPages,
    totalItems: standardItemsTotalItems,
    startItem: standardItemsStartItem,
    setPage: setStandardItemsPage,
    setPageSize: setStandardItemsPageSize,
  } = usePagination(standardItems);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索编号/名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-56"
          />
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["全部", ...categories].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          新建标准
        </Button>
      </div>
      {filtered.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {s.code} · {s.name}
              </CardTitle>
              <div className="flex gap-2">
                <Badge
                  variant={s.status === "active" ? "default" : "secondary"}
                >
                  {s.status === "active" ? "启用" : "停用"}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                  <BookOpen className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">适用：{s.category}</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">检验项目</TableHead>
                  <TableHead className="whitespace-nowrap">标准值</TableHead>
                  <TableHead className="whitespace-nowrap">下限</TableHead>
                  <TableHead className="whitespace-nowrap">上限</TableHead>
                  <TableHead className="whitespace-nowrap">单位</TableHead>
                  <TableHead className="whitespace-nowrap">类别</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s.items || []).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {item.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.standard}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.lower}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.upper}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.unit || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline">
                        {item.category === "chemical"
                          ? "化学"
                          : item.category === "physical"
                            ? "物理"
                            : "外观"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "编辑质检标准" : "新建质检标准"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>标准名称</Label>
                <Input
                  value={form.name || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>适用产品类别</Label>
                <Select
                  value={form.category || "绗缝被"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={form.status || "active"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as QualityStandard["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm font-medium">检验项目</div>
            <div className="space-y-2 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">
                      项目名称
                    </TableHead>
                    <TableHead className="whitespace-nowrap">标准值</TableHead>
                    <TableHead className="whitespace-nowrap">下限</TableHead>
                    <TableHead className="whitespace-nowrap">上限</TableHead>
                    <TableHead className="whitespace-nowrap">单位</TableHead>
                    <TableHead className="whitespace-nowrap">类别</TableHead>
                    <TableHead className="whitespace-nowrap w-16">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardItemsPaginated.map((item, i) => {
                    const actualIdx = standardItemsStartItem - 1 + i;
                    return (
                      <TableRow key={actualIdx}>
                        <TableCell>
                          <Input
                            className="h-8 min-w-24 px-2"
                            value={item.name}
                            onChange={(e) =>
                              updateItem(actualIdx, "name", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-20 px-2"
                            type="number"
                            value={item.standard}
                            onChange={(e) =>
                              updateItem(actualIdx, "standard", Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-20 px-2"
                            type="number"
                            value={item.lower}
                            onChange={(e) =>
                              updateItem(actualIdx, "lower", Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-20 px-2"
                            type="number"
                            value={item.upper}
                            onChange={(e) =>
                              updateItem(actualIdx, "upper", Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-20 px-2"
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(actualIdx, "unit", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.category}
                            onValueChange={(v) => updateItem(actualIdx, "category", v)}
                          >
                            <SelectTrigger className="h-8 w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="chemical">化学</SelectItem>
                              <SelectItem value="physical">物理</SelectItem>
                              <SelectItem value="appearance">外观</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeItem(actualIdx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                currentPage={standardItemsCurrentPage}
                totalPages={standardItemsTotalPages}
                pageSize={standardItemsPageSize}
                totalItems={standardItemsTotalItems}
                onPageChange={setStandardItemsPage}
                onPageSizeChange={setStandardItemsPageSize}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setStandardItems((p) => [
                    ...p,
                    {
                      name: "",
                      standard: 0,
                      lower: 0,
                      upper: 0,
                      unit: "",
                      category: "physical",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                添加项目
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── 工序检验标准 ──────────────────────────────────────────── */

function ProcessInspectionStandardsSection() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessInspectionStandard | null>(null);
  const [form, setForm] = useState<Partial<ProcessInspectionStandard>>({
    process_id: "",
    process_name: "",
    status: "active",
    items: [],
  });
  const [items, setItems] = useState<EditableInspectionItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("全部");

  const filtered = sortByCreatedDesc(
    store.processInspectionStandards.filter((s) => {
      const matchSearch =
        !search ||
        s.code.includes(search) ||
        s.process_name.includes(search) ||
        (s.process_code && s.process_code.includes(search));
      const matchStatus = filterStatus === "全部" || s.status === filterStatus;
      return matchSearch && matchStatus;
    }),
  );

  const {
    paginatedItems: paginated,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(filtered);

  function openNew() {
    setEditing(null);
    setForm({ process_id: "", process_name: "", status: "active", items: [] });
    setItems([
      {
        name: "",
        standard: 0,
        lower: 0,
        upper: 0,
        unit: "",
        category: "physical",
      } as EditableInspectionItem,
    ]);
    setOpen(true);
  }

  function openEdit(s: ProcessInspectionStandard) {
    setEditing(s);
    setForm({ ...s });
    setItems(
      (s.items || []).map((i) => ({
        ...i,
        result: i.result || "pending",
      })) as EditableInspectionItem[],
    );
    setOpen(true);
  }

  function save() {
    if (!form.process_id || !form.process_name) return;
    const std: ProcessInspectionStandard = {
      id: editing?.id || nanoid(),
      code: editing?.code || `PIS-${Date.now().toString().slice(-6)}`,
      process_id: form.process_id,
      process_name: form.process_name,
      process_code: form.process_code,
      status: (form.status as ProcessInspectionStandard["status"]) || "active",
      items: items.map((i) => ({
        name: i.name,
        standard: i.standard,
        lower: i.lower,
        upper: i.upper,
        unit: i.unit,
        category: i.category,
        result: 'pending',
      })),
      created_at: editing?.created_at || new Date().toISOString().slice(0, 16).replace("T", " "),
      updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    if (editing) {
      store.updateProcessInspectionStandard(std);
    } else {
      store.addProcessInspectionStandard(std);
    }
    setOpen(false);
  }

  function remove(id: string) {
    store.deleteProcessInspectionStandard(id);
  }

  function updateItem(
    idx: number,
    field: keyof EditableInspectionItem,
    value: string | number,
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }

  function addItem() {
    setItems((p) => [
      ...p,
      {
        name: "",
        standard: 0,
        lower: 0,
        upper: 0,
        unit: "",
        category: "physical",
      } as EditableInspectionItem,
    ]);
  }

  function removeItem(idx: number) {
    setItems((p) => p.filter((_, i) => i !== idx));
  }

  const activeProcesses = store.processes.filter((p) => p.status === "active");

  function buildDefaultItems(processName: string): QualityInspectionItem[] {
    const name = processName.toLowerCase();
    if (name.includes("裁剪") || name.includes("开料") || name.includes("剪边")) {
      return [
        { name: "裁片尺寸偏差", standard: 0, lower: -2, upper: 2, unit: "mm", category: "physical", result: "pending" },
        { name: "铺布层数", standard: 25, lower: 20, upper: 30, unit: "层", category: "physical", result: "pending" },
        { name: "裁刀转速", standard: 2800, lower: 2600, upper: 3000, unit: "rpm", category: "physical", result: "pending" },
      ];
    }
    if (name.includes("缝制") || name.includes("绗缝") || name.includes("拼接") || name.includes("包边") || name.includes("卷边") || name.includes("打褶")) {
      return [
        { name: "针距", standard: 3, lower: 2.5, upper: 3.5, unit: "mm", category: "physical", result: "pending" },
        { name: "线张力", standard: 250, lower: 200, upper: 300, unit: "g", category: "physical", result: "pending" },
        { name: "缝速", standard: 3000, lower: 2800, upper: 3200, unit: "rpm", category: "physical", result: "pending" },
        { name: "线迹外观", standard: 1, lower: 1, upper: 1, unit: "级", category: "appearance", result: "pending" },
      ];
    }
    if (name.includes("检验") || name.includes("初检") || name.includes("复检")) {
      return [
        { name: "疵点数量", standard: 0, lower: 0, upper: 2, unit: "处", category: "appearance", result: "pending" },
        { name: "色差等级", standard: 4, lower: 3, upper: 5, unit: "级", category: "appearance", result: "pending" },
        { name: "检验照度", standard: 800, lower: 700, upper: 900, unit: "lux", category: "physical", result: "pending" },
      ];
    }
    if (name.includes("包装")) {
      return [
        { name: "真空度", standard: 0.08, lower: 0.07, upper: 0.09, unit: "MPa", category: "physical", result: "pending" },
        { name: "包装袋厚度", standard: 0.08, lower: 0.07, upper: 0.1, unit: "mm", category: "physical", result: "pending" },
        { name: "封口外观", standard: 1, lower: 1, upper: 1, unit: "级", category: "appearance", result: "pending" },
      ];
    }
    if (name.includes("水洗") || name.includes("整烫")) {
      return [
        { name: "水洗尺寸变化率", standard: -3, lower: -5, upper: 0, unit: "%", category: "physical", result: "pending" },
        { name: "温度", standard: 45, lower: 40, upper: 50, unit: "℃", category: "physical", result: "pending" },
        { name: "外观平整度", standard: 1, lower: 1, upper: 1, unit: "级", category: "appearance", result: "pending" },
      ];
    }
    if (name.includes("充棉") || name.includes("上松紧")) {
      return [
        { name: "充棉量", standard: 450, lower: 400, upper: 500, unit: "g", category: "physical", result: "pending" },
        { name: "气压", standard: 0.5, lower: 0.4, upper: 0.6, unit: "MPa", category: "physical", result: "pending" },
        { name: "克重偏差", standard: 0, lower: -5, upper: 5, unit: "%", category: "physical", result: "pending" },
      ];
    }
    // 通用默认
    return [
      { name: "尺寸偏差", standard: 0, lower: -2, upper: 2, unit: "mm", category: "physical", result: "pending" },
      { name: "外观缺陷", standard: 0, lower: 0, upper: 1, unit: "处", category: "appearance", result: "pending" },
      { name: "作业一致性", standard: 1, lower: 1, upper: 1, unit: "级", category: "appearance", result: "pending" },
    ];
  }

  const generateStandards = useCallback(async () => {
    const existingProcessIds = new Set(
      store.processInspectionStandards.map((s) => s.process_id),
    );
    const targets = activeProcesses.filter((p) => !existingProcessIds.has(p.id));
    if (targets.length === 0) {
      toast.info("所有启用工序已存在检验标准");
      return;
    }

    const now = beijingNow();
    let created = 0;
    for (const p of targets) {
      const template = store.processParamTemplates.find(
        (t) => t.process_name === p.name && t.status === "active",
      );
      const items: QualityInspectionItem[] = template
        ? template.params.map((param) => ({
            name: param.name,
            standard: param.standard,
            lower: param.lower,
            upper: param.upper,
            unit: param.unit,
            category: "physical",
            result: "pending",
          }))
        : buildDefaultItems(p.name);

      const std: ProcessInspectionStandard = {
        id: nanoid(),
        code: `PIS-${Date.now().toString().slice(-6)}-${created + 1}`,
        process_id: p.id,
        process_name: p.name,
        process_code: p.code,
        status: "active",
        items,
        created_at: now,
        updated_at: now,
      };
      await store.addProcessInspectionStandard(std);
      created++;
    }
    toast.success(`已生成 ${created} 条工序检验标准`);
  }, [store, activeProcesses]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索编号/工序名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-56"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["全部", "active", "inactive"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "全部" ? "全部" : s === "active" ? "启用" : "停用"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateStandards}>
            <Wand2 className="mr-1 h-4 w-4" />
            生成工序标准
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            新增工序标准
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">标准编号</TableHead>
                <TableHead className="whitespace-nowrap">工序名称</TableHead>
                <TableHead className="whitespace-nowrap">工序编号</TableHead>
                <TableHead className="whitespace-nowrap">检验项目数</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">更新时间</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {s.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.process_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.process_code || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(s.items || []).length}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {s.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBeijingTime(s.updated_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    暂无工序检验标准
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "编辑工序检验标准" : "新增工序检验标准"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>工序名称</Label>
                <Select
                  value={form.process_id || ""}
                  onValueChange={(v) => {
                    const p = store.processes.find((x) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      process_id: v,
                      process_name: p?.name || "",
                      process_code: p?.code || "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工序" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProcesses.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={form.status || "active"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as ProcessInspectionStandard["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm font-medium">检验项目</div>
            <div className="space-y-2 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">项目名称</TableHead>
                    <TableHead className="whitespace-nowrap">标准值</TableHead>
                    <TableHead className="whitespace-nowrap">下限</TableHead>
                    <TableHead className="whitespace-nowrap">上限</TableHead>
                    <TableHead className="whitespace-nowrap">单位</TableHead>
                    <TableHead className="whitespace-nowrap">类别</TableHead>
                    <TableHead className="whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          className="h-8 min-w-24 px-2"
                          value={item.name}
                          onChange={(e) => updateItem(i, "name", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20 px-2"
                          type="number"
                          value={item.standard}
                          onChange={(e) =>
                            updateItem(i, "standard", Number(e.target.value))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20 px-2"
                          type="number"
                          value={item.lower}
                          onChange={(e) =>
                            updateItem(i, "lower", Number(e.target.value))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20 px-2"
                          type="number"
                          value={item.upper}
                          onChange={(e) =>
                            updateItem(i, "upper", Number(e.target.value))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20 px-2"
                          value={item.unit}
                          onChange={(e) => updateItem(i, "unit", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.category}
                          onValueChange={(v) => updateItem(i, "category", v)}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chemical">化学</SelectItem>
                            <SelectItem value="physical">物理</SelectItem>
                            <SelectItem value="appearance">外观</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeItem(i)}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-4 w-4" />
                添加项目
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── 质检标准库 ──────────────────────────────────────────── */

function StandardsTab() {
  const [filterCat, setFilterCat] = useState("全部");
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <Tabs defaultValue="product" className="w-full">
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          <TabsTrigger value="product">产品质检标准</TabsTrigger>
          <TabsTrigger value="process">工序检验标准</TabsTrigger>
        </TabsList>
        <TabsContent value="product">
          <ProductStandardsSection
            search={search}
            setSearch={setSearch}
            filterCat={filterCat}
            setFilterCat={setFilterCat}
          />
        </TabsContent>
        <TabsContent value="process">
          <ProcessInspectionStandardsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── 来料检验 ──────────────────────────────────────────── */

function IncomingTab() {
  const store = useAppStore();
  const navigate = useNavigate();
  const currentUserName = useCurrentUserName();
  const inspectorUsers = useInspectorUsers();
  const [searchParams, setSearchParams] = useSearchParams();
  const arrivalCode = searchParams.get("arrivalCode") || "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<MaterialInspection>>({
    category: "面料",
    result: "qualified",
    status: "pending",
    items: [],
    inspector: defaultInspector(currentUserName, inspectorUsers),
  });
  const [filterResult, setFilterResult] = useState("全部");
  const [search, setSearch] = useState(arrivalCode);
  const [detail, setDetail] = useState<MaterialInspection | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (arrivalCode) {
      setSearch(arrivalCode);
    }
  }, [arrivalCode]);

  const filtered = sortByCreatedDesc(
    store.materialInspections.filter((m) => {
      const matchSearch =
        !search ||
        m.code.includes(search) ||
        m.material_name.includes(search) ||
        (m.color && m.color.includes(search)) ||
        (m.contract_no && m.contract_no.includes(search)) ||
        (m.arrival_code && m.arrival_code.includes(search));
      const matchResult = filterResult === "全部" || m.result === filterResult;
      return matchSearch && matchResult;
    }),
  );

  function buildItems(standard?: QualityStandard): QualityInspectionItem[] {
    return (standard?.items || []).map((si) => ({
      name: si.name,
      standard: si.standard,
      upper: si.upper,
      lower: si.lower,
      unit: si.unit,
      actual: undefined,
      result: "pending",
    }));
  }

  function save() {
    if (!form.material_name) return;
    const error = validateQuantities(
      Number(form.check_qty) || 0,
      Number(form.qualified_qty) || 0,
      Number(form.unqualified_qty) || 0,
    );
    if (error) {
      toast.error(error);
      return;
    }
    const allItems = (form.items || []).map((item) => {
      if (item.actual === undefined) return item;
      const pass = item.actual >= item.lower && item.actual <= item.upper;
      return {
        ...item,
        result: (pass
          ? "qualified"
          : "unqualified") as QualityInspectionItem["result"],
      };
    });
    const hasUnqualified = allItems.some((i) => i.result === "unqualified");
    const hasQualified = allItems.some((i) => i.result === "qualified");
    const result: MaterialInspection["result"] = hasUnqualified
      ? hasQualified
        ? "partial"
        : "unqualified"
      : "qualified";
    const record: MaterialInspection = {
      id: nanoid(),
      code: `MI-${Date.now().toString().slice(-6)}`,
      material_id: "",
      material_name: form.material_name || "",
      color: form.color || "",
      category: form.category || "面料",
      supplier: form.supplier || "",
      contract_no: form.contract_no || "",
      batch: form.batch || `B${Date.now().toString().slice(-8)}`,
      arrival_qty: Number(form.arrival_qty) || 0,
      check_qty: Number(form.check_qty) || 0,
      qualified_qty: Number(form.qualified_qty) || 0,
      unqualified_qty: Number(form.unqualified_qty) || 0,
      result,
      status: "inspected",
      inspector: form.inspector || defaultInspector(currentUserName, inspectorUsers) || "质检员",
      created_at: form.created_at || beijingNow(),
      items: allItems,
      defect_reason: form.defect_reason || "",
    };
    store.addMaterialInspection(record);
    if (
      (result === "qualified" || result === "partial") &&
      record.material_id &&
      record.qualified_qty > 0
    ) {
      const inv = store.inventory.find(
        (i) => i.material_id === record.material_id,
      );
      if (inv) {
        store.setInventory(
          store.inventory.map((i) =>
            i.material_id === record.material_id
              ? { ...i, quantity: i.quantity + record.qualified_qty }
              : i,
          ),
        );
      } else {
        store.setInventory([
          ...store.inventory,
          {
            id: nanoid(),
            type: "material",
            material_id: record.material_id,
            quantity: record.qualified_qty,
            min_stock: 100,
            max_stock: 5000,
            warehouse: "原料仓",
          },
        ]);
      }
      store.addStockRecord({
        id: nanoid(),
        record_no: `GR-${Date.now().toString().slice(-6)}`,
        type: "in",
        subtype: "采购入库",
        material_id: record.material_id,
        quantity: record.qualified_qty,
        warehouse: "原料仓",
        related_order: record.purchase_order_no || record.code,
        related_order_id: record.purchase_order_id || record.id,
        handler: record.inspector,
        record_date: record.created_at,
      });
    }
    if (result === "unqualified" || result === "partial") {
      store.addProductionException({
        id: nanoid(),
        code: `EX-${Date.now().toString().slice(-6)}`,
        work_id: "",
        work_no: "-",
        operation_name: "来料检验",
        type: "物料缺料",
        description: `${result === "partial" ? "部分" : ""}来料不合格：${record.material_name} 批次 ${record.batch}，${record.defect_reason || ""}`,
        submitter: record.inspector,
        created_at: beijingNow(),
        status: "pending",
      });
    }
    setOpen(false);
  }

  function clearArrivalFilter() {
    setSearch("");
    searchParams.delete("arrivalCode");
    setSearchParams(searchParams);
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
      {arrivalCode && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            <span>
              正在查看到货单 <span className="font-medium">{arrivalCode}</span>{" "}
              的来料检验记录
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/purchase?tab=arrival")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回到货入库
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearArrivalFilter}
              title="清除筛选"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索检验单/物料/颜色/合同编号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-56"
          />
          <Select value={filterResult} onValueChange={setFilterResult}>
            <SelectTrigger className="w-full md:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["全部", "qualified", "partial", "unqualified"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "全部"
                    ? "全部"
                    : r === "qualified"
                      ? "合格"
                      : r === "partial"
                        ? "部分合格"
                        : "不合格"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm({
              category: "面料",
              result: "qualified",
              status: "pending",
              items: buildItems(store.qualityStandards[0]),
              inspector: defaultInspector(currentUserName, inspectorUsers),
            });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新增来料检验
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">检验单号</TableHead>
                <TableHead className="whitespace-nowrap">物料名称</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">类别</TableHead>
                <TableHead className="whitespace-nowrap">供应商</TableHead>
                <TableHead className="whitespace-nowrap">批次</TableHead>
                <TableHead className="whitespace-nowrap">到货/检验</TableHead>
                <TableHead className="whitespace-nowrap">合格/不合格</TableHead>
                <TableHead className="whitespace-nowrap">判定</TableHead>
                <TableHead className="whitespace-nowrap">检验人</TableHead>
                <TableHead className="whitespace-nowrap">时间</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((m) => (
                <TableRow
                  key={m.id}
                  className={
                    m.result === "unqualified"
                      ? "bg-destructive/5"
                      : m.result === "partial"
                        ? "bg-secondary/5"
                        : ""
                  }
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {m.contract_no || "-"}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {m.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.material_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.color || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.category}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.supplier || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{m.batch}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.arrival_qty}/{m.check_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.qualified_qty}/{m.unqualified_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        m.result === "qualified"
                          ? "default"
                          : m.result === "partial"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {m.result === "qualified"
                        ? "合格"
                        : m.result === "partial"
                          ? "部分合格"
                          : "不合格"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.inspector}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBeijingDate(m.created_at)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDetail(m);
                        setDetailOpen(true);
                      }}
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-muted-foreground"
                  >
                    暂无来料检验记录
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增来料检验</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>物料</Label>
                <Select
                  value={form.material_id || "none"}
                  onValueChange={(v) => {
                    const m = store.materials.find((x) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      material_id: m?.id || "",
                      material_name: m?.name || "",
                      category: m?.category || "面料",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择物料" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">选择物料</SelectItem>
                    {store.materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>物料类别</Label>
                <Select
                  value={form.category || "面料"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["面料", "里料", "填充物", "辅料"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>颜色</Label>
                <Input
                  value={form.color || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  placeholder="选填"
                />
              </div>
              <div className="space-y-2">
                <Label>供应商</Label>
                <Select
                  value={form.supplier_id || "none"}
                  onValueChange={(v) => {
                    const s = store.suppliers.find((x) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      supplier_id: s?.id || "",
                      supplier: s?.name || "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">选择供应商</SelectItem>
                    {store.suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联采购订单</Label>
                <Select
                  value={form.purchase_order_id || "none"}
                  onValueChange={(v) => {
                    const o = store.purchaseOrders.find((x) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      purchase_order_id: o?.id || "",
                      purchase_order_no: o?.order_no || "",
                      contract_no: o?.contract_no || f.contract_no,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择采购订单" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联</SelectItem>
                    {store.purchaseOrders
                      .filter(
                        (o) =>
                          !form.supplier_id ||
                          o.supplier_id === form.supplier_id,
                      )
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_no} · {o.supplier_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>合同编号</Label>
                <Input
                  value={form.contract_no || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contract_no: e.target.value }))
                  }
                  placeholder="不关联可留空"
                />
              </div>
              <div className="space-y-2">
                <Label>到货批次</Label>
                <Input
                  value={form.batch || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, batch: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>到货数量</Label>
                <Input
                  type="number"
                  value={form.arrival_qty || 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      arrival_qty: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>检验数量</Label>
                <Input
                  type="number"
                  value={form.check_qty || 0}
                  onChange={(e) => {
                    const check = clampQuantity(Number(e.target.value), Infinity);
                    setForm((f) => ({
                      ...f,
                      check_qty: check,
                      qualified_qty: clampQuantity(f.qualified_qty || 0, check),
                      unqualified_qty: clampQuantity(
                        f.unqualified_qty || 0,
                        check - clampQuantity(f.qualified_qty || 0, check),
                      ),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>合格数量</Label>
                <Input
                  type="number"
                  value={form.qualified_qty || 0}
                  onChange={(e) =>
                    setForm((f) =>
                      updateQuantities(f, "qualified_qty", Number(e.target.value)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>不合格数量</Label>
                <Input
                  type="number"
                  value={form.unqualified_qty || 0}
                  onChange={(e) =>
                    setForm((f) =>
                      updateQuantities(f, "unqualified_qty", Number(e.target.value)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>不合格原因</Label>
                <Input
                  value={form.defect_reason || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, defect_reason: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>检验人</Label>
                <Select
                  value={form.inspector || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, inspector: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择检验人" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectorUsers.length === 0 && (
                      <SelectItem value="_empty" disabled>
                        暂无质检员用户
                      </SelectItem>
                    )}
                    {inspectorUsers.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>提交</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>来料检验详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">检验单号</Label>
                  <div className="font-medium">{detail.code}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">合同编号</Label>
                  <div className="font-medium">{detail.contract_no || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">物料名称</Label>
                  <div className="font-medium">{detail.material_name}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">颜色</Label>
                  <div className="font-medium">{detail.color || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">类别</Label>
                  <div className="font-medium">{detail.category}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">供应商</Label>
                  <div className="font-medium">{detail.supplier || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">批次</Label>
                  <div className="font-medium">{detail.batch}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">到货/检验数量</Label>
                  <div className="font-medium">
                    {detail.arrival_qty}/{detail.check_qty}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">合格/不合格</Label>
                  <div className="font-medium">
                    {detail.qualified_qty}/{detail.unqualified_qty}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">判定结果</Label>
                  <div>
                    <Badge
                      variant={
                        detail.result === "qualified"
                          ? "default"
                          : detail.result === "partial"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {detail.result === "qualified"
                        ? "合格"
                        : detail.result === "partial"
                          ? "部分合格"
                          : "不合格"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">检验人</Label>
                  <div className="font-medium">{detail.inspector}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">时间</Label>
                  <div className="font-medium">
                    {formatBeijingDate(detail.created_at)}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-muted-foreground">不合格原因</Label>
                  <div className="font-medium">{detail.defect_reason || "-"}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>检验项明细</Label>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">项目</TableHead>
                        <TableHead className="whitespace-nowrap">标准</TableHead>
                        <TableHead className="whitespace-nowrap">上限</TableHead>
                        <TableHead className="whitespace-nowrap">下限</TableHead>
                        <TableHead className="whitespace-nowrap">单位</TableHead>
                        <TableHead className="whitespace-nowrap">实测值</TableHead>
                        <TableHead className="whitespace-nowrap">结果</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.length > 0 ? (
                        detail.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-nowrap">
                              {item.name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.standard}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.upper}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.lower}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.unit}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.actual ?? "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  item.result === "qualified"
                                    ? "default"
                                    : item.result === "unqualified"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {item.result === "qualified"
                                  ? "合格"
                                  : item.result === "unqualified"
                                    ? "不合格"
                                    : "待检"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground"
                          >
                            暂无检验项明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── 过程巡检 ──────────────────────────────────────────── */

function ProcessTab() {
  const store = useAppStore();
  const currentUserName = useCurrentUserName();
  const inspectorUsers = useInspectorUsers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ProcessInspection>>({
    operation_name: "绗缝",
    result: "qualified",
    status: "pending",
    items: [],
    inspector: defaultInspector(currentUserName, inspectorUsers),
  });
  const [filterResult, setFilterResult] = useState("全部");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ProcessInspection | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = sortByCreatedDesc(
    store.processInspections
      .filter((p) => filterResult === "全部" || p.result === filterResult)
      .filter((p) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          p.code.toLowerCase().includes(s) ||
          p.work_no.toLowerCase().includes(s) ||
          p.operation_name.toLowerCase().includes(s) ||
          (p.color || "").toLowerCase().includes(s) ||
          (p.contract_no || "").toLowerCase().includes(s)
        );
      }),
  );

  function resultBadge(result: ProcessInspection["result"]) {
    if (result === "qualified") return { label: "合格", variant: "default" as const };
    if (result === "unqualified") return { label: "不合格", variant: "destructive" as const };
    return { label: "待质检", variant: "outline" as const };
  }

  async function save() {
    if (!form.work_no || !form.operation_name) return;
    const wo = store.workOrders.find((w) => w.work_no === form.work_no);
    const op = wo?.operations.find((o) => o.name === form.operation_name);
    const standard = store.processInspectionStandards.find(
      (s) => s.process_name === form.operation_name && s.status === "active",
    );
    const items =
      form.items?.length && form.items.some((i) => i.name)
        ? (form.items as QualityInspectionItem[])
        : (standard?.items || []).map((i) => ({
            ...i,
            actual: undefined,
            result: "pending" as const,
          }));
    const existing = store.processInspections.find(
      (p) =>
        p.work_no === form.work_no &&
        (p.operation_code === op?.code || p.operation_name === form.operation_name),
    );
    const record: ProcessInspection = {
      id: existing?.id || nanoid(),
      code: existing?.code || `PI-${Date.now().toString().slice(-6)}`,
      work_id: wo?.id || existing?.work_id || "",
      work_no: form.work_no,
      operation_name: form.operation_name,
      operation_code: op?.code || "",
      color: form.color || "",
      contract_no: form.contract_no || "",
      result: (form.result as ProcessInspection["result"]) || "qualified",
      status: "inspected",
      inspector: form.inspector || defaultInspector(currentUserName, inspectorUsers) || "质检员",
      created_at: existing?.created_at || beijingNow(),
      items,
      defect_reason: form.defect_reason || "",
    };
    if (existing) {
      store.updateProcessInspection(record);
    } else {
      store.addProcessInspection(record);
    }
    if (record.result === "qualified" && op && wo) {
      const completedOp = {
        ...op,
        status: "completed" as const,
        completed: true,
        pqc_inspection_id: record.id,
      };
      const nextOps = unlockNextOperation(
        {
          ...wo,
          operations: wo.operations.map((o) =>
            o.code === op.code ? completedOp : o,
          ),
        },
        completedOp,
      );
      const updated = { ...wo, operations: nextOps };
      const recalc = recalcWorkOrderFromOperations(updated);
      const finalWo = { ...updated, ...recalc };
      await store.updateWorkOrder(finalWo);
      if (recalc.status === "qc" && !isFinishedInspectionQualified(store, finalWo)) {
        await createPendingFinishedInspection(store, finalWo);
      }
    } else if (record.result === "unqualified") {
      store.addProductionException({
        id: nanoid(),
        code: `EX-${Date.now().toString().slice(-6)}`,
        work_id: record.work_id,
        work_no: record.work_no,
        operation_name: record.operation_name,
        type: "质量问题",
        description: `过程巡检不合格：${record.operation_name}，${record.defect_reason || ""}`,
        submitter: record.inspector,
        created_at: beijingNow(),
        status: "pending",
      });
    }
    setOpen(false);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索单号/工单/工序/颜色/合同编号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-56"
          />
          <Select value={filterResult} onValueChange={setFilterResult}>
            <SelectTrigger className="w-full md:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["全部", "qualified", "unqualified", "pending"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "全部"
                    ? "全部"
                    : r === "qualified"
                      ? "合格"
                      : r === "unqualified"
                        ? "不合格"
                        : "待质检"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm({
              operation_name: "绗缝",
              result: "qualified",
              status: "pending",
              items: [],
              inspector: defaultInspector(currentUserName, inspectorUsers),
            });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新增巡检
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">巡检单号</TableHead>
                <TableHead className="whitespace-nowrap">工单</TableHead>
                <TableHead className="whitespace-nowrap">工序</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">巡检结果</TableHead>
                <TableHead className="whitespace-nowrap">不合格原因</TableHead>
                <TableHead className="whitespace-nowrap">巡检人</TableHead>
                <TableHead className="whitespace-nowrap">时间</TableHead>
                <TableHead className="text-right whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((p) => (
                <TableRow
                  key={p.id}
                  className={
                    p.result === "unqualified" ? "bg-destructive/5" : ""
                  }
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {p.contract_no || "-"}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {p.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.work_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.operation_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.color || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        p.status === "inspected" ? "default" : "outline"
                      }
                    >
                      {p.status === "inspected" ? "已巡检" : "待质检"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={resultBadge(p.result).variant}>
                      {resultBadge(p.result).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.defect_reason || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.inspector || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBeijingDate(p.created_at)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDetail(p);
                        setDetailOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground"
                  >
                    暂无巡检记录
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>新增过程巡检</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>工单编号</Label>
              <Select
                value={form.work_no || ""}
                onValueChange={(v) => {
                  const w = store.workOrders.find((x) => x.work_no === v);
                  setForm((f) => ({
                    ...f,
                    work_no: v,
                    contract_no: w?.contract_no || f.contract_no,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工单" />
                </SelectTrigger>
                <SelectContent>
                  {store.workOrders.map((w) => (
                    <SelectItem key={w.id} value={w.work_no}>
                      {w.work_no} · {w.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>巡检工序</Label>
              <Select
                value={form.operation_name || "绗缝"}
                onValueChange={(v) => {
                  const standard = store.processInspectionStandards.find(
                    (s) => s.process_name === v && s.status === "active",
                  );
                  setForm((f) => ({
                    ...f,
                    operation_name: v,
                    items: (standard?.items || []).map((i) => ({
                      ...i,
                      actual: undefined,
                      result: "pending" as const,
                    })),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["绗缝", "水洗", "整烫"].map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <Input
                value={form.color || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                placeholder="选填"
              />
            </div>
            <div className="space-y-2">
              <Label>合同编号</Label>
              <Input
                value={form.contract_no || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contract_no: e.target.value }))
                }
                placeholder="选填"
              />
            </div>
            <div className="space-y-2">
              <Label>巡检结果</Label>
              <Select
                value={form.result || "qualified"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    result: v as ProcessInspection["result"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualified">合格</SelectItem>
                  <SelectItem value="unqualified">不合格</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.result === "unqualified" && (
              <div className="space-y-2">
                <Label>不合格原因</Label>
                <Textarea
                  value={form.defect_reason || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, defect_reason: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>巡检人</Label>
              <Select
                value={form.inspector || ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, inspector: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择巡检人" />
                </SelectTrigger>
                <SelectContent>
                  {inspectorUsers.length === 0 && (
                    <SelectItem value="_empty" disabled>
                      暂无质检员用户
                    </SelectItem>
                  )}
                  {inspectorUsers.map((u) => (
                    <SelectItem key={u.id} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>提交</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>巡检详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">巡检单号</Label>
                  <div className="font-medium">{detail.code}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">工单</Label>
                  <div className="font-medium">{detail.work_no}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">工序</Label>
                  <div className="font-medium">{detail.operation_name}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">巡检状态</Label>
                  <div>
                    <Badge variant={detail.status === "inspected" ? "default" : "outline"}>
                      {detail.status === "inspected" ? "已巡检" : "待质检"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">巡检结果</Label>
                  <div>
                    <Badge variant={resultBadge(detail.result).variant}>
                      {resultBadge(detail.result).label}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">巡检人</Label>
                  <div className="font-medium">{detail.inspector || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">时间</Label>
                  <div className="font-medium">{formatBeijingDate(detail.created_at)}</div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-muted-foreground">不合格原因 / 备注</Label>
                  <div className="font-medium">{detail.defect_reason || "-"}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>检验项明细</Label>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">项目</TableHead>
                        <TableHead className="whitespace-nowrap">标准</TableHead>
                        <TableHead className="whitespace-nowrap">上限</TableHead>
                        <TableHead className="whitespace-nowrap">下限</TableHead>
                        <TableHead className="whitespace-nowrap">单位</TableHead>
                        <TableHead className="whitespace-nowrap">实测值</TableHead>
                        <TableHead className="whitespace-nowrap">结果</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.length > 0 ? (
                        detail.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-nowrap">{item.name}</TableCell>
                            <TableCell className="whitespace-nowrap">{item.standard}</TableCell>
                            <TableCell className="whitespace-nowrap">{item.upper}</TableCell>
                            <TableCell className="whitespace-nowrap">{item.lower}</TableCell>
                            <TableCell className="whitespace-nowrap">{item.unit}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.actual !== undefined ? item.actual : "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  item.result === "qualified"
                                    ? "default"
                                    : item.result === "unqualified"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {item.result === "qualified"
                                  ? "合格"
                                  : item.result === "unqualified"
                                    ? "不合格"
                                    : "待填"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground"
                          >
                            暂无明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── 成品检验 ──────────────────────────────────────────── */

function FinishedTab() {
  const store = useAppStore();
  const currentUserName = useCurrentUserName();
  const inspectorUsers = useInspectorUsers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<FinishedInspection>>({
    result: "qualified",
    status: "pending",
    items: [],
    inspector: defaultInspector(currentUserName, inspectorUsers),
  });
  const [filterResult, setFilterResult] = useState("全部");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<FinishedInspection | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = sortByCreatedDesc(
    store.finishedInspections
      .filter((f) => filterResult === "全部" || f.result === filterResult)
      .filter((f) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          f.code.toLowerCase().includes(s) ||
          f.work_no.toLowerCase().includes(s) ||
          f.product_name.toLowerCase().includes(s) ||
          (f.color || "").toLowerCase().includes(s) ||
          (f.contract_no || "").toLowerCase().includes(s)
        );
      }),
  );

  function openNew() {
    setForm({ result: "qualified", status: "pending", items: [], inspector: defaultInspector(currentUserName, inspectorUsers) });
    setOpen(true);
  }

  function openEdit(f: FinishedInspection) {
    const product = store.products.find((p) => p.id === f.product_id);
    const items = f.items?.length ? f.items : buildFinishedItems(store.qualityStandards, product);
    setForm({ ...f, result: f.result || "qualified", items });
    setOpen(true);
  }

  async function save() {
    if (!form.work_no || !form.product_name) return;
    const error = validateQuantities(
      Number(form.check_qty) || 0,
      Number(form.qualified_qty) || 0,
      Number(form.unqualified_qty) || 0,
    );
    if (error) {
      toast.error(error);
      return;
    }
    if (hasPendingItem(form.items || [])) {
      toast.error("请填写质检标准项的实测值");
      return;
    }
    const computedResult = deriveResultFromItems(form.items || []);
    if (computedResult === "unqualified" && !form.defect_reason) {
      toast.error("不合格时请填写不合格原因");
      return;
    }
    const wo = store.workOrders.find((w) => w.work_no === form.work_no);
    const record: FinishedInspection = {
      id: form.id || nanoid(),
      code: form.code || `FI-${Date.now().toString().slice(-6)}`,
      work_id: form.work_id || wo?.id || "",
      work_no: form.work_no,
      product_id: form.product_id || wo?.product_id || "",
      product_code: form.product_code || wo?.product_code || "",
      product_name: form.product_name,
      color: form.color || "",
      batch: form.batch || `FB${Date.now().toString().slice(-8)}`,
      check_qty: Number(form.check_qty) || 0,
      qualified_qty: Number(form.qualified_qty) || 0,
      unqualified_qty: Number(form.unqualified_qty) || 0,
      result: computedResult,
      status: "inspected",
      inspector: form.inspector || defaultInspector(currentUserName, inspectorUsers) || "质检员",
      created_at: form.created_at || beijingNow(),
      contract_no: form.contract_no || "",
      items: form.items || [],
      defect_reason: form.defect_reason || "",
    };
    if (form.id) {
      await store.updateFinishedInspection(record);
    } else {
      await store.addFinishedInspection(record);
    }
    // 成品检验合格且工单状态为 qc 时，自动生成待入库单
    if (record.result === "qualified" && wo?.status === "qc") {
      createFinishedGoodsInbound(store, wo, record);
    }
    setOpen(false);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索单号/工单/产品/颜色/合同编号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-56"
          />
          <Select value={filterResult} onValueChange={setFilterResult}>
            <SelectTrigger className="w-full md:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["全部", "qualified", "unqualified"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "全部" ? "全部" : r === "qualified" ? "合格" : "不合格"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          新增成品检验
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">检验单号</TableHead>
                <TableHead className="whitespace-nowrap">工单</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">批次</TableHead>
                <TableHead className="whitespace-nowrap">
                  检验/合格/不合格
                </TableHead>
                <TableHead className="whitespace-nowrap">判定</TableHead>
                <TableHead className="whitespace-nowrap">不合格原因</TableHead>
                <TableHead className="whitespace-nowrap">检验人</TableHead>
                <TableHead className="whitespace-nowrap">时间</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((f) => (
                <TableRow
                  key={f.id}
                  className={
                    f.result === "unqualified" ? "bg-destructive/5" : ""
                  }
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {f.contract_no || "-"}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {f.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.work_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.product_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.color || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{f.batch}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.check_qty}/{f.qualified_qty}/{f.unqualified_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        f.result === "qualified"
                          ? "default"
                          : f.result === "unqualified"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {f.result === "qualified"
                        ? "合格"
                        : f.result === "unqualified"
                          ? "不合格"
                          : "待检"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.defect_reason || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.inspector}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBeijingDate(f.created_at)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {f.status === "pending" && (
                      <Button size="sm" onClick={() => openEdit(f)}>
                        检验
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDetail(f);
                        setDetailOpen(true);
                      }}
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-muted-foreground"
                  >
                    暂无成品检验记录
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "成品检验" : "新增成品检验"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>工单编号</Label>
                <Select
                  value={form.work_no || ""}
                  onValueChange={(v) => {
                    const wo = store.workOrders.find((w) => w.work_no === v);
                    const product = store.products.find((p) => p.id === wo?.product_id);
                    setForm((f) => ({
                      ...f,
                      work_no: v,
                      product_id: wo?.product_id || "",
                      product_code: wo?.product_code || "",
                      product_name: wo?.product_name || "",
                      contract_no: wo?.contract_no || f.contract_no,
                      items: buildFinishedItems(store.qualityStandards, product),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工单" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.workOrders.map((w) => (
                      <SelectItem key={w.id} value={w.work_no}>
                        {w.work_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>产品名称</Label>
                <Input
                  value={form.product_name || ""}
                  readOnly
                  onChange={(e) =>
                    setForm((f) => ({ ...f, product_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>颜色</Label>
                <Input
                  value={form.color || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  placeholder="选填"
                />
              </div>
              <div className="space-y-2">
                <Label>合同编号</Label>
                <Input
                  value={form.contract_no || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contract_no: e.target.value }))
                  }
                  placeholder="选填"
                />
              </div>
              <div className="space-y-2">
                <Label>检验数量</Label>
                <Input
                  type="number"
                  value={form.check_qty || 0}
                  onChange={(e) => {
                    const check = clampQuantity(Number(e.target.value), Infinity);
                    setForm((f) => ({
                      ...f,
                      check_qty: check,
                      qualified_qty: clampQuantity(f.qualified_qty || 0, check),
                      unqualified_qty: clampQuantity(
                        f.unqualified_qty || 0,
                        check - clampQuantity(f.qualified_qty || 0, check),
                      ),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>合格数量</Label>
                <Input
                  type="number"
                  value={form.qualified_qty || 0}
                  onChange={(e) =>
                    setForm((f) =>
                      updateQuantities(f, "qualified_qty", Number(e.target.value)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>不合格数量</Label>
                <Input
                  type="number"
                  value={form.unqualified_qty || 0}
                  onChange={(e) =>
                    setForm((f) =>
                      updateQuantities(f, "unqualified_qty", Number(e.target.value)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>检验人</Label>
                <Select
                  value={form.inspector || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, inspector: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择检验人" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectorUsers.length === 0 && (
                      <SelectItem value="_empty" disabled>
                        暂无质检员用户
                      </SelectItem>
                    )}
                    {inspectorUsers.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>质检标准项</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!form.work_no}
                    onClick={() => {
                      const wo = store.workOrders.find((w) => w.work_no === form.work_no);
                      const product = store.products.find((p) => p.id === wo?.product_id);
                      setForm((f) => ({ ...f, items: buildFinishedItems(store.qualityStandards, product) }));
                    }}
                  >
                    重新加载标准
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">项目名称</TableHead>
                        <TableHead className="whitespace-nowrap">标准值</TableHead>
                        <TableHead className="whitespace-nowrap">下限</TableHead>
                        <TableHead className="whitespace-nowrap">上限</TableHead>
                        <TableHead className="whitespace-nowrap">单位</TableHead>
                        <TableHead className="whitespace-nowrap">实测值</TableHead>
                        <TableHead className="whitespace-nowrap">结果</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(form.items || []).length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground"
                          >
                            请先选择工单，或点击“重新加载标准”加载质检项
                          </TableCell>
                        </TableRow>
                      )}
                      {(form.items || []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">{item.name}</TableCell>
                          <TableCell className="whitespace-nowrap">{item.standard}</TableCell>
                          <TableCell className="whitespace-nowrap">{item.lower}</TableCell>
                          <TableCell className="whitespace-nowrap">{item.upper}</TableCell>
                          <TableCell className="whitespace-nowrap">{item.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-24 px-2"
                              value={item.actual ?? ""}
                              onChange={(e) => {
                                const actual = e.target.value === "" ? undefined : Number(e.target.value);
                                setForm((f) => {
                                  const items = (f.items || []).map((it, i) =>
                                    i === idx
                                      ? { ...it, actual, result: evaluateItem({ ...it, actual }) }
                                      : it,
                                  );
                                  return {
                                    ...f,
                                    items,
                                    result: deriveResultFromItems(items),
                                  };
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.result === "qualified"
                              ? "合格"
                              : item.result === "unqualified"
                                ? "不合格"
                                : "待检"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>判定结果</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm">
                  {form.result === "qualified"
                    ? "合格"
                    : form.result === "unqualified"
                      ? "不合格"
                      : "待检"}
                </div>
              </div>
              {form.result === "unqualified" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    不合格原因 <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={form.defect_reason || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, defect_reason: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>提交</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>成品检验详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">检验单号</Label>
                  <div className="font-medium">{detail.code}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">合同编号</Label>
                  <div className="font-medium">{detail.contract_no || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">工单</Label>
                  <div className="font-medium">{detail.work_no}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">产品</Label>
                  <div className="font-medium">{detail.product_name}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">颜色</Label>
                  <div className="font-medium">{detail.color || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">批次</Label>
                  <div className="font-medium">{detail.batch}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">检验/合格/不合格</Label>
                  <div className="font-medium">
                    {detail.check_qty}/{detail.qualified_qty}/{detail.unqualified_qty}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">判定结果</Label>
                  <div>
                    <Badge
                      variant={
                        detail.result === "qualified"
                          ? "default"
                          : detail.result === "unqualified"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {detail.result === "qualified"
                        ? "合格"
                        : detail.result === "unqualified"
                          ? "不合格"
                          : "待检"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">检验人</Label>
                  <div className="font-medium">{detail.inspector}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">时间</Label>
                  <div className="font-medium">
                    {formatBeijingDate(detail.created_at)}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-muted-foreground">不合格原因</Label>
                  <div className="font-medium">{detail.defect_reason || "-"}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>检验项明细</Label>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">项目</TableHead>
                        <TableHead className="whitespace-nowrap">标准</TableHead>
                        <TableHead className="whitespace-nowrap">上限</TableHead>
                        <TableHead className="whitespace-nowrap">下限</TableHead>
                        <TableHead className="whitespace-nowrap">单位</TableHead>
                        <TableHead className="whitespace-nowrap">实测值</TableHead>
                        <TableHead className="whitespace-nowrap">结果</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items && detail.items.length > 0 ? (
                        detail.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-nowrap">
                              {item.name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.standard}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.upper}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.lower}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.unit}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.actual ?? "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  item.result === "qualified"
                                    ? "default"
                                    : item.result === "unqualified"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {item.result === "qualified"
                                  ? "合格"
                                  : item.result === "unqualified"
                                    ? "不合格"
                                    : "待检"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground"
                          >
                            暂无检验项明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── 质量追溯 ──────────────────────────────────────────── */

function TraceTab() {
  const store = useAppStore();
  const [workNo, setWorkNo] = useState("");
  const [searched, setSearched] = useState(false);

  const materials = useMemo(
    () =>
      sortByCreatedDesc(
        store.materialInspections.filter((m) => {
          const wo = store.workOrders.find((w) => w.work_no === workNo);
          return wo ? m.material_id === "" || workNo : false;
        }),
      ),
    [workNo, store.materialInspections, store.workOrders],
  );

  const processes = useMemo(
    () =>
      sortByCreatedDesc(
        store.processInspections.filter((p) => p.work_no === workNo),
      ),
    [workNo, store.processInspections],
  );
  const finished = useMemo(
    () =>
      sortByCreatedDesc(
        store.finishedInspections.filter((f) => f.work_no === workNo),
      ),
    [workNo, store.finishedInspections],
  );
  const wo = store.workOrders.find((w) => w.work_no === workNo);

  function search() {
    setSearched(true);
  }

  const allMaterials = workNo ? store.materialInspections : [];
  const allProcesses = processes;
  const allFinished = finished;

  const {
    paginatedItems: allFinishedPaginated,
    currentPage: allFinishedCurrentPage,
    pageSize: allFinishedPageSize,
    totalPages: allFinishedTotalPages,
    totalItems: allFinishedTotalItems,
    setPage: setAllFinishedPage,
    setPageSize: setAllFinishedPageSize,
  } = usePagination(allFinished);

  const {
    paginatedItems: allProcessesPaginated,
    currentPage: allProcessesCurrentPage,
    pageSize: allProcessesPageSize,
    totalPages: allProcessesTotalPages,
    totalItems: allProcessesTotalItems,
    setPage: setAllProcessesPage,
    setPageSize: setAllProcessesPageSize,
  } = usePagination(allProcesses);

  const {
    paginatedItems: allMaterialsPaginated,
    currentPage: allMaterialsCurrentPage,
    pageSize: allMaterialsPageSize,
    totalPages: allMaterialsTotalPages,
    totalItems: allMaterialsTotalItems,
    setPage: setAllMaterialsPage,
    setPageSize: setAllMaterialsPageSize,
  } = usePagination(allMaterials);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="输入工单编号追溯"
            value={workNo}
            onChange={(e) => setWorkNo(e.target.value)}
          />
        </div>
        <Button onClick={search}>
          <Search className="mr-1 h-4 w-4" />
          追溯
        </Button>
      </div>
      {searched &&
        (wo ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  工单信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">工单编号：</span>
                    <span className="font-medium">{wo.work_no}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">产品：</span>
                    <span className="font-medium">{wo.product_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    <span className="font-medium">{wo.status}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  来料检验记录
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {allMaterials.length > 0 ? (
                  <>
                    (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            检验单号
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            物料
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            批次
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            供应商
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            判定
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            检验人
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allMaterialsPaginated.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="whitespace-nowrap">
                              {m.code}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {m.material_name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {m.batch}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {m.supplier}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  m.result === "qualified"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {m.result === "qualified" ? "合格" : "不合格"}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {m.inspector}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    )
                    <Pagination
                      currentPage={allMaterialsCurrentPage}
                      totalPages={allMaterialsTotalPages}
                      pageSize={allMaterialsPageSize}
                      totalItems={allMaterialsTotalItems}
                      onPageChange={setAllMaterialsPage}
                      onPageSizeChange={setAllMaterialsPageSize}
                    />
                  </>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">
                    该工单无来料检验记录
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  过程巡检记录
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {allProcesses.length > 0 ? (
                  <>
                    (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            巡检单号
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            工序
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            结果
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            不合格原因
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            巡检人
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            时间
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allProcessesPaginated.map((p) => (
                          <TableRow
                            key={p.id}
                            className={
                              p.result === "unqualified"
                                ? "bg-destructive/5"
                                : ""
                            }
                          >
                            <TableCell className="whitespace-nowrap">
                              {p.code}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {p.operation_name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  p.result === "qualified"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {p.result === "qualified" ? "合格" : "不合格"}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {p.defect_reason || "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {p.inspector}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatBeijingDate(p.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    )
                    <Pagination
                      currentPage={allProcessesCurrentPage}
                      totalPages={allProcessesTotalPages}
                      pageSize={allProcessesPageSize}
                      totalItems={allProcessesTotalItems}
                      onPageChange={setAllProcessesPage}
                      onPageSizeChange={setAllProcessesPageSize}
                    />
                  </>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">
                    该工单无过程巡检记录
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  成品检验记录
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {allFinished.length > 0 ? (
                  <>
                    (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            检验单号
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            产品
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            批次
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            合格/不合格
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            判定
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            检验人
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allFinishedPaginated.map((f) => (
                          <TableRow
                            key={f.id}
                            className={
                              f.result === "unqualified"
                                ? "bg-destructive/5"
                                : ""
                            }
                          >
                            <TableCell className="whitespace-nowrap">
                              {f.code}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {f.product_name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {f.batch}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {f.qualified_qty}/{f.unqualified_qty}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  f.result === "qualified"
                                    ? "default"
                                    : f.result === "unqualified"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {f.result === "qualified"
                                  ? "合格"
                                  : f.result === "unqualified"
                                    ? "不合格"
                                    : "待检"}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {f.inspector}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    )
                    <Pagination
                      currentPage={allFinishedCurrentPage}
                      totalPages={allFinishedTotalPages}
                      pageSize={allFinishedPageSize}
                      totalItems={allFinishedTotalItems}
                      onPageChange={setAllFinishedPage}
                      onPageSizeChange={setAllFinishedPageSize}
                    />
                  </>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">
                    该工单无成品检验记录
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            未找到工单号 "{workNo}"，请确认工单编号。
          </p>
        ))}
      {!searched && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            通过工单号可追溯来料检验 → 过程巡检 →
            成品检验的完整质量链路，不合格批次可追溯到原材料批次与绗缝设备。
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function now() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

/* ─── 页面入口 ──────────────────────────────────────────── */

export function QualityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "standards";

  function updateUrlTab(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="质量管理"
        description="质检标准、来料/过程/成品检验与追溯"
      />
      <ControlledTabs
        modulePath="/quality"
        defaultTab={initialTab}
        onActiveTabChange={updateUrlTab}
      >
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="standards">
          <StandardsTab />
        </TabsContent>

        <TabsContent value="incoming">
          <IncomingTab />
        </TabsContent>
        <TabsContent value="process">
          <ProcessTab />
        </TabsContent>
        <TabsContent value="finished">
          <FinishedTab />
        </TabsContent>
        <TabsContent value="trace">
          <TraceTab />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}
