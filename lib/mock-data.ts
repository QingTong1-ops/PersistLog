import type {
  DashboardDataset,
  DemoUser,
  PreviewTask,
  RouteRecord,
  RouteStatus,
  Task,
} from "@/lib/types";

export const DEMO_TODAY = "2026-10-19";
export const DEMO_TODAY_LABEL = "2026 年 10 月 19 日 周一";
export const EFFECTIVE_CAPACITY = 240;
export const ROUTE_TOTAL_TASKS = 42;
export const ROUTE_BASE_DONE = 26;
export const ROUTE_BASE_TODAY_DONE = 2;

export const DEMO_USER: DemoUser = {
  name: "林同学",
  initial: "林",
  email: "lin@example.com",
  goal: "Java 后端实习",
  targetDate: "2026-11-10",
  timezone: "Asia/Shanghai",
  dailyMinutes: 300,
  capacityFactor: 0.8,
};

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "完成 2 道二叉树中等题",
    type: "算法",
    stage: "阶段二 · 第 3 周",
    source: "路线",
    planned: 60,
    actual: 55,
    status: "completed",
    carry: 0,
    why: "第 3 周算法目标；先做中等题，难度与当前阶段匹配。",
    output: "2 道题的代码与复杂度注释",
    acceptance: "能独立写出迭代和递归两种遍历，并说明时间复杂度。",
    note: "完成 2 道，第 2 道用时略长。",
  },
  {
    id: "t2",
    title: "复习 Redis 缓存一致性",
    type: "八股",
    stage: "阶段一 · 第 2 周",
    source: "路线",
    planned: 35,
    actual: 30,
    status: "completed",
    carry: 0,
    why: "上周的薄弱项；今天用 35 分钟做一次主动回忆。",
    output: "一页缓存一致性笔记",
    acceptance: "能讲清 Cache Aside 的读写顺序和失效场景。",
    note: "",
  },
  {
    id: "t3",
    title: "完成订单系统缓存方案",
    type: "工程",
    stage: "阶段三 · 第 5 周",
    source: "顺延",
    planned: 70,
    actual: 0,
    status: "pending",
    carry: 1,
    why: "昨天未完成，按顺延优先级进入今天；连续顺延 1 次。",
    output: "缓存分层图 + 失效策略",
    acceptance: "能讲清穿透/击穿/雪崩的处理和取舍。",
    note: "",
  },
  {
    id: "t4",
    title: "回答 3 道 JVM 高频问题",
    type: "八股",
    stage: "阶段一 · 第 2 周",
    source: "路线",
    planned: 35,
    actual: 0,
    status: "pending",
    carry: 0,
    why: "本周八股目标；这 3 题在最近两次模拟面试里出现过。",
    output: "3 段口述提纲",
    acceptance: "不看资料讲清内存区域、GC 和类加载。",
    note: "",
  },
  {
    id: "t5",
    title: "完成今日复盘并填写实际分钟",
    type: "复盘",
    stage: "今日计划 · 自动生成",
    source: "系统",
    planned: 20,
    actual: 0,
    status: "pending",
    carry: 0,
    why: "每天留 20 分钟记录证据，供晚报和预测使用。",
    output: "今日复盘 3 行",
    acceptance: "写下完成项、阻塞项和明天第一件事。",
    note: "",
  },
];

export const INITIAL_ROUTE_STATES: Record<number, RouteStatus> = {
  1: "active",
  2: "draft",
  3: "paused",
};

export const INITIAL_ROUTES: RouteRecord[] = [
  {
    id: 1,
    name: "Java 后端实习准备 · 36 天",
    job: "Java 后端实习",
    status: "active",
    days: 36,
    taskCount: 42,
    doneCount: 26,
    plannedMinutes: 3840,
    forecast: "11/12",
    targetDate: "2026-11-10",
    progress: 62,
    currentStage: "阶段 2 / 4",
    day: 18,
    startDate: "2026-10-02",
  },
  {
    id: 2,
    name: "秋招算法基础补齐 · 21 天",
    job: "秋招算法",
    status: "draft",
    days: 21,
    taskCount: 18,
    doneCount: 3,
    plannedMinutes: 1260,
    forecast: "待确认",
    targetDate: "待确认",
    progress: 18,
    currentStage: "待确认",
    day: 0,
    startDate: "2026-10-20",
  },
  {
    id: 3,
    name: "Redis 与 MySQL 专项",
    job: "Redis / MySQL 专项",
    status: "paused",
    days: 14,
    taskCount: 12,
    doneCount: 5,
    plannedMinutes: 960,
    forecast: "—",
    targetDate: "—",
    progress: 42,
    currentStage: "已暂停",
    day: 9,
    startDate: "2026-09-28",
  },
];

function buildMonthlyDays() {
  const days = [];
  const start = new Date(2026, 8, 20); // 9/20
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const active = i >= 12;
    const plan = active ? 5 : 0;
    let done = 0;
    let carry = 0;
    if (active) {
      const offset = i - 12;
      done = offset % 3 === 0 ? 3 : 4;
      if (offset === 14) done = 5;
      carry = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1][offset] ?? 0;
    }
    days.push({ label, plan, done, carry });
  }
  return days;
}

