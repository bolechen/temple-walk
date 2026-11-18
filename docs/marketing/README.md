# 宣发素材：规则、出处与重出步骤（#152）

**状态（2026-11-18）：最终素材未出，等重构落地。** 树（#162）、远山（#183）、小沙弥（#163）都要换，现在拍的全套重构后都得重拍。这个 PR 交付的是**能复用的东西**：脚本、机位清单、分镜、文案草稿、调研，外加一段 T4 样片证明流程走得通（见「样片」）。小红书封面与排序、X 的中英文帖与配图、Steam 草稿的文字与胶囊图清单**都还没写**，重构后再做。

## 一、硬约束（issue #152）

1. **只用实机画面。** 图和视频都从真实构建里出；不用 AI 生成的图，不后期加游戏里没有的东西。调色、裁切、字幕、转场可以。字幕是项目字体（Yunjing Kai）的一行字叠在画面上，隐藏的只有界面按钮。
2. **授权干净。** `docs/t00/asset-register.csv` 里 `commercial_use` 不是 `yes` 的不用（现有 7 件 `unverified`：MESHY-novice、OG-share、REF-T00-main、REF-T00-sheet、REF-jingshan-plates、REF-monk-apose、REF-art-prototype）。小沙弥用默认的代码身体（`?body=code`，所有脚本的地址都带它）。字体只用项目自带的六款（OFL）。配乐和钟声只用本项目合成的（`tools/music.mjs`、`tools/marketing-audio.mjs`）。**不使用游戏自带的分享预览图（`OG-share`）。**
3. **避开殿内博物馆藏品的特写。** 起步包只拍殿外和庭院。**例外要注意**：大殿上檐「釋迦寶殿」匾的四个字取自 ColBase TB-1446（东京国立博物馆藏）并经加工，凡是匾上字看得清的大殿镜头（如 `hall`）发出时要署名，写法见下。
4. **调子**：安静庄严，不快切、不夸张标题。文案不说「开放世界」「AI 生成的寺院」；说清是序章、网页即玩、约十几分钟；寺名云径禅寺是虚构的，原型研究的是径山，**不称「还原径山寺」**；手机真机还没系统测过，只说「电脑和手机的浏览器都能打开」。
5. **大文件不进 git。** 视频、4K 原图放 `hf://buckets/bolechen/temple-walk-render/marketing/<日期>/<run>/`；仓库里只放清单（`manifest-*.json`：文件名、SHA-256、提交号、地址参数、站点指纹）、每张 ≤ 400 KB 的预览图和文案。
6. **不替所有者发布**，不注册账号，不把所有者的姓名、邮箱写进素材或请求。

## 二、署名怎么写

- 画面里只有游戏本身；视频或帖子里出现大殿匾额近景时，加一行：「大殿匾额四字据 ColBase（https://colbase.nich.go.jp/collection_items/tnm/TB-1446）所载无准师范《禅院额字『釈迦宝殿』》（东京国立博物馆藏）加工，分离墨迹并裁切为四字。」（出自 `docs/t00/LICENSING-AUDIT.md` §六。）
- 起步包不拍殿内，所以克利夫兰、大都会、ColBase 的馆藏画与扫描雕塑不会入镜；若某张图里露出，按审计 §六 补署名，或换机位。
- 字体、纹理（Poly Haven CC0）、three.js 等的署名在游戏内的「鸣谢」页，宣发文案不必重复。

## 三、不能用的

`asset-register.csv` 里 7 件 `unverified`（上面列出）；雕刻身体的小沙弥（`?body=sculpt`）；任何殿内藏品特写；外部音源与录音；AI 生成图。

## 四、每件素材的出处

每次出片由 `tools/marketing-gpu.sh` 写一份 `docs/marketing/manifest-<run>.json`：每个文件的 SHA-256、出图用的页面地址、提交号（`+dirty` 表示 `app/` 有未提交改动）、站点指纹（`report.json` 的 `site`）。发布前把清单里的行抄进下表。

