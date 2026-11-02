# 珠光小店物语 · Cocos Creator 版

[直接试玩](https://mengpingchen954-ops.github.io/pencil-bead-atelier/)

当前公开版使用 **Cocos Creator 3.8.2** 原生节点、Graphics、Sprite、Label、音频与触控事件实现。完整工程在 [cocos/](cocos/)，用 Dashboard 打开后运行 assets/scenes/Atelier.scene。

已迁移三消采珠、连消与工具、十二槽手串拖动制作、六份委托、十一处清理、修屋与家具升级、三章主线及生活支线、作品图鉴、回忆手账与自动存档。保留原插画、剧情、库存及经营规则。支持鼠标、触屏、键盘和浏览器屏幕阅读器；游戏页面由 Cocos 渲染。

最新优化加入前15关独立目标与障碍布局、四连丝线珠 / 五连花束珠及连锁、纸袋与线结、委托缺料提示、实时目标反馈与定向补给。领奖后回顾客手作台；修屋和家具升级带有新旧房间渐变及奶奶回应。彩铅插画、持续顾客委托与旧进度继续保留。第16关起循环这15套关卡配置。

订单交付已按参考图改为完整结算页：递交礼盒插画、实际手串、金币与信誉、收藏解锁和「继续营业」。回执随奖励保存，刷新不会重复发奖；继续后接原有顾客剧情，保留小满的祝福回应和回头客委托。Creator 的 Page 下拉框可切换到「订单交付」编辑布局。

剧情对话按新参考图采用全屏小店人物场景、底部姓名与对白框、右上「记录 / 跳过」。记录可分页查看已读内容并回到原句；主线、家具支线、小满聊天与回应使用同一套界面。Creator 的 Page「剧情对话」可以编辑布局。人物使用提供的祖孙插画，其他角色暂以真实姓名和对白呈现。

「手账 → 人物故事 · 回忆」新增参考图形式的人物回忆页：奶奶珠盒大图、关系阶段、分页已知经历、相关实际作品与人物切换。奶奶、阿禾及三位顾客按已有剧情和订单进度解锁，未知经历不提前显示；底部制作按钮返回当前顾客委托。Creator 现有14个可编辑页面，包括「人物回忆」和「成品包装」。

成品确认采用参考图的打开礼盒、人物陪伴、花卉祝福卡和双按钮布局。礼盒中显示实际十二颗珠子与吊坠，可返回继续修改；海风订单可选择已解锁的祝福、信纸和丝带。完成包装保留所选方案，使用默认包装则恢复默认三项后交付；仅交付时扣库存和结算，进入已有结算页。普通及回头客订单使用默认祝福。

美术按用户提供的「铅笔2」参考细化：人物柜台纵深插画、俯视透视托盘、独立珠材与接触阴影、斜俯视装修、复古花边和纸张纹理。31 张生产纹理及裁剪来源记录在 Cocos 工程内，`cocos/tools/prepare-pencil-art.py` 重建原24张素材，再依次运行 `prepare-delivery-art.py`、`prepare-dialogue-art.py`、`prepare-memory-art.py`、`prepare-packing-art.py` 并传入对应参考图提取新增插画。标题、结算、对白、经历、选项和按钮均为实时 Cocos 节点。

旧网页「设置 → 导出」的 JSON 可在本版「设置 → 导出 / 导入存档」中继续使用。同一站点的合法旧存档会自动读取；不同浏览器与原生平台之间需手动导入。

## 工程与构建

- [cocos/README.md](cocos/README.md)：运行方式、文件结构、存档迁移与平台说明。
- cocos/build-game.ps1：调用已安装 Creator，使用正式构建配置生成 cocos/build/web-mobile。
- `scripts/package-cocos.ps1 -Project <工程绝对路径>`：同步已构建工程的预期源码与浏览器产物，排除编辑器私人配置，并重建校验清单。
- cocos-web/：已经 Creator 构建并验证的 Web Mobile 产物，GitHub Actions 发布此目录。
- cocos-web/build-manifest.json：工程与产物 SHA-256 清单。CI 检查两者一致，避免修改源文件后仍发布旧构建。Creator 编译在本地安装环境执行，Actions 验证产物后部署。

使用 Node.js 24 执行：

```sh
node --test cocos/tests/*.mjs
node scripts/verify-cocos-build.mjs
```

浏览器验收：设置 `GAME_URL` 后运行 `node scripts/test-cocos-polish.mjs`，逐关操作正式 Cocos 构建并检查订单交付、领奖、失败重试、装修保存与手机 / 桌面布局。`node scripts/test-cocos-delivery.mjs` 专门检查六份订单、回头客、实际作品与奖励、刷新回执、祝福回应和三种宽度。

`node scripts/test-cocos-dialogue.mjs` 检查全部十段剧情、逐句内容、记录分页与返回、触屏继续及跳过、小满聊天和交付回应、存档与三种宽度。

`node scripts/test-cocos-memories.mjs` 检查五位人物、解锁与已知经历、重温、真实收藏作品、触屏切换、回当前委托和三种宽度。

`node scripts/test-cocos-packing.mjs` 检查真实成品、返回修改、触屏包装、海风选择与默认重置、单次结算、刷新和三种宽度。

包含 66 项 Cocos 规则、控制器与场景测试，其中一项直接载入 Creator 正式编译模块，覆盖全部委托、装修、剧情和存档恢复。

Web Mobile 构建可通过静态 HTTP 服务试玩。Android、iOS 和小游戏平台需要在 Creator 中配置相应 SDK 后另行构建，本仓库不包含这些平台安装包。

## 网页原型

原 Three.js 网页源码保留在 src/、public/ 和 tests/，原说明归档在 [docs/网页原型说明.md](docs/网页原型说明.md)。根目录 Vite 开发命令用于该历史原型；Cocos 版不依赖 Three.js 或 WebView。
