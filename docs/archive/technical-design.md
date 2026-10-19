# 恒序 persistLog 系统技术方案设计

## 1. 文档说明

- 系统名称：恒序 persistLog
- 文档类型：系统技术方案设计
- 版本：V1.0
- 主要语言：Python
- 核心数据库：MySQL 8.0+
- 架构策略：先采用模块化单体，保留后续拆分为服务的边界

本文档根据《产品需求分析》设计第一版可落地的系统方案。设计目标是优先支持稳定迭代和业务闭环，不在早期引入过多分布式组件。

## 2. 技术选型结论

| 层次 | 推荐技术 | 选择原因 |
| --- | --- | --- |
| 后端 API | Python + FastAPI | 异步友好、类型清晰、适合 AI 和文件处理 |
| 数据访问 | SQLAlchemy 2.x + Alembic | 类型安全、迁移成熟、适合 MySQL |
| 数据库 | MySQL 8.0 | 事务、JSON、全文索引、团队熟悉度高 |
| 缓存与队列 | Redis | 缓存、分布式锁、任务队列和限流均可使用 |
| 异步任务 | Celery + Redis | AI 调用、导入、通知和日任务生成均需要异步执行 |
| 文件存储 | S3 兼容对象存储，开发环境使用 MinIO | 保存简历、导入文件、代码产物和报告 |
| 前端 | React + TypeScript + Next.js | 适合复杂任务交互和服务端渲染 |
| UI | Ant Design 或 shadcn/ui | 快速搭建管理类和工作台页面 |
| AI 编排 | LangGraph + LangChain Core + 自建 AI Gateway | LangGraph 管理有状态流程，LangChain 提供模型和提示词通用能力，Gateway 负责业务隔离、审计和可靠性 |
| 向量检索 | V1 使用 MySQL 全文检索，P1 引入 Qdrant | 先降低部署复杂度，后续支持知识库和语义检索 |
| 本地代码助手 | Python + Typer | 跨平台、易发布、可复用后端数据模型 |
| 认证 | JWT + Refresh Token；外部平台 V1 只使用普通链接或深链接 | 满足独立登录和入口跳转，暂不引入账号打通 |
| 部署 | Docker Compose 起步，Kubernetes 作为后续方案 | 降低第一版部署和运维成本 |
| 监控 | Prometheus + Grafana + Loki 或 OpenTelemetry | 观察 API、任务、AI 和通知链路 |

## 3. 架构原则

### 3.1 模块化单体优先

V1 不建议一开始拆成多个微服务。使用一个 Python 后端仓库，通过领域模块隔离业务边界：

```text
api/
  auth/
  profile/
  diagnosis/
  route/
  planning/
  practice/
  review/
  notification/
  import_plan/
  integration/
  report/
```

各模块通过应用服务和领域事件交互，禁止直接依赖其他模块的 ORM 内部实现。这样既能减少部署复杂度，也能为后续拆分服务保留边界。

### 3.2 同步请求与异步任务分离

适合在请求内完成的操作：

- 登录和用户档案修改。
- 查询今日任务。
- 修改任务状态。
- 查看复习记录。

必须异步执行的操作：

- 简历解析。
- AI 诊断和路线生成。
- AI 评分和每日复盘。
- Markdown/HTML 导入。
- 每日任务生成。
- 错题复习任务创建。
- 通知发送。
- 本地代码上传和分析。

### 3.3 数据先落库，再执行 AI

用户输入、文件、任务和练习结果必须先写入数据库，再提交 AI 任务。AI 失败后可以重试，不会丢失用户输入。

### 3.4 AI 输出必须结构化

所有会进入业务数据的 AI 输出都要求使用 JSON Schema 或 Pydantic 模型校验。自然语言内容只作为展示字段，任务、路线、评分和错题必须有结构化字段。

## 4. 总体架构

```text
                         ┌─────────────────────┐
                         │ React / Next.js Web │
                         └──────────┬──────────┘
                                    │ HTTPS
                         ┌──────────▼──────────┐
                         │ Nginx / API Gateway │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────▼──────────────────┐
                 │ Python FastAPI 模块化单体              │
                 │ auth profile route planning practice │
                 │ review notification import          │
                 └─────┬──────────┬──────────┬──────────┘
                       │          │          │
                ┌──────▼───┐ ┌────▼─────┐ ┌──▼──────────┐
                │ MySQL 8  │ │ Redis    │ │ Object Store│
                │ 业务数据  │ │ cache/job│ │ MinIO / S3  │
                └──────────┘ └────┬─────┘ └─────────────┘
                                  │
                         ┌────────▼────────┐
                         │ Celery Workers  │
                         │ AI/import/notify│
                         └───────┬─────────┘
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
      ┌──────▼────────────┐ ┌──────▼──────────┐  ┌──────▼───────┐
      │ LangGraph +       │ │ WeCom Group Bot │  │ Local Agent  │
      │ LangChain + AI GW │ │ notification    │  │ code sync    │
      └───────────────────┘ └─────────────────┘  └──────────────┘
```

## 5. 服务和模块边界

### 5.1 Auth 模块

职责：

- 注册、登录、刷新 Token。
- 用户注销。
- 产品内部登录和 Token 刷新。
- 设备和本地 Agent 注册。
- 登录安全和限流。

不负责用户简历和学习数据。

### 5.2 Profile 模块

职责：

- 用户基础档案。
- 求职目标。
- 简历版本。
- 困境记录。
- 隐私授权。

### 5.3 Diagnosis 模块

职责：

- 创建诊断任务。
- 聚合简历、目标岗位、困境和历史数据。
- 调用 AI Gateway。
- 保存诊断报告和能力差距。

### 5.4 Route 模块

职责：

- 创建和管理学习路线。
- 管理路线版本、阶段和周目标。
- 生成路线草案。
- 接受、暂停、恢复和归档路线。
- 将路线任务交给 Planning 模块。

### 5.5 Planning 模块

职责：

- 日计划、周计划和周期性任务。
- 任务依赖。
- 每日任务实例化。
- 每日容量和优先级排序。
- 延期、跳过和阻塞处理。

