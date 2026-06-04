# =====================================================
# TaskFlow 前端镜像（多阶段构建）
# Stage 1: node 编译产出 dist
# Stage 2: nginx 静态托管 + 反代 /api → backend:3000
# =====================================================

# ---------- Stage 1: Build ----------
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 生产构建：Vite 默认输出到 ./dist
RUN npm run build

# ---------- Stage 2: Serve ----------
FROM nginx:alpine

# 自定义 nginx 配置（包含 SPA history fallback + /api 反代）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx 默认前台运行
CMD ["nginx", "-g", "daemon off;"]
