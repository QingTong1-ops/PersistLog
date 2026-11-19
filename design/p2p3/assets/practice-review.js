const REVIEW_JOB_KEY = "persistlog-prototype-review-job-v1";
const REVIEW_DRAFT_KEY = "persistlog-prototype-code-draft-v1";

const practiceCode = {
  lru: `from collections import OrderedDict
from time import monotonic

class LRUCache:
    def __init__(self, capacity: int, ttl: float):
        self.capacity = capacity
        self.ttl = ttl
        self.entries = OrderedDict()

    def get(self, key: str):
        entry = self.entries.get(key)
        if entry is None:
            return None
        return entry[0]

    def put(self, key: str, value: int):
        self.entries[key] = (value, monotonic() + self.ttl)
        self.entries.move_to_end(key)
        if len(self.entries) > self.capacity:
            self.entries.popitem(last=False)`,
  tree: `import java.util.*;

class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        if (root == null) return result;
        Queue<TreeNode> queue = new ArrayDeque<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            int size = queue.size();
            List<Integer> level = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();
                level.add(node.val);
                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }
            result.add(level);
        }
        return result;
    }
}`,
  twoSum: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        return []`,
  thread: `import java.util.concurrent.*;

class NotificationWorker {
    private final ExecutorService executor =
        Executors.newFixedThreadPool(8);

    public void send(Notification event) {
        executor.execute(() -> deliver(event));
    }

    private void deliver(Notification event) {
        client.send(event);
    }
}`,
  order: `class OrderService {
    private final OrderRepository repository;

    public Order create(CreateOrderCommand command) {
        Order order = new Order(
            command.requestId(),
            command.userId(),
            command.amount()
        );
        return repository.save(order);
    }
}`,
};

const practiceSubmissions = [
  {
    id: "05", title: "为订单服务补充幂等键校验", date: "11月15日 09:40", fileName: "OrderService.java", language: "Java 17", source: "学习路线 · 项目实践", status: "pending", code: practiceCode.order,
    testStatus: "provided", passed: 2, total: 3, failedTest: "重复请求仍会创建第二条订单。", timeComplexity: "平均 O(1)", spaceComplexity: "O(1)", notes: "使用请求号作为幂等键，希望检查并发写入与失败恢复。", attempts: [],
  },
  {
    id: "04", title: "实现支持过期时间的 LRU 缓存", date: "11月14日 10:26", fileName: "solution.py", language: "Python 3.11", source: "学习路线 · 第 3 阶段", status: "succeeded", code: practiceCode.lru,
    testStatus: "provided", passed: 3, total: 4, failedTest: "过期键再次读取时，仍返回旧值。", timeComplexity: "平均 O(1)", spaceComplexity: "O(capacity)", notes: "使用 OrderedDict 维护访问顺序，希望重点检查边界与过期处理。",
    score: 76, grade: "B+", confidence: 0.82, risk: "中",
    attempts: [
      { number: 1, status: "failed", date: "11月14日 10:20", detail: "服务暂时不可用 · 提交已保留" },
      { number: 2, status: "succeeded", date: "11月14日 10:26", detail: "6 秒 · 静态评审示例" },
    ],
  },
  {
    id: "03", title: "二叉树层序遍历", date: "11月12日 16:18", fileName: "Solution.java", language: "Java 17", source: "学习路线 · 数据结构", status: "succeeded", code: practiceCode.tree,
    testStatus: "provided", passed: 6, total: 6, failedTest: "", timeComplexity: "O(n)", spaceComplexity: "O(w)", notes: "使用队列按层遍历，w 为最大层宽。", score: 88, grade: "A−", confidence: 0.9, risk: "低",
    attempts: [{ number: 1, status: "succeeded", date: "11月12日 16:18", detail: "静态评审示例" }],
  },
  {
    id: "02", title: "两数之和的边界处理", date: "11月10日 14:05", fileName: "solution.py", language: "Python 3.11", source: "学习路线 · 算法基础", status: "succeeded", code: practiceCode.twoSum,
    testStatus: "provided", passed: 5, total: 5, failedTest: "", timeComplexity: "O(n)", spaceComplexity: "O(n)", notes: "使用哈希表记录已经遍历的数字与下标。", score: 84, grade: "B+", confidence: 0.88, risk: "低",
    attempts: [{ number: 1, status: "succeeded", date: "11月10日 14:05", detail: "静态评审示例" }],
  },
  {
    id: "01", title: "线程池参数调优实验", date: "11月09日 11:30", fileName: "NotificationWorker.java", language: "Java 17", source: "学习路线 · 工程实践", status: "failed", code: practiceCode.thread,
    testStatus: "provided", passed: 3, total: 5, failedTest: "任务异常时调用方没有收到失败通知。", timeComplexity: "提交任务平均 O(1)", spaceComplexity: "与队列长度相关", notes: "希望检查队列上限、拒绝策略与资源释放。",
    attempts: [{ number: 1, status: "failed", date: "11月09日 11:30", detail: "评审服务暂时不可用 · 提交已保留" }],
  },
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function readReviewSession(key) {
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeReviewSession(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function formatReviewTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function reviewStatus(record) {
  const states = {
    pending: { label: "待评审", filter: "pending", tone: "tag--neutral" },
    reviewing: { label: "评审中", filter: "pending", tone: "" },
    succeeded: { label: `评审完成 · 风险${record.risk || "中"}`, filter: "succeeded", tone: "tag--good" },
    insufficient: { label: "证据不足 · 暂不评分", filter: "insufficient", tone: "tag--warning" },
    failed: { label: "评审失败 · 提交已保留", filter: "failed", tone: "tag--risk" },
  };
  return states[record.status] || states.pending;
}

function getReviewResult(record) {
  const isPrimaryExample = record.id === "04" || record.id === "05" || record.origin === "local";
  const untested = record.testStatus === "untested";
  const unscored = untested || (record.status !== "succeeded" && record.status !== "insufficient");
  return {
    score: unscored ? null : isPrimaryExample ? 76 : (record.score ?? null),
    grade: unscored ? "—" : isPrimaryExample ? "B+" : (record.grade ?? "—"),
    confidence: unscored ? null : isPrimaryExample ? 0.82 : (record.confidence ?? null),
    risk: record.risk || "中",
    dimensions: [
      { label: untested ? "正确性 · 未评估" : `正确性风险 · ${record.risk || "中"}`, value: untested ? null : isPrimaryExample ? 62 : record.id === "03" ? 92 : 88 },
      { label: "复杂度", value: isPrimaryExample ? 80 : record.id === "03" ? 88 : 90 },
      { label: "代码质量", value: isPrimaryExample ? 74 : record.id === "03" ? 86 : 82 },
      { label: "测试与验证", value: isPrimaryExample ? 60 : 100 },
      { label: "表达与复盘", value: isPrimaryExample ? 70 : record.id === "03" ? 82 : 76 },
    ],
  };
}

function getReviewFinding(record) {
  const lines = record.code.split("\n");
  const locate = (needle) => Math.max(1, lines.findIndex((line) => line.includes(needle)) + 1);
  if (record.code.includes("return entry[0]")) {
    return {
      line: locate("return entry[0]"), excerpt: "return entry[0]",
      issue: "读取时没有判断过期时间，可能返回已失效的值。",
      advice: "先验证 entry 的过期时间，再决定返回、删除或更新访问顺序。写入时保存了过期时间，但读取路径尚未使用它。",
      improvements: [
        { title: "在 get 中检查过期时间", detail: "过期时移除该键并返回空值，避免读取已失效数据。", verify: "增加已过期键的自测。", line: locate("return entry[0]") },
        { title: "读取命中后更新访问顺序", detail: "命中后调用 move_to_end，保持 LRU 的淘汰顺序。", verify: "连续读取两个键，再验证淘汰顺序。" },
        { title: "补充容量边界测试", detail: "覆盖空缓存、重复键与容量为 0 的输入。", verify: "记录每个边界的预期与实际结果。" },
      ],
      followups: ["命中后需要更新访问顺序吗？如何验证？", "过期键应该立即删除，还是等待下次写入清理？为什么？"],
    };
  }
  if (record.code.includes("queue.poll()")) {
    return {
      line: locate("if (root == null)"), excerpt: "if (root == null) return result;",
      issue: "已处理空树；还需要把边界覆盖与队列空间说明对应起来。",
      advice: "保留当前按层处理队列的结构，用不同形状的树验证层序和空间复杂度。",
      improvements: [
        { title: "保留空树与单节点测试", detail: "确保初始边界不被后续修改破坏。", verify: "分别传入 null 与单节点树。", line: locate("if (root == null)") },
        { title: "覆盖不平衡树", detail: "验证只有左子树或右子树时的层序结果。", verify: "比较每一层的节点顺序。" },
        { title: "补充队列空间说明", detail: "说明最大层宽如何影响额外空间。", verify: "比较满二叉树与链式树的空间差异。" },
      ],
      followups: ["为什么每轮要先记录队列长度？", "最坏情况下，队列中会保留多少节点？"],
    };
  }
  if (record.code.includes("seen[num]")) {
    return {
      line: locate("seen[num]"), excerpt: "seen[num] = i",
      issue: "先查询再写入避免了同一元素重复使用；无解时的返回约定需要明确。",
      advice: "保留哈希表查找路径，并补充重复数字和无解输入的契约。",
      improvements: [
        { title: "验证重复数字", detail: "确认同一个下标不会被重复使用。", verify: "使用 [3, 2, 4] 与目标 6。", line: locate("seen[num]") },
        { title: "明确无解时的行为", detail: "说明返回空数组还是抛出异常，并与调用方约定一致。", verify: "添加不存在答案的用例。" },
        { title: "检查重复解的处理", detail: "说明存在多组答案时返回哪一组。", verify: "记录一组多解输入的预期结果。" },
      ],
      followups: ["为什么不能先把所有数字都放入哈希表？", "存在多组答案时，当前实现返回哪一组？"],
    };
  }
  if (record.code.includes("executor.execute")) {
    return {
      line: locate("executor.execute"), excerpt: "executor.execute(() -> deliver(event));",
      issue: "任务提交之外，还需要检查异常传播、队列上限与线程池关闭路径。",
      advice: "根据调用方能承受的背压选择队列和拒绝策略，并明确资源释放责任。",
      improvements: [
        { title: "补充关闭策略", detail: "说明谁来关闭线程池以及如何处理未完成任务。", verify: "验证关闭后的提交行为和退出过程。", line: locate("executor.execute") },
        { title: "明确队列与拒绝策略", detail: "避免无界队列掩盖容量问题。", verify: "模拟持续提交并记录拒绝结果。" },
        { title: "处理异步任务异常", detail: "定义失败通知、重试和补偿边界。", verify: "注入一次发送异常并检查调用方结果。" },
      ],
      followups: ["队列满且达到最大线程数后，调用方会发生什么？", "关闭线程池时，尚未执行的任务应该怎么办？"],
    };
  }
  if (record.code.includes("repository.save(order)")) {
    return {
      line: locate("repository.save(order)"), excerpt: "return repository.save(order);",
      issue: "创建订单前构造了幂等标识，但这里还需要验证唯一约束与重复请求的处理。",
      advice: "让数据库唯一约束承担最终防重，并明确重复请求如何获得第一次的结果。",
      improvements: [
        { title: "验证幂等键唯一约束", detail: "不能只依赖应用层先查后写来防止并发重复。", verify: "同时提交两个相同请求号，只应创建一个订单。", line: locate("repository.save(order)") },
        { title: "处理唯一约束冲突", detail: "重复请求应返回第一次的结果或可查询的状态。", verify: "捕获冲突并验证返回的订单一致。" },
        { title: "补充失败恢复路径", detail: "区分超时、已创建但未响应和真正失败。", verify: "模拟保存成功后的响应超时。" },
      ],
      followups: ["为什么应用层先查后写仍可能创建重复订单？", "请求超时后，客户端如何安全地查询第一次的结果？"],
    };
  }
  const line = Math.max(1, lines.findIndex((item) => item.trim()) + 1);
  return {
    line, excerpt: lines[line - 1].trim(),
    issue: "这里展示代码证据的定位方式；真实问题与评分需要由 Agent 返回。",
    advice: "真实实现应把结论关联到本次代码的文件、行号和片段，不使用与代码无关的通用建议。",
    improvements: [
      { title: "核验代码证据", detail: "确认每条问题都能追溯到本次提交。", verify: "点击证据检查对应代码行。", line },
      { title: "对照自测与静态风险", detail: "自测是用户提供的证据，不是系统运行结论。", verify: "记录失败输入、预期与实际结果。" },
      { title: "保留修改与复评记录", detail: "修改后创建新提交，让前后代码与结果可比较。", verify: "从历史详情检查前后版本。" },
    ],
    followups: ["这段代码最关键的边界条件是什么？", "你会用哪个自测来验证最重要的修改？"],
  };
}

function getSubmission(id) {
  const job = readReviewSession(REVIEW_JOB_KEY);
  if (job && job.id === id) return job;
  return practiceSubmissions.find((record) => record.id === id) || null;
}

function getHistoryRecords() {
  const job = readReviewSession(REVIEW_JOB_KEY);
  const records = practiceSubmissions.map((record) => job && job.id === record.id ? job : record);
  if (job && job.id === "06") records.unshift(job);
  return records;
}

function reviewUrl(id) {
  return `practice-review.html?submission=${encodeURIComponent(id)}`;
}

function renderHistoryRow(record, currentId) {
  const state = reviewStatus(record);
  const result = getReviewResult(record);
  const attempts = record.attempts || [];
  const test = record.testStatus === "untested" ? "未提供自测" : record.status === "failed" ? "查看失败原因" : record.status === "succeeded" ? `自测 ${record.passed} / ${record.total}` : "查看最新进度";
  return `<li><a class="list-row history-row ${record.id === currentId ? "is-current" : ""}" data-practice-status="${state.filter}" href="${reviewUrl(record.id)}" ${record.id === currentId ? 'aria-current="page"' : ""} aria-label="查看提交 #${escapeHtml(record.id)}：${escapeHtml(record.title)}，${state.label}"><div class="list-row__main"><span class="list-row__title">${escapeHtml(record.title)}</span><div class="list-row__meta"><span>提交 #${escapeHtml(record.id)}</span><span>${escapeHtml(record.startedAt ? formatReviewTime(record.startedAt) : record.date)}</span><span>${escapeHtml(record.language)}</span><span>${attempts.length ? `${attempts.length} 次评审` : "尚未开始评审"}</span><span class="tag ${state.tone}">${state.label}</span></div><span class="history-open">查看代码与评审详情 ${icon("arrow")}</span></div><div class="list-row__side"><strong>${result.score ?? "—"}</strong><small>${escapeHtml(test)}</small></div></a></li>`;
}

