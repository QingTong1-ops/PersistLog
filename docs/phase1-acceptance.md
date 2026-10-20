# 恒序 persistLog · Phase 1 验收与收尾

- **日期**：2026-10-20
- **范围**：Phase 1 计划落地（登录、档案/目标、导入、路线、今日执行、看板、企微通知、AI 授权）
- **前端**：`frontend-master`，Next.js 16 + React 19
- **后端**：`backend-main` / 本地工作区 Phase 1 + 本轮补齐项
- **联调地址**：前端 `http://localhost:3000`，后端 `http://127.0.0.1:8000`

---

## 1. 结论

Phase 1 前后端主链路已闭环，可以进入「真实使用 7 天」的收尾观察期。

| 能力 | 状态 | 说明 |
|---|---|---|
| 注册 / 登录 / 刷新 / 登出 | ✅ | Access Token 内存，Refresh HttpOnly Cookie |
| 档案 / 容量 / 主目标 | ✅ | `/profile`、`/job-targets` 真实保存 |
| AI 授权 | ✅ | `PUT /consents`，首次导入前授权 |
| Markdown 导入 | ✅ | multipart → Job 轮询 → 预览 |
| 预览编辑 | ✅ | `PATCH /imports/{id}/preview`，确认使用最新结构 |
| 导入确认 / 回滚 | ✅ | 幂等确认；未产生执行记录可回滚 |
| 路线 / 阶段 / 周 / 任务 | ✅ | 列表、详情、暂停/恢复/归档、调整 |
| 阶段 / 周进度 | ✅ | 后端 `progress` 直接返回 |
| 今日计划 | ✅ | `GET /today`、`POST /today/generate` |
| 手动加任务 | ✅ | `POST /today/items`，刷新后保留 |
| 空计划回填 | ✅ | 先有今日空计划、后导入路线也会自动补齐 |
| occurrence 动作 | ✅ | 开始/完成/延期/跳过/阻塞/解除/放弃/拆分 |
| 看板 | ✅ | overview / trends / distribution / forecast |
| 企微通知 | ⚠️ 部分 | 渠道/偏好/Outbox/测试已接；动态 send_time 未开放 |
| 移动端 | ✅ | 390px 今日/导入/路线/看板/设置通过 |

---

## 2. 自动化验证

```text
后端：.\.venv\Scripts\python.exe -m pytest -q   通过
前端：pnpm lint                                  通过
前端：pnpm typecheck                             通过
前端：pnpm build                                 通过
```

构建产物：

```text
/            → /today
/today       → 今日执行
/dashboard   → 执行看板
/import      → Markdown 导入
/routes      → 路线列表
/routes/[id] → 路线详情
/settings/*  → 档案、通知、AI、数据
/login       → 登录/注册
/onboarding  → 首次引导
```

---

## 3. 浏览器验收记录

### 3.1 认证

- [x] 登录后进入 `/today`
- [x] 刷新页面仍保持登录（Refresh Cookie 生效）
- [x] 401 单飞刷新后原请求重试
- [x] 退出登录回到 `/login`

### 3.2 今日

- [x] 今日 3 项 / 140 分钟 / 有效容量 144
- [x] 完成「TCP 三次握手」后 33%（1/3）
- [x] 路线进度 17%（1/6）
- [x] 看板 overview 同步 33%
- [x] 手动添加「Phase1 回归任务」后 4 项
- [x] 刷新后临时任务仍在（`POST /today/items`）

### 3.3 导入

- [x] 上传 Markdown → Job 轮询
- [x] 预览 2 阶段 / 2 周 / 3 任务 / 180 分钟
- [x] 编辑第一项标题 → `PATCH preview` 成功
- [x] 前端显示编辑后的标题
- [x] 确认创建路线（另一次导入验证）
- [x] 取消/回滚批次

### 3.4 空计划回填

- [x] 新用户先 `GET /today` 生成 0 项空计划
- [x] 导入并确认路线
- [x] 同一 `plan_id` 再次 `GET /today` 自动补齐 3 项 / 140 分钟
- [x] 不需要删除计划或重新生成

### 3.5 路线

- [x] 路线列表默认不返回 archived
- [x] 路线详情 2 阶段 / 6 任务
- [x] 阶段进度 `1/4 · 25%`
- [x] 周进度「完成 1/3」
- [x] 暂停 / 恢复 / 归档 / 调整日期容量

### 3.6 看板与设置

- [x] 7/30 天、趋势、分布、预测真实数据
- [x] 档案 180 分钟 / 80% / 有效 144
- [x] 企微未配置时显示「未配置」，测试按钮禁用
- [x] AI 授权状态来自后端

---

## 4. 数据与清理

联调测试数据：

- 主测试账号：`lin.frontend@example.com`
- 回填测试账号：`phase1.backfill@example.com`
- 主账号当前：1 条 active 路线、6 个任务、今日 3 项（1 项完成）
- 临时任务与预览批次已 abandon / cancel，避免影响页面
- 测试账号仅存在于本地开发库

---

## 5. 已知限制（不阻塞 Phase 1 观察）

1. 企微测试发送需要有效 Webhook；`send_time` 动态调度未开放。
2. 引导步骤 3 的文件选择仍是占位，导入在 `/import` 完成。
3. 没有自动化 E2E；当前为 lint/typecheck/build + 手工验收。
4. 时间戳仍按 UTC 解析（后端暂未补 `Z`）。
5. Phase 2/3 页面未开始。

---

## 6. Phase 1 观察期任务

进入 Phase 2 前，按产品文档 §10.5 完成：

- [ ] 连续 7 天真实使用
- [ ] 至少 20 条真实任务数据
- [ ] 导入 / 今日 / 看板 / 推送稳定
- [ ] 任务状态、实际耗时、顺延可对账
- [ ] 明确代码提交格式与 Rubric
- [ ] 记录每天的实际使用问题，形成 Phase 2 输入

---

## 7. 上线前检查

- [ ] `BACKEND_API_URL` 指向生产 API，或使用 Nginx 同源反向代理
- [ ] `CORS_ORIGINS` 只包含真实前端 Origin
- [ ] `REFRESH_COOKIE_SECURE=true`，全站 HTTPS
- [ ] `JWT_SECRET` / `ENCRYPTION_KEY` / `AI_API_KEY` 使用 Secrets Manager
- [ ] 数据库备份、迁移、监控与告警就绪
- [ ] 前端 `pnpm build` + `pnpm start` 验证
- [ ] 关闭 `NEXT_PUBLIC_SHOW_DEV_NAV`
- [ ] 浏览器控制台无 hydration/CORS 错误

---

## 8. 相关文档

- [README](../README.md)
- [技术架构](architecture.md)
- [产品与功能](https://github.com/QingTong1-ops/PersistLog/blob/backend-main/docs/01-产品与功能.md)
- [技术设计](https://github.com/QingTong1-ops/PersistLog/blob/backend-main/docs/02-技术设计.md)
- [前端对接说明](https://github.com/QingTong1-ops/PersistLog/blob/backend-main/docs/05-前端对接说明.md)