### 5.6 Practice 模块

职责：

- 算法、八股、工程化和项目表达练习。
- 练习材料和题目。
- 代码、答案和产物记录。
- 练习状态。

### 5.7 Evaluation 模块

职责：

- AI 问题生成。
- 回答评估。
- 代码和工程方案评估。
- 评分证据保存。

为了保持边界清晰，评价逻辑可以独立为模块，但数据仍由 Practice 和 Review 关联。

### 5.8 Review 模块

职责：

- 每日复盘。
- 错题管理。
- 复习阶段和下次复习时间。
- 复习回答记录。
- 创建复习任务。

### 5.9 Notification 模块

职责：

- 通知渠道配置。
- 通知模板。
- 通知出站队列。
- 重试和去重。
- 发送结果记录。

### 5.10 Import 模块

职责：

- 文件上传和格式识别。
- Markdown/HTML 解析。
- AI 标准化。
- 导入预览。
- 用户确认后写入路线。

### 5.11 Integration 模块

职责：

- 管理求职平台入口链接配置。
- 提供跳转到求职平台的入口。
- 提供跳转到恒序的目标页面。

V1 不接收外部业务数据，不提供账号打通、测评导入、错题同步或任务状态回传。

## 6. 推荐代码目录

```text
persistlog/
├── apps/
│   ├── api/
│   │   ├── main.py
│   │   ├── dependencies.py
│   │   └── routers/
│   ├── worker/
│   │   ├── celery_app.py
│   │   └── tasks/
│   └── scheduler/
├── domain/
│   ├── auth/
│   ├── profile/
│   ├── diagnosis/
│   ├── route/
│   ├── planning/
│   ├── practice/
│   ├── evaluation/
│   ├── review/
│   ├── notification/
│   ├── import_plan/
│   └── integration/
├── infrastructure/
│   ├── db/
│   ├── cache/
│   ├── storage/
│   ├── ai/
│   ├── messaging/
│   └── observability/
├── migrations/
├── tests/
├── scripts/
├── alembic.ini
├── pyproject.toml
├── docker-compose.yml
└── .env.example
```

每个领域模块建议包含：

```text
module/
├── models.py
├── schemas.py
├── repository.py
├── service.py
├── events.py
├── tasks.py
└── router.py
```

## 7. MySQL 数据模型

### 7.1 通用约定

- 主键使用 `BIGINT` 或 UUID。推荐应用层生成 UUID，避免暴露递增用户数量。
- 所有表包含 `created_at`、`updated_at`。
- 可恢复数据使用 `deleted_at` 软删除。
- 状态字段使用字符串枚举，由 Python Enum 和数据库约束共同管理。
- 长文本和 AI 输出使用 `TEXT` 或 `JSON`。
- 多租户或未来企业版可预留 `tenant_id`。
- 所有用户业务表必须包含 `user_id`，避免跨用户查询。

### 7.2 用户和档案

#### `users`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | char(36) | 用户 ID |
| email | varchar(255) | 邮箱，可为空 |
| phone | varchar(32) | 手机号，可为空 |
| password_hash | varchar(255) | 密码哈希 |
| status | varchar(32) | active、disabled、deleted |
| timezone | varchar(64) | 用户时区，默认 Asia/Shanghai |
| last_login_at | datetime | 最近登录时间 |

#### `user_profiles`

保存学历、专业、技术栈、每日可用时长、计划容量系数、个人介绍等信息。

推荐字段：

```text
user_id, daily_available_minutes,
planning_capacity_factor, preferred_start_time,
preferred_end_time, timezone
```

#### `job_targets`

保存目标岗位、城市、行业、目标日期和优先级。一个用户可以有多个目标，但同一时间只有一个主目标。

#### `resume_versions`

保存简历版本、原始文件地址、解析文本、解析结构、解析状态和版本号。

建议字段：

```text
id, user_id, file_id, title, version_no, raw_text,
parsed_json, status, is_current, created_at
```

#### `dilemmas`

保存用户在某一时间提交的困境描述和上下文。

### 7.3 AI 诊断和路线

#### `diagnoses`

保存诊断输入快照、能力差距、建议、模型版本和生成状态。

#### `routes`

核心字段：

```text
id, user_id, job_target_id, diagnosis_id, title,
status, start_date, end_date, daily_capacity_minutes,
forecast_end_date, current_version, source_type, created_at
```

`source_type` 包括：`ai_generated`、`manual`、`imported`。

#### `route_versions`

每次 AI 重新生成、用户确认或批量调整都产生版本。

#### `route_stages`

保存阶段目标、顺序、能力标签和预计周期。

#### 能力看板数据

`capability_definitions` 保存目标岗位需要的能力项，例如 MySQL、贪心算法、系统设计和项目表达。

```text
id, code, name, category, description,
target_roles_json, parent_id, default_target_level
```

`user_capabilities` 保存用户在某个目标下的当前掌握度和目标要求。

```text
id, user_id, job_target_id, capability_id,
current_level, target_level, progress_percent,
status, confidence, last_assessed_at
```

`capability_evidence` 保存支撑能力判断的证据，例如任务完成、代码评估、八股回答和错题复习。

```text
id, user_capability_id, source_type, source_id,
score, evidence_summary, evidence_json, created_at
```

能力看板的 AI 总结只能基于 `capability_evidence` 生成；没有足够证据时状态为 `unassessed`。

### 7.4 计划和任务

#### `plans`

表示日计划、周计划或周期计划。

```text
id, user_id, route_id, plan_type, title,
start_date, end_date, status, source_type
```

#### `tasks`

表示任务模板或业务任务定义。

```text
id, user_id, plan_id, route_stage_id, title, description,
task_type, priority, estimated_minutes, due_date,
acceptance_criteria_json, output_requirements_json,
status, source_type, is_splittable, remaining_minutes,
original_due_date, effective_due_date, carry_over_count
```

#### `task_occurrences`

表示某个任务在某一天的实际执行实例。这个表用于处理周期任务、延期任务和复习任务。

