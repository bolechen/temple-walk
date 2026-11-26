---
name: video-production
description: 从 temple-walk 实机渲染制作 Steam 横屏宣传片与视频号/小红书 9:16 竖屏成片的完整工作流：先声后画、共享素材池、全字库强校验、SSD 直出、仪轨动画逐帧捕获、交付门禁与 social-promotion 入库规范。适用于为 T00/T05 或后续关卡出宣传片、系列短视频与封面，不用于游戏内普通截图审图（审图用 art-gate）。
metadata:
  version: "1.1.1"
  project: "山门之外 / temple-walk"
---

# 实机宣传片与短视频怎么出片

为什么有这一页：2026-11-23～24 连续制作 Steam 横屏宣传片 V1/V2 与「如是我闻.co」3 条竖屏短视频期间，反复踩了 6 类坑——默认人物模型漂移、`about:blank` 跨源拉字体触发 FOIT 空灰条、游戏子集 `woff2` 隐性缺字回退、Chrome Metal 录屏与 MLX 配音互抢 GPU、先盲录再对配音导致剪辑回跳、3.4 GB 素材先落本地仓库再搬 SSD。本页取代上述零散手工摸索，把**先声后画 + 四道硬门禁**固化成可直接照做的标准流程。

---

## 一、Stage 0 · 规格与字库冻结（开工前 30 秒，零渲染成本）

1. **大文件唯一落盘 SSD（严禁写进仓库 `tools/out/`）**
   - 统一输出根目录：`/Volumes/SSD/temple-walk-videos/<batch>/`（含共享 `pool/`、音频、各成片包）。
   - 需进 `social-promotion` 审核看板的成片，在同卷 `/Volumes/SSD` 上用 APFS 零拷贝克隆（`cp -c -R`）至 `/Volumes/SSD/buddhist-say/promo-out/videos/<YYYY-MM-DD-slug>/`——`board.py` 会 `resolve()` 符号链接并只放行 `MEDIA_ROOTS` 下的物理文件。
2. **冻结实机渲染参数单**
   - 显式写死人物身体参数：`?body=code`（0.7.0 代码闭眼小沙弥）或默认 Tripo（`?body=tripo`），严禁依赖默认值。
   - 锁定 `level`、`q=high`、`season`、`time`、`view` 以及需要实机捕获的仪轨动作清单（如 `tea` / `bell` / `incense`）。
3. **全字库与 `cmap` 预检（严禁拿游戏子集 `woff2` 出对外视频）**
   - 游戏内 `dist/shared/fonts/*.woff2` 仅含 1,379 个游戏内字符，且 `brush.woff2`（Ma Shan Zheng）缺少「喫」等字，直接用于短视频/封面会导致隐性混排回退。
   - 对外视频与 3:4 封面统一使用「如是我闻」全字库：
     - 标题 / 引题 / 顶部标签 / 尾卡品牌名：`/Volumes/Dev/buddhist-say/promo-out/assets/KingHwaOldSong-GJ.ttf`（京华老宋体，39,599 字）
     - 字幕 / 封面副标 / 尾卡问句 / 朱印：`/Volumes/Dev/buddhist-say/promo-out/assets/LXGWWenKai-Regular.ttf`（霞鹜文楷，46,412 字）
   - 开渲前先跑零依赖校验脚本，确保本批全部文案字符 **0 缺字**：
     ```bash
     python3 skills/video-production/scripts/check-fonts.py \
       --fonts /Volumes/Dev/buddhist-say/promo-out/assets/KingHwaOldSong-GJ.ttf \
               /Volumes/Dev/buddhist-say/promo-out/assets/LXGWWenKai-Regular.ttf \
       --text-file <剧本或文案JSON/TXT>
     ```

---

## 二、Stage 1 · 先声后画（配音独享 GPU，反算精确分镜时长）

