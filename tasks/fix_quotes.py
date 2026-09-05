#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复 QO-26JLHD017/018 报价单：补齐 Quotation 结构必填字段，消除报价单页面 undefined.includes 崩溃"""

import json
from datetime import date, timedelta

QUOTES = [
    ("bb883eb7-9171-468d-a164-1a97472591fb", "26JLHD017", 118200, date(2026, 8, 27)),
    ("1bcfe497-eef9-4555-853d-2e63988eaa06", "26JLHD018", 113780, date(2026, 9, 3)),
]

sqls = []
for qid, no, amount, sign in QUOTES:
    total_cost = round(amount * 0.82)
    delivery = str(sign + timedelta(days=25))
    # 静态字段：用 || 合并，避免对同一列多次赋值
    patch = {
        "quotation_no": f"QT-{no}-001",
        "sku_id": "",
        "sku_specification": "",
        "estimated_delivery_date": delivery,
        "creator": "邵常青",
        "updated_at": f"{sign}T00:00:00+08:00",
        "target_profit_rate": 0.22,
        "fabric_loss_rate": 0.05,
        "batch_factor": 0,
        "delivery_days": 25,
        "total_cost": total_cost,
        "suggested_price": amount,
        "estimated_profit": amount - total_cost,
        "actual_profit_rate": 0.22,
        "cost_items": [],
        "approval_logs": [],
        "version_logs": [],
    }
    patch_json = json.dumps(patch, ensure_ascii=False).replace("'", "''")

    # 动态字段：quantity 从 items 汇总，product_* 取第一个 item
    items_expr = "(CASE WHEN jsonb_typeof(data->'items') = 'array' THEN data->'items' ELSE '[]'::jsonb END)"
    qty_expr = f"(COALESCE((SELECT SUM((e->>'quantity')::numeric) FROM jsonb_array_elements({items_expr}) e), 0)::text::jsonb)"
    # product_* 转为 jsonb 字符串（to_jsonb 自动处理转义）
    expr = f"(data || '{patch_json}'::jsonb)"
    expr = f"jsonb_set({expr}, '{{quantity}}', {qty_expr})"
    for f in ("product_id", "product_code", "product_name"):
        val_expr = f"to_jsonb(COALESCE(data->'items'->0->>'{f}', ''))"
        expr = f"jsonb_set({expr}, '{{{f}}}', {val_expr})"

    sqls.append(f"UPDATE entity_store SET data = {expr} WHERE id = '{qid}' AND entity_type = 'quotes';")

with open("/tmp/fix_quotes.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sqls) + "\n")
print("\n".join(sqls))

