# TaskFlow 智能任务管理

集成 Claude API 的任务管理系统：用户输入一句话，AI 自动拆解为带优先级和预估工时的子任务。

## 技术栈

- 前端：Vue 3 + Element Plus + Vite + Pinia + Axios
- 后端：Node.js + Express + Prisma + MySQL 8.0
- AI：兼容 OpenAI 协议的大模型服务（可接 Claude/DeepSeek 等中转或服务商）
- 部署：Docker + Nginx

## 目录结构

```
.
├── backend/                  后端服务
│   ├── src/                  Express 入口、路由、控制器、中间件、服务
│   ├── prisma/schema.prisma  Prisma 数据模型
│   ├── utils/aiClient.js     AI 调用封装（重试 + JSON 校验）
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── frontend/                 Vue 3 前端
│   ├── src/                  页面、组件、路由、Pinia、API 封装
│   ├── nginx.conf            SPA 托管 + /api 反向代理
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── docker-compose.yml        mysql / backend / frontend 编排
├── .env.example              部署环境变量模板
├── start.ps1                 Windows 一键启动脚本
├── start.sh                  Linux/macOS 一键启动脚本
└── DOCKER_DEPLOY.md          Docker 部署说明
```

## Docker 部署

第一次使用 Docker 部署请看：

```text
DOCKER_DEPLOY.md
```

Windows 快速启动：

```powershell
cd D:\实战项目\智能任务管理
.\start.ps1
```

启动后访问：

```text
http://localhost
```

如果 `.env` 中修改了 `FRONTEND_PORT`，访问对应端口。

## 本地传统开发

如果暂时不使用 Docker，可以使用本机 MySQL + Navicat + 终端运行：

```text
LOCAL_DEV.md
```

核心流程：

```powershell
# 1. Navicat 创建数据库 ai_task_manager

# 2. 配置 backend/.env
cd backend
copy .env.example .env

# 3. 同步表结构
npx prisma generate
npm run prisma:push

# 4. 回到项目根目录，一键打开前后端开发终端
cd ..
.\start-dev.ps1
```
