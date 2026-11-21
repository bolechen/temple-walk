# 素材商用授权核对（issue #105）

> **这是开发方对各来源公开条款的整理，不是法律意见。** 条款随时会改，这里记的是 2026-11-16 当天打开页面看到的内容。
> 涉及金额大的决定（收费上架、预告片投放）或下文标为「含糊」「未能核实」的项目，建议所有者请律师看过再定。

核对日期：2026-11-16。基线：`origin/main` 698fed3（清点在 9358ed3 上做；之后 main 没有动 `app/` 和登记表，只加了小沙弥身体的试验工具，不进产物）。判断口径：**最严的情形，即在 Steam 上收费销售**。
本次只核对和登记，没有删除、替换任何素材，也没有改游戏。
**第二轮（2026-11-20，基线 `origin/main` c38edbe）见第十节**：增量核对、第一轮链接复查、Steam 对 AI 内容的披露要求。第一至九节保持第一轮的原文。

逐行结果在 [`asset-register.csv`](asset-register.csv)，新加四栏：`commercial_use`（yes / conditional / no / unverified）、
`attribution_required`、`license_url`、`checked_on`。原有九栏含义不变（只修了两处数据：`LIB-three` 一行原来有个没加引号的逗号，
后三栏错位一格，已归位；它的 `file` 原写 `app/vendor/three/`，这个目录 11-15 起就不存在了，改成实际的来源 `node_modules/three`）。
抓到的原始条款和接口返回存在 [`evidence/licensing/`](evidence/licensing/)。

## 一、总表

| 类别 | 登记行 | yes | conditional | no | unverified |
|---|---:|---:|---:|---:|---:|
| 扫描贴图（Poly Haven） | 8（16 个文件） | 8 | | | |
| 字体 | 16 | 14 | 2 | | |
| 打进产物的程序库 | 5 | | 5 | | |
| 佛像与莲座模型 | 2 | 2 | | | |
| 代码生成（建筑、植物、小沙弥、声音、配乐、标签图标） | 6 | 6 | | | |
| 小沙弥的雕刻身体（Meshy） | 1 | | | | 1 |
| 馆藏作品图（ColBase 14、克利夫兰 13、大都会 5） | 32 | 18 | 14 | | |
| 名匾取字（无准师范「釋迦寶殿」） | 1 | | 1 | | |
| 博物馆三维扫描雕像（Mia 5、克利夫兰 2） | 7 | 7 | | | |
| 分享预览图 | 1 | | | | 1 |
| 参考图与美术原型（不随游戏分发） | 6 | 1 | | | 5 |
| **合计** | **85** | **56** | **22** | **0** | **7** |

没有一件核实为「不可商用」。22 件「有条件」里，没有一件的条件是「不许商用」，都是**要补的署名或许可声明**，以及两款字体要改内部名字。
7 件「未能核实」全是 AI 生成或来历没记下的图，要所有者回答第五节的问题。

## 二、范围清点

- **登记表**：原 76 行，逐行核对；新增 9 行（下面三个漏登记的文件、四个随产物发出却没登记的程序库、`refs/` 里三组没登记的参考图），现 85 行。
- **`app/` 下会进 `dist/` 的素材文件**：78 个（`vite.config.mjs` 的 `KEPT` 把 `shared/`、`levels/`、`vendor/`、`favicon.svg` 原样拷进产物）：
  馆藏图 32、名匾取字 1、贴图 16、模型 10、字体 16、分享图 1、标签图标 1、Basis 解码器 1（`.wasm`；另有同名 `.js`）。
  和登记表对过：
  - **有文件没登记**：`app/favicon.svg`、`app/shared/og/temple-walk.jpg`、`app/vendor/basis/basis_transcoder.wasm`。已补行（`GEN-favicon`、`OG-share`、`LIB-basis`）。
  - **有登记没文件**：`LIB-three` 指向的 `app/vendor/three/`（已改，见上）。其余登记了 `app/` 路径的行文件都在。
  - 新检查 `tests/unit/asset-register.test.mjs` 先失败（[`register-check-before.log`](evidence/licensing/register-check-before.log)：上面三个文件、四个新栏缺失），补齐后通过（[`register-check-after.log`](evidence/licensing/register-check-after.log)）。它在 `pnpm test` 里跑，以后往 `app/` 加图片、模型、字体、贴图、音频、`.wasm` 而不登记就会失败；登记表里的 `app/` 路径不存在也会失败（`app/vendor/` 除外，它是安装时拷的）。
- **馆藏作品**：`works.js` 32 件，`gallery/` 32 张图，一一对应。
- **扫描雕像**：`STAND` 用到 7 件（Mia 5、克利夫兰 2）。
- **字体** 16 个文件（六种中文用途，加日、英、韩各自的字面）；**贴图** 8 组；**名匾取字** 1 张。
- **npm 依赖里进产物的**：`three@0.186.0` 本体与它附带的 `GLTFLoader`、`KTX2Loader`、后期处理、`BufferGeometryUtils`；`meshopt_decoder`（meshoptimizer）；
  Basis Universal 解码器；`lil-gui` 和 `stats.js`（只给 `?debug` 面板用，正式站不加载，但分块文件在 `dist/assets/` 里）。
  其余 devDependencies（vite、playwright、sharp、gltf-transform、meshoptimizer 编码器、typescript）只在构建和测试时用，不进产物。
- **声音**：见第七节，全部合成。

## 三、逐类结论

### 1. 扫描贴图（8 行，yes）

<https://polyhaven.com/license>：「Our assets are all licensed as CC0 … You can use our assets for any purpose, including commercial work. You do not need to give credit or attribution when using them (although it is appreciated). You can redistribute them … or even in a product you sell.」
8 个资源页都标 `CC0 License`；作者由 Poly Haven 接口 `api.polyhaven.com/info/<id>` 读出（Rob Tuytel、Dario Barresi、Dimitrios Savva、Amal Kumar、Charlotte Baglioni、colormass、Rico Cilliers）。缩小、重新打包不受限。

### 2. 字体（16 行：14 yes，2 conditional）

全部是 SIL OFL 1.1，逐个打开了上游的 `OFL.txt`（`github.com/google/fonts/main/ofl/<名>/OFL.txt` 与 `github.com/lxgw/LxgwWenKai`）。
OFL 允许随软件（含收费软件）捆绑、嵌入、分发，不许单独卖字体；要求字体带着版权声明和许可全文——`app/shared/fonts/OFL.txt` 随产物发出，里面十二段齐全。
**关键在「保留字体名」（Reserved Font Name）**：子集化就是修改版，修改版不得使用保留名。逐个查了上游声明，再用 fontTools 读了我们子集文件里的名字表：

