# 恒序 persistLog 开发指导文档

**版本** v1.0  
**日期** 2026-10-19  
**依据** [产品需求分析](product-requirements.md) V1.0、[系统技术方案设计](technical-design.md) V1.0、[对比与补充清单](gap-analysis.md)  
**状态** Phase 1 可进入开发；Phase 2/3 为路线图  
**首版目标** 计划导入 → 每日跟踪 → 进度看板 → 企业微信推送

> 说明：PRD 的 P0/P1/P2 是产品优先级；本文的 Phase 1/2/3 是交付顺序，两者不是一一对应。Phase 1 先落地“计划 + 跟踪 + 看板 + 推送”，Phase 2 做代码练习 AI 评审，Phase 3 做其余需求。

---

## 0. 设计决策（先补齐缺陷）

### 0.1 五条不变的产品决策

继续遵守两份原始文档已经确定的边界：

1. V1 不做语音回答。
2. V1 采用自适应间隔复习（Phase 3 实现，规格先定）。
3. AI 使用第三方 API，不自建/私有化模型。
4. V1 使用企业微信群机器人推送。
5. 求职平台只做入口链接跳转，不做账号、简历、测评、错题、任务数据交换。

### 0.2 交付顺序

| 阶段 | 目标 | 核心内容 | 退出标准 |
|---|---|---|---|
| Phase 1 | 计划能落地 | 导入计划、手动编辑、每日任务、进度看板、企微推送 | 用户能连续 7 天按计划执行并收到推送 |
| Phase 1.5 | 计划增强（可选） | HTML 导入、周报、数据导出/删除、计划模板 | 导入覆盖面与数据合规补齐 |
| Phase 2 | 代码练习有反馈 | 算法代码提交、AI 静态评审、评分证据、评分趋势 | 每天提交代码能得到可执行反馈 |
| Phase 3 | 其余需求 | AI 诊断/路线、八股/项目提问、错题复习、完整能力看板、CLI、平台链接、管理能力 | 产品闭环完整 |

> Phase 2/3 本文只锁定范围、依赖和关键规格；进入该阶段前再补详细设计（表结构、API、Rubric、页面）。

### 0.3 14 个缺陷的处置

| ID | 缺陷 | 决策 | 落地阶段 |
|---|---|---|---|
| D-01 | 复习间隔与产品展示不一致 | 采用 `first_review_after_days=1` + `intervals=[1,4,7,14]`，对应第 2/3/7/14/28 天；前 5 阶段固定推进，之后倍率 + 上限 | Phase 3（规格先定） |
| D-02 | 算法代码评审 P0/P1 矛盾 | Phase 2 实现“基础版静态评审”：不执行代码，基于代码 + 用户自测结果 + 思路说明；Git 自动同步/沙箱/IDE 放 Phase 3 | Phase 2 |
| D-03 | CLI 是 P0 但排到最后 | CLI 从首版移出，Phase 3 实现；Phase 1/2 用网页上传；验收 #13 不再属于首版 | Phase 3 |
| D-04 | 任务状态机与真源不清 | `tasks` 只做模板（draft/active/archived）；每日状态只放 `task_occurrences`；补齐 actual_minutes/note/原因字段 | Phase 1 |
| D-05 | 每日复盘/提问无表且工作流混合 | 拆成 `daily_quiz` 与 `daily_review`，Phase 3 实现；Phase 1/2 不依赖 | Phase 3 |
| D-06 | 能力看板缺岗位要求/权重/聚合 | Phase 1 只做执行进度看板；Phase 2 加算法评分趋势；Phase 3 做完整能力模型 | Phase 1/2/3 |
| D-07 | 通知缺配置/模板/偏好/触发 | Phase 1 完整实现渠道 CRUD、测试、模板、偏好、Outbox、触发矩阵 | Phase 1 |
| D-08 | 诊断/路线操作 API 缺失 | Phase 1 只做导入/手动路线 CRUD、激活/暂停/归档/调整；AI 诊断/生成放 Phase 3 | Phase 1/3 |
| D-09 | HTML 导入版本冲突 | Phase 1 只做 Markdown；HTML 放 Phase 1.5/3，接口预留 | Phase 1.5 |
| D-10 | 深链接口径不清 | Phase 3 只做固定 URL/页面路径；不做带身份/业务数据的深链 | Phase 3 |
| D-11 | 周总结/周报不清 | Phase 1 只做轻量“周总结”推送；完整周报放 Phase 3 | Phase 1/3 |
| D-12 | 管理员角色无落地 | Phase 1 不做管理后台；用脚本/DB/运维工具；多用户管理放 Phase 3 | Phase 1 |
| D-13 | 指标不可采集 | Phase 1 只做执行指标；删除模拟面试/Offer；补 actual_minutes；预测历史 Phase 3 | Phase 1 |
| D-14 | 看板是 P0 但开发阶段没列 | 进度看板明确放进 Phase 1，与计划跟踪一起做 | Phase 1 |

### 0.4 新增的工程决策

1. **计划优先，不依赖 AI 诊断**：Phase 1 的用户入口是“导入一份计划”，不是“让 AI 生成一份计划”。
2. **看板分层**：Phase 1 只展示“计划执行进度”；Phase 2 加“代码评分趋势”；能力准备度必须有证据，Phase 3 才开放完整能力。
3. **日状态唯一真源**：`task_occurrences` 是今日列表、完成率、顺延、看板的唯一数据源；`tasks` 只做模板。
4. **顺延用容量回流，不硬移日期**：未完成任务进入下一天，后续任务由每日编排按容量重新选择；路线结束日期用剩余工作量预测，不把整条路线逐日平移。这样避免“一天没完成，整条计划雪崩”。
5. **AI 只做“结构化”，不做“替用户确认”**：导入解析必须经过预览、校验、用户确认才落库。
6. **Phase 1 不引入 LangGraph**：导入是一条 Celery 流水线 + 一次结构化 AI 调用；Phase 2/3 出现多步人工确认流程时再引入 LangGraph。
7. **通知只做单向推送**：企微群机器人不能收回复；消息里的操作通过链接回 Web（已登录直达，未登录先登录）。
8. **所有异步任务统一 Job 契约**：导入、通知、日计划生成都返回/记录 `job_id`，前端可查询进度。
9. **时间是用户时区**：日期字段按用户时区计算，数据库存 UTC 时间戳；日界线默认 04:00，可配置。
10. **先做单区域、单主目标**：数据模型支持多目标，但 Phase 1 只允许一个主目标、一个进行中路线，降低交互复杂度。

---

## 1. 交付范围

### 1.1 Phase 1 要解决的问题

用户已经有计划（自己写的、其他 AI 生成的、Markdown 导出的），但计划躺在文档里，每天不知道做什么、做了没人提醒、进度看不见。

Phase 1 只做四件事：

1. **导入计划**：把 Markdown 计划变成结构化路线/阶段/周/任务。
2. **跟踪计划**：每天生成今日任务，支持完成、延期、跳过、阻塞、放弃、备注、实际耗时。
3. **进度看板**：完成率、计划 vs 实际、时间分布、顺延、路线进度、预计完成日期。
4. **推送**：早报、晚报、逾期、顺延、周总结，走企业微信群机器人。

### 1.2 Phase 1 包含

- 账号注册/登录、刷新 Token。
- 用户档案：时区、每日可用时间、计划容量系数。
- 求职目标：岗位、目标日期、优先级；Phase 1 只启用一个主目标。
- 文件上传（Markdown）。
- 计划导入：规则抽取 + AI 标准化 + 校验 + 预览 + 编辑 + 确认 + 回滚。
- 路线/阶段/周/任务的手动增删改查。
- 每日计划生成、今日页、任务状态、实际耗时、备注。
- 未完成自动顺延、路线预计完成日期。
- 进度看板：总览、趋势、时间分布、顺延、路线进度、预测。
- 企业微信群机器人：渠道配置、测试、模板、偏好、免打扰、Outbox、重试、去重。
- 周总结推送（轻量）。
- 审计日志、基础监控。

### 1.3 Phase 1 不包含

- AI 诊断、AI 生成路线（Phase 3）。
- 简历上传/解析（Phase 3）。
- 算法代码提交/AI 评审（Phase 2）。
- 八股/项目提问、每日复盘、错题本、间隔复习（Phase 3）。
- CLI、Git 自动接入、IDE 插件（Phase 3）。
- 求职平台数据交换/SSO（Phase 3，且仍不做数据交换）。
- HTML 导入（Phase 1.5/3）。
- 完整能力看板、准备度、证据链（Phase 3）。
- 管理后台（Phase 3）。
- 多渠通知（QQ/邮件/站内，Phase 3）。
- 数据导出/删除（Phase 1.5/3，但接口预留）。

### 1.4 Phase 1 用户旅程

```text
注册/登录
  → 填档案（时区、每日可用时间）
  → 填目标岗位（岗位、目标日期）
  → 上传 Markdown 计划
  → AI 解析 + 规则校验
  → 预览（阶段/周/任务 + 问题清单）
  → 手动修正
  → 确认导入
  → 生成今日任务
  → 早报推送
  → 完成/延期/跳过/阻塞
  → 看板更新
  → 晚报/逾期/顺延推送
  → 周总结
```

### 1.5 与原始文档的差异

