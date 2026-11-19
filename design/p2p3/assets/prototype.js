const iconPaths = {
  arrow: ["<path d='M5 12h14'/>", "<path d='m12 5 7 7-7 7'/>"],
  "arrow-up-right": ["<path d='M7 7h10v10'/>", "<path d='M7 17 17 7'/>"],
  book: ["<path d='M12 7v14'/>", "<path d='M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'/>"],
  calendar: ["<rect x='3' y='5' width='18' height='16' rx='2'/>", "<path d='M16 3v4M8 3v4M3 11h18'/>"],
  chart: ["<path d='M3 3v18h18'/>", "<path d='m7 15 4-4 3 3 5-7'/>"],
  check: ["<path d='m5 12 4 4L19 6'/>"],
  chevron: ["<path d='m6 9 6 6 6-6'/>"],
  clock: ["<circle cx='12' cy='12' r='9'/>", "<path d='M12 7v5l3 2'/>"],
  code: ["<path d='m8 6-6 6 6 6M16 6l6 6-6 6'/>"],
  external: ["<path d='M15 3h6v6M10 14 21 3'/>", "<path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/>"],
  file: ["<path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z'/>", "<path d='M14 2v6h6M8 13h8M8 17h5'/>"],
  grid: ["<rect x='3' y='3' width='7' height='7' rx='1'/>", "<rect x='14' y='3' width='7' height='7' rx='1'/>", "<rect x='3' y='14' width='7' height='7' rx='1'/>", "<rect x='14' y='14' width='7' height='7' rx='1'/>"],
  info: ["<circle cx='12' cy='12' r='9'/>", "<path d='M12 11v5M12 8h.01'/>"],
  layers: ["<path d='m12 2 10 5-10 5L2 7z'/>", "<path d='m2 12 10 5 10-5M2 17l10 5 10-5'/>"],
  message: ["<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>"],
  play: ["<path d='m7 4 13 8-13 8z'/>"],
  route: ["<circle cx='6' cy='19' r='3'/>", "<circle cx='18' cy='5' r='3'/>", "<path d='M9 19h6.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H15'/>"],
  settings: ["<path d='M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'/>"],
  target: ["<circle cx='12' cy='12' r='9'/>", "<circle cx='12' cy='12' r='5'/>", "<circle cx='12' cy='12' r='1'/>"],
  upload: ["<path d='M12 3v12M7 8l5-5 5 5'/>", "<path d='M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4'/>"],
  user: ["<circle cx='12' cy='8' r='4'/>", "<path d='M4 21a8 8 0 0 1 16 0'/>"],
  x: ["<path d='M18 6 6 18M6 6l12 12'/>"],
};

function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function sprite() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true"><defs>${Object.entries(iconPaths).map(([name, paths]) => `<symbol id="icon-${name}" viewBox="0 0 24 24">${paths.join("")}</symbol>`).join("")}</defs></svg>`;
}

const prototypePages = [
  { key: "index", phase: "P2 / P3", title: "原型目录", href: "index.html", icon: "grid" },
  { key: "practice", phase: "P2 · 代码反馈", title: "代码练习", href: "practice.html", icon: "code" },
  { key: "practice-detail", phase: "P2 · 代码反馈", title: "提交代码", href: "practice-detail.html", icon: "file" },
  { key: "practice-review", phase: "P2 · 代码反馈", title: "评审详情", href: "practice-review.html?submission=04", icon: "code" },
  { key: "code-dashboard", phase: "P2 · 代码反馈", title: "评分趋势", href: "code-dashboard.html", icon: "chart" },
  { key: "route-generate", phase: "P3 · 反馈与记忆", title: "诊断与路线", href: "route-generate.html", icon: "route" },
  { key: "quiz", phase: "P3 · 反馈与记忆", title: "每日提问", href: "quiz.html", icon: "message" },
  { key: "mistakes", phase: "P3 · 反馈与记忆", title: "错题与复习", href: "mistakes.html", icon: "book" },
  { key: "capability", phase: "P3 · 反馈与记忆", title: "能力看板", href: "capability.html", icon: "target" },
  { key: "review-settings", phase: "P3 · 反馈与记忆", title: "复习设置", href: "review-settings.html", icon: "settings" },
];

