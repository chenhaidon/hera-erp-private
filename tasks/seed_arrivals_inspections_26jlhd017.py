#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为合同 26JLHD017 的三张采购订单生成到货记录（已入库，9/5、9/6）及对应来料检验记录。

生成内容：
- purchase_arrivals   3 张（status=stored，含 received/qualified/rejected/stored_qty）
- material_inspections 7 条（status=inspected，含检验项目实测值，部分 partial）
- stock_records       7 条（采购入库 GR-26JLHD017-xxx）
- inventory           对应物料库存增加合格数量
- purchase_orders     回写 items 的到货/合格/不合格/入库数量
"""

import json

import requests

BASE = "https://backend.appmiaoda.com/projects/supabase331454395508113408"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsj8FmgzMLaCgXF4LGn0"
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
CONTRACT = "26JLHD017"
INSPECTOR = "金灵芳"

# 26JLHD017 三张采购订单（来自线上 entity_store）
PURCHASE_ORDERS = [
    {
        "id": "f561e56d-039a-4d6b-b075-d59850d7fb17",
        "order_no": "PO-26JLHD017-001",
        "supplier_id": "309e568b-d4f0-494e-964a-3fb052482da7",
        "supplier_name": "华纺原料",
        "arrival_code": "PA-26JLHD017-001",
        "arrival_date": "2026-09-05",
        "inspect_time": "2026-09-05 09:40:00",
        "inspect_date": "2026-09-05",
        "qualified_date": "2026-09-05",
        "items": [
            {
                "material_id": "488010dc-5779-4a00-b701-46f9dc7f4d3d",
                "material_code": "MT-001",
                "material_name": "纯棉面料",
                "category": "面料",
                "specification": "幅宽240cm 克重120g",
                "quantity": 1700,
                "unit": "米",
                "unit_price": 12,
                "amount": 20400,
                "rejected": 10,
                "defect_reason": "克重偏差超下限，局部偏轻",
                "warehouse": "面料仓",
                "location_id": "loc-fabric-1",
            },
            {
                "material_id": "22ba7c4a-0443-45a3-9373-d6590b5856c7",
                "material_code": "MT-002",
                "material_name": "绒布面料",
                "category": "面料",
                "specification": "幅宽220cm 克重200g",
                "quantity": 500,
                "unit": "米",
                "unit_price": 15,
                "amount": 7500,
                "rejected": 0,
                "defect_reason": "",
                "warehouse": "面料仓",
                "location_id": "loc-fabric-2",
            },
        ],
    },
    {
        "id": "4990f7da-bede-4498-90db-560d76e8035c",
        "order_no": "PO-26JLHD017-002",
        "supplier_id": "567e47de-02ca-4e16-aed7-8604b4a12418",
        "supplier_name": "新棉填充",
        "arrival_code": "PA-26JLHD017-002",
        "arrival_date": "2026-09-05",
        "inspect_time": "2026-09-05 15:50:00",
        "inspect_date": "2026-09-05",
        "qualified_date": "2026-09-05",
        "items": [
            {
                "material_id": "49a7ec69-6b61-4846-8336-ce3d02695739",
                "material_code": "MT-003",
                "material_name": "喷胶棉",
                "category": "填充物",
                "specification": "克重300g/㎡",
                "quantity": 260,
                "unit": "kg",
                "unit_price": 22,
                "amount": 5720,
                "rejected": 4,
                "defect_reason": "外观等级不足，局部结块",
                "warehouse": "填充仓",
                "location_id": "loc-filling-1",
            },
            {
                "material_id": "05760f96-0da6-45c5-ae8a-fdc78439d076",
                "material_code": "MT-004",
                "material_name": "羽绒",
                "category": "填充物",
                "specification": "80%白鸭绒",
                "quantity": 40,
                "unit": "kg",
                "unit_price": 80,
                "amount": 3200,
                "rejected": 0,
                "defect_reason": "",
                "warehouse": "填充仓",
                "location_id": "loc-filling-2",
            },
        ],
    },
    {
        "id": "2d6b6997-f1cf-4b4a-aa70-f02c9a67b5ac",
        "order_no": "PO-26JLHD017-003",
        "supplier_id": "94a554cb-0b20-42a2-9bff-0525ebed080f",
        "supplier_name": "顺达辅料",
        "arrival_code": "PA-26JLHD017-003",
        "arrival_date": "2026-09-06",
        "inspect_time": "2026-09-06 11:00:00",
        "inspect_date": "2026-09-06",
        "qualified_date": "2026-09-06",
        "items": [
            {
                "material_id": "bcb31f5a-29ca-4320-8e3a-ddf89aaee11a",
                "material_code": "MT-005",
                "material_name": "拉链",
                "category": "辅料",
                "specification": "3号尼龙拉链",
                "quantity": 200,
                "unit": "条",
                "unit_price": 0.5,
                "amount": 100.0,
                "rejected": 0,
                "defect_reason": "",
                "warehouse": "辅料仓",
                "location_id": "loc-accessory-1",
            },
            {
                "material_id": "2b55674b-1199-41ba-8548-48a367c45fe2",
                "material_code": "MT-006",
                "material_name": "松紧绳",
                "category": "辅料",
                "specification": "5mm 圆松紧带",
                "quantity": 1000,
                "unit": "米",
                "unit_price": 2,
                "amount": 2000,
                "rejected": 0,
                "defect_reason": "",
                "warehouse": "辅料仓",
                "location_id": "loc-accessory-2",
            },
            {
                "material_id": "c6a0d864-c86c-4e2f-b843-2e0d9d03a498",
                "material_code": "MT-D2115D11",
                "material_name": "春亚纺",
                "category": "面料",
                "specification": "幅宽2.8m",
                "quantity": 300,
                "unit": "米",
                "unit_price": 16,
                "amount": 4800,
                "rejected": 6,
                "defect_reason": "色牢度不达标，批次色差",
                "warehouse": "面料仓",
                "location_id": "loc-fabric-2",
            },
        ],
    },
]

# 各物料检验项目（name, standard, lower, upper, unit, category, actual）
INSPECTION_ITEMS = {
    "面料": [
        ("外观", 4, 3, 5, "级", "appearance"),
        ("色牢度", 4, 3, 5, "级", "physical"),
        ("克重偏差", 0, -5, 5, "%", "physical"),
        ("pH值", 6.5, 4, 8.5, "", "chemical"),
        ("幅宽偏差", 0, -1, 1, "cm", "appearance"),
    ],
    "填充物_棉": [
        ("外观", 4, 3, 5, "级", "appearance"),
        ("克重偏差", 0, -5, 5, "%", "physical"),
        ("回弹性", 85, 75, 95, "%", "physical"),
    ],
    "填充物_绒": [
        ("外观", 4, 3, 5, "级", "appearance"),
        ("含绒量", 80, 75, 90, "%", "physical"),
        ("蓬松度", 400, 350, 450, "cm³/g", "physical"),
        ("清洁度", 450, 350, 500, "mm", "chemical"),
    ],
    "拉链": [
        ("外观", 4, 3, 5, "级", "appearance"),
        ("拉力强度", 350, 300, 500, "N", "physical"),
        ("尺寸偏差", 0, -2, 2, "mm", "appearance"),
    ],
    "松紧绳": [
        ("外观", 4, 3, 5, "级", "appearance"),
        ("拉伸强度", 120, 100, 200, "N", "physical"),
        ("伸长率", 150, 120, 180, "%", "physical"),
    ],
}

# 实测值（默认取合格区间内的代表值，超差项单独覆盖）
DEFAULT_ACTUAL = {
    "外观": 4.5,
    "色牢度": 4.0,
    "克重偏差": 1.2,
    "pH值": 6.8,
    "幅宽偏差": -0.2,
    "回弹性": 88,
    "含绒量": 82,
    "蓬松度": 415,
    "清洁度": 470,
    "拉力强度": 420,
    "尺寸偏差": 0.3,
    "拉伸强度": 155,
    "伸长率": 162,
}
# 超差项：物料编码 -> 检验项目 -> 实际值（低于下限）
OVERRIDES = {
    "MT-001": {"克重偏差": -6.2},  # 纯棉面料 部分不合格
    "MT-003": {"外观": 2.5},  # 喷胶棉 部分不合格
    "MT-D2115D11": {"色牢度": 2.8},  # 春亚纺 部分不合格
}


def run_sql(sql: str):
    r = requests.post(f"{BASE}/rest/v1/rpc/execute_sql", headers=HEADERS, json={"sql_text": sql})
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"SQL 执行失败 {r.status_code}: {r.text[:300]}")
    return r


def esc(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False).replace("'", "''")


def already_done() -> bool:
    url = f"{BASE}/rest/v1/entity_store?entity_type=eq.purchase_arrivals&data->>code=in.(PA-26JLHD017-001,PA-26JLHD017-002,PA-26JLHD017-003)&select=id"
    r = requests.get(url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    r.raise_for_status()
    return len(r.json()) >= 3


def entity_exists(eid: str) -> bool:
    url = f"{BASE}/rest/v1/entity_store?id=eq.{eid}&select=id"
    r = requests.get(url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    r.raise_for_status()
    return len(r.json()) > 0


def build_inspection_item(name, standard, lower, upper, unit, category, material_code):
    actual = OVERRIDES.get(material_code, {}).get(name, DEFAULT_ACTUAL.get(name, standard))
    result = "qualified" if lower <= actual <= upper else "unqualified"
    return {
        "name": name,
        "standard": standard,
        "upper": upper,
        "lower": lower,
        "unit": unit,
        "category": category,
        "actual": actual,
        "result": result,
    }


def items_for_material(material_code: str, material_name: str):
    if material_code == "MT-003":
        key = "填充物_棉"
    elif material_code == "MT-004":
        key = "填充物_绒"
    elif material_code == "MT-005":
        key = "拉链"
    elif material_code == "MT-006":
        key = "松紧绳"
    else:
        key = "面料"
    return [build_inspection_item(*spec, material_code) for spec in INSPECTION_ITEMS[key]]


def main():
    if already_done():
        print("已存在 PA-26JLHD017* 到货记录，跳过（幂等保护）")
        return

    for po in PURCHASE_ORDERS:
        # 1) 到货单（已入库）
        arrival_items = []
        for it in po["items"]:
            qualified = it["quantity"] - it["rejected"]
            arrival_items.append({
                "material_id": it["material_id"],
                "material_code": it["material_code"],
                "material_name": it["material_name"],
                "specification": it["specification"],
                "quantity": it["quantity"],
                "unit": it["unit"],
                "unit_price": it["unit_price"],
                "amount": it["amount"],
                "received_qty": it["quantity"],
                "qualified_qty": qualified,
                "rejected_qty": it["rejected"],
                "stored_qty": qualified,
                "warehouse": it["warehouse"],
                "location_id": it["location_id"],
            })
        arrival = {
            "id": f"pa-26jlhd017-{po['arrival_code'][-3:]}",
            "code": po["arrival_code"],
            "order_id": po["id"],
            "order_no": po["order_no"],
            "supplier_name": po["supplier_name"],
            "arrival_date": po["arrival_date"],
            "inspect_date": po["inspect_date"],
            "qualified_date": po["qualified_date"],
            "inspector": INSPECTOR,
            "contract_no": CONTRACT,
            "status": "stored",
            "items": arrival_items,
            "warehouse": arrival_items[0]["warehouse"],
        }
        # 2) 来料检验记录 + 入库记录
        for idx, it in enumerate(po["items"], start=1):
            qualified = it["quantity"] - it["rejected"]
            inspection_items = items_for_material(it["material_code"], it["material_name"])
            result = (
                "unqualified" if qualified == 0
                else ("partial" if it["rejected"] > 0 else "qualified")
            )
            inspection = {
                "id": f"mi-26jlhd017-{po['arrival_code'][-3:]}-{idx}",
                "code": f"MI-{po['arrival_code'][3:]}-{it['material_code']}",
                "material_id": it["material_id"],
                "material_name": it["material_name"],
                "category": it["category"],
                "supplier": po["supplier_name"],
                "supplier_id": po["supplier_id"],
                "purchase_order_id": po["id"],
                "purchase_order_no": po["order_no"],
                "arrival_id": arrival["id"],
                "arrival_code": po["arrival_code"],
                "contract_no": CONTRACT,
                "batch": f"{po['arrival_code']}-{it['material_code']}",
                "arrival_qty": it["quantity"],
                "check_qty": it["quantity"],
                "qualified_qty": qualified,
                "unqualified_qty": it["rejected"],
                "result": result,
                "status": "inspected",
                "inspector": INSPECTOR,
                "created_at": po["inspect_time"],
                "items": inspection_items,
                "defect_reason": it["defect_reason"] if it["rejected"] > 0 else "",
            }
            sql = (
                "INSERT INTO entity_store (id, entity_type, data) "
                f"SELECT '{inspection['id']}', 'material_inspections', '{esc(inspection)}'::jsonb "
                "WHERE NOT EXISTS (SELECT 1 FROM entity_store e2 WHERE e2.id = '" + inspection['id'] + "');"
            )
            run_sql(sql)
            print(f"  检验 {inspection['code']} ({it['material_name']}, {result}) 写入成功")

            stock_record = {
                "id": f"gr-26jlhd017-{po['arrival_code'][-3:]}-{idx}",
                "record_no": f"GR-{po['arrival_code'][3:]}-{idx}",
                "type": "in",
                "subtype": "采购入库",
                "material_id": it["material_id"],
                "quantity": qualified,
                "warehouse": it["warehouse"],
                "location_id": it["location_id"],
                "related_order": po["order_no"],
                "related_order_id": po["id"],
                "contract_no": CONTRACT,
                "handler": INSPECTOR,
                "record_date": po["qualified_date"],
                "remark": "来料检验合格入库",
            }
            # 2) 入库记录 + 库存增加（以入库记录是否存在保证幂等）
            if entity_exists(stock_record["id"]):
                print(f"  入库 {stock_record['record_no']} 已存在，跳过")
            else:
                sql = (
                    "INSERT INTO entity_store (id, entity_type, data) "
                    f"SELECT '{stock_record['id']}', 'stock_records', '{esc(stock_record)}'::jsonb "
                    "WHERE NOT EXISTS (SELECT 1 FROM entity_store e2 WHERE e2.id = '" + stock_record['id'] + "');"
                )
                run_sql(sql)

                # 3) 库存增加合格数量（取该物料最新一条库存记录）
                sql = (
                    "UPDATE entity_store es SET data = jsonb_set(es.data, '{quantity}', "
                    f"to_jsonb((es.data->>'quantity')::int + {qualified})) "
                    "FROM ("
                    "SELECT id FROM entity_store WHERE entity_type = 'inventory' "
                    f"AND data->>'material_id' = '{it['material_id']}' "
                    "ORDER BY created_at DESC LIMIT 1) latest WHERE es.id = latest.id;"
                )
                run_sql(sql)
                print(f"  入库 {stock_record['record_no']} {it['material_name']} +{qualified}{it['unit']}")

        # 写入到货单
        sql = (
            "INSERT INTO entity_store (id, entity_type, data) "
            f"SELECT '{arrival['id']}', 'purchase_arrivals', '{esc(arrival)}'::jsonb "
            "WHERE NOT EXISTS (SELECT 1 FROM entity_store e2 WHERE e2.id = '" + arrival['id'] + "');"
        )
        run_sql(sql)
        print(f"到货单 {arrival['code']} ({po['supplier_name']}, {po['arrival_date']}, 已入库) 写入成功")

        # 4) 回写采购订单 items 的到货/合格/不合格/入库数量
        url = (
            f"{BASE}/rest/v1/entity_store?id=eq.{po['id']}&select=data->items"
        )
        r = requests.get(url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
        r.raise_for_status()
        po_items = (r.json() or [{}])[0].get("items", []) if r.json() else []
        arrival_map = {a["material_id"]: a for a in arrival_items}
        for pi in po_items:
            matched = arrival_map.get(pi.get("material_id"))
            if matched:
                pi["received_qty"] = matched["received_qty"]
                pi["qualified_qty"] = matched["qualified_qty"]
                pi["rejected_qty"] = matched["rejected_qty"]
                pi["stored_qty"] = matched["stored_qty"]
                pi["warehouse"] = matched["warehouse"]
                pi["location_id"] = matched["location_id"]
        payload = json.dumps(po_items, ensure_ascii=False).replace("'", "''")
        sql = (
            f"UPDATE entity_store SET data = jsonb_set(data, '{{items}}', "
            f"'{payload}'::jsonb) WHERE id = '{po['id']}';"
        )
        run_sql(sql)
        print(f"采购订单 {po['order_no']} 到货数量已回写")

    print("26JLHD017 到货与来料检验数据生成完成")


if __name__ == "__main__":
    main()
