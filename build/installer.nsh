!define MUI_WELCOMEPAGE_TITLE "欢迎使用 Maidong 安装向导"
!define MUI_WELCOMEPAGE_TEXT "本安装程序将引导您完成 Maidong 的安装。请按照提示继续，并可选择是否在桌面创建快捷方式。"

!macro customInit
  SetOutPath "$INSTDIR"
!macroend

!macro customInstall
  CreateDirectory "$SMPROGRAMS\\${PRODUCT_NAME}"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk"
!macroend
