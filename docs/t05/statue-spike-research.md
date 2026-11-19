# 七佛造像试验：开工前补查的现成做法（#280）

2026-11-19 查。每条标核到什么程度：**原文已读**（读了该页或该文本身）、**二手**（读了转引它的文章）、**上游不明**（读了网页，但网页没写出处）、**未核**（只见于搜索摘要或没打开）。推测不当出处用。

## 一、公有领域的坐佛三维扫描

**结论：没有找到辽、金、北宋的 CC0 坐佛三维扫描。** 唯一沾边的辽代扫描是首都博物馆的白石释迦（Sketchfab `982fd66a…`，上传者 HeritageEast），是卧佛（涅槃像），不能下载，没有标许可。

能下载、许可写明的坐佛（Sketchfab 接口 `/v3/models/{uid}` 当天读的 `license` 字段）：

| 件 | 年代、材质、尺寸 | 姿态 | 文件 | 许可 | 能不能做底 |
| --- | --- | --- | --- | --- | --- |
| Freer（美国国立亚洲艺术博物馆）F1917.243《Seated figure of Buddha》，Sketchfab `a4d22eb6…` | 唐，8 世纪初；大理石，51.5 cm | 结跏趺坐、袒右、螺髻无冠；**两前臂和手残缺** | 30 万面，Objaverse 有镜像（11.2 MB，SHA-256 `5834c2c7…`） | **CC0**，但是扫描者 Daniel Pett 在馆内拍 117 张照片自建的，不是馆方发布；馆方对该件标「usage conditions apply」（未核：原页打不开） | 汉地、无冠、坐姿对，手要重做；放进白盒看过：底座悬空、要清理 |
| 克利夫兰艺术博物馆 1973.85《Seated Buddha》，Sketchfab `d86bda08…` | **日本平安时代**，1100 年代；木胎贴金，像身 88 cm | 结跏趺坐、定印、手完整，带光背和莲座 | 40.7 万面 | **CC0**，馆方发布（clevelandart.org/open-access-faqs） | 形体完整，但是日本像；只作比例和衣纹参考。Objaverse 里没有，Sketchfab 下载要登录，**这次没有取到文件** |
| Mia 31240《Amoghasiddhi Buddha》，`33699be9…` | 明永乐，1403–24；檀木髹漆贴金 | 结跏趺坐，右手施无畏 | 项目已有：`app/shared/models/buddha-lacquer.glb`（40k 面，顶点色） | **CC0**，馆方 | 完整、零成本；但样式是藏传五方佛，不是辽式 |
| 雷峰塔地宫鎏金释迦坐像，Sketchfab `7d0cbc0e…`（上传者 dluo） | 晚唐至五代，10 世纪；鎏金铜，68 cm | 结跏趺坐，说法印，自带背光和莲座 | 19 万面，Objaverse 有镜像（8.1 MB，SHA-256 `345e94e0…`） | **CC BY 4.0**（要署名），第三方在浙江省博物馆拍摄；馆方权利未核 | 年代最近，但背光、莲座和像身是一体，要切；只作对照，没有选作底 |
| 史密森尼 F1923.15「法界人中像」 | 北齐；石灰岩 151 cm | 立像，缺头缺臂 | CC0（Open Access API） | 不适合 |

查过不适合的：Mia、克利夫兰的泰国、柬埔寨、印度坐佛；菩萨像（项目已在用）；造像碑（浮雕）；旧金山亚洲艺术博物馆两件（不能下载）；哈佛 / 芝加哥大学 CAEA 的模型（CC BY 或许可未核）；卡内基、Met 燃灯佛（CC BY-NC，不能商用）；Met 2026 年 2 月发布的三维模型（页面 429，有没有中国坐佛**未核**）；Scan the World（许可未核）；Europeana（未查）。Sketchfab 检索词：seated buddha、liao、buddha china、jin dynasty、song dynasty buddha、buddha ming、buddha tang、amitabha、shakyamuni、chinese buddha、vairocana、xiangtangshan buddha（含与不含 `license=cc0`）。

