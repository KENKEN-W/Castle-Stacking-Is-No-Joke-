(function (root) {
  "use strict";
  if (typeof module !== "undefined" && module.exports) { require("../js/config.js"); require("../js/game.js"); require("../js/storage.js"); }
  const { Game: G, Storage: S, Config: C } = root.Shogun;
  const results = [];
  const assert = (ok, message = "assertion failed") => { if (!ok) throw Error(message); };
  const eq = (actual, expected) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  const test = (name, fn) => { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
  const castle = (number, color = "islamic") => ({ number, color });
  function columns(n, mono = 0) {
    let next = 1;
    return Array.from({ length: 5 }, (_, col) => Array.from({ length: Math.max(0, Math.min(5, n - col * 5)) }, (_, j) => castle(next++, col < mono ? C.CASTLE_COLORS[col % 3].id : C.CASTLE_COLORS[j % 3].id)));
  }
  function sync(s) { s.fourColumns=s.columns.map(G.isFour); s.fourBonus=G.score(s.columns).fourBonus; return s; }
  function blocked(n) {
    const state = G.newGame(() => .5);
    let next = 2;
    state.columns = Array.from({ length: 5 }, (_, i) => Array.from({ length: Math.floor(n / 5) + (i < n % 5 ? 1 : 0) }, (_, j) => castle(next++, C.CASTLE_COLORS[j % 3].id)));
    state.current = castle(1);
    state.remaining = Array.from({ length: 24 - n }, (_, i) => castle(n + 2 + i));
    state.best = n;
    state.phase = G.Phase.CANNOT_PLACE;
    return sync(state);
  }
  function arriveBlocked(n, previous = G.newGame()) {
    const state = useBlocked(previous,n), current = state.columns[0].pop();
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
    state.best = Math.max(state.best, n); return sync(state);
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
  test("A12 色の境界と重み", () => { eq(C.CASTLE_COLORS.map(c=>c.weight),[1,1,1]); eq([0,.3333333332,1/3,.6666666665,2/3,.999999].map(n=>G.randomColor(()=>n)),["islamic","islamic","western","western","japanese","japanese"]); });
  [[14,0,0],[15,0,15],[20,0,20],[20,1,45],[20,2,70],[20,3,95],[20,4,120],[25,5,275],[14,1,0],[18,1,41],[22,2,76]].forEach(([n,m,p],i)=>test(`B${String(i+1).padStart(2,"0")} ${n}城・同色${m}列=${p}点`,()=>eq(G.score(columns(n,m)).points,p)));
  test("同色4城・異色混在を除外",()=>{ assert(!G.isMono(columns(4,1)[0])); assert(!G.isMono(columns(5,0)[0])); eq(G.score(columns(10,2)).mono,2); });
  test("S01 保存で未来の順序・色まで一致",()=>{ const mem=memory(),store=S.createStorage(()=>mem),s=G.transition(G.newGame(),{type:"PLACE",column:0}).state;assert(store.save(s).ok);eq(store.load().state,s); });
  test("S07 保存禁止と容量不足",()=>{const denied=S.createStorage(()=>{throw Error('denied');});assert(!denied.save(G.newGame()).ok);assert(denied.load().error);const full=S.createStorage(()=>({setItem(){throw Error('full');}}));assert(!full.save(G.newGame()).ok);});
  test("S07 壊れたJSON・非対応バージョン",()=>{const mem=memory(),st=S.createStorage(()=>mem);mem.setItem(C.STORAGE_KEY,'{bad');assert(st.load().error);st.save(G.newGame());const data=JSON.parse(mem.getItem(C.STORAGE_KEY));data.version=999;mem.setItem(C.STORAGE_KEY,JSON.stringify(data));assert(st.load().error);});
  test("保存改変: 重複・降順・過剰段・不整合得点・状態",()=>{const edits=[s=>s.remaining[0]=s.current,s=>s.best=-1,s=>s.phase="WIN",s=>s.scores[0]=100,s=>s.battleScore=1,s=>s.remaining[0].color="purple",s=>s.columns[0]=Array(6).fill(castle(1))];for(const edit of edits){const s=G.newGame();edit(s);assert(!S.validate(s));}});
  function roundtrip(s) {const mem=memory(),st=S.createStorage(()=>mem);assert(st.save(s).ok,"save failed");eq(st.load().state,s);return st.load().state;}
  function monoBlocked(n=18) { const s=blocked(n); s.columns[0].push(s.columns[4].pop()); if(s.columns[0].length<5)s.columns[0].push(s.columns[3].pop()); s.columns[0].sort((a,b)=>a.number-b.number);s.columns[0].forEach(c=>c.color="islamic");const last=s.columns[0].pop();s.remaining.unshift(s.current);s.current=last;s.phase=G.Phase.PLAYING;sync(s);return G.transition(s,{type:"PLACE",column:0}).state; }
  test("A13 制限付き抽選1000種と6手目の21〜25",()=>{let high=false;for(let i=0;i<1000;i++){const d=G.createDeck();assert(d.slice(0,5).every(c=>c.number<=20));high ||= d[5].number>20;}assert(high);});
  test("A12 種類ごとの個数は固定しない",()=>{eq(new Set(G.createDeck(()=>0).map(c=>c.color)).size,1);});
  test("A14 無効入力・復帰で手数不変",()=>{let s=G.transition(G.newGame(()=>.5),{type:"PLACE",column:0}).state;s=roundtrip(s);eq(G.transition(s,{type:"PLACE",column:-1}).state,s);});
  test("B12 同種4段1列のみ・15城は20点",()=>{const c=columns(15);c[0].slice(0,4).forEach(x=>x.color="islamic");eq(G.score(c).points,20);});
  test("B13 15城・同種5段は35点",()=>eq(G.score(columns(15,1)).points,35));
  test("B14 14城・仮加点15点は全失効",()=>{const s=blocked(14);s.columns=[s.columns.flat().slice(0,4),s.columns.flat().slice(4,8),s.columns.flat().slice(8,12),[s.columns.flat()[12]],[s.columns.flat()[13]]];s.columns.slice(0,3).forEach(c=>c.forEach(x=>x.color="islamic"));const last=s.columns[0].pop();s.remaining.unshift(s.current);s.current=last;s.phase=G.Phase.PLAYING;const end=G.transition(s,{type:"PLACE",column:0}).state;eq([end.fourBonus,end.result.points,end.ended],[15,0,1]);roundtrip(end);});
  test("B15 5城目が異種でも4段加点を保持",()=>{const c=columns(20,1);c[0][4].color="western";eq([G.score(c).fourBonus,G.score(c).mono,G.score(c).points],[5,0,25]);});
  test("B16/S09 4段の配置・5段・無効入力・復帰で重複なし",()=>{let s=G.newGame();s.current=castle(1);s.remaining=Array.from({length:24},(_,i)=>castle(i+2));for(let i=0;i<4;i++)s=G.transition(s,{type:"PLACE",column:0}).state;eq([s.fourBonus,s.battleScore],[5,0]);s=roundtrip(s);s=G.transition(s,{type:"PLACE",column:0}).state;eq(s.fourBonus,5);const r=G.transition(s,{type:"PLACE",column:0});assert(!r.changed);roundtrip(r.state);});
  test("B17 上の4城だけ同種は対象外",()=>{const c=columns(5,1);c[0][0].color="western";eq(G.score(c).fourBonus,0);});
  test("C15 15城・同種5段達成でも置ける間は続行",()=>{let s=G.newGame();s.columns=columns(14,1);s.current=castle(15,"western");s.remaining=Array.from({length:10},(_,i)=>castle(i+16));s.best=14;sync(s);s=G.transition(s,{type:"PLACE",column:2}).state;eq([s.phase,s.wins,s.battleScore],[G.Phase.PLAYING,0,0]);roundtrip(s);});
  test("C16/S03 初勝ち戦18城・原因の城・41点を保存",()=>{const s=monoBlocked();eq([s.phase,s.wins,s.best,s.battleScore,s.ended],[G.Phase.WIN,1,18,41,0]);eq(s.result.blockedCastle,s.current);eq(s.result.winReason,"MONO_BLOCKED");roundtrip(s);assert(!G.transition(s,{type:"END"}).changed);const next=G.transition(s,{type:"CONTINUE"}).state;eq([next.result,next.fourBonus,next.battle,next.battleScore],[null,0,1,41]);roundtrip(next);});
  test("C01 14城・同種5段でも強制終了",()=>{const s=monoBlocked(14);eq([s.phase,s.battleScore,s.wins,s.ended],[G.Phase.BATTLE_RESULT,0,0,1]);roundtrip(s);});
  test("S10 旧形式は非対応・読込だけで上書きしない",()=>{const mem=memory();const raw=JSON.stringify({version:1,rules:1,state:G.newGame()});mem.setItem(C.STORAGE_KEY,raw);const st=S.createStorage(()=>mem);assert(st.load().error);eq(st.load().state,null);eq(mem.getItem(C.STORAGE_KEY),raw);assert(st.save(G.newGame()).ok);assert(st.load().state);});
  test("S07 新しい保存項目の破損を拒否",()=>{for(const change of [s=>s.fourBonus+=5,s=>s.fourColumns[0]=false,s=>s.result.points++,s=>s.result.blockedCastle.number=25,s=>s.result.winReason="FULL_BOARD"]){const s=monoBlocked();change(s);assert(!S.validate(s));}});
  test("D 評価の全境界",()=>{const inputs=[0,14,15,39,40,54,55,64,65,70,71,89,90,158];eq(inputs.map(G.rating),["足軽","足軽","足軽大将","足軽大将","先手大将","先手大将","副大将","副大将","総大将","総大将","戦国大名","戦国大名","天下統一大将軍","天下統一大将軍"]);});

  test("C01-C03 14・15・24城で自動終了",()=>{for(const n of [14,15,24]){const s=arriveBlocked(n);eq([s.phase,s.result.points,s.ended,s.bonusStage],[G.Phase.BATTLE_RESULT,n<15?0:n,1,false]);roundtrip(s);}});
  function withCumulative(n=75){let s=G.newGame();s.battleScore=n;s.wins=3;s.best=25;s.bonusStage=true;return s;}
  test("C04 75+18+5=98 自動確定",()=>{let s=useBlocked(withCumulative(),18);s.columns[0].forEach(c=>c.color='islamic');const last=s.columns[0].pop();s.remaining.unshift(s.current);s.current=last;s.phase=G.Phase.PLAYING;s=G.transition(s,{type:'PLACE',column:0}).state;eq([s.battleScore,s.ended,s.phase],[98,1,G.Phase.BATTLE_RESULT]);roundtrip(s);});
  test("C05/C06 25城勝ち戦から同戦ボーナス",()=>{let s=win();eq([s.battleScore,s.current,s.ended,s.bonusStage,s.result.wasBonus],[25,null,0,true,false]);roundtrip(s);s=G.transition(s,{type:'CONTINUE'}).state;eq([s.battle,s.battleScore,s.bonusStage,G.count(s)],[1,25,true,0]);roundtrip(s);});
  test("C07/C18/C19 連続25+55+18=98 ボーナス解除",()=>{let s=win();s=win(G.transition(s,{type:'CONTINUE'}).state,1);eq([s.result.wasBonus,s.bonusStage],[true,true]);roundtrip(s);s=arriveBlocked(18,G.transition(s,{type:'CONTINUE'}).state);eq([s.scores[0],s.ended,s.wins,s.bonusStage],[98,1,2,false]);roundtrip(s);s=G.transition(s,{type:'NEXT_BATTLE'}).state;eq([s.battle,s.battleScore,s.bonusStage],[2,0,false]);roundtrip(s);});
  test("C08 累積75+14城は75点保持",()=>{const s=arriveBlocked(14,withCumulative());eq([s.scores[0],s.result.points,s.bonusStage],[75,0,false]);roundtrip(s);});
  function final(){let s=G.newGame();for(let i=0;i<3;i++){s=arriveBlocked(18,s);if(i<2)s=G.transition(s,{type:'NEXT_BATTLE'}).state;}return s;}
  test("C09/C12 3戦終了・二重操作拒否",()=>{const s=final();eq([s.phase,s.finalScore,s.ended],[G.Phase.GAME_RESULT,54,3]);for(const type of ['NEXT_BATTLE','CONTINUE','PLACE'])assert(!G.transition(s,{type,column:0}).changed);roundtrip(s);});
  test("C10 93+21+44=158",()=>{let s=withCumulative(25);s.battle=3;s.ended=2;s.scores=[93,21,null];s=arriveBlocked(19,s);eq([s.scores,s.finalScore,G.rating(s.finalScore)],[[93,21,44],158,'天下統一大将軍']);roundtrip(s);});
  test("C11 新規開始で全リセット",()=>{const s=G.newGame();eq([s.battle,s.ended,s.wins,s.best,s.battleScore,s.bonusStage],[1,0,0,0,0,false]);assert(!('retries' in s));eq(s.scores,[null,null,null]);});
  test("C12 続行と次戦の連打は進まない",()=>{for(const [s,type] of [[win(),'CONTINUE'],[arriveBlocked(18),'NEXT_BATTLE']]){const first=G.transition(s,{type}).state;assert(!G.transition(first,{type}).changed);roundtrip(first);}});
  test("C13 前の93点保持",()=>{let s=G.newGame();s.battle=2;s.ended=1;s.scores=[93,null,null];s=arriveBlocked(18,s);eq([s.scores,G.totalScore(s)],[[93,18,null],111]);roundtrip(s);});
  test("C14 全新盤面の序盤制限",()=>{for(const s of [G.newGame(),G.transition(win(),{type:'CONTINUE'}).state,G.transition(arriveBlocked(18),{type:'NEXT_BATTLE'}).state]){assert([s.current,...s.remaining].slice(0,5).every(c=>c.number<=20));roundtrip(s);}});
  test("C17 旧RETRY/ENDを全状態で拒否",()=>{for(const s of [G.newGame(),win(),arriveBlocked(18),final()])for(const type of ['RETRY','END']){const r=G.transition(s,{type});assert(!r.changed);eq(r.state,s);}});
  test("C20 ボーナスでも同じ抽選と得点",()=>{const normal=G.newGame(()=>.5),bonus=G.transition(win(),{type:'CONTINUE'},()=>.5).state;eq([normal.current,normal.remaining],[bonus.current,bonus.remaining]);eq(G.score(normal.columns),G.score(bonus.columns));});
  test("S02-S05/S09 全状態・ボーナス・次戦・最終結果復元",()=>{for(const s of [win(),monoBlocked(),G.transition(win(),{type:'CONTINUE'}).state,arriveBlocked(18),G.transition(arriveBlocked(18),{type:'NEXT_BATTLE'}).state,final()])roundtrip(s);});
  test("S10 v2選択状態も読込で書き換えない",()=>{const mem=memory(),st=S.createStorage(()=>mem);const raw=JSON.stringify({version:2,rules:2,state:{phase:'CHOOSE_END_OR_RETRY'}});mem.setItem(C.STORAGE_KEY,raw);assert(st.load().error);eq(mem.getItem(C.STORAGE_KEY),raw);assert(st.save(G.newGame()).ok);roundtrip(st.load().state);});
  test("S11 ボーナスフラグの欠落・不整合拒否",()=>{for(const s of [G.newGame(),win(),arriveBlocked(18),G.transition(win(),{type:'CONTINUE'}).state]){s.bonusStage=!s.bonusStage;assert(!S.validate(s));}let s=win();delete s.bonusStage;assert(!S.validate(s));s=win();s.result.wasBonus=true;assert(!S.validate(s));});


  test("C08 仮加点も失効・累積75保持",()=>{let s=useBlocked(withCumulative(),14);const flat=s.columns.flat();s.columns=[flat.slice(0,4),flat.slice(4,8),flat.slice(8,12),[flat[12]],[flat[13]]];s.columns.slice(0,3).forEach(col=>col.forEach(c=>c.color='islamic'));const last=s.columns[0].pop();s.remaining.unshift(s.current);s.current=last;s.phase=G.Phase.PLAYING;s=G.transition(s,{type:'PLACE',column:0}).state;eq([s.result.points,s.fourBonus,s.scores[0]],[0,15,75]);roundtrip(s);});

  const summary = { passed: results.filter(r=>r.pass).length, failed: results.filter(r=>!r.pass).length, results };
  root.Shogun.TestResults = summary;
  root.Shogun.TestFixtures = { blocked, arriveBlocked, win, useBlocked, columns, sync, monoBlocked, final };
  if (typeof document !== "undefined") document.getElementById("results").textContent = `${summary.passed}件成功 / ${summary.failed}件失敗\n\n` + results.map(r=>`${r.pass ? "PASS" : "FAIL"} ${r.name}${r.error ? " — "+r.error : ""}`).join("\n");
  if (typeof module !== "undefined" && module.exports) { module.exports = summary; if (require.main === module) { console.log(JSON.stringify(summary,null,2)); if(summary.failed)process.exitCode=1; } }
})(typeof globalThis !== "undefined" ? globalThis : window);
