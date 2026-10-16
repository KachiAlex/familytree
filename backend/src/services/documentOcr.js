const { getGeminiModel } = require('../utils/gemini');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Fields the extractor may propose — constrained so callers can't smuggle
// arbitrary columns through.
const EXTRACTABLE_FIELDS = [
  'full_name', 'gender', 'date_of_birth', 'date_of_death', 'alive_status',
  'place_of_birth', 'occupation', 'biography', 'clan_name', 'village_origin',
];

/**
 * Fetch a document image and extract genealogical facts with Gemini vision.
 * Returns { fields: {...}, notes: string } — fields only contains keys the
 * document actually evidences. null when extraction is unavailable.
 */
async function extractDocumentFields(fileUrl, mimeType) {
  if (!process.env.GEMINI_API_KEY || !fileUrl) return null;
  if (!/^image\//.test(mimeType || '') && mimeType !== 'application/pdf') return null;

  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Document fetch failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

  const model = getGeminiModel({
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    { inlineData: { data: buffer.toString('base64'), mimeType } },
    {
      text: `This is a family document (certificate, letter, obituary, ID, newspaper clipping or handwritten record) from an African family archive.
Extract any genealogical facts about the person it concerns. Return JSON:
{
  "fields": { ...only keys from [${EXTRACTABLE_FIELDS.join(', ')}] that the document evidences },
  "notes": "one short paragraph summarizing what the document is and anything notable that doesn't fit the fields"
}
Rules: ISO dates (YYYY-MM-DD) where determinable; alive_status boolean only if death is evidenced; biography = a factual 1-2 sentence summary of life details found; omit keys you cannot evidence; do not guess.`,
    },
  ]);

  const parsed = JSON.parse(result.response.text() || '{}');
  const fields = {};
  for (const key of EXTRACTABLE_FIELDS) {
    if (parsed.fields && parsed.fields[key] !== undefined && parsed.fields[key] !== null && parsed.fields[key] !== '') {
      fields[key] = parsed.fields[key];
    }
  }
  return { fields, notes: parsed.notes || '' };
}

module.exports = { extractDocumentFields };
