# 恒序 persistLog · 前端技术架构

- **版本**：v0.2（Phase 1 页面 + 前后端联调）
- **更新日期**：2026-11-15
- **对应代码**：`persistLogFrontend/`
- **设计依据**：[P1 页面设计协作规范](frontend-design-guidelines.md) 与当前 React 实现；[P2 / P3 规划原型](../design/p2p3/README.md)

---

## 1. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router） |
| UI | React 19 + TypeScript 5.9 |
| 样式 | `app/optimized.css` 当前浅色视觉覆盖；`app/globals.css` / `app/uwp.css` 提供基础布局与兼容规则 |
| 组件 | 业务组件优先；`uwp_components` 仅作为迁移期间的旧版兼容层 |
| 图标 | lucide-react |
| 包管理 | pnpm 12 |
| 构建 | Turbopack（Next.js 默认） |
| 校验 | ESLint 9 + `tsc --noEmit` |

没有引入 Tailwind 或状态管理库；业务布局仍用原生 CSS，UWP 组件与皮肤负责控件、surface、字体与状态。后续如果数据缓存复杂，可引入 TanStack Query。

---

## 2. 渲染模型

```text
app/layout.tsx（RootLayout）
  └─ AppStoreProvider（任务/路线/授权状态）
      └─ ToastProvider（全局反馈）
          ├─ app/(app)/layout.tsx（AppShell：侧边栏/顶栏/移动导航）
          │   ├─ /today
          │   ├─ /dashboard
          │   ├─ /routes /routes/[id]
          │   ├─ /import
          │   └─ /settings/[tab]
          └─ app/(auth)/login
              app/(auth)/onboarding
```

- 页面文件是 Server Component：读取 `params` / `searchParams`，设置 metadata。
- 视图组件是 Client Component：处理表单、弹窗、任务状态和本地演示状态。
- `?state=` 只用于设计评审状态演示，不参与业务数据。

### 2.1 为什么页面和视图分层

- Server 层保持路由、metadata、参数解析简单可测。
- Client 层承接交互，避免把 `useState` 散落在路由文件里。
- 后续接 API 时，可在 Server 层做首屏数据加载，Client 层做乐观更新。

---

## 3. 目录与模块边界

| 目录 | 职责 | 不负责 |
| --- | --- | --- |
| `app/` | 路由、布局、metadata、参数解析 | 复杂业务状态 |
| `components/*-view.tsx` | 页面级组合、交互编排 | 跨页面数据持久化 |
| `components/today/` | 任务行、详情抽屉、任务弹窗 | 路线/看板渲染 |
| `components/import/` | 上传/解析/预览/确认状态机 | 真实文件解析（后端） |
| `components/routes/` | 路线列表、详情、阶段/周/任务、版本 | 今日计划生成 |
| `components/dashboard/` | KPI、趋势、分布、预测 | 能力评分 |
| `components/settings/` | 档案、通知、AI 授权、数据 | 认证后端 |
| `lib/auth/` | 会话初始化、登录、刷新、登出 | 业务数据 |
| `lib/store/` | 跨页面 today/routes/profile/授权状态 | 服务端持久化 |
| `lib/api/` | fetch、Bearer、401 刷新、端点、映射 | UI 逻辑 |
| `lib/mock-data.ts` | 历史设计常量和导入模板；不再作为 Store 失败回退 | 真实数据 |
| `lib/config/data-source.ts` / `lib/api/mock/p1.ts` | 构建期数据源选择、Mock 请求与隔离会话 | Live 失败回退、真实通知发送 |
| `app/globals.css` / `app/uwp.css` / `app/optimized.css` | 业务布局、旧版 UWP 兼容层、当前视觉覆盖 | 组件内联样式 |
| `docs/frontend-design-guidelines.md` | 当前 P1 视觉、布局、动效、细节与文字协作基准 | 业务数据与 API |
| `design/p2p3/` | P2 / P3 页面规划、静态交互与接入口径 | 真实业务、API 持久化或 AI 调用 |

---

## 4. 状态模型

### 4.1 Task

```ts
type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "postponed"
  | "skipped"
  | "blocked"
  | "abandoned";
```

关键字段：`planned` / `actual` / `carry` / `why` / `output` / `acceptance` / `source`。

### 4.2 Store actions

