(function () {
  "use strict";
  const { Config: C, Game: G, Storage } = window.Shogun;
  const app = document.getElementById("app"), modal = document.getElementById("modal"), announcement = document.getElementById("announcement");
  const storage = Storage.createStorage();
  const loaded = storage.load();
  let saved = loaded.state, state = null, saveError = loaded.error, screen = "TITLE", modalMode = null, returnFocus = null, lastClick = 0;
  let lastPlaced = -1, completedColumn = -1, message = "", errorColumn = -1;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const number = n => n.toLocaleString("ja-JP");
  const colorOf = castle => C.CASTLE_COLORS.find(color => color.id === castle.color);
  const points = n => `${number(n)}<small>点</small>`;
  const button = (label, action, style = "primary") => `<button class="button ${style}" data-action="${action}">${label}</button>`;
  function castle(c, size = "", animate = false) {
    const color = colorOf(c);
    return `<span class="castle ${size} ${animate ? "land" : ""}" style="--castle-color:${color.hex}" aria-hidden="true"><span class="roof"></span><span class="castle-wall"><b>${c.number}</b><span class="castle-color"><span class="color-mark">${color.mark}</span> ${color.name}</span></span><span class="stone"></span></span>`;
  }
  const brand = () => `<div class="brand"><span class="crest" aria-hidden="true">五</span><span>五段重ね将軍<small>数字を読み、五段を築け。</small></span></div>`;
  function announce(text) { announcement.textContent = text; }
  function persist() { const result = storage.save(state); saveError = result.ok ? null : result.error; saved = G.clone(state); }
  function renderTitle() {
    screen = "TITLE";
    app.innerHTML = `<main class="title-page"><header>${brand()}<span class="edition">思考型 城積みパズル</span></header><section class="title-hero"><p class="eyebrow">運を読み、一手を決める。</p><h1>五段重ね<span>将軍</span></h1><div class="title-castles" aria-hidden="true">${castle({ number: 3, color: "blue" })}${castle({ number: 8, color: "red" })}${castle({ number: 14, color: "green" })}</div><p class="hero-copy">小さな城から、大きな城へ。<br>五つの列に、あなたの采配を。</p><div class="title-actions">${saved ? button(saved.phase === G.Phase.GAME_RESULT ? "前回の結果を見る" : "つづきから", "RESUME") + `<p class="resume-note">第${saved.battle}戦 · 現在の合計 ${number(G.totalScore(saved))}点</p>` + button("最初から遊ぶ", "NEW", "secondary") : button("はじめる", "NEW")}${button("遊び方", "HELP", "quiet")}</div><div class="title-rules"><span><b>5</b>列 × <b>5</b>段</span><span><b>15</b>城から得点</span><span>全<b>3</b>戦</span></div></section><footer>登録不要・端末内に自動保存${saveError ? `<p class="save-error">${escape(saveError)}</p>` : ""}</footer></main>`;
  }
  function render() {
    if (!state) return renderTitle();
    screen = "GAME";
    const info = G.score(state.columns), available = G.available(state), active = state.phase === G.Phase.PLAYING;
    app.innerHTML = `<main class="game-page"><header>${brand()}<button class="help-button" data-action="HELP" aria-label="遊び方を開く">? <span>遊び方</span></button></header>
      <section class="scoreboard" aria-label="戦績"><div class="battle-indicator"><span class="eyebrow">現在の戦</span><strong>第${state.battle}戦</strong><span>全${C.NUMBER_OF_BATTLES}戦</span></div><div class="battle-scores">${state.scores.map((n, i) => `<div class="battle-score ${i + 1 === state.battle ? "current" : ""}"><span>第${i + 1}戦</span><b>${n !== null ? `${number(n)}<small>点</small>` : i + 1 === state.battle ? "挑戦中" : "未開始"}</b></div>`).join("")}</div><div class="total"><span>現在の合計</span><strong>${points(G.totalScore(state))}</strong><small>第${state.battle}戦 累積 ${number(state.battleScore)}点</small></div></section>
      <div class="board-heading"><span><span class="gold-dot"></span> ${active ? "金の枠に城を置けます" : "この盤面の結果"}</span><span>下から上へ、大きい数字</span></div>
      <section class="board" aria-label="5本の城列">${state.columns.map((col, i) => {
        const allowed = active && available.includes(i), full = col.length === C.MAX_STACK_HEIGHT, mono = G.isMono(col);
        const label = allowed ? "置ける" : full ? "満杯" : active ? "数字不足" : "配置終了";
        const readable = col.map(c => `${c.number} ${colorOf(c).name}`).join("、") || "空";
        return `<button class="column ${allowed ? "available" : ""} ${mono ? "mono" : ""} ${i === errorColumn ? "invalid" : ""} ${i === completedColumn ? "mono-flash" : ""}" data-column="${i}" ${active ? "" : "disabled"} aria-label="第${i + 1}列、${col.length}城、最上段${col.length ? col[col.length - 1].number : "なし"}、${label}。下から${readable}"><span class="column-heading">第${i + 1}列 <kbd>${i + 1}</kbd></span><span class="stack">${Array.from({ length: C.MAX_STACK_HEIGHT }, (_, level) => `<span class="slot ${level === col.length - 1 ? "top" : ""}">${col[level] ? castle(col[level], "", i === lastPlaced && level === col.length - 1) : '<span class="empty-mark" aria-hidden="true"></span>'}</span>`).join("")}</span><span class="column-status">${label}</span><span class="mono-badge">${mono ? "同色5段" : `${col.length} / ${C.MAX_STACK_HEIGHT}`}</span></button>`;
      }).join("")}</section>
      <section class="control-panel"><div class="current-castle"><div><span class="eyebrow">${active ? "次に置く城" : "盤面終了"}</span>${state.current ? `<div class="current-art" role="img" aria-label="${state.current.number}、${colorOf(state.current).name}の城">${castle(state.current, "large")}</div>` : '<div class="conquered">制覇</div>'}</div><div class="current-guide"><strong>${active ? "置く列を選ぼう" : state.phase === G.Phase.WIN ? "25城、積み上げ達成" : "次の采配を決めよう"}</strong><span>${active ? `配置可能：${available.map(i => i + 1).join("・")}列` : "下の結果をご確認ください"}</span><small>クリック・タップ ／ キー 1〜5</small></div></div><div class="board-stats"><div class="count"><span>積んだ城</span><strong>${info.castles}<small> / ${G.TOTAL}城</small></strong></div><div class="progress" aria-hidden="true"><span style="width:${info.castles / G.TOTAL * 100}%"></span><i style="left:${C.MIN_SCORE_CASTLES / G.TOTAL * 100}%"></i></div><p>${info.castles < C.MIN_SCORE_CASTLES ? `得点まであと <b>${C.MIN_SCORE_CASTLES - info.castles}城</b>` : "15城到達 · 得点条件達成"}</p><div class="score-preview"><span>${active || state.phase === G.Phase.CHOOSE ? "この盤面の得点見込み" : "この盤面の得点"}</span><strong>${points(info.points)}</strong></div><small>同色5段 ${info.mono}列 <b>×${info.multiplier}</b> ${info.castles < C.MIN_SCORE_CASTLES ? "· 15城未満は0点" : ""}</small></div></section>
      <p class="message ${errorColumn >= 0 ? "warning" : ""}" id="message">${escape(message || "一度置いた城は動かせません。数字と色、どちらを優先しますか？")}</p><footer><span>勝ち戦 ${state.wins}回 · 再合戦 ${state.retries}回 · 最高 ${state.best}城</span><span class="${saveError ? "save-error" : ""}">${saveError ? escape(saveError) : "自動保存済み"}</span></footer></main>`;
    if (!active) showResult();
  }
  function openModal(mode, content, extraClass = "") {
    if (!modal.open) returnFocus = document.activeElement;
    modalMode = mode;
    modal.className = extraClass;
    modal.innerHTML = content;
    if (!modal.open) modal.showModal();
    modal.querySelector("h2").focus();
  }
  function closeModal() { modal.close(); modalMode = null; if (returnFocus && returnFocus.isConnected) returnFocus.focus(); }
  const heading = (eyebrow, title) => `<p class="eyebrow">${eyebrow}</p><h2 id="modal-title" tabindex="-1">${title}</h2>`;
  function showResult() {
    const info = G.score(state.columns);
    const breakdown = `<div class="breakdown"><span>基本点 <b>${info.base}</b></span><span>同色5段 <b>${info.mono}列</b></span><span>倍率 <b>×${info.multiplier}</b></span></div>`;
    if (state.phase === G.Phase.CHOOSE) openModal("RESULT", `${heading(`第${state.battle}戦 · ${info.castles}城`, "城をこれ以上<br>積めません")}${breakdown}<p>この盤面の獲得予定 <b>${info.points}点</b><br>この戦の累積 <b>${number(state.battleScore)}点</b></p><div class="choice"><p>戦終了なら、この戦は合計 <b>${number(state.battleScore + info.points)}点</b></p>${button("戦終了 — 得点を確定", "END")}</div><div class="choice caution"><p>再合戦なら、この戦は <b>0点から</b></p><p class="small">この戦の累積${number(state.battleScore)}点をすべて破棄し、今回の${info.points}点も加算しません。</p>${button("再合戦 — 0点から挑戦", "RETRY", "danger")}</div><p class="small muted">終了済みの戦の得点、勝ち戦回数、最高積載数は残ります。</p>`);
    if (state.phase === G.Phase.WIN) openModal("RESULT", `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>${heading("25城制覇", "勝ち戦！")}${breakdown}<p class="result-label">今回の獲得</p><div class="result-number">+${points(info.points)}</div><p class="result-cumulative">第${state.battle}戦 累積 <b>${number(state.battleScore)}点</b></p><p>第${state.battle}戦は続きます。</p>${button("次の合戦へ", "CONTINUE")}`, "win-dialog");
    if (state.phase === G.Phase.BATTLE_RESULT) openModal("RESULT", `${heading(`${info.castles}城 · 戦績`, `第${state.battle}戦 終了`)}${breakdown}<div class="result-rows"><p><span>今回の盤面</span><b>${info.points}点</b></p><p><span>勝ち戦による累積</span><b>${number(state.battleScore - info.points)}点</b></p></div>${info.castles < C.MIN_SCORE_CASTLES ? '<p class="small">15城未満のため、この盤面は0点です。<br>勝ち戦で獲得した得点は残ります。</p>' : ""}<p class="result-label">この戦の最終得点</p><div class="result-number">${points(state.battleScore)}</div>${button(`第${state.battle + 1}戦へ`, "NEXT_BATTLE")}`);
    if (state.phase === G.Phase.GAME_RESULT) openModal("RESULT", `${heading("五段重ね将軍", "戦績")}<div class="result-rows">${state.scores.map((n, i) => `<p><span>第${i + 1}戦</span><b>${number(n)}点</b></p>`).join("")}</div><p class="result-label">最終得点</p><div class="result-number">${points(state.finalScore)}</div><div class="records"><span>勝ち戦<b>${state.wins}回</b></span><span>再合戦<b>${state.retries}回</b></span><span>最高積載<b>${state.best}城</b></span></div>${button("もう一度遊ぶ", "NEW")}${button("タイトルへ", "TITLE", "quiet")}`);
  }
  function help() {
    openModal("HELP", `${heading("指南書", "遊び方")}<div class="help-content"><h3>一、大きい数字を上へ</h3><p>1〜25の城を5列に積みます。空列には何でも置けます。城の上には、より大きい数字だけ。各列5城までです。</p><div class="help-stack"><span>14</span><span>8</span><span>3</span><small>下から上へ ↑</small></div><p>次に置く城だけが見えます。一度置いた城は移動・取り消しできません。</p><h3>二、まずは15城</h3><div class="help-threshold"><span>14城 <b>0点</b></span><span>15城 <b>15点〜</b></span></div><p>同色5段があっても、15城未満で詰まるとその盤面は0点です。</p><h3>三、色をそろえて倍率アップ</h3><p>赤・青・緑は同じ確率で出現します。1列の5城すべてが同色ならボーナス。列同士の色は違っても構いません。</p><table><caption>同色5段完成列数と倍率</caption><tbody>${C.MONOCHROME_MULTIPLIERS.map((n, i) => `<tr><th>${i}列</th><td>×${n}</td></tr>`).join("")}</tbody></table><p>例：18城・同色5段1列なら、18×2＝36点。色を狙うことで、15城に届かなくなることもあります。</p><h3>四、戦の終わりと続き</h3><ul><li><b>14城以下で詰まる：</b>盤面0点で戦終了。勝ち戦の累積得点は残ります。</li><li><b>15〜24城で詰まる：</b>「戦終了」で得点確定、または「再合戦」を選びます。</li><li><b>再合戦：</b>その戦の累積得点もすべて捨てて0点から。同じ戦で何度でも挑戦できます。終了済みの別の戦の得点と参考記録は残ります。</li><li><b>25城完成：</b>勝ち戦！ 得点を加算して同じ戦を続けます。</li></ul><p><b>戦終了が3回起きたらゲーム終了。</b>3戦の合計得点を競います。</p><h3>五、操作と中断</h3><p>列をクリック・タップ、またはキー1〜5。TabとEnter／Spaceでも操作できます。進行は端末内に自動保存され、「つづきから」で再開できます。再読み込みで城の順番は変わりません。</p><p class="small">同じ端末・ブラウザで再開してください。ブラウザの保存データを削除すると進行は失われます。自動保存が利用できない場合は画面に通知します。</p></div>${button("戻る", "CLOSE_HELP")}`, "help-dialog");
  }
  function startGame() { closeModal(); state = G.newGame(); message = ""; lastPlaced = completedColumn = errorColumn = -1; persist(); render(); document.querySelector('[data-column="0"]').focus(); }
  function apply(action) {
    const before = state, result = G.transition(state, action);
    if (!result.changed) {
      if (action.type === "PLACE" && state.phase === G.Phase.PLAYING) {
        errorColumn = action.column; lastPlaced = completedColumn = -1;
        message = state.columns[action.column].length === C.MAX_STACK_HEIGHT ? "この列は満杯です。この城はここには置けません。" : "この城はここには置けません。最上段より大きい数字が必要です。";
        render(); document.querySelector(`[data-column="${action.column}"]`).focus(); announce(message);
      }
      return;
    }
    closeModal(); state = result.state; errorColumn = -1; lastPlaced = action.type === "PLACE" ? action.column : -1;
    completedColumn = lastPlaced >= 0 && G.isMono(state.columns[lastPlaced]) && !G.isMono(before.columns[lastPlaced]) ? lastPlaced : -1;
    message = action.type === "RETRY" ? "再合戦。この戦は0点から、もう一度。参考記録は残っています。" : "";
    if (G.count(before) < C.MIN_SCORE_CASTLES && G.count(state) >= C.MIN_SCORE_CASTLES) message = "15城到達！ 得点条件を達成しました。";
    if (completedColumn >= 0) message = `第${completedColumn + 1}列、同色5段完成！${G.count(state) < C.MIN_SCORE_CASTLES ? " 得点には15城以上が必要です。" : ""}`;
    persist(); render();
    if (state.phase === G.Phase.PLAYING) document.querySelector(`[data-column="${lastPlaced >= 0 ? lastPlaced : 0}"]`).focus({ preventScroll: true });
    announce(`${message} ${G.count(state)}城。${state.current ? `次の城は${state.current.number}、${colorOf(state.current).name}。` : "勝ち戦！"}`);
  }
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-action],[data-column]");
    if (!target || (modal.open && !modal.contains(target))) return;
    const now = performance.now();
    if (now - lastClick < 220) return;
    lastClick = now;
    if (target.dataset.column !== undefined && state) return apply({ type: "PLACE", column: Number(target.dataset.column) });
    const action = target.dataset.action;
    if (action === "HELP") return help();
    if (action === "CLOSE_HELP") return closeModal();
    if (action === "RESUME") { state = G.clone(saved); render(); return; }
    if (action === "TITLE") { closeModal(); state = null; return renderTitle(); }
    if (action === "NEW") {
      if (screen === "TITLE" && saved && saved.phase !== G.Phase.GAME_RESULT) return openModal("CONFIRM", `${heading("新しいゲーム", "最初から遊びますか？")}<p>保存したゲームを破棄して始めます。得点と参考記録もリセットされます。</p>${button("新しく始める", "CONFIRM_NEW")}${button("戻る", "CANCEL_NEW", "secondary")}`);
      return startGame();
    }
    if (action === "CONFIRM_NEW") return startGame();
    if (action === "CANCEL_NEW") return closeModal();
    if (state) apply({ type: action });
  });
  document.addEventListener("keydown", event => {
    if (event.repeat && (["Enter", " "].includes(event.key) || /^[1-5]$/.test(event.key))) { event.preventDefault(); return; }
    if (modal.open || !state || screen !== "GAME" || event.ctrlKey || event.altKey || event.metaKey) return;
    if (/^[1-5]$/.test(event.key)) { event.preventDefault(); apply({ type: "PLACE", column: Number(event.key) - 1 }); }
  });
  modal.addEventListener("cancel", event => { event.preventDefault(); if (modalMode === "HELP" || modalMode === "CONFIRM") closeModal(); });
  renderTitle();
})();
