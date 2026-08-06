# WebView App —— 打开即加载网址的桌面壳

一个最小可运行的 Electron 套壳应用：启动后直接加载你配置的网址，跨平台（Windows / macOS）一套代码打包。

## 快速开始

### 1. 修改要加载的网址
打开 `main.js`，把顶部的 `TARGET_URL` 改成你的地址：

```js
const TARGET_URL = 'https://pc.mdzjia.com'
```

### 2. 安装依赖

```bash
npm install
```

### 3. 本地运行（开发预览）

```bash
npm start
```

### 4. 打包成安装包（跨平台）

```bash
npm run dist
```

- Windows：生成 `dist/MaidongApp Setup.exe`（NSIS 安装包）
- macOS：生成 `dist/MaidongApp-*.dmg`

> 说明：在 macOS 上打 Windows 包需要额外配置 wine；建议在对应系统上分别打包，或接 CI（如 GitHub Actions）自动出双端包。

## 目录结构

```
webview-app/
├── main.js        # 主进程：创建窗口、加载网址、外链跳系统浏览器、域名白名单、固定标题
├── preload.js     # 预加载脚本：最小安全面，可向网页暴露 shell 版本
├── package.json   # 依赖与打包配置（electron-builder）
└── README.md
```

## 行为说明

- 启动即加载 `TARGET_URL`（已设为 `https://pc.mdzjia.com`），加载完成才显示窗口（避免白屏闪烁）。
- **域名白名单**：壳内只允许打开 `mdzjia.com` 及子域名；站内跳到站外会被拦截并改用系统默认浏览器打开（见 `main.js` 的 `ALLOWED_HOSTS`）。
- **固定窗口标题**：窗口标题固定为 `麦冬云诊所`（`APP_TITLE`），不被网页自身标题覆盖。
- 网页内点击外链 / 新窗口会在系统默认浏览器打开，不会在壳内弹新窗。
- 网址加载失败会弹出错误提示。
- 菜单栏自动隐藏。

## 已内置的可配置项

- `main.js` → `TARGET_URL`：要加载的网址。
- `main.js` → `APP_TITLE`：窗口标题（当前 `麦冬云诊所`）。
- `main.js` → `ALLOWED_HOSTS`：放行域名白名单，要放开更多域名往数组里加。
- `package.json` → `productName` / `appId`：安装包显示名与应用标识（当前 `MaidongApp` / `com.mdzjia.pc`）。

## 进阶（可选）

- 需要托盘常驻 / 系统通知 / 本地文件读写：可在主进程引入 `Tray`、`Notification`、Node API（需调整 `webPreferences`）。
- 换应用图标：在 `build` 配置加 `icon` 字段并放入 `.icns`（Mac）/ `.ico`（Win）文件。