| 字体 | 保留名 | 子集里的名字 | 结论 |
|---|---|---|---|
| 马善政楷书、志莽行书、Noto Serif SC/JP、Klee One、Yuji Boku、Yuji Syuku、EB Garamond、Gowun Batang、Song Myung | 无 | 原名 | yes |
| 霞鹜文楷（`kai.woff2`） | 「霞鹜」「霞鶩」「落霞孤鹜」「落霞孤鶩」「LXGW」 | `LXGW WenKai` | **conditional** |
| Nanum Brush Script（`hand-ko.woff2`） | Nanum、NanumBrush 等 | `Nanum Brush Script` / `NanumBrush` | **conditional** |

- 霞鹜文楷的附加许可原文：保留名可以继续用在「subsetted or converted to other formats (e.g., WOFF/WOFF2) solely for web font delivery」的修改版里。网页上用没有问题；**装进 Steam 的桌面包算不算「solely for web font delivery」，条款没说清，按最严算不算**。
- Nanum 的 OFL 没有附加许可，子集沿用保留名，严格说现在网页上也不合规。
- 另：Noto 的两个子集名字表写着 `ExtraLight`（变量字体取实例时没改名），不涉及许可，只是名字不对。

### 3. 程序库（5 行，conditional）

| 库 | 许可证（核对的文件） | 现状 |
|---|---|---|
| three.js r186 | MIT（`mrdoob/three.js` r186 `LICENSE`；`node_modules/three/package.json` 同） | Vite 压缩后的 `dist/assets/index-*.js` 里**没有** MIT 声明 |
| meshoptimizer 解码器 | MIT（`zeux/meshoptimizer` `LICENSE.md`） | 文件头被压缩去掉了 |
| Basis Universal 解码器 | **Apache-2.0**（`BinomialLLC/basis_universal` `LICENSE`、`NOTICE`） | `tools/setup.mjs` 拷到 `app/vendor/basis/LICENSE` 的是 three.js 的 MIT 文本，不是 Basis 的；Apache-2.0 §4 要求附许可全文和 NOTICE 里的署名 |
| lil-gui 0.17.0 | MIT（npm 登记与文件头） | 只在调试分块里，正式站不加载 |
| stats.js | MIT（`mrdoob/stats.js` `LICENSE`） | 同上 |

都允许商用，条件都是**随发行物附上许可声明**。现在的产物里只有一份（还放错了地方）。

### 4. 佛像与莲座模型（2 行，yes：依所有者确认）

确认的出处：`docs/HANDOFF.md`「2026-11-15 所有者的四个决定」②「佛像与莲座模型归所有者所有，可随项目分发」；README「安全与素材许可」与 `CLAUDE.md` 都转记了这句。
开发方没有独立核实模型的原始作者（登记表原写「original authorship not recorded here」）。第五节留了一个确认问题。

### 5. 代码生成（6 行，yes）

建筑、植物、小沙弥（代码建的身体）、声音、配乐、标签图标都是本项目代码画出或算出来的，不涉及外部素材。

### 6. 馆藏作品图（32 行：18 yes，14 conditional）

**作品本身**：32 件都是 12 至 14 世纪的作品（南宋、元、北宋末、日本镰仓），有名可考的作者里卒年最晚的是楚石梵琦（1370），早已超出任何国家的著作权保护期，**作品本身属公有领域**。
**馆方的照片按什么条款开放**，分三家：

- **ColBase（14 件，东京国立博物馆 11、九州国立博物馆 3）→ conditional。** 用无头浏览器打开了 <https://colbase.nich.go.jp/pages/term?locale=ja>（最终更新日 令和6年8月1日；全文存 [`colbase-term-ja-2026-11-16.txt`](evidence/licensing/colbase-term-ja-2026-11-16.txt)）：
  「どなたでも以下の１.～６.に従って、複製、公衆送信、翻訳・変形等の翻案等、自由に利用できます。**商用利用も可能です。**」
  条件一：「コンテンツを利用する際は出典を記載してください」，例「出典：ColBase（https://colbase.nich.go.jp/）」或「出典：国立文化財機構所蔵品統合検索システム（当該ページのURL）」。
  条件二：「コンテンツを編集・加工等して利用する場合は、上記出典とは別に、編集・加工等を行ったことを記載してください。なお、編集・加工した情報を、あたかも当機構が作成したかのような態様で公表・利用してはいけません。」例「『ColBase』（当該ページのURL）を加工して作成」。
  另：与 CC BY 4.0 兼容；请求「各作品を尊重し、作者や寄贈者、関係するコミュニティの尊厳を傷つけるような形で利用しないようお願いします」；机构标志、logo 不在规则内；第三方权利由使用者自查。
  14 个藏品页逐个打开（[`colbase-items-2026-11-16.txt`](evidence/licensing/colbase-items-2026-11-16.txt)），每页「利用規約」都链到同一页，都提供图像下载，没有哪件标了另外的条件。
  我们把每张图缩到 1280 像素并转成 WebP（`tools/gallery.py`），按最严算属于「加工」，所以除了现有的出典行，还要写明加工过。
- **克利夫兰艺术博物馆（13 件）→ yes。** 开放获取接口 `openaccess-api.clevelandart.org/api/artworks/<编号>` 逐件返回 `share_license_status: "CC0"`、`copyright: null`。
  <https://www.clevelandart.org/open-access>：「High-resolution images and data … are made available under a Creative Commons Zero (CC0) designation」，「Works designated as Creative Commons (CC0) do not require attribution or citation」；附带「Citation of the CMA's CC0 or restricted content does not imply endorsement by the CMA, nor does it grant permission to use the CMA's trademarks」。
- **大都会艺术博物馆（5 件）→ yes。** 藏品接口 `collectionapi.metmuseum.org/public/collection/v1/objects/<id>` 逐件返回 `isPublicDomain: true`。
  政策页 <https://www.metmuseum.org/policies/image-resources> 当天返回 **HTTP 429**（限流），**没有读到政策页原文**；读到的是馆方 GitHub 开放获取仓库的说明（`metmuseum/openaccess` README，CC0；「You must not use The Metropolitan Museum of Art's trademarks or otherwise claim or imply that the Museum or any other third party endorses you」）——那段话说的是数据集，图像的 CC0 依据是接口的 `isPublicDomain` 字段。结论按 yes 记，但政策页原文请评审时再开一次。

**说明文字**：卡片上的中文说明是我们据馆方著录自己写的（`docs/t00/SOURCES.md`「馆藏说明」一行），日、英、韩文译自我们的中文，不是馆方文字的转抄，不需要另外的授权。**馆方来源行**照原样保留。

### 7. 名匾取字（1 行，conditional）

`app/levels/t00/boards/shijia.webp` 取自 ColBase TB-1446（无准师范《禅院額字「釈迦宝殿」》，重要文化财，东京国立博物馆），墨迹从纸上分离、切成四个字（`tools/boards.py`），属明显的「加工」。条款同上，可以商用；
但**游戏里没有任何地方为这块匾标出处**（画框里的同一件作品有卡片，匾本身没有），要在鸣谢页补上，并写明是加工后的。

### 8. 博物馆三维扫描雕像（7 行，yes）

