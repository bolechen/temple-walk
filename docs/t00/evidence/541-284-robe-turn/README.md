# #284 / #541 掉头起步：改前改后

`node tools/novice-views.cjs --code --glb=app/shared/models/novice-tripo.glb --poses=turn --walk=<帧> --sides=正,侧`，站定后让他转身往反方向走（页面的转身 9/s、加速 10/s），第 6 帧（0.2 s）和第 12 帧（0.4 s）；每个身体两个角度（正面、侧面）。拼图自上而下：改前 6 帧、改后 6 帧、改前 12 帧、改后 12 帧（改前为 main `55740ec` 的 `monk.js`）。每张图里两个身体并排：先代码身体，后 Tripo 身体。

未拍：台阶上下的片子（`stair-film` 需整站构建，本次未跑）。前襟上行裂开（#541 第 5 条）没有修。**拼图 `turn-collage.jpg` 尚未推证据库**（本会话没有 `hf` 命令），文件在会话里，未入 git；待有 `hf` 的人 `node tools/evidence.mjs push` 后补 MANIFEST。
