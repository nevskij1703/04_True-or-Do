/**
 * main.js — точка входа.
 * Бутстраппит экраны, обработчики, фоновые сердечки и dev-панель.
 */
(function () {
  function $(id) { return document.getElementById(id); }

  function ready() {
    mountHeartsBg();
    initOnboarding();
    initSettingsFab();
    initHomeScreen();
    initGameScreen();
    initDevPanel();
    initialNavigate();
  }

  function initialNavigate() {
    if (!window.Storage.isOnboarded()) {
      window.UI.show('screen-onboarding');
      $('btn-settings').classList.add('hidden');
    } else {
      hydrateHome();
      window.UI.show('screen-home');
      $('btn-settings').classList.remove('hidden');
    }
  }

  /* ====== Фоновые сердечки ====== */
  function mountHeartsBg() {
    const bg = $('hearts-bg');
    if (!bg) return;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const h = document.createElement('span');
      h.className = 'heart-float';
      h.style.left = Math.random() * 100 + '%';
      h.style.animationDelay = (-Math.random() * 18) + 's';
      h.style.animationDuration = (12 + Math.random() * 14) + 's';
      h.style.fontSize = (10 + Math.random() * 22) + 'px';
      h.style.opacity = (0.25 + Math.random() * 0.55).toFixed(2);
      h.textContent = '♥';
      bg.appendChild(h);
    }
  }

  /* ====== Онбординг ====== */
  function initOnboarding() {
    const cb = $('onb-checkbox');
    const btn = $('onb-continue');
    cb.addEventListener('change', () => { btn.disabled = !cb.checked; });
    btn.addEventListener('click', () => {
      window.Storage.setOnboarded();
      hydrateHome();
      $('btn-settings').classList.remove('hidden');
      window.UI.show('screen-home');
    });
  }

  /* ====== Главная ====== */
  function hydrateHome() {
    const p = window.Storage.getPlayers();
    $('input-p1').value = p.p1;
    $('input-p2').value = p.p2;
    selectGender(1, p.g1);
    selectGender(2, p.g2);

    const mode = window.Storage.getMode();
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.mode === mode);
    });
  }

  function selectGender(playerNum, gender) {
    document
      .querySelectorAll('.gender-btn[data-player="' + playerNum + '"]')
      .forEach(b => b.classList.toggle('selected', b.dataset.gender === gender));
  }

  function readGender(playerNum) {
    const sel = document.querySelector(
      '.gender-btn[data-player="' + playerNum + '"].selected'
    );
    return sel ? sel.dataset.gender : (playerNum === 1 ? 'female' : 'male');
  }

  function initHomeScreen() {
    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.dataset.player;
        document
          .querySelectorAll('.gender-btn[data-player="' + num + '"]')
          .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        savePlayers();
      });
    });

    ['input-p1', 'input-p2'].forEach(id => {
      $(id).addEventListener('input', savePlayers);
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        window.Storage.setMode(btn.dataset.mode);
      });
    });

    $('btn-play').addEventListener('click', () => {
      savePlayers();
      window.Game.start();
    });
  }

  function savePlayers() {
    const p1 = $('input-p1').value.trim() || 'Игрок 1';
    const p2 = $('input-p2').value.trim() || 'Игрок 2';
    window.Storage.setPlayers(p1, p2, readGender(1), readGender(2));
  }

  /* ====== Игра ====== */
  function initGameScreen() {
    $('bottle').addEventListener('click', () => window.Game.spinBottle());
    $('btn-done').addEventListener('click', () => window.Game.completeCurrent());
    $('btn-replace').addEventListener('click', () => window.Game.replaceCurrent());
    $('btn-end-game').addEventListener('click', () => window.Game.endGame());

    $('btn-play-again').addEventListener('click', () => window.Game.playAgain());
    $('btn-back-home').addEventListener('click', () => window.Game.backHome());

    $('btn-rate-now').addEventListener('click', () => window.Game.rateNow());
    $('btn-rate-later').addEventListener('click', () => window.Game.rateLater());
  }

  /* ====== Настройки (модалка) ====== */
  function initSettingsFab() {
    const fab = $('btn-settings');
    const modal = $('settings-modal');
    const close = $('settings-close');
    const sound = $('sound-toggle');
    const vibration = $('vibration-toggle');

    sound.checked = window.Storage.getSound();
    vibration.checked = window.Storage.getVibration();

    function hydrateSettings() {
      sound.checked = window.Storage.getSound();
      vibration.checked = window.Storage.getVibration();
      const p = window.Storage.getPlayers();
      $('set-p1').value = p.p1;
      $('set-p2').value = p.p2;
      selectSettingsGender(1, p.g1);
      selectSettingsGender(2, p.g2);
    }

    fab.addEventListener('click', () => {
      hydrateSettings();
      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.add('show'));
    });

    function dismiss() {
      modal.classList.remove('show');
      setTimeout(() => modal.classList.add('hidden'), 220);
    }

    close.addEventListener('click', dismiss);
    modal.addEventListener('click', e => {
      if (e.target === modal) dismiss();
    });

    sound.addEventListener('change', e => window.Storage.setSound(e.target.checked));
    vibration.addEventListener('change', e => window.Storage.setVibration(e.target.checked));

    // Имена + пол в настройках — сохраняем и обновляем игру на лету
    ['set-p1', 'set-p2'].forEach(id => {
      $(id).addEventListener('input', saveSettingsPlayers);
    });
    document.querySelectorAll('.gender-btn[data-set-player]').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.dataset.setPlayer;
        document
          .querySelectorAll('.gender-btn[data-set-player="' + num + '"]')
          .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        saveSettingsPlayers();
      });
    });
  }

  function selectSettingsGender(playerNum, gender) {
    document
      .querySelectorAll('.gender-btn[data-set-player="' + playerNum + '"]')
      .forEach(b => b.classList.toggle('selected', b.dataset.gender === gender));
  }

  function readSettingsGender(playerNum) {
    const sel = document.querySelector(
      '.gender-btn[data-set-player="' + playerNum + '"].selected'
    );
    return sel ? sel.dataset.gender : (playerNum === 1 ? 'female' : 'male');
  }

  function saveSettingsPlayers() {
    const p1 = $('set-p1').value.trim() || 'Игрок 1';
    const p2 = $('set-p2').value.trim() || 'Игрок 2';
    const g1 = readSettingsGender(1);
    const g2 = readSettingsGender(2);
    window.Storage.setPlayers(p1, p2, g1, g2);
    // Если игра уже идёт — обновим шапку и карточку
    if (window.Game && typeof window.Game.refresh === 'function') {
      window.Game.refresh();
    }
    // Подтянуть тот же контент в инпуты на главной — чтобы не разъезжалось
    if ($('input-p1')) $('input-p1').value = p1;
    if ($('input-p2')) $('input-p2').value = p2;
    selectGender(1, g1);
    selectGender(2, g2);
  }

  /* ====== Dev-панель ====== */
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
        <label>Режим:
          <select id="dev-mode"><option value="">все</option></select>
        </label>
      </div>
      <div class="dev-row dev-actions">
        <button id="dev-check">Проверить контент</button>
        <button id="dev-reset">Сбросить localStorage</button>
        <label class="dev-mock"><input type="checkbox" id="dev-mock"> Mock Ads</label>
      </div>
      <div id="dev-summary" class="dev-summary"></div>
      <div id="dev-list" class="dev-list"></div>`;
    document.body.appendChild(root);

    const modes = Object.keys(window.GAME_CONFIG.modes);
    const modeSel = root.querySelector('#dev-mode');
    modes.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      modeSel.appendChild(o);
    });

    const typeSel = root.querySelector('#dev-type');
    const list = root.querySelector('#dev-list');
    const summary = root.querySelector('#dev-summary');
    const mockToggle = root.querySelector('#dev-mock');
    mockToggle.checked = window.Storage.getMockAds();

    function render() {
      const t = typeSel.value;
      const m = modeSel.value;
      const cards = window.CARDS.filter(card =>
        (!t || card.type === t) &&
        (!m || card.mode === m)
      );
      summary.innerHTML = `Всего: <b>${window.CARDS.length}</b> · отфильтровано: <b>${cards.length}</b>`;
      list.innerHTML = cards.map(card =>
        `<div class="dev-card dev-${card.type}">
           <span class="dev-id">#${card.id}</span>
           <span class="dev-tag">${card.type}</span>
           <span class="dev-tag">${card.mode}</span>
           <div class="dev-text">${escapeHtml(card.text)}</div>
         </div>`
      ).join('');
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    }

    typeSel.addEventListener('change', render);
    modeSel.addEventListener('change', render);
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
