# #192 匾字：改前、改后

## 字体与补墨的对照（工具画的字）

- **`faces-and-evening.jpg`**：「喫茶去」「望江亭」「雲徑禪寺」各四行，同字号、同底色，由 `tools/board-ink.py` 自己的画法画出。每行下面标两种量法的数。
  1. Yuji Boku（改前）
  2. 霞鶩文楷 TC 粗体，不补
  3. 按墨占字框补墨（上限 0.05，弃用）：「去」「江」「寺」被补得明显比邻字粗，数是平了，看起来反而不匀
  4. 按笔画宽补墨（本 PR）
- **`ink-before-yuji.json`、`ink-wenkai-raw.json`、`ink-after.json`**：19 块匾逐字的数（笔画宽、墨占字框、补墨值）。生成命令依次为 `python3 tools/board-ink.py --raw <Yuji Boku 的 bang.woff2> --json`、`--raw --json`、`--json`。

## 游戏里（T4）

- **`boards-t4-before-after.jpg`**：左列 main `ccf3f42`（run `20261118-104706`），右列本 PR `065458d`（run `20261118-105250`）。两次 run 的 site 指纹都不带 `+dirty`，报告见 `t4-main.json`、`t4-head.json`。
  - 六个画面：茶寮所有者角度、茶寮正面、山门、大殿、照壁、cam04。均为夏昼，`?shot=1&q=high`，1600×900。
  - 「茶寮所有者角度」那张机位太近、仰角太大，没拍到匾；山门那张匾被切了顶。这两张用下面的近景代替。T4 额度已用完，没有补拍。

## 近景（软件渲染）

- **`boards-close-before-after.jpg`、`boards-close-crops.jpg`**：这几张是**软件渲染**（SwiftShader，本地 1280×720，`?shot=1&q=high`，夏昼，第一人称），不是 T4。要看的是字的墨量匀不匀，软件渲染看得清。左 main `ccf3f42`，右本 PR `065458d`。
  - 茶寮所有者角度：`cam=-9,16.5,-1.18,0.55`
  - 茶寮正面：`cam=-7.0,14,-1.571,0.28`
  - 山门两块匾：`cam=0,53.5,0,0.45`
  - crops 那张是从原图截出匾、放大的。
  - 改前「茶」比「喫」「去」细，「雲」糊成一团，「續」偏轻；改后各块匾上的字轻重一致。