```text
id, user_id, task_id, occurrence_date, timezone,
status, priority_snapshot, estimated_minutes, remaining_minutes,
carry_over_from_id, auto_shift_reason,
started_at, completed_at, unique_key
```

唯一索引：

```text
unique(user_id, task_id, occurrence_date)
```

#### `task_dependencies`

保存前置任务关系，防止路线调整时丢失依赖。

#### `recurring_rules`

保存周期规则，例如每天、每周一三五或每隔 N 天。

### 7.5 练习和评估

#### `practice_sessions`

保存一次练习活动。

```text
id, user_id, task_occurrence_id, practice_type,
title, started_at, submitted_at, status, metadata_json
```

#### `questions`

保存算法题、八股题、工程题和项目追问题。

#### `answers`

保存用户回答文本、代码地址、附件地址和提交版本。

#### `evaluations`

保存 AI 或规则评价。

```text
id, user_id, answer_id, evaluator_type,
score_json, evidence_json, feedback_text,
confidence, model_name, prompt_version
```

`evidence_json` 用于记录评分所依据的回答片段、代码片段或测试结果。

### 7.6 错题和复习

#### `mistakes`

保存用户的错题主体、错误类型、知识标签和当前掌握程度。

#### `review_schedules`

保存复习阶段和下次复习时间。

```text
id, mistake_id, user_id, stage_index,
scheduled_date, status, interval_days,
last_result, completed_at
```

#### `review_attempts`

保存每次复习回答、结果、评分和 AI 反馈。

### 7.7 文件、AI 和审计

#### `notification_channels`

保存用户的通知渠道配置。V1 的 `channel_type` 为 `wecom_group_bot`。

```text
id, user_id, channel_type, secret_ciphertext,
status, timezone, quiet_hours_json,
last_test_at, last_error, created_at, updated_at
```

`secret_ciphertext` 保存企业微信群机器人 Webhook 的加密值，接口返回时只返回脱敏结果。

#### `files`

保存对象存储地址、文件类型、大小、哈希、扫描状态和归属用户。

#### `ai_runs`

保存每次 AI 请求的可追踪信息：

```text
id, user_id, run_type, provider, model,
prompt_version, input_hash, input_snapshot,
output_json, status, token_usage_json,
latency_ms, error_code, created_at
```

敏感原文可配置为只保存哈希或加密存储。

#### `audit_logs`

记录重要写入操作，例如路线确认、批量删除、隐私授权变更、入口链接配置变更和 AI 自动创建任务。

## 8. API 设计

API 使用 REST 风格，版本前缀为 `/api/v1`。后续可为实时任务进度增加 WebSocket 或 Server-Sent Events。

### 8.1 认证

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### 8.2 档案和简历

```text
GET  /api/v1/profile
PUT  /api/v1/profile
POST /api/v1/resumes
GET  /api/v1/resumes
POST /api/v1/job-targets
GET  /api/v1/job-targets
```

### 8.3 诊断和路线

```text
POST /api/v1/diagnoses
GET  /api/v1/diagnoses/{id}
POST /api/v1/routes/generate
GET  /api/v1/routes
GET  /api/v1/routes/{id}
POST /api/v1/routes/{id}/accept
POST /api/v1/routes/{id}/pause
POST /api/v1/routes/{id}/resume
POST /api/v1/routes/{id}/regenerate
```

路线生成返回异步任务 ID：

```json
{
  "job_id": "job_123",
  "status": "queued"
}
```

### 8.4 今日任务

```text
GET  /api/v1/today
POST /api/v1/tasks
PATCH /api/v1/tasks/{id}
POST /api/v1/tasks/{id}/start
POST /api/v1/tasks/{id}/complete
POST /api/v1/tasks/{id}/postpone
POST /api/v1/tasks/{id}/block
```

### 8.5 成长看板

```text
GET /api/v1/dashboard/overview
GET /api/v1/dashboard/capabilities
GET /api/v1/dashboard/timeline
GET /api/v1/dashboard/evidence
```

`overview` 返回总体准备度、路线完成率、计划执行率、预计完成日期和风险提示；`capabilities` 返回能力当前掌握度、目标要求、差距和证据；`timeline` 返回路线预计结束日期及顺延记录。

推荐计算方式：

```text
目标达成度 = min(当前掌握度 / 目标掌握度, 1) × 100%
预计剩余天数 = 剩余任务分钟数 / 有效每日计划容量
预计完成日期 = 当前日期 + 预计剩余天数 + 历史顺延修正
```

总体准备度按目标岗位能力权重加权计算，不直接使用任务数量代替能力掌握度。

### 8.6 练习和复盘

```text
POST /api/v1/practice-sessions
POST /api/v1/practice-sessions/{id}/submit
POST /api/v1/evaluations
POST /api/v1/daily-reviews
GET  /api/v1/daily-reviews/{date}
POST /api/v1/questions/generate
POST /api/v1/answers/{id}/evaluate
```

### 8.7 错题和复习

```text
GET  /api/v1/mistakes
GET  /api/v1/reviews/today
POST /api/v1/mistakes/{id}/review
PATCH /api/v1/review-schedules/{id}
```

### 8.8 文件导入

```text
POST /api/v1/imports
GET  /api/v1/imports/{id}
GET  /api/v1/imports/{id}/preview
POST /api/v1/imports/{id}/confirm
POST /api/v1/imports/{id}/cancel
```

### 8.9 外部平台入口链接

V1 不需要外部平台数据接口。链接可以由前端配置、环境变量或后台管理配置提供：

```text
GET /api/v1/integrations/entry-links
```

返回可展示的入口名称和 URL，例如：

```json
{
  "items": [
    {
      "code": "job_platform",
      "title": "进入求职辅助平台",
      "url": "https://job.example.com"
    }
  ]
}
```

V1 不提供 `handoff`、外部事件接收、数据同步、SSO 或一次性 Token 接口。用户点击链接后，在目标系统内独立登录和操作。

## 9. AI 编排与 AI Gateway 设计

### 9.1 推荐组合

恒序建议使用以下分层，而不是让业务模块直接调用 LangChain：