**作品本身**：6 世纪至 1500 年代的雕塑，公有领域。**馆方扫描**：
- 文件取自 Hugging Face 上的 `allenai/objaverse`（登记表记了确切文件和哈希）。Objaverse 元数据（`metadata/<组>.json.gz`）逐件写 `license: cc0`，上传者 `artsmia` 或 `clevelandart`。
- 再用 Sketchfab 接口 `api.sketchfab.com/v3/models/<uid>` 逐件查了**当前**状态：7 件都是「CC0 Public Domain」，上传者是两馆官方账号，仍可下载。
- 克利夫兰接口对 1997.11 和 1981.53 返回 `share_license_status: "CC0"`，并给出同一个 Sketchfab 地址；Mia 接口 `search.artsmia.org/id/<id>` 对 5 件都返回 `rights_type: "Public Domain"`。
- Mia 的条款页（`artsmia.org/terms-of-use`）当天 HTTP 429，没有读到；结论依据是 Sketchfab 上馆方自己选的 CC0 与 Mia 接口字段。
- Objaverse 数据集整体是 ODC-By 1.0，它的说明写明「Individual objects … may be under the following licenses … The metadata will provide the license for each object」，我们只取了 7 件单个对象，按各自的 CC0。
- 小出入：Mia 在 Sketchfab 上把「Figure of a Monk」写成「10th C BCE」，馆藏页是 9 至 10 世纪（公元），不影响许可。

我们减面、把贴图烘成顶点色，CC0 不限修改。

## 四、conditional / unverified 逐项与处理建议

| 项目 | 状态 | 缺什么 | 建议 |
|---|---|---|---|
| ColBase 14 件馆藏图（`WORK-wuzhun-shijia-baodian`、`liangkai-chushan-shijia`、`liangkai-liuzu-jiezhu`、`yuanwu-yinkezhuang`、`xutang-poxutang`、`wuzhun-tang`、`jianyao-hemu-tianmu`、`jianyao-youdi-tianmu`、`zhangjizhi-huayanjing`、`songban-yuanwu-xinyao`、`dahui-wuxiang-chidu`、`wuzhun-bandu-chidu`、`chijue-bayu`、`baiyi-guanyin`） | conditional | 出典行已有；缺「加工过」的说明 | **补署名**：卡片来源行改成「出典：ColBase（条目地址）。据该图像缩小、转为 WebP」或「『ColBase』（条目地址）を加工して作成」，并在鸣谢页列出 |
| `CALLIG-shijia` 名匾四字 | conditional | 游戏里没有出典 | **补署名**：鸣谢页加一行，写明出典与「分离墨迹、裁切为四字」 |
| `FONT-kai` 霞鹜文楷 | conditional | 子集仍叫「LXGW WenKai」，附加许可只覆盖网页字体 | **改名**：`tools/fonts.py` 切字时把名字表换成项目自己的名字（如「Yunjing Kai」），版权行和 OFL 保留；或只在网页版用原名、桌面包用改名版 |
| `FONT-hand-ko` Nanum Brush Script | conditional | 子集沿用保留名 | **改名**，同上（网页版也应改） |
| `LIB-three`、`LIB-meshopt`、`LIB-lil-gui`、`LIB-stats` | conditional | 产物里没有 MIT 声明 | **补声明**：产物里加一份第三方许可汇总（如 `dist/THIRD-PARTY-NOTICES.txt`），鸣谢页链过去；调试分块也可以在商业构建里去掉 |
| `LIB-basis` | conditional | 附的许可文件是错的，缺 Apache-2.0 全文和 NOTICE | **补声明**：附 Basis 的 `LICENSE` 和 `NOTICE`；`tools/setup.mjs` 拷错的那份要改 |
| `MESHY-novice` 雕刻身体 | unverified | 生成时的套餐、是否公开过、输入图的权利 | **待所有者确认**（第五节）；现在默认不加载，影响小 |
| `OG-share` 分享预览图 | unverified | 谁做的、上面的字用的什么字体 | **待所有者确认**；若是本项目截图加项目字体，即可改为 yes（另随名匾补 ColBase 出典） |
| `REF-T00-main`、`REF-T00-sheet` | unverified | 研究图集站用什么生成 | 不进游戏；**确认前不要用在商店页和预告片** |
| `REF-jingshan-plates` | unverified | 来历没记；看上去是生成图，其中一张是另一张的改图 | 同上；若是在别人的照片上改的，还要问照片的权利 |
| `REF-monk-apose` A-pose 设定图 | unverified | OpenAI 条款没读到（openai.com 返回 403、浏览器打开超时）；所用账户未记 | **待所有者确认**；它是小沙弥形象的来源，商店页若要用这个形象，先答第五节的问题 |
| `REF-art-prototype` 六张美术原型 | unverified | `manifest.json` 只写「built-in image_gen」，不知是哪家服务 | 同上；确认前不要用在商店页和预告片 |

## 五、AI 生成素材：要所有者回答的问题

**Meshy（`MESHY-novice`）。** Meshy 的服务条款页 `meshy.ai/terms-of-use` 返回 **HTTP 403**，没有读到全文。帮助中心可以读（存 [`meshy-help-2026-11-16.txt`](evidence/licensing/meshy-help-2026-11-16.txt)，页面只写「Updated over a week ago」，没有日期）：
「Paid plans: You retain full private ownership of the assets you generate, provided you don't publish them publicly to the Meshy Community and the source materials (including any uploaded reference images) don't violate anyone else's copyright.」
「Free plan: Your models are licensed to you under CC BY 4.0, which still allows commercial use, but requires you to credit Meshy」（建议写法「Model created with Meshy – CC BY 4.0 License」）；
「Ownership rights are generally tied to the plan you were on at the time of generation」；取消订阅后「You'll retain the rights to the models you created while you were a subscriber」。

1. 生成 `novice.glb` 所用的那次导出（SHA-256 `5244a309…`）是哪天做的？当时 Meshy 账户是不是 Pro（或其他付费档）？能在 Meshy 后台的套餐与账单记录里看到吗？
2. 这个模型有没有发布到 Meshy Community（公开）过？
3. 输入图是 GPT Image 对 `refs/monk-apose-front-v1-eyes-closed.png`（2026-11-21 前叫 `monk-apose-front.png`） 的改图：你对它有没有完整的权利（见下面 OpenAI 的问题）？
4. 是否愿意自己读一遍 Meshy 服务条款全文（`meshy.ai/terms-of-use`，我们这边打不开），看有没有帮助中心没写的限制？

**OpenAI GPT Image（`REF-monk-apose`、可能也包括 `REF-art-prototype`）。** 条款页没读到，不下结论。

5. A-pose 三视图和正面图是在哪个产品里生成的（ChatGPT 个人版 / Plus / Team、API、别的）？大概哪天？
6. 它们是从文字生成的，还是在你自己画的草图上生成的？有没有用别人的作品做参考图？
7. 六张美术原型的「built-in image_gen」是哪家的哪个产品？用的是谁的账户？

