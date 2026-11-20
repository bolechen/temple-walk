# 独立评审笔记 · b1ab53021da181940b247b882b7a43d3da170608

锁定提交 b1ab530（feat(build): the desktop shell is MyGo… #263）。上一轮 4aa2d5c；其间 74 个提交，17 个动了 app/。评审开始与结束时 main 都是 b1ab530。
环境：SwiftShader，Playwright Chromium，运行仓库代码的子进程已移除 GH/HF/云凭据，服务绑定 127.0.0.1。无目标设备，无 HF Job。研究 Site 未读。

## 实际打开并查看的截图
原图在 HF 数据集 bolechen/temple-walk-evidence，固定在 aed430d，`t00/independent/20261120-b1ab530/shots/`；哈希见 MANIFEST.json。git 只留拼图 collage.jpg（第一、二行 cam01–06，第三行举相机）。
- cam01 竹林石阶：踏面连续，垂带与踏面端头闭合，无缝；左侧有两点黄绿亮斑（飘落物），不碍画面。
- cam02 石阶仰望：垂带收头干净，土坡不从踏面端头露出（STR-15 仍缺另补的仰视机位）。
- cam03 照壁：「雙徑歸堂」金字清楚，山门匾「雲徑禪寺」可读。
- cam04 山门：阴天下暗木门楼，「萬年正續」匾可读，门洞里看得到首院。
- cam05 门内回望：两扇开着的门框住照壁，铺地湿而不镜面。
- cam06 首院：香炉居中，大殿、两侧殿、柳杉、远山层次清楚；积水大多是软边，靠下有沿铺缝的直边暗带（ART-01 未逐项复判）。
- 举相机（竹林起点，q=high）：近竹与远坡同样清晰，没有景深；界面只有 设置 / 快门 / 收起。一根近处竹竿立在画面正中偏右，切过小沙弥一侧（ART-11）。

## PHOTO-02 复测
真按 P：举相机前后 post.dof 均为 false，focus 0（probe-photo.log）。yard.js:700 只在举相机且 settings.blur 打开时才给焦距。验收条件满足，关闭。

## EDGE-001/002
edges:grid（#276 后的默认 walker）：178 个地点全部可达，200 万站位，各组 ✓，最深 1.0 cm（大慧院，在 1 cm 容差内），茶寮 0；膝下 0.7 cm。仍缺正常速度录像，维持 fixed_pending_retest。

## 工具问题
- shots.js 等门洞时读 __doorways().queued.length，report() 里没有这个字段，每个机位报 TypeError，跳过等待，进程仍退出 0（TOOL-01）。
- evidence.mjs push 上传成功（HF aed430d）后从未镜像的 R2 回读，404，没写清单；设 EVIDENCE_BASE 为 HF 原址后重跑才写出（EVID-03）。
