const $ = (selector) => document.querySelector(selector);

const form = $("#historyForm");
const submitBtn = $("#submitBtn");
const loadingCard = $("#loadingCard");
const errorBox = $("#errorBox");
const resultShell = $("#resultShell");
const resultTitle = $("#resultTitle");
const resultSummary = $("#resultSummary");
const scoreValue = $("#scoreValue");
const tabs = $("#tabs");
const tabContent = $("#tabContent");
const historyToggle = $("#historyToggle");
const historyPanel = $("#historyPanel");
const historyList = $("#historyList");
const clearHistory = $("#clearHistory");
const fillExample = $("#fillExample");
const toast = $("#toast");

let currentResult = null;
let activeTab = "overview";

const examples = [
  {
    eventTitle: "Октябрьская революция",
    region: "Россия",
    period: "1917 год",
    change: "Революция не удалась, большевики потеряли влияние, а Временное правительство удержало власть."
  },
  {
    eventTitle: "Распад СССР",
    region: "СССР, Европа, мир",
    period: "1991 год",
    change: "СССР не распался, а стал обновлённой федерацией с общей армией, общей валютой и широкой автономией республик."
  },
  {
    eventTitle: "Вторая мировая война",
    region: "Европа",
    period: "1939 год",
    change: "Война не началась в 1939 году, потому что Германия столкнулась с внутренним военным заговором против руководства."
  }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(toText).join("\n\n");
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") return Object.values(value).map(toText).filter(Boolean).join("\n\n");
  return "";
}

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && toText(value)) return value;
  }
  return "";
}

function splitToBullets(text) {
  const clean = toText(text);
  if (!clean) return [];
  if (clean.includes("•")) {
    return clean.split("•").map((x) => x.trim()).filter(Boolean);
  }
  return clean.split(/[.!?]\s+/).map((x) => x.trim()).filter((x) => x.length > 10).slice(0, 5);
}

function normalizeResult(payload, input = {}) {
  let raw = payload?.result && typeof payload.result === "object" ? payload.result : payload;

  if (typeof raw === "string") {
    raw = {
      title: input.eventTitle || "Альтернативная история",
      shortSummary: raw,
      resultText: raw
    };
  }

  raw = raw || {};

  const after5 = pick(raw, ["after5Years", "fiveYears", "resultAfter5Years"]);
  const after20 = pick(raw, ["after20Years", "twentyYears", "resultAfter20Years"]);
  const after50 = pick(raw, ["after50Years", "fiftyYears", "resultAfter50Years"]);

  const result = {
    title: toText(pick(raw, ["title", "scenarioTitle", "name"])) || "Альтернативная история",
    shortSummary: toText(pick(raw, ["shortSummary", "summary", "resume"])) || "Сценарий построен.",
    realHistoryContext: toText(pick(raw, ["realHistoryContext", "context", "historicalContext"])),
    changedPoint: toText(pick(raw, ["changedPoint", "change", "mainChange"])) || input.change || "",
    firstConsequences: toText(pick(raw, ["firstConsequences", "immediateConsequences", "firstEffects"])),
    causeChain: toText(pick(raw, ["causeChain", "chainOfConsequences", "causeEffectChain", "consequencesChain"])),
    politics: toText(pick(raw, ["politics", "politicalConsequences", "politicalImpact"])),
    economy: toText(pick(raw, ["economy", "economicConsequences", "economicImpact"])),
    military: toText(pick(raw, ["military", "militaryConsequences", "warConsequences", "wars"])),
    technology: toText(pick(raw, ["technology", "technologyConsequences", "technologicalConsequences", "tech"])),
    culture: toText(pick(raw, ["culture", "culturalConsequences", "culturalImpact"])),
    society: toText(pick(raw, ["society", "socialConsequences", "socialImpact"])),
    bordersAndAlliances: toText(pick(raw, ["bordersAndAlliances", "alliances", "borders"])),
    ordinaryPeopleLife: toText(pick(raw, ["ordinaryPeopleLife", "peopleLife", "dailyLife"])),
    after5Years: toText(after5),
    after20Years: toText(after20),
    after50Years: toText(after50),
    modernWorldResult: toText(pick(raw, ["modernWorldResult", "modernWorld", "currentWorld"])),
    probabilityScore: Number(pick(raw, ["probabilityScore", "plausibility", "score"])) || 50,
    risks: toText(pick(raw, ["risks", "scenarioRisks", "weakPoints"])),
    sourcesNote: toText(pick(raw, ["sourcesNote", "assumptions", "note"])),
    videoScriptVersion: toText(pick(raw, ["videoScriptVersion", "youtubeVersion", "videoVersion"])),
    voiceoverVersion: toText(pick(raw, ["voiceoverVersion", "voiceVersion", "narration"])),
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    causeEffectMap: Array.isArray(raw.causeEffectMap) ? raw.causeEffectMap : []
  };

  result.probabilityScore = Math.max(1, Math.min(100, Math.round(result.probabilityScore)));

  if (!result.timeline.length) {
    result.timeline = [
      {
        year: "Старт",
        title: "Точка изменения",
        description: result.changedPoint || result.shortSummary,
        impactLevel: "высокий"
      }
    ];
  }

  if (!result.causeEffectMap.length) {
    result.causeEffectMap = [
      { branch: "Политика", items: splitToBullets(result.politics) },
      { branch: "Экономика", items: splitToBullets(result.economy) },
      { branch: "Войны", items: splitToBullets(result.military) },
      { branch: "Технологии", items: splitToBullets(result.technology) },
      { branch: "Культура", items: splitToBullets(result.culture) },
      { branch: "Общество", items: splitToBullets(result.society) }
    ].filter((branch) => branch.items.length);
  }

  return result;
}

