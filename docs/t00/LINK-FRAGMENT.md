# 链接里 `#` 后面的数据（`app/src/fragment.js`）

给「为他人点灯」（#343，`wishes.js`）和「带走存档」（#338）共用的一层封装：数据放在地址的 `#` 后面，浏览器不把它发给服务器，也不进访问日志。

## 格式

`#<kind>=<base64url>`，`kind` 是 1 到 8 个小写字母（现有：`lamp`；#338 用 `save`）。base64url 解开是：

| 字节 | 内容 |
|---|---|
| 0 | 封装版本，现为 `1`；0 或比读者所知更大的，读者按「太新」拒绝（`why: "version"`） |
| 1 … n−2 | 载荷，各 kind 自己的版本与排布 |
| n−1 | CRC-8（多项式 0x07）对前面所有字节；对不上是 `why: "checksum"`，即链接被截断或抄错 |

整个片段超过 8192 个字符一律不收。`unpack` 不抛错：返回 `{ ok: true, kind, bytes }` 或 `{ ok: false, why }`（`empty`、`format`、`checksum`、`version`）；谁调用谁决定是忽略（灯）还是告诉玩家（存档）。载荷大了可以用同文件的 `deflate`/`inflate`（浏览器与 Node 自带的 CompressionStream，`deflate-raw`）；`inflate` 有输出上限，小链接解出一大团的会被拒。

## 灯（`lamp`）

载荷两字节：`[祝语编号, 季节<<2 | 时辰]`。祝语编号是 `wishes.js` 的 `WISHES` 里的下标，**只能追加，不能改序或删**（改了，旧链接就指到别的话上去）；季节与时辰的编号是 `mood.js` 的 `SEASONS`、`TIMES` 的下标。典型链接：`https://temple.rushiwowen.co/?utm_source=lamp&utm_medium=share&utm_content=<lang>#lamp=AQMJaw`（片段 11 个字符）。读的一方只认列表里有的编号，其余忽略，页面上除了预设祝语不显示任何来自链接的文字（`tests/unit/wishes.test.mjs`，e2e `lamp`）。

## 给 #338 的话

`pack("save", bytes)` / `unpack` 直接可用；存档的载荷版本、各键的校验、「覆盖当前进度」的确认页都是 #338 自己的事。`yard.js` 里的 `__debugURL()` 会把当前地址的 `location.hash` 原样带上，导入存档时记得先读后清（`history.replaceState`），灯的做法见 `game.js` 里 `arrival`。
