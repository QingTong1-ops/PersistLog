<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 项目协作规则

- 本仓库的页面实现必须先对照 `design/p2p3/` 原型、`design/p2p3/README.md`、`docs/frontend-design-guidelines.md` 和对应工程计划，再修改 React。
- P2/P3 页面按计划分阶段交付：先完成 `dev:mock` 的页面交互和状态验收，再接后端 Live 接口；不得把原型固定数据伪装成真实数据，也不得在 Live 请求失败时回退 Mock。
- 数据源只由 `dev:mock` / `dev:live`、`build:mock` / `build:live` 等命令控制，不新增页面 URL 数据源参数。
- 修改工程前先读取当前 Next.js 版本在 `node_modules/next/dist/docs/` 下的相关指南，特别是路由、类型生成、`distDir` 和自定义 TypeScript 配置。
- 保护用户已有工作区修改、删除记录和 `record/` 截图；不要用 `git add .`，只暂存本次任务涉及的文件。
- 提交信息使用单行中文格式：`类型：简短说明`。例如：`feat：新增代码练习页面`、`fix：修复评审状态显示`、`docs：更新P2工程计划`。不要使用英文 Conventional Commit 格式。
- 每个阶段结束后运行 lint、typecheck、build 和相关 Mock/Live 测试；报告任务编号、验证范围、提交号和未完成的 Live 联调项。
