# 恒序 persistLog · 两份文档对比与补充清单

**对比对象**

- [产品需求分析](product-requirements.md) V1.0（686 行）
- [系统技术方案设计](technical-design.md) V1.0（1719 行）

**结论**

产品闭环和技术骨架已经成型，V1 的五项既定决策也一致：不做语音、首版自适应复习、第三方 AI、企微群机器人、平台只跳转不交换数据。

当前主要问题不是“缺功能”，而是**关键规则、数据模型和接口契约没有闭合**。如果直接进入开发，最可能在六个地方返工：复习档期、算法评审范围、CLI、任务状态、每日复盘/提问、能力看板。

> 说明：本文是问题清单与建议；实际交付顺序和最终决策已按“计划看板优先”的原则落到 [开发指导文档](development-guide.md)。两者冲突时，以开发指导文档为准。

> 本文只做补充与对齐，不推翻两份文档的 V1 范围。所有“建议”都可以直接改成决策记录。

---

## 0. 先看 10 个 P0 缺口

| # | 缺口 | 位置 | 影响 | 建议 |
|---|---|---|---|---|
| G-01 | 复习间隔与产品展示对不上 | PRD 6.9；TECH 12.5 | 到期日错误，复习节奏不可信 | 改为 `first_review_after_days=1` + `intervals=[1,4,7,14]`，见 D-01 |
| G-02 | 算法代码 AI 评审在 P0 还是 P1 不清 | PRD 6.6/6.7/9；TECH 7.5/9.4/9.9/23 | 核心闭环、CLI、评分 Schema、工作量都受影响 | 基础版纳入 Phase 2；Git 自动同步/沙箱/IDE 留 Phase 3，见 D-02 |
| G-03 | CLI 是 P0，但技术排到阶段五，且没有 API/数据表 | PRD 9；TECH 13.2/21/8/23 | P0 验收 #13 无法达成 | CLI 移出首版（Phase 3），首版用网页上传，见 D-03、3.5 |
| G-04 | 任务状态机与 `tasks` / `task_occurrences` 真源不清 | PRD 6.4/6.5；TECH 7.4/12.6/23 | 状态不一致、顺延/复盘统计错误 | 日状态放 occurrence，模板只保留 draft/active/archived，见 D-04 |
| G-05 | 每日复盘/每日提问没有数据表，工作流混在一起 | PRD 6.7/6.8；TECH 9.4/7 | P0 核心结果无法落库 | 拆 quiz / review 两条工作流，补表，见 D-05、3.2 |
| G-06 | 能力看板缺岗位要求、权重、证据聚合 | PRD 6.13；TECH 7.3/8.5 | 准备度/掌握度算不出来 | 补 `job_capability_requirements`、`capability_snapshots` 和口径，见 D-06、3.4 |
| G-07 | 通知只有 Provider/Outbox，没有配置、模板、偏好 | PRD 6.10；TECH 14/8 | 用户无法配置企微，P0 通知无法闭环 | 补渠道 CRUD/测试、模板、偏好、触发矩阵，见 D-07、3.6 |
| G-08 | API 是端点清单，不是契约 | TECH 8 | 前端/CLI 无法联调，异步任务无法查询 | 补 OpenAPI、Job 状态、错误码、幂等，见 3.8 |
| G-09 | 数据模型多张表只有一句话，且缺表 | TECH 7 | 后期迁移成本高，统计口径无法落地 | 补全 DDL、索引、枚举、种子数据，见 3.9 |
| G-10 | 指标包含 V1 无法采集的项 | PRD 10 vs 4.2/7.4 | 指标好看但无数据源 | 删除/延后模拟面试、Offer 等；补实际时长与预测历史，见 3.12 |

---

## 1. 总体评价

### 1.1 已经比较扎实

- **产品**：目标用户、场景 A–D、范围与非范围、核心闭环、五项决策、P0/P1/P2、指标、容量与顺延建议都写清楚了。
- **技术**：模块化单体、同步/异步分离、先落库再 AI、LangGraph + AI Gateway、结构化输出、Outbox、对象存储、CLI 优先、验收标准，方向合理。
- **一致性**：两份文档在“V1 不交换平台数据、企微群机器人、第三方 AI、自适应复习、无语音”上一致，边界没有互相打架。

### 1.2 当前最大风险

1. **规则不一致**：复习间隔、任务状态、算法评审范围、CLI 排期。
2. **数据模型是目录不是契约**：多张表只有一句描述，缺字段、缺表、缺唯一约束。
3. **API 是端点清单不是契约**：缺请求/响应 Schema、错误码、异步任务查询、幂等约定。
4. **P0 功能缺闭环设计**：通知配置、每日复盘、每日提问、能力看板、CLI。
5. **指标不可采集**：模拟面试、Offer、实际学习时长、预测偏差都没有数据来源。

---

## 2. 必须先拍板的 14 个决策

### D-01 复习间隔与自适应算法

**冲突**

- PRD 6.9 展示：`第 2 天 → 第 3 天 → 第 7 天 → 再过 7 天 → 再过 14 天`。
- TECH 12.5 配置：`intervals: [1, 2, 6, 7, 14]`，相对上一次复习完成时间。
- 两者对不上。按产品展示，5 次复习对应“首次 +1 天 + 4 个间隔”，不是 5 个间隔。

**建议口径**

按“学习日为第 1 天”理解：

| 复习次 | 产品展示 | 距上次复习 | 相对学习日 |
|---|---|---|---|
| 1 | 第 2 天 | 首次 +1 天 | D+1 |
| 2 | 第 3 天 | +1 天 | D+2 |
| 3 | 第 7 天 | +4 天 | D+6 |
| 4 | 第 14 天 | +7 天 | D+13 |
| 5 | 第 28 天 | +14 天 | D+27 |

因此配置应为：

```json
{
  "first_review_after_days": 1,
  "intervals": [1, 4, 7, 14],
  "max_interval_days": 60,
  "reset_on_wrong": true
}
```

- 技术文档的 `[1,2,6,7,14]` 需要整体改掉，不能只把 `6` 改成 `4`；按展示应为 `first_review_after_days=1` + `intervals=[1,4,7,14]`。
- 前 5 个阶段按固定阶段推进；第 5 次之后才使用倍率 + 上限。
- 答错：回退一个阶段，次日重现；答对但置信度低：重复当前阶段；答对且置信度高：进入下一阶段。
- “连续答对进入长期复习”的阈值、最大间隔、重置规则需要写死为配置项。

**影响**：这是 P0 的规则硬伤，直接决定复习任务何时进入今日列表。

### D-02 算法代码 AI 评审是否属于 V1

**冲突**

- PRD 6.6 算法练习：AI 评价正确性、复杂度、边界、代码质量；6.7 每日复盘也包含技术正确性；TECH 23 验收 #6 要求“提交回答或练习产物并获得评分”。
- 但 PRD 9 的 P0 清单没有“算法代码 AI 评审”，它被放在 P1；P1 同时还列了“Git 记录接入”“工程方案评分”。
- TECH 9.4 工作流包含 `evaluate_code_or_artifacts`，9.9 AI 任务包含 `code_evaluation`，7.5 有 `evaluations`，技术侧默认 V1 有代码评估。

**建议**

