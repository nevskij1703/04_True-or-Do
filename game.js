/**
 * game.js — состояние игры и переходы между ходами.
 *
 * Игровая последовательность:
 *   1. Показывается экран с бутылочкой и именем текущего игрока.
 *   2. Игрок крутит бутылочку — случайно выпадает Правда или Действие.
 *   3. Показывается карточка.
 *   4. На карточке доступны: "Выполнено" и "Заменить" (один раз).
 *   5. После "Выполнено" ход переходит ко второму игроку → снова бутылочка.
 */
window.Game = (function () {
  const state = {
    currentPlayerIdx: 0,           // 0 = p1, 1 = p2
    players: { p1: 'Игрок 1', p2: 'Игрок 2', g1: 'female', g2: 'male' },
    mode: 'mixed',
    maxIntensity: 3,
    cardsThisSession: 0,
    currentCard: null,
    currentType: null,
    replaceUsed: false,
    bottleAngle: 0,
    spinning: false
  };

  function loadFromStorage() {
    state.players = window.Storage.getPlayers();
    state.mode = window.Storage.getMode();
    state.maxIntensity = window.Storage.getIntensity();
  }

  function genderIcon(g) { return g === 'male' ? '♂' : '♀'; }

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

  function switchTurn() {
    state.currentPlayerIdx = 1 - state.currentPlayerIdx;
  }

  function renderTurnHeader() {
    const cur = currentPlayer();
    const other = otherPlayer();
    const turnEl = document.getElementById('turn-name');
    const turnGender = document.getElementById('turn-gender');
    turnEl.textContent = cur.name;
    turnGender.textContent = genderIcon(cur.gender);
    turnGender.className = 'turn-gender gender-' + cur.gender;

    // подпись над/под бутылочкой
    document.getElementById('bottle-current').textContent = cur.name + ' ' + genderIcon(cur.gender);
    document.getElementById('bottle-current').className =
      'player-chip glow gender-' + cur.gender;
    document.getElementById('bottle-other').textContent = other.name + ' ' + genderIcon(other.gender);
    document.getElementById('bottle-other').className =
      'player-chip dim gender-' + other.gender;
  }

  function showBottleStage() {
    state.currentCard = null;
    state.currentType = null;
    state.replaceUsed = false;
    document.getElementById('bottle-stage').classList.remove('hidden');
    document.getElementById('card').classList.add('hidden');
    document.getElementById('card-actions').classList.add('hidden');
    document.getElementById('btn-replace').classList.remove('hidden');
    document.getElementById('card-consent').classList.remove('show');
  }

  /**
   * Запуск анимации бутылочки. Затем рандомно выбирает Правду или Действие.
   */
  function spinBottle() {
    if (state.spinning) return;
    state.spinning = true;
    const svg = document.querySelector('#bottle .bottle-svg');
    const turns = 4 + Math.floor(Math.random() * 3); // 4..6 оборотов
    const final = turns * 360 + Math.floor(Math.random() * 360);
    state.bottleAngle += final;
    svg.style.transition = 'transform 2.4s cubic-bezier(0.18, 0.74, 0.22, 1)';
    svg.style.transform = 'rotate(' + state.bottleAngle + 'deg)';
    window.AudioFX.flip();
    document.getElementById('bottle').classList.add('spinning');

    setTimeout(() => {
      state.spinning = false;
      document.getElementById('bottle').classList.remove('spinning');
      const type = Math.random() < 0.5 ? 'truth' : 'dare';
      state.currentType = type;
      revealCard(type);
    }, 2400);
  }

  function revealCard(type) {
    const card = window.CardEngine.pick({
      type,
      mode: state.mode,
      maxIntensity: state.maxIntensity
    });
    if (!card) {
      window.UI.toast('Карточки кончились — обновляю пул!');
      window.CardEngine.resetSession();
      return revealCard(type);
    }
    renderCard(card);
  }

  function renderCard(card) {
    state.currentCard = card;
    const cardEl = document.getElementById('card');
    const typeEl = document.getElementById('card-type');
    const catEl = document.getElementById('card-category');
    const playerEl = document.getElementById('card-player');
    const textEl = document.getElementById('card-text');
    const consentEl = document.getElementById('card-consent');
    const cur = currentPlayer();

    cardEl.className = 'card flip-in ' + window.UI.cardClassForType(card.type);
    cardEl.classList.remove('hidden');
    typeEl.textContent = card.type === 'truth' ? 'Правда' : 'Действие';
    catEl.textContent = card.category;
    textEl.textContent = card.text;
    playerEl.textContent = cur.name + ' ' + genderIcon(cur.gender);
    playerEl.className = 'player-chip gender-' + cur.gender;

    if (card.intensity >= 4) {
      consentEl.textContent = 'Только если обоим комфортно.';
      consentEl.classList.add('show');
    } else {
      consentEl.classList.remove('show');
      consentEl.textContent = '';
    }

    // спрятать сцену с бутылкой, показать действия
    document.getElementById('bottle-stage').classList.add('hidden');
    document.getElementById('card-actions').classList.remove('hidden');

    const replaceBtn = document.getElementById('btn-replace');
    if (state.replaceUsed) replaceBtn.classList.add('hidden');
    else replaceBtn.classList.remove('hidden');

    window.AudioFX.flip();
  }

  function replaceCurrent() {
    if (state.replaceUsed || !state.currentCard) return;
    window.CardEngine.markSeen(state.currentCard.id);
    state.replaceUsed = true;
    revealCard(state.currentType);
    window.UI.toast('Карточка заменена');
  }

  async function maybeShowInterstitial() {
    if (window.AdManager.shouldShowInterstitial(state.cardsThisSession)) {
      await window.AdManager.showInterstitialAd();
      window.AdManager.scheduleNextAd(state.cardsThisSession);
    }
  }

  async function completeCurrent() {
    if (!state.currentCard) return;
    window.AudioFX.done();
    window.CardEngine.markSeen(state.currentCard.id);
    state.cardsThisSession++;

    const confettiEvery = window.GAME_CONFIG.confettiEvery || 20;
    if (state.cardsThisSession % confettiEvery === 0) {
      window.UI.confetti();
      window.AudioFX.confetti();
    }

    await maybeShowInterstitial();

    switchTurn();
    renderTurnHeader();
    showBottleStage();
  }

  function start() {
    loadFromStorage();
    window.CardEngine.resetSession();
    window.AdManager.resetCounters();
    state.cardsThisSession = 0;
    state.currentPlayerIdx = 0;
    state.bottleAngle = 0;
    renderTurnHeader();
    showBottleStage();
    window.UI.show('screen-game');
  }

  function endGame() {
    window.UI.show('screen-home');
  }

  return {
    start, endGame,
    spinBottle,
    completeCurrent,
    replaceCurrent,
    _state: state
  };
})();
