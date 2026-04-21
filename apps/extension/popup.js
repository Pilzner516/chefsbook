const API_BASE = 'https://chefsbk.app';

// Cloudflare-protected domains confirmed in session 145 crawl.
// On these sites we skip the server-side import entirely and go straight
// to browser-side HTML scraping — identical flow, just no wasted round-trip.
const PDF_FALLBACK_SITES = [
  'allrecipes.com', 'seriouseats.com', 'foodnetwork.com', 'food52.com',
  'epicurious.com', 'nytcooking.com', 'cooking.nytimes.com',
  'cooksillustrated.com', 'americastestkitchen.com', 'eatingwell.com',
  'marthastewart.com', 'tasteofhome.com', 'ohsheglows.com',
  'ambitiouskitchen.com', 'bakerbynature.com', 'skinnytaste.com',
  'damndelicious.net', 'gimmesomeoven.com', 'twopeasandtheirpod.com',
  'browneyedbaker.com', 'dinneratthezoo.com', 'crazyforcrust.com',
  'jocooks.com', 'thewoksoflife.com', 'thespruceeats.com',
  'cafedelites.com', 'therecipecritic.com', 'wellplated.com',
  'cookingclassy.com', 'natashaskitchen.com', 'spendwithpennies.com',
  'foodandwine.com', 'thepioneerwoman.com',
  'bbcgoodfood.com', 'jamieoliver.com', 'deliciousmagazine.co.uk',
  'olivemagazine.com', 'greatbritishchefs.com', 'lovefood.com',
  'waitrose.com', 'goodhousekeeping.com', 'nigella.com',
  'marmiton.org', 'cuisineaz.com', '750g.com', 'cuisineactuelle.fr',
  'chefkoch.de', 'lecker.de', 'essen-und-trinken.de', 'kochbar.de',
  'giallozafferano.it', 'cucchiaio.it', 'sale-pepe.it',
  'taste.com.au', 'womensweeklyfood.com.au', 'australiangoodtaste.com.au',
  'foodnetwork.ca', 'canadianliving.com', 'chatelaine.com',
];

function isPdfFallbackSite(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return PDF_FALLBACK_SITES.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
const SUPABASE_URL = 'https://api.chefsbk.app';
const SUPABASE_ANON_KEY = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE3NTEwMDAwMDAsICJleHAiOiAxOTA4NzY2NDAwfQ.ISQ5gkoYSYom-YNgj1PUk-h8Hd6E0MQHtvrEB7NR_zw';

const content = document.getElementById('content');

// ── Helpers ──

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

function clear() { content.textContent = ''; }

// ── Storage ──

async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['access_token', 'refresh_token', 'email'], resolve);
  });
}

async function saveSession(access_token, refresh_token, email) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ access_token, refresh_token, email }, resolve);
  });
}

async function clearSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['access_token', 'refresh_token', 'email'], resolve);
  });
}

// ── Supabase auth ──

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || err.msg || 'Login failed');
  }
  return res.json();
}

async function refreshTokenFn(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: token }),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Get current tab ──

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ── Get page HTML from active tab ──

async function getPageHtml(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Wait 500ms for recipe plugins (WPRM, Tasty, etc.) to finish rendering
        return new Promise((resolve) => {
          setTimeout(() => resolve(document.documentElement.outerHTML), 500);
        });
      },
    });
    return result?.result || '';
  } catch {
    return '';
  }
}

// ── Import recipe ──