- 把“基础版算法代码评审”纳入 Phase 2：静态评审 + 用户自测结果 + 用户填写的思路/复杂度 + 文件/行号证据；不执行代码。
- Git 自动同步、沙箱执行、IDE 插件、工程仓库自动拉取放 Phase 3。
- 如果坚持不做代码评审，则必须同步修改 PRD 6.6、6.7 和验收 #6，否则核心闭环“练习→评分→错题”断裂。

### D-03 CLI 的版本位置与协议

**冲突**

- PRD 9 P0 包含“Python CLI 本地代码助手”，TECH 23 验收 #13 要求 CLI 能绑定项目、读 Git diff、提交代码产物。
- TECH 21 开发阶段把 CLI 放在“阶段五：外部平台和本地助手”，是最后一步。
- TECH 8 API 没有 CLI/设备/项目/提交相关端点，7 数据模型也没有 `devices`、`local_projects`、`code_submissions`。

**建议**

- 方案 A（推荐）：CLI 移出首版，Phase 3 再实现；首版和代码评审阶段用网页上传。
- 方案 B：如果坚持 CLI 首版，则前移到阶段三/四，并补齐设备授权、项目映射、提交、异步评审协议。
- 不论选哪个，都要补 3.5 的协议和数据表；否则验收 #13 无法实现。

### D-04 任务状态机与真源

**冲突**

- PRD 6.4：`待开始 → 进行中 → 已完成 → 待复盘`；异常状态：延期、跳过、阻塞、放弃。
- TECH 12.6：只排除 `completed`、`skipped`、`cancelled`，没有“待复盘”，并把“放弃”写成 `cancelled`。
- TECH 8.4 API 只有 start/complete/postpone/block，没有 skip/unblock/abandon/review。
- `tasks` 和 `task_occurrences` 都有状态、预计时长、剩余时长，真源不清。

**建议**

- 日执行状态只放在 `task_occurrences`；`tasks` 只保留模板状态 `draft` / `active` / `archived`。
- occurrence 状态建议：

```text
pending → in_progress → completed → pending_review → reviewed
pending / in_progress → postponed / skipped / blocked / abandoned
blocked → pending（解除阻塞）
```

（无需复盘的完成任务可直接 `completed → reviewed`。）

- 补字段：`actual_minutes`、`note`、`skip_reason`、`block_reason`、`reviewed_at`、`split_index`、`parent_occurrence_id`。
- “延期”不是终态：创建下一天的新 occurrence，旧 occurrence 标记 `postponed`，并记录 `carry_over_from_id`。

### D-05 每日复盘与每日提问

**冲突**

- PRD 6.7 每日复盘和 6.8 AI 每日提问是两个功能。
- TECH 9.4 “每日复盘工作流”把 `generate_questions → collect_answers → evaluate_answers → summarize_daily_review` 串成一条，意味着复盘会等待提问作答。
- TECH 7 没有 `daily_reviews` 表；8.6 有 `POST /daily-reviews`，但没有对应数据模型。
- `questions` / `answers` 也没有“每日题集”“追问轮次”的建模。

**建议**

- 拆成两条工作流：
  1. `daily_quiz`：选题 → 出题 → 作答 → 评分 → 生成错题。
  2. `daily_review`：汇总当天任务、练习、评分、错题 → 生成复盘与明日建议；可引用 quiz 结果，但不阻塞在 quiz 上。
- 新增 `daily_reviews`、`daily_quiz_sessions`、`daily_quiz_items`、`answer_turns`。
- 复盘必须允许“未评估”，不能因为缺少代码/回答就编造分数。

### D-06 能力看板口径

**冲突**

- PRD 6.13 要求总体准备度、当前掌握度、目标达成度、未评估、7/30 天趋势、预计完成日期。
- TECH 7.3 有 `capability_definitions`、`user_capabilities`、`capability_evidence`；8.5 有目标达成度公式。
- 但缺：岗位能力要求与权重、任务到能力的映射、证据聚合公式、趋势快照、准备度覆盖率。
- `capability_definitions.target_roles_json` 无法替代“某个岗位目标下每项能力的 target_level 和 weight”。

**建议**

- 新增 `job_capability_requirements`（job_target_id, capability_id, target_level, weight）。
- 新增 `capability_snapshots`（按日/周保存 readiness 与各能力值），用于 7/30 天趋势。
- Phase 1 只做执行进度看板；Phase 2 加算法评分趋势；Phase 3 再落地完整能力模型。
- 明确证据聚合：
  - 来源权重：算法代码 1.0、工程方案 1.0、八股/项目回答 0.8、自评 0.3、外部测评 0.6。
  - 时间衰减：半衰期 30 天。
  - 证据数 ≥3 且置信度 ≥0.5 才算 `assessed`，否则 `unassessed`。
  - readiness 只在已评估能力上加权；同时展示“证据覆盖率”，覆盖率 <50% 时标注低置信度。
- 明确任务/题目/错题到 capability 的映射表或 JSON 字段。

### D-07 通知配置、模板与触发

**冲突**

- PRD 6.10 要求企微群机器人、免打扰、模板、失败重试、去重；通知类型包括今日任务、任务开始、任务逾期、错题到期、晚间复盘、周总结、连续未完成。
- TECH 14 有 Provider、Outbox、重试；但缺渠道配置 API、模板表、用户偏好、触发矩阵。
- 用户无法在页面上配置 Webhook 并发送测试消息，P0 通知无法端到端使用。

**建议**

- 新增表：`notification_templates`、`notification_preferences`；把 14.3 的 `notification_outbox` 正式写进第 7 章。
- 新增 API：渠道 CRUD、测试发送、偏好读写。
- 明确触发矩阵：事件、默认时间、渠道、模板、去重键、免打扰行为。
- 明确“任务开始”和“连续未完成”是否真的要在 V1 发；如果发，补阈值和文案。

### D-08 诊断与路线操作 API

**冲突**

- PRD 6.2：诊断要支持接受、修改、重新生成、查看历史。
- PRD 6.3：路线要支持预览、接受、编辑、重新生成、暂停、恢复、复制、归档、查看版本、调整开始时间和每日容量。
- TECH 8.3 只有 generate/list/get/accept/pause/resume/regenerate；没有 PATCH 草稿、copy、archive、versions、diff、adjust start/capacity。
- 诊断没有 accept/modify/regenerate 端点。

**建议**

- P0 至少补：`PATCH /diagnoses/{id}`、`POST /diagnoses/{id}/accept`、`PATCH /routes/{id}/draft`、`POST /routes/{id}/archive`。
- P1 补：copy、versions、diff、adjust start/capacity。
- 路线草稿编辑必须支持任务级增删改，否则“预览后调整”落不了地。

### D-09 HTML 导入的版本

**冲突**

- PRD 6.11：V1 支持 Markdown，P1 支持 HTML。
- TECH 5.10/9.4：Import 模块和导入工作流都写的是 Markdown/HTML。
- TECH 23 验收 #10 只要求 Markdown。

**建议**

- V1 只做 Markdown；HTML 解析器放 P1，技术文档加开关或明确“接口预留、V1 不开放”。
- 如果坚持 V1 HTML，则产品 6.11 和 P1 清单要同步改。

### D-10 深链接的口径

**冲突**

- PRD 4.1 说 V1 只做入口跳转；6.12 说“支持普通链接或页面级深链接”；P1 又列“求职平台深链接”。
- TECH 15 说 V1 支持普通链接或页面级深链接，不携带业务数据。

