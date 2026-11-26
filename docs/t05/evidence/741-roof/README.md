# T05 大殿屋面：举折、筒板瓦、起翘、椽飞、鸱尾（#741 第一个 PR）

2026-11-25，分支 `claude/project-thread-i4jnpi`。之前是 main `98f333a`，之后是 `e6544c4`（cam01、角部是 `8998ce5`，角梁头改短后重出）。软件渲染（SwiftShader），`node tools/shots.js --level=t05 <view>@winter-day`，1280×720。

- `shots/<视角>-before.png`、`shots/<视角>-after.png`：cam01（南门进来看大殿）、cam02、cam07（牌坊下看大殿，美术总监锁的三条判据就在这张上）、corner（新加的视角，大殿东南角）。存在证据库里，不进 git。
- `collage.jpg`：cam01、cam02、角部前后对照。

看到的：屋面从一块直坡变成上陡下缓的曲面，四角起翘，檐口有瓦当和滴水，檐下两层椽（圆椽、方飞椽），角部椽子散开对着角柱，正脊两端是辽式鸱尾。cam07 上鸱尾尖仍在牌坊额枋下，正脊尖都看得到，中轴上大殿瓦面 11 行。

T4 实拍（`LEVEL=t05 tools/gpu-render.sh t4-small`，每帧毫秒，之前 → 之后）：cam01 高档 1080p 7.47 → 8.27（三角形 168k → 269k）；cam01 低档 844×390 2.35 → 3.01；角部高档 7.07 → 7.74；cam02 高档 11.61 → 12.07。
