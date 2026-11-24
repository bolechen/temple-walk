# 画作卡片上的日本指定（#656）

一张拼图：[`piece-rank.jpg`](piece-rank.jpg)（218 KB）。上排是手机两种尺寸（竖屏、360 宽），下面三张是桌面：中文、日文、英文。

看什么：

- 资料区最后一行是**单列**的「等级　重要文化财／国宝」，不再拼在「收藏」行末尾（原来印成「收藏　东京国立博物馆　重要文化财」，#656 的起因）；
- 资料区下面一行 12 px 小注说明这是什么等级，四种语言各自成句；
- 没有日本指定的作品（如 Tiger）不出现这一行——e2e `lang` 场景里断言。

重出（都不进仓库，`tools/out/` 是 git 忽略的）：

```
node tools/mobile-audit.cjs tools/out/piece-rank --only=piece      # 两种手机尺寸各一张
node tools/mobile-audit.cjs tools/out/piece-rank --only=piece --shapes=small,large
# 桌面与日英韩：任何一页控制台执行 window.__work("wuzhun-shijia-baodian") 后截图
```

手机四种尺寸的走查（`--only=piece`，upright/side/small/large）报「nothing a phone would mind」。
