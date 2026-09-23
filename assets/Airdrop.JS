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

function pickWalletProvider() {
  return new Promise(resolve => {
    setTimeout(() => {
      if (discoveredWallets.length === 0) { resolve(window.ethereum || null); return; }
      if (discoveredWallets.length === 1) { resolve(discoveredWallets[0].provider); return; }
      showWalletPicker(discoveredWallets, chosen => resolve(chosen ? chosen.provider : null));
    }, 150);
  });
}

function showWalletPicker(wallets, onChoose) {
  const overlay = document.createElement("div");
  overlay.className = "wallet-picker-overlay";
  overlay.innerHTML = `
    <div class="wallet-picker" role="dialog" aria-label="Choose a wallet">
      <h3>Choose a wallet</h3>
      <div class="wallet-picker-list">
        ${wallets.map((w, i) => `
          <button type="button" class="wallet-picker-item" data-idx="${i}">
            <img src="${w.info.icon}" alt="" width="26" height="26">
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

$("addGdtyToken")?.addEventListener("click", async () => {
  if (!activeProvider) return;
  try {
    await activeProvider.request({
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
    markStep("stepClaim");
  } catch (err) {
    console.error("Add to wallet:", err);
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
        already_claimed: "A claim has already been made from your network. One claim per person.",
        airdrop_full: "All 10,000 claims have been taken. Thanks for your interest!",
        airdrop_paused: "The airdrop is currently paused. Please check back later.",
        rate_limited: "Too many attempts. Please wait a moment and try again.",
        invalid_wallet: "Could not read a valid wallet address.",
        airdrop_treasury_empty: "The airdrop pool is temporarily unavailable. Please try again later.",
        airdrop_not_configured: "The airdrop isn't fully set up yet. Please check back soon."
      };
      setState(messages[data.error] || "Could not process your claim. Please try again.", true);
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
