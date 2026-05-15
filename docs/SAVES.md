# Сейв и миграции (04_True-or-Do)

## Структура (после миграции v0 → v1)

LocalStorage-ключ: `TOD_save`. Единый JSON:

```json
{
  "schemaVersion": 1,
  "mode": "romance",
  "seenCards": [12, 33, 47],
  "sound": false,
  "vibration": true,
  "onboardingOk": true,
  "mockAds": false,
  "rateGiven": false
}
```

**До миграции** (legacy v0) каждое поле жило в отдельном localStorage entry: `TOD_mode`, `TOD_seenCards`, `TOD_sound`, и т.д. При первом запуске нового кода [storage.js](../storage.js) автоматически собирает их в единый JSON и удаляет старые ключи.

**Игроки и пол** (`sessionPlayers`) — НЕ персистятся. Хранятся только в памяти модуля до перезагрузки страницы. Это намеренно (см. комментарий в storage.js).

## Контракт

- [migrations.js](../migrations.js) — реестр миграций. Каждая миграция — чистая функция `(state) => state`.
- [storage.js](../storage.js) при `load()`:
  1. Пытается прочитать single-key `TOD_save`.
  2. Если его нет — ищет legacy multi-keys (`TOD_mode`, ...) и собирает их в объект.
  3. Прогоняет результат через `window.Migrations.runMigrations()` каскадно.
  4. Сохраняет в single-key, удаляет legacy.

API `window.Storage.*` — совместим с прошлой версией. `get(key, fallback)` принимает как `'mode'` так и `'TOD_mode'` (нормализуется).

## Как добавить новую миграцию

1. В коде поменялся формат сейва. Текущая `getCurrentSchemaVersion()` возвращает, например, 3.
2. В [migrations.js](../migrations.js) добавь функцию `4: function(state) { /* v3 → v4 */ return state; }`.
3. Обнови `DEFAULTS()` в [storage.js](../storage.js) — новая структура.
4. После публикации в РуСтор обнови `.claude/release-state.json` (`lastPublishedSchemaVersion: 4`).

## ⚠️ Правила

- **Не меняй уже опубликованную миграцию.**
- **Миграции — defensive**: используй `?? defaultValue` для отсутствующих полей.
- **Каскадные** — каждая запускается ровно один раз для каждого юзера.

## Проверка перед релизом

Skill `prepare-release-candidate` перед сборкой запускает **полный self-test**: пустой сейв прогоняется через **все** миграции в реестре, проверяется корректность результата. Если что-то падает — сборка релиза не запускается.

## Опубликованный релиз

`.claude/release-state.json` обновляется **автоматически** skill'ом `prepare-release-candidate` после того, как пользователь подтвердил, что отправляет собранный APK в стор. Если не подтвердил — файл не трогается, при следующем RC та же база для сравнения.
