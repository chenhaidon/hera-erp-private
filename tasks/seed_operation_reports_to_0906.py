#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 26JLHD016/017 等活跃合同的各工序补齐 2026-08-29 ~ 2026-09-06 的模拟报工数据。"""

import json
import random
import math
from datetime import date, datetime, timedelta, timezone
import requests

random.seed(42)

BASE = "https://backend.appmiaoda.com/projects/supabase331454395508113408"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsj8FmgzMLaCgXF4LGn0"
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

TARGET_CONTRACTS = ["26JLHD014", "26JLHD016", "26JLHD017", "26JLHD018"]
START_DATE = date(2026, 8, 29)
END_DATE = date(2026, 9, 6)

OPERATOR_POOL = ["张工", "李工", "王工", "赵工", "刘工"]
PRICE_MAP = {
    "G-001": 0.5,  # 开料
    "G-002": 0.3,  # 剪边
    "G-003": 0.6,  # 包边
    "G-007": 0.3,  # 包装
    "G-008": 2.0,  # 电脑绣
    "G-010": 1.0,  # 水洗
    "G-011": 0.4,  # 检验
}


def fmt_iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone(timedelta(hours=8))).isoformat()


def fetch_work_orders():
    contract_filter = ",".join(TARGET_CONTRACTS)
    url = f"{BASE}/rest/v1/entity_store?entity_type=eq.work_orders&data->>contract_no=in.({contract_filter})&select=id,data"
    r = requests.get(url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    r.raise_for_status()
    rows = r.json()
    return [(row["id"], row["data"]) for row in rows]


def generate_daily_qty(remaining: int, days_left: int) -> int:
    if days_left <= 0:
        return remaining
    base = remaining / days_left
    qty = max(1, math.floor(base * random.uniform(0.8, 1.2)))
    return min(qty, remaining)


def process_work_order(wo_id: str, data: dict) -> dict:
    operations = data.get("operations", [])
    if not operations:
        return data

    # 为每个工序按日补齐报工
    for op in operations:
        op["reports"] = list(op.get("reports") or [])
        existing_dates = {
            datetime.fromisoformat(r["report_time"]).date()
            for r in op["reports"]
            if r.get("report_time")
        }
        plan = int(op.get("plan_qty") or 0)
        completed = int(op.get("completed_qty") or 0)
        remaining = max(0, plan - completed)
        code = op.get("code", "")
        unit_price = PRICE_MAP.get(code, 0.5)

        missing_dates = [
            START_DATE + timedelta(days=i)
            for i in range((END_DATE - START_DATE).days + 1)
            if (START_DATE + timedelta(days=i)) not in existing_dates
        ]

        # 只在还有余量且存在缺失日期时生成新报工记录
        if missing_dates and remaining > 0:
            # 控制最后一天也留一些余量，避免提前一天完成导致后续日期无记录
            for idx, d in enumerate(missing_dates):
                days_left = len(missing_dates) - idx
                day_total = generate_daily_qty(remaining, days_left)
                if day_total <= 0:
                    break

                # 每天 1~3 人报工
                n = min(random.randint(1, 3), len(OPERATOR_POOL))
                ops_today = random.sample(OPERATOR_POOL, n)
                shares = [random.random() for _ in range(n)]
                total_weight = sum(shares)
                qtys = [max(1, round(day_total * w / total_weight)) for w in shares]
                # 修正舍入误差
                diff = day_total - sum(qtys)
                if diff != 0:
                    qtys[0] += diff

                for operator, qty in zip(ops_today, qtys):
                    if qty <= 0:
                        continue
                    hour = random.randint(8, 16)
                    minute = random.randint(0, 59)
                    second = random.randint(0, 59)
                    report_time = fmt_iso(datetime(d.year, d.month, d.day, hour, minute, second))
                    op["reports"].append({
                        "id": f"rpt-{wo_id[-8:]}-{op['code']}-{d.strftime('%Y%m%d')}-{operator}",
                        "operator_id": None,
                        "operator_name": operator,
                        "qty": qty,
                        "unit_price": unit_price,
                        "amount": round(qty * unit_price, 2),
                        "report_time": report_time,
                        "work_no": data.get("work_no"),
                        "operation_name": op["name"],
                        "operation_code": op["code"],
                    })
                remaining -= day_total

        # 重新计算工序完成数与状态
        op["completed_qty"] = sum(r["qty"] for r in op["reports"])
        op["completed"] = op["completed_qty"] >= plan
        if op["completed"]:
            op["status"] = "completed"
        elif op["completed_qty"] > 0:
            op["status"] = "running"
        else:
            op["status"] = "pending"

        # 按报工时间排序
        op["reports"].sort(key=lambda r: r["report_time"])

    # 重新计算工单总体进度
    operations_sorted = sorted(operations, key=lambda o: o.get("seq", 0))
    last_op = operations_sorted[-1] if operations_sorted else None
    completed_quantity = int(last_op["completed_qty"]) if last_op else 0
    progress = 0
    if operations:
        progress = round(
            sum(min((o.get("completed_qty", 0) / max(o.get("plan_qty", 1), 1)), 1.0) for o in operations)
            / len(operations) * 100
        )
    all_closed = all(o.get("status") in ("completed", "closed") for o in operations)
    any_running = any(o.get("status") in ("running", "qc", "pending_start") for o in operations)

    new_status = data.get("status")
    if all_closed:
        if new_status not in ("inbound", "closed"):
            new_status = "qc"
    elif data.get("status") == "paused":
        new_status = "paused"
    elif any_running:
        new_status = "producing"
    elif all(o.get("status") == "pending" for o in operations):
        new_status = "pending"

    data["completed_quantity"] = completed_quantity
    data["progress"] = progress
    data["status"] = new_status
    data["operations"] = operations
    return data


def update_work_order(wo_id: str, data: dict):
    payload = json.dumps(data, ensure_ascii=False).replace("'", "''")
    sql = f"UPDATE entity_store SET data = '{payload}'::jsonb WHERE id = '{wo_id}';"
    r = requests.post(f"{BASE}/rest/v1/rpc/execute_sql", headers=HEADERS, json={"sql_text": sql})
    print(wo_id, r.status_code, r.text[:120] if r.text else "OK")


def main():
    rows = fetch_work_orders()
    print(f"找到 {len(rows)} 张目标工单")
    for wo_id, data in rows:
        new_data = process_work_order(wo_id, data)
        update_work_order(wo_id, new_data)
    print("报工模拟数据补齐完成")


if __name__ == "__main__":
    main()
