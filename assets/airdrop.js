const API_BASE = "";
const $ = id => document.getElementById(id);

let activeProvider = null;
let connectedAddress = null;
const discoveredWallets = [];

// Cloudflare Turnstile (bot-check) token, set by the widget's callback in
// airdrop.html once the visitor passes the check. Turnstile tokens are
// single-use and expire after a few minutes, so we clear this on
// expiry/error and after every claim attempt, and re-request it via
// window.turnstile.reset() so a fresh token is ready for the next try.
let turnstileToken = null;
window.onTurnstileSuccess = token => { turnstileToken = token; };
window.onTurnstileExpired = () => { turnstileToken = null; };

window.addEventListener("eip6963:announceProvider", event => {
  const detail = event.detail;
  if (!detail?.info?.uuid) return;
  if (discoveredWallets.some(w => w.info.uuid === detail.info.uuid)) return;
  discoveredWallets.push(detail);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

// TODO: replace with your own free Project ID from https://cloud.reown.com
// (formerly WalletConnect Cloud). Required for the "Other Wallets
// (WalletConnect)" option to work - without a real Project ID that option
// will show an error when chosen, but every other wallet-connect path is
// unaffected.
const WALLETCONNECT_PROJECT_ID = "0a0744ab9912dfdd69a3e184f20403b2";

let wcProvider = null;

// Wallet logos: served through our own Worker (/api/wallet-icon), which
// fetches each wallet's official site icon once and caches it. If an icon
// can't load, a 🔗 placeholder is shown instead.
const walletIcon = domain => `/api/wallet-icon?d=${encodeURIComponent(domain)}`;

// UPDATED: WalletConnect is now loaded as an ES module (with a second CDN as
// backup) instead of the old UMD <script>. The UMD build couldn't load
// WalletConnect's QR/wallet-list modal, so tapping "Other Wallets" just
// hung with no reaction. We also no longer depend on that modal at all: we
// show our own panel (wallet buttons on mobile, QR code on desktop).
async function loadWalletConnectLib() {
  const sources = [
    "https://esm.sh/@walletconnect/ethereum-provider@2.17.0",
    "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.17.0/+esm"
  ];
  for (const src of sources) {
    try {
      const m = await import(src);
      const EP = m.EthereumProvider || m.default?.EthereumProvider || m.default;
      if (EP?.init) return EP;
    } catch (err) {
      console.warn("WalletConnect load failed from", src, err);
    }
  }
  throw new Error("WalletConnect couldn't load. Paste your wallet address below instead, or open this page inside your wallet app's browser.");
}

async function getWalletConnectProvider() {
  if (wcProvider) return wcProvider;
  const EP = await loadWalletConnectLib();
  const provider = await EP.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    optionalChains: [56],
    rpcMap: { 56: "https://bsc-dataseed.binance.org/" },
    showQrModal: false,
    metadata: {
      name: "GOLDITY",
      description: "GOLDITY (GDTY) 10K Airdrop",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.png`]
    }
  });
  provider.on("display_uri", uri => {
    const app = pendingWcApp && WC_APPS[pendingWcApp];
    if (app) openWalletAppDirect(app, uri);
    else showWalletConnectPanel(uri);
  });
  provider.on("connect", () => closeWalletConnectPanel());
  wcProvider = provider;
  return wcProvider;
}

// UPDATED: mobile wallet apps that connect DIRECTLY over WalletConnect.
// Tapping one keeps the user in Chrome/Safari: the wallet app opens only to
// approve the connection, then the user comes back to this same page,
// already connected. (Previously these buttons re-opened the whole site
// inside the wallet's own browser.)
const WC_APPS = {
  trust:   { name: "Trust Wallet",  icon: walletIcon("trustwallet.com"),  open: "https://link.trustwallet.com/wc", link: u => `https://link.trustwallet.com/wc?uri=${encodeURIComponent(u)}` },
  metamask:{ name: "MetaMask",      icon: walletIcon("metamask.io"),      open: "https://metamask.app.link/",     link: u => `https://metamask.app.link/wc?uri=${encodeURIComponent(u)}` },
  okx:     { name: "OKX Wallet",    icon: walletIcon("okx.com"),          open: "okx://main",                     link: u => `okx://main/wc?uri=${encodeURIComponent(u)}` },
  bitget:  { name: "Bitget Wallet", icon: walletIcon("web3.bitget.com"),  open: "bitkeep://",                     link: u => `bitkeep://wc?uri=${encodeURIComponent(u)}` },
  tp:      { name: "TokenPocket",   icon: walletIcon("tokenpocket.pro"),  open: "tpoutside://",                   link: u => `tpoutside://wc?uri=${encodeURIComponent(u)}` },
  safepal: { name: "SafePal",       icon: walletIcon("safepal.com"),      open: "safepalwallet://",               link: u => `safepalwallet://wc?uri=${encodeURIComponent(u)}` }
};
// The wallet app the current WalletConnect session was made with (so later
// requests like "Add GDTY" can bring that app to the front on mobile).
let connectedWcApp = null;
// Increases on every connect attempt / cancel, so a late answer from an
// abandoned attempt can't suddenly change the page.
let connectAttempt = 0;

// Rejects if a wallet never answers (some ignore unsupported requests),
// so buttons can't stay stuck on "Connecting…" / "Adding…" forever.
function withTimeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(message)), ms))]);
}
// Which wallet app the user picked, so the WalletConnect link is sent
// straight to that app instead of showing a generic list first.
let pendingWcApp = null;

