// Groq client — OpenAI-compatible API reachable from the production VPS
// (Gemini is geo-blocked there). Used for wisdom chat, biographies and
// audio transcription (whisper-large-v3).

const GROQ_API = 'https://api.groq.com/openai/v1';
const TEXT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';

const isGroqConfigured = () => Boolean(process.env.GROQ_API_KEY);

const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const callGroq = async (model, messages, { maxTokens, temperature, json }) => {
  const res = await fetch(`${GROQ_API}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Groq API ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
};

/**
 * Chat completion. `messages` is the OpenAI format array:
 *   [{role:'system'|'user'|'assistant', content:string}, ...]
 * On free-tier TPM rate limits: waits and retries once, then falls back to
 * the smaller model.
 */
async function generateText(messages, opts = {}) {
  if (!isGroqConfigured()) return null;
  const o = { maxTokens: 1024, temperature: 0.7, json: false, ...opts };
  try {
    return await callGroq(TEXT_MODEL, messages, o);
  } catch (err) {
    if (err.status !== 429) throw err;
    await sleep(3000);
    try {
      return await callGroq(TEXT_MODEL, messages, o);
    } catch (retryErr) {
      if (retryErr.status !== 429) throw retryErr;
      return callGroq(FALLBACK_MODEL, messages, o);
    }
  }
}

/**
 * Transcribe an audio buffer with Groq Whisper. Returns transcript text or
 * null when unavailable/no speech. Throws on API errors.
 */
async function transcribeAudioGroq(buffer, mimetype) {
  if (!isGroqConfigured() || !buffer || buffer.length === 0) return null;

  const ext = (mimetype || 'audio/webm').split('/')[1].split(';')[0] || 'webm';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype || 'audio/webm' }), `recording.${ext}`);
  form.append('model', WHISPER_MODEL);

  const res = await fetch(`${GROQ_API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq Whisper ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text || '').trim() || null;
}

module.exports = { generateText, transcribeAudioGroq, isGroqConfigured, TEXT_MODEL };
