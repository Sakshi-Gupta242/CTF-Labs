# Lab 01 — ByteMart: SQL Injection (UNION-based & Auth Bypass)

## Title
**ByteMart** — a vulnerable e-commerce demo store

## Difficulty
🟢 **Beginner** (Estimated solve time: 20–35 minutes)

## Learning Objectives
By completing this lab you will be able to:
- Identify SQL Injection points via error-based fingerprinting.
- Perform a **UNION-based SQL injection** to extract data from a table not exposed by the application UI.
- Perform an **authentication bypass** SQL injection against a login form.
- Understand why string concatenation into SQL queries is dangerous.
- Understand and apply the fix: parameterized queries / prepared statements.

## Technology Stack
- **Backend:** Node.js + Express 4 (vanilla REST API, no ORM)
- **Database:** SQLite3 (file-based, seeded on boot)
- **Frontend:** Vanilla HTML + CSS + JavaScript (no framework, no build step)
- **Web server (frontend):** Nginx (Alpine) serving static files
- **Containerization:** Docker + Docker Compose

## Folder Structure
```
Lab-01-SQLI/
├── backend/
│   ├── server.js          # Express app w/ intentional SQLi vulnerabilities
│   ├── db.js               # SQLite init + seed data
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Challenge Story
ByteMart is a scrappy online electronics store that outsourced its
backend to the lowest bidder. Their developer, in a rush to ship
before a demo, wrote raw SQL string concatenation everywhere and
promised to "fix it after launch." That launch was six months ago.

Rumor has it there's a confidential internal flag stored somewhere
in ByteMart's database — not in the `users` table, not visible in
any UI. Your job: find a way in.

## Vulnerability Description
Two endpoints build SQL queries via direct string concatenation of
user-supplied input:

1. `GET /api/products/search?q=...` — inserted directly into a
   `LIKE '%...%'` clause. A single quote breaks out of the string
   literal, enabling classic UNION-based injection.
2. `POST /api/login` — username and password are concatenated
   directly into a `WHERE username = '...' AND password = '...'`
   clause, enabling authentication bypass via SQL comment injection
   (e.g. `admin' -- `).

Both are instances of **CWE-89: Improper Neutralization of Special
Elements used in an SQL Command**.

## OWASP Mapping
- **OWASP Top 10 2021: A03:2021 – Injection**
- **OWASP Top 10 2021: A07:2021 – Identification and Authentication
  Failures** (for the login bypass specifically)
- **CWE-89** — SQL Injection

## Architecture
```
 ┌────────────┐        HTTP (port 8081)        ┌──────────────┐
 │  Browser   │ ─────────────────────────────▶ │  Nginx        │
 │ (frontend) │                                 │ (static files)│
 └────────────┘                                 └──────────────┘
        │
        │ fetch() calls to port 4001
        ▼
 ┌─────────────────────────────┐
 │  Express Backend (Node.js)  │
 │  - /api/products/search     │◀── VULNERABLE (UNION SQLi)
 │  - /api/login                │◀── VULNERABLE (Auth bypass SQLi)
 │  - /api/admin/panel          │◀── Flag delivery (role=admin gate)
 └──────────────┬───────────────┘
                │
                ▼
        ┌───────────────┐
        │  SQLite DB     │
        │  users         │
        │  products      │
        │  flags         │◀── Target table (not exposed via any legit endpoint)
        └───────────────┘
```

## Database Schema
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  email TEXT
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  category TEXT
);

