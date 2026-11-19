# 外链记录（2026-11-19 起）

目标地址统一用正式站 `https://temple.rushiwowen.co/`（`bolechen.github.io/temple-walk/` 已 404，README 已改，见 PR #257）。
SEO 提醒：知乎/Reddit/X 的用户内容链接多为 nofollow，收益主要在引流量与品牌搜索；GitHub/HF 的链接是可传递的。

## 已上线并核验（七处）

| 位置 | 链接 | 状态 |
|---|---|---|
| GitHub 个人主页 README（`bolechen/bolechen` 仓库） | https://github.com/bolechen | 链接可点（dofollow），commit `1b1b883` |
| GitHub bio | https://github.com/bolechen | 纯文本 URL（bio 不渲染链接），作品牌提法 |
| Hugging Face 数据集卡 | https://huggingface.co/datasets/bolechen/temple-walk-evidence | 卡含游戏站与仓库链接，commit `5625355` |
| 知乎专栏文章 | https://zhuanlan.zhihu.com/p/2106692942509429068 | 3 张实机图 + 2 个链接（游戏站带 `utm_source=zhihu`） |
| Reddit r/threejs | https://www.reddit.com/r/threejs/comments/1xzxzql/beyond_the_mountain_gate_a_quiet_temple_walk/ | markdown 正文，2 个链接（游戏站带 `utm_source=reddit`） |
| X（@avenger） | https://x.com/avenger/status/2123242790184427601 | 2 图 + 正式站链接 |
| 仓库 README 首屏「体验原型（正式站）」 | https://github.com/bolechen/temple-walk#readme | PR #257 已合并（2026-11-19），线上已核验 |

配图全部是正式站实机截图（夏昼照壁 `cam03`、秋暮回望 `lookback`、冬雪首院 `court`，`?shot=1` 无 UI），未做后期添加；文案按 `first-batch.md` 的调子（虚构寺名注明、不说还原径山寺、不说开放世界）。截图存在 `/private/tmp/claude-501/tw-{screen,lookback,snow}.jpg`（临时文件，重出命令见下）。

重出截图：`https://temple.rushiwowen.co/?shot=1&show=<机位>&season=<季>&time=<时>&view=<视角>&body=code`，机位见 `docs/marketing/shots.json`。

## 待办

- ~~**仓库 README 首屏链接**：PR #257 待合并，合并后生效。~~ 已合并上线，见上表。
- **AxiomeCG/awesome-threejs PR #88**（Games 子节）：待维护者合并，合并即上线。fork 分支 `bolechen:awesome-threejs/add-temple-walk`。
- ~~awesome-online-games/awesome-browser-games~~：**已放弃**——它要求先在自己网站发文回链它的仓库才肯合并（交换链接），backlink 规范里属中风险模式，不做。
- **itch.io / IndieDB / Game Jolt 游戏页**：需所有者在 ego lite 人工登录后建页（素材见下节）。
- **重构后首发**（等树/远山/小沙弥定稿、T4 重拍素材）：小红书笔记（rushiwowen_co 号）、Product Hunt。这两处是「一次性首发」，按 #152 的调子不提前发。

## 建页素材（itch / IndieDB / Game Jolt 通用）

英文标题：**Beyond the Mountain Gate · 山门之外**；一句话：A slow, quiet temple walk in your browser — bamboo path, bell, tea, and 16 seasons of light. 玩游戏链接 `https://temple.rushiwowen.co`，源码 `https://github.com/bolechen/temple-walk`，封面用上表三张实机图。
