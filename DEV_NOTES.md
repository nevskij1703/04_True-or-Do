# DEV_NOTES

Карта проекта для разработчика. Где что лежит и куда тыкаться.

## Где логика карточек

- `cards.js` — массив `window.CARDS`. Каждая запись: `{ id, type, category, intensity, text }`.
- `window.CardsData` — простые геттеры (`all`, `byType`, `byCategory`, `count`).

## Где фильтрация и перемешивание

- `cardEngine.js`:
  - `pool(options)` — фильтрует карточки по типу, категории и интенсивности.
  - `pick(options)` — выбирает случайную карточку и помечает «сессионно увиденную».
  - `markSeen` / `unmarkSeen` — для контроля повторов.
  - `resetSession` — сбрасывает сессионную историю.
  - `unlockCategoryTemporarily(cat, duration)` — временно открывает категорию (после rewarded).
  - Если пул кончился — `pick` сам обнуляет seen и берёт заново.

## Где localStorage

- `storage.js` — единая обёртка:
  - игроки, режим, интенсивность;
  - просмотренные id (`seenCards`);
  - статистика (`played`, `truth`, `dare`, `skipped`, `sessions`);
  - звук/вибрация;
  - флаг онбординга;
  - переключатель Mock Ads.
- Все ключи с префиксом `TOD_`.
- Полный сброс — `Storage.resetAll()` или кнопка в dev-панели.

## Где реклама

- `ads.js` — `window.AdManager`:
  - `showInterstitialAd()` → Promise.
  - `showRewardedAd(reward)` → Promise с `{ watched, reward }`.
  - `shouldShowInterstitial(cardsPlayed)` — правила частоты.
  - `scheduleNextAd(cardsPlayed)` — выбирает следующий момент показа.
- Mock рисует короткий оверлей (1.2 сек interstitial / 1.6 сек rewarded).
- Подключение Яндекса — в комментариях того же файла.

## Где настройки интенсивности

- В `config.js`: `defaultMaxIntensity` и список `modes`.
- В `storage.js`: `getIntensity` / `setIntensity` (1..5).
- На UI: ползунок «Интенсивность» на главном экране (`#input-intensity`).

## Где состояние игры

- `game.js` — `window.Game`:
  - `start()`, `end()`;
  - `pickType('truth'|'dare'|'any')`;
  - `completeCurrent()`, `skipCurrent()`, `rerollCurrent()`;
  - reward-обработчики: `rewardExtraCard`, `rewardFreeSkips`, `rewardUnlockCategory`.
- Все переходы между ходами проходят через `endOfCard(action)`, который и решает, не пора ли показать interstitial.

## Где UI

- `ui.js` — переключение экранов (`UI.show(id)`), конфетти, toast, классы для карточки.
- `main.js` — навешивает обработчики на кнопки/инпуты, монтирует dev-панель.
- `styles.css` — мобильный portrait-first, мягкая палитра, анимация `flipIn`, mock-overlay, dev-панель.

## Какие темы запрещены для карточек

В контент **нельзя** добавлять:

- откровенный 18+ / порнографию;
- насилие, унижение, принуждение;
- алкоголь и другие вещества;
- задания, требующие денег;
- задания с риском травмы;
- темы измен, болезней, травм, политики, религии;
- манипулятивные / токсичные формулировки.

Для самопроверки используйте `config.js → blacklist` и кнопку «Проверить контент» в dev-панели.

## Dev-панель

Запуск: `?dev=1` в URL (например, `index.html?dev=1`).

- Фильтрация карточек по типу/категории/интенсивности.
- Кнопка «Проверить контент» (дубли id, пустые тексты, blacklist).
- Экспорт статистики (копирует в буфер).
- Сброс localStorage.
- Тогглер Mock Ads (сохраняется в storage).

## Точка расширения для аналитики

Сейчас аналитики нет. Удобные места для хука:

- `Game.completeCurrent` / `skipCurrent` / `rerollCurrent`.
- `AdManager.showInterstitialAd` / `showRewardedAd` (резолв Promise).
- `Storage.incStat`.

## Известные ограничения

- Пул карточек хранится в JS и грузится синхронно. При сотнях тысяч записей нужно вынести в JSON и грузить лениво.
- `localStorage` ограничен ~5 МБ — для нашего размера контента это многократно с запасом.
- Mock-реклама не блокирует игру навсегда: если что-то пошло не так, можно открыть `?dev=1` и сбросить состояние.
