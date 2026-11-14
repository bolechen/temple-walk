# 楼梯动作平滑：依据、取舍与验证

## 问题与实现

此前为避免穿模，角色根部直接使用逐级踏面高度。普通踏步约0.18米，因此躯干也在某一帧升高整级；衣摆接触前一级踏面时还会抬起整个上身。单独做根部插值又会把角色拉回石阶内部。

本轮把三个层次分开：

1. **支撑与碰撞**：根部仍留在可见踏面上，踏步外挑、平台衔接和楼梯碰撞不回退。
2. **躯干与镜头**：躯干在世界高度上跟随连续路径，用按dt计算的指数阻尼；镜头继续独立平滑。楼梯上的普通步速为1.25米/秒，快步上限1.6米/秒，平地操作不变。躯干步态起伏降至8毫米，摆腿节奏按行走距离和踏面深度调整。
3. **接触修正**：物理根部升降时，从各脚的局部偏移中补偿同一高度差，避免重复抬脚。衣摆只在实际接触踏面的局部收起，不再由一个前缘顶点带着上身跳。裤腿连接平滑躯干和各自支撑的脚，避免衣摆下露出缝隙。

真实下跳时暂停贴地修正，沿既有抛物线起落；坐姿保留原来的折腿逻辑。殿前无栏低台下跳和普通上楼是不同状态，不能用楼梯平滑把跳跃重新吸回地面。

现有小沙弥是程序建模的分组网格，不是完整骨骼角色。本轮采用接触目标、骨盆补偿和局部网格修正的分层思路，没有引入Unity/Unreal运行时或声称已实现完整两骨IK。将来更换骨骼角色时，可保留地面查询和状态边界，替换腿部求解与动画曲线。

## 查阅的官方资料

- [Epic：Foot Placement Pelvis Settings](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/FootPlacementPelvisSettings?application_version=5.2)：区分角色移动补偿、骨盆插值和最大偏移。这里借鉴分层原则，不依赖该实验插件。
- [Epic：IK Setups](https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-setups?application_version=4.27)：以地面检测结果设置足部接触目标，再修正动画。
- [Unity：OnAnimatorIK](https://docs.unity.com/en-us/engine/6000.6/script-reference/unityengine/monobehaviour/onanimatorik)：分别设置目标和权重；其Humanoid限制不适用于当前Three.js模型，不能直接照搬组件。
- [Godot：CharacterBody3D](https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html)：地面吸附与主动起跳分开，向上跳跃时不应用地面吸附。

## 验证范围

`stair-smoothing.test.mjs`按固定步长回放上下楼：旧实现6项全部失败，单帧躯干突变约0.18米；新实现60Hz约0.013米、30Hz约0.025米、20Hz约0.038米。它衡量相同输入下的动画位移，不是目标设备FPS成绩。

另有主动下跳不被吸回地面的回归。`stairs.test.mjs`继续检查鞋子与整件袍子的实际顶点不进入踏面，覆盖转向和坐姿。浏览器`stairs`场景使用正常键盘上下楼，记录物理支撑和躯干高度，并限制整级跳变；`drop`和`boot`回归下跳及空格入场。最终通过情况随PR和运行报告记录，不把文档提案当作已完成的设备验收。
