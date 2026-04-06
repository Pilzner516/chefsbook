import { accessSync } from 'fs';

// ─── Title fallback ─────────────────────────────────────────────

/**
 * Generate a readable title from a URL slug.
 * e.g. "sous-vide-salmon-recipe" → "Sous Vide Salmon Recipe"
 */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop() ?? '';
    if (slug && slug.length > 3) {
      return slug
        .replace(/[-_]+/g, ' ')
        .replace(/\.\w+$/, '')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'Untitled Recipe';
  }
}

/**
 * Ensure a recipe object has a valid title.
 * Returns the title and whether it was auto-generated (needs review).
 */
export function ensureTitle(
  recipe: { title?: string | null },
  url: string,
): { title: string; generated: boolean } {
  if (recipe.title?.trim()) {
    return { title: recipe.title.trim(), generated: false };
  }
  return { title: titleFromUrl(url), generated: true };
}

// ─── Pre-flight URL validation ──────────────────────────────────

const REJECT_PATTERNS: { test: (u: URL) => boolean; error: string }[] = [
  {
    test: (u) => u.hostname.includes('google.') && u.pathname.startsWith('/search'),
    error: 'This is a search page, not a recipe. Please paste a direct recipe URL.',
  },
  {
    test: (u) => u.hostname.includes('google.') && (u.pathname.startsWith('/amp/') || u.pathname.startsWith('/url')),
    error: 'This is a Google redirect. Please paste the direct recipe URL.',
  },
  {
    test: (u) => /\/(recipes|recipe|category|categories|tag|tags|archive|search|results|browse)\/?$/i.test(u.pathname),
    error: 'This looks like a category or index page, not a specific recipe.',
  },
  {
    test: (u) => /\/(recipes?-by-|recipes?-list|all-recipes)/i.test(u.pathname),
    error: 'This looks like a recipe index page, not a specific recipe.',
  },
];

/**
 * Pre-flight URL check. Rejects URLs that are obviously not recipes.
 * Returns { ok: true } or { ok: false, error: "message" }.
 */
export function preflightUrl(url: string): { ok: boolean; error?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(u)) {
      return { ok: false, error: pattern.error };
    }
  }

  return { ok: true };
}

// ─── Fetch with fallback chain ──────────────────────────────────

const STANDARD_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetch a URL with a fallback chain: standard fetch → Puppeteer → ScrapingBee.
 * Returns the raw HTML and which method succeeded.
 */
export async function fetchWithFallback(
  url: string,
): Promise<{ html: string; method: 'fetch' | 'puppeteer' | 'scrapingbee' }> {
  // 1. Standard fetch
  let fetchError: string | null = null;
  try {
    const res = await fetch(url, {
      headers: STANDARD_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      return { html: await res.text(), method: 'fetch' };
    }
    fetchError = `HTTP ${res.status}`;
    if (res.status !== 403) {
      throw new Error(fetchError);
    }
  } catch (e: any) {
    if (!e.message?.includes('403')) throw e;
    fetchError = e.message;
  }

  // 2. Puppeteer (if system Chrome is available)
  try {
    const html = await fetchWithPuppeteer(url);
    if (html) return { html, method: 'puppeteer' };
  } catch {
    // Puppeteer failed or unavailable
  }

  // 3. ScrapingBee (if API key exists)
  const sbKey = process.env.SCRAPINGBEE_API_KEY;
  if (sbKey) {
    try {
      const res = await fetch(
        `https://app.scrapingbee.com/api/v1?${new URLSearchParams({
          api_key: sbKey,
          url,
          render_js: 'true',
        })}`,
        { signal: AbortSignal.timeout(30000) },
      );
      if (res.ok) {
        return { html: await res.text(), method: 'scrapingbee' };
      }
    } catch {
      // ScrapingBee also failed
    }
  }

  throw new Error(
    'This site blocked our request (403). Try the Chrome extension to import from this site.',
  );
}

// ─── Puppeteer helper ───────────────────────────────────────────

function findChromePath(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      accessSync(p);
      return p;
    } catch {
      // not found
    }
  }
  return null;
}

async function fetchWithPuppeteer(url: string): Promise<string | null> {
  let puppeteer: typeof import('puppeteer-core');
  try {
    puppeteer = await import('puppeteer-core');
  } catch {
    return null; // puppeteer-core not installed
  }

  const chromePath = findChromePath();
  if (!chromePath) return null;

  const browser = await puppeteer.default.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(STANDARD_HEADERS['User-Agent']);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}
