// 菜单 / 弹窗文案的轻量国际化层
// 按系统语言 (app.getLocale()) 选择 zh / en，自定义文案统一走 t(key)
// 注意：role 内置项可同时指定 label 来覆盖系统文字（行为仍由 role 提供）
const { app } = require('electron')

const zh = {
  showWindow: '显示窗口',
  exit: '退出',
  copyLink: '复制链接地址',
  copyImage: '复制图片地址',
  loadFailTitle: '加载失败',
  // 顶部菜单（按系统语言切换）
  fileMenu: '文件',
  editMenu: '编辑',
  undo: '撤销',
  redo: '重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  selectAll: '全选',
  viewMenu: '视图',
  windowMenu: '窗口',
  minimize: '最小化',
  zoom: '缩放',
  front: '全部置于顶层',
  helpMenu: '帮助',
  about: '关于',
  services: '服务',
  hide: '隐藏',
  hideOthers: '隐藏其他',
  showAll: '全部显示',
  quit: '退出',
  closeWindow: '关闭窗口',
  reload: '重新加载',
  forceReload: '强制重新加载',
  resetZoom: '实际大小',
  zoomIn: '放大',
  zoomOut: '缩小',
  toggleFullscreen: '切换全屏',
  openWebsite: '访问网站',
  loadFailMsg: '无法打开 {url}\n错误：{desc} ({code})',
  updateReadyTitle: '更新就绪',
  updateReadyMsg: '新版本已下载，重启后生效。',
  restartNow: '立即重启',
  later: '稍后'
}

const en = {
  showWindow: 'Show Window',
  exit: 'Quit',
  copyLink: 'Copy Link Address',
  copyImage: 'Copy Image Address',
  loadFailTitle: 'Load Failed',
  // 顶部菜单（按系统语言切换）
  fileMenu: 'File',
  editMenu: 'Edit',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select All',
  viewMenu: 'View',
  windowMenu: 'Window',
  minimize: 'Minimize',
  zoom: 'Zoom',
  front: 'Bring All to Front',
  helpMenu: 'Help',
  about: 'About',
  services: 'Services',
  hide: 'Hide',
  hideOthers: 'Hide Others',
  showAll: 'Show All',
  quit: 'Quit',
  closeWindow: 'Close Window',
  reload: 'Reload',
  forceReload: 'Force Reload',
  resetZoom: 'Actual Size',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  toggleFullscreen: 'Toggle Full Screen',
  openWebsite: 'Visit Website',
  loadFailMsg: 'Cannot open {url}\nError: {desc} ({code})',
  updateReadyTitle: 'Update Ready',
  updateReadyMsg: 'A new version has been downloaded and will take effect after restart.',
  restartNow: 'Restart Now',
  later: 'Later'
}

const dict = { zh, en }

function currentLocale() {
  const l = (app && typeof app.getLocale === 'function') ? app.getLocale() : 'zh'
  return (l || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

// t('key') 或 t('key', { url, desc, code }) 做占位符替换
function t(key, vars) {
  const table = dict[currentLocale()] || zh
  let str = table[key] != null ? table[key] : (zh[key] != null ? zh[key] : key)
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v == null ? '' : String(v))
    }
  }
  return str
}

module.exports = { t, currentLocale }
