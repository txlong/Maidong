# WebView App —— 打开即加载网址的桌面壳

一个最小可运行的 Electron 套壳应用：启动后直接加载你配置的网址，跨平台（Windows / macOS）一套代码打包。

## 快速开始

### 1. 修改要加载的网址
打开 `main.js`，把顶部的 `TARGET_URL` 改成你的地址：

```js
const TARGET_URL = 'https://你的网址.com'
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

- Windows：生成 `dist/WebViewApp Setup.exe`（NSIS 安装包）
- macOS：生成 `dist/WebViewApp-*.dmg`

> 说明：在 macOS 上打 Windows 包需要额外配置 wine；建议在对应系统上分别打包，或接 CI（如 GitHub Actions）自动出双端包。

## 目录结构

```
webview-app/
├── main.js        # 主进程：创建窗口、加载网址、外链跳系统浏览器
├── preload.js     # 预加载脚本：最小安全面，可向网页暴露 shell 版本
├── package.json   # 依赖与打包配置（electron-builder）
└── README.md
```

## 行为说明

- 启动即加载 `TARGET_URL`，加载完成才显示窗口（避免白屏闪烁）。
- 网页内点击外链 / 新窗口会在系统默认浏览器打开，不会在壳内弹新窗。
- 网址加载失败会弹出错误提示。
- 菜单栏自动隐藏。

## 进阶（可选）

- 想锁死网址、禁止跳转别的站：在 `main.js` 里监听 `will-navigate` 做白名单校验。
- 需要托盘常驻 / 系统通知 / 本地文件读写：可在主进程引入 `Tray`、`Notification`、Node API（需调整 `webPreferences`）。
