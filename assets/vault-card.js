/* Small "Design Vault" card for the dashboard: points, site credit and a link to the gallery.
   Stays hidden until the Vault is open (admins see it earlier, labelled as preview). */
(function () {
  "use strict";
  const section = document.getElementById("vaultCardSection");
  if (!section) return;
  fetch("/api/vault/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || !j.ok || !j.loggedIn || !j.points) return;
      document.getElementById("vaultCardPoints").textContent = String(j.points.balance);
      const credit = Number(j.creditCents || 0);
      const cbox = document.getElementById("vaultCardCreditBox");
      if (credit > 0) {
        cbox.classList.remove("hidden");
        document.getElementById("vaultCardCredit").textContent = "$" + (credit / 100).toFixed(2);
      }
      const ne = j.points.nextExpiry;
      if (ne) {
        const d = new Date(ne.at);
        if (!isNaN(d)) document.getElementById("vaultCardExpiry").textContent = ne.points + " points expire on " + d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      }
      if (!j.launched) document.getElementById("vaultCardPreview").classList.remove("hidden");
      if (j.isAdmin) document.getElementById("vaultCardAdmin").classList.remove("hidden");
      section.classList.remove("hidden");
    })
    .catch(() => {});
})();
