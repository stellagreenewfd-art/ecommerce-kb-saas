#!/bin/bash

# ============================================================
# 电商知识库 SaaS - 自动部署到 Render 脚本
# 使用方式:
#   cd /Users/qinaqiang/WorkBuddy/2026-06-13-22-26-14/ecommerce-kb
#   bash deploy-to-render.sh
#
# 支持两种模式:
#   1) 全自动: 设置 GITHUB_TOKEN 和 RENDER_API_KEY, 脚本自动创建 GitHub 仓库和 Render 服务
#   2) 半自动: 只推送代码到已创建的 GitHub 仓库, 然后生成 "Deploy to Render" 按钮链接
# ============================================================

set -e

REPO_NAME_DEFAULT="ecommerce-kb-saas"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

function warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

function error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

function prompt() {
  echo -e "${BLUE}[INPUT]${NC} $1"
}

# 检查必要命令
function check_commands() {
  if ! command -v git &> /dev/null; then
    error "请先安装 git: https://git-scm.com/downloads"
    exit 1
  fi
  if ! command -v curl &> /dev/null; then
    error "curl 未安装"
    exit 1
  fi
}

# 初始化 git 仓库
function init_git() {
  if [ -d "$PROJECT_DIR/.git" ]; then
    log "Git 仓库已存在,跳过初始化"
  else
    log "初始化 Git 仓库..."
    git init
    git add .
    git commit -m "Initial commit: ecommerce knowledge base SaaS" || true
  fi
}

# 读取用户输入
function read_input() {
  local var_name=$1
  local message=$2
  local default_value=$3
  local is_secret=$4

  if [ -n "$default_value" ]; then
    prompt "$message (默认: $default_value):"
  else
    prompt "$message:"
  fi

  if [ "$is_secret" = "true" ]; then
    read -s value
    echo
  else
    read value
  fi

  if [ -z "$value" ] && [ -n "$default_value" ]; then
    value="$default_value"
  fi

  eval "$var_name='$value'"
}

