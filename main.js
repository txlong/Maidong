const { app, BrowserWindow, shell, dialog, Menu, clipboard } = require('electron')
const path = require('path')
const { t } = require('./i18n')

// 强制应用语言为简体中文（解决打包后默认显示英语的问题）
app.commandLine.appendSwitch('lang', 'zh-CN')

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

// 单实例锁：防止旧进程未退出时（或异常残留）再双击快捷方式启动第二个进程，
// 导致新进程读不到旧进程内存中的登录 cookie 而需要重新登录
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

let win = null

// ============================================================
// 登录态持久化：网页下发的 session cookie 自动转成持久 cookie
// 解决 Windows 上完全退出应用后每次都要重新登录的问题。
// 原因：无过期时间的 session cookie 仅在 Chromium"干净退出"时才刷盘，
//       Windows 上常见退出/杀进程场景会丢失；Mac 测试时通常只是
//       隐藏窗口（hide 到托盘），进程从未退出，所以登录态一直在。
// ============================================================
const COOKIE_PERSIST_DAYS = 30 // session cookie 转持久后的有效天数

function setupCookiePersistence() {
  const { session } = require('electron')
  const cookies = session.defaultSession.cookies

  console.log('[session] userData 目录:', app.getPath('userData'))

  cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (removed || !cookie.session) return
    if (cookie.expirationDate) return // 已是持久 cookie，无需处理

    const expirationDate = Math.floor(Date.now() / 1000) + COOKIE_PERSIST_DAYS * 86400
    const host = (cookie.domain || '').replace(/^\./, '')
    const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path || '/'}`

    const opts = {
      url,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate
    }
    // hostOnly cookie 不能带 domain（否则会变成 domain cookie，扩大作用域）
    if (!cookie.hostOnly && cookie.domain) opts.domain = cookie.domain

    cookies.set(opts, (err) => {
      if (err) console.warn(`[cookie] 持久化失败: ${cookie.name} ->`, err.message)
    })
  })
}

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
  // 先注册 cookie 持久化，再创建窗口，确保登录 cookie 第一时间被接管
  setupCookiePersistence()

  // 设置国际化的顶部应用菜单（替换 macOS 默认英文菜单；视图菜单不含开发者工具）
  Menu.setApplicationMenu(buildAppMenu())

  createWindow()
  setupAutoUpdate()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else if (win) win.show()
})

// 所有窗口关闭后直接退出应用（Windows/macOS 一致），不再驻留后台
app.on('window-all-closed', () => {
  app.quit()
})
