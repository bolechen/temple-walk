# T05 的字体重裁（2026-11-25）

T05（奉明寺）要上生产，它要写的字有一批不在裁好的字体里。本文记这次重裁：原始字体从哪里来、哈希是什么、加了哪些字、体积涨了多少、怎么证明原有的字没动、怎么再来一次。

## 1. 缺的是什么

`pnpm run check` 在 main 和在 #705、#710 两个分支（本地合并后）都是 0 个问题，因为两处作者都把缺字的词换掉了绕开它。真正的缺口要对照字体文件才看得出来：

- 韩文寺名「봉명사」：「봉」在 `serif-ko` 里有，在 `brush-ko`、`hand-ko` 里没有。这两套只按 `app/locales` 裁，而 `check.cjs` 只对照 `chars-ko.txt`（读的字的总清单），所以查不出来。
- 简体「营」、日文「営」不在任何一套里；「修建」的「修」「建」本来就在。
- `docs/t05/I18N.md` §3–§5 列的新字（寂、县、辽、契丹、耶律、萧绰、赟、跏趺、庑、栿、椽……）多数不在。
- `bang`（匾额的字）没有「奉」「明」。

## 2. 加了什么、怎么加

- `app/levels/t05/font-chars.json`：这一关还没写进任何脚本或表里的字，分三档。`all` 是大字（寺名）：进该语言的每一套面，包括 brush 和手写；`text` 是读的字（术语、I18N.md §3 的日韩栏、§4 草稿句、§5 清单）：只进该语言的 kai 和 serif；`bang` 是匾额的字。以后字写进了表或脚本，扫描自然找得到，这里就不必再列。
- `tools/fonts.py` 的 `level_chars()` 读各关的这个文件，改动只在三处调用。关卡自己的 `locales/<语言>.js` 由 #710 的改动认（`WORK_TABLES`），本 PR 不重复。
- `tools/fonts-diff.py`：重裁前后逐字比对（见 §4）。

## 3. 原始字体

全部取自 github.com/google/fonts 的 `main`（取字时为 `83c62e3`），LXGW WenKai 取自 lxgw/LxgwWenKai 的 v1.530 release。版本与现有字体文件里记的（name 表第 5 项）逐一相同；仓库里原来没有记过来源哈希，这是第一次记。

| 用于 | 字体 | 版本 | 原件 SHA-256 | 取自 |
|---|---|---|---|---|
| brush | Ma Shan Zheng | 2.003 | `6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb` | …/mashanzheng/MaShanZheng-Regular.ttf |
| kai | LXGW WenKai | 1.530 | `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b` | github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf |
| xing | Zhi Mang Xing | 2.001 | `644e0cae9b40f0b10ab729a01bd32032e3973bac22be3dccae01bf6ae7fde969` | …/zhimangxing/ZhiMangXing-Regular.ttf |
| serif, seal | Noto Serif SC（可变） | 2.003-H1 | `050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9` | …/notoserifsc/NotoSerifSC[wght].ttf |
| bang, brush-ja | Yuji Boku | 3.002 | `94fda16384f3bdac24376a000c57e99abfa314961bd89ef27badfb7410322003` | …/yujiboku/YujiBoku-Regular.ttf |
| xing-ja | Yuji Syuku | 3.002 | `82728ebafc8c97391e2dab633414a806f344b8e4e2227d307179f07b548fca61` | …/yujisyuku/YujiSyuku-Regular.ttf |
| kai-ja | Klee One | 1.100 | `bf4063f030cc2ae6adf0a11424a1888e5c0eb4438f1f6d02f52294af868e9b3a` | …/kleeone/KleeOne-Regular.ttf |
| serif-ja, seal-ja | Noto Serif JP（可变） | 2.003-H1 | `2fd527ba12b6a44ec30d796d633360da0aeba6c5d4af1304ce12bb4dc15a7dfc` | …/notoserifjp/NotoSerifJP[wght].ttf |
| serif-ko | Gowun Batang | 2.000 | `466c593e7147412e748af4856d5ad14709b5a860bdf62b9c2546f2c5874e9849` | …/gowunbatang/GowunBatang-Regular.ttf |
| brush-ko | Song Myung | 1.00 | `7f90ab20250911560212cc5819c7b205f9c6644bb96b65095d89fcae096bbf58` | …/songmyung/SongMyung-Regular.ttf |
| hand-ko | Nanum Brush Script | 1.100 | `27ceaf578c96f594cdf07fe0181b251790acbb746a164e45c1f6473f89911a31` | …/nanumbrushscript/NanumBrushScript-Regular.ttf |

「…」指 `https://raw.githubusercontent.com/google/fonts/main/ofl`。EB Garamond（`serif-en`、`hand-en`）这次没有重裁，也没有取原件：英文表没有变。授权全文 `app/shared/fonts/OFL.txt` 一字未动（`git diff` 为空）；脚本的 `main()` 会把它重写一遍，所以重裁后须还原它。

## 4. 原有的字没有动