let toastTimer;

function showToast(message) {
  const toast = document.getElementById("prototype-toast");
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3800);
}

function navigationLink(page, current) {
  return `<a class="nav-link ${page.key === current ? "is-active" : ""}" href="${page.href}" ${page.key === current ? 'aria-current="page"' : ""}>${icon(page.icon)}<span>${page.title}</span>${page.key === current ? '<span class="nav-tag">当前</span>' : ""}</a>`;
}

function renderShell() {
  const current = document.body.dataset.page || "index";
  const page = prototypePages.find((item) => item.key === current) || prototypePages[0];
  const template = document.getElementById("page-content");
  const root = document.getElementById("prototype-root");
  if (!template || !root) return;
  const p1 = (label, iconName) => `<button class="nav-link" type="button" data-p1="${label}">${icon(iconName)}<span>${label}</span></button>`;
  const p2 = prototypePages.filter((item) => ["practice", "practice-detail", "practice-review", "code-dashboard"].includes(item.key));
  const p3 = prototypePages.filter((item) => ["route-generate", "quiz", "mistakes", "capability", "review-settings"].includes(item.key));
  root.innerHTML = `${sprite()}<div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="index.html" aria-label="恒序 P2 P3 原型目录"><span class="brand-mark">${icon("arrow-up-right")}</span><span class="brand-copy"><span class="brand-name">恒序</span><span class="brand-sub">persistLog</span></span></a>
      <nav class="side-nav" aria-label="原型主导航">
        <div class="nav-group"><p class="nav-label">P1 · 已有页面</p>${p1("今日", "grid")}${p1("执行看板", "chart")}${p1("学习路线", "route")}${p1("导入计划", "upload")}</div>
        <div class="nav-group"><p class="nav-label">P2 · 代码反馈</p>${p2.map((item) => navigationLink(item, current)).join("")}</div>
        <div class="nav-group"><p class="nav-label">P3 · 反馈与记忆</p>${p3.map((item) => navigationLink(item, current)).join("")}</div>
      </nav>
      <div class="sidebar-goal"><p>当前目标 · 示例</p><strong>Java 后端实习</strong></div>
      <div class="sidebar-profile"><span class="avatar">演</span><div class="profile-copy"><b>演示用户</b><span>非真实账户数据</span></div></div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <div class="topbar-left"><a class="mobile-brand" href="index.html"><span class="brand-mark">${icon("arrow-up-right")}</span>恒序</a><div class="breadcrumb">${page.phase} / <strong>${page.title}</strong></div></div>
        <div class="topbar-actions"><span class="demo-badge">产品示意<span class="demo-badge__full"> · 非真实数据</span></span><a class="icon-button" href="index.html" aria-label="返回原型目录" title="原型目录">${icon("grid")}</a><details class="mobile-directory"><summary>页面 ${icon("chevron")}</summary><nav class="mobile-directory__menu" aria-label="P2 P3 页面">${prototypePages.map((item) => `<a href="${item.href}">${item.phase.split(" · ")[0]} · ${item.title}</a>`).join("")}</nav></details><span class="avatar topbar-avatar">演</span></div>
      </header>
      <main class="main" id="main-content"><div class="view" id="page-view"></div></main>
    </div>
    <nav class="mobile-nav" aria-label="已有功能导航"><button type="button" data-p1="今日">${icon("grid")}今日</button><button type="button" data-p1="执行看板">${icon("chart")}看板</button><button type="button" data-p1="学习路线">${icon("route")}路线</button><button type="button" data-p1="我的">${icon("user")}我的</button></nav>
    <div class="toast" id="prototype-toast" role="status" aria-live="polite" hidden></div>
  </div>`;
  document.getElementById("page-view").append(template.content.cloneNode(true));
  document.querySelectorAll("[data-p1]").forEach((control) => control.addEventListener("click", () => showToast(`${control.dataset.p1}属于 P1，本次原型仅展示 P2 / P3 页面。`)));
  document.querySelectorAll("[data-toast]").forEach((control) => control.addEventListener("click", () => showToast(control.dataset.toast)));
  document.querySelectorAll("[data-close-dialog]").forEach((control) => control.addEventListener("click", () => control.closest("dialog")?.close()));
}