let wcPanel = null;
function closeWalletConnectPanel() {
  wcPanel?.remove();
  wcPanel = null;
}

function loadQrLib() {
  if (window.QRCode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    sc.onload = resolve;
    sc.onerror = reject;
    document.head.appendChild(sc);
  });
}

function iconHtml(src) {
  return src
    ? `<img src="${src}" alt="" width="26" height="26" onerror="this.outerHTML='<span class=&quot;wallet-picker-icon-fallback&quot;>🔗</span>'">`
    : `<span class="wallet-picker-icon-fallback" aria-hidden="true">🔗</span>`;
}

function showWalletConnectPanel(uri) {
  closeWalletConnectPanel();
  const mobile = isMobileDevice();
  const apps = [
    ...Object.values(WC_APPS).map(a => ({ name: a.name, icon: a.icon, href: a.link(uri) })),
    { name: "Other wallet app", icon: walletIcon("walletconnect.com"), href: uri }
  ];
  wcPanel = document.createElement("div");
  wcPanel.className = "wallet-picker-overlay";
  wcPanel.innerHTML = `
    <div class="wallet-picker" role="dialog" aria-label="Connect with WalletConnect">
      <h3>Connect with WalletConnect</h3>
      ${mobile ? `
        <p class="wallet-picker-hint">Tap your wallet app, approve the connection there, then come back to this page.</p>
        <div class="wallet-picker-list">
          ${apps.map(a => `<a class="wallet-picker-item" href="${a.href}" rel="noopener">${iconHtml(a.icon)}<span>${a.name}</span></a>`).join("")}
        </div>` : `
        <p class="wallet-picker-hint">Scan this QR code with your wallet app (Trust Wallet, MetaMask, OKX…), then approve the connection.</p>
        <div id="wcQr" style="display:flex;justify-content:center;padding:12px;background:#fff;border-radius:10px"></div>`}
      <button type="button" class="wallet-picker-cancel" id="wcCopy">Copy connection link</button>
      <button type="button" class="wallet-picker-cancel" id="wcClose">Cancel</button>
    </div>`;
  document.body.appendChild(wcPanel);
  wcPanel.querySelector("#wcClose").addEventListener("click", () => {
    cancelWalletConnect();
  });
  wcPanel.querySelector("#wcCopy").addEventListener("click", async e => {
    try { await navigator.clipboard.writeText(uri); e.target.textContent = "Copied ✓"; }
    catch { window.prompt("Copy this link:", uri); }
  });
  if (!mobile) {
    loadQrLib().then(() => {
      const box = document.getElementById("wcQr");
      if (box) new window.QRCode(box, { text: uri, width: 240, height: 240, correctLevel: window.QRCode.CorrectLevel.L });
    }).catch(() => {
      const box = document.getElementById("wcQr");
      if (box) box.outerHTML = `<p class="wallet-picker-hint">QR code couldn't load - use "Copy connection link" and paste it into your wallet app.</p>`;
    });
  }
}

