# -*- coding: utf-8 -*-
"""生成脱敏演示数据：农户点位取自卫星影像中的真实房屋位置（坐标已做随机微偏移）。"""
import json, math, random, os, datetime
from collections import defaultdict

random.seed(20261020)
ROOT = r"F:/便民服务"
OUT = os.path.join(ROOT, "data")
os.makedirs(OUT, exist_ok=True)

pts = json.load(open(os.path.join(ROOT, "tools", "footprints.json"), encoding="utf-8"))

# ---------- 选村：以“整齐排屋”聚落为中心，取最近的 428 个房屋点 ----------
CENTER = (120.11555, 30.23505)   # 主聚落中心（卫星图排屋区）

def dist(p, c=CENTER):
    dx = (p["lng"] - c[0]) * 95000
    dy = (p["lat"] - c[1]) * 111000
    return math.hypot(dx, dy)

pts.sort(key=dist)
sel = pts[:428]
print("selected", len(sel), "max radius m", round(dist(sel[-1]), 1))

# ---------- 村界：按角度取最远点 + 外扩 ----------
cx, cy = CENTER
def hull_poly(points, bins=32, buffer_m=18):
    buckets = defaultdict(float)
    for p in points:
        dx = (p["lng"] - cx) * 95000
        dy = (p["lat"] - cy) * 111000
        ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
        b = int(ang / (360 / bins)) % bins
        buckets[b] = max(buckets[b], math.hypot(dx, dy))
    poly = []
    for b in range(bins):
        ang = math.radians((b + 0.5) * 360 / bins)
        rr = (buckets.get(b, 150) + buffer_m)
        # 轻微平滑，避免锯齿
        rr = 0.72 * rr + 0.28 * ((buckets.get((b - 1) % bins, rr) + buckets.get((b + 1) % bins, rr)) / 2 + buffer_m)
        poly.append([round(cy + rr * math.sin(ang) / 111000, 6), round(cx + rr * math.cos(ang) / 95000, 6)])
    return poly

village_poly = hull_poly(sel)

SURNAME = list("张王李赵刘陈杨黄周吴徐孙马朱胡郭何林高罗")
GROUP = ["一组", "二组", "三组", "四组", "五组"]

def group_of(p):
    ang = (math.degrees(math.atan2((p["lat"] - cy) * 111000, (p["lng"] - cx) * 95000)) + 360) % 360
    if ang < 60: return "一组"
    if ang < 130: return "二组"
    if ang < 200: return "三组"
    if ang < 275: return "四组"
    return "五组"

households = []
care_ids = set(random.sample(range(428), 23))
for i, p in enumerate(sorted(sel, key=lambda q: (group_of(q), q["lat"]))):
    g = group_of(p)
    name = random.choice(SURNAME)
    status = "正常"
    r = random.random()
    if r > 0.965: status = "闲置"
    elif r > 0.93: status = "待核查"
    care = "无"
    if i in care_ids:
        care = random.choice(["留守老人", "低保户", "残疾人", "独居老人"])
    households.append({
        "id": "A-%03d" % (i + 1),
        "houseNo": "A-%03d" % (i + 1),
        "owner": name + "某",
        "ownerKey": name,
        "phone": "1%d****%04d" % (random.choice([38, 39, 58, 86, 35]), random.randint(0, 9999)),
        "group": g,
        "address": "示范村%s%d号" % (g, random.randint(1, 60)),
        "lat": round(p["lat"], 6),
        "lng": round(p["lng"], 6),
        "members": random.choice([1, 2, 2, 3, 3, 3, 4, 4, 5, 6]),
        "houseStatus": status,
        "care": care,
        "builtYear": random.choice([1985, 1992, 1998, 2003, 2008, 2012, 2015, 2018, 2021]),
        "area": random.choice([86, 102, 118, 135, 160, 188, 220]),
        "tags": [t for t in [("党员户" if random.random() < 0.08 else None),
                             ("种粮大户" if random.random() < 0.05 else None),
                             ("农家乐" if random.random() < 0.06 else None)] if t],
        "updatedAt": "2026-10-%02d" % random.randint(1, 19),
    })

# ---------- 服务网点（贴到真实房屋点附近） ----------
def near(idx, dx=0.00012, dy=0.00008):
    p = sel[idx % len(sel)]
    return round(p["lat"] + dy, 6), round(p["lng"] + dx, 6)

