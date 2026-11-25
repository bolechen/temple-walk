# #728 美术初审的必须改：纸条上的碑文整句用楷书（证据）

头 `18a8feb`。图在证据库，钉在 cc1f3b8：https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/cc1f3b8bc4b17d0cdecaef9fc02e8d7912eebaf5/t05/728-slip 。手机 360×640（deviceScaleFactor 2，触屏），软件渲染，中文，冬昼。页上的记号预先写进 `yunjing.levels.v1`，进场后：

- `slip-whole-360x640.png`：从歇脚菜单「这一页」打开的整页。抄下的「觀其寶殿崔嵬，儼居七佛」整句是 Yunjing Kai（之前觀寶崔嵬儼居是楷书回退、其殿七佛是行书）；旁边小字「元大德七年碑」，下面那句话按短语一列一句。
- `slip-note-360x640.png`：只有观察页时，「记下」后的那页：九间， / 单檐庑殿， / 青灰瓦。 / 台基比人高。 四列，不再把「单檐」「青灰瓦」拆开。

e2e `t05-page` 断言了：碑文那句的字体是 Yunjing Kai，观察那句和旁边小字按短语分列。`node tools/mobile-audit.cjs --level=t05`：0 问题。