| 文件 | 场景与地址参数 | 提交号 | 清单 |
|---|---|---|---|
| （重构后补） | | | |

## 五、重构落地后，照这个顺序重出全套

前置：`pnpm install`；`hf` 已登录（`HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 是占位值，真令牌由代理注入）；Node 22+、ffmpeg。

1. **合并最新 main，重看机位。** `shots.json` 里 10 个机位（竹林起点、石阶、照壁前、山门、首院、大殿、凌霄阁回望、撞钟、夜、雪）每个有横版 3840×2160 与竖版 1560×2080。
   `node tools/marketing-shots.cjs --scale 0.25 --orient land --out tools/out/mk`（本地 SwiftShader，慢，约一分钟一张）。看每张构图：树、远山、小沙弥换了以后，**依赖它们的机位都要重看**——凌霄阁回望（远山、树）、竹林起点（树、竹）、首院与雪景（树）、撞钟（小沙弥近景）、照壁前（小沙弥）。机位不对就改 `shots.json` 里的 `query`（`?cam=x,z,yaw,pitch` 或命名视图）。挑不出好图的机位，`shots.json` 里留了备选思路：山门用夏昼、竹林起点用秋晨。
2. **本地试一小段片子**确认没坏：`node tools/marketing-film.cjs --size 216x384 --fps 3 --only 3-bell --out tools/out/film-t`（SwiftShader 很慢，开场一段尤其慢，只看流程）。
3. **T4 上一次出齐**（上限 1 小时，约 $0.40）：
   - `tools/marketing-gpu.sh full`：`shots.json` 全部静帧加竖版四段；`tools/marketing-gpu.sh full-wide`：16:9 版四段（X 用）。
   - 两条命令各自把大文件同步进桶，并写 `docs/marketing/manifest-<run>.json`。
   - 快超时先停下告诉主创。
4. **声音**：`node tools/music.mjs autumn-dusk`（取 `tools/out/music/` 里合适的一段），钟声 `node tools/marketing-audio.mjs tools/out/bells.wav 40 '[["far",0.5],["bell",<撞钟的时刻>]]'`。
5. **剪辑**：`tools/marketing-edit.sh <分段目录> <音乐> tools/out/bells.wav <成片.mp4>`（慢溶、淡入淡出、配乐压低钟声在上；10–15 秒的 X 短版取成片的一段，用 `ffmpeg -ss <起> -t <秒>`）。成片和分段放桶里，清单入库。
6. **补文案**：小红书封面（3:4，项目字体）、6–9 张排序；X 中英主帖、跟帖、4 张图的 alt；Steam 短描述、长描述、5 张截图、胶囊图尺寸清单。草稿与思路见 `first-batch.md`（调子已通过主创评审）和 `RESEARCH.md`（依据）。
7. **缩略图总览**：用 ffmpeg 的 `tile` 把所有图和视频关键帧拼一张，放进 PR。

## 六、已知的坑

- **`?shot=1` 的页面里按 E 撞不了钟。** `?show=shot-bell&shot=1` 能把他放在钟旁并把眼睛放到撞钟的机位，但按 E（键盘或点按钮）都不会拉绳（`__rites().bell.pulls` 一直是 0）。所以 `marketing-film.cjs` 的撞钟段不用 `?shot`，走访客的路：点「入山」、Esc 跳过开场、`__pose` 到钟旁、等「撞钟」出现、按 E，再用 `__riteClock` 冻结观礼时钟逐帧推进；界面上的按钮和提示用样式隐藏。这条行为没有在这个 PR 里修，是否算 bug 由主创定。
- 本地 SwiftShader 出一帧很慢，逐帧出片的完整视频只能在 T4 上做，本地只试流程。
- 开场与序章标题的逐帧推进靠 `__openingAt(秒)` 和给 `#prologue` 的 CSS 动画设时钟，**重构后若这两处实现变了，要先在小尺寸上试一遍**。

## 七、样片

见 PR #158 正文的「样片」一节（运行号、站点指纹、耗时）。
