# T00 变更记录

## 2026-11-14 · 修复小和尚上楼时穿入踏面

- 重现：主线3cd5f0b，普通W键上楼，软件Chromium采样中角色根部最多落后支撑面约0.12米，鞋底采样最多穿入约0.20米。
- 角色根部直接贴合踏面，第一/第三视角镜头保留独立平滑；动画鞋子按其跨越的踏面抬起，衣摆对前方台阶作接触修正，坐姿保持原有折腿逻辑。
- 踏步可见几何与碰撞共用步高、踏面深度及外挑尺寸；殿前楼梯按真实平台边沿分段，衔接处取最高可见支撑面。
- 回归验证覆盖可见台阶射线高度、殿前分段、重叠平台、鞋子与衣摆、不同朝向及坐姿；新增`stairs` E2E使用正常速度键盘上/下楼并记录支撑高度。


## 2026-11-14 · M2–M3（提交 52a0059 起）

基准：提交 035efc0（`evidence/M2-before/`）。按 `review-log.json` 的两份评审改，逐条原因见 `decisions.md`。

改动的文件：

- `app/src/mood.js`：「夏 · 昼」成为 J01 阴天雨后；云量对直射光的削减加大。
- `app/src/materials.js`、`app/src/glsl.js`：木色去红压暗并加雨蚀；白墙污痕只在墙脚和压顶下；石面踏亮、缝里少苔；檐下椽子受地面反光。
- `app/src/ground.js`：积水只在洼处；苔只在常潮的缝里。
- `app/src/building.js`：`timber` 选项（木板壁、版门、门钉）；檐下遮蔽减弱。
- `app/src/site.js`：山门木板壁；半山亭移到平台南侧的石台上；照壁瓦顶和窄脊；经幢代替石灯；大殿上下檐收紧；
  山门前柳杉外移，墙外加柳杉林；六个验收机位 `cam01`…`cam06`。
- `app/src/geo.js`：踏步出挑。
- `app/src/plaque.js`：匾额繁体、楷体、暗金。
- `app/src/trees.js`、`app/src/bamboo.js`、`app/src/backdrop.js`、`app/src/sky.js`：柳杉加密压暗；竹下矮竹和蕨；远竹压暗；
  近山不被雾吃掉；云面更匀。
- `app/src/tour.js`（新）、`app/yard.js`：`?tour=120x3` 行走测量。
- `app/src/hints.js`（新）、`app/index.html`、`app/f/kai.woff2`（新）：操作提示只在需要时出现；界面用楷体；游戏名改为「山门之外」。
- `tools/cameras.mjs`（新）、`tools/gpu/job.cjs`：机位清单从总平面写出；GPU 任务可跑行走测量并录像。
- `tests/e2e/run.cjs`：`tour` 场景；`boot`、`keys`、`phone` 改为检查提示会消失。