**其他来历没记下的图。**

8. `refs/jingshan-courtyard*.png`、`refs/jingshan-hall-plate.png` 是谁、用什么做的？是不是在真实照片上改的？
9. 研究图集站的 `T00.png`、`T00-sheet.png` 用什么生成？
10. `app/shared/og/temple-walk.jpg` 谁做的？标题「山门之外」和英文用的是什么字体？
11. （确认性的）`/zen` 的佛像与莲座模型，是否全部由你或你的团队制作，没有含购买或生成的、带其他条款的部分？

另：Steam 对含 AI 生成内容的游戏有披露要求，本次没有核对它的现行条款；上架前要另查。

## 六、署名：游戏内「鸣谢与来源」所需的文字清单

只出清单，这次不改界面。**必须**的标「必」，其余是不要求但建议写的。

**馆藏图像与名匾**
- 必：「馆藏图像出典：ColBase（https://colbase.nich.go.jp/）。以下各图据 ColBase 图像缩小并转为 WebP 后使用」，下列 14 件的条目地址：
  `tnm/TB-1446`、`tnm/TA-617`、`tnm/TA-143`、`tnm/TB-1171`、`tnm/TB-1169`、`tnm/TB-1437`、`tnm/TG-2496`、`kyuhaku/G16`、`tnm/TB-1209`、`kyuhaku/B17`、`tnm/TB-1173`、`tnm/TB-1174`、`tnm/TB-1198`、`kyuhaku/A47`（均为 `https://colbase.nich.go.jp/collection_items/` 之后的部分）。
- 必：「大殿上檐『釋迦寶殿』四字：据 ColBase（https://colbase.nich.go.jp/collection_items/tnm/TB-1446）所载无准师范《禅院额字『釈迦宝殿』》（东京国立博物馆藏）加工，分离墨迹并裁切为四字。」
- 建议：「The Cleveland Museum of Art, Open Access (CC0)」「The Metropolitan Museum of Art, Open Access (CC0)」——各卡片上已有逐件来源行。
- 措辞不能暗示任何一家博物馆认可或参与了这个游戏。

**三维扫描**
- 建议：「殿内雕像的三维扫描：Minneapolis Institute of Art（5 件）、The Cleveland Museum of Art（2 件），CC0，经 Sketchfab / Objaverse 取得；本项目减面并烘焙为顶点色。」

**贴图**
- 建议：「部分材质纹理来自 Poly Haven（CC0）：Rob Tuytel、Dario Barresi、Dimitrios Savva、Amal Kumar、Charlotte Baglioni、colormass、Rico Cilliers。」

**字体**（OFL 要求许可全文随字体，`OFL.txt` 已随附；屏幕上列名是惯例）
- 建议：「字体：马善政楷书（Ma Shan Zheng）、霞鹜文楷（LXGW WenKai）、志莽行书（Zhi Mang Xing）、Noto Serif SC / JP、Klee One、Yuji Boku、Yuji Syuku、EB Garamond、Gowun Batang、Song Myung、Nanum Brush Script，均以 SIL Open Font License 1.1 授权，本项目切取子集。」（两款改名后，写「基于××修改」。）

**程序库**（必：许可全文随发行物）
- 必：three.js（MIT，© 2010-2026 three.js authors）、meshoptimizer（MIT，© 2016-2026 Arseny Kapoulkine）、Basis Universal（Apache-2.0，© 2016–2026 Binomial LLC，附 NOTICE；「Basis Universal」是 Binomial LLC 的商标）、lil-gui（MIT，George Michael Brower）、stats.js（MIT）。放进第三方许可汇总文件即可，鸣谢页给链接。

**AI 生成**
- 只有在 Meshy 免费档生成时才必须：「Model created with Meshy – CC BY 4.0 License」。付费档不需要。

### 现在卡片上的来源行够不够（逐件）

| 来源 | 件数 | 现在的来源行 | 判断 |
|---|---:|---|---|
| ColBase | 14 | `Source: ColBase (条目地址)` | **不够**：出典有了，缺「加工过」的说明（缩小、转 WebP） |
| 克利夫兰 | 13 | `The Cleveland Museum of Art, <基金> (<编号>). Open Access, public domain (CC0).` | 够（CC0 不要求署名，现在的写法比要求多） |
| 大都会 | 5 | `The Metropolitan Museum of Art, New York. <来源> (<编号>). Open Access, public domain (CC0).` | 够（同上） |

ColBase 14 件逐一是（标题照 `works.js`）：禅院额字“释迦宝殿”（tnm/TB-1446）、出山释迦图（tnm/TA-617）、六祖截竹图（tnm/TA-143）、与虎丘绍隆印可状（tnm/TB-1171）、致照禅者偈颂“破虚堂”（tnm/TB-1169）、禅院牌字断简“汤”（tnm/TB-1437）、禾目天目（tnm/TG-2496）、油滴天目（kyuhaku/G16）、楷书大方广佛华严经册（tnm/TB-1209）、宋版《圜悟心要》（kyuhaku/B17）、致无相居士尺牍（tnm/TB-1173）、致圣一国师尺牍“板渡墨迹”（tnm/TB-1174）、大慧宗杲、草堂善清墨迹跋（tnm/TB-1198）、白衣观音图（kyuhaku/A47）——每一件都是「不够」，原因相同。

## 七、声音：确认全部是合成的

在 `app/` 的代码里查了 `decodeAudioData`、`new Audio(`、`<audio`、`.mp3/.ogg/.wav/.m4a/.flac/.opus` 和所有 `fetch(`、`asset(` 调用：
- 没有一处解码或读取音频文件；`fetch` 只有 `community.js` 一处，取的是内测反馈群二维码的配置（二维码图片放在外部、由所有者维护，不在 `app/` 里，也不随产物分发），`asset()` 取的是贴图、模型、馆藏图、名匾字。
- `audio.js` 和 `instruments.js` 里的 8 处 `createBuffer` 都是把代码算出来的样本写进缓冲区（鼓槌和快门的噪声脉冲、风声的褐噪声、`stepSound()` 算出的脚步声、混响的冲激响应、琴弦 Karplus-Strong 的拨弦激励、撞木一声的噪声）。
- `app/` 下没有任何音频文件（新检查也会拦住以后加进来而不登记的）。

结论与 `CLAUDE.md` 一致：没有采样。（ColBase TB-1446 条目页附有馆方的语音讲解 mp3，我们没有下载或使用。）

## 八、没能核实的来源页

