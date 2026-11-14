# T00 云径禅寺 · 交付包

《山门之外》的序章。这个目录对应「山门之外 · 寺院创作资料库」T00 交接包（handoff-v001）要求的八项交付。
交接包原文在 <https://temple-atlas-research.floralpage64.chatgpt.site/llms.txt>，2026-11-14 读取；两张参考图也在那天实际打开看过。

范围是交接包定的五区：竹林入口、上山石阶、照壁、重阁山门、第一个院落。寺里其他部分（上面两层台地、山顶、八座殿内、朱印、
四季四时、拍照）都还在，不在这一轮验收里。

| 交付 | 文件 | 状态 |
|---|---|---|
| D01 可运行场景 | [RUN.md](RUN.md)，仓库本身 | 有 |
| D02 工程基线与变更 | [project-baseline.json](project-baseline.json)、[decisions.md](decisions.md)、[CHANGELOG.md](CHANGELOG.md) | 有；目标设备未锁定 |
| D03 场景与相机 | [scene-spec.json](scene-spec.json)、[camera-manifest.json](camera-manifest.json)；`?show=cam01`…`cam06` | 有 |
| D04 六机位运行截图 | `evidence/M2-before/`（改之前）、`evidence/M4/CAM-01.jpg`…`CAM-06.jpg` | 有，T4 上的真实页面 |
| D05 连续行走录像 | `evidence/M4/walkthrough.webm` | 有，webm 而非 mp4，程序行走（diagnostic） |
| D06 性能证据 | [performance.json](performance.json)、`evidence/M4/frame-times.csv`、`evidence/M4/console.txt` | **只有 T4；目标设备 blocked** |
| D07 资产与权利 | [asset-register.csv](asset-register.csv) | 有；佛像模型授权待所有者确认 |
| D08 评审与验收 | [review-log.json](review-log.json)、[acceptance-report.json](acceptance-report.json)、[KNOWN-ISSUES.md](KNOWN-ISSUES.md) | 有；**验收没有全部通过** |

开发方的自报写在 [acceptance-report.json](acceptance-report.json)：哪几项通过、哪几项没有、哪几项因为没有目标设备而无法判定。
它不是独立验收。独立验收由评审方写入 [independent-review.json](independent-review.json)；每轮交付的摘要在 [delivery.json](delivery.json)，
由仓库的状态工作流同步到研究站点（见 `../SITE-SYNC.md`）。
完成定义是「验收通过并有运行证据」，按这个定义 T00 **还没有完成**。

证据怎么来的：截图、录像和帧耗时都由 `tools/gpu-render.sh` 在 Hugging Face 的一块 Tesla T4 上，用无头 Chromium（ANGLE/Vulkan）
打开真实页面得到，不是离线渲染。它不是目标设备。每份证据标的提交号是出图时 `app/` 的版本。

`review-log.json` 里的评审人是同一模型的子代理（各自独立的会话，只拿到截图或代码），不是人，也不是独立评审方。
四个维度各评了一轮，六机位复核了一轮；复核之后的修改没有再复核。
