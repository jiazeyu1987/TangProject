# AI 医院导入管理系统 MVP

这是一个最小可运行的前后端原型，用于演示“AI 结构化纪要 + 医院项目台账 + 任务中心 + 管理汇总”四个核心模块。

当前版本直接复用你本机已经登录的 `codex` CLI，不需要额外配置 `OPENAI_API_KEY`。

## 技术栈

- Node.js
- Express
- 本机 Codex CLI
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
CODEX_CLI_PATH=codex
CODEX_MODEL=
CODEX_SANDBOX=read-only
```

4. 启动服务

```bash
npm start
```

5. 打开浏览器访问

```text
http://localhost:3000
```

## 数据与抽取方式

- 演示数据保存在 `data/store.json`
- 初始种子数据来自 `data/seed-store.json`
- 结构化输出 schema 位于 `data/intake-schema.json`
- 正常情况下，后端通过本机 `codex exec` 生成结构化 JSON
- 如果本机 Codex 不可用，系统会自动切换到启发式抽取

## 我本地验证过

- `GET /api/health` 正常返回，且 `configured: true`
- `GET /api/bootstrap` 正常返回项目、任务和汇总数据
- 页面首页 `GET /` 返回 `200`
- `POST /api/intake` 可调用本机 Codex 生成结构化结果
- `PATCH /api/tasks/:taskId` 可更新任务状态并刷新页面数据

## 已知边界

- 当前是单机演示版，没有用户鉴权
- 数据保存在本地 JSON 文件，不是数据库
- 没有多租户、审批流和消息推送
- 没有企业微信 / 钉钉集成
