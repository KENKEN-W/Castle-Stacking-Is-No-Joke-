(function (root) {
  "use strict";
  const C = root.Shogun.Config, G = root.Shogun.Game;
  const signature = JSON.stringify([C.NUMBER_OF_COLUMNS, C.MAX_STACK_HEIGHT, C.MIN_SCORE_CASTLES, C.NUMBER_OF_BATTLES, C.CASTLE_COLORS, C.MONOCHROME_MULTIPLIERS, C.FOUR_STACK_HEIGHT, C.FOUR_STACK_BONUS, C.OPENING_RESTRICTED_TURNS, C.OPENING_MAX_NUMBER, C.PLAYER_RATINGS]);
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  function validate(state) {
    try {
      if (!state || ![G.Phase.PLAYING, G.Phase.WIN, G.Phase.BATTLE_RESULT, G.Phase.GAME_RESULT].includes(state.phase)) return false;
      if (![state.battle, state.ended, state.battleScore, state.wins, state.best].every(integer)) return false;
      if (state.battle < 1 || state.battle > C.NUMBER_OF_BATTLES || state.ended > C.NUMBER_OF_BATTLES || state.best > G.TOTAL) return false;
      if (!Array.isArray(state.columns) || state.columns.length !== C.NUMBER_OF_COLUMNS || !Array.isArray(state.remaining) || state.remaining.length > G.TOTAL) return false;
      const validCastle = castle => castle && Number.isInteger(castle.number) && castle.number >= 1 && castle.number <= G.TOTAL && C.CASTLE_COLORS.some(color => color.id === castle.color);
      for (const col of state.columns) {
        if (!Array.isArray(col) || col.length > C.MAX_STACK_HEIGHT || !col.every(validCastle)) return false;
        if (col.some((castle, i) => i > 0 && castle.number <= col[i - 1].number)) return false;
      }
      if (state.current !== null && !validCastle(state.current)) return false;
      if (!state.remaining.every(validCastle)) return false;
      const all = state.columns.flat().concat(state.current ? [state.current] : [], state.remaining);
      if (all.length !== G.TOTAL || new Set(all.map(c => c.number)).size !== G.TOTAL) return false;
      const info = G.score(state.columns), options = G.available(state);
      if (state.best < info.castles || (state.wins > 0 && state.best < C.MIN_SCORE_CASTLES)) return false;
      if (JSON.stringify(state.fourColumns) !== JSON.stringify(state.columns.map(G.isFour)) || state.fourBonus !== info.fourBonus) return false;
      if (info.castles < C.OPENING_RESTRICTED_TURNS && state.columns.flat().concat(state.current ? [state.current] : [], state.remaining.slice(0, C.OPENING_RESTRICTED_TURNS - info.castles - 1)).some(c => c.number > C.OPENING_MAX_NUMBER)) return false;
      if (typeof state.bonusStage !== "boolean" || "retries" in state) return false;
      const ended = [G.Phase.BATTLE_RESULT, G.Phase.GAME_RESULT].includes(state.phase);
      if (state.bonusStage !== (!ended && state.battleScore > 0)) return false;
      if (state.ended !== state.battle - (ended ? 0 : 1)) return false;
      if (state.phase === G.Phase.GAME_RESULT && state.ended !== C.NUMBER_OF_BATTLES) return false;
      if (state.phase === G.Phase.BATTLE_RESULT && state.ended >= C.NUMBER_OF_BATTLES) return false;
      if (!Array.isArray(state.scores) || state.scores.length !== C.NUMBER_OF_BATTLES) return false;
      if (!state.scores.every((n, i) => i < state.ended ? integer(n) : n === null)) return false;
      if (ended && state.scores[state.battle - 1] !== state.battleScore) return false;
      if (state.phase === G.Phase.PLAYING && (!state.current || !options.length || info.castles >= G.TOTAL)) return false;
      if (ended && (!state.current || options.length || info.castles >= G.TOTAL || (info.castles >= C.MIN_SCORE_CASTLES && info.mono))) return false;
      const fullWin = info.castles === G.TOTAL && state.current === null && !state.remaining.length;
      const monoWin = info.castles >= C.MIN_SCORE_CASTLES && info.castles < G.TOTAL && info.mono > 0 && state.current && !options.length;
      if (state.phase === G.Phase.WIN && ((!fullWin && !monoWin) || !state.wins)) return false;
      if (ended || state.phase === G.Phase.WIN) {
        if (!state.result || Object.keys(info).some(key => state.result[key] !== info[key]) || state.battleScore < info.points) return false;
        if (JSON.stringify(state.result.blockedCastle) !== JSON.stringify(state.current)) return false;
        if (state.result.winReason !== (ended ? null : fullWin ? "FULL_BOARD" : "MONO_BLOCKED")) return false;
      } else if (state.result !== null) return false;
      // Wins may now be 15..25 castles; neither scores nor records imply full boards.
      const awardedBoard = ended || state.phase === G.Phase.WIN ? info.points : 0;
      const priorWinsScore = state.battleScore - awardedBoard;
      if (state.phase === G.Phase.WIN && state.result.wasBonus !== (priorWinsScore > 0)) return false;
      const maxWin = G.TOTAL * Math.max(...C.MONOCHROME_MULTIPLIERS) + C.NUMBER_OF_COLUMNS * C.FOUR_STACK_BONUS;
      const priorWins = state.wins - (state.phase === G.Phase.WIN ? 1 : 0);
      if (priorWinsScore < 0 || (priorWinsScore > 0 && priorWinsScore < G.TOTAL) || priorWinsScore > priorWins * maxWin) return false;
      if (state.phase === G.Phase.GAME_RESULT ? state.finalScore !== G.totalScore(state) : state.finalScore !== null) return false;
      return integer(G.totalScore(state));
    } catch (_) { return false; }
  }
  function createStorage(provider = () => root.localStorage) {
    return {
      load() {
        try {
          const raw = provider().getItem(C.STORAGE_KEY);
          if (!raw) return { state: null, error: null };
          const data = JSON.parse(raw);
          if (data.version !== C.SAVE_VERSION || data.rules !== C.RULES_VERSION) return { state: null, error: "以前のルールで保存されたゲーム、または非対応の保存形式です。得点や城を引き直さず、新しいゲームを始めてください。開始すると保存を置き換えます。" };
          if (data.version !== C.SAVE_VERSION || data.rules !== C.RULES_VERSION || data.signature !== signature || !validate(data.state)) return { state: null, error: "保存データを読み込めません。形式が異なるか、データが壊れています。新しく始められます。" };
          return { state: data.state, error: null };
        } catch (_) { return { state: null, error: "保存データを読み込めません。この環境では自動保存できない場合があります。" }; }
      },
      save(state) {
        if (!validate(state)) return { ok: false, error: "保存する状態を確認できませんでした。" };
        try { provider().setItem(C.STORAGE_KEY, JSON.stringify({ version: C.SAVE_VERSION, rules: C.RULES_VERSION, signature, state })); return { ok: true }; }
        catch (_) { return { ok: false, error: "この環境では自動保存できません。このまま遊べますが、今回の進行は保存されません。" }; }
      }
    };
  }
  const Storage = { validate, createStorage };
  root.Shogun.Storage = Storage;
  if (typeof module !== "undefined" && module.exports) module.exports = Storage;
})(typeof globalThis !== "undefined" ? globalThis : window);
