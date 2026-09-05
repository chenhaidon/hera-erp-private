#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 26JLHD017 合同的 4 张生产工单工序统一改为沙发垫工艺路线，并在首工序添加少量报工记录"""

import json
import uuid

SOFA_PAD_PROCESS = [
    {"name": "开料", "code": "G-001", "category": "internal", "hours": 0.2, "device": "裁剪机", "skill": "裁剪", "price": 0.5},
    {"name": "电脑绣", "code": "G-008", "category": "outsourcing", "hours": 0.8, "device": "绣花机", "skill": "绣花", "price": 2},
    {"name": "剪边", "code": "G-002", "category": "internal", "hours": 0.1, "device": "剪边机", "skill": "裁剪", "price": 0.3},
    {"name": "包边", "code": "G-003", "category": "internal", "hours": 0.3, "device": "包边机", "skill": "缝制", "price": 0.6},
    {"name": "水洗", "code": "G-010", "category": "outsourcing", "hours": 0.4, "device": "水洗机", "skill": "水洗", "price": 1},
    {"name": "检验", "code": "G-011", "category": "internal", "hours": 0.167, "device": "", "skill": "", "price": 0.5},
    {"name": "包装", "code": "G-007", "category": "internal", "hours": 0.1, "device": "包装线", "skill": "包装", "price": 0.3},
]

FIRST_OP_REPORTS = [
    {"operator_name": "张工", "qty": 12},
    {"operator_name": "李工", "qty": 8},
]

WORK_ORDERS = [
    ("c85e7665-72e6-4bed-be5d-844433428c5f", "f1d72f89-991a-40e6-a59c-16400cf3c1aa", "WO-2026-0017-1", 220),
    ("715576b0-4843-4069-bd25-c393cd96a0d3", "7f459622-da9c-4deb-9a46-7ebea636d6a1", "WO-2026-0017-2", 180),
    ("da77526e-2c58-4ac3-a106-fcc8b8949dfb", "5bfa6778-1cdc-4675-b12f-60d2e9291835", "WO-2026-0017-3", 250),
    ("412632e5-2fe2-4829-88cc-a3566a7d97f4", "642eb4c9-7829-4e29-beca-72c66ffa596b", "WO-2026-0017-4", 200),
]


def build_ops(qty: int):
    reports_total = sum(r["qty"] for r in FIRST_OP_REPORTS)
    ops = []
    for idx, step in enumerate(SOFA_PAD_PROCESS, start=1):
        if idx == 1:
            status = "running"
            completed_qty = reports_total
            reports = [
                {
                    "id": str(uuid.uuid4()),
                    "operator_name": r["operator_name"],
                    "qty": r["qty"],
                    "unit_price": step["price"],
                    "amount": round(r["qty"] * step["price"], 2),
                    "report_time": "2026-08-28T08:30:00+08:00",
                    "work_no": "",
                    "operation_name": step["name"],
                    "operation_code": step["code"],
                }
                for r in FIRST_OP_REPORTS
            ]
        else:
            status = "pending"
            completed_qty = 0
            reports = []
        ops.append({
            "seq": idx,
            "code": step["code"],
            "name": step["name"],
            "category": step["category"],
            "plan_qty": qty,
            "completed_qty": completed_qty,
            "status": status,
            "completed": False,
            "device": step["device"],
            "skill": step["skill"],
            "hours": step["hours"],
            "price": step["price"],
            "reports": reports,
        })
    return ops


sqls = []
for phy_id, es_id, work_no, qty in WORK_ORDERS:
    ops = build_ops(qty)
    completed_qty = sum(r["qty"] for r in FIRST_OP_REPORTS)
    progress = round(completed_qty / qty * 100, 2) if qty > 0 else 0
    ops_json = json.dumps(ops, ensure_ascii=False).replace("'", "''")
    sqls.append(f"""
UPDATE work_orders
SET operations = '{ops_json}'::jsonb,
    completed_quantity = {completed_qty},
    progress = {progress},
    status = 'producing',
    updated_at = now()
WHERE id = '{phy_id}' AND work_no = '{work_no}';

UPDATE entity_store
SET data = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(data, '{{operations}}', '{ops_json}'::jsonb),
            '{{completed_quantity}}', '{completed_qty}'::jsonb
        ),
        '{{progress}}', '{progress}'::jsonb
    ),
    '{{status}}', '"producing"'
)
WHERE id = '{es_id}' AND entity_type = 'work_orders';
""")

with open("/tmp/fix_wo_sofa_pad.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sqls))
print("\n".join(sqls))
