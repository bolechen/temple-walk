# 独立评审看图与运行记录 · ea2f3d0

- 源码（锁定）：ea2f3d0ccf5b495b7d5b5f86a536f600e3a6d72e（上次评审 727687e，相隔 117 个提交，app/ 与 tests/ 140 个文件）
- 评审结束时主线：f22b9aba021b113e82ded90dd3c42fab83b4b5f3（多出 #179 界面走查、#158 宣发、两份流程文档；改了 ui.css 菜单版面、settings 三分线默认、game/hints/journey/yard）。本记录不适用于 f22b9ab，待复验。
- 环境：托管 Linux，Playwright Chromium headless + SwiftShader；运行仓库代码的子进程移除 GH/GitHub/AWS/云/HF 凭据；服务绑定 127.0.0.1。非目标设备。浏览器、截图、e2e 串行。
- Skill：temple-review @ c4c3ba5（SKILL.md、references/protocol.md）。

## 静态与几何

- pnpm run check：73 个文件 0 问题；pnpm typecheck 退出 0；pnpm test 378/378；评审校验器 17/17。
- pnpm run edges：1,891,145 个站立点，16 组全部 0 越界、最深 0.0 cm；膝下鞋袍最深 0.0 cm；跨步转身 7.0 cm（工具自己的口径，未判失败）。只证 walker/身体几何，不证正常速度录像。

## e2e（SwiftShader，串行）

- e2e:quick（boot）通过。
- 选中 14 个场景首跑：keys、jump、drop、stairs、camera、layers、taps、music、sound、phone 通过；**menu、hallexit、director、opening 失败**（e2e-first-run.log 原样保留）。
- 一次有理由的诊断重试，每个场景单独进程：menu **同一断言再失败**（en 1280×720 `{"fits":true,"clipped":true}`）；hallexit、director、opening 单独通过。
- 归因：menu 为产品版面缺陷（英文时辰一行宽屏溢出，开放 PR #180 写明由 #137 引入、改 chip 内边距）；其余三项为 harness 级联——运行器在场景抛错后不关它开的页面，残留页拖慢同一浏览器里后面的场景（PR #180 的同一诊断与修复，未合并）。没有加长超时或改断言。
- music 通过时自报「step back took 5.31 s of audio time…boundary check was skipped」：边界检查被跳过，TEST-02 的三连通过条件未满足。

## 固定机位（tools/shots.js cam01–cam06，q=high、?shot，夏日雨后，第一人称；逐张打开）

注意：这些截图在高档 + ?shot 下，按 #125 的设计带有很浅的景深（见 PHOTO-02）。

- cam01 竹林起点：踏面与垂带清楚；竹林冠层仍透出大片亮天、叶片成片（ART-07 未改善）。右上角有屋檐近物入画。
- cam02 石阶：右侧垂带与踏面端头之间**不再露出土坡三角缺口**（shots/cam02-right-crop.jpg）。cam01 同样干净。仰视补充机位未拍，STR-15 记 fixed_pending_retest。
- cam03 照壁：字框清楚；天空仍为大面积平亮灰（ART-02）。
- cam04 山门：形制完整；天空仍大且最亮（ART-02）；远处柳杉细长刷状（ART-10）。
- cam05 门内望照壁：画面内竹竿均在照壁/墙后，无从铺地长出。
- cam06 第一院：湿铺地哑光为主，水洼边缘柔和，倒影为模糊暗团、无硬边屋顶倒影（ART-01 本机位成立、ART-14 关闭）；大殿正脊与屋面贴合，无浅色悬浮线（shots/cam06-ridge-crop.jpg，STR-10 关闭）；柳杉仍是重复刷状尖塔（ART-10）；天空仍最大最亮（ART-02）。大殿右侧墙后有一片竖向亮雾/垂枝（shots/cam06-right-crop.jpg），未用 __pick 定位，只记观察。
- STR-14：cam03、cam05、cam06 及留影院景中未见竹竿穿铺地，关闭（范围：这些机位）。

## 实际输入（probes/check.cjs，Playwright 键鼠/触控事件）

- 第一段（q=high，1280×720，身后视角首院）：`__photo(true)` 后 `__probe().post` = `{"depth":true,"gtao":true,"dof":true,"focus":6.18}`——**举相机时高档开着景深**。随后截图在 SwiftShader 下 30 s 超时（probe-run1.log），属环境慢，不是产品问题；第二轮跳过该段。
- 标题页：等「入山」可点后真实点击；开场镜头完整播完（phase done，13.5 s，未被我的点击跳过——点击发生在开场已结束之后，不能据此评价跳过功能；opening 场景单独通过）。
- 正常速度（q=low，无 ?cam/?fast/__walk/__pose）：按住 W 60 帧，z 91.5→86.05、高度 −14.5→−13.77，移动 5.45 m，正在第一段石阶上（shots/input-after-w.jpg）。只覆盖起步，五区往返未走。画面为夜：时辰随容器时钟；所有者 2026-11-18 定的「首访固定白天」在锁定提交上尚未实现（#179 在 f22b9ab 合入）。
- 鼠标拖动：yaw 0→0.31。本段无页面错误、控制台错误或失败请求。
- 留影（自动画质）：桌面 1280×720 成片 2294×1525，竖屏手机 390×844 成片 1108×2415。按 card.js 的装裱（四边 5.5%、底部 20%）反算，画心分别为 16:9 与屏幕竖幅，即「全幅」；取景器只有收起/设置/快门（shots/photo-desktop.jpg、photo-phone.jpg）。此两次未落在高档，dof=false。thirds=false（三分线默认开启在 f22b9ab 才合入）。

## 未做

- Mac/手机帧率（无设备；未启动 HF Job：T4 回答不了目标设备问题，且本轮无必须真实 GPU 才能归因的图形问题）。
- 五区正常速度往返录像、触屏真机、Safari/iOS。
- 殿内 16 个机位、雕塑、墨画、展品卡；凌霄阁顶层（loft 场景未跑）；结尾。
- 配乐、钟声、脚步听评（配乐 Goal 仍按提案只评建议，不生成音乐）。
- 仰视补充机位（STR-15）、大殿月台补充机位（ART-01）、白墙近看（ART-05）。
