// Original procedural vector art of Lofi the Yeti (white fur, blue face/hands/feet, dark shades).
// Drawn from scratch for this game — no copied artwork.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Jagged "fur" outline around an ellipse. */
export function furPath(cx: number, cy: number, rx: number, ry: number, spikes: number, depth: number, seed: number): string {
  // Soft tufts: valleys on the ellipse, quadratic control points pushed outwards.
  const r = rng(seed);
  const pt = (a: number, k: number) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  let d = '';
  for (let i = 0; i < spikes; i++) {
    const a0 = (i / spikes) * Math.PI * 2;
    const a1 = ((i + 1) / spikes) * Math.PI * 2;
    const am = (a0 + a1) / 2 + (r() - 0.5) * 0.15;
    const [x0, y0] = pt(a0, 1 - depth * 0.25);
    const [xm, ym] = pt(am, 1 + depth * (1.2 + r() * 1.1));
    const [x1, y1] = pt(a1, 1 - depth * 0.25);
    if (i === 0) d += `M${x0.toFixed(1)} ${y0.toFixed(1)} `;
    d += `Q${xm.toFixed(1)} ${ym.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)} `;
  }
  return d + 'Z';
}

export const PALETTE = {
  fur: '#ffffff',
  furShade: '#d9e3f0',
  skin: '#5b8ee6',
  skinDark: '#3f6fc4',
  shades: '#121a2e',
  board: '#ff5d6c',
  boardEdge: '#c23b4a',
  scarf: '#ffcf4a',
};

/** Side view, facing right, crouched on a snowboard. Origin: board bottom centre at (60,118) in a 120x124 box. */
export function lofiRiderSVG(): string {
  const P = PALETTE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 124" width="240" height="248">
  <defs>
    <linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${P.board}"/><stop offset="1" stop-color="#ff8a5c"/></linearGradient>
  </defs>
  <!-- back leg -->
  <path d="M44 84 Q36 98 40 108" stroke="${P.furShade}" stroke-width="13" stroke-linecap="round" fill="none"/>
  <ellipse cx="41" cy="110" rx="9" ry="5" fill="${P.skinDark}"/>
  <!-- body -->
  <path d="${furPath(56, 70, 25, 22, 18, 0.12, 7)}" fill="${P.fur}" stroke="${P.furShade}" stroke-width="1.5"/>
  <path d="M40 80 Q56 92 74 80" stroke="${P.furShade}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- front leg -->
  <path d="M68 84 Q82 94 78 108" stroke="${P.fur}" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M68 84 Q82 94 78 108" stroke="${P.furShade}" stroke-width="1.5" fill="none"/>
  <ellipse cx="80" cy="110" rx="10" ry="5" fill="${P.skin}"/>
  <!-- board -->
  <rect x="14" y="112" width="92" height="8" rx="4" fill="url(#b)"/>
  <rect x="14" y="117" width="92" height="3" rx="1.5" fill="${P.boardEdge}"/>
  <circle cx="22" cy="116" r="1.6" fill="#fff"/><circle cx="98" cy="116" r="1.6" fill="#fff"/>
  <!-- back arm -->
  <path d="M46 62 Q30 66 24 58" stroke="${P.furShade}" stroke-width="11" stroke-linecap="round" fill="none"/>
  <circle cx="22" cy="57" r="6" fill="${P.skinDark}"/>
  <!-- head -->
  <path d="${furPath(70, 38, 21, 20, 16, 0.16, 21)}" fill="${P.fur}" stroke="${P.furShade}" stroke-width="1.5"/>
  <path d="M66 30 Q70 22 86 26 Q94 34 90 48 Q84 56 72 52 Q62 46 66 30 Z" fill="${P.skin}"/>
  <path d="M74 48 Q82 52 89 47" stroke="${P.skinDark}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M72 47 Q81 44 90 45" stroke="${P.skinDark}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- shades -->
  <path d="M66 33 L93 31 L92 38 Q86 42 80 37 Q74 42 68 39 Z" fill="${P.shades}"/>
  <path d="M71 34 L76 34" stroke="#6ea8ff" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M84 33 L88 33" stroke="#6ea8ff" stroke-width="1.6" stroke-linecap="round"/>
  <!-- front arm -->
  <path d="M64 64 Q80 70 92 64" stroke="${P.fur}" stroke-width="12" stroke-linecap="round" fill="none"/>
  <path d="M64 64 Q80 70 92 64" stroke="${P.furShade}" stroke-width="1.2" fill="none"/>
  <circle cx="95" cy="63" r="6.5" fill="${P.skin}"/>
</svg>`;
}

/** Big front-facing head used for title screen & logo. */
export function lofiHeadSVG(size = 512): string {
  const P = PALETTE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">
  <path d="${furPath(100, 104, 76, 72, 30, 0.09, 99)}" fill="${P.fur}" stroke="${P.furShade}" stroke-width="2"/>
  <path d="${furPath(100, 106, 60, 56, 24, 0.06, 5)}" fill="${P.furShade}" opacity=".55"/>
  <path d="M52 92 Q54 58 100 56 Q146 58 148 92 Q150 140 100 148 Q50 140 52 92 Z" fill="${P.skin}"/>
  <path d="M58 82 Q100 70 142 82 L140 100 Q124 112 108 100 L100 96 L92 100 Q76 112 60 100 Z" fill="${P.shades}"/>
  <path d="M68 86 L84 84" stroke="#6ea8ff" stroke-width="4" stroke-linecap="round"/>
  <path d="M114 84 L130 86" stroke="#6ea8ff" stroke-width="4" stroke-linecap="round"/>
  <path d="M70 124 Q100 116 130 124 Q118 136 100 136 Q82 136 70 124 Z" fill="${P.skinDark}"/>
  <path d="M70 124 Q100 130 130 124" stroke="#2f5aa8" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;
}

export function svgToImage(svg: string): HTMLImageElement {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img;
}
