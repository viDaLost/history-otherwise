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

function crop(value, limit = 900) {
  const text = cleanText(value);
  if (text.length <= limit) return text;
  return text.slice(0, limit).trim();
}

function buildIllustrationPrompt(payload) {
  const title = crop(payload.title, 180);
  const summary = crop(payload.shortSummary, 500);
  const changedPoint = crop(payload.changedPoint, 500);
  const firstConsequences = crop(payload.firstConsequences, 500);
  const politics = crop(payload.politics, 450);
  const economy = crop(payload.economy, 450);
  const military = crop(payload.military, 450);
  const technology = crop(payload.technology, 450);
  const culture = crop(payload.culture, 450);
  const modernWorld = crop(payload.modernWorldResult, 650);
  const period = crop(payload.period, 120);
  const region = crop(payload.region, 120);

  return `
Создай одну детальную иллюстрацию для мобильного приложения об альтернативной истории.

Главная задача:
Показать общее положение мира после изменения истории.
Зритель должен по картинке понять, как изменилась политика, общество, экономика, армия и повседневная жизнь.

Сценарий:
${title}

Регион:
${region}

Период:
${period}

Краткое резюме:
${summary}

Ключевое изменение:
${changedPoint}

Первые последствия:
${firstConsequences}

Политика:
${politics}

Экономика:
${economy}

Военная сфера:
${military}

Технологии:
${technology}

Культура:
${culture}

Современный итог:
${modernWorld}

Визуальный стиль:
кинематографичная историческая сцена,
реалистичный digital concept art,
широкая композиция,
глубина пространства,
много деталей,
серьёзная атмосфера,
свет как в драматическом фильме,
премиальный вид,
без текста,
без букв,
без подписей,
без водяных знаков,
без логотипов,
без интерфейса,
без плакатов с читаемыми словами.

Композиция:
на переднем плане покажи обычных людей и признаки новой повседневной жизни,
на среднем плане покажи власть, армию, промышленность или общественные изменения,
на дальнем плане покажи город, символы государства, архитектуру и масштаб последствий.
`;
}

function parseGeminiError(error) {
  const raw = error?.message || "Ошибка генерации изображения через Gemini.";
  try {
    const start = raw.indexOf("{");
    if (start >= 0) {
      const parsed = JSON.parse(raw.slice(start));
      return parsed?.error?.message || raw;
    }
  } catch {}
  return raw;
}

async function generateGeminiImage(prompt) {
  const models = [
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation"
  ];

  let lastError = "";

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt
      });

      const parts = response?.candidates?.[0]?.content?.parts || response?.parts || [];

      for (const part of parts) {
        if (part?.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          return {
            model,
            imageUrl: `data:${mimeType};base64,${part.inlineData.data}`
          };
        }

        if (part?.inline_data?.data) {
          const mimeType = part.inline_data.mime_type || "image/png";
          return {
            model,
            imageUrl: `data:${mimeType};base64,${part.inline_data.data}`
          };
        }
      }

      lastError = `Модель ${model} не вернула изображение.`;
    } catch (error) {
      lastError = parseGeminiError(error);
    }
  }

  throw new Error(lastError || "Gemini не вернул изображение.");
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
    const prompt = buildIllustrationPrompt(body);
    const image = await generateGeminiImage(prompt);

    return res.status(200).json({
      ok: true,
      imageUrl: image.imageUrl,
      imagePrompt: prompt,
      imageModel: image.model
    });
  } catch (error) {
    return res.status(500).json({
      error: parseGeminiError(error)
    });
  }
}
