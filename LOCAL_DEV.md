# TaskFlow 本地传统开发运行指南

这份文档用于不使用 Docker 的本地开发方式：本机 MySQL + Navicat + 两个终端分别运行后端和前端。

## 结论

不需要大改项目代码。当前项目已经支持本地运行：

- 后端读取 `backend/.env` 中的 `DATABASE_URL`。
- Prisma 根据 `backend/prisma/schema.prisma` 创建表。
- 前端 Vite 已配置代理，把 `/api` 转发到 `http://localhost:3000`。

## 1. 确认本机环境

你当前机器已经检测到：

- Node.js 可用。
- npm 可用。
- MySQL 8.0 可用。
- MySQL 服务名是 `MySQL80`，并且正在运行。

如果以后 MySQL 没启动，可以在管理员 PowerShell 中执行：

```powershell
Start-Service MySQL80
```

## 2. 用 Navicat 创建数据库

1. 打开 Navicat。
2. 连接本机 MySQL：

```text
Host: localhost
Port: 3306
User: 你自己的 MySQL 用户名，常见是 root
Password: 你安装 MySQL 时设置的密码
```

3. 新建数据库：

```text
数据库名：ai_task_manager
字符集：utf8mb4
排序规则：utf8mb4_unicode_ci
```

只需要建库，不建议手工建表。表由 Prisma 自动创建。

## 3. 配置后端环境变量

复制模板：

```powershell
cd D:\实战项目\智能任务管理\backend
copy .env.example .env
```

打开 `backend/.env`，重点修改：

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://root:你的MySQL密码@localhost:3306/ai_task_manager"
JWT_SECRET=换成一段长随机字符串
JWT_EXPIRES_IN=7d
```

如果你的 MySQL 密码包含特殊字符，需要 URL 编码：

```text
@  写成 %40
#  写成 %23
%  写成 %25
空格 写成 %20
```

例如密码是 `abc@123`：

```env
DATABASE_URL="mysql://root:abc%40123@localhost:3306/ai_task_manager"
```

AI 配置可以先保留模板值；普通登录、任务 CRUD、仪表盘不依赖 AI。只有点击 AI 拆解/周报时才需要正确配置：

```env
AI_API_KEY=你的key
AI_BASE_URL=兼容 OpenAI 协议的 /v1 地址
AI_MODEL=模型名
```

## 4. 安装依赖

依赖已经安装过。如果以后重新安装，分别执行：

```powershell
cd D:\实战项目\智能任务管理\backend
npm ci
```

```powershell
cd D:\实战项目\智能任务管理\frontend
npm ci
```

## 5. 同步数据库表结构

执行：

```powershell
cd D:\实战项目\智能任务管理\backend
npx prisma generate
npm run prisma:push
```

执行成功后，去 Navicat 刷新 `ai_task_manager` 数据库，应该能看到：

- `users`
- `tasks`
- `daily_plans`
- `daily_plan_items`

`tasks` 表现在包含主任务/子任务与 AI 规划字段：

- `parentId`: 子任务挂载的父任务 ID。
- `estimatedHours`: 预估工时。
- `aiGenerated`: 是否由 AI 生成。
- `sourcePrompt`: AI 拆解来源输入。
- `completedAt`: 任务完成时间，用于周报和趋势统计。

每日计划相关表：

- `daily_plans`: 每个用户每天一条计划。
- `daily_plan_items`: 每日计划中的任务项，关联到 `tasks`。

注意：不要自己手工改 Prisma 已创建的表结构，否则后续同步可能冲突。

## 6. 启动后端

打开一个 PowerShell：

```powershell
cd D:\实战项目\智能任务管理\backend
npm run dev
```

看到类似下面内容表示后端启动成功：

```text
[TaskFlow] 后端服务已启动 http://localhost:3000
```

可以测试健康接口：

```powershell
curl http://localhost:3000/api/health
```

## 7. 启动前端

再打开一个新的 PowerShell：

```powershell
cd D:\实战项目\智能任务管理\frontend
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

## 8. 使用流程

1. 打开 `http://localhost:5173`。
2. 注册账号。
3. 登录后进入仪表盘。
4. 新建任务、编辑任务、切换状态。
5. 如果 AI 配置正确，可以测试 AI 拆解和周报。

## 9. 一键打开开发终端

项目根目录提供：

```powershell
.\start-dev.ps1
```

它会打开两个 PowerShell 窗口：

- 一个运行后端 `npm run dev`
- 一个运行前端 `npm run dev`

首次使用前仍然必须先完成：

- Navicat 建库
- `backend/.env` 配置
- `npm run prisma:push`

## 10. 常见问题

### 数据库连接失败

重点检查：

- MySQL 服务 `MySQL80` 是否正在运行。
- Navicat 是否能用同一账号密码连接。
- `backend/.env` 的 `DATABASE_URL` 密码是否正确。
- 密码里的特殊字符是否做了 URL 编码。

### 前端请求 404 或连接失败

确认后端在 `3000` 端口运行：

```powershell
curl http://localhost:3000/api/health
```

确认前端是从 `frontend` 目录启动：

```powershell
npm run dev
```

### AI 功能失败

普通任务功能不受影响。AI 功能失败通常是：

- `AI_API_KEY` 错误。
- `AI_BASE_URL` 没包含 `/v1`。
- `AI_MODEL` 服务商不支持。
