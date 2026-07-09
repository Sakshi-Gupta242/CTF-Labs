/**
 * app.js
 * ------
 * Frontend logic for ByteMart demo store (Lab 01 - SQL Injection).
 * Plain vanilla JS, no build step, talks to backend via fetch().
 *
 * The API_BASE is resolved at runtime so this works both when opened
 * directly and when served behind Docker/nginx.
 */

const API_BASE = window.location.origin.replace(/:\d+$/, '') + ':4001';
// Fallback if the above doesn't resolve correctly in some environments:
const API = (window.__API_BASE__ || API_BASE);

const views = {
  shop: document.getElementById('view-shop'),
  login: document.getElementById('view-login'),
  admin: document.getElementById('view-admin')
};
const navButtons = {
  shop: document.getElementById('nav-shop'),
  login: document.getElementById('nav-login'),
  admin: document.getElementById('nav-admin')
};

function showView(name) {
  Object.keys(views).forEach(k => {
    views[k].style.display = k === name ? 'block' : 'none';
    navButtons[k].classList.toggle('active', k === name);
  });
  if (name === 'admin') checkAdmin();
}

navButtons.shop.addEventListener('click', () => showView('shop'));
navButtons.login.addEventListener('click', () => showView('login'));
navButtons.admin.addEventListener('click', () => showView('admin'));

// ---------------- Product search ----------------
async function searchProducts(query) {
  const errorBox = document.getElementById('search-error');
  const grid = document.getElementById('products-grid');
  errorBox.style.display = 'none';
  grid.innerHTML = '<p>Loading...</p>';

  try {
    const res = await fetch(`${API}/api/products/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      errorBox.style.display = 'block';
      errorBox.textContent = 'Server error: ' + (data.error || 'unknown error') +
        (data.sql_debug ? '\n\nDebug SQL:\n' + data.sql_debug : '');
      grid.innerHTML = '';
      return;
    }

    if (!data.results || data.results.length === 0) {
      grid.innerHTML = '<p>No products found.</p>';
      return;
    }

    grid.innerHTML = data.results.map(p => `
      <div class="product-card">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description || '')}</p>
        <p class="price">$${Number(p.price).toFixed(2)}</p>
      </div>
    `).join('');
  } catch (e) {
    errorBox.style.display = 'block';
    errorBox.textContent = 'Network error: ' + e.message;
    grid.innerHTML = '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('search-btn').addEventListener('click', () => {
  searchProducts(document.getElementById('search-input').value);
});
document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchProducts(e.target.value);
});

// Load default product list on page load
searchProducts('');

// ---------------- Login ----------------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-message');
  msg.textContent = '';

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      msg.style.color = '#f87171';
      msg.textContent = data.error + (data.sql_debug ? ('\nDebug SQL: ' + data.sql_debug) : '');
      return;
    }

    msg.style.color = '#4ade80';
    msg.textContent = `Welcome, ${data.user.username} (role: ${data.user.role})`;
  } catch (err) {
    msg.style.color = '#f87171';
    msg.textContent = 'Network error: ' + err.message;
  }
});

// ---------------- Admin panel ----------------
async function checkAdmin() {
  const status = document.getElementById('admin-status');
  const output = document.getElementById('admin-output');
  output.textContent = '';
  status.textContent = 'Checking session...';

  try {
    const who = await fetch(`${API}/api/whoami`, { credentials: 'include' });
    if (!who.ok) {
      status.textContent = 'You are not logged in. Please login first.';
      return;
    }
    const whoData = await who.json();
    status.textContent = `Logged in as ${whoData.username} (role: ${whoData.role})`;

    const panel = await fetch(`${API}/api/admin/panel`, { credentials: 'include' });
    const panelData = await panel.json();
    if (!panel.ok) {
      output.textContent = 'Access denied: ' + panelData.error;
      return;
    }
    output.textContent = panelData.message + '\n\nFLAG: ' + panelData.flag;
  } catch (e) {
    status.textContent = 'Error checking session: ' + e.message;
  }
}
