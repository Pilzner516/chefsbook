import fs from 'fs';

const f = 'docs/landing-previews/concept-f.html';
let s = fs.readFileSync(f, 'utf8');

// === 20px SVGs (feature-row .ic + import-card .ico) ===
const svg20 = (path) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const GLOBE = svg20('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>');
const CAMERA = svg20('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
const MIC = svg20('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>');
const BRAIN = svg20('<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>');
const PEOPLE = svg20('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>');
const BOX = svg20('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>');
const STORE = svg20('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>');
const SYNC = svg20('<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>');
const HEART = svg20('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>');
const COMMENT = svg20('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');

// === 16px SVGs (flow-step icons) ===
const svg16 = (path, sw = 2) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const CAMERA16 = svg16('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
const CLIPBOARD16 = svg16('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>');
const CALENDAR16 = svg16('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');
const CART16 = svg16('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>');

// === 14px inline SVG for mv-url lock ===
const LOCK14 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

// === Heart glyph for comm "♥ 42" — small filled heart ===
const HEART12 = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.998 5.998 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

// === Apple + Play SVG badges (for app store badges) ===
const APPLE_BADGE = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/></svg>`;
const PLAY_BADGE = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 20.5V3.5c0-.4.2-.7.5-.9l10 8.5L3.5 21.4c-.3-.2-.5-.5-.5-.9zm13.3-9l2.4 2-2.4 2-2.3-2 2.3-2zm-2.2-1.9L4.8 2.4l11 6.4-1.7 1.8zm0 5.8l1.7 1.8-11 6.4 9.3-8.2z"/></svg>`;

// === Replacements ===
// Flow-step icons (16px)
s = s.replace(/<span class="ico">📸<\/span>/, `<span class="ico">${CAMERA16}</span>`);
s = s.replace(/<span class="ico">📋<\/span>/, `<span class="ico">${CLIPBOARD16}</span>`);
s = s.replace(/<span class="ico">📅<\/span>/, `<span class="ico">${CALENDAR16}</span>`);
s = s.replace(/<span class="ico">🛒<\/span>/, `<span class="ico">${CART16}</span>`);

// Feature rows (20px)
s = s.replace('<div class="ic">🌐</div>', `<div class="ic">${GLOBE}</div>`);
s = s.replace('<div class="ic">📷</div>', `<div class="ic">${CAMERA}</div>`);
s = s.replace('<div class="ic">🎙️</div>', `<div class="ic">${MIC}</div>`);
s = s.replace('<div class="ic">🧠</div>', `<div class="ic">${BRAIN}</div>`);
s = s.replace('<div class="ic">👨‍👩‍👧</div>', `<div class="ic">${PEOPLE}</div>`);
s = s.replace('<div class="ic">📦</div>', `<div class="ic">${BOX}</div>`);
s = s.replace('<div class="ic">🏪</div>', `<div class="ic">${STORE}</div>`);
s = s.replace('<div class="ic">👥</div>', `<div class="ic">${SYNC}</div>`);
s = s.replace('<div class="ic">❤️</div>', `<div class="ic">${HEART}</div>`);
s = s.replace('<div class="ic">💬</div>', `<div class="ic">${COMMENT}</div>`);
s = s.replace('<div class="ic">👨‍👩‍👧‍👦</div>', `<div class="ic">${PEOPLE}</div>`);

// Import cards (20px)
s = s.replace('<div class="ico">🌐</div>', `<div class="ico">${GLOBE}</div>`);
s = s.replace('<div class="ico">📷</div>', `<div class="ico">${CAMERA}</div>`);
s = s.replace('<div class="ico">🎙️</div>', `<div class="ico">${MIC}</div>`);

// URL bar lock
s = s.replace('<span class="lock">🔒</span>', `<span class="lock">${LOCK14}</span>`);

// Comm card: the heart character used in "♥ 42" (keep heart icon inline + number)
s = s.replace('<div class="heart">♥ 42</div>', `<div class="heart">${HEART12} <span>42</span></div>`);

// Marta ragù comment "She just saved your Nonna's ragù ❤️" — replace emoji heart with small SVG
s = s.replace(`ragù ❤️</p>`, `ragù</p>`);

// Platform diagram nodes — strip emoji, text only
s = s.replace('>📱 Import<', '>Import<');
s = s.replace('>📅 Plan<', '>Plan<');
s = s.replace('>🛒 Shop<', '>Shop<');
s = s.replace('>👨‍👩‍👧 Family<', '>Family<');
s = s.replace('>🌍 Translate<', '>Translate<');
s = s.replace('>❤️ Discover<', '>Discover<');

// App store badges — replace emoji with SVG
s = s.replace(
  '<a href="/auth" class="badge-app"><span>🍎</span><div><span class="store-sub">Download on the</span><span class="store-main">App Store</span></div></a>',
  `<a href="/auth" class="badge-app"><span class="badge-logo">${APPLE_BADGE}</span><div><span class="store-sub">Download on the</span><span class="store-main">App Store</span></div></a>`
);
s = s.replace(
  '<a href="/auth" class="badge-app"><span>▶</span><div><span class="store-sub">GET IT ON</span><span class="store-main">Google Play</span></div></a>',
  `<a href="/auth" class="badge-app"><span class="badge-logo">${PLAY_BADGE}</span><div><span class="store-sub">GET IT ON</span><span class="store-main">Google Play</span></div></a>`
);

// Footer flag strip — replace with elegant lang codes
s = s.replace('<span>🇬🇧 🇫🇷 🇪🇸 🇮🇹 🇩🇪</span>', '<span class="lang-codes">EN · FR · ES · IT · DE</span>');

fs.writeFileSync(f, s);
console.log('Done. Remaining emoji:');
const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F1E6}-\u{1F1FF}\u2665\u2764]+(?:\u200D[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])*/gu;
const m = (s.match(re) || []).filter(e => e !== '★★★★★' && e !== '✓');
if (m.length === 0) console.log('(none — only stars/checks remain)');
else m.forEach(e => console.log(' ' + e));