```text
startTask(id)
completeTask(id, actual, note)
postponeTask(id, reason)
skipTask(id, reason, note)
blockTask(id, reason)
unblockTask(id)
restoreTask(id)
abandonTask(id)
splitTask(id, parts)
addTask(input)
completeAll()
clearToday()
setRouteStatus(id, status)
setConsentGranted(boolean)
resetDemo()
```

派生值：

- `taskStats(tasks)`：完成率、容量、顺延、待完成。
- `routeDoneCount(tasks)`：路线完成数（按 task 去重）。
- `routePercent(tasks)`：路线进度。
- 侧边栏、今日摘要、看板、路线详情共用同一派生函数。

### 4.3 演示数据口径

- 今日 5 项 / 220 分钟 / 2 完成。
- 路线 42 项 / 26 完成 / 62%。
- 今日完成后路线变为 27/42 = 64%，Toast 与侧边栏同步。
- 预测 11/12，目标 11/10，晚 2 天。

---

## 5. API 接入

### 5.1 客户端

2026-11-19 起，全项目模式由 `scripts/run-mode.mjs` 选择：`dev/build/start:mock` 使用本地 P1 演示适配器，`:live` 使用真实 API，默认 Live。参见 [数据源运行说明](data-source-modes.md)。`apiFetch` 与认证刷新统一选择传输方式；Mock 禁用 API rewrite，不发送企微/AI 请求。Store 不再在请求失败后退回旧演示数据。P2/P3 后续沿用本配置，不通过 URL 选择模式。

`lib/api/client.ts`：

- `apiFetch<T>(path, init)`：拼 `NEXT_PUBLIC_API_BASE_URL`，`credentials: "include"`。
- 统一抛出 `ApiError`，携带 `status` / `code` / `requestId`。
- 204 返回 `undefined`。
- 请求体由 `jsonBody` 序列化。

### 5.2 端点映射

`lib/api/live.ts` 按 openapi 分组：

```text
auth.login / register / me / logout
profile.get / update / jobs / createJob / updateJob / consents / setConsent
today.get / generate / addItem / action
imports.create / get / preview / updatePreview / confirm / cancel / rollback / job
routes.list / get / create / action / adjust / forecast / versions / createTask
dashboard.overview / trends / distribution / forecast
notifications.channels / createChannel / updateChannel / deleteChannel /
  preferences / updatePreferences / outbox / test / resend
```

`lib/api/mappers.ts` 负责把后端对象映射成页面类型，避免组件直接依赖 snake_case 字段。

### 5.3 当前接入状态

已接真实链路：

1. 登录/注册/刷新/登出、SessionGate、401 单飞刷新。
2. 今日 `GET /today` 与全部 occurrence 动作；完成后重新拉取 today + routes。
3. 导入 multipart 上传、Job 轮询、预览、确认、回滚。
4. 路线列表/详情、暂停/恢复/归档、调整日期/容量；阶段/周 `progress` 直接使用后端返回值。
5. 看板 overview / trends / distribution / forecast。
6. 档案与主目标保存、通知渠道/偏好/Outbox 读取与测试发送。
7. 今日手动加任务 `POST /today/items`；导入预览编辑走 `PATCH /imports/{id}/preview`。
8. 已有空计划会在下一次 `GET /today` / `POST /today/generate` 自动补齐。

仍为前端或占位的部分见 README §7。

### 5.4 认证

- `POST /auth/login` 返回 access token，只放内存。
- Refresh token 由 HttpOnly Cookie 承载，前端不读、不写 localStorage。
- `SessionGate` 在 `(app)/layout.tsx` 检查会话；未登录跳 `/login`。
- 401 时 `client.ts` 单飞刷新并重试一次；失败清空 token 并跳登录。
- CSRF/Origin 校验由后端负责；前端 `credentials: "include"`。
- Next rewrite 让浏览器只看到 `localhost:3000`，避免 localhost / 127.0.0.1 的 Cookie 不同源问题。

---

## 6. 设计系统与样式边界

当前 P1 设计基准是 [P1 页面设计协作规范](frontend-design-guidelines.md) 与 React 实现，不恢复已清理的 P1 静态原型和重复规格。P2 / P3 规划原型统一放在 [design/p2p3/](../design/p2p3/README.md)，用于后续页面与交互协作；未经 React、真实接口和浏览器验收，不视为已实现功能。

