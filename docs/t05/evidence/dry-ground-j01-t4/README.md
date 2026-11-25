# J01 墙外干地与冠顶：T4 实拍对软件渲染（#686，应用码 8888f95）

拼图：左 T4（Tesla T4，Chromium/ANGLE Vulkan，`tools/gpu-render.sh t4-small`，LEVEL=t05，冬昼，q=high，1280×720），右 SwiftShader 同机位；行：cam01、cam07、到达点往南（总监取景 `__look((0,1.7,215)→(0,4.7,315))`）、往西南（`→(-25,3,250)`）。
`report-pr-8888f95.json`（到达点两张与四个 bench 的 cost）、`report-pictures-cam01-cam07.json`（cam01、cam07 两张）的 `site.commit` 都是 8888f95（无 +dirty），`site.sha256` 212cab2d…；`report-main-5abb644.json` 是同一脚本在 main 5abb644 上的 bench。
数与结论见 #686 的评论与 `docs/t05/DECISIONS.md`。
