const STORAGE_KEY = "istoriya_inache_history_v1";

const examples = [
  {
    eventTitle: "Распад СССР",
    region: "Россия, Европа, мир",
    period: "1991 год",
    change: "СССР не распался в 1991 году, а был преобразован в обновлённую федерацию с частичной рыночной экономикой."
  },
  {
    eventTitle: "Битва при Ватерлоо",
    region: "Франция, Европа",
    period: "1815 год",
    change: "Наполеон победил при Ватерлоо и заставил европейские державы заключить новый мирный договор."
  },
  {
    eventTitle: "Появление интернета",
    region: "США, Европа, мир",
    period: "1950-е годы",
    change: "Технологии, похожие на интернет, появились в 1950-х и стали доступны университетам, армиям и крупным компаниям."
  },
  {
    eventTitle: "Первая мировая война",
    region: "Европа, Российская империя, Османская империя",
    period: "1914 год",
    change: "Первая мировая война не началась после кризиса 1914 года, потому что Австро-Венгрия и Сербия приняли международное расследование."
  },
  {
    eventTitle: "Римская империя",
    region: "Средиземноморье, Европа, Ближний Восток",
    period: "V век",
    change: "Западная Римская империя не рухнула, а провела военную и налоговую реформу, сохранив власть над Италией, Галлией и Северной Африкой."
  },
  {
    eventTitle: "США после Второй мировой войны",
    region: "США, Европа, Азия",
    period: "1945-1955 годы",
    change: "США не стали главной сверхдержавой после Второй мировой войны из-за длительного экономического кризиса и политической изоляции."
  }
];

const form = document.querySelector("#scenarioForm");
const submitBtn = document.querySelector("#submitBtn");
const loadingBox = document.querySelector("#loadingBox");
const errorBox = document.querySelector("#errorBox");
const emptyResult = document.querySelector("#emptyResult");
const resultContent = document.querySelector("#resultContent");
const historyList = document.querySelector("#historyList");
const examplesGrid = document.querySelector("#examplesGrid");
const fillRandomExampleBtn = document.querySelector("#fillRandomExample");

let currentResult = null;
let currentInput = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFormData() {
  return {
    eventTitle: document.querySelector("#eventTitle").value.trim(),
    region: document.querySelector("#region").value.trim(),
    period: document.querySelector("#period").value.trim(),
    change: document.querySelector("#change").value.trim(),
    depth: document.querySelector("#depth").value,
    style: document.querySelector("#style").value
  };
}

function setFormData(data) {
  document.querySelector("#eventTitle").value = data.eventTitle || "";
  document.querySelector("#region").value = data.region || "";
  document.querySelector("#period").value = data.period || "";
  document.querySelector("#change").value = data.change || "";
  document.querySelector("#depth").value = data.depth || "medium";
  document.querySelector("#style").value = data.style || "documentary";
}

function validateFormData(data) {
  const errors = [];

  if (data.eventTitle.length < 3) errors.push("укажи название события");
  if (data.region.length < 2) errors.push("укажи страну или регион");
  if (data.period.length < 2) errors.push("укажи дату или период");
  if (data.change.length < 12) errors.push("опиши, что именно изменилось");

  const totalLength =
    data.eventTitle.length + data.region.length + data.period.length + data.change.length;

  if (totalLength > 4200) {
    errors.push("сократи общий текст до 4200 символов");
  }

  return errors;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function setLoading(isLoading) {
  loadingBox.classList.toggle("hidden", !isLoading);
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Идёт моделирование..." : "Смоделировать историю";
}

async function generateScenario(payload) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Сервер вернул ошибку.");
  }

  if (!data?.result) {
    throw new Error("Сервер не вернул результат.");
  }

  return data.result;
}

function listItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<p>Нет данных.</p>";
  }

  return `
    <ul>
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function textBlock(title, content, wide = false) {
  return `
    <article class="result-block ${wide ? "wide" : ""}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(content || "Нет данных.")}</p>
    </article>
  `;
}

function listBlock(title, items, wide = false) {
  return `
    <article class="result-block ${wide ? "wide" : ""}">
      <h3>${escapeHtml(title)}</h3>
      ${listItems(items)}
    </article>
  `;
}

function renderTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return "<p>Временная линия не создана.</p>";
  }

  return `
    <div class="timeline">
      ${timeline
        .map(
          (item) => `
            <div class="timeline-item">
              <span class="timeline-dot"></span>
              <div class="timeline-card">
                <header>
                  <span class="timeline-year">${escapeHtml(item.year)}</span>
                  <span class="badge">влияние: ${escapeHtml(item.impactLevel)}</span>
                </header>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.description)}</p>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCauseMap(result) {
  const map = result.causeEffectMap;

  if (!Array.isArray(map) || map.length === 0) {
    return "<p>Карта причин и последствий не создана.</p>";
  }

  return `
    <div class="cause-map">
      <div class="cause-center">
        <strong>Главное изменение</strong>
        <p>${escapeHtml(result.changedPoint)}</p>
      </div>

      <div class="cause-branches">
        ${map
          .map(
            (branch) => `
              <article class="cause-branch">
                <h4>${escapeHtml(branch.branch)}</h4>
                ${listItems(branch.items)}
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildPlainText(result) {
  const lines = [];

  lines.push(result.title);
  lines.push("");
  lines.push("Краткое резюме:");
  lines.push(result.shortSummary);
  lines.push("");
  lines.push("Реальный исторический контекст:");
  lines.push(result.realHistoryContext);
  lines.push("");
  lines.push("Точка изменения:");
  lines.push(result.changedPoint);
  lines.push("");
  lines.push(`Уровень правдоподобности: ${result.probabilityScore}/100`);
  lines.push("");

  const sections = [
    ["Первые последствия", result.firstConsequences],
    ["Цепочка последствий", result.consequenceChain],
    ["Политические последствия", result.politics],
    ["Экономические последствия", result.economy],
    ["Военные последствия", result.military],
    ["Технологические последствия", result.technology],
    ["Культурные последствия", result.culture],
    ["Общество", result.society],
    ["Границы и союзы", result.bordersAndAlliances],
    ["Риски", result.risks]
  ];

  for (const [title, items] of sections) {
    lines.push(title + ":");
    if (Array.isArray(items)) {
      for (const item of items) lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("Жизнь обычных людей:");
  lines.push(result.ordinaryPeopleLife);
  lines.push("");

  lines.push("Через 5 лет:");
  lines.push(result.after5Years);
  lines.push("");

  lines.push("Через 20 лет:");
  lines.push(result.after20Years);
  lines.push("");

  lines.push("Через 50 лет:");
  lines.push(result.after50Years);
  lines.push("");

  lines.push("Современный мир:");
  lines.push(result.modernWorldResult);
  lines.push("");

  lines.push("Временная линия:");
  for (const item of result.timeline || []) {
    lines.push(`${item.year}. ${item.title}. ${item.description} Влияние: ${item.impactLevel}.`);
  }

  lines.push("");
  lines.push("Примечание:");
  lines.push(result.sourcesNote);

  return lines.join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function buildShortVersion(result) {
  const timeline = (result.timeline || [])
    .slice(0, 5)
    .map((item) => `${item.year}. ${item.title}. ${item.description}`)
    .join("\n");

  return `${result.title}

${result.shortSummary}

Главное изменение:
${result.changedPoint}

Ключевые последствия:
${(result.consequenceChain || []).slice(0, 5).map((item) => `- ${item}`).join("\n")}

Временная линия:
${timeline}

Итог:
${result.modernWorldResult}

Правдоподобность: ${result.probabilityScore}/100`;
}

function showVariant(title, text) {
  const box = document.querySelector("#variantBox");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <textarea readonly>${escapeHtml(text)}</textarea>
    <button class="btn btn-ghost btn-small" type="button" id="copyVariantBtn">
      Скопировать эту версию
    </button>
  `;

  document.querySelector("#copyVariantBtn").addEventListener("click", async () => {
    await copyText(text);
    document.querySelector("#copyVariantBtn").textContent = "Скопировано";
  });
}

function renderResult(result, input) {
  currentResult = result;
  currentInput = input;

  emptyResult.classList.add("hidden");
  resultContent.classList.remove("hidden");

  const plainText = buildPlainText(result);
  const jsonText = JSON.stringify({ input, result }, null, 2);

  resultContent.innerHTML = `
    <div class="result-hero">
      <div>
        <p class="eyebrow">Альтернативная ветка</p>
        <h2>${escapeHtml(result.title)}</h2>
        <p>${escapeHtml(result.shortSummary)}</p>
      </div>

      <div class="score">
        <div>
          <strong>${escapeHtml(result.probabilityScore)}</strong>
          <span>из 100<br>правдоподобность</span>
        </div>
      </div>
    </div>

    <div class="export-actions">
      <button class="btn btn-primary btn-small" type="button" id="copyTextBtn">Скопировать текст</button>
      <button class="btn btn-ghost btn-small" type="button" id="downloadTxtBtn">Скачать .txt</button>
      <button class="btn btn-ghost btn-small" type="button" id="downloadJsonBtn">Скачать .json</button>
      <button class="btn btn-ghost btn-small" type="button" id="shortVersionBtn">Сделать краткую версию</button>
      <button class="btn btn-ghost btn-small" type="button" id="videoVersionBtn">Версия для YouTube</button>
      <button class="btn btn-ghost btn-small" type="button" id="voiceVersionBtn">Версия для озвучки</button>
    </div>

    <div id="variantBox" class="variant-box hidden"></div>

    <div class="result-grid">
      ${textBlock("Реальный исторический контекст", result.realHistoryContext, true)}
      ${textBlock("Что изменилось в первой точке", result.changedPoint)}
      ${listBlock("Цепочка последствий", result.consequenceChain)}
      ${listBlock("Политические последствия", result.politics)}
      ${listBlock("Экономические последствия", result.economy)}
      ${listBlock("Военные последствия", result.military)}
      ${listBlock("Технологические последствия", result.technology)}
      ${listBlock("Культурные последствия", result.culture)}
      ${listBlock("Как изменились границы и союзы", result.bordersAndAlliances)}
      ${textBlock("Как изменилась жизнь обычных людей", result.ordinaryPeopleLife)}
      ${textBlock("Что происходит через 5 лет", result.after5Years)}
      ${textBlock("Что происходит через 20 лет", result.after20Years)}
      ${textBlock("Что происходит через 50 лет", result.after50Years)}
      ${textBlock("Современный мир в этой версии истории", result.modernWorldResult, true)}
      ${listBlock("Главные риски сценария", result.risks, true)}

      <article class="result-block wide">
        <h3>Краткая временная линия</h3>
        ${renderTimeline(result.timeline)}
      </article>

      <article class="result-block wide">
        <h3>Карта причин и последствий</h3>
        ${renderCauseMap(result)}
      </article>

      ${textBlock("Примечание об источниках и допущениях", result.sourcesNote, true)}
    </div>
  `;

  document.querySelector("#copyTextBtn").addEventListener("click", async () => {
    await copyText(plainText);
    document.querySelector("#copyTextBtn").textContent = "Скопировано";
  });

  document.querySelector("#downloadTxtBtn").addEventListener("click", () => {
    downloadFile("istoriya-inache.txt", plainText, "text/plain;charset=utf-8");
  });

  document.querySelector("#downloadJsonBtn").addEventListener("click", () => {
    downloadFile("istoriya-inache.json", jsonText, "application/json;charset=utf-8");
  });

  document.querySelector("#shortVersionBtn").addEventListener("click", () => {
    showVariant("Краткая версия", buildShortVersion(result));
  });

  document.querySelector("#videoVersionBtn").addEventListener("click", () => {
    showVariant("Версия для YouTube", result.videoScriptVersion);
  });

  document.querySelector("#voiceVersionBtn").addEventListener("click", () => {
    showVariant("Версия для озвучки", result.voiceoverVersion);
  });
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistoryItem(input, result) {
  const history = loadHistory();

  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    result
  };

  const next = [item, ...history].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  renderHistory();
}

function deleteHistoryItem(id) {
  const history = loadHistory().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderHistory();
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

function renderHistory() {
  const history = loadHistory();

  if (!history.length) {
    historyList.innerHTML = `<p class="history-empty">История пока пуста. Создай первый сценарий.</p>`;
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) => `
        <article class="history-item">
          <div>
            <h3>${escapeHtml(item.input.eventTitle || item.result.title)}</h3>
            <p>${escapeHtml(formatDate(item.createdAt))}</p>
            <p>${escapeHtml(item.input.change)}</p>
          </div>

          <div class="history-actions">
            <button class="btn btn-ghost btn-small" type="button" data-open="${item.id}">Открыть</button>
            <button class="btn btn-ghost btn-small" type="button" data-similar="${item.id}">Создать похожий сценарий</button>
            <button class="btn btn-danger btn-small" type="button" data-delete="${item.id}">Удалить</button>
          </div>
        </article>
      `
    )
    .join("");

  historyList.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = history.find((entry) => entry.id === button.dataset.open);
      if (!item) return;

      renderResult(item.result, item.input);
      document.querySelector("#result").scrollIntoView({ behavior: "smooth" });
    });
  });

  historyList.querySelectorAll("[data-similar]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = history.find((entry) => entry.id === button.dataset.similar);
      if (!item) return;

      setFormData(item.input);
      document.querySelector("#create").scrollIntoView({ behavior: "smooth" });
    });
  });

  historyList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteHistoryItem(button.dataset.delete);
    });
  });
}

