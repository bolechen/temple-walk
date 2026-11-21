# #478 御碑亭：台阶、亭内连通、跳台

图在证据库，清单 `MANIFEST.json` 钉在提交 957e08be1b32。软件渲染（`?q=low`，夏天白昼，960×540），左改前（main `6246673` 的构建）右改后。拼图 `collage-478.jpg`；单张在证据库（`node tools/evidence.mjs pull docs/t00/evidence/478-stele`）。

| 名 | `?cam=x,z,yaw,pitch` |
|---|---|
| steps-front | -6.5,50.5,-π/2,0.12（第一人称，从路上看正面） |
| steps-side | -8.5,54.5,-0.67,0.15（斜侧） |
| steps-top | -7.0,50.5,-π/2,0.55（抬头看） |
| stele-third | `view=third`，-11.2,50.5,-π/2,0.2（第三人称站在碑前；改前图里那一点被挡住，镜头落在别处，不可比） |

## 查到的

- 原因一：下层 `steps: 0`，台基 0.45 m 高于一步（0.255 m），正面没有路上去。`plan.test` 新加的「亭内碑前」一点，改前旧 walker 和格子 walker 都走不到（已核）。
- 原因二，写的路：写出来的平面只在 `steps` 为真时才登记台沿（`walk.drops`），`steps: 0` 一条也没有，所以旧 walker 下空格永远跳不上去。
- 跳不上去，格子 walker（页面默认）：我在 main 的构建上从西、北、南三面站到台沿外 0.5–1 m 面朝台基，`findClimb` 都找得到路（台基 0.45 m，在 `REACH`＋`CLEARANCE`＝0.479 m 以内）；东面（正面）没有找到台沿。我没有查清东面为什么没有，补了台阶之后那一面是台阶，没有再追。所有者在哪一面试的我不知道，若在三面之一试而跳不上，我没有复现，需要他的地址。
- 补了什么：`steps: 2.6, walkAll: true`（三级，有垂带，照路边歇脚亭）；`walkAll` 在旧 walker 下不留台基外圈的实体、也不登记台沿，所以在 `site.js` 补回外圈实体、台沿旁的两小块、和碑脚（1.5×0.9 m，眼睛挡到碑顶 `eyeTop`）。

## 测试

`plan.test.mjs` 的 places 加「碑前」一点；`stele-478.test.mjs`：正面一路踏上去每级不高过一步；西、北、南三面按空格找得到路（只在格子 walker 下测，旧 walker 不写这些台沿）。

## 验收

- 过：`check`、`typecheck`、`pnpm test`（865）、`test:grid`（865）、`edges`、`edges:grid`、`nearplane`、`nearplane:grid`（均在 `c46f308`）。`edges` 中途出过 1–2 cm 的台阶侧沿超限，补了台沿旁两块后过。
- walk-diff：未跑（CI 跑），新开的地待 CI 的摘要；预期为台阶和亭内约 25 m²，亭内原先不可达。
- e2e：未在本地跑 `jump` 场景（交给 CI 的 quick 和需要时手动的 Run workflow）；本地用单测按 `findClimb` 验了跳台，不是真实按键。
- 美术：待美术审图二（碑面现在是没有字的石料，要不要刻字请它给意见，这次不做，按 #478 的评论交 #460 的会话）。
