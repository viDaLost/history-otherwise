import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3-flash"
];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toText(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("\n\n");
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") return Object.values(value).map(toText).filter(Boolean).join("\n\n");
  return "";
}

function getInput(body = {}) {
  return {
    eventTitle: clean(body.eventTitle || body.event || body.eventName || body.title) || "Не указано",
    region: clean(body.region || body.country || body.place || body.location) || "Не указано",
    period: clean(body.period || body.year || body.date || body.time) || "Не указано",
    change: clean(body.change || body.mainChange || body.changedPoint || body.prompt || body.userPrompt || body.description),
    depth: clean(body.depth || body.analysisDepth) || "Средний анализ",
    style: clean(body.style || body.answerStyle) || "Документальный"
  };
}

function parseLooseJson(text) {
  if (!text) return null;

  let raw = String(text).trim();
  raw = raw.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(raw);
  } catch {}

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");

  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {}
  }

  return null;
}

function normalizeApiError(error) {
  const raw = String(error?.message || error || "Ошибка Gemini API");
  const lower = raw.toLowerCase();

  if (
    lower.includes("quota exceeded") ||
    lower.includes("rate limit") ||
    lower.includes("free_tier") ||
    lower.includes("billing details")
  ) {
    return "Лимит Gemini API исчерпан. Показан локальный результат без Gemini. Подожди сброса лимита или подключи billing.";
  }

  if (lower.includes("the string did not match the expected pattern")) {
    return "Gemini вернул нестабильный формат. Показан локальный результат.";
  }

  if (lower.includes("503") || lower.includes("unavailable") || lower.includes("high demand")) {
    return "Gemini сейчас перегружен. Показан локальный результат.";
  }

  return raw;
}

