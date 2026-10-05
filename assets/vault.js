/* GOLDITY Design Vault - public gallery and image page.
   Every piece of server data is written with textContent / attributes, never innerHTML. */
(function () {
  "use strict";

  const ID_RE = /^[a-z0-9]{10}$/;
  const $ = (id) => document.getElementById(id);
  const state = { meta: null, me: null, page: 1, total: 0, loading: false, filters: { category: "", style: "", free: false, unlocked: false, q: "" } };
  const detailMatch = location.pathname.match(/^\/vault\/([a-z0-9]{10})\/?$/);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  async function api(path, body) {
    const opts = { credentials: "same-origin", headers: {} };
    if (body !== undefined) {
      opts.method = "POST";
      opts.headers["content-type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    try {
      const r = await fetch(path, opts);
      const j = await r.json().catch(() => ({}));
      j._status = r.status;
      return j;
    } catch {
      return { ok: false, error: "network", _status: 0 };
    }
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };
  const fmtMoney = (cents) => "$" + (Number(cents || 0) / 100).toFixed(2);

  function setState(node, msg, kind) {
    node.textContent = msg || "";
    node.className = "status-text" + (kind ? " " + kind : "");
  }

  // ---------------------------------------------------------------- shared header / wallet box

  function renderWallet() {
    const me = state.me;
    const link = $("vaultAccountLink");
    if (me && me.loggedIn) {
      link.textContent = "My Dashboard";
      link.href = "/dashboard.html";
    }
    const box = $("vaultWallet");
    if (!me || !me.loggedIn || !me.points) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    $("vaultPoints").textContent = String(me.points.balance);
    const showCredit = Number(me.creditCents || 0) > 0;
    $("vaultCreditBox").classList.toggle("hidden", !showCredit);
    if (showCredit) $("vaultCredit").textContent = fmtMoney(me.creditCents);
    const ne = me.points.nextExpiry;
    $("vaultExpiry").textContent = ne ? `${ne.points} points expire on ${fmtDate(ne.at)}` : "";
  }

  async function refreshMe() {
    state.me = await api("/api/vault/me");
    renderWallet();
  }

  function showClosed() {
    $("galleryView").classList.add("hidden");
    $("detailView").classList.add("hidden");
    $("vaultHeading").textContent = "Design Vault — opening soon";
    setState($("vaultState"), "The Design Vault is not open yet. Please check back soon.");
  }

  // ---------------------------------------------------------------- gallery

  function readFilters() {
    const q = new URLSearchParams(location.search);
    state.filters = {
      category: q.get("category") || "",
      style: q.get("style") || "",
      free: q.get("free") === "1",
      unlocked: q.get("unlocked") === "1",
      q: (q.get("q") || "").slice(0, 60)
    };
  }

  function writeFilters() {
    const f = state.filters, p = new URLSearchParams();
    if (f.category) p.set("category", f.category);
    if (f.style) p.set("style", f.style);
    if (f.free) p.set("free", "1");
    if (f.unlocked) p.set("unlocked", "1");
    if (f.q) p.set("q", f.q);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function fillSelect(sel, items, current) {
    for (const it of items) {
      const o = document.createElement("option");
      o.value = it.slug;
      o.textContent = it.name;
      sel.appendChild(o);
    }
    sel.value = [...sel.options].some((o) => o.value === current) ? current : "";
  }

  function card(item) {
    const a = el("a", "vault-card");
    a.href = "/vault/" + item.id;
    const thumb = el("div", "vault-thumb");
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = item.title;
    img.src = item.previewUrl;
    thumb.appendChild(img);
    const badges = el("div", "vault-badges");
    if (item.free) badges.appendChild(el("span", "vault-badge free", "Free"));
    else if (item.unlocked) badges.appendChild(el("span", "vault-badge unlocked", "Unlocked"));
    else badges.appendChild(el("span", "vault-badge", item.cost + " pts"));
    thumb.appendChild(badges);
    a.appendChild(thumb);
    const body = el("div", "vault-card-body");
    body.appendChild(el("h3", "", item.title));
    const catName = (state.meta.categories.find((c) => c.slug === item.category) || {}).name || item.category;
    const parts = [catName, item.hasStones ? "With stones" : "No stones"];
    if (item.styles.length) parts.push(item.styles.map((s) => s.name).join(" · "));
    body.appendChild(el("div", "vault-card-meta", parts.join(" · ")));
    a.appendChild(body);
    return a;
  }

  async function loadGallery(reset) {
    if (state.loading) return;
    state.loading = true;
    if (reset) { state.page = 1; $("vaultGrid").textContent = ""; }
    const f = state.filters, p = new URLSearchParams();
    if (f.category) p.set("category", f.category);
    if (f.style) p.set("style", f.style);
    if (f.free) p.set("free", "1");
    if (f.unlocked) p.set("unlocked", "1");
    if (f.q) p.set("q", f.q);
    p.set("page", String(state.page));
    const r = await api("/api/vault/gallery?" + p.toString());
    state.loading = false;
    if (r._status === 404 && r.error === "not_launched") { showClosed(); return; }
    if (!r.ok) {
      setState($("vaultState"), r._status === 401 ? "Sign in to see the designs you unlocked." : "The gallery could not be loaded. Please try again.", "error");
      return;
    }
    setState($("vaultState"), "");
    state.total = r.total;
    const grid = $("vaultGrid");
    for (const it of r.items) grid.appendChild(card(it));
    if (!grid.children.length) grid.appendChild(el("div", "vault-empty", "No designs match these filters."));
    const shown = grid.querySelectorAll(".vault-card").length;
    $("vaultCount").textContent = r.total ? `${shown} of ${r.total} designs` : "";
    $("vaultMore").classList.toggle("hidden", shown >= r.total);
  }

  function initGallery() {
    $("galleryView").classList.remove("hidden");
    readFilters();
    fillSelect($("fCategory"), state.meta.categories, state.filters.category);
    fillSelect($("fStyle"), state.meta.styles, state.filters.style);
    state.filters.category = $("fCategory").value;
    state.filters.style = $("fStyle").value;
    $("fFree").checked = state.filters.free;
    $("fQuery").value = state.filters.q;
    const loggedIn = !!(state.me && state.me.loggedIn);
    $("fUnlocked").disabled = !loggedIn;
    $("fUnlockedWrap").classList.toggle("is-disabled", !loggedIn);
    $("fUnlockedWrap").title = loggedIn ? "" : "Sign in to see your unlocked designs";
    if (!loggedIn) state.filters.unlocked = false;
    $("fUnlocked").checked = state.filters.unlocked;

    const apply = () => {
      state.filters = { category: $("fCategory").value, style: $("fStyle").value, free: $("fFree").checked, unlocked: $("fUnlocked").checked, q: $("fQuery").value.trim() };
      writeFilters();
      loadGallery(true);
    };
    for (const id of ["fCategory", "fStyle", "fFree", "fUnlocked"]) $(id).addEventListener("change", apply);
    let timer = null;
    $("fQuery").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(apply, 350); });
    $("vaultFilters").addEventListener("submit", (e) => { e.preventDefault(); apply(); });
    $("vaultMore").addEventListener("click", () => { state.page += 1; loadGallery(false); });
    loadGallery(true);
  }

  // ---------------------------------------------------------------- detail page

  function chip(text) { return el("span", "vault-chip", text); }

  function renderDetail(item) {
    const me = state.me;
    const loggedIn = !!(me && me.loggedIn);
    $("detailView").classList.remove("hidden");
    $("detailTitle").textContent = item.title;
    const img = $("detailImg");
    img.alt = item.title;
    img.src = item.demoUrl || item.previewUrl;
    img.oncontextmenu = item.free || item.unlocked ? null : (e) => e.preventDefault();

    const chips = $("detailChips");
    chips.textContent = "";
    chips.appendChild(chip(item.categoryName));
    chips.appendChild(chip(item.hasStones ? "With stones" : "No stones"));
    for (const s of item.styles) chips.appendChild(chip(s.name));

    const status = $("detailStatus"), actions = $("detailActions"), fine = $("detailFine"), note = $("detailNote");
    status.textContent = "";
    actions.textContent = "";
    setState($("detailState"), "");
    if (item.status && item.status !== "published") {
      $("vaultBanner").textContent = `Admin view: this design is "${item.status}" and not visible to the public.`;
      $("vaultBanner").classList.remove("hidden");
    }

    if (item.free) {
      status.appendChild(el("strong", "", "Free to view"));
      status.appendChild(document.createTextNode(" — shown in full, no download."));
      note.textContent = "This design is part of the free showcase.";
      fine.textContent = "Need this design as a manufacturing file? CAD orders open soon.";
    } else if (item.unlocked) {
      status.appendChild(el("strong", "", "Unlocked"));
      status.appendChild(document.createTextNode(` until ${fmtDate(item.unlockExpiresAt)}.`));
      note.textContent = "Showing the full image. The download is the original, full-resolution file without watermark.";
      const dl = el("button", "btn btn-gold", "Download full file");
      dl.type = "button";
      dl.addEventListener("click", () => download(item, dl));
      actions.appendChild(dl);
      fine.textContent = "Download links work for a few minutes and only in this browser session.";
    } else {
      status.appendChild(el("strong", "", `${item.cost} points`));
      status.appendChild(document.createTextNode(` to unlock the full image and download the original file. Access lasts ${state.meta.unlockDays} days.`));
      note.textContent = "Preview with watermark. Unlock to see the full image and download the file.";
      fine.textContent = "Points are earned as gifts for verifying your email and wallet, and can be added by GOLDITY support. Point packages open soon.";
      if (!loggedIn) {
        const li = el("a", "btn btn-gold", "Sign in to unlock");
        li.href = "/login.html";
        const reg = el("a", "btn btn-outline", "Create account");
        reg.href = "/register.html";
        actions.appendChild(li);
        actions.appendChild(reg);
      } else {
        const bal = me.points ? me.points.balance : 0;
        status.appendChild(el("div", "vault-fineprint", `Your balance: ${bal} points`));
        const ub = el("button", "btn btn-gold", `Unlock for ${item.cost} points`);
        ub.type = "button";
        armed(ub, item);
        actions.appendChild(ub);
      }
    }
  }

  // Two-step button: the first click arms it, the second click within 5 seconds spends the points.
  function armed(btn, item) {
    let armedAt = 0, label = btn.textContent, t = null;
    btn.addEventListener("click", async () => {
      if (Date.now() - armedAt > 5000) {
        armedAt = Date.now();
        btn.textContent = `Click again to spend ${item.cost} points`;
        clearTimeout(t);
        t = setTimeout(() => { btn.textContent = label; armedAt = 0; }, 5000);
        return;
      }
      clearTimeout(t);
      armedAt = 0;
      btn.disabled = true;
      btn.textContent = "Unlocking…";
      await unlock(item, btn, label);
    });
  }

  async function unlock(item, btn, label) {
    const r = await api("/api/vault/unlock", { imageId: item.id });
    const st = $("detailState");
    if (r.ok) {
      await refreshMe();
      await showDetail(item.id, true);
      setState($("detailState"), r.already ? "Already unlocked." : `Unlocked. ${r.spent} points spent.`, "success");
      return;
    }
    btn.disabled = false;
    btn.textContent = label;
    const msg = {
      insufficient_points: `Not enough points: you have ${r.balance ?? 0}, this needs ${r.cost ?? item.cost}.`,
      unauthorized: "Please sign in again.",
      rate_limited: "Too many attempts. Please wait a moment.",
      busy: "Please try again.",
      free_image: "This image is free to view.",
      not_launched: "The Design Vault is not open yet."
    }[r.error] || "Something went wrong. Please try again.";
    setState(st, msg, "error");
  }

  async function download(item, btn) {
    btn.disabled = true;
    const r = await api("/api/vault/download-link", { imageId: item.id });
    btn.disabled = false;
    if (!r.ok || typeof r.url !== "string" || !r.url.startsWith("/api/vault/file/")) {
      const msg = {
        not_unlocked: "Your access to this image has ended. Unlock it again to download.",
        downloads_unavailable: "Downloads are temporarily unavailable. Please try again later.",
        rate_limited: "Too many downloads this hour. Please try again later.",
        unauthorized: "Please sign in again."
      }[r.error] || "The download could not start. Please try again.";
      setState($("detailState"), msg, "error");
      return;
    }
    setState($("detailState"), "Your download is starting…", "success");
    window.location.href = r.url;
  }

  async function showDetail(id, quiet) {
    if (!ID_RE.test(id)) { setState($("vaultState"), "This design is not available.", "error"); return; }
    const r = await api("/api/vault/image/" + id);
    if (!r.ok) {
      $("detailView").classList.add("hidden");
      setState($("vaultState"), r._status === 404 ? "This design is not available." : "The design could not be loaded. Please try again.", "error");
      return;
    }
    if (!quiet) setState($("vaultState"), "");
    state.meta.unlockDays = r.unlockDays || state.meta.unlockDays;
    renderDetail(r.item);
  }

  // ---------------------------------------------------------------- start

  async function init() {
    const [meta, me] = await Promise.all([api("/api/vault/meta"), api("/api/vault/me")]);
    if (meta._status === 503) { setState($("vaultState"), "The Design Vault is being prepared. Please check back soon."); return; }
    if (!meta.ok || (!meta.launched && !meta.adminPreview)) { showClosed(); return; }
    state.meta = meta;
    state.me = me;
    renderWallet();
    if (meta.adminPreview) {
      $("vaultBanner").textContent = "Admin preview: the Design Vault is not public yet. Visitors see a \"coming soon\" message.";
      $("vaultBanner").classList.remove("hidden");
    }
    if (detailMatch) {
      await showDetail(detailMatch[1], true);
    } else initGallery();
  }

  init();
})();
