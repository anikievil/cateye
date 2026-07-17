/* 跑一次就好 — SPA（hash routing, localStorage, 無後端） */
(function () {
  "use strict";

  const $app = document.getElementById("app");
  const byId = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
  const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  // ── 儲存層 ──
  const store = {
    get(k, fallback) {
      try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; }
      catch { return fallback; }
    },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  };
  const myList = () => store.get("mylist", []);
  const setMyList = (v) => { store.set("mylist", v); updateBadge(v.length); };
  const checks = (id) => store.get("chk:" + id, []);
  const setChecks = (id, v) => store.set("chk:" + id, v);
  const reminders = () => store.get("reminders", []);
  const setReminders = (v) => store.set("reminders", v);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function updateBadge(n = myList().length) {
    const b = document.getElementById("myBadge");
    b.hidden = n === 0;
    b.textContent = n;
  }

  // ── 提醒工具 ──
  function daysUntil(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return Math.ceil((d - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }
  function dueSoon() {
    return reminders()
      .map((r) => ({ ...r, days: daysUntil(r.date) }))
      .filter((r) => r.days <= 7)
      .sort((a, b) => a.days - b.days);
  }
  function downloadICS(r) {
    const dt = r.date.replace(/-/g, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//跑一次就好//TW",
      "BEGIN:VEVENT",
      "UID:" + Date.now() + "@run-once.tw",
      "DTSTART;VALUE=DATE:" + dt,
      "SUMMARY:" + r.label.replace(/[,;\\]/g, " "),
      "DESCRIPTION:來自「跑一次就好」的辦事提醒",
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + r.label.replace(/[,;\\]/g, " "), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "提醒-" + r.label.slice(0, 12) + ".ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── 搜尋 ──
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return SERVICES
      .map((s) => {
        let score = 0;
        if (s.title.toLowerCase().includes(q)) score += 10;
        if ((s.aliases || []).some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) score += 6;
        if (s.summary.toLowerCase().includes(q)) score += 2;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s)
      .slice(0, 12);
  }

  // ── 共用片段 ──
  const svcChips = (s) => {
    let h = "";
    if (s.steps?.length) h += '<span class="chip chip-deep">完整攻略</span>';
    h += `<span class="chip chip-cat">${esc(catById[s.cat].name)}</span>`;
    if (s.online?.available) h += '<span class="chip chip-online">可線上辦</span>';
    return h;
  };
  const svcItem = (s) => `
    <a class="svc-item" href="#/s/${s.id}">
      <div class="svc-t">${esc(s.title)} ${svcChips(s)}</div>
      <div class="svc-s">${esc(s.summary)}</div>
    </a>`;
  const specNote = (d) => (d.spec ? `<div class="ck-spec">🗣 櫃檯會問：${esc(d.spec)}</div>` : "");

  // ── 吉祥物（嚴肅頁面不出現，見 SOLEMN_IDS） ──
  function catSVG(pose = "idle", size = 64) {
    const eyes =
      pose === "happy" ? '<path d="M26 27q3-4 6 0M44 27q3-4 6 0" class="cl"/>' :
      pose === "sleep" ? '<path d="M26 28h7M43 28h7" class="cl"/>' :
      pose === "sad" ? '<path d="M26 29q3 2 6 0M44 29q3 2 6 0" class="cl"/>' :
      '<circle cx="29" cy="27" r="2.4" class="cf"/><circle cx="47" cy="27" r="2.4" class="cf"/>';
    const mouth =
      pose === "sad" ? '<path d="M34 37q4-3 8 0" class="cl"/>' :
      pose === "happy" ? '<path d="M33 33q2.5 4 5 0q2.5 4 5 0" class="cl"/>' :
      '<path d="M36 33q2 2 4 0" class="cl"/>';
    const extra =
      pose === "sad" ? '<path d="M25 21l7 2M51 21l-7 2" class="cl"/>' :
      pose === "sleep" ? '<text x="58" y="14" class="zz">z z</text>' : "";
    return `<svg class="cat cat-${pose}" width="${size}" height="${size}" viewBox="0 0 76 66" aria-hidden="true">
      <path class="cl cat-tail" d="M62 56q12-2 10-14" fill="none"/>
      <path class="cp" d="M20 58q-4-18 8-26l24 0q12 8 8 26z"/>
      <path class="cp" d="M22 14L26 2L36 10M54 14L50 2L40 10"/>
      <circle class="cp" cx="38" cy="26" r="17"/>
      ${eyes}<path d="M36 30l2 2 2-2" class="cl"/>${mouth}${extra}
      <path d="M14 26h9M14 31l9-1M62 26h-9M62 31l-9-1" class="cl"/>
      <path class="collar" d="M27 44q11 6 22 0l1 4q-12 6-24 0z"/>
      <circle class="tag" cx="38" cy="50" r="3.4"/>
    </svg>`;
  }
  const catBubble = (pose, text) => `
    <div class="cat-row">
      ${catSVG(pose)}
      <div class="cat-bubble"><b>${esc(MASCOT_NAME)}</b>${esc(text)}</div>
    </div>`;

  // ── 分享（原生分享面板，備援剪貼簿） ──
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  async function shareText(text) {
    const full = text + "\n" + location.origin + location.pathname + "#/cases";
    try {
      if (navigator.share) { await navigator.share({ text: full }); return; }
      throw new Error("no-share");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      try { await navigator.clipboard.writeText(full); toast("已複製，貼到群組吧！"); }
      catch { toast("複製失敗，請長按選取文字"); }
    }
  }
  const disclaimer = () => `
    <footer class="disclaimer">⚠ ${esc(DISCLAIMER)}
      <div style="margin-top:8px"><a href="${reportMailto("整體建議或錯誤回報")}">✉ 回報錯誤／給我們建議</a></div>
    </footer>`;

  // ── 回報系統（mailto，無後端） ──
  const mailtoURL = (subject, body) =>
    "mailto:" + REPORT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  function reportMailto(topic) {
    const body = [
      "回報項目：" + topic,
      "頁面：" + location.href,
      "",
      "◆ 哪裡不對／發生什麼事（費用變了？文件不用了？流程卡住？）：",
      "",
      "",
      "◆ 你去的是哪個單位（縣市／機關名，選填）：",
      "",
      "感謝回報！查證後會更新內容。",
    ].join("\n");
    return mailtoURL("【跑一次就好】回報：" + topic, body);
  }

  // ── 首頁 ──
  function renderHome() {
    const featured = SERVICES.filter((s) => s.featured);
    const due = dueSoon();
    $app.innerHTML = `
      <header class="masthead rise">
        <div class="brand-row">
          <div class="brand-seal">辦</div>
          <div>
            <div class="brand-name">跑一次就好</div>
            <div class="brand-sub">公家機關辦事指南</div>
          </div>
        </div>
        <div class="searchbox">
          <input id="q" type="search" placeholder="要辦什麼？例：權狀不見、過戶、印鑑…" autocomplete="off" enterkeyhint="search">
          <span class="s-ic">⌕</span>
        </div>
        <div class="search-results" id="results"></div>
        ${catBubble("idle", MASCOT_TIPS[Math.floor(Math.random() * MASCOT_TIPS.length)])}
        <a class="wiz-cta rise" href="#/wizard">
          <span class="wiz-cta-ic">⚑</span>
          <span><b>不知道缺什麼？先選你要辦的事</b><br>
          <small>回答幾個「有／還沒」，直接生出你的準備方案＋缺件解法</small></span>
          <span class="wiz-cta-go">→</span>
        </a>
        ${due.length ? `
          <div class="due-banner">
            <b>◷ 有 ${due.length} 件事快到期</b>
            ${due.slice(0, 3).map((r) => `${esc(r.label)}（${r.days <= 0 ? "今天！" : r.days + " 天後"}）`).join("、")}
            — <a href="#/my">查看清單</a>
          </div>` : ""}
      </header>

      <section id="homeMain">
        <div class="sec-h rise rise-1"><h2>情境包</h2><span class="rule"></span><a class="more" href="#/cat/scenario">全部</a></div>
        <div class="feat-scroll rise rise-1">
          ${featured.map((s) => `
            <a class="feat-card" href="#/s/${s.id}" data-stamp="免白跑">
              <div class="feat-kicker">跨單位・一條龍</div>
              <div class="feat-title">${esc(s.title)}</div>
              <div class="feat-desc">${esc(s.summary)}</div>
              <div class="feat-meta">${s.steps.length} 個步驟・${s.docs.length} 份文件・${s.pitfalls.length} 個常見卡關</div>
            </a>`).join("")}
        </div>

        <div class="sec-h rise rise-2"><h2>分類瀏覽</h2><span class="rule"></span></div>
        <div class="cat-grid rise rise-2">
          ${CATEGORIES.map((c) => `
            <a class="cat-card" href="#/cat/${c.id}">
              <span class="cat-ic">${esc(c.icon)}</span>
              <span><span class="cat-name">${esc(c.name)}</span><br><span class="cat-desc">${esc(c.desc)}</span></span>
            </a>`).join("")}
        </div>
        ${disclaimer()}
      </section>`;

    const $q = document.getElementById("q");
    const $r = document.getElementById("results");
    const $main = document.getElementById("homeMain");
    $q.addEventListener("input", () => {
      const hits = search($q.value);
      const active = $q.value.trim().length > 0;
      $main.style.display = active ? "none" : "";
      $r.innerHTML = !active ? "" :
        hits.length ? hits.map(svcItem).join("") :
        `<div class="search-empty">找不到「${esc($q.value)}」——換個說法試試（例：謄本、報稅、過戶），或到分類裡找。</div>`;
    });
  }

  // ── 分類頁 ──
  function renderCat(catId) {
    const c = catById[catId];
    if (!c) return renderHome();
    const list = SERVICES.filter((s) => s.cat === catId);
    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/">← 回首頁</a>
        <div class="sec-h"><h2>${esc(c.icon)}　${esc(c.name)}</h2><span class="rule"></span></div>
        <p class="page-desc">${esc(c.desc)}</p>
      </header>
      <section class="rise rise-1">${list.map(svcItem).join("")}</section>
      ${disclaimer()}`;
  }

  // ── 詳頁 ──
  function renderService(id) {
    const s = byId[id];
    if (!s) return renderHome();
    const tracked = myList().includes(id);
    const done = checks(id);
    const docsN = (s.docs || []).length;

    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/cat/${s.cat}">← ${esc(catById[s.cat].name)}</a>
      </header>

      <article class="doc-sheet rise">
        <h1 class="d-title">${esc(s.title)}</h1>
        <p class="d-sum">${esc(s.summary)}</p>
        <div class="d-badges">${svcChips(s)}</div>
        <dl class="kv">
          <dt>去哪辦</dt><dd>${esc(s.where)}</dd>
          <dt>費用</dt><dd>${esc(s.fee)}</dd>
          <dt>時間</dt><dd>${esc(s.time)}</dd>
        </dl>
        <button class="track-btn ${tracked ? "on" : ""}" id="trackBtn">
          ${tracked ? "✓ 已加入我的清單" : "＋ 加入我的辦事清單"}
        </button>
        ${(s.docs || []).length ? `<a class="wiz-inline" href="#/wizard/${s.id}">⚑ 用嚮導盤點我還缺什麼 →</a>` : ""}
        <p class="verify-note ${s.verified ? "ok" : ""}">${s.verified
          ? `✓ 已對照官方公告（${esc(s.verified)}）｜仍以機關最新公告為準。`
          : `△ 待查證：整理於 ${esc(s.lastUpdated)}，出發前請以機關公告為準。`}
          <a href="${reportMailto(s.title)}" style="color:inherit">✉ 回報有誤</a></p>
      </article>

      ${s.online?.available ? `
        <div class="online-band rise rise-1">◎ 這件事可以線上辦！
          ${s.online.url ? `<a href="${esc(s.online.url)}" target="_blank" rel="noopener">前往線上申辦 ↗</a>` : ""}
          ${s.online.note ? `<span style="color:var(--ink-soft)">（${esc(s.online.note)}）</span>` : ""}
        </div>` : ""}

      ${s.steps?.length ? `
        <div class="sec-h rise rise-1"><h2>流程</h2><span class="rule"></span></div>
        <ol class="timeline rise rise-1">
          ${s.steps.map((st, i) => `
            <li>
              <span class="step-no">${i + 1}</span>
              <div class="step-t">${esc(st.t)}</div>
              <div class="step-d">${esc(st.d)}</div>
              <div class="step-meta">
                ${st.place ? `<span class="step-place">◉ ${esc(st.place)}</span>` : ""}
                ${st.wait ? `<span class="step-wait">◷ 等 ${esc(st.wait)}</span>` : ""}
              </div>
            </li>`).join("")}
        </ol>` : ""}

      ${docsN ? `
        <div class="sec-h rise rise-2"><h2>文件清單</h2><span class="rule"></span></div>
        <div class="doc-sheet tight rise rise-2">
          <ul class="checklist" id="ckList">
            ${s.docs.map((d, i) => `
              <li><label>
                <input type="checkbox" data-i="${i}" ${done.includes(i) ? "checked" : ""}>
                <span class="ck-box">✓</span>
                <span class="ck-body">
                  <span class="ck-n">${esc(d.n)}</span>
                  ${d.w ? `<div class="ck-w">↳ 去哪拿：${esc(d.w)}</div>` : ""}
                  ${d.note ? `<div class="ck-note">${esc(d.note)}</div>` : ""}
                  ${specNote(d)}
                </span>
              </label></li>`).join("")}
          </ul>
          <div class="progress-line" id="ckProg"></div>
        </div>` : ""}

      ${s.pitfalls?.length ? `
        <div class="sec-h rise rise-3"><h2>卡關了怎麼辦</h2><span class="rule"></span></div>
        <div class="rise rise-3">
          ${s.pitfalls.map((p) => `
            <details class="pitfall">
              <summary><span class="pit-mark">問</span>${esc(p.q)}</summary>
              <div class="pit-a">${esc(p.a)}</div>
            </details>`).join("")}
        </div>` : ""}

      ${(() => {
        const rel = CASES.filter((c) => c.goal === id || (c.related || []).includes(id));
        return rel.length ? `
          <div class="sec-h rise rise-4"><h2>實戰案例</h2><span class="rule"></span><a class="more" href="#/cases">全部</a></div>
          <section class="rise rise-4">${rel.map(caseCard).join("")}</section>` : "";
      })()}

      ${s.links?.length ? `
        <div class="sec-h rise rise-4"><h2>官方連結</h2><span class="rule"></span></div>
        <div class="linkrow rise rise-4">
          ${s.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}
        </div>` : ""}

      ${disclaimer()}`;

    // 追蹤
    document.getElementById("trackBtn").addEventListener("click", (e) => {
      const list = myList();
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1); else list.push(id);
      setMyList(list);
      e.target.className = "track-btn " + (i < 0 ? "on" : "");
      e.target.textContent = i < 0 ? "✓ 已加入我的清單" : "＋ 加入我的辦事清單";
    });

    // checklist
    const $ck = document.getElementById("ckList");
    const $prog = document.getElementById("ckProg");
    function refreshProg(n) {
      if ($prog) $prog.textContent = n === 0 ? "" : n === docsN ? "🎉 文件備齊，可以出發了" : `已備妥 ${n} / ${docsN} 份`;
    }
    if ($ck) {
      $ck.addEventListener("change", (e) => {
        const i = +e.target.dataset.i;
        const arr = checks(id);
        const at = arr.indexOf(i);
        if (e.target.checked && at < 0) arr.push(i);
        if (!e.target.checked && at >= 0) arr.splice(at, 1);
        setChecks(id, arr);
        refreshProg(arr.length);
      });
      refreshProg(done.length);
    }
  }

  // ── 嚮導：選目的 → 盤點 → 準備方案 ──
  let wizAnswers = {};

  function renderWizardPicker() {
    const featured = SERVICES.filter((s) => s.featured);
    const cats = CATEGORIES.filter((c) => c.id !== "scenario");
    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/">← 回首頁</a>
        <div class="sec-h"><h2>⚑ 你這趟最主要要完成什麼？</h2><span class="rule"></span></div>
        <p class="page-desc">選一件事，下一步幫你盤點文件、列出缺件的解法。</p>
      </header>
      <section class="rise rise-1">
        <div class="wiz-group-t">最多人卡關的</div>
        ${featured.map((s) => `<a class="wiz-goal wiz-goal-hot" href="#/wizard/${s.id}">${esc(s.title)}<span>→</span></a>`).join("")}
        ${cats.map((c) => {
          const list = SERVICES.filter((s) => s.cat === c.id);
          return `
            <div class="wiz-group-t">${esc(c.icon)}　${esc(c.name)}</div>
            ${list.map((s) => `<a class="wiz-goal" href="#/wizard/${s.id}">${esc(s.title)}<span>→</span></a>`).join("")}`;
        }).join("")}
        <div class="wiz-group-t">其他情境包</div>
        ${SERVICES.filter((s) => s.cat === "scenario" && !s.featured).map((s) => `<a class="wiz-goal" href="#/wizard/${s.id}">${esc(s.title)}<span>→</span></a>`).join("")}
      </section>
      ${disclaimer()}`;
  }

  function renderWizardCheck(id) {
    const s = byId[id];
    if (!s || !(s.docs || []).length) return renderWizardPicker();
    wizAnswers = {};
    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/wizard">← 重選目的</a>
        <div class="sec-h"><h2>盤點一下</h2><span class="rule"></span></div>
        <p style="font-size:14px;margin:0 2px 4px"><b>${esc(s.title)}</b> 需要 ${s.docs.length} 樣東西——你手上有了嗎？</p>
        <p class="page-desc">不確定就按「還沒」，方案裡會告訴你去哪拿。</p>
      </header>
      <section class="rise rise-1">
        ${s.docs.map((d, i) => `
          <div class="wiz-q" data-q="${i}">
            <div class="wiz-q-t">${esc(d.n)}</div>
            ${d.note ? `<div class="wiz-q-n">${esc(d.note)}</div>` : ""}
            ${specNote(d)}
            <div class="seg">
              <button type="button" data-a="yes">✓ 有了</button>
              <button type="button" data-a="no">還沒</button>
            </div>
          </div>`).join("")}
        <button class="track-btn" id="wizGo" disabled>先回答上面的問題</button>
      </section>`;

    const total = s.docs.length;
    const $go = document.getElementById("wizGo");
    $app.querySelectorAll(".wiz-q .seg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = +btn.closest(".wiz-q").dataset.q;
        wizAnswers[q] = btn.dataset.a === "yes";
        btn.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
        const done = Object.keys(wizAnswers).length;
        $go.disabled = done < total;
        $go.textContent = done < total ? `還有 ${total - done} 題（${done}/${total}）` : "⚑ 生出我的準備方案";
      });
    });
    $go.addEventListener("click", () => renderWizardResult(id));
  }

  function renderWizardResult(id) {
    const s = byId[id];
    const missing = s.docs.map((d, i) => ({ ...d, i })).filter((d) => !wizAnswers[d.i]);
    const owned = s.docs.map((d, i) => ({ ...d, i })).filter((d) => wizAnswers[d.i]);
    const slowest = missing.find((d) => d.wait?.includes("月")) || missing.find((d) => d.wait?.includes("週"));

    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/wizard/${id}">← 重新盤點</a>
        <div class="sec-h"><h2>你的準備方案</h2><span class="rule"></span></div>
      </header>

      <article class="doc-sheet rise">
        <h1 class="d-title" style="font-size:19px">${esc(s.title)}</h1>
        ${missing.length === 0
          ? `<p class="wiz-verdict ok">🎉 ${s.docs.length} 樣全備齊——可以直接出發了！去之前再確認一次開放時間。</p>`
          : `<p class="wiz-verdict">缺 <b>${missing.length}</b> 樣，備齊 ${owned.length} 樣。${slowest ? `<br>⚠ 其中「<b>${esc(slowest.n)}</b>」要等 ${esc(slowest.wait)}——<b>今天就先去辦這個</b>，其他的等的期間再補。` : "缺的都當天可處理，照下面的順序跑就好。"}</p>`}
        ${SOLEMN_IDS.includes(id) ? "" : catBubble(missing.length === 0 ? "happy" : "sad", missing.length === 0 ? "太強了！出發前再看一眼營業時間喵。" : "先辦最慢的那項，等待期間補其他的喵。")}
      </article>

      ${missing.length ? `
        <div class="sec-h rise rise-1"><h2>缺的東西・怎麼補</h2><span class="rule"></span></div>
        <section class="rise rise-1">
          ${missing.map((d) => `
            <div class="res-card res-miss">
              <div class="res-t">✕ ${esc(d.n)} ${d.wait ? `<span class="step-wait">◷ ${esc(d.wait)}</span>` : ""}</div>
              <div class="res-w">↳ 去哪拿：${esc(d.w || "見攻略")}</div>
              ${d.note ? `<div class="res-n">${esc(d.note)}</div>` : ""}
              ${specNote(d)}
              ${d.fix && byId[d.fix] ? `<a class="res-fix" href="#/s/${d.fix}">📖 完整解法：${esc(byId[d.fix].title)} →</a>` : ""}
            </div>`).join("")}
        </section>` : ""}

      ${owned.length ? `
        <div class="sec-h rise rise-2"><h2>已備齊</h2><span class="rule"></span></div>
        <section class="rise rise-2">
          ${owned.map((d) => `<div class="res-card res-ok">✓ ${esc(d.n)}</div>`).join("")}
        </section>` : ""}

      <section class="rise rise-3" style="margin-top:18px">
        <button class="track-btn" id="wizTrack">＋ 存成追蹤清單（已有的自動打勾）</button>
        <a class="wiz-full" href="#/s/${id}">看完整流程與卡關 Q&A →</a>
        <a class="wiz-report" href="${reportMailto(s.title)}">✉ 這頁資訊有誤？回報給我們</a>
      </section>
      ${disclaimer()}`;

    document.getElementById("wizTrack").addEventListener("click", () => {
      const list = myList();
      if (!list.includes(id)) { list.push(id); setMyList(list); }
      setChecks(id, owned.map((d) => d.i));
      location.hash = "#/s/" + id;
    });
  }

  // ── 我的清單 ──
  function renderMy() {
    const list = myList();
    const rems = reminders().map((r, idx) => ({ ...r, idx, days: daysUntil(r.date) })).sort((a, b) => a.days - b.days);

    $app.innerHTML = `
      <header class="page-head rise">
        <div class="sec-h"><h2>我的辦事清單</h2><span class="rule"></span></div>
      </header>

      ${!list.length ? `
        <div class="empty-state rise">${catSVG("sleep", 80)}<br>
          ${esc(MASCOT_NAME)}趴著等你。還沒有追蹤中的事項——<br>從<a href="#/">首頁</a>找到要辦的事，按「加入我的辦事清單」。
        </div>` : `
        <section class="rise rise-1">
          ${list.map((id) => {
            const s = byId[id]; if (!s) return "";
            const n = checks(id).length, total = (s.docs || []).length;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return `
              <div class="my-item">
                <div class="my-top">
                  <a class="my-title" href="#/s/${id}">${esc(s.title)}</a>
                  <button class="my-remove" data-rm="${id}" aria-label="移除">✕</button>
                </div>
                ${total ? `<div class="pbar"><div style="width:${pct}%"></div></div>
                <div class="my-stats">文件 ${n}/${total}${pct === 100 ? "・備齊 ✓" : ""}</div>` : ""}
              </div>`;
          }).join("")}
        </section>`}

      <div class="sec-h rise rise-2"><h2>到期提醒</h2><span class="rule"></span></div>
      <div class="doc-sheet tight rise rise-2">
        ${rems.length ? rems.map((r) => `
          <div class="remind-item">
            <span>${esc(r.label)}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <span class="remind-date ${r.days <= 7 ? "soon" : ""}">${esc(r.date)}${r.days <= 0 ? "・到了" : `・${r.days}天`}</span>
              <span class="remind-actions">
                <button data-ics="${r.idx}">📅 行事曆</button>
                <button data-del="${r.idx}">刪</button>
              </span>
            </span>
          </div>`).join("") : `<p style="font-size:13.5px;color:var(--ink-soft)">補件期限、證件到期日、公告期滿日……記在這裡，進 App 就會提醒你。</p>`}
        <form class="remind-form" id="remForm">
          <input type="text" id="remLabel" placeholder="例：領新權狀（公告期滿）" maxlength="30" required>
          <input type="date" id="remDate" required>
          <button class="btn-sm" type="submit">加入</button>
        </form>
        <p style="font-size:11.5px;color:var(--ink-soft);margin-top:8px">按「📅 行事曆」可把提醒匯出到手機行事曆（前一天會通知）。</p>
      </div>
      ${disclaimer()}`;

    const $f = document.getElementById("remForm");
    $f.addEventListener("submit", (e) => {
      e.preventDefault();
      const label = document.getElementById("remLabel").value.trim();
      const date = document.getElementById("remDate").value;
      if (!label || !date) return;
      setReminders([...reminders(), { label, date }]);
      renderMy();
    });
  }

  // ── 卡關案例（抱怨區） ──
  const caseCard = (c) => `
    <details class="case-card">
      <summary>
        <span class="case-stamp ${c.status === "solved" ? "st-solved" : "st-open"}">${c.status === "solved" ? "已解決" : "徵解法中"}</span>
        <span class="case-title">${esc(c.title)}</span>
        <span class="case-meta">${esc(c.date)}・${esc(c.place)}</span>
      </summary>
      <div class="case-body">
        <div class="case-sec"><b>卡在哪</b><p>${esc(c.stuck)}</p></div>
        ${c.solution ? `<div class="case-sec"><b>怎麼解</b><p>${esc(c.solution)}</p></div>` : ""}
        ${c.lesson ? `<div class="case-lesson">📌 ${esc(c.lesson)}</div>` : ""}
        ${c.goal && byId[c.goal] ? `<a class="res-fix" href="#/s/${c.goal}">📖 這件事的完整攻略 →</a>` : ""}
        <button class="share-btn" data-share-case="${c.id}">↗ 分享這個案例</button>
      </div>
    </details>`;

  function renderCases() {
    const solved = CASES.filter((c) => c.status === "solved");
    const open = CASES.filter((c) => c.status !== "solved");
    $app.innerHTML = `
      <header class="page-head rise">
        <div class="sec-h"><h2>✎ 卡關案例</h2><span class="rule"></span></div>
        <p class="page-desc">
          真實的踩坑經歷。抱怨進來 → 找到解法 → 變成範例，<b>讓後面的人只跑一趟</b>。</p>
      </header>

      <div class="game-cards rise">
        <a class="game-card" href="#/quiz">
          <span class="game-ic">⚔</span><b>踩坑測驗</b>
          <small>${QUIZ.length} 題，測你會不會被公家機關坑</small>
        </a>
        <a class="game-card" href="#/bingo">
          <span class="game-ic">▦</span><b>受難賓果</b>
          <small>點你中過的坑，看你的受難等級</small>
        </a>
      </div>

      <div class="sec-h rise rise-1"><h2>已解決・後人照抄</h2><span class="rule"></span></div>
      <section class="rise rise-1">${solved.map(caseCard).join("")}</section>

      ${open.length ? `
        <div class="sec-h rise rise-2"><h2>徵解法中</h2><span class="rule"></span></div>
        <section class="rise rise-2">${open.map(caseCard).join("")}</section>` : ""}

      <div class="sec-h rise rise-3"><h2>我要抱怨（回報卡關）</h2><span class="rule"></span></div>
      <div class="doc-sheet tight rise rise-3">
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:12px">
          被踢皮球、白跑一趟、現場才知道缺東西……寫下來。查到解法後會刊在上面（不會登你的個資）。</p>
        <form class="complain-form" id="cForm">
          <input type="text" id="cWhat" placeholder="你要辦什麼事？（例：機車過戶）" maxlength="60" required>
          <input type="text" id="cWhere" placeholder="哪個單位／縣市？（例：台中監理站，選填）" maxlength="60">
          <textarea id="cStuck" rows="4" placeholder="卡在哪？發生什麼事？（櫃檯說了什麼、缺了什麼、被叫去哪）" required></textarea>
          <button class="track-btn" type="submit" style="margin-top:4px">✉ 送出抱怨</button>
        </form>
        <p style="font-size:11.5px;color:var(--ink-soft);margin-top:8px">會開啟你的信件 App 寄出，內容可先編輯。</p>
      </div>
      ${disclaimer()}`;

    document.getElementById("cForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const what = document.getElementById("cWhat").value.trim();
      const where = document.getElementById("cWhere").value.trim();
      const stuck = document.getElementById("cStuck").value.trim();
      const subject = "【跑一次就好】卡關抱怨：" + what;
      const body = ["◆ 要辦的事：" + what, "◆ 單位／縣市：" + (where || "（未填）"), "", "◆ 卡在哪：", stuck, "", "（此回報將整理成公開案例，不會刊登個人資料）"].join("\n");
      location.href = mailtoURL(subject, body);
    });
  }

  // ── 踩坑測驗 ──
  let quiz = null;
  function renderQuiz() {
    if (!quiz) quiz = { i: 0, score: 0, wrong: [] };
    if (quiz.i >= QUIZ.length) return renderQuizResult();
    const item = QUIZ[quiz.i];
    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/cases">← 卡關案例</a>
        <div class="sec-h"><h2>踩坑測驗</h2><span class="rule"></span>
          <span class="quiz-prog">第 ${quiz.i + 1}／${QUIZ.length} 題</span></div>
      </header>
      <article class="doc-sheet rise">
        <p class="quiz-q">${esc(item.q)}</p>
        <div class="quiz-opts" id="qOpts">
          ${item.opts.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join("")}
        </div>
        <div id="qFeedback"></div>
      </article>`;

    document.getElementById("qOpts").addEventListener("click", (e) => {
      const btn = e.target.closest(".quiz-opt");
      if (!btn || document.querySelector(".quiz-opt.hit, .quiz-opt.miss")) return;
      const pick = +btn.dataset.i;
      const right = pick === item.ans;
      if (right) quiz.score++; else quiz.wrong.push(quiz.i);
      document.querySelectorAll(".quiz-opt").forEach((b, i) => {
        if (i === item.ans) b.classList.add("hit");
        else if (i === pick) b.classList.add("miss");
        b.disabled = true;
      });
      document.getElementById("qFeedback").innerHTML = `
        ${item.solemn ? "" : catBubble(right ? "happy" : "sad", right ? "答對了喵！" : "中招了喵……記起來！")}
        <p class="quiz-why">${esc(item.why)}</p>
        ${byId[item.link] ? `<a class="res-fix" href="#/s/${item.link}">📖 完整攻略：${esc(byId[item.link].title)} →</a>` : ""}
        <button class="track-btn" id="qNext" style="margin-top:14px">${quiz.i + 1 < QUIZ.length ? "下一題 →" : "看我的稱號 →"}</button>`;
      document.getElementById("qNext").addEventListener("click", () => { quiz.i++; renderQuiz(); });
    });
  }
  function renderQuizResult() {
    const title = QUIZ_TITLES.find((t) => quiz.score >= t.min);
    const wrong = quiz.wrong.map((i) => QUIZ[i]);
    const share = `我在「跑一次就好」踩坑測驗拿了 ${quiz.score}/${QUIZ.length}，獲封【${title.t}】！你敢測嗎？`;
    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/cases">← 卡關案例</a>
        <div class="sec-h"><h2>測驗結果</h2><span class="rule"></span></div>
      </header>
      <article class="doc-sheet rise" style="text-align:center">
        ${catSVG(quiz.score >= 6 ? "happy" : quiz.score >= 3 ? "idle" : "sad", 88)}
        <div class="quiz-score">${quiz.score}<small>／${QUIZ.length}</small></div>
        <div class="quiz-title">【${esc(title.t)}】</div>
        <p class="page-desc" style="margin-bottom:6px">${esc(title.d)}</p>
        <button class="track-btn" id="qShare">↗ 分享我的稱號</button>
        <button class="wiz-full" id="qAgain" style="width:100%;border:1.5px solid var(--line);background:var(--card);cursor:pointer">再玩一次</button>
      </article>
      ${wrong.length ? `
        <div class="sec-h rise rise-1"><h2>你中招的坑・補課</h2><span class="rule"></span></div>
        <section class="rise rise-1">
          ${wrong.map((w) => `
            <div class="res-card res-miss">
              <div class="res-t">${esc(w.q)}</div>
              <div class="res-n">${esc(w.why)}</div>
              ${byId[w.link] ? `<a class="res-fix" href="#/s/${w.link}">📖 ${esc(byId[w.link].title)} →</a>` : ""}
            </div>`).join("")}
        </section>` : ""}
      ${disclaimer()}`;
    document.getElementById("qShare").addEventListener("click", () => shareText(share));
    document.getElementById("qAgain").addEventListener("click", () => { quiz = null; renderQuiz(); });
  }

  // ── 受難賓果 ──
  function bingoLines(marks) {
    const has = (i) => marks.includes(i);
    let lines = 0;
    for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every((c) => has(r * 5 + c))) lines++;
    for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every((r) => has(r * 5 + c))) lines++;
    if ([0, 6, 12, 18, 24].every(has)) lines++;
    if ([4, 8, 12, 16, 20].every(has)) lines++;
    return lines;
  }
  function renderBingo() {
    const FREE = 12;
    let marks = store.get("bingo", [FREE]);
    if (!marks.includes(FREE)) marks = [...marks, FREE];
    const lines = bingoLines(marks);
    const title = BINGO_TITLES.find((t) => lines >= t.min);
    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/cases">← 卡關案例</a>
        <div class="sec-h"><h2>公家機關受難賓果</h2><span class="rule"></span></div>
        <p class="page-desc">點你親身中過的坑。中間是免費格——每個人都值得一次好心承辦。</p>
      </header>
      <div class="bingo-status rise">已中 <b>${lines}</b> 條線【${esc(title.t)}】</div>
      <div class="bingo-grid rise rise-1">
        ${BINGO_ITEMS.map((t, i) => `
          <button class="bingo-cell ${marks.includes(i) ? "on" : ""} ${i === FREE ? "free" : ""}" data-i="${i}" ${i === FREE ? "disabled" : ""}>${esc(t)}</button>`).join("")}
      </div>
      <section class="rise rise-2" style="margin-top:14px">
        <button class="track-btn" id="bShare">↗ 分享我的受難等級</button>
        <button class="wiz-report" id="bReset" style="width:100%;cursor:pointer">重設賓果卡</button>
      </section>
      ${disclaimer()}`;

    document.querySelector(".bingo-grid").addEventListener("click", (e) => {
      const cell = e.target.closest(".bingo-cell");
      if (!cell || cell.disabled) return;
      const i = +cell.dataset.i;
      const at = marks.indexOf(i);
      if (at >= 0) marks.splice(at, 1); else marks.push(i);
      store.set("bingo", marks);
      renderBingo();
    });
    document.getElementById("bShare").addEventListener("click", () => {
      const n = bingoLines(marks);
      const t = BINGO_TITLES.find((x) => n >= x.min);
      shareText(`公家機關受難賓果：我中了 ${n} 條線，獲封【${t.t}】（共踩過 ${marks.length - 1} 種坑）。你中幾條？`);
    });
    document.getElementById("bReset").addEventListener("click", () => { store.set("bingo", [FREE]); renderBingo(); });
  }

  // ── 據點 ──
  function renderSpots() {
    $app.innerHTML = `
      <header class="page-head rise">
        <div class="sec-h"><h2>找辦理據點</h2><span class="rule"></span></div>
        <p class="page-desc">「地圖找最近的」會用你的位置搜尋；出發前記得先查開放時間，很多單位中午休息、週末不開。</p>
      </header>
      <section class="rise rise-1">
        ${SPOTS.map((sp) => `
          <div class="spot-item">
            <div class="spot-name">${esc(sp.name)}</div>
            <div class="spot-note">${esc(sp.note)}</div>
            <div class="spot-links">
              <a class="spot-map" href="https://www.google.com/maps/search/${encodeURIComponent(sp.name)}" target="_blank" rel="noopener">地圖找最近的</a>
              ${!sp.mapsOnly ? `<a class="spot-off" href="${esc(sp.official)}" target="_blank" rel="noopener">官方網站</a>` : ""}
            </div>
          </div>`).join("")}
      </section>
      ${disclaimer()}`;
  }

  // ── Router ──
  function route() {
    const h = location.hash || "#/";
    const [, page, arg] = h.split("/");
    window.scrollTo(0, 0);
    document.querySelectorAll(".tabbar a").forEach((a) => a.classList.remove("active"));
    (document.querySelector(`.tabbar a[data-tab="${page}"]`) ||
      document.querySelector('.tabbar a[data-tab="home"]')).classList.add("active");

    if (page === "s" && arg) renderService(arg);
    else if (page === "quiz") return renderQuiz();
    else if (page === "bingo") return renderBingo();
    else if (page === "cases") return renderCases();
    else if (page === "wizard" && arg) renderWizardCheck(arg);
    else if (page === "wizard") renderWizardPicker();
    else if (page === "cat" && arg) renderCat(arg);
    else if (page === "my") renderMy();
    else if (page === "spots") renderSpots();
    else renderHome();
  }

  // 「我的清單」頁的移除／刪提醒／匯出行事曆／案例分享（全域委派，只掛一次）
  $app.addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.shareCase) {
      const c = CASES.find((x) => x.id === t.dataset.shareCase);
      if (c) shareText(`【${c.status === "solved" ? "已解決" : "徵解法中"}】${c.title}\n${c.lesson || c.stuck}`);
      return;
    }
    if (t.dataset.rm) { setMyList(myList().filter((x) => x !== t.dataset.rm)); renderMy(); return; }
    if (t.dataset.del !== undefined) {
      const arr = reminders(); arr.splice(+t.dataset.del, 1); setReminders(arr); renderMy(); return;
    }
    if (t.dataset.ics !== undefined) downloadICS(reminders()[+t.dataset.ics]);
  });

  window.addEventListener("hashchange", route);
  updateBadge();
  route();
})();
