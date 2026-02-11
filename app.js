const STORAGE_KEY = "coffeecord-brews";

const form = document.getElementById("brew-form");
const list = document.getElementById("brew-list");
const stats = document.getElementById("stats");
const clearAllButton = document.getElementById("clear-all");
const template = document.getElementById("brew-item-template");

const beanInput = document.getElementById("bean");
const methodInput = document.getElementById("method");
const ratioInput = document.getElementById("ratio");
const scoreInput = document.getElementById("score");
const notesInput = document.getElementById("notes");

const formTitle = document.getElementById("form-title");
const formMode = document.getElementById("form-mode");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");

const filterMethod = document.getElementById("filter-method");
const filterMinScore = document.getElementById("filter-min-score");
const searchKeyword = document.getElementById("search-keyword");
const sortBy = document.getElementById("sort-by");
const resetFiltersButton = document.getElementById("reset-filters");

const exportDataButton = document.getElementById("export-data");
const importMode = document.getElementById("import-mode");
const importFile = document.getElementById("import-file");
const importMessage = document.getElementById("import-message");

let brews = normalizeBrews(loadBrews()).valid;
let editingId = null;
setEditMode(null);
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const bean = beanInput.value.trim();
  const method = methodInput.value;
  const ratio = ratioInput.value.trim();
  const score = Number(scoreInput.value);
  const notes = notesInput.value.trim();

  if (editingId) {
    const targetIndex = brews.findIndex((item) => item.id === editingId);
    if (targetIndex >= 0) {
      brews[targetIndex] = {
        ...brews[targetIndex],
        bean,
        method,
        ratio,
        score,
        notes,
      };
    }
    setImportMessage("记录已更新。", "success");
  } else {
    const record = {
      id: createId(),
      bean,
      method,
      ratio,
      score,
      notes,
      createdAt: new Date().toISOString(),
    };
    brews.unshift(record);
  }

  saveBrews();
  render();
  clearFormAndExitEditMode();
});

cancelEditButton.addEventListener("click", () => {
  clearFormAndExitEditMode();
  setImportMessage("已取消编辑。", "success");
});

clearAllButton.addEventListener("click", () => {
  if (brews.length === 0) {
    return;
  }

  const confirmed = window.confirm("确认删除所有冲煮记录吗？");
  if (!confirmed) {
    return;
  }

  brews = [];
  saveBrews();
  render();
  clearFormAndExitEditMode();
});

[filterMethod, filterMinScore, sortBy].forEach((element) => {
  element.addEventListener("change", render);
});
searchKeyword.addEventListener("input", render);

resetFiltersButton.addEventListener("click", () => {
  filterMethod.value = "all";
  filterMinScore.value = "0";
  sortBy.value = "createdAt-desc";
  searchKeyword.value = "";
  render();
});

exportDataButton.addEventListener("click", exportBrewsToFile);
importFile.addEventListener("change", handleImportFile);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `brew-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setEditMode(id) {
  editingId = id;

  if (!editingId) {
    formTitle.textContent = "新增冲煮记录";
    formMode.textContent = "";
    submitButton.textContent = "保存记录";
    cancelEditButton.hidden = true;
    return;
  }

  formTitle.textContent = "编辑冲煮记录";
  formMode.textContent = "正在编辑一条历史记录";
  submitButton.textContent = "保存修改";
  cancelEditButton.hidden = false;
}

function beginEdit(id) {
  const target = brews.find((item) => item.id === id);
  if (!target) {
    return;
  }

  beanInput.value = target.bean;
  methodInput.value = target.method;
  ratioInput.value = target.ratio;
  scoreInput.value = String(target.score);
  notesInput.value = target.notes;

  setEditMode(id);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearFormAndExitEditMode() {
  form.reset();
  setEditMode(null);
}

function loadBrews() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBrews() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(brews));
}

function removeBrew(id) {
  brews = brews.filter((item) => item.id !== id);
  if (editingId === id) {
    clearFormAndExitEditMode();
  }
  saveBrews();
  render();
}

function exportBrewsToFile() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    brews,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  link.href = url;
  link.download = `coffeecord-export-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);

  setImportMessage(`已导出 ${brews.length} 条记录。`, "success");
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const source = Array.isArray(parsed) ? parsed : parsed?.brews;

    if (!Array.isArray(source)) {
      setImportMessage("导入失败：文件中未找到可识别的记录数组。", "error");
      event.target.value = "";
      return;
    }

    const normalized = normalizeBrews(source);
    if (normalized.valid.length === 0) {
      setImportMessage("导入失败：没有有效记录。", "error");
      event.target.value = "";
      return;
    }

    const mode = importMode.value;
    if (mode === "replace") {
      brews = normalized.valid;
    } else {
      const map = new Map();
      [...brews, ...normalized.valid].forEach((item) => {
        map.set(item.id, item);
      });
      brews = Array.from(map.values());
    }

    saveBrews();
    render();

    const skippedText = normalized.invalidCount > 0 ? `，忽略 ${normalized.invalidCount} 条无效记录` : "";
    setImportMessage(
      `导入完成：新增/写入 ${normalized.valid.length} 条${skippedText}。`,
      "success"
    );
  } catch {
    setImportMessage("导入失败：JSON 格式不正确。", "error");
  }

  event.target.value = "";
}

