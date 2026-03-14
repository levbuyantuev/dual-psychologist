import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `Ты — «Дуальный Психолог», AI-ассистент для работы с внутренними противоречиями и дуальностями.

Твоя методика:
1. Внимательно слушай пользователя, задавай уточняющие вопросы
2. Выявляй внутренние противоречия (дуальности) в словах и чувствах
3. Используй технику признания: «Я признаю [чувство] и даю этому место и время»
4. Помогай увидеть оба полюса противоречия без осуждения
5. Направляй к интеграции — принятию обеих сторон как частей целого

Правила:
- Отвечай на русском языке
- Будь эмпатичным, тёплым, но не навязчивым
- Не давай медицинских диагнозов
- Не заменяй профессиональную психотерапию
- Если чувствуешь, что человеку нужна срочная помощь — рекомендуй обратиться к специалисту
- Используй короткие, ёмкие ответы (2-4 абзаца)
- Задавай один уточняющий вопрос в конце ответа`;

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

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
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
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `DeepSeek API error: ${err}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'Нет ответа';

    return res.status(200).json({ content });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
