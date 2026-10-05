/* GOLDITY Design Vault - admin panel (admin accounts only; every call is checked again on the server).
   All server data is written with textContent, never innerHTML. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, "");
      else n.setAttribute(k, String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }

  function select(options, value, attrs) {
    const s = h("select", attrs);
    for (const [v, label] of options) s.append(h("option", { value: v, text: label }));
    s.value = value === undefined || value === null ? "" : String(value);
    return s;
  }

  async function api(path, body, form) {
    const opts = { credentials: "same-origin", headers: {} };
    if (form) { opts.method = "POST"; opts.body = form; }
    else if (body !== undefined) { opts.method = "POST"; opts.headers["content-type"] = "application/json"; opts.body = JSON.stringify(body); }
    try {
      const r = await fetch(path, opts);
      const j = await r.json().catch(() => ({}));
      j._status = r.status;
      return j;
    } catch {
      return { ok: false, error: "network", _status: 0 };
    }
  }

  const ERR = {
    unauthorized: "You are not signed in as an admin.", forbidden: "Request blocked (origin check).", rate_limited: "Too many requests. Wait a moment.",
    brand_check_required: "Tick the brand confirmation box.", title_required: "A title is required.", invalid_category: "Pick a valid category.",
    styles_1_or_2: "Pick 1 or 2 styles.", invalid_style: "One of the styles is not valid or is switched off.",
    unsupported_image: "Only JPG, PNG and still WebP images are accepted.", preview_too_large: "The preview is larger than 1000px.",
    demo_too_large: "The demo is larger than 2000px.", aspect_mismatch: "The versions do not have the same proportions (rotated photo?).",
    preview_not_distinct: "The preview must differ from the original.", free_limit_reached: "This category already has its maximum of free images.",
    file_too_large: "A file is too large (original max 30 MB).", too_large: "The upload is too large.", storage_not_configured: "The R2 bucket binding VAULT is missing.",
    not_configured: "The Vault is not fully configured yet.", insufficient_points: "The user does not have that many points.",
    insufficient_credit: "The user does not have that much credit.", note_required: "Write a short reason (3+ characters).",
    invalid_points: "Enter a whole number of points (not 0).", invalid_amount: "Enter a valid amount (not 0).", vault_not_ready: "Run \"Set up database\" first.",
    network: "Network error.", not_found: "Not found."
  };
  const errText = (r) => ERR[r.error] || r.message || `Error (${r.error || r._status})`;
  const money = (cents) => "$" + (Number(cents || 0) / 100).toFixed(2);
  const dollarsToCents = (v) => Math.round(parseFloat(String(v).replace(",", ".")) * 100);
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(); };

  let ov = null;          // overview payload
  const loaded = {};      // tabs already rendered

  function status(node, msg, kind) {
    node.textContent = msg || "";
    node.className = "status-text" + (kind ? " " + kind : "");
  }

  // Two-step confirm for risky buttons.
  function confirmButton(btn, armedText, action) {
    const label = btn.textContent;
    let armed = false, t = null;
    btn.addEventListener("click", async () => {
      if (!armed) {
        armed = true;
        btn.textContent = armedText;
        t = setTimeout(() => { armed = false; btn.textContent = label; }, 5000);
        return;
      }
      clearTimeout(t); armed = false; btn.textContent = label;
      await action();
    });
  }

  // ------------------------------------------------------------------ start / tabs

  function gate(message, link) {
    const g = $("adminGate");
    g.classList.remove("hidden");
    g.textContent = "";
    g.append(h("p", { text: message }));
    if (link) g.append(h("a", { class: "btn btn-gold btn-small", href: link[0], text: link[1] }));
  }

  function showTab(name) {
    for (const b of document.querySelectorAll("#vaultTabs button")) b.classList.toggle("active", b.dataset.tab === name);
    for (const p of document.querySelectorAll("[data-panel]")) p.classList.toggle("hidden", p.dataset.panel !== name);
    // The overview is re-read every time it is opened so the counts are never stale.
    if (name === "overview" || !loaded[name]) { loaded[name] = true; ({ overview: renderOverview, images: renderImages, settings: renderSettings, users: renderUsers, log: renderLog, upload: renderUploadDefaults })[name]?.(); }
  }

  async function start() {
    const r = await api("/api/admin/vault/overview");
    if (r._status === 401) { gate("Sign in with an admin account to use this page.", ["/login.html", "Sign in"]); return; }
    $("adminApp").classList.remove("hidden");
    for (const b of document.querySelectorAll("#vaultTabs button")) b.addEventListener("click", () => showTab(b.dataset.tab));
    if (r._status === 503 && r.error === "vault_not_ready") {
      ov = null;
      renderSetupOnly();
      return;
    }
    if (!r.ok) { gate(errText(r)); return; }
    ov = r;
    showTab("overview");
  }

  function renderSetupOnly() {
    const p = $("panelOverview");
    p.textContent = "";
    for (const b of document.querySelectorAll("#vaultTabs button")) if (b.dataset.tab !== "overview") b.classList.add("hidden");
    const st = h("div", { class: "status-text" });
    const btn = h("button", { class: "btn btn-gold", type: "button", text: "Set up database" });
    btn.addEventListener("click", async () => {
      btn.disabled = true; status(st, "Creating tables…");
      const r = await api("/api/admin/vault/setup", {});
      if (r.ok) location.reload(); else { btn.disabled = false; status(st, errText(r), "error"); }
    });
    p.append(h("div", { class: "dashboard-card" }, h("h3", { text: "The Design Vault database is not set up yet" }),
      h("p", { text: "This creates the Vault tables (images, points, credit, unlocks, downloads, admin log) and the default categories and styles. It is safe to press more than once." }),
      h("div", { class: "form-actions" }, btn), st));
  }

  // ------------------------------------------------------------------ overview

  async function renderOverview() {
    const fresh = await api("/api/admin/vault/overview");
    if (fresh.ok) ov = fresh;
    const p = $("panelOverview");
    p.textContent = "";
    const open = ov.settings.launched === 1;
    const cfg = ov.config;
    const li = (ok, text, optional) => h("li", {}, h("span", { class: ok ? "ok" : optional ? "opt" : "no", text: ok ? "✓" : optional ? "–" : "✗" }), text);
    const st = h("div", { class: "status-text" });
    const toggle = h("button", { class: open ? "btn btn-outline" : "btn btn-gold", type: "button", text: open ? "Close the Vault (admin only)" : "Open the Vault to the public" });
    confirmButton(toggle, open ? "Click again to close it" : "Click again to open it to everyone", async () => {
      const r = await api("/api/admin/vault/settings", { settings: { launched: open ? 0 : 1 } });
      if (!r.ok) { status(st, r.problems ? r.problems.join(" · ") : errText(r), "error"); return; }
      showTab("overview");
    });
    const counts = ov.imageCounts || {};
    p.append(
      h("div", { class: "dashboard-card" },
        h("h3", { text: open ? "The Vault is OPEN to the public" : "The Vault is closed: only admins can see it" }),
        h("p", { text: open ? "Visitors can browse, and the Design Vault link appears in the site menu." : "Upload and check your designs first, then open it. The menu link appears automatically when you open it." }),
        h("ul", { class: "vault-checklist" },
          li(true, "Database is set up"),
          li(cfg.r2Bound, "Private storage (R2 bucket binding VAULT)"),
          li(cfg.linkSecretOk, "Download link secret (Worker secret VAULT_LINK_SECRET, 32+ characters)"),
          li(cfg.treasuryConfigured, "Treasury wallet address (VAULT_TREASURY_ADDRESS) - only needed for GDTY payments later", true)),
        h("div", { class: "form-actions" }, toggle), st),
      h("div", { class: "dashboard-card" }, h("h3", { text: "Images" }),
        h("div", { class: "vault-stats" },
          h("div", {}, h("strong", { text: counts.published || 0 }), "published"),
          h("div", {}, h("strong", { text: counts.hidden || 0 }), "hidden"),
          h("div", {}, h("strong", { text: counts.deleted || 0 }), "deleted"))),
      (() => {
        const sst = h("div", { class: "status-text" });
        const b = h("button", { class: "btn btn-outline btn-small", type: "button", text: "Re-run database setup" });
        b.addEventListener("click", async () => { b.disabled = true; const r = await api("/api/admin/vault/setup", {}); b.disabled = false; status(sst, r.ok ? "Done. Nothing was overwritten." : errText(r), r.ok ? "success" : "error"); });
        return h("div", { class: "dashboard-card" }, h("h3", { text: "Maintenance" }), h("p", { text: "Safe to run any time. It only adds missing tables and default categories/styles." }), h("div", { class: "form-actions" }, b), sst);
      })());
  }

  // ------------------------------------------------------------------ upload

  const up = { rows: [], busy: false };
  const catOptions = () => ov.categories.filter((c) => c.active).map((c) => [c.slug, c.name]);
  const styleOptions = (none) => [...(none ? [["", "— none —"]] : []), ...ov.styles.filter((s) => s.active).map((s) => [s.slug, s.name])];

  function renderUploadDefaults() {
    const d = $("upDefaults");
    d.textContent = "";
    const mk = (label, node) => h("label", {}, label, node);
    up.dCat = select(catOptions(), catOptions()[0]?.[0]);
    up.dS1 = select(styleOptions(false), styleOptions(false)[0]?.[0]);
    up.dS2 = select(styleOptions(true), "");
    up.dStones = select([["0", "No stones"], ["1", "With stones"]], "0");
    up.dFree = h("input", { type: "checkbox" });
    const apply = h("button", { class: "btn btn-outline btn-small", type: "button", text: "Apply to all rows" });
    apply.addEventListener("click", () => { for (const r of up.rows) if (!r.done) { r.cat.value = up.dCat.value; r.s1.value = up.dS1.value; r.s2.value = up.dS2.value; r.stones.value = up.dStones.value; r.free.checked = up.dFree.checked; } });
    d.append(mk("Category", up.dCat), mk("Style 1", up.dS1), mk("Style 2 (optional)", up.dS2), mk("Stones", up.dStones),
      h("label", { class: "vault-check-row" }, up.dFree, "Mark new rows as Free"), apply);
  }

  function addFiles(files) {
    for (const f of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { addRow(f, "Not a JPG, PNG or WebP image.", "err", true); continue; }
      if (f.size > 30 * 1024 * 1024) { addRow(f, "Larger than 30 MB.", "err", true); continue; }
      addRow(f);
    }
    $("upStart").disabled = !up.rows.some((r) => !r.done && !r.blocked);
  }

  function addRow(file, msg, kind, blocked) {
    const url = URL.createObjectURL(file);
    const r = { file, done: false, blocked: !!blocked };
    r.title = h("input", { type: "text", maxlength: 120, value: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120) });
    r.cat = select(catOptions(), up.dCat.value);
    r.s1 = select(styleOptions(false), up.dS1.value);
    r.s2 = select(styleOptions(true), up.dS2.value);
    r.stones = select([["0", "No stones"], ["1", "With stones"]], up.dStones.value);
    r.free = h("input", { type: "checkbox" }); r.free.checked = up.dFree.checked;
    r.status = h("div", { class: "vault-up-status" + (kind ? " " + kind : ""), text: msg || `${(file.size / 1048576).toFixed(1)} MB · ready` });
    const L = (t, n) => h("label", {}, t, n);
    r.node = h("div", { class: "vault-up-row" }, h("img", { src: url, alt: "" }),
      h("div", { class: "vault-up-fields" }, h("label", { class: "wide" }, "Title", r.title), L("Category", r.cat), L("Style 1", r.s1), L("Style 2", r.s2), L("Stones", r.stones),
        h("label", { class: "vault-check-row" }, r.free, "Free"), r.status));
    up.rows.push(r);
    $("upList").append(r.node);
  }

  function toBlob(canvas, type, q) { return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode_failed"))), type, q)); }

  function drawScaled(bmp, maxSide, watermark) {
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), hgt = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = hgt;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, hgt);   // PNGs with transparency: flatten on white
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, 0, 0, w, hgt);
    if (watermark) {
      g.save();
      g.translate(w / 2, hgt / 2);
      g.rotate(-Math.PI / 6);
      const fs = Math.max(18, Math.round(Math.max(w, hgt) / 15));
      g.font = `800 ${fs}px Arial, Helvetica, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      const text = "goldityglobal.com";
      const stepX = g.measureText(text).width + fs * 1.4, stepY = fs * 3;
      const diag = Math.hypot(w, hgt);
      g.lineWidth = Math.max(2, fs / 8); g.lineJoin = "round";
      let row = 0;
      for (let y = -diag; y <= diag; y += stepY, row++) {
        for (let x = -diag; x <= diag; x += stepX) {
          const ox = x + (row % 2 ? stepX / 2 : 0);
          g.strokeStyle = "rgba(0,0,0,0.38)"; g.strokeText(text, ox, y);
          g.fillStyle = "rgba(255,255,255,0.62)"; g.fillText(text, ox, y);
        }
      }
      g.restore();
    }
    return c;
  }

  async function uploadOne(r) {
    const s1 = r.s1.value, s2 = r.s2.value;
    if (!r.title.value.trim()) { status(r.status, "Add a title.", "err"); return false; }
    if (!s1) { status(r.status, "Pick at least one style.", "err"); return false; }
    if (s2 && s2 === s1) { status(r.status, "Style 1 and 2 are the same.", "err"); return false; }
    r.status.className = "vault-up-status"; r.status.textContent = "Making the 3 versions…";
    let preview, demo;
    try {
      const bmp = await createImageBitmap(r.file);
      demo = await toBlob(drawScaled(bmp, 1600, false), "image/jpeg", 0.88);
      preview = await toBlob(drawScaled(bmp, 800, true), "image/jpeg", 0.82);
      if (bmp.close) bmp.close();
    } catch { status(r.status, "This browser could not read the image.", "err"); return false; }
    r.status.textContent = "Uploading…";
    const f = new FormData();
    f.set("title", r.title.value.trim()); f.set("category", r.cat.value); f.set("styles", s2 ? `${s1},${s2}` : s1);
    f.set("hasStones", r.stones.value); f.set("free", r.free.checked ? "1" : "0"); f.set("brandCheck", "1");
    f.set("original", r.file, r.file.name); f.set("preview", new File([preview], "preview.jpg", { type: "image/jpeg" })); f.set("demo", new File([demo], "demo.jpg", { type: "image/jpeg" }));
    const res = await api("/api/admin/vault/images", undefined, f);
    if (!res.ok) { status(r.status, errText(res), "err"); r.status.className = "vault-up-status err"; return false; }
    r.done = true;
    for (const n of [r.title, r.cat, r.s1, r.s2, r.stones, r.free]) n.disabled = true;
    if (res.freeLimitReached) { r.status.className = "vault-up-status warn"; r.status.textContent = "Saved, but this category already has its maximum of free images, so it was saved as a paid image."; }
    else { r.status.className = "vault-up-status ok"; r.status.textContent = res.free ? "Published (free)." : "Published."; }
    return true;
  }

  function initUpload() {
    $("upFiles").addEventListener("change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
    $("upClear").addEventListener("click", () => { if (up.busy) return; up.rows = []; $("upList").textContent = ""; $("upStart").disabled = true; status($("upState"), ""); });
    $("upStart").addEventListener("click", async () => {
      if (up.busy) return;
      if (!$("upBrand").checked) { status($("upState"), "Tick the brand confirmation box first.", "error"); return; }
      up.busy = true; $("upStart").disabled = true;
      let ok = 0, fail = 0;
      const todo = up.rows.filter((r) => !r.done && !r.blocked);
      for (let i = 0; i < todo.length; i++) {
        status($("upState"), `Uploading ${i + 1} of ${todo.length}…`);
        (await uploadOne(todo[i])) ? ok++ : fail++;
      }
      up.busy = false;
      $("upStart").disabled = !up.rows.some((r) => !r.done && !r.blocked);
      status($("upState"), `${ok} published${fail ? `, ${fail} need attention (see the rows below)` : ""}.`, fail ? "warning" : "success");
      loaded.images = false;
    });
  }

  // ------------------------------------------------------------------ images

  const im = { page: 1, status: "", category: "", q: "" };

  async function renderImages() {
    const p = $("panelImages");
    p.textContent = "";
    const fs = select([["", "All (not deleted)"], ["published", "Published"], ["hidden", "Hidden"], ["deleted", "Deleted"]], im.status);
    const fc = select([["", "All categories"], ...ov.categories.map((c) => [c.slug, c.name])], im.category);
    const fq = h("input", { type: "search", placeholder: "Title", value: im.q, maxlength: 60 });
    const go = h("button", { class: "btn btn-outline btn-small", type: "button", text: "Search" });
    const list = h("div", {});
    const pager = h("div", { class: "vault-pager" });
    const st = h("div", { class: "status-text" });
    const load = async () => {
      list.textContent = ""; status(st, "Loading…");
      const q = new URLSearchParams({ page: String(im.page) });
      if (im.status) q.set("status", im.status); if (im.category) q.set("category", im.category); if (im.q) q.set("q", im.q);
      const r = await api("/api/admin/vault/images?" + q);
      if (!r.ok) { status(st, errText(r), "error"); return; }
      status(st, r.total ? "" : "No images yet.");
      for (const it of r.items) list.append(imageRow(it));
      pager.textContent = "";
      const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
      const prev = h("button", { class: "btn btn-outline btn-small", type: "button", text: "← Prev", disabled: im.page <= 1 });
      const next = h("button", { class: "btn btn-outline btn-small", type: "button", text: "Next →", disabled: im.page >= pages });
      prev.addEventListener("click", () => { im.page--; load(); }); next.addEventListener("click", () => { im.page++; load(); });
      pager.append(prev, `Page ${im.page} of ${pages} · ${r.total} images`, next);
    };
    go.addEventListener("click", () => { im.status = fs.value; im.category = fc.value; im.q = fq.value.trim(); im.page = 1; load(); });
    fq.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
    p.append(h("div", { class: "dashboard-card" }, h("div", { class: "vault-form-grid" }, h("label", {}, "Status", fs), h("label", {}, "Category", fc), h("label", {}, "Search", fq)), h("div", { class: "form-actions" }, go)), st, list, pager);
    load();
  }

  function imageRow(it) {
    const title = h("input", { type: "text", maxlength: 120, value: it.title });
    const cat = select(ov.categories.map((c) => [c.slug, c.name]), it.category);
    const allStyles = ov.styles.filter((s) => s.active || it.styles.includes(s.slug)).map((s) => [s.slug, s.active ? s.name : s.name + " (off)"]);
    const s1 = select([["", "— none —"], ...allStyles], it.styles[0] || "");
    const s2 = select([["", "— none —"], ...allStyles], it.styles[1] || "");
    const stones = select([["0", "No stones"], ["1", "With stones"]], it.hasStones ? "1" : "0");
    const free = h("input", { type: "checkbox" }); free.checked = it.free;
    const stat = select([["published", "Published"], ["hidden", "Hidden"], ["deleted", "Deleted"]], it.status);
    const st = h("div", { class: "vault-up-status" });
    const save = h("button", { class: "btn btn-gold btn-small", type: "button", text: "Save" });
    save.addEventListener("click", async () => {
      const styles = [s1.value, s2.value].filter(Boolean);
      if (new Set(styles).size !== styles.length) { st.className = "vault-up-status err"; st.textContent = "Style 1 and 2 are the same."; return; }
      save.disabled = true; st.className = "vault-up-status"; st.textContent = "Saving…";
      const r = await api("/api/admin/vault/images/update", { id: it.id, title: title.value, category: cat.value, hasStones: stones.value === "1", free: free.checked, status: stat.value, styles });
      save.disabled = false;
      if (!r.ok) { st.className = "vault-up-status err"; st.textContent = errText(r); return; }
      free.checked = !!r.free;
      st.className = "vault-up-status " + (r.freeLimitReached ? "warn" : "ok");
      st.textContent = r.unchanged ? "No changes." : r.freeLimitReached ? "Saved, but the free limit is reached so it stays paid." : "Saved.";
      loaded.overview = false;
    });
    const L = (t, n) => h("label", {}, t, n);
    return h("div", { class: "vault-img-row" },
      h("img", { src: it.previewUrl, alt: "", loading: "lazy" }),
      h("div", {},
        h("div", { class: "vault-meta" }, `${it.id} · ${it.unlocks} unlocks · ${when(it.createdAt)} · `, h("a", { href: "/vault/" + it.id, target: "_blank", rel: "noopener", text: "open page" })),
        h("div", { class: "vault-inline" }, h("label", { class: "wide" }, "Title", title), L("Category", cat), L("Style 1", s1), L("Style 2", s2), L("Stones", stones), L("Status", stat),
          h("label", { class: "vault-check-row" }, free, "Free"), save, st)));
  }

  // ------------------------------------------------------------------ settings, categories, styles

  function renderSettings() {
    const p = $("panelSettings");
    p.textContent = "";
    const defs = ov.settingDefs;
    const inputs = {};
    const grid = h("div", { class: "vault-form-grid" });
    for (const [k, d] of Object.entries(defs)) {
      if (k === "launched") continue;
      inputs[k] = h("input", { type: "number", min: d.min, max: d.max, step: 1, value: ov.settings[k] });
      grid.append(h("label", {}, d.label, inputs[k]));
    }
    const st = h("div", { class: "status-text" });
    const save = h("button", { class: "btn btn-gold", type: "button", text: "Save settings" });
    save.addEventListener("click", async () => {
      const s = {};
      for (const [k, n] of Object.entries(inputs)) s[k] = n.value === "" ? NaN : Number(n.value);
      save.disabled = true;
      const r = await api("/api/admin/vault/settings", { settings: s });
      save.disabled = false;
      if (!r.ok) { status(st, r.key ? `${defs[r.key]?.label || r.key}: allowed ${r.min}–${r.max}` : errText(r), "error"); return; }
      ov.settings = r.settings; status(st, r.changed.length ? "Saved. New values apply to future unlocks and new points only." : "Nothing changed.", "success");
    });
    p.append(h("div", { class: "dashboard-card" }, h("h3", { text: "Points & access" }),
      h("p", { text: "Changes apply to future unlocks and new points. Images already unlocked and points already issued keep their old terms." }), grid, h("div", { class: "form-actions" }, save), st));

    // categories
    const table = h("table", { class: "dashboard-table" });
    table.append(h("thead", {}, h("tr", {}, ...["Category", "Active", "Free images (blank = default)", "CAD with stones $", "CAD no stones $", "CAD custom $", ""].map((t) => h("th", { text: t })))));
    const body = h("tbody", {});
    for (const c of ov.categories) {
      const name = h("input", { type: "text", value: c.name, maxlength: 60 });
      const active = h("input", { type: "checkbox" }); active.checked = !!c.active;
      const fl = h("input", { type: "number", min: 0, max: 200, value: c.free_limit === null ? "" : c.free_limit, placeholder: String(ov.settings.free_per_category) });
      const p1 = h("input", { type: "number", min: 0, step: "0.01", value: (c.cad_stones_cents / 100).toFixed(2) });
      const p2 = h("input", { type: "number", min: 0, step: "0.01", value: (c.cad_plain_cents / 100).toFixed(2) });
      const p3 = h("input", { type: "number", min: 0, step: "0.01", value: (c.cad_custom_cents / 100).toFixed(2) });
      const cst = h("span", { class: "vault-meta" });
      const b = h("button", { class: "btn btn-outline btn-small", type: "button", text: "Save" });
      b.addEventListener("click", async () => {
        const payload = { slug: c.slug, name: name.value, active: active.checked, freeLimit: fl.value === "" ? null : Number(fl.value), cadStonesCents: dollarsToCents(p1.value), cadPlainCents: dollarsToCents(p2.value), cadCustomCents: dollarsToCents(p3.value) };
        if ([payload.cadStonesCents, payload.cadPlainCents, payload.cadCustomCents].some((n) => !Number.isFinite(n))) { cst.textContent = "Check the prices."; return; }
        b.disabled = true; const r = await api("/api/admin/vault/categories", payload); b.disabled = false;
        cst.textContent = r.ok ? (r.unchanged ? "No changes" : "Saved") : errText(r);
        if (r.ok) { Object.assign(c, { name: payload.name, active: payload.active ? 1 : 0, free_limit: payload.freeLimit, cad_stones_cents: payload.cadStonesCents, cad_plain_cents: payload.cadPlainCents, cad_custom_cents: payload.cadCustomCents }); loaded.upload = false; }
      });
      body.append(h("tr", {}, h("td", {}, name), h("td", {}, active), h("td", {}, fl), h("td", {}, p1), h("td", {}, p2), h("td", {}, p3), h("td", {}, b, cst)));
    }
    table.append(body);
    p.append(h("div", { class: "dashboard-card" }, h("h3", { text: "Categories, free images and CAD prices (USD)" }),
      h("p", { text: "CAD prices are stored now and used when CAD orders open. Price changes only affect future orders." })),
      h("div", { class: "table-wrap" }, table));

    // styles
    const sl = h("div", {});
    const renderStyles = () => {
      sl.textContent = "";
      for (const s of ov.styles) {
        const name = h("input", { type: "text", value: s.name, maxlength: 40 });
        const active = h("input", { type: "checkbox" }); active.checked = !!s.active;
        const sst = h("span", { class: "vault-meta" });
        const b = h("button", { class: "btn btn-outline btn-small", type: "button", text: "Save" });
        b.addEventListener("click", async () => {
          const r = await api("/api/admin/vault/styles", { op: "update", slug: s.slug, name: name.value, active: active.checked });
          sst.textContent = r.ok ? "Saved" : errText(r); if (r.ok) { s.name = name.value; s.active = active.checked ? 1 : 0; }
        });
        sl.append(h("div", { class: "vault-inline", style: "margin-bottom:8px" }, h("label", {}, "Style", name), h("label", { class: "vault-check-row" }, active, "Active"), b, sst));
      }
    };
    renderStyles();
    const newName = h("input", { type: "text", maxlength: 40, placeholder: "e.g. Art Deco" });
    const addSt = h("span", { class: "vault-meta" });
    const add = h("button", { class: "btn btn-gold btn-small", type: "button", text: "Add style" });
    add.addEventListener("click", async () => {
      const r = await api("/api/admin/vault/styles", { op: "add", name: newName.value });
      if (!r.ok) { addSt.textContent = r.error === "style_exists" ? "That style already exists." : errText(r); return; }
      const o = await api("/api/admin/vault/overview"); if (o.ok) { ov = o; } newName.value = ""; addSt.textContent = "Added"; renderStyles(); loaded.upload = false;
    });
    p.append(h("div", { class: "dashboard-card" }, h("h3", { text: "Design styles" }),
      h("p", { text: "Each image gets 1 or 2 styles. Switching a style off hides it from filters and new uploads but old images keep their label." }), sl,
      h("div", { class: "vault-inline" }, h("label", {}, "New style", newName), add, addSt)));
  }

  // ------------------------------------------------------------------ users: points and credit

  function renderUsers() {
    const p = $("panelUsers");
    p.textContent = "";
    const email = h("input", { type: "email", placeholder: "user@example.com", maxlength: 160 });
    const look = h("button", { class: "btn btn-gold btn-small", type: "button", text: "Find user" });
    const st = h("div", { class: "status-text" });
    const out = h("div", {});
    // `doneMessage` is shown after the panel is rebuilt, so a success message is never wiped by the refresh.
    const doLookup = async (doneMessage) => {
      out.textContent = ""; status(st, "Looking up…");
      const r = await api("/api/admin/vault/user?email=" + encodeURIComponent(email.value.trim()));
      if (!r.ok) { status(st, r.error === "not_found" ? "No user with that email." : errText(r), "error"); return; }
      status(st, typeof doneMessage === "string" ? doneMessage : "", typeof doneMessage === "string" ? "success" : "");
      out.append(userPanel(r, doLookup));
    };
    look.addEventListener("click", () => doLookup());
    email.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doLookup(); } });
    p.append(h("div", { class: "dashboard-card" }, h("h3", { text: "Find a user" }), h("div", { class: "vault-inline" }, h("label", { class: "wide" }, "Account email", email), look), st), out);
  }

  function ledgerTable(headers, rows) {
    const t = h("table", { class: "dashboard-table" });
    t.append(h("thead", {}, h("tr", {}, ...headers.map((x) => h("th", { text: x })))));
    t.append(h("tbody", {}, ...rows.map((r) => h("tr", {}, ...r.map((c) => h("td", { text: c }))))));
    return h("div", { class: "table-wrap" }, t);
  }

  function userPanel(r, refresh) {
    const u = r.user;
    const adj = (title, hint, label, field, convert, path) => {
      const amt = h("input", { type: "number", step: field === "cents" ? "0.01" : "1", placeholder: field === "cents" ? "e.g. 25.00 or -5.00" : "e.g. 100 or -15" });
      const note = h("input", { type: "text", maxlength: 200, placeholder: "Reason (required)" });
      const s = h("div", { class: "status-text" });
      const b = h("button", { class: "btn btn-gold btn-small", type: "button", text: label });
      b.addEventListener("click", async () => {
        const v = convert(amt.value);
        if (!Number.isFinite(v) || v === 0) { status(s, "Enter an amount (not 0).", "error"); return; }
        b.disabled = true;
        const res = await api(path, { email: u.email, [field]: v, note: note.value });
        b.disabled = false;
        if (!res.ok) { status(s, errText(res), "error"); return; }
        refresh(field === "cents" ? "Site credit updated." : "Points updated.");
      });
      return h("div", { class: "dashboard-card" }, h("h3", { text: title }), h("p", { text: hint }), h("div", { class: "vault-inline" }, h("label", {}, "Amount", amt), h("label", { class: "wide" }, "Reason", note), b), s);
    };
    return h("div", {},
      h("div", { class: "dashboard-card" }, h("h3", { text: u.name || u.email }),
        h("p", { text: `${u.email} · ${u.wallet ? "wallet " + u.wallet : "no wallet"} · joined ${when(u.createdAt)}` }),
        h("div", { class: "vault-stats" }, h("div", {}, h("strong", { text: r.points }), "points"), h("div", {}, h("strong", { text: money(r.creditCents) }), "site credit"),
          r.nextExpiry ? h("div", {}, h("strong", { text: r.nextExpiry.points }), `expire ${when(r.nextExpiry.at)}`) : null)),
      adj("Add or remove points", "Positive adds points (they expire after the normal period). Negative removes points that are still valid.", "Apply points", "points", (v) => parseInt(v, 10), "/api/admin/vault/points"),
      adj("Add or remove site credit (USD)", "Site credit never expires and can pay for anything in the Vault. Use it e.g. when someone paid from an exchange by mistake.", "Apply credit", "cents", (v) => dollarsToCents(v), "/api/admin/vault/credit"),
      h("div", { class: "dashboard-card" }, h("h3", { text: "Points ledger (latest 40)" })),
      ledgerTable(["When", "Type", "Amount", "Left", "Expires", "Note"], r.pointsLedger.map((x) => [when(x.created_at), x.kind, x.amount, x.remaining, x.expires_at ? when(x.expires_at) : "", x.note || ""])),
      h("div", { class: "dashboard-card" }, h("h3", { text: "Credit ledger (latest 40)" })),
      ledgerTable(["When", "Type", "Amount", "Note"], r.creditLedger.map((x) => [when(x.created_at), x.kind, money(x.amount_cents), x.note || ""])),
      h("div", { class: "dashboard-card" }, h("h3", { text: "Recent unlocks" })),
      ledgerTable(["Image", "Unlocked", "Until", "Points"], r.unlocks.map((x) => [x.image_id, when(x.unlocked_at), when(x.expires_at), x.points_spent])));
  }

  // ------------------------------------------------------------------ log

  async function renderLog() {
    const p = $("panelLog");
    p.textContent = "";
    const r = await api("/api/admin/vault/log?limit=100");
    if (!r.ok) { p.append(h("div", { class: "status-text error", text: errText(r) })); return; }
    const short = (s) => { if (s === null || s === undefined) return ""; const t = String(s); return t.length > 120 ? t.slice(0, 117) + "…" : t; };
    p.append(h("div", { class: "dashboard-card" }, h("h3", { text: "Admin activity (latest 100)" }), h("p", { text: "Every price, setting, image, points and credit change is recorded here with the old and new value." })),
      ledgerTable(["When", "Admin", "Action", "Target", "Old", "New", "Note"], r.items.map((x) => [when(x.created_at), x.admin_email || "", x.action, `${x.target_type || ""} ${x.target_id || ""}`.trim(), short(x.old_value), short(x.new_value), x.note || ""])));
  }

  initUpload();
  start();
})();
