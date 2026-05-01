import { GoogleGenAI, Modality } from "@google/genai";

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
Create one cinematic alternative history illustration for a mobile web app.

Goal:
Show the overall changed world after the user's historical change.
The viewer should understand how politics, society, economy, military balance, technology, and daily life changed.

Scenario:
${title}

Region:
${region}

Period:
${period}

Short summary:
${summary}

Key historical change:
${changedPoint}

Immediate consequences:
${firstConsequences}

Politics:
${politics}

Economy:
${economy}

Military:
${military}

Technology:
${technology}

Culture:
${culture}

Modern result:
${modernWorld}

Visual style:
realistic cinematic digital concept art,
serious historical atmosphere,
wide narrative composition,
deep perspective,
rich environment detail,
dramatic lighting,
premium mobile app illustration,
historically grounded,
no text,
no letters,
no readable signs,
no captions,
no watermark,
no logo,
no UI.

Composition:
foreground: ordinary people and signs of changed daily life,
middle ground: government, army, industry, public order, institutions, or social change,
background: city, architecture, state symbols without readable text, and large-scale consequences.
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

function getParts(response) {
  return response?.candidates?.[0]?.content?.parts || response?.parts || [];
}

function extractImage(parts) {
  for (const part of parts) {
    if (part?.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }

    if (part?.inline_data?.data) {
      const mimeType = part.inline_data.mime_type || "image/png";
      return `data:${mimeType};base64,${part.inline_data.data}`;
    }
  }

  return "";
}

function extractText(parts) {
  return parts
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function tryModel(model, prompt, config) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config
  });

  const parts = getParts(response);
  const imageUrl = extractImage(parts);

  if (imageUrl) {
    return {
      model,
      imageUrl
    };
  }

  const text = extractText(parts);
  throw new Error(text || `Модель ${model} ответила без изображения.`);
}

async function generateGeminiImage(prompt) {
  const attempts = [
    {
      model: "gemini-2.5-flash-image",
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    },
    {
      model: "gemini-2.5-flash-image-preview",
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    },
    {
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    }
  ];

  const errors = [];

  for (const attempt of attempts) {
    try {
      return await tryModel(attempt.model, prompt, attempt.config);
    } catch (error) {
      errors.push(`${attempt.model}: ${parseGeminiError(error)}`);
    }
  }

  throw new Error(errors.join("\n\n"));
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
