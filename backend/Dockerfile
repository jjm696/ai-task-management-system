# =====================================================
# TaskFlow 后端镜像
# - 基于 node:18-alpine
# - 启动时自动执行 prisma migrate deploy 应用迁移
# =====================================================
FROM node:18-alpine

# 创建工作目录
WORKDIR /app

# Alpine 缺少 openssl，Prisma 引擎运行需要
RUN apk add --no-cache openssl

# 先单独拷贝依赖文件，利用 Docker 层缓存
COPY package*.json ./

# 同时安装 prod + dev 依赖（prisma CLI 在 devDeps 中，运行时需要执行 migrate deploy）
RUN npm ci

# 拷贝 prisma schema 并生成 client
COPY prisma ./prisma
RUN npx prisma generate

# 拷贝其余源码
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# 启动：先同步数据库表结构，再启动服务
# - 若 prisma/migrations 目录存在 → migrate deploy（生产推荐方式）
# - 否则降级为 db push（首次部署、无迁移历史时的便捷方案）
CMD ["sh", "-c", "if [ -d prisma/migrations ]; then npx prisma migrate deploy; else npx prisma db push --accept-data-loss; fi && node src/index.js"]