**建议**

- 把“深链接”拆成两种：
  - V1：固定 URL 或固定页面路径，不带用户上下文。
  - P1：带页面参数/上下文入口，但仍不传身份、简历、测评、错题、任务状态。
- 这样既保留“页面级入口”，又不违反“不交换业务数据”。

### D-11 周总结与周报

**冲突**

- PRD 6.10 通知类型有“周总结”；P1 又列“周报和月报”。
- TECH 14.2 企微消息示例有“周总结”，但没有周报数据模型、生成工作流和 API。

**建议**

- V1：轻量“周总结”推送（完成率、有效天数、错题、下周重点），数据由现有表聚合。
- P1：完整周报/月报（趋势、能力变化、证据、建议），新增 `weekly_reports` 表和生成任务。

### D-12 管理员角色

**冲突**

- PRD 7 定义管理员：管理用户状态、配置 AI 提示词和评分规则、管理通知模板、查看日志和失败任务。
- TECH 16.2 有 RBAC `user/admin/operator`，但代码目录没有 admin 模块，8 章没有 admin API，7 章没有 prompt/rubric/template 管理表。
- PRD 12 又明确“当前主要是个人使用”。

**建议**

- V1 不做管理后台；管理员能力用脚本/数据库/运维工具完成，产品文档把“管理员”标为内部角色而非 V1 功能。
- 如果要做多用户，再补 admin 模块、权限矩阵、prompt/rubric/template 管理和审计查询。

### D-13 指标与数据源

**冲突/缺口**

- PRD 10 含“模拟面试表现变化”“面试机会或 Offer 转化情况”，但 4.2 明确不做招聘投递，也没有模拟面试模块。
- “每周有效学习时长”需要实际耗时，但 `task_occurrences` 没有 `actual_minutes`。
- “预计完成日期与实际完成日期偏差”需要预测历史，但只有当前 `forecast_end_date`。
- “目标岗位准备度提升”需要基线快照，但没有 `capability_snapshots`。

**建议**

- 从 V1 指标中删除模拟面试/Offer，或改为 P2 的“手动记录面试/Offer 里程碑”。
- 补 `actual_minutes`、`route_forecast_history`、`capability_snapshots`。
- 每个指标写清：定义、分子、分母、数据源、统计频率。

### D-14 成长看板的开发阶段

**冲突**

- PRD 9 P0 与 TECH 23 验收 #11 都要求成长看板。
- TECH 21 的五个阶段没有明确列“成长看板”；它可能被隐含在阶段二/三，但排期上看不到。

**建议**

- 把成长看板加入阶段二或阶段三，与能力模型、证据聚合一起做；不要留到最后补。

---

## 3. P0 需要补齐的规格

### 3.1 计划与任务

#### 3.1.1 状态机

需要一张完整的状态迁移表，至少覆盖：

| 当前状态 | 动作 | 下一状态 | 副作用 |
|---|---|---|---|
| pending | start | in_progress | 记录 started_at |
| in_progress | complete | completed | 记录 completed_at、actual_minutes |
| completed | review | pending_review / reviewed | 进入日复盘 |
| pending/in_progress | postpone | postponed | 创建次日 occurrence，记录 carry_over_from_id |
| pending/in_progress | skip | skipped | 记录 skip_reason，不顺延 |
| pending/in_progress | block | blocked | 记录 block_reason |
| blocked | unblock | pending | 清除阻塞 |
| pending/in_progress/blocked | abandon | abandoned | 终态，不计完成率 |
| pending/in_progress | split | 子 occurrence | 需要 `parent_occurrence_id` / `split_index` |

#### 3.1.2 `tasks` 与 `task_occurrences` 的职责

- `tasks`：任务模板/定义，字段补 `learning_objective`、`recommended_resources_json`、`capability_codes`、`needs_review`、`source_type`、`source_id`。
- `task_occurrences`：某天实际执行实例，字段补 `actual_minutes`、`note`、`skip_reason`、`block_reason`、`reviewed_at`、`split_index`、`parent_occurrence_id`。
- 明确：今日列表、完成率、顺延、复盘统计都以 occurrence 为准；模板不直接统计完成率。

#### 3.1.3 任务拆分与唯一键

- 现在 `unique(user_id, task_id, occurrence_date)` 会阻止同一天拆成多个执行单元。
- 需要加 `split_index` 或 `parent_occurrence_id`，唯一键改为 `(user_id, task_id, occurrence_date, split_index)`。
- 补拆分 API 与“拆分后剩余分钟数”的计算规则。

#### 3.1.4 周计划模型

- PRD 要求“路线 → 阶段 → 周目标 → 日任务”；TECH 没有明确的 `route_weeks`/`week_goals`。
- `plans` 表虽然支持 `plan_type=week`，但缺 `stage_id`、`week_no`、`focus`、`milestone`。
- 建议新增 `route_weeks`（route_stage_id, week_no, focus, milestone, start_date, end_date），`tasks.route_week_id` 关联。

#### 3.1.5 每日计划快照

- `plans` 表语义不清：它是“计划模板”还是“某天的计划快照”？
- 今日页需要总任务数、预计总耗时、完成率、生成时间、生成版本；建议新增 `daily_plans` + `daily_plan_items`，或在 `plans` 里明确这些字段。
- 每日生成需要幂等键 `(user_id, plan_date)` 和生成记录，便于解释“为什么今天这些任务”。

#### 3.1.6 顺延与预测

需要写清：

- `remaining_minutes` 如何从用户填写的进度/已完成产出计算。
- 后续路线任务如何按依赖整体顺延；可选任务是否顺延。
- 周期任务遇到顺延如何处理（跳过本次还是补做）。
- `forecast_end_date` 的公式：当前剩余任务分钟 / 有效日容量 + 历史顺延修正；修正系数怎么算。
- 连续顺延达到什么阈值触发 AI 重新估算/拆分，阈值配置在哪里。
- 顺延通知的触发时机和内容。

#### 3.1.7 容量与实际耗时

- 需要 `actual_minutes` 才能计算“最近一段时间中位数”和“每周有效学习时长”。
- 明确计时方式：任务开始/完成时间差、用户手动填、还是两者结合。
- 明确冷启动估时：按任务类型给默认值，还是 AI 估算后用户确认。
- 周末/工作日容量差异、临时不可用时间是否进入容量计算。

#### 3.1.8 依赖与周期规则

- `task_dependencies` 需要明确：只支持同路线内依赖，还是跨路线；循环依赖如何检测；前置任务被跳过/放弃时后续怎么办。
- `recurring_rules` 需要明确：每天/每周几/每隔 N 天；时区；节假日例外；跳过本次是否影响下次。

#### 3.1.9 路线生成校验

TECH 9.4 有 `check_daily_capacity` / `check_dependencies` 节点，但没有写校验规则。至少需要：

- 总时长 ≤ 可用天数 × 有效日容量 × 0.8。
- 单日任务 ≤ 日容量；单任务 15–120 分钟，超长必须拆分。
- 依赖存在且无环；前置任务日期早于后置任务。
- 每周至少 1 个可验收产出；每 7 天留 1 个缓冲/复盘日。
- 任务必须有能力标签、产出、验收；缺失则打回修复节点。
- 路线日期不早于今天；阶段/周顺序连续。
- 能力覆盖：目标岗位的核心能力至少被一个任务覆盖。
- 校验失败时回到 `draft_route` / `normalize_tasks` 修复，而不是直接落库。

