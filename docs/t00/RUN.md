# T00 云径禅寺 · 启动说明

《山门之外》序章。浏览器里的 three.js r186 场景，没有构建步骤。three.js 不在 Git 里，由 `pnpm install` 取回。

## 启动

```sh
git clone <本仓库> && cd temple-walk
pnpm install             # 依赖；并把 three.js 拷进 app/vendor/three/
pnpm run serve           # 等于 python3 -m http.server 8000 --bind 127.0.0.1 --directory app
```

打开 <http://localhost:8000/>，点「入山」。任何静态文件服务器都可以，直接把 `app/` 当站点根目录。

需要的东西：一个支持 WebGL2 的浏览器；本地需要 Node.js 22+、pnpm 10（只为安装那一步）和 Python 3（或任何静态服务器）。
没有锁文件，因为没有依赖：three.js 在 `app/vendor/three/`，字体在 `app/shared/fonts/`，贴图在 `app/levels/t00/textures/`，佛像模型在 `app/levels/t00/models/`。
测试和出图工具另外需要 Node 22+ 和 Playwright（Chromium）。

## 操作

| 键鼠 | 作用 |
|---|---|
| W A S D / 方向键 | 行走，相对视线方向 |
| Shift | 快步 |
| 点一下画面 | 握住鼠标，移动鼠标环顾；Esc 松开 |
| 滚轮 | 第三视角的远近 |
| E / 回车 | 做眼前提示的事 |
| 空格 | 跳；站在无栏矮台前沿面向外侧时是下台阶 |
| V | 第一视角 / 第三视角 |
| B | 朱印帐 |
| P | 拍照 |
| T | 季节与时辰 |
| H | 键位卡 |
| Esc | 松开鼠标；合上打开的东西；都没有时是「歇脚」菜单（画质、环顾快慢、上下反转、音量、回到起点） |

触屏：左下圆盘行走，拖动画面环顾，点地面走过去。

## 验收用的地址

- 六个固定机位：`?show=cam01` … `?show=cam06`，加 `&season=summer&time=day&q=high`。`?show` 会冻结时间并隐藏界面。
  机位的坐标、朝向和视场角在 `camera-manifest.json`，由 `node tools/cameras.mjs` 从 `app/src/site.js` 写出。
- 基准预设 J01（阴天雨后）就是「夏 · 昼」：`?season=summer&time=day`。
- 行走测量：`?tour=120x3&enter&view=first&q=high&season=summer&time=day`。
  预热 10 秒后，沿「竹林起点 → 石阶 → 照壁 → 山门 → 第一院」往返走 120 秒，重复 3 次，结束时页面上给出每次的平均帧率、
  p95 帧耗时，并可下载 `performance.json` 和 `frame-times.csv`。请在目标设备的浏览器里以 1920×1080 窗口运行。
- 其他参数见仓库根目录 `CLAUDE.md`。

## 检查

```sh
pnpm run check    # 每个脚本能解析，着色器片段不以注释结尾，字体覆盖所有用到的字
pnpm test         # 单元测试：总平面、行走、建筑生成、季节
pnpm run e2e:quick # 真实页面启动并出图
pnpm run e2e      # 全部场景，约 20 分钟
```

## 已知限制

见 `KNOWN-ISSUES.md`。