function listen(id, eventName, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(eventName, handler);
  return element;
}

function initCodeDashboard() {
  const chart = document.getElementById("code-trend-chart");
  if (!chart) return;
  const datasets = {
    "7": { labels: ["11/09", "11/11", "11/13", "11/15"], average: [74, 78, 81, 76], selftest: [67, 80, 80, 75], count: "3", mean: "79", high: "84", improvement: "2 / 3" },
    "30": { labels: ["10/17", "10/24", "10/31", "11/07", "11/14"], average: [68, 71, 74, 73, 76], selftest: [50, 67, 67, 75, 75], count: "12", mean: "76", high: "88", improvement: "5 / 8" },
  };
  function render(range) {
    const data = datasets[range];
    const left = 40;
    const width = 660;
    const top = 14;
    const height = 170;
    const x = (index) => left + (width * index) / (data.labels.length - 1);
    const y = (value) => top + (100 - value) * (height / 100);
    const path = (values) => values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ");
    const dots = (values, secondary) => values.map((value, index) => `<circle class="chart-dot ${secondary ? "chart-dot--secondary" : ""}" cx="${x(index)}" cy="${y(value)}" r="4"/>`).join("");
    const grid = [0, 25, 50, 75, 100].map((value) => `<line class="chart-grid" x1="${left}" y1="${y(value)}" x2="${left + width}" y2="${y(value)}"/><text x="4" y="${y(value) + 4}">${value}</text>`).join("");
    chart.innerHTML = `${grid}<path class="chart-line" d="${path(data.average)}"/><path class="chart-line chart-line--secondary" d="${path(data.selftest)}"/>${dots(data.average, false)}${dots(data.selftest, true)}${data.labels.map((label, index) => `<text x="${x(index)}" y="210" text-anchor="middle">${label}</text>`).join("")}`;
    chart.setAttribute("aria-label", `近${range}天演示趋势：${data.count}次提交，平均${data.mean}分，最高${data.high}分。`);
    document.getElementById("trend-count").textContent = data.count;
    document.getElementById("trend-average").textContent = data.mean;
    document.getElementById("trend-high").textContent = data.high;
    document.getElementById("trend-improved").textContent = data.improvement;
    document.getElementById("trend-range-label").textContent = `近${range}天 · 演示数据`;
    document.querySelectorAll("[data-trend-range]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.trendRange === range)));
  }
  document.querySelectorAll("[data-trend-range]").forEach((button) => button.addEventListener("click", () => render(button.dataset.trendRange)));
  render("30");
}

function initRouteGenerate() {
  const form = document.getElementById("route-input-form");
  if (!form) return;
  const intensity = document.getElementById("route-intensity");
  const accept = document.getElementById("accept-route");
  function setStep(step) {
    document.querySelectorAll("[data-route-step]").forEach((panel) => { panel.hidden = Number(panel.dataset.routeStep) !== step; });
    document.querySelectorAll("[data-step-indicator]").forEach((item) => {
      const value = Number(item.dataset.stepIndicator);
      item.classList.toggle("is-active", value === step);
      item.classList.toggle("is-done", value < step);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function updateIntensity() {
    const count = Number(intensity.value);
    const weeks = Number(document.getElementById("route-period").value);
    const minutes = Number(document.getElementById("daily-time").value);
    const hours = count * 1.5;
    const capacity = Math.round(weeks * 7 * (minutes / 60) * 0.8 * 10) / 10;
    const remaining = Math.round((capacity - hours) * 10) / 10;
    document.getElementById("route-capacity-label").textContent = `${weeks} 周 · 每日 ${minutes} 分钟 · 有效容量约 ${capacity} 小时`;
    document.getElementById("route-task-count").textContent = `${count} 项任务`;
    document.getElementById("route-hours").textContent = `${hours} 小时`;
    document.getElementById("route-buffer").textContent = `${remaining} 小时`;
    document.getElementById("confirm-task-count").textContent = `${count} 项任务`;
    document.getElementById("confirm-route-period").textContent = `${weeks} 周`;
    document.getElementById("confirm-daily-time").textContent = `每天 ${minutes} 分钟`;
    let stageStart = 1;
    document.querySelectorAll("[data-stage-summary]").forEach((summary, index) => {
      const stageWeeks = Math.floor(weeks / 3) + (index < weeks % 3 ? 1 : 0);
      summary.textContent = `第 ${stageStart}–${stageStart + stageWeeks - 1} 周 · ${count / 3} 项任务 · ${count / 2} 小时`;
      stageStart += stageWeeks;
    });
    const warning = document.getElementById("route-capacity-warning");
    warning.hidden = remaining >= 0;
    if (remaining < 0) warning.textContent = `预计工作量超出容量 ${Math.abs(remaining)} 小时。请降低强度、延长周期或缩小范围后再确认。`;
    accept.disabled = remaining < 0;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    updateIntensity();
    setStep(2);
  });
  intensity.addEventListener("change", updateIntensity);
  ["daily-time", "route-period"].forEach((id) => listen(id, "change", updateIntensity));
  listen("route-edit", "click", () => setStep(1));
  listen("accept-route", "click", () => setStep(3));
  listen("route-back", "click", () => setStep(2));
  listen("route-lock-stage", "change", (event) => {
    document.getElementById("regenerate-stage").disabled = event.target.checked;
    showToast(event.target.checked ? "第 2 阶段已锁定，局部重生成不会覆盖它。" : "第 2 阶段已解锁，可进行局部调整。");
  });
  listen("regenerate-stage", "click", () => {
    document.getElementById("stage-update").hidden = false;
    showToast("已展示第 2 阶段局部调整示例，其他阶段未改变。");
  });
  listen("confirm-route", "click", () => {
    document.getElementById("route-confirmed").hidden = false;
    document.getElementById("confirm-route").disabled = true;
    document.getElementById("confirm-route").textContent = "已确认（演示）";
  });
  updateIntensity();
}

const quizQuestions = [
  { type: "基础", source: "今日任务 · HTTP 缓存", title: "强缓存和协商缓存的区别是什么？", hint: "可以从是否发起请求、响应头与失效条件三个方面回答。", feedback: "需要补充 Cache-Control 与 ETag 的协作方式，并说明缓存失效后会发生什么。", followup: "如果服务端文件没有变化，为什么协商缓存仍然需要一次请求？" },
  { type: "原理", source: "历史错题 · JVM", title: "为什么老年代通常使用标记整理算法？", hint: "结合对象存活率、内存碎片和移动对象的成本说明。", feedback: "回答应包含老年代对象特点与碎片问题；仅说“回收更彻底”还不够。", followup: "如果对象存活率很低，标记整理仍然是合适的选择吗？" },
  { type: "项目", source: "简历项目 · 订单服务", title: "你的订单服务如何避免重复创建订单？", hint: "说明唯一约束、幂等键、请求重试与异常恢复。", feedback: "需要区分客户端生成幂等键与数据库唯一约束，二者不能只选其一。", followup: "请求超时后，客户端如何安全地查询第一次请求的结果？" },
  { type: "场景", source: "目标岗位 · 后端开发", title: "缓存与数据库同时更新时，你会先处理哪一个？", hint: "说明失败场景与一致性要求，不需要给出唯一方案。", feedback: "先描述业务的一致性要求，再比较更新顺序与补偿方案。", followup: "如果允许短暂不一致，你会如何设置失效与重试策略？" },
];

function initQuiz() {
  const form = document.getElementById("quiz-form");
  if (!form) return;
  let current = 0;
  const answered = new Set();
  const answer = document.getElementById("quiz-answer");
  const feedback = document.getElementById("quiz-feedback");
  const navButtons = [...document.querySelectorAll("[data-question-index]")];
  function updateProgress() {
    const completed = answered.size;
    document.getElementById("quiz-progress-text").textContent = `${completed} / ${quizQuestions.length} 题已作答`;
    document.getElementById("quiz-progress-bar").style.width = `${(completed / quizQuestions.length) * 100}%`;
    document.getElementById("quiz-progress").setAttribute("aria-valuenow", String(completed));
  }
  function renderQuestion() {
    const question = quizQuestions[current];
    document.getElementById("quiz-type").textContent = question.type;
    document.getElementById("quiz-source").textContent = question.source;
    document.getElementById("quiz-title").textContent = question.title;
    document.getElementById("quiz-hint").textContent = question.hint;
    document.getElementById("quiz-feedback-text").textContent = question.feedback;
    document.getElementById("quiz-followup-text").textContent = question.followup;
    document.getElementById("quiz-position").textContent = `第 ${current + 1} / ${quizQuestions.length} 题`;
    document.getElementById("quiz-next").textContent = current === quizQuestions.length - 1 ? "完成本次提问" : "下一题";
    document.getElementById("quiz-complete").hidden = true;
    document.getElementById("quiz-error").hidden = true;
    form.hidden = false;
    answer.value = "";
    answer.disabled = false;
    feedback.hidden = true;
    document.getElementById("followup-box").hidden = true;
    navButtons.forEach((button, index) => {
      button.classList.toggle("is-active", index === current);
      button.classList.toggle("is-done", answered.has(index));
      button.setAttribute("aria-current", index === current ? "step" : "false");
    });
  }
  navButtons.forEach((button) => button.addEventListener("click", () => {
    current = Number(button.dataset.questionIndex);
    renderQuestion();
  }));
  listen("quiz-answer", "input", () => { document.getElementById("quiz-error").hidden = true; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!answer.value.trim()) {
      document.getElementById("quiz-error").hidden = false;
      answer.focus();
      return;
    }
    answered.add(current);
    feedback.hidden = false;
    answer.disabled = true;
    updateProgress();
    navButtons[current].classList.add("is-done");
  });
  listen("quiz-followup", "click", () => {
    document.getElementById("followup-box").hidden = false;
    document.getElementById("followup-answer").focus();
  });
  listen("quiz-next", "click", () => {
    if (current === quizQuestions.length - 1) {
      form.hidden = true;
      feedback.hidden = true;
      document.getElementById("quiz-complete").hidden = false;
      return;
    }
    current += 1;
    renderQuestion();
  });
  listen("quiz-reset", "click", () => {
    answered.clear();
    current = 0;
    updateProgress();
    renderQuestion();
  });
  let remaining = 600;
  let timer = null;
  const timerButton = document.getElementById("quiz-timer");
  function renderTimer() {
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    timerButton.textContent = timer ? `暂停 ${minutes}:${seconds}` : remaining === 600 ? "限时 10 分钟" : `继续 ${minutes}:${seconds}`;
  }
  timerButton.addEventListener("click", () => {
    if (remaining === 0) {
      remaining = 600;
      document.getElementById("quiz-time-notice").hidden = true;
    }
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    } else {
      timer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(timer);
          timer = null;
          document.getElementById("quiz-time-notice").hidden = false;
        }
        renderTimer();
      }, 1000);
    }
    renderTimer();
  });
  renderQuestion();
  renderTimer();
}

