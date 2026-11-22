# #622 修前修后：山门前把视角拖到脚下

复现地址 `?cam=-5.68,49.8,1.145,0.449&view=third&season=autumn&time=day`，鼠标往下拖再拖回，取眼睛离脚下地面最低的那一帧。

- 修前（main 959279e）：眼睛在脚下 0.54 m，近裁面切掉地面，他悬空。
- 修后（本分支）：同一帧，眼睛在地面以上 0.55 m。

图：`before-after.jpg`（左修前，右修后），推到 `bolechen/temple-walk-evidence`，见 MANIFEST.json。
