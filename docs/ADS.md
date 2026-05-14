# Яндекс-реклама — интеграция (04_True-or-Do / Правда или Действие)

Игра использует глобальный синглтон `window.AdManager` из [ads.js](../ads.js), который определяет backend **лениво** при первом показе:

| Backend | Условие | Когда применяется |
|---|---|---|
| `native` | `window.YandexAds.showInterstitial` существует | Production APK (html2apk c `-YandexAdsBridge`) |
| `mock` | `window.YandexAds` отсутствует или `Storage.getMockAds()/CFG.mockAds` принудительно true | dev в браузере |

Никакой веб-SDK слой (`Ya.Context.AdvManager.render`, РСЯ `context.js`) **не подключается** — проект целится только в РуСтор APK.

## Слоты рекламы

| Слот | Когда показывается | Метод | unit-ID |
|---|---|---|---|
| **Interstitial** | После того как бутылочка выбрала карточку, но до её показа (см. `maybeShowInterstitial` в game.js) | `AdManager.showInterstitialAd()` | `GAME_CONFIG.unitInterstitial` |
| **Rewarded** | Подготовлен на стороне `ads.js`, но в текущем gameplay не вызывается. Зарезервирован под будущие сценарии. | `AdManager.showRewardedAd(reward)` | `GAME_CONFIG.unitRewarded` |

Точка вызова — [game.js](../game.js):227–231 (`maybeShowInterstitial` внутри `spinBottle`).

**Каденс interstitial:**
- Первые `GAME_CONFIG.cardsBeforeFirstAd` карточек (по умолчанию 5) — без рекламы.
- Дальше — случайный интервал `[minCardsBetweenAds; maxCardsBetweenAds]` (по умолчанию 4–6).
- `scheduleNextAd(cardsPlayed)` после каждого показа выбирает новый интервал.

Unit-ID в [config.js](../config.js):
- Interstitial: `R-M-19273501-1`
- Rewarded: `R-M-19273501-2`

Источник: [Yandex Partner Mobile Ads](https://partner.yandex.ru/mobile-ads).

## Сборка APK с включённым Yandex Mobile Ads

```
& "$env:LOCALAPPDATA\Programs\html2apk\html2apk.ps1" `
  -ProjectFolder "C:\Users\Александр\Desktop\Claude\04_True-or-Do" `
  -AppName "Правда или Действие" `
  -AppId "com.matryoshka.trueordo" `
  -OutputFile "$env:USERPROFILE\Downloads\TrueOrDo.apk" `
  -YandexAdsBridge
```

html2apk автоматически добавляет gradle-зависимость, ACCESS_NETWORK_STATE, `YandexAdsBridge.java` и патчит MainActivity. Подробности — в `01_RS_GlitterSort/docs/ADS.md` (там же полный исходник Java-моста).

## Контракт callback'ов от Java

```js
window.__yandexAdsCallback(kind, event)
// kind:  'interstitial' | 'rewarded'
// event: 'closed' | 'rewarded'
```

- `interstitial` всегда завершается событием `closed`.
- `rewarded` приходит с `rewarded`, если пользователь досмотрел до конца; иначе `closed`.

Имя callback'а зафиксировано в Java-классе `YandexAdsBridge` и не должно меняться в JS.

## Mock backend (dev)

В браузере без bridge'а `ads.js` рисует HTML-оверлей `.ad-mock-overlay` (динамически создаваемый, не закреплён в index.html) с прогресс-баром и автозакрытием через 1.2–1.6 сек.

`AdManager.showInterstitialAd()` → `{ watched: true }` после закрытия оверлея.
`AdManager.showRewardedAd(reward)` → `{ watched: true, reward }` (mock всегда даёт reward).

## Проверка backend

В DevTools-консоли (после первого показа рекламы, потому что lazy-init):
```js
AdManager.getBackend()  // 'native' | 'mock' | 'pending' (до первого показа)
AdManager.stats()       // { totalShown, nextAdAt, backend }
```

## Dev-panel override

`window.Storage.getMockAds()` может переопределить `CFG.mockAds` (если dev-panel такое умеет). Эта проверка делается в `isForcedMock()` при `ensureBackend()`.

**Важно:** backend определяется **один раз** при первом показе. Если пользователь через dev-panel поменяет mockAds после того как реклама уже один раз показалась — изменение не подействует без перезагрузки страницы (или ручного вызова перезапуска `ensureBackend`).

## Где смотреть в коде

- Backend detection: [ads.js](../ads.js) → `ensureBackend()`.
- Native bridge logic: [ads.js](../ads.js) → `showInterstitialAd()` / `showRewardedAd()` (ветка `if (backend === 'native')`).
- Mock fallback: [ads.js](../ads.js) → `showMockOverlay()`.
- Каденс: [ads.js](../ads.js) → `shouldShowInterstitial()` / `scheduleNextAd()` + [game.js](../game.js):227–231 триггер.
