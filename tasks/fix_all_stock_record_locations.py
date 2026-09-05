#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为所有仓库中缺少库位的出入库记录补齐库位信息。"""

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
    # 获取所有库位
    url = f"{BASE}/rest/v1/entity_store?entity_type=eq.warehouse_locations&select=id,warehouse:data->>warehouse,code:data->>code"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    locations = r.json()
    loc_map = {}
    for loc in locations:
        loc_map.setdefault(loc["warehouse"], []).append(loc)
    for wh, locs in loc_map.items():
        loc_map[wh] = sorted(locs, key=lambda x: x.get("code") or x["id"])

    # 获取所有未分配库位的出入库记录
    url = (
        f"{BASE}/rest/v1/entity_store?entity_type=eq.stock_records&"
        "or=(data->>location_id.is.null,data->>location_id.eq.'')&"
        "select=id,warehouse:data->>warehouse,data"
    )
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    rows = r.json()
    print(f"未分配库位记录共 {len(rows)} 条")

    counts = {}
    for row in rows:
        wh = row.get("warehouse") or "未分类"
        locs = loc_map.get(wh)
        if not locs:
            print(f"警告：仓库 {wh} 未找到库位，跳过 {row['id']}")
            continue
        idx = counts.get(wh, 0)
        loc = locs[idx % len(locs)]
        counts[wh] = idx + 1

        data = row.get("data", {})
        data["location_id"] = loc["id"]
        data["location_name"] = loc.get("code") or loc["id"]
        payload = json.dumps(data, ensure_ascii=False).replace("'", "''")
        sql = f"UPDATE entity_store SET data = '{payload}'::jsonb WHERE id = '{row['id']}'"
        run_sql(sql)

    print("库位补齐完成")
    for wh, n in sorted(counts.items()):
        print(f"  {wh}: {n} 条")


if __name__ == "__main__":
    main()
