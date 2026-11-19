# 独立评审笔记 · 4aa2d5ca1106e2c90abaae2fbc6b1e5fbc95e127

锁定提交 4aa2d5c（ci(evidence): smoke-test the R2 secrets…）。上一轮 ea2f3d0；其间 50 个提交。评审结束时 main 为 81e4ee29（#249，仅 tools/ 与 tests/ 的小沙弥离线工具，app/ 无改动，未重跑）。
研究 Site 需要 ChatGPT 登录，本环境读到的是登录页：Site 内容未核；改用 GitHub 的 llms.txt、LATEST-GOALS、实时 status JSON。
环境：SwiftShader，Playwright Chromium，GH/HF/云凭据已从运行仓库代码的子进程移除，服务绑定 127.0.0.1。无目标设备，无 HF Job。

## 实际打开并查看的运行截图（tools/shots.js，q 默认档，errors: []）
- cam01 竹林石阶：竹叶、苔地、石阶踏面连续可读，右上角一角檐入画，空气雾感与 J01 阴雨一致。
- cam03 照壁：「雙徑歸堂」金字在深色菱格上清晰，檐下斗拱受光不再是剪影，后方山门匾「雲徑禪寺」可读。
- cam06 首院：香炉居中，大殿、两侧殿、柳杉与远山成对称纵深，铺地有积水倒影，近中远层次清楚。
- cam02/04/05 同批已生成（见 shots.log 的 tris/calls），本轮只逐张细看了 cam01/03/06，其余未细看，不据此给 pass。
截图 SHA-256（文件在 tools/out/，按仓库规则不入 git，未推 HF 数据集）：
- cam01 bfe0f4316521e2962a39b1f31daa7cd92ed190a7a72dc343d25206b2456626fb
- cam02 2a5e645c4d3d72f585b15f9f3fea6153d72ab701f8d6c98a9e6c22e6bff6ec81
- cam03 ad9af58d990b4c807b6401d2a203c24d77abb1fae0fc0a430043a2cfe0fd5482
- cam04 a2e0fc5527b9c7f3cf4b5b4b0ca9b9ea14b0112c53c387e974a3bff9788668fa
- cam05 0308546c5ebfd768e2bb363dc07087f91259ad760573bf32497668189ffb8121
- cam06 6db793d9433ab4f02e02d730cccb9653ba182261bd77d3436a7c92baaa594984

## PHOTO-02 复测（真实按键 P，q=high，?enter）
举相机前 post.dof=false；按 P 后 post.dof=true，focus=6.12 m（probe-photo.log）。源码 app/yard.js:652 仍是 post.focus(Q.has("shot") || photo.on ? focusAt() : 0)。与所有者「不需要景深，远近景都清晰」不符：问题仍开，4aa2d5c 上复现。
举相机后的整帧截图在 SwiftShader 高档下超时（Playwright screenshot 30 s，二次尝试 120 s 未记成功），无图可看，只有 __probe 数值。

## UI-01 复测
e2e menu（418 s）与 menufit（zh/ja/en/ko × 1280×720、1366×768、1920×1080，103 s）在 4aa2d5c 通过。UI-01 的验收条件逐字满足。

## 未做
解析、类型、487 项单测、校验器测试、e2e:quick 通过；未跑 e2e 全量/smoke、edges、nearplane、halls、loft、ending、声音、性能。未细看 cam02/04/05。
