!define MUI_WELCOMEPAGE_TITLE "欢迎使用 ${PRODUCT_NAME} 安装向导"
!define MUI_WELCOMEPAGE_TEXT "本安装程序将引导您完成 ${PRODUCT_NAME} 的安装。请按照提示继续，并可选择是否在桌面创建快捷方式。"

; 安装到英文目录
InstallDir "$PROGRAMFILES\${PRODUCT_FILENAME}"

!macro customInit
  SetOutPath "$INSTDIR"
!macroend

!macro customInstall
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.ico"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.ico"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
!macroend
