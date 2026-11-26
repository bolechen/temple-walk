# #728 T4 实拍：抄碑与「整体」的机位帧，碑亭一带的帧耗

头 `ee74f49`（`app/` 不 dirty）。Hugging Face Job，一张 Tesla T4，Chromium 走 Vulkan（ANGLE），high 档 1920×1080，冬昼。运行号 **20261125-145444**（Job `report.json` 的 `site.commit` 即 `ee74f49…`，`site.sha256` 钉住每个文件）。命令：

```sh
BASE_SITE=<main 98f333a 的 dist> LEVEL=t05 tools/gpu-render.sh t4-small "$(cat spec.json)"
```

spec：`bench` 三处各两轮、本分支与 main（`BASE_SITE`，同一 Job 里 `base/`）交替；`shots`：`shot-copy@winter-day@third`、`shot-p1b@winter-day@third`、`cam01@winter-day@third`。

## 帧耗（`__cost`，毫秒，让卡画完一帧；两轮的均值）

| 处 | 本分支 | main | 三角形 / 绘制调用（本分支对 main） |
|---|---|---|---|
| cam01（院落远望，C01） | 7.82 | 8.21 | 179 406 / 95 对 179 050 / 93 |
| 碑亭南侧（`cam=-16,16,0,0.08`，第三人称看亭） | 9.34 | 9.32 | 178 836 / 92 对 177 250 / 89 |
| cam02（踏道脚，C02） | 10.79 | 11.85 | 178 838 / 93 对 178 482 / 91（一轮） |

差别都在本卡的起伏之内：碑亭多出约 1 600 个三角形、3 次绘制（三级踏步与碑面），没有新的光与通道。

## 图（推在证据库，钉在 98f0223：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/98f0223d034acabd23c278a3218cc18b5964eed6/t05/728-t4 ，见 `MANIFEST.json`）

- `t4-shot-copy.png`：抄碑镜头的终点机位（他左肩后，与头齐高），碑面阴刻与托板执笔的手。
- `t4-shot-p1b.png`：P1「记下」的 3/4 低机位，殿的正面与前檐在上方。
- `t4-cam01.png`：cam01，殿与西侧碑亭。
- `slip-whole-upright.png`、`slip-note-upright.png`、`menu-row-upright.png`：手机竖屏（iPhone 13，软件渲染）。整页从歇脚菜单「这一页」打开（抄下的那句居首，旁边小字「元大德七年碑 · 观察那句」）；只有观察页时是那句话；纸上不盖红印。菜单在竖屏上「这一页」在「意」一栏里，要往下滚才看见。菜单底的版本行写 `c26d65f`：这几张图出自提交 `ee74f49` 之前的工作树构建，代码与 `ee74f49` 相同。
- `collage.jpg`：以上拼成一张（只在证据库，不进 git：本 PR 在 git 里的拼图是 `728-checkpoints/collage.jpg`）。
- `t4-report.json`：Job 的原始报告。

## 这次实拍查出并修好的

第一次实拍（运行号 20261125-143706，头 `c26d65f`）的 `shot-copy` 里，纸面上有一道暗色 V 形楔子。原因是纸贴在木板的正面上、两面同在一个平面，互相闪烁（软件渲染下整张纸发暗，抄写过程里的帧恰好没露出来）。`ee74f49` 把木板改为 6 mm 厚，纸在板面上 1 mm，笔尖再高 1 mm，并加了单测（`t05-writing.test`「the paper lies a millimetre clear of the board's face」，先红后绿）。同一提交还让静止摆姿（`?show=shot-copy`、`__poseRite`）的纸板每帧跟着他转到该处，也加了单测。
