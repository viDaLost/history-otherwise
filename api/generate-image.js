import OpenAI from "openai";

export const config = {
  maxDuration: 60
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildIllustrationPrompt(payload) {
  const title = cleanText(payload.title);
  const summary = cleanText(payload.shortSummary);
  const changedPoint = cleanText(payload.changedPoint);
  const firstConsequences = cleanText(payload.firstConsequences);
  const politics = cleanText(payload.politics);
  const economy = cleanText(payload.economy);
  const military = cleanText(payload.military);
  const technology = cleanText(payload.technology);
  const culture = cleanText(payload.culture);
  const modernWorld = cleanText(payload.modernWorldResult);
  const period = cleanText(payload.period);
  const region = cleanText(payload.region);

  return `
Create one cinematic, informative illustration for a mobile app about alternative history.

Goal:
The image must help the viewer immediately understand how history changed after the user's change.
This is not a simple portrait.
Show the overall changed situation, atmosphere, and consequences in one coherent scene.

Subject:
Alternative history scenario title: ${title}
Region: ${region}
Period: ${period}

Scenario summary:
${summary}

Changed point:
${changedPoint}

Immediate consequences:
${firstConsequences}

Political consequences:
${politics}

Economic consequences:
${economy}

Military consequences:
${military}

Technological consequences:
${technology}

Cultural consequences:
${culture}

Modern world result:
${modernWorld}

Visual instructions:
- Show a panoramic narrative composition with foreground, middle ground, and background.
- Include key visual symbols of political change, economic change, military shift, and daily life.
- Show people, architecture, environment, and historical mood.
- The illustration should communicate "before vs after" through the scene itself, not through split panels.
- Make the changed timeline feel plausible and grounded.
- No text, no labels, no captions inside the image.
- No watermark.
- Premium digital illustration, realistic concept art, polished, dramatic lighting, high detail.
- Suitable for viewing on a phone screen.
`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Метод не поддерживается. Используй POST."
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "На сервере не найден OPENAI_API_KEY. Добавь ключ для генерации изображений в Vercel."
      });
    }

    const body = req.body || {};
    const prompt = buildIllustrationPrompt(body);

    const imageResponse = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    const item = imageResponse?.data?.[0] || {};
    const imageUrl = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : "");

    if (!imageUrl) {
      return res.status(500).json({
        error: "Сервис изображений не вернул картинку."
      });
    }

    return res.status(200).json({
      ok: true,
      imageUrl,
      imagePrompt: prompt
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Ошибка генерации иллюстрации."
    });
  }
}
