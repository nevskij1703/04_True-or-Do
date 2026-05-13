/**
 * game.js — состояние игры и переходы между ходами.
 *
 * Внешний API:
 *   Game.start()          — начать новую сессию.
 *   Game.pickType(type)   — игрок выбрал "truth" | "dare" | "any".
 *   Game.completeCurrent()— "Выполнено".
 *   Game.skipCurrent()    — "Пропустить".
 *   Game.rerollCurrent()  — "Другая карточка".
 *   Game.end()            — закончить и показать статистику.
 */
window.Game = (function () {
  const state = {
    currentPlayerIdx: 0,           // 0 = p1, 1 = p2
    players: { p1: 'Игрок 1', p2: 'Игрок 2' },
    mode: 'mixed',
    maxIntensity: 3,
    cardsThisSession: 0,
    currentCard: null,
    awaitingChoice: true,          // ждём выбора правда/действие
    freeSkips: 0                   // подаренные rewarded-ом пропуски без рекламы
  };

  function loadFromStorage() {
    const p = window.Storage.getPlayers();
    state.players = p;
    state.mode = window.Storage.getMode();
    state.maxIntensity = window.Storage.getIntensity();
  }

  function currentPlayerName() {
    return state.currentPlayerIdx === 0 ? state.players.p1 : state.players.p2;
  }

  function switchTurn() {
    state.currentPlayerIdx = 1 - state.currentPlayerIdx;
  }

  function renderTurnHeader() {
    window.UI.setText('current-player', currentPlayerName());
  }

  function renderCard(card) {
    state.currentCard = card;
    const cardEl = document.getElementById('card');
    const titleEl = document.getElementById('card-type');
    const catEl = document.getElementById('card-category');
    const textEl = document.getElementById('card-text');
    const playerEl = document.getElementById('card-player');
    const consentEl = document.getElementById('card-consent');

    cardEl.className = 'card flip-in ' + window.UI.cardClassForType(card.type);
    titleEl.textContent = card.type === 'truth' ? 'Правда' : 'Действие';
    catEl.textContent = card.category;
    textEl.textContent = card.text;
    playerEl.textContent = currentPlayerName();

    // Маленький дисклеймер для интенсивности 4-5
    if (card.intensity >= 4) {
      consentEl.textContent = 'Только если обоим комфортно.';
      consentEl.classList.add('show');
    } else {
      consentEl.classList.remove('show');
      consentEl.textContent = '';
    }

    // Показать карточку, скрыть выбор
    document.getElementById('type-choice').classList.add('hidden');
    document.getElementById('card-actions').classList.remove('hidden');
    cardEl.classList.remove('hidden');
    window.AudioFX.flip();
  }

  function showChoice() {
    state.awaitingChoice = true;
    state.currentCard = null;
    document.getElementById('type-choice').classList.remove('hidden');
    document.getElementById('card-actions').classList.add('hidden');
    document.getElementById('card').classList.add('hidden');
    document.getElementById('card-consent').classList.remove('show');
  }

  function pickType(type) {
    if (!state.awaitingChoice) return;
    state.awaitingChoice = false;
    const card = window.CardEngine.pick({
      type,
      mode: state.mode,
      maxIntensity: state.maxIntensity
    });
    if (!card) {
      window.UI.toast('Карточки кончились — обновляю пул!');
      window.CardEngine.resetSession();
      return pickType(type);
    }
    renderCard(card);
  }

  function tickStats(card, action) {
    window.Storage.incStat('played', 1);
    if (card.type === 'truth') window.Storage.incStat('truth', 1);
    else window.Storage.incStat('dare', 1);
    if (action === 'skip') window.Storage.incStat('skipped', 1);
  }

  async function maybeShowInterstitial() {
    const stats = window.Storage.getStats();
    if (window.AdManager.shouldShowInterstitial(state.cardsThisSession)) {
      await window.AdManager.showInterstitialAd();
      window.AdManager.scheduleNextAd(state.cardsThisSession);
    }
  }

  async function endOfCard(action) {
    if (!state.currentCard) return;
    const card = state.currentCard;
    window.CardEngine.markSeen(card.id);
    tickStats(card, action);
    state.cardsThisSession++;

    // Конфетти каждые N карточек
    const confettiEvery = window.GAME_CONFIG.confettiEvery || 20;
    if (state.cardsThisSession % confettiEvery === 0) {
      window.UI.confetti();
      window.AudioFX.confetti();
    }

    // Между ходами — возможно реклама
    await maybeShowInterstitial();

    switchTurn();
    renderTurnHeader();
    showChoice();
  }

  function completeCurrent() {
    window.AudioFX.done();
    endOfCard('done');
  }

  function skipCurrent() {
    // если есть бесплатные пропуски — пропускаем без рекламы
    if (state.freeSkips > 0) state.freeSkips--;
    window.AudioFX.skip();
    endOfCard('skip');
  }

  function rerollCurrent() {
    if (!state.currentCard) return;
    // не помечаем как просмотренную — даём другую той же категории/типа
    const sameType = state.currentCard.type;
    window.CardEngine.markSeen(state.currentCard.id); // чтобы не попалась снова
    const card = window.CardEngine.pick({
      type: sameType,
      mode: state.mode,
      maxIntensity: state.maxIntensity
    });
    if (!card) {
      window.UI.toast('Других карточек нет — попробуй сменить тип.');
      return;
    }
    renderCard(card);
  }

  function start() {
    loadFromStorage();
    window.CardEngine.resetSession();
    window.AdManager.resetCounters();
    state.cardsThisSession = 0;
    state.currentPlayerIdx = 0;
    state.freeSkips = 0;
    window.Storage.incStat('sessions', 1);
    renderTurnHeader();
    showChoice();
    window.UI.show('screen-game');
  }

  function end() {
    const stats = window.Storage.getStats();
    window.UI.setText('stat-played', stats.played);
    window.UI.setText('stat-truth', stats.truth);
    window.UI.setText('stat-dare', stats.dare);
    window.UI.setText('stat-skipped', stats.skipped);
    window.UI.setText('stat-favourite', stats.truth >= stats.dare ? 'Правда' : 'Действие');
    window.UI.show('screen-stats');
  }

  // Награды от rewarded-рекламы
  function rewardExtraCard() {
    state.awaitingChoice = true;
    state.currentPlayerIdx = 1 - state.currentPlayerIdx; // вернуть ход обратно
    renderTurnHeader();
    pickType('any');
    window.UI.toast('Бонусная карточка для тебя!');
  }
  function rewardFreeSkips(n) {
    state.freeSkips += n || 3;
    window.UI.toast('+' + (n || 3) + ' бесплатных пропусков');
  }
  function rewardUnlockCategory(cat) {
    window.CardEngine.unlockCategoryTemporarily(cat);
    window.UI.toast('Категория "' + cat + '" открыта временно');
  }

  return {
    start, end,
    pickType,
    completeCurrent, skipCurrent, rerollCurrent,
    rewardExtraCard, rewardFreeSkips, rewardUnlockCategory,
    _state: state
  };
})();
