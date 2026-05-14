/**
 * game.js — состояние игры и переходы между ходами.
 *
 * Механика:
 *   - Вокруг бутылочки по кругу разложено 12 карточек (микс Правда/Действие).
 *   - Каждый ход игрок крутит бутылочку. Бутылочка останавливается,
 *     указывая на одну из 12 позиций.
 *   - Если позиция уже сыграна (там стрелка по часовой) —
 *     ход переходит к следующей сыгранной карточке по часовой стрелке.
 *   - На карточке игрок может нажать "Выполнено" или "Заменить" (один раз).
 *   - После 12 ходов игра заканчивается.
 */
window.Game = (function () {
  const TOTAL_SLOTS = 12;

  const state = {
    currentPlayerIdx: 0,
    players: { p1: 'Игрок 1', p2: 'Игрок 2', g1: 'female', g2: 'male' },
    mode: 'mixed',
    maxIntensity: 3,
    cardsThisSession: 0,
    slots: [],            // [{ type, card, used }, ...]
    selectedIdx: -1,
    replaceUsed: false,
    bottleAngle: 0,
    spinning: false
  };

  function loadFromStorage() {
    state.players = window.Storage.getPlayers();
    state.mode = window.Storage.getMode();
    state.maxIntensity = window.Storage.getIntensity();
  }

  function currentPlayer() {
    return state.currentPlayerIdx === 0
      ? { name: state.players.p1, gender: state.players.g1 }
      : { name: state.players.p2, gender: state.players.g2 };
  }
  function otherPlayer() {
    return state.currentPlayerIdx === 0
      ? { name: state.players.p2, gender: state.players.g2 }
      : { name: state.players.p1, gender: state.players.g1 };
  }
  function switchTurn() { state.currentPlayerIdx = 1 - state.currentPlayerIdx; }

  /* ===== Слоты по кругу ===== */
  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Раскладка 12 символов "?"/"!" по кругу:
   * 6 правд + 6 действий, ещё случайно, но с ограничением —
   * не более двух подряд одинаковых (с учётом замыкания круга).
   */
  function arrangeSlotTypes() {
    const base = ['truth','truth','truth','truth','truth','truth',
                  'dare','dare','dare','dare','dare','dare'];
    function valid(arr) {
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        if (arr[i] === arr[(i + 1) % n] && arr[i] === arr[(i + 2) % n]) return false;
      }
      return true;
    }
    for (let attempt = 0; attempt < 500; attempt++) {
      const candidate = shuffle(base);
      if (valid(candidate)) return candidate;
    }
    // Fallback — гарантированно валидный паттерн TT DD TT DD TT DD ...
    return ['truth','truth','dare','dare','truth','truth','dare','dare','truth','truth','dare','dare'];
  }

  function buildSlots() {
    const types = arrangeSlotTypes();
    const slots = types.map(t => {
      const card = window.CardEngine.pick({
        type: t,
        mode: state.mode,
        maxIntensity: state.maxIntensity
      });
      if (card) window.CardEngine.markSeen(card.id);
      return { type: t, card, used: false };
    });
    state.slots = slots;
  }

  function renderSlots() {
    const host = document.getElementById('slots-host');
    host.innerHTML = '';
    state.slots.forEach((s, i) => {
      const angle = i * (360 / TOTAL_SLOTS);
      const div = document.createElement('div');
      div.className = 'slot ' + (s.used ? 'used' : 'slot-' + s.type);
      div.style.setProperty('--angle', angle + 'deg');
      div.dataset.idx = i;
      if (s.used) {
        div.innerHTML = `
          <svg class="slot-arrow-svg" viewBox="0 0 24 24" style="transform: rotate(${angle}deg);">
            <path d="M5 12 H17 M13 7 L18 12 L13 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
      } else {
        const sym = s.type === 'truth' ? '?' : '!';
        div.innerHTML = `<span class="slot-symbol">${sym}</span>`;
      }
      host.appendChild(div);
    });
  }

  function highlightSlot(idx, ghost) {
    document.querySelectorAll('.slot').forEach(el => {
      el.classList.remove('highlight', 'ghost-highlight');
    });
    const el = document.querySelector('.slot[data-idx="' + idx + '"]');
    if (el) el.classList.add(ghost ? 'ghost-highlight' : 'highlight');
  }

  function resolveSlotFromAngle(rotation) {
    const ang = ((rotation % 360) + 360) % 360;
    return Math.round(ang / (360 / TOTAL_SLOTS)) % TOTAL_SLOTS;
  }

  function allUsed() {
    return state.slots.every(s => s.used);
  }

  function renderTurnHeader() {
    const cur = currentPlayer();
    const other = otherPlayer();
    document.getElementById('turn-count').textContent = (state.cardsThisSession + 1);
    const curEl = document.getElementById('bottle-current');
    curEl.textContent = cur.name;
    curEl.setAttribute('data-gender', cur.gender);
    curEl.className = 'player-chip glow with-gender-icon gender-' + cur.gender;
    const otherEl = document.getElementById('bottle-other');
    otherEl.textContent = other.name;
    otherEl.setAttribute('data-gender', other.gender);
    otherEl.className = 'player-chip dim with-gender-icon gender-' + other.gender;
  }

  function showBottleStage() {
    state.replaceUsed = false;
    document.getElementById('screen-game').classList.remove('in-card');
    document.getElementById('bottle-stage').classList.remove('hidden');
    document.getElementById('card-view').classList.add('hidden');
    // сбросить любую подсветку
    document.querySelectorAll('.slot').forEach(el => el.classList.remove('highlight','ghost-highlight'));
  }

  /* ===== Бутылочка =====
   * Физика вращения:
   *   Стадия 1 — равномерная угловая скорость ω0 (deg/ms),
   *              делает ровно SPIN_FIXED_TURNS полных оборотов.
   *              Длительность = SPIN_FIXED_TURNS*360 / ω0.
   *   Стадия 2 — равноускоренное замедление от ω0 до 0 за случайное
   *              время T2 ∈ [DECEL_MIN_MS, DECEL_MAX_MS].
   *              Пройденный за стадию угол = ω0 * T2 / 2 → в среднем
   *              ~1 оборот, иногда чуть меньше, иногда чуть больше.
   *
   * Реализация: две последовательные CSS-transition.
   *   Стадия 1 — linear (точно постоянная скорость).
   *   Стадия 2 — cubic-bezier(0.25, 0.5, 0.5, 1). Это аппроксимирует
   *              easeOutQuad (квадратичная кривая = равномерное замедление).
   *              Начальный наклон кривой = 2 → начальная угловая скорость
   *              в стадии 2 точно равна ω0, без рывка на стыке.
   *              Финальный наклон = 0 → плавная остановка без «вкопанной».
   *
   * Подкрути значения ниже, если захочется быстрее/медленнее.
   */
  const SPIN_FIXED_TURNS = 5;
  // ω0 побольше — на старте бутылка крутится заметно быстрее (~3.33 об/с).
  // Стадия 1 при этом занимает 1500мс. Чтобы суммарно остаться ~3с,
  // стадия 2 длится 1100–1800мс — за это время она тормозит, успевая
  // пройти ещё ~1.8…3 оборота. В среднем ~2.4 оборота на замедлении.
  const SPIN_OMEGA_DEG_PER_MS = 1.2;  // 1200°/с ≈ 3.33 об/с
  const DECEL_MIN_MS = 1100;          // быстрее замедление → меньше доворот (~1.8 оборота)
  const DECEL_MAX_MS = 1800;          // медленнее → больше доворот (~3 оборота)
  const DECEL_BEZIER = 'cubic-bezier(0.25, 0.5, 0.5, 1)'; // easeOutQuad

  function spinBottle() {
    if (state.spinning) return;
    if (allUsed()) return;
    state.spinning = true;

    const svg = document.querySelector('#bottle .bottle-svg');
    const baseAngle = state.bottleAngle;

    const omega = SPIN_OMEGA_DEG_PER_MS;
    const stage1Dist = SPIN_FIXED_TURNS * 360;
    const stage1Dur = stage1Dist / omega; // ≈ 2143 ms

    const stage2Dur = DECEL_MIN_MS + Math.random() * (DECEL_MAX_MS - DECEL_MIN_MS);
    // Для постоянного замедления: путь = ω0 * T2 / 2.
    const stage2Dist = omega * stage2Dur / 2;

    const stage1Final = baseAngle + stage1Dist;
    const stage2Final = stage1Final + stage2Dist;
    state.bottleAngle = stage2Final;

    // Стадия 1 — равномерное вращение.
    svg.style.transition = 'transform ' + stage1Dur + 'ms linear';
    svg.style.transform = 'rotate(' + stage1Final + 'deg)';
    window.AudioFX.flip();
    document.getElementById('bottle').classList.add('spinning');

    // Стадия 2 — плавное замедление до нуля.
    setTimeout(() => {
      svg.style.transition = 'transform ' + stage2Dur + 'ms ' + DECEL_BEZIER;
      svg.style.transform = 'rotate(' + stage2Final + 'deg)';
    }, stage1Dur);

    // Резолвим слот по итогам обоих этапов.
    setTimeout(async () => {
      document.getElementById('bottle').classList.remove('spinning');
      state.spinning = false;
      let idx = resolveSlotFromAngle(state.bottleAngle);
      let safety = 0;
      while (state.slots[idx].used && safety < TOTAL_SLOTS) {
        highlightSlot(idx, true);
        await wait(280);
        idx = (idx + 1) % TOTAL_SLOTS;
        safety++;
      }
      highlightSlot(idx);
      state.selectedIdx = idx;
      await wait(360);
      // Реклама — после того как бутылочка выбрала карточку,
      // но до того как её прочитают.
      await maybeShowInterstitial();
      revealCurrentSlot();
    }, stage1Dur + stage2Dur);
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ===== Карточка ===== */
  function revealCurrentSlot() {
    const s = state.slots[state.selectedIdx];
    if (!s || !s.card) return;
    renderCard(s.card);
  }

  function renderCard(card) {
    const cur = currentPlayer();
    const cardEl = document.getElementById('card');
    cardEl.className = 'card flip-in ' + window.UI.cardClassForType(card.type);
    document.getElementById('card-title').textContent = card.type === 'truth' ? 'Правда' : 'Действие';
    document.getElementById('card-title').className =
      'card-title ' + (card.type === 'truth' ? 'title-truth' : 'title-dare');
    const badge = document.getElementById('card-title-badge');
    badge.textContent = card.type === 'truth' ? '?' : '!';
    badge.className = 'title-badge ' + (card.type === 'truth' ? 'badge-truth' : 'badge-dare');
    const cardPlayerEl = document.getElementById('card-player');
    cardPlayerEl.textContent = cur.name;
    cardPlayerEl.setAttribute('data-gender', cur.gender);
    cardPlayerEl.className = 'with-gender-icon gender-' + cur.gender;
    document.getElementById('card-text').textContent = card.text;

    const replaceBtn = document.getElementById('btn-replace');
    if (state.replaceUsed) replaceBtn.classList.add('hidden');
    else replaceBtn.classList.remove('hidden');

    // переключить виды
    document.getElementById('bottle-stage').classList.add('hidden');
    document.getElementById('card-view').classList.remove('hidden');
    document.getElementById('screen-game').classList.add('in-card');

    window.AudioFX.flip();
  }

  function replaceCurrent() {
    if (state.replaceUsed) return;
    const s = state.slots[state.selectedIdx];
    if (!s) return;
    // взять новую карточку того же типа
    const newCard = window.CardEngine.pick({
      type: s.type,
      mode: state.mode,
      maxIntensity: state.maxIntensity
    });
    if (!newCard) {
      window.UI.toast('Других карточек нет');
      return;
    }
    window.CardEngine.markSeen(newCard.id);
    s.card = newCard;
    state.replaceUsed = true;
    renderCard(newCard);
    window.UI.toast('Карточка заменена');
  }

  async function maybeShowInterstitial() {
    if (window.AdManager.shouldShowInterstitial(state.cardsThisSession)) {
      await window.AdManager.showInterstitialAd();
      window.AdManager.scheduleNextAd(state.cardsThisSession);
    }
  }

  async function completeCurrent() {
    if (state.selectedIdx < 0) return;
    window.AudioFX.done();
    state.slots[state.selectedIdx].used = true;
    state.cardsThisSession++;
    renderSlots();

    const confettiEvery = window.GAME_CONFIG.confettiEvery || 20;
    if (state.cardsThisSession % confettiEvery === 0) {
      window.UI.confetti();
      window.AudioFX.confetti();
    }

    if (state.cardsThisSession >= TOTAL_SLOTS || allUsed()) {
      // конец партии
      showEndOverlay();
      return;
    }

    switchTurn();
    renderTurnHeader();
    showBottleStage();
  }

  /* ===== Конец партии ===== */
  function showEndOverlay() {
    const o = document.getElementById('end-overlay');
    o.classList.remove('hidden');
    requestAnimationFrame(() => o.classList.add('show'));
    window.UI.confetti();
    window.AudioFX.confetti();
  }
  function hideEndOverlay() {
    const o = document.getElementById('end-overlay');
    o.classList.remove('show');
    setTimeout(() => o.classList.add('hidden'), 220);
  }

  function playAgain() {
    hideEndOverlay();
    start();
  }
  function backHome() {
    hideEndOverlay();
    window.UI.show('screen-home');
  }

  /* ===== Старт / конец ===== */
  function start() {
    loadFromStorage();
    window.CardEngine.resetSession();
    window.AdManager.resetCounters();
    state.cardsThisSession = 0;
    state.currentPlayerIdx = 0;
    state.bottleAngle = 0;
    state.replaceUsed = false;
    state.selectedIdx = -1;
    buildSlots();
    renderSlots();
    renderTurnHeader();
    showBottleStage();
    window.UI.show('screen-game');
  }

  function endGame() {
    hideEndOverlay();
    window.UI.show('screen-home');
  }

  /**
   * Перезагрузить игроков из Storage и перерисовать всё, что от них зависит.
   * Вызывается из main.js, когда пользователь меняет имя/пол в модалке настроек,
   * чтобы игровой экран обновился на лету.
   */
  function refresh() {
    state.players = window.Storage.getPlayers();
    renderTurnHeader();
    if (state.currentCard) {
      const cur = currentPlayer();
      const playerEl = document.getElementById('card-player');
      if (playerEl) {
        playerEl.textContent = cur.name;
        playerEl.setAttribute('data-gender', cur.gender);
        playerEl.className = 'with-gender-icon gender-' + cur.gender;
      }
    }
  }

  return {
    start, endGame,
    spinBottle,
    completeCurrent,
    replaceCurrent,
    playAgain,
    backHome,
    refresh,
    _state: state
  };
})();
