const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')

// ============================================================
// 在这里改成你要加载的网址（必改）
// ============================================================
const TARGET_URL = 'https://pc.mdzjia.com'
// ============================================================

// 窗口标题（固定，不被网页标题覆盖）
const APP_TITLE = '麦冬云诊所'

// 允许访问的域名白名单（仅这些域名的页面可在壳内打开）
const ALLOWED_HOSTS = ['mdzjia.com', 'pc.mdzjia.com', 'www.mdzjia.com']
function isAllowedHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ALLOWED_HOSTS.includes(host) || host.endsWith('.mdzjia.com')
  } catch {
    return false
  }
}
// ============================================================

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.loadURL(TARGET_URL)

  // 加载完成才显示窗口，避免白屏闪烁
  win.once('ready-to-show', () => {
    win.setTitle(APP_TITLE)
    win.show()
  })

  // 锁定域名：壳内只允许访问白名单域名，站外跳转改用系统浏览器
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedHost(url)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // 固定窗口标题，不被网页标题覆盖
  win.on('page-title-updated', (event) => {
    event.preventDefault()
    win.setTitle(APP_TITLE)
  })

  // 加载失败时给出友好提示
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    dialog.showErrorBox(
      '加载失败',
      `无法打开 ${TARGET_URL}\n错误：${errorDescription} (${errorCode})\n请检查网址是否正确或网络是否连通。`
    )
  })

  // 外链 / 新窗口用系统默认浏览器打开，避免在壳内弹新窗
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
