const { app, BrowserWindow, shell, dialog, Tray, Menu, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const { t } = require('./i18n')

let autoUpdater = null
try { autoUpdater = require('electron-updater').autoUpdater } catch (e) { autoUpdater = null }

// ============================================================
// 在这里改成你要加载的网址
// ============================================================
const TARGET_URL = 'https://pc.mdzjia.com'
// ============================================================

// 窗口标题（固定，不被网页标题覆盖）
const APP_TITLE = '麦冬云诊所'

// 是否禁用开发者工具（菜单项 / 快捷键 / 右键 Inspect）
const DEV_TOOLS_BLOCKED = true

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

  // 固定窗口标题
  win.on('page-title-updated', (event) => { event.preventDefault(); win.setTitle(APP_TITLE) })

  // 加载失败提示
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    dialog.showErrorBox(t('loadFailTitle'), t('loadFailMsg', { url: TARGET_URL, desc, code }))
  })

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
    { label: t('showWindow'), click: () => win && win.show() },
    { type: 'separator' },
    { label: t('exit'), click: () => { app.isQuiting = true; app.quit() } }
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
      title: t('updateReadyTitle'),
      message: t('updateReadyMsg'),
      buttons: [t('restartNow'), t('later')]
    }).then(({ response }) => {
      if (response === 0) { app.isQuiting = true; autoUpdater.quitAndInstall() }
    })
  })
}

// ============================================================
// 顶部应用菜单：按系统语言国际化（t()）；视图菜单手动构建，不含开发者工具入口
// 配置位置：菜单结构在此函数；文案在 i18n.js 的 zh / en 表
// ============================================================
function buildAppMenu() {
  const template = [
    {
      // macOS 第一个菜单（应用名）
      label: APP_TITLE,
      submenu: [
        { label: t('about'), role: 'about' },
        { type: 'separator' },
        { label: t('services'), role: 'services' },
        { type: 'separator' },
        { label: t('hide'), role: 'hide' },
        { label: t('hideOthers'), role: 'hideOthers' },
        { label: t('showAll'), role: 'unhide' },
        { type: 'separator' },
        { label: t('quit'), role: 'quit' }
      ]
    },
    {
      label: t('fileMenu'),
      submenu: [{ label: t('closeWindow'), role: 'close' }]
    },
    {
      label: t('editMenu'),
      submenu: [
        { label: t('undo'), role: 'undo' },
        { label: t('redo'), role: 'redo' },
        { type: 'separator' },
        { label: t('cut'), role: 'cut' },
        { label: t('copy'), role: 'copy' },
        { label: t('paste'), role: 'paste' },
        { label: t('selectAll'), role: 'selectAll' }
      ]
    },
    {
      // 手建视图菜单：刻意不用 role:'viewMenu'，否则会自动带 Toggle Developer Tools
      label: t('viewMenu'),
      submenu: [
        { label: t('reload'), role: 'reload' },
        { label: t('forceReload'), role: 'forceReload' },
        { type: 'separator' },
        { label: t('resetZoom'), role: 'resetZoom' },
        { label: t('zoomIn'), role: 'zoomIn' },
        { label: t('zoomOut'), role: 'zoomOut' },
        { type: 'separator' },
        { label: t('toggleFullscreen'), role: 'togglefullscreen' }
      ]
    },
    {
      // 手建窗口菜单：刻意不用 role:'windowMenu'，否则子项(Minimize/Zoom 等)由系统语言决定
      label: t('windowMenu'),
      submenu: [
        { label: t('minimize'), role: 'minimize' },
        { label: t('zoom'), role: 'zoom' },
        { type: 'separator' },
        { label: t('front'), role: 'front' }
      ]
    },
    {
      label: t('helpMenu'),
      submenu: [
        { label: t('openWebsite'), click: () => shell.openExternal(TARGET_URL) }
      ]
    }
  ]
  return Menu.buildFromTemplate(template)
}

// ============================================================
// 禁用开发者工具：菜单项 / 快捷键 / 右键 Inspect
// ============================================================
function attachDevToolsBlocker(contents) {
  if (!DEV_TOOLS_BLOCKED) return

  // 拦截打开开发者工具的快捷键（Ctrl+Shift+I / Cmd+Option+I / Ctrl+Shift+J / F12）
  contents.on('before-input-event', (event, input) => {
    const mod = input.control || input.meta
    if (mod && input.shift && /^[ij]$/i.test(input.key)) event.preventDefault()
    if (input.key === 'F12') event.preventDefault()
  })

  // 右键菜单：剪切/复制/粘贴/全选统一走 i18n（role+label 保留内置行为）；
  // 自定义项（复制链接/图片地址）走 i18n；整体移除 Inspect / 开发者工具入口
  contents.on('context-menu', (event, params) => {
    event.preventDefault()
    const items = []
    if (params.isEditable) {
      items.push({ label: t('cut'), role: 'cut' }, { label: t('copy'), role: 'copy' }, { label: t('paste'), role: 'paste' })
    } else if (params.selectionText) {
      items.push({ label: t('copy'), role: 'copy' })
    }
    if (params.linkURL) {
      items.push({ type: 'separator' }, { label: t('copyLink'), click: () => clipboard.writeText(params.linkURL) })
    }
    if (params.hasImageContents && params.srcURL) {
      items.push({ type: 'separator' }, { label: t('copyImage'), click: () => clipboard.writeText(params.srcURL) })
    }
    items.push({ type: 'separator' }, { label: t('selectAll'), role: 'selectAll' })
    if (items.length) {
      Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(contents) })
    }
  })
}

// 统一管理所有新开窗口：允许打开任意地址（无白名单）；禁用开发者工具入口
app.on('web-contents-created', (event, contents) => {
  // 任意新窗口（含业务系统的打印预览窗）均在壳内打开，由系统/网页自身处理打印
  contents.setWindowOpenHandler(() => ({ action: 'allow' }))
  attachDevToolsBlocker(contents)
})

app.whenReady().then(() => {
  // 设置国际化的顶部应用菜单（替换 macOS 默认英文菜单；视图菜单不含开发者工具）
  Menu.setApplicationMenu(buildAppMenu())

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
