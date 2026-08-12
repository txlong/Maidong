#!/usr/bin/env bash
# ============================================================
# 同步 GitHub Release 及其附件到 Gitee
# 触发方式：GitHub Release 发布后自动执行（或手动 workflow_dispatch）
# 依赖：gh（GitHub Actions runner 自带）、curl、jq、git
# 所需 Secrets：
#   GITEE_TOKEN   Gitee 私人令牌（https://gitee.com/profile/personal_access_tokens，勾选 projects 权限）
# 说明：Gitee 单个 Release 附件上限 100MB，超限附件会跳过并给出警告
# ============================================================
set -euo pipefail

: "${GITHUB_REPOSITORY:?请设置 GITHUB_REPOSITORY}"
: "${GITEE_OWNER:?请设置 GITEE_OWNER（Gitee 用户名/组织）}"
: "${GITEE_REPO:?请设置 GITEE_REPO（Gitee 仓库名）}"
: "${GITEE_TOKEN:?请设置 GITEE_TOKEN（Gitee 私人令牌）}"
: "${GH_TOKEN:?请设置 GH_TOKEN}"

GITEE_API="https://gitee.com/api/v5"
MAX_ASSET_BYTES=$((100 * 1024 * 1024)) # Gitee 单附件上限 100MB
TMP_DIR="/tmp/maidong-sync"
mkdir -p "$TMP_DIR"

# 封装：调用 Gitee API，失败时打印 response body 便于诊断
# 用法: gitee_api <method> <url> <output_file> [curl额外参数...]
gitee_api() {
  local method="$1" url="$2" outfile="$3"; shift 3
  local code
  code=$(curl -sS -o "$outfile" -w "%{http_code}" -X "$method" "$url" "$@")
  if [ "$code" -ge 400 ]; then
    echo "❌ Gitee API ${method} ${url} 失败 (HTTP ${code})"
    echo "   返回内容: $(cat "$outfile" 2>/dev/null | head -c 500)"
    return 1
  fi
  return 0
}

# 确定要同步的 tag：手动触发优先，其次 Release 事件，兜底取最新正式版
TAG="${MANUAL_TAG:-$EVENT_TAG}"
if [ -z "$TAG" ]; then
  echo "==> 未指定 tag，取 GitHub 最新正式 Release"
  TAG=$(gh api "repos/${GITHUB_REPOSITORY}/releases/latest" --jq '.tag_name')
fi
echo "==> 同步 Release: ${TAG}"

# 1) 读取 GitHub Release 元数据（名称/说明/预发布标记/目标分支/附件列表）
GH_RELEASE=$(gh api "repos/${GITHUB_REPOSITORY}/releases/tags/${TAG}")
GH_NAME=$(echo "$GH_RELEASE" | jq -r '.name // .tag_name')
GH_BODY=$(echo "$GH_RELEASE" | jq -r '.body // ""')
GH_PRERELEASE=$(echo "$GH_RELEASE" | jq -r '.prerelease // false')
GH_TARGET=$(echo "$GH_RELEASE" | jq -r '.target_commitish // "main"')

# body 为空时给默认值（Gitee API 对空 body 可能返回 400）
if [ -z "$GH_BODY" ] || [ "$GH_BODY" = "null" ]; then
  GH_BODY="Release ${TAG}"
fi

echo "==> Release 元数据: name=[${GH_NAME}] target=[${GH_TARGET}] prerelease=[${GH_PRERELEASE}] body长度=${#GH_BODY}"

# 2) 推送代码与 tag 到 Gitee（创建 Gitee Release 必须先有对应 tag）
REMOTE_URL="https://${GITEE_OWNER}:${GITEE_TOKEN}@gitee.com/${GITEE_OWNER}/${GITEE_REPO}.git"
git remote remove gitee 2>/dev/null || true
git remote add gitee "$REMOTE_URL"
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || echo main)
echo "==> 推送代码(${DEFAULT_BRANCH})与 tags 到 Gitee..."
git push gitee "HEAD:${DEFAULT_BRANCH}" --force
git push gitee --tags --force
git remote remove gitee

# 3) 确认 Gitee 仓库存在
if ! gitee_api GET "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}?access_token=${GITEE_TOKEN}" /dev/null; then
  echo "❌ Gitee 仓库 ${GITEE_OWNER}/${GITEE_REPO} 不存在或 token 无权限"
  exit 1
fi

# 4) 检查 tag 是否已存在于 Gitee（创建 Release 的前提）
if ! gitee_api GET "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/tags?access_token=${GITEE_TOKEN}&q=${TAG}" "${TMP_DIR}/tags.json" 2>/dev/null; then
  echo "⚠️  无法查询 Gitee tag 列表，继续尝试创建 Release..."