function renderHistoryList(id, currentId = "") {
  const list = document.getElementById(id);
  if (list) list.innerHTML = getHistoryRecords().map((record) => renderHistoryRow(record, currentId)).join("");
}

function initPracticeHistory() {
  const filter = document.getElementById("practice-filter");
  if (!filter) return;
  renderHistoryList("practice-history-list");
  function applyFilter() {
    let visible = 0;
    document.querySelectorAll("#practice-history-list [data-practice-status]").forEach((row) => {
      const show = filter.value === "all" || row.dataset.practiceStatus === filter.value;
      row.hidden = !show;
      if (show) visible += 1;
    });
    document.getElementById("practice-filter-count").textContent = `当前显示 ${visible} 条示例记录 · 点击查看详情`;
    document.getElementById("practice-empty").hidden = visible !== 0;
  }
  filter.addEventListener("change", applyFilter);
  applyFilter();
}

function startReview(record) {
  const previousAttempts = record.attempts || [];
  const number = Math.max(0, ...previousAttempts.map((attempt) => attempt.number || 0)) + 1;
  const startedAt = Date.now();
  const job = { ...record, origin: "local", status: "reviewing", startedAt, attempts: [...previousAttempts, { number, status: "reviewing", date: formatReviewTime(startedAt), detail: "异步评审演示进行中" }] };
  if (!writeReviewSession(REVIEW_JOB_KEY, job)) showToast("当前浏览器无法保存会话进度，请复制代码并允许会话存储后重试。");
  return job;
}