| 原始文档 | 本文调整 | 原因 |
|---|---|---|
| P0 包含 Python CLI | 移到 Phase 3 | 先验证计划闭环，CLI 不是首版阻塞项 |
| P0 包含成长看板（含能力） | Phase 1 只做执行看板 | 没有代码/回答证据时，能力分不可信 |
| P0 包含 AI 诊断/路线 | 移到 Phase 3 | 导入计划可以独立启动，先降低 AI 依赖 |
| 算法代码 AI 评审在 P0/P1 之间矛盾 | Phase 2 | 原始 P0 清单未列、P1 列了，但闭环需要；按用户优先级放 Phase 2 |
| P1 HTML 导入 | Phase 1.5 | Markdown 覆盖大多数 AI 生成计划 |
| P1 周报/月报 | Phase 1 轻量周总结，完整周报 Phase 3 | 先给节奏感，不先做重报表 |
| 管理员角色 | Phase 1 不做 UI | 个人使用，脚本/DB 足够 |

---

## 2. 技术架构

### 2.1 技术栈

| 层 | 选型 | Phase 1 用途 |
|---|---|---|
| 后端 | Python 3.11+ / FastAPI | REST API |
| ORM/迁移 | SQLAlchemy 2.x / Alembic | MySQL 访问与迁移 |
| 数据库 | MySQL 8.0 | 业务数据 |
| 缓存/队列 | Redis | 缓存、锁、Celery broker |
| 异步 | Celery + Beat | 导入、日计划、顺延、通知 |
| 文件 | MinIO（开发）/ S3 兼容（生产） | Markdown 文件 |
| 前端 | React + TypeScript + Next.js | Web |
| UI | Ant Design | 工作台/表单/表格 |
| AI | 第三方 API + 自建 AI Gateway | Phase 1 只做导入标准化 |
| 认证 | JWT + Refresh Token | 独立登录 |
| 部署 | Docker Compose | 单机起步 |
| 监控 | Prometheus + Grafana + Loki（可选） | API/任务/通知 |

### 2.2 Phase 1 模块边界

```text
apps/
  api/
    routers/
      auth.py
      profile.py
      files.py
      imports.py
      routes.py
      tasks.py
      today.py
      dashboard.py
      notifications.py
      jobs.py
  worker/
    tasks/
      import_tasks.py
      planning_tasks.py
      notification_tasks.py
  scheduler/
    beat.py

domain/
  auth/
  profile/
  import_plan/
  route/
  planning/
  dashboard/
  notification/
  file/
  ai/
  common/

infrastructure/
  db/
  cache/
  storage/
  ai/
  messaging/
  observability/
```

Phase 2 新增 `practice/`、`evaluation/`；Phase 3 新增 `diagnosis/`、`review/`、`capability/`、`integration/`。

### 2.3 同步与异步

**同步请求**

- 登录/刷新。
- 档案/目标 CRUD。
- 路线/任务 CRUD。
- 今日查询、任务状态变更。
- 看板查询。
- 通知渠道配置/测试（测试发送走异步，但接口立即返回 job）。

**异步任务**

- Markdown 解析 + AI 标准化 + 校验。
- 每日计划生成。
- 未完成顺延。
- 通知发送/重试。
- 周总结生成。
- 文件安全扫描（可选）。

### 2.4 关键链路

**导入链路**

```text
前端上传 Markdown
  → 后端创建 file + import_batch
  → 返回 job_id
  → Celery: 抽取文本 → 规则解析 → AI 标准化 → 校验
  → 写入 import_items / import_issues
  → 前端轮询 job / import
  → 预览、编辑
  → 确认: 事务创建 route/stages/weeks/tasks
  → 写 audit_log
```

**每日链路**

```text
Celery Beat 每 15 分钟
  → 找本地时间到点的用户
  → 生成/补齐 today 的 daily_plan + occurrences（幂等）
  → 生成早报 outbox
  → Worker 发送企微
```

**顺延链路**

```text
日界线后
  → 找 pending/in_progress/blocked 的旧 occurrence
  → 计算 remaining_minutes
  → 创建今天的 occurrence（carry_over_from_id）
  → 旧 occurrence 标记 postponed
  → 更新 forecast_end_date
  → 生成顺延通知
```

### 2.5 部署

```text
nginx
  ├── frontend (Next.js)
  └── api (FastAPI)
        ├── worker (Celery)
        └── beat (Celery Beat)

mysql
redis
minio / S3
```

环境变量：

```text
APP_ENV=dev
DATABASE_URL=mysql+aiomysql://...
REDIS_URL=redis://...
S3_ENDPOINT=http://minio:9000
S3_BUCKET=persistlog
JWT_SECRET=...
ENCRYPTION_KEY=...
AI_PROVIDER=openai_compatible
AI_MODEL=...
AI_API_KEY=...
```

---

## 3. 领域模型与状态机

### 3.1 核心对象

| 对象 | 职责 |
|---|---|
| User | 账号、时区、状态 |
| UserProfile | 每日可用时间、容量系数、偏好 |
| JobTarget | 目标岗位、目标日期、优先级 |
| Route | 一条学习路线，关联目标 |
| RouteVersion | 路线快照，支持导入/手动变更追溯 |
| Stage | 路线阶段 |
| Week | 阶段下的周目标 |
| Task | 任务模板，含产出/验收/估时/类型 |
| DailyPlan | 某一天的计划快照与容量 |
| TaskOccurrence | 某天某任务的实际执行实例 |
| ImportBatch | 一次导入的批次、状态、问题 |
| NotificationChannel | 企微群机器人配置 |
| NotificationOutbox | 出站消息队列 |
| File | 上传文件元数据 |
| Job | 异步任务状态 |
| AiRun | AI 调用审计 |
| AuditLog | 重要写操作审计 |

### 3.2 任务状态机

**模板 `tasks.status`**

```text
draft → active → archived
```

- `draft`：路线草稿中的任务，不进入今日。
- `active`：可被每日编排选中。
- `archived`：不再参与编排，保留历史。

**执行实例 `task_occurrences.status`**

```text
pending → in_progress → completed
（Phase 3：completed → pending_review → reviewed）
pending / in_progress → postponed / skipped / blocked / abandoned
blocked → pending
```

| 当前 | 动作 | 下一状态 | 副作用 |
|---|---|---|---|
| pending | start | in_progress | 写 started_at |
| in_progress | complete | completed | 写 completed_at、actual_minutes |
| completed | review（Phase 3） | pending_review / reviewed | Phase 3 使用；Phase 1 停在 completed |
| pending/in_progress | postpone | postponed | 创建次日 occurrence，写 carry_over_from_id |
| pending/in_progress | skip | skipped | 写 skip_reason；任务 `planned_date` 置空，不再自动进入今日 |
| pending/in_progress | block | blocked | 写 block_reason |
| blocked | unblock | pending | 清除 block_reason |
| pending/in_progress/blocked | abandon | abandoned | 终态；任务 `status=archived`，不计完成率 |
| pending/in_progress | split | 子 occurrence | 写 parent_occurrence_id、split_index |

**规则**

- `task_occurrences` 是今日列表、完成率、顺延、看板的唯一真源。
- 一个任务同一天可以有多个拆分实例，唯一键包含 `split_index`。
- `postponed` 是旧实例的终态；新实例才是下一天的可执行项。
- `abandoned` 不计入完成率分母，单独展示“已放弃”。
- Phase 1 完成任务停在 `completed`；`pending_review/reviewed` 仅为 Phase 3 预留。

### 3.3 路线状态机

```text
draft → active → paused → active
active → completed
active / paused / completed → archived
```

- 导入确认后默认 `active`；开始日期在未来也可以 `active`，只是当天没有任务。
- 一个求职目标同一时间只允许一条 `active` 路线；切换路线先暂停旧路线。
- 所有 active 任务完成且无未完成 occurrence 时，可提示“路线已完成”；Phase 1 由用户手动完成/归档。
- Phase 1 不做 `pending_confirm`，导入预览在 `import_batch` 里完成确认。

### 3.4 导入状态机

```text
uploaded → parsing → needs_review → confirmed
                    ↘ failed
confirmed → rolled_back
uploaded/parsing/needs_review → cancelled
```

- `needs_review`：解析完成，有预览和问题清单，等待用户确认。
- `confirmed`：已创建路线/任务，事务提交。
- `rolled_back`：仅允许未产生执行记录的批次回滚。
- `failed`：解析或 AI 失败，保留原文，允许重试/手动创建。

### 3.5 通知状态机

```text
pending → sending → sent
                 ↘ failed → pending（重试）
                          ↘ dead（超过最大次数）
```

- 唯一键 `(user_id, dedup_key)`，重复入队不重复发送。
- 重试间隔：1 分钟、5 分钟、30 分钟；最多 3 次。
- `dead` 需要能在设置页看到并支持手动重发。

### 3.6 不变量

1. 所有业务表必须有 `user_id`，查询必须带 `user_id`。
2. `daily_plans(user_id, plan_date)` 唯一。
3. `task_occurrences(user_id, task_id, occurrence_date, split_index)` 唯一。
4. 一个 `job_target` 同时只有一条 `active` 路线。
5. 路线开始日期 ≤ 结束日期；任务的 `planned_date` 在路线范围内。
6. 任务必须有 `title`、`task_type`、`estimated_minutes`、`deliverable`、`acceptance`。
7. 导入确认必须幂等：同一批次重复确认只创建一次。
8. 通知同一 `(user_id, dedup_key)` 只发一次。
9. 删除/归档路线不影响已完成 occurrence 和历史统计。

---

## 4. 数据模型

### 4.1 约定