CREATE TABLE flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flag_name TEXT,
  flag_value TEXT
);
```

## Seed Data
- 5 users (`admin`, `sophia_j`, `mike_dev`, `guest`, `support_bot`) with
  plaintext passwords (intentionally weak app, not the focus of this
  particular lab — see Lab 04/10 for auth-focused labs).
- 8 realistic products (keyboards, mice, desks, etc.).
- 1 row in `flags` table containing the master flag.

## Hidden Flag
```
CTF{sql1_1nj3ct10n_uni0n_s3l3ct_maSt3r}
```
The flag is stored in the `flags` table, reachable via:
- **Path A:** Direct UNION-based extraction through `/api/products/search`.
- **Path B:** Auth bypass into the `admin` account via `/api/login`,
  then retrieving it legitimately through `/api/admin/panel`.

## Flag Verification Logic
There is no separate "flag checker" service in this lab — the flag
is retrieved directly from the vulnerable application, mirroring
real-world SQLi exploitation. Players simply submit the extracted
string to their CTF platform / instructor for scoring.

## Walkthrough

### Path A — UNION-based extraction
1. Confirm the injection point by sending a single quote:
   ```
   GET /api/products/search?q='
   ```
   Observe the SQL error returned in the JSON response
   (`sql_debug` field shows the broken query — this app leaks it
   intentionally to help you learn column-count fingerprinting).

2. Determine the column count using `ORDER BY` or trial UNIONs.
   The `products` table query selects 4 columns:
   `id, name, description, price`.

3. Craft the UNION payload:
   ```
   GET /api/products/search?q=zzzzz' UNION SELECT id, flag_name, flag_value, 1 FROM flags--
   ```
   (`zzzzz` ensures the original `LIKE` clause matches nothing, so
   only your UNION row appears.)

4. The flag appears in the `description` field of the JSON response.

### Path B — Authentication bypass
1. Submit a login request with:
   ```json
   { "username": "admin' -- ", "password": "anything" }
   ```
   The trailing `-- ` comments out the `AND password = '...'` clause,
   so the query becomes `SELECT ... WHERE username = 'admin' -- ' AND password='anything'`,
   which authenticates as `admin` without knowing the real password.

2. Visit the Admin Panel tab in the UI (or call
   `GET /api/admin/panel` with the returned session cookie).

3. The flag is returned directly in the JSON response.

## Expected Solution
Either UNION-based extraction or auth-bypass-then-admin-panel is a
fully valid solve. Advanced players may also try boolean-based blind
injection against `/api/login` for practice, though the flag is
retrievable much faster via the two paths above.

## Hints
1. *(Easy)* Try putting a single quote (`'`) into the search box.
   What does the error tell you?
2. *(Medium)* If you can inject into a `SELECT`, can you `UNION`
   another `SELECT` onto it? How many columns does the original
   query return?
3. *(Medium)* The login form builds a query like
   `WHERE username = '<input>' AND password = '<input>'`. What
   SQL syntax lets you comment out the rest of a line?
4. *(Hard)* The flag isn't in the `users` table — think about what
   other tables might exist in a typical schema, and how UNION lets
   you read from any table the DB user can access.

## Hardening Guide
To fix this application:

1. **Use parameterized queries everywhere:**
   ```js
   // Vulnerable:
   db.all(`SELECT * FROM products WHERE name LIKE '%${q}%'`, ...)

   // Fixed:
   db.all(`SELECT * FROM products WHERE name LIKE ?`, [`%${q}%`], ...)
   ```
2. **Never concatenate user input into SQL strings**, even for
   "internal" or "trusted" endpoints.
3. **Remove SQL error leakage** (`sql_debug` field) from API
   responses in production — use generic error messages and log
   details server-side only.
4. **Hash passwords** (bcrypt/argon2) instead of storing plaintext —
   even with SQLi fixed, plaintext passwords are a liability.
5. **Apply least privilege** to the database user/connection so that
   even if injection occurred, the blast radius (e.g. access to a
   `flags`-equivalent sensitive table) is minimized.
6. **Add a Web Application Firewall (WAF)** rule set (e.g. OWASP
   CRS via ModSecurity) as defense-in-depth, not as a substitute for
   fixing the code.
7. **Enable prepared statement caching** in production ORMs
   (Sequelize, Prisma, Knex) — nearly all modern ORMs default to
   parameterized queries, so avoid hand-rolled SQL wherever possible.

## Deployment Instructions

### Prerequisites
- Docker Engine ≥ 20.10
- Docker Compose ≥ 1.29 (or Docker Compose V2 built into the Docker CLI)

### Build & Run
```bash
cd CTF-Labs/Lab-01-SQLI
docker compose up --build
```

### Access
- Frontend (Store UI): http://localhost:8081
- Backend API directly: http://localhost:4001/api/health

### Stop & Clean Up
```bash
docker compose down -v
```

### Run without Docker (local dev)
```bash
cd backend
npm install
node server.js
# In a second terminal, serve frontend/ with any static file server, e.g.:
cd ../frontend
python3 -m http.server 8081
```
