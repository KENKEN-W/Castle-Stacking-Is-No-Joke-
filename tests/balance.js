(function (root) {
  "use strict";
  if (typeof module !== "undefined" && module.exports) { require("../js/config.js"); require("../js/game.js"); }
  const G = root.Shogun.Game, C = root.Shogun.Config;
  function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
  // Policies see only columns and the current castle, never the unseen queue.
  function choose(columns, current, policy) {
    const options = columns.map((col,i)=>({col,i})).filter(x=>G.canPlace(x.col,current));
    if (!options.length) return -1;
    const top = col => col.length ? col[col.length-1].number : 0;
    const colorRun = col => col.length && col.every(c=>c.color===current.color) ? col.length : 0;
    options.sort((a,b) => (policy === "color" ? colorRun(b.col)-colorRun(a.col) : 0) || top(b.col)-top(a.col) || a.i-b.i);
    return options[0].i;
  }
  function run(boards=10000) {
    const metrics = { number:{reached15:0,mono:0,wins:0,points:0,castles:0,decisions:0,disagreements:0,opportunities:0}, color:{reached15:0,mono:0,wins:0,points:0,castles:0,decisions:0,disagreements:0,opportunities:0} };
    for(let seed=1;seed<=boards;seed++) {
      const deck=G.createDeck(seeded(seed));
      for(const policy of ["number","color"]) {
        const columns=Array.from({length:5},()=>[]), m=metrics[policy]; let opportunity=false;
        for(const current of deck) {
          const normal=choose(columns,current,"number"), colored=choose(columns,current,"color");
          if(normal<0)break;
          m.decisions++;if(normal!==colored){m.disagreements++;opportunity=true;}
          columns[policy==="number"?normal:colored].push(current);
        }
        const s=G.score(columns);m.castles+=s.castles;m.points+=s.points;m.reached15+=s.castles>=C.MIN_SCORE_CASTLES?1:0;m.mono+=s.mono>0?1:0;m.wins+=s.castles===G.TOTAL || (s.castles>=C.MIN_SCORE_CASTLES && s.mono>0)?1:0;m.opportunities+=opportunity?1:0;
      }
    }
    const games = {};
    for (const policy of ["number", "color"]) {
      const m = { games: boards, points: 0, wins: 0, ratings: Object.fromEntries(C.PLAYER_RATINGS.map(r => [r.name, 0])) };
      for (let seed=1; seed<=boards; seed++) {
        const random=seeded(seed); let s=G.newGame(random), steps=0;
        while(s.phase!==G.Phase.GAME_RESULT) {
          if(++steps>10000) throw Error("simulation did not finish");
          const action=s.phase===G.Phase.PLAYING ? {type:"PLACE",column:choose(s.columns,s.current,policy)} : {type:s.phase===G.Phase.WIN ? "CONTINUE" : "NEXT_BATTLE"};
          s=G.transition(s,action,random).state;
        }
        m.points+=s.finalScore;m.wins+=s.wins;m.ratings[G.rating(s.finalScore)]++;
      }
      games[policy]=m;
    }
    return {boards, seeds:`1..${boards}`, definition:"機会＝同じ観測盤面で数字優先と同種優先の配置先が異なる場面。独立盤面比較では両方針に同じ10,000デッキを使用。別途3戦ゲームを各10,000回実行し評価分布を集計。ゲーム試行では戦終了を自動確定し、勝ち戦は続行。未来の城は参照しない。完成や得点の保証ではない。",metrics,games};
  }
  root.Shogun.Balance={run,choose,seeded};
  if(typeof document!=="undefined")document.getElementById("balance").addEventListener("click",()=>{document.getElementById("balance-results").textContent=JSON.stringify(run(),null,2);});
  if(typeof module!=="undefined"&&module.exports){module.exports={run,choose,seeded};if(require.main===module)console.log(JSON.stringify(run(),null,2));}
})(typeof globalThis!=="undefined"?globalThis:window);