function editSubmission(id) {
  const record = getSubmission(id);
  if (!record) return;
  writeReviewSession(REVIEW_DRAFT_KEY, record);
  window.location.replace(`practice-detail.html?edit=${encodeURIComponent(id)}`);
}

function initPracticeForm() {
  const form = document.getElementById("practice-form");
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "review") {
    const id = params.get("state") === "failed" ? "01" : "04";
    window.location.replace(`${reviewUrl(id)}${params.get("state") === "insufficient" ? "&state=insufficient" : ""}`);
    return;
  }
  const draft = readReviewSession(REVIEW_DRAFT_KEY);
  const edit = params.get("edit");
  const initial = (edit && getSubmission(edit)) || (!edit && draft) || practiceSubmissions[1];
  const values = {
    "practice-title": initial.title,
    "practice-language": initial.language,
    "practice-difficulty": initial.difficulty || "中等",
    "practice-source": initial.source,
    "practice-tags": initial.tags || "缓存, 数据结构",
    "time-complexity": initial.timeComplexity,
    "space-complexity": initial.spaceComplexity,
    "practice-notes": initial.notes || "",
    "code-input": initial.code,
    "test-status": initial.testStatus,
    "test-passed": initial.passed ?? 0,
    "test-total": initial.total ?? 1,
    "test-failed": initial.failedTest || "",
  };
  Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value; });
  form.dataset.fileName = initial.fileName;
  document.getElementById("code-file-tag").textContent = initial.fileName;
  document.getElementById("draft-restored").hidden = !edit && !draft;
  function updateTestFields() {
    const untested = document.getElementById("test-status").value === "untested";
    document.querySelectorAll("[data-test-field]").forEach((field) => { field.disabled = untested; });
    document.getElementById("test-error").hidden = true;
  }
  function collectDraft() {
    const value = (id) => document.getElementById(id).value;
    const untested = value("test-status") === "untested";
    return {
      title: value("practice-title"), language: value("practice-language"), difficulty: value("practice-difficulty"), source: value("practice-source"), tags: value("practice-tags"),
      timeComplexity: value("time-complexity"), spaceComplexity: value("space-complexity"), notes: value("practice-notes"), code: value("code-input"), fileName: form.dataset.fileName,
      testStatus: value("test-status"), passed: untested ? null : Number(value("test-passed")), total: untested ? null : Number(value("test-total")), failedTest: untested ? "" : value("test-failed"),
    };
  }
  listen("test-status", "change", updateTestFields);
  listen("practice-language", "change", () => {
    const extensions = { "Python 3.11": "py", "Java 17": "java", JavaScript: "js", TypeScript: "ts" };
    form.dataset.fileName = `solution.${extensions[document.getElementById("practice-language").value]}`;
    document.getElementById("code-file-tag").textContent = form.dataset.fileName;
  });
  listen("code-file", "change", (event) => {
    const file = event.target.files[0];
    const message = document.getElementById("code-file-name");
    if (!file) return;
    if (file.size > 200 * 1024) {
      message.className = "field-error";
      message.textContent = "文件超过 200 KB，请缩小文件或直接粘贴代码；原代码已保留。";
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    message.className = "field__hint";
    message.textContent = `正在本地读取 ${file.name}，不会上传文件。`;
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      document.getElementById("code-input").value = reader.result;
      form.dataset.fileName = file.name;
      document.getElementById("code-file-tag").textContent = file.name;
      message.textContent = `已在本地读入 ${file.name}，共 ${reader.result.split("\n").length} 行。未上传或执行文件。`;
    });
    reader.addEventListener("error", () => {
      message.className = "field-error";
      message.textContent = "无法读取这个文本文件，请直接粘贴代码；原代码已保留。";
    });
    reader.readAsText(file);
  });
  listen("save-code-draft", "click", () => showToast(writeReviewSession(REVIEW_DRAFT_KEY, collectDraft()) ? "草稿仅保存在当前标签页会话中，未提交到服务器。" : "当前浏览器不允许会话存储，请保留本页或复制代码。"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const untested = document.getElementById("test-status").value === "untested";
    const error = document.getElementById("test-error");
    error.hidden = true;
    if (!form.reportValidity()) return;
    if (!untested && Number(document.getElementById("test-passed").value) > Number(document.getElementById("test-total").value)) {
      error.hidden = false;
      document.getElementById("test-passed").focus();
      return;
    }
    const record = { ...collectDraft(), id: "06", origin: "local", status: "pending", attempts: [] };
    const job = startReview(record);
    if (!readReviewSession(REVIEW_JOB_KEY)) return;
    writeReviewSession(REVIEW_DRAFT_KEY, collectDraft());
    const submit = document.getElementById("practice-submit");
    submit.disabled = true;
    submit.textContent = "提交成功，正在打开评审页…";
    window.location.replace(`${reviewUrl(job.id)}&created=1`);
  });
  updateTestFields();
}

