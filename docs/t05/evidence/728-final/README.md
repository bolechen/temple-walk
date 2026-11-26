# #728 美术终审 @ aaa2602 的改动（证据）

头 `f4741b0`。

- `j01-shot-copy-t4.png`：抄碑镜头停住时的画面，T4（run 20261125-160443，`t4-report.json` 的 `site.commit` 即 `f4741b0…`，`app/` 不 dirty），J01 冬昼，high 1920×1080。镜头 60°、在他左肩后 1 m、高 1.4 m，整块碑文（题名与四列）都在画面里，上沿落在碑首的石面上，不切任何一个字；停住不再动。原来 48° 的机位上沿把「奉」「嵬」「納」三列切成两半（`728-t4c/j01-shot-copy.png`）。斜看碑面时一行字在画面上是斜的（同一行每往左一列高约 0.04 NDC，字缝只有 0.02–0.03），单调仰角做不到四列都落在字缝里，所以改成整块入画。`t05-director.test`「none cut by its edge」逐字量四角，原机位红、新机位绿。
- `slip-whole-360x640.png`、`slip-note-360x640.png`：手机 360×640。纸条上端多了一道干笔横墨（原来只画在他手里的纸上，竖纸漏了）；抄下的那句照碑不加标点。

没改好的（照实说）：执笔的右手仍叠在耳朵轮廓前一点。从左肩后任何机位都是这样（姿势把笔举在脸侧），换右侧初版试过，手臂挡纸；要改得动执笔姿势，不在这一步。

图钉在 f5deade：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/f5deadeb87bc56f916ed9c5333e1e22bdea3ee86/t05/728-final
