# 预告片渲染：怎么出成片

`docs/trailer/storyboard.md` 是分镜，`app/levels/t00/trailer.js` 是同一份分镜的数据脚本（#610）。一条命令按脚本逐帧渲染 1080p 60 fps 的 mp4，带游戏自己合成的配乐。

## 原理（为什么每次出的帧一样）

- 页面加 `?trailer`（只在 dev 服务器和构建为 `preview` 的站点有效；正式站和 canary 不读这个参数，见 `src/trailer-gate.js`）。
- `src/trailer-boot.js` 在一切之前把页面的 `performance.now()` 和 `requestAnimationFrame` 换成固定时钟（`src/trailer-clock.js`）：每一帧固定前进 1/fps 秒，只有工具推它才走。风、落叶、钟的摆动、脚步、门景淡入、镜头弹簧都跟着这个时钟，不读真实时间。
- 每个镜头在时钟上有自己的一段（`src/trailer.js` 的 `SHOT_BASE + 序号 × SHOT_SPAN`），开拍前先跑 1.5 秒预热，再从头走。所以任何一帧都可以单独重渲，或从任意镜头续跑，结果一样。
- 界面、调试面板、提示行、版本行全部隐藏（`body.bare`）。字幕、标题卡、镜与镜之间的纸色淡入淡出由 `src/trailer.js` 叠加，用游戏自己的字体（Yunjing Kai / Brush）。
- 过渡遵守 director 的上限（15 m/s、144°/s），自由镜头不穿墙：`tests/unit/trailer-script.test.mjs` 在真实的平面上逐帧断言。`tests/e2e/run.cjs` 的 `trailer` 场景断言同一帧在两个全新页面里逐像素相同。

## 命令

```sh
node tools/trailer.mjs --size=640x360 --fps=12 --q=medium      # 软件渲染的小预览，云端或没有显卡时用
node tools/trailer.mjs --size=640x360 --fps=12 --stills=3      # 每个镜头 3 张，拼成一张总览图 stills.jpg（+ stills.json 记录行列对应的镜头和帧）
node tools/trailer.mjs --from=39 --to=46                       # 只渲染第 39–46 秒（帧留在 out/frames/）
node tools/trailer.mjs --resume                                # 接着上次中断的地方，已有的帧不重画
node tools/trailer.mjs --gpu                                   # 成片：用显卡
```

输出在 `tools/out/trailer/`（`--out=` 可改）：`frames/%06d.png`、`score.wav`、`<id>-<宽>x<高>-<fps>fps.mp4`（H.264、yuv420p、`+faststart`，可直接上传 Steam）、`report.json`（脚本、尺寸、渲染器、各镜首尾帧、每帧 SHA-256、页面报的错、片长/首帧/结尾/无版本号核对）。

声音用 `tools/trailer-audio.mjs`：和 `tools/music.mjs` 同一套 `score.js` 与 `instruments.js`，按脚本的镜头走过各个地方，开场远处山钟、殿钟按镜头里的 `strike` 事件，结尾淡出，长度与片长一致。

## 在 Mac 上渲染成片

1. `pnpm install`，`pnpm exec playwright install chromium`；`brew install ffmpeg`。
2. `node tools/trailer.mjs --gpu`（Mac 上走 Metal：`--use-angle=metal`）。工具会先报告渲染器，若 `--gpu` 却落到 SwiftShader 就报错退出，不会悄悄用软件渲染。
3. 1080p × 4200 帧；中断后 `--resume`。

## 在 T4 上渲染成片

T4 要花钱，按所有者的安排留到下一步。办法与 `tools/gpu-render.sh` 相同：把 `app/` 与脚本同步到私有 bucket，起一个有 T4 的 Hugging Face Job，Chromium 走 Vulkan（`tools/gpu/job.cjs` 的 `angle-vulkan`），Job 里运行 `node tools/trailer.mjs --gpu --out=<dir>`，再把 `<dir>` 取回。`TEMPLE_SITE=<已构建的站点>` 可让工具直接用已有的 `dist/`。

## 未做（下一步）

- 成片本身，和 Opus 看样帧后改镜头：等所有者说开工。
- 敲钟镜头里小沙弥不做拉绳动作，只有钟摆和钟声（`__strike`）；入殿不走面幕，出殿门是一刀硬切（分镜原文如此：「面幕不用，直接走出」）。
- 脚步声没有混进预告的声轨。
