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
        }
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
        }
      }
    }
  }
};

function buildPrompt(input) {
  return `
Ты исторический аналитик и редактор альтернативной истории.

Создай правдоподобную альтернативную ветку истории на русском языке.

Данные пользователя:
Событие: ${input.eventTitle}
Регион: ${input.region}
Период: ${input.period}
Главное изменение: ${input.change}
Глубина анализа: ${input.depth}
Стиль: ${input.style}

Верни только JSON.
Не используй markdown.
Не используй блоки кода.
Не добавляй пояснения вне JSON.
Не оставляй пустые поля.
Не пиши "нет данных".
Если данные пользователя противоречивые, всё равно построй сценарий и объясни спорность в risks и sourcesNote.

Требования:
- title: короткое название сценария.
- shortSummary: 2-3 предложения.
- realHistoryContext: 2-4 предложения.
- changedPoint: 2-4 предложения.
- firstConsequences: 2-4 предложения.
- causeChain: 2-4 предложения.
- politics, economy, military, technology, culture, society: 2-4 предложения в каждом поле.
- bordersAndAlliances: 2-4 предложения.
- ordinaryPeopleLife: 2-4 предложения.
- after5Years, after20Years, after50Years, modernWorldResult: 2-4 предложения в каждом поле.
- probabilityScore: число от 1 до 100.
- risks: 2-4 предложения.
- sourcesNote: 1-3 предложения.
- videoScriptVersion: краткая версия для видео.
- voiceoverVersion: версия для озвучки.
- timeline: 6-8 объектов.
- causeEffectMap: 6 ветвей: политика, экономика, войны, технологии, культура, общество.
`;
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

function parseLooseJson(text) {
  if (!text) return null;

  let raw = String(text).trim();

  raw = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(raw);
  } catch {}

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(slice);
    } catch {}
  }

  return null;
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt, useSchema = true) {
  let lastError = "";

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config = useSchema
          ? {
              temperature: 0.35,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
              responseSchema
            }
          : {
              temperature: 0.25,
              maxOutputTokens: 4096
            };

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config
        });

        return {
          model,
          text: response.text || ""
        };
      } catch (error) {
        lastError = parseGeminiError(error);

        if (!isTemporaryError(lastError)) {
          throw new Error(lastError);
        }

        await wait(650 * attempt);
      }
    }
  }

  throw new Error(lastError || "Gemini временно перегружен. Попробуй ещё раз.");
}

async function convertTextToJson(text, input) {
  const prompt = `
Преобразуй текст ниже в валидный JSON для приложения альтернативной истории.

Верни только JSON.
Не используй markdown.
Не используй блоки кода.
Не добавляй текст вне JSON.

Если в тексте не хватает данных, заполни их логично на основе данных пользователя.

Данные пользователя:
Событие: ${input.eventTitle}
Регион: ${input.region}
Период: ${input.period}
Главное изменение: ${input.change}

Текст:
${String(text).slice(0, 6000)}
`;

  const generated = await callGemini(prompt, true);
  return parseLooseJson(generated.text);
}

function fallbackText(input, section) {
  const event = input.eventTitle || "историческое событие";
  const change = input.change || "заданное изменение";

  const table = {
    realHistoryContext: `В реальной истории событие «${event}» развивалось в конкретном политическом и социальном контексте. Альтернативный сценарий меняет одну ключевую точку и показывает логические последствия этого изменения.`,
    changedPoint: `Ключевое изменение состоит в том, что ${change}. Это меняет баланс сил, решения элит и реакцию общества.`,
    firstConsequences: `Первые последствия затрагивают власть, общественные настроения и устойчивость государства. Участники событий быстро перестраивают свои действия, потому что исходная траектория истории нарушена.`,
    causeChain: `Сначала меняется точка принятия решений. Затем меняются политический курс, экономические приоритеты, международные отношения и повседневная жизнь людей.`,
    politics: `Политическая система перестраивается под новый баланс сил. Власть усиливает контроль над ключевыми институтами и пытается закрепить новый курс.`,
    economy: `Экономика реагирует на политическую перестройку и новые решения государства. Меняются правила собственности, распределения ресурсов и внешней торговли.`,
    military: `Военная сфера становится опорой для стабилизации или давления. Армия получает более заметную роль, потому что от неё зависит безопасность нового режима.`,
    technology: `Технологическое развитие подстраивается под новые приоритеты страны. Одни направления ускоряются, а другие получают меньше ресурсов.`,
    culture: `Культура отражает новую идеологию и спор о будущем. Через прессу, искусство, образование и публичную память общество переосмысливает произошедшее.`,
    society: `Общество делится на сторонников нового курса и его критиков. Повседневная жизнь меняется через новые правила, ожидания и уровень свободы.`,
    bordersAndAlliances: `Границы и союзы меняются по мере того, как страна ищет новые договорённости и сталкивается с внешним давлением. Дипломатия становится инструментом закрепления новой линии развития.`,
    ordinaryPeopleLife: `Жизнь обычных людей меняется через работу, цены, безопасность, доступ к информации и отношение государства к населению. Новая историческая ветка влияет на быт сильнее, чем кажется на первом этапе.`,
    after5Years: `Через 5 лет новое направление уже видно в институтах, экономике и политике. При этом часть кризисов ещё не решена и продолжает влиять на общество.`,
    after20Years: `Через 20 лет альтернативный курс меняет целое поколение. Государство, экономика и международная роль страны становятся заметно другими.`,
    after50Years: `Через 50 лет последствия превращаются в новую историческую норму. Мир воспринимает этот путь как базовый, хотя у него остаются собственные слабые места.`,
    modernWorldResult: `Современный мир в этой версии истории отличается иным балансом сил, другими союзами и новой памятью о прошлом. Изменение одной точки отражается на международной политике, экономике и культуре.`,
    risks: `Главные риски сценария связаны с сопротивлением общества, внешним давлением, экономическими сбоями и тем, что отдельные решения могли пойти по другому пути.`,
    sourcesNote: `Это альтернативная реконструкция. Реальные исторические факты взяты как исходная точка, а дальнейшие события являются логическим предположением.`,
    videoScriptVersion: `Представь, что ${change}. Именно эта точка запускает новую ветку истории. Дальше меняются власть, экономика, общество и место страны в мире.`,
    voiceoverVersion: `Представь, что ${change}. Сначала это меняет ближайшие решения власти. Затем новая траектория истории влияет на общество, внешнюю политику и будущее страны.`
  };

  return table[section] || "";
}

