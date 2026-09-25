/* Lightweight confetti burst on a throwaway canvas. No dependencies. */

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function confetti({ count = 140, origin = { x: 0.5, y: 0.35 }, spread = 1 } = {}) {
  if (reduced()) return;
  const css = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--mark', '--good', '--bad']
    .map(v => css.getPropertyValue(v).trim())
    .filter(Boolean)
    .concat(['#7FB2FF', '#FFFFFF']);

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 });
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);

  const ox = origin.x * W, oy = origin.y * H;
  const parts = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread;
    const speed = 7 + Math.random() * 9;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      color: colors[(Math.random() * colors.length) | 0],
    };
  });

  const start = performance.now();
  const life = 1900;
  function frame(now) {
    const t = now - start;
    c.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save();
      c.globalAlpha = Math.max(0, 1 - t / life);
      c.translate(p.x, p.y); c.rotate(p.r);
      c.fillStyle = p.color;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      c.restore();
    }
    if (t < life) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