- MySQL 8.0，InnoDB，utf8mb4。
- 主键 `char(36)` UUID，应用层生成。
- 时间戳存 UTC；`date` 字段按用户时区计算。
- 所有表含 `created_at`、`updated_at`；可恢复数据含 `deleted_at`。
- 金额/比例用 `decimal`，时长用 `int` 分钟。
- JSON 字段必须有应用层 Schema 校验。
- 软删除只用于用户可见对象；任务实例不做软删除。

### 4.2 ERD

```text
users
  ├── refresh_tokens
  ├── user_profiles
  ├── job_targets
  │     └── routes
  │           ├── route_versions
  │           ├── route_stages
  │           │     └── route_weeks
  │           └── tasks
  │                 ├── task_dependencies
  │                 └── task_occurrences
  ├── daily_plans
  │     └── daily_plan_items
  ├── import_batches
  │     ├── import_items
  │     └── import_issues
  ├── notification_channels
  ├── notification_preferences
  ├── notification_outbox
  ├── files
  ├── jobs
  ├── ai_runs
  └── audit_logs
```

### 4.3 Phase 1 表清单

| 表 | 用途 | 关键约束 |
|---|---|---|
| users | 账号 | email/phone 唯一 |
| refresh_tokens | 刷新令牌 | token_hash 唯一 |
| user_profiles | 档案/容量 | user_id 主键 |
| user_consents | AI 解析/隐私授权 | (user_id, scope, version) 唯一 |
| job_targets | 目标岗位 | 一个主目标（应用层） |
| routes | 路线 | 一个目标一条 active |
| route_versions | 路线快照 | (route_id, version_no) 唯一 |
| route_stages | 阶段 | route_id + order_no |
| route_weeks | 周目标 | (stage_id, week_no) 唯一 |
| tasks | 任务模板 | title/type/est/deliverable/acceptance 非空 |
| task_dependencies | 依赖 | (task_id, depends_on_task_id) 唯一 |
| recurring_rules | 周期规则 | 预留 |
| daily_plans | 每日计划 | (user_id, plan_date) 唯一 |
| daily_plan_items | 计划项 | (daily_plan_id, occurrence_id) 唯一 |
| task_occurrences | 执行实例 | (user_id, task_id, date, split_index) 唯一 |
| import_batches | 导入批次 | status |
| import_items | 导入项 | batch_id |
| import_issues | 导入问题 | batch_id |
| files | 文件 | user_id |
| notification_channels | 通知渠道 | user_id |
| notification_templates | 通知模板 | (code, channel_type, locale, version) 唯一 |
| notification_preferences | 通知偏好 | (user_id, event_type, channel_id) 唯一 |
| notification_outbox | 出站队列 | (user_id, dedup_key) 唯一 |
| jobs | 异步任务 | user_id + type |
| ai_runs | AI 审计 | user_id |
| audit_logs | 审计 | user_id + action |

完整 DDL 见 [schema.sql](schema.sql)。以下只列关键字段和口径。

### 4.4 关键字段

`user_profiles` 保存 `daily_available_minutes`、`planning_capacity_factor`、`day_boundary_time`（默认 04:00）、偏好时间段；`users.timezone` 保存时区。`/settings` 读写这些字段。

`user_consents` 保存 `scope`（Phase 1 至少 `ai_import`、`privacy_policy`）、`version`、`granted_at`、`revoked_at`；首次导入前必须取得 `ai_import` 同意。

#### `tasks`（模板）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | char(36) | PK |
| user_id | char(36) | 归属 |
| route_id/stage_id/week_id | char(36) | 可空；导入/手动路线任务关联 |
| title | varchar(300) | 动作 + 对象 |
| description | text | 具体做什么 |
| learning_objective | text | 学习目标 |
| task_type | varchar(32) | algorithm/fundamentals/engineering/project/resume/apply/review/interview/reflection |
| priority | varchar(16) | P0/P1/P2 |
| estimated_minutes | int | 预计时长 |
| planned_date | date | 计划执行日；可空（周期任务） |
| due_date | date | 截止日；可空 |
| deliverable | text | 产出要求，必填 |
| acceptance_criteria | text | 验收标准，必填 |
| resources_json | json | 推荐资料/题目 |
| capability_tags_json | json | Phase 1 用自由标签；Phase 3 映射能力词典 |
| needs_review | tinyint | Phase 3 复习标记 |
| is_splittable | tinyint | 是否可拆分 |
| source_type | varchar(32) | imported/manual/recurring/ai_generated/review |
| source_id | char(36) | 导入批次/规则/错题 ID |
| status | varchar(32) | draft/active/archived |

#### `task_occurrences`（执行实例）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | char(36) | PK |
| user_id | char(36) | 归属 |
| task_id | char(36) | 模板 |
| daily_plan_id | char(36) | 可空 |
| occurrence_date | date | 用户时区日期 |
| timezone | varchar(64) | 生成时区 |
| status | varchar(32) | 见状态机 |
| priority_snapshot | varchar(16) | 生成时优先级 |
| planned_minutes | int | 计划时长 |
| actual_minutes | int | 实际耗时，可空 |
| remaining_minutes | int | 剩余工作量 |
| carry_over_from_id | char(36) | 来源实例 |
| postpone_count | int | 顺延次数 |
| skip_reason/block_reason | varchar(500) | 原因 |
| note | text | 用户备注 |
| started_at/completed_at | datetime | UTC |
| reviewed_at | datetime | Phase 3 |
| split_index | int | 拆分序号，默认 0 |
| parent_occurrence_id | char(36) | 拆分父实例 |

#### `daily_plans` / `daily_plan_items`

- `daily_plans`：`user_id`、`plan_date`、`capacity_minutes`、`status`、`generated_at`、`generation_version`、`summary_json`。
- `daily_plan_items`：`daily_plan_id`、`task_occurrence_id`、`order_no`、`planned_minutes`、`is_optional`。
- `summary_json` 保存“今日聚焦”、每项入选原因、被延期任务、容量使用情况。

#### `routes` / `route_stages` / `route_weeks`

- `routes`：`job_target_id`、`title`、`status`、`source_type`、`source_id`、`start_date`、`end_date`、`daily_capacity_minutes`、`forecast_end_date`、`current_version`。
- `route_stages`：`route_id`、`name`、`objective`、`order_no`、`start_date`、`end_date`、`weight`、`exit_criteria`。
- `route_weeks`：`stage_id`、`week_no`、`focus`、`milestone`、`start_date`、`end_date`。

#### `import_batches` / `import_items` / `import_issues`

- `import_batches`：`file_id`、`format`、`status`、`parser_version`、`ai_run_id`、`summary_json`、`error_json`。
- `import_items`：`batch_id`、`source_locator`（行号/标题）、`normalized_json`、`status`、`error_json`。
- `import_issues`：`batch_id`、`item_id`、`severity`、`code`、`message`、`suggestion`。

#### 通知相关

- `notification_channels`：`channel_type`、`name`、`config_ciphertext`、`status`、`quiet_hours_json`、`last_test_at`、`last_error`。
- `notification_templates`：`code`、`channel_type`、`locale`、`subject`、`body`、`version`、`status`。
- `notification_preferences`：`event_type`、`channel_id`、`enabled`、`send_time`、`timezone`、`quiet_hours_behavior`。
- `notification_outbox`：`template_code`、`payload_json`、`dedup_key`、`status`、`retry_count`、`next_retry_at`、`sent_at`、`last_error`。

### 4.5 索引与约束

```text
users(email) UNIQUE
users(phone) UNIQUE
refresh_tokens(token_hash) UNIQUE
job_targets(user_id, status)
routes(user_id, status)
routes(job_target_id, status)
route_versions(route_id, version_no) UNIQUE
route_weeks(stage_id, week_no) UNIQUE
daily_plans(user_id, plan_date) UNIQUE
task_occurrences(user_id, task_id, occurrence_date, split_index) UNIQUE
task_occurrences(user_id, occurrence_date, status) INDEX
task_occurrences(user_id, status, remaining_minutes) INDEX
notification_outbox(user_id, dedup_key) UNIQUE
notification_outbox(status, next_retry_at) INDEX
import_batches(user_id, created_at) INDEX
ai_runs(user_id, created_at) INDEX
audit_logs(user_id, created_at) INDEX
```

### 4.6 迁移与种子数据

- Alembic 管理迁移，禁止手改生产库。
- 种子数据：
  - 默认通知模板（早报/晚报/逾期/顺延/周总结）。
  - 默认用户设置（容量系数 0.8，日界线 04:00，时区 Asia/Shanghai）。
  - 演示路线（可选，仅开发环境）。
- Phase 2/3 新表通过增量迁移加入，不修改 Phase 1 已有字段语义。

### 4.7 Phase 2/3 预留表

只列名字，Phase 1 不建：

- Phase 2：`practice_sessions`、`code_submissions`、`evaluations`、`rubrics`、`rubric_versions`。
- Phase 3：`diagnoses`、`resume_versions`、`dilemmas`、`daily_quizzes`、`daily_quiz_items`、`answers`、`answer_turns`、`daily_reviews`、`mistakes`、`knowledge_points`、`review_schedules`、`review_attempts`、`review_settings`、`devices`、`device_tokens`、`local_projects`、`capability_definitions`、`user_capabilities`、`capability_evidence`、`capability_snapshots`、`route_forecast_history`、`weekly_reports`。

---

## 5. API 契约

### 5.1 通用约定

