// Renders the Jugnu mark into the PNGs app.json points at. Run: npm run icons
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const out = (f) => path.join(__dirname, '..', 'assets', f);
fs.mkdirSync(path.join(__dirname, '..', 'assets'), { recursive: true });

// Drawn on the 108-unit adaptive-icon grid; the visible area is the middle 72 units (18..90).
function mark({ mono = false } = {}) {
  const glow = mono ? '#FFFFFF' : '#FFE45C';
  const white = '#FFFFFF';
  const body = mono ? '#FFFFFF' : '#FF8A3D';
  const head = mono ? '#FFFFFF' : '#2A2F55';
  const ant = mono ? '#FFFFFF' : '#FFD7A8';
  return `
    ${mono ? '' : `<circle cx="30" cy="32" r="0.8" fill="${white}" opacity="0.55"/>
    <circle cx="40" cy="26" r="0.6" fill="${white}" opacity="0.45"/>
    <circle cx="78" cy="68" r="0.7" fill="${white}" opacity="0.5"/>
    <circle cx="34" cy="76" r="0.8" fill="${white}" opacity="0.45"/>`}
    <path d="M34 58 L44.5 68.5 L62 51" fill="none" stroke="${glow}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 4.4"/>
    ${mono ? '' : `<circle cx="62.5" cy="50.5" r="14" fill="${glow}" opacity="0.08"/>
    <circle cx="62.5" cy="50.5" r="9" fill="${glow}" opacity="0.16"/>`}
    <g transform="translate(66 47) rotate(-45)">
      <ellipse cx="-1" cy="-3.4" rx="4.8" ry="2.2" fill="${white}" opacity="${mono ? 1 : 0.55}" transform="rotate(-20 -1 -3.4)"/>
      <ellipse cx="-1" cy="3.4" rx="4.8" ry="2.2" fill="${white}" opacity="${mono ? 1 : 0.55}" transform="rotate(20 -1 3.4)"/>
      <ellipse cx="-5" cy="0" rx="4.6" ry="3.6" fill="${glow}"/>
      <ellipse cx="0.6" cy="0" rx="3" ry="2.6" fill="${body}"/>
      <circle cx="3.9" cy="0" r="1.8" fill="${head}"/>
      <path d="M4.8 -0.9 L7.6 -3.2 M4.8 0.9 L7.6 3.2" fill="none" stroke="${ant}" stroke-width="0.8" stroke-linecap="round"/>
    </g>`;
}

const svg = (viewBox, inner, bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${bg ? `<rect x="-10" y="-10" width="130" height="130" fill="${bg}"/>` : ''}${inner}</svg>`);

async function main() {
  // Legacy/store icon: full-bleed square, cropped to the visible area.
  await sharp(svg('18 18 72 72', mark(), '#0F1A3C'), { density: 1200 }).resize(1024, 1024).png().toFile(out('icon.png'));
  // Adaptive icon layers use the whole 108 grid; the launcher masks the outside.
  await sharp(svg('0 0 108 108', mark()), { density: 1200 }).resize(1024, 1024).png().toFile(out('adaptive-foreground.png'));
  await sharp(svg('0 0 108 108', mark({ mono: true })), { density: 1200 }).resize(1024, 1024).png().toFile(out('adaptive-monochrome.png'));
  // Splash: the mark alone on the navy splash background.
  await sharp(svg('18 18 72 72', mark()), { density: 1200 }).resize(512, 512).png().toFile(out('splash-icon.png'));
  console.log('icons written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