// Opens the chosen wallet app to approve the connection. The automatic
// redirect can be blocked by some browsers (it isn't a direct tap), so a
// big "Open <wallet>" button is shown as well - one tap always works.
function openWalletAppDirect(app, uri) {
  closeWalletConnectPanel();
  const href = app.link(uri);
  wcPanel = document.createElement("div");
  wcPanel.className = "wallet-picker-overlay";
  wcPanel.innerHTML = `
    <div class="wallet-picker" role="dialog" aria-label="Approve in ${app.name}">
      <h3>Approve in ${app.name}</h3>
      <p class="wallet-picker-hint">${app.name} is opening. Approve the connection there, then come back to this page - it will connect automatically.</p>
      <div class="wallet-picker-list">
        <a class="wallet-picker-item" href="${href}" rel="noopener">${iconHtml(app.icon)}<span>Open ${app.name}</span></a>
      </div>
      <button type="button" class="wallet-picker-cancel" id="wcClose">Cancel</button>
    </div>`;
  document.body.appendChild(wcPanel);
  wcPanel.querySelector("#wcClose").addEventListener("click", () => {
    cancelWalletConnect();
  });
  setState(`Opening ${app.name}… Approve the connection, then return here.`);
  try { window.location.href = href; } catch {}
}

function cancelWalletConnect() {
  connectAttempt++;
  pendingWcApp = null;
  closeWalletConnectPanel();
  // Start a clean WalletConnect session next time instead of reusing a
  // half-finished pairing.
  try { Promise.resolve(wcProvider?.disconnect?.()).catch(() => {}); } catch {}
  wcProvider = null;
  resetConnectButton();
  setState("Connection cancelled. You can try again or paste your address below.");
}

function resetConnectButton() {
  const btn = $("connectWallet");
  if (btn && !connectedAddress) { btn.disabled = false; btn.textContent = "Connect Wallet"; }
}

const WALLETCONNECT_ENTRY = {
  info: { name: "Other Wallets (WalletConnect)", icon: walletIcon("walletconnect.com") },
  special: "walletconnect"
};

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Named wallet-app entries for mobile. Each one connects through
// WalletConnect directly to that app (see WC_APPS above) - the site stays
// open in the user's normal browser.
function buildNamedWalletApps() {
  return Object.entries(WC_APPS).map(([key, a]) => ({
    info: { name: a.name, icon: a.icon },
    special: "wcapp",
    key
  }));
}

// UPDATED: resolves { provider } or { reason } so a cancelled picker, a
// deep-link redirect and a real failure each show their own message instead
// of all ending in "No wallet detected".
async function connectViaOption(chosen, resolve) {
  if (!chosen) { resolve({ reason: "cancelled" }); return; }
  if (chosen.special === "wcapp" || chosen.special === "walletconnect") {
    pendingWcApp = chosen.special === "wcapp" ? chosen.key : null;
    setState(pendingWcApp ? `Connecting to ${chosen.info.name}…` : "Starting WalletConnect…");
    try {
      resolve({ provider: await getWalletConnectProvider() });
    } catch (err) {
      resolve({ reason: "error", message: err?.message || "Could not start WalletConnect. Please refresh the page and try again." });
    }
    return;
  }
  resolve({ provider: chosen.provider });
}

function pickWalletProvider() {
  // Ask again at click time: some in-app wallet browsers inject late.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return new Promise(resolve => {
    setTimeout(() => {
      const options = [...discoveredWallets];
      if (window.ethereum && !options.length) {
        options.push({ info: { name: "Browser Wallet", icon: "" }, provider: window.ethereum });
      }
      // Only offer wallet-app buttons when we're NOT already inside a
      // wallet's own browser (there the injected wallet above is used).
      if (isMobileDevice() && !window.ethereum && !discoveredWallets.length) {
        options.push(...buildNamedWalletApps());
      }
      options.push(WALLETCONNECT_ENTRY);

      if (options.length === 1) {
        // Nothing injected/discovered and not on mobile - go straight to
        // WalletConnect (its own modal offers a QR code plus deep links to
        // hundreds of wallets).
        connectViaOption(WALLETCONNECT_ENTRY, resolve);
        return;
      }
      showWalletPicker(options, chosen => connectViaOption(chosen, resolve));
    }, 300);
  });
}

