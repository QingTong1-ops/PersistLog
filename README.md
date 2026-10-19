# 恒序 persistLog · Frontend

**当前状态**：Phase 1 前端技术框架 + 设计初稿页面落地  
**技术栈**：Next.js 16（App Router）+ React 19 + TypeScript + 原生 CSS  
**数据状态**：页面使用 `lib/mock-data.ts` 演示数据；API 客户端与端点映射已就绪，尚未联调后端  
**日期**：2026-10-19  
**远程仓库**：<https://github.com/QingTong1-ops/PersistLog.git>  
**分支**：`frontend-master`

> 恒序把「计划 / 困境」翻译成「今天做什么」，再把「今天做了什么」翻译成「有没有更接近目标」。
> Phase 1 只做计划落地、今日执行、学习路线、执行看板和企微推送；代码评审、错题复习、完整能力看板属于 Phase 2/3。

---

## 1. 快速开始

要求：Node.js ≥ 22，pnpm ≥ 12。

```bash
cd persistLogFrontend
pnpm install
cp .env.example .env.local   # Windows 可用 Copy-Item .env.example .env.local
pnpm dev
```

打开 <http://localhost:3000>。

> 开发环境请使用 `http://localhost:3000`，不要用 `127.0.0.1`，否则 Next.js 的开发资源可能被跨域策略拦截。
> 如确实需要 127.0.0.1，`next.config.ts` 已把 `127.0.0.1` 加入 `allowedDevOrigins`。

### 常用脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发服务器（Turbopack） |
| `pnpm build` | 生产构建 + TypeScript 检查 |
| `pnpm start` | 启动生产构建 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

---

## 2. 当前路由

| 路由 | 页面 | 状态 |
| --- | --- | --- |
| `/login` | 登录 / 注册 | 已落地，交互为前端模拟 |
| `/onboarding` | 4 步首次引导 | 已落地 |
| `/today` | 今日任务、容量、顺延、路线预测 | 已落地，状态联动 |
| `/import` | Markdown 上传 / 解析 / 预览 / 确认 | 已落地，Job 为模拟流程 |
| `/routes` | 路线列表 | 已落地 |
| `/routes/[id]` | 路线详情、阶段/周/任务、版本、设置 | 已落地 |
| `/dashboard` | 执行看板 7/30 天 | 已落地 |
| `/settings/profile` | 档案与容量 | 已落地 |
| `/settings/notifications` | 企业微信推送 | 已落地 |
| `/settings/ai` | AI 授权 | 已落地 |
| `/settings/data` | 数据与账号 | 已落地 |

状态演示：

- `/today?state=done`：今日全部完成
- `/today?state=empty`：今日无任务
- `/import?state=preview`：导入预览
- `/import?state=error`：导入解析失败
- `/routes?state=empty`：无路线
- `/dashboard?state=empty`：无执行记录

开发环境顶栏「页面地图」可打开所有路由和状态演示；生产构建默认隐藏，可通过 `NEXT_PUBLIC_SHOW_DEV_NAV=true` 打开。

---

## 3. 目录结构