- Base path：`/api/v1`。
- 认证：`Authorization: Bearer <access_token>`。
- 请求/响应：JSON，UTF-8；日期 `YYYY-MM-DD`；时间 ISO 8601 UTC。
- 分页：`page`（从 1 开始）、`page_size`（默认 20，最大 100）；响应 `items`、`total`、`page`、`page_size`。
- 幂等：POST 支持 `Idempotency-Key`，服务端保存 24 小时。
- 异步：返回 `202 { "job_id": "..." }`；用 `GET /jobs/{id}` 查询。
- 错误：

```json
{
  "error": {
    "code": "IMPORT_VALIDATION_FAILED",
    "message": "导入计划存在 3 个错误",
    "details": { "issues": 3 },
    "request_id": "..."
  }
}
```

- 权限：所有业务查询强制当前用户；Phase 1 只有 `user` 角色。
- 限流：登录 5 次/分钟/IP；导入 3 次/小时/用户；通知测试 5 次/小时/用户。

### 5.2 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录 |
| POST | `/auth/refresh` | 刷新 |
| POST | `/auth/logout` | 撤销当前 refresh token |

登录响应：

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 1800,
  "user": { "id": "...", "email": "...", "timezone": "Asia/Shanghai" }
}
```

### 5.3 档案与目标

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/PUT | `/profile` | 档案、每日可用时间、容量系数 |
| GET/POST | `/job-targets` | 列表/创建 |
| PATCH/DELETE | `/job-targets/{id}` | 编辑/归档 |
| GET/PUT | `/settings` | 时区、日界线、通知默认值 |
| GET/PUT | `/consents` | 查询/记录 AI 解析与隐私授权 |

### 5.4 文件与导入

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/files/presign` | 获取上传 URL |
| POST | `/files/{id}/complete` | 上传完成回调 |
| POST | `/imports` | 创建导入（file_id 或 multipart） |
| GET | `/imports/{id}` | 批次状态 |
| GET | `/imports/{id}/preview` | 预览树 + 问题清单 |
| PATCH | `/imports/{id}/preview` | 修改预览项并重新校验 |
| POST | `/imports/{id}/confirm` | 确认导入 |
| POST | `/imports/{id}/cancel` | 取消 |
| POST | `/imports/{id}/rollback` | 回滚 |

创建导入响应：

```json
{ "import_id": "...", "job_id": "...", "status": "queued" }
```

预览响应：

```json
{
  "import_id": "...",
  "status": "needs_review",
  "route": {
    "title": "30 天后端冲刺",
    "start_date": "2026-10-20",
    "end_date": "2026-11-18",
    "stages": [
      {
        "name": "基础夯实",
        "objective": "补齐计网/OS/DB",
        "weeks": [
          {
            "week_no": 1,
            "focus": "网络基础",
            "milestone": "能讲清 TCP 握手",
            "tasks": [
              {
                "title": "TCP 三次握手",
                "task_type": "fundamentals",
                "planned_date": "2026-10-20",
                "estimated_minutes": 45,
                "deliverable": "口述录音/笔记",
                "acceptance_criteria": "不看资料讲清状态机",
                "source_locator": "line 12"
              }
            ]
          }
        ]
      }
    ]
  },
  "issues": [
    {
      "severity": "warning",
      "code": "MISSING_ACCEPTANCE",
      "message": "任务缺少验收标准，已生成建议",
      "suggestion": "补充：能不看资料讲清三次握手"
    }
  ],
  "stats": { "stages": 3, "weeks": 6, "tasks": 42, "total_minutes": 1680 }
}
```

确认响应：

```json
{ "route_id": "...", "status": "active", "created_tasks": 42 }
```

### 5.5 路线/阶段/周/任务

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/routes` | 列表/手动创建 |
| GET/PATCH | `/routes/{id}` | 详情/编辑标题/日期/容量 |
| POST | `/routes/{id}/activate` | 激活 |
| POST | `/routes/{id}/pause` | 暂停 |
| POST | `/routes/{id}/resume` | 恢复 |
| POST | `/routes/{id}/archive` | 归档 |
| POST | `/routes/{id}/adjust` | 调整开始日期/日容量 |
| GET | `/routes/{id}/versions` | 版本列表 |
| GET | `/routes/{id}/versions/{no}` | 版本详情 |
| POST/PATCH/DELETE | `/routes/{id}/stages` | 阶段 CRUD |
| POST/PATCH/DELETE | `/stages/{id}/weeks` | 周 CRUD |
| GET/POST | `/tasks` | 任务列表/创建 |
| PATCH/DELETE | `/tasks/{id}` | 任务编辑/归档 |

路线详情响应至少包含：

```json
{
  "id": "...",
  "title": "...",
  "status": "active",
  "start_date": "...",
  "end_date": "...",
  "forecast_end_date": "...",
  "progress": { "completed_tasks": 12, "total_tasks": 42, "percent": 28.6 },
  "stages": [
    {
      "id": "...",
      "name": "...",
      "order_no": 1,
      "weeks": [
        {
          "id": "...",
          "week_no": 1,
          "focus": "...",
          "tasks": [
            {
              "id": "...",
              "title": "...",
              "task_type": "fundamentals",
              "estimated_minutes": 45,
              "planned_date": "...",
              "status": "active"
            }
          ]
        }
      ]
    }
  ]
}
```

**删除语义**

- `DELETE /tasks/{id}` = 归档（`status=archived`），不物理删除。
- `POST /routes/{id}/archive` = 归档，不物理删除。
- 阶段/周下还有任务时，删除返回 `409`；先移动或归档任务。
- 历史 `task_occurrences` 不删除；任务归档不影响已完成记录和看板统计。

### 5.6 今日与任务执行

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/today` | 今日计划 + 任务 |
| POST | `/today/generate` | 手动触发生成（幂等） |
| POST | `/task-occurrences/{id}/start` | 开始 |
| POST | `/task-occurrences/{id}/complete` | 完成，body 可带 actual_minutes/note |
| POST | `/task-occurrences/{id}/postpone` | 延期到明天 |
| POST | `/task-occurrences/{id}/skip` | 跳过，body 带 reason |
| POST | `/task-occurrences/{id}/block` | 阻塞，body 带 reason |
| POST | `/task-occurrences/{id}/unblock` | 解除阻塞 |
| POST | `/task-occurrences/{id}/abandon` | 放弃 |
| PATCH | `/task-occurrences/{id}` | 备注、实际耗时、剩余分钟 |
| POST | `/task-occurrences/{id}/split` | 拆分 |

今日响应：

```json
{
  "date": "2026-10-20",
  "timezone": "Asia/Shanghai",
  "capacity_minutes": 192,
  "summary": {
    "planned_tasks": 4,
    "completed_tasks": 2,
    "planned_minutes": 150,
    "actual_minutes": 95,
    "completion_rate": 0.5
  },
  "items": [
    {
      "occurrence_id": "...",
      "task_id": "...",
      "title": "TCP 三次握手",
      "task_type": "fundamentals",
      "stage_name": "基础夯实",
      "week_focus": "网络基础",
      "source_type": "imported",
      "why": "本周重点 + 计划日期到期",
      "status": "pending",
      "planned_minutes": 45,
      "actual_minutes": null,
      "is_optional": false,
      "carry_over": false
    }
  ],
  "carry_over": [
    { "occurrence_id": "...", "title": "LRU 缓存", "postpone_count": 1 }
  ]
}
```

### 5.7 看板

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/dashboard/overview?range=7d` | 总览 |
| GET | `/dashboard/trends?range=30d` | 每日趋势 |
| GET | `/dashboard/distribution?range=7d` | 类型/阶段分布 |
| GET | `/dashboard/forecast` | 路线预测 |

总览响应：

```json
{
  "range": "7d",
  "completion": {
    "planned_tasks": 24,
    "completed_tasks": 16,
    "completion_rate": 0.667,
    "planned_minutes": 960,
    "actual_minutes": 720
  },
  "carry_over": { "count": 5, "rate": 0.208 },
  "active_days": 5,
  "cumulative_active_days": 12,
  "route": {
    "id": "...",
    "progress_percent": 28.6,
    "forecast_end_date": "2026-11-25",
    "target_end_date": "2026-11-18",
    "risk": "behind"
  },
  "time": { "estimated_vs_actual_ratio": 1.12 },
  "capability": { "status": "locked", "message": "完整能力评估将在后续阶段开放" }
}
```

### 5.8 通知

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/notification-channels` | 列表/创建 |
| PATCH/DELETE | `/notification-channels/{id}` | 编辑/删除 |
| POST | `/notification-channels/{id}/test` | 测试发送 |
| GET | `/notification-templates` | 模板列表 |
| GET/PUT | `/notification-preferences` | 偏好读写 |
| GET | `/notification-outbox?status=failed` | 失败消息 |

创建渠道：

```json
{
  "channel_type": "wecom_group_bot",
  "name": "恒序提醒群",
  "webhook_url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
}
```

响应只返回脱敏：

```json
{
  "id": "...",
  "channel_type": "wecom_group_bot",
  "name": "恒序提醒群",
  "webhook_masked": "https://qyapi.weixin.qq.com/...key=****",
  "status": "active"
}
```

