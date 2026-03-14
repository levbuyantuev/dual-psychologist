import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const ANALYSIS_PROMPT = `Ты — эксперт по анализу дуальностей. Проанализируй переписку пользователя с психологом и выяви все внутренние противоречия (дуальности).

Для каждой найденной дуальности дай:
1. **Полюс А** и **Полюс Б** — два противоположных стремления/чувства
2. **Корень противоречия** — откуда оно растёт
3. **Как проявляется** — конкретные примеры из диалога (список)
4. **Интеграционная фраза** — фраза для проработки в формате: «Я признаю, что во мне есть и [А], и [Б], и я даю место обоим»
5. **Рекомендации** — 2-3 пункта для дальнейшей работы

Отвечай на русском. Формат ответа — структурированный текст с заголовками. Будь конкретным, опирайся на слова пользователя.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  try {
    const { messages } = req.body;

    const conversationText = messages
      .map((m: any) => `${m.role === 'user' ? 'Пользователь' : 'Психолог'}: ${m.content}`)
      .join('\n\n');

    const apiMessages = [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: `Вот переписка для анализа:\n\n${conversationText}` },
    ];

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        max_tokens: 2048,
        temperature: 0.5,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `DeepSeek API error: ${err}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'Не удалось выполнить анализ';

    return res.status(200).json({ content });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