```text
业务模块
  ↓
AI Workflow Service
  ↓
LangGraph StateGraph
  ├── LangChain Chat Model / Prompt / Structured Output
  ├── 业务规则节点
  ├── 人工确认节点
  └── 持久化和审计节点
  ↓
AI Gateway
  ↓
不同模型供应商
```

各技术的职责如下：

- **LangGraph**：编排多步骤、有状态、可暂停和可恢复的 AI 工作流。
- **LangChain Core**：提供 Chat Model 适配、提示词模板、结构化输出、工具调用和可选的检索组件。
- **自建 AI Gateway**：统一模型路由、超时、重试、限流、成本统计、敏感数据处理、Prompt 版本和审计。
- **Pydantic**：定义业务级输入输出 Schema，确保 AI 结果能够安全写入 MySQL。
- **Celery**：承载异步触发和后台执行；LangGraph 负责一次 AI 工作流内部的节点流转。

React 与 AI 编排没有替代关系。React + TypeScript + Next.js 负责 Web 前端，展示路线生成进度、AI 追问、复盘结果和人工确认界面。

如果这里的“react”指的是 **ReAct（Reasoning + Acting）Agent 模式**，建议只用于开放式的求职问答、资料检索和工具调用，不作为路线生成和复习调度的主流程。路线生成、每日计划和错题复习更适合使用可控的 LangGraph 状态图，避免模型自由决策导致重复创建任务或绕过业务规则。

### 9.2 为什么使用 LangGraph

恒序不是一次性问答产品。它需要处理中间状态和人工确认，例如：

```text
读取简历
  ↓
解析简历
  ↓
分析岗位差距
  ↓
生成路线草案
  ↓
校验任务粒度和每日容量
  ↓
等待用户确认
  ↓
写入路线和任务
```

这类流程需要：

- 节点之间传递结构化状态。
- 某一步失败后能够重试。
- AI 结果不合格时能够回到修复节点。
- 等待用户确认后继续执行。
- 保存工作流执行记录。
- 后续根据每日复盘重新调整路线。

LangGraph 更适合承载这些有状态流程。它不应承担用户、路线、任务和错题等核心业务数据的最终存储，最终数据仍由领域服务和 MySQL 管理。

### 9.3 LangChain 的使用边界

建议使用 LangChain 的通用能力：

- Chat Model 适配。
- Prompt 模板。
- JSON Schema 或 Pydantic 结构化输出。
- Tool calling。
- 文档切分和检索组件。
- Callback 和 Token 使用统计。

不建议让 LangChain 对象直接操作业务数据库，或把大量业务规则写进不可测试的 Chain。业务规则应保持在 Python Domain Service 中，例如：

- 每日任务容量计算。
- 错题复习间隔计算。
- 路线版本状态流转。
- 任务依赖检查。
- 用户确认后才允许写入执行中的路线。

### 9.4 LangGraph 工作流

#### 简历诊断工作流

```text
load_context
  → parse_resume
  → build_job_capability_model
  → analyze_gap
  → validate_diagnosis
  → persist_diagnosis
```

#### 学习路线生成工作流

```text
load_diagnosis
  → draft_route
  → normalize_tasks
  → check_daily_capacity
  → check_dependencies
  → validate_route_schema
  → create_route_draft
  → wait_user_confirmation
  → activate_route
```

#### 每日复盘工作流

```text
load_day_evidence
  → generate_questions
  → collect_answers
  → evaluate_answers
  → evaluate_code_or_artifacts
  → summarize_daily_review
  → create_mistakes
  → schedule_reviews
 → update_capabilities
 → refresh_progress_forecast
  → suggest_route_adjustment
```

#### 计划导入工作流

```text
load_file
  → detect_format
  → parse_markdown_or_html
  → normalize_plan
  → fill_missing_fields
  → validate_import
  → create_import_preview
  → wait_user_confirmation
  → persist_route
```

### 9.5 工作流状态设计

使用显式状态对象，不依赖自然语言上下文作为唯一状态：

```python
class RouteGenerationState(TypedDict, total=False):
    user_id: str
    job_target_id: str
    diagnosis_id: str
    route_draft: dict
    validation_errors: list[str]
    daily_capacity_minutes: int
    user_confirmation: str
    ai_run_id: str
```

每个节点只负责一类动作：

- 读取上下文。
- 调用模型。
- 校验结构化结果。
- 执行业务规则。
- 写入草稿。
- 等待人工确认。

### 9.6 持久化策略

V1 建议分两层保存：

1. `ai_runs` 保存每次 AI 任务的输入摘要、输出、模型、提示词版本和错误。
2. 领域表保存已经通过业务校验的诊断、路线、任务、评分和错题。

LangGraph 的 checkpoint 用于工作流暂停、恢复和重试；它不替代 MySQL 领域数据。工作流恢复标识与 `ai_runs.id` 关联。

### 9.7 AI Gateway 设计目标

- 屏蔽不同模型厂商的接口差异。
- 统一超时、重试、限流和错误处理。
- 统一结构化输出校验。
- 记录模型、提示词版本和 Token 消耗。
- 支持后续切换模型或配置不同任务使用不同模型。

### 9.8 接口抽象

```python
class AIProvider(Protocol):
    async def generate(
        self,
        *,
        prompt: str,
        response_schema: type[BaseModel],
        model: str,
        temperature: float = 0.2,
    ) -> AIResult:
        ...
```

业务模块不直接调用第三方 SDK，而是调用：

```python
result = await ai_gateway.run(
    task_type="route_generation",
    input_data=context,
    output_schema=RouteDraftSchema,
)
```

### 9.9 AI 任务类型

- `resume_parse`
- `diagnosis_generation`
- `route_generation`
- `plan_import_normalization`
- `question_generation`
- `answer_evaluation`
- `code_evaluation`
- `daily_review`
- `route_adjustment`
- `capability_summary`
- `progress_forecast`

### 9.10 AI 可靠性策略

