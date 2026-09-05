import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store";
import { nanoid } from "@/lib/utils";
import type { Material, MaterialSupplierPrice } from "@/types";

const CATEGORIES = [
  "面料",
  "辅料",
  "填充物",
  "包装材料",
  "滚边料",
  "面层面料",
  "衬布",
  "底层面料",
  "填充棉",
  "其他",
];
const STATUS_OPTIONS = ["active", "inactive"];

export function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useAppStore();
  const isCreate = id === "create";
  const existing = store.materials.find((m) => m.id === id);
  const [material, setMaterial] = useState<Partial<Material>>(() =>
    initMaterial(existing, isCreate),
  );
  const [isEditing, setIsEditing] = useState(isCreate);

  useEffect(() => {
    setMaterial(initMaterial(existing, isCreate));
  }, [existing, id, isCreate]);

  const supplierPrices = useMemo(
    () =>
      store.materialSupplierPrices.filter(
        (s) => s.material_id === (material.id || id),
      ),
    [store.materialSupplierPrices, material.id, id],
  );

  const handleSave = () => {
    if (!material.code || !material.name) return;
    const payload = {
      ...material,
      id: material.id || nanoid(),
      status: material.status || "active",
    } as Material;
    if (isCreate) store.addMaterial(payload);
    else store.updateMaterial(payload);
    navigate(`/materials/${payload.id}`);
    setIsEditing(false);
    toast.success("保存成功");
  };

  const addSupplierPrice = () => {
    const sp: MaterialSupplierPrice = {
      id: nanoid(),
      material_id: material.id || id || "",
      supplier_id: nanoid(),
      supplier_name: "",
      price: 0,
      currency: "CNY",
      lead_time: 7,
      moq: 0,
      status: "active",
      is_default: supplierPrices.length === 0,
      effective_date: new Date().toISOString().split("T")[0],
      expiry_date: "",
    };
    store.addMaterialSupplierPrice(sp);
  };

  const updateSupplierPrice = (
    spId: string,
    field: keyof MaterialSupplierPrice,
    value: string | number | boolean,
  ) => {
    store.updateMaterialSupplierPrice(
      store.materialSupplierPrices
        .map((s) => (s.id === spId ? { ...s, [field]: value } : s))
        .find((s) => s.id === spId)!,
    );
  };

  const removeSupplierPrice = (spId: string) => {
    store.deleteMaterialSupplierPrice(spId);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/materials")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {isCreate ? "新建物料" : material.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {material.code || "物料编码"}
            </p>
          </div>
          {!isCreate && (
            <Badge
              variant={material.status === "active" ? "default" : "secondary"}
            >
              {material.status === "active" ? "启用" : "停用"}
            </Badge>
          )}
        </div>
        {isEditing ? (
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        ) : (
          <Button size="sm" onClick={() => setIsEditing(true)}>
            编辑
          </Button>
        )}
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="suppliers">供应商价格</TabsTrigger>
          <TabsTrigger value="inventory">库存信息</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>物料编码</Label>
                <Input
                  disabled={!isEditing}
                  value={material.code || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, code: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>物料名称</Label>
                <Input
                  disabled={!isEditing}
                  value={material.name || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>类别</Label>
                <Select
                  disabled={!isEditing}
                  value={material.category}
                  onValueChange={(v) =>
                    setMaterial((m) => ({ ...m, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>规格</Label>
                <Input
                  disabled={!isEditing}
                  value={material.specification || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({
                      ...m,
                      specification: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>单位</Label>
                <Input
                  disabled={!isEditing}
                  value={material.unit || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, unit: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>默认供应商</Label>
                <Input
                  disabled={!isEditing}
                  value={material.default_supplier || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({
                      ...m,
                      default_supplier: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>门幅</Label>
                <Input
                  disabled={!isEditing}
                  value={material.width || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, width: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>布号</Label>
                <Input
                  disabled={!isEditing}
                  value={material.fabric_no || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, fabric_no: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>单件尺寸</Label>
                <Input
                  disabled={!isEditing}
                  value={material.piece_size || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, piece_size: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>颜色</Label>
                <Input
                  disabled={!isEditing}
                  value={material.color || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, color: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  disabled={!isEditing}
                  value={material.status}
                  onValueChange={(v) =>
                    setMaterial((m) => ({
                      ...m,
                      status: v as "active" | "inactive",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "active" ? "启用" : "停用"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>备注</Label>
                <Input
                  disabled={!isEditing}
                  value={material.remark || ""}
                  onChange={(e) =>
                    setMaterial((m) => ({ ...m, remark: e.target.value }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">供应商价格</CardTitle>
              <Button size="sm" variant="outline" onClick={addSupplierPrice}>
                <Plus className="mr-1 h-4 w-4" />
                新增供应商报价
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">供应商</th>
                    <th className="p-2 text-left">单价</th>
                    <th className="p-2 text-left">币种</th>
                    <th className="p-2 text-left">交期(天)</th>
                    <th className="p-2 text-left">MOQ</th>
                    <th className="p-2 text-left">生效日期</th>
                    <th className="p-2 text-left">默认</th>
                    <th className="p-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPrices.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-2">
                        <Input
                          value={s.supplier_name}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "supplier_name",
                              e.target.value,
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={s.price}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "price",
                              Number(e.target.value),
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={s.currency}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "currency",
                              e.target.value,
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={s.lead_time}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "lead_time",
                              Number(e.target.value),
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={s.moq}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "moq",
                              Number(e.target.value),
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={s.effective_date}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "effective_date",
                              e.target.value,
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={s.is_default}
                          onChange={(e) =>
                            updateSupplierPrice(
                              s.id,
                              "is_default",
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSupplierPrice(s.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {supplierPrices.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-4 text-center text-muted-foreground"
                      >
                        暂无供应商报价
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">库存信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>当前库存</Label>
                <Input value={material.stock || 0} readOnly />
              </div>
              <div className="space-y-2">
                <Label>安全库存</Label>
                <Input value={material.safety_stock || 0} readOnly />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function initMaterial(
  existing?: Material,
  isCreate?: boolean,
): Partial<Material> {
  if (existing) return { ...existing };
  if (isCreate)
    return {
      id: "",
      code: "",
      name: "",
      category: "面料",
      specification: "",
      unit: "米",
      default_supplier: "",
      color: "",
      status: "active",
      stock: 0,
      safety_stock: 0,
      width: "",
      fabric_no: "",
      piece_size: "",
      remark: "",
    };
  return {};
}
