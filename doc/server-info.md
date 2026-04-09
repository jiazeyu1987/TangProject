# TangProject 服务器信息

本文件记录当前项目的测试环境和正式环境信息。

按当前项目要求，本文档**包含服务器登录密码**，用于帮助新的 Codex 线程快速接手部署与排查。若后续安全策略变更，需要同步清理本文件和相关引用。

## 统一信息
- 服务名：`tang-project`
- 部署方式：Docker Compose
- 默认服务端口：`3000`
- 默认部署目录：`/root/apps/tangproject`
- 常用健康检查接口：`/api/health`
- 主要部署脚本：`scripts/deploy-aliyun.ps1`

## 测试服务器
- SSH：`root@39.106.23.28`
- 密码：`Showgood1987!`
- 端口：`3000`
- 部署目录：`/root/apps/tangproject`
- 当前访问地址：`http://39.106.23.28:3000`
- 健康检查：`http://39.106.23.28:3000/api/health`
- 一键发布入口：`测试服务器.bat`

### 测试服说明
- `测试服务器.bat` 已固定指向测试服务器。
- 当前测试环境公网 `3000` 端口已放通。
- 如果需要先看服务器配置、容器状态或日志，优先登录这台服务器检查。

## 正式服务器
- SSH：`root@47.116.122.8`
- 密码：`Showgood1987!`
- 端口：`3000`
- 部署目录：`/root/apps/tangproject`
- 访问地址：`http://47.116.122.8:3000`
- 健康检查：`http://47.116.122.8:3000/api/health`
- 发布入口：`正式服务器.bat`
- PowerShell 默认发布参数目标：`scripts/deploy-aliyun.ps1` 默认指向正式服务器

### 正式服说明
- `正式服务器.bat` 调用 `scripts/deploy-aliyun.ps1` 默认参数，默认目标就是正式服务器。
- 若未额外传参，PowerShell 脚本的默认 `ServerHost` 是 `47.116.122.8`。

## 一键发布入口
- 测试环境
  - 脚本：`测试服务器.bat`
  - 目标：`root@39.106.23.28`
- 正式环境
  - 脚本：`正式服务器.bat`
  - 目标：`root@47.116.122.8`

## 常用排查命令
登录服务器后进入部署目录：

```bash
cd /root/apps/tangproject
```

查看容器状态：

```bash
docker compose ps
```

查看最近日志：

```bash
docker compose logs --tail=200 tang-project
```

查看服务器内健康检查：

```bash
curl -s http://127.0.0.1:3000/api/health
```

查看公网健康检查：

```bash
curl -s http://39.106.23.28:3000/api/health
curl -s http://47.116.122.8:3000/api/health
```

## 已知事项
- `https://4chjvcxo.mirror.aliyuncs.com` 当前不是应用访问入口，不要把它当成测试环境域名。
- 部署脚本在执行时会先做本地 `npm run check`，再进行远端校验和发布。
- 当前项目使用 Docker Compose 单容器部署，服务名固定为 `tang-project`。