### 3.2 练习、提问与评估

#### 3.2.1 题目模型

`questions` 目前只有一句话，需要补：

- `question_type`：基础、原理、代码、系统设计、项目追问、场景、反问/澄清。
- `source_type`：今日任务、历史内容、错题、简历项目、岗位要求、低分能力项。
- `difficulty`、`capability_code`、`knowledge_point_id`、`reference_answer`、`rubric_code`、`dedup_hash`。
- 题目生成后需要去重，避免连续几天问同一道题。

#### 3.2.2 每日题集与追问

- 新增 `daily_quiz_sessions`（user_id, quiz_date, source_context_json, status）和 `daily_quiz_items`（session_id, question_id, order_no, answer_id, evaluation_id）。
- 追问需要 `answer_turns` 或 `answers.parent_answer_id`，否则“支持追问”无法落库。
- 明确每日题量、题型配比、难度分布、超时规则。

#### 3.2.3 评估模型与 Rubric

`evaluations` 需要补：

- `rubric_code` + `rubric_version`：否则不同版本的分数不可比。
- `status`：`queued/running/succeeded/failed/not_evaluated`。
- `dimensions_json`：按练习类型定义维度分，不要只放一个 `score_json`。
- `evaluator_type`：AI / rule / human；人工复核要能覆盖 AI。
- `evidence_json`：必须带文件/行号/回答片段。
- `confidence` + `pass_threshold`：置信度低时明确“建议人工复核”。

需要为四类练习各写一份 Rubric：

- 算法：正确性、复杂度、边界、代码质量、测试、表达。
- 八股：准确性、完整性、深度、结构、追问。
- 工程：问题定义、方案取舍、代码结构、工程质量、结果、表达。
- 项目：真实性、职责边界、技术深度、取舍、结果数据、表达。

#### 3.2.4 代码提交模型

- 补 `code_submissions`：language、problem_source、problem_url、difficulty、self_reported_complexity、test_results_json、independence（是否独立完成）、diff、files、commit_sha。
- 明确“用户自测结果”与“服务端沙箱结果”的区别；V1 不执行代码时，评分只能基于静态证据 + 自测结果。
- 明确代码证据的脱敏与文件路径处理（不要把本地绝对路径写入证据）。

#### 3.2.5 未评估语义

- PRD 8 要求“无证据时显示未评估”，但 TECH 只给 capability 定义了 `unassessed`。
- 需要把 `not_evaluated` 扩展到：练习评分、每日复盘、能力证据、成长看板。
- 无证据的维度不能给 0 分，也不能给“默认及格”；展示为“未评估/证据不足”。

### 3.3 错题与复习

#### 3.3.1 错题字段

`mistakes` 需要补：

- `question_id`、`source_type`、`knowledge_point_ids`、`error_type`、`user_answer_snapshot`、`reference_answer`、`ai_evaluation_id`、`first_wrong_at`、`last_reviewed_at`、`next_review_at`、`mastery_level`、`consecutive_correct`、`lapses`。
- 错误类型枚举：概念不清、记忆模糊、边界遗漏、复杂度错、表达结构缺失、细节记不清、审题错、完全不会。
- 复习历史由 `review_attempts` 保存；`mistakes` 保存当前聚合状态。

#### 3.3.2 知识点与标签

- 需要 `knowledge_points`（树形）和 `question_knowledge_points` / `mistake_knowledge_points`，或在题目/错题上存 `knowledge_codes_json`。
- 没有知识点，就无法做知识点热力图、按知识点抽题、按知识点覆盖复习。
- 建议至少做一张 `knowledge_points` 表，题目和错题用关联表；JSON 只作为兜底。

#### 3.3.3 复习调度算法

需要一份可测试的伪代码，至少定义：

- `stage_index` 与 `base_interval_days` 的映射。
- 首次复习延迟（D-01 建议 1 天）。
- 答对/答错/低置信度/高置信度的状态迁移。
- `max_interval_days`、长期复习阈值、归档条件。
- 复习日期以“实际完成时间”为基准，而不是原计划日期。
- 重复错误如何提高优先级、是否生成变式题。
- 每日复习配额、超配额时的优先级公式、积压清理规则。

#### 3.3.4 用户复习设置

- PRD 6.9 说用户可以调整默认间隔、最大间隔和重置规则。
- TECH 只有 `review_schedules`，没有用户级设置表/API。
- 需要 `review_settings`（user_id, first_review_after_days, intervals_json, max_interval_days, daily_quota, reset_policy）和对应 API。

#### 3.3.5 复习任务进入今日列表

- 明确复习任务的配额（例如最多 10 题或 35% 容量）。
- 明确复习任务与路线任务、周期任务的排序关系。
- 明确超期复习的优先级公式，以及“只复习高优题”的筛选规则。
- 明确复习任务完成后如何回写 `mastery_level`、`consecutive_correct`、`next_review_at`。

#### 3.3.6 复习统计

- 到期数、逾期数、完成率、再次答对率、掌握率、知识点热力图、遗忘曲线。
- 需要定义“掌握”的阈值和证据要求，避免一次答对就算掌握。

### 3.4 能力看板

#### 3.4.1 岗位能力要求

- 新增 `job_capability_requirements`：每个求职目标下，每项能力的 `target_level`、`weight`、`priority`。
- 需要一份初始能力词典（例如：算法、数据结构、计算机网络、操作系统、数据库、语言基础、系统设计、工程化、项目表达、简历表达、面试沟通）。
- 需要定义能力等级 0–100 的锚点，否则“当前 72 分/目标 80 分”没有意义。

#### 3.4.2 能力证据聚合

- `capability_evidence` 要能去重：同一份代码/回答不能反复加分。
- 定义来源权重、时间衰减、置信度、最少证据数。
- 定义 `current_level`、`confidence`、`status`（assessed/unassessed/stale）的计算。
- 定义“目标达成度”和“总体准备度”的公式，以及证据覆盖率低时如何展示。

#### 3.4.3 趋势与快照

- PRD 要求最近 7 天/30 天趋势。
- 只有 evidence 表也能算，但每次查询成本高；建议每日/每周生成 `capability_snapshots`。
- 快照至少保存：readiness、各能力 current_level、evidence_count、coverage。

#### 3.4.4 预计完成日期

- `forecast_end_date` 需要历史记录，才能算“预测偏差”。
- 新增 `route_forecast_history`：route_id, forecast_date, predicted_end_date, remaining_minutes, effective_capacity, reason。
- 明确预测公式和“历史顺延修正”的计算方式。

#### 3.4.5 看板 API 契约

- `GET /dashboard/overview`、`capabilities`、`timeline`、`evidence` 需要明确的响应 Schema。
- 至少包含：readiness、coverage、assessed/unassessed 列表、趋势点、预测日期、风险提示、证据下钻。

### 3.5 CLI 本地代码助手

#### 3.5.1 认证与设备

- 明确 `persistlog login` 的流程：设备授权码（浏览器确认）还是账号密码；推荐设备授权，避免 CLI 存密码。
- 新增 `devices`、`device_tokens`：token 哈希、scope、过期时间、撤销时间、最后使用时间。
- CLI 凭证存 OS keychain，不写明文配置。
- 支持 `persistlog logout` 撤销当前设备 token。

