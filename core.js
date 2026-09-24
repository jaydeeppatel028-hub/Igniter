/* =====================================================================
   IGNITER LEAGUE — core: connection, login, navigation, shared helpers
   You do not need to edit this file.
   ===================================================================== */
(function () {
  "use strict";
  const C = window.LEAGUE_CONFIG || {};
  const App = (window.App = { routes: {}, cache: {} });

  App.configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY &&
    !/PASTE_/.test(C.SUPABASE_URL) && !/PASTE_/.test(C.SUPABASE_ANON_KEY));

  // ------------------------------------------------------------------
  // Category definitions (labels come from the point rules in the DB)
  // ------------------------------------------------------------------
  App.CATS = {
    p2p:          { icon: "🤝", label: "P2P Meeting" },
    new_member:   { icon: "🌱", label: "New Member Connection" },
    ref_given:    { icon: "📤", label: "Reference Given" },
    ref_received: { icon: "📥", label: "Reference Received" },
    biz_given:    { icon: "💼", label: "Business Given" },
    biz_received: { icon: "💰", label: "Business Received" },
    visitor:      { icon: "🙋", label: "Visitor Brought" },
    induction:    { icon: "🎉", label: "Visitor Inducted" },
    attendance:   { icon: "✅", label: "Meeting Attendance" },
    activity:     { icon: "🏭", label: "Activity Participation" },
    challenge:    { icon: "⚡", label: "Special Challenge" },
  };
  App.catLabel = (c) => (App.rulesMap && App.rulesMap[c] && App.rulesMap[c].label) || (App.CATS[c] && App.CATS[c].label) || c;
  App.catIcon = (c) => (App.CATS[c] && App.CATS[c].icon) || "•";

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  const esc = (App.esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;"));
  App.$ = (s, r) => (r || document).querySelector(s);
  App.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  App.fmtDate = (iso) => {
    if (!iso) return "—";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return esc(iso);
    return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
  };
  App.fmtDateTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d)) return String(ts);
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  App.fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  App.fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
  App.todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  App.addDays = (iso, n) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  };
  App.daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  App.initials = (name) => String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  App.avatar = (url, name, cls) => url
    ? `<span class="av ${cls || ""}"><img src="${esc(url)}" alt="" loading="lazy"></span>`
    : `<span class="av ${cls || ""}">${esc(App.initials(name))}</span>`;
  App.rankBadge = (r) => `<span class="rank ${r <= 3 ? "r" + r : ""}">${r}</span>`;
  App.medal = (r) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "");
  App.sampleTag = (isSample) => (isSample ? '<span class="sample-tag">SAMPLE</span>' : "");
  App.statusTag = (s) => {
    if (s === "pending") return '<span class="tag pending">PENDING APPROVAL</span>';
    if (s === "approved") return '<span class="tag approved">APPROVED</span>';
    if (s === "rejected") return '<span class="tag rejected">REJECTED</span>';
    return `<span class="tag gray">${esc(s)}</span>`;
  };
  App.loadingHTML = '<div class="loading"><div class="spinner"></div></div>';
  App.rand = () => Math.random().toString(36).slice(2, 8);

  // Turn any error into a message a normal person understands
  App.errMsg = (e) => {
    if (!e) return "Something went wrong.";
    const m = String(e.message || e.error_description || e.error || e);
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return "Could not reach the server. Please check your internet and try again.";
    if (/Invalid login credentials/i.test(m)) return "Wrong username or password.";
    if (/banned/i.test(m)) return "Your account is disabled. Please contact the League Admin.";
    if (/JWT expired|invalid JWT|not logged in/i.test(m)) return "Your session has expired. Please log in again.";
    if (e.code === "23505" || /duplicate key/i.test(m)) return "Duplicate: this has already been recorded.";
    if (e.code === "42501" || /row-level security|permission denied/i.test(m)) return "You do not have permission to do this.";
    if (/same_password|should be different/i.test(m)) return "The new password must be different from the old one.";
    if (/Password should be at least/i.test(m)) return m;
    if (/Function not found|Requested function was not found|404/i.test(m)) return "The admin-users Edge Function is not installed yet (see the setup guide, Step 7).";
    return m;
  };

  // Run a Supabase query; throw a friendly error if it failed
  App.q = async (promise) => {
    const res = await promise;
    if (res.error) throw res.error;
    return res.data;
  };
  App.rpc = (fn, args) => App.q(App.sb.rpc(fn, args || {}));

  // Call the secure admin Edge Function
  App.adminFn = async (action, payload) => {
    const { data, error } = await App.sb.functions.invoke("admin-users", { body: Object.assign({ action }, payload || {}) });
    if (error) {
      let msg = error.message;
      try { if (error.context && error.context.json) { const j = await error.context.json(); msg = j.error || j.message || msg; } } catch (_) { /* ignore */ }
      if (/Failed to send a request|FunctionsFetchError/i.test(error.name + " " + msg)) msg = "Function not found";
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };

  // ------------------------------------------------------------------
  // Toasts & modals
  // ------------------------------------------------------------------
  App.toast = (msg, type) => {
    const box = document.getElementById("toasts");
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === "bad" ? 6000 : 3500);
  };

  /**
   * App.modal({ title, body, actions:[{label, cls, value}], wide, onAction(value, el) })
   * Returns a Promise with the clicked action value (or null if closed).
   * If onAction returns false (or a Promise of false), the modal stays open.
   */
  App.modal = (opts) => new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `<div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(opts.title || "")}</h3><button class="icon-btn" data-x aria-label="Close">✕</button></div>
      <div class="modal-body"></div><div class="modal-actions"></div></div>`;
    const bodyEl = wrap.querySelector(".modal-body");
    if (typeof opts.body === "string") bodyEl.innerHTML = opts.body; else if (opts.body) bodyEl.appendChild(opts.body);
    const actEl = wrap.querySelector(".modal-actions");
    const actions = opts.actions || [{ label: "Close", cls: "ghost", value: null }];
    if (!actions.length) actEl.remove();
    let busy = false;
    const close = (v) => { wrap.remove(); document.body.style.overflow = ""; resolve(v); };
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.cls || "");
      b.textContent = a.label;
      b.type = "button";
      b.onclick = async () => {
        if (busy) return;
        if (opts.onAction && a.value !== null && a.value !== undefined) {
          busy = true; const old = b.textContent; b.disabled = true; b.textContent = "Please wait…";
          let ok;
          try { ok = await opts.onAction(a.value, wrap); } catch (e) { App.toast(App.errMsg(e), "bad"); ok = false; }
          busy = false; b.disabled = false; b.textContent = old;
          if (ok === false) return;
        }
        close(a.value);
      };
      actEl.appendChild(b);
    });
    wrap.querySelector("[data-x]").onclick = () => { if (!busy) close(null); };
    wrap.addEventListener("click", (e) => { if (e.target === wrap && !busy && !opts.sticky) close(null); });
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    if (opts.onOpen) opts.onOpen(wrap);
    const first = wrap.querySelector("input, select, textarea");
    if (first && window.innerWidth > 700) first.focus();
  });

  App.confirm = (message, opts) => App.modal({
    title: (opts && opts.title) || "Please confirm",
    body: `<p>${message}</p>`,
    actions: [{ label: "Cancel", cls: "ghost", value: false }, { label: (opts && opts.ok) || "Yes", cls: (opts && opts.danger) ? "red" : "", value: true }],
  }).then((v) => v === true);

  App.prompt = (o) => {
    let val = null;
    return App.modal({
      title: o.title,
      body: `${o.message ? `<p>${o.message}</p>` : ""}<label class="f"><span>${esc(o.label || "")}</span>${o.textarea
        ? `<textarea id="pr-in" placeholder="${esc(o.placeholder || "")}">${esc(o.value || "")}</textarea>`
        : `<input id="pr-in" type="${o.type || "text"}" placeholder="${esc(o.placeholder || "")}" value="${esc(o.value || "")}">`}</label>`,
      actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: o.ok || "OK", cls: o.danger ? "red" : "", value: "ok" }],
      onAction: (v, el) => {
        val = el.querySelector("#pr-in").value.trim();
        if (o.required && !val) { App.toast(o.requiredMsg || "Please fill this in.", "bad"); return false; }
        return true;
      },
    }).then((v) => (v === "ok" ? val : null));
  };

  App.showImage = (url, title) => App.modal({ title: title || "Photo", wide: true, body: `<img class="full" src="${esc(url)}" alt="Photo"><p class="small mt"><a href="${esc(url)}" target="_blank" rel="noopener">Open full size</a></p>` });

  // Signed (private, temporary) links for proof files
  App.signedUrl = async (path) => {
    const { data, error } = await App.sb.storage.from("proofs").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };
  App.signedUrls = async (paths) => {
    const out = {};
    const list = Array.from(new Set(paths.filter(Boolean)));
    if (!list.length) return out;
    const { data, error } = await App.sb.storage.from("proofs").createSignedUrls(list, 3600);
    if (error) { console.warn(error); return out; }
    (data || []).forEach((d) => { if (d.signedUrl) out[d.path] = d.signedUrl; });
    return out;
  };
  App.viewProof = async (path, title) => {
    try {
      const url = await App.signedUrl(path);
      if (/\.pdf$/i.test(path)) window.open(url, "_blank", "noopener"); else App.showImage(url, title);
    } catch (e) { App.toast(App.errMsg(e), "bad"); }
  };

  // ------------------------------------------------------------------
  // Images: shrink phone photos (fast upload, removes GPS location data)
  // ------------------------------------------------------------------
  App.IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  App.compressImage = (file, maxDim, quality) => new Promise((resolve, reject) => {
    maxDim = maxDim || 1600; quality = quality || 0.82;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the photo."))), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This photo could not be opened. Please use a JPG, PNG or WEBP photo.")); };
    img.src = url;
  });

  // Validate + compress a chosen photo. Returns a JPEG Blob (max 5 MB).
  App.preparePhoto = async (file, maxDim) => {
    if (!file) throw new Error("Please choose a photograph.");
    const type = (file.type || "").toLowerCase();
    const okExt = /\.(jpe?g|png|webp)$/i.test(file.name || "");
    if (!App.IMAGE_TYPES.includes(type) && !okExt) throw new Error("Only JPG, JPEG, PNG or WEBP photos are allowed.");
    if (file.size > 25 * 1024 * 1024) throw new Error("This photo is too large (over 25 MB). Please choose another one.");
    const blob = await App.compressImage(file, maxDim || 1600, 0.82);
    if (blob.size > 5 * 1024 * 1024) throw new Error("The photo is still bigger than 5 MB. Please choose a smaller photo.");
    return blob;
  };

  // ------------------------------------------------------------------
  // CSV export / import
  // ------------------------------------------------------------------
  App.downloadCSV = (filename, rows, columns) => {
    if (!rows || !rows.length) { App.toast("Nothing to export.", "bad"); return; }
    const cols = columns || Object.keys(rows[0]).map((k) => ({ k, l: k }));
    const cell = (v) => {
      if (v == null) return "";
      let s = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;   // stop Excel formula injection
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.map((c) => cell(c.l)).join(",")];
    rows.forEach((r) => lines.push(cols.map((c) => cell(typeof c.f === "function" ? c.f(r) : r[c.k])).join(",")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // Robust CSV reader (handles quotes, commas inside quotes, Excel BOM)
  App.parseCSV = (text) => {
    text = String(text || "").replace(/^﻿/, "");
    const rows = []; let row = []; let cur = ""; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === "," || ch === ";" && !text.includes(",")) { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = ""; if (row.some((c) => c.trim() !== "")) rows.push(row); row = [];
      } else cur += ch;
    }
    row.push(cur); if (row.some((c) => c.trim() !== "")) rows.push(row);
    return rows;
  };

  // ------------------------------------------------------------------
  // Base data (settings, weeks, rules, members)
  // ------------------------------------------------------------------
  App.loadBase = async () => {
    const sb = App.sb;
    const [settings, weeks, rules, members] = await Promise.all([
      App.q(sb.from("league_settings").select("*").eq("id", 1).single()),
      App.q(sb.from("league_weeks").select("*").order("week_no", { ascending: true })),
      App.q(sb.from("point_rules").select("*").order("sort_order", { ascending: true })),
      App.rpc("list_members"),
    ]);
    App.settings = settings;
    App.weeks = weeks || [];
    App.rules = rules || [];
    App.rulesMap = {};
    App.rules.forEach((r) => (App.rulesMap[r.code] = r));
    App.members = members || [];
    App.memberMap = {};
    App.members.forEach((m) => (App.memberMap[m.id] = m));
  };
  App.memberName = (id) => (id && App.memberMap && App.memberMap[id] ? App.memberMap[id].full_name : (App.profileMap && App.profileMap[id] ? App.profileMap[id].full_name : "—"));
  App.weekForDate = (iso) => {
    const w = (App.weeks || []).find((x) => iso >= x.start_date && iso <= x.end_date);
    return w ? w.week_no : null;
  };
  App.currentWeek = () => App.weekForDate(App.todayISO());
  App.isAdmin = () => App.profile && App.profile.role === "admin";
  App.pointsText = (code) => {
    const r = App.rulesMap && App.rulesMap[code];
    if (!r) return "";
    if (r.unit_amount) return `${r.points} pt per ${App.fmtINR(r.unit_amount)}`;
    return `+${r.points} pts`;
  };
  App.calcPoints = (code, amount) => {
    const r = App.rulesMap && App.rulesMap[code];
    if (!r) return 0;
    if (r.unit_amount) return Math.floor((Number(amount) || 0) / Number(r.unit_amount)) * r.points;
    return r.points;
  };

  App.refreshPendingCount = async () => {
    if (!App.isAdmin()) return;
    try {
      const { count } = await App.sb.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending");
      App.pendingCount = count || 0;
      App.$$("[data-pending-badge]").forEach((b) => { b.textContent = App.pendingCount; b.classList.toggle("hidden", !App.pendingCount); });
    } catch (_) { /* ignore */ }
  };

  // ------------------------------------------------------------------
  // Router
  // ------------------------------------------------------------------
  App.route = (name, fn, opts) => { App.routes[name] = { fn, opts: opts || {} }; };
  App.go = (hash) => { if (location.hash === hash) App.render(); else location.hash = hash; };

  const NAV_MEMBER = [
    { r: "home", l: "Home", i: "🏠" },
    { r: "leaderboard", l: "Leaderboard", i: "🏆" },
    { r: "me", l: "My Performance", i: "📊", memberOnly: true },
    { r: "submit", l: "Submit Activity", i: "➕", memberOnly: true },
    { r: "winners", l: "Weekly Winners", i: "🎖️" },
    { r: "challenges", l: "Special Challenge", i: "⚡" },
    { r: "profile", l: "Profile", i: "👤" },
    { r: "admin", l: "Admin Panel", i: "🛠️", adminOnly: true },
  ];

  function navItems() {
    return NAV_MEMBER.filter((n) => (!n.adminOnly || App.isAdmin()) && (!n.memberOnly || !App.isAdmin()));
  }

  function renderShell() {
    const app = document.getElementById("app");
    const s = App.settings || {};
    const items = navItems();
    const badge = '<span class="badge hidden" data-pending-badge>0</span>';
    app.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#/home" aria-label="Home">
          <img src="assets/igniter-logo.png" alt="IGNITER Ahmedabad">
          <span class="divider"></span>
          <img class="gpbo" src="assets/gpbo-logo.png" alt="Sardardham GPBO Network">
        </a>
        <nav class="topnav">${items.map((n) => `<a href="#/${n.r}" data-nav="${n.r}">${n.l}${n.r === "admin" ? badge : ""}</a>`).join("")}</nav>
        <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menu">☰</button>
      </header>
      ${s.test_mode ? '<div class="test-banner">TEST MODE — sample data may be visible. (Admin can switch this off in Settings.)</div>' : ""}
      ${s.announcement ? `<div class="announce">${esc(s.announcement)}</div>` : ""}
      <main id="view"></main>
      <nav class="bottomnav">
        <a href="#/home" data-nav="home"><span class="ico">🏠</span>Home</a>
        <a href="#/leaderboard" data-nav="leaderboard"><span class="ico">🏆</span>Board</a>
        ${App.isAdmin()
          ? `<a href="#/admin/approvals" class="plus" data-nav="admin"><span class="ico">✔</span>Approve${badge}</a>
             <a href="#/winners" data-nav="winners"><span class="ico">🎖️</span>Winners</a>`
          : `<a href="#/submit" class="plus" data-nav="submit"><span class="ico">+</span>Submit</a>
             <a href="#/me" data-nav="me"><span class="ico">📊</span>My Stats</a>`}
        <button id="more-btn" type="button"><span class="ico">☰</span>More</button>
      </nav>`;
    const openDrawer = () => {
      const bd = document.createElement("div");
      bd.className = "drawer-backdrop";
      const dr = document.createElement("div");
      dr.className = "drawer";
      const cur = (location.hash.replace(/^#\//, "").split("/")[0]) || "home";
      dr.innerHTML = `<div class="who row">${App.avatar(App.profile.avatar_url, App.profile.full_name)}<div><b>${esc(App.profile.full_name)}</b><div class="small muted">@${esc(App.profile.username)}</div></div></div>
        ${items.map((n) => `<a href="#/${n.r}" class="${cur === n.r ? "active" : ""}"><span>${n.i}</span>${n.l}${n.r === "admin" ? badge : ""}</a>`).join("")}
        <a href="#" id="drawer-logout"><span>🚪</span>Logout</a>`;
      const close = () => { bd.remove(); dr.remove(); };
      bd.onclick = close;
      dr.addEventListener("click", (e) => { if (e.target.closest("a")) setTimeout(close, 0); });
      document.body.append(bd, dr);
      dr.querySelector("#drawer-logout").onclick = (e) => { e.preventDefault(); App.logout(); };
      App.refreshPendingCount();
    };
    App.$("#menu-btn").onclick = openDrawer;
    App.$("#more-btn").onclick = openDrawer;
  }

  App.render = async () => {
    if (!App.configured) return renderNotConfigured();
    if (!App.session || !App.profile) return renderLogin();
    if (!App.$("#view")) renderShell();
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    let name = parts[0] || "home";
    if (!App.routes[name]) name = "home";
    const route = App.routes[name];
    if (route.opts.admin && !App.isAdmin()) { App.go("#/home"); return; }
    if (route.opts.member && App.isAdmin()) { App.go("#/admin"); return; }
    App.$$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
    const view = App.$("#view");
    view.innerHTML = App.loadingHTML;
    const token = (App._renderToken = (App._renderToken || 0) + 1);
    try {
      await route.fn(view, parts.slice(1), token);
    } catch (e) {
      console.error(e);
      if (token === App._renderToken) view.innerHTML = `<div class="notice bad">${esc(App.errMsg(e))}</div><button class="btn ghost" onclick="App.render()">Try again</button>`;
    }
    App.refreshPendingCount();
  };
  App.stale = (token) => token !== App._renderToken;

  // ------------------------------------------------------------------
  // Login / logout
  // ------------------------------------------------------------------
  function renderNotConfigured() {
    document.getElementById("app").innerHTML = `<div class="login-page"><div class="login-box card">
      <div class="login-logos"><img src="assets/igniter-logo.png" alt="IGNITER"><img class="gpbo" src="assets/gpbo-logo.png" alt="GPBO"></div>
      <h2>Almost ready!</h2>
      <p>The website is not connected to Supabase yet.</p>
      <p>Open the file <b>js/config.js</b> and paste your <b>Project URL</b> and <b>anon public key</b>. (See the setup guide, Step 10–11.)</p>
      ${typeof window.supabase === "undefined" ? '<div class="notice bad">The Supabase library could not load. Check your internet connection.</div>' : ""}
    </div></div>`;
  }

  function renderLogin(message) {
    document.getElementById("app").innerHTML = `
      <div class="login-page"><div class="login-box">
        <div class="login-logos"><img src="assets/igniter-logo.png" alt="IGNITER Ahmedabad"><img class="gpbo" src="assets/gpbo-logo.png" alt="Sardardham GPBO Network"></div>
        <div class="league-title"><div class="l1">IGNITER</div><div class="l2">BUSINESS &amp; P2P LEAGUE</div>
          <div class="tagline">CONNECT MORE • REFER MORE • SUPPORT MORE • GROW TOGETHER</div></div>
        <form class="card" id="login-form" autocomplete="on">
          ${message ? `<div class="notice bad">${esc(message)}</div>` : ""}
          <label class="f"><span>Username</span>
            <input type="text" id="lg-user" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="e.g. jaydeep.patel" required></label>
          <label class="f"><span>Password</span>
            <div class="pw-wrap"><input type="password" id="lg-pass" name="password" autocomplete="current-password" required>
            <button type="button" class="icon-btn" id="lg-eye" aria-label="Show password">👁</button></div></label>
          <div id="lg-err" class="notice bad hidden"></div>
          <button class="btn block lg" id="lg-btn" type="submit">Login</button>
          <p class="small muted center mt">Forgot password? Please contact the League Admin.<br>Admin uses the same login screen.</p>
        </form>
      </div></div>`;
    App.$("#lg-eye").onclick = () => { const p = App.$("#lg-pass"); p.type = p.type === "password" ? "text" : "password"; };
    App.$("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = App.$("#lg-btn"), err = App.$("#lg-err");
      err.classList.add("hidden");
      let u = App.$("#lg-user").value.trim().toLowerCase().replace(/\s+/g, "");
      const p = App.$("#lg-pass").value;
      if (!u || !p) return;
      const email = u.includes("@") ? u : `${u}@${C.LOGIN_EMAIL_DOMAIN}`;
      btn.disabled = true; btn.textContent = "Logging in…";
      try {
        const { data, error } = await App.sb.auth.signInWithPassword({ email, password: p });
        if (error) throw error;
        App.session = data.session;
        await afterLogin();
      } catch (ex) {
        err.textContent = App.errMsg(ex);
        err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Login";
      }
    };
  }

  async function afterLogin() {
    const uid = App.session.user.id;
    const prof = await App.q(App.sb.from("profiles").select("*").eq("id", uid).maybeSingle());
    if (!prof) { await App.sb.auth.signOut(); App.session = null; return renderLogin("Your profile was not found. Please contact the League Admin."); }
    if (!prof.is_active) { await App.sb.auth.signOut(); App.session = null; return renderLogin("Your account is disabled. Please contact the League Admin."); }
    App.profile = prof;
    await App.loadBase();
    if (!location.hash || location.hash === "#/" || location.hash === "#/login") location.hash = "#/home";
    App.$("#view") && App.$("#view").remove();
    renderShell();
    App.render();
  }

  App.reloadProfile = async () => {
    App.profile = await App.q(App.sb.from("profiles").select("*").eq("id", App.session.user.id).single());
  };

  App.logout = async () => {
    try { await App.sb.auth.signOut(); } catch (_) { /* ignore */ }
    App.session = null; App.profile = null;
    location.hash = "#/login";
    renderLogin();
  };

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  App.start = async () => {
    if (!App.configured) return renderNotConfigured();
    if (window.__MOCK_SUPABASE__) App.sb = window.__MOCK_SUPABASE__;
    else {
      if (typeof window.supabase === "undefined") return renderNotConfigured();
      App.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
    }
    window.addEventListener("hashchange", () => App.render());
    App.sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { App.session = null; App.profile = null; }
      else if (session) App.session = session;
    });
    try {
      const { data } = await App.sb.auth.getSession();
      App.session = data && data.session;
      if (App.session) await afterLogin(); else renderLogin();
    } catch (e) {
      console.error(e);
      renderLogin(App.errMsg(e));
    }
  };
})();
