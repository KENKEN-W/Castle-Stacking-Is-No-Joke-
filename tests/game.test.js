(function (root) {
  "use strict";
  if (typeof module !== "undefined" && module.exports) { require("../js/config.js"); require("../js/game.js"); require("../js/storage.js"); }
  const { Game: G, Storage: S, Config: C } = root.Shogun;
  const results = [];
  const assert = (ok, message = "assertion failed") => { if (!ok) throw Error(message); };
  const eq = (actual, expected) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  const test = (name, fn) => { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
  const castle = (number, color = "red") => ({ number, color });
  function columns(n, mono = 0) {
    let next = 1;
    return Array.from({ length: 5 }, (_, col) => Array.from({ length: Math.max(0, Math.min(5, n - col * 5)) }, (_, j) => castle(next++, col < mono ? C.CASTLE_COLORS[col % 3].id : C.CASTLE_COLORS[j % 3].id)));
  }
  function blocked(n) {
    const state = G.newGame(() => .5);
    let next = 2;
    state.columns = Array.from({ length: 5 }, (_, i) => Array.from({ length: Math.floor(n / 5) + (i < n % 5 ? 1 : 0) }, (_, j) => castle(next++, C.CASTLE_COLORS[j % 3].id)));
    state.current = castle(1);
    state.remaining = Array.from({ length: 24 - n }, (_, i) => castle(n + 2 + i));
    state.best = n;
    state.phase = G.Phase.CHOOSE;
    return state;
  }
  function arriveBlocked(n) {
    const state = blocked(n), current = state.columns[0].pop();
    state.remaining.unshift(state.current); state.current = current; state.phase = G.Phase.PLAYING;
    return G.transition(state, { type: "PLACE", column: 0 }).state;
  }
  function win(previous = G.newGame(), mono = 0) {
    const state = G.clone(previous);
    state.columns = columns(25, mono); state.current = state.columns[4].pop(); state.remaining = []; state.phase = G.Phase.PLAYING; state.result = null;
    return G.transition(state, { type: "PLACE", column: 4 }).state;
  }
  function useBlocked(previous, n) {
    const fixture = blocked(n), state = G.clone(previous);
    for (const key of ["columns", "current", "remaining", "phase", "result"]) state[key] = fixture[key];
    state.best = Math.max(state.best, n); return state;
  }
  function memory() { const data = {}; return { getItem: k => data[k] || null, setItem: (k,v) => { data[k] = v; } }; }
  test("A01 3の上に4", () => assert(G.canPlace([castle(3)], castle(4))));
  test("A02 3の上に3不可", () => assert(!G.canPlace([castle(3)], castle(3))));
  test("A03 3の上に2不可", () => assert(!G.canPlace([castle(3)], castle(2))));
  test("A04 満杯不可", () => assert(!G.canPlace(columns(5)[0], castle(25))));
  test("A05 空列に1・25", () => assert(G.canPlace([],castle(1)) && G.canPlace([],castle(25))));
  test("A06 13の配置可能列", () => eq(G.available({ columns: [[castle(3)],[castle(7)],[castle(12)],[castle(18)],[]], current: castle(13) }), [0,1,2,4]));
  test("A07 不可入力は不変", () => { const s = G.newGame(); s.columns[0] = [castle(25)]; const before = JSON.stringify(s); const r = G.transition(s,{type:"PLACE",column:0}); assert(!r.changed); eq(JSON.stringify(r.state), before); });
  test("A08 100デッキに重複・欠落なし", () => { for (let i=0;i<100;i++) { const deck=G.createDeck(); eq(deck.map(c=>c.number).sort((a,b)=>a-b),Array.from({length:25},(_,j)=>j+1)); assert(deck.every(c=>C.CASTLE_COLORS.some(x=>x.id===c.color))); } });
  test("A09 色と配置は独立", () => { for(const color of C.CASTLE_COLORS) assert(G.canPlace([castle(3)],castle(4,color.id))); });
  test("A11 配置後の昇順・上限・重複", () => { for(let i=0;i<100;i++) { let s=G.newGame(); while(s.phase===G.Phase.PLAYING) { s=G.transition(s,{type:"PLACE",column:G.available(s)[0]}).state; assert(S.validate(s)); } } });
  test("A12 色の境界と重み", () => { eq(C.CASTLE_COLORS.map(c=>c.weight),[1,1,1]); eq([0,.3333333332,1/3,.6666666665,2/3,.999999].map(n=>G.randomColor(()=>n)),["red","red","blue","blue","green","green"]); });
  [[14,0,0],[15,0,15],[20,0,20],[20,1,40],[20,2,60],[20,3,80],[20,4,100],[25,5,250],[14,1,0],[18,1,36],[22,2,66]].forEach(([n,m,p],i)=>test(`B${String(i+1).padStart(2,"0")} ${n}城・同色${m}列=${p}点`,()=>eq(G.score(columns(n,m)).points,p)));
  test("同色4城・異色混在を除外",()=>{ assert(!G.isMono(columns(4,1)[0])); assert(!G.isMono(columns(5,0)[0])); eq(G.score(columns(10,2)).mono,2); });
  test("C01 14城で強制終了",()=>{ const s=arriveBlocked(14); eq([s.phase,s.battleScore,s.ended],[G.Phase.BATTLE_RESULT,0,1]); assert(S.validate(s)); });
  for(const n of [15,24]) test(`C02/C03 ${n}城で選択`,()=>{ const s=arriveBlocked(n); eq(s.phase,G.Phase.CHOOSE); assert(S.validate(s)); });
  test("C04/C05 18城再合戦・繰り返し",()=>{ let s=blocked(18); for(let i=1;i<=5;i++){ s=G.transition(s,{type:"RETRY"}).state; eq([s.battle,s.ended,s.battleScore,s.retries,G.count(s)],[1,0,0,i,0]); assert(S.validate(s)); s=useBlocked(s,18); } });
  test("C06 再合戦前の18点は含めない",()=>{ let s=G.transition(blocked(18),{type:"RETRY"}).state; s=G.transition(useBlocked(s,22),{type:"END"}).state; eq(s.scores[0],22); });
  test("C07/C08 勝ち戦加点と同戦続行",()=>{ let s=win(); eq([s.phase,s.battleScore,s.battle,s.ended,s.wins],[G.Phase.WIN,25,1,0,1]); assert(S.validate(s)); s=G.transition(s,{type:"CONTINUE"}).state; eq([G.count(s),s.battleScore,s.battle,s.ended],[0,25,1,0]); assert(S.validate(s)); });
  test("C09 連続勝ち戦25+50+18=93",()=>{ let s=win(); s=G.transition(s,{type:"CONTINUE"}).state; s=win(s,1); s=G.transition(s,{type:"CONTINUE"}).state; s=G.transition(useBlocked(s,18),{type:"END"}).state; eq([s.scores[0],s.ended,s.wins],[93,1,2]); assert(S.validate(s)); });
  test("C10/C21 75点破棄・勝ち戦記録保持",()=>{ let s=win(); s=win(G.transition(s,{type:"CONTINUE"}).state,1); s=useBlocked(G.transition(s,{type:"CONTINUE"}).state,18); s=G.transition(s,{type:"RETRY"}).state; eq([s.battleScore,s.wins,s.best,s.retries,s.ended],[0,2,25,1,0]); assert(S.validate(s)); });
  test("C11 勝ち戦後14城で強制終了、25点保持",()=>{ let s=win(); s=G.transition(s,{type:"CONTINUE"}).state; const b=arriveBlocked(14); s.columns=b.columns;s.current=b.current;s.remaining=b.remaining;s.phase=G.Phase.PLAYING; const c=s.columns[0].pop();s.remaining.unshift(s.current);s.current=c; s=G.transition(s,{type:"PLACE",column:0}).state; eq([s.battleScore,s.scores[0],s.ended],[25,25,1]);assert(S.validate(s)); });
  test("C12/C13 3回の戦終了だけでゲーム終了",()=>{ let s=G.newGame(); for(let i=1;i<=3;i++){ s=G.transition(useBlocked(s,18),{type:"END"}).state;eq(s.ended,i);assert(S.validate(s));if(i<3) s=G.transition(s,{type:"NEXT_BATTLE"}).state; }eq([s.phase,s.battle,s.finalScore],[G.Phase.GAME_RESULT,3,54]);assert(!G.transition(s,{type:"NEXT_BATTLE"}).changed); });
  test("C14 93+21+44=158・二重計上なし",()=>{ let s=win();s=win(G.transition(s,{type:"CONTINUE"}).state,1);s=G.transition(useBlocked(s,18),{type:"END"}).state;s=G.transition(s,{type:"NEXT_BATTLE"}).state;s=G.transition(useBlocked(s,21),{type:"END"}).state;s=G.transition(s,{type:"NEXT_BATTLE"}).state;s=useBlocked(s,22);s.columns[0].forEach(c=>c.color="red");s=G.transition(s,{type:"END"}).state;eq([s.scores,s.finalScore,G.totalScore(s)],[[93,21,44],158,158]); assert(S.validate(s)); });
  test("C15 新規ゲームで全記録リセット",()=>{ const s=G.newGame();eq([s.battle,s.ended,s.wins,s.retries,s.best,s.battleScore],[1,0,0,0,0,0]);eq(s.scores,[null,null,null]); });
  test("C16/C18 結果の二重操作を拒否",()=>{ for(const [s,type] of [[win(),"CONTINUE"],[blocked(18),"RETRY"],[blocked(18),"END"]]){ const once=G.transition(s,{type}); const twice=G.transition(once.state,{type}); assert(!twice.changed);eq(twice.state,once.state); } });
  test("C17 全25城完成・26城目を参照しない",()=>{ const s=win(G.newGame(),5);eq([s.current,s.remaining.length,s.battleScore],[null,0,250]);assert(S.validate(s)); });
  test("C19 前の戦の93点は再合戦でも残る",()=>{ let s=blocked(18);s.battle=2;s.ended=1;s.scores=[93,null,null];s.battleScore=75;s.wins=2;s.best=25;s=G.transition(s,{type:"RETRY"}).state;eq([s.scores,G.totalScore(s)],[[93,null,null],93]);assert(S.validate(s)); });
  test("C20 降順25〜20は5城で強制終了",()=>{ let s=G.newGame();s.current=castle(25);s.remaining=Array.from({length:24},(_,i)=>castle(24-i));for(let i=0;i<5;i++)s=G.transition(s,{type:"PLACE",column:i}).state;eq([G.count(s),s.ended,s.battleScore],[5,1,0]);assert(S.validate(s)); });
  test("C22 再合戦で最高22城保持",()=>{ const s=G.transition(blocked(22),{type:"RETRY"}).state;eq([s.best,G.count(s)],[22,0]); });
  test("S01 保存で未来の順序・色まで一致",()=>{ const mem=memory(),store=S.createStorage(()=>mem),s=G.transition(G.newGame(),{type:"PLACE",column:0}).state;assert(store.save(s).ok);eq(store.load().state,s); });
  test("S02/S03 選択・勝ち戦・戦結果をそのまま復元",()=>{ const store=S.createStorage(()=>memory()); for(const s of [blocked(18),win(),arriveBlocked(14)]){const mem=memory(),st=S.createStorage(()=>mem);assert(st.save(s).ok);eq(st.load().state,s);} });
  test("S04/S09 再合戦後の0点と記録を復元",()=>{let s=win();s=win(G.transition(s,{type:"CONTINUE"}).state,1);s=G.transition(useBlocked(s,18),{type:"RETRY"}).state;const mem=memory(),st=S.createStorage(()=>mem);assert(st.save(s).ok);eq(st.load().state,s);eq([s.wins,s.best,s.battleScore],[2,25,0]);});
  test("S05 ゲーム結果復元",()=>{ let s=G.newGame();for(let i=0;i<3;i++){s=G.transition(useBlocked(s,18),{type:"END"}).state;if(i<2)s=G.transition(s,{type:"NEXT_BATTLE"}).state;}const mem=memory(),st=S.createStorage(()=>mem);assert(st.save(s).ok);eq(st.load().state.finalScore,54); });
  test("S07 保存禁止と容量不足",()=>{const denied=S.createStorage(()=>{throw Error('denied');});assert(!denied.save(G.newGame()).ok);assert(denied.load().error);const full=S.createStorage(()=>({setItem(){throw Error('full');}}));assert(!full.save(G.newGame()).ok);});
  test("S07 壊れたJSON・非対応バージョン",()=>{const mem=memory(),st=S.createStorage(()=>mem);mem.setItem(C.STORAGE_KEY,'{bad');assert(st.load().error);st.save(G.newGame());const data=JSON.parse(mem.getItem(C.STORAGE_KEY));data.version=999;mem.setItem(C.STORAGE_KEY,JSON.stringify(data));assert(st.load().error);});
  test("保存改変: 重複・降順・過剰段・不整合得点・状態",()=>{const edits=[s=>s.remaining[0]=s.current,s=>s.best=-1,s=>s.phase="WIN",s=>s.scores[0]=100,s=>s.battleScore=1,s=>s.remaining[0].color="purple",s=>s.columns[0]=Array(6).fill(castle(1))];for(const edit of edits){const s=G.newGame();edit(s);assert(!S.validate(s));}});
  const summary = { passed: results.filter(r=>r.pass).length, failed: results.filter(r=>!r.pass).length, results };
  root.Shogun.TestResults = summary;
  root.Shogun.TestFixtures = { blocked, arriveBlocked, win, useBlocked, columns };
  if (typeof document !== "undefined") document.getElementById("results").textContent = `${summary.passed}件成功 / ${summary.failed}件失敗\n\n` + results.map(r=>`${r.pass ? "PASS" : "FAIL"} ${r.name}${r.error ? " — "+r.error : ""}`).join("\n");
  if (typeof module !== "undefined" && module.exports) { module.exports = summary; if (require.main === module) { console.log(JSON.stringify(summary,null,2)); if(summary.failed)process.exitCode=1; } }
})(typeof globalThis !== "undefined" ? globalThis : window);
