# 启动 / 构建数据源说明

更新：2026-11-19。范围：全项目模式基础设施和 P1 已接入请求；P2/P3 页面暂未开始。

## 1. 单一入口

`pnpm dev:mock`、`pnpm build:mock`、`pnpm start:mock` 选择 Mock；对应 `:live` 选择真实接口。不带后缀的 dev/build/start 默认 Live。npm 等价命令为 `npm run dev:mock` 等。

`scripts/run-mode.mjs` 用 Node 启动 Next CLI（无 shell 拼接），校验 mode、注入编译期 `NEXT_PUBLIC_DATA_SOURCE`、转发 Next 参数和退出码。非法模式拒绝执行。来源不能由 URL、Cookie、sessionStorage 控制。

产物位于 `.next/mock` / `.next/live`，都被现有 `.gitignore` 忽略。build 成功记录 mode 和 BUILD_ID；start 检查对应产物与标记，避免混用。`tsconfig.mock.json` / `tsconfig.live.json` 分开包含路由类型，基础 `tsconfig.json` 不扫描另一种产物；框架类型稳定入口是 `types/framework.d.ts`。

不改用户 `.env.local`；该文件继续保存 Live 后端地址。环境变量中 Public 值会进入浏览器包，不应放密钥。不要直接执行 Next CLI 绕过命令校验，也不要在一个 mode 的 dev/build 同时运行时改写它的产物。

## 2. 数据链路

```text
页面 / P1 Store
  → lib/api/live.ts（保留旧名称，表示领域端点，不表示固定 Live 来源）
  → apiFetch / refreshSession
  → lib/config/data-source.ts
      mock → 动态导入 lib/api/mock/p1.ts → 本标签页演示存储
      live → fetch + 原有 Bearer / Cookie / 401 单飞刷新 → Next rewrite → FastAPI
```

API 错误不触发模式切换；Mock 未实现请求返回 501；Mock 不配置 API rewrite。没有真登录 Cookie 也能进入虚拟账户，Mock 登录不会覆盖真实 Cookie，切回 Live 后仍遵循原真实会话。

为兼容 P1 页面原有分支，Store 的 `live` 字段现在固定表示“使用数据适配器”，两种 mode 都为 true；**新模块不得把它当成运行模式**，应使用 `DATA_SOURCE`/`IS_MOCK` 或统一领域数据访问层。Store 已取消网络错误后切回本地演示状态的路径。

## 3. P1 演示持久化与边界

- 只有一个虚拟身份，不建立真实用户。输入合法格式即可演示登录；账号字段不代表被验证。注册重置本标签页演示数据。
- 存储键 `persistlog:mock:p1:v1`；刷新可恢复，关闭标签页结束。内容只供预览，不应输入私人资料。存储被禁时保存操作返回明确错误。
- 不存登录密码、真实登录 token、Webhook 原文；不读取或发送真实 Cookie。退出只结束 Mock 会话；“重置演示”恢复初始数据并退出。
- Mock 请求串行更新，避免并发写丢数据；操作失败不提交变更；导入重复确认返回已有路线。
- 读取的 Markdown 文件只用于模拟文件选择，返回标注的固定示例，未上传/解析；通知测试与重发只生成演示 Outbox；预测和调度为简化模拟，不冒充真实算法。
- 现有页面未接入的功能不在此次范围内；未知 Mock 端点报错而非伪造成功。真实接口的错误和持久化验收待后端联调。

## 4. P2/P3 后续接入

统一使用本全局模式，不新增页面路由参数或 P2/P3 环境开关。每个领域保留稳定前端数据接口，Mock 数据与模拟状态变化集中在领域适配器；真实 DTO 与前端模型通过 API 层映射。

后端未交付时先做 Mock 页面/状态验收；未知真实端点不得猜测并标为已联调。未来确定 OpenAPI 后增加 Live 实现，页面保持数据访问接口不变。Live 未交付能力展示不可用/错误，不回退演示。P2/P3 模拟进度必须明示演示，真实任务进度/评分/复习日期始终取后端。

## 5. 验证与边界

本轮验证：

- `test:modes`：9 项测试通过，涵盖命令选择/非法值、演示认证恢复/退出、任务与路线/看板同步、并发保存、导入确认/回滚、通知不外发、未知接口拒绝、Live 错误不回退、401 单飞刷新。
- `build:mock`、`build:live`：两套产物均构建通过。
- `typecheck:mock`、`typecheck:live`：分模式类型检查通过。
- `test:modes:smoke`：两种生产包各 11 个路由壳返回 200；根路径指向 `/login`；Mock 标识与构建模式一致；Mock 无 API rewrite，Live 保留 API rewrite。
- `test:modes:dev`：实际通过启动器启动两种 dev 模式，登录页来源正确，命令覆盖相反的继承环境。Windows 测试结束需有权限清理自己创建的进程树；不停止用户已有服务。
- lint 通过；未新增第三方依赖。当前工具环境没有 pnpm 可执行文件，验证使用 package.json 对应的 Node 入口直接运行，而非声称运行了 pnpm 本身。

HTTP 冒烟检查不是浏览器端完整点击验收，也不是后端真实联调。交互测试在独立 Node 环境执行真实 TS 请求适配器；不据此宣称所有 P1 业务、浏览器渲染、调度/权限规则均已验证。

建议手工预览：`dev:mock` → 登录 → 今日完成/新增任务 → 看板 → 路线 → 上传 Markdown 查看固定预览 → 设置档案/通知模拟 → 刷新 → 退出/重置。Live 在后端停机时应显示错误而非演示任务。
