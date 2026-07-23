#!/usr/bin/env bash
# 在阿里云 ECS（Ubuntu）上安装并启动途灵后端。
# 用法（在服务器上）:
#   cd ~/ai-travel-assistant && bash scripts/ecs-bootstrap.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/ai-travel-assistant}"
BRANCH="${BRANCH:-TT}"
PORT="${PORT:-3000}"

echo "==> 工作目录: $APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "==> 安装 Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> 安装 pnpm"
  sudo npm install -g pnpm@10
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> 安装 pm2"
  sudo npm install -g pm2
fi

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH" || true

if [[ ! -f apps/server/.env ]]; then
  echo "❌ 缺少 apps/server/.env —— 请先从本机 scp 上传后再跑此脚本"
  exit 1
fi

echo "==> 安装依赖"
pnpm install --frozen-lockfile || pnpm install

echo "==> 放行本机防火墙端口 $PORT（若启用 ufw）"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow "${PORT}/tcp" || true
  sudo ufw allow OpenSSH || true
fi

echo "==> 用 pm2 启动后端"
cd "$APP_DIR/apps/server"
pm2 delete tuling-api 2>/dev/null || true
# 用 tsx 直接跑 TypeScript，免先 tsc
pm2 start pnpm --name tuling-api --cwd "$APP_DIR/apps/server" -- exec tsx src/index.ts
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true

sleep 2
curl -fsS "http://127.0.0.1:${PORT}/health" && echo
echo "✅ 本机健康检查通过。请确认阿里云安全组已放行 TCP ${PORT}"
echo "   公网: http://$(curl -fsS ifconfig.me 2>/dev/null || echo YOUR_IP):${PORT}/health"