## 二、Tripo 的价目和接口（官方文档，2026-11-19 读）

来源：<https://developers.tripo3d.ai/en/pricing>、<https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard>、<https://developers.tripo3d.ai/en/docs/migration-v2-to-v3>。

- 1 点 = 0.01 美元。文字生成模型：无贴图 10 点、标准贴图 20 点；图片 / 多视图生成：20 / 30 点。HD 贴图 +10，HD 几何 +20，四边面 +5，智能低模 +10，分件 +20。另做贴图（Texture 任务）标准 10 点、HD 20 点。文字生图 seedream 5 点起。
- 版本：`v3.1-20260211`（推荐）、`v3.0-20250812`、`v2.5-20250123`。有 `model_seed`、`image_seed`（文字生成内部先出一张图，这个种子管那张图）、`texture_seed`、`face_limit`、`negative_prompt`。同一种子同一输入出同一网格。
- 新接口在 `openapi.tripo3d.ai/v3`，但本沙箱的代理只接了 `api.tripo3d.ai`（v3 域名返回 401），所以用旧的 v2 任务接口 `POST /v2/openapi/task`，`model_version` 填 `v3.1-20260211`，能用。
- 条款与上次相同（2025-07-11 版，付费产出可商用、无署名要求，见 `docs/t00/refactor/novice-spike.md`「许可」）。

## 三、七佛的手印：出处到哪一步

**没读到任何一手调查报告**（杜仙洲《义县奉国寺大雄殿调查报告》，《文物》1961-2；建筑文化考察组《义县奉国寺》，天津大学出版社 2008；丁垚等，《建筑史》25 辑，2009）。逐尊、双手都写到的描述只找到一处网页 A（<https://u.ss3316.com/yo/26/6976_18738353.html>），上游不明；它的用语（袒右式 / 下垂式 / 下垂加偏衫式）和数字（掌长 1.15 m、指圈直径 0.38 m）像是出自测绘报告，这是推测，不当出处用。

| 位次（东→西） | 手印 | 衣式 | 出处 |
| --- | --- | --- | --- |
| 东 1 迦叶 | 禅定印（双手叠置） | 耿威：通肩；A：袒右——**冲突** | 耿威 2016（二手，搜狐转载原文已读）；A（上游不明） |
| 东 2 拘留孙 | A：左手置右脚上掌心向上；右臂微抬掌心向前 | A：下垂式 | 只有 A |
| 东 3 尸弃 | A：左臂微抬掌心向外，指尖触腿；右手上举至胸 | A：下垂加偏衫式 | 只有 A |
| 东 4 毗婆尸（正中） | 说法印；哪只手结，几家不一 | 双领下垂 | 耿威、C（《穿越千年看古建》）、A |
| 东 5 毗舍浮 | A：右手举胸，拇指与中指、无名指相捻 | A：下垂加偏衫式 | 只有 A |
| 东 6 拘那含牟尼 | A：右手微抬掌心向下作拿捏状 | A：下垂式 | 只有 A |
| 东 7 释迦 | 与愿印（耿威、C），另有触地印（知乎，未核）、「掌心皆向上」（A）——**四说冲突** | **袒右**（耿威、C、A、新浪博客 D 一致） | 二手，较可靠 |

