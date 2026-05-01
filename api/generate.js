import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  maxDuration: 60
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(toText).join("\n\n");
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") return Object.values(value).map(toText).filter(Boolean).join("\n\n");
  return "";
}

function getInput(body) {
  return {
    eventTitle: cleanText(body.eventTitle || body.title || body.event || body.eventName || "Не указано"),
    region: cleanText(body.region || body.country || body.place || "Не указано"),
    period: cleanText(body.period || body.year || body.date || "Не указано"),
    change: cleanText(body.change || body.mainChange || body.changedPoint || body.prompt || body.userPrompt || ""),
    depth: cleanText(body.depth || body.analysisDepth || "Средний анализ"),
    style: cleanText(body.style || body.answerStyle || "Документальный")
  };
}

function buildPrompt(input) {
  return `
Ты исторический аналитик, редактор и сценарист альтернативной истории.

Создай правдоподобную альтернативную ветку истории на русском языке.

Данные пользователя:
Событие: ${input.eventTitle}
Регион: ${input.region}
Период: ${input.period}
Главное изменение: ${input.change}
Глубина анализа: ${input.depth}
Стиль: ${input.style}

Жёсткие правила:
1. Верни только JSON по схеме.
2. Заполни каждое поле. Нельзя писать пустые строки и "нет данных".
3. Каждое крупное поле должно содержать 2–4 конкретных предложения.
4. Отделяй реальные факты от предположений.
5. Не выдавай выдуманные события за реальные.
6. Покажи понятную цепочку причин и последствий.
7. timeline сделай из 6–8 пунктов.
8. causeEffectMap сделай из 6 ветвей: политика, экономика, войны, технологии, культура, общество.
9. probabilityScore дай числом от 1 до 100.
10. Не растягивай ответ. Пиши плотно, ясно и полезно.
11. Все impactLevel пиши на русском: высокий, средний, низкий.
`;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    shortSummary: { type: Type.STRING },
    realHistoryContext: { type: Type.STRING },
    changedPoint: { type: Type.STRING },
    firstConsequences: { type: Type.STRING },
    causeChain: { type: Type.STRING },
    politics: { type: Type.STRING },
    economy: { type: Type.STRING },
    military: { type: Type.STRING },
    technology: { type: Type.STRING },
    culture: { type: Type.STRING },
    society: { type: Type.STRING },
    bordersAndAlliances: { type: Type.STRING },
    ordinaryPeopleLife: { type: Type.STRING },
    after5Years: { type: Type.STRING },
    after20Years: { type: Type.STRING },
    after50Years: { type: Type.STRING },
    modernWorldResult: { type: Type.STRING },
    probabilityScore: { type: Type.NUMBER },
    risks: { type: Type.STRING },
    sourcesNote: { type: Type.STRING },
    videoScriptVersion: { type: Type.STRING },
    voiceoverVersion: { type: Type.STRING },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          year: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          impactLevel: { type: Type.STRING }
        },
        required: ["year", "title", "description", "impactLevel"]
      }
    },
    causeEffectMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          branch: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["branch", "items"]
      }
    }
  },
  required: [
    "title",
    "shortSummary",
    "realHistoryContext",
    "changedPoint",
    "firstConsequences",
    "causeChain",
    "politics",
    "economy",
    "military",
    "technology",
    "culture",
    "society",
    "bordersAndAlliances",
    "ordinaryPeopleLife",
    "after5Years",
    "after20Years",
    "after50Years",
    "modernWorldResult",
    "probabilityScore",
    "risks",
    "sourcesNote",
    "videoScriptVersion",
    "voiceoverVersion",
    "timeline",
    "causeEffectMap"
  ]
};

function findBranch(map, words) {
  if (!Array.isArray(map)) return "";
  const item = map.find((branch) => {
    const name = toText(branch?.branch).toLowerCase();
    return words.some((word) => name.includes(word));
  });

  if (!item || !Array.isArray(item.items)) return "";
  return item.items.filter(Boolean).map((x) => `• ${toText(x)}`).join("\n");
}

