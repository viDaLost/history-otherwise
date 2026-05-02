import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  maxDuration: 60
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODELS = [
“gemini-3.1-flash-lite”,
“gemini-2.5-flash-lite”,
“gemini-2.5-flash”,
“gemini-3-flash”
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
Ты исторический аналитик, редактор и сценарист альтернативной истории.

Создай конкретную альтернативную ветку истории на русском языке.

Данные пользователя:
Событие: ${input.eventTitle}
Регион: ${input.region}
Период: ${input.period}
Главное изменение: ${input.change}
Глубина анализа: ${input.depth}
Стиль: ${input.style}

Формат:
Верни только JSON.
Не используй markdown.
Не используй блоки кода.
Не добавляй текст вне JSON.
Не оставляй пустые поля.
Не пиши "нет данных".

Главное требование:
Пиши конкретно. В каждом разделе должны быть:
- годы или периоды
- участники событий: власть, армия, партии, страны, группы общества
- действия этих участников
- прямые последствия
- бытовые изменения для людей
- 1-2 слабых места сценария

Запрещено писать расплывчато:
- "меняется баланс сил" без объяснения кто получил власть
- "экономика развивается иначе" без объяснения отраслей, торговли, цен, ресурсов
- "общество делится" без объяснения групп и причин
- "мир становится другим" без примеров союзов, границ, конфликтов, технологий

Если пользователь ввёл коротко или с ошибкой в дате, не останавливайся.
Построй самый логичный сценарий.
Спорные места вынеси в risks и sourcesNote.

Требования к полям:
title: короткое название сценария.
shortSummary: 3 конкретных предложения о новом ходе истории.
realHistoryContext: 3 предложения с реальным контекстом.
changedPoint: 3 предложения о точке изменения.
firstConsequences: 4 конкретных предложения о первых действиях сторон.
causeChain: 5 связанных шагов: причина -> действие -> результат.
politics: 4 предложения. Назови, кто управляет, какие институты усилились, кто потерял влияние.
economy: 4 предложения. Укажи отрасли, торговлю, ресурсы, цены, налоги или производство.
military: 4 предложения. Укажи армию, фронты, конфликты, мобилизацию или военные союзы.
technology: 3-4 предложения. Укажи отрасли, которые ускорились или замедлились.
culture: 3-4 предложения. Укажи школу, прессу, искусство, цензуру или общественную память.
society: 4 предложения. Укажи группы людей и как изменилась их жизнь.
bordersAndAlliances: 4 предложения. Укажи конкретные союзы, границы, дипломатические конфликты.
ordinaryPeopleLife: 4 предложения. Укажи работу, еду, цены, безопасность, свободы, быт.
after5Years: 4 конкретных предложения.
after20Years: 4 конкретных предложения.
after50Years: 4 конкретных предложения.
modernWorldResult: 4 конкретных предложения о современной карте мира.
probabilityScore: число от 1 до 100.
risks: 4 предложения о слабых местах сценария.
sourcesNote: 2 предложения. Отдели реальные факты от предположений.
videoScriptVersion: 6-8 предложений для короткого видео.
voiceoverVersion: 8-10 предложений для озвучки.

timeline:
Сделай 7 пунктов.
Каждый пункт:
year: год или период.
title: конкретное событие.
description: 2 предложения. Кто что сделал и к чему это привело.
impactLevel: высокий, средний или низкий.

causeEffectMap:
Сделай 6 ветвей:
1. Политика
2. Экономика
3. Войны
4. Технологии
5. Культура
6. Общество

В каждой ветви дай 4 конкретных пункта.
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
              temperature: 0.28,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              responseSchema
            }
          : {
              temperature: 0.25,
              maxOutputTokens: 8192
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
Не добавляй текст вне JSON.
Заполни все поля конкретными данными.

Данные пользователя:
Событие: ${input.eventTitle}
Регион: ${input.region}
Период: ${input.period}
Главное изменение: ${input.change}

Текст:
${String(text).slice(0, 7000)}
`;

  const generated = await callGemini(prompt, true);
  return parseLooseJson(generated.text);
}

function fallbackText(input, section) {
  const event = input.eventTitle || "историческое событие";
  const change = input.change || "заданное изменение";
  const region = input.region || "указанный регион";
  const period = input.period || "указанный период";

  const table = {
    realHistoryContext: `В реальной истории событие «${event}» связано с политическим кризисом, решениями элит и реакцией общества в регионе: ${region}. Период «${period}» задаёт исходную точку анализа. Дальше приложение строит альтернативную ветку как логическое предположение.`,
    changedPoint: `Главное изменение: ${change}. Это меняет порядок решений власти, поведение армии, позицию политических групп и реакцию населения. Первый эффект возникает сразу после того, как исходный ход событий срывается.`,
    firstConsequences: `В первые месяцы власть усиливает контроль над столицей, связью, транспортом и ключевыми ведомствами. Армия и полиция получают приказ удерживать порядок и блокировать радикальные группы. Противники нового курса уходят в подполье, эмиграцию или пытаются создать новый центр сопротивления. Обычные люди сталкиваются с проверками, нехваткой новостей и ростом тревоги.`,
    causeChain: `Сначала ломается исходный сценарий события. Затем власть или победившая сторона закрепляет контроль над армией, финансами и прессой. После этого меняются экономические решения, внешняя политика и система союзов. Через несколько лет новый курс становится частью государственного устройства. Через десятилетия меняется память о событии и место страны в мире.`,
    politics: `Политический центр усиливает исполнительную власть и снижает влияние радикальных оппонентов. Парламент, правительство или военное командование получают больше полномочий. Оппозиция делится на легальную часть и подпольные группы. Государство строит новую идеологию вокруг идеи спасения страны от кризиса.`,
    economy: `Экономика переходит к режиму стабилизации. Государство контролирует транспорт, банки, топливо, продовольствие и военные заказы. Частный бизнес сохраняется там, где он нужен для производства и торговли. Цены растут из-за неопределённости, но власти пытаются удержать снабжение крупных городов.`,
    military: `Армия становится главным гарантом нового порядка. Командование получает политическое влияние и право вмешиваться в кризисные регионы. Возможны локальные восстания и приграничные конфликты. Главная цель власти: не допустить распада страны и паралича фронтов или гарнизонов.`,
    technology: `Технологии развиваются вокруг нужд государства, связи, транспорта и военной промышленности. Ускоряются железные дороги, радио, производство оружия и управленческие системы. Гражданские инновации получают меньше ресурсов в периоды нестабильности. Позже часть военных технологий переходит в промышленность и быт.`,
    culture: `Культура становится инструментом объяснения нового курса. Школа, пресса и кино показывают событие как поворотный момент спасения страны. Часть художников и писателей поддерживает власть, часть уходит в эмиграцию или внутреннюю оппозицию. Память о проигравшей стороне становится предметом споров.`,
    society: `Общество делится на сторонников порядка, сторонников старого курса и людей, которые хотят выжить без участия в политике. Рабочие ждут зарплат и снабжения, крестьяне реагируют на налоги и землю, армия требует дисциплины. В городах растёт контроль над митингами и печатью. В быту люди сильнее зависят от государства и местной администрации.`,
    bordersAndAlliances: `Внешняя политика становится осторожнее. Страна ищет союзников, которые признают новый порядок и дадут кредиты, оружие или рынки. Соседи проверяют слабые места границ и поддерживают удобные им силы. Долгосрочно формируются новые союзы и зоны влияния.`,
    ordinaryPeopleLife: `Обычные люди ощущают изменения через цены, работу, мобилизацию, документы и новости. В городах важны хлеб, транспорт, отопление и безопасность улиц. В деревне главный вопрос: земля, налоги и призыв. Семьи стараются избегать политики, но новая власть всё равно входит в повседневную жизнь.`,
    after5Years: `Через 5 лет новый порядок уже закреплён законами, силовыми структурами и экономическими решениями. Часть оппозиции подавлена, часть встроена в легальную политику. Экономика восстанавливается медленно, потому что старые проблемы не исчезают. Внешние партнёры оценивают страну через её стабильность и военную силу.`,
    after20Years: `Через 20 лет вырастает поколение, которое знает это событие как официальную точку перелома. Политическая система становится привычной, но внутри неё сохраняются конфликты между реформаторами и силовыми группами. Промышленность и образование развиваются по государственным приоритетам. Международное положение зависит от того, насколько страна смогла избежать новых войн и распада.`,
    after50Years: `Через 50 лет альтернативный исход становится частью национальной мифологии. Учебники, памятники и праздники объясняют его как спасение или как упущенный шанс, в зависимости от позиции общества. Экономика и культура уже идут по другой траектории. Мир вокруг страны тоже меняется, потому что крупное событие не дало прежней цепочки последствий.`,
    modernWorldResult: `Современный мир в этой ветке имеет другой баланс сил, другие союзы и другую память о прошлом. Регион ${region} занимает иное место в дипломатии, торговле и военной безопасности. Некоторые конфликты не возникают в прежнем виде, но появляются новые линии напряжения. Главный итог: одно решение меняет не только власть, но и быт, культуру и международный порядок.`,
    risks: `Сценарий зависит от того, насколько армия, элиты и население приняли бы новый исход. Есть риск, что подавленное движение вернулось бы через подполье или внешнюю поддержку. Экономические трудности могли сорвать даже удачное политическое решение. Дата и формулировка пользователя требуют допущений, поэтому часть выводов остаётся оценочной.`,
    sourcesNote: `Реальные факты использованы как исходная точка. Всё после изменения является альтернативной реконструкцией, а не описанием настоящей истории.`,
    videoScriptVersion: `Представь, что ${change}. В этот момент история уходит с привычного пути. Власть, армия и общество реагируют иначе. Первые месяцы решают, кто удержит столицу, ресурсы и связь. Через несколько лет меняются законы, экономика и внешняя политика. Через десятилетия новый исход становится частью памяти страны. Такой сценарий показывает, как одно решение в прошлом создаёт другой мир в будущем.`,
    voiceoverVersion: `Что было бы, если ${change}? Сначала меняется сама точка кризиса. Власть пытается удержать управление, армия получает больше влияния, а противники нового курса ищут новый способ борьбы. Экономика перестраивается вокруг снабжения, контроля и восстановления. Обычные люди чувствуют это через цены, работу, безопасность и новости. Через 5 лет новый порядок уже закрепляется. Через 20 лет меняется поколение. Через 50 лет меняется историческая память. В итоге современный мир получает другую карту союзов, конфликтов и возможностей.`
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
      year: "+3 месяца",
      title: "Удержание управления",
      description: "Власть берёт под контроль связь, транспорт, финансы и ключевые города. Оппозиция теряет возможность быстро координировать действия.",
      impactLevel: "высокий"
    },
    {
      year: "+1 год",
      title: "Новый политический порядок",
      description: "Создаются новые правила, усиливаются силовые структуры и меняется роль партий. Общество получает меньше хаоса, но больше контроля.",
      impactLevel: "высокий"
    },
    {
      year: "+5 лет",
      title: "Закрепление курса",
      description: result.after5Years,
      impactLevel: "средний"
    },
    {
      year: "+20 лет",
      title: "Поколение новой ветки",
      description: result.after20Years,
      impactLevel: "средний"
    },
    {
      year: "+50 лет",
      title: "Новая историческая норма",
      description: result.after50Years,
      impactLevel: "средний"
    },
    {
      year: "Сегодня",
      title: "Иной современный мир",
      description: result.modernWorldResult,
      impactLevel: "высокий"
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

    const items = toText(fallback)
      .split(/[.!?]\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 4);

    return { branch, items };
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