- **经典里没有给七佛分派手印。** 《长阿含经·大本经》卷一（CBETA T01n0001，原文已读）记七佛的名、劫、树等，全卷没有「印」字。Bhattacharyya《Indian Buddhist Iconography》说七佛坐像一般「all alike」（wisdomlib，原文已读）。所以奉国寺七佛的手印是造像者的安排；耿威「七尊手印是一个渐次移动双手的连续动作」是他的读法。
- **胸衣「花纹 / 龙纹」：没找到任何来源，未核。** 调研包 `CULTURE.md` §2.3 这一条应改成未核。
- **高度：** 「正中毗婆尸合座 9.5 m」多见于通俗文章；Heritage Science 2021（引丁垚等 2009）给七尊平均约 9.4 m（原文已读）；《奉国寺纪略》（二手转引）记拘留孙身高二丈三尺、**高于**毗婆尸的二丈一尺五寸。「中尊最高」只能算多数说法。
- **释迦转头：** 「脸稍向西偏」（耿威，二手）；A 作「略向西南」。
- **辽代坐佛的比例和风格：** 王南等，《建筑史学刊》2021-2（澎湃转载，原文已读）：应县木塔首层大佛头身比 1∶3–1∶3.25；奉国寺七佛高宽比近 3∶2，两端几尊趋于 8∶5；中尊通高与明间面阔之比也是 3∶2（引丁垚、成丽的三维扫描研究，未给数值）。温玉清（《紫禁城》，原文已读）：七佛「皆结跏趺坐于约 90 厘米高的砖坛及仰莲佛座之上」「多经后代重妆」。灵隐寺网站赏析（二手、通俗）：面形圆鼓、肉髻平缓、螺发正中嵌髻珠、两肩宽厚、上身偏长、仰莲座莲瓣肥厚。

**要请顾问或查原书的地方**：拘留孙、尸弃、毗舍浮、拘那含牟尼四尊的手印（只有来源不明的 A）；释迦的手印（四说）；迦叶的衣式；胸衣纹样。建议所有者请人查《文物》1961-2 和《义县奉国寺》（2008）两种原书，或请顾问对照正面高清照片逐尊核一遍——这是对照，不是要把奉国寺的像抄进游戏。

### 这次试验怎么用这些

- 三尊试验选的是出处最可靠的三尊：**迦叶（禅定印）、毗婆尸（说法印）、释迦（袒右、与愿印）**。它们在奉国寺的位置分别是东端、正中、西端；本试验把它们并排放在 0、±5.80 处，只为看三种手印、两种衣式「远看是一组、近看各是一尊」成不成立，不是排位提案。
- 正式做七尊时，四尊只有 A 的手印要么等顾问，要么由所有者定为「原创演绎」（游戏里本来就标「非实测复原」），在 `SOURCES.md` 写「自拟」。

## 四、主要网址

- 耿威《历史的细节——义县奉国寺大殿的佛教内涵与建筑形式》，《中国建筑文化遗产》2016 年第 19 期，搜狐转载：<https://m.sohu.com/a/946278009_121124384/>
- 搜狐「万岁时」（转引《奉国寺纪略》）：<https://www.sohu.com/a/339616069_771517>
- 《穿越千年看古建》第 3 章：<https://mwbook.novel.qq.com/read/1056120361/3>
- 新浪博客 D：<https://blog.sina.com.cn/s/blog_6ddbd0b10102vs5t.html>
- Heritage Science 2021：<https://www.nature.com/articles/s40494-021-00488-2>
- 温玉清，故宫博物院：<https://www.dpm.org.cn/Uploads/File/pdf/0b/8f/fb/0b8ffb189a727c76e511dd43360018f4.pdf>
- 王南等（澎湃）：<https://m.thepaper.cn/newsDetail_forward_14226434>
- 灵隐寺：<https://www.lingyinsi.org/detail_15523.html>
- CBETA《长阿含经》卷一：<https://cbdata.dila.edu.tw/stable/juans?work=T0001&juan=1>
- Bhattacharyya：<https://www.wisdomlib.org/buddhism/book/the-indian-buddhist-iconography/d/doc242501.html>
- Sketchfab：<https://sketchfab.com/3d-models/a4d22eb6d3c44848bd49b89fb4c28759>、<https://sketchfab.com/3d-models/d86bda08fa92458397596d2a42b30f46>、<https://sketchfab.com/3d-models/7d0cbc0e0d034e63a02274ab8af70eee>
- Objaverse 镜像：<https://huggingface.co/datasets/allenai/objaverse>（revision `556637099bf4…`，与 T00 七件扫描同一版）

没能打开：百度百科、知乎（403）、360doc（网络不放行）、silkroads.org.cn 等。