function fallbackText(input, section) {
  const base = input.change || "заданное пользователем изменение";
  const event = input.eventTitle || "историческое событие";

  const map = {
    realHistoryContext: `В реальной истории событие «${event}» развивалось в рамках своего политического и социального контекста. Альтернативный сценарий меняет одну ключевую точку и дальше строит последствия как предположение, а не как реальный факт.`,
    changedPoint: `Ключевое изменение: ${base}. Именно оно запускает новую цепочку решений, конфликтов и компромиссов.`,
    firstConsequences: `Первые последствия затрагивают власть, общественные настроения и баланс сил. Участники событий вынуждены менять планы, искать союзников и быстро реагировать на новую ситуацию.`,
    causeChain: `Главное изменение влияет на ближайшие политические решения. Эти решения меняют экономику, безопасность, внешние союзы и жизнь обычных людей.`,
    politics: `Политическая система меняется из-за нового баланса сил. Власть ищет способы удержать контроль и снизить риск нового кризиса.`,
    economy: `Экономика реагирует на политическую неопределённость. Государство усиливает контроль над ключевыми ресурсами и пытается сохранить производство.`,
    military: `Военная сфера становится одним из главных инструментов стабилизации. Армия получает больше влияния, потому что от неё зависит исход кризиса.`,
    technology: `Технологическое развитие идёт через потребности государства, армии и промышленности. Часть проектов получает больше ресурсов, а часть замедляется.`,
    culture: `Культура отражает новый политический курс. Общество спорит о прошлом, власти и будущем страны.`,
    society: `Общество делится на сторонников нового порядка и тех, кто считает его опасным. Повседневная жизнь становится осторожнее и политически напряжённее.`,
    bordersAndAlliances: `Границы и союзы меняются не сразу. Сначала меняется дипломатическая позиция страны, затем вокруг неё формируются новые партнёрства и конфликты.`,
    ordinaryPeopleLife: `Обычные люди живут в условиях неопределённости. Работа, цены, безопасность и свобода слова зависят от того, как новая власть удерживает ситуацию.`,
    after5Years: `Через 5 лет последствия уже закрепляются в институтах. Страна получает новый политический курс, но внутреннее напряжение сохраняется.`,
    after20Years: `Через 20 лет альтернативный путь меняет поколение, экономику и международную роль страны. Часть проблем решена, но появляются новые противоречия.`,
    after50Years: `Через 50 лет последствия становятся частью новой исторической нормы. Мир воспринимает эту версию событий как базовую, хотя её слабые места остаются заметными.`,
    modernWorldResult: `Современный мир в этой версии истории отличается балансом сил, союзами и памятью о прошлом. Главное изменение влияет на международные блоки, экономические связи и культурную идентичность.`,
    risks: `Главные риски сценария: слишком сильная роль отдельных лидеров, сопротивление общества, экономическое давление и вмешательство внешних сил.`,
    sourcesNote: `Это альтернативная реконструкция. Реальные факты использованы как исходная точка, дальнейшие события являются логическим предположением.`
  };

  return map[section] || "";
}

function normalizeTimeline(timeline, input) {
  if (Array.isArray(timeline) && timeline.length) {
    return timeline.slice(0, 8).map((item, index) => ({
      year: toText(item.year) || String(index + 1),
      title: toText(item.title) || "Событие",
      description: toText(item.description) || fallbackText(input, "firstConsequences"),
      impactLevel: toText(item.impactLevel) || "средний"
    }));
  }

  return [
    {
      year: input.period || "Начало",
      title: "Точка изменения",
      description: input.change,
      impactLevel: "высокий"
    },
    {
      year: "+1 год",
      title: "Первые последствия",
      description: fallbackText(input, "firstConsequences"),
      impactLevel: "высокий"
    },
    {
      year: "+5 лет",
      title: "Закрепление нового курса",
      description: fallbackText(input, "after5Years"),
      impactLevel: "средний"
    },
    {
      year: "+20 лет",
      title: "Новая система",
      description: fallbackText(input, "after20Years"),
      impactLevel: "средний"
    }
  ];
}

function normalizeMap(map, input, result) {
  const branches = ["Политика", "Экономика", "Войны", "Технологии", "Культура", "Общество"];

  return branches.map((branch) => {
    const existing = Array.isArray(map)
      ? map.find((item) => toText(item.branch).toLowerCase().includes(branch.toLowerCase().slice(0, 5)))
      : null;

    if (existing && Array.isArray(existing.items) && existing.items.length) {
      return {
        branch,
        items: existing.items.map(toText).filter(Boolean).slice(0, 6)
      };
    }

    const key = {
      "Политика": "politics",
      "Экономика": "economy",
      "Войны": "military",
      "Технологии": "technology",
      "Культура": "culture",
      "Общество": "society"
    }[branch];

    const text = toText(result[key]) || fallbackText(input, key);
    return {
      branch,
      items: text.split(/[.!?]\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 4)
    };
  });
}