`python3 -I tools/fonts-diff.py <改前的 woff2 所在目录>`：对改前每一套里的每个字，比对展开部件后的轮廓哈希、字宽、左侧距，再比对整套的度量（upm、hhea 与 OS/2 的上下沿和行距、x 高、大写高）和名称表（含版权、许可、改名后的 Yunjing Kai 与 Yunjing Hand KO）。结果：17 个文件全部通过，没有字符被删，没有字形、字宽、度量、名称变动。组合字形（「。」「`」）裁切时引用的部件会重新编号，所以比较前先展开。

这也说明下载的原件和当年裁字用的是同一份：同一份字体、同一个脚本重裁，原有字符的轮廓一一相同。

## 5. 体积

| 文件 | 改前 KB | 改后 KB | 增 | 字数 |
|---|---|---|---|---|
| brush | 297.8 | 327.4 | +29.6 | 814→886 |
| xing | 218.6 | 240.2 | +21.5 | 814→886 |
| kai | 304.7 | 319.9 | +15.2 | 1379→1449 |
| seal | 172.5 | 185.7 | +13.1 | 849→923 |
| serif | 263.4 | 275.4 | +12.0 | 1376→1446 |
| bang | 25.4 | 26.3 | +1.0 | 44→46 |
| kai-ja | 576.2 | 588.8 | +12.6 | 1269→1305 |
| serif-ja | 300.0 | 306.2 | +6.2 | 1269→1305 |
| xing-ja | 427.1 | 432.0 | +4.8 | 728→735 |
| brush-ja | 440.9 | 445.0 | +4.1 | 728→735 |
| seal-ja | 176.3 | 177.4 | +1.1 | 729→736 |
| hand-ko | 132.1 | 133.1 | +0.9 | 544→547 |
| brush-ko | 78.2 | 78.6 | +0.4 | 541→544 |
| serif-ko | 83.2 | 83.2 | +0.0 | 782→784 |
| serif-en、hand-en | 101.2 | 101.2 | 0 | 不变 |

十七套合计 3597.6 → 3720.3 KB，**+122.7 KB（+3.4%）**；按页面语言：中文六套 +92.4，日文五套 +28.8，韩文三套 +1.3。woff2 已是压缩格式，传输大小同这些数。

增加的字不全是 T05 的：brush、xing、seal 各多 55 个左右，是 main 的脚本和表在上次裁字之后新写、却没人重裁的字（这三套 `check` 不检查，缺了就回落到别的字体，画面上看不出是缺字）。其中有 34 个来自 `debug.js` 和各关的 `bake.js`、`checks.js`：`fonts.py` 的 `used()` 扫了它们，`check.cjs` 却明确排除了它们（页面不加载）。把 `used()` 改成同样的排除，下回少裁这 34 个字，但会同时去掉 18 个旧字（倒命坡境干廓挡晕植球碰筑绕缘蔽适遮降），别的分支正好用到就会红，所以本 PR 没有改，留作后续。

## 6. 再来一次

```sh
python3 -I tools/fonts.py SRC                  # 中文六套（SRC 里的文件名见 tools/fonts.py 开头）
git checkout app/shared/fonts/OFL.txt          # main() 会重写它
python3 -I tools/fonts.py --lang ja SRC        # ko 同；每次先还原 OFL.txt
python3 -I tools/fonts-diff.py BEFORE          # BEFORE 是改前的 woff2；必须全部 ok
pnpm run check && node --test tests/unit/fonts.test.mjs tests/unit/notices.test.mjs
```

## 7. 没做的

- 日韩的术语是建议值（I18N.md §3），字先进了 `kai-ja`、`serif-ja`；定稿后若换了词，字再增减。
- T05 的匾额只加了「奉」「明」；别的匾（大雄殿、法轮天地、慈润河山等）用什么字形（繁体？）由 T05 美术定，定了再进 `bang`。
- 文案中的日韩读音没有母语者核过。

## 8. 第二批：碑文与观察页（2026-11-25，第二个小 PR，挂在第一个之上）

字由打卡点会话给出，T05 主创定了落点：

- **碑面与抄下的那一行**（繁体，画在碑面和纸上，四种语言下同一套、不翻译）：`大元國大寧路義州重修大奉國寺碑觀其寶殿崔嵬儼居七佛法堂弘敞可納千僧遼金遺刹一炬殆盡獨奉國孑然而在`。进 kai（Yunjing Kai，LXGW 文楷）的 `text` 档，也进 serif。碑文还在对 S31 校勘，定稿若少几个字，多切无妨。
- **观察页小沙弥手写的一句和按钮**（纸上用 Yunjing Xing 写，所以进 `all` 档：该语言的每一套面，含 xing、xing-ja、hand-ko）：中文九间……台基比人高／记下／抄碑／元大德七年碑／收下；日文、韩文同一组句子的各自译法。英文全是 ASCII，EB Garamond 的两套本来就有，不用加。这些译文将放在 `app/levels/t05/locales/{ja,en,ko}.js`，打卡点分支推上去后扫描也找得到；在那之前由 `font-chars.json` 先保证。

核对：新字在原始字体里全有（没有「原件缺字」）；新字在对应的每个 woff2 里全有；`tools/fonts-diff.py` 对第一批的产物比对，17 个文件全部通过，没有字符被删或改。体积 3720.3 → 3740.0 KB，**+19.6 KB（+0.5%）**：kai +4.1，serif +3.6，日文五套 +7.8，韩文三套 +2.0，中文 brush、xing、seal 各 +0.3 至 +0.9。