# 全自动模式: 创建 GitHub 仓库
function create_github_repo_auto() {
  if [ -z "$GITHUB_TOKEN" ]; then
    warn "GITHUB_TOKEN 未设置, 将切换到半自动模式"
    return 1
  fi

  log "使用 GitHub API 创建仓库: $REPO_NAME"
  
  # 检查仓库是否已存在
  local existing=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$GITHUB_USERNAME/$REPO_NAME" | grep -c '"id"' || true)
  
  if [ "$existing" -gt 0 ]; then
    log "仓库 $GITHUB_USERNAME/$REPO_NAME 已存在,跳过创建"
    return 0
  fi

  local response=$(curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/user/repos" \
    -d "{\"name\":\"$REPO_NAME\",\"private\":true,\"description\":\"中国电商运营知识库 SaaS - AI 问答会员平台\",\"auto_init\":false}")

  if echo "$response" | grep -q '"clone_url"'; then
    log "GitHub 仓库创建成功: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
  else
    error "GitHub 仓库创建失败:"
    echo "$response" | head -20
    return 1
  fi
}

# 半自动模式: 用户手动创建仓库后, 设置 remote 并推送
function push_to_github_manual() {
  log "进入半自动推送模式"
  read_input REPO_URL "请输入你的 GitHub 仓库地址 (例如 https://github.com/你的用户名/ecommerce-kb-saas.git)"
  
  if [ -z "$REPO_URL" ]; then
    error "仓库地址不能为空"
    exit 1
  fi

  # 更新或添加 remote
  if git remote | grep -q origin; then
    git remote set-url origin "$REPO_URL"
  else
    git remote add origin "$REPO_URL"
  fi

  # 推送代码
  log "推送代码到 GitHub..."
  git branch -M main 2>/dev/null || true
  git push -u origin main
  log "代码推送成功"
}

# 全自动模式: 创建 Render Web Service
function create_render_service_auto() {
  if [ -z "$RENDER_API_KEY" ]; then
    warn "RENDER_API_KEY 未设置, 跳过自动创建 Render 服务"
    return 1
  fi

  log "使用 Render API 创建 Web Service..."
  
  local response=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    "https://api.render.com/v1/services" \
    -d "{
      \"type\": \"web_service\",
      \"name\": \"$REPO_NAME\",
      \"ownerId\": \"$RENDER_OWNER_ID\",
      \"repo\": \"https://github.com/$GITHUB_USERNAME/$REPO_NAME\",
      \"branch\": \"main\",
      \"buildCommand\": \"npm install\",
      \"startCommand\": \"npm start\",
      \"plan\": \"starter\",
      \"envVars\": [
        {\"key\": \"DEEPSEEK_API_KEY\", \"value\": \"$DEEPSEEK_API_KEY\"},
        {\"key\": \"JWT_SECRET\", \"value\": \"$JWT_SECRET\"},
        {\"key\": \"PORT\", \"value\": \"3000\"}
      ]
    }")

  if echo "$response" | grep -q '"id"'; then
    log "Render 服务创建成功"
    echo "$response" | grep '"url"' | head -1
  else
    error "Render 服务创建失败:"
    echo "$response" | head -30
    return 1
  fi
}

# 生成 Deploy to Render 按钮链接
function generate_render_deploy_link() {
  local github_url="https://github.com/$GITHUB_USERNAME/$REPO_NAME"
  local deploy_url="https://render.com/deploy?repo=$github_url"
  
  log "============================================"
  log "部署链接已生成"
  log "============================================"
  echo ""
  echo -e "${YELLOW}GitHub 仓库:${NC} $github_url"
  echo -e "${YELLOW}Deploy to Render:${NC} $deploy_url"
  echo ""
  echo "点击上方 Deploy to Render 链接, 登录后选择:"
  echo "  1. Apply Blueprint"
  echo "  2. 在 Environment 中填入 DEEPSEEK_API_KEY 和 JWT_SECRET"
  echo "  3. 等待 2-3 分钟即可访问"
  echo ""
}

# 主流程
function main() {
  echo ""
  echo "============================================================"
  echo "  电商知识库 SaaS - 一键部署到 Render"
  echo "============================================================"
  echo ""

  check_commands
  init_git

  # 读取项目配置
  read_input REPO_NAME "GitHub 仓库名称" "$REPO_NAME_DEFAULT"
  read_input GITHUB_USERNAME "你的 GitHub 用户名"

  # 检查是否使用全自动模式
  if [ -n "$GITHUB_TOKEN" ] && [ -n "$RENDER_API_KEY" ]; then
    log "检测到 GITHUB_TOKEN 和 RENDER_API_KEY, 使用全自动模式"
    read_input JWT_SECRET "JWT 密钥 (建议 32 位以上随机字符串)" "$(openssl rand -hex 32 2>/dev/null || date +%s%N)"
    
    # 从 .env 读取 DEEPSEEK_API_KEY
    if [ -f "$PROJECT_DIR/.env" ]; then
      DEEPSEEK_API_KEY=$(grep "^DEEPSEEK_API_KEY=" "$PROJECT_DIR/.env" | cut -d '=' -f2)
    fi
    
    if [ -z "$DEEPSEEK_API_KEY" ]; then
      read_input DEEPSEEK_API_KEY "请输入 DeepSeek API Key"
    fi

    create_github_repo_auto
    
    # 设置 remote 并推送
    local repo_url="https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
    if git remote | grep -q origin; then
      git remote set-url origin "$repo_url"
    else
      git remote add origin "$repo_url"
    fi
    git branch -M main 2>/dev/null || true
    git push -u origin main
    
    create_render_service_auto
  else
    # 半自动模式
    warn "全自动模式需要 GITHUB_TOKEN 和 RENDER_API_KEY"
    warn "将使用半自动模式: 你手动创建 GitHub 仓库, 脚本推送代码并生成 Render 部署链接"
    echo ""
    
    push_to_github_manual
    
    # 使用用户输入的仓库地址提取用户名和仓库名
    if [[ "$REPO_URL" =~ github.com/([^/]+)/([^/]+)(\.git)?$ ]]; then
      GITHUB_USERNAME="${BASH_REMATCH[1]}"
      REPO_NAME="${BASH_REMATCH[2]}"
    fi
    
    generate_render_deploy_link
  fi

  log "部署脚本执行完毕"
}

main
