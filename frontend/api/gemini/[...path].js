// Serverless proxy for Gemini generateContent — the VPS backend sits in a
// region where the Gemini API is geo-blocked, so calls relay through Vercel.
// The API key arrives in the `key` query param from the backend's own env;
// nothing is stored here. POST only, restricted to model generate endpoints.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const segs = req.query.path;
  const subpath = Array.isArray(segs) ? segs.join('/') : (segs || '');

  // Only allow model action endpoints, e.g. v1beta/models/gemini-3.8-flash:generateContent
  if (!/^v1beta\/models\/[\w.-]+:\w+$/.test(subpath)) {
    return res.status(400).json({ error: 'Unsupported path' });
  }

  const key = req.query.key;
  if (!key || typeof key !== 'string') {
    return res.status(401).json({ error: 'Missing API key' });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/${subpath}?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      }
    );
    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed' });
  }
};
