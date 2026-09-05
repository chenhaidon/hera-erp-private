import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { nanoid } from "@/lib/utils";
import type { ProductCategory, FabricType, FillingType } from "@/types";

export function ProductDictionaryTab() {
  return (
    <Tabs defaultValue="category" className="w-full">
      <TabsList className="mb-4 grid w-full grid-cols-3 md:w-auto">
        <TabsTrigger value="category">产品分类</TabsTrigger>
        <TabsTrigger value="fabric">面料类型</TabsTrigger>
        <TabsTrigger value="filling">填充物类型</TabsTrigger>
      </TabsList>
      <TabsContent value="category">
        <CategoryTab />
      </TabsContent>
      <TabsContent value="fabric">
        <FabricTab />
      </TabsContent>
      <TabsContent value="filling">
        <FillingTab />
      </TabsContent>
    </Tabs>
  );
}

export default function DataDictionaryPage() {
  return (
    <div className="space-y-4 p-6">
      <ProductDictionaryTab />
    </div>
  );
}

function CategoryTab() {
  const list = useAppStore((s) => s.productCategories);
  const add = useAppStore((s) => s.addProductCategory);
  const update = useAppStore((s) => s.updateProductCategory);
  const remove = useAppStore((s) => s.removeProductCategory);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ProductCategory>>({});

  const filtered = list.filter((i) => i.name.includes(search));
  const activeCount = list.filter((i) => i.status === "active").length;

  const onSubmit = () => {
    if (!form.name) return;
    if (form.id) {
      const existing = list.find((i) => i.id === form.id);
      if (existing) update({ ...existing, ...form } as ProductCategory);
    } else {
      add({
        id: nanoid(),
        name: form.name,
        parent_id: form.parent_id,
        sort: form.sort || list.length,
        status: "active",
      });
    }
    setOpen(false);
    setForm({});
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base md:text-lg">产品分类</CardTitle>
          <p className="text-sm text-muted-foreground">
            已启用 {activeCount} 个 · 共 {list.length} 个
          </p>
        </div>
        <div className="flex flex-1 min-w-0 items-center gap-2 md:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="搜索分类名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setForm({})}>
                <Plus className="mr-1 h-4 w-4" />
                新增
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
              <DialogHeader>
                <DialogTitle>{form.id ? "编辑分类" : "新增分类"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>分类名称</Label>
                  <Input
                    value={form.name || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>排序</Label>
                  <Input
                    type="number"
                    value={form.sort ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, sort: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={onSubmit}>保存</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  分类名称
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  排序
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  状态
                </th>
                <th className="whitespace-nowrap p-3 text-right font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="whitespace-nowrap p-3">{item.name}</td>
                  <td className="whitespace-nowrap p-3">{item.sort}</td>
                  <td className="whitespace-nowrap p-3">
                    <Badge
                      variant={
                        item.status === "active" ? "default" : "secondary"
                      }
                    >
                      {item.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm(item);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update({
                            ...item,
                            status:
                              item.status === "active" ? "inactive" : "active",
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FabricTab() {
  const list = useAppStore((s) => s.fabricTypes);
  const add = useAppStore((s) => s.addFabricType);
  const update = useAppStore((s) => s.updateFabricType);
  const remove = useAppStore((s) => s.removeFabricType);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<FabricType>>({});

  const filtered = list.filter((i) => i.name.includes(search));
  const activeCount = list.filter((i) => i.status === "active").length;

  const onSubmit = () => {
    if (!form.name) return;
    if (form.id) {
      const existing = list.find((i) => i.id === form.id);
      if (existing) update({ ...existing, ...form } as FabricType);
    } else {
      add({
        id: nanoid(),
        name: form.name,
        composition: form.composition || "",
        weight: form.weight || "",
        width: form.width || "",
        status: "active",
      });
    }
    setOpen(false);
    setForm({});
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base md:text-lg">面料类型</CardTitle>
          <p className="text-sm text-muted-foreground">
            已启用 {activeCount} 个 · 共 {list.length} 个
          </p>
        </div>
        <div className="flex flex-1 min-w-0 items-center gap-2 md:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="搜索面料名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setForm({})}>
                <Plus className="mr-1 h-4 w-4" />
                新增
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
              <DialogHeader>
                <DialogTitle>{form.id ? "编辑面料" : "新增面料"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>面料名称</Label>
                  <Input
                    value={form.name || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>成分</Label>
                  <Input
                    value={form.composition || ""}
                    onChange={(e) =>
                      setForm({ ...form, composition: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>克重</Label>
                  <Input
                    value={form.weight || ""}
                    onChange={(e) =>
                      setForm({ ...form, weight: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>幅宽</Label>
                  <Input
                    value={form.width || ""}
                    onChange={(e) =>
                      setForm({ ...form, width: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={onSubmit}>保存</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  面料名称
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  成分
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  克重
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  幅宽
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  状态
                </th>
                <th className="whitespace-nowrap p-3 text-right font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="whitespace-nowrap p-3">{item.name}</td>
                  <td className="whitespace-nowrap p-3">
                    {item.composition || "-"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {item.weight || "-"}
                  </td>
                  <td className="whitespace-nowrap p-3">{item.width || "-"}</td>
                  <td className="whitespace-nowrap p-3">
                    <Badge
                      variant={
                        item.status === "active" ? "default" : "secondary"
                      }
                    >
                      {item.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm(item);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update({
                            ...item,
                            status:
                              item.status === "active" ? "inactive" : "active",
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FillingTab() {
  const list = useAppStore((s) => s.fillingTypes);
  const add = useAppStore((s) => s.addFillingType);
  const update = useAppStore((s) => s.updateFillingType);
  const remove = useAppStore((s) => s.removeFillingType);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<FillingType>>({});

  const filtered = list.filter((i) => i.name.includes(search));
  const activeCount = list.filter((i) => i.status === "active").length;

  const onSubmit = () => {
    if (!form.name) return;
    if (form.id) {
      const existing = list.find((i) => i.id === form.id);
      if (existing) update({ ...existing, ...form } as FillingType);
    } else {
      add({
        id: nanoid(),
        name: form.name,
        composition: form.composition || "",
        weight: form.weight || "",
        resilience: form.resilience || "",
        status: "active",
      });
    }
    setOpen(false);
    setForm({});
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base md:text-lg">填充物类型</CardTitle>
          <p className="text-sm text-muted-foreground">
            已启用 {activeCount} 个 · 共 {list.length} 个
          </p>
        </div>
        <div className="flex flex-1 min-w-0 items-center gap-2 md:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="搜索填充物名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setForm({})}>
                <Plus className="mr-1 h-4 w-4" />
                新增
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {form.id ? "编辑填充物" : "新增填充物"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>填充物名称</Label>
                  <Input
                    value={form.name || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>成分</Label>
                  <Input
                    value={form.composition || ""}
                    onChange={(e) =>
                      setForm({ ...form, composition: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>克重</Label>
                  <Input
                    value={form.weight || ""}
                    onChange={(e) =>
                      setForm({ ...form, weight: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>回弹性等级</Label>
                  <Input
                    value={form.resilience || ""}
                    onChange={(e) =>
                      setForm({ ...form, resilience: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={onSubmit}>保存</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  填充物名称
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  成分
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  克重
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  回弹性等级
                </th>
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  状态
                </th>
                <th className="whitespace-nowrap p-3 text-right font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="whitespace-nowrap p-3">{item.name}</td>
                  <td className="whitespace-nowrap p-3">
                    {item.composition || "-"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {item.weight || "-"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {item.resilience || "-"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <Badge
                      variant={
                        item.status === "active" ? "default" : "secondary"
                      }
                    >
                      {item.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm(item);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update({
                            ...item,
                            status:
                              item.status === "active" ? "inactive" : "active",
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
