/* =====================================================================
   IGNITER LEAGUE — member pages
   Home, Leaderboard, My Performance, Submit Activity, Weekly Winners,
   Special Challenge, Profile
   ===================================================================== */
(function () {
  "use strict";
  const App = window.App;
  const esc = App.esc;

  // ------------------------------------------------------------------
  // League status line
  // ------------------------------------------------------------------
  App.leagueStatusText = () => {
    const s = App.settings, today = App.todayISO();
    if (s.finalized) return "🏁 League finalized";
    if (s.status === "ended") return "League ended";
    if (s.status === "not_started") return today < s.start_date ? `Starts ${App.fmtDate(s.start_date)}` : "Not started yet";
    const w = App.currentWeek();
    return w ? `Week ${w} running` : "League running";
  };

  // ==================================================================
  // HOME
  // ==================================================================
  App.route("home", async (el, _p, token) => {
    const [stats, lb] = await Promise.all([App.rpc("get_home_stats"), App.rpc("get_leaderboard", { p_week: null })]);
    if (App.stale(token)) return;
    const s = App.settings, today = App.todayISO();
    const cw = stats.current_week;
    const weekText = s.finalized ? "Final" : cw ? `Week ${cw}` : today < s.start_date ? "Not started" : "Completed";
    const daysLabel = today < s.start_date ? "Days to Start" : "Days Remaining";
    const daysVal = s.finalized || s.status === "ended" ? 0 : today < s.start_date ? App.daysBetween(today, s.start_date) : stats.days_remaining;
    const top = (lb || []).slice(0, 10);
    const me = App.profile;
    el.innerHTML = `
      <section class="hero">
        <div class="l1">IGNITER</div>
        <div class="l2">BUSINESS &amp; P2P LEAGUE</div>
        <div class="tagline">CONNECT MORE • REFER MORE • SUPPORT MORE • GROW TOGETHER</div>
        <div class="meta">
          <span class="pill">📅 ${App.fmtDate(s.start_date)} – ${App.fmtDate(s.end_date)}</span>
          <span class="pill">${esc(App.leagueStatusText())}</span>
        </div>
      </section>
      <div class="notice">Welcome, <b>${esc(me.full_name)}</b>! ${App.isAdmin() ? 'You are logged in as <b>Admin</b>.' : ""}</div>
      <div class="stat-grid">
        <div class="stat blue"><div class="k">Current Week</div><div class="v">${weekText}</div></div>
        <div class="stat accent"><div class="k">${daysLabel}</div><div class="v">${daysVal}</div></div>
        <div class="stat"><div class="k">Total Members</div><div class="v">${App.fmtNum(stats.total_members)}</div></div>
        <div class="stat"><div class="k">Total P2Ps</div><div class="v">${App.fmtNum(stats.total_p2p)}</div></div>
        <div class="stat"><div class="k">Total References</div><div class="v">${App.fmtNum(stats.total_references)}</div></div>
        <div class="stat"><div class="k">Total Business</div><div class="v">${App.fmtINR(stats.total_business)}</div></div>
        <div class="stat"><div class="k">Total Visitors</div><div class="v">${App.fmtNum(stats.total_visitors)}</div></div>
        <div class="stat"><div class="k">Total Inductions</div><div class="v">${App.fmtNum(stats.total_inductions)}</div></div>
      </div>
      ${App.isAdmin() ? "" : `<a class="btn green block lg mb" href="#/submit">➕ Submit Activity</a>`}
      <div class="card">
        <div class="card-title"><h2>🏆 Top 10</h2><a class="btn ghost sm" href="#/leaderboard">Full leaderboard</a></div>
        ${top.length ? top.map((r) => `
          <div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:nowrap">
            ${App.rankBadge(r.rank)} ${App.avatar(r.avatar_url, r.full_name)}
            <div class="grow" style="min-width:0"><b>${esc(r.full_name)}</b>${App.sampleTag(r.is_sample)}${r.member_id === me.id ? ' <span class="tag approved">YOU</span>' : ""}
              <div class="small muted">${r.p2p} P2P · ${r.ref_given} Ref · ${App.fmtINR(r.biz_given_amount)}</div></div>
            <div class="pts-badge" style="font-size:1.1rem">${r.total_points}</div>
          </div>`).join("") : '<div class="empty">No members yet.</div>'}
      </div>`;
  });

  // ==================================================================
  // LEADERBOARD (also used inside the Admin panel)
  // ==================================================================
  const LB_COLS = [
    { k: "total_points", l: "Total" },
    { k: "p2p", l: "P2P" },
    { k: "new_member", l: "New Member Conn." },
    { k: "ref_given", l: "Ref Given" },
    { k: "ref_received", l: "Ref Received" },
    { k: "biz_given_amount", l: "Business Given", money: true, pts: "biz_given_points" },
    { k: "biz_received_amount", l: "Business Received", money: true, pts: "biz_received_points" },
    { k: "visitors", l: "Visitors" },
    { k: "inductions", l: "Inductions" },
    { k: "attendance", l: "Attendance" },
    { k: "activities", l: "Activities" },
    { k: "challenges", l: "Special Challenge", pts: "challenge_points" },
  ];
  App.LB_COLS = LB_COLS;
  const lbState = { week: null, search: "", sort: "total_points", dir: -1, data: {} };

  App.renderLeaderboard = async (el, opts) => {
    opts = opts || {};
    const weeks = App.weeks.map((w) => w.week_no);
    el.innerHTML = `
      <div class="card-title no-print"><h2>🏆 Leaderboard</h2>
        <div class="row">
          ${opts.admin ? '<button class="btn ghost sm" id="lb-csv">⬇ Export CSV</button>' : ""}
          <button class="btn ghost sm" id="lb-print">🖨 Print</button>
          <button class="btn ghost sm" id="lb-refresh">↻ Refresh</button>
        </div></div>
      <div class="print-only"><h2>IGNITER BUSINESS &amp; P2P LEAGUE — LEADERBOARD <span id="lb-print-title"></span></h2><p class="small">Printed ${App.fmtDateTime(new Date())}</p></div>
      <div class="lb-controls">
        <div class="chips" id="lb-weeks">
          <button class="chip" data-w="">All Weeks</button>
          ${weeks.map((w) => `<button class="chip" data-w="${w}">Week ${w}</button>`).join("")}
        </div>
        <input type="search" class="grow" id="lb-search" placeholder="🔍 Search member…" value="${esc(lbState.search)}">
        <select id="lb-sort" style="max-width:220px">${LB_COLS.map((c) => `<option value="${c.k}">Sort: ${c.l}</option>`).join("")}</select>
      </div>
      <div id="lb-body">${App.loadingHTML}</div>`;
    const sortSel = App.$("#lb-sort", el);
    sortSel.value = lbState.sort;

    const load = async (force) => {
      const key = lbState.week || "all";
      if (force || !lbState.data[key]) {
        App.$("#lb-body", el).innerHTML = App.loadingHTML;
        lbState.data[key] = await App.rpc("get_leaderboard", { p_week: lbState.week });
      }
      draw();
    };

    const draw = () => {
      App.$$("#lb-weeks .chip", el).forEach((c) => c.classList.toggle("active", String(lbState.week || "") === c.dataset.w));
      App.$("#lb-print-title", el).textContent = lbState.week ? `(WEEK ${lbState.week})` : "(ALL WEEKS)";
      const all = lbState.data[lbState.week || "all"] || [];
      const s = lbState.search.toLowerCase();
      let rows = all.filter((r) => !s || r.full_name.toLowerCase().includes(s) || (r.username || "").includes(s) || (r.group_name || "").toLowerCase().includes(s));
      const k = lbState.sort, d = lbState.dir;
      rows = rows.slice().sort((a, b) => (Number(b[k]) - Number(a[k])) || a.rank - b.rank || a.full_name.localeCompare(b.full_name));
      if (d === 1) rows.reverse();
      const meId = App.profile.id;
      const podium = !s && k === "total_points" && d === -1 && all.length >= 3 && all[0].total_points > 0;
      const top3 = all.slice(0, 3);
      const cellVal = (r, c) => c.money ? `${App.fmtINR(r[c.k])}${r[c.pts] ? ` <span class="muted small">(${r[c.pts]} pts)</span>` : ""}`
        : c.pts && r[c.pts] ? `${r[c.k]} <span class="muted small">(${r[c.pts]} pts)</span>` : App.fmtNum(r[c.k]);

      App.$("#lb-body", el).innerHTML = `
        ${podium ? `<div class="podium">
          ${[1, 0, 2].map((i) => { const r = top3[i]; return `<div class="p p${i + 1}"><div class="medal">${App.medal(r.rank)}</div>
            ${App.avatar(r.avatar_url, r.full_name, "lg")}<div class="nm">${esc(r.full_name)}</div><div class="pts">${r.total_points}</div><div class="small muted">points</div></div>`; }).join("")}
        </div>` : ""}
        ${rows.length ? "" : '<div class="empty">No members found.</div>'}
        <div class="lb-cards">${rows.map((r) => `
          <div class="lbc ${r.member_id === meId ? "me" : ""}">
            <div class="lbc-head">${App.rankBadge(r.rank)} ${App.avatar(r.avatar_url, r.full_name)}
              <div class="nm"><b>${esc(r.full_name)}${App.sampleTag(r.is_sample)}</b><span>${esc(r.group_name || "")} ${r.member_id === meId ? "· YOU" : ""}</span></div>
              <div class="tot">${r.total_points}<small>POINTS ▾</small></div></div>
            <div class="lbc-body">${LB_COLS.slice(1).map((c) => `<div class="mini"><b>${c.money ? App.fmtINR(r[c.k]) : App.fmtNum(r[c.k])}</b><span>${c.l}</span></div>`).join("")}</div>
          </div>`).join("")}</div>
        <div class="lb-desktop"><div class="table-wrap"><table class="lb">
          <thead><tr><th data-k="rank">#</th><th data-k="full_name">Member</th>${LB_COLS.map((c) => `<th data-k="${c.k}" class="${k === c.k ? "sorted" : ""}">${c.l}${k === c.k ? (d === -1 ? " ▼" : " ▲") : ""}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr class="${r.member_id === meId ? "me" : ""}">
            <td>${App.rankBadge(r.rank)}</td>
            <td><div class="who">${App.avatar(r.avatar_url, r.full_name)}<div><b>${esc(r.full_name)}</b>${App.sampleTag(r.is_sample)}<div class="small muted">${esc(r.group_name || "")}</div></div></div></td>
            ${LB_COLS.map((c) => `<td class="${c.k === "total_points" ? "total" : ""}">${cellVal(r, c)}</td>`).join("")}
          </tr>`).join("")}</tbody></table></div></div>`;
      App.$$(".lbc-head", el).forEach((h) => (h.onclick = () => h.parentElement.classList.toggle("open")));
      App.$$("table.lb th", el).forEach((th) => (th.onclick = () => {
        const key = th.dataset.k;
        if (key === "rank") { lbState.sort = "total_points"; lbState.dir = -1; }
        else if (key === "full_name") { lbState.sort = "total_points"; lbState.dir = lbState.dir * -1; }
        else if (lbState.sort === key) lbState.dir *= -1; else { lbState.sort = key; lbState.dir = -1; }
        sortSel.value = lbState.sort;
        draw();
      }));
    };

    App.$$("#lb-weeks .chip", el).forEach((c) => (c.onclick = () => { lbState.week = c.dataset.w ? Number(c.dataset.w) : null; load().catch((e) => App.toast(App.errMsg(e), "bad")); }));
    App.$("#lb-search", el).oninput = (e) => { lbState.search = e.target.value; draw(); };
    sortSel.onchange = () => { lbState.sort = sortSel.value; lbState.dir = -1; draw(); };
    App.$("#lb-print", el).onclick = () => window.print();
    App.$("#lb-refresh", el).onclick = () => load(true).catch((e) => App.toast(App.errMsg(e), "bad"));
    if (opts.admin) App.$("#lb-csv", el).onclick = () => {
      const rows = lbState.data[lbState.week || "all"] || [];
      App.downloadCSV(`leaderboard-${lbState.week ? "week" + lbState.week : "all-weeks"}.csv`, rows, [
        { k: "rank", l: "Rank" }, { k: "full_name", l: "Member" }, { k: "username", l: "Username" }, { k: "group_name", l: "Group" },
        { k: "total_points", l: "Total Points" }, { k: "p2p", l: "P2P" }, { k: "new_member", l: "New Member Connections" },
        { k: "ref_given", l: "References Given" }, { k: "ref_received", l: "References Received" },
        { k: "biz_given_amount", l: "Business Given (Rs)" }, { k: "biz_given_points", l: "Business Given Points" },
        { k: "biz_received_amount", l: "Business Received (Rs)" }, { k: "biz_received_points", l: "Business Received Points" },
        { k: "visitors", l: "Visitors" }, { k: "inductions", l: "Inductions" }, { k: "attendance", l: "Attendance" },
        { k: "activities", l: "Activity Participation" }, { k: "challenges", l: "Special Challenges" }, { k: "challenge_points", l: "Challenge Points" },
      ]);
    };
    lbState.data = {};           // always fresh when page opens
    await load(true);
  };

  App.route("leaderboard", async (el) => {
    const wrap = document.createElement("div");
    wrap.className = "card flat";
    el.innerHTML = "";
    el.appendChild(wrap);
    await App.renderLeaderboard(wrap, {});
  });

  // ==================================================================
  // MY PERFORMANCE (dashboard + point history)
  // ==================================================================
  const CARD_ORDER = ["p2p", "new_member", "ref_given", "ref_received", "biz_given", "biz_received", "visitor", "induction", "attendance", "activity", "challenge"];

  App.txnDetails = (t, opts) => {
    opts = opts || {};
    const parts = [];
    if (t.partner_id) parts.push(`With: <b>${esc(App.memberName(t.partner_id))}</b>`);
    if (t.amount != null && /^biz_/.test(t.category)) parts.push(`Amount: <b>${App.fmtINR(t.amount)}</b>`);
    if (t.customer_name) parts.push(`Customer: ${esc(t.customer_name)}`);
    if (t.description) parts.push(esc(t.description));
    if (t.notes) parts.push(`<span class="muted">Notes: ${esc(t.notes)}</span>`);
    if (t.status === "rejected" && t.reject_reason) parts.push(`<span style="color:var(--red)">Reason: ${esc(t.reject_reason)}</span>`);
    return parts.join("<br>");
  };

  App.route("me", async (el, _p, token) => {
    const me = App.profile;
    const [txns, lbAll] = await Promise.all([
      App.q(App.sb.from("v_transactions").select("*").eq("member_id", me.id).order("txn_date", { ascending: false }).order("id", { ascending: false })),
      App.rpc("get_leaderboard", { p_week: null }),
    ]);
    if (App.stale(token)) return;
    const cw = App.currentWeek();
    const lbWeek = cw ? await App.rpc("get_leaderboard", { p_week: cw }) : [];
    if (App.stale(token)) return;
    const mine = (lbAll || []).find((r) => r.member_id === me.id) || { rank: "—", total_points: 0 };
    const mineW = (lbWeek || []).find((r) => r.member_id === me.id);
    const counted = txns.filter((t) => t.status === "approved" && t.week_no != null);
    const agg = {};
    CARD_ORDER.forEach((c) => (agg[c] = { n: 0, pts: 0, amt: 0 }));
    counted.forEach((t) => { const a = agg[t.category]; if (a) { a.n++; a.pts += t.points; a.amt += Number(t.amount || 0); } });
    const pendingN = txns.filter((t) => t.status === "pending").length;

    el.innerHTML = `
      <h2>Welcome, ${esc(me.full_name)} 👋</h2>
      <div class="stat-grid">
        <div class="stat blue"><div class="k">Current Rank</div><div class="v">${mine.total_points > 0 ? "#" + mine.rank : "—"}</div><div class="sub" style="color:#cfe0ff">of ${lbAll.length} members</div></div>
        <div class="stat accent"><div class="k">Total Points</div><div class="v">${mine.total_points}</div></div>
        <div class="stat"><div class="k">${cw ? `Week ${cw} Points` : "Current Week"}</div><div class="v">${cw ? (mineW ? mineW.total_points : 0) : "—"}</div>${cw && mineW ? `<div class="sub">Week rank #${mineW.rank}</div>` : ""}</div>
        <div class="stat"><div class="k">Pending Approval</div><div class="v">${pendingN}</div></div>
      </div>
      <a class="btn green block lg mb" href="#/submit">➕ Submit Activity</a>
      <div class="cat-grid mb">${CARD_ORDER.map((c) => `
        <div class="cat"><div class="ic">${App.catIcon(c)}</div><div>
          <div class="v">${/^biz_/.test(c) ? App.fmtINR(agg[c].amt) : agg[c].n}</div>
          <div class="k">${esc(App.catLabel(c))}</div>
          <div class="p">${agg[c].pts} pts</div></div></div>`).join("")}</div>
      <div class="card">
        <div class="card-title"><h2>📜 My Point History</h2>
          <div class="chips" id="hist-f"><button class="chip active" data-s="">All</button><button class="chip" data-s="approved">Approved</button><button class="chip" data-s="pending">Pending</button><button class="chip" data-s="rejected">Rejected</button></div></div>
        <p class="small muted">Only <b>APPROVED</b> entries count towards your total. Pending entries are waiting for the Admin.</p>
        <div id="hist"></div>
      </div>`;

    const drawHist = (filter) => {
      const list = txns.filter((t) => !filter || t.status === filter);
      App.$("#hist", el).innerHTML = list.length ? `<table class="rt"><thead><tr><th>Date</th><th>Activity</th><th>Details</th><th>Points</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map((t) => `<tr>
          <td data-label="Date" class="nowrap">${App.fmtDate(t.txn_date)}<div class="small muted">${t.week_no ? "Week " + t.week_no : "Outside league"}</div></td>
          <td data-label="Activity">${App.catIcon(t.category)} ${esc(App.catLabel(t.category))}</td>
          <td data-label="Details"><div>${App.txnDetails(t) || "—"}</div></td>
          <td data-label="Points" class="nowrap">${t.status === "rejected" ? '<span class="muted">0</span>' : `<span class="pts-badge">+${t.points}</span>`}${t.status === "pending" ? '<div class="small muted">if approved</div>' : ""}</td>
          <td data-label="Status">${App.statusTag(t.status)}</td>
          <td data-label="" class="no-label nowrap">
            ${t.photo_path ? `<button class="btn ghost sm" data-photo="${esc(t.photo_path)}">📷 Photo</button>` : ""}
            ${t.doc_path ? `<button class="btn ghost sm" data-photo="${esc(t.doc_path)}">📎 Document</button>` : ""}
            ${t.status === "pending" ? `<button class="btn ghost sm red-text" data-withdraw="${t.id}">Withdraw</button>` : ""}</td>
        </tr>`).join("")}</tbody></table>` : '<div class="empty">No entries yet. Tap “Submit Activity” to add your first one!</div>';
      App.$$("[data-photo]", el).forEach((b) => (b.onclick = () => App.viewProof(b.dataset.photo, "Proof")));
      App.$$("[data-withdraw]", el).forEach((b) => (b.onclick = async () => {
        if (!(await App.confirm("Withdraw (delete) this pending submission?", { ok: "Withdraw", danger: true }))) return;
        try { await App.rpc("withdraw_submission", { p_id: Number(b.dataset.withdraw) }); App.toast("Submission withdrawn.", "good"); App.render(); }
        catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
    };
    App.$$("#hist-f .chip", el).forEach((c) => (c.onclick = () => {
      App.$$("#hist-f .chip", el).forEach((x) => x.classList.toggle("active", x === c));
      drawHist(c.dataset.s);
    }));
    drawHist("");
  }, { member: true });

  // ==================================================================
  // SUBMIT ACTIVITY
  // ==================================================================
  const TYPES = [
    { t: "p2p", icon: "🤝", l: "P2P Meeting", pts: () => App.pointsText("p2p") },
    { t: "new_member", icon: "🌱", l: "New Member Connection", pts: () => App.pointsText("new_member") },
    { t: "reference", icon: "📤", l: "Reference", pts: () => `Given ${App.pointsText("ref_given")} · Received ${App.pointsText("ref_received")}` },
    { t: "business", icon: "💼", l: "Business", pts: () => App.pointsText("biz_given") },
    { t: "visitor", icon: "🙋", l: "Visitor", pts: () => `${App.pointsText("visitor")} (+${(App.rulesMap.induction || {}).points || 100} if inducted)` },
    { t: "challenge", icon: "⚡", l: "Special Challenge", pts: () => "10 – 30 pts" },
  ];

  const HELP = {
    p2p: "A proper <b>one-to-one business meeting</b> with another member to understand each other's business, requirements, customer profile and how you can support each other. <b>Casual talk during the regular meeting does not count.</b> A photograph of the meeting is required.",
    new_member: "Meeting a <b>newly / recently inducted member</b> and understanding their business, ideal customer and requirements. Only members marked as “new” appear in the list.",
    reference: "A <b>genuine</b> business reference / opportunity. Choose whether you <b>gave</b> it to a member or <b>received</b> it from a member.",
    business: "<b>Actual business</b> done. Points = 1 for every full ₹50,000 (e.g. ₹2,50,000 = 5 points; ₹49,999 = 0 points).",
    visitor: "A <b>qualified visitor</b> you brought to an official Igniter / GPBO meeting or event. If the visitor later joins GPBO, the Admin will add the induction bonus to you.",
    challenge: "Completed one of the Admin's special challenges? Claim it here. The Admin will verify and approve.",
  };

  const memberOptions = (filterFn) => {
    const list = App.members.filter((m) => m.id !== App.profile.id && (!filterFn || filterFn(m)));
    return `<option value="">— Choose member —</option>` + list.map((m) => `<option value="${m.id}">${esc(m.full_name)}${m.group_name ? " (" + esc(m.group_name) + ")" : ""}</option>`).join("");
  };

  App.route("submit", async (el, parts) => {
    const type = parts[0];
    const s = App.settings;
    let closedMsg = "";
    if (s.finalized) closedMsg = "The league is finalized. Submissions are closed.";
    else if (s.status === "not_started") closedMsg = "The league has not started yet. You can look at the forms, but submissions will open when the Admin starts the league.";
    else if (s.status === "ended") closedMsg = "The league has ended. Submissions are closed.";

    el.innerHTML = `
      <h2>➕ Submit Activity</h2>
      ${closedMsg ? `<div class="notice warn">${esc(closedMsg)}</div>` : ""}
      <div class="type-grid mb">${TYPES.map((x) => `<button type="button" class="type-tile ${type === x.t ? "active" : ""}" data-t="${x.t}"><span class="ic">${x.icon}</span><b>${x.l}</b><span>${esc(x.pts())}</span></button>`).join("")}</div>
      <p class="small muted">Meeting Attendance and Activity Participation are marked by the Admin — you do not need to submit them.</p>
      <div id="form-area"></div>`;
    App.$$(".type-tile", el).forEach((b) => (b.onclick = () => App.go("#/submit/" + b.dataset.t)));
    if (!type || !HELP[type]) return;
    const area = App.$("#form-area", el);
    await buildForm(area, type);
    area.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { member: true });

  async function buildForm(area, type) {
    const s = App.settings, today = App.todayISO();
    const maxDate = today < s.end_date ? today : s.end_date;
    const dateField = (label) => `<label class="f"><span>${label || "Date"} <em>*</em></span><input type="date" id="f-date" value="${maxDate >= s.start_date ? maxDate : ""}" min="${s.start_date}" max="${maxDate}" required></label>`;
    let html = "";
    let challenges = [];

    if (type === "p2p") {
      html = `${dateField("Date of meeting")}
        <label class="f"><span>Member met <em>*</em></span><select id="f-partner" required>${memberOptions()}</select></label>
        <label class="f"><span>Business discussion summary <em>*</em></span><textarea id="f-desc" placeholder="What did you discuss? Their business, requirements, ideal customers, how you can support each other…" required></textarea></label>
        <label class="f"><span>Notes (optional)</span><input type="text" id="f-notes"></label>
        <div class="f"><span style="display:block;font-weight:600;font-size:.9rem;margin-bottom:5px">Photograph of the meeting <em style="color:var(--red);font-style:normal">*</em></span>
          <div class="photo-drop"><input type="file" id="f-photo" accept="image/jpeg,image/png,image/webp" class="hidden">
            <button type="button" class="btn ghost" id="f-photo-btn">📷 Take / Choose Photo</button>
            <div class="small muted mt">JPG, PNG or WEBP. Large photos are automatically reduced (max 5 MB).</div>
            <img id="f-preview" class="hidden" alt="Preview"></div></div>`;
    } else if (type === "new_member") {
      const newOnes = App.members.filter((m) => m.is_new && m.id !== App.profile.id);
      if (!newOnes.length) { area.innerHTML = `<div class="card"><h3>🌱 New Member Connection</h3><div class="notice warn">No members are marked as “new members” yet. The Admin marks new members in Admin → Members.</div></div>`; return; }
      html = `${dateField("Date of meeting")}
        <label class="f"><span>New member met <em>*</em></span><select id="f-partner" required>${memberOptions((m) => m.is_new)}</select></label>
        <label class="f"><span>What did you learn about their business? <em>*</em></span><textarea id="f-desc" placeholder="Their business, ideal customer, requirements, how you can support each other…" required></textarea></label>
        <label class="f"><span>Notes (optional)</span><input type="text" id="f-notes"></label>`;
    } else if (type === "reference") {
      html = `<div class="seg" id="f-dir"><button type="button" class="active" data-v="ref_given">📤 I GAVE a reference</button><button type="button" data-v="ref_received">📥 I RECEIVED a reference</button></div>
        ${dateField()}
        <label class="f"><span id="f-partner-l">Given to member</span><select id="f-partner" required>${memberOptions()}</select></label>
        <label class="f"><span>Reference details <em>*</em></span><textarea id="f-desc" placeholder="What is the requirement / opportunity?" required></textarea></label>
        <label class="f"><span>Customer / company name (if appropriate)</span><input type="text" id="f-customer"></label>
        <label class="f"><span>Notes (optional)</span><input type="text" id="f-notes"></label>`;
    } else if (type === "business") {
      html = `<div class="seg" id="f-dir"><button type="button" class="active" data-v="biz_given">💼 Business GIVEN</button><button type="button" data-v="biz_received">💰 Business RECEIVED</button></div>
        <label class="f"><span id="f-partner-l">Business given to member</span><select id="f-partner" required>${memberOptions()}</select></label>
        <label class="f"><span>Amount in ₹ <em>*</em></span><input type="number" id="f-amount" inputmode="numeric" min="1" step="1" placeholder="e.g. 250000" required><small id="f-amt-pts">Points: 0</small></label>
        ${dateField()}
        <label class="f"><span>Description <em>*</em></span><textarea id="f-desc" placeholder="What was the business?" required></textarea></label>
        <label class="f"><span>Supporting document / photo (optional)</span><input type="file" id="f-doc" accept="image/jpeg,image/png,image/webp,application/pdf"><small>Photo or PDF, max 5 MB.</small></label>`;
    } else if (type === "visitor") {
      html = `<label class="f"><span>Visitor name <em>*</em></span><input type="text" id="v-name" required></label>
        <div class="form-grid two">
          <label class="f"><span>Company</span><input type="text" id="v-company"></label>
          <label class="f"><span>Mobile number <em>*</em></span><input type="tel" id="v-mobile" inputmode="tel" placeholder="10-digit mobile" required></label>
          <label class="f"><span>Business category</span><input type="text" id="v-cat" placeholder="e.g. Plastic moulding"></label>
          ${dateField("Visit date")}
        </div>
        <label class="f"><span>Event</span><input type="text" id="v-event" list="v-events" placeholder="e.g. Weekly Meeting"><datalist id="v-events"><option value="Weekly Meeting"><option value="Mega Visitors Day"><option value="Joint Meeting"><option value="Business Exhibition"><option value="Workshop"></datalist></label>
        <label class="f"><span>Member who brought the visitor</span><input type="text" value="${esc(App.profile.full_name)} (you)" disabled></label>
        <label class="f"><span>Notes (optional)</span><input type="text" id="f-notes"></label>`;
    } else if (type === "challenge") {
      challenges = await App.q(App.sb.from("special_challenges").select("*").eq("is_active", true).order("id", { ascending: true }));
      if (!challenges.length) { area.innerHTML = `<div class="card"><h3>⚡ Special Challenge</h3><div class="empty">There is no active challenge right now.</div></div>`; return; }
      if (!s.allow_challenge_claims) { area.innerHTML = `<div class="card"><h3>⚡ Special Challenge</h3><div class="notice">The Admin awards challenge points directly. You do not need to submit anything.</div></div>`; return; }
      html = `<label class="f"><span>Challenge <em>*</em></span><select id="f-ch">${challenges.map((c) => `<option value="${c.id}">${esc(c.name)} (+${c.points} pts${c.week_no ? ", Week " + c.week_no : ""})</option>`).join("")}</select></label>
        <div class="notice" id="f-ch-desc"></div>
        ${dateField("Date completed")}
        <label class="f"><span>How did you complete it? <em>*</em></span><textarea id="f-desc" placeholder="Give details so the Admin can verify (names, dates, etc.)" required></textarea></label>`;
    }
    const t = TYPES.find((x) => x.t === type);
    area.innerHTML = `<form class="card" id="sub-form" novalidate>
        <h3>${t.icon} ${t.l}</h3>
        <div class="notice small">${HELP[type]}</div>
        ${html}
        <div id="f-err" class="notice bad hidden"></div>
        <button class="btn green block lg" id="f-submit" type="submit">Submit for Approval</button>
        <p class="small muted center mt">Your entry will show as <b>PENDING</b> until the Admin approves it.</p>
      </form>`;

    // interactive bits
    const dir = App.$("#f-dir", area);
    let category = type === "reference" ? "ref_given" : type === "business" ? "biz_given" : type;
    if (dir) App.$$("button", dir).forEach((b) => (b.onclick = () => {
      App.$$("button", dir).forEach((x) => x.classList.toggle("active", x === b));
      category = b.dataset.v;
      const l = App.$("#f-partner-l", area);
      if (l) l.textContent = { ref_given: "Given to member", ref_received: "Received from member", biz_given: "Business given to member", biz_received: "Business received from member" }[category];
      updAmt();
    }));
    const amt = App.$("#f-amount", area);
    const updAmt = () => { if (amt) App.$("#f-amt-pts", area).textContent = `Points: ${App.calcPoints(category, amt.value)} ${amt.value ? "(" + App.fmtINR(amt.value) + ")" : ""}`; };
    if (amt) amt.oninput = updAmt;
    const chSel = App.$("#f-ch", area);
    if (chSel) {
      const showCh = () => { const c = challenges.find((x) => String(x.id) === chSel.value); App.$("#f-ch-desc", area).innerHTML = c ? `<b>${esc(c.name)}</b>: ${esc(c.description || "")}${c.start_date ? `<br><span class="small">${App.fmtDate(c.start_date)} – ${App.fmtDate(c.end_date)}</span>` : ""}` : ""; };
      chSel.onchange = showCh; showCh();
    }
    let photoBlob = null;
    const photoIn = App.$("#f-photo", area);
    if (photoIn) {
      App.$("#f-photo-btn", area).onclick = () => photoIn.click();
      photoIn.onchange = async () => {
        const f = photoIn.files[0];
        photoBlob = null;
        const prev = App.$("#f-preview", area);
        prev.classList.add("hidden");
        if (!f) return;
        try {
          photoBlob = await App.preparePhoto(f);
          prev.src = URL.createObjectURL(photoBlob);
          prev.classList.remove("hidden");
          App.$("#f-photo-btn", area).textContent = "📷 Change Photo";
        } catch (e) { App.toast(App.errMsg(e), "bad"); photoIn.value = ""; }
      };
    }

    App.$("#sub-form", area).onsubmit = async (e) => {
      e.preventDefault();
      const btn = App.$("#f-submit", area), err = App.$("#f-err", area);
      const val = (id) => { const x = App.$("#" + id, area); return x ? x.value.trim() : ""; };
      const fail = (m) => { err.textContent = m; err.classList.remove("hidden"); err.scrollIntoView({ behavior: "smooth", block: "center" }); };
      err.classList.add("hidden");
      const date = val("f-date");
      if (!date) return fail("Please choose the date.");
      btn.disabled = true; btn.textContent = "Submitting…";
      try {
        const uid = App.profile.id;
        if (type === "visitor") {
          if (!val("v-name")) throw new Error("Please enter the visitor name.");
          if (val("v-mobile").replace(/\D/g, "").length < 10) throw new Error("Please enter a valid 10-digit mobile number.");
          await App.rpc("submit_visitor", {
            p_visitor_name: val("v-name"), p_company: val("v-company"), p_mobile: val("v-mobile"),
            p_business_category: val("v-cat"), p_visit_date: date, p_event_name: val("v-event"), p_notes: val("f-notes"),
          });
        } else {
          const args = { p_category: category, p_txn_date: date, p_description: val("f-desc"), p_notes: val("f-notes") || null };
          if (type !== "challenge") {
            args.p_partner_id = val("f-partner");
            if (!args.p_partner_id) throw new Error("Please choose the member.");
          }
          if (!args.p_description) throw new Error(type === "p2p" ? "Please write the business discussion summary." : "Please fill in the details.");
          if (type === "reference") args.p_customer_name = val("f-customer") || null;
          if (type === "business") {
            args.p_amount = Number(val("f-amount"));
            if (!(args.p_amount > 0)) throw new Error("Please enter the amount in ₹.");
            const docIn = App.$("#f-doc", area);
            if (docIn && docIn.files[0]) {
              const f = docIn.files[0];
              let blob = f, ext = "pdf", ctype = "application/pdf";
              if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) { if (f.size > 5 * 1024 * 1024) throw new Error("The PDF is bigger than 5 MB."); }
              else { blob = await App.preparePhoto(f); ext = "jpg"; ctype = "image/jpeg"; }
              const path = `${uid}/docs/${Date.now()}_${App.rand()}.${ext}`;
              const up = await App.sb.storage.from("proofs").upload(path, blob, { contentType: ctype, upsert: false });
              if (up.error) throw up.error;
              args.p_doc_path = path;
            }
          }
          if (type === "challenge") { args.p_challenge_id = Number(val("f-ch")); args.p_notes = null; }
          if (type === "p2p") {
            if (!photoBlob) throw new Error("Please add a photograph of the P2P meeting.");
            if (args.p_description.length < 10) throw new Error("Please write a little more in the discussion summary (at least 10 characters).");
            const path = `${uid}/p2p/${Date.now()}_${App.rand()}.jpg`;
            const up = await App.sb.storage.from("proofs").upload(path, photoBlob, { contentType: "image/jpeg", upsert: false });
            if (up.error) throw up.error;
            args.p_photo_path = path;
          }
          await App.rpc("submit_activity", args);
        }
        area.innerHTML = `<div class="card center"><div style="font-size:3rem">✅</div><h2>Submitted!</h2>
          <p>Your entry is now <b>PENDING APPROVAL</b>. Points will be added after the Admin approves it.</p>
          <div class="row" style="justify-content:center"><a class="btn green" href="#/submit">Submit another</a><a class="btn ghost" href="#/me">My Performance</a></div></div>`;
        App.toast("Submitted for approval ✔", "good");
      } catch (ex) {
        fail(App.errMsg(ex));
        btn.disabled = false; btn.textContent = "Submit for Approval";
      }
    };
  }

  // ==================================================================
  // WEEKLY WINNERS (+ final result when finalized)
  // ==================================================================
  App.achievementsText = (a) => {
    if (!a) return "";
    const bits = [];
    if (a.p2p) bits.push(`${a.p2p} P2P`);
    if (a.ref_given) bits.push(`${a.ref_given} Ref given`);
    if (a.ref_received) bits.push(`${a.ref_received} Ref received`);
    if (Number(a.biz_given_amount)) bits.push(`${App.fmtINR(a.biz_given_amount)} business given`);
    if (Number(a.biz_received_amount)) bits.push(`${App.fmtINR(a.biz_received_amount)} business received`);
    if (a.visitors) bits.push(`${a.visitors} visitor${a.visitors > 1 ? "s" : ""}`);
    if (a.inductions) bits.push(`${a.inductions} induction${a.inductions > 1 ? "s" : ""}`);
    if (a.new_member) bits.push(`${a.new_member} new member conn.`);
    if (a.attendance) bits.push(`${a.attendance} attendance`);
    if (a.activities) bits.push(`${a.activities} activities`);
    if (a.challenges) bits.push(`${a.challenges} challenge${a.challenges > 1 ? "s" : ""}`);
    return bits.join(" · ");
  };
  App.lbAchievements = (r) => App.achievementsText({ p2p: r.p2p, ref_given: r.ref_given, ref_received: r.ref_received, biz_given_amount: r.biz_given_amount, biz_received_amount: r.biz_received_amount, visitors: r.visitors, inductions: r.inductions, new_member: r.new_member, attendance: r.attendance, activities: r.activities, challenges: r.challenges });

  App.renderFinalResult = (finals, awards) => `
    <div class="final-banner"><div class="l1">IGNITER BUSINESS &amp; P2P LEAGUE</div><div class="l2">${App.weeks.length}-WEEK FINAL RESULT</div></div>
    <div class="card">
      ${finals.length ? finals.map((f) => `<div class="winner" style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="trophy">${App.medal(f.position)}</div>${App.avatar(f.avatar_url, f.member_name, "lg")}
        <div class="grow"><div class="small muted" style="font-weight:700">${f.position === 1 ? "OVERALL CHAMPION" : f.position === 2 ? "RUNNER-UP" : "THIRD POSITION"}</div>
          <h3 style="margin:0">${esc(f.member_name)}</h3><div class="small muted">${esc(App.achievementsText(f.achievements))}</div></div>
        <div class="pts">${f.points}<div class="small muted" style="font-size:.7rem">points</div></div></div>`).join("") : '<div class="empty">No final results.</div>'}
    </div>
    ${awards.length ? `<div class="card"><h3>🌟 Special Appreciation Awards</h3>${awards.map((a) => `<div class="award"><div class="trophy" style="font-size:1.6rem">🏅</div><div><b>${esc(a.award_name)}</b><div>${esc(a.member_name || "")}</div>${a.note ? `<div class="small muted">${esc(a.note)}</div>` : ""}</div></div>`).join("")}</div>` : ""}`;

  App.route("winners", async (el, _p, token) => {
    const sb = App.sb;
    const [winners, prizes, finals, awards] = await Promise.all([
      App.q(sb.from("weekly_winners").select("*").order("week_no", { ascending: true }).order("position", { ascending: true })),
      App.q(sb.from("prizes").select("*").order("sort_order", { ascending: true })),
      App.q(sb.from("final_results").select("*").order("position", { ascending: true })),
      App.q(sb.from("final_awards").select("*").order("id", { ascending: true })),
    ]);
    if (App.stale(token)) return;
    const cw = App.currentWeek();
    const live = {};
    for (const w of App.weeks) {
      if (!w.locked && w.start_date <= App.todayISO()) live[w.week_no] = (await App.rpc("get_leaderboard", { p_week: w.week_no })).filter((r) => r.total_points > 0).slice(0, 3);
    }
    if (App.stale(token)) return;
    const s = App.settings;
    el.innerHTML = `
      ${s.finalized ? App.renderFinalResult(finals, awards) : ""}
      <h2>🎖️ Weekly Winners</h2>
      <p class="small muted">Each week's winner is decided only by that week's <b>approved</b> points. A week becomes final when the Admin locks it.</p>
      <div class="week-grid mb">${App.weeks.map((w) => {
        const ww = winners.filter((x) => x.week_no === w.week_no);
        const lv = live[w.week_no];
        let body;
        if (w.locked) {
          body = ww.length ? ww.map((x) => `<div class="winner" style="padding:8px 0">
              <div class="trophy">${App.medal(x.position)}</div>${App.avatar(x.avatar_url, x.member_name, x.position === 1 ? "lg" : "")}
              <div class="grow"><b style="font-size:${x.position === 1 ? "1.1rem" : ".95rem"}">${esc(x.member_name)}</b>${x.position === 1 ? ` <span class="tag approved">WEEK ${w.week_no} WINNER</span>` : ""}
              <div class="small muted">${esc(App.achievementsText(x.achievements))}</div></div>
              <div class="pts" style="font-size:${x.position === 1 ? "1.6rem" : "1.1rem"}">${x.points}</div></div>`).join("") : '<div class="empty">No points were scored this week.</div>';
        } else if (lv) {
          body = lv.length ? `<div class="small muted mb">Live standings — not final yet</div>` + lv.map((r) => `<div class="winner" style="padding:6px 0">
              <div style="font-size:1.4rem">${App.medal(r.rank)}</div>${App.avatar(r.avatar_url, r.full_name)}
              <div class="grow"><b>${esc(r.full_name)}</b><div class="small muted">${esc(App.lbAchievements(r))}</div></div><div class="pts" style="font-size:1.1rem">${r.total_points}</div></div>`).join("") : '<div class="empty">No approved points yet this week.</div>';
        } else body = `<div class="empty">Starts ${App.fmtDate(w.start_date)}</div>`;
        return `<div class="card"><div class="card-title"><h3>WEEK ${w.week_no} ${w.locked ? "WINNER" : ""}</h3>
          ${w.locked ? '<span class="tag approved">🔒 FINAL</span>' : w.week_no === cw ? '<span class="tag pending">IN PROGRESS</span>' : lv ? '<span class="tag info">AWAITING RESULT</span>' : '<span class="tag gray">UPCOMING</span>'}</div>
          <div class="small muted mb">${App.fmtDate(w.start_date)} – ${App.fmtDate(w.end_date)}</div>${body}</div>`;
      }).join("")}</div>
      ${prizes.length ? `<div class="card"><h3>🎁 Prizes</h3>${prizes.map((p) => `<div class="award"><div style="font-size:1.4rem">🎁</div><div><b>${esc(p.title)}</b>${p.description ? `<div class="small muted">${esc(p.description)}</div>` : ""}</div></div>`).join("")}</div>` : ""}`;
  });

  // ==================================================================
  // SPECIAL CHALLENGE
  // ==================================================================
  App.route("challenges", async (el, _p, token) => {
    const list = await App.q(App.sb.from("special_challenges").select("*").eq("is_active", true).order("id", { ascending: false }));
    let mine = [];
    if (!App.isAdmin()) mine = await App.q(App.sb.from("transactions").select("id,challenge_id,status").eq("member_id", App.profile.id).eq("category", "challenge"));
    if (App.stale(token)) return;
    el.innerHTML = `<h2>⚡ Special Challenges</h2>
      <p class="small muted">Complete a challenge to earn bonus points (10 – 30). ${App.settings.allow_challenge_claims ? "Tap “I completed this” to claim it — the Admin will verify." : "The Admin awards challenge points directly."}</p>
      ${list.length ? list.map((c) => {
        const my = mine.filter((m) => m.challenge_id === c.id).sort((a, b) => (a.status === "rejected") - (b.status === "rejected"))[0];
        return `<div class="card"><div class="card-title"><h3>⚡ ${esc(c.name)}</h3><span class="tag approved" style="font-size:.9rem">+${c.points} pts</span></div>
          <p>${esc(c.description || "")}</p>
          <div class="row small muted">${c.week_no ? `<span class="tag info">Week ${c.week_no}</span>` : ""}${c.start_date ? `<span>📅 ${App.fmtDate(c.start_date)} – ${App.fmtDate(c.end_date)}</span>` : ""}</div>
          ${App.isAdmin() ? "" : my && my.status !== "rejected" ? `<div class="mt">${App.statusTag(my.status)}</div>`
            : App.settings.allow_challenge_claims ? `<a class="btn green mt" href="#/submit/challenge">I completed this</a>${my ? ' <span class="small muted">(previous claim was rejected)</span>' : ""}` : ""}
        </div>`;
      }).join("") : '<div class="card empty">No active challenge right now. Check back soon!</div>'}`;
  });

  // ==================================================================
  // PROFILE (photo, change password, logout)
  // ==================================================================
  App.route("profile", async (el) => {
    const p = App.profile;
    el.innerHTML = `
      <div class="card"><div class="row">${App.avatar(p.avatar_url, p.full_name, "xl")}
        <div class="grow"><h2 style="margin:0">${esc(p.full_name)}</h2><div class="muted">@${esc(p.username)}</div>
        ${p.group_name ? `<div class="small muted">Group: ${esc(p.group_name)}</div>` : ""}
        <div class="small muted">Role: ${p.role === "admin" ? "Admin" : "Member"}</div></div></div>
        <div class="mt"><input type="file" id="av-in" accept="image/jpeg,image/png,image/webp" class="hidden">
        <button class="btn ghost sm" id="av-btn">📷 ${p.avatar_url ? "Change" : "Add"} profile photo</button>
        ${p.avatar_url ? '<button class="btn ghost sm red-text" id="av-del">Remove photo</button>' : ""}</div></div>
      <form class="card" id="pw-form">
        <h3>🔑 Change Password</h3>
        <label class="f"><span>New password</span><input type="password" id="pw1" autocomplete="new-password" required><small>At least 8 characters, with letters AND numbers.</small></label>
        <label class="f"><span>Confirm new password</span><input type="password" id="pw2" autocomplete="new-password" required></label>
        <label class="check small"><input type="checkbox" id="pw-show"> Show passwords</label>
        <div id="pw-msg" class="notice hidden"></div>
        <button class="btn block" id="pw-btn" type="submit">Change Password</button>
      </form>
      <button class="btn ghost red-text block lg" id="logout-btn">🚪 Logout</button>`;
    App.$("#pw-show", el).onchange = (e) => { App.$("#pw1", el).type = App.$("#pw2", el).type = e.target.checked ? "text" : "password"; };
    App.$("#pw-form", el).onsubmit = async (e) => {
      e.preventDefault();
      const a = App.$("#pw1", el).value, b = App.$("#pw2", el).value, msg = App.$("#pw-msg", el), btn = App.$("#pw-btn", el);
      const show = (t, cls) => { msg.textContent = t; msg.className = "notice " + cls; };
      if (a.length < 8) return show("Password must be at least 8 characters.", "bad");
      if (!/[A-Za-z]/.test(a) || !/\d/.test(a)) return show("Password must contain letters AND numbers.", "bad");
      if (a !== b) return show("The two passwords do not match.", "bad");
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        const { error } = await App.sb.auth.updateUser({ password: a });
        if (error) throw error;
        show("✔ Password changed. Use the new password next time you log in.", "good");
        App.$("#pw1", el).value = App.$("#pw2", el).value = "";
      } catch (ex) { show(App.errMsg(ex), "bad"); }
      btn.disabled = false; btn.textContent = "Change Password";
    };
    App.$("#logout-btn", el).onclick = () => App.logout();
    const avIn = App.$("#av-in", el);
    App.$("#av-btn", el).onclick = () => avIn.click();
    avIn.onchange = async () => {
      const f = avIn.files[0];
      if (!f) return;
      try {
        const blob = await App.preparePhoto(f, 400);
        const path = `${p.id}/avatar_${Date.now()}.jpg`;
        const up = await App.sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (up.error) throw up.error;
        const url = App.sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        await App.rpc("set_my_avatar", { p_url: url });
        await App.reloadProfile();
        App.toast("Profile photo updated ✔", "good");
        App.render();
      } catch (ex) { App.toast(App.errMsg(ex), "bad"); }
    };
    const del = App.$("#av-del", el);
    if (del) del.onclick = async () => {
      try { await App.rpc("set_my_avatar", { p_url: null }); await App.reloadProfile(); App.render(); } catch (ex) { App.toast(App.errMsg(ex), "bad"); }
    };
  });
})();