sp_defs = [
    ("示范村便民服务站", "便民服务", "村级事项代办、证明开具、政策咨询", "示范村文化路 1 号", "08:30-17:00（周一至周五）", "0572-****101"),
    ("示范村卫生室", "医疗健康", "常见病诊疗、慢病配药、家庭医生签约", "示范村一组 18 号", "08:00-17:30（每日）", "0572-****102"),
    ("示范村文化礼堂", "文化活动", "文体活动、老年人课堂、电影放映", "示范村文化广场北侧", "09:00-20:00", "0572-****103"),
    ("示范村养老照料中心", "养老服务", "助餐、日间照料、康复训练", "示范村三组 6 号", "07:30-18:00", "0572-****104"),
    ("示范村快递驿站", "生活服务", "快递代收代寄、农资代购", "示范村商业街 3 号", "08:30-19:00", "0572-****105"),
]
service_points = []
for i, (n, t, s, addr, hours, tel) in enumerate(sp_defs):
    lat, lng = near(30 + i * 47, 0.00018 * (1 if i % 2 else -1), 0.00012 * (i % 3 - 1))
    service_points.append({"id": "SP-%03d" % (i + 1), "name": n, "type": t, "services": s,
                           "address": addr, "hours": hours, "phone": tel, "lat": lat, "lng": lng})

