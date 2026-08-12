#!/usr/bin/env bash
# ============================================================
# 上传本地构建产物到 Gitee Release（构建流程内置调用，免去"下载再上传"）
# 用法: upload-assets-to-gitee.sh "<glob1>" ["<glob2>" ...]
# 所需环境变量: GITEE_OWNER, GITEE_REPO, GITEE_TOKEN, REL_ID
# 特性:
#   - Gitee 单附件 100MB 上限，超限自动跳过并警告
#   - 已存在附件跳过（幂等，重跑不重复上传）
#   - 未配置 GITEE_TOKEN / REL_ID=SKIP 时静默跳过（不阻塞构建）
#   - 上传失败计数，有失败则返回非零退出码
# ============================================================
set -euo pipefail

# 未配置 Gitee 时静默跳过（构建流程不应因 Gitee 未配置而失败）
if [ -z "${GITEE_TOKEN:-}" ] || [ -z "${REL_ID:-}" ] || [ "${REL_ID:-}" = "SKIP" ]; then
  echo "⚠️ 未配置 GITEE_TOKEN 或未创建 Gitee Release，跳过附件上传"
  exit 0
fi
: "${GITEE_OWNER:?请设置 GITEE_OWNER}"
: "${GITEE_REPO:?请设置 GITEE_REPO}"

GITEE_API="https://gitee.com/api/v5"
MAX_ASSET_BYTES=$((100 * 1024 * 1024)) # Gitee 单附件上限 100MB
TMPDIR_SAFE="${RUNNER_TEMP:-/tmp}"

# 已存在附件清单（幂等，避免重跑重复上传）
EXISTING=""
code=$(curl -sS -o "${TMPDIR_SAFE}/gitee_rel.json" -w "%{http_code}" \
  "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${REL_ID}?access_token=${GITEE_TOKEN}" 2>/dev/null || echo 000)
if [ "$code" = "200" ]; then
  EXISTING=$(jq -r '.assets[]?.name' "${TMPDIR_SAFE}/gitee_rel.json" 2>/dev/null || true)
fi

UPLOADED=0; SKIP_EXIST=0; SKIP_OVER=0; FAILED=0
for pattern in "$@"; do
  # shellcheck disable=SC2086
  for f in $pattern; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo 0)

    if [ "$size" -gt "$MAX_ASSET_BYTES" ]; then
      echo "⚠️ 跳过超限附件: ${name} ($((size / 1024 / 1024)) MB > 100MB)"
      SKIP_OVER=$((SKIP_OVER + 1))
      continue
    fi
    if [ -n "$EXISTING" ] && grep -qxF "$name" <<<"$EXISTING"; then
      echo "==> 附件已存在，跳过: ${name}"
      SKIP_EXIST=$((SKIP_EXIST + 1))
      continue
    fi

    echo "==> 上传: ${name} ($((size / 1024 / 1024)) MB)"
    resp="${TMPDIR_SAFE}/gitee_upload_resp.txt"
    up_code=$(curl -sS -o "$resp" -w "%{http_code}" \
      -X POST "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${REL_ID}/attach_files?access_token=${GITEE_TOKEN}" \
      -F "file=@${f}")
    if [ "$up_code" -ge 400 ]; then
      echo "⚠️ 上传失败 (HTTP ${up_code}): $(head -c 300 "$resp" 2>/dev/null)"
      FAILED=$((FAILED + 1))
    else
      UPLOADED=$((UPLOADED + 1))
    fi
  done
done

echo ""
echo "✅ Gitee 附件上传完成: 成功=${UPLOADED} 已存在跳过=${SKIP_EXIST} 超限跳过=${SKIP_OVER} 失败=${FAILED}"
[ "$FAILED" -eq 0 ] || exit 1
