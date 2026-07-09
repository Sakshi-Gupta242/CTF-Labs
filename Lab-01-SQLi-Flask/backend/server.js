/**
 * server.js
 * ---------
 * ByteMart - a fake e-commerce backend for CTF Lab 01 (SQL Injection).
 *
 * ============================================================
 * INTENTIONAL VULNERABILITY (for CTF purposes only):
 * The `/api/products/search` and `/api/login` endpoints build raw
 * SQL strings via direct concatenation of user input. This is a
 * classic UNION-based / auth-bypass SQL Injection vulnerability
 * (CWE-89, OWASP A03:2021 - Injection).
 *
 * DO NOT use this pattern in real applications. Always use
 * parameterized queries / prepared statements (see db.js for the
 * correct pattern used in seeding).
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { db, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Very small in-memory session store for demo purposes.
const sessions = {};

function makeSessionToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Initialize DB with seed data on boot.
init();

// ---------------------------------------------------------------
// Health check
// ---------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'bytemart-backend' });
});

// ---------------------------------------------------------------
// VULNERABLE ENDPOINT #1: Product search (UNION-based SQLi)
//
// Example legitimate use:
//   GET /api/products/search?q=keyboard
//
// Example exploit (UNION-based extraction):
//   GET /api/products/search?q=' UNION SELECT id,flag_name,flag_value,1 FROM flags--
// ---------------------------------------------------------------
app.get('/api/products/search', (req, res) => {
  const q = req.query.q || '';

  // VULNERABLE: string concatenation directly into SQL.
  const sql = `SELECT id, name, description, price FROM products WHERE name LIKE '%${q}%'`;

  db.all(sql, [], (err, rows) => {
    if (err) {
      // Deliberately leak the SQL error to help players fingerprint
      // the injection point (common in real misconfigured apps too).
      return res.status(500).json({ error: err.message, sql_debug: sql });
    }
    res.json({ results: rows, count: rows.length });
  });
});

// ---------------------------------------------------------------
// VULNERABLE ENDPOINT #2: Login (auth bypass via SQLi)
//
// Example exploit:
//   POST /api/login
//   { "username": "admin' -- ", "password": "anything" }
// ---------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  // VULNERABLE: string concatenation directly into SQL.
  const sql = `SELECT id, username, role FROM users WHERE username = '${username}' AND password = '${password}'`;

  db.get(sql, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message, sql_debug: sql });
    }
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = makeSessionToken();
    sessions[token] = { userId: row.id, username: row.username, role: row.role };

    res.cookie('session_token', token, { httpOnly: true, sameSite: 'lax' });
    res.json({
      message: 'Login successful',
      user: { username: row.username, role: row.role }
    });
  });
});

// ---------------------------------------------------------------
// Authenticated "admin panel" - only reachable if session role === 'admin'
// This gives players a concrete goal: obtain admin session OR
// pull the flag straight out of the DB via injection (two solve paths).
// ---------------------------------------------------------------
function requireAuth(req, res, next) {
  const token = req.cookies.session_token;
  const session = sessions[token];
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.session = session;
  next();
}

app.get('/api/admin/panel', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin role required' });
  }

  db.get(`SELECT flag_value FROM flags WHERE flag_name = 'sqli_master_flag'`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      message: 'Welcome, admin. Here is the confidential flag.',
      flag: row.flag_value
    });
  });
});

app.get('/api/whoami', requireAuth, (req, res) => {
  res.json({ username: req.session.username, role: req.session.role });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.session_token;
  delete sessions[token];
  res.clearCookie('session_token');
  res.json({ message: 'Logged out' });
});

app.listen(PORT, () => {
  console.log(`[bytemart] backend listening on port ${PORT}`);
});