| 页面 | 结果 | 怎么处理的 |
|---|---|---|
| `metmuseum.org/policies/image-resources`、`/hubs/open-access` | HTTP 429 | 用藏品接口 `isPublicDomain` 与馆方 GitHub 说明；评审时请再开政策页 |
| `artsmia.org/terms-of-use`、`new.artsmia.org/terms-of-use` | HTTP 429 | 用 Sketchfab 接口（馆方选的 CC0）与 Mia 接口 `rights_type` |
| `meshy.ai/terms-of-use` | HTTP 403 | 读了帮助中心；条款全文请所有者读 |
| `openai.com/policies/terms-of-use`、`/row-terms-of-use` | HTTP 403；浏览器打开 60 秒超时 | 未下结论，列为待所有者确认 |
| `colbase.nich.go.jp/pages/guide` | 页面不存在（站内链接实为 `/pages/term`） | 读了 `/pages/term` |

ColBase 全站只能用浏览器渲染出来（直接抓取只有一行「Loading...」），本次用 Playwright 的无头 Chromium 打开；其余接口用 curl 直接取，原始返回摘要存 [`api-responses-2026-11-16.json`](evidence/licensing/api-responses-2026-11-16.json)。
本次没有联系任何第三方，没有发邮件，没有注册账号。

## 九、已补齐（issue #113）

前文不改。第四节里「conditional」的 22 项，条件已逐项补上，登记表 `asset-register.csv` 对应行改为 `yes`（`checked_on` 2026-11-16，补齐在同一天）；`unverified` 的 7 项没有动，等所有者回答第五节。没有换任何素材。

| 项 | 怎么补的 | 看哪里 |
|---|---|---|
| ColBase 14 件馆藏图 | 卡片在馆方来源行（`Source: ColBase (条目地址)`，按原文不译）之下加一行加工说明，写法照 ColBase 利用规约的示例「『ColBase』（URL）を加工して作成」：「「ColBase」（URL）加工而成：缩小并转为 WebP。」，裁切过的写「裁切、缩小并转为 WebP」（现在 14 件都只是缩小转码，没有裁切）。数据是 `works.js` 每件的 `processed` 字段（`tools/gallery.py` 写出），文字走 `t()`，日、英、韩各有译文。鸣谢页也列了这 14 件，各链到条目页 | `src/credits.js`（`processedLine`）、`tests/unit/credits.test.mjs`、e2e `lang`（日文卡片）、`docs/t00/evidence/licensing/fix/` 四种语言的卡片截图 |
| 名匾「釋迦寶殿」`CALLIG-shijia` | 鸣谢页「名匾」一节写明出典（TB-1446 条目地址）和加工（分离墨迹、裁切为四字） | 鸣谢页、`credits.test.mjs` |
| 鸣谢与来源页 | 歇脚菜单加「鸣谢」，打开一张纸（`#credits`，`ui.layer`）：馆藏三家（ColBase 14 件逐件、克利夫兰与大都会、不暗示馆方认可）、名匾、三维扫描（Mia、克利夫兰）、Poly Haven 与七位作者、字体及各自的 OFL 版权行、程序库，并链到第三方许可汇总和字体许可全文。文字走 `t()`，四种语言都有；馆方来源行不译 | `src/credits.js`、`index.html` 的 `#credits`、e2e `menu`（开页、14+1 个 ColBase 链接、两份许可文件能打开）、`tools/mobile-audit.cjs` |
| 字体保留名 `FONT-kai`、`FONT-hand-ko` | 子集文件的 name 表换成项目自己的名字：`Yunjing Kai`（PostScript `YunjingKai-Regular`）、`Yunjing Hand KO`（`YunjingHandKO-Regular`），Nanum 的商标记录（name 7）去掉；版权、许可记录照原样保留。`tools/fonts.py` 的 `cut()` 切字时自动改（`RENAMED`），已切好的文件可用 `python3 tools/fonts.py --rename` 就地改。新检查 `tests/unit/fonts.test.mjs`（在 Node 里直接读 `.woff2` 的 name 表）：16 个字体文件的名字记录不含各自 OFL 声明的保留名；先让它失败（`hand-ko.woff2` 的 name 1、3、4、6、7 含 Nanum），再改。为了鸣谢页的新字，还用原始 TTF（google/fonts、lxgw v1.530）重切了十六个文件里的字集，所有原有字的字形逐个比对没有变 | `fonts.test.mjs`、`pnpm run check` |
| 第三方许可声明 `LIB-three`、`LIB-meshopt`、`LIB-lil-gui`、`LIB-stats` | `tools/notices.mjs` 写 `app/shared/licenses/THIRD-PARTY-NOTICES.txt`：three.js、meshoptimizer 的 MIT 全文读自 `node_modules`，lil-gui、stats.js、Basis 的 LICENSE 与 NOTICE 取自各自仓库、放在同目录；它随 `shared/` 进 `dist/shared/licenses/`，鸣谢页有链接。`vite.config.mjs` 的构建收尾在文件缺失、缺任一库的名字时让构建失败 | `tests/unit/notices.test.mjs`（把站点真的建到临时目录，查五个库的名字、四份 MIT 与 Apache-2.0 全文、版权行）、e2e `menu` 在页面里打开这份文件 |
| Basis `LIB-basis` | `tools/setup.mjs` 不再拷 three.js 的 MIT，改拷 Basis 自己的 Apache-2.0 `LICENSE` 和 `NOTICE`（放在 `app/shared/licenses/`，因为没有任何安装的包带着它们）到 `app/vendor/basis/`；同样的两份也在汇总里 | `notices.test.mjs`（`dist/vendor/basis/LICENSE`、`NOTICE`） |

**还没做到的，如实写在这里**
- 评审时仍请再开一次大都会、Mia 的政策页（第八节，当时 HTTP 429）；这次没有重核，登记表里它们本来就是 `yes`。
- 鸣谢页里的 Poly Haven、三维扫描、字体三节是「建议写」的内容，不是条款要求；写了不会有害，主创认为多余可以删。
- 日、英、韩的译文是开发方初稿，未经母语者审读（与其余界面一致，见 `docs/t00/I18N.md`）。
- 重切字体让几张字面变大了：`brush-ja` +57 KB、`xing-ja` +58 KB、`seal-ja` +25 KB、`hand-ko` +12 KB，原因是这些面的字集按整张翻译表算，而鸣谢页并不用它们写字（见 PR 里的取舍问题）。

## 十、第二轮核对（2026-11-20，issue #105，基线 c38edbe）

> 同样是开发方对公开条款的整理，不是法律意见。口径不变（最严：收费上架）。没有删除、替换任何素材，没有改游戏。第五节的 11 个问题**原样保留**，开发方没有替所有者回答；所有者后来在 #105 的评论里答了其中第 1、2、5、6、7、8、11 问，按他的原话更新了相关行（见 10.6）。
> 抓到的条款原文和接口返回在 [`evidence/licensing/round2/`](evidence/licensing/round2/)（小文本，进 git）。本地仓库是浅克隆，没有第一轮基线 698fed3，所以「11-16 之后新增」用登记表的 `checked_on`、`app/` 下的素材文件清单和依赖清单来判断（见 10.1）。

### 10.1 增量核对