### 5.9 异步任务

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/jobs/{id}` | 查询 Job |

```json
{
  "id": "...",
  "type": "import_normalization",
  "status": "running",
  "progress": 0.6,
  "result_ref": "import:...",
  "error": null
}
```

### 5.10 错误码

| code | HTTP | 说明 |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | 登录失败 |
| `AUTH_TOKEN_EXPIRED` | 401 | Token 过期 |
| `FORBIDDEN` | 403 | 越权 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 422 | 参数校验失败 |
| `IMPORT_PARSE_FAILED` | 422 | 解析失败 |
| `IMPORT_VALIDATION_FAILED` | 422 | 导入校验不通过 |
| `IMPORT_ALREADY_CONFIRMED` | 409 | 重复确认 |
| `ROUTE_CAPACITY_EXCEEDED` | 422 | 路线容量超限 |
| `TASK_STATE_INVALID` | 409 | 任务状态不允许该操作 |
| `NOTIFICATION_CHANNEL_INVALID` | 422 | Webhook 不合法 |
| `NOTIFICATION_SEND_FAILED` | 502 | 发送失败 |
| `AI_PROVIDER_ERROR` | 502 | AI 调用失败 |
| `RATE_LIMITED` | 429 | 限流 |

### 5.11 Phase 1 端点总表

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/profile
PUT    /api/v1/profile
GET    /api/v1/settings
PUT    /api/v1/settings
GET    /api/v1/consents
PUT    /api/v1/consents

GET    /api/v1/job-targets
POST   /api/v1/job-targets
PATCH  /api/v1/job-targets/{id}
DELETE /api/v1/job-targets/{id}

POST   /api/v1/files/presign
POST   /api/v1/files/{id}/complete

POST   /api/v1/imports
GET    /api/v1/imports/{id}
GET    /api/v1/imports/{id}/preview
PATCH  /api/v1/imports/{id}/preview
POST   /api/v1/imports/{id}/confirm
POST   /api/v1/imports/{id}/cancel
POST   /api/v1/imports/{id}/rollback

GET    /api/v1/routes
POST   /api/v1/routes
GET    /api/v1/routes/{id}
PATCH  /api/v1/routes/{id}
POST   /api/v1/routes/{id}/activate
POST   /api/v1/routes/{id}/pause
POST   /api/v1/routes/{id}/resume
POST   /api/v1/routes/{id}/archive
POST   /api/v1/routes/{id}/adjust
GET    /api/v1/routes/{id}/versions
GET    /api/v1/routes/{id}/versions/{no}
POST   /api/v1/routes/{id}/stages
PATCH  /api/v1/routes/{id}/stages/{stage_id}
DELETE /api/v1/routes/{id}/stages/{stage_id}
POST   /api/v1/stages/{id}/weeks
PATCH  /api/v1/stages/{id}/weeks/{week_id}
DELETE /api/v1/stages/{id}/weeks/{week_id}
GET    /api/v1/tasks
POST   /api/v1/tasks
PATCH  /api/v1/tasks/{id}
DELETE /api/v1/tasks/{id}

GET    /api/v1/today
POST   /api/v1/today/generate
POST   /api/v1/task-occurrences/{id}/start
POST   /api/v1/task-occurrences/{id}/complete
POST   /api/v1/task-occurrences/{id}/postpone
POST   /api/v1/task-occurrences/{id}/skip
POST   /api/v1/task-occurrences/{id}/block
POST   /api/v1/task-occurrences/{id}/unblock
POST   /api/v1/task-occurrences/{id}/abandon
PATCH  /api/v1/task-occurrences/{id}
POST   /api/v1/task-occurrences/{id}/split

GET    /api/v1/dashboard/overview
GET    /api/v1/dashboard/trends
GET    /api/v1/dashboard/distribution
GET    /api/v1/dashboard/forecast

GET    /api/v1/notification-channels
POST   /api/v1/notification-channels
PATCH  /api/v1/notification-channels/{id}
DELETE /api/v1/notification-channels/{id}
POST   /api/v1/notification-channels/{id}/test
GET    /api/v1/notification-templates
GET    /api/v1/notification-preferences
PUT    /api/v1/notification-preferences
GET    /api/v1/notification-outbox

GET    /api/v1/jobs/{id}
```

---

## 6. 核心算法

### 6.1 导入解析与标准化

**目标**：把非结构化 Markdown 变成可执行的任务，并保留来源与不确定性。

**流水线**

```text
1. 文件校验（大小、编码、扩展名）
2. 文本抽取 + 基础清洗
3. 规则解析：标题层级/列表/checkbox/表格/日期
4. AI 标准化：输出 RouteDraft JSON
5. Schema 校验 + 业务校验
6. 生成预览 + 问题清单
7. 用户编辑
8. 确认落库
```

**规则解析**

- `#`/`##`/`###` 映射为阶段/周/任务组。
- 无序列表、`- [ ]`、数字列表映射为任务。
- 表格列名匹配：任务、日期、时长、产出、验收、类型、优先级。
- 日期格式：`YYYY-MM-DD`、`MM/DD`、`第 N 天`、`第 N 周`。
- 无法识别的段落保留为 `source_text`，交给 AI。

**AI 输出 Schema**

```json
{
  "route": {
    "title": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "stages": [
      {
        "name": "string",
        "objective": "string",
        "weeks": [
          {
            "week_no": 1,
            "focus": "string",
            "milestone": "string",
            "tasks": [
              {
                "title": "string",
                "task_type": "algorithm|fundamentals|engineering|project|resume|apply|review|interview|reflection",
                "planned_date": "YYYY-MM-DD|null",
                "estimated_minutes": 45,
                "learning_objective": "string",
                "description": "string",
                "deliverable": "string",
                "acceptance_criteria": "string",
                "priority": "P0|P1|P2",
                "resources": ["string"],
                "capability_tags": ["string"],
                "source_locator": "line 12",
                "assumptions": ["string"]
              }
            ]
          }
        ]
      }
    ]
  },
  "assumptions": ["string"],
  "warnings": ["string"]
}
```

**业务校验**

- 必填：title、task_type、estimated_minutes、deliverable、acceptance_criteria。
- 日期：在路线范围内；无日期按周/容量顺序分配，并标记 `assumption`。
- 开始日期早于今天：提示用户选择“从今天开始整体平移”或“保留历史（过去任务归档，不进入今日）”；默认平移。
- 容量：单日 ≤ 有效容量；总量 ≤ 天数 × 有效容量 × 0.8。
- 单任务 15–120 分钟；超过 120 分钟标记 `TOO_LONG`，建议拆分。
- 依赖：Phase 1 导入不强制依赖；如果有前置描述，存为 `task_dependencies`，检测自环。
- 重复：同 title + planned_date 标记 warning。
- 能力标签：Phase 1 只做自由标签，不校验词典。
- 缺失验收/产出：AI 生成建议并标记 warning，用户必须确认。

**失败降级**

- AI 失败：保留规则解析结果，状态 `needs_review`，允许手动补全。
- Schema 校验失败：自动修复一次；仍失败则标记 `failed`，保留原文。
- 解析置信度低：预览顶部提示“建议逐项检查”。

**AI 调用约束**

- 输入只包含计划文本和必要上下文，不发送用户其他数据。
- 计划文本按“不可信数据”处理，使用分隔符和明确指令，防 Prompt Injection。
- 输出必须通过 JSON Schema；失败重试一次。
- 记录 `ai_runs`：provider、model、prompt_version、input_hash、output、token、latency。
- AI 不得直接写库；只能生成预览。

### 6.2 每日计划生成

**触发**

- Celery Beat 每 15 分钟扫描；按用户时区，在 06:00–08:00 之间生成当日计划。
- 用户打开 `/today` 时，如果当天没有计划，同步触发一次（幂等）。

**输入池**

1. 已顺延的 occurrence（`postponed` 的来源）。
2. 路线任务：所属路线 `status=active`、`tasks.status=active`、`planned_date ≤ today`、没有已完成 occurrence。
3. 周期规则实例（Phase 1 预留，默认关闭）。
4. 用户手动添加的今日任务。

**排除规则**

- 排除今天已有 occurrence 的任务，避免与顺延重复创建。
- 排除 `archived` 任务；`skip` 会把任务 `planned_date` 置空，用户可在路线详情重新排期；`abandon` 会归档任务。
- 生成前先执行顺延，确保 carry-over occurrence 已存在；顺延与生成在同一用户锁内完成。

**容量**

```text
daily_capacity = floor(user.daily_available_minutes × planning_capacity_factor)
planning_capacity_factor 默认 0.8，允许 0.6–1.0
if daily_capacity < 30: daily_capacity = 30
```

**优先级**

```text
1. 顺延任务（carry_over_from_id 非空）
2. 必做路线任务（priority=P0）
3. 普通路线任务（P1/P2）
4. 周期任务
5. 可选任务
同一优先级：due_date 早 → stage.order_no 小 → priority 高 → 预计时长短
```

**选择**

- 先放顺延任务；如果顺延任务超过容量，全部放入并标记 `over_capacity`，提示用户拆分/放弃，不静默截断。
- 再放路线任务，直到容量用尽或达到 6 项。
- 预留 10% 容量给临时任务；如果容量不足，允许超 10% 但提示。
- 单任务 >120 分钟：如果可拆分，拆成 60–90 分钟的子任务；否则整块排入并提示。
- 没有任务也创建空计划，便于推送和看板。

**幂等**

- `daily_plans(user_id, plan_date)` 唯一。
- `task_occurrences(user_id, task_id, occurrence_date, split_index)` 唯一。
- 重复生成：返回已有计划，不重复创建；如果任务池变化，只补充缺失项，不删除已完成项。

**解释**

`summary_json` 保存：

```json
{
  "focus": "今天先把昨天没做完的 TCP 收尾",
  "capacity_minutes": 192,
  "planned_minutes": 150,
  "selected": [
    { "task_id": "...", "reason": "顺延任务 + 本周重点" }
  ],
  "deferred": [
    { "task_id": "...", "reason": "容量不足，未排入今日，后续按容量重排" }
  ]
}
```

