# 殿内正式布光（第二阶段步 1）

拼图四格：左上目标图（`refs/t05-concept-2026-11-20/02-hall-from-door.webp`，生成图，只取光）、右上改前 cam03 站位第一人称（main）、左下改后同站位第一人称、右下改后 cam03 第三人称。夏昼，SwiftShader，1280×720，`q=high`。

数和法子见 `docs/t05/DECISIONS.md` 2026-11-22「殿内正式布光」。`layers.py` 量梁/檩/望板三层，`measure-fill.py` 量美术总监的线，`t4-report.json` 是 T4 同一 Job 里交替量的 `__cost`；`trial.cjs` 是试验用的驱动（它要一个临时钩子 `window.__fills`，那个钩子从不提交）。