#### 3.5.2 项目映射与同步

- 本地 `~/.persistlog/config.json` 保存项目名、项目 ID、路径、默认分支；服务端只保存项目 ID/名称/仓库信息，不保存本地绝对路径。
- 明确 `persistlog project add`、`persistlog sync`、`persistlog submit` 的语义。
- `sync` 是拉取今日任务/任务 ID，还是上传 Git 元数据？需要定义。
- 新增 `local_projects` 表。

#### 3.5.3 提交协议

- `POST /code-submissions`：project_id、task_occurrence_id、commit_sha、diff、files、test_results、self_note、language、problem metadata。
- 返回 `submission_id` + `evaluation_job_id`。
- 大文件走预签名 URL；提交前展示文件列表并让用户确认。
- 明确支持“只传 diff”“只传选中文件”“传整个项目压缩包”三种模式。

#### 3.5.4 安全边界

- `.persistlogignore`、敏感目录排除、密钥扫描。
- 测试命令白名单、超时、资源限制；服务端不能主动在用户机器上执行命令。
- token scope 最小化：`tasks:read`、`submissions:write`。
- 明确“服务端永远不能直接访问用户电脑目录”。

#### 3.5.5 排期

- 如果 CLI 保持 P0，开发阶段必须前移；否则验收 #13 无法在 P0 完成。

### 3.6 通知

#### 3.6.1 渠道配置

- 新增 API：`POST/GET/PATCH/DELETE /notification-channels`、`POST /notification-channels/{id}/test`。
- 新增 `notification_channels` 的字段：`name`、`channel_type`、`config_ciphertext`、`status`、`quiet_hours_json`、`last_test_at`、`last_error`。
- Webhook 只返回脱敏值；支持重新配置、删除、测试。

#### 3.6.2 触发矩阵

| 事件 | 默认时间 | 渠道 | 去重键 | 备注 |
|---|---|---|---|---|
| 今日任务生成 | 07:30 | 企微 | user+date+today | 含任务数/预计时长/第一件事 |
| 任务逾期 | 20:00 | 企微 | user+date+overdue | 只发一次 |
| 错题到期 | 07:30 | 企微 | user+date+review | 可合并进早报 |
| 晚间复盘 | 20:30 | 企微 | user+date+evening | 含完成率 |
| 周总结 | 周日 20:00 | 企微 | user+week+weekly | 轻量统计 |
| 顺延通知 | 日切后 | 企微 | user+date+carry | 说明影响 |
| 任务开始 | 可选 | 企微 | user+occurrence+start | 默认关闭，避免噪音 |
| 连续未完成 | 可选 | 企微 | user+date+streak | 需定义阈值 |

#### 3.6.3 模板与偏好

- `notification_templates`：code、channel_type、locale、subject、body、version、status。
- `notification_preferences`：user_id、event_type、channel_id、enabled、send_time、timezone、quiet_hours_behavior。
- 免打扰语义要定义：延迟到静默结束，还是直接丢弃；早报/晚报建议延迟，逾期提醒建议丢弃或合并。

#### 3.6.4 企微安全

- 用户提交的 Webhook 是外部 URL，服务端会主动请求，存在 SSRF 风险。
- 需要：只允许 HTTPS、主机白名单 `qyapi.weixin.qq.com`、禁止重定向、超时、限制响应大小。
- Webhook key 加密存储，日志脱敏，支持轮换/删除。
- 群机器人单向推送，不能读回复；“完成/跳过”通过链接回 Web。

#### 3.6.5 Outbox

- 把 14.3 的 `notification_outbox` 正式纳入数据模型。
- 唯一键 `(user_id, dedup_key)`；重试策略已有，补死信/人工重发。
- 发送失败要能在页面看到状态，而不是只写日志。

### 3.7 导入

#### 3.7.1 标准路线 Schema

需要一份“导入目标格式”的 JSON Schema，至少包含：

```json
{
  "title": "30 天后端冲刺",
  "start_date": "2026-10-20",
  "end_date": "2026-11-18",
  "stages": [
    {
      "name": "基础夯实",
      "objective": "补齐计网/OS/DB 核心",
      "weeks": [
        {
          "week_no": 1,
          "focus": "网络基础",
          "milestone": "能讲清 TCP 三次握手/四次挥手",
          "tasks": [
            {
              "title": "TCP 三次握手",
              "task_type": "fundamentals",
              "scheduled_date": "2026-10-20",
              "estimated_minutes": 45,
              "learning_objective": "理解状态机与异常",
              "action": "阅读 + 口述 3 分钟",
              "deliverable": "口述录音/笔记",
              "acceptance": "不看资料讲清 SYN/SYN-ACK/ACK",
              "priority": "P1",
              "dependencies": [],
              "capability_codes": ["network.tcp"]
            }
          ]
        }
      ]
    }
  ]
}
```

#### 3.7.2 校验规则

- 必填：title、task_type、日期或周、estimated_minutes、deliverable、acceptance。
- 日期在路线范围内；无日期任务按周分配；只有周计划的任务按容量拆分到日。
- 总时长 ≤ 可用天数 × 有效日容量 × 0.8。
- 依赖存在且无环；单任务 >120 分钟要拆分或警告。
- 能力编码必须存在于能力词典；未知编码给警告，不直接失败。
- 重复任务（title + date）要提示合并/跳过/保留。

#### 3.7.3 预览与回滚

- 预览要同时给树形（阶段/周/任务）和日历视图。
- 允许在预览里修改字段并重新校验，不能只让用户“确认/取消”。
- 落库用批次 ID；支持整批回滚。
- 冲突策略：默认新建路线；如果要覆盖当前执行中路线，必须二次确认，并保留旧版本。

#### 3.7.4 导入数据表

- `import_batches`：user_id、file_id、format、status、parser_version、summary_json。
- `import_items`：batch_id、source_locator、normalized_json、status、error_json。
- `import_issues`：batch_id、item_id、severity、code、message、suggestion。

#### 3.7.5 HTML 安全

- HTML 导入要清洗脚本/样式/事件属性；只保留文本结构。
- 限制文件大小、嵌套深度、图片外链。

### 3.8 API 契约

#### 3.8.1 异步任务契约

现在 `POST /routes/generate` 返回 `job_id`，但没有查询端点的定义。需要统一：

```text
POST /api/v1/routes/generate  -> 202 { "job_id": "..." }
GET  /api/v1/jobs/{job_id}    -> {
  "id": "...",
  "type": "route_generation",
  "status": "queued|running|succeeded|failed|cancelled",
  "progress": 0.42,
  "result_ref": "route:123",
  "error": null,
  "created_at": "...",
  "updated_at": "..."
}
```

所有 AI/导入/评分/导出都走同一套 Job 契约；前端轮询或 SSE。

#### 3.8.2 错误与分页

- 统一错误包：

```json
{
  "error": {
    "code": "ROUTE_CAPACITY_EXCEEDED",
    "message": "每日容量不足",
    "details": { "required": 260, "available": 192 },
    "request_id": "..."
  }
}
```

- 统一分页：`page` / `page_size` 或 cursor；返回 `items`、`total`、`next_cursor`。
- 统一幂等：`Idempotency-Key` 请求头，服务端保存 24 小时。
- 统一并发：路线/任务更新带 `version` 或 `If-Match`，避免覆盖。

