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
  const setMyList = (v) => { store.set("mylist", v); updateBadge(); };
  const checks = (id) => store.get("chk:" + id, []);
  const setChecks = (id, v) => store.set("chk:" + id, v);
  const reminders = () => store.get("reminders", []);
  const setReminders = (v) => store.set("reminders", v);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function updateBadge() {
    const b = document.getElementById("myBadge");
    const n = myList().length;
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
    if (s.steps && s.steps.length) h += '<span class="chip chip-deep">完整攻略</span>';
    h += `<span class="chip chip-cat">${esc(catById[s.cat].name)}</span>`;
    if (s.online && s.online.available) h += '<span class="chip chip-online">可線上辦</span>';
    return h;
  };
  const svcItem = (s) => `
    <a class="svc-item" href="#/s/${s.id}">
      <div class="svc-t">${esc(s.title)} ${svcChips(s)}</div>
      <div class="svc-s">${esc(s.summary)}</div>
    </a>`;
  const disclaimer = () => `
    <footer class="disclaimer">⚠ ${esc(DISCLAIMER)}
      <div style="margin-top:8px"><a href="${reportMailto("整體建議或錯誤回報")}">✉ 回報錯誤／給我們建議</a></div>
    </footer>`;

  // ── 回報系統（mailto，無後端） ──
  function reportMailto(topic) {
    const subject = "【跑一次就好】回報：" + topic;
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
    return "mailto:" + REPORT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
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
        <div class="sec-h" style="margin-top:0"><h2>${esc(c.icon)}　${esc(c.name)}</h2><span class="rule"></span></div>
        <p style="font-size:13.5px;color:var(--ink-soft);margin:0 2px 14px">${esc(c.desc)}</p>
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
        <p class="verify-note">△ 待查證：整理於 ${esc(s.lastUpdated)}，出發前請以機關公告為準。
          <a href="${reportMailto(s.title)}" style="color:inherit">✉ 回報有誤</a></p>
      </article>

      ${s.online && s.online.available ? `
        <div class="online-band rise rise-1">◎ 這件事可以線上辦！
          ${s.online.url ? `<a href="${esc(s.online.url)}" target="_blank" rel="noopener">前往線上申辦 ↗</a>` : ""}
          ${s.online.note ? `<span style="color:var(--ink-soft)">（${esc(s.online.note)}）</span>` : ""}
        </div>` : ""}

      ${s.steps && s.steps.length ? `
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
        <div class="doc-sheet rise rise-2" style="padding-top:14px">
          <ul class="checklist" id="ckList">
            ${s.docs.map((d, i) => `
              <li><label>
                <input type="checkbox" data-i="${i}" ${done.includes(i) ? "checked" : ""}>
                <span class="ck-box">✓</span>
                <span class="ck-body">
                  <span class="ck-n">${esc(d.n)}</span>
                  ${d.w ? `<div class="ck-w">↳ 去哪拿：${esc(d.w)}</div>` : ""}
                  ${d.note ? `<div class="ck-note">${esc(d.note)}</div>` : ""}
                </span>
              </label></li>`).join("")}
          </ul>
          <div class="progress-line" id="ckProg"></div>
        </div>` : ""}

      ${s.pitfalls && s.pitfalls.length ? `
        <div class="sec-h rise rise-3"><h2>卡關了怎麼辦</h2><span class="rule"></span></div>
        <div class="rise rise-3">
          ${s.pitfalls.map((p) => `
            <details class="pitfall">
              <summary><span class="pit-mark">問</span>${esc(p.q)}</summary>
              <div class="pit-a">${esc(p.a)}</div>
            </details>`).join("")}
        </div>` : ""}

      ${s.links && s.links.length ? `
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
    function refreshProg() {
      const n = checks(id).length;
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
        refreshProg();
      });
      refreshProg();
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
        <div class="sec-h" style="margin-top:0"><h2>⚑ 你這趟最主要要完成什麼？</h2><span class="rule"></span></div>
        <p style="font-size:13.5px;color:var(--ink-soft);margin:0 2px 14px">選一件事，下一步幫你盤點文件、列出缺件的解法。</p>
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
        <div class="sec-h" style="margin-top:0"><h2>盤點一下</h2><span class="rule"></span></div>
        <p style="font-size:14px;margin:0 2px 4px"><b>${esc(s.title)}</b> 需要 ${s.docs.length} 樣東西——你手上有了嗎？</p>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 2px 14px">不確定就按「還沒」，方案裡會告訴你去哪拿。</p>
      </header>
      <section class="rise rise-1">
        ${s.docs.map((d, i) => `
          <div class="wiz-q" data-q="${i}">
            <div class="wiz-q-t">${esc(d.n)}</div>
            ${d.note ? `<div class="wiz-q-n">${esc(d.note)}</div>` : ""}
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
    const slowest = missing.filter((d) => d.wait && /週|月/.test(d.wait)).sort((a, b) => (b.wait.includes("月") ? 1 : 0) - (a.wait.includes("月") ? 1 : 0))[0];

    $app.innerHTML = `
      <header class="page-head rise">
        <a class="backlink" href="#/wizard/${id}">← 重新盤點</a>
        <div class="sec-h" style="margin-top:0"><h2>你的準備方案</h2><span class="rule"></span></div>
      </header>

      <article class="doc-sheet rise">
        <h1 class="d-title" style="font-size:19px">${esc(s.title)}</h1>
        ${missing.length === 0
          ? `<p class="wiz-verdict ok">🎉 ${s.docs.length} 樣全備齊——可以直接出發了！去之前再確認一次開放時間。</p>`
          : `<p class="wiz-verdict">缺 <b>${missing.length}</b> 樣，備齊 ${owned.length} 樣。${slowest ? `<br>⚠ 其中「<b>${esc(slowest.n)}</b>」要等 ${esc(slowest.wait)}——<b>今天就先去辦這個</b>，其他的等的期間再補。` : "缺的都當天可處理，照下面的順序跑就好。"}</p>`}
      </article>

      ${missing.length ? `
        <div class="sec-h rise rise-1"><h2>缺的東西・怎麼補</h2><span class="rule"></span></div>
        <section class="rise rise-1">
          ${missing.map((d) => `
            <div class="res-card res-miss">
              <div class="res-t">✕ ${esc(d.n)} ${d.wait ? `<span class="step-wait">◷ ${esc(d.wait)}</span>` : ""}</div>
              <div class="res-w">↳ 去哪拿：${esc(d.w || "見攻略")}</div>
              ${d.note ? `<div class="res-n">${esc(d.note)}</div>` : ""}
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
        <div class="sec-h" style="margin-top:6px"><h2>我的辦事清單</h2><span class="rule"></span></div>
      </header>

      ${!list.length ? `
        <div class="empty-state rise"><div class="big">空</div>
          還沒有追蹤中的事項。<br>從<a href="#/">首頁</a>找到要辦的事，按「加入我的辦事清單」。
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
      <div class="doc-sheet rise rise-2" style="padding-top:16px">
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

  // ── 據點 ──
  function renderSpots() {
    $app.innerHTML = `
      <header class="page-head rise">
        <div class="sec-h" style="margin-top:6px"><h2>找辦理據點</h2><span class="rule"></span></div>
        <p style="font-size:13.5px;color:var(--ink-soft);margin:0 2px 14px">「地圖找最近的」會用你的位置搜尋；出發前記得先查開放時間，很多單位中午休息、週末不開。</p>
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
    const tab = page === "my" ? "my" : page === "spots" ? "spots" : "home";
    document.querySelector(`.tabbar a[data-tab="${tab}"]`).classList.add("active");

    if (page === "s" && arg) renderService(arg);
    else if (page === "wizard" && arg) renderWizardCheck(arg);
    else if (page === "wizard") renderWizardPicker();
    else if (page === "cat" && arg) renderCat(arg);
    else if (page === "my") renderMy();
    else if (page === "spots") renderSpots();
    else renderHome();
  }

  // 「我的清單」頁的移除／刪提醒／匯出行事曆（全域委派，只掛一次）
  $app.addEventListener("click", (e) => {
    const t = e.target;
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
