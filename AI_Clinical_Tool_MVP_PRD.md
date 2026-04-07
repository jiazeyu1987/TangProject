# AI 医院导入过程管理系统 MVP PRD

## 1. 产品定义

这是一个面向创新型医疗器械导入场景的 `AI + 项目管理` 系统。

系统目标不是生成日报，而是通过 AI 与一线人员对话，持续沉淀每家医院的推进状态、阻塞问题、待办任务和历史轨迹，最终服务于管理决策。

一句话定义：

`用 AI 对话替代低效人工追问，把医院导入过程转成结构化项目管理数据。`

## 2. 解决的问题

当前问题：

- 医院导入是持续推进过程，不是一次性销售
- 一线员工掌握大量碎片信息，但这些信息分散在口头、微信、脑子里
- 管理层只能逐个追问，效率低，且容易失真、遗漏
- 缺乏统一的医院推进台账，无法看清阶段、阻塞点、责任人和下一步动作

MVP 要解决的核心问题：

- 让 AI 主动做日常问询
- 让自由聊天自动转为结构化记录
- 让每家医院形成持续更新的推进台账
- 让管理层能看到任务、风险和整体推进情况

## 3. 目标用户

### 3.1 一线用户

- 临床推广
- 渠道人员
- 销售支持
- 区域执行人员

### 3.2 管理用户

- 区域经理
- 销售总监
- 总经理

### 3.3 系统管理员

- 维护医院、区域、阶段、标签、人员信息

## 4. 产品边界

### 4.1 MVP 要做

- Web 聊天问询入口
- AI 结构化提取
- 医院台账
- 任务追踪
- 管理汇总页

### 4.2 MVP 不做

- 复杂 CRM
- 复杂审批流
- 企业微信 / 钉钉深度集成
- 语音输入和语音转写
- 自动生成复杂 BI 报表
- 多组织、多租户复杂权限体系

## 5. 核心业务对象

系统核心对象不是员工，而是 `医院项目 Hospital Project`。

每个医院项目至少要表达：

- 医院是谁
- 当前推进阶段
- 最近一次推进发生在什么时候
- 见了谁
- 对方反馈了什么
- 当前卡点是什么
- 下一步动作是什么
- 谁负责
- 截止时间是什么

## 6. 核心业务流程

### 6.1 一线日常流程

1. 员工打开聊天入口
2. AI 发起日常问询
3. 员工自由回答
4. AI 追问缺失字段
5. 系统生成结构化纪要
6. 系统自动生成 / 更新任务
7. 系统更新医院项目台账

### 6.2 管理查看流程

1. 管理者打开后台
2. 查看医院列表和状态分布
3. 查看卡住医院、逾期任务、高频问题
4. 点进医院详情查看历史轨迹
5. 根据问题决定资源支持或管理动作

## 7. MVP 核心功能

## 7.1 AI 问询

目标：

- 用聊天方式代替主管追问

最小能力：

- 支持员工主动输入
- 支持 AI 按模板追问
- 支持围绕一次医院推进形成完整对话

典型追问字段：

- 今天 / 本周推进的是哪家医院
- 去了哪个科室
- 见了谁
- 对方身份是什么
- 对方的态度和反馈是什么
- 当前主要阻碍是什么
- 下一步计划是什么
- 是否需要总部支持

## 7.2 自动结构化整理

目标：

- 从自由对话中提取结构化字段

提取结果至少包括：

- 医院
- 科室
- 接触人
- 角色
- 反馈摘要
- 问题标签
- 下一步动作
- 负责人
- 截止时间
- 当前阶段
- 是否需要管理关注

## 7.3 任务追踪

目标：

- 让系统记住未完成事项，而不是只保留聊天记录

任务最小字段：

- 标题
- 关联医院项目
- 负责人
- 截止日期
- 状态
- 来源纪要

任务状态：

- 待处理
- 进行中
- 已完成
- 已逾期

## 7.4 医院台账

目标：

- 每家医院一页，能连续看推进过程

医院台账页最少展示：

- 医院名称
- 所属区域
- 当前阶段
- 最近推进时间
- 当前阻塞点
- 下一步动作
- 关键接触人
- 历史纪要时间线
- 关联任务

## 7.5 管理汇总

目标：

- 让管理层快速识别风险和资源投放点

首版看板内容：

- 各阶段医院数量
- 超过 N 天未推进的医院
- 当前逾期任务
- 高频问题标签
- 各区域推进分布

## 8. 页面清单

### 8.1 登录页

- 用户登录

### 8.2 聊天问询页

- 与 AI 对话
- 查看当前提取摘要
- 提交本次纪要

### 8.3 我的任务页

- 查看分配给我的任务
- 更新状态

### 8.4 医院列表页

- 按区域 / 阶段 / 状态筛选医院

