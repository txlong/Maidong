// macOS 公证脚本（electron-builder afterSign 钩子）
// 仅在 macOS 构建时运行；缺少 Apple 凭证时自动跳过，不影响本地未签名构建。
module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('[notarize] 未检测到 Apple 公证凭证，跳过公证（APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID）。')
    return
  }

  const { notarize } = require('@electron/notarize')
  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`[notarize] 开始公证 ${appPath}`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID
  })
  console.log('[notarize] 公证完成')
}
module.exports.default = module.exports