export const DASHBOARD_DATA: Record<7 | 30, DashboardDataset> = {
  7: {
    planned: 38,
    completed: 28,
    carry: 5,
    active: 12,
    periodActive: 5,
    planMinutes: 620,
    actualMinutes: 578,
    status: { completed: 28, carry: 5, skipped: 3, blocked: 2 },
    types: [
      { label: "算法", count: 13 },
      { label: "八股", count: 9 },
      { label: "工程", count: 7 },
      { label: "项目", count: 4 },
      { label: "复盘", count: 3 },
      { label: "简历/面试", count: 2 },
    ],
    days: [
      { label: "一", plan: 5, done: 3, carry: 1 },
      { label: "二", plan: 6, done: 5, carry: 0 },
      { label: "三", plan: 5, done: 4, carry: 2 },
      { label: "四", plan: 6, done: 5, carry: 0 },
      { label: "五", plan: 5, done: 3, carry: 1 },
      { label: "六", plan: 6, done: 5, carry: 1 },
      { label: "日", plan: 5, done: 3, carry: 0 },
    ],
  },
  30: {
    planned: 90,
    completed: 67,
    carry: 11,
    active: 12,
    periodActive: 12,
    planMinutes: 1467,
    actualMinutes: 1367,
    status: { completed: 67, carry: 11, skipped: 7, blocked: 5 },
    types: [
      { label: "算法", count: 31 },
      { label: "八股", count: 22 },
      { label: "工程", count: 16 },
      { label: "项目", count: 10 },
      { label: "复盘", count: 7 },
      { label: "简历/面试", count: 4 },
    ],
    days: buildMonthlyDays(),
  },
};

export const PREVIEW_TASKS: Record<number, PreviewTask> = {
  1: {
    id: 1,
    title: "TCP 三次握手",
    type: "八股",
    minutes: 45,
    output: "状态机笔记",
    acceptance: "不看资料讲清三次握手和四次挥手",
  },
  2: {
    id: 2,
    title: "HTTP 缓存",
    type: "八股",
    minutes: 45,
    output: "思维导图",
    acceptance: "能区分强缓存与协商缓存",
  },
  3: {
    id: 3,
    title: "完成 3 道中等题",
    type: "算法",
    minutes: 90,
    output: "3 份代码与复杂度",
    acceptance: "",
  },
  4: {
    id: 4,
    title: "HTTPS 握手与证书链",
    type: "八股",
    minutes: 40,
    output: "一页笔记",
    acceptance: "能说明证书校验过程",
  },
  5: {
    id: 5,
    title: "JVM 内存区域",
    type: "八股",
    minutes: 50,
    output: "结构图",
    acceptance: "能画出运行时数据区",
  },
  6: {
    id: 6,
    title: "GC 收集器对比",
    type: "八股",
    minutes: 45,
    output: "对比表",
    acceptance: "能说明 CMS 与 G1 的差异",
  },
  7: {
    id: 7,
    title: "二叉树遍历与复杂度",
    type: "算法",
    minutes: 60,
    output: "代码",
    acceptance: "能写出迭代与递归版本",
  },
  8: {
    id: 8,
    title: "区间 DP",
    type: "算法",
    minutes: 60,
    output: "3 道题解",
    acceptance: "能独立推导状态转移",
  },
  9: {
    id: 9,
    title: "背包问题",
    type: "算法",
    minutes: 60,
    output: "题解",
    acceptance: "能区分 01 背包与完全背包",
  },
  10: {
    id: 10,
    title: "订单系统缓存方案",
    type: "工程",
    minutes: 70,
    output: "缓存分层图",
    acceptance: "能讲清失效策略",
  },
  11: {
    id: 11,
    title: "缓存穿透 / 击穿 / 雪崩",
    type: "八股",
    minutes: 45,
    output: "对比笔记",
    acceptance: "能给出三种场景的处理方案",
  },
  12: {
    id: 12,
    title: "项目复盘：订单系统",
    type: "项目",
    minutes: 60,
    output: "STAR 提纲",
    acceptance: "能在 3 分钟内讲清项目",
  },
  13: {
    id: 13,
    title: "简历项目重写",
    type: "简历",
    minutes: 60,
    output: "简历段落",
    acceptance: "每条经历有指标和取舍",
  },
  14: {
    id: 14,
    title: "3 次模拟面试",
    type: "面试",
    minutes: 90,
    output: "面试记录",
    acceptance: "能回答项目追问",
  },
};

export const TEMPLATE_MARKDOWN = `# 30 天后端冲刺

- 开始：2026-10-20
- 结束：2026-11-18
- 每日可用：120 分钟

## 阶段一：基础夯实（10/20 - 11/02）

### 第 1 周：网络基础

- [ ] TCP 三次握手（45 分钟）
  - 类型：八股
  - 产出：口述录音 / 笔记
  - 验收：不看资料讲清状态机
- [ ] HTTP 缓存（45 分钟）
  - 类型：八股
  - 产出：思维导图
  - 验收：能区分强缓存 / 协商缓存

## 阶段二：算法强化（11/03 - 11/18）

### 第 2 周：树与图

- [ ] 完成 3 道二叉树中等题（90 分钟）
  - 类型：算法
  - 产出：代码与复杂度注释
  - 验收：能独立写出迭代和递归版本
`;
