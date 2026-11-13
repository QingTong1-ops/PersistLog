# 执行看板 / 今日 · 高保真原型 v2

这一版基于原型的业务结构和演示数据，重做执行看板与今日页的视觉与操作路径。自 2026-11-13 起，本目录作为项目新的正式视觉基线；`app/` 下工程页面按此基线逐步迁移，未迁移页面暂保留旧版兼容实现。

## 预览

在 `persistLogFrontend/design` 目录启动静态服务：

```bash
python -m http.server 8080
```

- 原型总览：<http://127.0.0.1:8080/optimized/index.html>
- 今日：<http://127.0.0.1:8080/optimized/today.html>
- 执行看板：<http://127.0.0.1:8080/optimized/dashboard.html>
- 学习路线：<http://127.0.0.1:8080/optimized/routes.html>
- 路线详情：<http://127.0.0.1:8080/optimized/route-detail.html>
- 导入计划：<http://127.0.0.1:8080/optimized/import.html>
- 设置：<http://127.0.0.1:8080/optimized/settings.html>
- 登录：<http://127.0.0.1:8080/optimized/login.html>
- 首次引导：<http://127.0.0.1:8080/optimized/onboarding.html>
- 深色执行看板：<http://127.0.0.1:8080/optimized/dashboard-dark.html>
- 深色今日：<http://127.0.0.1:8080/optimized/today-dark.html>
- 加载状态：`dashboard.html?state=loading`
- 错误状态：`dashboard.html?state=error`

深色版复用 `deepmind-dark-mode` skill 的 token 与组件配方：炭黑 `#121317`、surface 递进、`#F8F9FC` / `#B2BBC5` 文字、低透明度描边、胶囊按钮、24px 卡片圆角；业务布局和交互与浅色版一致。

## 视觉基线

- 浅灰画布 `#f4f5f7`，白色卡片，细边框与轻阴影。
- 低饱和靛蓝 `#4f5d96` 为主色；青绿用于完成；橙色用于提醒；红色只用于延期、阻塞和风险。
- 卡片 12px 圆角，控件 7–8px 圆角，桌面 12 列网格、24px 间距。
- 桌面侧栏 216px，可收为 64px 图标栏；≤1024px 自动收起；顶部栏 56px。
- 中文优先使用 Noto Sans SC / Microsoft YaHei UI；辅助文字 12px 起，正文与控件满足 AA 对比度。

## 页面内容

### 执行看板

- 四个低饱和指标卡：完成率、时间投入、顺延率、累计活跃；时间卡直接写清“计划 / 实际 / 耗时率 / 节省”。
- 趋势图支持悬停数值、图例开关、7/30 天区间；点击日期联动任务明细。
- 任务分布提供完成 / 进行中 / 顺延 / 阻塞的定义，环形图和状态行均可筛选任务。
- 路线进度使用中性轨道，展示完成比例、预计日期、当前状态和操作入口。
- 预测与风险突出日期、延期天数和原因，提供“查看高风险任务”“调整计划”。
- 任务明细支持日期、状态、风险筛选，行内“更多”打开任务抽屉，可完成或顺延。

### 今日

- 只保留一个“下一步任务”焦点，带完成比例、预计耗时、剩余缓冲、开始下一项和调整计划。
- 任务列表支持勾选完成、撤销、全部 / 待完成 / 已完成筛选；来源、阶段和验收信息可查看。
- 右侧只展示今日概览与执行提示；提示可跳到对应任务或路线。
- 完成、撤销、开始计时、筛选为空、加载和错误均有对应反馈。

## 状态与交互

- `:hover`、`:active`、`:focus-visible`、`aria-pressed`、`aria-busy`。
- 加载：骨架屏（`?state=loading`）；错误：顶部提示（`?state=error`）。
- 任务筛选无结果：空状态，可直接清除筛选。
- 完成反馈：toast + 行内状态更新 + 可撤销。
- 图表：tooltip、图例开关、日期联动、30 天重绘。
- 抽屉、弹窗支持遮罩点击和 Esc 关闭。

## 交付截图

- `previews/dashboard-desktop.png`
- `previews/dashboard-narrow.png`
- `previews/today-desktop.png`
- `previews/today-narrow.png`
- `previews/dashboard-dark-desktop.png`
- `previews/dashboard-dark-narrow.png`
- `previews/today-dark-desktop.png`
- `previews/today-dark-narrow.png`

桌面截图按 1440px 宽度输出；窄屏按 390px 输出，侧栏为图标栏。

## 页面覆盖

| 原型 | 目标 | 状态 |
| --- | --- | --- |
| `today.html` | Focus-first 今日执行 | ✅ |
| `dashboard.html` | Evidence-first 执行复盘 | ✅ |
| `routes.html` | 路线列表与目标概览 | ✅ |
| `route-detail.html` | 阶段、周、任务与路线设置 | ✅ |
| `import.html` | 上传、解析、预览、确认 | ✅ |
| `settings.html` | 档案、通知、AI、数据 | ✅ |
| `login.html` | 登录 / 注册入口 | ✅ |
| `onboarding.html` | 首次目标与容量引导 | ✅ |

所有新增页面共用 `assets/prototype-suite.css` 和 `assets/prototype-suite.js`，以保证原型阶段的 token、间距、圆角、状态颜色和交互反馈保持一致。`dashboard.html` / `today.html` 及其深色版本保留原有高保真参考，并通过 `index.html` 统一进入。