const { getGeminiModel } = require('../utils/gemini');

// Gemini inline-data limit is ~20MB; keep headroom.
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

/**
 * Transcribe an audio buffer with Gemini. Returns the transcript text, or
 * null if transcription is unavailable (no key, oversized file, no speech).
 * Throws on API errors — callers decide whether to fail or continue.
 */
async function transcribeAudio(buffer, mimetype) {
  if (!process.env.GEMINI_API_KEY || !buffer || buffer.length === 0) return null;
  if (buffer.length > MAX_INLINE_BYTES) return null;

  const model = getGeminiModel();
  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimetype || 'audio/webm',
      },
    },
    {
      text: 'Transcribe this audio recording verbatim. This is an oral history / family story recording, possibly in English or an African language. Output only the spoken words as plain text — no timestamps, no speaker labels, no commentary. If the audio contains no intelligible speech, reply with an empty response.',
    },
  ]);

  const text = result.response.text().trim();
  return text || null;
}

module.exports = { transcribeAudio };
