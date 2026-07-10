/**
 * server.js
 * ---------
 * Lab 02 — Stored XSS (Express)
 *
 * Minimal feedback API. Submissions are stored in an in-memory array
 * with NO sanitization. The vulnerability is triggered on the admin
 * panel frontend, which renders this data via innerHTML.
 *
 * INTENTIONAL (CTF only): Do not sanitize or encode user input here
 * or in the frontend admin view. See README.md for mitigations.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors({ origin: true }));
app.use(bodyParser.json());

// ---------------------------------------------------------------------------
// In-memory feedback store (resets when the container/process restarts)
// ---------------------------------------------------------------------------
/** @type {{ id: number, name: string, feedback: string, createdAt: string }[]} */
const feedbackStore = [];
let nextId = 1;

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'lab02-xss-backend', entries: feedbackStore.length });
});

// ---------------------------------------------------------------------------
// POST /api/feedback — submit feedback (stored verbatim)
// Body: { name: string, feedback: string }
// ---------------------------------------------------------------------------
app.post('/api/feedback', (req, res) => {
  const { name, feedback } = req.body;

  if (!name || !feedback) {
    return res.status(400).json({ error: 'Both name and feedback are required.' });
  }

  if (typeof name !== 'string' || typeof feedback !== 'string') {
    return res.status(400).json({ error: 'Invalid field types.' });
  }

  if (name.length > 100 || feedback.length > 2000) {
    return res.status(400).json({ error: 'Input exceeds maximum length.' });
  }

  const entry = {
    id: nextId++,
    name,
    feedback,
    createdAt: new Date().toISOString()
  };

  // Stored as-is — no HTML encoding or sanitization (intentional vulnerability)
  feedbackStore.push(entry);

  res.status(201).json({ message: 'Thank you for your feedback!', entry });
});

// ---------------------------------------------------------------------------
// GET /api/feedback — list all feedback (used by the admin panel)
// ---------------------------------------------------------------------------
app.get('/api/feedback', (_req, res) => {
  res.json({
    count: feedbackStore.length,
    feedback: [...feedbackStore].reverse()
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[lab02-xss] Backend listening on http://0.0.0.0:${PORT}`);
});
