(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const body = document.body;
  const page = document.querySelector(".page");
  if (!page) return;

  /* ---------- layout / shell ---------- */

  const navToggle = $("#navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const collapsed = body.classList.toggle("nav-collapsed");
      navToggle.setAttribute("aria-expanded", String(!collapsed));
      navToggle.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
    });
  }

  $$(".nav-item").forEach((link) => {
    const label = link.querySelector(".nav-text")?.textContent?.trim();
    if (label && !link.getAttribute("aria-label")) link.setAttribute("aria-label", label);
  });

  /* ---------- URL state demo ---------- */

  const params = new URLSearchParams(window.location.search);
  const demoState = params.get("state");
  if (demoState === "loading") {
    body.classList.add("state-loading");
  }
  if (demoState === "error") {
    const banner = $("#errorBanner");
    if (banner) banner.classList.add("is-visible");
  }

  const retryBtn = $("#retryBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      const banner = $("#errorBanner");
      if (banner) banner.classList.remove("is-visible");
      showToast("已重新同步最近数据");
    });
  }

  /* ---------- toast ---------- */

  let toastTimer = null;
  function showToast(text, options) {
    const toast = $("#toast");
    const label = $("#toastText");
    const action = $("#toastAction");
    if (!toast || !label) return;
    label.textContent = text;
    if (action) {
      action.hidden = !options || !options.onUndo;
      action.onclick = options && options.onUndo ? options.onUndo : null;
    }
    toast.classList.add("is-visible");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4600);
  }

  function hideToast() {
    const toast = $("#toast");
    if (toast) toast.classList.remove("is-visible");
  }

  /* ---------- drawer / modal ---------- */

  const scrim = $("#scrim");
  const drawer = $("#taskDrawer");
  const modal = $("#adjustModal");
  let activeDrawerRow = null;

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    if (scrim) scrim.classList.add("is-open");
    body.classList.add("no-scroll");
    const close = $("#closeDrawer");
    if (close) close.focus();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (scrim && !modal?.classList.contains("is-open")) scrim.classList.remove("is-open");
    if (!modal?.classList.contains("is-open")) body.classList.remove("no-scroll");
    activeDrawerRow = null;
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (scrim) scrim.classList.add("is-open");
    body.classList.add("no-scroll");
    const close = $("#closeAdjust");
    if (close) close.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (scrim && !drawer?.classList.contains("is-open")) scrim.classList.remove("is-open");
    if (!drawer?.classList.contains("is-open")) body.classList.remove("no-scroll");
  }

  if (scrim) {
    scrim.addEventListener("click", () => {
      closeDrawer();
      closeModal();
    });
  }
  const closeDrawerBtn = $("#closeDrawer");
  if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", closeDrawer);
  const closeAdjustBtn = $("#closeAdjust");
  if (closeAdjustBtn) closeAdjustBtn.addEventListener("click", closeModal);
  const cancelAdjust = $("#cancelAdjust");
  if (cancelAdjust) cancelAdjust.addEventListener("click", closeModal);
  $$("[data-adjust]").forEach((button) => button.addEventListener("click", openModal));

  const applyAdjust = $("#applyAdjust");
  if (applyAdjust) {
    applyAdjust.addEventListener("click", () => {
      closeModal();
      showToast("计划容量已更新，未来 7 天的风险已重新计算");
    });
  }
  const capacityRange = $("#capacityRange");
  const capacityInput = $("#capacityInput");
  if (capacityRange && capacityInput) {
    capacityRange.addEventListener("input", () => {
      capacityInput.value = String(Math.round(Number(capacityRange.value) * 2.4));
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal?.classList.contains("is-open")) closeModal();
    else if (drawer?.classList.contains("is-open")) closeDrawer();
  });

  /* ---------- chart (dashboard only) ---------- */

  const chartDays = $("#chartDays");
  if (chartDays) {
    const data7 = {
      dates: ["10/14", "10/15", "10/16", "10/17", "10/18", "10/19", "10/20"],
      plan: [20, 28, 26, 32, 34, 30, 38],
      done: [12, 20, 18, 24, 26, 22, 28],
      carry: [4, 6, 5, 7, 6, 8, 5],
    };
    const data30 = {
      dates: Array.from({ length: 30 }, (_, index) => {
        const day = 21 + index;
        return day <= 30 ? `09/${day}` : `10/${day - 30}`;
      }),
      plan: Array.from({ length: 30 }, (_, index) => 22 + ((index * 7) % 16)),
      done: Array.from({ length: 30 }, (_, index) => 14 + ((index * 5) % 13)),
      carry: Array.from({ length: 30 }, (_, index) => 2 + ((index * 3) % 6)),
    };
    const state = {
      period: 7,
      hidden: new Set(),
      date: null,
      status: "all",
      risk: false,
    };
    const statusLabels = {
      all: "全部",
      done: "已完成",
      active: "进行中",
      carry: "顺延",
      blocked: "阻塞",
      todo: "待开始",
    };

    const tooltip = $("#chartTooltip");
    const tooltipDate = $("#tooltipDate");
    const tooltipPlan = $("#tooltipPlan");
    const tooltipDone = $("#tooltipDone");
    const tooltipCarry = $("#tooltipCarry");
    const chartWrap = $("#chartWrap");

    function currentData() {
      return state.period === 7 ? data7 : data30;
    }

    function renderChart() {
      const data = currentData();
      const max = 40;
      chartDays.innerHTML = "";
      const x = $("#chartX");
      if (x) x.innerHTML = "";
      data.dates.forEach((date, index) => {
        const day = document.createElement("button");
        day.type = "button";
        day.className = "chart-day" + (state.date === date ? " is-selected" : "");
        day.setAttribute("aria-label", `${date}：计划 ${data.plan[index]}，完成 ${data.done[index]}，顺延 ${data.carry[index]}`);
        day.setAttribute("aria-pressed", String(state.date === date));
        day.dataset.date = date;
        const bars = document.createElement("span");
        bars.className = "chart-bars";
        [
          ["plan", data.plan[index]],
          ["done", data.done[index]],
          ["carry", data.carry[index]],
        ].forEach(([series, value]) => {
          const bar = document.createElement("span");
          bar.className = `chart-bar chart-bar--${series}` + (state.hidden.has(series) ? " is-hidden" : "");
          bar.style.height = `${Math.max(2, (value / max) * 100)}%`;
          bars.appendChild(bar);
        });
        day.appendChild(bars);
        day.addEventListener("mouseenter", (event) => showTooltip(event, date, index, data));
        day.addEventListener("mousemove", (event) => moveTooltip(event));
        day.addEventListener("mouseleave", hideTooltip);
        day.addEventListener("click", () => selectDate(date));
        chartDays.appendChild(day);

        if (x) {
          const label = document.createElement("span");
          label.textContent = state.period === 30 && index % 5 !== 0 ? "" : date;
          if (state.date === date) label.classList.add("is-selected");
          x.appendChild(label);
        }
      });
      if (chartWrap) chartWrap.classList.toggle("is-empty", data.dates.length === 0);
    }

    function showTooltip(event, date, index, data) {
      if (!tooltip || !chartWrap) return;
      if (tooltipDate) tooltipDate.textContent = date;
      if (tooltipPlan) tooltipPlan.textContent = String(data.plan[index]);
      if (tooltipDone) tooltipDone.textContent = String(data.done[index]);
      if (tooltipCarry) tooltipCarry.textContent = String(data.carry[index]);
      moveTooltip(event);
      tooltip.classList.add("is-visible");
    }

    function moveTooltip(event) {
      if (!tooltip || !chartWrap) return;
      const rect = chartWrap.getBoundingClientRect();
      const left = Math.min(Math.max(event.clientX - rect.left, 82), rect.width - 82);
      const top = Math.max(event.clientY - rect.top - 10, 90);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function hideTooltip() {
      if (tooltip) tooltip.classList.remove("is-visible");
    }

    function selectDate(date) {
      state.date = state.date === date ? null : date;
      renderChart();
      applyFilters();
      const section = $("#task-section");
      if (section && state.date) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    $$(".legend-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const series = button.dataset.series;
        if (state.hidden.has(series)) state.hidden.delete(series);
        else state.hidden.add(series);
        button.setAttribute("aria-pressed", String(!state.hidden.has(series)));
        renderChart();
      });
    });

    $$("[data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        state.period = Number(button.dataset.period) || 7;
        $$("[data-period]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        const sub = $("#trendSub");
        if (sub) sub.textContent = `近 ${state.period} 天 · 计划 / 完成 / 顺延任务数`;
        state.date = null;
        renderChart();
        applyFilters();
      });
    });

    function setStatus(status) {
      state.status = status;
      state.risk = false;
      $$("[data-status-filter]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.statusFilter === status));
      });
      applyFilters();
      const section = $("#task-section");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    $$("[data-status-filter]").forEach((button) => {
      button.addEventListener("click", () => setStatus(button.dataset.statusFilter || "all"));
    });

    const clearStatus = $("#clearStatus");
    if (clearStatus) {
      clearStatus.addEventListener("click", () => {
        state.date = null;
        state.status = "all";
        state.risk = false;
        $$("[data-status-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.statusFilter === "all")));
        renderChart();
        applyFilters();
      });
    }

    const riskFilter = $("#riskFilter");
    if (riskFilter) {
      riskFilter.addEventListener("click", () => {
        state.risk = true;
        state.status = "all";
        state.date = null;
        $$("[data-status-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.statusFilter === "all")));
        applyFilters();
        const section = $("#task-section");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    function applyFilters() {
      const rows = $$("#taskRows .task-row");
      let visible = 0;
      rows.forEach((row) => {
        const dateMatch = !state.date || row.dataset.date === state.date;
        const statusMatch = state.status === "all" || row.dataset.status === state.status;
        const riskMatch = !state.risk || row.dataset.risk === "true";
        const show = dateMatch && statusMatch && riskMatch;
        row.style.display = show ? "" : "none";
        if (show) visible += 1;
      });
      const empty = $("#taskEmpty");
      if (empty) empty.classList.toggle("is-visible", visible === 0);
      const banner = $("#taskFilterBanner");
      const text = $("#taskFilterText");
      const parts = [];
      if (state.date) parts.push(`日期 ${state.date}`);
      if (state.status !== "all") parts.push(statusLabels[state.status] || state.status);
      if (state.risk) parts.push("高风险任务");
      if (banner) banner.classList.toggle("is-visible", parts.length > 0);
      if (text) text.textContent = parts.length ? `已筛选：${parts.join(" · ")}` : "";
      const sub = $("#taskSub");
      if (sub) sub.textContent = parts.length ? `当前筛选 ${visible} 项任务` : "查看、筛选并处理影响进度和日期的任务";
    }

    const clearTaskFilter = $("#clearTaskFilter");
    if (clearTaskFilter) {
      clearTaskFilter.addEventListener("click", () => {
        state.date = null;
        state.status = "all";
        state.risk = false;
        $$("[data-status-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.statusFilter === "all")));
        renderChart();
        applyFilters();
      });
    }
    const emptyClear = $("#emptyClear");
    if (emptyClear) emptyClear.addEventListener("click", () => $("#clearTaskFilter")?.click());

    /* donut */

    const donutSvg = $("#donutSvg");
    if (donutSvg) {
      const segments = [
        { key: "done", value: 28, color: "#2f7d73" },
        { key: "active", value: 3, color: "#4f5d96" },
        { key: "carry", value: 5, color: "#c58a52" },
        { key: "blocked", value: 2, color: "#a94444" },
      ];
      const total = segments.reduce((sum, item) => sum + item.value, 0);
      const radius = 47;
      const circumference = 2 * Math.PI * radius;
      const ns = "http://www.w3.org/2000/svg";
      const track = document.createElementNS(ns, "circle");
      track.setAttribute("class", "donut-track");
      track.setAttribute("cx", "60");
      track.setAttribute("cy", "60");
      track.setAttribute("r", String(radius));
      donutSvg.appendChild(track);
      let offset = 0;
      segments.forEach((segment) => {
        const circle = document.createElementNS(ns, "circle");
        const length = (segment.value / total) * circumference;
        circle.setAttribute("class", "donut-seg");
        circle.setAttribute("cx", "60");
        circle.setAttribute("cy", "60");
        circle.setAttribute("r", String(radius));
        circle.setAttribute("stroke", segment.color);
        circle.setAttribute("stroke-dasharray", `${length} ${circumference - length}`);
        circle.setAttribute("stroke-dashoffset", String(-offset));
        circle.dataset.statusFilter = segment.key;
        circle.setAttribute("role", "button");
        circle.setAttribute("tabindex", "0");
        circle.setAttribute("aria-label", `筛选${statusLabels[segment.key]}任务`);
        circle.addEventListener("click", () => setStatus(segment.key));
        circle.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setStatus(segment.key);
          }
        });
        donutSvg.appendChild(circle);
        offset += length;
      });
    }

    /* task rows / drawer */

    const drawerTitle = $("#drawerTitle");
    const drawerStatus = $("#drawerStatus");
    const drawerMinutes = $("#drawerMinutes");
    const drawerStage = $("#drawerStage");
    const drawerDate = $("#drawerDate");

    function rowStatusLabel(status) {
      return statusLabels[status] || "待开始";
    }

    function openTask(row) {
      activeDrawerRow = row;
      if (drawerTitle) drawerTitle.textContent = row.querySelector(".task-name")?.textContent || "任务详情";
      if (drawerStatus) drawerStatus.textContent = rowStatusLabel(row.dataset.status);
      if (drawerMinutes) drawerMinutes.textContent = row.querySelector(".task-minutes")?.textContent || "—";
      if (drawerStage) drawerStage.textContent = row.querySelector(".task-stage")?.textContent || "—";
      if (drawerDate) drawerDate.textContent = row.dataset.date || "—";
      openDrawer();
    }

    $$("[data-open-task]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".task-row");
        if (row) openTask(row);
      });
    });

    function completeRow(row) {
      const previous = {
        html: row.innerHTML,
        status: row.dataset.status,
        className: row.className,
      };
      row.dataset.status = "done";
      row.classList.add("is-done");
      const icon = row.querySelector(".task-status-icon");
      if (icon) {
        icon.className = "task-status-icon task-status-icon--done";
        icon.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#check"></use></svg>';
      }
      const status = row.querySelector(".task-status-text");
      if (status) status.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#check"></use></svg>已完成';
      applyFilters();
      showToast("任务已完成，任务明细和趋势已更新", {
        onUndo: () => {
          row.innerHTML = previous.html;
          row.dataset.status = previous.status;
          row.className = previous.className;
          applyFilters();
          hideToast();
        },
      });
    }

    const drawerComplete = $("#drawerComplete");
    if (drawerComplete) {
      drawerComplete.addEventListener("click", () => {
        if (!activeDrawerRow) return;
        const row = activeDrawerRow;
        closeDrawer();
        completeRow(row);
      });
    }

    const drawerPostpone = $("#drawerPostpone");
    if (drawerPostpone) {
      drawerPostpone.addEventListener("click", () => {
        if (!activeDrawerRow) return;
        activeDrawerRow.dataset.status = "carry";
        activeDrawerRow.dataset.risk = "false";
        const status = activeDrawerRow.querySelector(".task-status-text");
        if (status) status.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#refresh"></use></svg>顺延';
        const icon = activeDrawerRow.querySelector(".task-status-icon");
        if (icon) {
          icon.className = "task-status-icon task-status-icon--carry";
          icon.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#refresh"></use></svg>';
        }
        closeDrawer();
        applyFilters();
        showToast("已顺延到明天，路线预测已重新计算");
      });
    }

    renderChart();
    applyFilters();
  }

  /* ---------- today page ---------- */

  const todayList = $("#todayTaskList");
  if (todayList) {
    const rows = $$(".today-task-row", todayList);
    const filterButtons = $$("[data-today-filter]");
    let activeFilter = "all";

    function updateCounts() {
      const done = rows.filter((row) => row.classList.contains("is-done")).length;
      const total = rows.length;
      const percent = Math.round((done / total) * 100);
      const percentNode = $("#todayPercent");
      if (percentNode) percentNode.innerHTML = `${percent}%<span>${done} / ${total} 项</span>`;
      const track = $("#todayProgressTrack");
      if (track) track.firstElementChild.style.width = `${percent}%`;
      const todoCount = $("#todoCount");
      if (todoCount) todoCount.textContent = String(total - done);
      const doneCount = $("#doneCount");
      if (doneCount) doneCount.textContent = String(done);
      const summaryValue = $(".today-summary-row b");
      if (summaryValue) summaryValue.innerHTML = `${done} / ${total} 项 <small>· ${percent}%</small>`;
      const heroDone = $(".today-progress-note");
      if (heroDone && done === total) heroDone.textContent = "今天的任务已完成，可以结束今天。";
    }

    function applyTodayFilter() {
      let visible = 0;
      rows.forEach((row) => {
        const done = row.classList.contains("is-done");
        const show = activeFilter === "all" || (activeFilter === "done" && done) || (activeFilter === "todo" && !done);
        row.style.display = show ? "" : "none";
        if (show) visible += 1;
      });
      const empty = $("#todayEmpty");
      if (empty) empty.classList.toggle("is-visible", visible === 0);
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.todayFilter || "all";
        filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        applyTodayFilter();
      });
    });
    const emptyClear = $("#todayEmptyClear");
    if (emptyClear) {
      emptyClear.addEventListener("click", () => {
        activeFilter = "all";
        filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.todayFilter === "all")));
        applyTodayFilter();
      });
    }

    function setDone(row, done) {
      row.classList.toggle("is-done", done);
      const check = row.querySelector(".today-check");
      if (check) check.setAttribute("aria-checked", String(done));
      updateCounts();
      applyTodayFilter();
    }

    function completeTodayRow(row) {
      setDone(row, true);
      showToast("已完成，今日进度已更新", {
        onUndo: () => {
          setDone(row, false);
          hideToast();
        },
      });
    }

    function undoTodayRow(row) {
      setDone(row, false);
      showToast("已恢复为待完成");
    }

    rows.forEach((row) => {
      const check = row.querySelector(".today-check");
      if (check) {
        check.addEventListener("click", () => {
          if (row.classList.contains("is-done")) undoTodayRow(row);
          else completeTodayRow(row);
        });
      }
      const undo = row.querySelector("[data-undo]");
      if (undo) undo.addEventListener("click", () => undoTodayRow(row));
    });

    const startNext = $("#startNext");
    if (startNext) {
      startNext.addEventListener("click", () => {
        const next = rows.find((row) => !row.classList.contains("is-done"));
        if (!next) {
          showToast("今天的任务已经全部完成");
          return;
        }
        rows.forEach((row) => row.classList.remove("is-focused"));
        next.classList.add("is-focused");
        next.scrollIntoView({ behavior: "smooth", block: "center" });
        const label = $("#startNextText");
        if (label) {
          const minutes = next.querySelector(".today-task-minutes")?.textContent || "";
          label.textContent = `计时中 · ${minutes.replace(" 分钟", "")} 分钟`;
        }
        startNext.classList.add("is-loading");
        startNext.setAttribute("aria-busy", "true");
        window.setTimeout(() => {
          startNext.classList.remove("is-loading");
          startNext.removeAttribute("aria-busy");
        }, 900);
        showToast("已开始下一步任务，完成后回来记录");
      });
    }

    $$("[data-task-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = todayList.querySelector(`[data-id="${button.dataset.taskJump}"]`);
        if (!row) return;
        row.classList.remove("is-highlighted");
        void row.offsetWidth;
        row.classList.add("is-highlighted");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        const check = row.querySelector(".today-check");
        if (check) check.focus();
      });
    });

    updateCounts();
    applyTodayFilter();
  }

  /* ---------- shared Today drawer / modal ---------- */

  if (todayList) {
    const title = $("#drawerTitle");
    const status = $("#drawerStatus");
    const minutes = $("#drawerMinutes");
    const stage = $("#drawerStage");
    const source = $("#drawerSource");
    let activeRow = null;

    function openTodayTask(row) {
      activeRow = row;
      if (title) title.textContent = row.querySelector(".today-task-title")?.textContent || "任务详情";
      if (status) status.textContent = row.classList.contains("is-done") ? "已完成" : "待完成";
      if (minutes) minutes.textContent = row.querySelector(".today-task-minutes")?.textContent || "—";
      if (stage) stage.textContent = row.querySelector(".today-task-meta span")?.textContent || "—";
      if (source) {
        const spans = row.querySelectorAll(".today-task-meta span");
        source.textContent = spans[2]?.textContent || "今日计划";
      }
      openDrawer();
    }

    $$("[data-open-task]").forEach((button) => {
      button.addEventListener("click", () => {
        const row =
          button.closest(".today-task-row") ||
          todayList.querySelector(`[data-id="${button.dataset.openTask}"]`);
        if (row) openTodayTask(row);
      });
    });

    const complete = $("#drawerComplete");
    if (complete) {
      complete.addEventListener("click", () => {
        if (!activeRow) return;
        const row = activeRow;
        closeDrawer();
        if (!row.classList.contains("is-done")) {
          const check = row.querySelector(".today-check");
          if (check) check.click();
        }
      });
    }

    const postpone = $("#drawerPostpone");
    if (postpone) {
      postpone.addEventListener("click", () => {
        if (!activeRow) return;
        closeDrawer();
        showToast("已顺延到明天，今日容量释放 70 分钟");
      });
    }
  }

  /* hash scroll for route links */

  if (window.location.hash === "#route") {
    const route = $("#route");
    if (route) window.setTimeout(() => route.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }
})();
