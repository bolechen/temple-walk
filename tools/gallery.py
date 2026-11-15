#!/usr/bin/env python3
"""Hang the real works in the halls: pack the pictures and write what is known about each.

    python3 tools/gallery.py <dir holding the collected works>      (needs Pillow)

The works are things that survive from the temple this place is drawn from, or show what one of its halls is for:
letters and large characters by Jingshan's abbots, paintings of the Chan school, the tea bowls of its time. Each
comes from a museum that publishes it for free reuse: ColBase (Japan's National Institutes for Cultural Heritage;
the source line it asks for is kept with each work), the Metropolitan Museum's Open Access or the Cleveland Museum
of Art's Open Access (both public domain, CC0).
The directory holds one folder per work with `source.jpg` and `meta.json` (title, maker, period, holder, the
encyclopedia note, the credit line, the page it came from) and an `index.json` of them all.

Writes app/levels/t00/gallery/<slug>.webp (the longest side 1280) and app/src/works.js (what the halls and the reading card use).
Which work hangs in which hall, and in what order along the walls, is the HANG table below.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HANG = {
    "main": ["wuzhun-shijia-baodian", "liangkai-chushan-shijia", "liangkai-liuzu-jiezhu", "cma-chushan-shijia-chijue", "cma-luye-damo", "cma-luohan-shizhe", "yintuoluo-wuzu-zailai"],
    "chan": ["yuanwu-yinkezhuang", "xutang-poxutang", "met-qilv-tu"],
    "tea": ["wuzhun-tang", "jianyao-hemu-tianmu", "jianyao-youdi-tianmu"],
    "library": ["zhangjizhi-huayanjing", "songban-yuanwu-xinyao", "cma-jinzi-fahuajing-feihua"],
    "yaoshi": ["met-yaoshi-fohui", "cma-yaoshi-shier-shenjiang", "met-shier-shenjiang"],
    "dahui": ["dahui-wuxiang-chidu", "wuzhun-bandu-chidu", "chijue-bayu"],
    "guanyin": ["baiyi-guanyin", "cma-baiyi-guanyin-zhongfeng", "cma-baiyi-guanyin-zhangyuehu"],
    "lingxiao": ["met-zhangjizhi-leyouyuan", "muqi-long-tu", "muqi-hu-tu", "malin-zuokan-yunqi", "cma-qiaofu-guijia-xuzhou", "cma-muniu-tu", "met-zhiweng-yaoshan-liao"],
}
# Where a photograph shows more than the work (a gallery with benches, a brocade mount), the part to keep: left, top, right, bottom.
CROP = {
    "met-yaoshi-fohui": (0.015, 0.05, 0.985, 0.672),
    "cma-luye-damo": (0, 0.02, 1, 0.965), "yintuoluo-wuzu-zailai": (0.02, 0.08, 0.97, 0.94), "cma-jinzi-fahuajing-feihua": (0.055, 0.05, 0.96, 0.95),
    "cma-yaoshi-shier-shenjiang": (0.03, 0.015, 0.97, 0.985), "cma-baiyi-guanyin-zhongfeng": (0.03, 0.01, 0.97, 0.99), "cma-baiyi-guanyin-zhangyuehu": (0.03, 0.04, 0.97, 0.98),
    "muqi-long-tu": (0.04, 0.015, 0.96, 0.985), "muqi-hu-tu": (0.04, 0.015, 0.96, 0.985), "cma-qiaofu-guijia-xuzhou": (0.02, 0.01, 0.98, 0.99),
    "malin-zuokan-yunqi": (0.20, 0.12, 0.84, 0.88), "cma-muniu-tu": (0.01, 0.12, 0.995, 0.93),
}

def main():
    src = sys.argv[1]; out = f"{ROOT}/app/levels/t00/gallery"; os.makedirs(out, exist_ok=True)
    works = {m["slug"]: m for m in json.load(open(f"{src}/index.json", encoding="utf-8"))}
    data = {}
    for hall, slugs in HANG.items():
        for slug in slugs:
            m = works[slug]; im = Image.open(f"{src}/{slug}/source.jpg").convert("RGB")
            if slug in CROP: l, t, r, b = CROP[slug]; im = im.crop((round(im.width * l), round(im.height * t), round(im.width * r), round(im.height * b)))
            k = 1280 / max(im.size)
            if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            im.save(f"{out}/{slug}.webp", quality=80, method=6)
            rank = m.get("designation") or ""; rank = "" if rank == "none" else rank
            data[slug] = {"title": m["title_zh"], "by": m["artist_zh"], "dates": m.get("artist_dates") or "", "period": m["period_zh"], "medium": m["medium_zh"],
                          "size": m.get("size_cm") or "", "holder": m["holder_zh"], "rank": rank, "note": m["note_zh"], "link": m["jingshan_link_zh"],
                          "credit": m["credit_line"], "url": m["page_url"], "w": im.width, "h": im.height}
            print(f"{slug:28s} {im.width}x{im.height} {os.path.getsize(f'{out}/{slug}.webp') // 1024:4d} KB  {hall}")
    js = ("// The real works that hang in the halls: written by tools/gallery.py from the museums' own records. Do not edit by hand.\n"
          "// Each is published for free reuse by the museum that holds it; `credit` is the source line to show with it.\n"
          "export const HANG = " + json.dumps(HANG, ensure_ascii=False) + ";\n"
          "export const WORKS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    open(f"{ROOT}/app/src/works.js", "w", encoding="utf-8").write(js)
    print(sum(os.path.getsize(f"{out}/{f}") for f in os.listdir(out)) // 1024, "KB in app/levels/t00/gallery")

if __name__ == "__main__":
    main()
