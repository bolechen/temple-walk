# #728 T4 重拍：#740（天光）与 #723（整石碑）合进来之后

头 `f2b2f81`（`app/` 不 dirty；两份 `report.json` 的 `site.commit` 都是 `f2b2f81…`）。Hugging Face Job，一张 Tesla T4，Chromium 走 Vulkan（ANGLE），high 档 1920×1080。上一次实拍（`728-t4/`，run 20261125-145444 @ ee74f49）在 #740、#723 之前，光和碑身都已变，所以重拍。

## 两次 Job

- **run 20261125-153838**（`t4-report-cost.json`）：帧耗，本分支与当前 main（9cdfb5d，`BASE_SITE`）同一 Job 交替各两轮；图三张，冬昼（与先前证据同一气氛，便于对照）。
- **run 20261125-154240**（`t4-report-j01.json`）：只出图，夏昼四张。**作废**：T05 的 J01 是冬昼，夏昼是引擎默认的灰天，不是玩家看到的 J01；J01 四张见 `728-t4c/`（run 20261125-154648）。

## 帧耗（`__cost`，毫秒，两轮均值）

| 处 | 本分支 | main 9cdfb5d | 三角形 / 绘制调用（本分支对 main） |
|---|---|---|---|
| cam01 | 8.16 | 8.21 | 179 406 / 97 对 179 050 / 95 |
| 碑亭南侧（`cam=-16,16,0,0.08`） | 8.90 | 9.68 | 178 704 / 93 对 177 118 / 90 |
| cam02 | 11.09 | 12.00 | 178 838 / 95 对 178 482 / 93（一轮） |

差别在本卡起伏之内；碑亭多约 1 600 三角形、3 次绘制（三级踏步与碑面），没有新的光与通道。第一轮 cam01 的本分支一侧有一帧 7.0 s（首个页面的编译），之后各页最坏帧都在 0.9–1.1 s。

## 图（推在证据库，钉在 4147789：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/4147789111a3b40fdc57c8c4d46131d20194de4c/t05/728-t4b ，见 `MANIFEST.json`）

- `j01-shot-copy.png`、`j01-shot-p1b.png`、`j01-cam01.png`、`j01-stele.png`：夏昼（**作废**，文件名里的 j01 是误写，以 `728-t4c/` 为准）。
- `winter-shot-copy.png`、`winter-shot-p1b.png`、`winter-cam01.png`：冬昼。
- `collage.jpg`（只在证据库）：上排 J01 四张，下排冬昼三张与 J01 纸面放大。

**更正**：夏昼那四张天是阴灰色，原因是 T05 的 J01 是冬昼（`level.js` 的 `moodFor` 只对 winter + day 给 J01），夏昼走的是引擎默认气氛（T05 主创确认）。冬昼三张（run 20261125-153838）就是 J01。
