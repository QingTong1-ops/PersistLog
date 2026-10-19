# 恒序 persistLog · 前端技术架构

- **版本**：v0.1（Phase 1 技术框架）
- **日期**：2026-10-19
- **对应代码**：`persistLogFrontend/`
- **设计依据**：[`design/visual-design.md`](../design/visual-design.md)、[`design/page-spec.md`](../design/page-spec.md)

---

## 1. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router） |
| UI | React 19 + TypeScript 5.9 |
| 样式 | 原生 CSS（从设计原型迁移的 token / 组件类） |
| 图标 | lucide-react |
| 包管理 | pnpm 12 |
| 构建 | Turbopack（Next.js 默认） |
| 校验 | ESLint 9 + `tsc --noEmit` |

没有引入 Tailwind、组件库或状态管理库：Phase 1 页面数量和状态复杂度可控，原生 CSS + React Context 更容易保持设计还原度；后续如果数据缓存复杂，可引入 TanStack Query。

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
| `components/import/` | 上传/解析/预览/确认状态机 | 真实文件解析 |
| `components/routes/` | 路线列表、详情、阶段/周/任务、版本 | 今日计划生成 |
| `components/dashboard/` | KPI、趋势、分布、预测 | 能力评分 |
| `components/settings/` | 档案、通知、AI 授权、数据 | 认证后端 |
| `lib/store/` | 跨页面任务/路线/授权状态 | 服务端持久化 |
| `lib/api/` | fetch 封装、端点映射 | UI 逻辑 |
| `lib/mock-data.ts` | 统一演示数据 | 生产数据 |
| `app/globals.css` | 设计 token、组件、响应式 | 组件内联样式 |

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

`lib/api/client.ts`：

- `apiFetch<T>(path, init)`：拼 `NEXT_PUBLIC_API_BASE_URL`，`credentials: "include"`。
- 统一抛出 `ApiError`，携带 `status` / `code` / `requestId`。
- 204 返回 `undefined`。
- 请求体由 `jsonBody` 序列化。

### 5.2 端点映射

`lib/api/endpoints.ts` 按 openapi 分组：

```text
auth.login / register / me / refresh / logout
today.get / generate / action
imports.create / get / preview / confirm / cancel / rollback / job
routes.list / get / create / update / action / adjust / forecast / versions
dashboard.overview / trends / distribution / forecast
settings.profile / settings / jobTargets / consents / channels / preferences / outbox / auditLogs
```

### 5.3 从 mock 切到真实 API

1. 保留 `AppStore` 的 action 签名，把 `setTasks` 更新替换成：
   - 乐观更新本地 state；
   - 调用 `api.today.action(...)`；
   - 失败回滚并 `showToast`。
2. 页面首次加载时用 Server Component 或 `useEffect` 拉取 `api.today.get()`、`api.routes.list()`、`api.dashboard.overview()`。
3. 导入用 `api.imports.create` + `api.imports.job` 轮询，轮询间隔 1–2 秒，完成后进入预览。
4. 认证接 HttpOnly Refresh Cookie；Access Token 只放内存；401 时调 `api.auth.refresh()`，失败跳 `/login`。
5. 所有接口错误展示 `code + message + request_id`；不要只显示“请求失败”。

### 5.4 认证

- 登录/注册当前是前端模拟。
- 正式接入时：
  - `POST /auth/login` 返回 access token（内存）。
  - Refresh token 由 HttpOnly Cookie 承载，前端不读、不写 localStorage。
  - 路由守卫在 `(app)/layout.tsx` 或 middleware 中检查会话。
  - CSRF/Origin 校验由后端负责；前端 `credentials: "include"`。

---

## 6. 设计系统迁移

- `design/prototype.css` → `app/globals.css`，保留 `--brand-*`、`--ink-*`、状态色、卡片、按钮、任务、看板等类名。
- 原型 HTML 的语义结构迁移为 React 组件；未引入 CSS-in-JS。
- 图标由内联 sprite 改为 lucide-react，视觉尺寸/线宽保持一致。
- 设计 token 修改只改 `:root`，不要在组件里散落色值。

---

## 7. 响应式

| 断点 | 行为 |
| --- | --- |
| > 1200 | 252px 侧边栏 + 多列 |
| ≤ 1024 | 侧边栏收窄；今日/导入/看板单列 |
| ≤ 860 | 隐藏侧边栏；顶部品牌 + 底部 4 导航 |
| ≤ 640 | 任务两行、表单单列、设置导航 2×2、弹窗底部抽屉 |
| ≤ 420 | KPI 单列、按钮全宽 |

移动端入口：今日 / 看板 / 路线 / 我的；导入从今日空态和路线页进入。

---

## 8. 可访问性

- 所有按钮可键盘操作；Modal/Sheet 支持 Esc、焦点进入与关闭恢复。
- 进度环有 `aria-label` 和文本百分比；图表有总体 `aria-label`。
- 状态使用文字 + 颜色；不仅靠色点。
- `prefers-reduced-motion` 关闭过渡。
- 抽屉/弹窗打开时锁滚动；关闭时恢复。

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

1. Store 与页面 props 仍有少量重复派生计算，接入 API 后统一到 selector。
2. 演示数据与组件文案有重复（如目标日期、预测日期），应抽成常量/接口字段。
3. 路线详情阶段任务为静态展示，未与任务 CRUD 打通。
4. 新路线只存在本地 state，未持久化。
5. 导入模拟定时器未使用真实 Job 轮询。
6. 设置页表单保存只 Toast，未调用 API。
7. 未加路由级 loading/error 以外的数据层错误边界。

---

## 11. 扩展点

- `lib/api/endpoints.ts`：新增 Phase 2/3 端点。
- `components/today/task-modals.tsx`：新增任务动作时保持同一表单模式。
- `components/dashboard/dashboard-view.tsx`：Phase 2 代码评分趋势区块。
- `components/settings/settings-view.tsx`：Phase 3 复习参数面板。
- `app/globals.css`：新增组件前先复用现有 token/类。