1. **先出配音，后录画面**：Chrome Metal 录屏与 MLX `make_voice.py`（Qwen3-TTS + Whisper）同时跑会互抢 Apple Silicon GPU，拖慢 5–10 倍。有口播的项目必须先独享 GPU 跑完配音。
2. **口播双重门禁**（`kang 老师` 音色）：
   ```bash
   /Volumes/SSD/buddhist-say/promo-out/tts-eval/.venv/bin/python \
     /Users/avenger/social-promotion/ops/checks/make_voice.py \
     --lines <pack>/vo/lines.json --out <pack>/vo
   ```
   - 每句须过双门禁（拼音含声调、音高，阈值以 social-promotion 的 `voice_spec()` 为准）；`vo/report.json` 中 `ok` 全为 `true`。
   - **异体字防误读**：`lines.json` 口播稿写通用字（如「吃茶去」），渲染画面字幕时再替换为典雅字形（如「喫茶去」）。
   - 成片目录需留 `voice_ref.py` 引用 `kang` 参考音路径，供 `ops qc` 校验音色来源。
3. **由真实音频时长反算分镜**：用 `ffprobe` 读出 `vo/00.wav ..` 精确秒数，算出 `bodyEnd` 与每个镜头需要的秒数（再加 `0.5s` 转场余量），再进入录屏阶段——彻底杜绝盲录浪费、末尾冻帧或同一段素材回跳。

---

## 三、Stage 2 · 定帧闸门 → Metal GPU 共享素材池录屏

1. **先出 1 帧定帧拼图（Stills Gate，~20 秒）**
   - 所有候选机位先各截 1 帧拼成联系表，人工目检通过后再录全帧 MP4：
     - 构图无柱子/树冠贴边遮挡；
     - 主体小沙弥与建筑比例协调，竖屏上下留足安全区；
     - **合规避坑**：大殿上香机位改从西侧切入（例：`__look([cx - 2.35, fy + 1.15, cz + 2.15], [cx + 0.15, fy + 2.05, cz - 2.6])`），彻底避开功德箱入画。
2. **真显卡与视口突破**
   - 启动系统 Chrome（`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`），加 `--use-angle=metal --ignore-gpu-blocklist --enable-gpu`。
   - **突破 macOS 窗口高度上限（993px）**：对每个页面通过 `const cdp = await ctx.newCDPSession(page)`（注意在 `BrowserContext` 上调，不是 `Page`）发送：
     ```js
     await cdp.send("Emulation.setDeviceMetricsOverride", {
       width, height, deviceScaleFactor: 1, mobile: false,
     });
     ```
3. **仪轨动画实机捕获铁律（吃茶 / 撞钟 / 上香）**
   - **不带 `?trailer=1`**：该参数会冻结 `rAF`，卡死游戏里基于 `setTimeout` 的 `wait()`。
   - **隐藏 HUD 必须用 `opacity: 0 !important`**，**严禁用 `display: none`**（否则 `E` 键仪轨交互失效）。
   - 正常 `?body=code&enter=1&debug=0&q=high&view=third&...` 进场 → 定位到 `window.__places[rite].at` → 按 `e` → 轮询等到 `window.__director().phase === "hold"` 且仪轨段落激活 → 用 `window.__riteClock(dtMs)` 按 `1000 / fps` 确定性逐帧步进管道喂 `ffmpeg`（`libx264 -crf 12 -pix_fmt yuv420p`）。
4. **共享素材池（`pool/`）与并发控制**
   - 同批多条视频共享 `pool/*.mp4`，一套素材剪出多角度成片；Chrome 录屏进程并发不超过 **2 路**。
   - 配乐切片必须带 `-stream_loop -1` + `apad=whole_dur=...` 兜底，视频段按实际 `clipDur` 动态钳位 `safeSs` 并仅在必要时做微小 `setpts` 平滑，禁止静帧硬冻。

---

## 四、Stage 3 · 文字排版、混音与总装

1. **全字库加载防 FOIT 灰条**
   - 严禁在 `about:blank` 跨源请求本地字体文件；起一个带 `Access-Control-Allow-Origin: *` 的本地 HTTP 静态服务提供 `.ttf`。
   - 每个渲染页（尾卡、字幕/标签、封面）均通过 `new FontFace(...).load()` + `document.fonts.add()` 注册，并以 `document.fonts.check()` 强断言（失败直接抛错中止）；切换文本后等两帧 `requestAnimationFrame` 再截 PNG。
