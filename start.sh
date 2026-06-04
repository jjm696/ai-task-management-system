#!/usr/bin/env bash
# =====================================================
# TaskFlow 一键启动脚本
# - 自动检查依赖（docker / docker compose）
# - 不存在 .env 时从模板复制并提示用户修改
# - 构建 + 启动所有服务，等待 backend 健康
# =====================================================
set -e

cd "$(dirname "$0")"

# ---------- 1. 依赖检查 ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker 未安装，请先安装 Docker Desktop / docker-ce"
  exit 1
fi

# 兼容 docker compose / docker-compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "[ERROR] 未检测到 docker compose 或 docker-compose"
  exit 1
fi

# ---------- 2. .env 检查 ----------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "[INFO] 已生成 .env，请编辑其中的密码 / JWT_SECRET / AI_API_KEY 等关键项后重新运行本脚本。"
    exit 0
  else
    echo "[ERROR] 缺少 .env.example，无法创建配置文件"
    exit 1
  fi
fi

# 简单校验关键密钥未保留默认值
if grep -q "please_change_this_to_a_long_random_string" .env || grep -q "please_change_this_strong_password" .env; then
  echo "[WARN] 检测到 .env 中仍使用模板默认密码/JWT_SECRET，建议修改后再继续。"
  read -r -p "仍要继续启动吗？[y/N] " ans
  case "$ans" in
    [yY]*) ;;
    *) echo "已中止。"; exit 1 ;;
  esac
fi

# ---------- 3. 构建并启动 ----------
echo "[INFO] 构建并启动 TaskFlow 服务…"
$COMPOSE up -d --build

# ---------- 4. 等待 backend 就绪 ----------
echo "[INFO] 等待 backend 启动（最多 60s）…"
for i in $(seq 1 30); do
  if docker inspect -f '{{.State.Running}}' taskflow-backend 2>/dev/null | grep -q true; then
    if docker exec taskflow-backend wget -qO- --timeout=2 http://localhost:3000/api/health >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 2
done

# ---------- 5. 打印访问信息 ----------
FRONTEND_PORT=$(grep -E '^FRONTEND_PORT=' .env | head -n1 | cut -d= -f2)
FRONTEND_PORT=${FRONTEND_PORT:-80}

echo ""
echo "============================================"
echo "  ✅ TaskFlow 已启动"
echo "  前端地址：http://localhost:${FRONTEND_PORT}"
echo "  常用命令："
echo "    查看日志：$COMPOSE logs -f"
echo "    停止服务：$COMPOSE down"
echo "    重启服务：$COMPOSE restart"
echo "    清理数据库：$COMPOSE down -v   (慎用，会删 MySQL 数据卷)"
echo "============================================"
