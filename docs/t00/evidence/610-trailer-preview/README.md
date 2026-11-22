# #610 预告模式：云端软件渲染的完整预览

提交 `be0ffeb`（`feat/trailer-mode`，PR #613）上，用 SwiftShader 渲染的完整预览，不是成片：

- `node tools/trailer.mjs --size=640x360 --fps=12 --q=medium`：840 帧，70.000 s，H.264 / yuv420p / +faststart 的 mp4（`t00-steam-1-640x360-12fps.mp4`，带游戏自己合成的配乐，AAC），画帧共 3154 s，页面没有报错。
- `node tools/trailer.mjs --stills=3 --size=640x360 --fps=12`：每个镜头 3 张，一行一个镜头、一行三张，拼成 `stills.jpg`；`stills.json` 记录每张是哪个镜头的哪一帧。
- `report.json`：脚本、渲染器（SwiftShader）、各镜首尾帧、全部 840 帧的 SHA-256（同一脚本同一提交再渲染，这张表应当一致）、音频测量（峰值 −2.32 dBFS，无削波，钟声在 40.2 / 42.4 / 44.6 s）、片长/首帧/结尾/无版本号核对。

预览用 `--q=medium`（软件渲染，高画质档的成片留到下一步，在真显卡上渲染）。敲钟镜头里小沙弥不做拉绳动作，钟摆在画面外，三帧看起来几乎不变；这是已知的、写在 `docs/trailer/README.md` 的「未做」里。

mp4 在证据库里（`MANIFEST.json` 钉了提交和 SHA-256），取回：`node tools/evidence.mjs pull docs/t00/evidence/610-trailer-preview`。