- 使用低温度生成结构化结果。
- Pydantic 校验失败时自动修复一次。
- 第三方调用超时后重试。
- 任务使用幂等键避免重复写入。
- 不把未经用户确认的 AI 结果直接写入执行中路线。
- 对用户上传文件做 Prompt Injection 防护。
- 对 AI 结果保留人工编辑入口。

### 9.11 模型供应商策略

这里的“模型供应商”是指提供大模型推理 API、Embedding API 或其他 AI 能力的服务方。它们不是恒序业务模块，而是 AI Gateway 的下游实现。

可能的供应商类型包括：

- 云端通用大模型服务。
- 国内大模型服务。
- OpenAI-compatible API 服务。
- 企业私有化模型。
- 使用 vLLM、Ollama 等运行的本地模型。

第一版不需要同时接入很多供应商，建议采用：

```text
一个主模型供应商
  + 一个可切换的备用供应商
  + Embedding 单独抽象
```

根据当前产品决策，V1 使用第三方 AI API，不自建或私有化部署模型。AI Gateway 仍保留 Provider 抽象，以便后续切换第三方供应商、替换模型或增加企业私有部署版本。

不同任务可以使用不同能力等级的模型：

| 任务 | 模型策略 |
| --- | --- |
| 任务分类、标签提取、格式转换 | 成本较低、响应较快的模型 |
| 简历诊断、路线生成、工程方案评价 | 能力更强的模型 |
| 代码分析和复杂追问 | 代码或推理能力较强的模型 |
| 文档向量化 | 独立 Embedding 模型 |

AI Gateway 至少需要统一以下配置：

```text
provider
model
endpoint
api_key_ref
timeout_seconds
max_tokens
temperature
```

这样后续可以在不修改领域业务代码的情况下切换供应商、比较成本和进行故障降级。供应商选择应通过真实样本评测准确性、中文表达、代码能力、延迟、价格和数据合规性后确定。

## 10. RAG 与知识库方案

### 10.1 是否必须使用 RAG

RAG 不是恒序 V1 的硬性依赖，但产品长期会从 RAG 中获益。原因是恒序需要让 AI 基于用户自己的简历、项目、历史回答、错题和导入资料进行提问与评价。

建议结论：

```text
V1：结构化数据查询 + MySQL 全文检索，先不强制引入向量数据库
P1：个人资料和求职知识采用混合检索 RAG
P2：加入更大的岗位、公司和技术知识库，并支持多路召回和重排
```

### 10.2 需要进入知识库的内容

#### 个人知识库

- 简历和项目文档。
- 用户上传的学习资料。
- 外部 AI 导入的计划。
- 历史复盘和回答。
- 错题解释和个人笔记。
- 用户主动授权的代码说明和技术方案。

#### 公共知识库

- 岗位能力要求。
- 计算机基础知识。
- 工程实践和系统设计资料。
- 公司或职位说明。
- 求职平台的题库解析和测评说明。

个人知识库和公共知识库必须分开索引，并在检索时强制进行用户权限过滤，不能发生跨用户召回。

### 10.3 不需要向量化的内容

以下内容优先使用 MySQL 查询，不需要直接向量化：

- 今日任务。
- 任务状态。
- 错题到期时间。
- 路线阶段和完成率。
- 评分数值。
- 用户偏好和每日容量。

这类数据是结构化事实，应该由 Planning、Review 和 Profile 模块查询后作为上下文传给 AI。

### 10.4 V1 检索方式

V1 可以在 MySQL 中增加：

```text
knowledge_documents
knowledge_chunks
```

保存文档、分段内容、来源、标签、用户权限和业务类型，使用 MySQL `FULLTEXT` 加标签过滤完成关键词检索。

### 10.5 P1 混合 RAG

当资料量增大或需要语义检索时，引入 Qdrant 或其他向量数据库：

```text
文件上传
  → 文本解析
  → 分段和清洗
  → 生成 Embedding
  → 写入 Qdrant
  → 保存 MySQL 元数据和权限
```

检索时建议采用：

```text
用户权限过滤
  → 关键词召回
  → 向量召回
  → 标签和岗位过滤
  → 可选重排
  → 生成带来源的上下文
```

AI 回答应尽量携带来源信息。如果没有检索到足够证据，应明确告知用户，而不是把模型常识伪装成用户资料或内部知识。

### 10.6 RAG 的边界

RAG 只负责提供相关资料，不能替代业务规则：

- 不能由 RAG 决定任务是否完成。
- 不能由 RAG 决定错题复习日期。
- 不能绕过权限读取其他用户资料。
- 不能直接修改路线或发送通知。

## 11. MCP 与工具调用方案

### 11.1 是否必须使用 MCP

不必须。LangGraph 可以直接调用 Python 函数、领域服务或 HTTP API 来完成工具调用。恒序内部的任务查询、错题创建、复习排期和评分保存，直接使用受控的 Python Tool 或 Domain Service 更简单、更容易测试。

MCP 更适合解决“模型或 Agent 需要访问独立进程、外部系统或本地环境”的问题。

### 11.2 V1 推荐做法

V1 采用内部 Tool Registry：

```text
LangGraph
  → Tool Registry
      → ProfileService
      → PlanningService
      → ReviewService
      → KnowledgeSearchService
      → EntryLinkService
```

工具都使用 Pydantic 输入输出，并通过用户上下文做权限校验。不要让模型直接拼 SQL 或直接访问 ORM。

### 11.3 适合使用 MCP 的场景

后续可以把以下能力做成 MCP Server：

#### 本地代码 MCP Server

- 查询用户授权的本地项目。
- 读取 Git diff。
- 获取测试结果。
- 运行白名单内的测试命令。
- 上传用户确认的代码产物。

#### 求职平台 MCP Server

当前不建设。只有在未来需要岗位要求、测评结果、题库错题或完成记录进行数据交换时，才评估是否通过 MCP 或正式 API 接入。

#### 外部资料 MCP Server

- 查询用户授权的文档系统。
- 查询个人笔记。
- 获取技术资料。

### 11.4 MCP 的安全边界

MCP 工具需要：

- 明确的工具白名单。
- 用户身份和权限注入。
- 只读和写入工具分离。
- 写入、删除、发送通知等操作增加确认或策略门。
- 文件路径限制。
- 命令执行白名单。
- 超时和资源限制。
- 工具调用审计。
- 幂等键和重复调用保护。

