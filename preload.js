// 套壳本身不暴露任何 Node 能力给网页，保持最小安全面。
// 如需网页与壳通信（如获取版本号），可在此用 contextBridge 暴露。
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('shell', {
  version: process.versions.electron
})
