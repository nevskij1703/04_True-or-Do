/**
 * migrations.js — реестр миграций сейва. См. docs/SAVES.md.
 *
 * Контракт:
 *   migrations[N]: state v(N-1) → state vN  (чистая функция)
 *   getCurrentSchemaVersion() — авто-вывод из max(keys)
 *   runMigrations(state, fromVersion) — каскад
 *
 * ⚠️ После публикации НЕ меняй существующие миграции.
 */
window.Migrations = (function () {
  const migrations = {
    1: function (state) {
      // v0 → v1: переход на single-key схему. К моменту вызова уже произошёл
      // collect из legacy multi-keys (см. storage.js → loadFromLegacyMultiKeys),
      // здесь финализируем структуру. Поля приходят как есть из старого
      // multi-key хранилища — никаких изменений не требуется.
      return state;
    },
  };

  function getCurrentSchemaVersion() {
    const keys = Object.keys(migrations).map(Number);
    return keys.length ? Math.max.apply(null, keys) : 1;
  }

  function runMigrations(state, fromVersion) {
    const current = getCurrentSchemaVersion();
    let v = (typeof fromVersion === 'number') ? fromVersion : 0;
    while (v < current) {
      const fn = migrations[v + 1];
      if (typeof fn !== 'function') {
        throw new Error('[migrations] Missing migration ' + (v + 1) + ' (target schemaVersion=' + current + ')');
      }
      state = fn(state);
      v++;
    }
    return { state: state, schemaVersion: current };
  }

  return { migrations: migrations, getCurrentSchemaVersion: getCurrentSchemaVersion, runMigrations: runMigrations };
})();
