import { GoogleGenAI } from "@google/genai";

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

function buildPrompt(data) {
  const eventTitle = cleanText(data.eventTitle || data.title || data.event || "Не указано");
  const region = cleanText(data.region || data.country || "Не указано");
  const period = cleanText(data.period || data.year || data.date || "Не указано");
  const change = cleanText(data.change || data.mainChange || data.prompt || "");
  const depth = cleanText(data.depth || "Глубокий анализ");
  const style = cleanText(data.style || "Документальный");

  return `
Ты исторический аналитик, сценарист и редактор альтернативной истории.

Твоя задача: построить правдоподобную альтернативную ветку истории на русском языке.

Данные пользователя:

Событие:
${eventTitle}

Страна, регион или мир:
${region}

Дата или период:
${period}

Главное изменение:
${change}

Глубина анализа:
${depth}

Стиль ответа:
${style}

Правила ответа:

1. Отделяй реальные исторические факты от предположений.
2. Не выдавай выдуманные события за настоящие.
3. Не пиши хаотичный рассказ.
4. Покажи цепочку причин и последствий.
5. Объясни, какие последствия сильные, а какие спорные.
6. Пиши ясно, подробно и интересно.
7. Не уходи в магию, фантастику или случайные события без причин.
8. Делай акцент на политике, экономике, войнах, культуре, технологиях, границах, союзах и жизни обычных людей.
9. Ответ должен быть полезен для чтения, видео, озвучки и дальнейшей доработки.

Структура ответа:

Название сценария

Краткое резюме

Реальный исторический контекст

Точка изменения

Первые последствия

Цепочка причин и последствий

Политические последствия

Экономические последствия

Военные последствия

Технологические последствия

Культурные последствия

Изменение границ и союзов

Жизнь обычных людей

Временная линия:
сделай 8–12 пунктов.
У каждого пункта укажи год, название события, описание и уровень влияния.

Карта последствий:
раздели на ветви:
политика
экономика
войны
технологии
культура
общество

Итог через 5 лет

Итог через 20 лет

Итог через 50 лет

Современный мир в этой версии истории

Оценка правдоподобности от 1 до 100

Главные слабые места сценария

Короткая версия для видео

Версия для озвучки

Начинай сразу с результата.
`;
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
    const change = cleanText(body.change || body.mainChange || body.prompt || "");

    if (change.length < 10) {
      return res.status(400).json({
        error: "Опиши главное изменение подробнее. Нужно минимум 10 символов."
      });
    }

    if (change.length > 5000) {
      return res.status(400).json({
        error: "Текст слишком длинный. Сократи описание изменения до 5000 символов."
      });
    }

    const prompt = buildPrompt(body);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.75,
        maxOutputTokens: 8192
      }
    });

    const result = response.text || "";

    if (!result) {
      return res.status(500).json({
        error: "Gemini вернул пустой ответ. Попробуй ещё раз."
      });
    }

    return res.status(200).json({
      result
    });
  } catch (error) {
    const message = error?.message || "Ошибка генерации через Gemini API.";

    return res.status(500).json({
      error: message
    });
  }
}
