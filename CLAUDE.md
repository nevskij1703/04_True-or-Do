# CLAUDE.md — 04_True-or-Do

## Preview-сервер: порт 8774

Этот проект — часть мульти-проектной мастерской из 4 параллельно ведущихся проектов
в `C:\Users\Александр\Desktop\Claude\`. У каждого закреплён **уникальный порт**,
чтобы preview-серверы могли работать одновременно и не перебивать друг друга.

### Карта портов мастерской

| Проект            | Порт  |
|-------------------|-------|
| 01_RS_GlitterSort | 8771  |
| 02_Words          | 8772  |
| 03_FlappyBird     | 8773  |
| 04_True-or-Do     | 8774  |

**Этот проект всегда работает на порту 8774.**

### Правила (важно для будущих сессий Claude)

- **НЕ меняй** значение `port` в `.claude/launch.json`. Оно зафиксировано намеренно.
- **НЕ ставь** `autoPort: true` — это приведёт к захвату соседнего порта другого проекта мастерской.
- **НЕ добавляй** альтернативные preview-конфигурации (`npx serve`, `npm run dev`, `http-server` и т.п.) на других портах. Если действительно нужен другой запуск — используй тот же порт 8774.
- Если 8774 «занят» — это, скорее всего, прежний инстанс **этого же** проекта. Останови его (`Get-Process python | Stop-Process`), а не переключайся на 8000/5173/8080 — это порты соседей.
- Эта мастерская специально разнесена по портам 8771–8774; не выходи за эти границы и не выбирай порт сам.

### История

Раньше у этого проекта было **три** конфигурации запуска (Python 8080, npx serve 5173, npx http-server 8000) — все три пересекались с портами соседей. Они были сведены к одной Python-конфигурации на 8774. Не возвращай альтернативные конфигурации.

## Монетизация: Yandex Mobile Ads (нативный SDK через WebView-bridge)

Проект целится в РуСтор APK. Реклама работает через **нативный Yandex Mobile Ads SDK**, который встраивается в APK инструментом `html2apk` (флаг `-YandexAdsBridge`). JS-сторона дёргает `window.YandexAds.showInterstitial(unitId)` / `showRewarded(unitId)` и слушает `window.__yandexAdsCallback(kind, event)`. В браузерном dev-режиме `window.YandexAds` отсутствует, и `ads.js` автоматически падает в mock с DOM-оверлеем.

**Полный контракт и Java-код моста:** [docs/ADS.md](docs/ADS.md).

### Unit-ID (Yandex Mobile Ads)

В [config.js](config.js), `window.GAME_CONFIG`:
- `unitInterstitial: 'R-M-19273501-1'`
- `unitRewarded:     'R-M-19273501-2'`

Источник: [Yandex Partner / Mobile Ads](https://partner.yandex.ru/mobile-ads).

### Что делает APK-сборщик

`html2apk -YandexAdsBridge -ProjectFolder <thisDir> -AppName "..." -AppId com.terekh.trueordo -OutputFile <...>.apk` дополнительно встраивает gradle-зависимость, ACCESS_NETWORK_STATE, `YandexAdsBridge.java` и патчит MainActivity (см. [docs/ADS.md](docs/ADS.md)).

### Правила (для будущих сессий)

- **НЕ возвращай** TODO под `Ya.Context.AdvManager.render(...)` или `https://yandex.ru/ads/system/context.js` — это РСЯ для веба, не подходит для APK в РуСтор.
- **НЕ убирай** mock-fallback из `ensureBackend()` — он нужен для dev-режима в браузере.
- Backend определяется **лениво** при первом показе. Стартовое состояние `getBackend() === 'pending'`.
- `window.Storage.getMockAds()` может **переопределить** конфиг (для dev-panel). В рантайме это применяется только при первом `ensureBackend()` — повторные смены тогглера не переключают backend без перезагрузки.
- Контракт `window.__yandexAdsCallback(kind, event)` зафиксирован на стороне Java в html2apk — не меняй имя callback'а в JS.
- Точка вызова рекламы из gameplay — в [game.js](game.js) (`maybeShowInterstitial()` в `spinBottle`).

## Сейвы и миграции

Сейв в `localStorage['TOD_save']` — единый JSON с полем `schemaVersion`. Раньше storage был multi-key (`TOD_mode`, `TOD_seenCards`, ...) — это всё ещё подхватывается через legacy-коллектор при первом запуске и автоматически переезжает в single-key. Спецификация — в [docs/SAVES.md](docs/SAVES.md). Файлы: [storage.js](storage.js), [migrations.js](migrations.js).

### Правила (для будущих сессий)

- **Любое изменение формата сейва ОБЯЗАНО иметь миграцию.** Если меняешь `DEFAULTS()` в `storage.js` — добавь функцию в `migrations.js` (ключ N+1).
- **НЕ возвращай multi-key хранение.** Все поля живут в одном JSON под `TOD_save`. API `window.Storage.*` остался прежним.
- **НЕ удаляй и НЕ меняй уже опубликованные миграции.**
- **`migrations.js` подключается в `index.html` ДО `storage.js`** — иначе `window.Migrations` undefined в момент IIFE storage.
- **При запросе релиз-кандидата** используй skill `prepare-release-candidate`.
- Состояние последнего опубликованного релиза — `.claude/release-state.json`. Обновляется автоматически skill'ом `prepare-release-candidate` — после сборки APK он спрашивает «отправляешь в стор?», и при ответе «да» записывает текущую `schemaVersion`/`versionCode`/`versionName` в файл.
