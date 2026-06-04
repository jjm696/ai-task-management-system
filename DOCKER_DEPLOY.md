# TaskFlow Docker 部署指南

这份文档面向第一次使用 Docker Desktop 的部署流程。项目已经包含三类容器：

- `mysql`: MySQL 8.0 数据库，数据保存在 Docker volume 中。
- `backend`: Node.js + Express + Prisma 后端。
- `frontend`: Nginx 托管前端静态文件，并把 `/api` 转发到后端。

## 1. 准备 Docker Desktop

1. 打开 Docker Desktop。
2. 等到左下角或状态栏显示 Docker 正在运行。
3. 打开 PowerShell，进入项目根目录：

```powershell
cd D:\实战项目\智能任务管理
```

4. 检查 Docker 是否可用：

```powershell
docker --version
docker compose version
```

如果这两个命令都能输出版本号，说明 Docker Desktop 基础环境可用。

## 2. 配置环境变量

项目根目录需要有 `.env` 文件。当前项目已经有 `.env`；如果以后重建项目没有该文件，可以执行：

```powershell
copy .env.example .env
```

至少检查这些配置：

```env
FRONTEND_PORT=80
MYSQL_ROOT_PASSWORD=改成一个数据库密码
MYSQL_DATABASE=ai_task_manager
JWT_SECRET=改成一段较长随机字符串
JWT_EXPIRES_IN=7d
AI_API_KEY=你的 AI 服务 key
AI_BASE_URL=兼容 OpenAI 协议的服务地址，通常以 /v1 结尾
AI_MODEL=模型名称
AI_TIMEOUT_MS=60000
```

不要把 `.env` 发给别人，也不要提交到公开仓库。

## 3. 一键启动

在项目根目录执行：

```powershell
.\start.ps1
```

这个脚本会执行：

- 检查 Docker 是否可用。
- 检查 `.env` 是否存在。
- 执行 `docker compose up -d --build` 构建并启动服务。

启动完成后访问：

```text
http://localhost
```

如果你把 `.env` 里的 `FRONTEND_PORT` 改成了其他端口，例如 `8080`，则访问：

```text
http://localhost:8080
```

## 4. 常用 Docker 命令

查看当前容器：

```powershell
docker compose ps
```

查看全部日志：

```powershell
docker compose logs -f
```

只看后端日志：

```powershell
docker compose logs -f backend
```

只看前端 Nginx 日志：

```powershell
docker compose logs -f frontend
```

只看数据库日志：

```powershell
docker compose logs -f mysql
```

停止容器但保留数据库数据：

```powershell
docker compose down
```

重新构建并启动：

```powershell
docker compose up -d --build
```

重启服务：

```powershell
docker compose restart
```

## 5. 数据库数据说明

MySQL 数据保存在 Docker named volume：`taskflow_mysql_data`。

普通停止不会删除数据：

```powershell
docker compose down
```

如果执行下面命令，会删除数据库数据，慎用：

```powershell
docker compose down -v
```

## 6. 排查常见问题

如果 `http://localhost` 打不开，先看容器状态：

```powershell
docker compose ps
```

如果某个服务不是 `running`，看对应日志：

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql
```

如果端口 80 被占用，把 `.env` 改成：

```env
FRONTEND_PORT=8080
```

然后重新启动：

```powershell
docker compose up -d --build
```

如果 AI 功能报错，重点检查：

- `.env` 里的 `AI_API_KEY` 是否正确。
- `AI_BASE_URL` 是否是兼容 OpenAI 协议的 `/v1` 地址。
- `AI_MODEL` 是否是你的服务商支持的模型名。

如果后端连不上数据库，重点检查：

- `MYSQL_ROOT_PASSWORD` 是否为空。
- `docker compose logs -f mysql` 是否显示 MySQL 已 ready。
- 是否误删过 volume 或修改过数据库密码。

## 7. 本项目 Docker 构建前置条件

前后端 Dockerfile 使用 `npm ci` 安装依赖，因此必须保留这些锁文件：

- `backend/package-lock.json`
- `frontend/package-lock.json`

不要删除它们，否则 Docker 构建会失败。
