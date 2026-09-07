# 潜行 · Blender 建模样件

这次实际使用本机 Blender 5.2.1 LTS 制作了潜行的三维模型，并接入战斗与标题页的「模型样件」检视。参照的是 `public/art/recruits.png` 右侧已有立绘：短黑发、银色合金装甲、深色贴身内衬、青色胸部灯条和右前臂发射器。

这是**看着立绘编写建模规则、再渲染检查与修改**的结果。没有从单张图片恢复真实深度，也没有调用图片转三维服务。它能说明脚本可以做出更细的可编辑模型，但脸型、头发和装甲造型仍是风格化样件，不能视为立绘的精确还原。

## 可以直接打开的文件

| 文件 | 用途 |
| --- | --- |
| `assets_3d/qianxing/qianxing-reference-study.blend` | 可继续编辑的 Blender 原件，包含模型、材质、修改器、分层枢轴、比例骨架参考、打包的立绘与摄影棚灯光 |
| `public/models/qianxing.glb` | 游戏实际加载的模型；无外部贴图或网络素材依赖 |
| `assets_3d/qianxing/qianxing-beauty.png` | 全身四分之三角度展示 |
| `assets_3d/qianxing/qianxing-front.png` | 正面检查 |
| `assets_3d/qianxing/qianxing-side.png` | 侧面检查 |
| `assets_3d/qianxing/qianxing-back.png` | 背面检查 |
| `assets_3d/qianxing/qianxing-face.png` | 脸部近景，可直观看到当前精度的上限 |
| `assets_3d/blender/build_qianxing.py` | 可重复生成上述文件的建模脚本 |
| `scripts/model-probe.mjs` | 实际解析 GLB、检查枢轴、网格数值和场地朝向的验证工具 |

## 模型具体做了什么

- 身体内衬与脸部使用连续截面网格；脸部网格包含颧骨、眉弓、眼窝与鼻梁的形状，再加眼睑、虹膜、嘴唇和耳廓。
- 胸甲、肩甲、大腿甲、护胫、背甲与护臂都有自己的轮廓、厚度、倒角与法线处理。它们不是把几个立方体换成更高的细分数。
- 头发由带后颈轮廓的发帽、弯曲并收尖的发片及细线组成。手有独立手指、拇指与关节；前臂发射器有套筒、开口与透镜。
- 原件保留曲面细分、厚度和倒角修改器，分别使用皮肤、头发、织物、橡胶、金属和发光材质。没有烘焙纹理、毛发模拟和高精度皮肤细节。
- 游戏使用 `head`、`rightArm`、`leftArm` 三个可旋转枢轴，沿用待机、举臂、格挡与攻击动作。原件另有比例骨架参考；**当前没有蒙皮权重、走路动画、肘膝关节链或面部表情绑定**。

原件中 160 个网格对象、8,089 个编辑顶点、16 种角色材质。曲线转成网格后，实际游戏 GLB 为 **107,404 个三角形、242 个网格、247 个节点、2,139,984 字节（约 2.04 MiB）**；`node scripts/model-probe.mjs` 可复核这些数字。不要把不含曲线的约 6.4 万三角形当成最终游戏面数。当前样件以可编辑性和对比观察为主，尚未做材质合批或细节层级优化。

## 游戏中的检查方法

标题页进入「模型样件」，拖动可水平转满 360°，滚轮可缩放，重置镜头可回到完整人像。模型独自位于场地中央；退出后恢复先前战场显示与镜头。把潜行选入队伍，战斗中也会使用同一个 GLB；加载失败时保留原有基础外观。

正常战斗中，BOSS 位于三个站位的几何中心，角色面朝 BOSS，敌方按攻击目标转身。水平旋转没有角度限制，垂直角度限制在地面以上。游木切换医生与船长时会换外套、帽子和持械；补丁 Z 的收录姿态会扩大盾牌透镜，背后时钟持续转动。两个角色仍采用现有场景美术规格，并未宣称也完成了同等精度的 Blender 模型。

## 重建与验证

在项目目录执行：

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python 'assets_3d/blender/build_qianxing.py'
node scripts/model-probe.mjs
```

脚本先保存保留修改器的原件，再导出 GLB，最后使用 Cycles 渲染五个角度。`-- --no-render` 可只更新模型。脚本只写本项目的样件文件；无需改系统文件关联或打开 Blender 窗口。

使用的功能可在 Blender 官方的[后台命令行文档](https://docs.blender.org/manual/en/latest/advanced/command_line/index.html)、[glTF 导出说明](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html)与[Python 导出接口](https://docs.blender.org/api/main/bpy.ops.export_scene.html)中核对。
