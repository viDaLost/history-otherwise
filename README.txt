Исправление модели картинок

Ошибка на скрине говорит, что модель gemini-2.0-flash-preview-image-generation недоступна для твоего ключа или региона.

Что изменено:
1. Убрана gemini-2.0-flash-preview-image-generation.
2. Основная модель теперь gemini-2.5-flash-image.
3. Добавлены запасные модели:
   - gemini-2.5-flash-image-preview
   - gemini-3-pro-image-preview
4. responseModalities теперь передаётся через Modality.TEXT и Modality.IMAGE.
5. Если все модели не сработают, сайт покажет ошибки по каждой модели.

Что заменить:
1. package.json
2. api/generate-image.js

После замены:
1. Загрузи файлы в GitHub.
2. Сделай Redeploy в Vercel.
3. Нажми "Повторить генерацию картинки" или создай новый сценарий.

Если ошибка останется:
Gemini image generation недоступна для твоего ключа, региона или тарифа. Текстовая часть всё равно будет работать.