function splitSentences(text, limit = 4) {
  return String(text || "")
    .split(/[.!?]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractPersonName(text) {
  const matches = String(text || "").match(/[А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+){0,2}/g) || [];
  return matches[0] || "ключевая фигура";
}

function detectScenarioType(input) {
  const text = `${input.eventTitle} ${input.change}`.toLowerCase();

  if (text.includes("не родил")) return "no_birth";
  if (text.includes("не нача") || text.includes("не произошл") || text.includes("не было войны")) return "not_happened";
  if (text.includes("не распал")) return "no_collapse";

  return "generic";
}

function localScenario(input) {
  const type = detectScenarioType(input);
  const person = extractPersonName(input.change);
  const baseTitle = input.eventTitle !== "Не указано" ? input.eventTitle : input.region;

  let summary = "";
  let firstConsequences = "";
  let politics = "";
  let economy = "";
  let military = "";
  let technology = "";
  let culture = "";
  let society = "";
  let bordersAndAlliances = "";
  let ordinaryPeopleLife = "";
  let causeChain = "";
  let after5Years = "";
  let after20Years = "";
  let after50Years = "";
  let modernWorldResult = "";
  let risks = "";

  if (type === "no_birth") {
    summary = `${person} не появляется в истории, поэтому политическая радикализация идёт по другому пути. В ${input.region} не формируется прежняя персональная диктатура. Это меняет партийный расклад, внешнюю политику и вероятность большой войны.`;
    firstConsequences = `В первые годы после ${input.period} радикальное движение в ${input.region} теряет сильного оратора и символ объединения. Вместо одной фигуры появляются несколько конкурирующих лидеров, которые спорят между собой. Консервативные элиты, армия и крупный бизнес получают больше пространства для компромиссов. Власть жёстко следит за улицей, но ей проще изолировать крайние группы, потому что у них нет единого центра.`;
    politics = `Внутри страны не складывается тот же культ личности, который вёл к полной централизации власти. Правые движения остаются раздробленными и вынуждены искать союзы с армейскими кругами, националистами и промышленниками. Парламентская система всё ещё слаба, но шанс на коалиционное или полуавторитарное правительство заметно выше. Главной борьбой становится спор между консервативным порядком и радикальным реваншизмом.`;
    economy = `Военная мобилизация идёт медленнее, потому что нет прежнего масштаба идеологического нажима и сверхцентрализации. Государство всё равно вкладывает деньги в тяжёлую промышленность, транспорт и перевооружение, но темпы ниже. Крупный бизнес и банки сохраняют больше влияния на решения кабинета. Для населения это означает более мягкий режим нормирования, меньше шоковых кампаний и меньше давления на рынок труда.`;
    military = `Армия остаётся влиятельной силой, но не превращается в инструмент одного вождя. Генеральный штаб действует осторожнее и сильнее взвешивает риск общеевропейской войны. Локальные кризисы и приграничные споры сохраняются, но вероятность прямого запуска мировой войны снижается. Военное давление остаётся, но решения чаще проходят через кабинет.`;
    technology = `Военные технологии развиваются, но не в режиме абсолютного приоритета любой ценой. Авиация, связь, моторостроение и химическая промышленность всё равно растут, однако часть ресурсов остаётся у гражданских отраслей. Университеты и инженерные школы не так жёстко подчиняются партийной идеологии. Это даёт более ровное развитие промышленности и медицины.`;
    culture = `Пропаганда остаётся националистической, но не достигает прежнего масштаба массового культа вождя. Пресса и искусство сильнее зависят от цензуры государства, чем от одной личной линии. Эмиграция интеллектуалов всё ещё возможна, но давление ниже. Историческая память формируется вокруг кризиса и унижения после войны, а не вокруг мессианской фигуры.`;
    society = `Общество остаётся тревожным и политически расколотым. Ветераны, безработные, чиновники и средний класс по-разному смотрят на вопрос реванша и стабильности. Уличное насилие есть, но у него меньше масштаба, чем при полном захвате государства одной партией. Для семей главный вопрос остаётся прежним: работа, цены, безопасность и страх нового конфликта.`;
    bordersAndAlliances = `Соседи ${input.region} видят менее предсказуемую, но и менее агрессивную внешнюю линию. Союзы строятся вокруг сдерживания кризиса, а не вокруг одного проекта экспансии. При этом Восточная Европа остаётся зоной давления и дипломатических торгов. Карта границ меняется слабее, чем в сценарии большой мировой войны.`;
    ordinaryPeopleLife = `Обычные люди сталкиваются с иной политической атмосферой: меньше тотальной мобилизации, меньше культа, но больше затяжной нестабильности. Рынок труда остаётся нервным, цены колеблются, а молодёжь живёт в ожидании новых решений власти. Военная служба и политические проверки сохраняются, но не превращаются в тотальную повседневную систему. В быту больше неопределённости, но меньше риска немедленной катастрофы мирового масштаба.`;
    causeChain = `Отсутствие ${person} ослабляет радикальное движение. Ослабление движения мешает быстрой концентрации власти. Без тотальной концентрации власти решения о войне и мобилизации становятся осторожнее. Более осторожная внешняя политика снижает шанс полномасштабного конфликта прежнего типа. Из-за этого Европа и мир входят в другую политическую траекторию.`;
    after5Years = `Через 5 лет в ${input.region} складывается режим жёсткого порядка или слабой коалиции, который пытается удержать улицу и восстановить экономику. Радикальные движения ещё активны, но им труднее захватить весь аппарат. Европейские державы ведут политику сдерживания и наблюдения. Большая война к этому моменту всё ещё не является неизбежной.`;
    after20Years = `Через 20 лет Европа живёт в мире, где старые имперские обиды не исчезли, но развиваются иначе. Международные союзы строятся вокруг баланса сил, торговли и страха новой эскалации. Технологии и промышленность растут без прежнего масштаба военного разрушения. Память о межвоенном кризисе остаётся сильной, но мировой порядок не повторяет известную линию.`;
    after50Years = `Через 50 лет историки рассматривают отсутствие ${person} как одну из крупнейших точек развилки XX века. В учебниках подчёркивают роль институтов, армии и элит, которым пришлось искать иной путь. У мира другая карта союзов, другая память о Европе и другие центры влияния. Некоторые конфликты всё равно происходят, но их состав и последствия иные.`;
    modernWorldResult = `Современный мир выглядит менее травмированным прежней тотальной войной, но остаётся сложным и конкурентным. ${input.region} занимает иное место в памяти мира, а соседние страны строят идентичность без прежнего опыта глобальной катастрофы. Международные институты могли появиться в другой форме и позже. Баланс между США, Европой и восточными державами складывается по другой логике.`;
    risks = `Даже без ${person} в ${input.region} оставались кризис, реваншизм и сильные радикальные движения. Другой лидер мог занять его место и частично повторить курс. Экономический шок и борьба элит могли всё равно привести к войне. Поэтому этот сценарий снижает риск прежнего исхода, но не отменяет его полностью.`;
  } else {
    summary = `Изменение «${input.change}» переводит событие «${input.eventTitle}» на новую траекторию. В ${input.region} иначе складываются решения власти, армии и общества. Это меняет последствия на годы вперёд.`;
    firstConsequences = `Сразу после развилки начинается борьба за контроль над властью, информацией и ключевыми ресурсами. Силовые структуры и политические элиты быстро пересматривают свою позицию. Население реагирует тревогой и слухами. Уже в первые месяцы становится ясно, что исходная история не повторится.`;
    politics = `Политический центр вынужден адаптироваться к новому событию. Усиливаются те группы, которые лучше подготовлены к кризису. Влияние прежних фаворитов снижается. Новая коалиция власти начинает менять правила игры.`;
    economy = `Экономика реагирует через транспорт, снабжение, цены и распределение бюджета. Государство усиливает контроль над критически важными отраслями. Бизнес и местные элиты перестраивают цепочки поставок. Для населения это выражается в новых ценах, приоритетах и ограничениях.`;
    military = `Армия и силовые структуры получают ключевую роль. Они удерживают порядок, подавляют очаги сопротивления или становятся отдельным политическим игроком. Военная сфера влияет на соседей и союзников. Любой кризис быстро выходит за пределы одной столицы.`;
    technology = `Технологическое развитие смещается в сторону отраслей, которые новая власть считает полезными. Часть направлений ускоряется, часть замедляется. Государственный заказ становится главным инструментом влияния. Это постепенно меняет рынок труда и образование.`;
    culture = `Культура начинает объяснять обществу смысл нового поворота. Пресса, школа и публичная память перестраиваются. Часть деятелей культуры становится опорой власти, часть уходит в критику. Через годы это меняет национальную идентичность.`;
    society = `Общество перестраивается вокруг нового баланса страха, надежды и интереса. Одни социальные группы выигрывают, другие теряют влияние. Возникают новые линии конфликта между центром и регионами, бедными и обеспеченными, армией и гражданскими. В быту это чувствуется быстро.`;
    bordersAndAlliances = `Внешний мир реагирует через дипломатию, торговлю и безопасность границ. Часть союзов укрепляется, часть рассыпается. Соседи пытаются извлечь выгоду из перемен. Итогом становится новая международная конфигурация.`;
    ordinaryPeopleLife = `Обычные люди ощущают новую историю через работу, еду, безопасность, призыв и свободу слова. Именно повседневность показывает настоящий масштаб перемен. Семьи меняют планы, бизнес меняет стратегии, молодёжь меняет ожидания. История входит в дом через бытовые детали.`;
    causeChain = `Точка изменения ломает исходный порядок. Затем власть и элиты реагируют на кризис. После этого меняются решения по армии, финансам и дипломатии. Эти решения перестраивают общество и экономику. В конце возникает новый современный мир.`;
    after5Years = `Через 5 лет становятся видны первые устойчивые результаты. Новая власть или новая коалиция закрепляет курс. Экономика подстраивается под изменившийся порядок. Население начинает воспринимать новую линию как реальность.`;
    after20Years = `Через 20 лет уже выросло поколение, которое не знает исходного пути как личный опыт. Государственные институты и культура памяти закрепляют новую версию событий. Международная система адаптируется к новому центру силы. Часть старых споров остаётся, но их форма уже иная.`;
    after50Years = `Через 50 лет новая ветка становится полноценной исторической нормой. Исследователи спорят уже не о факте изменения, а о цене этой развилки. Политика, экономика и культура идут по иной траектории. Мир вокруг тоже давно изменился под её влиянием.`;
    modernWorldResult = `Современный мир в этой версии истории заметно отличается по союзам, памяти о прошлом и роли ${input.region}. Положение крупных держав распределено иначе. Часть кризисов исчезла, часть возникла на новом месте. Главное изменение продолжает влиять даже спустя десятилетия.`;
    risks = `Сценарий зависит от множества игроков, а не только от одной точки изменения. В реальности часть сил могла вернуть страну к похожему пути. Внешнее давление соседей тоже могло изменить исход. Поэтому итог остаётся логичной реконструкцией, а не гарантированным будущим.`;
  }

  const result = {
    title: `Альтернативная история: ${baseTitle}`,
    shortSummary: summary,
    realHistoryContext: `В реальной истории событие «${input.eventTitle}» связано с решениями власти, борьбой элит и реакцией общества в регионе ${input.region}. Период «${input.period}» задаёт исходную точку анализа. После изменения «${input.change}» эта линия перестраивается.`,
    changedPoint: input.change,
    firstConsequences,
    causeChain,
    politics,
    economy,
    military,
    technology,
    culture,
    society,
    bordersAndAlliances,
    ordinaryPeopleLife,
    after5Years,
    after20Years,
    after50Years,
    modernWorldResult,
    probabilityScore: type === "no_birth" ? 72 : 68,
    risks,
    sourcesNote: "Реальные факты использованы как отправная точка. Все последствия после точки изменения являются альтернативной реконструкцией.",
    videoScriptVersion: `${summary} Первые последствия меняют политику, экономику и международные отношения. Через несколько лет новый курс закрепляется, а через десятилетия рождается другой современный мир.`,
    voiceoverVersion: `${summary} Сразу после точки изменения начинается борьба за власть, ресурсы и общественное мнение. Новые решения элит меняют армию, экономику, культуру и быт людей. Через годы это превращается в полноценную альтернативную ветку истории.`
  };

  result.timeline = [
    { year: input.period, title: "Точка изменения", description: input.change, impactLevel: "высокий" },
    { year: "первые месяцы", title: "Немедленная реакция", description: firstConsequences, impactLevel: "высокий" },
    { year: "+5 лет", title: "Новый порядок", description: after5Years, impactLevel: "средний" },
    { year: "+20 лет", title: "Долгий эффект", description: after20Years, impactLevel: "средний" },
    { year: "+50 лет", title: "Историческая норма", description: after50Years, impactLevel: "средний" },
    { year: "сегодня", title: "Современный мир", description: modernWorldResult, impactLevel: "высокий" }
  ];

  result.causeEffectMap = [
    { branch: "Политика", items: splitSentences(politics) },
    { branch: "Экономика", items: splitSentences(economy) },
    { branch: "Войны", items: splitSentences(military) },
    { branch: "Технологии", items: splitSentences(technology) },
    { branch: "Культура", items: splitSentences(culture) },
    { branch: "Общество", items: splitSentences(society) }
  ];

  return result;
}

function normalizeResult(data, input) {
  const base = localScenario(input);
  const src = data && typeof data === "object" ? data : {};

  const pick = (...keys) => {
    for (const key of keys) {
      const value = toText(src[key]);
      if (value) return value;
    }
    return "";
  };

  const result = {
    ...base,
    title: pick("title", "scenarioTitle", "name") || base.title,
    shortSummary: pick("shortSummary", "summary", "resume") || base.shortSummary,
    realHistoryContext: pick("realHistoryContext", "context", "historicalContext") || base.realHistoryContext,
    changedPoint: pick("changedPoint", "mainChange", "change") || base.changedPoint,
    firstConsequences: pick("firstConsequences", "immediateConsequences", "firstEffects") || base.firstConsequences,
    causeChain: pick("causeChain", "chainOfConsequences") || base.causeChain,
    politics: pick("politics", "politicalConsequences") || base.politics,
    economy: pick("economy", "economicConsequences") || base.economy,
    military: pick("military", "militaryConsequences", "wars") || base.military,
    technology: pick("technology", "technologyConsequences", "tech") || base.technology,
    culture: pick("culture", "culturalConsequences") || base.culture,
    society: pick("society", "socialConsequences") || base.society,
    bordersAndAlliances: pick("bordersAndAlliances", "alliances", "borders") || base.bordersAndAlliances,
    ordinaryPeopleLife: pick("ordinaryPeopleLife", "peopleLife", "dailyLife") || base.ordinaryPeopleLife,
    after5Years: pick("after5Years", "fiveYears") || base.after5Years,
    after20Years: pick("after20Years", "twentyYears") || base.after20Years,
    after50Years: pick("after50Years", "fiftyYears") || base.after50Years,
    modernWorldResult: pick("modernWorldResult", "modernWorld", "currentWorld") || base.modernWorldResult,
    probabilityScore: Number(src.probabilityScore || src.score || base.probabilityScore) || base.probabilityScore,
    risks: pick("risks", "scenarioRisks") || base.risks,
    sourcesNote: pick("sourcesNote", "assumptions", "note") || base.sourcesNote,
    videoScriptVersion: pick("videoScriptVersion", "youtubeVersion", "videoVersion") || base.videoScriptVersion,
    voiceoverVersion: pick("voiceoverVersion", "voiceVersion", "narration") || base.voiceoverVersion,
    timeline: Array.isArray(src.timeline) && src.timeline.length ? src.timeline : base.timeline,
    causeEffectMap: Array.isArray(src.causeEffectMap) && src.causeEffectMap.length ? src.causeEffectMap : base.causeEffectMap
  };

  result.probabilityScore = Math.max(1, Math.min(100, Math.round(Number(result.probabilityScore) || 65)));
  return result;
}

function buildPrompt(input) {
  return `Ты исторический аналитик альтернативной истории. Верни только валидный JSON на русском языке. Без markdown. Без пояснений вне JSON.

Данные пользователя:
Событие: ${input.eventTitle}
Регион: ${input.region}
Период: ${input.period}
Главное изменение: ${input.change}
Глубина: ${input.depth}
Стиль: ${input.style}

Структура JSON:
{
  "title": "...",
  "shortSummary": "...",
  "realHistoryContext": "...",
  "changedPoint": "...",
  "firstConsequences": "...",
  "causeChain": "...",
  "politics": "...",
  "economy": "...",
  "military": "...",
  "technology": "...",
  "culture": "...",
  "society": "...",
  "bordersAndAlliances": "...",
  "ordinaryPeopleLife": "...",
  "after5Years": "...",
  "after20Years": "...",
  "after50Years": "...",
  "modernWorldResult": "...",
  "probabilityScore": 0,
  "risks": "...",
  "sourcesNote": "...",
  "videoScriptVersion": "...",
  "voiceoverVersion": "...",
  "timeline": [
    {"year":"...","title":"...","description":"...","impactLevel":"высокий"}
  ],
  "causeEffectMap": [
    {"branch":"Политика","items":["...","...","...","..."]},
    {"branch":"Экономика","items":["...","...","...","..."]},
    {"branch":"Войны","items":["...","...","...","..."]},
    {"branch":"Технологии","items":["...","...","...","..."]},
    {"branch":"Культура","items":["...","...","...","..."]},
    {"branch":"Общество","items":["...","...","...","..."]}
  ]
}

Требования:
1. Пиши конкретно, не пиши расплывчато.
2. Указывай участников, решения, последствия и бытовые изменения.
3. Не оставляй пустые поля.
4. Временная линия: 6-7 пунктов.
5. В каждом большом текстовом поле минимум 3 законченных предложения.
6. Не пиши "нет данных".`;
}

async function callGemini(prompt) {
  let lastError = "";

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.35,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      });

      return {
        model,
        text: response.text || ""
      };
    } catch (error) {
      lastError = normalizeApiError(error);

      if (lastError.includes("Лимит Gemini API исчерпан") || lastError.includes("Gemini сейчас перегружен")) {
        continue;
      }
    }
  }

  throw new Error(lastError || "Не удалось получить ответ от Gemini.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Используй POST." });
  }

  try {
    const input = getInput(req.body || {});

    if (!input.change || input.change === "Не указано" || input.change.length < 5) {
      return res.status(400).json({ error: "Опиши главное изменение подробнее." });
    }

    if (!process.env.GEMINI_API_KEY) {
      const fallback = localScenario(input);

      return res.status(200).json({
        ok: true,
        partial: true,
        warning: "На сервере не найден GEMINI_API_KEY. Показан локальный результат.",
        result: fallback,
        ...fallback
      });
    }

    try {
      const generated = await callGemini(buildPrompt(input));
      const parsed = parseLooseJson(generated.text);

      if (parsed) {
        const result = normalizeResult(parsed, input);

        return res.status(200).json({
          ok: true,
          model: generated.model,
          result,
          ...result
        });
      }

      const fallback = localScenario(input);

      return res.status(200).json({
        ok: true,
        partial: true,
        warning: "Gemini вернул нестабильный ответ. Показан локальный результат.",
        model: generated.model,
        result: fallback,
        ...fallback
      });
    } catch (error) {
      const friendly = normalizeApiError(error);
      const fallback = localScenario(input);

      return res.status(200).json({
        ok: true,
        partial: true,
        warning: friendly,
        result: fallback,
        ...fallback
      });
    }
  } catch (error) {
    return res.status(500).json({ error: normalizeApiError(error) });
  }
}