function renderReviewCode(record) {
  const code = document.getElementById("review-code");
  const lines = record.code.split("\n");
  code.innerHTML = lines.map((line, index) => `<span class="code-line" data-line="${index + 1}">${escapeHtml(line) || " "}</span>`).join("");
  code.setAttribute("aria-label", `${record.fileName}，共 ${lines.length} 行，只读代码快照`);
  document.getElementById("review-code-meta").textContent = `${record.fileName} · ${lines.length} 行 · 只读快照 · 由提交内容生成`;
  const meta = document.getElementById("review-test-meta");
  meta.replaceChildren();
  const values = [record.testStatus === "untested" ? "未提供自测" : `用户自测 ${record.passed} / ${record.total}`, `时间复杂度 ${record.timeComplexity}`, `空间复杂度 ${record.spaceComplexity}`];
  values.forEach((value) => {
    const span = document.createElement("span");
    span.textContent = value;
    meta.append(span);
  });
}

function renderReviewTrace(record, phase) {
  const lines = record.code.split("\n").length;
  const steps = [
    { title: "接收提交与上下文", detail: `${record.fileName} · ${record.language} · 已保存代码、自测和复杂度说明` },
    { title: "读取代码快照", detail: `${lines} 行代码 · 按本次提交版本读取，不执行代码` },
    { title: "静态分析与自测对照", detail: record.testStatus === "untested" ? "未提供自测；只整理静态风险，不给正确性分" : `对照用户填写的 ${record.passed} / ${record.total} 项自测，不将其当作系统判题` },
    { title: "整理评分与证据", detail: "汇总维度、扣分依据、改进方向和追问，并关联代码行号" },
  ];
  document.getElementById("review-trace").innerHTML = steps.map((step, index) => {
    const done = phase > index;
    const current = phase === index && record.status === "reviewing";
    const state = record.status === "failed" && index === 0 ? "失败" : done ? "已完成" : current ? "进行中" : "等待";
    return `<li class="trace-item ${done ? "is-done" : ""} ${current ? "is-current" : ""}"><span class="trace-index">0${index + 1}</span><div class="trace-copy"><strong>${step.title}</strong><p>${escapeHtml(step.detail)}</p></div><span class="trace-state">${state}</span></li>`;
  }).join("");
}