### 8.5 医院详情页

- 查看该医院项目的完整推进记录

### 8.6 管理汇总页

- 汇总统计与风险清单

### 8.7 配置页

- 医院
- 区域
- 阶段
- 问题标签
- 用户

## 9. 医院详情页结构

建议区块：

1. 基础信息
2. 当前阶段与状态
3. 最近一次推进摘要
4. 关键接触人
5. 当前问题标签
6. 待办任务
7. 历史纪要时间线

## 10. 数据模型

## 10.1 users

- id
- name
- role
- region_id
- status
- created_at

## 10.2 regions

- id
- name

## 10.3 hospitals

- id
- name
- region_id
- level
- address
- status

## 10.4 departments

- id
- hospital_id
- name

## 10.5 hospital_projects

- id
- hospital_id
- owner_user_id
- region_id
- current_stage
- project_status
- last_follow_up_at
- next_action
- next_action_due_at
- latest_summary
- created_at
- updated_at

## 10.6 hospital_contacts

- id
- hospital_id
- department_id
- name
- role
- phone
- notes

## 10.7 conversation_sessions

- id
- user_id
- project_id
- started_at
- ended_at

## 10.8 conversation_messages

- id
- session_id
- sender_type
- content
- created_at

## 10.9 project_updates

- id
- project_id
- session_id
- visit_date
- contact_name
- contact_role
- feedback_summary
- blockers
- opportunities
- next_step
- stage_after_update
- extracted_json
- manager_attention_needed
- created_by
- created_at

## 10.10 tasks

- id
- project_id
- update_id
- title
- description
- assignee_user_id
- due_at
- priority
- status
- created_at
- updated_at

## 10.11 issue_tags

- id
- name
- category

## 10.12 project_issue_links

- id
- project_id
- update_id
- issue_tag_id

## 11. AI 设计原则

MVP 阶段 AI 只做三件事：

1. 问询
2. 提取
3. 生成摘要和待办

不建议在 MVP 里让 AI 做：

- 自动决策医院阶段是否变化
- 自动审批任务
- 自动替代管理判断

更稳妥的方式：

- AI 输出结构化 JSON
- 后端校验
- 必要时允许用户确认后入库

## 12. 建议的 AI 结构化输出

```json
{
  "hospital": "",
  "department": "",
  "contacts": [
    {
      "name": "",
      "role": ""
    }
  ],
  "feedback_summary": "",
  "issues": [],
  "next_actions": [
    {
      "title": "",
      "assignee": "",
      "due_date": ""
    }
  ],
  "stage_after_update": "",
  "manager_attention_needed": false
}
```

## 13. 后端 API 草案

## 13.1 聊天相关

- `POST /api/chat/sessions`
- `POST /api/chat/messages`
- `POST /api/chat/extract`

## 13.2 医院项目相关

- `GET /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`

## 13.3 任务相关

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`

## 13.4 汇总相关

- `GET /api/dashboard/summary`
- `GET /api/dashboard/blocked-projects`
- `GET /api/dashboard/issue-distribution`

## 14. MVP 成功标准

上线后至少验证：

- 一线人员愿意用聊天方式填报推进信息
- 单次对话可稳定提取结构化字段
- 医院详情页能形成连续推进台账
- 管理者能识别卡点医院和逾期任务

## 15. 关键指标

建议首版跟踪：

- 活跃提交人数
- 每周新增推进记录数
- 自动提取成功率
- 自动生成任务数
- 逾期任务数
- 超过 N 天未推进医院数

## 16. 风险点

最容易做砸的地方：

- 把它做成普通日报系统
- 只保留聊天记录，没有结构化台账
- 数据模型围绕员工，而不是围绕医院项目
- AI 抽取不稳定，却没有人工确认机制
- 一上来集成太多入口，导致 MVP 失焦

## 17. 开发建议

建议首版技术路线：

- 前端：Next.js
- 后端：Node.js / NestJS 或 Express
- 数据库：PostgreSQL
- AI：结构化输出 + JSON Schema 校验
- 部署：单体应用优先

## 18. 分阶段计划

### Phase 1：MVP

- 聊天问询
- 结构化提取
- 任务生成
- 医院台账
- 管理汇总

### Phase 2：增强版

- 企业微信 / 钉钉接入
- 自动提醒
- 阶段推进规则
- 更强的标签和检索

### Phase 3：经营版

- 多组织管理
- 经营分析
- 权限和审计
- 与 CRM / OA / 企业 IM 集成

## 19. 当前最需要产品方补充的信息

开发前必须补齐：

1. 第一批真实使用者是谁
2. 医院推进阶段如何定义
3. 哪些字段是必填
4. 管理层最关心的 5 个指标是什么
5. 聊天入口优先选网页、企业微信还是钉钉

