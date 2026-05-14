/**
 * ads.js — менеджер рекламы.
 *
 * Архитектура (см. docs/ADS.md):
 *   native — html2apk с -YandexAdsBridge экспонирует window.YandexAds.*
 *            и шлёт результаты в window.__yandexAdsCallback(kind, event).
 *   mock   — DOM-оверлей для dev-режима в браузере.
 *
 * API (совместим с предыдущей версией):
 *   window.AdManager.showInterstitialAd()           → Promise<{ watched: bool }>
 *   window.AdManager.showRewardedAd(reward)         → Promise<{ watched: bool, reward }>
 *   window.AdManager.shouldShowInterstitial(played) → bool
 *   window.AdManager.scheduleNextAd(played) / resetCounters() / stats()
 *   window.AdManager.getBackend()                   → 'native' | 'mock' | 'pending'
 */
window.AdManager = (function () {
  const CFG = window.GAME_CONFIG;
  let backend = null;                  // lazy — определяется при первом показе
  let pendingInterstitial = null;
  let pendingRewarded = null;
  let cardsSinceLastAd = 0;
  let nextAdAt = CFG.cardsBeforeFirstAd;
  let totalShown = 0;

  function isForcedMock() {
    // Dev-panel может через Storage переопределить mockAds. Если такого
    // API нет — берём значение из конфига.
    return window.Storage ? window.Storage.getMockAds() : CFG.mockAds;
  }

  function ensureBackend() {
    if (backend !== null) return;
    if (isForcedMock()) {
      backend = 'mock';
      console.log('[ads] backend=mock (forced by config.mockAds / Storage)');
      return;
    }
    if (window.YandexAds && typeof window.YandexAds.showInterstitial === 'function') {
      backend = 'native';
      setupNativeCallback();
      console.log('[ads] backend=native (YandexAds bridge detected)');
      // Preload первой пары реклам, чтобы первый показ был мгновенным.
      try {
        window.YandexAds.preloadInterstitial(CFG.unitInterstitial);
        window.YandexAds.preloadRewarded(CFG.unitRewarded);
      } catch (e) { console.warn('[ads] preload skipped:', e); }
      return;
    }
    backend = 'mock';
    console.log('[ads] backend=mock (window.YandexAds not present — dev browser)');
  }

  function setupNativeCallback() {
    // Глобальный канал событий от Java-стороны:
    //   window.__yandexAdsCallback(kind, event)
    //     kind:  'interstitial' | 'rewarded'
    //     event: 'closed' | 'rewarded'
    window.__yandexAdsCallback = function (kind, event) {
      if (kind === 'interstitial' && pendingInterstitial) {
        const resolve = pendingInterstitial;
        pendingInterstitial = null;
        resolve({ watched: true });
      }
      if (kind === 'rewarded' && pendingRewarded) {
        const resolve = pendingRewarded;
        pendingRewarded = null;
        resolve({ watched: event === 'rewarded' });
      }
    };
  }

  /**
   * Простой mock-баннер — рисует оверлей и резолвится.
   */
  function showMockOverlay(title, subtitle, durationMs) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ad-mock-overlay';
      overlay.innerHTML = `
        <div class="ad-mock-box">
          <div class="ad-mock-badge">Реклама (mock)</div>
          <div class="ad-mock-title">${title}</div>
          <div class="ad-mock-sub">${subtitle}</div>
          <div class="ad-mock-bar"><div class="ad-mock-bar-fill"></div></div>
        </div>`;
      document.body.appendChild(overlay);

      const fill = overlay.querySelector('.ad-mock-bar-fill');
      requestAnimationFrame(() => {
        fill.style.transition = `width ${durationMs}ms linear`;
        fill.style.width = '100%';
      });

      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 220);
        resolve({ watched: true });
      }, durationMs);
    });
  }

  /**
   * Показать interstitial — между ходами.
   * Возвращает Promise<{watched: boolean}>.
   */
  function showInterstitialAd() {
    totalShown++;
    ensureBackend();
    if (backend === 'native') {
      return new Promise(resolve => {
        pendingInterstitial = resolve;
        try {
          window.YandexAds.showInterstitial(CFG.unitInterstitial);
        } catch (err) {
          console.warn('[ads] native interstitial failed', err);
          pendingInterstitial = null;
          resolve({ watched: false });
        }
      });
    }
    return showMockOverlay('Интерстишиал', 'Игра продолжится через мгновение…', 1200);
  }

  /**
   * Показать rewarded-рекламу. Запускается только по кнопке пользователя.
   * Возвращает Promise<{watched: boolean, reward?: any}>.
   */
  function showRewardedAd(reward) {
    totalShown++;
    ensureBackend();
    if (backend === 'native') {
      return new Promise(resolve => {
        pendingRewarded = function (r) { resolve(Object.assign({}, r, { reward: reward || true })); };
        try {
          window.YandexAds.showRewarded(CFG.unitRewarded);
        } catch (err) {
          console.warn('[ads] native rewarded failed', err);
          pendingRewarded = null;
          resolve({ watched: false, reward: reward || true });
        }
      });
    }
    return showMockOverlay('Бонусная реклама', 'Спасибо за поддержку!', 1600)
      .then(r => Object.assign({}, r, { reward: reward || true }));
  }

  /**
   * Хук, вызываемый игрой после каждой завершённой карточки.
   * Возвращает true, если по правилам частоты пора показать interstitial.
   */
  function shouldShowInterstitial(cardsPlayed) {
    if (cardsPlayed < CFG.cardsBeforeFirstAd) return false;
    if (cardsPlayed < nextAdAt) return false;
    return true;
  }

  /**
   * Запланировать следующий показ interstitial.
   */
  function scheduleNextAd(cardsPlayed) {
    const min = CFG.minCardsBetweenAds;
    const max = CFG.maxCardsBetweenAds;
    const gap = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
    nextAdAt = cardsPlayed + gap;
    cardsSinceLastAd = 0;
  }

  function resetCounters() {
    cardsSinceLastAd = 0;
    nextAdAt = CFG.cardsBeforeFirstAd;
    totalShown = 0;
  }

  function stats() {
    return { totalShown, nextAdAt, backend: backend || 'pending' };
  }

  function getBackend() {
    return backend || 'pending';
  }

  return {
    showInterstitialAd,
    showRewardedAd,
    shouldShowInterstitial,
    scheduleNextAd,
    resetCounters,
    stats,
    getBackend
  };
})();
