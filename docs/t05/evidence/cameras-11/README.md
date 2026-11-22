# T05 七机位与向外看一圈（PLAN.md 第 11 项）

T4（`tools/gpu-render.sh t4-small`，run `20261121-191701`），站点 commit `e8578b9`，1080p 高档定机位，夏昼（页面定机位的默认；T05 自己的 J01 还没有做）。

- 上：cam01–cam07（cam03 第三人称），`?level=t05&show=camNN`。
- 下：向外看一圈，十处（到达点、外山门、内山门、无量殿穿堂、A–F 六站）× 六向（北、东、南、西各平视 0.05 弧度；朝东墙头、朝南回看各抬 0.35 弧度），`?cam=x,z,yaw,pitch`，1280×720。
- `spec.json` 是这次 Job 的出图清单，`report.json` 是 Job 报告（站点指纹、每张的三角形与绘制数）。

看图的发现，逐条见 PR 与 issue。复现：`LEVEL=t05 tools/gpu-render.sh t4-small "$(cat docs/t05/evidence/cameras-11/spec.json)"`。