### 6.3 未完成顺延

**触发**

- 用户时区日界线（默认 04:00）后。
- 或在生成次日计划前执行。

**步骤**

1. 找 `occurrence_date < today` 且状态为 `pending`、`in_progress`、`blocked` 的实例。
2. 计算 `remaining_minutes`：
   - 用户填了剩余分钟：用用户值。
   - 否则：`max(planned_minutes - actual_minutes, 15)`。
3. 创建今天的 occurrence：
   - `task_id` 不变，`occurrence_date=today`；`pending`/`in_progress` 新实例为 `pending`，`blocked` 保持 `blocked` 并复制 `block_reason`。
   - `carry_over_from_id=旧实例`，`postpone_count=旧值+1`。
   - `planned_minutes=remaining_minutes`。
4. 旧实例标记 `postponed`。
5. 如果 `postpone_count >= 3`，在今日页和通知里提示“建议拆分/降级/放弃”。
6. 更新路线预测日期。

`blocked` 不自动变成 `pending`；用户在今日页点“解除阻塞”后才进入正常执行。

**容量回流，不硬移日期**

- 后续路线任务不改 `planned_date`；每日编排按容量重新选择。
- 如果连续顺延导致预测日期超过目标日期，看板提示风险，并建议降低强度/延长周期。
- 这样避免“一天没完成，整条路线日期全部平移”的雪崩。

**通知**

- 顺延发生后发一条企微消息：
  - 顺延了几项。
  - 预计完成日期变化。
  - 今日重点。

### 6.4 预测完成日期

**剩余工作量**

```text
remaining_minutes =
  Σ occurrence.remaining_minutes（未完成、未跳过、未放弃）
  + Σ task.estimated_minutes（尚未生成 occurrence 的 active 任务）
```

**有效吞吐**

```text
recent_days = 最近 14 天有实际完成记录的天数
if recent_days >= 5:
  throughput = median(每日 actual_minutes)
else:
  throughput = daily_capacity
throughput = max(throughput, 30)
```

**预测**

```text
forecast_days = ceil(remaining_minutes / throughput)
forecast_end_date = today + forecast_days
```

- 可加 10% buffer：`forecast_days = ceil(remaining_minutes / throughput * 1.1)`。
- 如果 `forecast_end_date > route.end_date` 或 `> job_target.target_date`，看板标记 `behind`。
- 每次任务完成/顺延/路线调整后重算，写回 `routes.forecast_end_date`。
- Phase 3 增加 `route_forecast_history`，用于“预测偏差”指标。

### 6.5 看板指标

**Phase 1 只做执行指标**

| 指标 | 定义 | 数据源 |
|---|---|---|
| 计划任务数 | 期间内 daily_plan_items 数 | daily_plan_items |
| 完成任务数 | status=completed 的 occurrence 数 | task_occurrences |
| 任务完成率 | 完成任务数 / 计划任务数 | 同上 |
| 计划分钟 | Σ planned_minutes | daily_plan_items |
| 实际分钟 | Σ actual_minutes | task_occurrences |
| 时间偏差 | 实际分钟 / 计划分钟 | 同上 |
| 顺延数 | carry_over_from_id 非空的 occurrence 数 | task_occurrences |
| 顺延率 | 顺延数 / 计划任务数 | 同上 |
| 活跃天数 | 至少完成 1 项的天数 | task_occurrences |
| 累计活跃天数 | 历史有完成记录的天数（不清零） | task_occurrences |
| 路线进度 | 已完成任务数 / 路线总任务数 | tasks/occurrences |
| 预测完成日期 | 见 6.4 | routes |
| 风险 | 预测日期 > 目标日期 | routes/job_targets |

**口径说明**

- 完成率分母不包含 `abandoned`；`skipped` 计入分母但不计入完成。
- `postponed` 计入原计划日分母、不计完成；新 occurrence 计入新计划日。因此周完成率是“occurrence 口径”，跨天顺延的任务会被重复计入；唯一任务口径 Phase 1.5 再补。
- 路线进度按 `task_id` 去重：一个任务只要有一个 `completed` occurrence 即算完成；`archived`/`abandoned` 任务不计入总数。
- 计划分钟以 `daily_plan_items.planned_minutes` 为准；实际分钟以 occurrence 为准。
- 没有实际分钟时，完成任务的分钟按计划分钟计入，并标注“估算”。
- 累计活跃天数不是连续打卡，避免断签焦虑。

**Phase 2 追加**

- 算法代码评分趋势（不做能力准备度）。
- 代码评审次数、平均分、改进项完成率。

**Phase 3 追加**

- 多维能力掌握度、目标达成度、准备度、证据覆盖率、7/30 天趋势。
- 预测偏差、路线调整率、复习指标。

### 6.6 周总结

**时间**：周日 20:00（用户时区）。

**内容**

```text
本周完成率、完成任务数、实际分钟
活跃天数、顺延率
时间分布（算法/八股/工程/项目/其他）
路线进度、预测完成日期
下周重点（取路线下一周 focus）
一句话建议（规则生成，不调用 AI）
```

Phase 1 不生成完整周报页面，只发企微消息；完整周报 Phase 3。

### 6.7 Phase 2/3 算法预留

**Phase 2 代码评审 Rubric**

| 维度 | 权重 | 看什么 |
|---|---|---|
| 正确性 | 35 | 边界、异常、约束、逻辑 |
| 复杂度 | 20 | 时间/空间分析与实现一致 |
| 代码质量 | 20 | 命名、结构、可读性 |
| 测试与验证 | 15 | 自测结果、用例覆盖 |
| 表达与复盘 | 10 | 思路、复杂度、改进 |

- 输入：代码文件、语言、题目、难度、用户自测结果、思路说明。
- 输出：分数、维度分、证据（文件/行号）、优点、≤3 条改进、追问、置信度、`not_evaluated`。
- 不执行代码；无法判断正确性时标 `not_evaluated`，不编造。
- 正确性维度展示为“静态风险（低/中/高）+ 自测通过率”，不显示“AC/正确”结论；没有自测结果时只给静态风险，不给正确性分。
- Phase 2 只记录评分与证据；完整能力模型 Phase 3。

**Phase 3 复习调度**

```json
{
  "first_review_after_days": 1,
  "intervals": [1, 4, 7, 14],
  "max_interval_days": 60,
  "reset_on_wrong": true
}
```

- 首次复习：学习后第 2 天。
- 之后：+1、+4、+7、+14 天，对应第 3/7/14/28 天。
- 答错：回退一阶段，次日重现。
- 答对低置信度：重复当前阶段。
- 答对高置信度：进入下一阶段。
- 超过最后阶段：倍率 + 上限，进入长期复习。

**Phase 3 能力聚合**

- 证据来源权重：代码 1.0、工程 1.0、八股/项目 0.8、自评 0.3、外部测评 0.6。
- 时间衰减半衰期 30 天。
- 证据数 ≥3 且置信度 ≥0.5 才算 `assessed`。
- readiness 只在已评估能力上加权，并展示证据覆盖率。
- 详细公式在 Phase 3 设计文档展开。

---

## 7. 通知设计

### 7.1 渠道

Phase 1 只支持企业微信群机器人。

**配置流程**

1. 创建内部群。
2. 添加群机器人，复制 Webhook。
3. 在恒序设置页粘贴 Webhook，点“发送测试”。
4. 配置提醒时间、免打扰、事件开关。

未配置渠道时不发推送，但今日页和看板仍可用；设置页提示“未配置推送”。

**Webhook 安全**

- 只允许 `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...`。
- 校验 scheme、host、path；禁止重定向；超时 10 秒；限制响应大小。
- `key` 加密存储（AES-GCM/Fernet），日志脱敏。
- 接口返回只给 `webhook_masked`。
- 支持重新配置、删除、测试。

### 7.2 事件与模板

| 事件 | 默认时间 | 触发条件 | 去重键 |
|---|---|---|---|
| 早报 | 07:30 | 今日计划已生成 | `morning:{date}` |
| 晚报 | 20:30 | 今日有未完成任务 | `evening:{date}` |
| 逾期 | 20:00 | 有逾期 occurrence | `overdue:{date}` |
| 顺延 | 日界线后 | 发生顺延 | `carry:{date}` |
| 周总结 | 周日 20:00 | 本周有任务 | `weekly:{iso_week}` |
| 任务开始 | 关闭 | 用户手动开启 | `start:{occurrence_id}` |

**模板变量**

```text
{date} {weekday} {planned_tasks} {completed_tasks}
{completion_rate} {planned_minutes} {actual_minutes}
{carry_count} {forecast_date} {route_title}
{today_link} {settings_link}
```

**早报示例**

```text
【恒序 · 今日】10/20 周二
今日 4 项，预计 2h30m
重点：TCP 三次握手 + 项目架构图
完成 2/4 即达标
→ 打开今日：https://app.example.com/today
```

**晚报示例**

```text
【恒序 · 收尾】今日完成 2/4，完成率 50%
实际 95 分钟｜顺延 2 项到明天
明天重点：先收尾 TCP，再做项目图
→ 打开今日：https://app.example.com/today
```

**顺延示例**

```text
【恒序 · 顺延】2 项任务移到今天
预计完成日期：11/25（原 11/18）
建议：今天先做顺延任务，再开新任务
```

### 7.3 偏好与免打扰

`notification_preferences` 按事件配置：

- 是否开启。
- 发送时间（早报/晚报/周总结）。
- 渠道。
- 免打扰行为：`delay`（延迟到静默结束）或 `drop`（丢弃）。
- 时区。