function normalizeResult(data, input) {
  const raw = data && typeof data === "object" ? data : {};
  const causeEffectMapRaw = Array.isArray(raw.causeEffectMap) ? raw.causeEffectMap : [];

  const result = {
    title: toText(raw.title) || `Альтернативная история: ${input.eventTitle}`,
    shortSummary: toText(raw.shortSummary) || `Сценарий строится вокруг изменения: ${input.change}`,
    realHistoryContext: toText(raw.realHistoryContext) || fallbackText(input, "realHistoryContext"),
    changedPoint: toText(raw.changedPoint) || fallbackText(input, "changedPoint"),
    firstConsequences: toText(raw.firstConsequences) || fallbackText(input, "firstConsequences"),
    causeChain: toText(raw.causeChain) || findBranch(causeEffectMapRaw, ["прич", "цеп"]) || fallbackText(input, "causeChain"),
    politics: toText(raw.politics) || findBranch(causeEffectMapRaw, ["полит"]) || fallbackText(input, "politics"),
    economy: toText(raw.economy) || findBranch(causeEffectMapRaw, ["эконом"]) || fallbackText(input, "economy"),
    military: toText(raw.military) || findBranch(causeEffectMapRaw, ["войн", "арм", "воен"]) || fallbackText(input, "military"),
    technology: toText(raw.technology) || findBranch(causeEffectMapRaw, ["техн"]) || fallbackText(input, "technology"),
    culture: toText(raw.culture) || findBranch(causeEffectMapRaw, ["культ"]) || fallbackText(input, "culture"),
    society: toText(raw.society) || findBranch(causeEffectMapRaw, ["общ", "соци"]) || fallbackText(input, "society"),
    bordersAndAlliances: toText(raw.bordersAndAlliances) || fallbackText(input, "bordersAndAlliances"),
    ordinaryPeopleLife: toText(raw.ordinaryPeopleLife) || fallbackText(input, "ordinaryPeopleLife"),
    after5Years: toText(raw.after5Years || raw.fiveYears || raw.resultAfter5Years) || fallbackText(input, "after5Years"),
    after20Years: toText(raw.after20Years || raw.twentyYears || raw.resultAfter20Years) || fallbackText(input, "after20Years"),
    after50Years: toText(raw.after50Years || raw.fiftyYears || raw.resultAfter50Years) || fallbackText(input, "after50Years"),
    modernWorldResult: toText(raw.modernWorldResult) || fallbackText(input, "modernWorldResult"),
    probabilityScore: Math.max(1, Math.min(100, Number(raw.probabilityScore) || 65)),
    risks: toText(raw.risks) || fallbackText(input, "risks"),
    sourcesNote: toText(raw.sourcesNote) || fallbackText(input, "sourcesNote"),
    videoScriptVersion: toText(raw.videoScriptVersion) || `В этой версии истории всё меняется в момент, когда ${input.change}. Сначала меняется баланс власти, затем экономика, армия и жизнь общества. Через годы это приводит к другой политической карте и новому месту страны в мире.`,
    voiceoverVersion: toText(raw.voiceoverVersion) || `Представь, что ${input.change}. Первый эффект заметен сразу: меняется власть, общество и ход будущих решений. Дальше эта точка создаёт новую ветку истории, где привычный мир развивается иначе.`
  };

  result.fiveYears = result.after5Years;
  result.twentyYears = result.after20Years;
  result.fiftyYears = result.after50Years;
  result.timeline = normalizeTimeline(raw.timeline, input);
  result.causeEffectMap = normalizeMap(raw.causeEffectMap, input, result);

  result.politicalConsequences = result.politics;
  result.economicConsequences = result.economy;
  result.militaryConsequences = result.military;
  result.technologyConsequences = result.technology;
  result.culturalConsequences = result.culture;
  result.socialConsequences = result.society;
  result.chainOfConsequences = result.causeChain;

  return result;
}

function resultToText(result) {
  const timeline = result.timeline.map((item) => `${item.year}. ${item.title}\n${item.description}\nВлияние: ${item.impactLevel}`).join("\n\n");

  const map = result.causeEffectMap.map((branch) => `${branch.branch}\n${branch.items.map((x) => `• ${x}`).join("\n")}`).join("\n\n");

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
    "Риски сценария",
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
  ].join("\n");
}

function parseGeminiError(error) {
  const raw = error?.message || "Ошибка генерации через Gemini API.";
  try {
    const start = raw.indexOf("{");
    if (start >= 0) {
      const parsed = JSON.parse(raw.slice(start));
      return parsed?.error?.message || raw;
    }
  } catch {}
  return raw;
}

function isTemporaryError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("503") ||
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("temporarily") ||
    text.includes("overloaded") ||
    text.includes("429") ||
    text.includes("rate");
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(prompt) {
  let lastError = "";

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.6,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema
          }
        });

        return {
          model,
          text: response.text || "{}"
        };
      } catch (error) {
        lastError = parseGeminiError(error);

        if (!isTemporaryError(lastError)) {
          throw new Error(lastError);
        }

        await wait(700 * attempt);
      }
    }
  }

  throw new Error(lastError || "Модель Gemini перегружена. Попробуй позже.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Метод не поддерживается. Используй POST."
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "На сервере не найден GEMINI_API_KEY. Добавь ключ Gemini в Vercel Environment Variables."
      });
    }

    const body = req.body || {};
    const input = getInput(body);

    if (input.change.length < 10) {
      return res.status(400).json({
        error: "Опиши главное изменение подробнее. Нужно минимум 10 символов."
      });
    }

    if (input.change.length > 3000) {
      return res.status(400).json({
        error: "Текст слишком длинный. Сократи описание изменения до 3000 символов."
      });
    }

    const generated = await generateWithFallback(buildPrompt(input));

    let parsed;
    try {
      parsed = JSON.parse(generated.text);
    } catch {
      return res.status(500).json({
        error: "Gemini вернул ответ не в формате JSON. Нажми кнопку генерации ещё раз."
      });
    }

    const normalized = normalizeResult(parsed, input);
    const text = resultToText(normalized);

    return res.status(200).json({
      ok: true,
      model: generated.model,
      result: normalized,
      resultText: text,
      ...normalized
    });
  } catch (error) {
    return res.status(500).json({
      error: parseGeminiError(error)
    });
  }
}