不建议把“直接修改路线”“批量删除错题”“发送外部通知”等高影响动作无条件暴露给模型。

### 11.5 推荐演进路线

```text
V1：LangGraph + 内部 Python Tools
  ↓
P1：本地代码助手提供可选 MCP Server
  ↓
未来：如果求职平台需要数据交换，再评估 MCP 或正式 API
```

MCP 是工具接入标准，不是 AI 编排框架，也不是 RAG 的替代品。它与 LangGraph、LangChain 和 RAG 可以组合使用，但各自解决的问题不同。

## 12. 每日任务生成和复习调度

### 12.1 调度方式

使用 Celery Beat 每日执行任务生成，也支持用户打开首页时进行补偿生成。

建议任务：

```text
generate_today_tasks      每个用户每日一次
generate_review_tasks     每小时或每日一次
send_task_reminders       每 5 分钟扫描待发送通知
retry_failed_ai_runs      每 10 分钟
retry_failed_notifications 每 5 分钟
cleanup_expired_tokens    每日一次
```

### 12.2 幂等策略

每日任务实例的唯一键：

```text
{user_id}:{task_id}:{occurrence_date}
```

使用 MySQL 唯一索引和事务保证重复触发时只生成一条任务。

### 12.3 优先级排序

初版可采用规则排序：

```text
复习到期 > 必做路线任务 > 固定周期任务 > 周计划任务 > 可选任务
```

同一优先级再按照：

1. 逾期天数。
2. 路线阶段顺序。
3. 任务截止日期。
4. 预计耗时。

如果总耗时超过用户每日容量：

- 保留必做任务。
- 把可选任务顺延。
- 记录自动调整原因。
- 给用户提供“接受调整”或“手动重排”。

### 12.4 每日容量计算

用户设置 `daily_available_minutes`，例如 4 小时对应 240 分钟。系统默认使用 `planning_capacity_factor = 0.8`，将 80% 用于计划任务，保留 20% 作为缓冲：

```text
daily_available_minutes = 240
effective_capacity = 240 × 0.8 = 192 分钟
buffer_minutes = 48 分钟
```

容量系数允许用户调整到 0.6～1.0。任务预计时长由 AI 初始估算，并可由用户修改；任务实际耗时持续记录，后续使用最近一段时间的中位数修正估算。

容量排程规则：

1. 到期复习任务优先进入有效容量。
2. 必做路线任务排在可选任务之前。
3. 单个任务超过 120 分钟时，优先拆成多个可执行单元。
4. 不足一个完整任务时，如果任务可拆分则排入剩余容量，否则顺延。
5. 缓冲时间未使用时，可以由用户主动领取可选任务。

### 12.5 错题复习规则

默认间隔配置：

```json
{
  "intervals": [1, 2, 6, 7, 14],
  "unit": "day",
  "reset_on_wrong": true
}
```

这里的间隔是相对上一次复习完成时间计算。产品层展示为“第 2 天、第 3 天、第 7 天、再过 7 天、再过 14 天”。

首版采用自适应调整：

- 答错：`next_interval = max(1, previous_interval // 2)`，并回到较低阶段。
- 答对且置信度低：保持或小幅增加间隔。
- 答对且置信度高：`next_interval = min(previous_interval × 2, max_interval)`。
- 连续答对达到阈值后进入长期复习。
- 重复错误增加知识点权重，并生成变式练习。

具体间隔算法通过配置实现，不能写死在 API 层。

### 12.6 未完成任务自动顺延

每日截止时间到达后，由调度任务执行自动顺延：

1. 找出状态不是 `completed`、`skipped` 或 `cancelled` 的任务实例。
2. 根据已完成产出和用户填写的进度计算 `remaining_minutes`。
3. 创建下一天的任务实例，并记录 `carry_over_from_id`。
4. 将后续尚未开始的路线任务按依赖关系顺延。
5. 保留已经完成的任务、回答、评分和复盘记录。
6. 根据新的最后一个任务日期更新 `routes.forecast_end_date`。
7. 根据顺延结果生成企业微信提醒。

错题复习日期以实际复习完成时间计算，不简单沿用原计划日期。任务连续顺延达到配置阈值后，触发 AI 重新估算任务量或拆分任务。

## 13. 文件和本地代码设计

### 13.1 对象存储

文件不直接存储在 MySQL，MySQL 只保存元数据和对象地址。

对象路径建议：

```text
users/{user_id}/resumes/{resume_id}/original.pdf
users/{user_id}/imports/{import_id}/source.md
users/{user_id}/artifacts/{artifact_id}/answer.txt
users/{user_id}/code/{submission_id}/source.zip
```

上传采用预签名 URL：

1. 前端向后端申请上传地址。
2. 前端直接上传对象存储。
3. 后端收到完成回调后创建文件记录。
4. 异步任务进行格式识别和安全扫描。

### 13.2 本地代码助手

建议第一版采用 Python CLI，不直接开发完整桌面客户端或 IDE 插件。

选择 CLI 的原因：

- 能适配 IntelliJ IDEA、PyCharm、VS Code、Cursor 等不同 IDE。
- 可以先覆盖 Git diff、测试执行、代码提交和任务绑定等核心能力。
- 不依赖具体 IDE 插件 API，开发和发布成本低。
- 对个人使用场景足够，用户可以直接在当前 IDE 的终端中执行命令。

后续优先增加 IDE 插件，用于一键提交当前文件、查看今日任务和查看 AI 反馈。只有在需要常驻托盘、目录监听、离线队列或操作系统级通知时，再考虑桌面客户端。

示例命令：

```bash
persistlog login
persistlog project add ./algorithm-practice --name algorithms
persistlog sync --project algorithms
persistlog submit --task TASK_ID --path ./src/solution.py
```

本地 Agent 的职责：

- 保存本地项目映射。
- 读取 Git 提交和工作区变更。
- 按用户配置选择文件。
- 生成代码摘要和测试结果。
- 使用预签名 URL 上传选定内容。
- 获取 AI 评估结果。

