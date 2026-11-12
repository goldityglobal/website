// GA4 custom events. No personal data is sent: only the event name and a short label.
(function () {
  function send(name, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params || {});
    } catch (e) {}
  }

  var path = location.pathname.replace(/\.html$/, "");
  if (path === "/whitepaper") send("whitepaper_view");

  var how = document.getElementById("how");
  if (how && "IntersectionObserver" in window) {
    var seen = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !seen) {
          seen = true;
          send("how_to_buy_view");
          io.disconnect();
        }
      });
    }, { threshold: 0.35 });
    io.observe(how);
  }

  var DEX_BUTTONS = { buyPancake: "pancakeswap", buyUniswap: "uniswap", buySushi: "sushiswap" };

  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest("button, a") : null;
    if (!el) return;

    if (el.id === "copy" && path === "/contract") {
      send("contract_copy");
      return;
    }
    if (DEX_BUTTONS[el.id]) {
      send("official_dex_outbound_click", { dex: DEX_BUTTONS[el.id] });
      return;
    }
    var href = el.getAttribute && el.getAttribute("href");
    if (!href) return;
    if (/dexscreener\.com\//i.test(href)) {
      send("official_dex_outbound_click", { dex: "dexscreener" });
    } else if (/geckoterminal\.com\//i.test(href)) {
      send("official_dex_outbound_click", { dex: "geckoterminal" });
    } else if (/t\.me\/gdtyglobal/i.test(href)) {
      send("join_telegram_click", { target: "community" });
    } else if (/t\.me\/GOLDITY_airdrop_bot/i.test(href)) {
      send("join_telegram_click", { target: "airdrop_bot" });
    }
  }, true);
})();
