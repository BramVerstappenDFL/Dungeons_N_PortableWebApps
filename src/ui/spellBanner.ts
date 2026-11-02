// Port of Grimoire's spellBanner (design system runtime helper): a deterministic abstract banner
// for a spell or attack. The same name and level always give the same picture.
/* eslint-disable prefer-const */

function seedFrom(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
function rng(seed: number): () => number {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function esc(s: string): string { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string); }
function n(x: number): number { return Math.round(x * 10) / 10; }
let W = 480, H = 160;

export function spellBanner(name: string, level: number, opts: { label?: boolean } = {}): string {
  let lvl = Math.max(0, Math.min(9, Math.round(Number(level) || 0)));
  let key = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  let seed = seedFrom(key);
  let R = rng(seed);
  let t = lvl / 9; // 0 = cantrip, 1 = 9th level
  let id = "gr" + seed.toString(36);

  // Colour: the name picks a tincture from the theme; the level sets how bright and how large the light is.
  let tinc = "var(--tincture-" + (1 + Math.floor(R() * 6)) + ")";
  function mix(a: string, pa: number, b: string) { return "color-mix(in srgb," + a + " " + pa + "%," + b + ")"; }
  let ground = mix(tinc, 24, "#0e0b08");
  let ground2 = mix(tinc, 8, "#0a0806");
  let glow = mix(tinc, Math.round(92 - 32 * t), "#fff");   // luminous tint of the tincture
  let core = mix(tinc, Math.round(48 - 40 * t), "#fff");   // nearly white at high levels
  let rim = mix(tinc, 18, "#fff");
  let dim = 0.85 + 0.15 * t;                               // overall brightness

  // Placement: the light sits near one edge so the banner crops it.
  let side = R() < 0.5 ? -1 : 1;
  let cx = side < 0 ? W * (0.03 + R() * 0.2) : W * (0.77 + R() * 0.2);
  let cy = H * (0.28 + R() * 0.44);
  let kinds = ["star", "ring", "orb"];
  let kind = kinds[Math.floor(R() * kinds.length)];
  let coreR = 7 + 17 * t;
  let haloR = 70 + 90 * t;
  let out = "";

  // Bloom: a wide blurred halo behind everything.
  out += '<g filter="url(#' + id + 'h)" style="mix-blend-mode:screen" opacity="' + n(0.6 + 0.4 * t) + '">' +
    '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(haloR) + '" fill="' + glow + '"/></g>';

  function flare(angle: number, len: number, w: number) {
    let ca = Math.cos(angle), sa = Math.sin(angle), px = -sa * w, py = ca * w;
    return '<path d="M' + n(cx + ca * len) + ' ' + n(cy + sa * len) + 'L' + n(cx + px) + ' ' + n(cy + py) + 'L' + n(cx - ca * len) + ' ' + n(cy - sa * len) + 'L' + n(cx - px) + ' ' + n(cy - py) + 'z"/>';
  }
  function arc(r: number, a0: number, a1: number, w: number) {
    let x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    return '<path d="M' + n(x0) + ' ' + n(y0) + 'A' + n(r) + ' ' + n(r) + ' 0 ' + ((a1 - a0) > Math.PI ? 1 : 0) + ' 1 ' + n(x1) + ' ' + n(y1) + '" fill="none" stroke="' + rim + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  }

  if (kind === "orb") {
    let orbR = 56 + 40 * t;
    out += '<defs><radialGradient id="' + id + 'o" cx="50%" cy="32%" r="75%"><stop offset="0" stop-color="' + core + '"/><stop offset="0.5" style="stop-color:' + glow + '"/><stop offset="1" stop-color="#0a0806"/></radialGradient></defs>' +
      '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(orbR) + '" fill="url(#' + id + 'o)" opacity="' + n(dim) + '"/>' +
      arc(orbR, Math.PI * 1.05, Math.PI * (1.7 + 0.2 * R()), n(1.5 + 1.5 * t)) +
      '<g filter="url(#' + id + 's)" fill="' + core + '"><ellipse cx="' + n(cx) + '" cy="' + n(cy - orbR * 0.25) + '" rx="' + n(orbR * 0.45) + '" ry="' + n(orbR * 0.25) + '"/></g>';
  } else {
    if (kind === "ring") {
      let rr = 62 + 46 * t, a0 = R() * Math.PI * 2;
      out += arc(rr, a0, a0 + Math.PI * (1.2 + 0.6 * R()), n(1.2 + 1.8 * t));
      if (lvl >= 4) out += arc(rr * 0.74, a0 + 2.4, a0 + 4.6, n(0.8 + 0.8 * t));
    }
    let longL = 60 + 130 * t, nRay = lvl < 2 ? 0 : 2 + Math.floor(t * 4);
    let rays = '<g filter="url(#' + id + 's)" fill="' + rim + '" opacity="' + n(dim) + '">';
    rays += flare(0, longL, 1.6 + 1.4 * t) + flare(Math.PI / 2, longL * 0.9, 1.6 + 1.4 * t);
    for (let i = 0; i < nRay; i++) rays += flare(R() * Math.PI, longL * (0.35 + 0.4 * R()), 0.8 + 0.8 * t);
    out += rays + '</g>';
    out += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(coreR * 1.8) + '" fill="' + glow + '" opacity="' + n(0.5 * dim) + '" filter="url(#' + id + 'h2)"/>';
    out += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(coreR) + '" fill="' + core + '" opacity="' + n(Math.min(1, 0.7 + 0.3 * t)) + '"/>';
  }

  let label = opts.label === false ? ' aria-hidden="true"' : ' role="img" aria-label="Abstract banner for ' + esc(name) + ', ' + (lvl === 0 ? "cantrip" : "level " + lvl) + '"';
  let sd = seed % 997;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice"' + label + '>' +
    '<defs><radialGradient id="' + id + 'g" cx="' + n(cx / W * 100) + '%" cy="' + n(cy / H * 100) + '%" r="90%"><stop offset="0" stop-color="' + ground + '"/><stop offset="1" stop-color="' + ground2 + '"/></radialGradient>' +
    '<filter id="' + id + 'h" x="-50%" y="-150%" width="200%" height="400%"><feGaussianBlur stdDeviation="' + n(20 + 10 * t) + '"/></filter>' +
    '<filter id="' + id + 'h2" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="' + n(4 + 3 * t) + '"/></filter>' +
    '<filter id="' + id + 's" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.9"/></filter>' +
    '<filter id="' + id + 'n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="' + sd + '" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>' +
    '<filter id="' + id + 'k" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="' + (sd + 7) + '" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 0 0 0 1"/><feFuncG type="discrete" tableValues="0 0 0 0 1"/><feFuncB type="discrete" tableValues="0 0 0 0 1"/></feComponentTransfer></filter>' +
    '<pattern id="' + id + 'p" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.75" fill="#000"/></pattern></defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'g)"/>' +
    out +
    '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'p)" opacity="0.26" style="mix-blend-mode:multiply"/>' +
    '<rect width="' + W + '" height="' + H + '" filter="url(#' + id + 'n)" opacity="0.9" style="mix-blend-mode:overlay"/>' +
    '<rect width="' + W + '" height="' + H + '" filter="url(#' + id + 'k)" opacity="0.42" style="mix-blend-mode:screen"/>' +
    '<rect width="' + W + '" height="' + H + '" filter="url(#' + id + 'k)" opacity="0.35" style="mix-blend-mode:multiply" transform="translate(1.5 1)"/>' +
    '</svg>';
}

