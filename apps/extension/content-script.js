// ChefsBook extension content script.
//
// Responsibilities:
//   1. When active on chefsbk.app, inject a presence marker so the web app
//      can detect the extension and hand off imports via postMessage.
//   2. Listen for CHEFSBOOK_PDF_IMPORT messages from the web app and
//      forward them to the extension background/popup flow for browser-
//      side extraction (the page's own HTML is already rendered in the
//      user's tab, so we simply post it to /api/extension/import).

(function () {
  const API_BASE = 'https://chefsbk.app';

  // --- Presence marker (on chefsbk.app only) ---
  if (location.hostname === 'chefsbk.app' || location.hostname === 'www.chefsbk.app') {
    try {
      const marker = document.createElement('meta');
      marker.setAttribute('name', 'chefsbook-extension');
      marker.setAttribute('data-chefsbook-extension', 'true');
      marker.setAttribute('content', '1.1.0');
      document.head.appendChild(marker);
      // Also set a dataset flag on <html> for CSS/JS selectors
      document.documentElement.setAttribute('data-chefsbook-extension', '1');
    } catch {}

    // --- postMessage handoff from the web app ---
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.type !== 'CHEFSBOOK_PDF_IMPORT') return;
      const targetUrl = String(data.url ?? '');
      const requestId = data.requestId ?? null;
      if (!targetUrl) return;
      try {
        // Ask the background to open/pull the URL in a new tab, scrape the
        // rendered HTML, and import it — returns the created recipe id.
        chrome.runtime.sendMessage(
          { type: 'CHEFSBOOK_IMPORT_URL', url: targetUrl, requestId },
          (res) => {
            window.postMessage(
              { type: 'CHEFSBOOK_PDF_IMPORT_RESULT', requestId, ok: !!res?.ok, recipe: res?.recipe ?? null, error: res?.error ?? null },
              location.origin,
            );
          },
        );
      } catch (e) {
        window.postMessage(
          { type: 'CHEFSBOOK_PDF_IMPORT_RESULT', requestId, ok: false, error: String(e?.message ?? e) },
          location.origin,
        );
      }
    });
  }

  // Expose API base so debugging in DevTools is clearer
  try { window.__CHEFSBOOK_EXTENSION__ = { apiBase: API_BASE, version: '1.1.0' }; } catch {}
})();