服务端不能直接访问用户电脑目录。

### 13.3 代码隐私

- 默认不上传整个目录。
- 支持 `.persistlogignore`。
- 上传前展示文件列表。
- 支持只上传 diff 或单次提交。
- 支持删除已上传代码。
- 后续可支持本地模型分析。

## 14. 通知系统设计

### 14.1 适配器接口

```python
class NotificationProvider(Protocol):
    async def send(self, message: NotificationMessage) -> SendResult:
        ...
```

实现：

- `WeComGroupBotProvider`（V1）
- `QQBotProvider`（后续）
- `EmailProvider`（后续）
- `InAppProvider`（兜底）

### 14.2 企业微信群机器人方案

#### 适用范围

个人企业未认证时，优先使用企业微信群机器人，而不是企业微信应用消息。群机器人通过群设置生成 Webhook，通常不依赖企业 CorpID、应用 Secret 或企业认证流程。

它适合恒序发送：

- 今日任务。
- 到期错题复习。
- 晚间复盘提醒。
- 任务逾期提醒。
- 周总结。

#### 配置步骤

1. 在企业微信中创建一个仅用于接收恒序提醒的内部群。
2. 在群管理中添加“自定义机器人”或“群机器人”。
3. 复制机器人 Webhook 地址。
4. 在恒序通知设置中粘贴 Webhook，并发送测试消息。
5. 配置提醒时间、免打扰时间和消息类型。

如果企业微信界面不允许建立只有一个成员的群，可以使用自己的备用企业微信账号或可信成员创建一个私有群。机器人消息只会发送到被添加的群，不能仅凭群机器人 Webhook 向个人私聊。

#### Webhook 请求

群机器人通常使用以下接口发送 Markdown 消息：

```text
POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={webhook_key}
Content-Type: application/json
```

请求示例：

```json
{
  "msgtype": "markdown",
  "markdown": {
    "content": "### 恒序 · 今日任务\n> 预计用时：90 分钟\n\n- [ ] 完成两道二叉树题\n- [ ] 复习 Redis 错题 3 道\n- [ ] 晚上 21:30 完成复盘"
  }
}
```

Python 适配器可以保持很薄，只负责调用 Webhook 和校验企业微信返回值：

```python
import httpx


class WeComGroupBotProvider:
    async def send_markdown(self, webhook_url: str, content: str) -> None:
        payload = {
            "msgtype": "markdown",
            "markdown": {"content": content},
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
            result = response.json()
            if result.get("errcode") != 0:
                raise RuntimeError(
                    f"WeCom webhook failed: {result.get('errmsg')}"
                )
```

实际项目中 `webhook_url` 应从服务端解密后的配置读取，不能由前端直接传入发送接口。

服务端需要检查返回的 `errcode` 和 `errmsg`，不能只根据 HTTP 状态判断发送成功。

#### 密钥和权限

- Webhook 中的 `key` 等同于发送凭证，不能写入前端代码、日志或 Git。
- 数据库中保存加密后的 Webhook，读取时只在服务端解密。
- 管理后台展示脱敏后的地址，并提供重新配置和删除按钮。
- 每个用户只能访问自己的通知配置。
- 支持发送测试消息，测试消息也需要经过同样的出站队列。
- 遵循企业微信官方消息长度和频率限制，系统内部使用 Redis 做限流和合并发送。

#### 能力边界

- 群机器人是单向推送，不能读取用户回复。
- 群机器人不负责用户身份认证。
- 群机器人不适合作为一对一私聊通道。
- 外部群、跨企业群和企业微信应用消息可能有不同限制，按当前企业微信后台实际可用能力配置。

### 14.3 Outbox 模式

业务事务只负责写入 `notification_outbox`，由 Worker 异步发送，避免通知接口阻塞业务请求。

字段包括：

```text
id, user_id, channel, template_code, payload_json,
dedup_key, status, retry_count, next_retry_at,
sent_at, last_error
```

唯一键建议：

```text
unique(user_id, dedup_key)
```

### 14.4 发送失败策略

- 第 1 次失败：1 分钟后重试。
- 第 2 次失败：5 分钟后重试。
- 第 3 次失败：30 分钟后重试。
- 超过最大次数：标记失败并通知用户检查渠道配置。

## 15. 外部求职平台联动

### 15.1 V1 联动方式

V1 只提供普通链接或页面级深链接，不建立数据接口：

```text
https://persistlog.example.com/
https://persistlog.example.com/today
https://job.example.com/
```

用户点击链接后，在目标系统内独立登录和操作。链接中不携带用户身份、简历、岗位、测评、错题、计划或任务状态。

### 15.2 技术实现

- 恒序前端配置“进入求职平台”的 URL。
- 求职平台前端配置“进入恒序”的 URL。
- 如果需要页面级入口，使用固定路径或固定锚点。
- 不需要 `handoff` 接口、一次性 Token、外部事件回调或数据同步表。
- 如需统计点击量，可以在各自系统内部记录，不交换业务数据。

### 15.3 未来扩展

如果未来需要账号打通、测评同步、错题同步或任务状态回传，再单独设计 OAuth/SSO、正式 API 或 MCP 接入方案。本版本不为这些能力预留运行时依赖。

## 16. 认证、权限与安全

### 16.1 认证

- Access Token 有效期 30 分钟。
- Refresh Token 有效期 30 天，可撤销。
- Refresh Token 使用轮换机制。
- 管理员使用额外的二次认证。

### 16.2 权限

V1 采用 RBAC：

- `user`
- `admin`
- `operator`

所有业务查询必须基于当前用户的 `user_id`，不能仅依赖前端传入的 ID。

### 16.3 数据安全

- 密码使用 Argon2id 或 bcrypt。
- 第三方密钥加密存储。
- 简历原文和代码可以使用应用层加密。
- 文件类型、大小和扩展名校验。
- Markdown/HTML 导入内容进行脚本过滤。
- 限制 AI、文件和通知 API 的调用频率。
- 第三方 AI API 调用前按用户授权和任务类型控制数据范围。
- AI 请求尽量发送必要上下文，避免默认上传完整历史数据和完整本地代码。