function infoCard(title, text, highlight = false) {
  const safeText = toText(text);
  if (!safeText) return "";
  return `
    <article class="info-card ${highlight ? "highlight" : ""}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(safeText)}</p>
    </article>
  `;
}

function compactRows(items) {
  return `
    <div class="compact-list">
      ${items.filter((item) => toText(item.text)).map((item, index) => `
        <div class="compact-row">
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderOverview(result) {
  tabContent.innerHTML = `
    <div class="section-grid">
      ${infoCard("Реальный контекст", result.realHistoryContext)}
      ${infoCard("Что изменилось", result.changedPoint, true)}
      ${infoCard("Первые последствия", result.firstConsequences)}
      ${compactRows([
        { title: "Через 5 лет", text: result.after5Years },
        { title: "Через 20 лет", text: result.after20Years },
        { title: "Через 50 лет", text: result.after50Years },
        { title: "Современный мир", text: result.modernWorldResult }
      ])}
      ${infoCard("Главные риски", result.risks)}
    </div>
  `;
}

function renderAnalysis(result) {
  tabContent.innerHTML = `
    <div class="section-grid two">
      ${infoCard("Цепочка последствий", result.causeChain, true)}
      ${infoCard("Политика", result.politics)}
      ${infoCard("Экономика", result.economy)}
      ${infoCard("Войны", result.military)}
      ${infoCard("Технологии", result.technology)}
      ${infoCard("Культура", result.culture)}
      ${infoCard("Общество", result.society)}
      ${infoCard("Границы и союзы", result.bordersAndAlliances)}
      ${infoCard("Жизнь людей", result.ordinaryPeopleLife)}
    </div>
  `;
}

function renderTimeline(result) {
  const items = result.timeline || [];

  tabContent.innerHTML = `
    <div class="timeline">
      ${items.map((item) => `
        <article class="timeline-card">
          <div class="timeline-year">${escapeHtml(item.year || "")}</div>
          <div class="pill">влияние: ${escapeHtml(item.impactLevel || "средний")}</div>
          <h3>${escapeHtml(item.title || "Событие")}</h3>
          <p>${escapeHtml(item.description || "")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMap(result) {
  const branches = result.causeEffectMap || [];

  tabContent.innerHTML = `
    <div class="section-grid">
      <article class="map-card map-center">
        <h3>Главное изменение</h3>
        <p>${escapeHtml(result.changedPoint || result.shortSummary)}</p>
      </article>

      ${branches.map((branch) => `
        <article class="map-card">
          <h3>${escapeHtml(branch.branch || "Ветвь")}</h3>
          <ul class="map-items">
            ${(branch.items || []).filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      `).join("")}
    </div>
  `;
}

function resultToText(result) {
  const timeline = (result.timeline || [])
    .map((item) => `${item.year}. ${item.title}\n${item.description}\nВлияние: ${item.impactLevel}`)
    .join("\n\n");

  const map = (result.causeEffectMap || [])
    .map((branch) => `${branch.branch}\n${(branch.items || []).map((x) => `• ${x}`).join("\n")}`)
    .join("\n\n");

  return [
    result.title,
    "",
    "Краткое резюме",
    result.shortSummary,
    "",
    "Реальный исторический контекст",
    result.realHistoryContext,
    "",
    "Что изменилось",
    result.changedPoint,
    "",
    "Первые последствия",
    result.firstConsequences,
    "",
    "Цепочка последствий",
    result.causeChain,
    "",
    "Политические последствия",
    result.politics,
    "",
    "Экономические последствия",
    result.economy,
    "",
    "Военные последствия",
    result.military,
    "",
    "Технологические последствия",
    result.technology,
    "",
    "Культурные последствия",
    result.culture,
    "",
    "Общество",
    result.society,
    "",
    "Границы и союзы",
    result.bordersAndAlliances,
    "",
    "Жизнь обычных людей",
    result.ordinaryPeopleLife,
    "",
    "Через 5 лет",
    result.after5Years,
    "",
    "Через 20 лет",
    result.after20Years,
    "",
    "Через 50 лет",
    result.after50Years,
    "",
    "Современный мир",
    result.modernWorldResult,
    "",
    `Правдоподобность: ${result.probabilityScore} из 100`,
    "",
    "Риски",
    result.risks,
    "",
    "Временная линия",
    timeline,
    "",
    "Карта причин и последствий",
    map,
    "",
    "Версия для YouTube",
    result.videoScriptVersion,
    "",
    "Версия для озвучки",
    result.voiceoverVersion,
    "",
    "Примечание",
    result.sourcesNote
  ].filter(Boolean).join("\n");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

async function copyText(text, message = "Скопировано") {
  await navigator.clipboard.writeText(text);
  showToast(message);
}

function renderExport(result) {
  tabContent.innerHTML = `
    <div class="section-grid">
      <article class="export-card">
        <h3>Экспорт результата</h3>
        <p>Сохрани полный сценарий или быстро скопируй версию для видео и озвучки.</p>
      </article>

      <div class="export-actions">
        <button class="action-btn primary" id="copyFull" type="button">Скопировать полный текст</button>
        <button class="action-btn" id="downloadTxt" type="button">Скачать .txt</button>
        <button class="action-btn" id="downloadJson" type="button">Скачать .json</button>
        <button class="action-btn" id="copyShort" type="button">Скопировать краткую версию</button>
        <button class="action-btn" id="copyVideo" type="button">Версия для YouTube</button>
        <button class="action-btn" id="copyVoice" type="button">Версия для озвучки</button>
      </div>

      ${infoCard("Примечание", result.sourcesNote)}
    </div>
  `;

  $("#copyFull")?.addEventListener("click", () => copyText(resultToText(result)));
  $("#downloadTxt")?.addEventListener("click", () => downloadFile("history-otherwise.txt", resultToText(result), "text/plain;charset=utf-8"));
  $("#downloadJson")?.addEventListener("click", () => downloadFile("history-otherwise.json", JSON.stringify(result, null, 2), "application/json;charset=utf-8"));
  $("#copyShort")?.addEventListener("click", () => copyText(`${result.title}\n\n${result.shortSummary}`));
  $("#copyVideo")?.addEventListener("click", () => copyText(result.videoScriptVersion || result.shortSummary, "Версия для YouTube скопирована"));
  $("#copyVoice")?.addEventListener("click", () => copyText(result.voiceoverVersion || result.shortSummary, "Версия для озвучки скопирована"));
}

function renderCurrentTab() {
  if (!currentResult) return;

  if (activeTab === "overview") renderOverview(currentResult);
  if (activeTab === "analysis") renderAnalysis(currentResult);
  if (activeTab === "timeline") renderTimeline(currentResult);
  if (activeTab === "map") renderMap(currentResult);
  if (activeTab === "export") renderExport(currentResult);
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  renderCurrentTab();

  if (resultShell) {
    resultShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showResult(result) {
  currentResult = result;
  resultTitle.textContent = result.title;
  resultSummary.textContent = result.shortSummary;
  scoreValue.textContent = String(result.probabilityScore);
  resultShell.classList.remove("hidden");
  activeTab = "overview";
  setActiveTab("overview");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1500);
}

function showError(message) {
  errorBox.textContent = message || "Ошибка генерации";
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("historyOtherwiseV2") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const items = getHistory();
  items.unshift(item);
  localStorage.setItem("historyOtherwiseV2", JSON.stringify(items.slice(0, 10)));
  renderHistory();
}

function deleteHistory(id) {
  const items = getHistory().filter((item) => item.id !== id);
  localStorage.setItem("historyOtherwiseV2", JSON.stringify(items));
  renderHistory();
}

function renderHistory() {
  const items = getHistory();

  if (!items.length) {
    historyList.innerHTML = `<article class="history-item"><p>История пока пустая.</p></article>`;
    return;
  }

  historyList.innerHTML = items.map((item) => `
    <article class="history-item">
      <h3>${escapeHtml(item.result?.title || "Без названия")}</h3>
      <p>${escapeHtml(item.result?.shortSummary || "").slice(0, 150)}${(item.result?.shortSummary || "").length > 150 ? "..." : ""}</p>
      <div class="history-actions">
        <button class="small-btn" type="button" data-open="${item.id}">Открыть</button>
        <button class="small-btn" type="button" data-delete="${item.id}">Удалить</button>
      </div>
    </article>
  `).join("");

  historyList.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = getHistory().find((entry) => entry.id === button.dataset.open);
      if (!item) return;
      showResult(item.result);
      historyPanel.classList.add("hidden");
    });
  });

  historyList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteHistory(button.dataset.delete));
  });
}

