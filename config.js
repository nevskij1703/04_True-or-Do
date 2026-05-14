/**
 * config.js — глобальные настройки игры.
 * Меняй значения тут, чтобы регулировать частоту рекламы,
 * звук/вибрацию и т.д.
 */
window.GAME_CONFIG = {
  // === Реклама ===
  // Контракт: см. docs/ADS.md.
  // Если в WebView APK подключён нативный Yandex Mobile Ads SDK через html2apk
  // (-YandexAdsBridge), JS дёргает window.YandexAds.* и слушает
  // window.__yandexAdsCallback. В браузере без bridge'а — mock с DOM-оверлеем.
  // Сколько карточек показать без рекламы в начале игры.
  cardsBeforeFirstAd: 5,
  // Минимум карточек между двумя interstitial-рекламами.
  minCardsBetweenAds: 4,
  // Максимум карточек между двумя interstitial-рекламами (случайно в диапазоне).
  maxCardsBetweenAds: 6,
  // true → принудительный mock даже если bridge доступен (полезно для dev).
  // Может быть переопределён в dev-panel через window.Storage.getMockAds().
  mockAds: false,
  // Yandex Mobile Ads unit-ID (partner.yandex.ru/mobile-ads).
  unitInterstitial: 'R-M-19273501-1',
  unitRewarded:     'R-M-19273501-2',

  // === Геймплей ===
  // Сколько ходов длится временно открытая премиум-категория после rewarded-рекламы.
  rewardedUnlockDuration: 10,
  // Через сколько карточек запускать конфетти.
  confettiEvery: 20,

  // === Звук и вибрация ===
  enableVibration: true,
  enableSound: false, // звук по умолчанию выключен, чтобы не пугать

  // === Контент ===
  // Режимы игры. Каждый режим = одно "ведро" карточек.
  //   romance — нежные тёплые карточки про "нас".
  //   flirt   — игривые, заигрывающие, лёгкое 16+.
  //   passion — самые жаркие, 18+, без откровенной порнографии.
  modes: {
    romance: { label: 'Романтика', emoji: '❤️' },
    flirt:   { label: 'Флирт',     emoji: '🫦' },
    passion: { label: 'Страсть',   emoji: '🔥' }
  },

  // === Dev ===
  // Список запрещённых слов для проверки контента в dev-панели.
  blacklist: [
    'алкоголь', 'водка', 'пиво', 'виски', 'наркотик',
    'удар', 'насил', 'кровь', 'смерть',
    'политик', 'религи', 'измен'
  ]
};
