# #744 竖纸横墨改成一笔、执笔的手离开耳朵（证据）

分支 `feat/t05-stroke-hold`，头 `ad9a965`。

- `j01-shot-copy-t4.png`（T4，run 20261125-163128，`t4-report.json` 的 `site.commit` 即 `ad9a965…`，`app/` 不 dirty；J01 冬昼，high 1920×1080）：抄碑镜头停住时。纸板在胸前偏左、下巴以下，笔杆向前斜，执笔的手在耳朵的左下方，不再压在耳朵轮廓上；笔落在纸上，碑文五列仍全在画面里。`before-j01-shot-copy-t4.png` 是改之前（#728 终审用的那张，run 20261125-160443）。
- `j01-shot-p1b-t4.png`：同一姿势在 P1「记下」机位。
- `slip-whole-360x640.png`、`slip-note-360x640.png`、`slip-whole-390x844.png`、`slip-note-390x844.png`：纸条上端那一道横墨，与他手里纸上的是同一笔（`pagework.js` 的 `drawStroke`）：起笔最重、往后渐细，墨尽处一道道顺着笔走的白。
- `collage.jpg`（只在证据库）：改前、改后的执笔局部，和 360×640 纸条上端。

数字：`t05-writing.test`「in the copy's shot the hand that writes stays clear of his ear」把耳朵与执笔的手投到抄碑镜头 1920×1080 里，整段书写最近：代码身体 61.6 px、Tripo 身体 48.4 px（要求 ≥ 45；旧姿势下 1.4 px 与 13.8 px，测试红）。手、笔、纸板到碑面最近 0.551 m（要求 ≥ 0.3）。


## 特写（从上面的原图裁出，2 倍放大）

- `crop-copy-hand-before.png`：改前（`before-j01-shot-copy-t4.png`），执笔的手压在左耳轮廓上。
- `crop-copy-hand-after.png`：改后（`j01-shot-copy-t4.png`），手在耳朵左下方，笔尖落在纸上。
- `crop-p1b-hand.png`：P1「记下」机位（`j01-shot-p1b-t4.png`），纸板在胸前偏左，手在纸上。
- `crop-slip-stroke-390x844.png`：390×844 纸条上端的横墨（`slip-whole-390x844.png`；纸条是网页界面，软件渲染即实际画面）。

**手里那张纸上的横墨**（T4 原图里没有：两张 T4 都是静止摆姿，摆姿时纸上画的是抄碑那一列）。**软件渲染**（SwiftShader，medium 档，1280×720，冬昼）补拍了 P1「记下」进行中的帧，头 `f018bc4` 的工作树（画面代码与 `ad9a965` 相同）：`node tools/t05-copy-frames.cjs <dir> --p1 --q=medium --times=2.6,3.15,3.7,4.0`。

- `p1-stroke-1-2.6s.png`（起笔）、`p1-stroke-2-3.1s.png`（中途）、`p1-stroke-3-3.7s.png`（收笔）、`p1-stroke-4-4.0s.png`（一笔画完，`stroked: 1`）；`p1-stroke-frames.json` 逐帧记：镜头已停在 P1 机位（`hold`，`w: 1`，`cuts: 0`），书写中。
- **照实说：这个机位里纸板几乎是侧对镜头的**（他在右下，纸板朝他自己、朝殿），纸面上那一笔在这几帧里看不清。P1 镜头的单测查的是纸在安全区内，不查纸面朝不朝镜头。要在画面里看得见那一笔，得动 P1 的机位或纸板角度，这是镜头/构图的事，留给初审判。
- `leaf-canvas-stroke.png`：为了看那一笔本身，把他手里那张纸的贴图（`pagework.js` 的 `drawPage`，只画横墨）单独画出来，在一笔的 25%、60%、100% 处：起笔最重、往后渐细、墨尽处飞白顺着笔走。这是贴图本身，不是场景画面；纸条上的那一道是同一个 `drawStroke`。


图钉在 adbc73c：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/adbc73c71676b8a1f7a41c698b66e03c0144dc42/t05/744-stroke-hold
特写四张钉在 2203e23：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/2203e239b54fda5c0fc5ba97414ae595a22a99a6/t05/744-stroke-hold
补拍（软件渲染）钉在 f9aaede：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/f9aaedee0af7d6676874822b6bf0030b34fe1060/t05/744-stroke-hold

## 第二轮：横墨改成无缝（头 `f531ad6`，美术终审 @ f018bc4 的必须改）

终审看出横墨的墨里有一排排浅格子纹（原来 `drawStroke` 一块块方格并排，块与块之间没盖严）。现在每根毫是一条连续、不透明、比自己那一份略宽的墨带，与邻毫相叠：墨浓处实心无缝；墨尽处每根毫各自离纸一段，只留顺笔的白丝；起笔圆头（藏锋，初审的建议一并做了）。手里那张纸与纸条共用这一个函数。

- `r2-stroke-390x844-pixels.png`：390×844（devicePixelRatio 3）纸条上那一道横墨的**原像素**（元素截图，不缩放），软件渲染。
- `r2-slip-whole-390x844.png`、`r2-slip-note-390x844.png`：整页与观察页。
- `r2-leaf-canvas-stroke.png`：**贴图，不是场景画面**——他手里那张纸的贴图（`drawPage`，只画横墨）在一笔的 25%、60%、100% 处（起笔、中途、收笔）。场景里 P1 机位纸板几乎侧对镜头，那一笔看不清（见上）。

第二轮图钉在 cceb677：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/cceb6779d4ff6f4120ed00bd78e877c792cf4f0a/t05/744-stroke-hold
