# #728 T05 自己的一页：抄碑与「整体」（证据）

分支 `feat/t05-checkpoints`，软件渲染（SwiftShader），J01 冬昼，1280×720，第三人称。出图的工具与命令都在仓库里，任何人可以重出。

## 拼图（git 里只留这一张：`collage.jpg`）

自上而下三条：

1. **抄碑动作分解**（`copy-*.png`，文件名用英文 take、raise、read、down、write、read-again、stop、away；`copy-sheet.jpg`）：`node tools/t05-copy-frames.cjs <dir> --q=medium`。从他站在碑前、按「抄碑」起，握住观察的时钟（`__riteClock`）逐步推进，在 0.5 取纸、1.0 举板、1.9 抬头读、3.0 落笔、8.0 写、10.0 再抬头、12.6 停笔、13.7 收起各拍一帧。`copy-frames.json` 逐帧记镜头阶段（`in` → `hold` → `out`）、`cuts`（全程 0）、他手里写到第几笔、手/笔/纸离碑面最近的距离（全程 ≥ 0.585 m）。
2. **摆镜条带**（`strip-*.png`，`strip-sheet.jpg`）：同一工具加 `--times=0.4,0.6,…,1.8`，镜头从他身后摆到抄碑机位的 0.4–1.8 s，每 0.2 s 一帧。**交美术初审判好看与否**。初版机位在他左前侧时，这一段 1.2 s 处西南柱占满前景、把他整个挡住（初版的条带没有放进来，原因写在 `docs/t05/SOURCES.md` §17）；现版机位在他左肩后，柱只从侧边前景掠过，他全程在画面里。`t05-director.test` 的「no column ever stands between the eye and him」把这一条钉住。
3. **「整体」横墨分解**（`stroke-*.png`，文件名 take、look-eave、down、stroke、line、stop、away；`stroke-sheet.jpg`）：同一工具加 `--p1`，C02 处按「记下」后 0.5 取纸、1.9 抬头看檐、3.0 落笔、3.9 横墨、6.0 写下那句、8.6 停笔、9.6 收起。（工具的地址带 `cam`，不写存档，所以收起后「记下」会再出现；正常走动时不会，e2e `t05-page` 断言了。）

## 其余（推在证据库，见 `MANIFEST.json`；钉在 a4faf89（文件名先用了中文，镜像的键是地址、要 ASCII，重推一次））

- `shot-copy_…png`、`shot-p1a_…png`、`shot-p1b_…png`：`node tools/shots.js --level=t05 shot-copy@winter-day@third shot-p1a@winter-day@third shot-p1b@winter-day@third`，三处打卡点各自的机位静帧（他摆成写字的姿势）。
- `stele-face.png`：从碑亭踏步顶往碑面看（`?level=t05&q=low&shot=1&view=first&cam=-16,12.9,0,0.25`），碑面阴刻读得出。字体按 #721 合并前的裁字，缺的繁体字是回退字形。
- `mobile-upright-pageSlip.png`、`mobile-upright-menu.png`、`mobile-t05-report.json`：`node tools/mobile-audit.cjs --level=t05`（中文，upright/side/small/large × 标题、入场、歇脚菜单、竖纸），0 问题。竖纸上「庑」「瓦」是回退字形，等 #721；纸角的红印此后已在 T05 页上隐藏（这张截图在隐藏之前）。

碑身的砌缝是碑亭体块的材质，#723 改成整石，不在本 PR。
