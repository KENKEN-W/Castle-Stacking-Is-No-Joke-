(function (root) {
  "use strict";
  const Config = Object.freeze({
    NUMBER_OF_COLUMNS: 5,
    MAX_STACK_HEIGHT: 5,
    MIN_SCORE_CASTLES: 15,
    HIGH_CASTLE_MIN: 21,
    HIGH_CASTLE_DELAY_DRAWS: 5,
    NUMBER_OF_BATTLES: 3,
    CASTLE_COLORS: Object.freeze([
      Object.freeze({ id: "red", name: "赤", mark: "●", hex: "#F28B82", weight: 1 }),
      Object.freeze({ id: "blue", name: "青", mark: "◆", hex: "#8ABEFF", weight: 1 }),
      Object.freeze({ id: "green", name: "緑", mark: "▲", hex: "#8FD5AC", weight: 1 })
    ]),
    MONOCHROME_MULTIPLIERS: Object.freeze([1, 2, 3, 4, 5, 10]),
    PLAYER_RANKS: Object.freeze([
      Object.freeze({ min: 90, name: "天下統一大将軍" }),
      Object.freeze({ min: 71, name: "戦国大名" }),
      Object.freeze({ min: 65, name: "総大将" }),
      Object.freeze({ min: 55, name: "副大将" }),
      Object.freeze({ min: 40, name: "先手大将" }),
      Object.freeze({ min: 15, name: "足軽大将" }),
      Object.freeze({ min: 0, name: "足軽" })
    ]),
    SAVE_VERSION: 2,
    RULES_VERSION: 2,
    STORAGE_KEY: "godan-shogun.save.v2"
  });
  root.Shogun = { Config };
  if (typeof module !== "undefined" && module.exports) module.exports = Config;
})(typeof globalThis !== "undefined" ? globalThis : window);
