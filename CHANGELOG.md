# Changelog

## [0.6.0](https://github.com/bolechen/temple-walk/compare/v0.5.0...v0.6.0) (2026-11-20)


### Features

* **analytics:** the visit's end, a changed setting and what a failed load broke are counted ([#330](https://github.com/bolechen/temple-walk/issues/330)) ([3842012](https://github.com/bolechen/temple-walk/commit/38420124220201119b6711913671a652edc6812f)), closes [#326](https://github.com/bolechen/temple-walk/issues/326)
* **build:** the desktop shell is MyGo, the trial build by default and a store build by --channel ([#263](https://github.com/bolechen/temple-walk/issues/263)) ([b1ab530](https://github.com/bolechen/temple-walk/commit/b1ab53021da181940b247b882b7a43d3da170608)), closes [#261](https://github.com/bolechen/temple-walk/issues/261)
* **incense:** incense may be offered in every hall with a Buddha, each burning on its own ([#316](https://github.com/bolechen/temple-walk/issues/316)) ([9eaf6ff](https://github.com/bolechen/temple-walk/commit/9eaf6ff5a33a595a541a03db3b08e3560b139dd5)), closes [#146](https://github.com/bolechen/temple-walk/issues/146)
* **ui:** the pause menu and the thanks say which build this is, and a new version is offered ([#311](https://github.com/bolechen/temple-walk/issues/311)) ([cbdc2cc](https://github.com/bolechen/temple-walk/commit/cbdc2cc06e629939b02e2efe53b93d11107c1eab)), closes [#310](https://github.com/bolechen/temple-walk/issues/310)


### Bug Fixes

* **camera:** 上台阶时镜头不再随每级踏步点头 ([#306](https://github.com/bolechen/temple-walk/issues/306)) ([d756748](https://github.com/bolechen/temple-walk/commit/d75674845b3d4885292342eca4e09fe2a468d2ad))
* **ui:** the build's line sits in the menu's foot without pushing the languages off a phone ([#329](https://github.com/bolechen/temple-walk/issues/329)) ([f0e5c86](https://github.com/bolechen/temple-walk/commit/f0e5c86196d72be62154acf9b5a1967242bd66fe))
* **walk:** 凌霄阁底层回廊加宽到走得过；贴栏杆走时让开望柱 ([#305](https://github.com/bolechen/temple-walk/issues/305)) ([4577abd](https://github.com/bolechen/temple-walk/commit/4577abddbf42644771f41b87757050413d1be448))

## [0.5.0](https://github.com/bolechen/temple-walk/compare/v0.4.0...v0.5.0) (2026-11-19)


### Features

* **analytics:** 补运营埋点，记录 Umami 数据快照 ([#260](https://github.com/bolechen/temple-walk/issues/260)) ([92d9528](https://github.com/bolechen/temple-walk/commit/92d9528327d4a9356a3e803f8b8b024ca4a0dde5))
* **camera:** 第三人称默认居中（B），台阶上俯仰随他修正，被挡时绕头顶让位 ([#291](https://github.com/bolechen/temple-walk/issues/291)) ([8d290ea](https://github.com/bolechen/temple-walk/commit/8d290eac78a852073149b14ff86b2e22f91ec927))
* **doorway:** 从殿外看进门洞，画的是这座殿自己的屋子（[#218](https://github.com/bolechen/temple-walk/issues/218)） ([#222](https://github.com/bolechen/temple-walk/issues/222)) ([cfb9f01](https://github.com/bolechen/temple-walk/commit/cfb9f01bfd7dcb77ae7681c3d647223f5298b5d2))
* **evidence:** mirror the manifests' files to R2 from CI ([#251](https://github.com/bolechen/temple-walk/issues/251)) ([56ea4cb](https://github.com/bolechen/temple-walk/commit/56ea4cb634265880592f8e743393f557f7844ce4))
* **ground:** the ground keeps the leaves that fall on it ([#267](https://github.com/bolechen/temple-walk/issues/267)) ([#269](https://github.com/bolechen/temple-walk/issues/269)) ([a507eae](https://github.com/bolechen/temple-walk/commit/a507eae4c2a81e99753cd8ac6b8fbe70548a44bc))
* **novice:** Tripo body round five offline: fingers together, armpit helpers, beads laid on the robe, outline both ways ([#289](https://github.com/bolechen/temple-walk/issues/289)) ([274d899](https://github.com/bolechen/temple-walk/commit/274d899386c342ea83d47e31e80cbb9948d67a4f)), closes [#286](https://github.com/bolechen/temple-walk/issues/286)
* **novice:** Tripo 分层小沙弥的离线接入工具 ([#249](https://github.com/bolechen/temple-walk/issues/249)) ([81e4ee2](https://github.com/bolechen/temple-walk/commit/81e4ee29b788fe03fcf6d21374ee7fb6c0ff1395))
* **novice:** Tripo 小沙弥第三轮——裤子和袍摆改用 Blender 骨热自动权重 ([#256](https://github.com/bolechen/temple-walk/issues/256)) ([fa3f86b](https://github.com/bolechen/temple-walk/commit/fa3f86b70685497e3f4660ec68e61046427ed5ac))
* **offering:** show the WeChat 赞赏码 in all four languages ([#243](https://github.com/bolechen/temple-walk/issues/243)) ([26127fd](https://github.com/bolechen/temple-walk/commit/26127fd510027ad3693f19a2edc876722d003b0c))
* **tools:** 全场「绕一圈」普查——清单、出图脚本、守贴图朝向的单测（[#252](https://github.com/bolechen/temple-walk/issues/252)） ([#268](https://github.com/bolechen/temple-walk/issues/268)) ([734c852](https://github.com/bolechen/temple-walk/commit/734c852e657513c5d9bc4a27307417d676900e28))
* **walk:** 全图默认走烘出来的格子（碰撞迁移第 4 步，[#274](https://github.com/bolechen/temple-walk/issues/274)） ([#276](https://github.com/bolechen/temple-walk/issues/276)) ([be27d70](https://github.com/bolechen/temple-walk/commit/be27d701f79f10a403888782ab424496dddbef60))
* **walk:** 首院默认走烘出来的格子，旧 walker 留作回退（[#265](https://github.com/bolechen/temple-walk/issues/265)） ([#266](https://github.com/bolechen/temple-walk/issues/266)) ([d3da81d](https://github.com/bolechen/temple-walk/commit/d3da81dc6a849eebd3e4689f18226ebcdb045e2b))


### Bug Fixes

* **audio:** the wind heard keeps the picture's clock ([#281](https://github.com/bolechen/temple-walk/issues/281)) ([7c86432](https://github.com/bolechen/temple-walk/commit/7c8643237b5e3a9f96de828121aedaa149a9cce0))
* **censer:** 三足的足根长进炉腹，不再悬在腹下 ([#244](https://github.com/bolechen/temple-walk/issues/244)) ([#253](https://github.com/bolechen/temple-walk/issues/253)) ([7ca94ed](https://github.com/bolechen/temple-walk/commit/7ca94ed95042b42fdfd9d1622ac0fef2745ff03b))
* **evidence:** 读到一半断掉的文件整份再读 ([#304](https://github.com/bolechen/temple-walk/issues/304)) ([9410a36](https://github.com/bolechen/temple-walk/commit/9410a36614d2879ebe5106c39c05d77c1b827c23))
* **novice:** Tripo body round six offline: clean cuffs, sleeve light measured, the whole tea measured ([#292](https://github.com/bolechen/temple-walk/issues/292)) ([5b5703c](https://github.com/bolechen/temple-walk/commit/5b5703c0549bfa34c8ce041bad19d7d584ecb899)), closes [#286](https://github.com/bolechen/temple-walk/issues/286)
* **novice:** Tripo 小沙弥第二轮——坐凳袍前片、裤上红白碎块、手的朝向和大小、念珠量 ([#255](https://github.com/bolechen/temple-walk/issues/255)) ([4609bdf](https://github.com/bolechen/temple-walk/commit/4609bdfabaf59a6eb4ee011f0753fa60bc41169d))
* **novice:** 上下台阶的步子——上与下分开、骨盆跟支撑脚、步频放慢 ([#273](https://github.com/bolechen/temple-walk/issues/273)) ([d3a7cde](https://github.com/bolechen/temple-walk/commit/d3a7cde3ee487a8a87b0ff00892332175c9dde44))
* **offering:** tear the offering sheet's edge like every other sheet ([#239](https://github.com/bolechen/temple-walk/issues/239)) ([1f84cbc](https://github.com/bolechen/temple-walk/commit/1f84cbca32cde93ad9225ac0a5a4aa230045ff21))
* **photo:** 举相机默认不虚化，景深改成留影设置里的「虚化」开关 ([#277](https://github.com/bolechen/temple-walk/issues/277)) ([a0ad8f9](https://github.com/bolechen/temple-walk/commit/a0ad8f9b7475a92828e267084d6abd3212d7a41f))
* **photo:** 设置和收起挪到快门两侧；finish 先滚到虚化再真点 ([#303](https://github.com/bolechen/temple-walk/issues/303)) ([346c5b3](https://github.com/bolechen/temple-walk/commit/346c5b3e26d8f18825833fff47803da7f5574b76))
* **plaque:** 匾字恢复为 Yuji Boku，不再套用按字补墨 ([#192](https://github.com/bolechen/temple-walk/issues/192)) ([#241](https://github.com/bolechen/temple-walk/issues/241)) ([8fb533e](https://github.com/bolechen/temple-walk/commit/8fb533ee84c457edcb980b7a57240e1a98d8b8a2))
* **plaque:** 素匾只有正面带字，背面和四边用场景自带木材质 ([#245](https://github.com/bolechen/temple-walk/issues/245)) ([#248](https://github.com/bolechen/temple-walk/issues/248)) ([19e65ae](https://github.com/bolechen/temple-walk/commit/19e65ae1730c9e40c52a42e16821f570f59e3a12))
* **rites:** 吃茶握法放低，倾碗时两手不再遮眼 ([#293](https://github.com/bolechen/temple-walk/issues/293)) ([2d9fb95](https://github.com/bolechen/temple-walk/commit/2d9fb958517d87aa3c8fb850d0046f1227a27722))
* **shaders:** 着色器里不再算出非法数；check 加守卫扫全场 ([#217](https://github.com/bolechen/temple-walk/issues/217)) ([#237](https://github.com/bolechen/temple-walk/issues/237)) ([c7e3dcd](https://github.com/bolechen/temple-walk/commit/c7e3dcd8d4adfa9c0af6b3cd929c79f8f8932fdc))
* **stairs:** 垂带方头落地、照壁字板只留正面、大殿台基背面两道后阶 ([#301](https://github.com/bolechen/temple-walk/issues/301)) ([45d36f2](https://github.com/bolechen/temple-walk/commit/45d36f2388e529990a995e4291a33a5c7844ea35))

## [0.4.0](https://github.com/bolechen/temple-walk/compare/v0.3.0...v0.4.0) (2026-11-18)


### Features

* **censer:** 殿前铁香炉恢复径山寺明万历塔式原形制 ([#217](https://github.com/bolechen/temple-walk/issues/217) 一) ([#230](https://github.com/bolechen/temple-walk/issues/230)) ([ee62767](https://github.com/bolechen/temple-walk/commit/ee6276759028f14cbda380afd8788ad6a7c96951))
* **censer:** 炉里的灰与香、细烟随风、四季时辰 ([#217](https://github.com/bolechen/temple-walk/issues/217) 二) ([#231](https://github.com/bolechen/temple-walk/issues/231)) ([81bb390](https://github.com/bolechen/temple-walk/commit/81bb39075e54da768e8675353196d1b75f412f93))
* **debug:** a console link to the view he has now ([#165](https://github.com/bolechen/temple-walk/issues/165)) ([#166](https://github.com/bolechen/temple-walk/issues/166)) ([cb35228](https://github.com/bolechen/temple-walk/commit/cb35228e0c4abf8087cd00b6c69c0b178d43b53d))
* **drift:** 叶落地停留再淡出、竹叶、铺地积叶、树下更密 ([#219](https://github.com/bolechen/temple-walk/issues/219) 二/二) ([#226](https://github.com/bolechen/temple-walk/issues/226)) ([b97ed33](https://github.com/bolechen/temple-walk/commit/b97ed335e1757204e42dc0f4fb3ecf47bec7c6c7))
* **ending:** 序章结尾后停在远景，朱印帐由玩家翻开 ([#147](https://github.com/bolechen/temple-walk/issues/147)) ([#204](https://github.com/bolechen/temple-walk/issues/204)) ([3261063](https://github.com/bolechen/temple-walk/commit/326106367731ae5b73400b5c1f35c1dddf731a9f))
* **evidence:** 证据二进制放仓库外，仓库只留清单 ([#223](https://github.com/bolechen/temple-walk/issues/223) 一) ([#224](https://github.com/bolechen/temple-walk/issues/224)) ([37dace8](https://github.com/bolechen/temple-walk/commit/37dace8e65fb002ca700089ba609826024f4e852))
* **evidence:** 迁移 docs/t00/evidence 其余全部二进制到数据集（[#223](https://github.com/bolechen/temple-walk/issues/223) 二） ([#228](https://github.com/bolechen/temple-walk/issues/228)) ([317e8de](https://github.com/bolechen/temple-walk/commit/317e8de543955f0b371e7ba464f026c8773c4f07))
* **input:** a faint jump ring on a touch screen ([#160](https://github.com/bolechen/temple-walk/issues/160)) ([47f60da](https://github.com/bolechen/temple-walk/commit/47f60daa0696be468e6e7b5651841b8d57f315b7)), closes [#142](https://github.com/bolechen/temple-walk/issues/142)
* **offering:** show the WeChat 赞赏码 in the Chinese web sheet ([#202](https://github.com/bolechen/temple-walk/issues/202)) ([#227](https://github.com/bolechen/temple-walk/issues/227)) ([3faa87b](https://github.com/bolechen/temple-walk/commit/3faa87bb8d424224d8dc272305367da6b3a5e653))
* **offering:** 大殿一只功德箱，网页版可由此去如是我闻护持页 ([#205](https://github.com/bolechen/temple-walk/issues/205)) ([ccf3f42](https://github.com/bolechen/temple-walk/commit/ccf3f4274c7d72dada53ebeeced5bb0bbd1be2bc))
* **offering:** 投币由他自己的手送到口上，眼睛去箱自己的机位 ([#214](https://github.com/bolechen/temple-walk/issues/214)) ([8049650](https://github.com/bolechen/temple-walk/commit/8049650450e27b15815e62d6ed2c319a90095c4a))
* **structure:** cut each building to the timber of its rank, and give every eave its corner beams ([#133](https://github.com/bolechen/temple-walk/issues/133)) ([017d732](https://github.com/bolechen/temple-walk/commit/017d7322668802b83f7293336bfba6f5f7b503c0))
* **trees:** every branch as thick as what it carries, and the maple as a Japanese maple ([#200](https://github.com/bolechen/temple-walk/issues/200)) ([10e999c](https://github.com/bolechen/temple-walk/commit/10e999cd3e5843e63e50b901b041bf4c8258a1a9))
* **trees:** grow the cryptomerias' wood with three's TreeGenerator ([#199](https://github.com/bolechen/temple-walk/issues/199)) ([3b63974](https://github.com/bolechen/temple-walk/commit/3b639742ae966ad6a012e0869c54fbacde0153ab))
* **ui:** a wide pause menu on wide screens, and a title bar that fits a phone ([#139](https://github.com/bolechen/temple-walk/issues/139)) ([2334da1](https://github.com/bolechen/temple-walk/commit/2334da10d831da4bc283e97f01eac15df9743c77))
* **ui:** the pause menu in four parts, 眼 身 耳 意, the three levels folded under 分开调 ([#195](https://github.com/bolechen/temple-walk/issues/195)) ([b2615f3](https://github.com/bolechen/temple-walk/commit/b2615f398e03700f74f4b4fb1f2ef7bcd68c2399))
* **ui:** touch hints when the hand needs them, the book at once, a walk told fittingly ([#189](https://github.com/bolechen/temple-walk/issues/189)) ([50de0c9](https://github.com/bolechen/temple-walk/commit/50de0c9232ee2fb43fda0a835cd548449140b40a))
* **walk:** 构建时从画出来的网格烘可走格子，CI 报可走面积变化（[#194](https://github.com/bolechen/temple-walk/issues/194) 第 2 步） ([#198](https://github.com/bolechen/temple-walk/issues/198)) ([8c96ef2](https://github.com/bolechen/temple-walk/commit/8c96ef2235dc67300c74f4314486cba93a52ef97))


### Bug Fixes

* **building:** 檐下斗拱按朝向取回地面的光，不再是剪影 ([#229](https://github.com/bolechen/temple-walk/issues/229)) ([c508e26](https://github.com/bolechen/temple-walk/commit/c508e26e3d3b973f75f25afe2c12181c8a17ee4c))
* **censer:** 烟的着色器不再在真显卡上算出 NaN，殿门前不再大片黑屏 ([#217](https://github.com/bolechen/temple-walk/issues/217)) ([#236](https://github.com/bolechen/temple-walk/issues/236)) ([d0da596](https://github.com/bolechen/temple-walk/commit/d0da596db27f4456cfeb19c1c83a667dfc89556b))
* **director:** 摇镜回家的断言按角速度，远景行不被别的提示顶掉 ([#233](https://github.com/bolechen/temple-walk/issues/233)) ([#234](https://github.com/bolechen/temple-walk/issues/234)) ([a3f2d33](https://github.com/bolechen/temple-walk/commit/a3f2d332e54cbc632a230aa04fcbd60acad36b79))
* **drift:** 落叶落花只从枫和银杏来，檐下不落 ([#219](https://github.com/bolechen/temple-walk/issues/219) 一/二) ([#221](https://github.com/bolechen/temple-walk/issues/221)) ([2ddec7a](https://github.com/bolechen/temple-walk/commit/2ddec7a175bbc0502900f5f738984abdf1a1c16d))
* **ending:** 手机息屏后收尾动画不再被跳过 ([#171](https://github.com/bolechen/temple-walk/issues/171)) ([cd0c12f](https://github.com/bolechen/temple-walk/commit/cd0c12f2369bbeaa2b820a5e13f4ef69a0e376f0))
* **input:** a right-click in the middle of a look-drag does not open the browser's menu ([#170](https://github.com/bolechen/temple-walk/issues/170)) ([36cad65](https://github.com/bolechen/temple-walk/commit/36cad65584b1a6b2c0bbfd21acd792c96e727c0a))
* **plaque:** name boards in an even brush regular hand, each character evened to its neighbours' weight ([#207](https://github.com/bolechen/temple-walk/issues/207)) ([bc7a68f](https://github.com/bolechen/temple-walk/commit/bc7a68f31781d8a00d659e080ec42ae1cca0297a))
* **plaque:** 名匾挂在斗拱昂嘴之外，字面不再被木件盖住 ([#213](https://github.com/bolechen/temple-walk/issues/213)) ([#216](https://github.com/bolechen/temple-walk/issues/216)) ([52dc953](https://github.com/bolechen/temple-walk/commit/52dc953db273e73d2c64fb8ab89c612488780ed2))
* **sit:** 静坐的呼吸圈画在地上，字移到底部 ([#201](https://github.com/bolechen/temple-walk/issues/201)) ([367ecb8](https://github.com/bolechen/temple-walk/commit/367ecb8ee5c7d5816df02c5b320e54fc20515166))
* **slip:** the library's slip lies whole on the screen in every language ([#203](https://github.com/bolechen/temple-walk/issues/203)) ([#208](https://github.com/bolechen/temple-walk/issues/208)) ([ea6f2c2](https://github.com/bolechen/temple-walk/commit/ea6f2c20f809c66dfa4d43041a00d6c1ac594db7))
* **test:** the nightly run is green again — pages closed after each scenario, positions read from the page ([#180](https://github.com/bolechen/temple-walk/issues/180)) ([61d1b54](https://github.com/bolechen/temple-walk/commit/61d1b5429793c5824284182ee144af855eed3812))
* **trees:** light each tree's foot from outside, and give its top ring the trunk's own normal ([#178](https://github.com/bolechen/temple-walk/issues/178)) ([5cb8bb2](https://github.com/bolechen/temple-walk/commit/5cb8bb262c7777317a7b5565a58a70889012b452))
* **trees:** make each tree one piece from the ground up, and slim the young cryptomerias ([#159](https://github.com/bolechen/temple-walk/issues/159)) ([995e772](https://github.com/bolechen/temple-walk/commit/995e7729983459b83af1faec20a1450eef583aa7))
* **trees:** the cryptomerias stand in their beds of earth again ([#206](https://github.com/bolechen/temple-walk/issues/206)) ([7523b1b](https://github.com/bolechen/temple-walk/commit/7523b1b0002808aeae6f7e002faf9f811a86a11e))
* **trees:** the trunk meets its foot without a seam, and every tube faces outward ([#197](https://github.com/bolechen/temple-walk/issues/197)) ([15ea861](https://github.com/bolechen/temple-walk/commit/15ea8616e90ffc329119d0f70566d5a626b5ab86))
* **trees:** winter snow up to every trunk, and the young cedars clothed to the top ([#215](https://github.com/bolechen/temple-walk/issues/215)) ([82aa3a4](https://github.com/bolechen/temple-walk/commit/82aa3a4aed5596c6d49598dd387fb26da90942b0))
* **ui:** show WebGL fallback message without retry and preserve language switcher ([#190](https://github.com/bolechen/temple-walk/issues/190)) ([834f6e6](https://github.com/bolechen/temple-walk/commit/834f6e6695f908019a428ddcc0abd4e04e2ed748))
* **ui:** walk-through of every surface — phone layout, pacing, honest wording ([#179](https://github.com/bolechen/temple-walk/issues/179)) ([f22b9ab](https://github.com/bolechen/temple-walk/commit/f22b9aba021b113e82ded90dd3c42fab83b4b5f3))

## [0.3.0](https://github.com/bolechen/temple-walk/compare/v0.2.0...v0.3.0) (2026-11-17)


### Features

* **art:** first art stage, the cheap film look (halation, colour tables, soft shadows, occlusion, layered mist) ([#125](https://github.com/bolechen/temple-walk/issues/125)) ([8e263c4](https://github.com/bolechen/temple-walk/commit/8e263c4ee4c3ad4a87b88494dd17bd1f85cd1981))
* **camera:** the eye goes to a set view for each observance, by a moving shot and never a cut ([#87](https://github.com/bolechen/temple-walk/issues/87)) ([7e681b6](https://github.com/bolechen/temple-walk/commit/7e681b6a57676816a3315c0219ba4ad37f88d97f))
* **ground:** 踩进水洼荡开两道涟漪 ([#86](https://github.com/bolechen/temple-walk/issues/86)) ([b8c3561](https://github.com/bolechen/temple-walk/commit/b8c3561026aeb43e5d30fc141571fb1ce7051ff8))
* **i18n:** 韩文界面与馆藏说明 ([#85](https://github.com/bolechen/temple-walk/issues/85)) ([e16cb7a](https://github.com/bolechen/temple-walk/commit/e16cb7aeb51d3542ec65c1e951c3387a27e3d639))
* **i18n:** 馆藏说明 32 件的日文、英文 ([#83](https://github.com/bolechen/temple-walk/issues/83)) ([13a32b1](https://github.com/bolechen/temple-walk/commit/13a32b10a2f8ecddb615a77777e5d9391ab97874))
* **lingxiao:** climb to the summit pavilion's top storey and look back from its gallery ([#122](https://github.com/bolechen/temple-walk/issues/122)) ([af872b7](https://github.com/bolechen/temple-walk/commit/af872b70a43dcc9e5b485eb6782cc6b8bc4c8157))
* **mood:** the hour follows the clock unless chosen for this visit ([#137](https://github.com/bolechen/temple-walk/issues/137)) ([ad0a125](https://github.com/bolechen/temple-walk/commit/ad0a1257cb34e1e3c56c3a4d078c9d05035c08ba))
* **music:** the prologue's title and the gate's first phrase as one ([#153](https://github.com/bolechen/temple-walk/issues/153)) ([47a0891](https://github.com/bolechen/temple-walk/commit/47a0891dc9034ca34e52ba82fd27984607629a9c))
* **music:** 序章结尾有自己的配乐（终章） ([#145](https://github.com/bolechen/temple-walk/issues/145)) ([f866af3](https://github.com/bolechen/temple-walk/commit/f866af3025dc354ba4df2f18701edcd5964e3441))
* **opening:** 入山后的开场镜头，山门前的序章标题 ([#136](https://github.com/bolechen/temple-walk/issues/136)) ([089a74e](https://github.com/bolechen/temple-walk/commit/089a74e00f4901ffdaa82255f1d5fc5564d32773))
* **structure:** fold the roofs and raise them by the Fashi's share of their span ([#88](https://github.com/bolechen/temple-walk/issues/88)) ([38ff12b](https://github.com/bolechen/temple-walk/commit/38ff12b6a2e97eae0e94ce8ba16d7bb9bf7295ea))
* **structure:** stand the upper storeys over the columns below, on balconies ([#89](https://github.com/bolechen/temple-walk/issues/89)) ([0a88f96](https://github.com/bolechen/temple-walk/commit/0a88f9690315965a8578643804f79115752137aa))
* **structure:** two bracket sets in the middle bay, and bays that narrow outward ([#82](https://github.com/bolechen/temple-walk/issues/82)) ([daa9d27](https://github.com/bolechen/temple-walk/commit/daa9d2761ccd3ee44be60ee3f9cf4eb3d8b06f22))


### Bug Fixes

* **assets:** 补齐授权核对的 22 项条件（署名、字体保留名、第三方许可声明） ([#124](https://github.com/bolechen/temple-walk/issues/124)) ([c6c8128](https://github.com/bolechen/temple-walk/commit/c6c8128a8472f0c445ada89044a713aab19a1af6))
* **audio:** 脚步再降 10 dB，若隐若现 ([#98](https://github.com/bolechen/temple-walk/issues/98)) ([c1abca0](https://github.com/bolechen/temple-walk/commit/c1abca093e753f2a436a531a2ed83ed4dc438c01))
* **backdrop:** no sky below the horizon; far bamboo ends and hill foot closed into the mist ([#126](https://github.com/bolechen/temple-walk/issues/126)) ([a6befb2](https://github.com/bolechen/temple-walk/commit/a6befb24f612dc4d43ca1ad49cb307c05f08cd5d))
* **fonts:** 鸣谢页的句子不再计入笔体、行书、印章字面的字集 ([#127](https://github.com/bolechen/temple-walk/issues/127)) ([d7fdab7](https://github.com/bolechen/temple-walk/commit/d7fdab74941efd7f84a9a0a11e036a235a8d2d19))
* **input:** a tap on the ground finds a way there, not only a straight line ([#157](https://github.com/bolechen/temple-walk/issues/157)) ([3ef6ba5](https://github.com/bolechen/temple-walk/commit/3ef6ba539e9d3f3b7b2bc15e9027fde98be67c83))
* **input:** tap from the main hall's porch walks there instead of back to its door ([#121](https://github.com/bolechen/temple-walk/issues/121)) ([f303f41](https://github.com/bolechen/temple-walk/commit/f303f412f4a52877d9bfeb383d3dc8d58860e324)), closes [#100](https://github.com/bolechen/temple-walk/issues/100)
* **monk:** he can jump up onto a low porch his jump reaches ([#155](https://github.com/bolechen/temple-walk/issues/155)) ([ae7c169](https://github.com/bolechen/temple-walk/commit/ae7c169a680de731aff0332f2f313b199ceec12c))
* **monk:** his shadow stays on the ground when he jumps ([#150](https://github.com/bolechen/temple-walk/issues/150)) ([5b60454](https://github.com/bolechen/temple-walk/commit/5b604540eb2c6a410b191177e7cbcd46d1a9aa88))
* **monk:** 雕刻身体接缝处同位置同权重 ([#123](https://github.com/bolechen/temple-walk/issues/123)) ([f463b15](https://github.com/bolechen/temple-walk/commit/f463b1524fdffcced1b9ee547e76c2133ebcf8ae))
* **site:** the four cushions on the tea house porch can be sat on ([#151](https://github.com/bolechen/temple-walk/issues/151)) ([8489f7f](https://github.com/bolechen/temple-walk/commit/8489f7fb5d1e55cfdac4f1922fc492b1c02ba13d))
* **tools:** stage each GPU run under its own folder and fingerprint the site it drew ([#128](https://github.com/bolechen/temple-walk/issues/128)) ([c3c0252](https://github.com/bolechen/temple-walk/commit/c3c0252f62d0fc08cb010f373f4e729a99342c93)), closes [#72](https://github.com/bolechen/temple-walk/issues/72)

## [0.2.0](https://github.com/bolechen/temple-walk/compare/v0.1.1...v0.2.0) (2026-11-16)


### Features

* a way-marker and a record of the visit; sumeru bases, railings, light at dawn and dusk ([2c05944](https://github.com/bolechen/temple-walk/commit/2c05944aba60466af72446279c04fac2aa5779e9))
* **analytics:** record prologue milestones in Umami ([b4e5ba6](https://github.com/bolechen/temple-walk/commit/b4e5ba6fd3fc353d754b83d05ea2fda77037c0d5))
* **analytics:** track demo visits with dedicated Umami site ([433eedb](https://github.com/bolechen/temple-walk/commit/433eedb3c8bdae5b6e7fef01e3579bca4e1f9d35))
* **audio:** 接入随走访展开的配乐，七印集一个主题 ([#21](https://github.com/bolechen/temple-walk/issues/21)) ([fe1c038](https://github.com/bolechen/temple-walk/commit/fe1c0381e222cb2fe006cd73d643dae5cf1468b7))
* **audio:** 脚步声按脚下发声：干石、雨后湿石、水洼、雪 ([#46](https://github.com/bolechen/temple-walk/issues/46)) ([62a58a5](https://github.com/bolechen/temple-walk/commit/62a58a5347bdc7c3aa8b2b7082671a148d4ba549))
* **bench:** open the dev server and previews straight onto a moment with ?seals=, ?at= and ?play= ([558b613](https://github.com/bolechen/temple-walk/commit/558b613cd5874c9a2348dd77d0011f815877fe13))
* **boards:** paint the name boards after the real temple's ([4f18b57](https://github.com/bolechen/temple-walk/commit/4f18b5737c3f528d2935ba38583d96cc6ff99386))
* **community:** 标题页与歇脚菜单加入内测反馈群入口 ([#63](https://github.com/bolechen/temple-walk/issues/63)) ([924da55](https://github.com/bolechen/temple-walk/commit/924da559f2d189b697f8cff45e9517336209cf7f))
* **dev:** add a ?debug panel for the place's state, switches and costs ([ac1cb19](https://github.com/bolechen/temple-walk/commit/ac1cb19b6d939cbb73702918ab31c58a1d761e3d))
* **dev:** preserve debug poses, add T00 hall cameras and fix doorway sky ([4ad6a9d](https://github.com/bolechen/temple-walk/commit/4ad6a9d80f7187b5ab6141fcb8b8f5b1bbe88b85))
* **dev:** show level completion in the debug panel ([#57](https://github.com/bolechen/temple-walk/issues/57)) ([ee76e38](https://github.com/bolechen/temple-walk/commit/ee76e384f4dda3057a802ab308206d6b628de5df))
* **gallery:** hang seventeen real works in the halls, each with an encyclopedia note ([c9cfac8](https://github.com/bolechen/temple-walk/commit/c9cfac8c20eee74f01798d59ee94f896ccf55c2a))
* **halls:** stand different figures beside the Buddha and in three other halls ([765f2b2](https://github.com/bolechen/temple-walk/commit/765f2b22e6e1def07721db9c7947d8cc8bcd949a))
* **hosting:** publish the demo with a Cloudflare Worker ([3e29fec](https://github.com/bolechen/temple-walk/commit/3e29fec6bafb3a51f4fcf675e9934ab76a5068b0))
* **i18n:** 日文、英文界面，按浏览器语言选择，菜单与标题可切换 ([#81](https://github.com/bolechen/temple-walk/issues/81)) ([44f1f53](https://github.com/bolechen/temple-walk/commit/44f1f533a4e611c4c5482d79caa962dd5c6616b9))
* ink leaves in the halls, one mesh of mist, the novice on a skeleton ([6c72023](https://github.com/bolechen/temple-walk/commit/6c72023d8266c26cb3370c154e254a218c7f116f))
* **interior:** 殿内柱网、梁架与天花按殿外开间和殿的等级重做 ([#27](https://github.com/bolechen/temple-walk/issues/27)) ([13bf215](https://github.com/bolechen/temple-walk/commit/13bf215b661b37804418791490e6c15705f88c49))
* **menu:** a pause menu with the visitor's own settings ([2dd6d37](https://github.com/bolechen/temple-walk/commit/2dd6d372b0ff87deacabb8ba9be77c3abd0f4521))
* **monk:** dress the novice in a sculpted body made from the owner's drawing ([#36](https://github.com/bolechen/temple-walk/issues/36)) ([f61a9ae](https://github.com/bolechen/temple-walk/commit/f61a9ae0beebb94431353568d07e7eb3f0f4bdff))
* **monk:** hop up onto a seat too high to step onto ([#61](https://github.com/bolechen/temple-walk/issues/61)) ([42a1234](https://github.com/bolechen/temple-walk/commit/42a12340965b48a8a01932e8d5f6774167782ce5))
* **monk:** rebuild the novice from the A-pose turnaround as a skinned figure ([#20](https://github.com/bolechen/temple-walk/issues/20)) ([af5afed](https://github.com/bolechen/temple-walk/commit/af5afede33e07766f884bdec3f2eb994be71b45e))
* **monk:** sit on a stool as on a chair, and cross-legged on a cushion ([#54](https://github.com/bolechen/temple-walk/issues/54)) ([99384c2](https://github.com/bolechen/temple-walk/commit/99384c2bfcddb4fb6b6c023a3bf7dd677471474e))
* **movement:** add deliberate hops from low unrailed porches ([636ebd2](https://github.com/bolechen/temple-walk/commit/636ebd27443170292162517141670ce63fde9bd2))
* **movement:** Space jumps ([3e67700](https://github.com/bolechen/temple-walk/commit/3e67700676e20182de846e33c733bdf9bb4e98da))
* **novice:** a bamboo hat on his back, fuller shoulders, deeper folds, fingers ([2880987](https://github.com/bolechen/temple-walk/commit/28809876a35d44c9e73cf76d7f1ea7c19475aca2))
* **photo:** raise the camera on the view as it is; zoom only; a left click takes the picture ([26f20f5](https://github.com/bolechen/temple-walk/commit/26f20f52cba54c1cb700581b43d8ae732561d28a))
* **photo:** simplify landscape photography and remove depth of field ([8e4cb3f](https://github.com/bolechen/temple-walk/commit/8e4cb3f98e60ece11d9ef291a387469618fd92b2))
* **rites:** ring, drink, offer and sit by his own hands; seats everywhere; a close for the prologue; every frame hung ([2df80b9](https://github.com/bolechen/temple-walk/commit/2df80b9b7ab23449e6af6499c2a409396347deda))
* **rites:** 换季后可重播序章结尾，香 5 分钟烧完后可再上，预览与本地默认开调试面板 ([#68](https://github.com/bolechen/temple-walk/issues/68)) ([7134ec0](https://github.com/bolechen/temple-walk/commit/7134ec04a897f947ae8203cd0c68cbe54fd2085c))
* **rites:** 缺印登顶也能收束序章，撞钟一按一下，吃茶后可停留 ([#52](https://github.com/bolechen/temple-walk/issues/52)) ([5b713d8](https://github.com/bolechen/temple-walk/commit/5b713d8933f96f9512769370d03166fcb3189c20))
* **seats:** walk up to a seat before sitting, and sit on every one of them in the rites scenario ([bdd1031](https://github.com/bolechen/temple-walk/commit/bdd1031690eacfe0e9eb0328101541f1153a11fc))
* **sharing:** add game cover and Open Graph metadata ([ee195ad](https://github.com/bolechen/temple-walk/commit/ee195ad4fb2b8b8a0ad1e327cb5a19849f2eb906))
* **snow:** 院中扫出一条路，屋顶下不积雪；PR 每次推送都更新预览 ([#64](https://github.com/bolechen/temple-walk/issues/64)) ([452f14e](https://github.com/bolechen/temple-walk/commit/452f14eaf75df83276a955533327f3e84390a509))
* **sound:** 竹击与墙外鸟叫，新建 T00 效果来源登记并对齐文档 ([#47](https://github.com/bolechen/temple-walk/issues/47)) ([b0c9518](https://github.com/bolechen/temple-walk/commit/b0c95189e1d8b011a78c401958c3dc083c4a4f7a))
* **status:** automate Claude delivery and research Site synchronization ([61b7751](https://github.com/bolechen/temple-walk/commit/61b775188a0e577e3d384129a90cbfabe492b6f9))
* **story:** hang a first leaf in each hall ([c41abe2](https://github.com/bolechen/temple-walk/commit/c41abe2d3c065e900c6e9772904b42cb5958fca5))
* **t00:** a baked light map for the paving, snow on the eaves, banded boards, one cloud of halos, welded vertices ([0e960f0](https://github.com/bolechen/temple-walk/commit/0e960f09442cd56b156175f195663c0ed1ff15e0))
* **t00:** give the gate a doorway, a balcony and bracket sets that read; plain censer, grey balustrade ([dce43b3](https://github.com/bolechen/temple-walk/commit/dce43b31f73c37b2df6d0186b5b8068338e13095))
* **tools:** let tools/inside.cjs --views take a level ([368c73e](https://github.com/bolechen/temple-walk/commit/368c73efd509c969834ec43080216ade56531f05))
* **ui:** add a running hand for what is written on paper ([339e309](https://github.com/bolechen/temple-walk/commit/339e3097b980f6576491baaa18911bc6bac5380a))
* **ui:** draw the interface as ink on paper ([#28](https://github.com/bolechen/temple-walk/issues/28)) ([7136549](https://github.com/bolechen/temple-walk/commit/7136549df6e5099159884815162eb11126d31d8a))
* **ui:** keep two slips on the picture and open the seasons with the book ([#39](https://github.com/bolechen/temple-walk/issues/39)) ([2433aa2](https://github.com/bolechen/temple-walk/commit/2433aa2c58da541e1ccf7891ccb1fdcd45688c79))
* **visit:** come back to where it was left, go back through a seal, and fit a phone's hand ([4196350](https://github.com/bolechen/temple-walk/commit/4196350f0086cf5a6ea7d804c3c05d6be4b62433))
* **well:** 龙井按史料加滴水声、涟漪和渗水，不加流水 ([#41](https://github.com/bolechen/temple-walk/issues/41)) ([53ad93e](https://github.com/bolechen/temple-walk/commit/53ad93e9385e0319299433d79629ae5b916463eb))
* **winter:** 雪地脚印，殿内不再有雪 ([#35](https://github.com/bolechen/temple-walk/issues/35)) ([0db8975](https://github.com/bolechen/temple-walk/commit/0db897504ed7193e344b63a4d334ad56a7cd68c7))
* 拍照定格与纸面取景器，第三下钟声惊鸟，序章结尾一声远钟 ([#59](https://github.com/bolechen/temple-walk/issues/59)) ([6486b89](https://github.com/bolechen/temple-walk/commit/6486b89027c8a88095dd3955c14cdaac16368a48))


### Bug Fixes

* **audio:** 撞钟悠长浑厚，脚步听得见且合拍，檐下滴水只在雨后 ([#53](https://github.com/bolechen/temple-walk/issues/53)) ([727687e](https://github.com/bolechen/temple-walk/commit/727687edc9d1b22c0fd19ed90ae22e21d5b33c99))
* **audio:** 竹林深处的风降约 5 dB，让配乐和脚步听得见 ([#69](https://github.com/bolechen/temple-walk/issues/69)) ([1b271f5](https://github.com/bolechen/temple-walk/commit/1b271f5c528b86a2942da2c3912c94dd1eac77f3))
* **audio:** 脚步声整体降 10 dB，对照小王子压到配乐之下 ([#65](https://github.com/bolechen/temple-walk/issues/65)) ([c4d49b5](https://github.com/bolechen/temple-walk/commit/c4d49b5491a601d1abfd32d43883f237ae4b616e))
* **boards:** give the screen wall its brick panel and stone frame ([a14db44](https://github.com/bolechen/temple-walk/commit/a14db4435c71c5eae291673a843ed38fd6cdc8d2))
* **camera:** stop the following eye from jumping, ease the walk, widen the view ([#32](https://github.com/bolechen/temple-walk/issues/32)) ([a37dd99](https://github.com/bolechen/temple-walk/commit/a37dd9906cd324c1867554b4e388e17738e6d1ff))
* **camera:** stop the view swimming when the mouse moves ([#66](https://github.com/bolechen/temple-walk/issues/66)) ([3485dcc](https://github.com/bolechen/temple-walk/commit/3485dcca62552a998d42eb9f145f5060940cdc46))
* **ci:** keep the statue files in git so a publication does not depend on a CDN that refuses the runners ([388f467](https://github.com/bolechen/temple-walk/commit/388f467535f9475fa78dbc1a1d39e3dad781394a))
* **ci:** let production deployment finish during frequent pushes ([45e5860](https://github.com/bolechen/temple-walk/commit/45e5860bfa9736eece4dc8baa40b69b9c49ecd15))
* **collision:** close the trees to the walker and take them into the sweep ([9f9cebc](https://github.com/bolechen/temple-walk/commit/9f9cebce8af8633dbc219d5678bd328d80c7d8e9))
* **collision:** keep the novice's whole body out of columns, rails, doors, stair cheeks and furniture ([91a6343](https://github.com/bolechen/temple-walk/commit/91a6343eaa4b44d9f19623a23f283583c32ffb3a))
* **collision:** measure his shoes and hem, the tea-table jump and the camera's near plane ([#67](https://github.com/bolechen/temple-walk/issues/67)) ([c49ab55](https://github.com/bolechen/temple-walk/commit/c49ab553ef2ce306657c9a04ff06b7bae4480670))
* **collision:** measure the skinned novice where his bones put him ([5c2106b](https://github.com/bolechen/temple-walk/commit/5c2106b197350795b5baef9ade6a6ad66ea90590))
* **devpose:** 阶边陷入修复；洗砚池按地方志重做；SOURCES 未核出处逐项对原文 ([#49](https://github.com/bolechen/temple-walk/issues/49)) ([440c17c](https://github.com/bolechen/temple-walk/commit/440c17cec111203ffb485bb8ac8791348fb6fed3))
* **guanyin:** keep the following eye out of the eaves and let the porch be hopped down from ([#23](https://github.com/bolechen/temple-walk/issues/23)) ([e117a8a](https://github.com/bolechen/temple-walk/commit/e117a8a0e8eedbfc11e607dcc421f7fc50b1155e))
* **interior:** show the court through a hall's doorway instead of a sheet of white ([74d2b91](https://github.com/bolechen/temple-walk/commit/74d2b917362b7083201d3c894de1fe568df48acb))
* **monk:** keep him on the stair treads and the follow eye on his side ([#42](https://github.com/bolechen/temple-walk/issues/42)) ([a7cec24](https://github.com/bolechen/temple-walk/commit/a7cec2474627d11c7f549a4fece30d957f66353b))
* **monk:** let a shoe over a drop dangle without lowering his pelvis ([#51](https://github.com/bolechen/temple-walk/issues/51)) ([15b0f91](https://github.com/bolechen/temple-walk/commit/15b0f91901de2f5e1ce87a8601665a09eb94bb00))
* **monk:** wear the body built in code until the sculpted one stops tearing ([2a95580](https://github.com/bolechen/temple-walk/commit/2a95580c17c432cad75a74530c4946a80ee1f7d3))
* **movement:** smooth stair poses while keeping feet grounded ([1fa3d2a](https://github.com/bolechen/temple-walk/commit/1fa3d2a58e277bde5ba1ce632b2e95543f567d39))
* **play:** close what the third re-check found in the menu, the jump and the mirror ([b6da920](https://github.com/bolechen/temple-walk/commit/b6da9207bba2b4f197c33b8c9682284849c8733d))
* **portrait:** find the novice in the picture now that the photograph keeps the view ([#30](https://github.com/bolechen/temple-walk/issues/30)) ([5800e10](https://github.com/bolechen/temple-walk/commit/5800e10c03d0b9695301b24bbfb32bc76d0c6576))
* **site:** keep the dragon well's arch below the terrace above it ([#62](https://github.com/bolechen/temple-walk/issues/62)) ([2bdd3f6](https://github.com/bolechen/temple-walk/commit/2bdd3f674a8cfea58282b1f19e29fe4a9bc76508))
* **site:** sit wall caps on their walls and keep the following eye on its terrace ([#40](https://github.com/bolechen/temple-walk/issues/40)) ([56f8b99](https://github.com/bolechen/temple-walk/commit/56f8b99808ed6ab0370fef6cad58de35c170ff53))
* **stairs:** rebuild the stair cheeks as one stone over a closed side ([#33](https://github.com/bolechen/temple-walk/issues/33)) ([861874e](https://github.com/bolechen/temple-walk/commit/861874eec9c7461cf943099087531291ddace0ce))
* **t00:** answer the second re-check — lighter grove and stair, soft light on damp stone, darker sky, a wood behind the hall ([7142498](https://github.com/bolechen/temple-walk/commit/71424981b2ee8ae81187625e9bb59b6baeda9ad7))
* **t00:** bed the main ridge down into the tiles ([2b52618](https://github.com/bolechen/temple-walk/commit/2b52618863f1df7b039141977d121eb5d134c518))
* **t00:** close the enclosure round the towers, turn the under-roof boards to face the ground, raise hills from mist ([0642aa6](https://github.com/bolechen/temple-walk/commit/0642aa6af154a9700c53abe878670ad23f2e8c61))
* **t00:** dress the stairs in their own stone; only standing water mirrors; the mirror never freezes ([dfc9909](https://github.com/bolechen/temple-walk/commit/dfc99097b4ddabca9ebcdfdbb2cf124b2f94329c))
* **t00:** keep mist sheets outside the walls; add a pick hook for unexplained pixels ([31660e4](https://github.com/bolechen/temple-walk/commit/31660e48de6062f8e8bc186ed55a863e38da27d6))
* **t00:** quiet the tiles' sheen so the far end of the gate's lower roof reads as roof ([954f84d](https://github.com/bolechen/temple-walk/commit/954f84d89fba3b03e39610bfa07dc0f44d7f75b6))
* **t00:** run the enclosure wall right up to the gate's end wall ([839f70c](https://github.com/bolechen/temple-walk/commit/839f70cb6c945554ebb499c79d5ced541f3bac0b))
* **t00:** the back of a tiled roof is dark board, not sky-lit tile ([b79ceb5](https://github.com/bolechen/temple-walk/commit/b79ceb5117dddfb5974d129aff0ced8ca6c187ac))
* **test:** serve stylesheets and fonts with their types to the test browser ([#29](https://github.com/bolechen/temple-walk/issues/29)) ([487770d](https://github.com/bolechen/temple-walk/commit/487770d3064e78b8ffa7f2e4df033703cdb3433f))
* **trees:** stand every tree on a foot of roots in a bed of earth ([420fcdc](https://github.com/bolechen/temple-walk/commit/420fcdcbbf1fb92b0562d24c6432bfa38232e2d1))
* **trees:** 殿前一对小柏不再倒伏在铺地上，枝叶长到近地 ([034015a](https://github.com/bolechen/temple-walk/commit/034015ad0f1321a2fb44f9a0367b9dac90468030))
* **ui:** keep the pause menu's paper under its lower rows when the sheet is drawn up ([29e532a](https://github.com/bolechen/temple-walk/commit/29e532ac2d22b194501a477ee7e814208cae4149))
* **well:** 龙井匾挂到拱券正面，不再埋在石头里 ([#45](https://github.com/bolechen/temple-walk/issues/45)) ([f4ff794](https://github.com/bolechen/temple-walk/commit/f4ff7940d312de62bd86c5152768fb2b1ff5c258))


### Performance Improvements

* **quality:** start base Apple chips and hidden cards on the medium tier ([f449c38](https://github.com/bolechen/temple-walk/commit/f449c38fa505056f8ba3f5b7fb4e92183a948b20))
* **trees:** grow the distant cryptomerias with half the boughs ([a6aa5e7](https://github.com/bolechen/temple-walk/commit/a6aa5e7d590ffe727c5ea45a8280b53b907d25a8))

## [0.1.1](https://github.com/bolechen/temple-walk/compare/v0.1.0...v0.1.1) (2026-11-14)


### Bug Fixes

* **movement:** keep the novice above stair treads ([96b6e85](https://github.com/bolechen/temple-walk/commit/96b6e851a612318a752f0a61c098fd13ec4c0f5c))

## 0.1.0 (2026-11-14)

### 初始版本基线

- T00「云径禅寺」可行走原型，包含多级山寺、可进入的殿堂、轻互动、朱印、季节时辰与拍照。
- 首屏加载进度、镜头输入修复、原创概念参考与协作评审资料。
- 以0.1.0接入Release Please，后续变更由Conventional Commits生成版本PR和发布说明。

此条为接入时整理的当前版本基线，不代表全部关卡、美术、素材许可或目标设备性能已验收，也不表示已经存在v0.1.0的GitHub Release。
