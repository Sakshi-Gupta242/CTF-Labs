/**
 * app.js
 * ------
 * Frontend logic for Lab 02 — Stored XSS.
 *
 * The HOME view submits feedback to the Express API.
 * The ADMIN view fetches all feedback and renders it with innerHTML
 * without any encoding or sanitization — this is the intentional
 * stored XSS sink (CWE-79).
 *
 * DO NOT copy the renderFeedbackUnsafe() pattern into production code.
 */

// Resolve API base URL (works locally and inside Docker)
const API = (() => {
  if (window.__API_BASE__) return window.__API_BASE__;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4002`;
})();

// CTF flag — set as a readable cookie when the admin panel loads
const FLAG = 'FLAG{stored_xss_master}';

// ---------------------------------------------------------------------------
// View routing (Home ↔ Admin)
// ---------------------------------------------------------------------------

const views = {
  home: document.getElementById('view-home'),
  admin: document.getElementById('view-admin')
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === name);
  });

  if (name === 'admin') {
    initAdminPanel();
  }
}

document.querySelectorAll('[data-view]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    showView(el.dataset.view);
  });
});

// ---------------------------------------------------------------------------
// HOME — Feedback form submission
// ---------------------------------------------------------------------------

document.getElementById('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const feedback = document.getElementById('feedback').value.trim();
  const msg = document.getElementById('form-message');

  msg.textContent = '';
  msg.className = 'message';

  try {
    const res = await fetch(`${API}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, feedback })
    });

    const data = await res.json();

    if (!res.ok) {
      msg.classList.add('error');
      msg.textContent = data.error || 'Submission failed.';
      return;
    }

    msg.classList.add('success');
    msg.textContent = data.message;
    e.target.reset();
  } catch (err) {
    msg.classList.add('error');
    msg.textContent = `Network error: ${err.message}`;
  }
});

// ---------------------------------------------------------------------------
// ADMIN — Load and render feedback
// ---------------------------------------------------------------------------

/**
 * Set the CTF flag as a non-HttpOnly cookie so payloads like
 * alert(document.cookie) can capture it when the admin panel executes XSS.
 */
function setAdminFlagCookie() {
  document.cookie = `flag=${FLAG}; path=/`;
}

/**
 * VULNERABLE: Builds HTML from stored feedback and assigns via innerHTML.
 * Both `name` and `feedback` are injected raw — any HTML/JS is executed.
 *
 * @param {{ id: number, name: string, feedback: string, createdAt: string }[]} items
 */
function renderFeedbackUnsafe(items) {
  const container = document.getElementById('feedback-list');

  if (!items.length) {
    container.innerHTML = '<p class="muted">No feedback submitted yet.</p>';
    return;
  }

  // VULNERABLE — intentional stored XSS sink for CTF lab
  container.innerHTML = items.map((item) => `
    <article class="feedback-item" data-id="${item.id}">
      <header class="feedback-header">
        <strong class="feedback-name">${item.name}</strong>
        <time class="feedback-time">${formatTime(item.createdAt)}</time>
      </header>
      <div class="feedback-body">${item.feedback}</div>
    </article>
  `).join('');
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function loadFeedback() {
  const container = document.getElementById('feedback-list');
  container.innerHTML = '<p class="muted">Loading feedback...</p>';

  try {
    const res = await fetch(`${API}/api/feedback`);
    const data = await res.json();

    if (!res.ok) {
      container.innerHTML = `<p class="error">Failed to load feedback: ${data.error}</p>`;
      return;
    }

    renderFeedbackUnsafe(data.feedback);
  } catch (err) {
    container.innerHTML = `<p class="error">Network error: ${err.message}</p>`;
  }
}

function initAdminPanel() {
  setAdminFlagCookie();
  loadFeedback();
}

document.getElementById('refresh-btn').addEventListener('click', loadFeedback);

// Default view
showView('home');
