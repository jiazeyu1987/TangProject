# AI 医院导入管理系统 MVP

这是一个最小可运行的前后端原型，用于演示“AI 结构化纪要 + 医院项目台账 + 任务中心 + 管理汇总”四个核心模块。

当前版本由应用服务直接通过 Node 调用 `https://api.asxs.top/v1/responses`，不再依赖本机或容器内的 `codex exec`。

部署与运维实操文档见：`ALIYUN_DOCKER_NODE_CODEX_RUNBOOK.md`

## 技术栈

- Node.js
- Express
- Responses API
- 原生 HTML / CSS / JavaScript
- 本地 JSON 数据仓

## 当前页面结构

- `工作台`
  - 推进纪要录入
  - 管理信号看板
- `项目台账`
  - 医院项目列表
  - 项目详情视图
- `任务中心`
  - 按状态分栏查看任务
- `管理汇总`
  - 阶段分布
  - 高频问题标签
  - 最近项目动态

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 可选：复制环境变量模板

```bash
copy .env.example .env
```

3. 可配置项

```env
PORT=3000
RESPONSES_BASE_URL=https://api.asxs.top/v1
RESPONSES_MODEL=gpt-5.4
RESPONSES_TIMEOUT_MS=120000
OPENAI_API_KEY=
```

4. 启动服务

```bash
npm start
```

5. 打开浏览器访问

```text
http://localhost:3000
```

## 一键部署到阿里云（双击）

1. 准备部署环境文件

```bash
copy .env.deploy.example .env.deploy
```

然后编辑 `.env.deploy`，至少填入非空 `OPENAI_API_KEY`。

2. 确认本机已安装并可执行以下命令

- `powershell`
- `ssh`
- `scp`
- `npm`

3. 双击仓库根目录下的 `deploy-aliyun.bat`

- 默认目标服务器为 `root@47.116.122.8`
- 默认部署目录为 `/root/apps/tangproject`
- 脚本会优先尝试 SSH key 登录；若不可用，会提示输入 SSH 密码（也可提前设置环境变量 `ALIYUN_SSH_PASSWORD`）
- 脚本会自动执行：
  - 本地 `npm run check`
  - 远端 Docker 前置检查
  - 文件同步
  - `docker compose build --no-cache` + `up -d --force-recreate`
  - 部署后 `api/health` 和 `api/bootstrap` 校验

4. 失败排查

- 详细流程与命令说明见 `ALIYUN_DOCKER_NODE_CODEX_RUNBOOK.md`
- 如果脚本失败，窗口会保留错误输出，不会静默降级

## 数据与抽取方式

- 演示数据保存在 `data/store.json`
- 初始种子数据来自 `data/seed-store.json`
- 结构化输出 schema 位于 `data/intake-schema.json`
- 后端会向 `RESPONSES_BASE_URL + /responses` 发起流式请求
- 结构化输出通过 Responses API 的 `json_schema` 格式约束生成
- 缺少 `OPENAI_API_KEY`、`RESPONSES_BASE_URL` 配错，或接口返回异常时，系统会直接报错，不做本地兜底抽取

## 我本地验证过

- `GET /api/health` 正常返回，且 `configured: true`
- `GET /api/bootstrap` 正常返回项目、任务和汇总数据
- 页面首页 `GET /` 返回 `200`
- `POST /api/intake` 可直接调用 Responses API 生成结构化结果
- `PATCH /api/tasks/:taskId` 可更新任务状态并刷新页面数据

## 已知边界

- 当前是单机演示版，没有用户鉴权
- 数据保存在本地 JSON 文件，不是数据库
- 没有多租户、审批流和消息推送
- 没有企业微信 / 钉钉集成