const reviewQuestions = [
  { title: "强缓存与协商缓存分别如何判断是否命中？", type: "概念不清", source: "每日提问 · 11月12日", original: "只要设置 ETag，浏览器就不会再发送请求。", reference: "强缓存先通过 Cache-Control / Expires 判断是否直接使用本地副本；过期后可携带 ETag / Last-Modified 进行协商验证。", stage: "第 3 天" },
  { title: "线程池的队列满且达到最大线程数后会发生什么？", type: "边界遗漏", source: "代码评审 · 11月11日", original: "会继续创建新线程处理请求。", reference: "达到最大线程数后进入拒绝策略。需要说明选择的拒绝策略、调用方影响与补偿方式。", stage: "第 2 天" },
  { title: "如何向面试官解释订单接口的幂等设计？", type: "表达结构缺失", source: "项目提问 · 11月10日", original: "加一个幂等键，重复请求就不处理了。", reference: "按请求标识、服务端原子校验、数据库唯一约束、重复请求返回结果与异常补偿来组织回答。", stage: "第 7 天" },
];

function initMistakes() {
  const list = document.getElementById("mistake-library");
  if (!list) return;
  const session = document.getElementById("review-session");
  const reveal = document.getElementById("reveal-review");
  const completed = new Set();
  let current = 0;
  function updateDue() {
    const due = reviewQuestions.length - completed.size;
    document.getElementById("due-count").textContent = due;
    document.getElementById("start-review").innerHTML = `${icon("play")}${due ? `开始复习（${due} 题）` : "今日复习已完成"}`;
    document.getElementById("start-review").disabled = due === 0;
    document.getElementById("library-empty").hidden = due !== 0;
  }
  function renderReview() {
    const question = reviewQuestions[current];
    document.getElementById("review-position").textContent = `第 ${current + 1} / ${reviewQuestions.length} 题`;
    document.getElementById("review-title").textContent = question.title;
    document.getElementById("review-source").textContent = question.source;
    document.getElementById("review-original").textContent = question.original;
    document.getElementById("review-reference").textContent = question.reference;
    document.getElementById("review-stage").textContent = `当前阶段：${question.stage}`;
    document.getElementById("review-answer").hidden = true;
    document.getElementById("review-schedule-result").hidden = true;
    document.getElementById("review-complete").hidden = true;
    document.getElementById("review-card").hidden = false;
    reveal.disabled = false;
    document.querySelectorAll("[data-review-rating]").forEach((button) => { button.disabled = true; });
  }
  listen("start-review", "click", () => {
    current = reviewQuestions.findIndex((_, index) => !completed.has(index));
    if (current < 0) return;
    list.hidden = true;
    session.hidden = false;
    renderReview();
  });
  reveal.addEventListener("click", () => {
    document.getElementById("review-answer").hidden = false;
    reveal.disabled = true;
    document.querySelectorAll("[data-review-rating]").forEach((button) => { button.disabled = false; });
  });
  document.querySelectorAll("[data-review-rating]").forEach((button) => button.addEventListener("click", () => {
    const rating = button.dataset.reviewRating;
    const messages = { wrong: "答错：回退一阶段，11月16日再次复习。", unsure: "答对但不确定：保持当前阶段，下次仍复习本题。", correct: "答对且确定：进入下一阶段。" };
    completed.add(current);
    const row = document.querySelector(`[data-mistake-index="${current}"]`);
    if (row) {
      row.dataset.reviewed = "true";
      row.hidden = true;
    }
    document.getElementById("review-schedule-result").textContent = messages[rating];
    document.getElementById("review-schedule-result").hidden = false;
    document.querySelectorAll("[data-review-rating]").forEach((item) => { item.disabled = true; });
    updateDue();
    window.setTimeout(() => {
      const next = reviewQuestions.findIndex((_, index) => !completed.has(index));
      if (next < 0) {
        document.getElementById("review-card").hidden = true;
        document.getElementById("review-complete").hidden = false;
      } else {
        current = next;
        renderReview();
      }
    }, 650);
  }));
  listen("back-mistakes", "click", () => {
    session.hidden = true;
    list.hidden = false;
    updateDue();
  });
  listen("review-finished", "click", () => {
    session.hidden = true;
    list.hidden = false;
    updateDue();
  });
  const filters = [...document.querySelectorAll("[data-mistake-filter]")];
  function filterRows() {
    let visible = 0;
    document.querySelectorAll("[data-mistake-index]").forEach((row) => {
      const matches = filters.every((filter) => filter.value === "all" || row.dataset[filter.dataset.mistakeFilter] === filter.value);
      const show = matches && row.dataset.reviewed !== "true";
      row.hidden = !show;
      if (show) visible += 1;
    });
    document.getElementById("filter-empty").hidden = visible !== 0;
  }
  filters.forEach((filter) => filter.addEventListener("change", filterRows));
  updateDue();
}

