/**
 * audio.js — простые звуки и вибрация.
 * Используем WebAudio для генерации короткого "плинк" без файлов.
 */
window.AudioFX = (function () {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { ctx = null; }
    }
    return ctx;
  }

  function beep(freq, durationMs, type) {
    if (!window.Storage.getSound()) return;
    const c = ensureCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(c.destination);
    const now = c.currentTime;
    g.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    o.start(now);
    o.stop(now + durationMs / 1000 + 0.02);
  }

  function vibrate(pattern) {
    if (!window.Storage.getVibration()) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  return {
    flip:    () => { beep(520, 120, 'triangle'); vibrate(15); },
    done:    () => { beep(660, 180, 'sine');    vibrate([20, 40, 20]); },
    skip:    () => { beep(300, 120, 'sine');    vibrate(10); },
    confetti:() => { beep(880, 220, 'triangle'); vibrate([10, 30, 10, 30, 10]); }
  };
})();