- `app/optimized.css` 由根布局最后加载，提供当前浅色工作区的共享 token、布局和响应式覆盖。
- `app/globals.css`、`app/uwp.css`、`components/uwp-root.tsx` 与 `uwp_components` 暂作为旧版兼容层保留，不再扩展新的 UWP 专属样式。
- 新样式优先使用 `--primary`、`--text-*`、`--surface-*` 等 optimized token；旧 `--brand-*` / `--ink-*` 变量只用于兼容映射。
- 桌面侧栏为 216px，卡片圆角为 12px；工作台使用 `.app-shell`，不能将通用 `.app` 当作工作台网格容器。
- 图标继续使用 `lucide-react`，业务组件应将颜色、间距、圆角和主题值集中到当前 token 中。
- 历史设计可通过 Git 回溯；旧原型中的深色主题、假数据和未落地交互不作为当前实现依据。

---

## 7. 响应式

| 断点 | 行为 |
| --- | --- |
| > 1200 | 216px 侧栏 + 多列主内容 |
| 861–1200 | 196px 侧栏；861–1100 沿用隐藏侧栏文字的紧凑导航 |
| ≤ 860 | 隐藏侧栏；顶部品牌 + 底部 4 导航，主要内容单列，指标双列 |
| ≤ 640 | 今日 Hero 与容量卡重排，主要按钮触控高度至少 44px |
| ≤ 560 | 页头与操作区纵向排列，表单单列 |
| ≤ 420 | KPI 单列、Hero 操作按钮全宽 |

移动端入口：今日 / 看板 / 路线 / 我的；导入从今日空态和路线页进入。完整约束见设计协作规范。

---

## 8. 可访问性

- 可交互控件保留键盘焦点与可读名称；图标按钮提供明确的 `aria-label`。
- 进度环有 `aria-label` 和文本百分比；图表有总体 `aria-label`。
- 状态使用文字 + 颜色；不仅靠色点。
- `prefers-reduced-motion` 将动画和过渡压至极短时长。
- Sheet 已处理 Esc 和锁滚动；Modal 基于 ContentDialog，不能据此假定所有弹层都支持 Esc、完整焦点陷阱与焦点恢复。
- 新增或修改弹层时，逐项验证焦点进入、Tab 顺序、焦点恢复、Esc、背景交互和锁滚动。

---

## 9. 测试与验证

当前验证：

```bash
pnpm lint
pnpm build
```

浏览器验收：

- 1440 / 390 宽度截图。
- 今日完成 → 60% / 路线 64% / Toast 同步。
- 添加任务 → 行数 +1，容量重算。
- 导入：授权 → 解析 → 预览 → 编辑 → 确认。
- 路线暂停/恢复、详情 tabs。
- 看板 7/30 切换。
- 设置推送/授权。

后续补：

- Vitest + React Testing Library：`taskStats`、`routeDoneCount`、状态动作。
- Playwright：登录 → 今日完成 → 看板对账；导入 → 确认 → 路线。
- Mock Service Worker：API 契约测试。

---

## 10. 已知技术债

1. Store 与页面 props 仍有少量重复派生计算，后续统一到 selector。
2. 未引入 TanStack Query；today/routes/dashboard 有重复拉取，可做缓存与请求去重。
3. 引导步骤 3 的文件选择仍是占位，导入在 `/import` 完成。
4. 通知测试发送依赖有效企微 Webhook；`send_time` 动态调度未开放。
5. 没有自动化 E2E；当前是 lint/typecheck/build + 手工验收。
6. 时间戳按 UTC 解析，后端暂未补 `Z`。

---

## 11. 扩展点

- `lib/api/live.ts`：新增 Phase 2/3 端点。
- `components/today/task-modals.tsx`：新增任务动作时保持同一表单模式。
- `components/dashboard/dashboard-view.tsx`：Phase 2 代码评分趋势区块。
- `components/settings/settings-view.tsx`：Phase 3 复习参数面板。
- `app/globals.css`：新增组件前先复用现有 token/类。
- [P2 / P3 页面原型](../design/p2p3/README.md)：页面路由、主流程、异常状态与领域组件基准；先核对接口再实现，不直接搬运演示数据。