const capabilityEvidence = {
  algorithm: { name: "算法", count: 5, records: [["代码评审", "11月14日", "LRU 缓存的边界处理与复杂度说明", "1.0"], ["代码评审", "11月10日", "二叉树层序遍历与队列操作", "1.0"], ["每日提问", "11月08日", "时间复杂度分析", "0.8"]] },
  structure: { name: "数据结构", count: 4, records: [["代码评审", "11月12日", "哈希表与链表的组合使用", "1.0"], ["每日提问", "11月09日", "堆与优先队列的适用场景", "0.8"], ["工程任务", "11月06日", "缓存淘汰结构设计", "1.0"]] },
  os: { name: "操作系统", count: 3, records: [["工程任务", "11月11日", "线程池参数与拒绝策略", "1.0"], ["每日提问", "11月05日", "JVM 内存区域", "0.8"], ["每日提问", "11月02日", "进程与线程的区别", "0.8"]] },
  database: { name: "数据库", count: 3, records: [["工程任务", "11月13日", "订单幂等键的唯一约束", "1.0"], ["每日提问", "11月10日", "事务隔离级别", "0.8"], ["代码评审", "11月03日", "分页查询的边界处理", "1.0"]] },
  engineering: { name: "工程化", count: 4, records: [["代码评审", "11月14日", "线程池关闭策略与测试", "1.0"], ["工程任务", "11月12日", "接口异常处理与重试", "1.0"], ["工程任务", "11月07日", "缓存失效与补偿方案", "1.0"]] },
};

