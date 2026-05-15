/**
 * storage.js — обёртка над localStorage с системой миграций сейва.
 * См. docs/SAVES.md (контракт) и migrations.js (реестр миграций).
 *
 * Внутри single-key: всё хранится в одном localStorage entry `TOD_save`.
 * Внешний API (window.Storage.*) совместим с прошлой multi-key версией —
 * gameplay-код не нужно править.
 *
 * Имена/пол игроков НЕ персистятся между загрузками страницы: они
 * хранятся в JS-памяти модуля. При обновлении страницы возвращаются
 * дефолты "Игрок 1" / "Игрок 2", а в рамках одной сессии подхватываются
 * введённые ранее значения.
 */
window.Storage = (function () {
  const STORAGE_KEY = 'TOD_save';

  // Legacy multi-key поля — оставлены здесь для одноразового collect'а
  // при первом запуске нового кода. После миграции v0→v1 эти ключи
  // в localStorage удаляются.
  const LEGACY_KEYS = {
    mode:         'TOD_mode',
    seenCards:    'TOD_seenCards',
    sound:        'TOD_sound',
    vibration:    'TOD_vibration',
    onboardingOk: 'TOD_onboardingOk',
    mockAds:      'TOD_mockAds',
    rateGiven:    'TOD_rateGiven'
  };

  function DEFAULTS() {
    return {
      schemaVersion: window.Migrations.getCurrentSchemaVersion(),
      mode:          'romance',
      seenCards:     [],
      sound:         window.GAME_CONFIG.enableSound,
      vibration:     window.GAME_CONFIG.enableVibration,
      onboardingOk:  false,
      mockAds:       window.GAME_CONFIG.mockAds,
      rateGiven:     false
    };
  }

  let cached = null;
  // Сессионные имена/пол игроков. Сбрасываются на reload страницы.
  let sessionPlayers = null;

  function loadFromLegacyMultiKeys() {
    const collected = {};
    let foundAny = false;
    for (const field in LEGACY_KEYS) {
      const lk = LEGACY_KEYS[field];
      const raw = localStorage.getItem(lk);
      if (raw !== null) {
        foundAny = true;
        try { collected[field] = JSON.parse(raw); } catch (e) { /* skip битое */ }
      }
    }
    return foundAny ? collected : null;
  }

  function cleanupLegacyKeys() {
    for (const field in LEGACY_KEYS) {
      try { localStorage.removeItem(LEGACY_KEYS[field]); } catch (e) {}
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch (e) {
      console.warn('[storage] save failed', e);
    }
  }

  function load() {
    if (cached) return cached;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let parsed = null;
      let fromVersion = 0;
      let cameFromLegacy = false;

      if (raw) {
        parsed = JSON.parse(raw);
        fromVersion = (typeof parsed.schemaVersion === 'number') ? parsed.schemaVersion : 0;
      } else {
        const legacy = loadFromLegacyMultiKeys();
        if (legacy) {
          parsed = legacy;
          fromVersion = 0;
          cameFromLegacy = true;
        }
      }

      if (parsed === null) {
        cached = DEFAULTS();
        persist();
        return cached;
      }

      const target = window.Migrations.getCurrentSchemaVersion();

      if (fromVersion > target) {
        console.warn('[storage] save schemaVersion=' + fromVersion + ' > code=' + target + ', resetting');
        try { localStorage.setItem(STORAGE_KEY + '_backup_future_v' + fromVersion, raw || JSON.stringify(parsed)); } catch (e) {}
        cached = DEFAULTS();
        persist();
        return cached;
      }

      let state = parsed;
      if (fromVersion < target) {
        const result = window.Migrations.runMigrations(parsed, fromVersion);
        state = result.state;
        state.schemaVersion = result.schemaVersion;
      }

      cached = Object.assign({}, DEFAULTS(), state, { schemaVersion: target });
      persist();
      if (cameFromLegacy) cleanupLegacyKeys();
      return cached;
    } catch (e) {
      console.warn('[storage] load failed, using defaults', e);
      cached = DEFAULTS();
      return cached;
    }
  }

  // === Низкоуровневое API: get/set/remove (для совместимости — принимают
  // как старые "TOD_<key>" имена, так и просто "<key>"). Стараемся не
  // ломать вызовы из gameplay-кода.

  function normalizeKey(k) {
    if (k && k.indexOf('TOD_') === 0) return k.slice(4);
    return k;
  }

  function get(key, fallback) {
    const state = load();
    const k = normalizeKey(key);
    if (k in state) return state[k];
    return (fallback !== undefined) ? fallback : undefined;
  }

  function set(key, value) {
    load();
    cached[normalizeKey(key)] = value;
    persist();
  }

  function remove(key) {
    load();
    delete cached[normalizeKey(key)];
    persist();
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
    const m = load().mode;
    if (!['romance', 'flirt', 'passion'].includes(m)) return 'romance';
    return m;
  }
  function setMode(mode) { set('mode', mode); }

  // === Просмотренные карточки ===
  function getSeenCards() { return load().seenCards || []; }
  function addSeenCard(id) {
    const state = load();
    if (!Array.isArray(state.seenCards)) state.seenCards = [];
    if (!state.seenCards.includes(id)) state.seenCards.push(id);
    persist();
  }
  function resetSeenCards() {
    const state = load();
    state.seenCards = [];
    persist();
  }

  // === Звук и вибрация ===
  function getSound()       { return load().sound; }
  function setSound(v)      { set('sound', !!v); }
  function getVibration()   { return load().vibration; }
  function setVibration(v)  { set('vibration', !!v); }

  // === Онбординг ===
  function isOnboarded()    { return !!load().onboardingOk; }
  function setOnboarded()   { set('onboardingOk', true); }

  // === Mock Ads (можно переключить в dev-панели) ===
  function getMockAds()     { return !!load().mockAds; }
  function setMockAds(v)    { set('mockAds', !!v); }

  // === Rate Us (показывать после каждой партии, пока не нажал "Оценить") ===
  function getRateGiven()   { return !!load().rateGiven; }
  function setRateGiven(v)  { set('rateGiven', !!v); }

  // === Полный сброс ===
  function resetAll() {
    cached = DEFAULTS();
    persist();
    sessionPlayers = null;
    // Подчищаем потенциально оставшиеся legacy-ключи (на случай если они
    // ещё лежали в localStorage параллельно с single-key).
    cleanupLegacyKeys();
  }

  return {
    // Низкоуровневое API (совместимость со старым кодом):
    KEYS: LEGACY_KEYS,   // оставлено для read-only справки в gameplay-коде
    get: get,
    set: set,
    remove: remove,
    // Высокоуровневое API:
    getPlayers: getPlayers,         setPlayers: setPlayers,
    getMode: getMode,               setMode: setMode,
    getSeenCards: getSeenCards,     addSeenCard: addSeenCard,     resetSeenCards: resetSeenCards,
    getSound: getSound,             setSound: setSound,
    getVibration: getVibration,     setVibration: setVibration,
    isOnboarded: isOnboarded,       setOnboarded: setOnboarded,
    getMockAds: getMockAds,         setMockAds: setMockAds,
    getRateGiven: getRateGiven,     setRateGiven: setRateGiven,
    resetAll: resetAll
  };
})();
