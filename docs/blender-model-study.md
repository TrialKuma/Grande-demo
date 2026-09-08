# Blender 建模记录 · 3.8

3.8 已把五处场景的完整地坪、主要建筑和远景轮廓重新制作，十名正式 BOSS 也换用完整全身模型。每名有 Blender 导出的待机、攻击、受击三段分件关节动画，总计 30 段；不是只有外接饰件，也不是柔性蒙皮动画。游戏代码负责动作触发、播放速度、核心状态、镜头与特效配合。

先使用内置 imagegen 生成五张概念图，再在 Blender 中按构图与材质关系拆件搭建。每处一个主要地标，省略写实纹理与密集远景城市。原图在 `public/concepts/`，完整场景原件在 `assets_3d/worlds/`，BOSS 原件在 `assets_3d/boss-cast/`。标题底部「场景与 BOSS 展示」可以查看场景、模型、动作与原始概念图。详见 [3.8 更新说明](update-3.8.md) 与 [概念图提示词](场景概念图提示词.md)。

## 3.7 阶段记录

以下是 3.7 阶段记录。当时实际使用本机 **Blender 5.2.1 LTS** 重建潜行，另制作了 20 个可复用的地景与 BOSS 细节模块。游戏会加载导出的 GLB；原件保留可编辑网格和修改器。

这里采用的是看着立绘设计轮廓、编写建模规则、渲染检查后修改的流程。没有从单张图片恢复真实深度，也没有调用图片转三维服务。

## 潜行改了什么

参照仍是 `public/art/recruits.png` 右半边：短黑发、银色装甲、深色内衬、胸部青色灯条、颞侧植入件和右前臂发射器。

- 胸甲改为有内缩边缘和厚度的曲面，增加斜向叠甲、胸前嵌槽、颈部护甲、腰侧液压杆和软质关节。
- 肩甲使用沿关节包覆的连续曲面，分成三层。护臂、后腰、腿后装甲、脚跟减震件和前臂发射器补齐了侧面与背面结构。
- 头部重建眉弓、眼窝、颧骨、下颌和鼻部连续表面，调整眼睑、眉毛与嘴部。头发改成贴合头皮的底层和长短不一的偏分发束。
- 游戏中的「模型样件 · 潜行」使用中性灯光和独立展示台，可以旋转检查；退出后恢复原战场、镜头与灯光。

脸仍是风格化造型，和立绘的真实人脸有明显差距。当前没有皮肤纹理烘焙、精细毛发、面部表情或蒙皮权重。动作仍由 `head`、`rightArm`、`leftArm` 三个刚性枢轴完成；细化模型没有同时升级成完整的人体动作系统。

## 可以直接查看的文件

| 文件 | 内容 |
| --- | --- |
| `assets_3d/qianxing/qianxing-reference-study.blend` | 潜行可编辑原件，含材质、修改器、立绘与摄影棚 |
| `public/models/qianxing.glb` | 战斗和模型检视实际使用的潜行模型 |
| `assets_3d/qianxing/qianxing-beauty.png` | 新版全身三分之四角度 |
| `assets_3d/qianxing/qianxing-front.png` | 新版正面 |
| `assets_3d/qianxing/qianxing-side.png` | 新版侧面 |
| `assets_3d/qianxing/qianxing-back.png` | 新版背面 |
| `assets_3d/qianxing/qianxing-face.png` | 新版脸部近景，能直接看到当前精度的边界 |
| `assets_3d/qianxing/before-v37/qianxing-beauty.png` | 上一版全身图，供前后比较 |
| `assets_3d/qianxing/before-v37/qianxing-face.png` | 上一版脸部近景 |
| `assets_3d/detail-kit/grande-detail-kit.blend` | 20 个地景与敌方细节模块的可编辑原件 |
| `assets_3d/detail-kit/detail-kit-gallery.png` | 模块总览渲染 |
| `public/models/grande-detail-kit.glb` | 游戏实际使用的模块库 |

## 五套场景与敌方细节

| 场景 | 新制作的结构 |
| --- | --- |
| 雾蚀遗迹 | 真正分块的石拱、凹槽柱、台缘石板、晶簇；细节载入后替换旧六角堆叠柱 |
| 风暴栈桥 | 带绝缘裙边、铜线圈和电极的继电塔，弯管与台缘 |
| 缄默书庭／归零天井 | 分层书架、独立书脊、打开的曲面书页和阅读台 |
| 下层水闸／熔炉区 | 检修泵机、法兰弯管、阀轮、压力窗 |
| 星轨观测台 | 带经线与刻度的星仪、石柱、阅读台与嵌线台缘 |

十名 BOSS 各增加一组与主题相符的组件：魔晶巨人的核心护圈、折镜刃卫的镜面胸饰、孢冠司祭的菌褶冠、雷脊守卫的涡轮、缄页织者的书页环、水闸监守的阀门、熔炉搬运者的炉栅、星轨测绘仪的刻度盘、缄令执行官的面具、归零之核的镂空冠架。

这些是接在原动作结构上的精细组件，保留各 BOSS 原有轮廓和战斗表现；并非十个 BOSS 都重新完成了全身雕刻。组件与各自的身体、头部或核心枢轴一起移动，材质独立，因此一名敌人受击闪白不会让场景或其他敌人一起闪白。

三种教学敌人另有独立的小型外观：四足侦察机、持盾旧哨卫、立式充能导管。它们沿用同一材质风格，也能使用现有攻击与受击动作。

## 实际游戏资产统计

| 资产 | 三角形 | 网格批次 | GLB 大小 |
| --- | ---: | ---: | ---: |
| 潜行 3.7 | 152,262 | 32 | 3,535,060 字节 |
| 20 模块细节库 | 151,610 | 81 | 约 3.67 MB |

潜行上一版是 107,404 个三角形、242 个网格。此次增加曲面与结构的同时，导出时按材质和动作枢轴合并为 32 个网格；Blender 原件保留独立部件，方便继续改造型。两个 GLB 都自带材质，不需要外部图片或网络纹理。细节库只实例化当前场景所需模块，并非把所有模块同时摆进战场。

## 重建与检查

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python 'assets_3d/blender/build_qianxing.py'
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python 'assets_3d/blender/build_detail_kit.py'
node scripts/model-probe.mjs
node --test tests/models-v37.test.js
```

`qianxing_refinement.py` 定义潜行的细化表面；`export_batched.py` 负责保留原件、合并游戏网格。每个生成目录中的 `manifest.json` 记录本次导出的实际数字。

已用实际 GLB 检查模块完整性、网格有限值、动作父节点、场景重复挂载和材质隔离，并在独立游戏页面查看五套场景、潜行模型正背面、施法、受击及最终 BOSS。离线包由项目的统一构建流程内嵌两个 GLB。