function initCapability() {
  const dialog = document.getElementById("evidence-dialog");
  if (!dialog) return;
  document.querySelectorAll("[data-capability-filter]").forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.capabilityFilter;
    document.querySelectorAll("[data-capability-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    document.querySelectorAll("[data-assessed]").forEach((row) => {
      row.hidden = filter !== "all" && String(filter === "assessed") !== row.dataset.assessed;
    });
  }));
  document.querySelectorAll("[data-evidence]").forEach((button) => button.addEventListener("click", () => {
    const data = capabilityEvidence[button.dataset.evidence];
    document.getElementById("evidence-title").textContent = `${data.name} · 证据记录`;
    document.getElementById("evidence-subtitle").textContent = `${data.count} 条证据 · 展示最近 3 条示例`;
    document.getElementById("evidence-list").innerHTML = data.records.map(([source, date, title, weight]) => `<li class="list-row"><div class="list-row__main"><span class="tag tag--neutral">${source}</span><p class="list-row__title" style="margin-top:8px">${title}</p><p class="list-row__meta">${date} · 产品示意</p></div><div class="list-row__side"><strong>${weight}</strong><small>来源权重</small></div></li>`).join("");
    dialog.showModal();
  }));
}

function initReviewSettings() {
  const form = document.getElementById("review-settings-form");
  if (!form) return;
  const fields = [...document.querySelectorAll("[data-interval]")];
  function updatePreview() {
    fields.forEach((field, index) => { document.getElementById(`preview-day-${index}`).textContent = `第 ${field.value || "—"} 天`; });
    document.getElementById("review-quota-preview").textContent = `每日最多 ${document.getElementById("review-limit").value || "—"} 题，预计用时不超过今日容量的 ${document.getElementById("review-capacity").value || "—"}%。`;
  }
  form.addEventListener("input", updatePreview);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const days = fields.map((field) => Number(field.value));
    const invalid = days.some((day, index) => day < 1 || (index > 0 && day <= days[index - 1]));
    document.getElementById("review-settings-error").hidden = !invalid;
    if (invalid) return;
    updatePreview();
    showToast("复习设置已在本页更新；原型未保存到账户。");
  });
  listen("review-settings-reset", "click", () => {
    form.reset();
    document.getElementById("review-settings-error").hidden = true;
    updatePreview();
    showToast("已恢复默认复习节奏。");
  });
  updatePreview();
}

renderShell();
initCodeDashboard();
initRouteGenerate();
initQuiz();
initMistakes();
initCapability();
initReviewSettings();
