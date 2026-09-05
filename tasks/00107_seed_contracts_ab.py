#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成合同 A/B 全链路造数 SQL
- 合同 A：26JLHD017，2026-08-27 签订，金额约 11.82 万
- 合同 B：26JLHD018，2026-09-03 签订，金额约 11.38 万
- 含：客户、合同、报价单、销售订单、主生产计划、采购订单、来料质检、采购入库、生产工单、领料单、出库记录、应付账款、库存更新
"""

import uuid
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).with_suffix(".sql")

# ---------- 基础数据 ----------
# 产品（来自 products 物理表）
PRODUCTS = {
    "nordic_quilt": {
        "id": "a6101474-bfe3-44f0-958e-864f8db20973",
        "code": "JF-2026-001",
        "name": "北欧风绗缝被",
        "category": "绗缝被",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg",
        "process_list": ["面料检验", "裁剪", "拼接", "绗缝", "包边", "水洗", "整烫定型", "检验", "包装"],
    },
    "sofa_pad": {
        "id": "4b97a885-5821-4a5b-a940-6761236be86a",
        "code": "JF-2026-003",
        "name": "云朵沙发垫",
        "category": "沙发垫",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_ac3ea6fc-b63f-4036-bc6c-1eadd52cd78a.jpg",
        "process_list": ["面料检验", "裁剪", "绗缝", "包边", "检验", "包装"],
    },
    "bedding_set": {
        "id": "a7d31069-5882-44e3-a6a1-af899679abb7",
        "code": "JF-2026-002",
        "name": "亲肤四件套",
        "category": "四件套",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_d830d123-4c83-4c21-9b36-cbc29a27b27d.jpg",
        "process_list": ["面料检验", "裁剪", "缝制", "整烫", "包装"],
    },
    "kids_quilt": {
        "id": "66d51cc0-c2c9-491f-85c6-d9ff9aea3a52",
        "code": "JF-2026-004",
        "name": "儿童绗缝童被",
        "category": "童被套件",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b22959d2-67cb-435c-9234-5f55fd8aa064.jpg",
        "process_list": ["面料检验", "裁剪", "绣花", "拼接", "绗缝", "包边", "水洗", "整烫", "检验", "包装"],
    },
    "cushion": {
        "id": "c7082434-32f6-4686-82ff-07be24ae4847",
        "code": "JF-2026-026",
        "name": "新中式靠垫系列",
        "category": "靠垫",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg",
        "process_list": ["面料检验", "裁剪", "缝纫", "填充", "封口", "包装"],
    },
    "ac_quilt": {
        "id": "0a0fa31c-da3e-4c97-a97b-160eed818de8",
        "code": "JF-2026-030",
        "name": "国潮空调被",
        "category": "空调被",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg",
        "process_list": ["面料检验", "裁剪", "拼接", "绗缝", "包边", "检验", "包装"],
    },
    "mattress": {
        "id": "e317023a-c52a-4f9e-858b-cb3a7118dac6",
        "code": "JF-2026-016",
        "name": "印花绗缝床垫",
        "category": "绗缝床垫",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg",
        "process_list": ["面料检验", "裁剪", "绗缝", "包边", "检验", "包装"],
    },
    "biz_sofa_pad": {
        "id": "2ed0ff7a-1220-491a-aae1-fb2d9ff86b46",
        "code": "JF-2026-034",
        "name": "商务沙发垫",
        "category": "沙发垫",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_ac3ea6fc-b63f-4036-bc6c-1eadd52cd78a.jpg",
        "process_list": ["面料检验", "裁剪", "绗缝", "包边", "检验", "包装"],
    },
    "retro_bedcover": {
        "id": "f42f82ee-75ff-4d99-a6d0-92b62c198abf",
        "code": "JF-2026-012",
        "name": "复古床盖",
        "category": "床盖",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg",
        "process_list": ["面料检验", "裁剪", "缝制", "整烫", "检验", "包装"],
    },
    "striped_ac_quilt": {
        "id": "ba365487-984a-498d-86ca-eb64ce813362",
        "code": "JF-2026-018",
        "name": "条纹空调被",
        "category": "空调被",
        "image": "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg",
        "process_list": ["面料检验", "裁剪", "拼接", "绗缝", "包边", "检验", "包装"],
    },
}

# 物料（来自 materials 物理表）
MATERIALS = {
    "cotton_fabric": {
        "id": "488010dc-5779-4a00-b701-46f9dc7f4d3d",
        "code": "MT-001",
        "name": "纯棉面料",
        "spec": "幅宽240cm 克重120g",
        "unit": "米",
        "warehouse": "面料仓",
    },
    "velvet_fabric": {
        "id": "22ba7c4a-0443-45a3-9373-d6590b5856c7",
        "code": "MT-002",
        "name": "绒布面料",
        "spec": "幅宽220cm 克重200g",
        "unit": "米",
        "warehouse": "面料仓",
    },
    "spray_cotton": {
        "id": "49a7ec69-6b61-4846-8336-ce3d02695739",
        "code": "MT-003",
        "name": "喷胶棉",
        "spec": "克重300g/㎡",
        "unit": "kg",
        "warehouse": "填充仓",
    },
    "down": {
        "id": "05760f96-0da6-45c5-ae8a-fdc78439d076",
        "code": "MT-004",
        "name": "羽绒",
        "spec": "80%白鸭绒",
        "unit": "kg",
        "warehouse": "填充仓",
    },
    "zipper": {
        "id": "bcb31f5a-29ca-4320-8e3a-ddf89aaee11a",
        "code": "MT-005",
        "name": "拉链",
        "spec": "3号尼龙拉链",
        "unit": "条",
        "warehouse": "辅料仓",
    },
    "chunya": {
        "id": "c6a0d864-c86c-4e2f-b843-2e0d9d03a498",
        "code": "MT-D2115D11",
        "name": "春亚纺",
        "spec": "幅宽2.8m",
        "unit": "米",
        "warehouse": "面料仓",
    },
}

# 松紧绳为新物料，动态生成 ID
elastic_rope_id = str(uuid.uuid4())
MATERIALS["elastic_rope"] = {
    "id": elastic_rope_id,
    "code": "MT-006",
    "name": "松紧绳",
    "spec": "5mm 圆松紧带",
    "unit": "米",
    "warehouse": "辅料仓",
}

# 供应商
SUPPLIERS = {
    "huafang": {
        "id": "309e568b-d4f0-494e-964a-3fb052482da7",
        "name": "华纺原料",
    },
    "xinmian": {
        "id": "567e47de-02ca-4e16-aed7-8604b4a12418",
        "name": "新棉填充",
    },
    "shunda": {
        "id": "94a554cb-0b20-42a2-9bff-0525ebed080f",
        "name": "顺达辅料",
    },
}

# 客户（新建）
CUSTOMERS = {
    "a": {
        "id": str(uuid.uuid4()),
        "name": "浙江悦享家居有限公司",
        "contact": "陈经理",
        "phone": "0579-55668899",
        "address": "浙江省杭州市余杭区家纺城A座",
        "country": "中国",
        "customer_type": "品牌商",
    },
    "b": {
        "id": str(uuid.uuid4()),
        "name": "上海美居生活科技有限公司",
        "contact": "刘总监",
        "phone": "021-99887766",
        "address": "上海市浦东新区张江高科园区",
        "country": "中国",
        "customer_type": "贸易商",
    },
}

# ---------- 合同明细 ----------
CONTRACT_A = {
    "no": "26JLHD017",
    "title": "多品类家纺产品采购合同（A）",
    "sign_date": date(2026, 8, 27),
    "items": [
        {"sku": "nordic-quilt-200230", "product_key": "nordic_quilt", "size": "200×230cm", "color": "米白", "qty": 220, "unit_price": 198},
        {"sku": "bedding-set-18", "product_key": "bedding_set", "size": "1.8m床", "color": "浅灰", "qty": 180, "unit_price": 228},
        {"sku": "sofa-pad-9090", "product_key": "sofa_pad", "size": "90×90cm", "color": "卡其", "qty": 250, "unit_price": 88},
        {"sku": "cushion-6060", "product_key": "cushion", "size": "60×60cm", "color": "藏青", "qty": 200, "unit_price": 58},
    ],
}

CONTRACT_B = {
    "no": "26JLHD018",
    "title": "精品家纺系列产品采购合同（B）",
    "sign_date": date(2026, 9, 3),
    "items": [
        {"sku": "ac-quilt-200230", "product_key": "ac_quilt", "size": "200×230cm", "color": "墨绿", "qty": 200, "unit_price": 158},
        {"sku": "mattress-150200", "product_key": "mattress", "size": "150×200cm", "color": "浅粉", "qty": 180, "unit_price": 128},
        {"sku": "biz-sofa-pad-90180", "product_key": "biz_sofa_pad", "size": "90×180cm", "color": "深灰", "qty": 220, "unit_price": 68},
        {"sku": "retro-bedcover-230250", "product_key": "retro_bedcover", "size": "230×250cm", "color": "米黄", "qty": 150, "unit_price": 158},
        {"sku": "striped-ac-quilt-180220", "product_key": "striped_ac_quilt", "size": "180×220cm", "color": "蓝白", "qty": 160, "unit_price": 128},
    ],
}

for c in [CONTRACT_A, CONTRACT_B]:
    c["amount"] = sum(i["qty"] * i["unit_price"] for i in c["items"])


# ---------- 采购订单设计 ----------
# A：已下达并到货入库
PO_A = [
    {
        "no": "PO-26JLHD017-001",
        "supplier": "huafang",
        "issue_date": date(2026, 8, 28),
        "arrival_date": date(2026, 9, 2),
        "status": "completed",
        "items": [
            {"material_key": "cotton_fabric", "qty": 1700, "unit_price": 12},
            {"material_key": "velvet_fabric", "qty": 500, "unit_price": 15},
        ],
    },
    {
        "no": "PO-26JLHD017-002",
        "supplier": "xinmian",
        "issue_date": date(2026, 8, 28),
        "arrival_date": date(2026, 9, 3),
        "status": "completed",
        "items": [
            {"material_key": "spray_cotton", "qty": 260, "unit_price": 22},
            {"material_key": "down", "qty": 40, "unit_price": 80},
        ],
    },
    {
        "no": "PO-26JLHD017-003",
        "supplier": "shunda",
        "issue_date": date(2026, 8, 29),
        "arrival_date": date(2026, 9, 2),
        "status": "completed",
        "items": [
            {"material_key": "zipper", "qty": 200, "unit_price": 0.5},
            {"material_key": "elastic_rope", "qty": 1000, "unit_price": 2},
            {"material_key": "chunya", "qty": 300, "unit_price": 16},
        ],
    },
]

# B：已下达但未到货
PO_B = [
    {
        "no": "PO-26JLHD018-001",
        "supplier": "huafang",
        "issue_date": date(2026, 9, 4),
        "expected_date": date(2026, 9, 9),
        "status": "approved",
        "items": [
            {"material_key": "cotton_fabric", "qty": 2000, "unit_price": 12},
            {"material_key": "velvet_fabric", "qty": 600, "unit_price": 15},
        ],
    },
    {
        "no": "PO-26JLHD018-002",
        "supplier": "xinmian",
        "issue_date": date(2026, 9, 4),
        "expected_date": date(2026, 9, 10),
        "status": "approved",
        "items": [
            {"material_key": "spray_cotton", "qty": 300, "unit_price": 22},
            {"material_key": "down", "qty": 80, "unit_price": 80},
        ],
    },
    {
        "no": "PO-26JLHD018-003",
        "supplier": "shunda",
        "issue_date": date(2026, 9, 4),
        "expected_date": date(2026, 9, 9),
        "status": "approved",
        "items": [
            {"material_key": "zipper", "qty": 300, "unit_price": 0.5},
            {"material_key": "elastic_rope", "qty": 1200, "unit_price": 2},
            {"material_key": "chunya", "qty": 500, "unit_price": 16},
        ],
    },
]

# ---------- 生产工单 / 领料设计（仅 A） ----------
WORK_ORDERS_A = [
    {
        "no": "WO-2026-0017-1",
        "product_key": "nordic_quilt",
        "sku": "nordic-quilt-200230",
        "size": "200×230cm",
        "qty": 220,
        "start": date(2026, 8, 30),
        "end": date(2026, 9, 10),
        "materials": [
            {"material_key": "cotton_fabric", "qty": 770},
            {"material_key": "spray_cotton", "qty": 132},
        ],
    },
    {
        "no": "WO-2026-0017-2",
        "product_key": "bedding_set",
        "sku": "bedding-set-18",
        "size": "1.8m床",
        "qty": 180,
        "start": date(2026, 8, 30),
        "end": date(2026, 9, 10),
        "materials": [
            {"material_key": "cotton_fabric", "qty": 900},
        ],
    },
    {
        "no": "WO-2026-0017-3",
        "product_key": "sofa_pad",
        "sku": "sofa-pad-9090",
        "size": "90×90cm",
        "qty": 250,
        "start": date(2026, 8, 31),
        "end": date(2026, 9, 12),
        "materials": [
            {"material_key": "velvet_fabric", "qty": 500},
            {"material_key": "spray_cotton", "qty": 125},
        ],
    },
    {
        "no": "WO-2026-0017-4",
        "product_key": "cushion",
        "sku": "cushion-6060",
        "size": "60×60cm",
        "qty": 200,
        "start": date(2026, 8, 31),
        "end": date(2026, 9, 12),
        "materials": [
            {"material_key": "chunya", "qty": 300},
            {"material_key": "down", "qty": 40},
            {"material_key": "zipper", "qty": 200},
        ],
    },
]


# ---------- 辅助函数 ----------
def esc(s):
    return str(s).replace("'", "''") if s is not None else ""


def json_item(obj):
    """将 dict/list 转为可插入的 jsonb 字符串（简单版）"""
    import json
    return json.dumps(obj, ensure_ascii=False)


def build_contract_items(contract):
    out = []
    for idx, it in enumerate(contract["items"], 1):
        p = PRODUCTS[it["product_key"]]
        out.append({
            "seq": idx,
            "product_id": p["id"],
            "product_code": p["code"],
            "product_name": p["name"],
            "sku": it["sku"],
            "size": it["size"],
            "color": it["color"],
            "spec": it["size"],
            "quantity": it["qty"],
            "unit_price": it["unit_price"],
            "amount": it["qty"] * it["unit_price"],
            "unit": "件",
            "image": p["image"],
        })
    return out


def build_sales_items(contract):
    out = []
    for idx, it in enumerate(contract["items"], 1):
        p = PRODUCTS[it["product_key"]]
        out.append({
            "seq": idx,
            "product_id": p["id"],
            "product_code": p["code"],
            "product_name": p["name"],
            "sku_id": it["sku"],
            "sku_summary": f"{it['size']} / {it['color']}",
            "size": it["size"],
            "color": it["color"],
            "quantity": it["qty"],
            "unit_price": it["unit_price"],
            "amount": it["qty"] * it["unit_price"],
            "unit": "件",
            "image": p["image"],
        })
    return out


def build_operations(process_list, qty):
    """根据产品工序生成工单工序；首道工序待开工，第二道工序生产中，其余未开始，使父级状态显示为生产中。"""
    ops = []
    n = len(process_list)
    for idx, name in enumerate(process_list, start=1):
        if n == 1:
            status = "running"
        elif idx == 1:
            status = "pending_start"
        elif idx == 2:
            status = "running"
        else:
            status = "pending"
        ops.append({
            "name": name,
            "code": f"OP-{idx:02d}",
            "seq": idx,
            "plan_qty": qty,
            "completed_qty": 0,
            "status": status,
            "completed": False,
        })
    return ops


# 26JLHD017 合同统一使用图片所示沙发垫工艺路线，并在首工序预置少量报工记录
SOFA_PAD_PROCESS = [
    {"name": "开料", "code": "G-001", "category": "internal", "hours": 0.2, "device": "裁剪机", "skill": "裁剪", "price": 0.5},
    {"name": "电脑绣", "code": "G-008", "category": "outsourcing", "hours": 0.8, "device": "绣花机", "skill": "绣花", "price": 2},
    {"name": "剪边", "code": "G-002", "category": "internal", "hours": 0.1, "device": "剪边机", "skill": "裁剪", "price": 0.3},
    {"name": "包边", "code": "G-003", "category": "internal", "hours": 0.3, "device": "包边机", "skill": "缝制", "price": 0.6},
    {"name": "水洗", "code": "G-010", "category": "outsourcing", "hours": 0.4, "device": "水洗机", "skill": "水洗", "price": 1},
    {"name": "检验", "code": "G-011", "category": "internal", "hours": 0.167, "device": "", "skill": "", "price": 0.5},
    {"name": "包装", "code": "G-007", "category": "internal", "hours": 0.1, "device": "包装线", "skill": "包装", "price": 0.3},
]

SOFA_PAD_FIRST_REPORTS = [
    {"operator_name": "张工", "qty": 12},
    {"operator_name": "李工", "qty": 8},
]


def build_sofa_pad_operations(qty, work_no, start):
    """生成沙发垫工艺路线工序，并在首工序内置少量报工记录。"""
    reports_total = sum(r["qty"] for r in SOFA_PAD_FIRST_REPORTS)
    report_time = f"{start}T08:30:00+08:00"
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
                    "report_time": report_time,
                    "work_no": work_no,
                    "operation_name": step["name"],
                    "operation_code": step["code"],
                }
                for r in SOFA_PAD_FIRST_REPORTS
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
    return ops, reports_total


def sql_insert(table, cols, vals):
    return f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(vals)});"


def gen_uuid():
    return str(uuid.uuid4())


# ---------- 生成 SQL ----------
lines = ["-- 客户、新物料", ""]

# 客户
for k, c in CUSTOMERS.items():
    lines.append(sql_insert(
        "customers",
        ["id", "name", "contact", "phone", "address", "country", "customer_type"],
        [f"'{c['id']}'", f"'{esc(c['name'])}'", f"'{esc(c['contact'])}'", f"'{esc(c['phone'])}'", f"'{esc(c['address'])}'", f"'{esc(c['country'])}'", f"'{esc(c['customer_type'])}'"],
    ))

# 新物料松紧绳
m = MATERIALS["elastic_rope"]
lines.append(sql_insert(
    "materials",
    ["id", "code", "name", "category", "specification", "unit", "stock", "status"],
    [f"'{m['id']}'", f"'{m['code']}'", f"'{esc(m['name'])}'", "'辅料'", f"'{esc(m['spec'])}'", f"'{esc(m['unit'])}'", "0", "'active'"],
))
lines.append("")

# entity_store 新增物料
lines.append(sql_insert(
    "entity_store",
    ["id", "entity_type", "data"],
    [f"'{m['id']}'", "'materials'", f"'{json_item({'id': m['id'], 'code': m['code'], 'name': m['name'], 'category': '辅料', 'specification': m['spec'], 'unit': m['unit'], 'stock': 0, 'status': 'active', 'created_at': '2026-08-27T00:00:00+08:00', 'updated_at': '2026-08-27T00:00:00+08:00'})}'"],
))
lines.append("")

# 合同、报价单、销售订单
contract_ids = {"a": gen_uuid(), "b": gen_uuid()}
quote_ids = {"a": gen_uuid(), "b": gen_uuid()}
so_ids = {"a": gen_uuid(), "b": gen_uuid()}
plan_ids = {"a": gen_uuid(), "b": gen_uuid()}

for key, contract, cust_key in [("a", CONTRACT_A, "a"), ("b", CONTRACT_B, "b")]:
    cid = contract_ids[key]
    qid = quote_ids[key]
    sid = so_ids[key]
    pid = plan_ids[key]
    cust = CUSTOMERS[cust_key]
    sign = contract["sign_date"]
    items = build_contract_items(contract)
    sales_items = build_sales_items(contract)

    # 合同物理表
    lines.append(sql_insert(
        "contracts",
        ["id", "contract_no", "title", "customer_id", "customer_name", "contact_name", "contact_phone", "customer_address", "contract_type", "customer_level", "quotation_id", "quotation_no", "amount", "currency", "sign_date", "effective_date", "delivery_date", "payment_terms", "status", "signer", "remark", "items", "clauses"],
        [
            f"'{cid}'", f"'{contract['no']}'", f"'{esc(contract['title'])}'", f"'{cust['id']}'", f"'{esc(cust['name'])}'",
            f"'{esc(cust['contact'])}'", f"'{esc(cust['phone'])}'", f"'{esc(cust['address'])}'", "'domestic'", "'normal'",
            f"'{qid}'", f"'QO-{contract['no']}'", str(contract["amount"]), "'CNY'", f"'{sign}'", f"'{sign}'",
            f"'{sign + timedelta(days=30)}'", "'合同签订后30天内发货，款到发货'", "'executing'", "'邵常青'", "'按合同条款执行'",
            f"'{json_item(items)}'::jsonb", "'[]'::jsonb",
        ],
    ))

    # 报价单物理表
    lines.append(sql_insert(
        "quotes",
        ["id", "quote_no", "customer_id", "customer_name", "contact", "phone", "currency", "exchange_rate", "items", "total_amount", "effective_date", "expiry_date", "status", "remark", "created_by", "converted_order_id"],
        [
            f"'{qid}'", f"'QO-{contract['no']}'", f"'{cust['id']}'", f"'{esc(cust['name'])}'", f"'{esc(cust['contact'])}'",
            f"'{esc(cust['phone'])}'", "'CNY'", "1", f"'{json_item(sales_items)}'::jsonb", str(contract["amount"]),
            f"'{sign - timedelta(days=3)}'", f"'{sign + timedelta(days=7)}'", "'converted'", "'已转销售订单'", "'邵常青'", f"'{sid}'",
        ],
    ))
    # entity_store 报价单（与 Quotation 结构对齐，补齐必填字段）
    quote_total_cost = round(contract["amount"] * 0.82)
    quote_items = [{
        "id": f"{contract['no']}-it{it['seq']}",
        "product_id": it["product_id"],
        "product_code": it["product_code"],
        "product_name": it["product_name"],
        "sku_id": it["sku_id"],
        "sku_specification": it["sku_summary"],
        "sku": it["sku_id"],
        "spec": it["size"],
        "specification": it["size"],
        "color": it["color"],
        "quantity": it["quantity"],
        "unit_price": it["unit_price"],
        "subtotal": it["amount"],
    } for it in sales_items]
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{qid}'", "'quotes'", f"'{json_item({'id': qid, 'quotation_no': f"QT-{contract['no']}-001", 'quote_no': f"QO-{contract['no']}", 'customer_id': cust['id'], 'customer_name': cust['name'], 'currency': 'CNY', 'product_id': sales_items[0]['product_id'], 'product_code': sales_items[0]['product_code'], 'product_name': sales_items[0]['product_name'], 'items': quote_items, 'quantity': sum(it['quantity'] for it in sales_items), 'target_profit_rate': 0.22, 'fabric_loss_rate': 0.05, 'batch_factor': 0, 'delivery_days': 25, 'estimated_delivery_date': str(sign + timedelta(days=25)), 'remark': '已转销售订单', 'status': 'converted', 'contract_no': contract['no'], 'sales_order_no': f"SO-{contract['no']}-001", 'cost_items': [], 'total_cost': quote_total_cost, 'suggested_price': contract['amount'], 'estimated_profit': contract['amount'] - quote_total_cost, 'actual_profit_rate': 0.22, 'creator': '邵常青', 'created_at': f"{sign}T00:00:00+08:00", 'updated_at': f"{sign}T00:00:00+08:00", 'expiry_date': str(sign + timedelta(days=30)), 'approval_logs': [], 'version_logs': [], 'created_by': '邵常青', 'contact': cust['contact'], 'phone': cust['phone'], 'exchange_rate': 1, 'effective_date': str(sign - timedelta(days=3)), 'converted_order_id': sid})}'"],
    ))

    # 销售订单物理表
    lines.append(sql_insert(
        "sales_orders",
        ["id", "order_no", "order_type", "channel", "customer_id", "customer_name", "currency", "trade_term", "destination", "delivery_date", "total_amount", "status", "items", "contract_no"],
        [
            f"'{sid}'", f"'SO-{contract['no']}-001'", "'国内销售'", "'线下'", f"'{cust['id']}'", f"'{esc(cust['name'])}'",
            "'CNY'", "'出厂价'", f"'{esc(cust['address'])}'", f"'{sign + timedelta(days=25)}'", str(contract["amount"]),
            "'confirmed'", f"'{json_item(sales_items)}'::jsonb", f"'{contract['no']}'",
        ],
    ))

    # 主生产计划物理表
    sku_items = [{'product_id': PRODUCTS[it['product_key']]['id'], 'product_code': PRODUCTS[it['product_key']]['code'], 'product_name': PRODUCTS[it['product_key']]['name'], 'specification': it['size'], 'color': it['color'], 'quantity': it['qty']} for it in contract['items']]
    lines.append(sql_insert(
        "production_plans",
        ["id", "plan_no", "cycle", "product_name", "category", "plan_quantity", "start_date", "end_date", "load_rate", "bottleneck_load_rate", "status", "work_orders", "sku_items"],
        [
            f"'{pid}'", f"'PL-{contract['no']}'", "'月度'", f"'{contract['no']} 主生产计划'", "'家纺'",
            str(sum(it["qty"] for it in contract["items"])), f"'{sign + timedelta(days=1)}'", f"'{sign + timedelta(days=25)}'",
            "75", "60", "'published'", "'[]'::jsonb", f"'{json_item(sku_items)}'::jsonb",
        ],
    ))
    # entity_store 主生产计划
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{pid}'", "'production_plans'", f"'{json_item({'id': pid, 'plan_no': f"PL-{contract['no']}", 'contract_no': contract['no'], 'contract_id': cid, 'cycle': '月度', 'product_name': f"{contract['no']} 主生产计划", 'category': '家纺', 'plan_quantity': sum(it['qty'] for it in contract['items']), 'start_date': str(sign + timedelta(days=1)), 'end_date': str(sign + timedelta(days=25)), 'load_rate': 75, 'bottleneck_load_rate': 60, 'status': 'published', 'work_orders': [], 'sku_items': sku_items, 'created_at': f"{sign}T00:00:00+08:00"})}'"],
    ))

    # entity_store 合同
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{cid}'", "'contracts'", f"'{json_item({'id': cid, 'contract_no': contract['no'], 'title': contract['title'], 'customer_id': cust['id'], 'customer_name': cust['name'], 'contact_name': cust['contact'], 'contact_phone': cust['phone'], 'customer_address': cust['address'], 'contract_type': 'domestic', 'customer_level': 'normal', 'quotation_id': qid, 'quotation_no': f"QO-{contract['no']}", 'amount': contract['amount'], 'currency': 'CNY', 'sign_date': str(sign), 'effective_date': str(sign), 'delivery_date': str(sign + timedelta(days=30)), 'payment_terms': '合同签订后30天内发货，款到发货', 'status': 'executing', 'signer': '邵常青', 'remark': '按合同条款执行', 'items': items, 'clauses': [], 'approval_logs': [], 'performance_nodes': [], 'version_logs': [], 'attachments': [], 'reminders': [], 'created_by': '邵常青', 'created_at': f"{sign}T00:00:00+08:00", 'updated_at': f"{sign}T00:00:00+08:00"})}'"],
    ))

    # entity_store 销售订单
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{sid}'", "'sales_orders'", f"'{json_item({'id': sid, 'order_no': f"SO-{contract['no']}-001", 'order_type': '国内销售', 'channel': '线下', 'customer_id': cust['id'], 'customer_name': cust['name'], 'currency': 'CNY', 'trade_term': '出厂价', 'destination': cust['address'], 'delivery_date': str(sign + timedelta(days=25)), 'total_amount': contract['amount'], 'status': 'confirmed', 'items': sales_items, 'created_at': f"{sign}T00:00:00+08:00", 'contract_no': contract['no']})}'"],
    ))

    # 应收账款（仅物理表 + entity_store）
    ar_id = gen_uuid()
    lines.append(sql_insert(
        "finance_records",
        ["id", "type", "counterparty", "currency", "amount", "paid_amount", "cost_breakdown", "created_at"],
        [f"'{ar_id}'", "'应收'", f"'{esc(cust['name'])}'", "'CNY'", str(contract["amount"]), "0", "'{}'::jsonb", f"'{sign}T00:00:00+08:00'"],
    ))
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{ar_id}'", "'finance_records'", f"'{json_item({'id': ar_id, 'type': '应收', 'counterparty': cust['name'], 'currency': 'CNY', 'amount': contract['amount'], 'paid_amount': 0, 'status': 'pending', 'created_at': f"{sign}T00:00:00+08:00"})}'"],
    ))

lines.append("")

# ---------- 采购订单（物理表） ----------
# 先收集应付账款
ap_records = []
po_meta = {}  # contract -> list of po objects with total

for contract_key, po_list in [("a", PO_A), ("b", PO_B)]:
    contract = CONTRACT_A if contract_key == "a" else CONTRACT_B
    po_meta[contract_key] = []
    for po in po_list:
        po_id = gen_uuid()
        supplier = SUPPLIERS[po["supplier"]]
        issue = po["issue_date"]
        expected = po.get("arrival_date", po.get("expected_date"))
        items_sql = []
        total = 0
        for it in po["items"]:
            m = MATERIALS[it["material_key"]]
            amount = it["qty"] * it["unit_price"]
            total += amount
            items_sql.append({
                "material_id": m["id"],
                "material_code": m["code"],
                "material_name": m["name"],
                "specification": m["spec"],
                "quantity": it["qty"],
                "unit_price": it["unit_price"],
                "amount": amount,
                "unit": m["unit"],
            })
        po["_id"] = po_id
        po["_total"] = total
        po["_items_json"] = items_sql
        po_meta[contract_key].append(po)

        lines.append(sql_insert(
            "purchase_orders",
            ["id", "order_no", "supplier_id", "supplier_name", "total_amount", "status", "expected_date", "items", "contract_no", "payment_status"],
            [
                f"'{po_id}'", f"'{po['no']}'", f"'{supplier['id']}'", f"'{esc(supplier['name'])}'", str(total),
                f"'{po['status']}'", f"'{expected}'", f"'{json_item(items_sql)}'::jsonb", f"'{contract['no']}'",
                "'unpaid'" if po["status"] == "completed" else "'unpaid'",
            ],
        ))
        # entity_store 采购订单
        lines.append(sql_insert(
            "entity_store",
            ["id", "entity_type", "data"],
            [f"'{po_id}'", "'purchase_orders'", f"'{json_item({'id': po_id, 'order_no': po['no'], 'supplier_id': supplier['id'], 'supplier_name': supplier['name'], 'total_amount': total, 'status': po['status'], 'issued_date': str(issue), 'expected_date': str(expected), 'items': items_sql, 'contract_no': contract['no'], 'payment_status': 'unpaid', 'created_at': f"{issue}T00:00:00+08:00"})}'"],
        ))

        # 已完成的采购单生成应付账款（A 到货后）
        if po["status"] == "completed":
            ap_id = gen_uuid()
            ap_records.append((ap_id, supplier["name"], total, issue))
            lines.append(sql_insert(
                "finance_records",
                ["id", "type", "counterparty", "currency", "amount", "paid_amount", "cost_breakdown", "created_at"],
                [f"'{ap_id}'", "'应付'", f"'{esc(supplier['name'])}'", "'CNY'", str(total), "0", f"'{{\"purchase_order_no\": \"{po['no']}\"}}'::jsonb", f"'{issue}T00:00:00+08:00'"],
            ))
            lines.append(sql_insert(
                "entity_store",
                ["id", "entity_type", "data"],
                [f"'{ap_id}'", "'finance_records'", f"'{json_item({'id': ap_id, 'type': '应付', 'counterparty': supplier['name'], 'currency': 'CNY', 'amount': total, 'paid_amount': 0, 'status': 'unpaid', 'purchase_order_no': po['no'], 'created_at': f"{issue}T00:00:00+08:00"})}'"],
            ))

lines.append("")

# ---------- A 采购入库、来料质检、库存增加 ----------
# 入库记录号前缀
inbound_seq = 1
for po in PO_A:
    supplier = SUPPLIERS[po["supplier"]]
    arrival = po["arrival_date"]
    for it in po["items"]:
        m = MATERIALS[it["material_key"]]
        # 库存增加（不存在则插入，存在则更新）
        lines.append(f"""
