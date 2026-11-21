# 链接里 `#` 后面的数据（`app/src/fragment.js`）

给「为他人点灯」（#343，`wishes.js`）和「带走朱印帐」（#338）共用的一层封装：数据放在地址的 `#` 后面，浏览器不把它发给服务器，也不进访问日志。

## 格式

`#<kind>=<base64url>`，`kind` 是 1 到 8 个小写字母（现有：`lamp`、`save`）。base64url 解开是：

| 字节 | 内容 |
|---|---|
| 0 | 封装版本，现为 `1`；0 或比读者所知更大的，读者按「太新」拒绝（`why: "version"`） |
| 1 … n−2 | 载荷，各 kind 自己的版本与排布 |
| n−1 | CRC-8（多项式 0x07）对前面所有字节；对不上是 `why: "checksum"`，即链接被截断或抄错 |

整个片段超过 8192 个字符一律不收。`unpack` 不抛错：返回 `{ ok: true, kind, bytes }` 或 `{ ok: false, why }`（`empty`、`format`、`checksum`、`version`）；谁调用谁决定是忽略（灯）还是告诉玩家（存档）。载荷大了可以用同文件的 `deflate`/`inflate`（浏览器与 Node 自带的 CompressionStream，`deflate-raw`）；`inflate` 有输出上限，小链接解出一大团的会被拒。

## 灯（`lamp`）

载荷两字节：`[祝语编号, 季节<<2 | 时辰]`。祝语编号是 `wishes.js` 的 `WISHES` 里的下标，**只能追加，不能改序或删**（改了，旧链接就指到别的话上去）；季节与时辰的编号是 `mood.js` 的 `SEASONS`、`TIMES` 的下标。典型链接：`https://temple.rushiwowen.co/?utm_source=lamp&utm_medium=share&utm_content=<lang>#lamp=AQMJaw`（片段 11 个字符）。读的一方只认列表里有的编号，其余忽略，页面上除了预设祝语不显示任何来自链接的文字（`tests/unit/wishes.test.mjs`，e2e `lamp`）。

## 存档（`save`，#338）

载荷是存档 JSON（`{ v, game: "yunjing", keys }`）用 `deflate-raw` 压缩后的字节；存档自己的版本是 JSON 里的 `v`，各键的校验与「会覆盖现在的进度」的确认页在 `app/src/carry.js`、`carry-page.js`，做法见 `SAVE.md`。

- **解压上限**：`SAVE_MOST` = 16384 字节（`inflate(bytes, SAVE_MOST)`）。校验能放过的最大存档约 2.2 KB JSON，链接片段约 680 字符；上限是它的四倍以上，留给以后新增的键。`tests/unit/carry.test.mjs` 构造这份最大存档，断言 JSON 的四倍不超过 `SAVE_MOST`、片段不超过 `MOST` 的一半，并用一个短链接解出 64 KB 的「解压炸弹」断言被拒。
- **拒绝的理由**：`unpack` 的 `version` → 「来自更新的版本」；`format`、`checksum`、kind 不是 `save`、解压失败或超限、JSON 坏 → 「损坏」。
- 打开链接时先读后清（`history.replaceState`），与灯一样。