elif [ "$(jq -r --arg t "$TAG" '[.[] | select(.name == $t)] | length' "${TMP_DIR}/tags.json" 2>/dev/null)" -ge 1 ] 2>/dev/null; then
  echo "==> Gitee 上 tag ${TAG} 已存在 ✓"
else
  echo "⚠️  Gitee 上未找到 tag ${TAG}，尝试单独推送..."
  git remote add gitee "$REMOTE_URL"
  git push gitee "refs/tags/${TAG}" --force || echo "⚠️  推送 tag ${TAG} 失败"
  git remote remove gitee
fi

# 5) 创建或更新 Gitee Release（标题/说明/预发布标记/target_commitish）
GITEE_RELEASE_FILE="${TMP_DIR}/gitee_release.json"
if gitee_api GET "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${TAG}?access_token=${GITEE_TOKEN}" "$GITEE_RELEASE_FILE" 2>/dev/null \
  && jq -e '.id' "$GITEE_RELEASE_FILE" >/dev/null 2>&1; then
  REL_ID=$(jq -r '.id' "$GITEE_RELEASE_FILE")
  echo "==> Gitee Release 已存在(id=${REL_ID})，更新标题/说明"
  PAYLOAD=$(jq -n --arg access_token "$GITEE_TOKEN" --arg name "$GH_NAME" --arg body "$GH_BODY" --argjson prerelease "$GH_PRERELEASE" --arg target_commitish "$GH_TARGET" \
    '{access_token:$access_token, name:$name, body:$body, prerelease:$prerelease, target_commitish:$target_commitish}')
  gitee_api PATCH "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${REL_ID}" "$GITEE_RELEASE_FILE" \
    -H 'Content-Type: application/json' -d "$PAYLOAD"
else
  echo "==> 在 Gitee 创建 Release ${TAG}"
  PAYLOAD=$(jq -n --arg access_token "$GITEE_TOKEN" --arg tag_name "$TAG" --arg name "$GH_NAME" --arg body "$GH_BODY" --argjson prerelease "$GH_PRERELEASE" --arg target_commitish "$GH_TARGET" \
    '{access_token:$access_token, tag_name:$tag_name, name:$name, body:$body, prerelease:$prerelease, target_commitish:$target_commitish}')
  gitee_api POST "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases" "$GITEE_RELEASE_FILE" \
    -H 'Content-Type: application/json' -d "$PAYLOAD"
  REL_ID=$(jq -r '.id' "$GITEE_RELEASE_FILE")
  echo "==> Gitee Release 创建成功 (id=${REL_ID})"
fi

# 6) 同步附件（重新拉取 Gitee Release 获取最新附件清单，避免重复上传）
gitee_api GET "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${TAG}?access_token=${GITEE_TOKEN}" "$GITEE_RELEASE_FILE"
GITEE_ASSETS=$(jq -r '.assets[]?.name' "$GITEE_RELEASE_FILE")
UPLOADED=0
SKIPPED_EXIST=0
SKIPPED_OVERSIZE=0
FAILED=0

while IFS= read -r asset; do
  A_NAME=$(echo "$asset" | jq -r '.name')
  A_URL=$(echo "$asset" | jq -r '.browser_download_url')
  A_SIZE=$(echo "$asset" | jq -r '.size // 0')

  if [ "$A_SIZE" -gt "$MAX_ASSET_BYTES" ]; then
    echo "⚠️  ${A_NAME} 为 $((A_SIZE / 1024 / 1024)) MB，超过 Gitee 附件 100MB 上限，跳过"
    SKIPPED_OVERSIZE=$((SKIPPED_OVERSIZE + 1))
    continue
  fi
  if [ -n "$GITEE_ASSETS" ] && grep -qxF "$A_NAME" <<<"$GITEE_ASSETS"; then
    echo "==> 附件已存在，跳过: ${A_NAME}"
    SKIPPED_EXIST=$((SKIPPED_EXIST + 1))
    continue
  fi
  echo "==> 下载并上传: ${A_NAME} ($((A_SIZE / 1024 / 1024)) MB)"
  curl -fsSL -o "${TMP_DIR}/${A_NAME}" "$A_URL"
  if gitee_api POST "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${REL_ID}/attach_files?access_token=${GITEE_TOKEN}" \
    /dev/null -F "file=@${TMP_DIR}/${A_NAME}"; then
    UPLOADED=$((UPLOADED + 1))
  else
    echo "⚠️  上传 ${A_NAME} 失败，跳过"
    FAILED=$((FAILED + 1))
  fi
  rm -f "${TMP_DIR}/${A_NAME}"
done < <(echo "$GH_RELEASE" | jq -c '.assets[]')

echo ""
echo "✅ 同步完成: tag=${TAG}"
echo "   上传附件: ${UPLOADED}   跳过(已存在): ${SKIPPED_EXIST}   跳过(超100MB): ${SKIPPED_OVERSIZE}   失败: ${FAILED}"