#### 3.8.3 缺失端点

| 功能 | 缺失端点 | 优先级 |
|---|---|---|
| 档案/目标/困境/简历版本 | `PATCH/DELETE /job-targets/{id}`、`POST /dilemmas`、`GET/PATCH /resumes/{id}` | P0 |
| 诊断接受/修改 | `PATCH /diagnoses/{id}`、`POST /diagnoses/{id}/accept` | P0 |
| 路线草稿编辑 | `PATCH /routes/{id}/draft` | P0 |
| 路线复制/归档/版本 | `POST /routes/{id}/copy`、`POST /routes/{id}/archive`、`GET /routes/{id}/versions` | P1 |
| 路线调整开始/容量 | `POST /routes/{id}/adjust` | P1 |
| 任务跳过/解除阻塞/放弃 | `POST /tasks/{id}/skip`、`/unblock`、`/abandon` | P0 |
| 任务备注/产物 | `PATCH /tasks/{id}`（note）、`POST /tasks/{id}/artifacts` | P0 |
| 请求 AI 帮助 | `POST /tasks/{id}/ai-help` 或独立 chat | 待定 |
| 今日任务列表 | `GET /today` 的完整响应 Schema | P0 |
| 按日期/周查任务 | `GET /tasks?date=`、`GET /tasks?week=` | P1 |
| 每日题集 | `GET /quizzes/today`、`POST /quizzes/{id}/answers`、`POST /answers/{id}/follow-up` | P0 |
| 练习列表/详情 | `GET /practice-sessions`、`GET /practice-sessions/{id}` | P1 |
| 错题详情/编辑/删除 | `GET/PATCH/DELETE /mistakes/{id}` | P1 |
| 复习设置 | `GET/PUT /review-settings` | P1 |
| 通知渠道配置/测试 | `POST/GET/PATCH/DELETE /notification-channels`、`POST /{id}/test` | P0 |
| 通知偏好 | `GET/PUT /notification-preferences` | P0 |
| 文件预签名 | `POST /files/presign`、`POST /files/{id}/complete` | P0 |
| CLI 设备授权 | `POST /auth/device/code`、`POST /auth/device/token` | P0 |
| CLI 项目/提交 | `GET/POST /local-projects`、`POST /code-submissions` | P0 |
| 数据导出 | `POST /data-exports`、`GET /data-exports/{id}` | P1 |
| 账号删除 | `POST /account/delete`、`GET /account/deletion-status` | P1 |
| 管理后台 | `GET /admin/users`、`GET/PUT /admin/prompts`、`GET/PUT /admin/rubrics` | P1 |
| 周报 | `GET /reports/weekly`、`POST /reports/weekly/generate` | P1 |
| 看板趋势 | `GET /dashboard/trends` | P1 |

#### 3.8.4 权限与限流

- 所有业务查询强制 `user_id` 过滤，不能信前端传的 ID。
- 明确每个端点的 scope：`profile:read`、`tasks:write`、`submissions:write`、`notifications:write`、`admin`。
- 明确限流：登录、AI 生成、评分、文件上传、通知发送分别限流。

### 3.9 数据模型

#### 3.9.1 缺表

| 表 | 用途 | 优先级 |
|---|---|---|
| `daily_reviews` | 每日复盘主体 | P0 |
| `daily_review_items` | 复盘与任务/练习/评分的关联 | P0 |
| `daily_quiz_sessions` | 每日题集 | P0 |
| `daily_quiz_items` | 题集与题目/答案的关联 | P0 |
| `answer_turns` | 追问轮次 | P0 |
| `knowledge_points` | 知识点树 | P0 |
| `question_knowledge_points` | 题目-知识点 | P1 |
| `mistake_knowledge_points` | 错题-知识点 | P1 |
| `rubrics` / `rubric_versions` | 评分规则版本 | P0 |
| `job_capability_requirements` | 岗位能力要求与权重 | P0 |
| `capability_snapshots` | 能力趋势快照 | P1 |
| `route_forecast_history` | 预测完成日期历史 | P1 |
| `devices` / `device_tokens` | CLI 设备授权 | P0 |
| `local_projects` | CLI 本地项目映射 | P0 |
| `code_submissions` | 代码提交 | P0 |
| `notification_templates` | 通知模板 | P0 |
| `notification_preferences` | 用户通知偏好 | P0 |
| `import_batches` / `import_items` / `import_issues` | 导入批次与问题 | P0 |
| `user_consents` | AI 数据授权 | P0 |
| `refresh_tokens` | Refresh Token 存储/撤销 | P0 |
| `prompt_templates` / `model_configs` | Prompt/模型配置 | P1 |
| `workflow_runs` | LangGraph 工作流持久化 | P1 |
| `review_settings` | 用户复习参数 | P1 |
| `daily_plans` / `daily_plan_items` | 每日计划快照 | P0/P1 |
| `weekly_reports` | 周报 | P1 |
| `data_export_jobs` / `deletion_requests` | 数据导出/删除 | P1 |

#### 3.9.2 表字段不足

| 表 | 需要补的字段/约束 |
|---|---|
| `users` | email/phone 唯一；状态、创建时间 |
| `user_profiles` | 学历、专业、年级/工作年限、技术栈、目标岗位、每日可用时间、容量系数 |
| `job_targets` | 角色、城市、行业、公司类型、目标日期、优先级、`is_primary`；同一用户仅一个主目标 |
| `resume_versions` | 文件元数据、解析状态、解析错误、`is_current` 唯一 |
| `dilemmas` | 原始文本、结构化上下文、创建时间 |
| `diagnoses` | 结构化诊断 JSON、能力差距、简历问题、项目问题、优先级、风险、模型/提示词版本 |
| `routes` | 状态枚举、当前版本 FK、来源、开始/结束日期、预测结束日期 |
| `route_versions` | 快照 JSON、变更类型、变更摘要、创建人/时间 |
| `route_stages` | 顺序、目标、能力标签、起止日期、验收标准 |
| `plans` | 语义（模板/快照）、stage_id、week_no、focus、milestone、生成版本 |
| `tasks` | learning_objective、recommended_resources、capability_codes、needs_review、source_id |
| `task_occurrences` | actual_minutes、note、skip/block reason、reviewed_at、split_index、parent_occurrence_id |
| `practice_sessions` | 题目/任务关联、提交状态、产物 |
| `questions` | type、source、difficulty、capability、knowledge_point、reference_answer、rubric_code、dedup_hash |
| `answers` | question_id、quiz_item_id、parent_answer_id、confidence_self、submitted_at |
| `evaluations` | rubric_code/version、status、dimensions_json、pass_threshold、evaluator_type |
| `mistakes` | 上述 3.3.1 的全部字段 |
| `review_schedules` | 唯一约束 `(mistake_id, stage_index)`；一个错题仅一个 active schedule |
| `review_attempts` | 回答、结果、评分、confidence、next_due |
| `files` | storage_key、mime、size、hash、scan_status、owner |
| `notification_outbox` | 正式纳入 7 章；status/retry/dead-letter |
| `ai_runs` | workflow_run_id、parent_run_id、idempotency_key、error_detail |
| `audit_logs` | actor_type、actor_id、action、target_type、target_id、before/after、request_id、ip、ua |