默认：

- 早报 07:30，晚报 20:30，周总结周日 20:00。
- 免打扰 23:00–07:00；早报延迟，逾期/顺延丢弃。

### 7.4 Outbox 与重试

- 业务事务只写 `notification_outbox`，不直接调企微。
- Worker 每 30 秒扫描 `pending` 且 `next_retry_at <= now`。
- 重试：1 分钟、5 分钟、30 分钟；3 次后 `dead`。
- `dead` 在设置页可见，支持手动重发。
- 发送前检查 `(user_id, dedup_key)`，已发则跳过。
- 企微返回 `errcode != 0` 视为失败，记录 `errmsg`。

### 7.5 限制

- 群机器人单向推送，不能读回复。
- 不支持个人私聊。
- 消息长度和频率按企微官方限制；系统内做合并/截断。
- Markdown 语法差异要适配；链接必须完整 URL。
- 外部群/跨企业群可能有限制，按实际后台能力配置。

---

## 8. 前端信息架构

### 8.1 页面地图（Phase 1）

| 路由 | 页面 | 关键内容 |
|---|---|---|
| `/login` | 登录 | 登录/注册 |
| `/onboarding` | 引导 | 档案 → 目标 → 每日时间 → 导入计划 |
| `/import` | 导入 | 上传、解析进度、预览、问题、确认 |
| `/routes` | 路线列表 | 当前/暂停/归档 |
| `/routes/{id}` | 路线详情 | 阶段/周/任务、编辑、调整、版本 |
| `/today` | 今日 | 容量、任务、状态、顺延、备注 |
| `/dashboard` | 进度看板 | 完成率、趋势、时间分布、预测 |
| `/settings/profile` | 档案 | 时区、每日时间、容量系数 |
| `/settings/notifications` | 通知 | 企微配置、测试、时间、免打扰、事件开关 |

Phase 2 新增 `/practice`、`/practice/{id}`、`/dashboard` 算法区块；Phase 3 新增 `/quiz`、`/mistakes`、`/routes/generate`、`/settings/review`。

### 8.2 关键页面

#### 引导页

- 步骤 1：时区、每日可用分钟、容量系数（默认 0.8）。
- 步骤 2：目标岗位、目标日期。
- 步骤 3：导入计划或“先手动创建路线”。
- 步骤 4：配置企微（可跳过，稍后配置）。
- 每步可返回；进度保存；刷新不丢。

#### 导入页

- 上传区：拖拽/选择 `.md`；限制 5MB。
- 首次导入前展示“计划文本会发送给第三方 AI 解析”的授权说明；用户同意后记录 `ai_import` 同意。
- 解析进度：上传 → 解析 → AI 标准化 → 校验。
- 预览：左侧阶段/周/任务树，右侧问题清单；任务可内联编辑。
- 顶部统计：阶段数、周数、任务数、总分钟、问题数。
- 底部：取消、重新解析、确认导入。
- 错误：解析失败显示原文和“手动创建”；校验失败标红到具体字段。

#### 今日页

- 顶部：日期、容量使用条、完成率、顺延数。
- 任务卡：类型标签、阶段/周、来源、预计时长、状态、入选原因。
- 操作：开始、完成（可填实际分钟/备注）、延期、跳过（原因）、阻塞（原因）、放弃、拆分。
- 顺延区：显示从昨天移来的任务和 `postpone_count`。
- 空状态：今日无任务 + “去导入/调整路线”。
- 完成状态：今日完成，显示明日预告（如果有）。

#### 路线详情

- 时间轴：阶段 → 周 → 任务。
- 进度：完成数/总数、百分比、预测日期。
- 编辑：任务增删改、调整开始日期/日容量、暂停/恢复/归档。
- 版本：查看导入/手动调整的历史快照（Phase 1 只读）。

#### 看板

- 总览卡：完成率、计划/实际分钟、活跃天数、顺延率。
- 趋势图：最近 7/30 天完成率/实际分钟。
- 分布图：任务类型、阶段。
- 路线卡：进度、预测日期、风险。
- 能力区：Phase 1 显示“完整能力评估将在后续阶段开放”，不显示假分数。

#### 通知设置

- 渠道卡：企微群机器人，Webhook 输入、测试、状态、删除。
- 事件开关：早报/晚报/逾期/顺延/周总结。
- 时间：早报、晚报、周总结。
- 免打扰：开始/结束、延迟/丢弃。
- 失败消息：查看 `dead`，手动重发。

### 8.3 组件

- `TaskCard`：标题、类型、阶段、来源、估时、状态、操作。
- `CapacityBar`：计划/实际/剩余。
- `CompletionRing`：完成率。
- `TrendChart`：7/30 天折线。
- `DistributionChart`：类型/阶段条形。
- `ImportTree`：阶段/周/任务，支持内联编辑。
- `IssueList`：error/warning，跳转到字段。
- `ChannelForm`：Webhook 输入、测试、脱敏展示。
- `EmptyState`、`ErrorState`、`LoadingState`。

### 8.4 状态与错误

- 空：无路线、无任务、无导入、无通知渠道。
- 加载：导入解析、AI 标准化、今日生成。
- 错误：文件格式、解析失败、校验失败、AI 失败、通知失败。
- 部分：任务部分完成、实际分钟未填、导入有 warning。
- 权限：未登录、Token 过期。
- 时区：跨日、顺延、今日无计划。

### 8.5 设计约束

- 移动优先：今日页在手机上可完成全部操作。
- 桌面优先：导入预览、路线详情、看板在桌面更好用。
- 中文文案；时间/日期按用户时区。
- 颜色只用于状态，不搞复杂游戏化。
- 不做“连续打卡清零”，显示累计活跃天数。

---

## 9. 安全、隐私与运维

### 9.1 认证与授权

- 密码 Argon2id。
- Access Token 30 分钟；Refresh Token 30 天，哈希存储、轮换、可撤销。
- 所有业务查询带 `user_id`；Phase 1 只有 `user` 角色。
- 登录限流 5 次/分钟/IP；失败锁定 15 分钟（5 次）。
- Phase 1 不做邮箱验证/密码找回，Phase 1.5 补。

### 9.2 数据隔离

- 每张业务表有 `user_id`。
- Repository 层强制注入当前用户；禁止前端传 `user_id` 作为过滤条件。
- 集成测试覆盖越权访问。

### 9.3 文件与导入安全

- 只允许 `.md`/`.markdown`，5MB，UTF-8。
- 首次导入前获取 `ai_import` 同意，记录 scope/version；撤销后停止新导入。
- MIME sniffing；拒绝可执行文件。
- 文件名不参与存储路径；用 UUID。
- 导入内容按不可信数据处理；HTML 导入 Phase 1.5 必须清洗脚本/样式。
- AI Prompt 使用分隔符；禁止把计划内容当指令。

### 9.4 Webhook SSRF

- 只允许 HTTPS + `qyapi.weixin.qq.com` + `/cgi-bin/webhook/send`。
- 禁止重定向、内网 IP、`file://`、`gopher://`。
- 超时 10 秒；响应大小 ≤ 64KB。
- Webhook key 加密存储；日志脱敏。

### 9.5 密钥与日志

- JWT secret、加密 key 从环境变量/Secrets Manager 读取。
- 对象存储启用服务端加密；文件访问使用短时签名 URL。
- 日志不输出密码、Token、Webhook、完整计划文本。
- AI 请求记录 input_hash，不默认保存全文；需要排障时加密保存并设置保留期。
- 审计日志记录导入确认、路线调整、通知配置变更、批量删除。

### 9.6 备份与迁移

- MySQL 每日全量备份 + binlog；保留 7 天。
- 对象存储版本化/生命周期。
- Alembic 迁移；发布前在 staging 跑迁移和回滚。
- 迁移失败自动回滚；备份恢复演练每季度一次。

### 9.7 监控与告警

- API：QPS、P95、4xx/5xx、DB 慢查询。
- Celery：队列长度、失败率、重试、死信。
- AI：调用成功率、Token、延迟、Schema 失败率。
- 通知：发送成功率、失败原因、dead 数。
- 业务：日计划生成数、导入成功率、活跃用户。
- 告警：5xx > 1%、队列积压 > 100、通知失败 > 5%、AI 失败 > 10%。

### 9.8 数据导出/删除

- Phase 1.5：导出 JSON/CSV + 文件；异步 Job；预签名 URL 24 小时。
- Phase 1.5：账号删除；软删除 + 异步清理对象存储；保留审计日志最小集。
- Phase 3：第三方 AI 侧删除请求（如供应商支持）。

---

## 10. 测试与验收

### 10.1 测试策略

| 层 | 内容 |
|---|---|
| 单元 | Markdown 解析、校验、日计划、顺延、预测、指标、去重、SSRF 校验 |
| 集成 | 上传→导入→预览→确认；今日生成→完成→看板；Outbox→发送 |
| E2E | 注册→档案→导入→今日→完成→看板→推送 |
| AI 评测 | 10 份 Markdown 样本，检查 Schema 合法率、任务完整率、日期正确率 |
| 安全 | 越权、Token 过期、文件类型、Webhook SSRF、Prompt Injection |
| 迁移 | 空库迁移、旧版本升级、回滚 |

### 10.2 关键测试用例

