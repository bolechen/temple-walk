# 殿内正式布光（第二阶段步 1，第三版，#608）

拼图四格：左上目标图（`refs/t05-concept-2026-11-20/02-hall-from-door.webp`，生成图，只取光）、右上改前 cam03 站位第一人称（main）、左下改后同站位第一人称、右下改后 cam03 第三人称。夏昼，SwiftShader，1280×720，`q=high`。前两版（`hall-light-phase2`、`-r2`）的拼图在证据库里，第一版带地面一池那盏灯，美术初审不通过后去掉；第三版把铺作拆回 main 的份额、望板抬到 10 以上。

数和法子见 `docs/t05/DECISIONS.md` 2026-11-22「殿内正式布光」。`layers.py` 量梁/檩/望板三层，`brk.py` 量铺作与墙，`measure-fill.py` 量美术总监的线，`trial.cjs` 是试验用的驱动（它要一个临时钩子 `window.__fills`，那个钩子从不提交）。`t4-report.json` 是第一版（六盏灯）在 T4 同一 Job 里交替量的 `__cost`，现在灯数同 main，不再适用，留着作记录。
