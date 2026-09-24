/* =====================================================================
   IGNITER LEAGUE — ADMIN PANEL
   Only visible to users whose profile role = 'admin'.
   (Security is enforced by the database, not by hiding buttons.)
   ===================================================================== */
(function () {
  "use strict";
  const App = window.App;
  const esc = App.esc;

  const SECTIONS = [
    { k: "overview", l: "📋 Overview" },
    { k: "members", l: "👥 Members" },
    { k: "approvals", l: "🔴 Pending Approvals", badge: true },
    { k: "p2p", l: "🤝 P2P Approvals" },
    { k: "business", l: "💼 Business" },
    { k: "references", l: "📤 References" },
    { k: "newmember", l: "🌱 New Member Conn." },
    { k: "visitors", l: "🙋 Visitors" },
    { k: "attendance", l: "✅ Attendance" },
    { k: "activities", l: "🏭 Activities" },
    { k: "challenges", l: "⚡ Special Challenges" },
    { k: "weekly", l: "🎖️ Weekly Winners" },
    { k: "awards", l: "🏁 Final Awards & Prizes" },
    { k: "leaderboard", l: "🏆 Leaderboard" },
    { k: "reports", l: "⬇ Reports / Export" },
    { k: "audit", l: "🕘 Audit Log" },
    { k: "settings", l: "⚙️ Settings" },
  ];
  const ACTIVITY_TYPES = ["Workshop", "Factory Visit", "Mega Visitors Day", "Joint Meeting", "Business Exhibition", "KMB", "Training", "Member Orientation", "Social Activity", "Sports Activity", "Other"];
  const AWARD_SUGGESTIONS = ["P2P Champion", "Business Champion", "Reference Champion", "Best Visitor Generator", "New Member Connector", "Most Consistent Member", "Most Active Member", "Best Supporter", "Most Improved Member"];
  const SAMPLE_MEMBERS = [
    { full_name: "Jaydeep Patel", group_name: "Sample Group A" },
    { full_name: "Milan Bhesaniya", group_name: "Sample Group A" },
    { full_name: "Lata Radadiya", group_name: "Sample Group B" },
    { full_name: "Rahul Patel", group_name: "Sample Group B" },
    { full_name: "Priya Shah", group_name: "Sample Group A" },
    { full_name: "Kunal Mehta", group_name: "Sample Group B" },
    { full_name: "Nidhi Desai", group_name: "Sample Group A", is_new_member: true },
    { full_name: "Harsh Vora", group_name: "Sample Group B", is_new_member: true },
  ];

  // All profiles (admin can read everything) -> App.profileMap
  async function loadProfiles() {
    const list = await App.q(App.sb.from("profiles").select("*").order("full_name", { ascending: true }));
    App.profiles = list;
    App.profileMap = {};
    list.forEach((p) => (App.profileMap[p.id] = p));
    return list;
  }
  const pName = (id) => (id && App.profileMap && App.profileMap[id] ? App.profileMap[id].full_name : id ? "(deleted member)" : "—");
  const memberProfiles = () => (App.profiles || []).filter((p) => p.role === "member");
  const memberSelect = (id, selected, opts) => `<select id="${id}">${(opts && opts.blank) ? `<option value="">${opts.blank}</option>` : ""}${memberProfiles().map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.full_name)}${p.is_active ? "" : " (disabled)"}${p.is_sample ? " [sample]" : ""}</option>`).join("")}</select>`;

  // ------------------------------------------------------------------
  // Admin shell
  // ------------------------------------------------------------------
  App.route("admin", async (el, parts, token) => {
    const sec = SECTIONS.find((s) => s.k === parts[0]) ? parts[0] : "overview";
    el.innerHTML = `<div class="admin-layout">
      <nav class="admin-menu no-print">${SECTIONS.map((s) => `<a href="#/admin/${s.k}" class="${s.k === sec ? "active" : ""}">${s.l}${s.badge ? ' <span class="badge hidden" data-pending-badge>0</span>' : ""}</a>`).join("")}</nav>
      <div id="admin-main">${App.loadingHTML}</div></div>`;
    const active = App.$(".admin-menu a.active", el);
    if (active && window.innerWidth < 1000) active.scrollIntoView({ block: "nearest", inline: "center" });
    await Promise.all([loadProfiles(), App.loadBase()]);
    if (App.stale(token)) return;
    const main = App.$("#admin-main", el);
    await ADMIN[sec](main, parts.slice(1), token);
  }, { admin: true });

  const reloadSection = () => App.render();

  const ADMIN = {};

  // ==================================================================
  // 1. OVERVIEW
  // ==================================================================
  ADMIN.overview = async (el) => {
    const s = App.settings;
    const [pend, stats] = await Promise.all([
      App.q(App.sb.from("transactions").select("category").eq("status", "pending")),
      App.rpc("get_home_stats"),
    ]);
    const byCat = {};
    pend.forEach((p) => (byCat[p.category] = (byCat[p.category] || 0) + 1));
    const members = memberProfiles();
    const samples = members.filter((m) => m.is_sample).length;
    el.innerHTML = `
      <div class="card-title"><h2>Admin Overview</h2></div>
      <a class="card" href="#/admin/approvals" style="display:block;text-decoration:none;color:inherit;border-left:5px solid ${pend.length ? "var(--red)" : "var(--green)"}">
        <h2 style="margin:0">${pend.length ? "🔴" : "🟢"} Pending Approvals: ${pend.length}</h2>
        <div class="small muted">${Object.keys(byCat).map((c) => `${esc(App.catLabel(c))}: ${byCat[c]}`).join(" · ") || "Nothing waiting. 👍"}</div></a>
      <div class="card">
        <div class="card-title"><h3>League status</h3><span class="tag ${s.status === "running" ? "approved" : s.status === "ended" ? "gray" : "pending"}">${s.finalized ? "FINALIZED" : s.status.replace("_", " ").toUpperCase()}</span></div>
        <p class="small">League dates: <b>${App.fmtDate(s.start_date)} – ${App.fmtDate(s.end_date)}</b> · Current week: <b>${stats.current_week || "—"}</b> · Days remaining: <b>${stats.days_remaining}</b></p>
        <div class="row">
          ${s.status !== "running" && !s.finalized ? '<button class="btn green" id="ov-start">▶ Start League (open submissions)</button>' : ""}
          ${s.status === "running" ? '<button class="btn red" id="ov-end">■ End League (close submissions)</button>' : ""}
          <a class="btn ghost" href="#/admin/settings">⚙️ Dates & Settings</a>
        </div>
        ${s.test_mode ? '<div class="notice warn mt">TEST MODE is ON (a yellow banner is shown to everyone). Switch it off in Settings when you go live.</div>' : ""}
        ${samples ? `<div class="notice warn mt">There are <b>${samples}</b> SAMPLE members. Delete them before the real league starts (Members → “Delete all sample members”).</div>` : ""}
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Active Members</div><div class="v">${stats.total_members}</div></div>
        <div class="stat"><div class="k">Approved P2Ps</div><div class="v">${stats.total_p2p}</div></div>
        <div class="stat"><div class="k">References Given</div><div class="v">${stats.total_references}</div></div>
        <div class="stat"><div class="k">Business Given</div><div class="v">${App.fmtINR(stats.total_business)}</div></div>
        <div class="stat"><div class="k">Visitors</div><div class="v">${stats.total_visitors}</div></div>
        <div class="stat"><div class="k">Inductions</div><div class="v">${stats.total_inductions}</div></div>
        <div class="stat"><div class="k">Disabled Members</div><div class="v">${members.filter((m) => !m.is_active).length}</div></div>
        <div class="stat"><div class="k">Sample Members</div><div class="v">${samples}</div></div>
      </div>
      <div class="card"><h3>🔧 Setup check</h3>
        <p class="small muted">Checks that the secure “admin-users” Edge Function (used to create logins and reset passwords) is installed.</p>
        <button class="btn ghost" id="ov-ping">Run setup check</button> <span id="ov-ping-res" class="small"></span></div>`;
    const setStatus = async (status, msg) => {
      if (!(await App.confirm(msg))) return;
      try { await App.q(App.sb.from("league_settings").update({ status, updated_at: new Date().toISOString() }).eq("id", 1)); App.toast("League status updated.", "good"); reloadSection(); }
      catch (e) { App.toast(App.errMsg(e), "bad"); }
    };
    const st = App.$("#ov-start", el), en = App.$("#ov-end", el);
    if (st) st.onclick = () => setStatus("running", "Start the league now? Members will be able to submit activities.");
    if (en) en.onclick = () => setStatus("ended", "End the league? Members will NOT be able to submit anything new. You can still approve pending entries.");
    App.$("#ov-ping", el).onclick = async () => {
      const r = App.$("#ov-ping-res", el);
      r.textContent = "Checking…";
      try { await App.adminFn("ping"); r.innerHTML = '<b style="color:var(--green)">✔ Edge Function is working.</b>'; }
      catch (e) { r.innerHTML = `<b style="color:var(--red)">✖ ${esc(App.errMsg(e))}</b>`; }
    };
  };

  // ==================================================================
  // 2. MEMBERS
  // ==================================================================
  const siteURL = () => location.origin + location.pathname.replace(/index\.html$/, "");
  const credMessage = (c) => `Hello ${c.full_name},\n\nYour login for the IGNITER BUSINESS & P2P LEAGUE:\n\nWebsite: ${siteURL()}\nUsername: ${c.username}\nPassword: ${c.password}\n\nPlease change your password after logging in (Profile → Change Password).`;
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); App.toast("Copied ✔", "good"); }
    catch (_) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); App.toast("Copied ✔", "good"); } catch (e) { App.toast("Could not copy. Please copy manually.", "bad"); }
      ta.remove();
    }
  };

  function showCredentials(creds) {
    const ok = creds.filter((c) => c.password);
    const bad = creds.filter((c) => !c.password || c.error);
    const div = document.createElement("div");
    div.innerHTML = `
      ${ok.length ? `<div class="notice warn"><b>IMPORTANT:</b> These passwords are shown <b>only once</b> and are not stored anywhere. Click <b>Download credentials (CSV)</b> now and keep the file private.</div>` : ""}
      ${bad.length ? `<div class="notice bad"><b>${bad.length} problem(s):</b><br>${bad.map((b) => `${esc(b.full_name)}${b.username ? " (" + esc(b.username) + ")" : ""}: ${esc(b.error || "")}`).join("<br>")}</div>` : ""}
      ${ok.length ? `<div class="table-wrap"><table class="rt cred-table"><thead><tr><th>Name</th><th>Username</th><th>Password</th><th></th></tr></thead><tbody>
        ${ok.map((c, i) => `<tr><td data-label="Name">${esc(c.full_name)}</td><td data-label="Username"><b>${esc(c.username)}</b></td><td data-label="Password"><b>${esc(c.password)}</b></td>
          <td class="no-label nowrap"><button class="btn ghost sm" data-copy="${i}">Copy message</button> <a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(credMessage(c))}">WhatsApp</a></td></tr>`).join("")}
      </tbody></table></div>` : ""}`;
    App.$$("[data-copy]", div).forEach((b) => (b.onclick = () => copyText(credMessage(ok[Number(b.dataset.copy)]))));
    const actions = [{ label: "Close", cls: "ghost", value: null }];
    if (ok.length) actions.unshift({ label: "⬇ Download credentials (CSV)", cls: "green", value: "dl" });
    return App.modal({
      title: `Login credentials (${ok.length})`, wide: true, sticky: true, body: div, actions,
      onAction: (v) => {
        if (v === "dl") {
          App.downloadCSV(`igniter-credentials-${App.todayISO()}.csv`, ok, [{ k: "full_name", l: "Name" }, { k: "username", l: "Username" }, { k: "password", l: "Temporary Password" }, { k: "x", l: "Website", f: () => siteURL() }]);
          return false;
        }
        return true;
      },
    });
  }

  async function createMembers(list) {
    const results = [];
    for (let i = 0; i < list.length; i += 15) {
      App.toast(`Creating accounts ${i + 1}–${Math.min(i + 15, list.length)} of ${list.length}…`);
      const r = await App.adminFn("create_members", { members: list.slice(i, i + 15) });
      results.push(...(r.results || []));
    }
    return results;
  }

  function memberFormHTML(p) {
    p = p || {};
    return `<div class="form-grid two">
      <label class="f"><span>Full name <em>*</em></span><input type="text" id="m-name" value="${esc(p.full_name || "")}"></label>
      <label class="f"><span>Username</span><input type="text" id="m-user" value="${esc(p.username || "")}" autocapitalize="none" placeholder="auto: firstname.lastname"><small>${p.id ? "Changing it changes the member's login name." : "Leave blank to create automatically."}</small></label>
      <label class="f"><span>Email</span><input type="email" id="m-email" value="${esc(p.email || "")}"></label>
      <label class="f"><span>Phone</span><input type="tel" id="m-phone" value="${esc(p.phone || "")}"></label>
      <label class="f"><span>Group</span><input type="text" id="m-group" value="${esc(p.group_name || "")}"></label>
      <label class="f"><span>Induction date</span><input type="date" id="m-ind" value="${esc(p.induction_date || "")}"></label>
    </div>
    <label class="check"><input type="checkbox" id="m-new" ${p.is_new_member ? "checked" : ""}> New / recently inducted member (others can log “New Member Connection” with them)</label>
    <label class="check"><input type="checkbox" id="m-sample" ${p.is_sample ? "checked" : ""}> Sample / test member</label>`;
  }
  const readMemberForm = (w) => ({
    full_name: App.$("#m-name", w).value.trim().replace(/\s+/g, " "),
    username: App.$("#m-user", w).value.trim().toLowerCase(),
    email: App.$("#m-email", w).value.trim() || null,
    phone: App.$("#m-phone", w).value.trim() || null,
    group_name: App.$("#m-group", w).value.trim() || null,
    induction_date: App.$("#m-ind", w).value || null,
    is_new_member: App.$("#m-new", w).checked,
    is_sample: App.$("#m-sample", w).checked,
  });

  ADMIN.members = async (el) => {
    let search = "";
    el.innerHTML = `
      <div class="card-title"><h2>👥 Members</h2>
        <div class="row"><button class="btn green sm" id="mb-add">＋ Add member</button><button class="btn sm" id="mb-import">⬆ Import members CSV</button>
        <button class="btn ghost sm" id="mb-export">⬇ Export CSV</button></div></div>
      <div class="row mb"><input type="search" class="grow" id="mb-search" placeholder="🔍 Search name, username, group…" style="max-width:360px">
        <button class="btn ghost sm" id="mb-sample">Create sample members</button><button class="btn ghost sm red-text" id="mb-del-sample">Delete all sample members</button></div>
      <div id="mb-list"></div>`;
    const draw = () => {
      const s = search.toLowerCase();
      const list = App.profiles.filter((p) => !s || [p.full_name, p.username, p.group_name, p.phone, p.email].join(" ").toLowerCase().includes(s));
      App.$("#mb-list", el).innerHTML = `<p class="small muted">${list.length} of ${App.profiles.length} logins</p>
        <table class="rt"><thead><tr><th>Name</th><th>Username</th><th>Group</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${list.map((p) => `<tr>
          <td data-label="Name"><b>${esc(p.full_name)}</b>${App.sampleTag(p.is_sample)}${p.role === "admin" ? ' <span class="tag info">ADMIN</span>' : ""}${p.is_new_member ? ' <span class="tag approved">NEW</span>' : ""}</td>
          <td data-label="Username">${esc(p.username)}</td>
          <td data-label="Group">${esc(p.group_name || "—")}</td>
          <td data-label="Phone">${esc(p.phone || "—")}</td>
          <td data-label="Status">${p.is_active ? '<span class="tag approved">ACTIVE</span>' : '<span class="tag rejected">DISABLED</span>'}</td>
          <td data-label="" class="no-label">${p.role === "admin" ? '<span class="small muted">—</span>' : `<div class="row">
            <button class="btn ghost sm" data-edit="${p.id}">Edit</button>
            <button class="btn ghost sm" data-reset="${p.id}">Reset password</button>
            <button class="btn ghost sm ${p.is_active ? "red-text" : ""}" data-active="${p.id}">${p.is_active ? "Disable" : "Enable"}</button>
            <button class="btn ghost sm red-text" data-del="${p.id}">Delete</button></div>`}</td>
        </tr>`).join("")}</tbody></table>`;
      App.$$("[data-edit]", el).forEach((b) => (b.onclick = () => editMember(App.profileMap[b.dataset.edit])));
      App.$$("[data-reset]", el).forEach((b) => (b.onclick = async () => {
        const p = App.profileMap[b.dataset.reset];
        if (!(await App.confirm(`Create a NEW temporary password for <b>${esc(p.full_name)}</b>? The old password will stop working.`))) return;
        try { const r = await App.adminFn("reset_password", { user_id: p.id }); showCredentials([r]); } catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
      App.$$("[data-active]", el).forEach((b) => (b.onclick = async () => {
        const p = App.profileMap[b.dataset.active];
        const to = !p.is_active;
        if (!(await App.confirm(to ? `Enable <b>${esc(p.full_name)}</b>? They can log in again and appear on the leaderboard.` : `Disable <b>${esc(p.full_name)}</b>? They cannot log in and are hidden from the leaderboard. Their data is kept.`, { danger: !to }))) return;
        try { await App.adminFn("set_active", { user_id: p.id, active: to }); App.toast("Updated ✔", "good"); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
      App.$$("[data-del]", el).forEach((b) => (b.onclick = async () => {
        const p = App.profileMap[b.dataset.del];
        const typed = await App.prompt({ title: "Delete member permanently", message: `This deletes <b>${esc(p.full_name)}</b>'s login AND all their submissions and points. This cannot be undone. (To just block them, use Disable instead.)`, label: "Type DELETE to confirm", ok: "Delete", danger: true });
        if (typed !== "DELETE") { if (typed !== null) App.toast("Not deleted (you did not type DELETE).", "bad"); return; }
        try { await App.adminFn("delete_member", { user_id: p.id }); App.toast("Member deleted.", "good"); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
    };
    App.$("#mb-search", el).oninput = (e) => { search = e.target.value; draw(); };
    draw();

    App.$("#mb-add", el).onclick = async () => {
      let created = null;
      await App.modal({
        title: "Add member", body: memberFormHTML({}), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Create login", cls: "green", value: "ok" }],
        onAction: async (v, w) => {
          const m = readMemberForm(w);
          if (!m.full_name) { App.toast("Please enter the name.", "bad"); return false; }
          created = await createMembers([m]);
          return true;
        },
      });
      if (created) { await showCredentials(created); reloadSection(); }
    };

    App.$("#mb-sample", el).onclick = async () => {
      if (!(await App.confirm(`Create ${SAMPLE_MEMBERS.length} SAMPLE members for testing? Their usernames start with <b>sample.</b> and they are clearly marked SAMPLE. You can delete them all later with one click.`))) return;
      try { const r = await createMembers(SAMPLE_MEMBERS.map((m) => Object.assign({ is_sample: true }, m))); await showCredentials(r); reloadSection(); }
      catch (e) { App.toast(App.errMsg(e), "bad"); }
    };
    App.$("#mb-del-sample", el).onclick = async () => {
      const n = App.profiles.filter((p) => p.is_sample).length;
      if (!n) return App.toast("There are no sample members.");
      if (!(await App.confirm(`Delete all <b>${n}</b> sample members and ALL their submissions/points?`, { danger: true, ok: "Delete samples" }))) return;
      try { const r = await App.adminFn("delete_sample_members"); App.toast(`Deleted ${r.deleted} sample members.`, "good"); if (r.errors && r.errors.length) App.toast(r.errors.join("; "), "bad"); reloadSection(); }
      catch (e) { App.toast(App.errMsg(e), "bad"); }
    };
    App.$("#mb-export", el).onclick = () => App.downloadCSV(`members-${App.todayISO()}.csv`, App.profiles, [
      { k: "full_name", l: "Name" }, { k: "username", l: "Username" }, { k: "email", l: "Email" }, { k: "phone", l: "Phone" },
      { k: "group_name", l: "Group" }, { k: "induction_date", l: "Induction Date" }, { k: "is_active", l: "Active", f: (r) => (r.is_active ? "Yes" : "No") },
      { k: "is_new_member", l: "New Member", f: (r) => (r.is_new_member ? "Yes" : "No") }, { k: "role", l: "Role" }, { k: "is_sample", l: "Sample", f: (r) => (r.is_sample ? "Yes" : "No") },
    ]);
    App.$("#mb-import", el).onclick = importMembers;
  };

  async function editMember(p) {
    await App.modal({
      title: "Edit member", body: memberFormHTML(p), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save", value: "ok" }],
      onAction: async (v, w) => {
        const m = readMemberForm(w);
        if (!m.full_name) { App.toast("Please enter the name.", "bad"); return false; }
        if (m.username && m.username !== p.username) await App.adminFn("change_username", { user_id: p.id, username: m.username });
        await App.q(App.sb.from("profiles").update({
          full_name: m.full_name, email: m.email, phone: m.phone, group_name: m.group_name,
          induction_date: m.induction_date, is_new_member: m.is_new_member, is_sample: m.is_sample,
        }).eq("id", p.id));
        App.toast("Saved ✔", "good");
        reloadSection();
        return true;
      },
    });
  }

  function importMembers() {
    const div = document.createElement("div");
    div.innerHTML = `
      <p>Upload a <b>.csv</b> file with these column headings (first row):</p>
      <p><code>Name, Username, Email, Phone, Group, Induction Date, Active, New Member</code></p>
      <p class="small muted">Only <b>Name</b> is required. Leave Username blank to create it automatically (firstname.lastname). Dates as DD/MM/YYYY or YYYY-MM-DD. Active / New Member: Yes or No.
      In Excel: File → Save As → “CSV UTF-8 (Comma delimited)”.</p>
      <p><button class="btn ghost sm" id="imp-tpl" type="button">⬇ Download template</button></p>
      <label class="f"><span>Choose CSV file</span><input type="file" id="imp-file" accept=".csv,text/csv"></label>
      <div id="imp-preview"></div>`;
    let rows = [];
    App.$("#imp-tpl", div).onclick = () => App.downloadCSV("members-template.csv", [{ Name: "Jaydeep Patel", Username: "", Email: "", Phone: "9876543210", Group: "", "Induction Date": "", Active: "Yes", "New Member": "No" }]);
    App.$("#imp-file", div).onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const text = await f.text();
      const grid = App.parseCSV(text);
      const prev = App.$("#imp-preview", div);
      if (grid.length < 2) { prev.innerHTML = '<div class="notice bad">The file seems empty.</div>'; return; }
      const head = grid[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
      const col = (...names) => head.findIndex((h) => names.includes(h));
      const ci = { name: col("name", "membername", "fullname"), user: col("username", "user"), email: col("email", "emailid"), phone: col("phone", "mobile", "phonenumber", "mobilenumber"),
        group: col("group", "groupname"), ind: col("inductiondate", "induction"), active: col("active", "status"), isnew: col("newmember", "new") };
      if (ci.name < 0) { prev.innerHTML = '<div class="notice bad">Could not find a “Name” column in the first row.</div>'; return; }
      const g = (r, i) => (i >= 0 ? String(r[i] || "").trim() : "");
      const existing = new Set(App.profiles.filter((p) => !p.is_sample).map((p) => p.full_name.toLowerCase()));
      rows = grid.slice(1).map((r) => ({
        full_name: g(r, ci.name).replace(/\s+/g, " "), username: g(r, ci.user).toLowerCase(), email: g(r, ci.email), phone: g(r, ci.phone),
        group_name: g(r, ci.group), induction_date: g(r, ci.ind), is_active: g(r, ci.active) || "yes", is_new_member: g(r, ci.isnew) || "no",
      })).filter((r) => r.full_name);
      prev.innerHTML = App.loadingHTML;
      let names = [];
      try { names = (await App.adminFn("preview_usernames", { members: rows })).usernames; }
      catch (ex) { prev.innerHTML = `<div class="notice bad">${esc(App.errMsg(ex))}</div>`; return; }
      rows.forEach((r, i) => (r.username = names[i]));
      const dup = rows.filter((r) => existing.has(r.full_name.toLowerCase())).length;
      prev.innerHTML = `<div class="notice good"><b>${rows.length}</b> members found. Check the usernames below, then click <b>Create accounts</b>.</div>
        ${dup ? `<div class="notice warn">${dup} name(s) already exist in the system. They will be created AGAIN as separate logins (with a number added). Remove them from the file if they are duplicates.</div>` : ""}
        <div class="table-wrap" style="max-height:40vh"><table class="rt"><thead><tr><th>#</th><th>Name</th><th>Username</th><th>Group</th><th>Phone</th><th>Active</th><th>New</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td data-label="#">${i + 1}</td><td data-label="Name">${esc(r.full_name)}${existing.has(r.full_name.toLowerCase()) ? ' <span class="tag pending">EXISTS</span>' : ""}</td><td data-label="Username"><b>${esc(r.username)}</b></td><td data-label="Group">${esc(r.group_name)}</td><td data-label="Phone">${esc(r.phone)}</td><td data-label="Active">${esc(r.is_active)}</td><td data-label="New">${esc(r.is_new_member)}</td></tr>`).join("")}
        </tbody></table></div>`;
    };
    let results = null;
    App.modal({
      title: "Import members from CSV", wide: true, body: div,
      actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Create accounts", cls: "green", value: "go" }],
      onAction: async () => {
        if (!rows.length) { App.toast("Please choose a CSV file first.", "bad"); return false; }
        if (!(await App.confirm(`Create <b>${rows.length}</b> member logins now?`))) return false;
        results = await createMembers(rows);
        return true;
      },
    }).then(async () => { if (results) { await showCredentials(results); reloadSection(); } });
  }

  // ==================================================================
  // 3–7. TRANSACTION LISTS (approvals, P2P, business, references…)
  // ==================================================================
  const MEMBER_CATS = ["p2p", "new_member", "ref_given", "ref_received", "biz_given", "biz_received", "visitor", "challenge"];

  async function txnSection(el, cfg) {
    const st = { status: cfg.status, cat: "", search: "" };
    el.innerHTML = `
      <div class="card-title"><h2>${cfg.title}</h2><div class="row">
        ${cfg.allowAdd ? '<button class="btn green sm" id="tx-add">＋ Add entry for a member</button>' : ""}
        <button class="btn ghost sm" id="tx-csv">⬇ Export CSV</button><button class="btn ghost sm" id="tx-ref">↻ Refresh</button></div></div>
      ${cfg.help ? `<div class="notice small">${cfg.help}</div>` : ""}
      <div class="lb-controls">
        <div class="chips" id="tx-status">${["pending", "approved", "rejected", ""].map((s) => `<button class="chip" data-s="${s}">${s ? s[0].toUpperCase() + s.slice(1) : "All"}</button>`).join("")}</div>
        ${cfg.cats.length > 1 ? `<select id="tx-cat" style="max-width:240px"><option value="">All types</option>${cfg.cats.map((c) => `<option value="${c}">${esc(App.catLabel(c))}</option>`).join("")}</select>` : ""}
        <input type="search" class="grow" id="tx-search" placeholder="🔍 Search member / text…">
      </div>
      <div id="tx-list">${App.loadingHTML}</div>`;
    let data = [], visitors = {}, challenges = {}, urls = {};

    const load = async () => {
      App.$("#tx-list", el).innerHTML = App.loadingHTML;
      let q = App.sb.from("v_transactions").select("*").in("category", st.cat ? [st.cat] : cfg.cats);
      if (st.status) q = q.eq("status", st.status);
      q = q.order("created_at", { ascending: st.status === "pending" }).limit(1000);
      data = await App.q(q);
      const vids = data.map((t) => t.visitor_id).filter(Boolean);
      visitors = {};
      if (vids.length) (await App.q(App.sb.from("visitors").select("*").in("id", vids))).forEach((v) => (visitors[v.id] = v));
      challenges = {};
      if (data.some((t) => t.challenge_id)) (await App.q(App.sb.from("special_challenges").select("id,name,points"))).forEach((c) => (challenges[c.id] = c));
      urls = await App.signedUrls(data.slice(0, 200).map((t) => t.photo_path));
      draw();
    };

    const draw = () => {
      App.$$("#tx-status .chip", el).forEach((c) => c.classList.toggle("active", c.dataset.s === st.status));
      const s = st.search.toLowerCase();
      const list = data.filter((t) => !s || [pName(t.member_id), pName(t.partner_id), t.description, t.notes, t.customer_name, visitors[t.visitor_id] && visitors[t.visitor_id].visitor_name].join(" ").toLowerCase().includes(s));
      App.$("#tx-list", el).innerHTML = `<p class="small muted">${list.length} entr${list.length === 1 ? "y" : "ies"}</p>` + (list.length ? list.map((t) => {
        const v = visitors[t.visitor_id], ch = challenges[t.challenge_id];
        const locked = t.week_no && (App.weeks.find((w) => w.week_no === t.week_no) || {}).locked;
        return `<div class="item ${t.status === "pending" ? "appr" : ""}">
          <div class="item-head"><div><div class="t">${App.catIcon(t.category)} ${esc(App.catLabel(t.category))} ${App.statusTag(t.status)}</div>
            <div class="small muted">#${t.id} · submitted ${App.fmtDateTime(t.created_at)}</div></div>
            <div class="pts-badge" style="font-size:1.2rem">+${t.points}${t.points_override != null ? '<div class="small muted">manual</div>' : ""}</div></div>
          <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
          <div class="kv grow">
            <div>Member</div><div><b>${esc(pName(t.member_id))}</b></div>
            ${t.partner_id ? `<div>${/received/.test(t.category) ? "From" : "With / To"}</div><div><b>${esc(pName(t.partner_id))}</b></div>` : ""}
            <div>Date</div><div>${App.fmtDate(t.txn_date)} · ${t.week_no ? `Week ${t.week_no}${t.week_override ? " (manual)" : ""}${locked ? " 🔒" : ""}` : '<b style="color:var(--red)">⚠ Outside league weeks (0 pts) — edit to set a week</b>'}</div>
            ${t.amount != null && /^biz_/.test(t.category) ? `<div>Amount</div><div><b>${App.fmtINR(t.amount)}</b></div>` : ""}
            ${t.description ? `<div>${t.category === "p2p" ? "Summary" : "Details"}</div><div>${esc(t.description)}</div>` : ""}
            ${t.customer_name ? `<div>Customer</div><div>${esc(t.customer_name)}</div>` : ""}
            ${t.notes ? `<div>Notes</div><div>${esc(t.notes)}</div>` : ""}
            ${v ? `<div>Visitor</div><div><b>${esc(v.visitor_name)}</b>${v.company ? ", " + esc(v.company) : ""}<br>📞 ${esc(v.mobile)} ${v.business_category ? "· " + esc(v.business_category) : ""}<br>${v.event_name ? "Event: " + esc(v.event_name) : ""}</div>` : ""}
            ${ch ? `<div>Challenge</div><div>${esc(ch.name)} (+${ch.points})</div>` : ""}
            ${t.reviewed_at ? `<div>Reviewed</div><div>${esc(pName(t.reviewed_by))} · ${App.fmtDateTime(t.reviewed_at)}</div>` : ""}
            ${t.reject_reason ? `<div>Reason</div><div style="color:var(--red)">${esc(t.reject_reason)}</div>` : ""}
          </div>
          ${t.photo_path ? (urls[t.photo_path] ? `<img class="thumb" src="${esc(urls[t.photo_path])}" data-photo="${esc(t.photo_path)}" alt="P2P photo">` : `<button class="btn ghost sm" data-photo="${esc(t.photo_path)}">📷 View photo</button>`) : ""}
          </div>
          ${t.doc_path ? `<button class="btn ghost sm mt" data-photo="${esc(t.doc_path)}">📎 View document</button>` : ""}
          <div class="actions">
            ${t.status !== "approved" ? `<button class="btn green" data-approve="${t.id}">✔ APPROVE</button>` : ""}
            ${t.status !== "rejected" ? `<button class="btn red" data-reject="${t.id}">✖ REJECT</button>` : ""}
            <button class="btn ghost" data-edit="${t.id}">✎ Edit</button>
            <button class="btn ghost red-text" data-del="${t.id}">🗑 Delete</button>
          </div></div>`;
      }).join("") : '<div class="empty">Nothing here. 👍</div>');

      App.$$("[data-photo]", el).forEach((b) => (b.onclick = () => App.viewProof(b.dataset.photo, "Proof")));
      App.$$("[data-approve]", el).forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        try { await App.q(App.sb.from("transactions").update({ status: "approved" }).eq("id", Number(b.dataset.approve))); App.toast("Approved ✔", "good"); await load(); App.refreshPendingCount(); }
        catch (e) { b.disabled = false; App.toast(App.errMsg(e), "bad"); }
      }));
      App.$$("[data-reject]", el).forEach((b) => (b.onclick = async () => {
        const reason = await App.prompt({ title: "Reject submission", label: "Reason for rejection (the member will see this)", textarea: true, required: true, requiredMsg: "A rejection reason is required.", ok: "Reject", danger: true });
        if (!reason) return;
        try { await App.q(App.sb.from("transactions").update({ status: "rejected", reject_reason: reason }).eq("id", Number(b.dataset.reject))); App.toast("Rejected.", "good"); await load(); App.refreshPendingCount(); }
        catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
      App.$$("[data-edit]", el).forEach((b) => (b.onclick = () => editTxn(data.find((t) => t.id === Number(b.dataset.edit)), load)));
      App.$$("[data-del]", el).forEach((b) => (b.onclick = async () => {
        const t = data.find((x) => x.id === Number(b.dataset.del));
        if (!(await App.confirm(`Delete this ${esc(App.catLabel(t.category))} entry of <b>${esc(pName(t.member_id))}</b> permanently? (It stays in the audit log.)`, { danger: true, ok: "Delete" }))) return;
        try { await App.q(App.sb.from("transactions").delete().eq("id", t.id)); App.toast("Deleted.", "good"); await load(); App.refreshPendingCount(); }
        catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
    };

    App.$$("#tx-status .chip", el).forEach((c) => (c.onclick = () => { st.status = c.dataset.s; load().catch((e) => App.toast(App.errMsg(e), "bad")); }));
    const catSel = App.$("#tx-cat", el);
    if (catSel) catSel.onchange = () => { st.cat = catSel.value; load().catch((e) => App.toast(App.errMsg(e), "bad")); };
    App.$("#tx-search", el).oninput = (e) => { st.search = e.target.value; draw(); };
    App.$("#tx-ref", el).onclick = () => load().catch((e) => App.toast(App.errMsg(e), "bad"));
    App.$("#tx-csv", el).onclick = () => App.downloadCSV(`${cfg.file}-${App.todayISO()}.csv`, data, txnCsvCols(visitors));
    const add = App.$("#tx-add", el);
    if (add) add.onclick = () => addTxn(cfg.cats, load);
    await load();
  }

  const txnCsvCols = (visitors) => [
    { k: "id", l: "ID" }, { k: "txn_date", l: "Date" }, { k: "week_no", l: "Week" },
    { k: "member", l: "Member", f: (r) => pName(r.member_id) }, { k: "category", l: "Activity", f: (r) => App.catLabel(r.category) },
    { k: "partner", l: "Other Member", f: (r) => (r.partner_id ? pName(r.partner_id) : "") }, { k: "amount", l: "Amount (Rs)" },
    { k: "description", l: "Details" }, { k: "customer_name", l: "Customer" }, { k: "notes", l: "Notes" },
    { k: "visitor", l: "Visitor", f: (r) => (visitors && visitors[r.visitor_id] ? visitors[r.visitor_id].visitor_name : "") },
    { k: "points", l: "Points" }, { k: "status", l: "Status" }, { k: "reject_reason", l: "Reject Reason" },
    { k: "created_at", l: "Submitted At" }, { k: "reviewed", l: "Reviewed By", f: (r) => (r.reviewed_by ? pName(r.reviewed_by) : "") }, { k: "reviewed_at", l: "Reviewed At" },
    { k: "photo_path", l: "Has Photo", f: (r) => (r.photo_path ? "Yes" : "") },
  ];

  function txnFormHTML(t, cats, isNew) {
    t = t || {};
    const cat = t.category || cats[0];
    return `
      ${isNew ? `<label class="f"><span>Member (earns the points) <em>*</em></span>${memberSelect("e-member", t.member_id, { blank: "— Choose member —" })}</label>
        <label class="f"><span>Activity type</span><select id="e-cat">${cats.map((c) => `<option value="${c}" ${c === cat ? "selected" : ""}>${esc(App.catLabel(c))}</option>`).join("")}</select></label>`
        : `<p><b>${App.catIcon(t.category)} ${esc(App.catLabel(t.category))}</b> — ${esc(pName(t.member_id))}</p>`}
      <div class="form-grid two">
        <label class="f"><span>Date <em>*</em></span><input type="date" id="e-date" value="${esc(t.txn_date || App.todayISO())}"></label>
        <label class="f" id="e-partner-wrap"><span>Other member</span>${memberSelect("e-partner", t.partner_id, { blank: "— none —" })}</label>
        <label class="f" id="e-amount-wrap"><span>Amount (₹)</span><input type="number" id="e-amount" min="0" step="1" value="${t.amount != null ? esc(t.amount) : ""}"></label>
        <label class="f"><span>Customer / company</span><input type="text" id="e-customer" value="${esc(t.customer_name || "")}"></label>
      </div>
      <label class="f"><span>Details / summary</span><textarea id="e-desc">${esc(t.description || "")}</textarea></label>
      <label class="f"><span>Notes</span><input type="text" id="e-notes" value="${esc(t.notes || "")}"></label>
      <div class="form-grid two">
        <label class="f"><span>Week</span><select id="e-week"><option value="">Automatic (from date)</option>${App.weeks.map((w) => `<option value="${w.week_no}" ${t.week_override === w.week_no ? "selected" : ""}>Force Week ${w.week_no}</option>`).join("")}</select></label>
        <label class="f"><span>Points</span><input type="number" id="e-points" step="1" placeholder="Automatic" value="${t.points_override != null ? esc(t.points_override) : ""}"><small>Leave blank for automatic points. Only fill to override.</small></label>
      </div>
      ${isNew ? "" : `<label class="f"><span>Status</span><select id="e-status">${["pending", "approved", "rejected"].map((s) => `<option ${t.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="f"><span>Reject reason (required if rejected)</span><input type="text" id="e-reason" value="${esc(t.reject_reason || "")}"></label>`}`;
  }
  function readTxnForm(w) {
    const v = (id) => { const x = App.$("#" + id, w); return x ? x.value.trim() : ""; };
    const out = {
      txn_date: v("e-date"), partner_id: v("e-partner") || null, amount: v("e-amount") === "" ? null : Number(v("e-amount")),
      customer_name: v("e-customer") || null, description: v("e-desc") || null, notes: v("e-notes") || null,
      week_override: v("e-week") ? Number(v("e-week")) : null, points_override: v("e-points") === "" ? null : Number(v("e-points")),
    };
    if (!out.txn_date) throw new Error("Please choose a date.");
    return out;
  }
  function editTxn(t, reload) {
    App.modal({
      title: `Edit entry #${t.id}`, body: txnFormHTML(t, [t.category], false),
      actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save changes", value: "ok" }],
      onAction: async (v, w) => {
        const upd = readTxnForm(w);
        upd.status = App.$("#e-status", w).value;
        upd.reject_reason = App.$("#e-reason", w).value.trim() || null;
        if (upd.status === "rejected" && !upd.reject_reason) { App.toast("Please enter the reject reason.", "bad"); return false; }
        if (!/^biz_/.test(t.category)) upd.amount = t.amount;
        await App.q(App.sb.from("transactions").update(upd).eq("id", t.id));
        App.toast("Saved ✔", "good");
        await reload(); App.refreshPendingCount();
        return true;
      },
    });
  }
  function addTxn(cats, reload) {
    const allowed = cats.filter((c) => MEMBER_CATS.includes(c) && c !== "visitor" && c !== "challenge");
    if (!allowed.length) return;
    App.modal({
      title: "Add entry for a member", body: `<div class="notice small">Use this when a member cannot submit themselves. The entry is saved as <b>APPROVED</b>.</div>` + txnFormHTML({}, allowed, true),
      actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Add (approved)", cls: "green", value: "ok" }],
      onAction: async (v, w) => {
        const row = readTxnForm(w);
        row.member_id = App.$("#e-member", w).value;
        row.category = App.$("#e-cat", w).value;
        if (!row.member_id) { App.toast("Please choose the member.", "bad"); return false; }
        if (row.category !== "challenge" && !row.partner_id) { App.toast("Please choose the other member.", "bad"); return false; }
        if (row.partner_id === row.member_id) { App.toast("Member and other member cannot be the same.", "bad"); return false; }
        if (/^biz_/.test(row.category) && !(row.amount > 0)) { App.toast("Please enter the amount.", "bad"); return false; }
        if (!/^biz_/.test(row.category)) row.amount = null;
        row.status = "approved";
        await App.q(App.sb.from("transactions").insert(row));
        App.toast("Added ✔", "good");
        await reload();
        return true;
      },
    });
  }

  ADMIN.approvals = (el) => txnSection(el, { title: "🔴 Pending Approvals", cats: MEMBER_CATS, status: "pending", file: "submissions",
    help: "Check each submission and click <b>APPROVE</b> or <b>REJECT</b>. Only approved entries give points. A reason is required to reject." });
  ADMIN.p2p = (el) => txnSection(el, { title: "🤝 P2P Approvals", cats: ["p2p"], status: "pending", file: "p2p", allowAdd: true,
    help: "Open the photo to verify the meeting. Duplicate P2Ps (same two members, same date, same submitter) are blocked automatically." });
  ADMIN.business = (el) => txnSection(el, { title: "💼 Business", cats: ["biz_given", "biz_received"], status: "", file: "business", allowAdd: true,
    help: "Points = FLOOR(amount ÷ ₹50,000). Example: ₹2,50,000 = 5 pts, ₹49,999 = 0 pts." });
  ADMIN.references = (el) => txnSection(el, { title: "📤 References", cats: ["ref_given", "ref_received"], status: "", file: "references", allowAdd: true });
  ADMIN.newmember = (el) => txnSection(el, { title: "🌱 New Member Connections", cats: ["new_member"], status: "", file: "new-member-connections", allowAdd: true,
    help: "Mark who counts as a “new member” in Admin → Members → Edit (tick “New / recently inducted member”)." });

  // ==================================================================
  // VISITORS (+ induction)
  // ==================================================================
  ADMIN.visitors = async (el) => {
    const [vis, txns] = await Promise.all([
      App.q(App.sb.from("visitors").select("*").order("visit_date", { ascending: false })),
      App.q(App.sb.from("transactions").select("id,visitor_id,category,status,reject_reason").in("category", ["visitor", "induction"])),
    ]);
    const vt = {}, it = {};
    txns.forEach((t) => { if (t.category === "visitor") { if (!vt[t.visitor_id] || t.status !== "rejected") vt[t.visitor_id] = t; } else it[t.visitor_id] = t; });
    let search = "";
    el.innerHTML = `<div class="card-title"><h2>🙋 Visitors</h2><button class="btn ghost sm" id="vi-csv">⬇ Export CSV</button></div>
      <div class="notice small">1) Approve the <b>Visitor Brought</b> entry (+${(App.rulesMap.visitor || {}).points} pts). 2) If the visitor later joins GPBO, click <b>Mark INDUCTED</b> (+${(App.rulesMap.induction || {}).points} pts to the member who brought them).</div>
      <input type="search" id="vi-search" placeholder="🔍 Search visitor / member / mobile…" class="mb" style="max-width:360px">
      <div id="vi-list"></div>`;
    const draw = () => {
      const s = search.toLowerCase();
      const list = vis.filter((v) => !s || [v.visitor_name, v.company, v.mobile, pName(v.brought_by), v.business_category].join(" ").toLowerCase().includes(s));
      App.$("#vi-list", el).innerHTML = list.length ? `<table class="rt"><thead><tr><th>Visitor</th><th>Brought by</th><th>Date / Event</th><th>Visitor entry</th><th>Induction</th><th></th></tr></thead><tbody>
        ${list.map((v) => { const t = vt[v.id]; return `<tr>
          <td data-label="Visitor"><b>${esc(v.visitor_name)}</b><div class="small muted">${esc(v.company || "")} ${v.business_category ? "· " + esc(v.business_category) : ""}<br>📞 ${esc(v.mobile)}</div></td>
          <td data-label="Brought by">${esc(pName(v.brought_by))}</td>
          <td data-label="Date">${App.fmtDate(v.visit_date)}<div class="small muted">${esc(v.event_name || "")}</div></td>
          <td data-label="Entry">${t ? App.statusTag(t.status) : '<span class="tag gray">none</span>'}</td>
          <td data-label="Induction">${v.induction_status === "inducted" ? `<span class="tag approved">🎉 INDUCTED</span><div class="small muted">${App.fmtDate(v.inducted_date)}</div>` : '<span class="tag gray">Not inducted</span>'}</td>
          <td data-label="" class="no-label"><div class="row">
            ${t && t.status === "pending" ? `<a class="btn sm" href="#/admin/approvals">Review</a>` : ""}
            ${v.induction_status !== "inducted" && t && t.status === "approved" ? `<button class="btn green sm" data-ind="${v.id}">Mark INDUCTED</button>` : ""}
            ${v.induction_status === "inducted" ? `<button class="btn ghost sm red-text" data-undo="${v.id}">Undo induction</button>` : ""}
            <button class="btn ghost sm" data-edit="${v.id}">Edit</button></div></td></tr>`; }).join("")}</tbody></table>` : '<div class="empty">No visitors yet.</div>';
      App.$$("[data-ind]", el).forEach((b) => (b.onclick = async () => {
        const v = vis.find((x) => x.id === Number(b.dataset.ind));
        let date = null, week = null;
        const ok = await App.modal({
          title: "Confirm induction", body: `<p>Confirm that <b>${esc(v.visitor_name)}</b> has been <b>inducted into GPBO</b>. <b>${esc(pName(v.brought_by))}</b> will receive +${(App.rulesMap.induction || {}).points} points.</p>
            <label class="f"><span>Induction date</span><input type="date" id="ind-date" value="${App.todayISO()}"></label>
            <label class="f"><span>Count points in week</span><select id="ind-week"><option value="">Automatic (from induction date)</option>${App.weeks.map((w) => `<option value="${w.week_no}">Week ${w.week_no}</option>`).join("")}</select>
            <small>If the induction happens after the league ends, choose a week here, otherwise the points will not count.</small></label>`,
          actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Confirm INDUCTED", cls: "green", value: "ok" }],
          onAction: (x, w) => { date = App.$("#ind-date", w).value; week = App.$("#ind-week", w).value; if (!date) { App.toast("Choose the date.", "bad"); return false; } return true; },
        });
        if (ok !== "ok") return;
        try { await App.rpc("mark_visitor_inducted", { p_visitor_id: v.id, p_date: date, p_week_override: week ? Number(week) : null }); App.toast("Marked as INDUCTED 🎉", "good"); reloadSection(); }
        catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
      App.$$("[data-undo]", el).forEach((b) => (b.onclick = async () => {
        if (!(await App.confirm("Undo the induction? The induction points will be removed.", { danger: true }))) return;
        try { await App.rpc("undo_visitor_induction", { p_visitor_id: Number(b.dataset.undo) }); App.toast("Induction removed.", "good"); reloadSection(); }
        catch (e) { App.toast(App.errMsg(e), "bad"); }
      }));
      App.$$("[data-edit]", el).forEach((b) => (b.onclick = () => {
        const v = vis.find((x) => x.id === Number(b.dataset.edit));
        App.modal({
          title: "Edit visitor", body: `<div class="form-grid two">
            <label class="f"><span>Visitor name</span><input type="text" id="v-name" value="${esc(v.visitor_name)}"></label>
            <label class="f"><span>Company</span><input type="text" id="v-company" value="${esc(v.company || "")}"></label>
            <label class="f"><span>Mobile</span><input type="tel" id="v-mobile" value="${esc(v.mobile)}"></label>
            <label class="f"><span>Business category</span><input type="text" id="v-cat" value="${esc(v.business_category || "")}"></label>
            <label class="f"><span>Event</span><input type="text" id="v-event" value="${esc(v.event_name || "")}"></label>
            <label class="f"><span>Brought by</span>${memberSelect("v-by", v.brought_by)}</label></div>
            <p class="small muted">Changing “Brought by” moves the visitor to another member (their entries move too).</p>`,
          actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save", value: "ok" }],
          onAction: async (x, w) => {
            const by = App.$("#v-by", w).value;
            await App.q(App.sb.from("visitors").update({
              visitor_name: App.$("#v-name", w).value.trim(), company: App.$("#v-company", w).value.trim() || null,
              mobile: App.$("#v-mobile", w).value.trim(), business_category: App.$("#v-cat", w).value.trim() || null,
              event_name: App.$("#v-event", w).value.trim() || null, brought_by: by,
            }).eq("id", v.id));
            if (by !== v.brought_by) await App.q(App.sb.from("transactions").update({ member_id: by }).eq("visitor_id", v.id));
            App.toast("Saved ✔", "good"); reloadSection(); return true;
          },
        });
      }));
    };
    App.$("#vi-search", el).oninput = (e) => { search = e.target.value; draw(); };
    App.$("#vi-csv", el).onclick = () => App.downloadCSV(`visitors-${App.todayISO()}.csv`, vis, [
      { k: "visitor_name", l: "Visitor" }, { k: "company", l: "Company" }, { k: "mobile", l: "Mobile" }, { k: "business_category", l: "Business Category" },
      { k: "visit_date", l: "Visit Date" }, { k: "event_name", l: "Event" }, { k: "by", l: "Brought By", f: (r) => pName(r.brought_by) },
      { k: "st", l: "Visitor Entry Status", f: (r) => (vt[r.id] ? vt[r.id].status : "") }, { k: "induction_status", l: "Induction" }, { k: "inducted_date", l: "Inducted Date" },
    ]);
    draw();
  };

  // ==================================================================
  // ATTENDANCE & ACTIVITIES (same pattern)
  // ==================================================================
  function checklistModal(title, subtitle, preChecked, onSave) {
    const div = document.createElement("div");
    const members = memberProfiles().filter((m) => m.is_active);
    div.innerHTML = `<p class="small muted">${subtitle}</p>
      <div class="row mb"><input type="search" id="cl-s" class="grow" placeholder="🔍 Search…"><button type="button" class="btn ghost sm" id="cl-all">Select all</button><button type="button" class="btn ghost sm" id="cl-none">Clear</button></div>
      <div class="small mb"><b id="cl-n">0</b> selected</div>
      <div class="check-list">${members.map((m) => `<label class="check" data-name="${esc((m.full_name + " " + m.username + " " + (m.group_name || "")).toLowerCase())}"><input type="checkbox" value="${m.id}" ${preChecked.has(m.id) ? "checked" : ""}> ${esc(m.full_name)}${App.sampleTag(m.is_sample)}</label>`).join("")}</div>`;
    const count = () => (App.$("#cl-n", div).textContent = App.$$("input[type=checkbox]:checked", div).length);
    div.addEventListener("change", count);
    App.$("#cl-s", div).oninput = (e) => { const s = e.target.value.toLowerCase(); App.$$(".check", div).forEach((c) => c.classList.toggle("hidden", !!s && !c.dataset.name.includes(s))); };
    App.$("#cl-all", div).onclick = () => { App.$$(".check:not(.hidden) input", div).forEach((i) => (i.checked = true)); count(); };
    App.$("#cl-none", div).onclick = () => { App.$$(".check:not(.hidden) input", div).forEach((i) => (i.checked = false)); count(); };
    count();
    return App.modal({
      title, body: div, sticky: true, actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save", cls: "green", value: "ok" }],
      onAction: async () => { await onSave(App.$$("input[type=checkbox]:checked", div).map((i) => i.value)); return true; },
    });
  }

  async function eventSection(el, cfg) {
    const [events, txns] = await Promise.all([
      App.q(App.sb.from(cfg.table).select("*").order(cfg.dateCol, { ascending: false })),
      App.q(App.sb.from("transactions").select("id,member_id," + cfg.fk + ",status").eq("category", cfg.cat).neq("status", "rejected")),
    ]);
    const byEvent = {};
    txns.forEach((t) => { (byEvent[t[cfg.fk]] = byEvent[t[cfg.fk]] || new Set()).add(t.member_id); });
    el.innerHTML = `<div class="card-title"><h2>${cfg.title}</h2><div class="row"><button class="btn green sm" id="ev-add">＋ ${cfg.addLabel}</button><button class="btn ghost sm" id="ev-csv">⬇ Export CSV</button></div></div>
      <div class="notice small">${cfg.help}</div>
      ${events.length ? `<table class="rt"><thead><tr><th>${cfg.nameLabel}</th><th>Date</th><th>${cfg.countLabel}</th><th></th></tr></thead><tbody>
      ${events.map((e) => `<tr><td data-label="${cfg.nameLabel}"><b>${esc(e.title)}</b>${e.activity_type ? `<div class="small muted">${esc(e.activity_type)}</div>` : ""}</td>
        <td data-label="Date">${App.fmtDate(e[cfg.dateCol])}<div class="small muted">${App.weekForDate(e[cfg.dateCol]) ? "Week " + App.weekForDate(e[cfg.dateCol]) : "⚠ outside league weeks"}</div></td>
        <td data-label="${cfg.countLabel}"><b>${(byEvent[e.id] || new Set()).size}</b> members · +${(App.rulesMap[cfg.cat] || {}).points} pts each</td>
        <td class="no-label"><div class="row"><button class="btn sm" data-mark="${e.id}">${cfg.markLabel}</button><button class="btn ghost sm" data-edit="${e.id}">Edit</button><button class="btn ghost sm red-text" data-del="${e.id}">Delete</button></div></td></tr>`).join("")}
      </tbody></table>` : `<div class="empty">Nothing yet. Click “${cfg.addLabel}”.</div>`}`;

    const form = (e) => `<label class="f"><span>${cfg.nameLabel} <em>*</em></span><input type="text" id="ev-title" value="${esc(e ? e.title : cfg.defaultTitle)}"></label>
      ${cfg.table === "activities" ? `<label class="f"><span>Type</span><select id="ev-type">${ACTIVITY_TYPES.map((t) => `<option ${e && e.activity_type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}
      <label class="f"><span>Date <em>*</em></span><input type="date" id="ev-date" value="${esc(e ? e[cfg.dateCol] : App.todayISO())}"></label>
      <label class="f"><span>${cfg.table === "activities" ? "Description" : "Notes"}</span><input type="text" id="ev-desc" value="${esc(e ? (e.description || e.notes || "") : "")}"></label>`;
    const read = (w) => {
      const row = { title: App.$("#ev-title", w).value.trim() };
      row[cfg.dateCol] = App.$("#ev-date", w).value;
      if (cfg.table === "activities") { row.activity_type = App.$("#ev-type", w).value; row.description = App.$("#ev-desc", w).value.trim() || null; }
      else row.notes = App.$("#ev-desc", w).value.trim() || null;
      if (!row.title || !row[cfg.dateCol]) throw new Error("Please fill in the name and date.");
      return row;
    };
    App.$("#ev-add", el).onclick = () => App.modal({
      title: cfg.addLabel, body: form(null), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Create", cls: "green", value: "ok" }],
      onAction: async (v, w) => { await App.q(App.sb.from(cfg.table).insert(read(w))); App.toast("Created ✔ — now tick the members.", "good"); reloadSection(); return true; },
    });
    App.$$("[data-edit]", el).forEach((b) => (b.onclick = () => {
      const e = events.find((x) => x.id === Number(b.dataset.edit));
      App.modal({
        title: "Edit", body: form(e), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save", value: "ok" }],
        onAction: async (v, w) => { await App.q(App.sb.from(cfg.table).update(read(w)).eq("id", e.id)); App.toast("Saved ✔", "good"); reloadSection(); return true; },
      });
    }));
    App.$$("[data-del]", el).forEach((b) => (b.onclick = async () => {
      const e = events.find((x) => x.id === Number(b.dataset.del));
      if (!(await App.confirm(`Delete “${esc(e.title)}” and remove its points from all members?`, { danger: true, ok: "Delete" }))) return;
      try { await App.q(App.sb.from(cfg.table).delete().eq("id", e.id)); App.toast("Deleted.", "good"); reloadSection(); } catch (ex) { App.toast(App.errMsg(ex), "bad"); }
    }));
    App.$$("[data-mark]", el).forEach((b) => (b.onclick = () => {
      const e = events.find((x) => x.id === Number(b.dataset.mark));
      checklistModal(`${e.title} — ${App.fmtDate(e[cfg.dateCol])}`, cfg.checkHelp, byEvent[e.id] || new Set(), async (ids) => {
        const r = await App.rpc(cfg.rpc, { [cfg.rpcArg]: e.id, p_member_ids: ids });
        App.toast(`Saved ✔ (${r.added} added, ${r.removed} removed)`, "good");
        reloadSection();
      });
    }));
    App.$("#ev-csv", el).onclick = () => {
      const rows = [];
      events.forEach((e) => (byEvent[e.id] || new Set()).forEach((m) => rows.push({ event: e.title, type: e.activity_type || "", date: e[cfg.dateCol], member: pName(m) })));
      App.downloadCSV(`${cfg.table}-${App.todayISO()}.csv`, rows, [{ k: "event", l: cfg.nameLabel }, { k: "type", l: "Type" }, { k: "date", l: "Date" }, { k: "member", l: "Member" }]);
    };
  }

  ADMIN.attendance = (el) => eventSection(el, {
    title: "✅ Meeting Attendance", table: "meetings", dateCol: "meeting_date", fk: "meeting_id", cat: "attendance",
    rpc: "admin_set_attendance", rpcArg: "p_meeting_id", addLabel: "New meeting", nameLabel: "Meeting", defaultTitle: "Weekly Meeting",
    countLabel: "Present", markLabel: "✔ Mark attendance", checkHelp: "Tick everyone who attended. Unticking a member removes their attendance points for this meeting.",
    help: "Create each official weekly meeting, then tick who attended (bulk). Each attendance = +" + ((App.rulesMap.attendance || {}).points) + " points. Members cannot mark their own attendance.",
  });
  ADMIN.activities = (el) => eventSection(el, {
    title: "🏭 Activity Participation", table: "activities", dateCol: "activity_date", fk: "activity_id", cat: "activity",
    rpc: "admin_set_activity_participants", rpcArg: "p_activity_id", addLabel: "New activity", nameLabel: "Activity", defaultTitle: "",
    countLabel: "Participants", markLabel: "✔ Select participants", checkHelp: "Tick every member who participated.",
    help: "Create an official activity (Workshop, Factory Visit, Mega Visitors Day, KMB…), then select the participating members. Each participant = +" + ((App.rulesMap.activity || {}).points) + " points.",
  });

  // ==================================================================
  // SPECIAL CHALLENGES
  // ==================================================================
  ADMIN.challenges = async (el) => {
    const [list, txns] = await Promise.all([
      App.q(App.sb.from("special_challenges").select("*").order("id", { ascending: false })),
      App.q(App.sb.from("transactions").select("id,member_id,challenge_id,status").eq("category", "challenge").neq("status", "rejected")),
    ]);
    el.innerHTML = `<div class="card-title"><h2>⚡ Special Challenges</h2><button class="btn green sm" id="ch-add">＋ Create challenge</button></div>
      <div class="notice small">Members can claim a challenge (it appears in Pending Approvals), or you can award it directly with “Award to members”.
        Examples: CONNECT 5, REFERENCE 3, P2P BLAST, BUSINESS CONNECTOR, GUEST CHALLENGE, CROSS-GROUP CONNECTION.</div>
      ${list.length ? list.map((c) => {
        const done = txns.filter((t) => t.challenge_id === c.id);
        return `<div class="item"><div class="item-head"><div><div class="t">⚡ ${esc(c.name)} ${c.is_active ? '<span class="tag approved">ACTIVE</span>' : '<span class="tag gray">INACTIVE</span>'}</div>
          <div class="small muted">${c.week_no ? "Week " + c.week_no + " · " : ""}${c.start_date ? App.fmtDate(c.start_date) + " – " + App.fmtDate(c.end_date) : "No dates"}</div></div>
          <div class="pts-badge" style="font-size:1.2rem">+${c.points}</div></div>
          <p class="mt">${esc(c.description || "")}</p>
          <div class="small">Completed: <b>${done.filter((t) => t.status === "approved").length}</b> approved · <b>${done.filter((t) => t.status === "pending").length}</b> pending claims</div>
          <div class="actions"><button class="btn green" data-award="${c.id}">🏅 Award to members</button><button class="btn ghost" data-edit="${c.id}">✎ Edit</button><button class="btn ghost red-text" data-del="${c.id}">🗑 Delete</button></div></div>`;
      }).join("") : '<div class="empty">No challenges yet.</div>'}`;

    const form = (c) => { c = c || { points: 20, is_active: true }; return `
      <label class="f"><span>Challenge name <em>*</em></span><input type="text" id="c-name" value="${esc(c.name || "")}" placeholder="e.g. CONNECT 5"></label>
      <label class="f"><span>Description</span><textarea id="c-desc" placeholder="e.g. Meet 5 different members this week">${esc(c.description || "")}</textarea></label>
      <div class="form-grid two">
        <label class="f"><span>Week</span><select id="c-week"><option value="">Any / by date</option>${App.weeks.map((w) => `<option value="${w.week_no}" ${c.week_no === w.week_no ? "selected" : ""}>Week ${w.week_no}</option>`).join("")}</select></label>
        <label class="f"><span>Points</span><select id="c-points">${[10, 15, 20, 25, 30].map((p) => `<option ${c.points === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
        <label class="f"><span>Start date</span><input type="date" id="c-start" value="${esc(c.start_date || "")}"></label>
        <label class="f"><span>End date</span><input type="date" id="c-end" value="${esc(c.end_date || "")}"></label>
      </div>
      <label class="check"><input type="checkbox" id="c-active" ${c.is_active ? "checked" : ""}> Active (visible to members)</label>`; };
    const read = (w) => {
      const r = { name: App.$("#c-name", w).value.trim(), description: App.$("#c-desc", w).value.trim() || null, week_no: App.$("#c-week", w).value ? Number(App.$("#c-week", w).value) : null,
        points: Number(App.$("#c-points", w).value), start_date: App.$("#c-start", w).value || null, end_date: App.$("#c-end", w).value || null, is_active: App.$("#c-active", w).checked };
      if (!r.name) throw new Error("Please enter the challenge name.");
      if (r.start_date && r.end_date && r.end_date < r.start_date) throw new Error("End date is before start date.");
      if (r.week_no && !r.start_date) { const wk = App.weeks.find((x) => x.week_no === r.week_no); r.start_date = wk.start_date; r.end_date = r.end_date || wk.end_date; }
      return r;
    };
    App.$("#ch-add", el).onclick = () => App.modal({ title: "Create challenge", body: form(), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Create", cls: "green", value: "ok" }],
      onAction: async (v, w) => { await App.q(App.sb.from("special_challenges").insert(read(w))); App.toast("Challenge created ✔", "good"); reloadSection(); return true; } });
    App.$$("[data-edit]", el).forEach((b) => (b.onclick = () => {
      const c = list.find((x) => x.id === Number(b.dataset.edit));
      App.modal({ title: "Edit challenge", body: form(c), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save", value: "ok" }],
        onAction: async (v, w) => { await App.q(App.sb.from("special_challenges").update(read(w)).eq("id", c.id)); App.toast("Saved ✔", "good"); reloadSection(); return true; } });
    }));
    App.$$("[data-del]", el).forEach((b) => (b.onclick = async () => {
      const c = list.find((x) => x.id === Number(b.dataset.del));
      if (!(await App.confirm(`Delete challenge “${esc(c.name)}”? All its completions and points will be removed. (To just hide it, Edit → untick Active.)`, { danger: true, ok: "Delete" }))) return;
      try { await App.q(App.sb.from("special_challenges").delete().eq("id", c.id)); App.toast("Deleted.", "good"); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
    }));
    App.$$("[data-award]", el).forEach((b) => (b.onclick = () => {
      const c = list.find((x) => x.id === Number(b.dataset.award));
      const approved = new Set(txns.filter((t) => t.challenge_id === c.id && t.status === "approved").map((t) => t.member_id));
      const pending = txns.filter((t) => t.challenge_id === c.id && t.status === "pending").map((t) => pName(t.member_id));
      checklistModal(`Award: ${c.name} (+${c.points})`, `Tick the members who completed this challenge. Already-awarded members are ticked. ${pending.length ? "Pending claims from: " + esc(pending.join(", ")) + " (ticking them approves their claim)." : ""} To remove an award, reject/delete it in Pending Approvals.`,
        approved, async (ids) => {
          const r = await App.rpc("admin_award_challenge", { p_challenge_id: c.id, p_member_ids: ids.filter((id) => !approved.has(id)) });
          App.toast(`Awarded ✔ (${r.added} new, ${r.approved} claims approved)`, "good");
          reloadSection();
        });
    }));
  };

  // ==================================================================
  // WEEKLY WINNERS (lock / unlock)
  // ==================================================================
  ADMIN.weekly = async (el) => {
    const [winners, pend] = await Promise.all([
      App.q(App.sb.from("weekly_winners").select("*").order("position", { ascending: true })),
      App.q(App.sb.from("v_transactions").select("id,week_no").eq("status", "pending")),
    ]);
    const lbs = {};
    for (const w of App.weeks) if (!w.locked) lbs[w.week_no] = await App.rpc("get_leaderboard", { p_week: w.week_no });
    const today = App.todayISO();
    el.innerHTML = `<h2>🎖️ Weekly Winners</h2>
      <div class="notice small">At the end of each week: approve all pending entries for that week, then click <b>LOCK WEEK</b>. Locking saves the winner and freezes that week's points so results cannot accidentally change. Only you can unlock.</div>
      <div class="week-grid">${App.weeks.map((w) => {
        const pn = pend.filter((p) => p.week_no === w.week_no).length;
        const ww = winners.filter((x) => x.week_no === w.week_no);
        const lb = (lbs[w.week_no] || []).filter((r) => r.total_points > 0).slice(0, 5);
        return `<div class="card"><div class="card-title"><h3>WEEK ${w.week_no}</h3>${w.locked ? '<span class="tag approved">🔒 LOCKED</span>' : '<span class="tag pending">OPEN</span>'}</div>
          <div class="small muted">${App.fmtDate(w.start_date)} – ${App.fmtDate(w.end_date)}${today > w.end_date ? " · week finished" : today >= w.start_date ? " · in progress" : " · upcoming"}</div>
          ${pn ? `<div class="notice warn mt small">${pn} pending submission(s) in this week. <a href="#/admin/approvals">Review them</a> before locking.</div>` : ""}
          <div class="mt">${w.locked
            ? (ww.length ? ww.map((x) => `<div class="winner" style="padding:5px 0"><span style="font-size:1.3rem">${App.medal(x.position)}</span><div class="grow"><b>${esc(x.member_name)}</b><div class="small muted">${esc(App.achievementsText(x.achievements))}</div></div><b>${x.points}</b></div>`).join("") : '<div class="empty">No points this week.</div>')
            : (lb.length ? '<div class="small muted">Live top 5:</div>' + lb.map((r) => `<div class="winner" style="padding:4px 0">${App.rankBadge(r.rank)}<div class="grow">${esc(r.full_name)}</div><b>${r.total_points}</b></div>`).join("") : '<div class="empty">No approved points yet.</div>')}</div>
          <div class="actions mt">${w.locked ? `<button class="btn ghost red-text" data-unlock="${w.week_no}">🔓 Unlock week</button>` : `<button class="btn" data-lock="${w.week_no}">🔒 LOCK WEEK ${w.week_no}</button>`}</div></div>`;
      }).join("")}</div>`;
    App.$$("[data-lock]", el).forEach((b) => (b.onclick = async () => {
      const wn = Number(b.dataset.lock), w = App.weeks.find((x) => x.week_no === wn);
      const pn = pend.filter((p) => p.week_no === wn).length;
      let msg = `Lock <b>Week ${wn}</b> and save the weekly winner?`;
      if (today <= w.end_date) msg += `<br><br>⚠ This week has <b>not finished</b> yet (ends ${App.fmtDate(w.end_date)}). Members will not be able to submit for this week after locking.`;
      if (pn) msg += `<br><br>⚠ There are <b>${pn} pending</b> submissions in this week. They cannot be approved while the week is locked.`;
      if (!(await App.confirm(msg, { ok: "Lock week" }))) return;
      try { const n = await App.rpc("lock_week", { p_week: wn }); App.toast(`Week ${wn} locked ✔ (${n} top positions saved)`, "good"); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
    }));
    App.$$("[data-unlock]", el).forEach((b) => (b.onclick = async () => {
      const wn = Number(b.dataset.unlock);
      if (!(await App.confirm(`Unlock Week ${wn}? The saved winner will be removed until you lock it again.`, { danger: true, ok: "Unlock" }))) return;
      try { await App.rpc("unlock_week", { p_week: wn }); App.toast(`Week ${wn} unlocked.`, "good"); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
    }));
  };

  // ==================================================================
  // FINAL AWARDS & PRIZES
  // ==================================================================
  ADMIN.awards = async (el) => {
    const s = App.settings;
    const [finals, awards, prizes, lb] = await Promise.all([
      App.q(App.sb.from("final_results").select("*").order("position", { ascending: true })),
      App.q(App.sb.from("final_awards").select("*").order("id", { ascending: true })),
      App.q(App.sb.from("prizes").select("*").order("sort_order", { ascending: true })),
      App.rpc("get_leaderboard", { p_week: null }),
    ]);
    const unlocked = App.weeks.filter((w) => !w.locked).map((w) => w.week_no);
    el.innerHTML = `
      <h2>🏁 Final Result</h2>
      ${s.finalized ? App.renderFinalResult(finals, awards) + `<div class="card"><p class="small muted">Finalized ${App.fmtDateTime(s.finalized_at)}. All points are locked.</p><button class="btn ghost red-text" id="fin-undo">Un-finalize league</button></div>`
        : `<div class="card"><p>When all 4 weeks are complete and every submission is reviewed, click <b>FINALIZE LEAGUE</b>. This saves the Champion, Runner-Up and Third Position and locks all results.</p>
          ${unlocked.length ? `<div class="notice warn small">Weeks not locked yet: ${unlocked.join(", ")}. (Recommended: lock every week first.)</div>` : ""}
          <div class="small muted mb">Current top 3 (live):</div>
          ${lb.slice(0, 3).map((r) => `<div class="winner" style="padding:5px 0"><span style="font-size:1.4rem">${App.medal(r.rank) || r.rank}</span><div class="grow"><b>${esc(r.full_name)}</b></div><b>${r.total_points}</b></div>`).join("") || '<div class="empty">No members.</div>'}
          <button class="btn green lg block mt" id="fin-go">🏁 FINALIZE LEAGUE</button></div>`}
      <div class="card"><div class="card-title"><h3>🌟 Special Appreciation Awards</h3><button class="btn green sm" id="aw-add">＋ Add award</button></div>
        <p class="small muted">These are chosen by you (not automatic). They are shown on the Weekly Winners page after the league is finalized.</p>
        ${awards.length ? awards.map((a) => `<div class="award"><div style="font-size:1.4rem">🏅</div><div class="grow"><b>${esc(a.award_name)}</b> — ${esc(a.member_name || "")}${a.note ? `<div class="small muted">${esc(a.note)}</div>` : ""}</div><button class="btn ghost sm red-text" data-aw-del="${a.id}">Remove</button></div>`).join("") : '<div class="empty">No awards yet.</div>'}</div>
      <div class="card"><div class="card-title"><h3>🎁 Prizes</h3><button class="btn green sm" id="pz-add">＋ Add prize</button></div>
        <p class="small muted">Shown to all members on the Weekly Winners page.</p>
        ${prizes.length ? prizes.map((p) => `<div class="award"><div style="font-size:1.4rem">🎁</div><div class="grow"><b>${esc(p.title)}</b>${p.description ? `<div class="small muted">${esc(p.description)}</div>` : ""}</div><button class="btn ghost sm" data-pz-edit="${p.id}">Edit</button><button class="btn ghost sm red-text" data-pz-del="${p.id}">Remove</button></div>`).join("") : '<div class="empty">No prizes added yet.</div>'}</div>`;

    const go = App.$("#fin-go", el);
    if (go) go.onclick = async () => {
      if (!(await App.confirm("FINALIZE the league? The final result will be saved and ALL points will be locked. Members can no longer submit.", { ok: "Finalize" }))) return;
      try { await App.rpc("finalize_league"); App.toast("League finalized 🏁", "good"); await App.loadBase(); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
    };
    const undo = App.$("#fin-undo", el);
    if (undo) undo.onclick = async () => {
      if (!(await App.confirm("Un-finalize? The saved final result is removed and points can change again. (League status stays “ended”; change it in Settings if needed.)", { danger: true, ok: "Un-finalize" }))) return;
      try { await App.rpc("unfinalize_league"); await App.loadBase(); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); }
    };
    App.$("#aw-add", el).onclick = () => App.modal({
      title: "Add appreciation award",
      body: `<label class="f"><span>Award</span><input type="text" id="aw-name" list="aw-list" placeholder="Choose or type"><datalist id="aw-list">${AWARD_SUGGESTIONS.map((a) => `<option value="${a}">`).join("")}</datalist></label>
        <label class="f"><span>Member</span>${memberSelect("aw-member", null, { blank: "— Choose member —" })}</label>
        <label class="f"><span>Note (optional)</span><input type="text" id="aw-note"></label>`,
      actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Add", cls: "green", value: "ok" }],
      onAction: async (v, w) => {
        const row = { award_name: App.$("#aw-name", w).value.trim(), member_id: App.$("#aw-member", w).value || null, note: App.$("#aw-note", w).value.trim() || null };
        if (!row.award_name || !row.member_id) { App.toast("Choose the award and the member.", "bad"); return false; }
        await App.q(App.sb.from("final_awards").insert(row)); reloadSection(); return true;
      },
    });
    App.$$("[data-aw-del]", el).forEach((b) => (b.onclick = async () => { try { await App.q(App.sb.from("final_awards").delete().eq("id", Number(b.dataset.awDel))); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); } }));
    const pzForm = (p) => `<label class="f"><span>Title</span><input type="text" id="pz-title" value="${esc(p ? p.title : "")}" placeholder="e.g. Weekly Winner"></label>
      <label class="f"><span>Description</span><input type="text" id="pz-desc" value="${esc(p ? p.description || "" : "")}" placeholder="e.g. Trophy + gift voucher"></label>
      <label class="f"><span>Order</span><input type="number" id="pz-sort" value="${p ? p.sort_order : prizes.length + 1}"></label>`;
    const pzRead = (w) => { const r = { title: App.$("#pz-title", w).value.trim(), description: App.$("#pz-desc", w).value.trim() || null, sort_order: Number(App.$("#pz-sort", w).value) || 0 }; if (!r.title) throw new Error("Enter a title."); return r; };
    App.$("#pz-add", el).onclick = () => App.modal({ title: "Add prize", body: pzForm(null), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Add", cls: "green", value: "ok" }],
      onAction: async (v, w) => { await App.q(App.sb.from("prizes").insert(pzRead(w))); reloadSection(); return true; } });
    App.$$("[data-pz-edit]", el).forEach((b) => (b.onclick = () => { const p = prizes.find((x) => x.id === Number(b.dataset.pzEdit));
      App.modal({ title: "Edit prize", body: pzForm(p), actions: [{ label: "Cancel", cls: "ghost", value: null }, { label: "Save", value: "ok" }],
        onAction: async (v, w) => { await App.q(App.sb.from("prizes").update(pzRead(w)).eq("id", p.id)); reloadSection(); return true; } }); }));
    App.$$("[data-pz-del]", el).forEach((b) => (b.onclick = async () => { try { await App.q(App.sb.from("prizes").delete().eq("id", Number(b.dataset.pzDel))); reloadSection(); } catch (e) { App.toast(App.errMsg(e), "bad"); } }));
  };

  // ==================================================================
  // LEADERBOARD (admin copy with export)
  // ==================================================================
  ADMIN.leaderboard = (el) => App.renderLeaderboard(el, { admin: true });

  // ==================================================================
  // REPORTS / EXPORT
  // ==================================================================
  ADMIN.reports = async (el) => {
    const exports = [
      { k: "members", l: "👥 Members" }, { k: "all", l: "📄 All transactions" }, { k: "p2p", l: "🤝 P2P" },
      { k: "ref", l: "📤 References" }, { k: "biz", l: "💼 Business" }, { k: "visitors", l: "🙋 Visitors" },
      { k: "attendance", l: "✅ Attendance" }, { k: "activity", l: "🏭 Activity participation" }, { k: "challenge", l: "⚡ Challenge completions" },
      { k: "lb", l: "🏆 Leaderboard (all weeks)" }, ...App.weeks.map((w) => ({ k: "lb" + w.week_no, l: `🏆 Leaderboard Week ${w.week_no}` })),
      { k: "audit", l: "🕘 Audit log" },
    ];
    el.innerHTML = `<h2>⬇ Reports / Export</h2><p class="small muted">Downloads open in Excel (CSV format).</p>
      <div class="type-grid">${exports.map((x) => `<button class="type-tile" data-x="${x.k}"><b>${x.l}</b><span>Download CSV</span></button>`).join("")}</div>
      <div class="card mt"><h3>🖨 Printable leaderboard</h3><p class="small muted">Open the leaderboard, choose the week, then click Print (or save as PDF).</p><a class="btn" href="#/admin/leaderboard">Open leaderboard</a></div>`;
    App.$$("[data-x]", el).forEach((b) => (b.onclick = async () => {
      const k = b.dataset.x;
      b.disabled = true;
      try {
        const d = App.todayISO();
        if (k === "members") return App.downloadCSV(`members-${d}.csv`, App.profiles, [
          { k: "full_name", l: "Name" }, { k: "username", l: "Username" }, { k: "email", l: "Email" }, { k: "phone", l: "Phone" }, { k: "group_name", l: "Group" },
          { k: "induction_date", l: "Induction Date" }, { k: "is_active", l: "Active" }, { k: "is_new_member", l: "New Member" }, { k: "role", l: "Role" }, { k: "is_sample", l: "Sample" }]);
        if (k.startsWith("lb")) {
          const w = k === "lb" ? null : Number(k.slice(2));
          const rows = await App.rpc("get_leaderboard", { p_week: w });
          return App.downloadCSV(`leaderboard-${w ? "week" + w : "all-weeks"}-${d}.csv`, rows, [{ k: "rank", l: "Rank" }, { k: "full_name", l: "Member" }, { k: "group_name", l: "Group" }, { k: "total_points", l: "Total Points" },
            ...App.LB_COLS.slice(1).map((c) => ({ k: c.k, l: c.l })), { k: "biz_given_points", l: "Business Given Points" }, { k: "biz_received_points", l: "Business Received Points" }, { k: "challenge_points", l: "Challenge Points" }]);
        }
        if (k === "audit") {
          const rows = await App.q(App.sb.from("audit_logs").select("*").order("changed_at", { ascending: false }).limit(5000));
          return App.downloadCSV(`audit-log-${d}.csv`, rows, [{ k: "changed_at", l: "When" }, { k: "changed_by_name", l: "Who" }, { k: "table_name", l: "Table" }, { k: "action", l: "Action" },
            { k: "record_id", l: "Record" }, { k: "old_status", l: "Old Status" }, { k: "new_status", l: "New Status" }, { k: "old_data", l: "Old Data" }, { k: "new_data", l: "New Data" }]);
        }
        if (k === "visitors") {
          const rows = await App.q(App.sb.from("visitors").select("*").order("visit_date", { ascending: true }));
          return App.downloadCSV(`visitors-${d}.csv`, rows, [{ k: "visitor_name", l: "Visitor" }, { k: "company", l: "Company" }, { k: "mobile", l: "Mobile" }, { k: "business_category", l: "Category" },
            { k: "visit_date", l: "Visit Date" }, { k: "event_name", l: "Event" }, { k: "by", l: "Brought By", f: (r) => pName(r.brought_by) }, { k: "induction_status", l: "Induction" }, { k: "inducted_date", l: "Inducted Date" }]);
        }
        const cats = { all: null, p2p: ["p2p"], ref: ["ref_given", "ref_received"], biz: ["biz_given", "biz_received"], attendance: ["attendance"], activity: ["activity"], challenge: ["challenge"] }[k];
        let q = App.sb.from("v_transactions").select("*");
        if (cats) q = q.in("category", cats);
        const rows = await App.q(q.order("txn_date", { ascending: true }).limit(20000));
        const vis = {};
        if (rows.some((r) => r.visitor_id)) (await App.q(App.sb.from("visitors").select("id,visitor_name"))).forEach((v) => (vis[v.id] = v));
        App.downloadCSV(`${k}-transactions-${d}.csv`, rows, txnCsvCols(vis));
      } catch (e) { App.toast(App.errMsg(e), "bad"); }
      finally { b.disabled = false; }
    }));
  };

  // ==================================================================
  // AUDIT LOG
  // ==================================================================
  ADMIN.audit = async (el) => {
    let table = "";
    el.innerHTML = `<div class="card-title"><h2>🕘 Audit Log</h2></div>
      <p class="small muted">Every change is recorded automatically: who created, approved, rejected, edited or deleted what, and when. Nobody can edit this log.</p>
      <select id="au-t" class="mb" style="max-width:260px"><option value="">All tables</option>${["transactions", "visitors", "profiles", "auth_users", "league_settings", "league_weeks", "point_rules", "meetings", "activities", "special_challenges", "weekly_winners", "final_results", "final_awards", "prizes"].map((t) => `<option>${t}</option>`).join("")}</select>
      <div id="au-list">${App.loadingHTML}</div>`;
    const load = async () => {
      let q = App.sb.from("audit_logs").select("*").order("changed_at", { ascending: false }).limit(300);
      if (table) q = q.eq("table_name", table);
      const rows = await App.q(q);
      const summary = (r) => {
        const d = r.new_data || r.old_data || {};
        if (r.table_name === "transactions") return `${App.catLabel(d.category)} · ${pName(d.member_id)} · ${App.fmtDate(d.txn_date)}`;
        if (r.table_name === "profiles") return d.full_name || "";
        if (r.table_name === "visitors") return d.visitor_name || "";
        if (r.table_name === "auth_users") return Array.isArray(d) ? `${d.length} member(s)` : (d.username || "");
        return d.title || d.name || d.award_name || d.member_name || d.label || (d.week_no ? "Week " + d.week_no : "");
      };
      App.$("#au-list", el).innerHTML = rows.length ? `<table class="rt"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Status change</th><th></th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td data-label="When" class="nowrap">${App.fmtDateTime(r.changed_at)}</td><td data-label="Who">${esc(r.changed_by_name || "System")}</td>
          <td data-label="What"><b>${esc(r.action)}</b> ${esc(r.table_name)} #${esc(r.record_id || "")}<div class="small muted">${esc(summary(r))}</div></td>
          <td data-label="Status">${r.old_status || r.new_status ? `${esc(r.old_status || "—")} → <b>${esc(r.new_status || "—")}</b>` : "—"}</td>
          <td class="no-label"><button class="btn ghost sm" data-i="${i}">Details</button></td></tr>`).join("")}</tbody></table>` : '<div class="empty">No entries.</div>';
      App.$$("[data-i]", el).forEach((b) => (b.onclick = () => {
        const r = rows[Number(b.dataset.i)];
        const o = r.old_data || {}, n = r.new_data || {};
        const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]));
        App.modal({ title: `${r.action} ${r.table_name}`, wide: true, body: keys.length && !Array.isArray(n)
          ? `<table class="rt"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${keys.map((k) => `<tr><td data-label="Field"><b>${esc(k)}</b></td><td data-label="Before">${esc(o[k] == null ? "" : JSON.stringify(o[k]))}</td><td data-label="After">${esc(n[k] == null ? "" : JSON.stringify(n[k]))}</td></tr>`).join("")}</tbody></table>`
          : `<pre style="white-space:pre-wrap;font-size:.8rem">${esc(JSON.stringify(r.new_data || r.old_data, null, 2))}</pre>` });
      }));
    };
    App.$("#au-t", el).onchange = (e) => { table = e.target.value; load().catch((ex) => App.toast(App.errMsg(ex), "bad")); };
    await load();
  };

  // ==================================================================
  // SETTINGS
  // ==================================================================
  ADMIN.settings = async (el) => {
    const s = App.settings;
    el.innerHTML = `<h2>⚙️ Settings</h2>
      <div class="card"><h3>League status</h3>
        <p class="small muted">Members can submit only while the league is <b>Running</b>.</p>
        <div class="seg" style="grid-template-columns:repeat(3,1fr)">${[["not_started", "Not started"], ["running", "▶ Running"], ["ended", "■ Ended"]].map(([v, l]) => `<button type="button" data-st="${v}" class="${s.status === v ? "active" : ""}">${l}</button>`).join("")}</div>
        ${s.finalized ? '<div class="notice warn small">League is FINALIZED. Un-finalize in Final Awards to change results.</div>' : ""}</div>

      <form class="card" id="set-form">
        <h3>📅 League dates & weeks</h3>
        <div class="form-grid two">
          <label class="f"><span>League start date</span><input type="date" id="s-start" value="${esc(s.start_date)}"></label>
          <label class="f"><span>League end date</span><input type="date" id="s-end" value="${esc(s.end_date)}"></label>
        </div>
        <button type="button" class="btn ghost sm mb" id="s-auto">↻ Auto-fill 4 weeks of 7 days from the start date</button>
        <table class="rt"><thead><tr><th>Week</th><th>Start</th><th>End</th><th>Locked</th></tr></thead><tbody>
          ${App.weeks.map((w) => `<tr><td data-label="Week"><b>Week ${w.week_no}</b></td>
            <td data-label="Start"><input type="date" data-ws="${w.week_no}" value="${esc(w.start_date)}" ${w.locked ? "disabled" : ""}></td>
            <td data-label="End"><input type="date" data-we="${w.week_no}" value="${esc(w.end_date)}" ${w.locked ? "disabled" : ""}></td>
            <td data-label="Locked">${w.locked ? "🔒 yes" : "no"}</td></tr>`).join("")}</tbody></table>
        <p class="small muted">Every activity is placed in a week automatically by its date. Locked weeks cannot be changed.</p>

        <h3 class="mt">🔢 Point values</h3>
        <table class="rt"><thead><tr><th>Activity</th><th>Points</th><th>Per amount (₹)</th></tr></thead><tbody>
          ${App.rules.filter((r) => r.code !== "challenge").map((r) => `<tr><td data-label="Activity">${App.catIcon(r.code)} <input type="text" data-rl="${r.code}" value="${esc(r.label)}" style="max-width:260px"></td>
            <td data-label="Points"><input type="number" data-rp="${r.code}" value="${r.points}" min="0" step="1" style="max-width:110px"></td>
            <td data-label="Per ₹">${r.unit_amount != null ? `<input type="number" data-ru="${r.code}" value="${Number(r.unit_amount)}" min="1" step="1" style="max-width:150px">` : '<span class="muted">—</span>'}</td></tr>`).join("")}</tbody></table>
        <p class="small muted">Special Challenge points (10–30) are set on each challenge. Changing values here recalculates everyone's points (except locked weeks' saved winners).</p>

        <h3 class="mt">🧩 Options</h3>
        <label class="f"><span>A member counts as “new” for this many days after their induction date</span><input type="number" id="s-newdays" value="${s.new_member_days}" min="0" max="3650" style="max-width:140px"><small>You can also tick “New member” on each member in Admin → Members.</small></label>
        <label class="check"><input type="checkbox" id="s-claims" ${s.allow_challenge_claims ? "checked" : ""}> Members can claim special challenges (you approve them)</label>
        <label class="check"><input type="checkbox" id="s-test" ${s.test_mode ? "checked" : ""}> TEST MODE banner (switch off when the real league starts)</label>
        <label class="f mt"><span>Announcement (shown at the top for everyone; leave blank for none)</span><input type="text" id="s-ann" value="${esc(s.announcement || "")}" placeholder="e.g. Week 2 challenge is live! ⚡"></label>
        <div id="s-err" class="notice bad hidden"></div>
        <button class="btn green lg block" type="submit" id="s-save">💾 Save settings</button>
      </form>

      <div class="card" style="border-color:var(--red)"><h3 style="color:var(--red)">⚠ Danger zone</h3>
        <p class="small">After testing, use this to delete ALL submissions, points, visitors, meetings, activities, weekly winners, final results and awards. Members, settings, challenges and prizes are kept.</p>
        <button class="btn red" id="s-reset">Delete all league data…</button></div>`;

    App.$$("[data-st]", el).forEach((b) => (b.onclick = async () => {
      const v = b.dataset.st;
      if (v === s.status) return;
      if (!(await App.confirm(`Change league status to <b>${b.textContent}</b>?`))) return;
      try { await App.q(App.sb.from("league_settings").update({ status: v, updated_at: new Date().toISOString() }).eq("id", 1)); await App.loadBase(); App.toast("Status updated ✔", "good"); reloadSection(); }
      catch (e) { App.toast(App.errMsg(e), "bad"); }
    }));
    App.$("#s-auto", el).onclick = () => {
      const start = App.$("#s-start", el).value;
      if (!start) return App.toast("Choose the start date first.", "bad");
      App.weeks.forEach((w, i) => {
        const a = App.$(`[data-ws="${w.week_no}"]`, el), b = App.$(`[data-we="${w.week_no}"]`, el);
        if (a.disabled) return;
        a.value = App.addDays(start, i * 7); b.value = App.addDays(start, i * 7 + 6);
      });
      App.$("#s-end", el).value = App.addDays(start, App.weeks.length * 7 - 1);
      App.toast("Weeks filled in. Click Save settings.", "good");
    };
    App.$("#set-form", el).onsubmit = async (e) => {
      e.preventDefault();
      const err = App.$("#s-err", el), btn = App.$("#s-save", el);
      err.classList.add("hidden");
      const start = App.$("#s-start", el).value, end = App.$("#s-end", el).value;
      const weeks = App.weeks.map((w) => ({ week_no: w.week_no, locked: w.locked, start_date: App.$(`[data-ws="${w.week_no}"]`, el).value, end_date: App.$(`[data-we="${w.week_no}"]`, el).value }));
      const problems = [];
      if (!start || !end || end < start) problems.push("League end date must be after the start date.");
      weeks.forEach((w, i) => {
        if (!w.start_date || !w.end_date || w.end_date < w.start_date) problems.push(`Week ${w.week_no}: end date must be after start date.`);
        if (w.start_date < start || w.end_date > end) problems.push(`Week ${w.week_no} must be inside the league dates.`);
        if (i > 0 && w.start_date <= weeks[i - 1].end_date) problems.push(`Week ${w.week_no} overlaps Week ${weeks[i - 1].week_no}.`);
      });
      const rules = App.rules.filter((r) => r.code !== "challenge").map((r) => {
        const upd = { code: r.code, label: App.$(`[data-rl="${r.code}"]`, el).value.trim() || r.label, points: Number(App.$(`[data-rp="${r.code}"]`, el).value) };
        const u = App.$(`[data-ru="${r.code}"]`, el);
        if (u) upd.unit_amount = Number(u.value);
        if (!Number.isInteger(upd.points) || upd.points < 0) problems.push(`${upd.label}: points must be a whole number (0 or more).`);
        if (u && !(upd.unit_amount > 0)) problems.push(`${upd.label}: amount must be more than 0.`);
        return upd;
      });
      const newDays = Number(App.$("#s-newdays", el).value);
      if (!Number.isInteger(newDays) || newDays < 0) problems.push("New-member days must be a whole number.");
      if (problems.length) { err.innerHTML = problems.map(esc).join("<br>"); err.classList.remove("hidden"); return; }
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        await App.q(App.sb.from("league_settings").update({ start_date: start, end_date: end, new_member_days: newDays,
          allow_challenge_claims: App.$("#s-claims", el).checked, test_mode: App.$("#s-test", el).checked,
          announcement: App.$("#s-ann", el).value.trim() || null, updated_at: new Date().toISOString() }).eq("id", 1));
        for (const w of weeks) {
          const old = App.weeks.find((x) => x.week_no === w.week_no);
          if (!w.locked && (old.start_date !== w.start_date || old.end_date !== w.end_date))
            await App.q(App.sb.from("league_weeks").update({ start_date: w.start_date, end_date: w.end_date }).eq("week_no", w.week_no));
        }
        for (const r of rules) {
          const old = App.rulesMap[r.code];
          if (old.label !== r.label || old.points !== r.points || (r.unit_amount !== undefined && Number(old.unit_amount) !== r.unit_amount)) {
            const upd = { label: r.label, points: r.points };
            if (r.unit_amount !== undefined) upd.unit_amount = r.unit_amount;
            await App.q(App.sb.from("point_rules").update(upd).eq("code", r.code));
          }
        }
        await App.loadBase();
        App.toast("Settings saved ✔", "good");
        App.$("#view") && App.$("#view").remove();
        App.render();
      } catch (ex) { err.textContent = App.errMsg(ex); err.classList.remove("hidden"); btn.disabled = false; btn.textContent = "💾 Save settings"; }
    };
    App.$("#s-reset", el).onclick = async () => {
      const typed = await App.prompt({ title: "Delete ALL league data", message: "This permanently deletes all submissions, points, photos records, visitors, meetings, activities, winners and awards. Members and settings are kept. <b>This cannot be undone.</b>", label: "Type RESET to confirm", ok: "Delete everything", danger: true });
      if (typed === null) return;
      try { await App.rpc("admin_reset_league_data", { p_confirm: typed }); App.toast("All league data deleted.", "good"); await App.loadBase(); reloadSection(); }
      catch (e) { App.toast(App.errMsg(e), "bad"); }
    };
  };
})();
