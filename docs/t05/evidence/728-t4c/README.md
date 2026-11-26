# #728 T4：T05 的 J01（冬昼）四张，交美术总监终审

T05 的基线气氛 J01 是**冬昼**（初冬晴）：`app/levels/t05/level.js` 的 `moodFor` 只对 `winter` + `day` 给 J01，不指定季时 T05 的 firstMood 也是冬昼。`728-t4b/` 里的夏昼四张（run 20261125-154240）是引擎默认的灰天，不是玩家看到的 J01，**作废**，以这里为准。

- **run 20261125-154648**（`t4-report-j01.json`）：头 `2418734`（`app/` 不 dirty；它与 `f2b2f81` 只差证据文档，页的入口 `assets/index-ClwUJWIV.js` 与 `site.sha256` 和 run 20261125-154240 相同）。一张 Tesla T4，Chromium 走 Vulkan（ANGLE），high 档 1920×1080。
- `j01-shot-copy.png`：抄碑镜头的终点机位（他左肩后与头齐高），整石碑面的阴刻与托板执笔的手，纸面干净、抄的那列字在纸上。
- `j01-shot-p1b.png`：P1「记下」的 3/4 低机位，殿正面与前檐在上方。
- `j01-cam01.png`：cam01，殿与西侧碑亭。
- `j01-stele.png`：从碑亭踏步顶看碑面（第一人称），题名与四列都读得出。
- `collage.jpg`（只在证据库）：四张拼一张。

图钉在 01f7655：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/01f7655167eb95246bfcec1355e533615f2d0554/t05/728-t4c

帧耗见 `728-t4b/`（run 20261125-153838，与 main 9cdfb5d 同 Job 交替；本分支不比 main 慢）。