- **文件和登记表一一对应**：`tests/unit/asset-register.test.mjs` 通过（4 项）。`app/` 下进产物的素材文件现为 79 个，比第一轮的 78 个多的一个是 `app/web/wechat-support-2026-08-28.jpg`（微信赞赏码），已登记（`WECHAT-QR-2026-08-28`）。**没有新字体、新贴图、新模型、新雕像、新馆藏图片**：`app/shared/fonts/` 仍是 16 个 `.woff2`，`models/` 仍是 10 个 `.glb`，`gallery/` 仍是 32 张，`textures/` 仍是 16 个。登记表现 90 行（第一轮 85，加上第一轮之后记的 `LIC-notices`、`LIB-three-treegen`、`DATA-walk-t00`、`DATA-doorways-t00`、`WECHAT-QR-2026-08-28`）。
- **新进依赖**：`package.json` 只有 `three@0.186.0` 一个运行时依赖，没有新的进产物的库；`app/` 里裸导入的只有 `three` 和 `three/addons/*`。`three-mesh-bvh`、`sharp`、`@gltf-transform/*` 等只在构建、工具里用，不进产物（`app/src/walkviz.js` 只在注释里提到 three-mesh-bvh）。
- **逐项核对第一轮之后新进登记表的 5 行**（都按原标准打开了来源）：

| 行 | 内容 | 核对 | 结论 |
|---|---|---|---|
| `LIB-three-treegen` | 改自 three r186 的 `TreeGenerator`（`app/src/three-tree.js`） | 再读 `three.js` r186 `LICENSE`：MIT，© 2010-2026 three.js authors；`THIRD-PARTY-NOTICES.txt` 第 9 行点名了这份拷贝 | yes（MIT，许可文本已随发行物；修改处写在文件头） |
| `DATA-walk-t00` | 烘焙的可走地面 | 本项目自己的网格烘出，无外部素材 | yes |
| `DATA-doorways-t00` | 烘焙的门洞画面 | 本项目自己的房间与灯；房间里的像各有登记行 | yes |
| `WECHAT-QR-2026-08-28` | 所有者的微信赞赏码 | 文件 SHA-256 前 16 位 `342876983294082f` 与登记一致；`https://rushiwowen.co/donate` 当天返回 200；是所有者自己的收款码，无需授权。只在 web 构建显示，steam 与 platform 构建里没有（`tests/unit/channel.test.mjs` 检查，本次没有重跑） | yes（见 10.4 对 Steam 的一条提醒） |
| `LIC-notices` | 随发行物的许可文本 | 第一轮已核；本轮核了其中 three、Basis、stats.js 的原文，一致 | yes |

### 10.2 第一轮链接复查

第一轮登记表里有 32 个不同的 `license_url`。本次重新打开 **20 个**（超过一半），另外按第一轮的方法重取了接口。结果：

| 链接 | 本次结果 | 与第一轮比 |
|---|---|---|
| `polyhaven.com/license` + 4 个资源接口（fine_grained_wood、medieval_blocks_03、japanese_cedar_bark、snow_02） | 200；仍是 CC0，「any purpose, including commercial work … no credit … product you sell」；作者与第一轮相同 | 无变化 |
| ColBase 利用规约（`/pages/term?locale=ja`，再取了 7 个条目页：TB-1446、TA-143、TB-1169、TB-1437、kyuhaku/G16、TB-1173、kyuhaku/A47） | 全文与 11-16 的逐字一致（最终更新日仍是令和6年8月1日）；商用可、要出典、加工要另写；7 个条目页都有「利用規約」和「ダウンロード」，没有另加条件。**注意**：第一次抓取返回的是「页面不存在」的占位页（站点按需渲染，等得不够久），等 12 秒后取到全文；这是抓取问题，不是条款被撤 | 无变化 |
| 克利夫兰 `open-access` 页 + 接口 1997.11、1970.2、1958.427.1、1977.200 | 200；页面仍是 CC0、「do not require attribution or citation」、「does not imply endorsement …」；4 件接口 `share_license_status: "CC0"` | 无变化 |
| Sketchfab 接口 5f209e2a（Mia）、1a57a0d6（克利夫兰）、33699be9（Mia）、a8581040（克利夫兰），及 c6efb650 的模型页 | 都是「CC0 Public Domain」，「Credit is not mandatory. Commercial use is allowed.」，上传者是馆方账号，仍可下载 | 无变化 |
| 大都会接口 40276、39534 | `isPublicDomain: true` | 无变化 |
| Mia 接口 1473、124303 | `rights_type: "Public Domain"` | 无变化 |
| OFL：Ma Shan Zheng、Noto Serif SC、Yuji Boku、EB Garamond、Song Myung、Nanum Brush Script、LXGW 文楷 | 200 | 前六个无变化。**LXGW 的附加许可措辞比第一轮引的多了一个条件**：保留名可继续用于「solely for web font delivery」的子集版，「provided such Modified Versions are not made available as installable desktop fonts」，版权行年份是 2021-2026。我们的文件已改成 `Yunjing Kai`，不依赖这条，**结论不变**（原文存 `round2/ofl-lxgw-wenkai-2026-11-20.txt`） |
| three.js r186、Basis Universal、stats.js、meshoptimizer、lil-gui 0.17.0（npm） | 200；MIT 或 Apache-2.0，与第一轮一致 | 无变化 |
| Meshy 帮助中心文章 | 200；付费档「full private ownership … provided you don't publish them publicly to the Meshy Community」；免费档 CC BY 4.0、**要在「project description」里署名**，建议写法同前 | 措辞略有补充（署名位置），结论不变 |
| `rushiwowen.co/donate` | 200 | 无变化 |

**仍然打不开（未能核实）**：

| 页面 | 结果 | 处理 |
|---|---|---|
| `metmuseum.org/policies/image-resources` | HTTP 429（curl 与无头 Chromium 都一样）；Wayback 的存档本机被代理拦下，没取到 | 与第一轮相同：依据是藏品接口 `isPublicDomain`；政策页请评审时人工再开一次 |
| `artsmia.org/terms-of-use` | HTTP 429 | 同上，依据是 Sketchfab 的 CC0 与 Mia 接口 `rights_type` |
| `meshy.ai/terms-of-use` | HTTP 403 | 仍只读到帮助中心；请所有者读全文 |
| `openai.com/policies/terms-of-use` | 直接抓取 HTTP 403；无头 Chromium 读到了全文 | 已读，见 10.6（版本 Effective 2026-01-01，原句已记）；生成当天那一版仍未读 |
| `tripo3d.ai/terms`（网页端）、`developers.tripo3d.com/en/terms`（API） | 网页端直接抓取 403；两份都用无头 Chromium 读到了全文 | 已读，见 10.6；小沙弥走 API，适用 API 那份（Last updated 2025-07-11） |

