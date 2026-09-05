#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把考勤记录从 2026-08-27 连续补齐到 2026-09-06（含），共 11 天，41 名员工。"""

import json
import random
import uuid
from datetime import date, timedelta
import requests

random.seed(42)

url = "https://backend.appmiaoda.com/projects/supabase331454395508113408/rest/v1/rpc/execute_sql"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsj8FmgzMLaCgXF4LGn0"
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# 当前考勤记录中的 41 名员工
employees = [
    {"employee_id": "LNBlSBh_3qKq2PIIft9ju", "employee_name": "于娟英"},
    {"employee_id": "I6JsiHPF58sZF-iUGfMnk", "employee_name": "于松灰"},
    {"employee_id": "13c2579c-d49b-4f90-813e-e596bd1e7aee", "employee_name": "于能静"},
    {"employee_id": "6777c7c0-5655-4724-9f8e-df63c9586999", "employee_name": "于裕民"},
    {"employee_id": "7bee1e5b-91cc-417c-9ae5-f3152c23d65b", "employee_name": "何光丰"},
    {"employee_id": "22eed93d-9508-4adb-8c30-6bf1b54784a8", "employee_name": "刘桂兰"},
    {"employee_id": "31d595c6-d6cf-4eee-a540-6ea38d03cc59", "employee_name": "吴德明"},
    {"employee_id": "2fc4629c-9ec1-4aa9-8354-3f0b60401b6b", "employee_name": "周凤莲"},
    {"employee_id": "a04382e0-981a-47c6-8589-cb7b9bebb2a2", "employee_name": "周强"},
    {"employee_id": "dbb5918a-34b4-4bbe-a467-b91a002986f1", "employee_name": "孙丽"},
    {"employee_id": "8626ded5-184b-46cc-8d22-b7851205f9c2", "employee_name": "孙长贵"},
    {"employee_id": "W7VV5LotueOTiHrGQEZr9", "employee_name": "季项农"},
    {"employee_id": "USicMLjAzaF8wbDPYdIwA", "employee_name": "应巧凤"},
    {"employee_id": "3392163e-016f-474c-8dd1-11f00b8e71cc", "employee_name": "张伟嫦"},
    {"employee_id": "0ff9a248-2418-42db-92fd-28b2c60de100", "employee_name": "张卫国"},
    {"employee_id": "9117943d-6245-40a9-bca8-b7ba195fe4db", "employee_name": "张杰"},
    {"employee_id": "uGOgVcduB26ljUtPJX-Sp", "employee_name": "张梦瑶"},
    {"employee_id": "237b6f20-dded-41c7-9817-762aa1934e26", "employee_name": "徐宝根"},
    {"employee_id": "mYnRTnmOyQIe6YSSdLYEu", "employee_name": "方自伟"},
    {"employee_id": "a2d9377c-6b89-4e7e-9af3-435c03d38d9d", "employee_name": "李秀英"},
    {"employee_id": "pWAd-_utnTN2M27jqWqPd", "employee_name": "杨云岩"},
    {"employee_id": "2d27fcc9-b23c-4da6-8d2f-455bbb55da9f", "employee_name": "王建国"},
    {"employee_id": "4b368add-ceb1-4fb3-8955-7c64b93fb22d", "employee_name": "王芳"},
    {"employee_id": "7cd5997a-2c20-41a4-857d-03f18801977c", "employee_name": "盛能镰"},
    {"employee_id": "59ee04e3-fb7e-4fe3-b5bb-cfaa9424104c", "employee_name": "盛顺利"},
    {"employee_id": "b07a5d97-149d-443e-9f81-3ff6add3136b", "employee_name": "胡满仓"},
    {"employee_id": "22b0376f-7966-4e29-a5ed-17cd1496fe53", "employee_name": "蒋佳男"},
    {"employee_id": "e9c1cbe5-eba2-414a-af7f-f1c60c9e4bea", "employee_name": "赵燕萍"},
    {"employee_id": "5c0e0af0-919d-4a96-9df4-af0df93f7516", "employee_name": "赵秀珍"},
    {"employee_id": "17019fd1-eed7-4502-84f5-b6b78aa5ac7a", "employee_name": "郑春娣"},
    {"employee_id": "M8qHQaB5oqnsc0Kpo7E_r", "employee_name": "金家华"},
    {"employee_id": "dbf58973-8270-49b6-81e7-16adba416bb9", "employee_name": "金灵芳"},
    {"employee_id": "UvY-Q9PzDa899WiBR6_5E", "employee_name": "陈恒"},
    {"employee_id": "cefb9e56-a0b0-4746-a6e5-82c3f50eb051", "employee_name": "陈海涛"},
    {"employee_id": "HJ6OmTJ7Z3d1ZStnurV1P", "employee_name": "陈红星"},
    {"employee_id": "fff9befe-ba47-4490-b010-1623b76b291f", "employee_name": "马志强"},
    {"employee_id": "4f2f42a3-c1eb-4f95-8ebb-e64e69ae18a3", "employee_name": "高巧云"},
    {"employee_id": "fdc0eca8-c277-4880-93e9-4b6deeaada7b", "employee_name": "黄美娟"},
    {"employee_id": "ddf3cdfc-74ec-498d-a8b9-3562309b6307", "employee_name": "黄超灵"},
    {"employee_id": "1d4f67ba-a6d1-46b8-b386-014fa8a6c82c", "employee_name": "黄闰壻"},
    {"employee_id": "7190dcd4-c286-4f07-bed3-dd648b12927c", "employee_name": "龙亚宇"},
]

start = date(2026, 8, 27)
end = date(2026, 9, 6)

records = []
for d in [start + timedelta(days=i) for i in range((end - start).days + 1)]:
    date_str = d.isoformat()
    for emp in employees:
        # 少量随机迟到/缺勤，使数据更真实
        r_val = random.random()
        if r_val < 0.92:
            status = "normal"
        elif r_val < 0.97:
            status = "late"
        else:
            status = "absent"

        if status == "absent":
            check_in = ""
            check_out = ""
        else:
            if status == "late":
                check_in = f"08:{random.randint(5, 30):02d}"
            else:
                check_in = f"07:{random.randint(30, 58):02d}"
            check_out = f"17:{random.randint(0, 30):02d}"

        record = {
            "id": f"att-{d.strftime('%Y%m%d')}-{emp['employee_id'][:8]}",
            "employee_id": emp["employee_id"],
            "employee_name": emp["employee_name"],
            "record_date": date_str,
            "check_in": check_in,
            "check_out": check_out,
            "status": status,
        }
        records.append(record)


def to_sql_insert(rec):
    payload = json.dumps(rec, ensure_ascii=False).replace("'", "''")
    return f"INSERT INTO entity_store (id, entity_type, data) VALUES ('{rec['id']}', 'attendance_records', '{payload}'::jsonb);"


batch_size = 100
batches = [records[i:i + batch_size] for i in range(0, len(records), batch_size)]
for batch in batches:
    sql = "\n".join(to_sql_insert(r) for r in batch)
    rr = requests.post(url, headers=headers, json={"sql_text": sql})
    print(rr.status_code, rr.text[:120])

print(f"已生成 {len(records)} 条考勤记录")
