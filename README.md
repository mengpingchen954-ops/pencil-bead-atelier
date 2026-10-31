# 珠光小店物语 · Cocos Creator 版

[直接试玩](https://mengpingchen954-ops.github.io/pencil-bead-atelier/)

当前公开版使用 **Cocos Creator 3.8.2** 原生节点、Graphics、Sprite、Label、音频与触控事件实现。完整工程在 [cocos/](cocos/)，用 Dashboard 打开后运行 assets/scenes/Atelier.scene。

已迁移三消采珠、连消与工具、十二槽手串拖动制作、六份委托、十一处清理、修屋与家具升级、三章主线及生活支线、作品图鉴、回忆手账与自动存档。保留原插画、剧情、库存及经营规则。支持鼠标、触屏、键盘和浏览器屏幕阅读器；游戏页面由 Cocos 渲染。

旧网页「设置 → 导出」的 JSON 可在本版「设置 → 导出 / 导入存档」中继续使用。同一站点的合法旧存档会自动读取；不同浏览器与原生平台之间需手动导入。

## 工程与构建

- [cocos/README.md](cocos/README.md)：运行方式、文件结构、存档迁移与平台说明。
- cocos/build-game.ps1：调用已安装 Creator，使用正式构建配置生成 cocos/build/web-mobile。
- cocos-web/：已经 Creator 构建并验证的 Web Mobile 产物，GitHub Actions 发布此目录。
- cocos-web/build-manifest.json：工程与产物 SHA-256 清单。CI 检查两者一致，避免修改源文件后仍发布旧构建。Creator 编译在本地安装环境执行，Actions 验证产物后部署。

使用 Node.js 24 执行：

```sh
node --test cocos/tests/*.mjs
node scripts/verify-cocos-build.mjs
```

包含 20 项规则测试，以及直接载入 Creator 正式编译模块的经营流程测试，覆盖全部委托、全部装修、所有剧情和存档恢复。

Web Mobile 构建可通过静态 HTTP 服务试玩。Android、iOS 和小游戏平台需要在 Creator 中配置相应 SDK 后另行构建，本仓库不包含这些平台安装包。

## 网页原型

原 Three.js 网页源码保留在 src/、public/ 和 tests/，原说明归档在 [docs/网页原型说明.md](docs/网页原型说明.md)。根目录 Vite 开发命令用于该历史原型；Cocos 版不依赖 Three.js 或 WebView。
