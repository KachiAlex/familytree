const { getGeminiModel } = require('../utils/gemini');
const { generateText } = require('../utils/groq');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Fields the extractor may propose — constrained so callers can't smuggle
// arbitrary columns through.
const EXTRACTABLE_FIELDS = [
  'full_name', 'gender', 'date_of_birth', 'date_of_death', 'alive_status',
  'place_of_birth', 'occupation', 'biography', 'clan_name', 'village_origin',
];

const EXTRACTION_PROMPT = (fieldsRef) => `This is text from a family document (certificate, letter, obituary, ID, newspaper clipping or handwritten record) from an African family archive.
Extract any genealogical facts about the person it concerns. Return JSON:
{
  "fields": { ...only keys from [${fieldsRef}] that the document evidences },
  "notes": "one short paragraph summarizing what the document is and anything notable that doesn't fit the fields"
}
Rules: ISO dates (YYYY-MM-DD) where determinable; alive_status boolean only if death is evidenced; biography = a factual 1-2 sentence summary of life details found; omit keys you cannot evidence; do not guess.`;

function pickFields(parsed) {
  const fields = {};
  for (const key of EXTRACTABLE_FIELDS) {
    if (parsed.fields && parsed.fields[key] !== undefined && parsed.fields[key] !== null && parsed.fields[key] !== '') {
      fields[key] = parsed.fields[key];
    }
  }
  return { fields, notes: parsed.notes || '' };
}

// Vision path: Gemini reads the image directly. Only works when a reachable
// endpoint is configured (GEMINI_BASE_URL proxy) — the VPS itself is blocked.
async function extractWithGemini(buffer, mimeType) {
  if (!process.env.GEMINI_API_KEY) return null;
  const model = getGeminiModel({
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent([
    { inlineData: { data: buffer.toString('base64'), mimeType } },
    { text: EXTRACTION_PROMPT(EXTRACTABLE_FIELDS.join(', ')) },
  ]);
  return pickFields(JSON.parse(result.response.text() || '{}'));
}

// OCR path: OCR.space turns the document into raw text (reachable from the
// VPS), then Groq structures the text into fields. No vision model needed.
async function ocrSpaceText(buffer, mimeType) {
  const form = new FormData();
  form.append('apikey', process.env.OCRSPACE_API_KEY || 'helloworld');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  form.append('file', new Blob([buffer], { type: mimeType }), `document.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`);
  const resp = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
  if (!resp.ok) throw new Error(`OCR service error: ${resp.status}`);
  const data = await resp.json();
  const text = (data.ParsedResults || []).map((r) => r.ParsedText || '').join('\n').trim();
  if (data.IsErroredOnProcessing || !text) {
    throw new Error(data.ErrorMessage?.[0] || 'OCR produced no text');
  }
  return text.slice(0, 12000);
}

async function extractWithOcr(buffer, mimeType) {
  if (!process.env.GROQ_API_KEY) return null;
  const text = await ocrSpaceText(buffer, mimeType);
  const reply = await generateText([
    { role: 'system', content: 'You extract genealogical facts from document text. Reply with JSON only.' },
    { role: 'user', content: `${EXTRACTION_PROMPT(EXTRACTABLE_FIELDS.join(', '))}\n\n--- DOCUMENT TEXT ---\n${text}` },
  ], { maxTokens: 800, temperature: 0.2, json: true });
  return pickFields(JSON.parse(reply || '{}'));
}

/**
 * Fetch a document and extract genealogical facts. Tries Gemini vision first
 * (when a proxy endpoint exists), falls back to OCR.space + Groq.
 * Returns { fields, notes } or null when extraction is unavailable.
 */
async function extractDocumentFields(fileUrl, mimeType) {
  if (!fileUrl) return null;
  if (!/^image\//.test(mimeType || '') && mimeType !== 'application/pdf') return null;

  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Document fetch failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

  if (process.env.GEMINI_BASE_URL) {
    try {
      return await extractWithGemini(buffer, mimeType);
    } catch (err) {
      console.error('[ocr] Gemini path failed, falling back to OCR:', err.message);
    }
  }
  return extractWithOcr(buffer, mimeType);
}

module.exports = { extractDocumentFields };
