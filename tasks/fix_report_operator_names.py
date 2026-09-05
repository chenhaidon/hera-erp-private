#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将报工记录中的占位姓名（刘工/李工/赵工/王工/张工）替换为用户档案中生产部的真实员工姓名。"""

import json
import random

import requests

BASE = "https://backend.appmiaoda.com/projects/supabase331454395508113408"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsj8FmgzMLaCgXF4LGn0"
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

PLACEHOLDERS = {"刘工", "李工", "赵工", "王工", "张工"}


def run_sql(sql: str):
    r = requests.post(f"{BASE}/rest/v1/rpc/execute_sql", headers=HEADERS, json={"sql_text": sql})
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"SQL {r.status_code}: {r.text[:300]}")


def main():
    # 获取生产部员工
    url = (
        f"{BASE}/rest/v1/entity_store?"
        "or=(entity_type.eq.employees,entity_type.eq.users)&"
        "data->>department=eq.生产部&select=id,data->>name"
    )
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    employees = r.json()
    names = [e["name"] for e in employees]
    if not names:
        print("未找到生产部员工")
        return
    print(f"生产部员工 {len(names)} 人")

    # 获取所有生产工单
    url = f"{BASE}/rest/v1/entity_store?entity_type=eq.work_orders&select=id,data"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    rows = r.json()

    random.seed(42)
    updated_count = 0

    for row in rows:
        data = row.get("data", {})
        ops = data.get("operations", [])
        modified = False
        for op in ops:
            for rep in op.get("reports", []):
                oname = rep.get("operator_name", "")
                if oname in PLACEHOLDERS:
                    new_name = random.choice(names)
                    new_id = next((e["id"] for e in employees if e["name"] == new_name), None)
                    rep["operator_name"] = new_name
                    rep["operator_id"] = new_id
                    modified = True
                    updated_count += 1
        if modified:
            payload = json.dumps(data, ensure_ascii=False).replace("'", "''")
            sql = f"UPDATE entity_store SET data = '{payload}'::jsonb WHERE id = '{row['id']}'"
            run_sql(sql)

    print(f"更新 {updated_count} 条报工记录")


if __name__ == "__main__":
    main()
