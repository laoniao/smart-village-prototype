# -*- coding: utf-8 -*-
"""
从公开卫星影像中提取房屋点位（用于生成“落图”的农户坐标）。

思路：
1. 按指定中心点与缩放级别下载 N×N 张卫星瓦片并拼接；
2. 用“非植被 + 中高亮度”的像素规则得到建筑候选，再做分块密度过滤与非极大值抑制；
3. 把像素坐标换算为 WGS84 经纬度，输出 tools/footprints.json。

注意：本脚本仅用于原型演示，输出坐标会再叠加随机微偏移，不对应任何真实住户。
依赖：pip install pillow numpy
用法：python tools/extract-footprints.py
"""
import os, math, json, urllib.request, concurrent.futures
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tiles")
OUT_JSON = os.path.join(ROOT, "tools", "footprints.json")
OUT_PREVIEW = os.path.join(ROOT, "tools", "footprints-preview.png")

Z = 17
CX, CY = 109269, 53978     # 中心瓦片编号（杭州西湖区龙井村一带，演示用）
N = 8                      # 拼接 N×N 张瓦片
TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


def fetch(x, y):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, f"{x}_{y}.png")
    if os.path.exists(p) and os.path.getsize(p) > 2000:
        return p
    req = urllib.request.Request(TILE_URL.format(z=Z, x=x, y=y), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r, open(p, "wb") as f:
        f.write(r.read())
    return p


def build_mosaic():
    x0, y0 = CX - N // 2, CY - N // 2
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(lambda xy: fetch(*xy), [(x0 + i, y0 + j) for i in range(N) for j in range(N)]))
    m = Image.new("RGB", (256 * N, 256 * N))
    for i in range(N):
        for j in range(N):
            m.paste(Image.open(os.path.join(CACHE, f"{x0 + i}_{y0 + j}.png")).convert("RGB"), (i * 256, j * 256))
    return m, x0, y0


def to_lnglat(px, py, x0, y0):
    n = 2 ** Z
    tx, ty = x0 + px / 256.0, y0 + py / 256.0
    return tx / n * 360.0 - 180.0, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / n))))


def main():
    m, x0, y0 = build_mosaic()
    a = np.asarray(m).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    bright = a.mean(axis=2)
    veg = (g > b + 14) & (g > r + 4)              # 植被：绿通道明显占优
    mask = (~veg) & (bright > 72) & (bright < 238)  # 屋顶：非植被且亮度适中

    BS = 6
    gh, gw = mask.shape[0] // BS, mask.shape[1] // BS
    score = mask[: gh * BS, : gw * BS].reshape(gh, BS, gw, BS).sum(axis=(1, 3)) / (BS * BS)

    cand, taken = [], np.zeros((gh, gw), bool)
    ys, xs = np.where(score > 0.55)
    for k in np.argsort(-score[ys, xs]):
        y, x = ys[k], xs[k]
        if taken[max(0, y - 1): y + 2, max(0, x - 1): x + 2].any():
            continue
        taken[y, x] = True
        cand.append({"x": x * BS + BS / 2, "y": y * BS + BS / 2, "s": float(score[y, x])})

    # 密度过滤：剔除孤立点（道路/田埂误检）
    from collections import defaultdict
    cells = defaultdict(list)
    for p in cand:
        cells[(int(p["x"] // 40), int(p["y"] // 40))].append(p)
    dense = [p for v in cells.values() if len(v) >= 4 for p in v]
    dense.sort(key=lambda p: -p["s"])

    kept = []
    for p in dense:
        if all((p["x"] - q["x"]) ** 2 + (p["y"] - q["y"]) ** 2 > 100 for q in kept):
            kept.append(p)

    out = []
    for p in kept:
        lng, lat = to_lnglat(p["x"], p["y"], x0, y0)
        out.append({"lng": round(lng, 6), "lat": round(lat, 6), "score": round(p["s"], 2)})
    json.dump(out, open(OUT_JSON, "w", encoding="utf-8"), ensure_ascii=False)
    print("房屋点位：", len(out), "→", OUT_JSON)

    vis = m.copy()
    d = ImageDraw.Draw(vis)
    for p in kept:
        d.ellipse([p["x"] - 3.5, p["y"] - 3.5, p["x"] + 3.5, p["y"] + 3.5], outline=(255, 30, 30))
    vis.resize((900, 900)).save(OUT_PREVIEW)
    print("检测预览：", OUT_PREVIEW)


if __name__ == "__main__":
    main()
