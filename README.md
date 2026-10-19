# 保研模拟器源码

## 运行

需要 Node.js 22.12 或更高版本，以及 pnpm 11.25.0。

```sh
pnpm install
pnpm dev
```

浏览器打开终端显示的地址。事件资源会从 `content/` 自动生成。

```sh
pnpm typecheck
pnpm build
pnpm start
```

`pnpm build` 生成 `dist/`，本源码包不附带该目录，也不自动执行 JavaScript 混淆。

## 代码格式

使用 Prettier 统一 TypeScript、Vue、CSS、JSON 和 PHP 文件的格式。编辑器基础设置见 `.editorconfig`。

```sh
pnpm format
pnpm format:check
```

## 内容

- `src/engine/`：角色、数值、课程、随机事件、日常行动、项目、申请、面试和结局规则。
- `src/components/`、`src/styles/`：游戏界面、交互和样式。
- `src/stores/`：本地游戏状态、行动和自动保存。
- `src/services/`：内容读取、加密本地存档、昵称和主动分享。
- `content/events/`：398 个事件、1337 个选项。
- `content/questions/`：106 道面试题。
- `content/endings/`：68 个结局。
- `content/programs.json`：41 个申请项目。
- `public/art/`：场景图片；字体通过原依赖包加载。

## 主动分享（可选）

游戏主体无需 PHP。需要链接分享时，在另一个终端运行 PHP 8 和 PDO SQLite 服务：

```sh
php -S 127.0.0.1:8081 -t server server/router.php
```

开发服务器已将 `/api/` 代理到该端口。部署时将站点的 `/api/` 请求交给 `server/index.php` 处理，并为 PHP 配置私有可写目录 `BAOYAN_SHARE_DATA`。默认保存到项目根目录的 `.share-data/`；部署时该目录应位于网站公开目录之外。

许可见 `LICENSE`。