## 17. 配置管理

使用环境变量和配置文件分离配置：

```text
APP_ENV=dev
DATABASE_URL=mysql+aiomysql://...
REDIS_URL=redis://...
S3_ENDPOINT=http://minio:9000
S3_BUCKET=persistlog
AI_PROVIDER=openai_compatible
AI_MODEL=...
JWT_SECRET=...
```

生产环境使用 Secrets Manager 或容器密钥管理，不把密钥提交到代码仓库。

## 18. 部署方案

### 18.1 开发环境

使用 Docker Compose 启动：

```text
mysql
redis
minio
api
worker
beat
frontend
```

### 18.2 单机生产环境

```text
Nginx
  ├── frontend container
  └── api containers
        ├── worker containers
        └── beat container

MySQL 8
Redis
MinIO 或云对象存储
```

### 18.3 后续扩展

当出现以下情况时再考虑拆分服务：

- AI 任务吞吐显著高于普通业务。
- 文件解析和代码分析需要独立扩容。
- 通知渠道数量明显增加。
- 多个产品共享身份和路线能力。

可拆分为：

- AI Service。
- Planning Service。
- Content and Practice Service。
- Notification Service。
- Integration Service。

## 19. 可观测性

### API 指标

- 请求数量。
- 响应时间。
- 4xx 和 5xx 比例。
- 数据库查询耗时。
- Redis 命中率。

### 异步任务指标

- 队列长度。
- 成功率。
- 平均等待时间。
- 平均执行时间。
- 重试次数。
- 失败任务数量。

### AI 指标

- 各任务类型成功率。
- Token 使用量。
- 平均响应时间。
- 结构化解析失败率。
- 模型成本。
- 用户人工修改率。

### 业务指标

- 每日任务生成数。
- 每日复盘完成率。
- 错题复习完成率。
- 路线接受率。
- 用户连续活跃天数。

日志中禁止输出密码、Token、简历全文和未经脱敏的代码。

## 20. 测试方案

### 单元测试

- 自适应复习间隔和重置规则。
- 任务排序和容量计算。
- 未完成任务顺延和路线结束日期预测。
- 任务状态流转。
- 能力掌握度和成长看板计算。
- 路线版本操作。
- Token 过期和签名校验。
- 通知重试策略。

### 集成测试

- FastAPI + MySQL。
- Celery + Redis。
- 对象存储上传回调。
- 文件导入到路线预览。
- 外部平台入口链接可正常跳转。

### AI 评估测试

维护一组固定样本：

- 不同质量的简历。
- 不同类型的学习计划。
- 正确和错误的算法答案。
- 不同水平的八股回答。
- 不同完整度的工程方案。

验证：

- JSON Schema 合法率。
- 评分稳定性。
- 关键字段完整率。
- 生成任务可执行性。
- 不能出现明显幻觉或无依据结论。

### 端到端测试

覆盖完整流程：

```text
注册 → 上传简历 → 生成路线 → 接受路线
→ 生成今日任务 → 完成练习 → 每日复盘
→ 创建错题 → 到期复习 → 重新评分
```

## 21. 开发阶段建议

### 阶段一：基础骨架

- FastAPI 项目结构。
- 用户认证。
- MySQL、Redis、对象存储接入。
- SQLAlchemy 和 Alembic。
- 前端登录和基础工作台。

### 阶段二：路线和任务闭环

- 用户档案和简历。
- AI 诊断。
- AI 路线生成。
- 路线确认。
- 今日任务。
- 任务状态和每日生成。

### 阶段三：练习和复盘闭环

- 问题和回答。
- AI 评估。
- 每日复盘。
- 错题和自适应间隔复习。

### 阶段四：通知和导入

- 企业微信群机器人。
- Markdown 导入。
- 计划预览和确认。

### 阶段五：外部平台和本地助手

- 求职平台深链接。
- Python 本地 CLI。
- Git 和代码产物上传。

## 22. 技术风险与应对

### AI 输出不稳定

应对方式：

- 结构化 Schema。
- 结果校验。
- 失败重试。
- 版本化提示词。
- 用户确认后生效。

### 每日任务过多导致用户放弃

应对方式：

- 强制每日容量。
- 必做和可选分级。
- 自动延期。
- 每日只展示有限数量的重点任务。

### 简历和代码隐私风险

应对方式：

- 用户授权。
- 选择性上传。
- 对象存储隔离。
- 文件加密和删除。
- 本地代码助手优先上传摘要或 diff。

### 通知渠道政策变化

应对方式：

- 采用统一通知适配器。
- 渠道配置独立存储。
- V1 保留站内通知作为兜底。

### 计划调整造成数据混乱

应对方式：

- 路线版本化。
- 任务模板与任务实例分离。
- 所有批量调整产生审计记录。
- 已完成任务不因新路线重生成而丢失。

## 23. 第一版验收标准

1. 用户能够上传简历并创建目标岗位。
2. 用户能够提交困境并获得结构化 AI 诊断。
3. 用户能够预览、确认和编辑 AI 学习路线。
4. 路线确认后能够生成每日任务。
5. 用户能够完成、延期、跳过和阻塞任务。
6. 用户能够提交回答或练习产物并获得评分。
7. 用户能够完成每日复盘。
8. 错误内容能够进入错题库并通过自适应算法生成复习任务。
9. 到期复习题能够出现在今日任务中。
10. Markdown 学习计划能够导入并在确认后生成路线。
11. 成长看板能够展示能力掌握度、目标差距、证据和预计完成日期。
12. 未完成任务能够自动顺延，后续任务和路线预计结束日期能够同步调整。
13. Python CLI 能够绑定本地项目、读取 Git diff 并提交用户选择的代码产物。
14. 企业微信群机器人能够发送今日任务、复习提醒和顺延提醒。
15. 求职平台和恒序能够通过普通链接或页面级深链接相互跳转，且不交换业务数据。
16. AI 失败、通知失败和导入失败均有可查询状态，不影响已有数据。

