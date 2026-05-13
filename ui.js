/**
 * ui.js — переключение экранов, эффекты (конфетти), вспомогательные хелперы.
 */
window.UI = (function () {
  const screens = ['screen-onboarding', 'screen-home', 'screen-game', 'screen-stats'];

  function show(id) {
    screens.forEach(s => {
      const el = document.getElementById(s);
      if (!el) return;
      if (s === id) el.classList.add('active');
      else el.classList.remove('active');
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function on(id, evt, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, cb);
  }

  /**
   * Конфетти — простая канвас-вариация.
   */
  function confetti() {
    const c = document.createElement('canvas');
    c.className = 'confetti-canvas';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const W = c.width = window.innerWidth;
    const H = c.height = window.innerHeight;
    const N = 80;
    const colors = ['#ff6b9d', '#ffb1c8', '#ffd1dc', '#ff9eae', '#c2a3ff', '#a0e7e5'];
    const particles = [];
    for (let i = 0; i < N; i++) {
      particles.push({
        x: Math.random() * W,
        y: -20 - Math.random() * 60,
        r: 4 + Math.random() * 6,
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: -0.1 + Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    let t0 = performance.now();
    function frame(t) {
      const dt = (t - t0) / 16;
      t0 = t;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.08 * dt;
        p.rot += p.vr * dt;
        if (p.y < H + 40) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      if (alive > 0 && t < t0 + 4000) {
        requestAnimationFrame(frame);
      } else {
        c.remove();
      }
    }
    requestAnimationFrame(frame);
  }

  /**
   * Небольшое всплывающее уведомление.
   */
  function toast(text, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 250);
    }, ms || 1800);
  }

  /**
   * Окрашивает карточку под тип.
   */
  function cardClassForType(type) {
    return type === 'truth' ? 'card-truth' : 'card-dare';
  }

  return { show, setText, setHTML, on, confetti, toast, cardClassForType };
})();