async function importRecipe(url, html, token) {
  const res = await fetch(`${API_BASE}/api/extension/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ url, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Import failed');
  return data;
}

// ── UI: Login ──

function renderLogin(errorMsg) {
  clear();

  const form = el('form', { className: 'login-form' });

  const emailLabel = el('div', null, el('label', { textContent: 'Email' }), el('input', { type: 'email', id: 'email', value: '', placeholder: 'you@example.com', required: '' }));
  const passLabel = el('div', null, el('label', { textContent: 'Password' }), el('input', { type: 'password', id: 'password', value: '', placeholder: 'Password', required: '' }));
  form.appendChild(emailLabel);
  form.appendChild(passLabel);

  if (errorMsg) {
    form.appendChild(el('div', { className: 'status status-error', textContent: errorMsg }));
  }

  const btn = el('button', { type: 'submit', className: 'btn btn-primary', id: 'loginBtn', textContent: 'Sign in' });
  form.appendChild(btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const data = await signIn(email, password);
      await saveSession(data.access_token, data.refresh_token, email);
      renderSaveView(data.access_token, email);
    } catch (err) {
      renderLogin(err.message);
    }
  });

  content.appendChild(form);
}

// ── UI: Save view ──

async function renderSaveView(token, email) {
  clear();
  const tab = await getCurrentTab();
  const pageTitle = tab?.title || 'Current page';
  const pageUrl = tab?.url || '';

  // User bar
  const userBar = el('div', { className: 'user-bar' });
  userBar.appendChild(el('span', { textContent: email }));
  const signOutBtn = el('button', { textContent: 'Sign out' });
  signOutBtn.addEventListener('click', async () => { await clearSession(); renderLogin(); });
  userBar.appendChild(signOutBtn);
  content.appendChild(userBar);

  // Save section
  const saveSection = el('div', { className: 'save-section' });
  saveSection.appendChild(el('p', { className: 'page-title', textContent: pageTitle }));

  const saveBtn = el('button', { className: 'btn btn-green', textContent: 'Save to Chefsbook' });
  const isBlocked = isPdfFallbackSite(pageUrl);
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Your Sous Chef is fetching this recipe...';

    const html = await getPageHtml(tab?.id);

    saveBtn.textContent = 'Your Sous Chef is fetching this recipe...';

    try {
      const data = await importRecipe(pageUrl, html, token);
      saveSection.textContent = '';
      // Redirect based on content type (recipe or technique)
      const contentType = data.contentType || 'recipe';
      const item = contentType === 'technique' ? data.technique : data.recipe;
      const itemType = contentType === 'technique' ? 'technique' : 'recipe';
      const itemName = item.title;
      saveSection.appendChild(el('div', { className: 'status status-success', textContent: 'Saved "' + itemName + '"' }));
      const link = el('a', { className: 'view-link', href: API_BASE + '/' + itemType + '/' + item.id, target: '_blank', textContent: 'View ' + itemType + ' →' });
      saveSection.appendChild(link);
    } catch (err) {
      // Never leak raw parser / server-stack text to users — log for devtools,
      // show a calm message with a retry.
      console.error('[ChefsBook extension] import failed:', err);
      const raw = err && err.message ? String(err.message) : '';
      const isTechnical = /JSON|parse|Unexpected token|Expected|stop_reason|position \d+/i.test(raw);
      const friendly = isTechnical
        ? "Couldn't read this recipe. Try again, or open it in the web app."
        : raw || 'Import failed. Try again.';
      saveSection.textContent = '';
      saveSection.appendChild(el('div', { className: 'status status-error', textContent: friendly }));
      const retryBtn = el('button', { className: 'btn btn-outline', textContent: 'Try again' });
      retryBtn.addEventListener('click', () => location.reload());
      saveSection.appendChild(retryBtn);
    }
  });
  saveSection.appendChild(saveBtn);
  content.appendChild(saveSection);
}

// ── Init ──

async function init() {
  const session = await getSession();

  if (session.access_token) {
    const refreshed = await refreshTokenFn(session.refresh_token);
    if (refreshed) {
      await saveSession(refreshed.access_token, refreshed.refresh_token, session.email);
      renderSaveView(refreshed.access_token, session.email);
    } else {
      await clearSession();
      renderLogin('Session expired, please sign in again');
    }
  } else {
    renderLogin();
  }
}

init();
