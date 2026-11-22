# 第三人称的镜头不进竹林（#515，PR #518）

本地构建，SwiftShader，自动画质。修前是 main 8cd4d2a，修后是本分支。每张图都在 `__eyeSpace` 变成 ready 之后拍。

## 报告点 `?cam=23.63642,75.60001,2.422,0.084&view=third&season=autumn&time=day`
| 文件 | 内容 |
|---|---|
| before-16x9、before-9x19.5 | 修前：镜头停在 (21.34, 72.98)，离他 3.5 m，在竹林里 |
| after-16x9、after-9x19.5 | 修后：镜头停在 (22.82, 74.66)，离他 1.25 m，在竹林外。他占满画面，脚被切掉（待审图二判） |
| before-jitter.json、after-jitter.json | 原地站 10 s，镜头每帧自身位移和转角。修前 0 m、0°；修后最大 0.0004 m、0.013° |

## T05 不受影响（`?level=t05&show=<机位>&view=third`）
| 文件 | 内容 |
|---|---|
| t05-before-{arrive,b,d}、t05-after-{arrive,b,d} | 改前、改后各三个机位 |
| t05-before.json、t05-after.json | 镜头位置、朝向、臂长，改前改后到小数点后四位完全相同 |
