# #632 推镜淡出：半透明只画朝向镜头的一面

`fade-<body>-front-back.jpg`：上排从他面前看，下排从他背后看；不透明度从左到右 0.2、0.4、0.6、0.8。`code` 是代码身体（默认），`tripo` 是 Tripo 身体。
用 `window.__fade(a)` 把不透明度停在定值，`__look` 摆眼睛，软件渲染、`q=low`。提交见 PR。背后那排看不到后脑后面的脸，也看不到斗笠以外的内面。

图已推到证据库（Hugging Face 数据集 `bolechen/temple-walk-evidence`，提交 cea60a862b312c0a543a951cd1dabec960668286，路径 `t00/632-fade/`）。推送后读回时公开地址还是 404（镜像由 CI 做），所以这个目录暂时没有 MANIFEST.json；总主创要的话由镜像那边补。
