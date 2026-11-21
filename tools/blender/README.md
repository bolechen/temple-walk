# 无界面 Blender（#514）

本项目修有机模型（佛像的手、脸）用的是 Blender，不开界面，全部由脚本驱动。

## 装什么

装 Blender 的 Python 模块 `bpy`，版本钉在 5.3.0：

```sh
pip install bpy==5.3.0        # 来自 PyPI，约 400 MB；要求 Python 3.13（模块只为这个版本构建）
python3 tools/blender/version.py   # 打印「Blender 5.3.0 (bpy module, …)」，版本不对就退出 1
```

- `bpy` 就是 Blender 本身，只是没有窗口。脚本里用 `import bpy`，和 `blender -b --python <script>` 跑同样的代码。
- 它从 PyPI 下载，云端容器的包管理白名单本来就放行，不用另加下载地址。
- Blender 的二进制和这个模块都不进 git。

如果哪天一定要用 `blender` 命令（比如要跑只有完整程序才带的插件）：

- 下载地址是 download.blender.org，要按环境工具的流程请所有者批，不能绕开；
- 版本也钉在 5.3.0。

## 用它的脚本

- `tools/t05-statue/repair.py`：佛像网格的编辑操作（#463、#370）。
- `tools/t05-statue/views.py`、`bake.py`：出图、烘法线。
- `tools/blender/`：#514 试点的脚本，见下方各文件开头的说明。

## 可重跑

同一个输入、同一份参数，输出应当逐字节一致。会让结果不一致的地方，在各脚本开头写明。
