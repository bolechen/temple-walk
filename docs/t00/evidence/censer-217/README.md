# #217 殿前铁香炉：证据

## `pr2-moods16.jpg`（PR 二：十六种季节时辰）

![十六种季节时辰](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/6fdc9d6a1e3c2a7116a4a3bc637ee071ea69b772/t00/censer-217/pr2-moods16.jpg)

- 每行一季（春、夏、秋、冬），每季四个时辰（晨、昼、昏、夜），每个时辰两张：炉前 3.2 米、9 米。
- 机位：近景 `__look([0.4,1.7,16.2]→[0,1.6,13])`，远景 `__look([0.8,1.7,22]→[0,1.5,13])`；远景里小沙弥站在画面下方。
- 提交 `b82750d`，`q=high`，SwiftShader。
- 仓库里只留这一张拼图。

**六个锁定机位，改前改后逐像素比**（main `ee62767` 对本 PR `b82750d`，差值超过 24/255 才算变了）：

| 机位 | 改变的像素 | 在哪里 |
|---|---|---|
| cam01 | 29 | 几簇 4–5 像素的竖条：飘落的竹叶，现在随风走，位置变了 |
| cam02 | 27 | 同上 |
| cam03 | 0 | — |
| cam04 | 1 | 一个像素 |
| cam05 | 0 | — |
| cam06 | 1585 | 1582 个在炉和烟的范围里，3 个散点 |

## `pr1-ears.jpg`（PR 一：照主创的第三条意见改耳）

![改耳前后](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/6fa8293194cc8a8f753819b99763819ecd47d89c/t00/censer-217/pr1-ears.jpg)

只改了耳：耳面宽约 0.23 米，朝前；外缘比腹最宽处宽出约一掌；从颈根斜出再上翻，顶到下层檐下；耳面回纹的明暗对比加大。上排是改耳前（`9dcb526`），下排是改耳后。这张现在只在数据集里。

## `pr1-form-v2.jpg`（PR 一：形制，照主创的意见改过之后）

![PR 一形制对照](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/cb07d9cd540f83ce222d706eea556bd0e015d347/t00/censer-217/pr1-form-v2.jpg)

这张现在只在数据集里（地址和 SHA-256 见 `MANIFEST.json`），仓库里只留最新的一张拼图。参照照片不进仓库，也不进拼图。

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
