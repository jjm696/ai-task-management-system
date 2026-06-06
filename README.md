# AI Task Management System

一个基于 Vue 3、Express、Prisma、MySQL 和 AI API 的智能任务管理系统。系统支持任务 CRUD、主子任务拆解、每日计划、仪表盘统计和 AI 周报生成，适合个人任务规划和 AI 辅助效率管理场景。

## 技术栈

- 前端：Vue 3、Vite、Vue Router、Pinia、Element Plus、Axios、ECharts、Marked、DOMPurify
- 后端：Node.js、Express、Prisma、MySQL、JWT、Zod
- AI 接入：OpenAI-Compatible API，可对接 Claude、DeepSeek 或其他兼容服务
- 部署：Docker、Docker Compose、Nginx

## 核心功能

- 用户认证：支持注册、登录、JWT 鉴权和用户数据隔离。
- 任务管理：支持任务创建、编辑、删除、状态切换、优先级、截止日期和预计工时。
- 主子任务：通过 Task 自关联结构支持主任务和子任务管理。
- AI 任务拆解：根据用户输入自动生成带优先级、预计工时和说明的子任务。
- 每日计划：将长期任务池转化为当天执行清单，支持加入计划、状态同步和进度统计。
- 仪表盘统计：展示任务状态分布、近 7 天完成趋势和计划完成情况。
- AI 周报：根据任务完成情况生成 Markdown 周报，并进行安全预览。

## 项目亮点

- 使用 Prisma 建模任务自关联关系，支持主任务、子任务和每日计划之间的关联查询。
- 对 AI 输出使用固定 JSON 结构、字段校验和失败重试，降低模型返回格式异常对业务流程的影响。
- 使用 `completedAt` 区分任务完成时间和更新时间，让完成趋势统计更准确。
- 使用 DOMPurify 处理 Markdown 周报预览，降低富文本渲染风险。
- 提供 Docker Compose 编排，包含 MySQL、后端服务、前端 Nginx 托管和 `/api` 反向代理。

## 目录结构

```text
.
├── backend/                   # Express 后端服务
│   ├── prisma/schema.prisma   # Prisma 数据模型
│   ├── src/                   # 路由、控制器、中间件、服务
│   ├── scripts/               # AI 调用测试脚本
│   ├── Dockerfile
│   └── package.json
├── frontend/                  # Vue 3 前端项目
│   ├── src/                   # 页面、组件、路由、Pinia、API 封装
│   ├── nginx.conf             # SPA 托管和 /api 反向代理
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml         # MySQL / Backend / Frontend 编排
├── .env.example               # Docker 部署环境变量模板
├── LOCAL_DEV.md               # 本地开发说明
├── DOCKER_DEPLOY.md           # Docker 部署说明
└── README.md
```

## Docker 快速启动

复制环境变量模板：

```bash
copy .env.example .env
```

修改 `.env` 中的数据库密码、JWT 密钥和 AI 配置后启动：

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://localhost
```

## 本地开发

### 1. 配置数据库

创建 MySQL 数据库：

```sql
CREATE DATABASE ai_task_manager DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 2. 启动后端

```bash
cd backend
copy .env.example .env
npm install
npx prisma generate
npm run prisma:push
npm run dev
```

后端默认地址：

```text
http://localhost:3000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：

```text
http://localhost:5173
```

## 后端环境变量

```text
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://root:your_password@localhost:3306/ai_task_manager"
JWT_SECRET=please_change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_BASE_URL=https://api.openai-sb.com/v1
AI_MODEL=claude-3-5-sonnet-20241022
AI_TIMEOUT_MS=60000
AI_MAX_RETRIES=3
AI_RETRY_BASE_DELAY_MS=1000
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=2048
```

## 安全说明

- `.env` 不应提交到 GitHub，仓库只保留 `.env.example`。
- AI Key、数据库密码和 JWT 密钥应通过环境变量配置。
- Markdown 周报渲染前需要保留安全过滤，避免 XSS 风险。
