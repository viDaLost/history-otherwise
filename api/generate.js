import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  maxDuration: 60
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-flash-latest"
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
    depth: cleanText(body.depth || body.analysisDepth || "Глубокий анализ"),
    style: cleanText(body.style || body.answerStyle || "Документальный")
  };
}

function buildPrompt(input) {
  return `
Ты исторический аналитик и сценарист альтернативной истории.

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
2. Заполни каждое поле.
3. Не оставляй поля пустыми.
4. Не пиши "нет данных".
5. Отделяй реальные факты от предположений.
6. Не выдавай выдуманные события за реальные.
7. Покажи цепочку причин и последствий.
8. timeline сделай из 8 пунктов.
9. causeEffectMap сделай из 6 ветвей: политика, экономика, войны, технологии, культура, общество.
10. probabilityScore дай числом от 1 до 100.
11. Текст в каждом крупном поле сделай содержательным: 3–6 предложений.
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

function normalizeResult(data, input) {
  const result = data && typeof data === "object" ? data : {};
  const title = toText(result.title) || `Альтернативная история: ${input.eventTitle}`;
  const shortSummary = toText(result.shortSummary) || `Сценарий строится вокруг изменения: ${input.change}`;

  const after5Years = toText(result.after5Years || result.fiveYears || result.resultAfter5Years);
  const after20Years = toText(result.after20Years || result.twentyYears || result.resultAfter20Years);
  const after50Years = toText(result.after50Years || result.fiftyYears || result.resultAfter50Years);

  return {
    title,
    shortSummary,
    realHistoryContext: toText(result.realHistoryContext),
    changedPoint: toText(result.changedPoint) || input.change,
    firstConsequences: toText(result.firstConsequences),
    causeChain: toText(result.causeChain),
    politics: toText(result.politics),
    economy: toText(result.economy),
    military: toText(result.military),
    technology: toText(result.technology),
    culture: toText(result.culture),
    society: toText(result.society),
    bordersAndAlliances: toText(result.bordersAndAlliances),
    ordinaryPeopleLife: toText(result.ordinaryPeopleLife),
    after5Years,
    after20Years,
    after50Years,
    fiveYears: after5Years,
    twentyYears: after20Years,
    fiftyYears: after50Years,
    modernWorldResult: toText(result.modernWorldResult),
    probabilityScore: Math.max(1, Math.min(100, Number(result.probabilityScore) || 50)),
    risks: toText(result.risks),
    sourcesNote: toText(result.sourcesNote),
    videoScriptVersion: toText(result.videoScriptVersion),
    voiceoverVersion: toText(result.voiceoverVersion),
    timeline: Array.isArray(result.timeline) ? result.timeline : [],
    causeEffectMap: Array.isArray(result.causeEffectMap) ? result.causeEffectMap : []
  };
}

function resultToText(result) {
  const timeline = Array.isArray(result.timeline)
    ? result.timeline.map((item) => `${item.year}. ${item.title}\n${item.description}\nВлияние: ${item.impactLevel}`).join("\n\n")
    : "";

  const map = Array.isArray(result.causeEffectMap)
    ? result.causeEffectMap.map((branch) => `${branch.branch}\n${Array.isArray(branch.items) ? branch.items.map((x) => `- ${x}`).join("\n") : ""}`).join("\n\n")
    : "";

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
  ].filter((part) => part !== undefined && part !== null).join("\n");
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
    text.includes("rate") ||
    text.includes("429");
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

      // Для твоего текущего frontend.
      result: normalized,

      // Для старых версий frontend, которые ждут текст.
      resultText: text,

      // Для версий frontend, которые читают поля напрямую.
      ...normalized
    });
  } catch (error) {
    return res.status(500).json({
      error: parseGeminiError(error)
    });
  }
}