function normalizeTimeline(timeline, input, result) {
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
      year: input.period || "Старт",
      title: "Точка изменения",
      description: result.changedPoint,
      impactLevel: "высокий"
    },
    {
      year: "+1 год",
      title: "Первые последствия",
      description: result.firstConsequences,
      impactLevel: "высокий"
    },
    {
      year: "+5 лет",
      title: "Закрепление нового курса",
      description: result.after5Years,
      impactLevel: "средний"
    },
    {
      year: "+20 лет",
      title: "Новая долгосрочная система",
      description: result.after20Years,
      impactLevel: "средний"
    }
  ];
}

function normalizeMap(map, input, result) {
  const branches = [
    ["Политика", result.politics],
    ["Экономика", result.economy],
    ["Войны", result.military],
    ["Технологии", result.technology],
    ["Культура", result.culture],
    ["Общество", result.society]
  ];

  return branches.map(([branch, fallback]) => {
    const existing = Array.isArray(map)
      ? map.find((item) => toText(item.branch).toLowerCase().includes(branch.toLowerCase().slice(0, 5)))
      : null;

    if (existing && Array.isArray(existing.items) && existing.items.length) {
      return {
        branch,
        items: existing.items.map(toText).filter(Boolean).slice(0, 6)
      };
    }

    return {
      branch,
      items: toText(fallback)
        .split(/[.!?]\s+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 4)
    };
  });
}

function normalizeResult(data, input) {
  const raw = data && typeof data === "object" ? data : {};

  const result = {
    title: toText(raw.title) || `Альтернативная история: ${input.eventTitle}`,
    shortSummary: toText(raw.shortSummary) || `Сценарий строится вокруг изменения: ${input.change}`,
    realHistoryContext: toText(raw.realHistoryContext) || fallbackText(input, "realHistoryContext"),
    changedPoint: toText(raw.changedPoint) || fallbackText(input, "changedPoint"),
    firstConsequences: toText(raw.firstConsequences) || fallbackText(input, "firstConsequences"),
    causeChain: toText(raw.causeChain) || fallbackText(input, "causeChain"),
    politics: toText(raw.politics) || fallbackText(input, "politics"),
    economy: toText(raw.economy) || fallbackText(input, "economy"),
    military: toText(raw.military) || fallbackText(input, "military"),
    technology: toText(raw.technology) || fallbackText(input, "technology"),
    culture: toText(raw.culture) || fallbackText(input, "culture"),
    society: toText(raw.society) || fallbackText(input, "society"),
    bordersAndAlliances: toText(raw.bordersAndAlliances) || fallbackText(input, "bordersAndAlliances"),
    ordinaryPeopleLife: toText(raw.ordinaryPeopleLife) || fallbackText(input, "ordinaryPeopleLife"),
    after5Years: toText(raw.after5Years || raw.fiveYears) || fallbackText(input, "after5Years"),
    after20Years: toText(raw.after20Years || raw.twentyYears) || fallbackText(input, "after20Years"),
    after50Years: toText(raw.after50Years || raw.fiftyYears) || fallbackText(input, "after50Years"),
    modernWorldResult: toText(raw.modernWorldResult) || fallbackText(input, "modernWorldResult"),
    probabilityScore: Math.max(1, Math.min(100, Number(raw.probabilityScore) || 65)),
    risks: toText(raw.risks) || fallbackText(input, "risks"),
    sourcesNote: toText(raw.sourcesNote) || fallbackText(input, "sourcesNote"),
    videoScriptVersion: toText(raw.videoScriptVersion) || fallbackText(input, "videoScriptVersion"),
    voiceoverVersion: toText(raw.voiceoverVersion) || fallbackText(input, "voiceoverVersion")
  };

  result.fiveYears = result.after5Years;
  result.twentyYears = result.after20Years;
  result.fiftyYears = result.after50Years;
  result.timeline = normalizeTimeline(raw.timeline, input, result);
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

    const generated = await callGemini(buildPrompt(input), true);

    let parsed = parseLooseJson(generated.text);

    if (!parsed) {
      try {
        parsed = await convertTextToJson(generated.text, input);
      } catch {}
    }

    let normalized;

    if (parsed) {
      normalized = normalizeResult(parsed, input);
    } else {
      normalized = normalizeResult({
        title: `Альтернативная история: ${input.eventTitle}`,
        shortSummary: `Gemini вернул текст не в JSON, поэтому приложение собрало безопасный результат по данным пользователя. Главная точка изменения: ${input.change}.`,
        changedPoint: input.change
      }, input);
    }

    return res.status(200).json({
      ok: true,
      model: generated.model,
      result: normalized,
      ...normalized
    });
  } catch (error) {
    return res.status(500).json({
      error: parseGeminiError(error)
    });
  }
}
