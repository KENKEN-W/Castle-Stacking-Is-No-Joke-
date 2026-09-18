(function (root) {
  "use strict";
  const Config = Object.freeze({
    NUMBER_OF_COLUMNS: 5,
    MAX_STACK_HEIGHT: 5,
    MIN_SCORE_CASTLES: 15,
    NUMBER_OF_BATTLES: 3,
    CASTLE_COLORS: Object.freeze([
      Object.freeze({ id: "red", name: "赤", mark: "●", hex: "#F28B82", weight: 1 }),
      Object.freeze({ id: "blue", name: "青", mark: "◆", hex: "#8ABEFF", weight: 1 }),
      Object.freeze({ id: "green", name: "緑", mark: "▲", hex: "#8FD5AC", weight: 1 })
    ]),
    MONOCHROME_MULTIPLIERS: Object.freeze([1, 2, 3, 4, 5, 10]),
    SAVE_VERSION: 1,
    RULES_VERSION: 1,
    STORAGE_KEY: "godan-shogun.save.v1"
  });
  root.Shogun = { Config };
  if (typeof module !== "undefined" && module.exports) module.exports = Config;
})(typeof globalThis !== "undefined" ? globalThis : window);