const PALETTE = {
  parchment: ['#27408b', '#d9531e', '#d29a1c', '#7b3a9e', '#3f7d3a', '#b3261e'],
  dungeon: ['#93a6f0', '#f08a56', '#e6b43c', '#c58be6', '#72c06b', '#f0786b'],
};
const cache = new Map<string, string>();

/**
 * Banner as a data: URI for <img src>, recoloured for the theme. Parchment gets a paper ground with
 * ink-toned light and printed-in grain instead of the glowing dark ground (as in the design).
 */
export function bannerUri(name: string, level: number, theme: 'parchment' | 'dungeon'): string {
  const key = `${theme}|${name}|${level}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let svg = spellBanner(name, level, { label: false });
  if (theme === 'parchment') {
    svg = svg
      .replace(/<rect[^>]*filter="url\(#gr[a-z0-9]+k\)"[^>]*\/>/g, '')
      .replace(/#0e0b08/g, '#f8f0da')
      .replace(/#0a0806/g, '#e2d4b2')
      .replace(/,#fff\)/g, ',#1f1710)')
      .replace(/mix-blend-mode:screen/g, 'mix-blend-mode:multiply')
      .replace('opacity="0.26"', 'opacity="0.1"')
      .replace('opacity="0.9" style="mix-blend-mode:overlay"', 'opacity="0.35" style="mix-blend-mode:multiply"');
  }
  const pal = PALETTE[theme];
  svg = svg.replace(/var\(--tincture-(\d)\)/g, (_m, d: string) => pal[Number(d) - 1]);
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cache.set(key, uri);
  return uri;
}

/** The tincture the banner for `name` uses, for the hatched minimized bar. */
export function bannerTint(name: string): string {
  const key = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  const r = rng(seedFrom(key))();
  return `var(--tincture-${1 + Math.floor(r * 6)})`;
}
