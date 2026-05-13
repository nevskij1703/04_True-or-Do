/**
 * main.js — точка входа. Бутстраппит экраны и обработчики.
 * Также монтирует dev-панель при ?dev=1.
 */
(function () {
  function $(id) { return document.getElementById(id); }

  function ready() {
    initOnboarding();
    initHomeScreen();
    initGameScreen();
    initStatsScreen();
    initSettings();
    initDevPanel();
    initialNavigate();
  }

  function initialNavigate() {
    if (!window.Storage.isOnboarded()) {
      window.UI.show('screen-onboarding');
    } else {
      hydrateHome();
      window.UI.show('screen-home');
    }
  }

  function initOnboarding() {
    const cb = $('onb-checkbox');
    const btn = $('onb-continue');
    cb.addEventListener('change', () => { btn.disabled = !cb.checked; });
    btn.addEventListener('click', () => {
      window.Storage.setOnboarded();
      hydrateHome();
      window.UI.show('screen-home');
    });
  }

  function hydrateHome() {
    const p = window.Storage.getPlayers();
    $('input-p1').value = p.p1;
    $('input-p2').value = p.p2;
    const mode = window.Storage.getMode();
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.mode === mode);
    });
    const intensity = window.Storage.getIntensity();
    $('input-intensity').value = intensity;
    $('intensity-label').textContent = intensity;
    $('sound-toggle').checked = window.Storage.getSound();
    $('vibration-toggle').checked = window.Storage.getVibration();
  }

  function initHomeScreen() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        window.Storage.setMode(btn.dataset.mode);
      });
    });

    $('input-intensity').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      $('intensity-label').textContent = v;
      window.Storage.setIntensity(v);
    });

    $('btn-play').addEventListener('click', () => {
      const p1 = $('input-p1').value.trim() || 'Игрок 1';
      const p2 = $('input-p2').value.trim() || 'Игрок 2';
      window.Storage.setPlayers(p1, p2);
      window.Game.start();
    });

    $('btn-stats-from-home').addEventListener('click', () => {
      window.Game.end();
    });

    $('btn-reset-stats').addEventListener('click', () => {
      if (!confirm('Сбросить статистику?')) return;
      window.Storage.resetStats();
      window.UI.toast('Статистика сброшена');
    });
  }

  function initGameScreen() {
    $('btn-truth').addEventListener('click', () => window.Game.pickType('truth'));
    $('btn-dare').addEventListener('click', () => window.Game.pickType('dare'));
    $('btn-random').addEventListener('click', () => window.Game.pickType('any'));

    $('btn-done').addEventListener('click', () => window.Game.completeCurrent());
    $('btn-skip').addEventListener('click', () => window.Game.skipCurrent());
    $('btn-reroll').addEventListener('click', () => window.Game.rerollCurrent());

    $('btn-end-game').addEventListener('click', () => window.Game.end());

    // Rewarded — бонус-карточка
    $('btn-bonus-card').addEventListener('click', async () => {
      const r = await window.AdManager.showRewardedAd({ kind: 'extraCard' });
      if (r.watched) window.Game.rewardExtraCard();
    });
    // Rewarded — бесплатные пропуски
    $('btn-bonus-skips').addEventListener('click', async () => {
      const r = await window.AdManager.showRewardedAd({ kind: 'freeSkips' });
      if (r.watched) window.Game.rewardFreeSkips(3);
    });
  }

  function initStatsScreen() {
    $('btn-new-game').addEventListener('click', () => {
      window.UI.show('screen-home');
    });
  }

  function initSettings() {
    $('sound-toggle').addEventListener('change', e => {
      window.Storage.setSound(e.target.checked);
    });
    $('vibration-toggle').addEventListener('change', e => {
      window.Storage.setVibration(e.target.checked);
    });
  }

  /**
   * Dev-панель — открывается с ?dev=1.
   * Возможности:
   *   - список всех карточек;
   *   - фильтры;
   *   - проверка дубликатов id и пустых текстов;
   *   - blacklist;
   *   - сброс localStorage и переключатель Mock Ads.
   */
  function initDevPanel() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') !== '1') return;

    const root = document.createElement('div');
    root.className = 'dev-panel';
    root.innerHTML = `
      <div class="dev-head">
        <strong>Dev panel</strong>
        <button id="dev-close" class="dev-x">×</button>
      </div>
      <div class="dev-row">
        <label>Тип:
          <select id="dev-type">
            <option value="">все</option>
            <option value="truth">truth</option>
            <option value="dare">dare</option>
          </select>
        </label>
        <label>Категория:
          <select id="dev-cat"><option value="">все</option></select>
        </label>
        <label>Макс. intensity:
          <input id="dev-int" type="number" min="1" max="5" value="5">
        </label>
      </div>
      <div class="dev-row dev-actions">
        <button id="dev-check">Проверить контент</button>
        <button id="dev-export">Экспорт статистики</button>
        <button id="dev-reset">Сбросить localStorage</button>
        <label class="dev-mock"><input type="checkbox" id="dev-mock"> Mock Ads</label>
      </div>
      <div id="dev-summary" class="dev-summary"></div>
      <div id="dev-list" class="dev-list"></div>`;
    document.body.appendChild(root);

    // заполняем категории
    const cats = Array.from(new Set(window.CARDS.map(c => c.category)));
    const catSel = root.querySelector('#dev-cat');
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      catSel.appendChild(o);
    });

    const typeSel = root.querySelector('#dev-type');
    const intInp = root.querySelector('#dev-int');
    const list = root.querySelector('#dev-list');
    const summary = root.querySelector('#dev-summary');
    const mockToggle = root.querySelector('#dev-mock');
    mockToggle.checked = window.Storage.getMockAds();

    function render() {
      const t = typeSel.value;
      const c = catSel.value;
      const maxI = parseInt(intInp.value, 10) || 5;
      const cards = window.CARDS.filter(card =>
        (!t || card.type === t) &&
        (!c || card.category === c) &&
        (card.intensity <= maxI)
      );
      summary.innerHTML = `Всего: <b>${window.CARDS.length}</b> · отфильтровано: <b>${cards.length}</b>`;
      list.innerHTML = cards.map(card =>
        `<div class="dev-card dev-${card.type}">
           <span class="dev-id">#${card.id}</span>
           <span class="dev-tag">${card.type}</span>
           <span class="dev-tag">${card.category}</span>
           <span class="dev-tag">i${card.intensity}</span>
           <div class="dev-text">${escapeHtml(card.text)}</div>
         </div>`
      ).join('');
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    }

    typeSel.addEventListener('change', render);
    catSel.addEventListener('change', render);
    intInp.addEventListener('input', render);

    root.querySelector('#dev-close').addEventListener('click', () => root.remove());

    root.querySelector('#dev-check').addEventListener('click', () => {
      const ids = window.CARDS.map(c => c.id);
      const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
      const empties = window.CARDS.filter(c => !c.text || !c.text.trim()).map(c => c.id);
      const bad = window.CARDS.filter(c =>
        window.GAME_CONFIG.blacklist.some(w => c.text.toLowerCase().includes(w))
      ).map(c => c.id);
      const truthCount = window.CARDS.filter(c => c.type === 'truth').length;
      const dareCount = window.CARDS.filter(c => c.type === 'dare').length;
      const lines = [
        `Всего карточек: ${window.CARDS.length}`,
        `Правда: ${truthCount}, Действие: ${dareCount}`,
        dupIds.length ? `⚠ Дубликаты id: ${dupIds.join(', ')}` : '✓ Дубликатов id нет',
        empties.length ? `⚠ Пустые тексты: ${empties.join(', ')}` : '✓ Пустых текстов нет',
        bad.length ? `⚠ Подозрительный контент: ${bad.join(', ')}` : '✓ Запрещённых слов не найдено'
      ];
      alert(lines.join('\n'));
    });

    root.querySelector('#dev-export').addEventListener('click', () => {
      const stats = window.Storage.getStats();
      const data = JSON.stringify(stats, null, 2);
      navigator.clipboard?.writeText(data);
      alert('Статистика скопирована в буфер:\n' + data);
    });

    root.querySelector('#dev-reset').addEventListener('click', () => {
      if (!confirm('Полностью очистить localStorage?')) return;
      window.Storage.resetAll();
      window.UI.toast('localStorage очищен');
    });

    mockToggle.addEventListener('change', e => {
      window.Storage.setMockAds(e.target.checked);
      window.UI.toast('Mock Ads: ' + (e.target.checked ? 'ON' : 'OFF'));
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
