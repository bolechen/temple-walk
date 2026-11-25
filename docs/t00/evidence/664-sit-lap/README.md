# #664 盘坐：先盘腿，手放腿面（接 #666）

穿的是**代码身体**（`app/src/monk.js`）。图在证据库，清单见 `MANIFEST.json`。

## 粗样 1（给所有者先看，未精修）

`rough-1.jpg`：上排设定图 `refs/monk-poses-v6-2026-11-23-sitting.webp` 的盘坐正面、侧面；中排代码身体在空台上从同样两面平视拍的，缩到同一比例；下排两边剪影叠在一起（白＝重合，红＝只有我们，绿＝只有设定图），不含蒲团和斗笠。

- 量法：`node tools/novice-sit-iou.mjs`（`tools/novice-sit-lib.mjs`）。照 #642 量站姿的做法：两边缩到同高（头顶到下摆最低处），底边对齐，按头部中线对中，算交 ÷ 并。设定图的剪影由 `node tools/novice-sit-ref.mjs` 从设定图抠出（去掉蒲团和影子），存在 `refs/monk-v6-sit/`。
- 粗样 1 的数（`rough-1.json`）：正面 0.926，侧面 0.906；d52d825（#666 的头）同一量法是正面 0.873，侧面 0.772。
- 这一版做了什么：盘起的两条腿按骨架实际摆出来（膝向两侧张开、和胯差不多高，小腿在身前交叠），袍子按「布盖在腿上」重新铺；两手叠放在腿面的布上、贴着小腹；袖子后侧垂过肘；坐下时斗笠取下放在右手边。
- 还没做的：袍面的褶、手的细修、下巴的影子、场景里（山顶 `shot-sit`、殿里蒲团）的实拍和数字、单测。

拼图怎么出：

```sh
node tools/novice-views.cjs --code --poses=sit --sides=平正,平右 --size=440,640 --out=tools/out/novice-sit/pair.png
node tools/novice-sit-iou.mjs
python3 tools/novice-sit-collage.py tools/out/novice-sit/pair.png tools/out/novice-sit tools/out/novice-sit/collage.jpg
```