function renderReviewResults(record) {
  const state = record.status;
  document.getElementById("review-waiting").hidden = state !== "reviewing" && state !== "pending";
  document.getElementById("review-error").hidden = state !== "failed";
  const hasResult = state === "succeeded" || state === "insufficient";
  document.getElementById("review-result").hidden = !hasResult;
  document.getElementById("review-details").hidden = !hasResult;
  if (!hasResult) return;
  const result = getReviewResult(record);
  const finding = getReviewFinding(record);
  document.getElementById("review-score").innerHTML = result.score === null ? "—" : `${result.score}<small> / 100</small>`;
  document.getElementById("review-score-meta").innerHTML = `<span>等级 <strong>${result.grade}</strong></span><span>评审置信度 <strong class="num">${result.confidence ?? "—"}</strong></span><span>静态风险 <strong class="text-warning">${result.risk}</strong></span><span>用户自测 <strong class="num">${record.testStatus === "untested" ? "未提供" : `${record.passed} / ${record.total}`}</strong></span>`;
  document.getElementById("review-insufficient").hidden = state !== "insufficient";
  document.getElementById("review-rubric").innerHTML = result.dimensions.map((dimension) => `<div><div class="rubric__head"><span>${dimension.label}</span><strong>${dimension.value === null ? "—" : `${dimension.value} / 100`}</strong></div><div class="progress ${dimension.value === null ? "progress--muted" : ""}" ${dimension.value === null ? 'aria-label="未评估"' : ""}><span style="width:${dimension.value || 0}%"></span></div></div>`).join("");
  document.getElementById("review-finding").innerHTML = `<button class="evidence-item" type="button" data-evidence-line="${finding.line}"><span class="evidence-item__locator">${escapeHtml(record.fileName)} : ${finding.line}</span><span class="evidence-item__issue">${escapeHtml(finding.issue)}</span><code>${escapeHtml(finding.excerpt)}</code><span class="history-open">定位代码 ${icon("arrow")}</span></button><p class="review-reason"><strong>建议：</strong>${escapeHtml(finding.advice)}</p>`;
  document.getElementById("review-improvements").innerHTML = finding.improvements.map((item) => `<li class="improvement-item"><label class="check-item"><input type="checkbox" data-improvement><span><strong class="check-item__title">${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></span></label><div class="improvement-verify"><span>验证：${escapeHtml(item.verify)}</span>${item.line ? `<button class="btn btn--sm" type="button" data-evidence-line="${item.line}">查看第 ${item.line} 行</button>` : ""}</div></li>`).join("");
  document.getElementById("review-followups").innerHTML = finding.followups.map((question) => `<li>${escapeHtml(question)}</li>`).join("");
  document.querySelectorAll("[data-evidence-line]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("#review-code .code-line").forEach((line) => line.classList.toggle("is-active", line.dataset.line === button.dataset.evidenceLine));
    document.querySelectorAll("[data-evidence-line]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelector(`#review-code .code-line[data-line="${button.dataset.evidenceLine}"]`)?.scrollIntoView({ block: "center", behavior: "auto" });
  }));
  const improvements = [...document.querySelectorAll("[data-improvement]")];
  function updateImprovements() {
    document.getElementById("improvement-count").textContent = `${improvements.filter((item) => item.checked).length} / ${improvements.length} 项已标记`;
    improvements.forEach((item) => item.closest(".check-item").classList.toggle("is-done", item.checked));
  }
  improvements.forEach((item) => item.addEventListener("change", updateImprovements));
  updateImprovements();
}

