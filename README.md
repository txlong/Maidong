# 麦冬云诊所PC端

一个跨平台（Windows / macOS）Electron 套壳应用：启动后直接加载 `https://pc.mdzjia.com`，一套代码打包双端安装包。

## 快速开始

### 1. 本地运行（开发预览）
```bash
npm install
npm start
```

### 2. 打包成安装包（跨平台）
```bash
npm run dist
```
- Windows：生成 `dist/maidong-desktop-1.x.x-win.exe`（NSIS 安装包）
- macOS：生成 `dist/maidong-desktop-1.x.x-mac.dmg`

> 说明：在 macOS 上打 Windows 包需要额外配置 wine；建议在对应系统上分别打包，或接 CI（GitHub Actions）自动出双端包（见下文）。

## 目录结构
```
webview-app/
├── main.js                 # 主进程：窗口、加载网址、白名单、固定标题、托盘、自动更新
├── preload.js              # 预加载脚本：最小安全面
├── package.json            # 依赖与打包配置（electron-builder + electron-updater）
├── assets/icon.png         # 应用与托盘图标
├── .github/workflows/      # 一键打包发布 CI
└── README.md
```

## 行为说明
- 启动即加载 `TARGET_URL`（`https://pc.mdzjia.com`），加载完成才显示窗口（避免白屏闪烁）。
- **域名白名单**：壳内只允许打开 `mdzjia.com` 及子域名；站外跳转被拦截并改用系统默认浏览器打开（见 `main.js` 的 `ALLOWED_HOSTS`）。
- **固定窗口标题**：窗口标题固定为 `麦冬云诊所`，不被网页自身标题覆盖。
- **托盘常驻**：关闭窗口不退出，最小化到系统托盘；双击托盘或右键「显示窗口」恢复，右键「退出」真正退出。
- **自动更新**：打包后启动会自动检查 GitHub Release 新版本并提示更新（开发模式不触发）。
- 网页内点击外链 / 新窗口会在系统默认浏览器打开。
- 网址加载失败会弹出错误提示；菜单栏自动隐藏。

## 可配置项
- `main.js` → `TARGET_URL`：要加载的网址。
- `main.js` → `APP_TITLE`：窗口标题（当前 `麦冬云诊所`）。
- `main.js` → `ALLOWED_HOSTS`：放行域名白名单。
- `package.json` → `productName` / `appId`：安装包名与应用标识（当前 `Maidong` / `com.maidong.app`）。
- `assets/icon.png`：应用与托盘图标（建议 256×256 以上、透明背景 PNG）。

## 一键打包发布（GitHub Actions）
`.github/workflows/build.yml` 在推送 `v*` 标签时，自动在 macOS / Windows runner 上构建并发布到 GitHub Release。

接入步骤：
1. 把项目推到 GitHub 仓库。
2. 打标签并推送：`git tag v1.0.0 && git push origin v1.0.0`。
3. Actions 自动构建，在 Release 中产出 `maidong-desktop-1.0.0-mac.dmg` 与 `maidong-desktop-1.0.0-win.exe`。
4. 已安装旧版的用户启动后会自动收到更新提示。

> CI 使用仓库默认 `secrets.GITHUB_TOKEN`，无需额外配置。

## 代码签名（去除系统拦截）

未签名的应用在 macOS 会报“已损坏，无法打开”，在 Windows 会触发 SmartScreen。本项目已在 CI 中预留签名/公证流程：**填好下面的 GitHub Secrets 后，下次打 tag 即自动签名 + 公证**，不填则照常构建未签名包。

### 需要在仓库 Settings → Secrets and variables → Actions 中创建的密钥

**macOS（Apple Developer ID + 公证）**
| Secret | 内容 |
|--------|------|
| `MAC_CERTIFICATE_BASE64` | “Developer ID Application” 证书导出为 `.p12` 后的 base64（`base64 -i cert.p12`） |
| `MAC_CERTIFICATE_PASSWORD` | 该 `.p12` 的导出密码 |
| `APPLE_ID` | 你的 Apple ID 邮箱 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple 专用密码（appleid.apple.com → 登录与安全 → App 专用密码） |
| `APPLE_TEAM_ID` | 10 位 Team ID |

**Windows（Authenticode 代码签名）**
| Secret | 内容 |
|--------|------|
| `WIN_CERTIFICATE_BASE64` | Windows 代码签名证书 `.pfx` 的 base64（`base64 -i cert.pfx`） |
| `WIN_CERTIFICATE_PASSWORD` | 该 `.pfx` 的密码 |

### 本地导出证书为 base64
```bash
# macOS
base64 -i "Developer ID Application.p12" | pbcopy   # 结果粘到 MAC_CERTIFICATE_BASE64
# Windows
base64 -i "codesign.pfx" | clip                      # 结果粘到 WIN_CERTIFICATE_BASE64
```

> 说明：Windows 全新代码签名证书初期 SmartScreen 可能仍有一次警告，待证书信誉累积（下载量上来）后自动消失，属正常现象。