#### 3.9.3 索引与约束

- `users(email)`、`users(phone)` 唯一。
- `job_targets(user_id, is_primary)` 部分唯一。
- `resume_versions(user_id, is_current)` 部分唯一。
- `user_capabilities(user_id, job_target_id, capability_id)` 唯一。
- `capability_evidence(source_type, source_id, capability_id)` 唯一，防重复计分。
- `review_schedules(mistake_id, stage_index)` 唯一。
- `daily_plans(user_id, plan_date)` 唯一。
- `notification_outbox(user_id, dedup_key)` 唯一。
- `task_occurrences(user_id, task_id, occurrence_date, split_index)` 唯一。
- `task_occurrences(user_id, occurrence_date, status)` 索引，用于今日/逾期查询。
- `mistakes(user_id, next_review_at, status)` 索引。
- `ai_runs(user_id, created_at)`、`audit_logs(user_id, created_at)` 索引。

#### 3.9.4 枚举与种子数据

- 统一枚举文件/数据库约束：任务状态、occurrence 状态、路线状态、计划状态、诊断状态、导入状态、练习状态、评估状态、复习状态、通知状态、AI 状态、文件状态、同意范围。
- 种子数据：能力词典、岗位能力模板、四类 Rubric、通知模板、默认复习配置。
- 没有种子数据，AI 生成路线时的 `capability_codes` 和评分时的 `rubric_code` 都无法校验。

### 3.10 隐私与安全

#### 3.10.1 授权与同意

- 新增 `user_consents`：scope（profile/resume/code/history/third_party_ai）、version、granted_at、revoked_at、ip/ua。
- AI 上下文构建器必须按 scope 过滤；撤销后新请求立即生效。
- 明确“第三方 AI 不用于训练”的供应商条款；如果供应商无法承诺，要在产品里明示。

#### 3.10.2 数据导出与删除

- 导出：异步 Job → 打包 JSON/CSV + 文件 → 预签名 URL → 过期删除。
- 删除：软删除 → 异步清理对象存储 → 清理备份/第三方 AI 侧数据（如可删）→ 返回删除凭证。
- 明确保留期、备份保留期、删除 SLA。

#### 3.10.3 Token 与会话

- Refresh Token 需要落库或 Redis：hash、user_id、device_id、expires_at、revoked_at、rotated_from。
- 轮换 + 重用检测；异常重用撤销整个 family。
- 补密码重置、邮箱验证、登录失败锁定（P1）。

#### 3.10.4 SSRF 与 Webhook

- 只允许 HTTPS + `qyapi.weixin.qq.com` 白名单；禁止重定向；限制响应大小和超时。
- Webhook key 加密存储，日志脱敏，支持轮换/删除。
- 这是 P0 安全问题，因为 Webhook 由用户输入。

#### 3.10.5 PII 与 Prompt Injection

- 发送第三方 AI 前做 PII 脱敏：姓名、手机、邮箱、公司名、学校名可配置。
- 日志禁止输出简历全文、代码全文、Token、Webhook key。
- 上传的简历/导入计划/网页内容都视为不可信输入：分隔符、指令层级、工具白名单、输出 Schema 校验。
- 禁止模型直接拼 SQL、直接访问 ORM、直接发通知/改路线。

#### 3.10.6 文件安全

- MIME sniffing、扩展名/大小限制、病毒扫描、压缩包炸弹防护、HTML 清洗。
- 图片/PDF OCR 如后续支持，需要单独的资源限制。

### 3.11 前端与信息架构

#### 3.11.1 页面清单

| 路由 | 页面 | 关键内容 | 主要 API |
|---|---|---|---|
| `/login` | 登录 | 登录/注册/忘记密码 | auth |
| `/onboarding` | 引导 | 档案 → 目标 → 简历 → 困境 → 时间 → 诊断 → 路线预览 → 通知 | profile/resume/diagnosis/route |
| `/today` | 今日 | 聚焦、任务、进度、逾期、复习、快捷操作 | `/today`、tasks |
| `/routes` | 路线列表 | 当前/历史/归档 | routes |
| `/routes/{id}` | 路线详情 | 阶段/周/任务、版本、调整 | routes/versions |
| `/practice/{id}` | 练习 | 题目、提交、评分、证据 | practice/evaluations |
| `/quiz` | 每日提问 | 今日题集、作答、追问、结果 | quizzes |
| `/mistakes` | 错题本 | 到期、筛选、掌握度 | mistakes/reviews |
| `/mistakes/{id}` | 错题详情 | 原答案、要点、复习历史 | mistakes |
| `/dashboard` | 成长看板 | 准备度、能力、趋势、证据、预测 | dashboard |
| `/import` | 导入 | 上传、解析、预览、问题、确认 | imports |
| `/settings/profile` | 档案 | 个人信息、目标、时间 | profile |
| `/settings/notifications` | 通知 | 渠道、测试、时间、免打扰、事件开关 | notification |
| `/settings/privacy` | 隐私 | AI 授权、导出、删除 | consents/data |
| `/settings/review` | 复习 | 间隔、配额、重置 | review-settings |
| `/admin/*` | 管理 | 用户、Prompt、Rubric、模板、任务日志 | admin（若做） |

#### 3.11.2 引导流程

需要明确 8 步引导的顺序、必填/可跳过、失败降级：

1. 目标岗位（必填）。
2. 每日可用时间（必填）。
3. 简历上传/解析（可跳过，手填关键信息）。
4. 困境问卷（5–8 题）。
5. AI 诊断（异步，展示进度）。
6. 路线预览（阶段/周/日，容量热力）。
7. 调整（强度/周期/侧重/局部重生成）。
8. 确认 + 通知配置 + 首日计划。

#### 3.11.3 关键状态

- 空状态：无简历、无路线、今日无任务、无错题、无证据。
- 加载/异步：简历解析、诊断、路线生成、评分、导入。
- 失败：AI 失败、解析失败、通知失败、导入失败；保留输入，可重试。
- 部分完成：任务部分完成、评分未评估、证据不足。
- 权限：未登录、Token 过期、无权限。
- 时区/日切：今日任务跨日、逾期、顺延。

### 3.12 指标与埋点

#### 3.12.1 指标定义

每个指标必须有：定义、分子、分母、数据源、频率。

| 指标 | 定义 | 数据源 | 备注 |
|---|---|---|---|
| 注册后档案完成率 | 完成必填档案/注册用户 | users/profile | 需定义“完成” |
| AI 路线生成率 | 成功生成路线/有诊断用户 | routes/diagnoses | 异步状态 |
| 路线接受率 | 接受/生成 | routes | 版本维度 |
| 每日任务完成率 | 完成 occurrence/计划 occurrence；或完成分钟/计划分钟 | task_occurrences | 建议两个都算 |
| 每日复盘完成率 | 完成复盘/有任务的天 | daily_reviews | 需补表 |
| 错题复习完成率 | 完成复习/到期复习 | review_attempts | 需补表 |
| 错题再次答对率 | 复习答对/复习作答 | review_attempts | 需补表 |
| 7/30 日留存 | 第 7/30 天有执行记录/注册用户 | events | 需埋点 |
| 每周有效学习时长 | Σ actual_minutes/周 | task_occurrences | 需补 actual_minutes |
| 路线调整率 | 有调整的路线/活跃路线 | route_versions | 需补版本 |
| 目标岗位准备度提升 | 当前 readiness - 基线 | capability_snapshots | 需补快照 |
| 能力差距缩小 | 基线 gap - 当前 gap | capability_snapshots | 需补快照 |
| 预计完成日期偏差 | 预测日期 - 实际日期 | route_forecast_history | 需补历史 |
| 任务自动顺延率 | 顺延 occurrence/计划 occurrence | task_occurrences | 可算 |
| 证据覆盖率 | 已评估能力权重/总权重 | capability_evidence | 需补模型 |
| 模拟面试表现变化 | — | 无 | V1 无此功能，删除/延后 |
| 面试机会/Offer 转化 | — | 无 | 超出 4.2 范围，删除/延后 |

