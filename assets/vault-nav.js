/* Adds a "Design Vault" link to the site menu once the Vault is open to the public.
   Opening the Vault is a switch in /vault-admin.html, so no redeploy is needed. */
(function () {
  "use strict";
  function addLink(nav) {
    if (!nav || nav.querySelector('a[href="/vault.html"]')) return;
    const a = document.createElement("a");
    a.href = "/vault.html";
    a.textContent = "Design Vault";
    const anchor = nav.querySelector('a[href="/contract.html"]');
    if (anchor && anchor.parentNode === nav) nav.insertBefore(a, anchor);
    else nav.appendChild(a);
  }
  fetch("/api/vault/status", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || !j.launched) return;
      addLink(document.querySelector(".main-nav"));
      addLink(document.querySelector('.mobile-nav nav[aria-label="Mobile navigation"]'));
    })
    .catch(() => {});
})();