```text
persistLogFrontend/
├─ app/
│  ├─ layout.tsx                 # 根布局、Provider、全局样式
│  ├─ page.tsx                   # 跳转 /today
│  ├─ globals.css                # 设计 token + 组件样式 + 响应式
│  ├─ error.tsx / not-found.tsx
│  ├─ (app)/
│  │  ├─ layout.tsx              # 侧边栏 + 顶栏 + 移动端导航
│  │  ├─ today/
│  │  ├─ import/
│  │  ├─ routes/ + routes/[id]/
│  │  ├─ dashboard/
│  │  └─ settings/ + settings/[tab]/
│  └─ (auth)/
│     ├─ login/
│     └─ onboarding/
├─ components/
│  ├─ app-shell.tsx              # 桌面侧边栏、顶栏、移动端导航、页面地图
│  ├─ brand-mark.tsx
│  ├─ ui.tsx                     # Button/Modal/Sheet/Toggle/Toast/进度等
│  ├─ today/                     # 今日视图、任务行、任务抽屉、状态弹窗
│  ├─ import/                    # 导入状态机
│  ├─ routes/                    # 路线列表、路线详情
│  ├─ dashboard/                 # KPI、趋势、分布、预测
│  ├─ settings/                  # 四个设置面板
│  └─ auth/                      # 登录、引导
├─ lib/
│  ├─ types.ts                   # Task/Route/Dashboard/Preview 类型
│  ├─ mock-data.ts               # 统一演示数据
│  ├─ store/app-store.tsx        # 任务状态、路线状态、授权状态
│  ├─ api/client.ts              # fetch 封装、统一错误包
│  ├─ api/endpoints.ts           # 与 openapi.json 对齐的端点映射
│  └─ utils.ts                   # 状态标签、任务统计、路线进度
├─ docs/
│  ├─ architecture.md            # 技术架构与接入说明
│  └─ screenshots/               # 实现截图
├─ design/                       # 原型、视觉规范、页面规格、设计预览
└─ .env.example
```

---

## 4. 架构要点

### 4.1 渲染模型

- 页面本身是 Server Component，负责读取 `searchParams` / `params` 和元数据。
- 视图组件是 Client Component（`"use client"`），负责交互和本地演示状态。
- `(app)/layout.tsx` 提供统一 AppShell；`(auth)` 使用独立全屏布局。
- 状态演示通过 `?state=` 进入，页面用 `key` 或初始化参数隔离，避免 effect 级联渲染。

### 4.2 状态层

`lib/store/app-store.tsx` 提供：

- 今日任务列表与所有 occurrence 状态动作：开始、完成、延期、跳过、阻塞、解除、恢复、放弃、拆分。
- 路线状态：执行中 / 暂停 / 草稿 / 归档。
- AI 授权状态。
- 派生指标：完成率、容量、路线进度、累计活跃。

当前 Store 是前端内存状态；刷新恢复演示数据。接入后端时，保留 action 签名，把 `setTasks` 替换为 API 调用 + 重新拉取。

### 4.3 API 层

- `lib/api/client.ts`：`apiFetch<T>`、`ApiError`、`X-Request-ID`、credentials include。
- `lib/api/endpoints.ts`：auth / today / imports / routes / dashboard / settings 端点，与 `docs/openapi.json` 对齐。
- 认证契约：Access Token 内存，Refresh Token HttpOnly Cookie；前端不写 localStorage。
- 导入接入：`POST /imports` + `GET /jobs/{id}` 轮询；当前界面用 3 秒模拟流程。
- 指标口径：看板数字必须与今日页、路线详情同一口径。

### 4.4 样式

`app/globals.css` 从设计原型迁移：

- `--brand-*` / `--ink-*` / 状态色 token。
- 卡片、按钮、标签、任务行、进度环、抽屉、弹窗、看板图表。
- 桌面侧边栏 + 移动端底部导航。
- `prefers-reduced-motion`、焦点环、状态文字 + 颜色。

详细规范见 [design/visual-design.md](design/visual-design.md) 与 [design/page-spec.md](design/page-spec.md)。

---

## 5. 模块提交记录

按模块拆分提交，便于回溯：

| 提交 | 内容 |
| --- | --- |
| `94b382e` | Next.js + TypeScript 工程、全局样式、根布局 |
| `d54cb39` | 设计系统、数据层、AppShell、页面骨架 |
| `b9bf225` | 登录 / 注册、4 步首次引导 |
| `4f4051b` | 今日执行、任务抽屉、完成/延期/跳过/阻塞/拆分 |
| `582fd29` | Markdown 导入状态机、预览、问题清单、确认/回滚 |
| `5649a7b` | 路线列表、路线详情、阶段/周/任务、版本、调整 |
| `7103605` | 执行看板、7/30 天趋势、分布、预测 |
| `ab210aa` | 档案、企微推送、AI 授权、数据与账号 |
| `docs`（本次） | API 客户端、环境变量、架构文档、README、截图 |

