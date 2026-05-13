/**
 * cardEngine.js — выбор и перемешивание карточек.
 *
 * Принцип:
 *   1. Берём все карточки из CARDS.
 *   2. Фильтруем по режиму (категории) и максимальной интенсивности.
 *   3. Учитываем временно открытые премиум-категории.
 *   4. Убираем те, что уже видели в этой сессии.
 *   5. Если пул пустой — сбрасываем seen и перемешиваем заново.
 */
window.CardEngine = (function () {
  let sessionSeen = new Set(); // только в рамках текущей сессии
  let tempUnlocks = {};        // categoryName -> expiresAt (timestamp)

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isCategoryAllowed(category, allowedCategories) {
    if (allowedCategories.includes(category)) return true;
    // временно разблокированные категории
    const exp = tempUnlocks[category];
    if (exp && exp > Date.now()) return true;
    return false;
  }

  /**
   * Получить пул карточек по фильтрам.
   * options = { type?: 'truth'|'dare'|'any', mode: 'soft'|..., maxIntensity: 1..5 }
   */
  function pool(options) {
    const mode = window.GAME_CONFIG.modes[options.mode] || window.GAME_CONFIG.modes.mixed;
    const allowed = mode.categories;
    const maxI = options.maxIntensity || window.GAME_CONFIG.defaultMaxIntensity;

    return window.CARDS.filter(c => {
      if (options.type && options.type !== 'any' && c.type !== options.type) return false;
      if (!isCategoryAllowed(c.category, allowed)) return false;
      if (c.intensity > maxI) return false;
      return true;
    });
  }

  /**
   * Выбрать следующую карточку.
   * Возвращает объект карточки или null, если пул совсем пуст.
   */
  function pick(options) {
    let available = pool(options).filter(c => !sessionSeen.has(c.id));

    // если кончились — обнуляем сессионный seen и перемешиваем заново
    if (available.length === 0) {
      sessionSeen.clear();
      available = pool(options);
      if (available.length === 0) return null;
    }

    const shuffled = shuffle(available);
    const card = shuffled[0];
    return card;
  }

  /**
   * Пометить карточку как показанную (только в сессии).
   * Полная история храним отдельно в Storage.
   */
  function markSeen(cardId) {
    sessionSeen.add(cardId);
    if (window.Storage) window.Storage.addSeenCard(cardId);
  }

  function unmarkSeen(cardId) {
    sessionSeen.delete(cardId);
  }

  function resetSession() {
    sessionSeen.clear();
  }

  function unlockCategoryTemporarily(category, durationCards) {
    // simplification: используем "сколько ходов осталось". Можно хранить число оставшихся ходов,
    // но проще на основе времени — берём щедрый запас.
    tempUnlocks[category] = Date.now() + (durationCards || window.GAME_CONFIG.rewardedUnlockDuration) * 60 * 1000;
  }

  function stats(options) {
    const all = pool(options);
    return {
      total: all.length,
      seen: all.filter(c => sessionSeen.has(c.id)).length,
      remaining: all.filter(c => !sessionSeen.has(c.id)).length
    };
  }

  return {
    pool,
    pick,
    markSeen,
    unmarkSeen,
    resetSession,
    unlockCategoryTemporarily,
    stats
  };
})();
