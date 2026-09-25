(function (root) {
  "use strict";
  const C = root.Shogun ? root.Shogun.Config : require("./config.js");
  const TOTAL = C.NUMBER_OF_COLUMNS * C.MAX_STACK_HEIGHT;
  const Phase = Object.freeze({ PLAYING: "PLAYING", CANNOT_PLACE: "CANNOT_PLACE", WIN: "WIN", BATTLE_RESULT: "BATTLE_RESULT", GAME_RESULT: "GAME_RESULT" });
  const clone = value => JSON.parse(JSON.stringify(value));
  const count = state => state.columns.reduce((sum, col) => sum + col.length, 0);
  const isMono = col => col.length === C.MAX_STACK_HEIGHT && col.every(castle => castle.color === col[0].color);
  const isFour = col => col.length >= C.FOUR_STACK_HEIGHT && col.slice(0, C.FOUR_STACK_HEIGHT).every(c => c.color === col[0].color);
  const rating = score => C.PLAYER_RATINGS.filter(r => score >= r.min).slice(-1)[0].name;
  function score(columns) {
    const castles = columns.reduce((sum, col) => sum + col.length, 0);
    const mono = columns.filter(isMono).length;
    const base = castles >= C.MIN_SCORE_CASTLES ? castles : 0;
    const multiplier = C.MONOCHROME_MULTIPLIERS[mono];
    const four = columns.filter(isFour).length, fourBonus = four * C.FOUR_STACK_BONUS;
    return { castles, mono, base, multiplier, four, fourBonus, points: base ? base * multiplier + fourBonus : 0 };
  }
  function randomColor(random = Math.random) {
    let value = random() * C.CASTLE_COLORS.reduce((sum, color) => sum + color.weight, 0);
    for (const color of C.CASTLE_COLORS) { value -= color.weight; if (value < 0) return color.id; }
    return C.CASTLE_COLORS[C.CASTLE_COLORS.length - 1].id;
  }
  function shuffle(numbers, random) {
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  }
  function createDeck(random = Math.random) {
    const opening = shuffle(Array.from({ length: Math.min(TOTAL, C.OPENING_MAX_NUMBER) }, (_, i) => i + 1), random).slice(0, C.OPENING_RESTRICTED_TURNS);
    const rest = shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1).filter(n => !opening.includes(n)), random);
    return opening.concat(rest).map(number => ({ number, color: randomColor(random) }));
  }
  function newBoard(state, random) {
    const deck = createDeck(random);
    state.columns = Array.from({ length: C.NUMBER_OF_COLUMNS }, () => []);
    state.current = deck.shift();
    state.remaining = deck;
    state.phase = Phase.PLAYING;
    state.result = null;
    state.fourColumns = Array(C.NUMBER_OF_COLUMNS).fill(false);
    state.fourBonus = 0;
    return state;
  }
  function newGame(random = Math.random) {
    return newBoard({ battle: 1, ended: 0, battleScore: 0, scores: Array(C.NUMBER_OF_BATTLES).fill(null), wins: 0, bonusStage: false, best: 0, finalScore: null }, random);
  }
  function canPlace(column, castle) {
    return !!castle && column.length < C.MAX_STACK_HEIGHT && (!column.length || column[column.length - 1].number < castle.number);
  }
  const available = state => state.columns.flatMap((column, i) => canPlace(column, state.current) ? [i] : []);
  function totalScore(state) {
    return state.scores.reduce((sum, n) => sum + (n === null ? 0 : n), 0) + (state.scores[state.battle - 1] === null ? state.battleScore : 0);
  }
  function finishBattle(state) {
    state.result = { ...score(state.columns), blockedCastle: clone(state.current), winReason: null };
    state.battleScore += state.result.points;
    state.scores[state.battle - 1] = state.battleScore;
    state.ended += 1;
    state.bonusStage = false;
    state.phase = state.ended === C.NUMBER_OF_BATTLES ? Phase.GAME_RESULT : Phase.BATTLE_RESULT;
    if (state.phase === Phase.GAME_RESULT) state.finalScore = totalScore(state);
  }
  function winBoard(state, reason) {
    state.result = { ...score(state.columns), blockedCastle: state.current ? clone(state.current) : null, winReason: reason, wasBonus: state.bonusStage };
    state.bonusStage = true;
    state.battleScore += state.result.points;
    state.wins += 1;
    state.phase = Phase.WIN;
  }
  function settlePlacement(state) {
    const castles = count(state);
    state.fourColumns = state.columns.map(isFour);
    state.fourBonus = state.fourColumns.filter(Boolean).length * C.FOUR_STACK_BONUS;
    state.best = Math.max(state.best, castles);
    if (castles === TOTAL) {
      state.current = null;
      winBoard(state, "FULL_BOARD");
      return;
    }
    state.current = state.remaining.shift();
    if (!available(state).length) {
      state.phase = Phase.CANNOT_PLACE;
      if (castles < C.MIN_SCORE_CASTLES) finishBattle(state);
      else if (score(state.columns).mono > 0) winBoard(state, "MONO_BLOCKED");
      else finishBattle(state);
    }
  }
  // All gameplay mutations go through this transition function; rendering never awards points.
  function transition(previous, action, random = Math.random) {
    let allowed = false;
    if (action.type === "PLACE") allowed = previous.phase === Phase.PLAYING && Number.isInteger(action.column) && action.column >= 0 && action.column < C.NUMBER_OF_COLUMNS && canPlace(previous.columns[action.column], previous.current);
    if (action.type === "CONTINUE") allowed = previous.phase === Phase.WIN;
    if (action.type === "NEXT_BATTLE") allowed = previous.phase === Phase.BATTLE_RESULT;
    if (!allowed) return { state: previous, changed: false };
    const state = clone(previous);
    if (action.type === "PLACE") { state.columns[action.column].push(state.current); settlePlacement(state); }
    if (action.type === "CONTINUE") newBoard(state, random);
    if (action.type === "NEXT_BATTLE") { state.battle += 1; state.battleScore = 0; state.bonusStage = false; newBoard(state, random); }
    return { state, changed: true };
  }
  const Game = { TOTAL, Phase, clone, count, isMono, isFour, rating, score, randomColor, createDeck, newGame, canPlace, available, totalScore, transition };
  root.Shogun.Game = Game;
  if (typeof module !== "undefined" && module.exports) module.exports = Game;
})(typeof globalThis !== "undefined" ? globalThis : window);
