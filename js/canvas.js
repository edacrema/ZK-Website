/* ══════════════════════════════════════════════════
   ZETAKAPPA FUTURES — Canvas Particle Animation
   ══════════════════════════════════════════════════ */
(function () {
  const cvs = document.getElementById('cvs');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  let W, H, pts = [], raf;

  function resize() {
    W = cvs.width = window.innerWidth;
    H = cvs.height = window.innerHeight;
    // Reduce density on inner pages (no #hero = inner page)
    const density = document.getElementById('hero') ? 12000 : 18000;
    pts = Array.from({ length: Math.floor(W * H / density) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * .9 + .2,
      vx: (Math.random() - .5) * .13, vy: (Math.random() - .5) * .13,
      a: Math.random() * .38 + .06
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(0,221,180,.028)';
    ctx.lineWidth = 1;
    const g = 76;
    for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // connections + dots
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 115) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,221,180,${.048 * (1 - d / 115)})`;
          ctx.lineWidth = .5;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,221,180,${p.a})`;
      ctx.fill();
    });
    raf = requestAnimationFrame(draw);
  }

  // Pause when tab not visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      draw();
    }
  });

  window.addEventListener('resize', resize);
  resize();
  draw();
})();