没有任何一项因为条款变化而需要改状态。登记表里 46 行的 `checked_on` 改为 2026-11-20（只有这一栏变）；状态现为：yes 88、conditional 0、no 0、unverified 2（第一轮第九节补齐后是 yes 78、unverified 7；加上第一轮之后记的 5 行（都是 yes）为 83 / 7；再按所有者回答把 `MESHY-novice`、`REF-monk-apose`、`REF-art-prototype`、`REF-T00-main`、`REF-T00-sheet` 五行改为 yes，见 10.6）。

### 10.3 总表（2026-11-20）

| | 行数 | yes | conditional | no | unverified |
|---|---:|---:|---:|---:|---:|
| 登记表合计 | 90 | 88 | 0 | 0 | 2 |
| 其中第二轮自己新增的行 | 0 | | | | |
| 其中第二轮重新打开并改了 `checked_on` 的行 | 46 | 46 | | | 0 |
| 其中因所有者回答由 unverified 改为 yes 的行 | 5 | 5 | | | |
| 仍是 unverified | 2 | | | | `OG-share`（第 10 问）、`REF-jingshan-plates`（工具没记录） |

「第二轮新增」指第二轮自己新加的行：没有（第一轮之后记的 5 行是别的 PR 记的，本轮核了它们，都是 yes）。条目变化：措辞变化、不改状态 2 项（`FONT-kai` 附加许可多了一个条件、Meshy 帮助中心免费档署名位置）；状态变化 5 项（见 10.6）。

### 10.4 Steam 对 AI 生成内容的披露要求（原文摘要）

来源：Steamworks 文档「Content Survey」，<https://partner.steamgames.com/doc/gettingstarted/contentsurvey>，2026-11-20 读，全文存 [`round2/steam-contentsurvey-2026-11-20.txt`](evidence/licensing/round2/steam-contentsurvey-2026-11-20.txt)。页面没有标更新日期。内容调查共三部分，第三部分是「Generative Artificial Intelligence Content」。要点（引文照原文）：

- **范围**：「it is concerned with the use of AI in creating content that ships with your game, and is consumed by players. This includes content such as artwork, sound, narrative, localization, etc.」；「Efficiency gains through the use of these tools is not the focus of this section.」——开发里用 AI 提效的工具不是这一部分的重点。
- **Pre-Generated**（预生成）：「Any kind of content that ships with your game and is consumed by players that is created with the help of AI tools during development.」需要在调查里**如实描述**（页面说「this section will require you to describe that implementation in detail」）。「Under the Steam Distribution Agreement, you promise Valve that your game will not include illegal or infringing content, and that your game will be consistent with your marketing materials. In our prerelease review, we will evaluate the output of AI generated content in your game the same way we evaluate all non-AI content」。
- **Live-Generated**（运行时生成）：另需说明给 AI 加了什么防护以免生成违法内容。**本项目没有运行时生成**（声音全是合成，见第七节；没有调用任何 AI 服务）。
- **其他**：「Products on Steam must adhere to the content rules, regardless of whether it is disclosed」；商店页和构建获批后，调查里有些项不能自己改，要联系 Steam 支持。
- **页面之外**：1 月中旬的媒体报道称 Valve 把表单改成「只披露玩家会接触到的 AI 内容，不含幕后提效工具」，并且披露会显示在商店页；那是转述，没有读到 Valve 自己的公告，**以上面读到的原文为准，商店页怎么显示未核实**。

**本项目可能要披露或要先弄清楚的项**（这是开发方的整理，是否算、怎么填由所有者定）：

1. **小沙弥的雕刻身体 `novice.glb`（Meshy 生成）**：属于「随游戏发出」的 AI 生成美术。它 11-15 起默认不加载，但仍在 `dist/` 里（`?body=sculpt`）。要么披露，要么上架构建里去掉；版权上已无问题（10.6），披露与否是另一个决定。
2. **生成它的输入图（GPT Image 改图）**：不随游戏发出，不属于披露范围；它们的权利问题见 10.6（OpenAI 条款）。
3. **商店页、预告片素材**：`refs/` 里的 AI 生成图和美术原型不随游戏发出。其中 A-pose 三视图、六张美术原型和 `T00*` 两张的版权问题已按 OpenAI 条款解决（10.6）；`T00*` 两张也是 GPT 做的（同样按 OpenAI 条款）；`jingshan-*` 三张的工具没有记录，分享预览图来历未答。拿去做商店页或预告片时，页面原文没有明说商店素材是否算在内，**未核实**；OpenAI 条款还禁止把 AI 输出说成是人做的。
4. **分享预览图 `OG-share`**（`unverified`，来历不明）：若是 AI 生成要一并算。
5. **日、英、韩的译文**：`localization` 是原文列出的内容类别。这些译文是开发会话（Claude）写的初稿，没有经过母语者审读（见 `docs/t00/I18N.md`），属于 Steam 要披露的 localization；填不填、怎么填由所有者定。
6. **代码里的程序化内容**（建筑、植物、声音、配乐）：是代码生成，不是 AI 模型出的内容；若代码是在 AI 编程助手帮助下写的，按页面原文属于「efficiency」工具，不是调查重点。这是开发方的读法，Valve 的审核口径未核实。
7. **佛像与莲座模型**：第五节问题 11 已问；若其中含生成或购买件，要回头看。
8. **一条与 AI 无关的提醒**：微信赞赏码只在 web 构建里（`channel.js` 的 `WEB`），steam 与 platform 构建没有；上架 Steam 的构建请保持这样（`channel.test.mjs` 守着）。

### 10.5 第二轮还没做、留给后面的

- 第五节还剩第 10 问（`OG-share`）待所有者回答；第 3、4 问见 10.6。
- 大都会、Mia 政策页与 Meshy、OpenAI 条款全文仍是「未能核实」，需要有人在浏览器里手开。
- 主创按关闭条件抽查（≥10 项，每类至少 1 项）。

### 10.6 所有者的回答与据此更新的行（issue #105 评论，2026-11-20）

