# TangProject 代码结构说明

## 项目概览
- 技术栈：Node.js、Express、原生 HTML / CSS / JavaScript、本地 JSON 数据文件。
- 后端入口：`server.js`
- 前端入口：`public/index.html`
- 本地运行命令：`npm start`
- 本地静态校验命令：`npm run check`

当前后端是单文件结构，主要业务逻辑集中在 `server.js`；前端也是静态页面加单文件脚本模式，适合快速定位和小范围修改。

## 根目录关键文件
- `server.js`
  唯一后端入口，负责加载环境变量、初始化数据、注册 API 路由、访问 Responses API、做备份调度。
- `package.json`
  Node 项目清单，当前只保留 `start` 和 `check` 两个脚本。
- `Dockerfile`
  容器镜像构建文件，使用 Debian 基础镜像并在镜像内安装 Node.js。
- `docker-compose.yml`
  运行时容器编排文件，服务名为 `tang-project`，端口映射到 `3000`。
- `.env.example`
  本地运行环境变量模板。
- `.env.deploy.example`
  部署环境变量模板。
- `测试服务器.bat`
  一键发布到测试服务器的 Windows 批处理。
- `正式服务器.bat`
  一键发布到正式服务器的 Windows 批处理。

## 后端结构
后端逻辑都在 `server.js` 中，主要可按下面几块理解：

- 配置与启动
  读取 `PORT`、`RESPONSES_BASE_URL`、`RESPONSES_MODEL`、`RESPONSES_TIMEOUT_MS`、`OPENAI_API_KEY` 等环境变量，初始化 Express 和数据存储。
- 健康检查与系统信息
  `GET /api/health` 返回配置状态、模型、Responses API 根地址、数据文件信息和备份状态。
- 认证与会话
  提供注册、登录、退出和 Bearer Token 认证校验，默认初始密码逻辑也在这里。
- Bootstrap / Dashboard
  `GET /api/bootstrap` 负责拼装首页所需的聚合数据，包括项目、任务、看板、风险信号、可见用户信息等。
- 项目与任务
  包含项目创建、任务状态更新、项目详情拼装和排序逻辑。
- Remarks 交流记录
  包括项目备注、回复、已读等流程。
- Followups 跟进问答
  包括追问问题生成、回答、历史记录、批量回答和提交收口逻辑。
- Intake 结构化录入
  调用 Responses API，把自由文本整理成结构化结果，并回写项目、更新、任务等数据。
- 备份系统
  包括备份目录初始化、定时备份、手动创建、恢复和保留数量裁剪。

## 主要 API 分组
- 健康检查
  - `GET /api/health`
- 认证
  - `GET /api/auth/options`
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Bootstrap
  - `GET /api/bootstrap`
- 备份
  - `GET /api/backups`
  - `POST /api/backups/create`
  - `POST /api/backups/restore`
- 用户
  - `PATCH /api/users/:userId`
- 任务
  - `PATCH /api/tasks/:taskId`
- 项目与备注
  - `POST /api/projects`
  - `POST /api/projects/:projectId/remarks`
  - `POST /api/project-remarks/:remarkId/reply`
  - `POST /api/project-remarks/:remarkId/read`
- 跟进问答
  - `POST /api/followups/question`
  - `POST /api/followups/questions`
  - `GET /api/followups/history`
  - `POST /api/followups/answer`
  - `POST /api/followups/answers`
- Intake
  - `POST /api/intake`
  - `POST /api/intake/preview`

## 前端结构
- `public/index.html`
  页面骨架，包含登录区、工作台、项目视图、任务区、管理区等静态容器。
- `public/app.js`
  前端主逻辑，负责状态管理、API 调用、登录态处理、页面渲染、表单提交流程。
- `public/styles.css`
  当前页面样式、布局、组件外观和响应式规则。

前端同样是单文件组织，改动 UI 时通常需要同时看 `index.html`、`app.js` 和 `styles.css`。

## 数据与持久化
- `data/store.json`
  当前运行时主数据文件，应用实际读写这个文件。
- `data/seed-store.json`
  初始种子数据。
- `data/intake-schema.json`
  Intake 结构化输出 schema。
- `data/followup-questions-schema.json`
  跟进提问输出 schema。
- `data/backups/`
  自动备份和手动备份输出目录。

## 部署相关文件
- `scripts/deploy-aliyun.ps1`
  主部署脚本，负责本地校验、远端前置检查、文件上传、容器构建与健康检查。
- `scripts/deploy-aliyun-paramiko.py`
  当 SSH key 不可用时，走密码认证上传与发布。
- `测试服务器.bat`
  固定发布到测试服务器。
- `正式服务器.bat`
  默认发布到正式服务器。

## 其他目录
- `output/`
  运行过程中可能产生的输出文件目录，不属于核心运行时代码。
- `node_modules/`
  本地依赖目录。

## 当前结构特点
- 后端是单文件模式，定位快，但单文件体量较大。
- 前端也是单文件模式，页面行为和渲染逻辑集中。
- 没有独立测试框架；当前主要依靠 `npm run check` 和接口验证。