原型与设计文档的历史仍保留在前面的 `ed45972` 提交。

---

## 6. 验证

最近一次验证：

```bash
pnpm lint        # 通过
pnpm build       # 通过，TypeScript 通过
```

浏览器覆盖：

- 1440px 桌面端：登录、引导、今日、导入、路线、路线详情、看板、设置。
- 390px 移动端：今日、导入、看板、设置、登录。
- 交互：完成任务后 40% → 60%、路线 62% → 64%；任务详情抽屉；完成弹窗；添加任务；导入解析 → 预览 → 编辑 → 确认；路线暂停/恢复；看板 7/30 天切换。

截图：

| 今日 | 执行看板 |
| --- | --- |
| ![今日](docs/screenshots/today.png) | ![执行看板](docs/screenshots/dashboard.png) |

| 导入预览 | 设置 |
| --- | --- |
| ![导入预览](docs/screenshots/import.png) | ![设置](docs/screenshots/settings.png) |

更多：[登录](docs/screenshots/login.png)、[移动端今日](docs/screenshots/today-mobile.png)。

---

## 7. 已知限制

1. 页面仍使用 mock 数据，未调用真实 API。
2. 登录/注册、引导提交为前端模拟；没有真实会话。
3. 导入解析为定时模拟，不是真实 Markdown 解析 / AI Job。
4. 企微测试发送、Outbox 重试、审计日志为界面演示。
5. 路线详情任务表展示 19/42 项关键任务，其余结构折叠。
6. 新路线只存在页面内存，刷新后恢复；未持久化。
7. 后端接口的字段细节以 `docs/openapi.json` 为准，接入时需补契约测试。

---

## 8. 下一步

1. 用 `lib/api/endpoints.ts` 替换 mock store，补 TanStack Query（或 SWR）缓存与错误重试。
2. 接真实登录、Refresh Cookie、CSRF/CORS 与路由守卫。
3. 导入接真实 `POST /imports` + `GET /jobs/{id}` 轮询。
4. 今日/看板/路线数据对账，补 E2E。
5. 设置页接通知渠道/偏好/Outbox 与授权记录。
6. 补 Playwright 组件/E2E 测试和 CI。

---

## 9. 分支与推送

```bash
git remote -v
# origin  https://github.com/QingTong1-ops/PersistLog.git (fetch)
# origin  https://github.com/QingTong1-ops/PersistLog.git (push)

git branch -vv
# * frontend-master ... origin/frontend-master
```

前端在 `frontend-master`，后端代码在 `backend-main`，两个分支历史独立；合并策略在前端工程化稳定后再确定。

---

## 10. 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 技术架构、数据流、API 接入方式 |
| [design/visual-design.md](design/visual-design.md) | 设计方向、token、组件、信息架构 |
| [design/page-spec.md](design/page-spec.md) | 逐页规格、状态机、API 映射、验收点 |
| [design/persistlog-phase1-prototype.html](design/persistlog-phase1-prototype.html) | 静态设计原型 |
| [docs/01-产品与功能.md](https://github.com/QingTong1-ops/PersistLog/blob/backend-main/docs/01-产品与功能.md) | 产品范围、功能规格、验收 |
| [docs/02-技术设计.md](https://github.com/QingTong1-ops/PersistLog/blob/backend-main/docs/02-技术设计.md) | 架构、数据、API、算法 |
| [docs/openapi.json](https://github.com/QingTong1-ops/PersistLog/blob/backend-main/docs/openapi.json) | 当前后端契约 |

---

**维护者**：恒序 persistLog  
**最后更新**：2026-10-19