1. 结构化 Markdown：3 阶段/6 周/42 任务 → 解析 ≥80%，日期/时长正确。
2. 半结构化 Markdown：只有周计划、无日期 → 按容量分配，标记 assumptions。
3. 混乱 Markdown：大量自然语言 → AI 失败/低置信度 → 保留原文，允许手动。
4. 导入确认重复调用 → 只创建一次路线。
5. 导入回滚 → 路线归档/删除，原路线不受影响。
6. 今日生成重复触发 → 只有一条 daily_plan，occurrence 不重复。
7. 完成任务 → 看板完成率/实际分钟更新。
8. 延期 → 次日 occurrence 创建，旧实例 postponed，postpone_count+1。
9. 连续延期 3 次 → 今日页/通知提示拆分/放弃。
10. 预测日期：剩余 600 分钟，吞吐 120 分钟/天 → 5 天（+10% buffer → 6 天）。
11. 通知去重：同一 dedup_key 入队两次 → 只发一次。
12. 通知失败：企微返回 errcode ≠ 0 → 重试 3 次 → dead。
13. Webhook 非白名单 → 422，不发起请求。
14. 用户 A 访问用户 B 的路线 → 404/403。
15. 时区：Asia/Shanghai 与 America/Los_Angeles 的今日/顺延日期正确。

### 10.3 Phase 1 验收标准

1. 用户能注册/登录，设置时区、每日可用时间、目标岗位。
2. 能上传 Markdown 计划，60 秒内完成解析（结构化样本），预览阶段/周/任务和问题。
3. 能在预览中修改任务字段并重新校验；确认后生成路线/任务。
4. 能手动新增/编辑/删除任务、阶段、周。
5. 能生成今日计划：3–6 项、容量 ≤ 有效容量、重复触发不重复。
6. 今日页能开始/完成/延期/跳过/阻塞/解除/放弃/备注/填实际分钟。
7. 未完成能自动顺延，次日出现，旧实例标记 postponed，预测日期更新。
8. 看板能展示完成率、计划/实际分钟、趋势、类型分布、顺延率、路线进度、预测日期；数字与数据库一致。
9. 能配置企微 Webhook、发送测试消息；早报/晚报/逾期/顺延/周总结按时间发送。
10. 通知失败能重试，dead 消息可见并手动重发；同一消息不重复。
11. 导入失败不影响已有路线；回滚可用。
12. 所有业务接口按用户隔离；越权返回 404/403；Webhook SSRF 被拦截。
13. E2E 流程跑通；关键操作有审计日志。
14. 页面在手机和桌面可用；空态/加载/错误态完整。
15. 首次导入前必须取得 `ai_import` 同意；未同意时只能手动创建路线，不调用 AI。

### 10.4 性能目标

| 项 | 目标 |
|---|---|
| 页面 P95 | < 1.5s |
| 今日接口 P95 | < 500ms |
| 导入解析（结构化 5k 字） | < 60s |
| 日计划生成 | < 5s/用户 |
| 通知发送 | < 10s/条（含队列） |
| 看板查询 | < 1s（30 天） |

### 10.5 上线检查

- 数据库迁移 + 备份。
- 种子数据（通知模板、默认设置）。
- 环境变量/密钥。
- 监控/告警。
- 限流/日志脱敏。
- 回滚方案。
- 真实 Markdown 样本回归。

---

## 11. 开发计划

### 11.1 里程碑

| 里程碑 | 周期（单人，参考） | 产出 |
|---|---|---|
| M1 基础骨架 | 1 周 | 项目结构、auth、profile、文件上传、迁移 |
| M2 导入流水线 | 1.5 周 | Markdown 解析、AI 标准化、校验、预览 API |
| M3 路线与任务 | 1 周 | 路线/阶段/周/任务 CRUD、确认导入、版本 |
| M4 每日跟踪 | 1.5 周 | 日计划生成、今日页、状态、实际耗时、顺延 |
| M5 看板 | 1 周 | 总览、趋势、分布、预测 |
| M6 通知 | 1 周 | 渠道、模板、偏好、Outbox、企微发送/重试 |
| M7 硬化 | 1 周 | 测试、监控、文档、上线检查 |

总计约 7–8 周。AI 导入质量、前端交互和企微配置可能增加 1–2 周。

### 11.2 任务拆解

**后端**

- Auth：注册/登录/刷新/撤销；Refresh Token 表。
- Profile/Target：CRUD、容量系数。
- File：预签名、完成回调、文件记录。
- Import：规则解析、AI 调用、Schema 校验、预览、确认、回滚。
- Route：路线/阶段/周/任务 CRUD、版本。
- Planning：日计划生成、顺延、预测、occurrence 状态。
- Dashboard：聚合查询、口径。
- Notification：渠道、模板、偏好、Outbox、Worker、企微适配器。
- Jobs：统一异步任务。
- Audit：关键操作。

**前端**

- 登录/引导。
- 导入上传/预览/编辑/确认。
- 路线列表/详情/编辑。
- 今日页/任务操作。
- 看板。
- 通知设置。
- 空态/错误态/移动适配。

**AI**

- 导入 Prompt + JSON Schema。
- 10 份样本评测。
- 失败重试/降级。
- Prompt 版本记录。

**测试/运维**

- 单元/集成/E2E。
- 安全测试。
- 监控/告警。
- 备份/回滚。

### 11.3 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| Markdown 格式差异大 | 导入成功率低 | 规则解析 + AI + 预览编辑；先支持结构化模板 |
| AI 输出不稳定 | 预览不可用 | JSON Schema + 修复一次 + 降级手动 |
| 看板口径不一致 | 用户不信任 | 统一指标定义 + 对账测试 |
| 顺延导致计划雪崩 | 用户放弃 | 容量回流 + 3 次提示 + 预测风险 |
| 企微配置门槛 | 推送用不起来 | 引导页 + 测试消息 + 失败提示 |
| 通知频率过高 | 用户反感 | 默认只发早报/晚报/顺延；事件可关 |
| 范围蔓延到代码评审 | Phase 1 延期 | 明确 Phase 1 不含 practice/evaluation |
| 时区/日界线错误 | 今日任务错天 | 用户时区 + 日界线配置 + 测试 |

### 11.4 Phase 2 进入条件

- Phase 1 连续 7 天真实使用，导入/今日/看板/推送稳定。
- 任务状态、实际耗时、顺延数据可对账。
- 有至少 20 条真实任务数据，用于看板口径校验。
- 明确代码评审输入格式（文件/语言/题目/自测结果）。
- 确定评分 Rubric 和“未评估”语义。

### 11.5 Phase 2 范围（代码评审）

- 代码提交：网页上传/粘贴；语言、题目、难度、自测结果、思路说明。
- AI 静态评审：正确性/复杂度/代码质量/测试/表达；证据行号；≤3 条改进；追问。
- 评审历史、重新评审、人工修正。
- 看板：算法评分趋势、评审次数、平均分。
- 不包含：代码执行/沙箱、Git 自动同步、IDE 插件、CLI。
- 数据表：practice_sessions、code_submissions、evaluations、rubrics、rubric_versions。
- 验收：提交到评分 <60s；证据可定位；无证据标未评估；历史可查。

### 11.6 Phase 3 范围（其余）

- AI 诊断 + 路线生成（简历/困境/目标）。
- 八股/项目每日提问 + 追问。
- 错题本 + 自适应间隔复习（D-01）。
- 完整能力看板（岗位要求/权重/证据聚合/趋势）。
- 每日复盘/周报。
- CLI/Git/IDE 插件。
- 平台入口链接（固定 URL，不传数据）。
- HTML 导入、数据导出/删除、管理能力、多渠通知。
- 迁移策略：只加表/加字段，不改 Phase 1 语义；用 feature flag 控制。

---

## 12. 附录

### 12.1 术语

| 术语 | 含义 |
|---|---|
| Route | 一条学习路线 |
| Stage | 路线阶段 |
| Week | 阶段下的周目标 |
| Task | 任务模板 |
| Occurrence | 某天某任务的实际执行实例 |
| DailyPlan | 某天的计划快照 |
| Carry-over | 未完成顺延 |
| Forecast | 预计完成日期 |
| Outbox | 通知出站队列 |
| Job | 异步任务 |

### 12.2 枚举

**task_type**：algorithm, fundamentals, engineering, project, resume, apply, review, interview, reflection

**task.status**：draft, active, archived

**occurrence.status**：pending, in_progress, completed, pending_review, reviewed, postponed, skipped, blocked, abandoned

**route.status**：draft, active, paused, completed, archived

**import.status**：uploaded, parsing, needs_review, confirmed, failed, cancelled, rolled_back

**notification.status**：pending, sending, sent, failed, dead

**job.status**：queued, running, succeeded, failed, cancelled

### 12.3 导入 Markdown 模板

```markdown
# 30 天后端冲刺

- 开始：2026-10-20
- 结束：2026-11-18
- 每日可用：120 分钟

## 阶段一：基础夯实（10/20 - 11/02）

### 第 1 周：网络基础

- [ ] TCP 三次握手（45 分钟）
  - 产出：口述录音/笔记
  - 验收：不看资料讲清状态机
- [ ] HTTP 缓存（45 分钟）
  - 产出：思维导图
  - 验收：能区分强缓存/协商缓存

### 第 2 周：操作系统

- [ ] 进程与线程（60 分钟）
  - 产出：笔记
  - 验收：能讲清上下文切换
```

### 12.4 关键决策摘要

- 先计划、后评审、再智能：Phase 1 不依赖 AI 诊断。
- 日状态只认 occurrence。
- 看板先执行、后能力。
- 顺延用容量回流，不硬移日期。
- 通知只做单向推送。
- 所有 AI 输出结构化、可追溯、需确认。

---

**附**：完整 DDL 见 [schema.sql](schema.sql)。
