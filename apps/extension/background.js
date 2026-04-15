// ChefsBook extension background service worker.
// Handles import requests dispatched from the content script on chefsbk.app.

const API_BASE = 'https://chefsbk.app';

async function getSession() {
  return new Promise((resolve) => chrome.storage.local.get(['access_token', 'refresh_token', 'email'], resolve));
}

async function scrapeTabHtml(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => new Promise((resolve) => setTimeout(() => resolve(document.documentElement.outerHTML), 800)),
    });
    return res?.result || '';
  } catch {
    return '';
  }
}

async function openAndScrape(url) {
  // Open the target URL in a new background tab, wait for load, scrape, close.
  const tab = await chrome.tabs.create({ url, active: false });
  return new Promise((resolve) => {
    const onUpdate = (id, info) => {
      if (id !== tab.id || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdate);
      // Give recipe-plugin JS a beat to finish rendering
      setTimeout(async () => {
        const html = await scrapeTabHtml(tab.id);
        try { await chrome.tabs.remove(tab.id); } catch {}
        resolve(html);
      }, 1500);
    };
    chrome.tabs.onUpdated.addListener(onUpdate);
  });
}

async function importRecipe(url, html, token) {
  const res = await fetch(`${API_BASE}/api/extension/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, html, extraction_method: 'extension-html' }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'CHEFSBOOK_IMPORT_URL') return;
  (async () => {
    const { access_token } = await getSession();
    if (!access_token) {
      sendResponse({ ok: false, error: 'Please sign in to the ChefsBook extension first.' });
      return;
    }
    try {
      const html = await openAndScrape(msg.url);
      if (!html) {
        sendResponse({ ok: false, error: 'Could not read the recipe page.' });
        return;
      }
      const { ok, body } = await importRecipe(msg.url, html, access_token);
      sendResponse({ ok, recipe: body?.recipe ?? null, error: ok ? null : (body?.error ?? 'Import failed') });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message ?? e) });
    }
  })();
  return true; // async response
});
