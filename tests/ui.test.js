(async function () {
  "use strict";
  const { Config:C, Game:G, Storage:S, TestFixtures:F } = Shogun;
  const frame=document.getElementById("game-frame"), output=document.getElementById("ui-results");
  const original=localStorage.getItem(C.STORAGE_KEY), results=[], errors=[];
  const pause=()=>new Promise(r=>setTimeout(r,250));
  const doc=()=>frame.contentDocument;
  const stored=()=>S.createStorage().load().state;
  const assert=(v,m)=>{if(!v)throw Error(m||"assertion failed");};
  async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}output.textContent=results.map(r=>`${r.pass?'PASS':'FAIL'} ${r.name}${r.error?' — '+r.error:''}`).join('\n');}
  async function load(state){
    if(state)assert(S.createStorage().save(state).ok,'fixture save failed');else localStorage.removeItem(C.STORAGE_KEY);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('iframe load timed out')),10000);frame.onload=()=>{clearTimeout(timer);frame.contentWindow.addEventListener('error',e=>errors.push(e.message));resolve();};frame.src='../index.html?ui-test='+Date.now();});
    await pause();
  }
  async function click(selector){const el=doc().querySelector("dialog[open]")?.querySelector(selector)||doc().querySelector(selector);assert(el,'missing '+selector);el.click();await pause();}
  const action=name=>click(`[data-action="${name}"]`);
  const text=()=>doc().body.textContent;
  try {
    await test('タイトル→遊び方→戻る→開始',async()=>{await load();await action('HELP');assert(doc().querySelector('dialog').open);await action('CLOSE_HELP');assert(!doc().querySelector('dialog').open);await action('NEW');assert(doc().querySelectorAll('.column').length===5);assert(stored().battle===1);});
    await test('未来の数字はDOMに描画しない',async()=>{assert(doc().querySelectorAll('.castle').length===1);assert(doc().querySelector('.current-art').getAttribute('aria-label'));});
    await test('数字キーで配置・長押し反復を拒否',async()=>{doc().dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));const n=G.count(stored());doc().dispatchEvent(new KeyboardEvent('keydown',{key:'1',repeat:true,bubbles:true}));assert(n===1&&G.count(stored())===1);});
    await test('遊び方で進行停止・Escapeで復帰',async()=>{const before=JSON.stringify(stored());await action('HELP');doc().dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true}));assert(JSON.stringify(stored())===before);doc().querySelector('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));assert(!doc().querySelector('dialog').open);});
    await test('S01/S08 遊び方を開いたまま再読込で城・順序・種類を保持',async()=>{const before=stored();await action('HELP');await load(before);await action('RESUME');assert(JSON.stringify(stored())===JSON.stringify(before));assert(doc().querySelector('.count strong').textContent.startsWith('1'));});
    await test('S06 新規開始の取消は保存を保持',async()=>{const before=stored();await load(before);await action('NEW');await action('CANCEL_NEW');assert(JSON.stringify(before)===JSON.stringify(stored()));await action('NEW');await action('CONFIRM_NEW');assert(G.count(stored())===0);});
    const fixture=G.newGame(()=>.5);fixture.columns[0]=[{number:20,color:'islamic'}];const deck=G.createDeck(()=>.5).filter(c=>c.number!==20);fixture.current=deck.shift();fixture.remaining=deck;fixture.best=1;
    await test('不可列クリックは得点と現在の城を変えない',async()=>{await load(fixture);await action('RESUME');const before=JSON.stringify(stored());await click('[data-column="0"]');assert(JSON.stringify(stored())===before);assert(doc().querySelector('.message').textContent.includes('置けません'));});
    for(const size of [[320,568],[320,740],[375,667],[375,812],[1280,720],[740,320]])await test(`表示 ${size[0]}×${size[1]}：5列・横溢れなし`,async()=>{frame.style.width=size[0]+'px';frame.style.height=size[1]+'px';await pause();assert(doc().documentElement.scrollWidth<=frame.contentWindow.innerWidth);assert(doc().documentElement.scrollHeight<=frame.contentWindow.innerHeight,"vertical overflow");const cols=[...doc().querySelectorAll('.column')].map(c=>c.getBoundingClientRect());assert(cols.length===5&&cols.every(c=>Math.abs(c.top-cols[0].top)<1&&c.width>=44));});
    await test('城は下から上へ積まれる',async()=>{const s=G.newGame();s.columns=F.columns(3);const used=s.columns.flat().map(c=>c.number);const deck=G.createDeck().filter(c=>!used.includes(c.number));s.current=deck.shift();s.remaining=deck;s.best=3;F.sync(s);await load(s);await action('RESUME');const boxes=[...doc().querySelectorAll('[data-column="0"] .castle')].map(c=>c.getBoundingClientRect());assert(boxes[0].top>boxes[1].top&&boxes[1].top>boxes[2].top);});
    await test('S03 勝ち戦復元・同じ戦の続行',async()=>{await load(F.win());await action('RESUME');assert(doc().querySelector('dialog').textContent.includes('勝ち戦！'));assert(stored().battleScore===25);await action('CONTINUE');assert(stored().battle===1&&stored().battleScore===25&&stored().ended===0&&stored().bonusStage);assert(doc().body.classList.contains('bonus'));});
    await test('強制戦終了→第2戦へ',async()=>{await load(F.arriveBlocked(14));await action('RESUME');assert(doc().querySelector('dialog').textContent.includes('0点'));await action('NEXT_BATTLE');assert(stored().battle===2&&stored().ended===1);});
    await test('第3戦終了→最終結果→タイトル→再プレイ',async()=>{let prev=G.newGame();prev.battle=3;prev.ended=2;prev.scores=[21,22,null];let s=F.arriveBlocked(18,prev);await load(s);await action('RESUME');assert(stored().finalScore===61);assert(doc().querySelector('.result-number').textContent==='61点');await action('TITLE');assert(text().includes('前回の結果を見る'));await action('RESUME');await action('NEW');assert(stored().battle===1&&stored().wins===0&&stored().best===0);});
    await test('4段仮加点と失効表示',async()=>{let s=G.newGame();s.current={number:1,color:'islamic'};s.remaining=Array.from({length:24},(_,i)=>({number:i+2,color:'islamic'}));for(let i=0;i<4;i++)s=G.transition(s,{type:'PLACE',column:0}).state;await load(s);await action('RESUME');assert(text().includes('同種4段 ＋5点'));assert(text().includes('（仮）'));assert(doc().querySelector('.score-preview strong').textContent==='0点');});
    await test('配置不能の勝ち戦：18城・41点・原因・再読込',async()=>{const s=F.monoBlocked();await load(s);await action('RESUME');assert(doc().querySelector('dialog').textContent.includes('勝ち戦！'));assert(doc().querySelector('.blocked-castle b').textContent==='置けなかった城：1');assert(doc().querySelector('.blocked-castle').textContent.includes('イスラムの城'));assert(doc().querySelector('.result-number').textContent==='+41点');await load(stored());await action('RESUME');assert(stored().battleScore===41);await action('CONTINUE');assert(stored().battle===1&&stored().wins===1&&stored().best===18);});
    await test('25城の勝ち戦には原因を表示しない',async()=>{await load(F.win());await action('RESUME');assert(!doc().querySelector('.blocked-castle'));assert(!doc().querySelector('.rating'));});
    await test('最終評価と原因を再読込して保持',async()=>{let prev=G.newGame();prev.battle=3;prev.ended=2;prev.scores=[21,22,null];let s=F.arriveBlocked(18,prev);await load(s);await action('RESUME');assert(doc().querySelector('.rating').textContent.includes('あなたの評価'));assert(doc().querySelector('.rating').textContent.includes('副大将'));assert(doc().querySelector('.blocked-castle b').textContent.includes('1'));assert(stored().finalScore===61);await load(stored());await action('RESUME');assert(stored().finalScore===61);});
    await test('旧保存データから安全に新規開始',async()=>{await load();localStorage.setItem(C.STORAGE_KEY,JSON.stringify({version:1,rules:1}));await new Promise(resolve=>{frame.onload=resolve;frame.contentWindow.location.reload();});await pause();await action('SAVE_INFO');assert(text().includes('以前のルール'));await action('CLOSE_HELP');assert(!doc().querySelector('[data-action="RESUME"]'));await action('NEW');assert(stored().battle===1);});
    await test('画像3種の読み込みと種類名',async()=>{await load();const imgs=[...doc().querySelectorAll('.castle img')];await Promise.all(imgs.map(i=>i.decode()));assert(imgs.length===3&&imgs.every(i=>i.naturalWidth>0));assert(text().includes('イスラム')&&text().includes('西洋')&&text().includes('日本'));await action('NEW');});
    await test('ゲーム内アセット読込成功・外部通信なし',async()=>{const entries=frame.contentWindow.performance.getEntriesByType('resource');assert(entries.filter(e=>/\.(css|js)/.test(e.name)).length===5);assert(entries.every(e=>new URL(e.name).origin===location.origin));});
    await test('S08 詳細の読込・閉じるは盤面不変',async()=>{const before=stored();await action('DETAILS');await action('NEXT');await load(before);await action('RESUME');assert(JSON.stringify(stored())===JSON.stringify(before));});
    await test('連続勝ち戦ボタン・連打・再読込の演出なし',async()=>{const s=F.win(G.transition(F.win(),{type:'CONTINUE'}).state);await load(s);await action('RESUME');assert(doc().body.classList.contains('bonus'));assert(doc().querySelector('[data-action="CONTINUE"]').textContent==='ボーナスステージを続ける');assert(!doc().querySelector('.celebrate'));const b=doc().querySelector('[data-action="CONTINUE"]');b.click();b.click();await pause();assert(stored().wins===2&&stored().battleScore===50&&stored().bonusStage);});
    await test('結果Escape無効・詳細後も加点不変',async()=>{await load(F.arriveBlocked(18));await action('RESUME');const before=JSON.stringify(stored());doc().querySelector('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));assert(doc().querySelector('dialog').open);await action('DETAILS');await action('CLOSE_HELP');assert(JSON.stringify(stored())===before&&doc().querySelector('dialog').open);});
    await test('未処理JavaScriptエラーなし',async()=>assert(errors.length===0,errors.join('\n')));
  } finally {
    if(original===null)localStorage.removeItem(C.STORAGE_KEY);else localStorage.setItem(C.STORAGE_KEY,original);
    const passed=results.filter(r=>r.pass).length;output.textContent=`${passed}件成功 / ${results.length-passed}件失敗\n保存データは復元済み\n\n`+output.textContent;
    window.UIResults={passed,failed:results.length-passed,results,errors};
    document.title=`画面テスト ${passed}/${results.length}`;
  }
})();
