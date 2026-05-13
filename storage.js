/**
 * storage.js — обёртка над localStorage.
 * Все ключи начинаются с префикса TOD_ чтобы не пересекаться с другими приложениями.
 */
window.Storage = (function () {
  const PREFIX = 'TOD_';
  const KEYS = {
    players:      PREFIX + 'players',
    mode:         PREFIX + 'mode',
    intensity:    PREFIX + 'intensity',
    seenCards:    PREFIX + 'seenCards',
    sound:        PREFIX + 'sound',
    vibration:    PREFIX + 'vibration',
    onboardingOk: PREFIX + 'onboardingOk',
    mockAds:      PREFIX + 'mockAds'
  };

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set failed', e);
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  // === Игроки + пол ===
  function getPlayers() {
    return get(KEYS.players, {
      p1: 'Игрок 1', p2: 'Игрок 2',
      g1: 'female',  g2: 'male'
    });
  }
  function setPlayers(p1, p2, g1, g2) {
    set(KEYS.players, {
      p1: p1 || 'Игрок 1',
      p2: p2 || 'Игрок 2',
      g1: g1 || 'female',
      g2: g2 || 'male'
    });
  }

  // === Режим ===
  function getMode() { return get(KEYS.mode, 'mixed'); }
  function setMode(mode) { set(KEYS.mode, mode); }

  // === Интенсивность ===
  function getIntensity() {
    return get(KEYS.intensity, window.GAME_CONFIG.defaultMaxIntensity);
  }
  function setIntensity(level) {
    const lvl = Math.max(1, Math.min(5, parseInt(level, 10) || 3));
    set(KEYS.intensity, lvl);
  }

  // === Просмотренные карточки ===
  function getSeenCards() { return get(KEYS.seenCards, []); }
  function addSeenCard(id) {
    const seen = getSeenCards();
    if (!seen.includes(id)) seen.push(id);
    set(KEYS.seenCards, seen);
  }
  function resetSeenCards() { set(KEYS.seenCards, []); }

  // === Звук и вибрация ===
  function getSound() { return get(KEYS.sound, window.GAME_CONFIG.enableSound); }
  function setSound(v) { set(KEYS.sound, !!v); }
  function getVibration() { return get(KEYS.vibration, window.GAME_CONFIG.enableVibration); }
  function setVibration(v) { set(KEYS.vibration, !!v); }

  // === Онбординг ===
  function isOnboarded() { return get(KEYS.onboardingOk, false); }
  function setOnboarded() { set(KEYS.onboardingOk, true); }

  // === Mock Ads (можно переключить в dev-панели) ===
  function getMockAds() { return get(KEYS.mockAds, window.GAME_CONFIG.mockAds); }
  function setMockAds(v) { set(KEYS.mockAds, !!v); }

  // === Полный сброс ===
  function resetAll() {
    Object.values(KEYS).forEach(remove);
  }

  return {
    KEYS,
    get, set, remove,
    getPlayers, setPlayers,
    getMode, setMode,
    getIntensity, setIntensity,
    getSeenCards, addSeenCard, resetSeenCards,
    getSound, setSound, getVibration, setVibration,
    isOnboarded, setOnboarded,
    getMockAds, setMockAds,
    resetAll
  };
})();
