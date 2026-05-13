/**
 * ads.js — менеджер рекламы.
 *
 * Сейчас здесь только mock-реализация (Promise, который "просмотрел" рекламу).
 * Чтобы подключить настоящую рекламу Яндекса:
 *
 *   1. Подключи в index.html SDK Яндекс.Рекламы:
 *      <script src="https://yandex.ru/ads/system/context.js" async></script>
 *
 *   2. В функциях showInterstitialAd / showRewardedAd замени
 *      mock-блок (внутри if (mock)) на вызовы Yandex.Context.AdvManager:
 *
 *      yaContextCb.push(() => {
 *        Ya.Context.AdvManager.render({
 *          renderTo: 'yandex_rtb_R-A-XXXXX-1',
 *          blockId:  'R-A-XXXXX-1',
 *          onClose:  () => resolve({ watched: true }),
 *          onError:  () => resolve({ watched: false })
 *        });
 *      });
 *
 *   3. Для rewarded используй соответствующий блок-id и onRewarded callback.
 *
 * Все настройки частоты лежат в config.js.
 */
window.AdManager = (function () {
  const CFG = window.GAME_CONFIG;
  let cardsSinceLastAd = 0;
  let nextAdAt = CFG.cardsBeforeFirstAd;
  let totalShown = 0;

  function isMock() {
    return window.Storage ? window.Storage.getMockAds() : CFG.mockAds;
  }

  /**
   * Простой mock-баннер — рисует оверлей на 1.2 секунды и резолвится.
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

      // запуск анимации прогресса
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
    if (isMock()) {
      return showMockOverlay('Интерстишиал', 'Игра продолжится через мгновение…', 1200);
    }
    // === ТУТ подключи Яндекс interstitial ===
    return Promise.resolve({ watched: true });
  }

  /**
   * Показать rewarded-рекламу. Запускается только по кнопке пользователя.
   * Возвращает Promise<{watched: boolean, reward?: any}>.
   */
  function showRewardedAd(reward) {
    totalShown++;
    if (isMock()) {
      return showMockOverlay('Бонусная реклама', 'Спасибо за поддержку!', 1600)
        .then(r => ({ ...r, reward: reward || true }));
    }
    // === ТУТ подключи Яндекс rewarded ===
    return Promise.resolve({ watched: true, reward: reward || true });
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
    return { totalShown, nextAdAt };
  }

  return {
    showInterstitialAd,
    showRewardedAd,
    shouldShowInterstitial,
    scheduleNextAd,
    resetCounters,
    stats
  };
})();
