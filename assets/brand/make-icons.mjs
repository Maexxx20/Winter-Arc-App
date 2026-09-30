// Erzeugt alle App-Icons aus einer Vorlage. Start: node assets/brand/make-icons.mjs
// Braucht Playwright (Chromium) zum Rendern der SVGs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'images');

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx, cy, r, from, to) => {
  const [sx, sy] = polar(cx, cy, r, from);
  const [ex, ey] = polar(cx, cy, r, to);
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
};

// Stilisierte Eiger-Nordwand: langer Mittellegigrat links, Gipfel, steile Westflanke rechts.
const ridge = [
  [-10, 1034], [-10, 760], [110, 700], [170, 712], [260, 640], [330, 648], [430, 540],
  [490, 520], [548, 410], [600, 318], [646, 392], [700, 500], [760, 575], [850, 650],
  [940, 720], [1034, 790], [1034, 1034],
];
// Lichtkante: vom Gipfel schräg nach unten links – teilt Nordwand (Schatten) und Westflanke (Licht)
const face = [
  [600, 318], [646, 392], [700, 500], [760, 575], [850, 650], [940, 720], [1034, 790], [1034, 1034],
  [455, 1034], [492, 860], [530, 735], [548, 640], [578, 548], [585, 450],
];
// Schneebänder in der Nordwand (Rampe, Spinne) – nur im farbigen Icon
const bands = [
  [[610, 560], [680, 585], [700, 610], [640, 600]],
  [[590, 690], [700, 700], [770, 740], [640, 735]],
];
// Punkte am unteren Rand der Vorlage (y > 1000) bleiben immer am Bildrand, auch wenn verkleinert wird.
const pts = (p, dx = 0, dy = 0, s = 1) =>
  p.map(([x, y]) => {
    const px = x < 0 ? -100 : x > 1024 ? 1124 : x * s + dx; // seitlich bis an den Rand
    const py = y > 1000 ? 1100 : y * s + dy; // unten bis an den Rand
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');

function mark({ ice = '#FFFFFF', shade = '#C9D7F6', arcTrack = 'rgba(255,255,255,0.22)', arcColor = '#FFFFFF', knobFill = '#2657D9', scale = 1, dx = 0, dy = 0, mono = false, fade = false }) {
  if (fade) {
    // Freistehendes Zeichen (Splash): Berg läuft nach unten weich aus.
    return `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0.62" stop-color="#fff"/><stop offset="0.9" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="m"><rect width="1024" height="1024" fill="url(#f)"/></mask></defs>
      <g mask="url(#m)">${mark({ ice, shade, arcTrack, arcColor, knobFill, scale, dx, dy, mono })}</g>`;
  }
  const cx = 512 * scale + dx, cy = 520 * scale + dy, r = 330 * scale, w = 34 * scale;
  const START = -130, END = 130, P = START + 260 * 0.66;
  const [kx, ky] = polar(cx, cy, r, P);
  return `
    <path d="${arc(cx, cy, r, START, END)}" stroke="${mono ? 'rgba(255,255,255,0.35)' : arcTrack}" stroke-width="${w}" stroke-linecap="round" fill="none"/>
    <path d="${arc(cx, cy, r, START, P)}" stroke="${arcColor}" stroke-width="${w}" stroke-linecap="round" fill="none"/>
    <circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="${w * 0.95}" fill="${mono ? '#FFFFFF' : knobFill}" stroke="${arcColor}" stroke-width="${w * 0.55}"/>
    <polygon points="${pts(ridge, dx, dy, scale)}" fill="${ice}"/>
    ${mono ? '' : `<polygon points="${pts(face, dx, dy, scale)}" fill="${shade}"/>`}
    ${mono ? '' : bands.map((b) => `<polygon points="${pts(b, dx, dy, scale)}" fill="${ice}" opacity="0.75"/>`).join('')}
  `;
}

const BG = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#0E2560"/><stop offset="0.55" stop-color="#1E4BC4"/><stop offset="1" stop-color="#4F82F2"/></linearGradient></defs>`;

const svgs = {
  // iOS / allgemein: voll, ohne Transparenz
  'icon.png': [1024, `${BG}<rect width="1024" height="1024" fill="url(#bg)"/>${mark({})}`],
  // Android adaptive: Vordergrund im sicheren Bereich (66 %), Hintergrund separat
  'android-icon-foreground.png': [1024, mark({ scale: 0.62, dx: 195, dy: 180 })],
  'android-icon-background.png': [1024, `${BG}<rect width="1024" height="1024" fill="url(#bg)"/>`],
  'android-icon-monochrome.png': [1024, mark({ scale: 0.62, dx: 195, dy: 180, mono: true })],
  // Splash: Zeichen in Markenblau auf hellem Grund
  'splash-icon.png': [1024, mark({ ice: '#2657D9', shade: '#1B3F9E', arcTrack: 'rgba(38,87,217,0.18)', arcColor: '#2657D9', knobFill: '#FFFFFF', fade: true })],
  'favicon.png': [1024, `${BG}<rect width="1024" height="1024" rx="220" fill="url(#bg)"/>${mark({})}`],
};

const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [file, [size, body]] of Object.entries(svgs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
  if (file === 'icon.png') fs.writeFileSync(path.join(here, 'icon.svg'), svg);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const buf = await page.locator('svg').screenshot({ omitBackground: true });
  fs.writeFileSync(path.join(out, file), buf);
  console.log('✓', file);
}
await browser.close();
