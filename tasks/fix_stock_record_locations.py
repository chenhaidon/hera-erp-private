#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为成品仓中缺少库位的出入库记录补齐库位信息。"""

import json

import requests

BASE = "https://backend.appmiaoda.com/projects/supabase331454395508113408"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsj8FmgzMLaCgXF4LGn0"
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def run_sql(sql: str):
    r = requests.post(f"{BASE}/rest/v1/rpc/execute_sql", headers=HEADERS, json={"sql_text": sql})
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"SQL {r.status_code}: {r.text[:300]}")


def main():
    # 获取成品仓库位
    url = (
        f"{BASE}/rest/v1/entity_store?entity_type=eq.warehouse_locations&"
        "data->>warehouse=eq.成品仓&select=id,code:data->>code"
    )
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    locations = r.json()
    if not locations:
        print("未找到成品仓库位")
        return
    locations = sorted(locations, key=lambda x: x.get("code") or "")
    print(f"成品仓库位 {len(locations)} 个")

    # 获取成品仓未分配库位的出入库记录
    url = (
        f"{BASE}/rest/v1/entity_store?entity_type=eq.stock_records&"
        "data->>warehouse=eq.成品仓&"
        "or=(data->>location_id.is.null,data->>location_id.eq.'')&"
        "select=id,data"
    )
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    rows = r.json()
    print(f"成品仓未分配库位记录 {len(rows)} 条")

    for idx, row in enumerate(rows):
        data = row.get("data", {})
        loc = locations[idx % len(locations)]
        data["location_id"] = loc["id"]
        data["location_name"] = loc.get("code") or loc["id"]
        payload = json.dumps(data, ensure_ascii=False).replace("'", "''")
        sql = f"UPDATE entity_store SET data = '{payload}'::jsonb WHERE id = '{row['id']}'"
        run_sql(sql)

    print("库位补齐完成")


if __name__ == "__main__":
    main()
