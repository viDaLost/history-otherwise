import OpenAI from "openai";

const MAX_TOTAL_LENGTH = 4200;

const scenarioSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    shortSummary: { type: "string" },
    realHistoryContext: { type: "string" },
    changedPoint: { type: "string" },
    probabilityScore: {
      type: "integer",
      minimum: 1,
      maximum: 100
    },
    firstConsequences: {
      type: "array",
      items: { type: "string" }
    },
    consequenceChain: {
      type: "array",
      items: { type: "string" }
    },
    politics: {
      type: "array",
      items: { type: "string" }
    },
    economy: {
      type: "array",
      items: { type: "string" }
    },
    military: {
      type: "array",
      items: { type: "string" }
    },
    technology: {
      type: "array",
      items: { type: "string" }
    },
    culture: {
      type: "array",
      items: { type: "string" }
    },
    society: {
      type: "array",
      items: { type: "string" }
    },
    bordersAndAlliances: {
      type: "array",
      items: { type: "string" }
    },
    ordinaryPeopleLife: { type: "string" },
    after5Years: { type: "string" },
    after20Years: { type: "string" },
    after50Years: { type: "string" },
    modernWorldResult: { type: "string" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          year: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          impactLevel: {
            type: "string",
            enum: ["низкий", "средний", "высокий", "критический"]
          }
        },
        required: ["year", "title", "description", "impactLevel"]
      }
    },
    causeEffectMap: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          branch: { type: "string" },
          items: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: { type: "string" }
          }
        },
        required: ["branch", "items"]
      }
    },
    risks: {
      type: "array",
      items: { type: "string" }
    },
    videoScriptVersion: { type: "string" },
    voiceoverVersion: { type: "string" },
    sourcesNote: { type: "string" }
  },
  required: [
    "title",
    "shortSummary",
    "realHistoryContext",
    "changedPoint",
    "probabilityScore",
    "firstConsequences",
    "consequenceChain",
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
    "timeline",
    "causeEffectMap",
    "risks",
    "videoScriptVersion",
    "voiceoverVersion",
    "sourcesNote"
  ]
};

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function validateInput(body) {
  const eventTitle = cleanString(body.eventTitle);
  const region = cleanString(body.region);
  const period = cleanString(body.period);
  const change = cleanString(body.change);
  const depth = cleanString(body.depth || "medium");
  const style = cleanString(body.style || "documentary");

  const missing = [];

  if (eventTitle.length < 3) missing.push("название события");
  if (region.length < 2) missing.push("страна или регион");
  if (period.length < 2) missing.push("дата или период");
  if (change.length < 12) missing.push("что именно изменилось");

  const totalLength = eventTitle.length + region.length + period.length + change.length;

  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Уточни: ${missing.join(", ")}. Так сценарий получится логичнее.`
    };
  }

  if (totalLength > MAX_TOTAL_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Текст слишком длинный. Сократи ввод до ${MAX_TOTAL_LENGTH} символов.`
    };
  }

  return {
    ok: true,
    data: {
      eventTitle,
      region,
      period,
      change,
      depth,
      style
    }
  };
}

function buildPrompt(data) {
  const depthMap = {
    short: "короткий анализ, без лишних деталей, но с логикой причин и последствий",
    medium: "средний анализ, с понятной структурой и ключевыми последствиями",
    deep: "глубокий анализ, с подробной политикой, экономикой, войнами, культурой, технологиями и бытом"
  };

  const styleMap = {
    documentary: "документальный стиль",
    dramatic: "драматичный стиль, но без превращения в фантастику",
    scientific: "научно-исторический стиль",
    chronicle: "краткая хроника по годам",
    video: "стиль сценария для видео"
  };

  return `
Ты исторический аналитик и сценарист альтернативной истории.

Твоя задача, построить правдоподобную альтернативную ветку истории на основе одного изменения, которое ввёл пользователь.

Правила:
1. Не выдавай фантастику без причин.
2. Сохраняй историческую логику.
3. Покажи цепочку причин и последствий.
4. Отделяй реальные исторические факты от предположений.
5. Не утверждай выдуманные события как реальные.
6. Пиши ясно, интересно и структурно.
7. Сначала объясни реальный исторический контекст.
8. Затем опиши точку изменения.
9. Затем покажи первые последствия.
10. Затем покажи долгие последствия.
11. Покажи сильные и слабые последствия.
12. Отдельно покажи спорные места сценария.
13. Пиши на русском языке.
14. Верни только JSON по заданной схеме.

Данные пользователя:
Название события: ${data.eventTitle}
Страна или регион: ${data.region}
Реальная дата или период: ${data.period}
Что изменилось: ${data.change}
Глубина анализа: ${depthMap[data.depth] || depthMap.medium}
Стиль ответа: ${styleMap[data.style] || styleMap.documentary}

Требования к timeline:
- Сделай 6-10 пунктов.
- Каждый пункт должен иметь год, название, описание и уровень влияния.
- Уровень влияния используй только: низкий, средний, высокий, критический.

Требования к causeEffectMap:
- Главное изменение находится в центре.
- Ветки: политика, экономика, войны, технологии, культура, общество.
- В каждой ветке 3-5 последствий.

Требования к probabilityScore:
- Дай оценку правдоподобности от 1 до 100.
- Не завышай оценку.
- Если сценарий спорный, честно снизь оценку.

Требования к videoScriptVersion:
- Сделай готовую краткую версию для YouTube-ролика.
- Без таймкодов.
- С сильным началом, основной частью и концовкой.

Требования к voiceoverVersion:
- Сделай текст для озвучки.
- Пиши плавно.
- Без сложной разметки.
`;
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text;

  const parts = [];

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Разрешён только POST-запрос."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, {
      error: "На сервере не задан OPENAI_API_KEY. Добавь ключ в переменные окружения."
    });
  }

  const body = normalizeBody(req);
  const validation = validateInput(body);

  if (!validation.ok) {
    return sendJson(res, validation.status, {
      error: validation.error
    });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Ты точный исторический аналитик. Ты возвращаешь только валидный JSON по схеме. Все выводы помечай как альтернативный сценарий, а не как реальные события."
        },
        {
          role: "user",
          content: buildPrompt(validation.data)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "alternative_history_scenario",
          strict: true,
          schema: scenarioSchema
        }
      },
      max_output_tokens: 5000
    });

    const outputText = extractOutputText(response);

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      return sendJson(res, 502, {
        error: "Модель вернула ответ, но JSON не удалось разобрать. Повтори запрос."
      });
    }

    return sendJson(res, 200, {
      result: parsed
    });
  } catch (error) {
    const message =
      error?.message ||
      "Не удалось получить ответ от OpenAI API. Проверь ключ, лимиты и подключение.";

    return sendJson(res, 500, {
      error: message
    });
  }
}
