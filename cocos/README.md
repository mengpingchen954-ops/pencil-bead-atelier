# 珠光小店物语 · Cocos Creator 原生版

完整游戏已迁入 `assets`，使用 **Cocos Creator 3.8.2 / TypeScript / 原生 2D UI**。

## 在 Creator 中运行

1. 用 Dashboard 打开本工程。
2. 等待资源导入，双击 `assets/scenes/Atelier.scene`。
3. 点击顶部「运行 / 预览」。设计尺寸为 720 × 1280，电脑横屏会保留侧边留白。

界面节点由 `assets/scripts/AtelierGame.ts` 在场景启动时生成。运行时可在层级中查看 Canvas、页面、棋盘和弹窗。编辑模式下的启动场景只有入口节点；修改玩法与页面请编辑对应脚本。

## 铅笔2 美术细化

本版使用用户提供的 `E:/Game/手串/铅笔2` 参考：人物与柜台的纵深插画、略俯视的前宽后窄关系、奶油纸纹、金色花边，以及六色彩铅珠材与三种吊坠。手作台为前宽后窄的透视托盘，珠子、空槽、接触阴影、拖动落点和投珠动画独立运行；装修房间改为斜俯视，墙、地板、窗户和家具仍随真实经营进度变化。

已选取并整理 24 张小尺寸纹理，原始参考图不复制进发布包。`assets/resources/art/pencil-sources.json` 记录来源、裁剪坐标与处理方式。用 Pillow 运行 `python tools/prepare-pencil-art.py E:/Game/手串/铅笔2` 可重新提取；该工具不修改参考原图。界面中的数值、委托、按钮与棋盘均由游戏实时绘制。

## 已迁移内容

- 8 × 8 三消棋盘、三连与 2 × 2 方块、连消下落、交换回位、提示、小木槌、十字与重排。
- 十二槽手串、随机空槽弹射、连续放珠、触屏 / 鼠标拖动换位、替换、取下、撤销、三种吊坠、参考配色、包装交付与自由设计。
- 六份定制委托、库存、金币、口碑、体力与三分钟恢复。
- 原始阿禾 / 奶奶插画、六种彩铅珠材、手作与消除音效。
- 十一处免费清理、擦拭、墙面 / 地板 / 窗户修复、三件家具各两级升级、原生节点绘制的房间变化。
- 三章七段主线、三段家具支线、逐句对白、回忆重温、相关记录和作品图鉴。
- 本地自动存档、旧存档字段校验、声音 / 减少动态效果、重置确认、存档 JSON 导入导出。

不依赖原网页在线地址、Three.js、HTML 页面或 WebView，断网后本地预览也可以运行。浏览器版仍需要通过 HTTP 服务加载资源。

## 存档迁移

原网页「设置 → 导出」得到的 JSON 可粘贴进本版「设置 → 导出 / 导入存档」。导入前会显示进度概况并要求在游戏中确认覆盖。网页与 Cocos 版使用同一套存档校验及规则；不同站点、浏览器和原生应用之间不会自动共享 localStorage。

## 构建与验证

安装 Node.js 24 后执行 `node --test tests/*.mjs`，验证实际迁移后的 TypeScript 规则模块。附带 20 项库存、三消、订单、装修、存档和剧情测试，以及一项直接运行 Creator 正式构建代码的完整经营流程测试；正式构建尚未生成时只跳过后一项。

在 Windows PowerShell 执行 `./build-game.ps1`。它使用项目版本对应的已安装 Creator 和 `buildConfig_web-mobile.json`，等待实际构建日志结束，再检查脚本错误。也可用 `-Creator` 指定编辑器路径。正式产物位于 `build/web-mobile`。Creator 内置「构建发布」同样可选择 Web Mobile、启动场景 Atelier、竖屏构建。

原生 Android / iOS / 微信小游戏需要在 Creator 中选择相应平台并准备各自 SDK；本次交付验证的是 Creator 的 Web Mobile 正式构建，未生成这些平台的安装包。

## 文件分工

| 路径 | 内容 |
|---|---|
| `assets/scenes/Atelier.scene` | 游戏入口，已绑定原生组件 |
| `assets/scripts/AtelierGame.ts` | Cocos 页面、输入、动画、音频与存档适配 |
| `assets/scripts/model.ts` | 与网页一致的玩法、库存与装修规则 |
| `assets/scripts/content.ts` | 完整委托、剧情、家具与珠材数据 |
| `assets/scripts/story.ts` | 剧情解锁、记录与重温规则 |
| `assets/resources/art` | 原始插画、来源说明和原生图标 |
| `assets/resources/beads` | 从原版绘图函数生成的六种透明珠材贴图 |
| `assets/resources/audio` | 本地音效 |
| `assets/resources/story-media.json` | 可选剧情视频映射 |

原游戏没有实际剧情视频，全部视频映射的 `src` 为空，本版保留完整文字。后续可把 MP4 放入 `assets/resources/videos/`，将对应 `src` 填成 `videos/文件名.mp4`；`captions` 可填写 `[{"start":0,"end":3,"text":"字幕"}]`。使用 Cocos VideoPlayer，播放失败自动切回文字，后台自动暂停。视频接入属于预留能力，当前未用真实影片测试。