function showWalletPicker(wallets, onChoose) {
  const overlay = document.createElement("div");
  overlay.className = "wallet-picker-overlay";
  overlay.innerHTML = `
    <div class="wallet-picker" role="dialog" aria-label="Choose a wallet">
      <h3>Choose a wallet</h3>
      <p class="wallet-picker-hint">${isMobileDevice() && !window.ethereum ? "Tap your wallet app: it opens to approve the connection, then you come back here." : "Don't see your wallet listed? Choose \"Other Wallets (WalletConnect)\" to connect with any wallet app via QR code or deep link."}</p>
      <div class="wallet-picker-list">
        ${wallets.map((w, i) => `
          <button type="button" class="wallet-picker-item" data-idx="${i}">
            ${iconHtml(w.info.icon)}
            <span>${w.info.name}</span>
          </button>
        `).join("")}
      </div>
      <button type="button" class="wallet-picker-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const cleanup = result => { overlay.remove(); onChoose(result); };
  overlay.querySelectorAll(".wallet-picker-item").forEach(btn => {
    btn.addEventListener("click", () => cleanup(wallets[Number(btn.dataset.idx)]));
  });
  overlay.querySelector(".wallet-picker-cancel")?.addEventListener("click", () => cleanup(null));
  overlay.addEventListener("click", e => { if (e.target === overlay) cleanup(null); });
}

function setState(message, error = false, scroll = true) {
  const el = $("airdropState");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", error);
  if (message && scroll) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function markStep(id) {
  ["stepConnect", "stepAdd", "stepClaim"].forEach(s => $(s)?.classList.remove("active", "done"));
  const order = ["stepConnect", "stepAdd", "stepClaim"];
  const idx = order.indexOf(id);
  order.forEach((s, i) => {
    if (i < idx) $(s)?.classList.add("done");
    if (i === idx) $(s)?.classList.add("active");
  });
}

async function loadStatus() {
  try {
    const res = await fetch(API_BASE + "/api/airdrop/status");
    const data = await res.json();
    if (!res.ok || !data.ok) return;
    $("airdropClaimed").textContent = `${data.claimed.toLocaleString()} / ${data.max.toLocaleString()}`;
    const pct = Math.min(100, (data.claimed / data.max) * 100);
    $("airdropProgressFill").style.width = pct + "%";
    if (data.paused) {
      setState("The airdrop is currently paused. Please check back later.", true, false);
      $("connectWallet").disabled = true;
    } else if (data.remaining <= 0) {
      setState("All 10,000 claims have been taken. Thanks for your interest!", true, false);
      $("connectWallet").disabled = true;
    }
  } catch {}
}

$("connectWallet")?.addEventListener("click", async () => {
  const btn = $("connectWallet");
  btn.disabled = true;
  btn.textContent = "Connecting…";
  const attempt = ++connectAttempt;
  const picked = await pickWalletProvider();
  if (!picked?.provider) {
    resetConnectButton();
    if (picked?.reason === "error") {
      setState(picked.message, true);
      openManualBox();
    } else if (picked?.reason === "cancelled") {
      setState("No wallet selected. You can also paste your wallet address below.");
      openManualBox();
    }
    return; // "redirect": the page is leaving for the wallet app
  }
  const provider = picked.provider;
  activeProvider = provider;
  try {
    const wcApp = pendingWcApp;
    let accounts;
    if (provider === wcProvider) {
      // WalletConnect needs a session BEFORE any request: connect() pairs
      // with the wallet app (this is what opens it), then the approved
      // accounts are read from the session. Calling request() first throws
      // "Please call connect() before request()".
      if (!provider.session) await provider.connect();
      accounts = provider.accounts?.length ? provider.accounts : await provider.request({ method: "eth_accounts" });
    } else {
      accounts = await provider.request({ method: "eth_requestAccounts" });
    }
    if (attempt !== connectAttempt) return; // user cancelled this attempt
    connectedAddress = accounts?.[0];
    closeWalletConnectPanel();
    connectedWcApp = provider === wcProvider ? wcApp : null;
    pendingWcApp = null;
    if (!connectedAddress) { resetConnectButton(); setState("Your wallet didn't share an address. Unlock it and try again, or paste your address below.", true); openManualBox(); return; }
    $("airdropWalletWrap").style.display = "";
    $("airdropWalletAddress").textContent = connectedAddress;
    $("addGdtyToken").disabled = false;
    $("claimAirdrop").disabled = false;
    $("connectWallet").textContent = "Wallet Connected";
    $("connectWallet").disabled = true;
    setState("Wallet connected. Add GDTY to your wallet, then claim.");
    markStep("stepAdd");
  } catch (err) {
    if (attempt !== connectAttempt) return;
    closeWalletConnectPanel();
    pendingWcApp = null;
    resetConnectButton();
    setState(err?.code === 4001
      ? "Connection request was rejected in your wallet. Try again, or paste your address below."
      : (err?.message || "Could not connect wallet.") + " You can also paste your address below.", true);
    openManualBox();
  }
});

function openManualBox() {
  const box = $("manualAddressBox");
  if (box) box.open = true;
}

// Manual address fallback: the claim endpoint only needs the receiving
// address, so users whose wallet won't connect can still claim.
$("useManualAddress")?.addEventListener("click", () => {
  const value = String($("manualAddress")?.value || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    setState("That doesn't look like a valid BSC address. It should start with 0x and be 42 characters long.", true);
    return;
  }
  connectedAddress = value;
  activeProvider = null;
  $("airdropWalletWrap").style.display = "";
  $("airdropWalletAddress").textContent = connectedAddress;
  $("addGdtyToken").disabled = true;
  $("claimAirdrop").disabled = false;
  setState("Address set. Complete the verification check, then press \"Claim 0.03 GDTY\". Add GDTY to your wallet manually using the contract address to see it.");
  markStep("stepClaim");
});

async function ensureBscNetwork(provider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x38",
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: ["https://bsc-dataseed.binance.org/"],
          blockExplorerUrls: ["https://bscscan.com"]
        }]
      });
    } else {
      throw switchError;
    }
  }
}

$("addGdtyToken")?.addEventListener("click", async () => {
  if (!activeProvider) return;
  const btn = $("addGdtyToken");
  if (btn) { btn.disabled = true; btn.textContent = "Adding…"; }
  const viaWc = activeProvider === wcProvider;
  // Over WalletConnect the request is answered inside the wallet app, so on
  // mobile bring that app to the front - otherwise nothing visibly happens.
  const bringWalletForward = () => {
    const app = connectedWcApp && WC_APPS[connectedWcApp];
    if (viaWc && app && isMobileDevice()) setTimeout(() => { try { window.location.href = app.open; } catch {} }, 300);
  };
  try {
    // A WalletConnect session is already on BNB Smart Chain (chain 56).
    if (!viaWc) await withTimeout(ensureBscNetwork(activeProvider), 60000, "Your wallet didn't respond.");
  } catch (err) {
    console.error("Switch network:", err);
    setState(err?.message || "Couldn't switch to BNB Smart Chain in your wallet. Please switch networks manually, then try again.", true);
    if (btn) { btn.disabled = false; btn.textContent = "Add GDTY to Wallet"; }
    return;
  }
  try {
    const request = activeProvider.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801",
          symbol: "GDTY",
          decimals: 18,
          image: `${window.location.origin}/favicon.png`
        }
      }
    });
    if (viaWc) setState("Approve adding GDTY in your wallet app, then come back here.");
    bringWalletForward();
    const added = await withTimeout(request, 60000, "Your wallet didn't respond");
    if (btn) { btn.textContent = "Added ✓"; }
    setState(added === false
      ? "You can still claim below - GDTY just wasn't added to your wallet's token list."
      : "GDTY added to your wallet. Now click \"Claim 0.03 GDTY\" below.");
    markStep("stepClaim");
  } catch (err) {
    // Some wallets (mobile wallets in particular) don't support
    // wallet_watchAsset at all and reject/throw here even though the network
    // switch above succeeded - that's why the button looked like it did
    // nothing. Claiming doesn't actually require this step to succeed (the
    // Claim button is already enabled once the wallet is connected), so we
    // tell the user that plainly instead of leaving them stuck.
    console.error("Add to wallet:", err);
    setState(err?.message
      ? `Couldn't add GDTY automatically (${err.message}). You can add it manually in your wallet later - your claim below will still work.`
      : "Couldn't add GDTY automatically. You can add it manually in your wallet later - your claim below will still work.", true);
    if (btn) { btn.disabled = false; btn.textContent = "Add GDTY to Wallet"; }
    markStep("stepClaim");
  }
});

