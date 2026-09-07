# 第三方依赖

运行时三维引擎使用 [Three.js](https://threejs.org/)，MIT license，版权声明保存在 `three-LICENSE.txt`。离线文件内也保留打包工具生成的许可注释。

构建工具 Vite / esbuild 仅用于开发和打包，最终离线文件无需安装它们。准确依赖版本见项目 `package-lock.json`。

角色与世界观文本取自用户工作区已有设计。四张美术图集由内置 imagegen 生成，提示词与适配记录见 `art-prompts.md`、`art-canon-3.1.md` 和 `art-canon-3.2.md`。潜行模型通过 Blender 脚本参照立绘制作，包含可编辑源文件和游戏用 GLB；其余模型、图形、音效和乐曲由程序生成。

263 段中文对白和旁白通过第三方 [edge-tts 客户端](https://github.com/rany2/edge-tts)访问 Microsoft Edge Read Aloud 在线神经语音服务生成。成品为合成 MP3，游戏与独立 HTML 播放本地音频；生成客户端不是微软官方 SDK，也不随游戏作为运行依赖。选声配置、来源记录及生成方式见 `story-and-voice.md` 和 `public/voices/manifest.json`。