function renderExamples() {
  examplesGrid.innerHTML = examples
    .map(
      (item, index) => `
        <button type="button" data-example="${index}">
          <strong>${escapeHtml(item.eventTitle)}</strong>
          <span>${escapeHtml(item.change)}</span>
        </button>
      `
    )
    .join("");

  examplesGrid.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const example = examples[Number(button.dataset.example)];
      setFormData({
        ...example,
        depth: "medium",
        style: "documentary"
      });

      document.querySelector("#create").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function fillRandomExample() {
  const example = examples[Math.floor(Math.random() * examples.length)];
  setFormData({
    ...example,
    depth: "medium",
    style: "documentary"
  });

  document.querySelector("#create").scrollIntoView({ behavior: "smooth" });
}

function initCanvas() {
  const canvas = document.querySelector("#timeCanvas");
  const ctx = canvas.getContext("2d");
  const particles = [];
  const count = Math.min(90, Math.floor(window.innerWidth / 18));

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function createParticles() {
    particles.length = 0;

    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.7 + 0.6
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > window.innerWidth) particle.vx *= -1;
      if (particle.y < 0 || particle.y > window.innerHeight) particle.vy *= -1;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(122, 204, 255, 0.42)";
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i += 1) {
      for (let j = i + 1; j < particles.length; j += 1) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 130) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(72, 185, 255, ${0.12 * (1 - distance / 130)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  hideError();

  const payload = getFormData();
  const errors = validateFormData(payload);

  if (errors.length) {
    showError(`Уточни данные: ${errors.join(", ")}.`);
    document.querySelector("#result").scrollIntoView({ behavior: "smooth" });
    return;
  }

  setLoading(true);
  emptyResult.classList.add("hidden");
  resultContent.classList.add("hidden");
  document.querySelector("#result").scrollIntoView({ behavior: "smooth" });

  try {
    const result = await generateScenario(payload);
    renderResult(result, payload);
    saveHistoryItem(payload, result);
  } catch (error) {
    emptyResult.classList.remove("hidden");
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

fillRandomExampleBtn.addEventListener("click", fillRandomExample);

renderExamples();
renderHistory();
initCanvas();
