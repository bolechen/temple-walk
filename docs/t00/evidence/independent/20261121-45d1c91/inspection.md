# 独立评审笔记 · 45d1c9156115aa06193f8f7367e14c4fac13b0c9

锁定源码提交 45d1c91（feat(controls): A/D turn him and the view, arrows step sideways (#295 C) #387）。上一轮 b1ab530；其间 58 个提交（70 个 app/ 文件变动，另有 worker/ 新增）。
评审结束时 main 最新为 3b27cab（docs(t05) 参考图，只动 docs/t05/，不涉及 app/，未另测）。
环境：受管 Linux 容器，Playwright Chromium headless，SwiftShader；运行仓库代码的子进程移除了 GH/GitHub/HF/AWS/GCloud/Umami 等凭据，服务绑定 127.0.0.1。无目标设备，未开 HF Job。
浏览器/截图任务全部串行。

## 运行的检查（日志在本目录）
- check.log：109 个文件，0 问题。typecheck.log：tsc 退出 0。
- unit.log / unit-grid.log：两套 walker 各 754 项，741 过、0 失败、13 跳过。
- e2e-quick.log：nogl、boot（100 s）、level、events 全过。
- shots.log：cam01–06 绘制完成，`errors: []`，退出 0（TOOL-01 前半复测通过）。
- keywalk.log：真键盘 W/A/D + Shift（Playwright 自动化输入，起点用 ?cam 摆放，q=low 480×320），从山门到大殿绕一圈 335 步，A 89 次、D 104 次，主角 95% 时间离画面中线 0.5% 以内，镜头距离 5 分位 2.48 m（最近一刻 0.66 m）。
- edges-grid.log：180 个地点全部可达，200 万站位，各组 ✓，最深 1.0 cm（大慧院 woodV，在 1 cm 容差内），膝下 0.7 cm。
- art11.log / photo/art11.json：竹林起点（?enter&q=high，夏昼），真按 P 举相机，16:9、4:3、9:16。
  首次运行失败（art11-first-failure.log）：本脚本截图用了 Playwright 默认 30 s 超时，软件渲染下不够，属评审脚本问题；改成与 shots.js 相同的 240 s 后重跑一次通过。脚本见 art11.cjs.txt。

## 实际打开并查看的截图
原图在 HF 数据集 bolechen/temple-walk-evidence，固定在 0f4b10b，`t00/independent/20261121-45d1c91/`；哈希见 MANIFEST.json。本轮没有拼图。
- cam01–cam06：与 b1ab530 同机位逐张对照，无回归。cam01 右上角近处檐角上一轮已有；cam02 垂带与踏面端头闭合；cam03 「雙徑歸堂」、山门匾可读；cam04 「萬年正續」可读，门洞见首院；cam05 门扇框住照壁；cam06 香炉居中，殿、柳杉、远山层次清楚，铺地积水下部仍有沿铺缝的直边暗带（ART-01 未改）。
- 竹林起点，行走首帧与举相机：三种画幅都有一根近竹立在画面中线偏右。16:9 竹竿在小沙弥右侧、切过石阶右半；4:3 竹竿贴着小沙弥左臂；9:16 竹竿占画面右三分之一，切过石阶右侧。ART-11 复现。
- 举相机界面：拍一段、设置、快门、收起四项（#350 新增「拍一段」），仍简洁；近竹与远坡同样清晰，post.dof 行走与举相机时都是 false（PHOTO-02 没有回退）。

## 静态审查：同修留痕（#346，worker/）
只记录日期、地点、类别、计数；不读 IP、头部、Cookie、UA；请求体限 200 字节、白名单校验；保留 90 天。没有个人数据。
限流是按地点的全局令牌桶，不按来源：一个刷量者可以把某地点当天的计数推高（每日上限 25 万），也能让真实访客在桶空时拿到 429。代码注释写明按来源限流交给 Cloudflare 边缘规则（docs/RELEASING.md）；本轮没有 Cloudflare 权限，未能核实生产是否配置该规则（登记 SEC-01，info）。

## 未执行
smoke/全量 e2e（夜间 CI 跑，CI 成功不等于验收）、nearplane、旧 walker 的 edges、殿内 16 机位、凌霄阁、结尾、门洞近看（#332 着色器改动无 T4/Mac 图，按规程标 blocked）、听评（配乐 Goal 仍是提案，只评审不生成）、五区真人正常速度往返录像、Mac/手机性能。
