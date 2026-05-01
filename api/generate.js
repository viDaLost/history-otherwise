import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  maxDuration: 60
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n\n");
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return "";
}

function normalizeResult(data) {
  const result = data && typeof data === "object" ? data : {};

  const after5Years = toText(result.after5Years || result.fiveYears || result.resultAfter5Years);
  const after20Years = toText(result.after20Years || result.twentyYears || result.resultAfter20Years);
  const after50Years = toText(result.after50Years || result.fiftyYears || result.resultAfter50Years);

  return {
    title: toText(result.title),
    shortSummary: toText(result.shortSummary),
    realHistoryContext: toText(result.realHistoryContext),
    changedPoint: toText(result.changedPoint),
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
    probabilityScore: Number(result.probabilityScore) || 50,
    risks: toText(result.risks),
    sourcesNote: toText(result.sourcesNote),
    videoScriptVersion: toText(result.videoScriptVersion),
    voiceoverVersion: toText(result.voiceoverVersion),
    timeline: Array.isArray(result.timeline) ? result.timeline : [],
    causeEffectMap: Array.isArray(result.causeEffectMap) ? result.causeEffectMap : []
  };
}

function buildPrompt(body) {
  const eventTitle = cleanText(body.eventTitle || body.title || body.event || "Не указано");
  const region = cleanText(body.region || body.country || "Не указано");
  const period = cleanText(body.period || body.year || body.date || "Не указано");
  const change = cleanText(body.change || body.mainChange || body.prompt || "");
  const depth = cleanText(body.depth || "Глубокий анализ");
  const style = cleanText(body.style || "Документальный");

  return `
Создай альтернативную историю на русском языке.

Данные пользователя:
Событие: ${eventTitle}
Регион: ${region}
Период: ${period}
Главное изменение: ${change}
Глубина анализа: ${depth}
Стиль: ${style}

Правила:
1. Отделяй реальные факты от предположений.
2. Не выдавай выдуманные события за реальные.
3. Покажи причинно-следственную логику.
4. Заполни все поля JSON.
5. Не оставляй пустые поля.
6. probabilityScore дай числом от 1 до 100.
7. timeline сделай из 8 пунктов.
8. causeEffectMap сделай из 6 ветвей: политика, экономика, войны, технологии, культура, общество.
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
    const change = cleanText(body.change || body.mainChange || body.prompt || "");

    if (change.length < 10) {
      return res.status(400).json({
        error: "Опиши главное изменение подробнее. Нужно минимум 10 символов."
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: buildPrompt(body),
      config: {
        temperature: 0.65,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    let parsed;

    try {
      parsed = JSON.parse(response.text || "{}");
    } catch {
      return res.status(500).json({
        error: "Gemini вернул не JSON. Попробуй ещё раз или уменьши запрос."
      });
    }

    return res.status(200).json(normalizeResult(parsed));
  } catch (error) {
    const rawMessage = error?.message || "Ошибка генерации через Gemini API.";
    let message = rawMessage;

    try {
      const jsonStart = rawMessage.indexOf("{");
      if (jsonStart >= 0) {
        const parsedError = JSON.parse(rawMessage.slice(jsonStart));
        message = parsedError?.error?.message || rawMessage;
      }
    } catch {}

    return res.status(500).json({
      error: message
    });
  }
}