#### 3.12.2 事件埋点

至少定义：

- `onboarding_started/completed`
- `resume_uploaded/parsed/failed`
- `diagnosis_generated`
- `route_generated/accepted/adjusted`
- `task_started/completed/skipped/postponed/blocked`
- `practice_submitted`
- `evaluation_completed/failed`
- `quiz_completed`
- `review_completed`
- `mistake_created`
- `import_confirmed/failed`
- `notification_sent/clicked/failed`
- `dashboard_viewed`
- `data_export_requested`
- `account_deleted`

没有事件表/埋点方案，PRD 10 的大部分指标只能手工估算。

---

## 4. P1/P2 补充

| 项 | 说明 | 优先级 |
|---|---|---|
| 路线版本 UI/差异/回滚 | `route_versions` 已有概念，缺 Schema/API/UI | P1 |
| 路线自动调整工作流 | 触发、证据、diff、确认、应用、通知 | P1 |
| 周报/月报 | 数据模型、生成任务、页面、推送 | P1 |
| RAG Schema | `knowledge_documents/chunks` 字段、权限、中文全文索引（ngram）、Embedding | P1 |
| 管理后台 | 用户、Prompt、Rubric、模板、失败任务、审计 | P1 |
| Git 服务端接入/IDE 插件 | CLI 之外的仓库 OAuth、插件 | P1 |
| 多渠道通知 | 企微应用、QQ、邮件、站内 | P1 |
| AI 质量/成本监控 | 抽样人工复核、评分一致性、Token 预算 | P1 |
| 备份/恢复/CI-CD | 每日备份、恢复演练、迁移回滚、流水线 | P1 |
| 性能/SLO | P95、AI 任务时延、队列积压、容量规划 | P1 |
| 安全测试 | 越权、SSRF、文件上传、Prompt Injection、限流 | P1 |
| 可访问性/国际化 | 键盘、屏幕阅读器、英文 | P2 |

---

## 5. 建议新增的文档

| 文档 | 内容 | 优先级 | 依赖 |
|---|---|---|---|
| `decision-log.md` | D-01 ~ D-14 的最终决策、理由、日期 | P0 | 无 |
| `domain-model.md` | ERD、状态机、枚举、领域不变量 | P0 | 决策 |
| `database-schema.sql` / `data-dictionary.md` | 全量 DDL、索引、约束、种子数据 | P0 | 领域模型 |
| `openapi.yaml` | 全部端点、请求/响应、错误码、Job、分页、幂等 | P0 | 领域模型 |
| `algorithm-spec.md` | 日编排、复习、能力聚合、预测、顺延 | P0 | 领域模型 |
| `ai-spec.md` | Prompt 注册表、输出 Schema、Rubric、评测集、质量门 | P0 | 领域模型 |
| `ia-wireframes.md` | 页面地图、引导流程、关键状态、交互稿 | P0 | 产品需求 |
| `security-privacy.md` | 同意、导出/删除、Token、SSRF、PII、供应商 | P0 | 技术方案 |
| `metrics-events.md` | 指标定义、事件表、看板、数据源 | P1 | 领域模型 |
| `test-plan.md` | 单元/集成/E2E/安全/AI 评测/迁移 | P1 | 上述文档 |

---

## 6. P0 检查清单

- [ ] D-01 复习间隔改为 `first_review_after_days=1` + `[1,4,7,14]`，并写清自适应规则。
- [ ] D-02 决定算法代码评审是否 P0；若 P0，补评分 Schema 和验收。
- [ ] D-03 决定 CLI 是 P0 还是 P1；若 P0，前移阶段并补协议。
- [ ] D-04 定义 occurrence 状态机、`tasks`/`task_occurrences` 真源和字段。
- [ ] D-05 拆分 daily_quiz / daily_review 工作流，补表。
- [ ] D-06 补岗位能力要求、权重、证据聚合、readiness 口径。
- [ ] D-07 补通知渠道 CRUD/测试、模板、偏好、触发矩阵。
- [ ] D-08 补诊断/路线草稿编辑、归档、版本 API。
- [ ] D-09 明确 HTML 导入版本。
- [ ] D-10 明确深链接口径。
- [ ] D-11 明确周总结是推送还是完整周报。
- [ ] D-12 明确管理员是否在 V1 范围。
- [ ] D-13 删除/延后不可采集指标，补 actual_minutes、预测历史、能力快照。
- [ ] D-14 把成长看板写进开发阶段。
- [ ] 任务模型补 learning_objective、resources、capability、needs_review。
- [ ] 任务拆分模型与唯一键调整。
- [ ] 周计划/周目标模型。
- [ ] 每日计划快照/生成记录。
- [ ] 顺延/预测算法与测试用例。
- [ ] 题目/题集/追问模型。
- [ ] Rubric 版本化与未评估语义。
- [ ] 错题字段、知识点树、复习设置。
- [ ] 能力词典与种子数据。
- [ ] CLI 设备授权/项目映射/提交协议/安全边界。
- [ ] 导入标准 Schema、校验、预览编辑、回滚。
- [ ] Job 状态、错误包、分页、幂等、并发控制。
- [ ] 缺失端点补齐（至少 3.8.3 的 P0 项）。
- [ ] 全量 DDL、索引、约束、枚举。
- [ ] 同意、导出/删除、Refresh Token、SSRF、PII 脱敏。
- [ ] 页面 IA、Onboarding、关键状态。
- [ ] 指标定义与事件埋点。

---

## 7. 如果只能先做 5 件事

1. **拍板 5 个决策**：D-01 复习间隔、D-02 算法评审范围、D-03 CLI 排期、D-04 任务状态、D-05 复盘/提问拆分。
2. **出领域模型**：ERD + occurrence 状态机 + 全量枚举 + 唯一约束（3.1 / 3.9）。
3. **出 API 契约**：OpenAPI + Job 状态 + 错误包 + 幂等 + 缺失端点（3.8）。
4. **出三份算法规格**：日编排与顺延、复习调度、能力证据聚合（3.1 / 3.3 / 3.4）。
5. **出最小 IA**：Onboarding、今日页、通知配置、复盘/提问页（3.11 / 3.6）。

这五件事做完，开发阶段才不会因为“规则没定、表没建、接口没约、页面没走”而反复返工。

---

## 8. 一句话总结

两份文档已经回答了“做什么”和“用什么技术做”，但还没有回答“规则到底是什么、数据长什么样、接口怎么约定、页面怎么走”。先把 D-01 ~ D-14 拍板，再产出领域模型、DDL、OpenAPI 和三份算法/评分规格，开发才不会在复习档期、任务状态和能力看板上返工。