所有者的回答原文在 [#105 的评论](https://github.com/bolechen/temple-walk/issues/105)（开发方没有替他回答，只记他说的）。

| 问 | 所有者的回答 | 更新 |
|---|---|---|
| 1、2 | Meshy 是**付费档**，**没有发到过 Meshy Community** | `MESHY-novice` → `yes`，不要求署名；依据「所有者确认（2026-11-20）+ 帮助中心原文」。**Meshy 服务条款全文（第 4 问）仍未读到**（`meshy.ai/terms-of-use` HTTP 403），照实写在登记表里 |
| 5、6 | A-pose 三视图在 **ChatGPT Plus** 里**由文字生成** | `REF-monk-apose` → `yes`（OpenAI 条款，见下） |
| 7 | 六张美术原型也是 ChatGPT（GPT 图像）生成 | `REF-art-prototype` → `yes`（同上）。注意输入是本游戏的截图，里面有大殿的「釋迦寶殿」匾（取自 ColBase，署名已在鸣谢页） |
| 8 | `jingshan-*` 三张是主创派单生成的 | 登记表 `REF-jingshan-plates` 的来历改为「本项目会话生成，工具未记录」；最早见于提交 `89439a7`（2026-11-11）；**状态仍是 `unverified`**，因为不知道用的什么工具，不能套 OpenAI 条款 |
| 11 | 佛像与莲座是所有者原有项目 buddhist-say 的 zen 模块的模型，所有者持有版权 | `MODEL-buddha`、`MODEL-pedestal` 的依据补上这句：「所有者确认（2026-11-15、2026-11-20）」 |
| 3 | 没有单独答；由第 5、6 问的回答覆盖（输入是文字，不是别人的图） | Meshy 的输入图是 GPT 图像对 A-pose 正面图的改图，A-pose 图由文字生成，没有第三方作品入图 |
| 9 | 研究站上的 `T00.png`、`T00-sheet.png` 也是 GPT 做的 | `REF-T00-main`、`REF-T00-sheet` → `yes`，依据同 `REF-art-prototype`（OpenAI 条款 2026-01-01 版）。所有者没说是哪个套餐、哪天、输入是什么；两张是参考图，不随游戏发出 |
| 10 | 待答 | `OG-share` 仍是 `unverified` |

**OpenAI 现行使用条款，版本与原句**（`https://openai.com/policies/terms-of-use/`，页面标「Published: January 1, 2026 … Effective: January 1, 2026」，2026-11-20 用无头 Chromium 读到全文，直接抓取仍是 403；摘录存 [`round2/openai-terms-of-use-2026-11-20.txt`](evidence/licensing/round2/openai-terms-of-use-2026-11-20.txt)）：

- 「Ownership of content. As between you and OpenAI, and to the extent permitted by applicable law, you (a) retain your ownership rights in Input and (b) own the Output. We hereby assign to you all our right, title, and interest, if any, in and to Output.」
- 「You are responsible for Content … You represent and warrant that you have all rights, licenses, and permissions needed to provide Input to our Services.」
- 「Similarity of content. … output may not be unique and other users may receive similar output … Our assignment above does not extend to other users’ output or any Third Party Output.」
- 使用限制里有一条：不得「Represent that Output was human-generated when it was not.」
- 条款没有区分 Plus 与其他个人档。**没有读到生成当天有效的那一版**（页面有「Previous version」链接，没有打开），也没有读 OpenAI 的使用政策（Usage Policies）。
- 「to the extent permitted by applicable law」这句很重要：条款只是把 OpenAI 的权利转给你；**纯 AI 生成的图像在各国能否取得著作权，是法律问题，不是条款问题**，金额大的决定请律师看。

**Tripo（主创问到的小沙弥新身体，#246、#286）**：截至 c38edbe，`app/` 和登记表里**没有** Tripo 产物（只在 `tools/novice-tripo.mjs`、`tools/novice-rig.mjs` 等工具里，原始导出在 Hugging Face 存储桶，不在仓库），所以没加登记行；它进 `app/shared/models/` 时 `asset-register` 单测会拦住不登记的文件。

*适用哪份条款。* 所有者指出，小沙弥是开发会话通过 **Tripo API**（`api.tripo3d.ai`）生成的，没有走网页端，所以适用开发者平台的条款：<https://developers.tripo3d.com/en/terms>，标题「Terms of User Agreement」，**Last updated: July 11, 2025**，运营方 Holymolly Ltd（2026-11-20 用无头 Chromium 读到全文，摘录存 [`round2/tripo-api-terms-2025-07-11-read-2026-11-20.txt`](evidence/licensing/round2/tripo-api-terms-2025-07-11-read-2026-11-20.txt)）。我起初预读的是网页端条款（`tripo3d.ai/terms`，2026-11-13 版，摘录也存了 `round2/tripo-terms-2026-11-20.txt`），**那份不适用于 API 生成的模型**；它的要点（免费档产物默认公开、放弃权利）只在用网页端免费档时才相关。

*开发者平台条款读到的：*
- **§3.2**：不得用 Outputs 做与 Holymolly 竞争的模型或服务；原文：「you may use Outputs for lawful commercial or non-commercial purposes, so long as such Outputs are not distributed or made available to third parties in a manner inconsistent with this Agreement or applicable laws」——可以商用，但带「不得以与本协议或法律不符的方式分发」的限定（本项目看不出冲突，但原文如此）。读到的这几节里没有署名、水印或 AI 标签的要求（网页端新版才有）。
- **§5.2.1**（免费用户）：「Tripo retains all rights」。**§5.2.2**（付费用户）：在用户授权 Tripo 提供服务所需的非独占使用的前提下，「Paid Users generally have all rights … of the Inputs and Outputs」；同段并承诺不把 Inputs 和 Outputs 用作训练数据。注意「generally」和一串前提（遵守法律、本协议等），不是无条件的「全部权利」。
- **§6.4**：「API Credits are prepaid and non-refundable once purchased」。条款只说 API 点数是预付的，**没有逐字写**「买了点数就算 Paid User」；这一步是所有者和主创的读法，开发方只能说它与条款不矛盾。
- §3.1：输入不得侵权。

*所有者的回答*（#105 评论，2026-11-20）：用的是所有者充值买的 API 点数（#163 记 400 点），输入图是 #163 记下的所有者自己的四视图，导出文件里的 AI 标记照原样保留，API 生成的模型不会自动公开。据此上面预读的四个问题：①套餐——付费点数；②是否公开——不会自动公开；③输入图——所有者自己的四视图；④AI 标记——保留。**登记行的写法**（等 Tripo 产物进 `app/` 时再加）：`commercial_use: yes`，依据「Tripo 开发者平台条款 2025-07-11 §3.2、§5.2.2，付费 API 点数（所有者充值，所有者确认 2026-11-20）」，不要求署名；备注 §3.2 的分发限定和 §5.2.2 的前提。我没有逐条细读条款的其余部分。

**仍待所有者**：Meshy 服务条款全文（帮助中心原文已足以定 `yes`，全文留待有人在浏览器里读）。

**合并后补（主创，2026-11-20）**：所有者答：「分享预览图和径山参考图都 gpt 做的，你查下 git」。查 git：分享预览图 `app/shared/og/temple-walk.jpg` 是所有者本人在 `ee195ad`（2026-11-15，feat(sharing): add game cover and Open Graph metadata，无 AI 会话署名、无 PR）提交的；径山三张最早见于 `89439a7`（2026-11-11，第一任主创的原型会话提交，说明里把殿内那张叫「painted plate」）。两行据所有者回答按 OpenAI 条款改为 `yes`：`OG-share`（随站点发出；标题字是 GPT 画出来的还是事后另排字体，所有者没说，暂按图的一部分算，若是另排的字体要补那款字体的许可）、`REF-jingshan-plates`（参考图，不随游戏发出）。登记表现为 yes 90、unverified 0。上 Steam 时，分享预览图若用作商店素材，属于 AI 生成内容，见 10.4。
