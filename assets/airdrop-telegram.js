// Telegram airdrop counter. Fully independent of airdrop.js: if anything here fails,
// the section simply stays hidden and the website airdrop is unaffected.
(function () {
  "use strict";
  var section = document.getElementById("tgAirdrop");
  var claimedEl = document.getElementById("tgAirdropClaimed");
  var fillEl = document.getElementById("tgAirdropFill");
  var btn = document.getElementById("tgAirdropBtn");
  var note = document.getElementById("tgAirdropNote");
  if (!section || !claimedEl || !fillEl || !btn || !note) return;

  var BASE_NOTE = note.textContent;
  var shown = false;
  var timer = null;
  var jumped = false;

  function fmt(n) {
    return Number(n).toLocaleString("en-US");
  }
  function setBtn(enabled) {
    if (enabled) {
      btn.classList.remove("is-disabled");
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("tabindex");
    } else {
      btn.classList.add("is-disabled");
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("tabindex", "-1");
    }
  }
  function hide() {
    section.style.display = "none";
    shown = false;
  }
  // Links such as goldityglobal.com/airdrop#telegram: the section only appears after the status
  // request, so the browser cannot jump to it by itself. Do it once, the first time it becomes visible.
  function jumpIfRequested() {
    if (jumped) return;
    jumped = true;
    try {
      var h = String(window.location.hash).toLowerCase();
      if (h === "#telegram" || h === "#tgairdrop") section.scrollIntoView({ block: "start" });
    } catch (e) {
      /* scrolling is a nicety; never let it break the page */
    }
  }

  function render(d) {
    if (!d || d.ok !== true || d.enabled !== true) return hide();
    var claimed = Number(d.claimed);
    var max = Number(d.max);
    if (!isFinite(claimed) || !isFinite(max) || max <= 0 || claimed < 0) return hide();
    claimedEl.textContent = fmt(claimed) + " / " + fmt(max);
    fillEl.style.width = Math.min(100, (claimed / max) * 100) + "%";
    if (d.paused) {
      note.textContent = "The Telegram airdrop is paused right now. Please check back later.";
      setBtn(false);
    } else if (claimed >= max) {
      note.textContent = "All " + fmt(max) + " Telegram claims have been taken. Thanks for your interest!";
      setBtn(false);
    } else {
      note.textContent = BASE_NOTE;
      setBtn(true);
    }
    section.style.display = "";
    shown = true;
    jumpIfRequested();
  }

  function load() {
    if (typeof fetch !== "function") return Promise.resolve();
    return fetch("/api/telegram/status", { headers: { accept: "application/json" } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error("status " + res.status);
          render(data);
        });
      })
      .catch(function () {
        /* keep whatever is on screen (hidden on first failure, last numbers afterwards) */
      });
  }

  load();
  timer = setInterval(function () {
    if (typeof document !== "undefined" && document.hidden) return;
    load();
  }, 30000);
  window.__tgAirdropTimer = timer;
})();