# ---------- 摄像头 ----------
# (名称, 点位类型, 厂商, 接入协议, 分辨率, 是否球机, AI 能力, 安装日期)
cam_defs = [
    ("村口主路东", "主要出入口", "海康威视", "gb28181", "2560×1440", True, ["车辆识别", "人员聚集"], "2025-03-12"),
    ("村口主路西", "主要出入口", "海康威视", "gb28181", "2560×1440", True, ["车辆识别"], "2025-03-12"),
    ("文化广场", "公共活动", "大华股份", "rtsp", "1920×1080", True, ["人员聚集", "越界检测"], "2025-05-08"),
    ("便民服务站", "公共服务", "大华股份", "rtsp", "1920×1080", False, [], "2025-05-08"),
    ("小学路口", "重点路段", "宇视科技", "gb28181", "2560×1440", True, ["人员聚集"], "2025-09-01"),
    ("河道北岸", "水域防汛", "海康威视", "hls", "1920×1080", False, ["水位识别", "越界检测"], "2025-06-20"),
    ("三组路口", "村组路口", "天地伟业", "rtsp", "1920×1080", False, [], "2025-07-15"),
    ("五组桥头", "桥梁涵洞", "天地伟业", "rtsp", "1920×1080", False, ["越界检测"], "2025-07-15"),
    ("养老中心", "重点关怀", "宇视科技", "rtsp", "1920×1080", False, ["跌倒检测"], "2025-10-09"),
    ("快递驿站", "生活服务", "海康威视", "gb28181", "1920×1080", False, [], "2025-08-21"),
    ("停车场", "公共停车场", "大华股份", "rtsp", "2560×1440", True, ["车辆识别"], "2025-08-21"),
    ("茶山入口", "农林防火", "海康威视", "hls", "2560×1440", True, ["烟火检测", "越界检测"], "2026-01-06"),
]
cameras = []
for i, (n, kind, vendor, protocol, res, ptz, ai, inst) in enumerate(cam_defs):
    lat, lng = near(i * 33, 0.00022 * math.cos(i), 0.00022 * math.sin(i))
    seq = i + 1
    offline = seq == 10  # 第 10 路离线，用于演示设备巡检
    cameras.append({
        "id": "CAM-%02d" % seq,
        "name": n,
        "deviceId": "3305210000132000%04d" % seq,     # GB/T 28181 20 位设备编码（演示）
        "channel": "CH%02d" % seq,
        "vendor": vendor,
        "kind": kind,
        "protocol": protocol,
        "streamUrl": ("rtsp://10.18.%d.%d:554/Streaming/Channels/%d01" % (10 + seq // 8, 20 + seq, seq))
                     if protocol != "hls"
                     else ("http://10.18.%d.%d/hls/%d/index.m3u8" % (10 + seq // 8, 20 + seq, seq)),
        "snapUrl": "/api/cameras/CAM-%02d/snapshot" % seq,
        "resolution": res,
        "ptz": ptz,
        "direction": (seq * 37) % 360,                 # 安装方向角，用于地图绘制视场扇形
        "fov": 75 if ptz else 55,                      # 视场角（度）
        "radius": 90 if ptz else 55,                   # 可视半径（米）
        "aiTags": ai,
        "installAt": inst,
        "lat": lat,
        "lng": lng,
        "status": "offline" if offline else "online",
        "storageDays": 30,
        "note": "演示设备，不接入真实视频流" if offline else "",
    })

# ---------- 事件 ----------
events = [
    ("道路安全隐患", "安全", "待处置", "示范村二组进村道路边坡有碎石滑落，存在安全隐患。", 0, 8),
    ("河道水位上涨", "防汛", "待处置", "连续降雨导致河道水位上升，已设置警示标志。", 1, 20),
    ("秸秆焚烧疑似火点", "环保", "待处置", "监测到田间疑似火点，已通知网格员现场核实。", 2, 33),
    ("路灯不亮", "设施", "已处置", "村民反映二组路灯不亮，已更换灯头。", 3, 51),
    ("垃圾桶满溢", "环境", "已处置", "三组垃圾分类亭垃圾桶满溢，已清运。", 4, 66),
    ("独居老人走访", "民生", "已处置", "网格员走访独居老人，协助代购药品。", 5, 80),
]
ev_list = []
for i, (t, c, st, desc, k, idx) in enumerate(events):
    lat, lng = near(idx * 11, 0.00015, 0.0001)
    ev_list.append({"id": "EV-%03d" % (i + 1), "title": t, "category": c, "status": st, "desc": desc,
                    "lat": lat, "lng": lng, "reportedAt": "2026-10-%02d %02d:%02d" % (20 - i, 8 + i, 10 + i * 7),
                    "reporter": "网格员 %s" % random.choice(SURNAME)})

# ---------- 邻村（概览页多点位展示，示意多边形） ----------
def blob(lat, lng, r_m, seed):
    rnd = random.Random(seed)
    ring = []
    n = 22
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r_m * (0.82 + rnd.random() * 0.36)
        ring.append([round(lat + rr * math.sin(a) / 111000, 6), round(lng + rr * math.cos(a) / 95000, 6)])
    return ring

neighbors = [
    ("示范二村", 30.24180, 120.11720, 260, 11),
    ("示范三村", 30.22930, 120.10940, 230, 12),
    ("示范四村", 30.23300, 120.12310, 210, 13),
    ("示范五村", 30.22600, 120.11800, 180, 14),
]
villages = [{"id": "V-01", "name": "示范村", "isMain": True, "center": [cy, cx], "boundary": village_poly,
             "households": 428, "population": 672}]
for i, (n, lat, lng, r, sd) in enumerate(neighbors):
    villages.append({"id": "V-%02d" % (i + 2), "name": n, "isMain": False, "center": [lat, lng],
                     "boundary": blob(lat, lng, r, sd), "households": random.choice([186, 240, 312, 268]),
                     "population": random.choice([420, 560, 690, 730])})

# ---------- 通知 ----------
notices = [
    ("2027年度城乡居民基本医疗保险开始缴费", "医保社保", "集中缴费期为 2026年10月20日至12月31日，可通过手机或到村便民服务站办理。", True),
    ("秋季农机购置补贴申报提醒", "惠农政策", "请已购机的农户在 11 月 10 日前携带材料到镇农业农村办提交申请。", True),
    ("村内自来水管网改造施工通告", "本地通知", "10月22日至10月28日二组、三组部分路段施工，请注意绕行。", False),
    ("老年人免费健康体检安排", "医疗健康", "10月25日上午在村卫生室开展65岁以上老年人免费体检。", False),
    ("水稻病虫害防治技术指导", "农业生产", "近期稻飞虱偏重发生，请各户注意田间检查并及时防治。", False),
    ("农村宅基地和建房政策宣讲会", "民生政务", "10月26日19:00在文化礼堂举办，欢迎村民参加。", False),
]
notice_list = []
for i, (t, c, s, imp) in enumerate(notices):
    notice_list.append({"id": "N-%03d" % (i + 1), "title": t, "category": c, "summary": s,
                        "content": s + "\n\n如有疑问，请拨打村便民服务站电话 0572-****101，或到村便民服务站现场咨询。本通知为演示数据。",
                        "publishAt": "2026-10-%02d" % (19 - i), "important": imp, "views": random.randint(80, 460)})

# ---------- 政策问答知识库 ----------
def doc(i, title, dept, date, typ):
    return {"id": "D-%02d" % i, "title": title, "dept": dept, "date": date, "type": typ}

policies = [
    {
        "id": "P-01", "title": "农机购置补贴申请指南", "category": "农业生产",
        "keywords": ["农机", "购置", "补贴", "农机补贴", "买机器", "拖拉机"],
        "summary": "支持农业生产的个人和农业生产经营组织购置补贴目录内的农机具。",
        "applyTo": ["从事农业生产的个人", "农业生产经营组织（含农户、家庭农场、农民专业合作社、农业企业等）"],
        "materials": ["身份证明", "农业经营主体资格证明", "购机发票", "机具合格证", "银行账户信息"],
        "steps": ["选择符合补贴目录的机具并购买", "携带相关材料向当地农业农村部门提交申请", "部门审核", "公示无异议后，按规定发放补贴资金"],
        "place": "镇农业农村办公室（村便民服务站可代办）",
        "placePending": True,
        "basis": ["《农机购置补贴政策实施意见》", "《XX省农机购置补贴实施方案》"],
        "updatedAt": "2024-03-01", "confirmed": True,
        "docs": [doc(1, "农机购置补贴政策实施意见", "农业农村部", "2024-03-01", "官方文件"),
                 doc(2, "XX省农机购置补贴实施方案", "XX省农业农村厅", "2024-02-20", "地方文件")],
    },
    {
        "id": "P-02", "title": "粮食补贴查询及办理指南", "category": "农业生产",
        "keywords": ["粮食", "补贴", "粮补", "种粮", "耕地地力"],
        "summary": "耕地地力保护补贴按承包耕地面积发放，具体金额以当年正式通知为准。",
        "applyTo": ["本村承包耕地的农户", "实际种粮的农业经营主体"],
        "materials": ["身份证", "土地承包经营权证", "一卡通银行账户"],
        "steps": ["村组核实种植面积并公示", "乡镇审核汇总", "县级财政拨付至“一卡通”账户"],
        "place": "村便民服务站（代收材料）",
        "placePending": False,
        "basis": ["《农业支持保护补贴政策实施方案》"],
        "updatedAt": "2026-05-20", "confirmed": True,
        "docs": [doc(3, "农业支持保护补贴政策实施方案", "财政部 农业农村部", "2026-05-20", "官方文件")],
    },
    {
        "id": "P-03", "title": "城乡居民医保报销比例", "category": "医保社保",
        "keywords": ["医保", "报销", "比例", "住院", "看病", "新农合"],
        "summary": "城乡居民医保住院报销比例按医院级别区分，乡镇卫生院最高，三级医院最低。",
        "applyTo": ["已参加当年度城乡居民基本医疗保险的村民"],
        "materials": ["社保卡或医保电子凭证", "住院发票", "费用清单", "出院记录"],
        "steps": ["定点医院直接结算（推荐）", "未能直接结算的，携带材料到镇医保服务站手工报销", "审核通过后拨付至本人账户"],
        "place": "镇便民服务中心医保窗口",
        "placePending": False,
        "basis": ["《城乡居民基本医疗保险实施办法》"],
        "updatedAt": "2026-09-15", "confirmed": True,
        "docs": [doc(4, "城乡居民基本医疗保险实施办法", "XX市医疗保障局", "2026-09-15", "地方文件")],
    },
    {
        "id": "P-04", "title": "农村宅基地和建房申请条件", "category": "民生政务",
        "keywords": ["宅基地", "建房", "盖房", "申请", "宅基地申请"],
        "summary": "符合“一户一宅”、宅基地面积限额和村庄规划的农户可申请宅基地和建房。",
        "applyTo": ["本村集体经济组织成员", "符合“一户一宅”且无宅基地或面积不足的农户"],
        "materials": ["户口簿", "身份证", "宅基地和建房申请表", "村民小组意见", "拟建位置测绘示意图"],
        "steps": ["向村民小组提出书面申请", "村民小组会议讨论并公示", "村级审核", "乡镇审批", "开工放线、竣工验收"],
        "place": "村便民服务站受理，镇自然资源所审批",
        "placePending": True,
        "basis": ["《土地管理法》", "《XX省农村住房建设管理办法》"],
        "updatedAt": "2025-11-08", "confirmed": True,
        "docs": [doc(5, "XX省农村住房建设管理办法", "XX省人民政府", "2025-11-08", "地方文件")],
    },
    {
        "id": "P-05", "title": "养老金领取资格认证怎么办", "category": "医保社保",
        "keywords": ["养老金", "认证", "养老", "待遇", "资格认证", "社保"],
        "summary": "领取城乡居民养老保险待遇人员每年需完成一次资格认证，可用手机刷脸办理。",
        "applyTo": ["按月领取城乡居民基本养老保险待遇的人员"],
        "materials": ["身份证", "社保卡", "本人手机（用于刷脸认证）"],
        "steps": ["打开“掌上社保”小程序", "选择“待遇资格认证”", "按提示完成人脸识别", "认证结果实时反馈"],
        "place": "线上办理；行动不便老人可联系村便民服务站上门协助",
        "placePending": False,
        "basis": ["《城乡居民基本养老保险经办规程》"],
        "updatedAt": "2026-04-12", "confirmed": True,
        "docs": [doc(6, "城乡居民基本养老保险经办规程", "人力资源社会保障部", "2026-04-12", "官方文件")],
    },
    {
        "id": "P-06", "title": "乡村道路建设与维护申请", "category": "乡村建设",
        "keywords": ["道路", "修路", "硬化", "路灯", "交通", "乡村道路"],
        "summary": "村内道路硬化、维修由村集体提出项目申请，纳入乡镇项目库后分批实施。",
        "applyTo": ["村民小组、村集体经济组织"],
        "materials": ["项目申请报告", "村民代表会议决议", "路段现状照片及位置图", "预算测算表"],
        "steps": ["村民小组提出需求", "村“两委”会议研究", "报乡镇项目库", "批复后组织施工并公示"],
        "place": "村便民服务站登记，镇村镇建设办受理",
        "placePending": True,
        "basis": ["《农村公路建设管理办法》"],
        "updatedAt": "2025-06-30", "confirmed": True,
        "docs": [doc(7, "农村公路建设管理办法", "交通运输部", "2025-06-30", "官方文件")],
    },
    {
        "id": "P-07", "title": "高龄津贴申领", "category": "社会救助",
        "keywords": ["高龄", "津贴", "老人", "80岁", "补贴"],
        "summary": "年满 80 周岁的本村户籍老人可申领高龄津贴，按月发放。",
        "applyTo": ["年满 80 周岁、具有本村户籍的老年人"],
        "materials": ["身份证", "户口簿", "本人银行卡", "近期免冠照片"],
        "steps": ["本人或家属到村便民服务站提出申请", "村级初审公示", "乡镇复核", "按月发放至银行卡"],
        "place": "村便民服务站",
        "placePending": False,
        "basis": ["《老年人优待和高龄津贴发放办法》"],
        "updatedAt": "2026-01-10", "confirmed": True,
        "docs": [doc(8, "老年人优待和高龄津贴发放办法", "XX市民政局", "2026-01-10", "地方文件")],
    },
    {
        "id": "P-08", "title": "农村危房改造补助", "category": "乡村建设",
        "keywords": ["危房", "改造", "住房安全", "修缮", "补助"],
        "summary": "经鉴定为 C、D 级危房且属低收入群体的农户，可申请危房改造补助。",
        "applyTo": ["农村低收入群体", "房屋经鉴定为 C 级或 D 级危房"],
        "materials": ["身份证", "房屋安全鉴定报告", "改造前照片", "施工合同", "银行账户"],
        "steps": ["农户申请", "村级评议公示", "乡镇审核", "县级审批", "竣工验收到户"],
        "place": "镇村镇建设办（村便民服务站可协助）",
        "placePending": True,
        "basis": ["《农村危房改造实施方案》"],
        "updatedAt": "2025-08-16", "confirmed": True,
        "docs": [doc(9, "农村危房改造实施方案", "住房和城乡建设部", "2025-08-16", "官方文件")],
    },
]

# ---------- 服务分类 ----------
services = [
    {"id": "S-01", "cat": "惠农政策", "name": "农机购置补贴", "desc": "申请条件、材料与流程", "policyId": "P-01", "hot": True},
    {"id": "S-02", "cat": "惠农政策", "name": "粮食补贴查询", "desc": "补贴标准与发放查询", "policyId": "P-02", "hot": True},
    {"id": "S-03", "cat": "惠农政策", "name": "农业保险投保", "desc": "水稻、茶叶等险种", "policyId": None, "hot": False},
    {"id": "S-04", "cat": "民生政务", "name": "宅基地和建房", "desc": "申请条件与审批流程", "policyId": "P-04", "hot": True},
    {"id": "S-05", "cat": "民生政务", "name": "高龄津贴申领", "desc": "80 周岁以上老人", "policyId": "P-07", "hot": False},
    {"id": "S-06", "cat": "民生政务", "name": "居住证明开具", "desc": "村级代办，当场办结", "policyId": None, "hot": False},
    {"id": "S-07", "cat": "医保社保", "name": "医保报销比例", "desc": "住院、门诊报销政策", "policyId": "P-03", "hot": True},
    {"id": "S-08", "cat": "医保社保", "name": "养老金资格认证", "desc": "手机刷脸，每年一次", "policyId": "P-05", "hot": True},
    {"id": "S-09", "cat": "医保社保", "name": "慢性病用药备案", "desc": "高血压、糖尿病等", "policyId": None, "hot": False},
    {"id": "S-10", "cat": "便民服务", "name": "水电费代缴", "desc": "村便民服务站代收", "policyId": None, "hot": False},
    {"id": "S-11", "cat": "便民服务", "name": "快递代收代寄", "desc": "村快递驿站", "policyId": None, "hot": False},
    {"id": "S-12", "cat": "便民服务", "name": "上门代办预约", "desc": "行动不便人群优先", "policyId": None, "hot": True},
    {"id": "S-13", "cat": "乡村建设", "name": "道路建设申请", "desc": "村内道路硬化与维修", "policyId": "P-06", "hot": False},
    {"id": "S-14", "cat": "乡村建设", "name": "危房改造补助", "desc": "C、D 级危房改造", "policyId": "P-08", "hot": False},
    {"id": "S-15", "cat": "社会救助", "name": "低保申请", "desc": "家庭收入与财产核对", "policyId": None, "hot": False},
    {"id": "S-16", "cat": "社会救助", "name": "临时救助", "desc": "突发困难家庭救助", "policyId": None, "hot": False},
]
categories = [
    {"id": "C-01", "name": "惠农政策", "icon": "sprout", "color": "#22a06b", "desc": "看政策 学补贴"},
    {"id": "C-02", "name": "民生政务", "icon": "doc", "color": "#e8663d", "desc": "办事项 少跑腿"},
    {"id": "C-03", "name": "医保社保", "icon": "shield", "color": "#2f7cf6", "desc": "保健康 更安心"},
    {"id": "C-04", "name": "便民服务", "icon": "home", "color": "#22a06b", "desc": "生活事 更方便"},
    {"id": "C-05", "name": "乡村建设", "icon": "build", "color": "#8a63d2", "desc": "共建美好家园"},
    {"id": "C-06", "name": "社会救助", "icon": "heart", "color": "#e0475f", "desc": "困难有人帮"},
]

stats = {
    "village": "示范村",
    "households": 428, "population": 672, "outflow": 156, "care": 23,
    "cameras": 12, "servicePoints": 5, "pendingEvents": 3,
    "householdsDelta": 2.3, "populationDelta": 1.1, "cameraOnline": 11, "cameraOnlineRate": 91.7,
    "monthly": [
        {"month": "5月", "resident": 651, "floating": 44, "households": 419, "newHouseholds": 5, "events": 26, "pending": 4},
        {"month": "6月", "resident": 658, "floating": 51, "households": 421, "newHouseholds": 3, "events": 31, "pending": 5},
        {"month": "7月", "resident": 664, "floating": 58, "households": 423, "newHouseholds": 4, "events": 38, "pending": 6},
        {"month": "8月", "resident": 667, "floating": 62, "households": 425, "newHouseholds": 2, "events": 34, "pending": 5},
        {"month": "9月", "resident": 669, "floating": 60, "households": 427, "newHouseholds": 3, "events": 29, "pending": 4},
        {"month": "10月", "resident": 672, "floating": 56, "households": 428, "newHouseholds": 2, "events": 22, "pending": 3},
    ],
}

for name, obj in [("villages", villages), ("households", households), ("service-points", service_points),
                  ("cameras", cameras), ("events", ev_list), ("notices", notice_list),
                  ("policies", policies), ("services", services), ("categories", categories),
                  ("stats", stats)]:
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    print("wrote", name, len(obj) if isinstance(obj, list) else "")
print("village boundary pts", len(village_poly))
print("household sample", households[0])
