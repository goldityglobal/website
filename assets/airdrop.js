const API_BASE = "";
const $ = id => document.getElementById(id);

let activeProvider = null;
let connectedAddress = null;
const discoveredWallets = [];

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
async function getWalletConnectProvider() {
  if (wcProvider) return wcProvider;
  if (!window.EthereumProvider) {
    throw new Error("WalletConnect failed to load. Please check your connection and try again.");
  }
  wcProvider = await window.EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    chains: [56],
    optionalChains: [56],
    showQrModal: true,
    metadata: {
      name: "GOLDITY",
      description: "GOLDITY (GDTY) 10K Airdrop",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.png`]
    }
  });
  return wcProvider;
}

const WALLETCONNECT_ENTRY = {
  info: { name: "Other Wallets (WalletConnect)", icon: "" },
  special: "walletconnect"
};

async function connectViaOption(chosen, resolve) {
  if (!chosen) { resolve(null); return; }
  if (chosen.special === "walletconnect") {
    try {
      const p = await getWalletConnectProvider();
      resolve(p);
    } catch (err) {
      setState(err?.message || "Could not start WalletConnect. Please refresh the page and try again.", true);
      resolve(null);
    }
    return;
  }
  resolve(chosen.provider);
}

function pickWalletProvider() {
  return new Promise(resolve => {
    setTimeout(() => {
      const options = [...discoveredWallets];
      if (window.ethereum && !options.length) {
        options.push({ info: { name: "Browser Wallet", icon: "" }, provider: window.ethereum });
      }
      options.push(WALLETCONNECT_ENTRY);

      if (options.length === 1) {
        // Nothing injected/discovered - go straight to WalletConnect
        // (its own modal offers a QR code plus deep links to hundreds of wallets).
        connectViaOption(WALLETCONNECT_ENTRY, resolve);
        return;
      }
      showWalletPicker(options, chosen => connectViaOption(chosen, resolve));
    }, 150);
  });
}

function showWalletPicker(wallets, onChoose) {
  const overlay = document.createElement("div");
  overlay.className = "wallet-picker-overlay";
  overlay.innerHTML = `
    <div class="wallet-picker" role="dialog" aria-label="Choose a wallet">
      <h3>Choose a wallet</h3>
      <p class="wallet-picker-hint">Don't see your wallet listed? Choose "Other Wallets (WalletConnect)" to connect with any wallet app via QR code or deep link.</p>
      <div class="wallet-picker-list">
        ${wallets.map((w, i) => `
          <button type="button" class="wallet-picker-item" data-idx="${i}">
            ${w.info.icon ? `<img src="${w.info.icon}" alt="" width="26" height="26">` : `<span class="wallet-picker-icon-fallback" aria-hidden="true">🔗</span>`}
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

function setState(message, error = false) {
  const el = $("airdropState");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", error);
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
      setState("The airdrop is currently paused. Please check back later.", true);
      $("connectWallet").disabled = true;
    } else if (data.remaining <= 0) {
      setState("All 10,000 claims have been taken. Thanks for your interest!", true);
      $("connectWallet").disabled = true;
    }
  } catch {}
}

$("connectWallet")?.addEventListener("click", async () => {
  const provider = await pickWalletProvider();
  if (!provider) {
    setState("No wallet detected. Open this page inside your wallet's browser (e.g. MetaMask app) first.", true);
    return;
  }
  activeProvider = provider;
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    connectedAddress = accounts?.[0];
    if (!connectedAddress) { setState("No wallet account available.", true); return; }
    $("airdropWalletWrap").style.display = "";
    $("airdropWalletAddress").textContent = connectedAddress;
    $("addGdtyToken").disabled = false;
    $("claimAirdrop").disabled = false;
    $("connectWallet").textContent = "Wallet Connected";
    $("connectWallet").disabled = true;
    setState("Wallet connected. Add GDTY to your wallet, then claim.");
    markStep("stepAdd");
  } catch (err) {
    setState(err.message || "Could not connect wallet.", true);
  }
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
  try {
    await ensureBscNetwork(activeProvider);
  } catch (err) {
    console.error("Switch network:", err);
    setState(err?.message || "Couldn't switch to BNB Smart Chain in your wallet. Please switch networks manually, then try again.", true);
    if (btn) { btn.disabled = false; btn.textContent = "Add GDTY to Wallet"; }
    return;
  }
  try {
    const added = await activeProvider.request({
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
  $("claimAirdrop").disabled = true;
  setState("Sending your claim…");
  try {
    const res = await fetch(API_BASE + "/api/airdrop/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: connectedAddress })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const messages = {
        wallet_already_claimed: "This wallet has already claimed the airdrop.",
        ip_limit_reached: "You've reached the maximum number of claims allowed from your network (100).",
        airdrop_full: "All 10,000 claims have been taken. Thanks for your interest!",
        airdrop_paused: "The airdrop is currently paused. Please check back later.",
        rate_limited: "Too many attempts. Please wait a moment and try again.",
        invalid_wallet: "Could not read a valid wallet address.",
        airdrop_treasury_empty: "The airdrop pool is temporarily unavailable. Please try again later.",
        airdrop_not_configured: "The airdrop isn't fully set up yet. Please check back soon.",
        forbidden: "Your browser blocked this request. If you're in an app's built-in browser (Instagram, Facebook, etc.), try opening this page in Chrome or Safari instead, then try again.",
        validation_failed: "Could not read a valid wallet address."
      };
      setState(messages[data.error] || `Could not process your claim${data.error ? ` (${data.error})` : ""}. Please try again.`, true);
      $("claimAirdrop").disabled = false;
      return;
    }
    setState("");
    $("airdropSuccess").style.display = "";
    $("airdropTxLink").href = `https://bscscan.com/tx/${encodeURIComponent(data.txHash)}`;
    $("claimAirdrop").style.display = "none";
    loadStatus();
  } catch {
    setState("Could not process your claim. Please try again.", true);
    $("claimAirdrop").disabled = false;
  }
});

loadStatus();
setInterval(loadStatus, 15000);
