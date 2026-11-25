# #744 竖纸横墨改成一笔、执笔的手离开耳朵（证据）

分支 `feat/t05-stroke-hold`，头 `ad9a965`。

- `j01-shot-copy-t4.png`（T4，run 20261125-163128，`t4-report.json` 的 `site.commit` 即 `ad9a965…`，`app/` 不 dirty；J01 冬昼，high 1920×1080）：抄碑镜头停住时。纸板在胸前偏左、下巴以下，笔杆向前斜，执笔的手在耳朵的左下方，不再压在耳朵轮廓上；笔落在纸上，碑文五列仍全在画面里。`before-j01-shot-copy-t4.png` 是改之前（#728 终审用的那张，run 20261125-160443）。
- `j01-shot-p1b-t4.png`：同一姿势在 P1「记下」机位。
- `slip-whole-360x640.png`、`slip-note-360x640.png`、`slip-whole-390x844.png`、`slip-note-390x844.png`：纸条上端那一道横墨，与他手里纸上的是同一笔（`pagework.js` 的 `drawStroke`）：起笔最重、往后渐细，墨尽处一道道顺着笔走的白。
- `collage.jpg`（只在证据库）：改前、改后的执笔局部，和 360×640 纸条上端。

数字：`t05-writing.test`「in the copy's shot the hand that writes stays clear of his ear」把耳朵与执笔的手投到抄碑镜头 1920×1080 里，整段书写最近：代码身体 61.6 px、Tripo 身体 48.4 px（要求 ≥ 45；旧姿势下 1.4 px 与 13.8 px，测试红）。手、笔、纸板到碑面最近 0.551 m（要求 ≥ 0.3）。

图钉在 adbc73c：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/adbc73c71676b8a1f7a41c698b66e03c0144dc42/t05/744-stroke-hold