function setImportMessage(message, type) {
  importMessage.textContent = message;
  importMessage.dataset.type = type;
}

function normalizeBrews(input) {
  const valid = [];
  let invalidCount = 0;

  input.forEach((item) => {
    if (!item || typeof item !== "object") {
      invalidCount += 1;
      return;
    }

    const bean = String(item.bean ?? "").trim();
    const method = String(item.method ?? "").trim();
    const ratio = String(item.ratio ?? "").trim();
    const score = Number(item.score);
    const notes = String(item.notes ?? "").trim();

    if (!bean || !method || !ratio || Number.isNaN(score) || score < 1 || score > 10) {
      invalidCount += 1;
      return;
    }

    const createdAtValue = Date.parse(item.createdAt);
    const createdAt = Number.isNaN(createdAtValue)
      ? new Date().toISOString()
      : new Date(createdAtValue).toISOString();

    const id = String(item.id ?? "").trim() || createId();

    valid.push({
      id,
      bean: bean.slice(0, 30),
      method,
      ratio,
      score,
      notes: notes.slice(0, 120),
      createdAt,
    });
  });

  return { valid, invalidCount };
}

function getVisibleBrews() {
  const methodValue = filterMethod.value;
  const minScoreValue = Number(filterMinScore.value);
  const keywordValue = searchKeyword.value.trim().toLowerCase();

  const filtered = brews.filter((item) => {
    const matchMethod = methodValue === "all" || item.method === methodValue;
    const matchScore = Number(item.score) >= minScoreValue;
    const keywordTarget = `${item.bean} ${item.notes}`.toLowerCase();
    const matchKeyword = keywordValue === "" || keywordTarget.includes(keywordValue);
    return matchMethod && matchScore && matchKeyword;
  });

  const [key, direction] = sortBy.value.split("-");
  return filtered.slice().sort((a, b) => {
    const left = key === "score" ? Number(a.score) : Date.parse(a.createdAt);
    const right = key === "score" ? Number(b.score) : Date.parse(b.createdAt);
    return direction === "asc" ? left - right : right - left;
  });
}

function render() {
  list.innerHTML = "";

  if (brews.length === 0) {
    stats.textContent = "暂无数据";
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "还没有记录，先添加一杯吧！";
    list.appendChild(empty);
    return;
  }

  const average = (
    brews.reduce((sum, item) => sum + Number(item.score || 0), 0) / brews.length
  ).toFixed(1);

  const visibleBrews = getVisibleBrews();
  stats.textContent = `共 ${brews.length} 条，当前显示 ${visibleBrews.length} 条，平均评分 ${average}`;

  if (visibleBrews.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "没有符合筛选条件的记录。";
    list.appendChild(empty);
    return;
  }

  visibleBrews.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const root = fragment.querySelector(".brew-item");

    fragment.querySelector(".bean").textContent = item.bean;
    fragment.querySelector(".method").textContent = item.method;
    fragment.querySelector(".ratio").textContent = `粉水比 ${item.ratio}`;
    fragment.querySelector(".score").textContent = `${item.score} 分`;
    fragment.querySelector(".notes").textContent = item.notes || "无备注";

    const date = new Date(item.createdAt);
    fragment.querySelector(".time").textContent = Number.isNaN(date.valueOf())
      ? "未知时间"
      : date.toLocaleString();

    fragment.querySelector(".edit").addEventListener("click", () => beginEdit(item.id));
    fragment.querySelector(".delete").addEventListener("click", () => removeBrew(item.id));
    if (editingId === item.id) {
      root.classList.add("editing");
    }
    list.appendChild(root);
  });
}
