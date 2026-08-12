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

# 确定要同步的 tag：手动触发优先，其次 Release 事件，兜底取最新正式版
TAG="${MANUAL_TAG:-$EVENT_TAG}"
if [ -z "$TAG" ]; then
  echo "==> 未指定 tag，取 GitHub 最新正式 Release"
  TAG=$(gh api "repos/${GITHUB_REPOSITORY}/releases/latest" --jq '.tag_name')
fi
echo "==> 同步 Release: ${TAG}"

# 1) 读取 GitHub Release 元数据（名称/说明/预发布标记/附件列表）
GH_RELEASE=$(gh api "repos/${GITHUB_REPOSITORY}/releases/tags/${TAG}")
GH_NAME=$(echo "$GH_RELEASE" | jq -r '.name // .tag_name')
GH_BODY=$(echo "$GH_RELEASE" | jq -r '.body // ""')
GH_PRERELEASE=$(echo "$GH_RELEASE" | jq -r '.prerelease // false')

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
if ! curl -fsS "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}?access_token=${GITEE_TOKEN}" >/dev/null; then
  echo "❌ Gitee 仓库 ${GITEE_OWNER}/${GITEE_REPO} 不存在，请先在 Gitee 创建同名仓库"
  exit 1
fi

# 4) 创建或更新 Gitee Release（标题/说明/预发布标记）
GITEE_RELEASE=$(curl -fsS "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${TAG}?access_token=${GITEE_TOKEN}" 2>/dev/null || true)
if echo "$GITEE_RELEASE" | jq -e '.id' >/dev/null 2>&1; then
  REL_ID=$(echo "$GITEE_RELEASE" | jq -r '.id')
  echo "==> Gitee Release 已存在(id=${REL_ID})，更新标题/说明"
  PAYLOAD=$(jq -n --arg access_token "$GITEE_TOKEN" --arg name "$GH_NAME" --arg body "$GH_BODY" --argjson prerelease "$GH_PRERELEASE" \
    '{access_token:$access_token, name:$name, body:$body, prerelease:$prerelease}')
  curl -fsS -X PATCH "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${REL_ID}" \
    -H 'Content-Type: application/json' -d "$PAYLOAD" >/dev/null
else
  echo "==> 在 Gitee 创建 Release ${TAG}"
  PAYLOAD=$(jq -n --arg access_token "$GITEE_TOKEN" --arg tag_name "$TAG" --arg name "$GH_NAME" --arg body "$GH_BODY" --argjson prerelease "$GH_PRERELEASE" \
    '{access_token:$access_token, tag_name:$tag_name, name:$name, body:$body, prerelease:$prerelease}')
  GITEE_RELEASE=$(curl -fsS -X POST "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases" \
    -H 'Content-Type: application/json' -d "$PAYLOAD")
  REL_ID=$(echo "$GITEE_RELEASE" | jq -r '.id')
fi

# 5) 同步附件（重新拉取 Gitee Release 获取最新附件清单，避免重复上传）
GITEE_RELEASE=$(curl -fsS "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${TAG}?access_token=${GITEE_TOKEN}")
GITEE_ASSETS=$(echo "$GITEE_RELEASE" | jq -r '.assets[]?.name')
mkdir -p /tmp/maidong-sync
UPLOADED=0
SKIPPED_EXIST=0
SKIPPED_OVERSIZE=0

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
  curl -fsSL -o "/tmp/maidong-sync/${A_NAME}" "$A_URL"
  curl -fsS -X POST "${GITEE_API}/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${REL_ID}/attach_files?access_token=${GITEE_TOKEN}" \
    -F "file=@/tmp/maidong-sync/${A_NAME}" >/dev/null
  rm -f "/tmp/maidong-sync/${A_NAME}"
  UPLOADED=$((UPLOADED + 1))
done < <(echo "$GH_RELEASE" | jq -c '.assets[]')

echo ""
echo "✅ 同步完成: tag=${TAG}"
echo "   上传附件: ${UPLOADED}   跳过(已存在): ${SKIPPED_EXIST}   跳过(超100MB): ${SKIPPED_OVERSIZE}"
