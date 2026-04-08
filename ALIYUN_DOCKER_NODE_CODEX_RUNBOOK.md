# 阿里云 Docker 部署与 Node 访问 Codex 方案记录

本文记录当前 `TangProject` 的线上部署方式，以及应用如何通过 Node 直接调用 Codex 能力（通过 Responses API 网关），并整理关键注意事项。

## 1. 当前方案概览

- 服务器：`47.116.122.8`
- 部署目录：`/root/apps/tangproject`
- 部署方式：`docker compose` 单容器部署（服务名 `tang-project`）
- 对外端口：`3000`
- 抽取方式：应用内 Node 直接请求 `https://api.asxs.top/v1/responses`
- 原 `codex exec` 本地 CLI 路径已移除，不再依赖容器内 Codex 登录状态

## 2. 目录与关键文件

- 应用入口：`server.js`
- 容器编排：`docker-compose.yml`
- 镜像构建：`Dockerfile`
- 运行配置模板：`.env.example`
- 结构化 schema：`data/intake-schema.json`

## 3. 部署步骤（Windows 本地 -> 阿里云）

### 3.1 本地准备

1. 确认代码已更新（尤其 `server.js`、`docker-compose.yml`、`.env.example`）。
2. 本地静态检查：

```bash
npm run check
```

### 3.2 同步文件到服务器

在 Windows PowerShell 下使用 `scp` 同步（按需调整文件列表）：

```powershell
scp server.js README.md .env.example Dockerfile docker-compose.yml .dockerignore root@47.116.122.8:/root/apps/tangproject/
scp public/app.js public/styles.css root@47.116.122.8:/root/apps/tangproject/public/
scp data/intake-schema.json root@47.116.122.8:/root/apps/tangproject/data/
```

### 3.3 服务器配置环境变量

登录服务器后进入目录：

```bash
cd /root/apps/tangproject
```

编辑 `.env.example`（当前 compose 使用该文件作为 `env_file`）：

```env
PORT=3000
RESPONSES_BASE_URL=https://api.asxs.top/v1
RESPONSES_MODEL=gpt-5.4
RESPONSES_TIMEOUT_MS=120000
OPENAI_API_KEY=你的真实密钥
```

### 3.4 重建并启动容器

```bash
cd /root/apps/tangproject
docker compose build --no-cache tang-project
docker compose up -d --force-recreate tang-project
docker compose ps
```

### 3.5 验证

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s http://47.116.122.8:3000/api/health
```

期望关键字段：

- `configured: true`
- `extractionMode: "responses-api"`
- `baseUrl: "https://api.asxs.top/v1"`

## 4. Node 访问 Codex（Responses API）实现说明

### 4.1 配置来源

应用从环境变量读取：

- `RESPONSES_BASE_URL`
- `RESPONSES_MODEL`
- `RESPONSES_TIMEOUT_MS`
- `OPENAI_API_KEY`

### 4.2 请求方式

- 目标：`POST ${RESPONSES_BASE_URL}/responses`
- Header：`Authorization: Bearer ${OPENAI_API_KEY}`
- 使用 `stream: true`（SSE）读取输出
- 使用 `text.format = json_schema` 约束结构化输出

### 4.3 健康检查策略

`/api/health` 不再检查本机 `codex login status`，改为检查：

- base URL 是否存在且不是以 `/responses` 结尾
- model 是否存在
- API key 是否存在

### 4.4 失败策略（Fail Fast）

当前策略为严格失败，不做启发式兜底：

- 接口未配置 -> 直接报错
- Responses 请求失败/超时 -> 直接报错
- 输出不符合 schema 或字段不合法 -> 直接报错

这符合项目全局策略：默认不降级、不 silent fallback。

## 5. 注意事项（重点）

1. `RESPONSES_BASE_URL` 必须是 API 根路径（`https://api.asxs.top/v1`），不能写成 `.../v1/responses`。
2. `OPENAI_API_KEY` 绝不能提交到 Git；线上建议改用专用 `.env` 或密钥管理服务，不建议长期放在 `.env.example`。
3. 该网关在非流式场景可能出现 `output` 为空，生产中应继续使用流式解析（当前已实现）。
4. `data/store.json` 是持久化数据，`docker compose up` 不会清空；不要在生产随意执行测试 intake，以免写入脏数据。
5. 结构化阶段和问题标签采用“精确匹配”；模型返回非枚举值会报错，这是设计预期。
6. 安全组/防火墙需放通 `3000`（或通过 Nginx 反代到 80/443）。
7. 当前使用 root + 密码登录仅适合快速验证，长期建议改为：
   - SSH key 登录
   - 禁用 root 远程密码登录
   - 为应用创建独立运维用户
8. 构建加 `--no-cache` 可确保镜像干净，但会变慢；非必要可去掉以提升发布速度。

## 6. 常用排查命令

```bash
cd /root/apps/tangproject
docker compose ps
docker compose logs --tail=200 tang-project
curl -s http://127.0.0.1:3000/api/health
```

如果 health 显示 `configured: false`，优先检查：

- `.env.example` 是否已写入有效 `OPENAI_API_KEY`
- `RESPONSES_BASE_URL` 是否误写为 `/responses`
- 容器是否已按最新配置重建（`up -d --force-recreate`）
