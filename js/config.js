(function (root) {
  "use strict";
  const Config = Object.freeze({
    NUMBER_OF_COLUMNS: 5,
    MAX_STACK_HEIGHT: 5,
    MIN_SCORE_CASTLES: 15,
    NUMBER_OF_BATTLES: 3,
    OPENING_RESTRICTED_TURNS: 5,
    OPENING_MAX_NUMBER: 20,
    FOUR_STACK_HEIGHT: 4,
    FOUR_STACK_BONUS: 5,
    // The legacy color field now identifies a castle TYPE, not its image color.
    CASTLE_COLORS: Object.freeze([
      Object.freeze({ id: "islamic", name: "イスラムの城", short: "イスラム", hex: "#F3E3C3", image: "assets/castles/islamic-castle.png", weight: 1 }),
      Object.freeze({ id: "western", name: "西洋の城", short: "西洋", hex: "#F2F5FA", image: "assets/castles/western-castle.png", weight: 1 }),
      Object.freeze({ id: "japanese", name: "日本の城", short: "日本", hex: "#E9E7E1", image: "assets/castles/japanese-castle.png", weight: 1 })
    ]),
    PLAYER_RATINGS: Object.freeze([
      { min: 0, name: "足軽" }, { min: 15, name: "足軽大将" },
      { min: 40, name: "先手大将" }, { min: 55, name: "副大将" },
      { min: 65, name: "総大将" }, { min: 71, name: "戦国大名" },
      { min: 90, name: "天下統一大将軍" }
    ].map(Object.freeze)),
    MONOCHROME_MULTIPLIERS: Object.freeze([1, 2, 3, 4, 5, 10]),
    SAVE_VERSION: 3,
    RULES_VERSION: 3,
    // Keep the key to detect old saves and explain incompatibility before replacing them.
    STORAGE_KEY: "godan-shogun.save.v1"
  });
  root.Shogun = { Config };
  if (typeof module !== "undefined" && module.exports) module.exports = Config;
})(typeof globalThis !== "undefined" ? globalThis : window);
