const { GoogleGenerativeAI } = require('@google/generative-ai');

// Shared Gemini client. The production VPS is in a region geo-blocked by the
// Gemini API, so when GEMINI_BASE_URL is set we route through the Vercel
// serverless proxy (/api/gemini/**) — the API key still travels in the query
// param from this env, nothing is stored on the proxy.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const requestOptions = process.env.GEMINI_BASE_URL
  ? { baseUrl: process.env.GEMINI_BASE_URL }
  : undefined;

const getGeminiModel = (params = {}) =>
  genAI.getGenerativeModel({ model: MODEL_NAME, ...params }, requestOptions);

module.exports = { getGeminiModel, MODEL_NAME };
