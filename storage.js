/**
 * storage.js — обёртка над localStorage.
 * Все ключи начинаются с префикса TOD_ чтобы не пересекаться с другими приложениями.
 *
 * Имена/пол игроков НЕ персистятся между загрузками страницы: они
 * хранятся в JS-памяти модуля. При обновлении страницы возвращаются
 * дефолты "Игрок 1" / "Игрок 2", а в рамках одной сессии подхватываются
 * введённые ранее значения. Остальные настройки (режим, интенсивность,
 * звук/вибрация, онбординг) живут в localStorage.
 */
window.Storage = (function () {
  const PREFIX = 'TOD_';
  const KEYS = {
    mode:         PREFIX + 'mode',
    seenCards:    PREFIX + 'seenCards',
    sound:        PREFIX + 'sound',
    vibration:    PREFIX + 'vibration',
    onboardingOk: PREFIX + 'onboardingOk',
    mockAds:      PREFIX + 'mockAds',
    rateGiven:    PREFIX + 'rateGiven' // true → больше никогда не показывать Rate Us
  };

  // Сессионные имена/пол игроков. Сбрасываются на reload страницы.
  let sessionPlayers = null;

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

  // === Игроки + пол (только в памяти, не в localStorage) ===
  function getPlayers() {
    if (sessionPlayers) return sessionPlayers;
    return { p1: 'Игрок 1', p2: 'Игрок 2', g1: 'female', g2: 'male' };
  }
  function setPlayers(p1, p2, g1, g2) {
    sessionPlayers = {
      p1: p1 || 'Игрок 1',
      p2: p2 || 'Игрок 2',
      g1: g1 || 'female',
      g2: g2 || 'male'
    };
  }

  // === Режим ===
  function getMode() {
    const m = get(KEYS.mode, 'romance');
    // Миграция со старых названий режимов на актуальные три.
    if (!['romance', 'flirt', 'passion'].includes(m)) return 'romance';
    return m;
  }
  function setMode(mode) { set(KEYS.mode, mode); }

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

  // === Rate Us (показывать после каждой партии, пока не нажал "Оценить") ===
  function getRateGiven() { return get(KEYS.rateGiven, false); }
  function setRateGiven(v) { set(KEYS.rateGiven, !!v); }

  // === Полный сброс ===
  function resetAll() {
    Object.values(KEYS).forEach(remove);
    sessionPlayers = null;
  }

  return {
    KEYS,
    get, set, remove,
    getPlayers, setPlayers,
    getMode, setMode,
    getSeenCards, addSeenCard, resetSeenCards,
    getSound, setSound, getVibration, setVibration,
    isOnboarded, setOnboarded,
    getMockAds, setMockAds,
    getRateGiven, setRateGiven,
    resetAll
  };
})();
