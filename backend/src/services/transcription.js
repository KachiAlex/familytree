const { transcribeAudioGroq, isGroqConfigured } = require('../utils/groq');

// Groq Whisper accepts ~25MB uploads; keep headroom.
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

/**
 * Transcribe an audio buffer (Groq Whisper). Returns the transcript text, or
 * null if transcription is unavailable (no key, oversized file, no speech).
 * Throws on API errors — callers decide whether to fail or continue.
 */
async function transcribeAudio(buffer, mimetype) {
  if (!isGroqConfigured() || !buffer || buffer.length === 0) return null;
  if (buffer.length > MAX_AUDIO_BYTES) return null;
  return transcribeAudioGroq(buffer, mimetype);
}

module.exports = { transcribeAudio };
