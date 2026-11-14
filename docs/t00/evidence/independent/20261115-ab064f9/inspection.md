# T00 independent inspection — 2026-11-15

- Reviewed main commit: `ab064f9bba6896b556381eedce5a700e2baf5535`.
- Runtime evidence commit: `0e960f09442cd56b156175f195663c0ed1ff15e0`; the only following main commit is the delivery-document commit `ab064f9…`, so source/evidence mismatch is explicit and the runtime evidence is not relabeled.
- Opened the research Site `llms.txt`, `assets/generated/T00.png`, and `assets/generated/T00-sheet.png`.
- Opened runtime screenshots `CAM-01.jpg` through `CAM-06.jpg` and `extra-hall-platform.jpg` from `docs/t00/evidence/M4`.
- Verified every M4 SHA-256 against `manifest.json`; all matched.
- Opened `walkthrough.webm` and inspected a 10-second contact sheet. The video is 116.04 s, VP8, 800×450, 25 fps. It is an automated diagnostic tour, not user input.
- Tried the live GitHub Pages build in the cloud browser. The visible page reached the title/error state, but WebGL context creation was disabled by the sandbox.
- Tried the live GitHub Pages build in desktop Chromium and preserved the visible `山路 · 请再来一次` failure state. One retry did not recover it.
- Local E2E first failed because the expected Playwright browser package was absent. A single diagnostic retry with system Chromium failed because the runtime denied the process-singleton socket. No timeout or assertion was weakened.
- Visual observations carried forward under stable IDs: ART-01/02/05/07/08/10/14, STR-10 and related minor items remain open. The current M4 images still show a large bright-grey sky, relatively bright wet paving/puddles, homogeneous stone between stair risers and side walls, repeated wall weathering, and flat/silhouette-like distant planting.
- Target Mac/phone performance was not measured. T4 data is diagnostic only and was not used to infer target-device performance.
