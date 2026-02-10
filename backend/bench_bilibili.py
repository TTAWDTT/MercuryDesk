"""测试纯 HTTP 方式获取 B站视频列表的可行性和速度"""
import time
import httpx
import re
import concurrent.futures

UID = "1057241855"
_BVID_RE = re.compile(r"\b(BV[0-9A-Za-z]{10})\b")
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Referer": f"https://space.bilibili.com/{UID}/",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://space.bilibili.com",
}

client = httpx.Client(timeout=15, follow_redirects=True, headers={"User-Agent": UA})

# ── 方案 A: 直接调 arc/search (无 WBI) ──
print("=== 方案 A: arc/search (无 WBI) ===")
t0 = time.perf_counter()
try:
    r = client.get(
        "https://api.bilibili.com/x/space/arc/search",
        params={"mid": UID, "pn": "1", "ps": "30", "order": "pubdate"},
        headers=HEADERS,
    )
    data = r.json()
    print(f"  code={data.get('code')}, message={data.get('message', '')[:80]}")
    vlist = data.get("data", {}).get("list", {}).get("vlist", [])
    print(f"  视频数: {len(vlist)}")
except Exception as e:
    print(f"  失败: {e}")
print(f"  耗时: {time.perf_counter()-t0:.2f}s\n")

# ── 方案 B: dynamic feed API (无 Cookie) ──
print("=== 方案 B: dynamic feed API (无 Cookie) ===")
t0 = time.perf_counter()
try:
    r = client.get(
        "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space",
        params={"host_mid": UID},
        headers=HEADERS,
    )
    data = r.json()
    print(f"  code={data.get('code')}, message={data.get('message', '')[:80]}")
    items = data.get("data", {}).get("items", [])
    bvids = []
    for item in items:
        major = item.get("modules", {}).get("module_dynamic", {}).get("major", {})
        archive = major.get("archive", {}) if isinstance(major, dict) else {}
        bvid = archive.get("bvid")
        if bvid:
            bvids.append(bvid)
    print(f"  BV IDs: {len(bvids)} → {bvids[:5]}")
except Exception as e:
    print(f"  失败: {e}")
print(f"  耗时: {time.perf_counter()-t0:.2f}s\n")

# ── 方案 C: 直接 HTTP GET 空间页提取 BV 号 ──
print("=== 方案 C: HTTP GET 空间页 ===")
t0 = time.perf_counter()
try:
    r = client.get(
        f"https://space.bilibili.com/{UID}/video",
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    bvids = list(set(_BVID_RE.findall(r.text)))
    print(f"  status={r.status_code}, BV IDs: {len(bvids)} → {bvids[:5]}")
    # 检查 __INITIAL_STATE__
    if "__INITIAL_STATE__" in r.text:
        print("  ⚡ 包含 __INITIAL_STATE__")
except Exception as e:
    print(f"  失败: {e}")
print(f"  耗时: {time.perf_counter()-t0:.2f}s\n")

# ── 方案 D: wbi/arc/search + 从 nav 获取 WBI key ──
print("=== 方案 D: wbi/arc/search + WBI 签名 ===")
t0 = time.perf_counter()
try:
    import hashlib, urllib.parse
    _MIXIN_KEY_ENC_TAB = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
        27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
        37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
        22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
    ]
    nav_r = client.get(
        "https://api.bilibili.com/x/web-interface/nav",
        headers={"User-Agent": UA, "Referer": "https://www.bilibili.com/"},
    )
    nav_data = nav_r.json()
    print(f"  nav code={nav_data.get('code')}")
    wbi_img = nav_data.get("data", {}).get("wbi_img", {})
    img_url = wbi_img.get("img_url", "")
    sub_url = wbi_img.get("sub_url", "")
    img_key = img_url.rsplit("/", 1)[-1].split(".")[0] if img_url else ""
    sub_key = sub_url.rsplit("/", 1)[-1].split(".")[0] if sub_url else ""
    print(f"  img_key={img_key[:10]}..., sub_key={sub_key[:10]}...")
    
    if img_key and sub_key:
        orig = img_key + sub_key
        mixin_key = "".join(orig[i] for i in _MIXIN_KEY_ENC_TAB)[:32]
        import time as t_mod
        params = {"mid": UID, "ps": "30", "pn": "1", "order": "pubdate", "wts": str(int(t_mod.time()))}
        params = dict(sorted(params.items()))
        filtered = {k: re.sub(r"[!'()*]", "", str(v)) for k, v in params.items()}
        query = urllib.parse.urlencode(filtered)
        params["w_rid"] = hashlib.md5((query + mixin_key).encode()).hexdigest()
        
        r = client.get(
            "https://api.bilibili.com/x/space/wbi/arc/search",
            params=params,
            headers=HEADERS,
        )
        data = r.json()
        print(f"  code={data.get('code')}, message={data.get('message', '')[:80]}")
        vlist = data.get("data", {}).get("list", {}).get("vlist", [])
        print(f"  视频数: {len(vlist)}")
        if vlist:
            print(f"  第一个: bvid={vlist[0].get('bvid')}, title={vlist[0].get('title', '')[:40]}")
except Exception as e:
    print(f"  失败: {e}")
print(f"  耗时: {time.perf_counter()-t0:.2f}s\n")

# ── 方案 E: 并发 view API 调用速度 ──
print("=== 方案 E: 并发 view API ===")
test_bvids = ["BV17YFHzgE9A", "BV1jXF8zbEwv", "BV1vY6zBvEL5", "BV1b96FBmEBg", "BV1JfzkBnEZu"]

def fetch_view(bvid):
    r = client.get(
        "https://api.bilibili.com/x/web-interface/view",
        params={"bvid": bvid},
        headers={"User-Agent": UA, "Referer": f"https://www.bilibili.com/video/{bvid}/"},
    )
    return r.json().get("code") == 0

# 顺序
t0 = time.perf_counter()
results_seq = [fetch_view(bv) for bv in test_bvids]
t_seq = time.perf_counter() - t0
print(f"  顺序 5 个: {t_seq:.2f}s, 成功: {sum(results_seq)}")

# 并发
t0 = time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
    results_par = list(ex.map(fetch_view, test_bvids))
t_par = time.perf_counter() - t0
print(f"  并发 5 个: {t_par:.2f}s, 成功: {sum(results_par)}")
print(f"  加速比: {t_seq/t_par:.1f}x\n")

client.close()
print("=== 测试完成 ===")
