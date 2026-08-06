const { app, BrowserWindow, shell, dialog, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

let autoUpdater = null
try { autoUpdater = require('electron-updater').autoUpdater } catch (e) { autoUpdater = null }

// ============================================================
// 在这里改成你要加载的网址
// ============================================================
const TARGET_URL = 'https://pc.mdzjia.com'
// ============================================================

// 窗口标题（固定，不被网页标题覆盖）
const APP_TITLE = '麦冬云诊所'

// 允许访问的域名白名单
const ALLOWED_HOSTS = ['mdzjia.com', 'pc.mdzjia.com', 'www.mdzjia.com']
function isAllowedHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ALLOWED_HOSTS.includes(host) || host.endsWith('.mdzjia.com')
  } catch { return false }
}
// ============================================================

let win = null
let tray = null

function createWindow() {
  win = new BrowserWindow({
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

  // 锁定域名：只允许访问白名单域名，站外跳转改用系统浏览器
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedHost(url)) { event.preventDefault(); shell.openExternal(url) }
  })

  // 固定窗口标题
  win.on('page-title-updated', (event) => { event.preventDefault(); win.setTitle(APP_TITLE) })

  // 加载失败提示
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    dialog.showErrorBox('加载失败', `无法打开 ${TARGET_URL}\n错误：${desc} (${code})`)
  })

  // 外链 / 新窗口用系统默认浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })

  // 关闭窗口最小化到托盘，不退出
  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      win.hide()
    }
  })
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png')
  if (!fs.existsSync(iconPath)) {
    console.warn('[tray] 未找到 assets/icon.png，跳过托盘')
    return
  }
  tray = new Tray(iconPath)
  tray.setToolTip(APP_TITLE)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => win && win.show() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuiting = true; app.quit() } }
  ]))
  tray.on('click', () => win && win.show())
}

function setupAutoUpdate() {
  if (!autoUpdater || !app.isPackaged) return
  autoUpdater.checkForUpdatesAndNotify()
  autoUpdater.on('update-available', () => console.log('[update] 发现新版本，开始下载…'))
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '更新就绪',
      message: '新版本已下载，重启后生效。',
      buttons: ['立即重启', '稍后']
    }).then(({ response }) => {
      if (response === 0) { app.isQuiting = true; autoUpdater.quitAndInstall() }
    })
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  setupAutoUpdate()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else if (win) win.show()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