function collectInput() {
  return {
    eventTitle: $("#eventTitle").value.trim(),
    region: $("#region").value.trim(),
    period: $("#period").value.trim(),
    change: $("#change").value.trim(),
    depth: $("#depth").value,
    style: $("#style").value
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = collectInput();

  hideError();

  if (data.change.length < 10) {
    showError("Опиши главное изменение подробнее. Нужно минимум 10 символов.");
    return;
  }

  submitBtn.disabled = true;
  loadingCard.classList.remove("hidden");
  resultShell.classList.add("hidden");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Сервер не вернул результат.");
    }

    const result = normalizeResult(payload, data);

    showResult(result);
    saveHistory({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      input: data,
      result
    });
  } catch (error) {
    showError(error.message || "Не удалось получить ответ.");
  } finally {
    loadingCard.classList.add("hidden");
    submitBtn.disabled = false;
  }
});

tabs.addEventListener("click", (event) => {
  const button = event.target.closest(".tab");
  if (!button) return;
  setActiveTab(button.dataset.tab);
});

historyToggle.addEventListener("click", () => {
  historyPanel.classList.toggle("hidden");
  if (!historyPanel.classList.contains("hidden")) {
    renderHistory();
    historyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

clearHistory.addEventListener("click", () => {
  localStorage.removeItem("historyOtherwiseV2");
  renderHistory();
  showToast("История очищена");
});

fillExample.addEventListener("click", () => {
  const item = examples[Math.floor(Math.random() * examples.length)];
  $("#eventTitle").value = item.eventTitle;
  $("#region").value = item.region;
  $("#period").value = item.period;
  $("#change").value = item.change;
});

renderHistory();
