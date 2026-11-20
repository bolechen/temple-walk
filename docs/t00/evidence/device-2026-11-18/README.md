# 真机第一轮：Pixel 8a，2026-11-18（issue #188）

项目第一组真手机上的数字。机型 Pixel 8a，Android 17，Chrome 157.0.8103.78，
GPU ANGLE (ARM, Mali-G715, OpenGL ES 3.2)，屏幕 411×812，DPR 2.625，
全程插电（AC powered），电量从 33% 到 46%。测的是已发布站
https://temple.rushiwowen.co/ 。

三份原始报告（JSON，文本，直接进 git）：

| 文件 | 内容 |
| --- | --- |
| `device-188-report.json` | 低档 `?tour=120x3&q=low` 一轮 + 冷启动 1 次 + `__cost`/`__census` |
| `device-188b-report.json` | 中档 `?tour=120x3&q=medium` 一轮；触屏部分因 `touchscreen.tap` 在 CDP 下报错而整体失败（见下） |
| `device-188c-report.json` | 触屏重跑（改用原生 CDP `Input.dispatchTouchEvent`）：点地走路、跳、双指、竖横屏截图 |

##  headline 数字

- **低档**：三轮 59.55 / 59.87 / 59.88 帧，p95 都是 16.8 毫秒，最长一帧
  192.1 / 33.4 / 17 毫秒；`ready_ms` 11388；`__cost()` 32.63。
  调速器在低档没有触发（`governed` 在触屏环节读到 1，是之后的事）。
- **冷启动到 ready**：1 次，12795 毫秒。注意：`enterBtn` 在 ready 刚触发的那一刻
  仍是 disabled（游戏用 200 毫秒轮询来启用它，探针读得太早），这是计时
  伪影，不是缺陷。
- **中档**：三轮 30.10 / 29.11 / 28.64 帧，p95 约 116.7–116.9 毫秒，
  最长一帧 283.9 / 142.2 / 142 毫秒；`ready_ms` 12073.9；`__cost()` 52.33。
  中档平均约 30 帧但 p95 约 117 毫秒，卡顿感明显；三轮递减，
  可能与发热有关（这是当晚第二轮长跑）。
- **内存（PSS，旧探针的 TOTAL 正则解析，不可靠）**：tour 后 202185 KB，
  触屏环节后 198092 KB；ready 后和进入后两次读数是 null（正则没匹配上）。
  旧探针的 PSS 解析有 bug，已在 `tools/device.cjs` 里修掉：
  新脚本读 `dumpsys meminfo` 的 "Total PSS by process" 一节，
  把所有 `com.android.chrome*` 进程（主进程 + 沙箱渲染进程）加起来，
  并单独报主进程。第一轮的 PSS 数因此不能和新脚本的直接对齐。
- **触屏**：点地走路过（首点干净通过）；跳圆环在这一轮没验成
  （按跳后 0.8 秒读数无高度变化——0.8 秒已经落地，读得太晚；
  后来 #142 的探针用 150–300 毫秒内读数确认了跳是有效的）；
  跳圆环与「留影」「歇脚」签条竖屏横屏都不重叠（有截图，见下）；
  双指缩放没验（发了手势，但无 `__cam` 可核）。

## 截图

竖屏、横屏各一张（跳圆环与「留影」「歇脚」签条不重叠的证据），
不在 git 里（都超过 1 MB）。先跑 `hf auth login`，再跑：

    node tools/evidence.mjs push docs/t00/evidence/device-2026-11-18

它会把两张图传到 `bolechen/temple-walk-evidence`，并写 `MANIFEST.json`。
本机副本在 `/Users/avenger/device-188c-portrait.png` 和
`/Users/avenger/device-188c-landscape.png`。

## 对照用的参考线（主创自拟，无出处，只作对照，不作结论）

- 低档平均不低于 30 帧每秒；95 分位帧不超过 50 毫秒；
  冷启动到可点不超过 15 秒。

## 还没做的（下一轮，见 #188 主创 2026-11-18 的评审）

- 冷启动、热启动各 3 次取中位数；内存三个点（首院、殿内、阁上）。
- 低档连跑两轮，第二轮对第一轮的差单独报（发热对比）。
- 触屏 7 项：坐蒲团、上台下台阶、息屏、开场、登顶回廊、双指缩放、跳
  （用 `__pose`、`?up=lingxiao`、`__ending()`、`__opening()` 把他放到位
  再做手势；跳在按下后 150–300 毫秒内读 `__yard().h`）。
- `?walker=mesh` 的数不在本条验收里（迁移第 3 步没开工，已挪到第 3 步的 issue）。

## 复现

    node tools/device.cjs

方法要点写在脚本头的注释里：Chrome 必须在前台；触摸用原生 CDP
`Input.dispatchTouchEvent`，不要用 Playwright 的 `touchscreen.tap`；
`dumpsys meminfo` 的 TOTAL 正则不可靠，读 "Total PSS by process" 一节。
