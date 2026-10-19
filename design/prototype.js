/* =========================================================
   恒序 persistLog · Phase 1 原型交互
   纯原生 JS，无依赖。所有数据均为演示数据。
   ========================================================= */

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);

  const EFFECTIVE_CAPACITY = 240;
  const ROUTE_TOTAL_TASKS = 42;
  const ROUTE_BASE_DONE = 26;
  const ROUTE_BASE_TODAY_DONE = 2;

  const CATEGORY_TAG = {
    算法: "tag--brand",
    八股: "tag--amber",
    工程: "tag--sky",
    项目: "tag--teal",
    复盘: "tag--teal",
    简历: "tag--neutral",
    面试: "tag--coral",
  };

  const STATUS_META = {
    pending: { label: "待开始", className: "status--neutral" },
    in_progress: { label: "进行中", className: "status--draft" },
    completed: { label: "已完成", className: "status--active" },
    postponed: { label: "已移明天", className: "status--paused" },
    skipped: { label: "已跳过", className: "status--neutral" },
    blocked: { label: "已阻塞", className: "status--risk" },
    abandoned: { label: "已放弃", className: "status--neutral" },
  };

  const INITIAL_TASKS = [
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

  const state = {
    tasks: clone(INITIAL_TASKS),
    filter: "all",
    period: 7,
    onbStep: 1,
    authMode: "login",
    routeStates: { 1: "active", 2: "draft", 3: "paused", 4: "draft" },
    consentGranted: true,
    importConsent: false,
    importFile: "后端冲刺计划.md",
    importPane: "empty",
    processingTimer: null,
    processingFinishTimer: null,
    pendingConfirm: null,
    lastFocus: null,
  };

  let sheetTaskId = null;

  const sheet = $("#sheet");
  const overlay = $("#overlay");
  const protoPanel = $("#proto-panel");
  const modalRoot = $("#modal-root");
  const toast = $("#toast");

  /* ---------------------------------------------------------
     通用：Toast / 浮层 / 弹窗 / 焦点
     --------------------------------------------------------- */

  let toastTimer = null;

  function showToast(message, tone = "success") {
    toast.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${tone === "risk" ? "i-alert-circle" : "i-check-circle"}"></use></svg><span>${message}</span>`;
    toast.classList.toggle("is-risk", tone === "risk");
    toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-show"), 3600);
  }

  function openSheet(html) {
    state.lastFocus = document.activeElement;
    sheet.inert = false;
    sheet.innerHTML = html;
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    window.setTimeout(() => {
      const focusable = sheet.querySelector("button, a[href], input, select, textarea");
      if (focusable) focusable.focus();
    }, 50);
  }

  function closeSheet(silent = false) {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    sheet.inert = true;
    if (!protoPanel.classList.contains("is-open") && !modalRoot.children.length) {
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
    }
    if (!silent && state.lastFocus && typeof state.lastFocus.focus === "function") {
      state.lastFocus.focus();
      state.lastFocus = null;
    }
  }

  function openProto() {
    protoPanel.inert = false;
    protoPanel.classList.add("is-open");
    protoPanel.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    window.setTimeout(() => $("#close-proto").focus(), 50);
  }

  function closeProto() {
    protoPanel.classList.remove("is-open");
    protoPanel.setAttribute("aria-hidden", "true");
    protoPanel.inert = true;
    if (!sheet.classList.contains("is-open") && !modalRoot.children.length) {
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
    }
  }

  function closeLayers(silent = false) {
    closeSheet(silent);
    closeProto();
    if (!sheet.classList.contains("is-open") && !protoPanel.classList.contains("is-open") && !modalRoot.children.length) {
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
    }
  }

  function openModal(title, subtitle, body, options = {}) {
    closeLayers(true);
    state.lastFocus = document.activeElement;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <section class="modal${options.wide ? " modal--wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal__head">
            <div>
              <h2 id="modal-title">${title}</h2>
              ${subtitle ? `<p>${subtitle}</p>` : ""}
            </div>
            <button class="icon-button" type="button" data-close-modal aria-label="关闭弹窗">
              <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
            </button>
          </div>
          <div class="modal__body">${body}</div>
        </section>
      </div>`;
    document.body.classList.add("no-scroll");
    window.setTimeout(() => {
      const focusable = modalRoot.querySelector("input, select, textarea, button:not([data-close-modal])");
      if (focusable) focusable.focus();
    }, 50);
  }

  function closeModal(silent = false) {
    modalRoot.innerHTML = "";
    if (!sheet.classList.contains("is-open") && !protoPanel.classList.contains("is-open")) {
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
    }
    if (!silent && state.lastFocus && typeof state.lastFocus.focus === "function") {
      state.lastFocus.focus();
      state.lastFocus = null;
    }
  }

  function openConfirm({ title, subtitle, body, confirmText = "确认", tone = "danger", onConfirm }) {
    state.pendingConfirm = onConfirm;
    openModal(
      title,
      subtitle || "",
      `<p>${body}</p>
       <div class="modal__foot">
         <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
         <button class="btn ${tone === "danger" ? "btn--danger" : "btn--primary"} btn--sm" type="button" data-confirm-ok>${confirmText}</button>
       </div>`
    );
  }

  function trapFocus(event) {
    const container = $(".modal");
    if (!container) return;
    const focusable = $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------
     路由
     --------------------------------------------------------- */

  const VIEW_MAP = {
    login: "view-login",
    onboarding: "view-onboarding",
    today: "view-today",
    dashboard: "view-dashboard",
    routes: "view-routes",
    route: "view-route-detail",
    import: "view-import",
    settings: "view-settings",
  };

  const CRUMBS = {
    login: "登录",
    onboarding: "首次引导",
    today: "今日",
    dashboard: "执行看板",
    routes: "学习路线",
    route: "路线详情",
    import: "导入计划",
    settings: "设置",
  };

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [pathPart, queryPart = ""] = raw.split("?");
    const segments = pathPart.split("/").filter(Boolean);
    return {
      segments,
      query: new URLSearchParams(queryPart),
      raw: raw || "today",
    };
  }

  function getRouteInfo() {
    const { segments, query } = parseHash();
    let key = segments[0] || "today";
    let id = null;
    let tab = null;

    if (key === "routes" && segments[1]) {
      key = "route";
      id = segments[1];
    } else if (key === "settings") {
      tab = segments[1] || "profile";
    }

    if (!VIEW_MAP[key]) key = "today";

    return { key, id, tab, query };
  }

  function renderRoute() {
    const route = getRouteInfo();
    const viewId = VIEW_MAP[route.key];

    $$(".view").forEach((view) => {
      view.hidden = view.id !== viewId;
    });

    const authMode = route.key === "login" || route.key === "onboarding";
    document.body.classList.toggle("auth-mode", authMode);

    const navKey = route.key === "route" ? "routes" : route.key;
    $$("[data-nav]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.nav === navKey);
    });

    const crumb = $("#crumb-page");
    if (crumb) crumb.textContent = CRUMBS[route.key] || "今日";

    closeLayers(true);
    stopProcessing();

    if (route.key === "today") {
      applyTodayDemo(route.query);
      renderToday();
    } else if (route.key === "routes") {
      renderRoutes(route.query);
    } else if (route.key === "route") {
      renderRouteDetail();
    } else if (route.key === "import") {
      renderImport(route.query);
    } else if (route.key === "dashboard") {
      renderDashboard(route.query);
    } else if (route.key === "settings") {
      renderSettings(route.tab);
    } else if (route.key === "login") {
      renderLogin();
    } else if (route.key === "onboarding") {
      renderOnboarding();
    }

    document.title =
      route.key === "today"
        ? "今日 · 恒序 persistLog"
        : `${CRUMBS[route.key] || "恒序"} · 恒序 persistLog`;

    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------
     今日
     --------------------------------------------------------- */

  function applyTodayDemo(query) {
    const demo = query.get("state");
    if (demo === "done") {
      state.tasks.forEach((task) => {
        if (task.status !== "abandoned") {
          task.status = "completed";
          task.actual = task.planned;
        }
      });
    } else if (demo === "empty") {
      state.tasks = [];
    }
  }

  function taskCounts() {
    const considered = state.tasks.filter((task) => task.status !== "abandoned");
    const completed = considered.filter((task) => task.status === "completed");
    const pending = considered.filter((task) => ["pending", "in_progress", "blocked"].includes(task.status));
    const carry = considered.filter((task) => task.carry > 0 && ["pending", "in_progress", "blocked"].includes(task.status));
    return { considered, completed, pending, carry };
  }

  function routeDoneCount() {
    const { completed } = taskCounts();
    return ROUTE_BASE_DONE + Math.max(0, completed.length - ROUTE_BASE_TODAY_DONE);
  }

  function syncRouteProgress() {
    const done = routeDoneCount();
    const percent = Math.round((done / ROUTE_TOTAL_TASKS) * 100);
    const setWidth = (selector) => {
      const el = $(selector);
      if (el) el.style.width = `${percent}%`;
    };
    const setText = (selector, text) => {
      const el = $(selector);
      if (el) el.textContent = text;
    };

    setWidth("#sidebar-goal-progress");
    setText("#sidebar-goal-meta", `${percent}% · ${done}/${ROUTE_TOTAL_TASKS}`);
    setText("#today-route-progress", `${percent}% · ${done}/${ROUTE_TOTAL_TASKS}`);
    setWidth("#route-1-progress");
    setText("#route-1-percent", `${percent}%`);
    setText("#route-1-done", String(done));
    setWidth("#dash-route-1-progress");
    setText("#dash-route-1-percent", `${percent}% · ${done}/${ROUTE_TOTAL_TASKS}`);

    const detailDone = $("#route-detail-done");
    if (detailDone) detailDone.innerHTML = `${ROUTE_TOTAL_TASKS} <small>/ ${done} 项</small>`;
    const detailProgress = $("#route-detail-progress");
    if (detailProgress) detailProgress.innerHTML = `${percent} <small>%</small>`;

    const dotClass = {
      completed: "done",
      pending: "pending",
      in_progress: "pending",
      blocked: "blocked",
      postponed: "postponed",
      skipped: "pending",
      abandoned: "pending",
    };
    state.tasks.forEach((task) => {
      const row = document.querySelector(`[data-route-task-id="${task.id}"] .status-dot`);
      if (row) row.className = `status-dot status-dot--${dotClass[task.status] || "pending"}`;
    });
  }

  function renderToday() {
    const { considered, completed, pending, carry } = taskCounts();
    const total = considered.length;
    const done = completed.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const plannedTotal = considered.reduce((sum, task) => sum + Number(task.planned || 0), 0);
    const completedPlanned = considered
      .filter((task) => task.status === "completed")
      .reduce((sum, task) => sum + Number(task.planned || 0), 0);
    const remainingPlanned = Math.max(0, plannedTotal - completedPlanned);
    const buffer = EFFECTIVE_CAPACITY - plannedTotal;
    const nextTask = state.tasks.find((task) => ["pending", "in_progress", "blocked"].includes(task.status));

    const ring = $("#today-ring");
    if (ring) ring.style.strokeDashoffset = String(276.5 * (1 - percent / 100));
    $("#today-percent").textContent = `${percent}%`;
    $("#done-metric").textContent = `${done} / ${total}`;
    $("#carry-metric").textContent = String(carry.length);
    $("#task-count-label").textContent = `${done} / ${total} 已完成`;
    $("#nav-today-count").textContent = String(total);

    const heroTitle = $("#hero-title");
    const heroSub = $("#hero-sub");
    if (!total) {
      heroTitle.textContent = "今天没有安排任务。";
      heroSub.textContent = "可以从路线添加任务，或导入一份新的 Markdown 计划。";
      $("#today-greeting").textContent = "今天没有排入任务；空计划仍然保留，方便记录和推送。";
    } else if (done === total) {
      heroTitle.textContent = "今天的计划已经完成。";
      heroSub.textContent = `${total} 项全部完成，累计活跃天数 +1。可以提前看明天，或把时间留给复盘。`;
      $("#today-greeting").textContent = "今天的计划已经完成。剩下的时间可以自由安排，不需要再补任务。";
    } else if (nextTask) {
      heroTitle.textContent =
        nextTask.status === "blocked"
          ? `「${nextTask.title}」仍在阻塞，先解除阻塞再继续。`
          : `先把「${nextTask.title}」做掉，今天就能回到节奏里。`;
      heroSub.textContent = `有效容量 ${EFFECTIVE_CAPACITY} 分钟 · 已排入 ${plannedTotal} 分钟 · ${
        buffer >= 0 ? `剩余缓冲 ${buffer} 分钟` : `超出容量 ${Math.abs(buffer)} 分钟`
      }`;
      $("#today-greeting").textContent = "计划已经排好。今天只需要确认、执行和记录，不用重新整理待办。";
    }

    renderCapacity(plannedTotal, completedPlanned, remainingPlanned, buffer);
    renderCarry(carry);
    renderTaskList();
    syncRouteProgress();

    const carryInsight = $("#carry-insight");
    if (carryInsight) {
      carryInsight.hidden = carry.length === 0;
      const copy = carryInsight.querySelector("span");
      if (copy && carry.length) {
        copy.textContent = `${carry.length} 项任务从昨天顺延。连续顺延 3 次会提示拆分、降级或放弃，避免一项任务拖住整条路线。`;
      }
    }

    $("#count-all").textContent = String(total);
    $("#count-pending").textContent = String(pending.length);
    $("#count-done").textContent = String(done);

    $$("[data-task-filter]").forEach((tab) => {
      const active = tab.dataset.taskFilter === state.filter;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
  }

  function renderCapacity(plannedTotal, completedPlanned, remainingPlanned, buffer) {
    const scale = Math.max(EFFECTIVE_CAPACITY, plannedTotal);
    const donePct = (completedPlanned / scale) * 100;
    const remainPct = (remainingPlanned / scale) * 100;
    const bufferPct = Math.max(0, buffer / scale) * 100;

    $("#capacity-planned-total").textContent = String(plannedTotal);
    $("#cap-done").style.width = `${donePct}%`;
    $("#cap-planned").style.width = `${remainPct}%`;
    $("#cap-buffer").style.width = `${bufferPct}%`;
    $("#cap-done-label").textContent = `${completedPlanned} 分钟`;
    $("#cap-planned-label").textContent = `${remainingPlanned} 分钟`;
    $("#cap-buffer-label").textContent = `${Math.max(0, buffer)} 分钟`;
    $("#capacity-buffer").textContent = String(Math.max(0, buffer));
    const bufferCopy =
      buffer >= EFFECTIVE_CAPACITY
        ? "分钟可用 · 今天还没有任务"
        : buffer >= 0
          ? "分钟缓冲 · 不建议再加任务"
          : "分钟超容量 · 建议拆分或移出任务";
    $("#capacity-buffer").nextElementSibling.textContent = bufferCopy;
  }

  function renderCarry(carry) {
    const card = $("#carry-card");
    if (!carry.length) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const first = carry[0];
    $("#carry-title").textContent = `${carry.length} 项任务从昨天顺延 · 连续顺延 ${Math.max(...carry.map((task) => task.carry))} 次`;
    $("#carry-meta").textContent = `${first.title} · ${first.planned} 分钟 · 今天优先做`;
  }

  function renderTaskList() {
    const list = $("#today-task-list");
    if (!list) return;

    const { considered, completed } = taskCounts();
    let rows = considered;
    if (state.filter === "pending") {
      rows = considered.filter((task) => ["pending", "in_progress", "blocked"].includes(task.status));
    } else if (state.filter === "done") {
      rows = completed;
    }

    if (!rows.length) {
      const copy =
        state.filter === "done"
          ? ["还没有已完成的任务", "完成一项后，这里会记录实际分钟和路线影响。"]
          : state.filter === "pending"
            ? ["待完成任务已清空", "可以查看已完成任务，或从路线添加一项。"]
            : ["今天没有任务", "从路线添加任务，或导入一份 Markdown 计划。"];
      list.innerHTML = `
        <div class="empty-state" style="padding:34px 22px">
          <span class="empty-state__icon"><svg class="icon" aria-hidden="true"><use href="#i-${state.filter === "done" ? "check-circle" : "today"}"></use></svg></span>
          <h3>${copy[0]}</h3>
          <p>${copy[1]}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px">
            <button class="btn btn--primary btn--sm" type="button" data-open="add-task">添加任务</button>
            <a class="btn btn--secondary btn--sm" href="#/routes/1">从路线添加</a>
          </div>
        </div>`;
      return;
    }

    list.innerHTML = rows.map(renderTaskRow).join("");
  }

  function renderTaskRow(task) {
    const status = STATUS_META[task.status] || STATUS_META.pending;
    const rowClasses = [
      "task-row",
      task.status === "completed" ? "is-done" : "",
      task.status === "blocked" ? "is-blocked" : "",
      task.status === "in_progress" ? "is-in-progress" : "",
      ["postponed", "skipped", "abandoned"].includes(task.status) ? `is-${task.status}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const carryTag = task.carry > 0 && task.status !== "completed" ? `<span class="tag tag--amber">顺延 ${task.carry} 次</span>` : "";
    const statusTag =
      task.status === "blocked"
        ? `<span class="tag tag--coral">阻塞</span>`
        : task.status === "in_progress"
          ? `<span class="tag tag--brand">进行中</span>`
          : task.status === "postponed"
            ? `<span class="tag tag--neutral">已移明天</span>`
            : task.status === "skipped"
              ? `<span class="tag tag--neutral">已跳过</span>`
              : task.status === "abandoned"
                ? `<span class="tag tag--neutral">已放弃</span>`
                : "";

    const sideMain =
      task.status === "completed"
        ? `${task.actual || task.planned} 分钟`
        : `${task.planned} 分钟`;
    const sideSub =
      task.status === "completed"
        ? "实际用时"
        : task.status === "in_progress"
          ? "进行中"
          : task.status === "blocked"
            ? "等待解除"
            : "计划时长";

    return `
      <article class="${rowClasses}" data-task-id="${task.id}" tabindex="0" aria-label="${esc(task.title)}，${status.label}">
        <button class="task-check" type="button" data-task-check="${task.id}" aria-label="${task.status === "completed" ? "已完成" : "完成任务"}：${esc(task.title)}">
          <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
        </button>
        <div class="task-body">
          <div class="task-top">
            <h3 class="task-title">${esc(task.title)}</h3>
            ${carryTag}
            ${statusTag}
          </div>
          <div class="task-meta">
            <span class="tag ${CATEGORY_TAG[task.type] || "tag--neutral"}">${esc(task.type)}</span>
            <span>${esc(task.stage)}</span>
            <span class="dot-sep" aria-hidden="true"></span>
            <span>来源：${esc(task.source)}</span>
            <button class="task-why" type="button" data-task-why="${task.id}">为什么今天做？</button>
          </div>
        </div>
        <div class="task-side">
          <span class="task-side__copy"><strong>${esc(sideMain)}</strong><span>${esc(sideSub)}</span></span>
          <button class="task-more" type="button" aria-label="打开任务详情" data-task-more="${task.id}">
            <svg class="icon" aria-hidden="true"><use href="#i-more"></use></svg>
          </button>
        </div>
      </article>`;
  }

  function findTask(id) {
    return state.tasks.find((task) => task.id === id);
  }

  function openTaskDetail(id) {
    const task = findTask(id);
    if (!task) return;
    sheetTaskId = id;
    const status = STATUS_META[task.status] || STATUS_META.pending;
    const statusLine =
      task.status === "completed"
        ? `已完成 · 计划 ${task.planned} 分钟 · 实际 ${task.actual || task.planned} 分钟`
        : task.status === "blocked"
          ? `已阻塞 · ${task.blockReason || "等待解除阻塞"}`
          : task.status === "postponed"
            ? "已延期到明天 · 新实例会继承顺延次数"
            : task.status === "skipped"
              ? `已跳过 · ${task.skipReason || "可在路线详情重新排期"}`
              : task.status === "abandoned"
                ? "已放弃 · 不计入完成率分母"
                : `${status.label} · 计划 ${task.planned} 分钟`;

    let actions = "";
    if (["pending", "in_progress"].includes(task.status)) {
      if (task.status === "pending") {
        actions += actionButton("start", "开始执行", "i-play", "btn--secondary");
      }
      actions += actionButton("complete", "完成并记录", "i-check", "btn--primary");
      actions += actionButton("postpone", "延期到明天", "i-refresh", "btn--secondary");
      actions += actionButton("skip", "跳过", "i-skip", "btn--secondary");
      actions += actionButton("block", "标记阻塞", "i-block", "btn--secondary");
      actions += actionButton("split", "拆分为两项", "i-split", "btn--secondary");
      actions += actionButton("abandon", "放弃任务", "i-trash", "btn--danger");
    } else if (task.status === "blocked") {
      actions += actionButton("unblock", "解除阻塞", "i-check-circle", "btn--primary");
      actions += actionButton("abandon", "放弃任务", "i-trash", "btn--danger");
    } else if (["postponed", "skipped"].includes(task.status)) {
      actions += actionButton("restore", "恢复到今日", "i-refresh", "btn--secondary");
      actions += actionButton("abandon", "放弃任务", "i-trash", "btn--danger");
    } else if (task.status === "completed") {
      actions += actionButton("complete", "修改实际分钟", "i-edit", "btn--secondary");
    }

    openSheet(`
      <div class="sheet__head">
        <div>
          <span class="eyebrow">任务详情</span>
          <h2>${esc(task.title)}</h2>
          <p>${esc(task.type)} · ${esc(task.stage)} · 来源：${esc(task.source)}</p>
        </div>
        <button class="icon-button" type="button" data-close-layers aria-label="关闭任务详情">
          <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
        </button>
      </div>
      <div class="sheet__body">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:13px">
          <span class="tag ${CATEGORY_TAG[task.type] || "tag--neutral"}">${esc(task.type)}</span>
          <span class="status ${status.className}">${status.label}</span>
          ${task.carry ? `<span class="tag tag--amber">顺延 ${task.carry} 次</span>` : ""}
          <span class="tag tag--outline">${task.planned} 分钟</span>
        </div>

        <div class="sheet__section">
          <h3>状态</h3>
          <p>${statusLine}</p>
        </div>

        <div class="sheet__section">
          <h3>为什么今天做</h3>
          <p>${esc(task.why)}</p>
        </div>

        <div class="sheet__section">
          <h3>产出要求</h3>
          <p>${esc(task.output || "尚未填写产出要求；导入时会产生 warning。")}</p>
        </div>

        <div class="sheet__section">
          <h3>验收标准</h3>
          <p>${esc(task.acceptance || "尚未填写验收标准；建议确认前补全。")}</p>
        </div>

        ${
          task.note
            ? `<div class="sheet__section"><h3>记录</h3><p>${esc(task.note)}</p></div>`
            : ""
        }

        <div class="sheet__section">
          <h3>操作</h3>
          <div class="sheet__actions">${actions || '<p class="muted" style="font-size:10px">该任务已结束，没有可执行操作。</p>'}</div>
        </div>

        <div class="sheet__section">
          <p class="muted" style="font-size:9.5px">状态流转：pending → in_progress → completed；pending/in_progress → postponed / skipped / blocked / abandoned；blocked → pending。所有高风险操作都应在正式版支持撤销或恢复。</p>
        </div>
      </div>`);
  }

  function actionButton(action, label, icon, className) {
    return `<button class="btn ${className} btn--sm" type="button" data-task-action="${action}"><svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg>${label}</button>`;
  }

  function openCompleteModal(id) {
    const task = findTask(id);
    if (!task) return;
    const { completed } = taskCounts();
    const beforeDone = routeDoneCount();
    const alreadyDone = task.status === "completed";
    const afterDone = beforeDone + (alreadyDone ? 0 : 1);
    const beforePct = Math.round((beforeDone / ROUTE_TOTAL_TASKS) * 100);
    const afterPct = Math.round((afterDone / ROUTE_TOTAL_TASKS) * 100);

    closeLayers(true);
    openModal(
      "完成任务",
      `${esc(task.title)} · 计划 ${task.planned} 分钟`,
      `<form class="modal__form" data-modal-form="complete" data-task-id="${task.id}">
        <div class="form-grid">
          <div class="field">
            <label for="complete-actual">实际用时 <small>分钟</small></label>
            <input id="complete-actual" name="actual" type="number" min="0" max="600" value="${task.actual || task.planned}" />
          </div>
          <div class="field">
            <label>计划时长</label>
            <input value="${task.planned} 分钟" disabled />
          </div>
        </div>
        <div class="field">
          <label for="complete-note">备注 <small>可选</small></label>
          <textarea id="complete-note" name="note" placeholder="记录卡点、产出位置或下一步">${esc(task.note || "")}</textarea>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>完成后：路线进度 <b>${beforePct}% → ${afterPct}%</b>；预计完成日期保持 <b>11/12</b>；今日完成度会立即更新。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">确认完成</button>
        </div>
      </form>`
    );
  }

  function openPostponeModal(id) {
    const task = findTask(id);
    if (!task) return;
    closeLayers(true);
    openModal(
      "延期到明天",
      `${esc(task.title)} · 今天不再出现，明天作为顺延任务进入计划`,
      `<form class="modal__form" data-modal-form="postpone" data-task-id="${task.id}">
        <div class="field">
          <label for="postpone-reason">原因 <small>可选，仅自己可见</small></label>
          <select id="postpone-reason" name="reason">
            <option>今天时间不够</option>
            <option>优先级发生变化</option>
            <option>身体状态不适合</option>
            <option>还在等资料 / 反馈</option>
            <option>其他</option>
          </select>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>明天会创建新的 occurrence，<b>顺延次数 +1</b>；预计完成日期由 11/12 变为 <b>11/13</b>。连续顺延 3 次会提示拆分或放弃。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">确认延期</button>
        </div>
      </form>`
    );
  }

  function openSkipModal(id) {
    const task = findTask(id);
    if (!task) return;
    closeLayers(true);
    openModal(
      "跳过任务",
      `${esc(task.title)} · 跳过需要写原因，任务计划日期会被清空`,
      `<form class="modal__form" data-modal-form="skip" data-task-id="${task.id}">
        <div class="field">
          <label for="skip-reason">原因 <small>必填</small></label>
          <select id="skip-reason" name="reason" required>
            <option value="">请选择</option>
            <option>内容已不适合当前目标</option>
            <option>时间安排冲突</option>
            <option>已经掌握，不需要再做</option>
            <option>任务描述有问题</option>
            <option>其他</option>
          </select>
        </div>
        <div class="field">
          <label for="skip-note">补充说明 <small>可选</small></label>
          <textarea id="skip-note" name="note" placeholder="例如：已通过项目实践掌握该知识点"></textarea>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>跳过会计入计划分母但不计完成，因此完成率可能下降。任务不会自动进入明天，可在路线详情重新排期。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--danger btn--sm" type="submit">确认跳过</button>
        </div>
      </form>`
    );
  }

  function openBlockModal(id) {
    const task = findTask(id);
    if (!task) return;
    closeLayers(true);
    openModal(
      "标记阻塞",
      `${esc(task.title)} · 阻塞不会自动解除，也不会被静默丢弃`,
      `<form class="modal__form" data-modal-form="block" data-task-id="${task.id}">
        <div class="field">
          <label for="block-reason">阻塞原因 <small>必填</small></label>
          <textarea id="block-reason" name="reason" required placeholder="例如：等待导师确认缓存分层方案"></textarea>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>阻塞任务仍会进入明天的计划并保持阻塞状态；解除后恢复为待开始。连续阻塞不会自动降级。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--danger btn--sm" type="submit">确认阻塞</button>
        </div>
      </form>`
    );
  }

  function openAbandonModal(id) {
    const task = findTask(id);
    if (!task) return;
    closeLayers(true);
    openConfirm({
      title: "放弃任务",
      subtitle: `${esc(task.title)}`,
      body: "放弃后任务会归档，<strong>不计入完成率分母</strong>，历史执行记录仍然保留。这个操作在正式版应支持撤销。",
      confirmText: "确认放弃",
      tone: "danger",
      onConfirm: () => {
        task.status = "abandoned";
        renderToday();
        showToast(`<strong>已放弃「${esc(task.title)}」</strong> 任务已归档，不计入完成率。`, "risk");
      },
    });
  }

  function openSplitModal(id) {
    const task = findTask(id);
    if (!task) return;
    const half = Math.max(15, Math.round(task.planned / 2));
    closeLayers(true);
    openModal(
      "拆分为两项",
      `${esc(task.title)} · 拆分后原任务归档，新任务进入今日`,
      `<form class="modal__form" data-modal-form="split" data-task-id="${task.id}">
        <div class="field">
          <label for="split-title-1">子任务 1</label>
          <input id="split-title-1" name="title1" value="${esc(task.title)} · 第一部分" required />
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="split-minutes-1">预计分钟</label>
            <input id="split-minutes-1" name="minutes1" type="number" min="15" max="120" value="${half}" />
          </div>
          <div class="field">
            <label>原任务时长</label>
            <input value="${task.planned} 分钟" disabled />
          </div>
        </div>
        <div class="field">
          <label for="split-title-2">子任务 2</label>
          <input id="split-title-2" name="title2" value="${esc(task.title)} · 第二部分" required />
        </div>
        <div class="field">
          <label for="split-minutes-2">预计分钟</label>
          <input id="split-minutes-2" name="minutes2" type="number" min="15" max="120" value="${Math.max(15, task.planned - half)}" />
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>拆分适合超过 70 分钟或连续顺延的任务。两个子任务都会继承原任务的阶段、产出和验收标准。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">确认拆分</button>
        </div>
      </form>`
    );
  }

  function completeTask(id, actual, note) {
    const task = findTask(id);
    if (!task) return;
    const wasCompleted = task.status === "completed";
    const beforeDone = routeDoneCount();
    task.status = "completed";
    task.actual = clamp(Number(actual) || task.planned, 0, 600);
    task.note = note || task.note || "";
    closeModal();
    renderToday();
    const afterDone = routeDoneCount();
    const beforePct = Math.round((beforeDone / ROUTE_TOTAL_TASKS) * 100);
    const afterPct = Math.round((afterDone / ROUTE_TOTAL_TASKS) * 100);
    const allDone = taskCounts().completed.length === taskCounts().considered.length;
    if (allDone) {
      showToast(`<strong>今天的计划已完成。</strong> 路线进度 ${beforePct}% → ${afterPct}%，累计活跃天数 +1。`);
    } else {
      showToast(
        `<strong>已完成「${esc(task.title)}」</strong> 路线进度 ${beforePct}% → ${afterPct}%，预计完成日 11/12。`
      );
    }
  }

  /* ---------------------------------------------------------
     学习路线
     --------------------------------------------------------- */

  function renderRoutes(query) {
    const empty = query.get("state") === "empty";
    $("#route-list").hidden = empty;
    $("#routes-empty").hidden = !empty;
    const metrics = document.querySelector("#view-routes .metric-grid");
    if (metrics) metrics.hidden = empty;
    renderRouteStatuses();
    syncRouteProgress();
  }

  function statusClass(status) {
    return {
      active: "status--active",
      paused: "status--paused",
      draft: "status--draft",
      archived: "status--neutral",
    }[status] || "status--neutral";
  }

  function statusLabel(status) {
    return {
      active: "执行中",
      paused: "已暂停",
      draft: "待确认",
      archived: "已归档",
    }[status] || "未知";
  }

  function renderRouteStatuses() {
    [1, 2, 3].forEach((id) => {
      const article = $(`.route-item[data-route-id="${id}"]`);
      if (!article) return;
      const statusEl = article.querySelector(".status");
      const status = state.routeStates[id] || "draft";
      if (statusEl) {
        statusEl.className = `status ${statusClass(status)}`;
        statusEl.textContent = statusLabel(status);
      }
    });

    const detailStatus = $("#route-detail-status");
    if (detailStatus) {
      const status = state.routeStates[1] || "active";
      detailStatus.className = `status ${statusClass(status)}`;
      detailStatus.textContent = statusLabel(status);
    }

    const activeCount = [1, 2, 3, 4].filter((id) => state.routeStates[id] === "active").length;
    if ($("#route-summary-active")) $("#route-summary-active").textContent = String(activeCount);

    updateRouteActionButton($("#route-1-action"), state.routeStates[1], false);
    updateRouteActionButton($("#route-detail-action"), state.routeStates[1], true);

    const route3Button = $('.route-item[data-route-id="3"] [data-route-action]');
    updateRouteActionButton(route3Button, state.routeStates[3], false);
  }

  function updateRouteActionButton(button, status, detailed) {
    if (!button) return;
    if (status === "archived") {
      button.dataset.routeAction = "";
      button.disabled = true;
      button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>已归档';
      return;
    }
    button.disabled = false;
    const isActive = status === "active";
    button.dataset.routeAction = isActive ? "pause" : "resume";
    const icon = isActive ? "i-pause" : "i-play";
    const label = isActive ? "暂停" : "恢复";
    button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg>${label}${detailed ? "路线" : ""}`;
  }

  function handleRouteAction(id, action) {
    const current = state.routeStates[id] || "draft";
    let next = current;
    if (action === "pause") next = "paused";
    if (action === "resume") next = "active";
    if (action === "archive") next = "archived";
    state.routeStates[id] = next;
    renderRouteStatuses();

    if (next === "archived") {
      showToast("<strong>路线已归档。</strong> 不再生成每日任务，历史记录和看板数据保留。", "risk");
      if (location.hash.startsWith("#/routes/")) location.hash = "#/routes";
    } else if (next === "paused") {
      showToast("<strong>路线已暂停。</strong> 暂停期间不会生成新的今日任务，已有执行记录保留。");
    } else if (next === "active") {
      showToast("<strong>路线已恢复。</strong> 下一次生成今日计划时会重新纳入未完成任务。");
    }
  }

  function renderRouteDetail() {
    switchDetailTab("structure");
    syncRouteProgress();
  }

  function switchDetailTab(name) {
    $$("[data-detail-tab]").forEach((tab) => {
      const active = tab.dataset.detailTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $$("[data-detail-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.detailPanel !== name;
    });
  }

  function openNewRouteModal() {
    openModal(
      "新建空路线",
      "先创建结构，稍后在路线详情里添加阶段、周和任务",
      `<form class="modal__form" data-modal-form="new-route">
        <div class="field">
          <label for="new-route-name">路线名称</label>
          <input id="new-route-name" name="name" value="新的学习路线" required />
        </div>
        <div class="field">
          <label for="new-route-job">目标岗位</label>
          <input id="new-route-job" name="job" value="Java 后端实习" />
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="new-route-start">开始日期</label>
            <input id="new-route-start" name="start" type="date" value="2026-10-20" />
          </div>
          <div class="field">
            <label for="new-route-minutes">每日可用分钟</label>
            <input id="new-route-minutes" name="minutes" type="number" value="300" />
          </div>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>新路线以草稿状态创建，不会进入今日计划；添加任务并激活后才会开始生成每日任务。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">创建草稿</button>
        </div>
      </form>`
    );
  }

  function openAdjustRouteModal() {
    openModal(
      "调整日期与容量",
      "调整会平移未完成阶段和任务，并生成新的路线版本",
      `<form class="modal__form" data-modal-form="adjust-route">
        <div class="form-grid">
          <div class="field">
            <label for="adjust-start">开始日期</label>
            <input id="adjust-start" name="start" type="date" value="2026-10-02" />
          </div>
          <div class="field">
            <label for="adjust-minutes">每日可用分钟</label>
            <input id="adjust-minutes" name="minutes" type="number" value="300" />
          </div>
          <div class="field">
            <label for="adjust-factor">容量系数</label>
            <select id="adjust-factor" name="factor">
              <option value="80">80% · 推荐</option>
              <option value="90">90%</option>
              <option value="100">100%</option>
              <option value="60">60%</option>
            </select>
          </div>
          <div class="field">
            <label>有效日容量</label>
            <input value="240 分钟" disabled />
          </div>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>预览：未完成阶段整体后移 <b>2 天</b>，预计完成日期从 11/08 变为 <b>11/10</b>。已完成任务的日期不变。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">保存并重排</button>
        </div>
      </form>`
    );
  }

  /* ---------------------------------------------------------
     导入
     --------------------------------------------------------- */

  const PREVIEW_TASKS = {
    1: { title: "TCP 三次握手", type: "八股", minutes: 45, output: "状态机笔记", acceptance: "不看资料讲清三次握手和四次挥手" },
    2: { title: "HTTP 缓存", type: "八股", minutes: 45, output: "思维导图", acceptance: "能区分强缓存与协商缓存" },
    3: { title: "完成 3 道中等题", type: "算法", minutes: 90, output: "3 份代码与复杂度", acceptance: "" },
    4: { title: "HTTPS 握手与证书链", type: "八股", minutes: 40, output: "一页笔记", acceptance: "能说明证书校验过程" },
    5: { title: "JVM 内存区域", type: "八股", minutes: 50, output: "结构图", acceptance: "能画出运行时数据区" },
    6: { title: "GC 收集器对比", type: "八股", minutes: 45, output: "对比表", acceptance: "能说明 CMS 与 G1 的差异" },
    7: { title: "二叉树遍历与复杂度", type: "算法", minutes: 60, output: "代码", acceptance: "能写出迭代与递归版本" },
    8: { title: "区间 DP", type: "算法", minutes: 60, output: "3 道题解", acceptance: "能独立推导状态转移" },
    9: { title: "背包问题", type: "算法", minutes: 60, output: "题解", acceptance: "能区分 01 背包与完全背包" },
    10: { title: "订单系统缓存方案", type: "工程", minutes: 70, output: "缓存分层图", acceptance: "能讲清失效策略" },
    11: { title: "缓存穿透 / 击穿 / 雪崩", type: "八股", minutes: 45, output: "对比笔记", acceptance: "能给出三种场景的处理方案" },
    12: { title: "项目复盘：订单系统", type: "项目", minutes: 60, output: "STAR 提纲", acceptance: "能在 3 分钟内讲清项目" },
    13: { title: "简历项目重写", type: "简历", minutes: 60, output: "简历段落", acceptance: "每条经历有指标和取舍" },
    14: { title: "3 次模拟面试", type: "面试", minutes: 90, output: "面试记录", acceptance: "能回答项目追问" },
  };

  function setImportPane(name) {
    state.importPane = name;
    $$("[data-import-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.importPane !== name;
    });
    updateImportConsent();
  }

  function updateImportConsent() {
    const checkbox = $("#import-consent");
    if (!checkbox) return;
    state.importConsent = checkbox.checked;
    $("#import-consent-box").classList.toggle("is-granted", checkbox.checked);
    const confirm = $("#confirm-import");
    if (confirm) confirm.disabled = !checkbox.checked;
  }

  function renderImport(query) {
    const demo = query.get("state");
    if (demo === "preview") {
      $("#import-consent").checked = true;
      setImportPane("preview");
      updateImportConsent();
    } else if (demo === "error") {
      setImportPane("error");
    } else if (demo === "done") {
      setImportPane("done");
    } else {
      setImportPane("empty");
    }
  }

  function requireConsent() {
    if ($("#import-consent").checked) return true;
    showToast("<strong>需要先授权。</strong> 首次导入前请勾选 AI 解析授权；也可以先在设置中撤销或授权。", "risk");
    $("#import-consent-box").scrollIntoView({ block: "center", behavior: "smooth" });
    $("#import-consent-box").animate(
      [{ boxShadow: "0 0 0 0 rgba(216,91,102,.35)" }, { boxShadow: "0 0 0 5px rgba(216,91,102,0)" }],
      { duration: 700 }
    );
    return false;
  }

  function resetProcessingSteps() {
    $$(".processing-step").forEach((step, index) => {
      step.className = `processing-step${index === 0 ? " is-done" : ""}`;
      const dot = step.querySelector(".step-dot");
      if (index === 0) {
        dot.innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-check"></use></svg>';
      } else {
        dot.textContent = String(index + 1);
      }
    });
    const firstPending = $('.processing-step[data-processing-step="1"]');
    if (firstPending) firstPending.classList.add("is-active");
  }

  function advanceProcessing(step) {
    $$(".processing-step").forEach((el, index) => {
      if (index < step) {
        el.classList.remove("is-active");
        el.classList.add("is-done");
        el.querySelector(".step-dot").innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-check"></use></svg>';
      } else if (index === step) {
        el.classList.add("is-active");
        el.classList.remove("is-done");
        el.querySelector(".step-dot").textContent = String(index + 1);
      } else {
        el.classList.remove("is-active", "is-done");
        el.querySelector(".step-dot").textContent = String(index + 1);
      }
    });
  }

  function startProcessing(fileName) {
    if (!requireConsent()) return;
    stopProcessing();
    state.importFile = fileName || "后端冲刺计划.md";
    $("#processing-file").textContent = `${state.importFile} · 上传完成`;
    $("#processing-job").textContent = "job_01J9F3K2 · 可离开页面，稍后回来";
    setImportPane("processing");
    resetProcessingSteps();

    const progress = [8, 32, 62, 88, 100];
    const stepLabels = ["规则抽取", "AI 标准化", "校验与容量检查"];
    let step = 0;
    const update = () => {
      const percent = progress[step];
      $("#processing-bar").style.width = `${percent}%`;
      $("#processing-percent").textContent = `${percent}%`;
      if (step > 0) {
        advanceProcessing(step);
        const current = $(`[data-processing-step="${step}"] strong`);
        if (current && stepLabels[step - 1]) {
          // 保持步骤文案稳定，仅更新进度
        }
      }
    };
    update();

    state.processingTimer = window.setInterval(() => {
      step += 1;
      update();
      if (step >= 4) {
        window.clearInterval(state.processingTimer);
        state.processingTimer = null;
        state.processingFinishTimer = window.setTimeout(() => {
          setImportPane("preview");
          updateImportConsent();
          showToast("<strong>解析完成。</strong> 已生成 3 个阶段、6 个周目标、42 个任务，请检查问题清单。");
        }, 520);
      }
    }, 760);
  }

  function stopProcessing() {
    if (state.processingTimer) {
      window.clearInterval(state.processingTimer);
      state.processingTimer = null;
    }
    if (state.processingFinishTimer) {
      window.clearTimeout(state.processingFinishTimer);
      state.processingFinishTimer = null;
    }
  }

  function downloadTemplate() {
    const template = `# 30 天后端冲刺

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
    const blob = new Blob([template], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "persistlog-plan-template.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("<strong>模板已下载。</strong> 按标题、列表和缩进填写，解析成功率最高。");
  }

  function openPreviewTaskEdit(id) {
    const task = PREVIEW_TASKS[id];
    if (!task) return;
    openModal(
      "编辑预览任务",
      "确认前可以逐项修改；保存后问题清单会同步更新",
      `<form class="modal__form" data-modal-form="preview-task" data-preview-id="${id}">
        <div class="field">
          <label for="preview-title">任务标题</label>
          <input id="preview-title" name="title" value="${esc(task.title)}" required />
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="preview-type">类型</label>
            <select id="preview-type" name="type">
              ${["算法", "八股", "工程", "项目", "简历", "面试", "复盘"].map((type) => `<option${type === task.type ? " selected" : ""}>${type}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="preview-minutes">预计分钟</label>
            <input id="preview-minutes" name="minutes" type="number" min="15" max="120" value="${task.minutes}" />
          </div>
        </div>
        <div class="field">
          <label for="preview-output">产出要求</label>
          <input id="preview-output" name="output" value="${esc(task.output)}" />
        </div>
        <div class="field">
          <label for="preview-acceptance">验收标准</label>
          <textarea id="preview-acceptance" name="acceptance" placeholder="能验证任务完成的客观标准">${esc(task.acceptance)}</textarea>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">保存修改</button>
        </div>
      </form>`,
      { wide: true }
    );
  }

  function updatePreviewTaskDom(id, task) {
    $$(`[data-edit-preview-task="${id}"]`).forEach((button) => {
      const row = button.closest(".preview-task");
      if (!row) return;
      const title = row.querySelector(".preview-task__title span");
      if (title) title.textContent = task.title;
      const minutes = row.querySelector("b");
      if (minutes) minutes.textContent = `${task.minutes} 分钟`;
      const icon = row.querySelector(".preview-task__title .icon");
      if (icon) {
        icon.classList.toggle("icon--ok", Boolean(task.acceptance));
        icon.classList.toggle("icon--warn", !task.acceptance);
        icon.querySelector("use").setAttribute("href", task.acceptance ? "#i-check-circle" : "#i-warning");
      }
    });
  }

  /* ---------------------------------------------------------
     看板
     --------------------------------------------------------- */

  const TYPE_COLORS = ["var(--brand-600)", "var(--teal-600)", "var(--sky-600)", "#e8aa4d", "#9b8afb", "#c7ccda"];

  const DASHBOARD = {
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
        carry = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1][offset] || 0;
      }
      days.push({ label, plan, done, carry });
    }
    return days;
  }

  function renderDashboard(query) {
    const empty = query.get("state") === "empty";
    $("#dashboard-content").hidden = empty;
    $("#dashboard-empty").hidden = !empty;
    if (empty) return;

    $$("[data-period]").forEach((button) => {
      const active = Number(button.dataset.period) === state.period;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const data = DASHBOARD[state.period];
    const rate = Math.round((data.completed / data.planned) * 100);
    const carryRate = Math.round((data.carry / data.planned) * 100);
    const deviation = Math.round((data.actualMinutes / data.planMinutes) * 1000) / 10;

    $("#kpi-rate").textContent = `${rate}%`;
    $("#kpi-rate-delta").textContent = state.period === 7 ? "+6pt 较前 7 天" : "+3pt 较前 30 天";
    $("#kpi-rate-sub").textContent = `${data.completed} / ${data.planned} 项`;
    $("#kpi-minutes").innerHTML = `${data.planMinutes}<small>/ ${data.actualMinutes} 分钟</small>`;
    $("#kpi-minutes-delta").textContent = `时间偏差 ${deviation}%`;
    $("#kpi-minutes-delta").nextElementSibling.textContent = `实际少于计划 ${data.planMinutes - data.actualMinutes} 分钟`;
    $("#kpi-carry").textContent = `${carryRate}%`;
    $("#kpi-carry-delta").textContent = `${data.carry} / ${data.planned} 项`;
    $("#kpi-active").innerHTML = `${data.active}<small>天</small>`;
    $("#kpi-active-delta").textContent = `近 ${state.period} 天活跃 ${data.periodActive} 天`;

    renderTrend(data);
    renderDistribution(data);
    renderStatusDonut(data);
    syncRouteProgress();
  }

  function renderTrend(data) {
    const chart = $("#trend-chart");
    const max = Math.max(...data.days.map((day) => day.plan), 1);
    const dense = data.days.length > 10;
    chart.classList.toggle("is-dense", dense);
    chart.innerHTML = data.days
      .map((day, index) => {
        const showLabel = !dense || index % 5 === 0 || index === data.days.length - 1;
        const planHeight = day.plan ? Math.max(5, (day.plan / max) * 100) : 2;
        const doneHeight = day.done ? Math.max(4, (day.done / max) * 100) : 0;
        const carryHeight = day.carry ? Math.max(4, (day.carry / max) * 100) : 0;
        return `<div class="trend-day${index === data.days.length - 1 ? " is-today" : ""}">
          <div class="trend-bars">
            <span class="trend-bar" style="height:${planHeight}%" title="${day.label} · 计划 ${day.plan} 项"></span>
            <span class="trend-bar trend-bar--done" style="height:${doneHeight}%" title="${day.label} · 完成 ${day.done} 项"></span>
            ${day.carry ? `<span class="trend-bar trend-bar--carry" style="height:${carryHeight}%" title="${day.label} · 顺延 ${day.carry} 项"></span>` : ""}
          </div>
          <span class="trend-day__label">${showLabel ? day.label : ""}</span>
        </div>`;
      })
      .join("");
    chart.setAttribute("aria-label", `近 ${state.period} 天执行趋势：计划 ${data.planned} 项，完成 ${data.completed} 项，顺延 ${data.carry} 项`);
    $("#trend-sub").textContent = `近 ${state.period} 天：计划任务数 / 完成任务数 / 顺延数`;
    $("#trend-tag").textContent = state.period === 7 ? "按天" : "30 天";
    $("#trend-total").textContent = `计划 ${data.planned} · 完成 ${data.completed} · 顺延 ${data.carry}`;
  }

  function renderDistribution(data) {
    const max = Math.max(...data.types.map((item) => item.count), 1);
    $("#type-distribution").innerHTML = data.types
      .map(
        (item, index) => `<div class="dist-row">
          <span>${item.label}</span>
          <div class="dist-track"><span style="width:${Math.round((item.count / max) * 100)}%;background:${TYPE_COLORS[index]}"></span></div>
          <b>${item.count} 项</b>
        </div>`
      )
      .join("");
  }

  function renderStatusDonut(data) {
    const total = data.status.completed + data.status.carry + data.status.skipped + data.status.blocked;
    const p1 = (data.status.completed / total) * 100;
    const p2 = p1 + (data.status.carry / total) * 100;
    const p3 = p2 + (data.status.skipped / total) * 100;
    const donut = $("#status-donut");
    donut.style.background = `conic-gradient(
      var(--teal-600) 0 ${p1}%,
      var(--amber-600) ${p1}% ${p2}%,
      #c7ccda ${p2}% ${p3}%,
      var(--coral-600) ${p3}% 100%
    )`;
    donut.setAttribute(
      "aria-label",
      `完成 ${data.status.completed} 项、顺延 ${data.status.carry} 项、跳过 ${data.status.skipped} 项、阻塞 ${data.status.blocked} 项`
    );
    donut.querySelector(".donut__center b").textContent = `${Math.round((data.status.completed / total) * 100)}%`;
    $("#status-legend").innerHTML = `
      <div class="legend-item"><i style="background:var(--teal-600)"></i>完成 <b>${data.status.completed}</b></div>
      <div class="legend-item"><i style="background:var(--amber-600)"></i>顺延 <b>${data.status.carry}</b></div>
      <div class="legend-item"><i style="background:#c7ccda"></i>跳过 <b>${data.status.skipped}</b></div>
      <div class="legend-item"><i style="background:var(--coral-600)"></i>阻塞 <b>${data.status.blocked}</b></div>`;
  }

  /* ---------------------------------------------------------
     设置 / 登录 / 引导
     --------------------------------------------------------- */

  function renderSettings(tab = "profile") {
    const activeTab = ["profile", "notifications", "ai", "data"].includes(tab) ? tab : "profile";
    $$("[data-settings-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== activeTab;
    });
    $$("[data-settings-tab]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.settingsTab === activeTab);
    });
    updateEffectiveCapacity();
  }

  function updateEffectiveCapacity() {
    const minutes = Number($("#set-minutes").value) || 300;
    const factor = Number($("#set-factor").value) || 80;
    $("#set-factor-value").textContent = `${factor}%`;
    $("#set-effective").textContent = `${Math.round((minutes * factor) / 100)} 分钟`;
  }

  function renderLogin() {
    setAuthMode("login");
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const register = mode === "register";
    $$("[data-auth-tab]").forEach((tab) => {
      const active = tab.dataset.authTab === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $("#register-fields").hidden = !register;
    $("#auth-title").textContent = register ? "创建你的执行空间" : "继续你的执行节奏";
    $("#auth-sub").textContent = register
      ? "先注册，再花 2 分钟完成档案、目标和第一份计划。"
      : "今天的计划还在等你，登录后从顺延任务开始。";
    $("#auth-submit").textContent = register ? "创建账号并开始引导" : "登录";
  }

  function renderOnboarding() {
    state.onbStep = 1;
    showOnboardingStep(1);
  }

  function showOnboardingStep(step) {
    state.onbStep = clamp(step, 1, 4);
    $$("[data-onb-step]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.onbStep) !== state.onbStep;
    });
    $$("[data-onb-indicator]").forEach((indicator) => {
      const index = Number(indicator.dataset.onbIndicator);
      indicator.classList.toggle("is-active", index === state.onbStep);
      indicator.classList.toggle("is-done", index < state.onbStep);
    });
    $("#onb-back").hidden = state.onbStep === 1;
    $("#onb-next").innerHTML =
      state.onbStep === 4
        ? '进入工作台 <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>'
        : '下一步 <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>';
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAdjustPlanModal() {
    closeLayers(true);
    openModal(
      "调整今日计划",
      "今日计划由容量和优先级自动生成，也可以手动补充",
      `<div class="impact-box" style="margin-bottom:14px">
        <svg class="icon" aria-hidden="true"><use href="#i-target"></use></svg>
        <span>有效容量 <b>240 分钟</b> · 已排入 <b>220 分钟</b> · 剩余缓冲 <b>20 分钟</b>。不建议再加超过 20 分钟的任务。</span>
      </div>
      <div class="stack" style="gap:8px">
        <button class="btn btn--secondary btn--sm" type="button" data-open="add-task" style="justify-content:flex-start"><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>手动添加一项任务</button>
        <button class="btn btn--secondary btn--sm" type="button" data-toast="已按当前容量和优先级重新生成今日计划；已有执行记录不会丢失。" style="justify-content:flex-start"><svg class="icon" aria-hidden="true"><use href="#i-refresh"></use></svg>重新生成今日计划</button>
        <a class="btn btn--secondary btn--sm" href="#/settings/profile" style="justify-content:flex-start"><svg class="icon" aria-hidden="true"><use href="#i-settings"></use></svg>调整每日容量</a>
      </div>
      <div class="modal__foot"><button class="btn btn--ghost btn--sm" type="button" data-close-modal>关闭</button></div>`
    );
  }

  function openAddTaskModal() {
    openModal(
      "添加今日任务",
      "手动加入的任务也会占用今日容量，并进入执行统计",
      `<form class="modal__form" data-modal-form="add-task">
        <div class="field">
          <label for="add-title">任务标题</label>
          <input id="add-title" name="title" placeholder="例如：复盘今天的面试问题" required />
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="add-type">类型</label>
            <select id="add-type" name="type">
              ${["算法", "八股", "工程", "项目", "简历", "面试", "复盘"].map((type) => `<option>${type}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="add-minutes">预计分钟</label>
            <input id="add-minutes" name="minutes" type="number" min="15" max="120" value="30" />
          </div>
        </div>
        <div class="field">
          <label for="add-output">产出要求</label>
          <input id="add-output" name="output" placeholder="例如：一页复盘笔记" />
        </div>
        <div class="field">
          <label for="add-acceptance">验收标准</label>
          <textarea id="add-acceptance" name="acceptance" placeholder="例如：能讲清 3 个问题的改进点"></textarea>
        </div>
        <div class="impact-box">
          <svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>
          <span>添加后会立即出现在今日任务中。若超出容量，会标记为 over_capacity，但不会静默丢弃。</span>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">添加任务</button>
        </div>
      </form>`
    );
  }

  function openEditWebhookModal() {
    openModal(
      "更换企业微信 Webhook",
      "只接受 HTTPS 与企业微信固定域名；密钥会加密存储",
      `<form class="modal__form" data-modal-form="edit-webhook">
        <div class="field">
          <label for="webhook-input">Webhook 地址</label>
          <input id="webhook-input" name="webhook" type="password" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." required />
          <p class="field__hint">保存后页面只显示掩码。测试发送会进入 Outbox 队列。</p>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary btn--sm" type="button" data-close-modal>取消</button>
          <button class="btn btn--primary btn--sm" type="submit">保存并测试</button>
        </div>
      </form>`
    );
  }

  function maskWebhook(value) {
    let key = value;
    if (value.includes("key=")) key = value.split("key=").pop();
    const tail = key.slice(-4) || "7a2f";
    return `https://qyapi.weixin.qq.com/…/send?key=••••••${tail}`;
  }

  /* ---------------------------------------------------------
     演示导航 / 重置
     --------------------------------------------------------- */

  function resetDemo() {
    state.tasks = clone(INITIAL_TASKS);
    state.filter = "all";
    state.period = 7;
    state.routeStates = { 1: "active", 2: "draft", 3: "paused", 4: "draft" };
    state.consentGranted = true;
    state.importConsent = false;
    state.importFile = "后端冲刺计划.md";
    $("#import-consent").checked = false;
    document.querySelector('.route-item[data-route-id="4"]')?.remove();
    stopProcessing();
    setImportPane("empty");
    $("#consent-status").className = "status status--active";
    $("#consent-status").textContent = "已授权";
    $("#revoke-consent").textContent = "撤销授权";
    $("#onb-file-name").textContent = "尚未选择文件";
    closeLayers(true);
    if (location.hash === "#/today" || location.hash === "") {
      renderRoute();
    } else {
      location.hash = "#/today";
    }
    showToast("<strong>演示数据已重置。</strong> 回到今日页，所有任务恢复为初始状态。");
  }

  /* ---------------------------------------------------------
     事件绑定
     --------------------------------------------------------- */

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest(".toggle");
    if (toggle) {
      toggle.classList.toggle("is-on");
      toggle.setAttribute("aria-pressed", String(toggle.classList.contains("is-on")));
      return;
    }

    const closeModalButton = event.target.closest("[data-close-modal]");
    if (closeModalButton) {
      closeModal();
      return;
    }

    if (event.target.matches("[data-modal-backdrop]")) {
      closeModal();
      return;
    }

    const confirmOk = event.target.closest("[data-confirm-ok]");
    if (confirmOk) {
      const callback = state.pendingConfirm;
      state.pendingConfirm = null;
      closeModal(true);
      if (callback) callback();
      return;
    }

    const closeLayersButton = event.target.closest("[data-close-layers]");
    if (closeLayersButton) {
      closeLayers();
      return;
    }

    const authTab = event.target.closest("[data-auth-tab]");
    if (authTab) {
      setAuthMode(authTab.dataset.authTab);
      return;
    }

    const detailTab = event.target.closest("[data-detail-tab]");
    if (detailTab) {
      switchDetailTab(detailTab.dataset.detailTab);
      return;
    }

    const routeAction = event.target.closest("[data-route-action]");
    if (routeAction) {
      handleRouteAction(Number(routeAction.dataset.routeId), routeAction.dataset.routeAction);
      return;
    }

    const taskFilter = event.target.closest("[data-task-filter]");
    if (taskFilter) {
      state.filter = taskFilter.dataset.taskFilter;
      renderToday();
      return;
    }

    const periodButton = event.target.closest("[data-period]");
    if (periodButton) {
      state.period = Number(periodButton.dataset.period);
      renderDashboard(new URLSearchParams());
      return;
    }

    const confirmButton = event.target.closest("[data-confirm]");
    if (confirmButton) {
      const kind = confirmButton.dataset.confirm;
      if (kind === "archive-route") {
        openConfirm({
          title: "归档路线",
          subtitle: "Java 后端实习准备 · 36 天",
          body: "归档后不再生成每日任务，历史记录与看板数据保留。正式版应支持从归档恢复。",
          confirmText: "确认归档",
          onConfirm: () => handleRouteAction(1, "archive"),
        });
      } else if (kind === "disconnect-channel") {
        openConfirm({
          title: "断开企业微信渠道",
          subtitle: "企业微信群机器人",
          body: "断开后不再发送早报、晚报、逾期和顺延提醒。今日页和看板仍然可用。",
          confirmText: "确认断开",
          onConfirm: () => showToast("<strong>渠道已断开。</strong> 可在设置中重新配置 Webhook。", "risk"),
        });
      } else if (kind === "revoke-consent") {
        const granted = state.consentGranted;
        openConfirm({
          title: granted ? "撤销 AI 解析授权" : "重新授权 AI 解析",
          subtitle: "scope ai_import · version v1",
          body: granted
            ? "撤销后不能导入新的 Markdown，已有路线、任务和今日页不受影响。你可以继续手动创建任务。"
            : "重新授权后，上传 Markdown 时计划文本可以发送给第三方 AI 做结构化解析。",
          confirmText: granted ? "确认撤销" : "确认授权",
          onConfirm: () => {
            state.consentGranted = !granted;
            $("#consent-status").className = `status ${granted ? "status--neutral" : "status--active"}`;
            $("#consent-status").textContent = granted ? "未授权" : "已授权";
            $("#revoke-consent").textContent = granted ? "重新授权" : "撤销授权";
            showToast(granted ? "<strong>授权已撤销。</strong> 你可以随时重新授权。" : "<strong>授权已恢复。</strong> 现在可以导入新的 Markdown。");
          },
        });
      }
      return;
    }

    const saveButton = event.target.closest("[data-save]");
    if (saveButton) {
      showToast(`<strong>${saveButton.dataset.save}</strong> 变更只影响未来计划，历史记录保持不变。`);
      return;
    }

    const locked = event.target.closest("[data-locked]");
    if (locked) {
      showToast(`<strong>后续阶段。</strong> ${locked.dataset.locked} Phase 1 先把计划执行跑通。`);
      return;
    }

    const editPreviewTask = event.target.closest("[data-edit-preview-task]");
    if (editPreviewTask) {
      openPreviewTaskEdit(Number(editPreviewTask.dataset.editPreviewTask));
      return;
    }

    const loadSample = event.target.closest("[data-load-sample]");
    if (loadSample) {
      startProcessing("后端冲刺计划.md");
      return;
    }

    const openTarget = event.target.closest("[data-open]");
    if (openTarget) {
      const kind = openTarget.dataset.open;
      if (kind === "adjust-plan") openAdjustPlanModal();
      if (kind === "add-task") openAddTaskModal();
      if (kind === "new-route") openNewRouteModal();
      if (kind === "adjust-route") openAdjustRouteModal();
      if (kind === "edit-webhook") openEditWebhookModal();
      return;
    }

    const goTarget = event.target.closest("[data-go]");
    if (goTarget) {
      closeLayers(true);
      location.hash = goTarget.dataset.go;
      return;
    }

    const toastTarget = event.target.closest("[data-toast]");
    if (toastTarget) {
      showToast(`<strong>恒序：</strong>${toastTarget.dataset.toast}`);
      return;
    }
  });

  /* 任务列表 */
  $("#today-task-list").addEventListener("click", (event) => {
    const check = event.target.closest("[data-task-check]");
    if (check) {
      event.preventDefault();
      const task = findTask(check.dataset.taskCheck);
      if (!task) return;
      if (task.status === "completed") {
        openTaskDetail(task.id);
      } else if (["postponed", "skipped", "abandoned"].includes(task.status)) {
        showToast("<strong>该任务已结束。</strong> 可在任务详情中恢复到今日。", "risk");
        openTaskDetail(task.id);
      } else {
        openCompleteModal(task.id);
      }
      return;
    }

    const why = event.target.closest("[data-task-why]");
    if (why) {
      openTaskDetail(why.dataset.taskWhy);
      return;
    }

    const more = event.target.closest("[data-task-more]");
    if (more) {
      openTaskDetail(more.dataset.taskMore);
      return;
    }

    const row = event.target.closest("[data-task-id]");
    if (row) openTaskDetail(row.dataset.taskId);
  });

  $("#today-task-list").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-task-id]");
    if (!row || event.target.closest("button")) return;
    event.preventDefault();
    openTaskDetail(row.dataset.taskId);
  });

  /* 任务详情抽屉 */
  sheet.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close-layers]");
    if (close) {
      closeLayers();
      return;
    }

    const action = event.target.closest("[data-task-action]");
    if (!action) return;
    const kind = action.dataset.taskAction;
    const currentTask = sheetTaskId;
    if (!currentTask) return;

    if (kind === "start") {
      const target = findTask(currentTask);
      target.status = "in_progress";
      closeLayers();
      renderToday();
      showToast(`<strong>开始「${esc(target.title)}」</strong> 完成后记得填写实际分钟。`);
    } else if (kind === "complete") {
      openCompleteModal(currentTask);
    } else if (kind === "postpone") {
      openPostponeModal(currentTask);
    } else if (kind === "skip") {
      openSkipModal(currentTask);
    } else if (kind === "block") {
      openBlockModal(currentTask);
    } else if (kind === "unblock") {
      const target = findTask(currentTask);
      target.status = "pending";
      closeLayers();
      renderToday();
      showToast(`<strong>已解除阻塞。</strong>「${esc(target.title)}」恢复为待开始。`);
    } else if (kind === "restore") {
      const target = findTask(currentTask);
      target.status = "pending";
      closeLayers();
      renderToday();
      showToast(`<strong>已恢复到今日。</strong>「${esc(target.title)}」重新进入待完成。`);
    } else if (kind === "abandon") {
      openAbandonModal(currentTask);
    } else if (kind === "split") {
      openSplitModal(currentTask);
    }
  });

  /* 弹窗内的表单 */
  modalRoot.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-modal-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const kind = form.dataset.modalForm;
    const taskId = form.dataset.taskId;

    if (kind === "complete") {
      completeTask(taskId, data.get("actual"), String(data.get("note") || "").trim());
    } else if (kind === "postpone") {
      const task = findTask(taskId);
      if (task) {
        task.status = "postponed";
        task.postponedTo = "10/20";
        task.postponeReason = data.get("reason") || "";
      }
      closeModal();
      renderToday();
      showToast(`<strong>已延期到明天。</strong> 预计完成日期 11/13（+1 天）；连续顺延 3 次会提示拆分。`);
    } else if (kind === "skip") {
      const task = findTask(taskId);
      if (task) {
        task.status = "skipped";
        task.skipReason = data.get("reason") || "";
        task.note = data.get("note") || task.note;
      }
      closeModal();
      renderToday();
      showToast("<strong>已跳过。</strong> 任务计划日期已清空，不再自动进入今日；可在路线详情重新排期。");
    } else if (kind === "block") {
      const task = findTask(taskId);
      if (task) {
        task.status = "blocked";
        task.blockReason = data.get("reason") || "";
      }
      closeModal();
      renderToday();
      showToast("<strong>已标记阻塞。</strong> 解除后恢复为待开始；阻塞任务仍会进入明天的计划。");
    } else if (kind === "split") {
      const task = findTask(taskId);
      if (task) {
        const titles = [String(data.get("title1") || "").trim(), String(data.get("title2") || "").trim()];
        const minutes = [Number(data.get("minutes1")) || 15, Number(data.get("minutes2")) || 15];
        task.status = "abandoned";
        statesPushSplit(task, titles, minutes);
      }
      closeModal();
      renderToday();
      showToast("<strong>已拆分为两项。</strong> 原任务归档，两个子任务已进入今日，可在详情里分别完成。");
    } else if (kind === "preview-task") {
      const id = form.dataset.previewId;
      PREVIEW_TASKS[id] = {
        title: String(data.get("title") || "").trim(),
        type: data.get("type"),
        minutes: Number(data.get("minutes")) || 45,
        output: String(data.get("output") || "").trim(),
        acceptance: String(data.get("acceptance") || "").trim(),
      };
      updatePreviewTaskDom(id, PREVIEW_TASKS[id]);
      closeModal();
      showToast("<strong>任务已更新。</strong> 问题清单会按新的验收标准重新判断。");
    } else if (kind === "add-task") {
      const minutes = clamp(Number(data.get("minutes")) || 30, 15, 120);
      const task = {
        id: `t${Date.now()}`,
        title: String(data.get("title") || "").trim(),
        type: data.get("type"),
        stage: "今日计划 · 手动添加",
        source: "手动",
        planned: minutes,
        actual: 0,
        status: "pending",
        carry: 0,
        why: "用户手动加入今日计划；会占用今日容量并进入执行统计。",
        output: String(data.get("output") || "").trim(),
        acceptance: String(data.get("acceptance") || "").trim(),
        note: "",
      };
      state.tasks.push(task);
      state.filter = "all";
      closeModal();
      renderToday();
      showToast(`<strong>已添加「${esc(task.title)}」</strong> 今日容量已重新计算。`);
    } else if (kind === "new-route") {
      const name = String(data.get("name") || "新的学习路线");
      const job = String(data.get("job") || "Java 后端实习");
      const start = String(data.get("start") || "2026-10-20");
      const minutes = Number(data.get("minutes")) || 300;
      if (document.querySelector('.route-item[data-route-id="4"]')) {
        closeModal();
        showToast("<strong>原型仅支持新增一条示例路线。</strong> 请刷新页面后重试。");
        return;
      }
      state.routeStates[4] = "draft";
      $("#route-list").insertAdjacentHTML(
        "beforeend",
        `<article class="route-item" data-route-id="4">
          <div class="route-item__copy">
            <div class="route-title-row"><h3>${esc(name)}</h3><span class="status status--draft">待确认</span></div>
            <p>目标：${esc(job)} · 开始 ${esc(start)} · 每日可用 ${minutes} 分钟</p>
            <div class="route-progress"><div class="progress-track"><span style="width:0%"></span></div><b>0%</b></div>
            <div class="route-meta"><span><b>0</b> 个任务</span><span>草稿</span><span>尚未生成每日计划</span></div>
          </div>
          <div class="route-actions">
            <button class="btn btn--primary btn--sm" type="button" data-toast="新增阶段：填写名称、开始日期和目标。">添加阶段</button>
            <button class="btn btn--ghost btn--sm" type="button" data-toast="草稿路线不会进入今日计划，激活后才会生成每日任务。">说明</button>
          </div>
        </article>`
      );
      $("#route-list").hidden = false;
      $("#routes-empty").hidden = true;
      closeModal();
      renderRouteStatuses();
      showToast(`<strong>草稿路线「${esc(name)}」已创建。</strong> 添加阶段和任务后即可激活。`);
    } else if (kind === "adjust-route") {
      closeModal();
      showToast("<strong>路线已重排。</strong> 未完成阶段整体后移 2 天，并生成版本 v4。");
    } else if (kind === "edit-webhook") {
      const value = String(data.get("webhook") || "");
      $("#webhook-masked").textContent = maskWebhook(value);
      $("#last-test").textContent = "刚刚 · 测试消息已排队";
      closeModal();
      showToast("<strong>Webhook 已更新。</strong> 测试消息已进入 Outbox，通常 5 秒内送达。");
    }
  });

  function statesPushSplit(task, titles, minutes) {
    titles.forEach((title, index) => {
      state.tasks.push({
        id: `t${Date.now()}${index}`,
        title,
        type: task.type,
        stage: task.stage,
        source: task.source,
        planned: minutes[index],
        actual: 0,
        status: "pending",
        carry: 0,
        why: `由「${task.title}」拆分；原任务已归档。`,
        output: task.output,
        acceptance: task.acceptance,
        note: "",
      });
    });
  }

  /* 顶栏与原型导航 */
  $("#open-proto").addEventListener("click", openProto);
  $("#close-proto").addEventListener("click", closeProto);
  $("#reset-demo").addEventListener("click", resetDemo);
  overlay.addEventListener("click", () => closeLayers());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (modalRoot.children.length) {
        closeModal();
      } else {
        closeLayers();
      }
      return;
    }
    if (event.key === "Tab" && modalRoot.children.length) trapFocus(event);
  });

  /* 登录 */
  $("#auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.authMode === "register") {
      showToast("<strong>账号已创建。</strong> 接下来用 4 步完成档案、目标和第一份计划。");
      location.hash = "#/onboarding";
    } else {
      showToast("<strong>登录成功。</strong> 今天的计划已经准备好了。");
      location.hash = "#/today";
    }
  });

  /* 引导 */
  $("#onb-next").addEventListener("click", () => {
    if (state.onbStep < 4) {
      showOnboardingStep(state.onbStep + 1);
    } else {
      showToast("<strong>引导完成。</strong> 今日页会先用示例计划展示执行流程，正式版会写入你的真实数据。");
      location.hash = "#/today";
    }
  });
  $("#onb-back").addEventListener("click", () => showOnboardingStep(state.onbStep - 1));
  $("#onb-sample").addEventListener("click", () => {
    $("#onb-file-name").textContent = "后端冲刺计划.md · 已载入示例";
    showToast("<strong>示例计划已就绪。</strong> 下一步会展示解析授权和推送设置。");
  });
  $("#onb-factor").addEventListener("input", (event) => {
    $("#onb-factor-value").textContent = `${event.target.value}%`;
  });
  $("#onb-consent").addEventListener("change", () => {
    const checked = $("#onb-consent").checked;
    showToast(checked ? "<strong>已记录授权。</strong> 可在设置 → AI 授权中撤销。" : "<strong>已取消授权。</strong> 之后只能手动创建任务。", checked ? "success" : "risk");
  });

  /* 今日按钮 */
  $("#start-next").addEventListener("click", () => {
    if (!state.tasks.length) {
      showToast("<strong>今天没有任务。</strong> 可以导入一份计划，或从路线添加一项任务。", "risk");
      return;
    }
    const next = state.tasks.find((task) => ["pending", "in_progress", "blocked"].includes(task.status));
    if (!next) {
      showToast("<strong>今天的任务已经全部完成。</strong> 可以查看明天的安排，或提前做一项。", "success");
      return;
    }
    openTaskDetail(next.id);
  });
  $("#carry-start").addEventListener("click", () => {
    const carry = state.tasks.find((task) => task.carry > 0 && ["pending", "in_progress", "blocked"].includes(task.status));
    if (carry) openTaskDetail(carry.id);
  });

  /* 导入 */
  $("#choose-file").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) startProcessing(file.name);
    event.target.value = "";
  });
  $("#import-consent").addEventListener("change", updateImportConsent);
  $("#load-sample").addEventListener("click", () => startProcessing("后端冲刺计划.md"));
  $("#download-template").addEventListener("click", downloadTemplate);
  $("#download-template-error").addEventListener("click", downloadTemplate);
  $("#retry-error").addEventListener("click", () => {
    setImportPane("empty");
    $("#choose-file").focus();
  });
  $("#cancel-processing").addEventListener("click", () => {
    stopProcessing();
    setImportPane("empty");
    showToast("<strong>已取消解析。</strong> 没有创建任何路线。", "risk");
  });
  $("#cancel-import").addEventListener("click", () => {
    setImportPane("empty");
    showToast("<strong>已取消本次导入。</strong> 已有路线不会改变。", "risk");
  });
  $("#reparse-import").addEventListener("click", () => startProcessing(state.importFile));
  $("#confirm-import").addEventListener("click", () => {
    if (!requireConsent()) return;
    setImportPane("done");
    showToast("<strong>路线已创建。</strong> 42 个任务已进入路线 v1，可在 24 小时内回滚。");
  });
  $("#rollback-import").addEventListener("click", () => {
    openConfirm({
      title: "回滚本次导入",
      subtitle: "后端冲刺计划.md · 路线 v1",
      body: "将删除本批次创建的路线、阶段、周和任务。如果已经产生执行记录，正式版会阻止回滚。",
      confirmText: "确认回滚",
      onConfirm: () => {
        setImportPane("empty");
        showToast("<strong>已回滚本次导入。</strong> 已有路线和执行记录没有受到影响。", "risk");
      },
    });
  });
  $("#import-again").addEventListener("click", () => {
    setImportPane("empty");
    state.importFile = "后端冲刺计划.md";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#toggle-preview-more").addEventListener("click", () => {
    const more = $("#preview-more-tasks");
    more.hidden = !more.hidden;
    $("#toggle-preview-more").textContent = more.hidden ? "展开全部 42 项" : "收起多余任务";
  });

  const dropzone = $("#dropzone");
  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });
  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) startProcessing(file.name);
  });

  /* 设置 */
  $("#set-factor").addEventListener("input", updateEffectiveCapacity);
  $("#set-minutes").addEventListener("input", updateEffectiveCapacity);
  $("#test-send").addEventListener("click", () => {
    $("#last-test").textContent = "刚刚 · 已进入 Outbox 队列";
    showToast("<strong>测试消息已排队。</strong> 通常 5 秒内送达；失败会按 1/5/30 分钟重试。");
  });

  /* 窗口导航 */
  window.addEventListener("hashchange", renderRoute);

  /* 初始渲染 */
  renderRoute();
})();