function renderReviewAttempts(record) {
  const attempts = record.attempts || [];
  const result = getReviewResult(record);
  document.getElementById("review-attempt-count").textContent = `${attempts.length} 次`;
  document.getElementById("review-attempts").innerHTML = attempts.length ? [...attempts].reverse().map((attempt, index) => {
    const status = index === 0 && record.status === "insufficient" ? "insufficient" : attempt.status;
    const label = status === "succeeded" ? `${result.score ?? "—"} 分` : status === "failed" ? "失败" : status === "insufficient" ? "未评分" : "评审中";
    return `<li class="attempt-item"><span class="trace-index">${String(attempt.number).padStart(2, "0")}</span><div class="attempt-copy"><strong>第 ${attempt.number} 次评审 ${index === 0 ? '<span class="tag">最新</span>' : ""}</strong><p>${escapeHtml(attempt.date || "当前会话")} · ${escapeHtml(attempt.detail || "评审状态已更新")}</p></div><span class="tag ${reviewStatus({ ...record, status }).tone}">${label}</span></li>`;
  }).join("") : '<li class="empty">尚未创建评审任务。</li>';
}

function initPracticeReview() {
  if (!document.getElementById("review-code")) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("submission") || "04";
  let current = getSubmission(id);
  renderHistoryList("review-history-list", id);
  if (!current) {
    document.getElementById("review-title").textContent = "未找到这条提交";
    document.getElementById("review-status-detail").textContent = "本地演示提交可能已被清除，请选择其他历史记录。";
    document.querySelector(".review-progress").hidden = true;
    document.querySelector(".review-workspace").hidden = true;
    document.getElementById("review-details").hidden = true;
    document.getElementById("review-results").hidden = true;
    document.getElementById("review-code").closest(".card").hidden = true;
    document.getElementById("review-attempts").closest(".card").hidden = true;
    document.getElementById("review-edit").hidden = true;
    document.getElementById("review-retry").hidden = true;
    return;
  }
  if (params.get("state") === "insufficient") {
    current = { ...current, status: "insufficient", testStatus: "untested", passed: null, total: null };
  } else if (params.get("state") === "failed") {
    current = { ...current, status: "failed" };
  } else if (current.status === "pending") {
    current = startReview(current);
  }
  if (params.has("state")) writeReviewSession(REVIEW_JOB_KEY, current);
  let timer = null;
  let previousState = "";
  let previousPhase = -1;
  function renderProgress() {
    current = getSubmission(id) || current;
    if (params.get("state") === "insufficient") current = { ...current, status: "insufficient", testStatus: "untested", passed: null, total: null };
    let phase = 4;
    let elapsed = 6500;
    if (current.status === "reviewing") {
      elapsed = Math.max(0, Date.now() - current.startedAt);
      phase = elapsed < 1200 ? 0 : elapsed < 2600 ? 1 : elapsed < 4600 ? 2 : elapsed < 6500 ? 3 : 4;
      if (phase === 4) {
        current.status = current.testStatus === "untested" ? "insufficient" : "succeeded";
        const latest = current.attempts[current.attempts.length - 1];
        latest.status = current.status;
        latest.detail = "6.5 秒 · 异步交互演示完成";
        writeReviewSession(REVIEW_JOB_KEY, current);
      }
    }
    const state = current.status;
    if (state === "failed") phase = -1;
    const status = reviewStatus(current);
    const progress = state === "reviewing" ? [8, 28, 62, 88, 100][phase] : state === "failed" ? 0 : 100;
    const stage = state === "reviewing" ? ["等待接收代码快照", "正在读取代码快照", "正在进行静态分析", "正在整理评分与证据", "评审结果已生成"][phase] : status.label;
    document.getElementById("review-state-badge").className = `tag ${status.tone}`;
    document.getElementById("review-state-badge").textContent = status.label;
    document.getElementById("review-stage-label").textContent = stage;
    document.getElementById("review-progress-bar").setAttribute("aria-valuenow", String(progress));
    document.getElementById("review-progress-value").style.width = `${progress}%`;
    document.getElementById("review-elapsed").textContent = state === "reviewing" ? `${Math.floor(elapsed / 1000)} 秒` : state === "failed" ? "未完成" : "已完成";
    document.getElementById("review-notice").className = `notice ${state === "succeeded" ? "notice--good" : state === "failed" ? "notice--error" : state === "insufficient" ? "notice--warning" : "notice--info"}`;
    document.getElementById("review-notice").textContent = state === "reviewing" ? "提交成功，正在评审。可以离开此页，稍后回来查看最新进度与结果。" : state === "succeeded" ? "最新评审已完成。代码与评分、扣分依据可并排对照，下方继续改进与复盘。" : state === "insufficient" ? "评审流程已结束，但缺少自测证据，正确性维度与总分暂不评定。" : "本次评审未完成。代码与说明仍保留，可通过重试追加一条评审记录。";
    document.getElementById("review-status-detail").textContent = `${current.fileName} · ${current.language} · 当前显示最新评审状态`;
    document.getElementById("review-last-updated").textContent = `最后更新 ${formatReviewTime(Date.now())} · 异步流程演示，未请求服务端`;
    document.getElementById("review-retry").disabled = state === "reviewing";
    document.getElementById("review-refresh").textContent = state === "reviewing" ? "刷新评审进度" : "刷新最新结果";
    if (previousState !== state) document.getElementById("review-process").open = state === "reviewing";
    if (previousState !== state || previousPhase !== phase) {
      document.getElementById("review-title").textContent = current.title;
      document.getElementById("review-submission-id").textContent = `提交 #${current.id}`;
      document.getElementById("review-subtitle").textContent = `${current.source} · ${current.startedAt ? formatReviewTime(current.startedAt) : current.date}`;
      document.getElementById("review-attempt-label").textContent = `第 ${Math.max(1, ...(current.attempts || []).map((attempt) => attempt.number || 0))} 次评审`;
      document.getElementById("review-attempts-title").textContent = "本次提交的评审记录";
      document.title = `${current.title} · 评审详情 · 恒序`;
      renderReviewCode(current);
      renderReviewTrace(current, phase);
      renderReviewResults(current);
      renderReviewAttempts(current);
      renderHistoryList("review-history-list", id);
      previousState = state;
      previousPhase = phase;
    }
    if (state === "reviewing" && !timer) timer = window.setInterval(renderProgress, 300);
    if (state !== "reviewing" && timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }
  listen("review-refresh", "click", () => { renderProgress(); showToast("已更新当前演示状态；真实接入时应读取服务端最新进度。"); });
  function retry() {
    current = startReview(getSubmission(id) || current);
    previousState = "";
    previousPhase = -1;
    renderProgress();
    showToast("已创建新的异步评审演示，旧记录仍保留。");
  }
  listen("review-retry", "click", retry);
  listen("review-error-retry", "click", retry);
  listen("review-edit", "click", () => editSubmission(id));
  listen("review-error-edit", "click", () => editSubmission(id));
  listen("followup-save", "click", () => showToast("回答仅用于当前页面演示，未保存到账户或生成错题。"));
  if (params.get("created") === "1") showToast("提交成功，异步评审演示已开始；代码未发送到任何服务。");
  renderProgress();
}

initPracticeHistory();
renderHistoryList("dashboard-history-list");
initPracticeForm();
initPracticeReview();
