const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { retrieveRelevantStories, generateWisdomResponse, MODEL_NAME } = require('../services/wisdomAI');

const router = express.Router();
router.use(authenticateToken);

// Check if a person has stories available for wisdom chat
router.get('/person/:personId/availability', async (req, res) => {
  try {
    const { personId } = req.params;

    const personResult = await pool.query(
      'SELECT person_id, full_name, biography, occupation, place_of_birth, clan_name, village_origin FROM persons WHERE person_id = $1',
      [personId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const storiesResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(story_text)), 0) as total_text_length
       FROM stories
       WHERE person_id = $1 AND story_text IS NOT NULL AND story_text != ''`,
      [personId]
    );

    const storyCount = parseInt(storiesResult.rows[0].count);
    const totalTextLength = parseInt(storiesResult.rows[0].total_text_length);

    res.json({
      available: storyCount > 0,
      storyCount,
      totalTextLength,
      person: personResult.rows[0],
    });
  } catch (error) {
    console.error('Error checking wisdom chat availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Get chat history for a person
router.get('/person/:personId/history', async (req, res) => {
  try {
    const { personId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await pool.query(
      `SELECT chat_id, role, message, created_at
       FROM wisdom_chats
       WHERE person_id = $1 AND user_id = $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [personId, req.user.user_id, limit]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Send a message and get a wisdom response
router.post('/person/:personId/message', async (req, res) => {
  try {
    const { personId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Wisdom AI is not configured. GEMINI_API_KEY is missing.' });
    }

    // Get person details
    const personResult = await pool.query(
      'SELECT * FROM persons WHERE person_id = $1',
      [personId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const person = personResult.rows[0];

    // Check that the person has stories
    const storiesCheck = await pool.query(
      `SELECT COUNT(*) as count FROM stories
       WHERE person_id = $1 AND story_text IS NOT NULL AND story_text != ''`,
      [personId]
    );

    if (parseInt(storiesCheck.rows[0].count) === 0) {
      return res.status(400).json({
        error: 'This person has no recorded stories yet. Add oral history stories first to enable Wisdom Chat.'
      });
    }

    // Get conversation history (last 10 messages for context)
    const historyResult = await pool.query(
      `SELECT role, message FROM wisdom_chats
       WHERE person_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [personId, req.user.user_id]
    );

    const conversationHistory = historyResult.rows.reverse();

    // Retrieve relevant stories using RAG
    const stories = await retrieveRelevantStories(personId, message);

    // Save user message
    await pool.query(
      `INSERT INTO wisdom_chats (family_id, person_id, user_id, role, message)
       VALUES ($1, $2, $3, 'user', $4)`,
      [person.family_id, personId, req.user.user_id, message]
    );

    // Generate response with Gemini
    const { text, tokensUsed } = await generateWisdomResponse(
      person,
      stories,
      conversationHistory,
      message
    );

    // Save AI response
    const aiMessageResult = await pool.query(
      `INSERT INTO wisdom_chats (family_id, person_id, user_id, role, message, retrieved_story_ids, model, tokens_used)
       VALUES ($1, $2, $3, 'assistant', $4, $5, $6, $7)
       RETURNING chat_id, created_at`,
      [
        person.family_id,
        personId,
        req.user.user_id,
        text,
        stories.map((s) => s.story_id),
        MODEL_NAME,
        tokensUsed,
      ]
    );

    res.json({
      message: text,
      chatId: aiMessageResult.rows[0].chat_id,
      createdAt: aiMessageResult.rows[0].created_at,
      storiesRetrieved: stories.length,
      tokensUsed,
    });
  } catch (error) {
    console.error('Error in wisdom chat:', error);
    if (error.message && error.message.includes('API key not valid')) {
      return res.status(503).json({ error: 'Gemini API key is invalid. Please check your GEMINI_API_KEY environment variable.' });
    }
    res.status(500).json({ error: 'Failed to generate wisdom response' });
  }
});

// Clear chat history for a person
router.delete('/person/:personId/history', async (req, res) => {
  try {
    const { personId } = req.params;

    await pool.query(
      'DELETE FROM wisdom_chats WHERE person_id = $1 AND user_id = $2',
      [personId, req.user.user_id]
    );

    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Get wisdom chat stats for a family
router.get('/family/:familyId/stats', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;

    const totalChats = await pool.query(
      'SELECT COUNT(*) as count FROM wisdom_chats WHERE family_id = $1',
      [familyId]
    );

    const uniqueUsers = await pool.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM wisdom_chats WHERE family_id = $1',
      [familyId]
    );

    const personsWithStories = await pool.query(
      `SELECT COUNT(DISTINCT s.person_id) as count
       FROM stories s
       WHERE s.family_id = $1 AND s.story_text IS NOT NULL AND s.story_text != ''`,
      [familyId]
    );

    const totalTokens = await pool.query(
      'SELECT COALESCE(SUM(tokens_used), 0) as total FROM wisdom_chats WHERE family_id = $1',
      [familyId]
    );

    res.json({
      totalMessages: parseInt(totalChats.rows[0].count),
      uniqueUsers: parseInt(uniqueUsers.rows[0].count),
      personsWithStories: parseInt(personsWithStories.rows[0].count),
      totalTokensUsed: parseInt(totalTokens.rows[0].total),
    });
  } catch (error) {
    console.error('Error fetching wisdom chat stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