2. **安全区与官方尾卡（9:16 · 1080×1920）**
   - 字幕框与官方尾卡所有元素均须在 **`y ≤ 1620`**（底部留足 `creative_constraints()["safe_bottom_px"]`，避开视频号/小红书交互栏）。
   - 尾卡使用官方 logo `/Volumes/Dev/buddhist-say/promo-out/assets/icon512.png`（200×200，`y1 ≤ 1620`）与「如是我闻」品牌名（字号 ≥ 78px，且不低于 `creative_constraints()["brand_px"]`，OCR 实测才算数，`y1 ≤ 1620`）。
3. **混音与双版本输出**
   - 人声（48kHz）驱动背景配乐做 `sidechaincompress` 避让，成片最终响度 **`-14.5 LUFS`**（门禁范围以 `video_qc()` 为准）、真峰值 **`≤ -1.5 dBFS`**（上限以 `video_qc()` 为准）。
   - 每条同时产出：`*-配音.mp4`（主版）、`*.mp4`（等长纯配乐备选）、`*-封面-3x4.png`（`1080×1440`）、`小红书文案.md`、`manifest.json`。

---

## 五、交付门禁（缺一不可）

### A. `social-promotion` 的 `video_qc`（硬项、软项都要过）

跑法、检查项和全部阈值以 `/Users/avenger/social-promotion/docs/VIDEO-DELIVERY.md` 第四节和 `scripts/ops.py` 的 `creative_constraints()` / `video_qc()` 为准，这里不复述，免得那边改了这里过时。

`video_qc` 的 `ok` 只看硬项，软项（响度、真峰值、封面尺寸、文案违禁词等）不过它照样返回真。所以**软项不是可选项**：软项任何一项不过，写明原因和实际读数再请主人定，主人点头前不得把片子交成「待审」。

### B. 本 skill 另加的 4 项硬检（补 `video_qc` 查不到的）
1. **全字库 `cmap` 覆盖 = 100%**：`check-fonts.py --fonts ... --text-file ...` 报告 0 缺字。
2. **标签与字幕 PNG 非空墨迹检测**：`check-fonts.py --png <pack>/gfx/top-hook.png <pack>/gfx/sub-*.png` 全部通过（杜绝 FOIT 空白灰条）。
3. **人工必看 3 张复核图**：① 批次 `3条封面总览`；② 全部顶部标签与字幕逐行拼接的字体全检图；③ 每条成片的 `qc/sheet.png` 与 `qc/last.png`。
4. **落盘与工作区洁净**：全部大文件在 `/Volumes/SSD/`，仓库 `git status` 无未跟踪大文件或临时产出。

---

## 六、入库 `social-promotion`

落盘、目录内文件、进台账「待审」、绑定素材包、刷新看板，全部按 `/Users/avenger/social-promotion/docs/VIDEO-DELIVERY.md` 第一、二、五节做；制作方只新增「待审」。本项目另加两条：

- 文案注明「云径禅寺为原创虚构山寺，全部为实机渲染」，不写宗教布道口径，不放 Steam 导流、外链、二维码。
- 文案零违禁词。清单与机检在 `VIDEO-DELIVERY.md`，不过就改文案，不算软项例外。
- 画面、封面不署配音者姓名；配音信息只写发布文案。
- 小红书在暂停网页端发布期间只入台账「待审」囤稿，**严禁操作小红书网页创作平台**。

`VIDEO-DELIVERY.md` 第六节「不做的事」与本节同效，先读那一页。

## 出处与踩坑记录

- 2026-11-23～24 实测全链路：Steam V1/V2 横屏宣传片（`/Volumes/SSD/temple-walk-videos/aaa-trailer-v2/`）与「如是我闻.co」3 条竖屏成片（`/Volumes/SSD/temple-walk-videos/channels-3pack/`，`ops qc` 3×14/14 满项通过，12/12 句 `0.0% CER`，195/195 字符零缺字）。
- 配套校验脚本：`skills/video-production/scripts/check-fonts.py`。