$("claimAirdrop")?.addEventListener("click", async () => {
  if (!connectedAddress) return;
  if (!turnstileToken) {
    setState("Please complete the verification check (\"Verify you are human\") above, then try again.", true);
    return;
  }
  $("claimAirdrop").disabled = true;
  setState("Sending your claim…");
  try {
    const res = await fetch(API_BASE + "/api/airdrop/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: connectedAddress, turnstileToken })
    });
    const data = await res.json().catch(() => ({}));
    // Turnstile tokens are single-use - reset the widget so a fresh one is
    // requested for the next attempt, whether this one succeeded or not.
    turnstileToken = null;
    window.turnstile?.reset("#turnstileWidget");
    if (!res.ok || !data.ok) {
      const messages = {
        wallet_already_claimed: "This wallet has already claimed the airdrop.",
        ip_limit_reached: "You've reached the maximum number of claims allowed from your network.",
        ip_attempts_exhausted: "Your network has used all 5 claim attempts allowed. No more claims can be made from this connection.",
        wallet_not_eligible: "This wallet isn't eligible. To claim, your wallet must hold at least $1 in total on BNB Smart Chain (BNB, USDT, USDC, ETH, BTCB, CAKE, XRP and other popular tokens all count together).",
        eligibility_check_failed: "We couldn't check your wallet on BNB Smart Chain right now. Please try again in a moment.",
        airdrop_busy: "Lots of people are claiming right now. Please wait a minute and try again.",
        airdrop_full: "All 10,000 claims have been taken. Thanks for your interest!",
        airdrop_paused: "The airdrop is currently paused. Please check back later.",
        rate_limited: "Too many attempts. Please wait a moment and try again.",
        invalid_wallet: "Could not read a valid wallet address.",
        airdrop_treasury_empty: "The airdrop pool is temporarily unavailable. Please try again later.",
        airdrop_not_configured: "The airdrop isn't fully set up yet. Please check back soon.",
        forbidden: "Your browser blocked this request. If you're in an app's built-in browser (Instagram, Facebook, etc.), try opening this page in Chrome or Safari instead, then try again.",
        validation_failed: "Could not read a valid wallet address.",
        captcha_failed: "Verification failed. Please complete the check above and try again.",
        airdrop_send_failed: "The network was busy and your claim wasn't sent. Nothing was used up - please try again.",
        claim_pending_check: "Your claim is being processed by the network. Please don't claim again - check your wallet in a few minutes. If GDTY doesn't arrive, contact support with your wallet address.",
        db_busy: "The airdrop is experiencing very high traffic right now. Please wait a moment and try again."
      };
      setState(messages[data.error] || `Could not process your claim${data.error ? ` (${data.error})` : ""}. Please try again.`, true);
      // Don't invite a retry while the network may still deliver this claim.
      $("claimAirdrop").disabled = data.error === "claim_pending_check";
      return;
    }
    setState("");
    $("airdropSuccess").style.display = "";
    $("airdropTxLink").href = `https://bscscan.com/tx/${encodeURIComponent(data.txHash)}`;
    $("claimAirdrop").style.display = "none";
    loadStatus();
  } catch {
    turnstileToken = null;
    window.turnstile?.reset("#turnstileWidget");
    setState("Could not process your claim. Please try again.", true);
    $("claimAirdrop").disabled = false;
  }
});

loadStatus();
setInterval(loadStatus, 15000);
