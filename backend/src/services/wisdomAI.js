const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../db/connection');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/**
 * Retrieve relevant stories for a person based on keyword matching.
 * Simple RAG: search stories by keyword overlap with the user's question.
 */
async function retrieveRelevantStories(personId, userQuestion, limit = 5) {
  // Extract keywords from the question (simple approach: split on whitespace, remove stopwords)
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
    'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'but', 'and', 'or', 'if', 'i',
    'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom',
    'this', 'that', 'these', 'those', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'about', 'like', 'tell',
    'give', 'know', 'think', 'say', 'want', 'make', 'go', 'see', 'get'
  ]);

  const keywords = userQuestion
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));

  if (keywords.length === 0) {
    // Fall back to most recent stories
    const result = await pool.query(
      `SELECT story_id, title, story_text, narrator_name, recorded_date, location
       FROM stories
       WHERE person_id = $1 AND story_text IS NOT NULL AND story_text != ''
       ORDER BY created_at DESC
       LIMIT $2`,
      [personId, limit]
    );
    return result.rows;
  }

  // Build keyword search conditions for PostgreSQL full-text search
  const searchTerms = keywords.map((k) => `${k}:*`).join(' | ');

  const result = await pool.query(
    `SELECT story_id, title, story_text, narrator_name, recorded_date, location,
            ts_rank_cd(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(story_text, '')), to_tsquery('english', $2)) as rank
     FROM stories
     WHERE person_id = $1
       AND story_text IS NOT NULL
       AND story_text != ''
       AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(story_text, '')) @@ to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [personId, searchTerms, limit]
  );

  // If full-text search returns nothing, fall back to ILIKE
  if (result.rows.length === 0) {
    const ilikeConditions = keywords.map((_, i) => `story_text ILIKE $${i + 2}`).join(' OR ');
    const ilikeParams = keywords.map((k) => `%${k}%`);

    const fallbackResult = await pool.query(
      `SELECT story_id, title, story_text, narrator_name, recorded_date, location
       FROM stories
       WHERE person_id = $1
         AND story_text IS NOT NULL
         AND story_text != ''
         AND (${ilikeConditions})
       ORDER BY created_at DESC
       LIMIT $${keywords.length + 2}`,
      [personId, ...ilikeParams, limit]
    );
    return fallbackResult.rows;
  }

  return result.rows;
}

/**
 * Build the system prompt that instructs Gemini to respond as the elder.
 */
function buildSystemPrompt(person, stories) {
  const storyContext = stories
    .map((s, i) => {
      let context = `Story ${i + 1}`;
      if (s.title) context += ` — "${s.title}"`;
      if (s.narrator_name) context += ` (narrated by ${s.narrator_name})`;
      if (s.recorded_date) context += ` [recorded ${s.recorded_date}]`;
      context += `:\n${s.story_text}`;
      return context;
    })
    .join('\n\n---\n\n');

  const personName = person.full_name || 'the elder';
  const personContext = [
    person.occupation ? `Occupation: ${person.occupation}` : null,
    person.place_of_birth ? `Born in: ${person.place_of_birth}` : null,
    person.clan_name ? `Clan: ${person.clan_name}` : null,
    person.village_origin ? `Village of origin: ${person.village_origin}` : null,
    person.biography ? `Biography: ${person.biography}` : null,
  ].filter(Boolean).join('\n');

  return `You are ${personName}, a respected family elder sharing wisdom with younger family members.

About ${personName}:
${personContext}

You are responding to a younger family member who has asked you a question. Answer as ${personName} would — drawing from your life experiences, the stories you've told, and the wisdom of your generation.

Here are stories that ${personName} has shared (these are your memories — speak from them naturally):

${storyContext}

Guidelines:
- Speak in first person as ${personName}. Use "I", "my", "when I was young", etc.
- Draw directly from the stories above when relevant. Reference specific events, people, and places you mentioned.
- If the question is about something not covered in your stories, share general wisdom that aligns with the values shown in your stories.
- Be warm, patient, and wise — like a grandparent speaking to a beloved grandchild.
- Keep responses concise (2-4 paragraphs) unless the question warrants more detail.
- If you don't know something, say so honestly — elders admit what they don't know.
- Do not break character. Do not mention that you are an AI or that these are recorded stories.
- Honor the cultural context: this is an African family elder sharing oral tradition and life wisdom.`;
}

/**
 * Generate a wisdom response using Gemini.
 */
async function generateWisdomResponse(person, stories, conversationHistory, userQuestion) {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: buildSystemPrompt(person, stories),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  // Build chat history for Gemini
  const history = conversationHistory.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.message }],
  }));

  const chat = model.startChat({
    history,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  const result = await chat.sendMessage(userQuestion);
  const response = result.response;
  const text = response.text();
  const usageMetadata = response.usageMetadata();

  return {
    text,
    tokensUsed: usageMetadata ? usageMetadata.totalTokenCount : null,
  };
}

module.exports = {
  retrieveRelevantStories,
  generateWisdomResponse,
  MODEL_NAME,
};