INSERT INTO inventory (id, type, material_id, quantity, warehouse, min_stock, max_stock)
SELECT gen_random_uuid(), 'material', '{m['id']}', {it['qty']}, '{m['warehouse']}', 100, 5000
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE type='material' AND material_id='{m['id']}' AND warehouse='{m['warehouse']}');
UPDATE inventory SET quantity = quantity + {it['qty']}, created_at = now()
WHERE type='material' AND material_id='{m['id']}' AND warehouse='{m['warehouse']}';
""")

        # 来料质检
        qc_id = gen_uuid()
        qc_no = f"QC-{po['no']}-{inbound_seq:03d}"
        inbound_seq += 1
        lines.append(sql_insert(
            "quality_inspections",
            ["id", "inspection_no", "type", "material_id", "result", "details", "qualified_qty", "unqualified_qty", "defect_reason", "photos"],
            [
                f"'{qc_id}'", f"'{qc_no}'", "'incoming'", f"'{m['id']}'", "'qualified'",
                f"'{{\"material_code\": \"{m['code']}\", \"result\": \"合格\"}}'::jsonb", str(it["qty"]), "0", "''", "'[]'::jsonb",
            ],
        ))

        # 入库记录
        sr_id = gen_uuid()
        sr_no = f"RK-{po['no']}-{it['material_key'].upper()[:3]}"
        lines.append(sql_insert(
            "stock_records",
            ["id", "record_no", "type", "subtype", "material_id", "quantity", "warehouse", "related_order", "handler", "record_date", "actual_qty", "profit_loss"],
            [
                f"'{sr_id}'", f"'{sr_no}'", "'inbound'", "'采购入库'", f"'{m['id']}'", str(it["qty"]), f"'{m['warehouse']}'",
                f"'{po['no']}'", "'仓库管理员'", f"'{arrival}'", str(it["qty"]), "0",
            ],
        ))
        lines.append(sql_insert(
            "entity_store",
            ["id", "entity_type", "data"],
            [f"'{sr_id}'", "'stock_records'", f"'{json_item({'id': sr_id, 'record_no': sr_no, 'type': 'inbound', 'subtype': '采购入库', 'material_id': m['id'], 'material_code': m['code'], 'material_name': m['name'], 'quantity': it['qty'], 'warehouse': m['warehouse'], 'related_order': po['no'], 'handler': '仓库管理员', 'record_date': str(arrival), 'created_at': f"{arrival}T10:00:00+08:00"})}'"],
        ))

lines.append("")

# ---------- A 生产工单（物理 + entity_store） ----------
# 合同 A 的工单统一使用沙发垫工艺路线，首工序预置少量报工记录
wo_es_ids = {}
for wo in WORK_ORDERS_A:
    wo_id = gen_uuid()
    p = PRODUCTS[wo["product_key"]]
    start = wo["start"]
    end = wo["end"]
    ops, completed_qty = build_sofa_pad_operations(wo["qty"], wo["no"], start)
    progress = round(completed_qty / wo["qty"] * 100, 2) if wo["qty"] else 0
    op_json = f"'{json_item(ops)}'::jsonb"
    lines.append(sql_insert(
        "work_orders",
        ["id", "work_no", "plan_id", "product_id", "product_code", "product_name", "product_images", "plan_quantity", "completed_quantity", "progress", "status", "operations", "source", "priority", "start_date", "end_date", "issued_at", "updated_at", "remark", "sku_id", "sku_summary"],
        [
            f"'{wo_id}'", f"'{wo['no']}'", f"'{plan_ids['a']}'", f"'{p['id']}'", f"'{p['code']}'", f"'{esc(p['name'])}'",
            f"'{json_item([p['image']])}'::jsonb", str(wo["qty"]), str(completed_qty), str(progress), "'producing'", op_json, "'plan'", "'medium'",
            f"'{start}'", f"'{end}'", f"'{start}T08:00:00+08:00'", "now()", "'按主生产计划下发，已领料开工'", f"'{wo['sku']}'", f"'{wo['size']}'",
        ],
    ))
    # entity_store work_order（生产模块读取）
    wo_es_id = gen_uuid()
    wo_es_ids[wo["no"]] = wo_es_id
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{wo_es_id}'", "'work_orders'", f"'{json_item({'id': wo_es_id, 'work_no': wo['no'], 'contract_no': CONTRACT_A['no'], 'plan_id': plan_ids['a'], 'product_id': p['id'], 'product_code': p['code'], 'product_name': p['name'], 'product_images': [p['image']], 'plan_quantity': wo['qty'], 'completed_quantity': completed_qty, 'progress': progress, 'status': 'producing', 'picking_status': 'picked', 'operations': ops, 'source': 'plan', 'priority': 'medium', 'start_date': str(start), 'end_date': str(end), 'issued_at': f"{start}T08:00:00+08:00", 'created_at': f"{start}T08:00:00+08:00", 'updated_at': f"{start}T08:00:00+08:00", 'remark': '按主生产计划下发，已领料开工', 'sku_id': wo['sku'], 'sku_summary': wo['size']})}'"],
    ))

lines.append("")

# ---------- A 领料单 + 出库 + 库存扣减 ----------
mr_counter = 60  # 接续已有编号
for wo in WORK_ORDERS_A:
    p = PRODUCTS[wo["product_key"]]
    mr_id = wo["no"] + "-MR"
    mr_code = f"MR-2026-{mr_counter:04d}"
    mr_counter += 1
    pick_date = wo["start"] + timedelta(days=1)
    items = []
    for it in wo["materials"]:
        m = MATERIALS[it["material_key"]]
        items.append({
            "material_id": m["id"],
            "material_code": m["code"],
            "material_name": m["name"],
            "specification": m["spec"],
            "color": wo.get("color", ""),
            "unit": m["unit"],
            "warehouse": m["warehouse"],
            "required_qty": it["qty"],
            "issued_qty": it["qty"],
        })
        # 出库记录
        sr_id = gen_uuid()
        sr_no = f"CK-{wo['no']}-{it['material_key'].upper()[:3]}"
        lines.append(sql_insert(
            "stock_records",
            ["id", "record_no", "type", "subtype", "material_id", "quantity", "warehouse", "related_order", "handler", "record_date", "actual_qty", "profit_loss"],
            [
                f"'{sr_id}'", f"'{sr_no}'", "'outbound'", "'生产领料'", f"'{m['id']}'", str(-it["qty"]), f"'{m['warehouse']}'",
                f"'{wo['no']}'", "'车间主任'", f"'{pick_date}'", str(it["qty"]), "0",
            ],
        ))
        lines.append(sql_insert(
            "entity_store",
            ["id", "entity_type", "data"],
            [f"'{sr_id}'", "'stock_records'", f"'{json_item({'id': sr_id, 'record_no': sr_no, 'type': 'outbound', 'subtype': '生产领料', 'material_id': m['id'], 'material_code': m['code'], 'material_name': m['name'], 'quantity': -it['qty'], 'warehouse': m['warehouse'], 'related_order': wo['no'], 'handler': '车间主任', 'record_date': str(pick_date), 'contract_no': CONTRACT_A['no'], 'created_at': f"{pick_date}T14:00:00+08:00"})}'"],
        ))
        # 库存扣减
        lines.append(f"UPDATE inventory SET quantity = quantity - {it['qty']} WHERE type='material' AND material_id='{m['id']}' AND warehouse='{m['warehouse']}';")

    # 领料单 entity_store
    mr_es_id = gen_uuid()
    lines.append(sql_insert(
        "entity_store",
        ["id", "entity_type", "data"],
        [f"'{mr_es_id}'", "'material_requisitions'", f"'{json_item({'id': mr_es_id, 'code': mr_code, 'contract_no': CONTRACT_A['no'], 'work_order_id': wo_es_ids[wo['no']], 'work_order_no': wo['no'], 'related_plan_no': f"PL-{CONTRACT_A['no']}", 'related_work_order_no': wo['no'], 'product_name': p['name'], 'department': '生产部', 'applicant': '车间主任', 'required_date': str(pick_date), 'issued_at': f"{pick_date}T14:00:00+08:00", 'items': items, 'total_issued_qty': sum(i['issued_qty'] for i in items), 'status': 'completed', 'remark': '按工单BOM发料', 'created_at': f"{pick_date}T14:00:00+08:00"})}'"],
    ))

lines.append("")

# ---------- 更新主生产计划 work_orders 字段 ----------
wo_nos = [wo["no"] for wo in WORK_ORDERS_A]
lines.append(f"UPDATE production_plans SET work_orders = '{json_item(wo_nos)}'::jsonb WHERE id = '{plan_ids['a']}';\n")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"已生成 SQL: {OUT}")
