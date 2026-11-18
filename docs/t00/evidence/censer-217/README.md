# #217 殿前铁香炉：证据

## `pr1-form-v2.jpg`（PR 一：形制，照主创的意见改过之后）

![PR 一形制对照](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/cb07d9cd540f83ce222d706eea556bd0e015d347/t00/censer-217/pr1-form-v2.jpg)

仓库里只留这一张拼图（不到 1 MB）；同一张也传到了数据集，地址和 SHA-256 见 `MANIFEST.json`。参照照片不进仓库，也不进拼图。

- **左栏**：照片里看得到的，和看不到时按什么推的。
- **第一行**：改后（PR 一 `dc48989`）的正面、侧面、俯视。
- **第二行**：改前（main `b97ed33`）的同三张，机位一样。
- **第三、四行**：cam06 和「院中望大殿」（`?cam=0,17.5,0,0.16`），改前改后并排。
- 季节时辰都是夏昼，`q=high`，SwiftShader 软件渲染，没用 T4。

六个锁定机位逐像素比过（差值超过 24/255 才算变了；比的是第一版形制 `a08f9ee` 和 main `461bec5`，形改后没有重比）：

| 机位 | 改变的像素 | 在哪里 |
|---|---|---|
| cam01–cam05 | 0 | — |
| cam06 | 2770 | 只在炉身外框里 |
| 院中 9 m（`?cam=0,21,0,0.1`） | 8740 | 只在炉身外框里 |
| 院中 4.5 m（`?cam=0,17.5,0,0.16`） | 21084 | 只在炉身外框里 |

**重出**：两个提交各自 `pnpm build` 出 `dist/`，用 `?shot=1&show=camNN&season=summer&time=day&view=first&q=high` 截 960×540。正、侧、俯三张是先开 `?shot=1&cam=0,20,0,0&q=high`，再调 `__look`：
- 正：`[0,1.6,18.2]→[0,1.5,13]`
- 侧：`[5.2,1.6,13]→[0,1.5,13]`
- 俯：`[0.01,7.5,13.8]→[0,0.8,13]`

**参照**：
- 照片：维基共享资源 File:Ming Censer of Jingshan Temple 2023.jpg（CatOnMars 摄，CC BY-SA 4.0）。
- 尺寸：杭州市文保中心云端档案 http://www.singdo.org/wenbao/luelan_disp.php?luelan_id=419
- 葫芦顶的旁证：维基共享资源 File:华严寺大雄宝殿月台上明万历二十二年铁焚香炉.jpg（Patrick20242023 摄，CC BY-SA 4.0）。那件的顶是驮兽宝珠，不是葫芦，见 SOURCES.md。
