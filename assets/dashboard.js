const API_BASE = "";

 

 

 


 


 

 

 


 


 



 


 


 

 

 

const $ = id => document.getElementById(id);

 

 

 

const fmt = (value, digits = 4) => {

 

  const n = Number(value || 0);

 

  if (!Number.isFinite(n)) return "—";

 

  return n.toLocaleString("en-US", {

 

    maximumFractionDigits: digits

 

  });

 

};

 

 

 

const fmtGdty = wei => {

 

  try {

 

    return `${fmt(Number(BigInt(wei || "0")) / 1e18, 4)} GDTY`;

 

  } catch {

 

    return "0 GDTY";

 

  }

 

};

 

 

 

const fmtUsdt = wei => {

 

  try {

 

    return `$${fmt(Number(BigInt(wei || "0")) / 1e18, 4)}`;

 

  } catch {

 

    return "$0";

 

  }

 

};

 

 

 

const shortAddress = address => {

 

  if (!address) return "—";

 

  return `${address.slice(0, 6)}…${address.slice(-4)}`;

 

};

 

 

 

const shortTx = tx => {

 

  if (!tx) return "—";

 

  return `${tx.slice(0, 8)}…${tx.slice(-6)}`;

 

};

 

 

 

const setText = (id, value) => {

 

  const el = $(id);

 

  if (el) el.textContent = value;

 

};

 

 

 

function setState(message, error = false) {

 

  const el = $("accountState");

 

  if (!el) return;

 

 

 

  el.textContent = message;

 

  el.classList.toggle("error", error);

 

}

 

 

 

async function api(path, options = {}) {

 

  const response = await fetch(API_BASE + path, {

 

    credentials: "include",

 

    ...options,

 

    headers: {

 

      "content-type": "application/json",

 

      ...(options.headers || {})

 

    }

 

  });

 

 

 

  const data = await response.json().catch(() => ({}));

 

 

 

  if (!response.ok) {

 

    throw new Error(

 

      data.message ||

 

      data.error ||

 

      "Request failed."

 

    );

 

  }

 

 

 

  return data;

 

}

 

 

 

 

 

/* =========================

 

   ACCOUNT

 

========================= */

 

 

 

function renderAccount(data) {

 

  const user = data.user;

 

 

 

  setText(

 

    "name",

 

    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "—"

 

  );

 

 

 

  setText("email", user.email || "—");

 

  setText("country", user.country || "—");

 

  setText(

 

    "accountStatus",

 

    user.emailVerified === false ? "Pending" : "Active"

 

  );

 

 

 

}

 

 

 

 

 

/* =========================

 

   WALLET

 

========================= */

 

 

 

function renderNotifications(items) {

 

  const container = $("notifications");

 

 

 

  if (!container) return;

 

 

 

  container.innerHTML = "";

 

 

 

  if (!items || !items.length) {

 

    const card = document.createElement("div");

 

 

 

    card.className = "dashboard-card";

 

    card.textContent = "No notifications.";

 

 

 

    container.appendChild(card);

 

    return;

 

  }

 

 

 

  for (const item of items) {

 

    const card = document.createElement("div");

 

 

 

    card.className =

 

      "dashboard-card notification-item";

 

 

 

    const title = document.createElement("strong");

 

    title.textContent = item.title || "Notification";

 

 

 

    const message = document.createElement("p");

 

    message.textContent = item.message || "";

 

 

 

    const date = document.createElement("small");

 

    date.textContent = item.createdAt

 

      ? new Date(item.createdAt).toLocaleString()

 

      : "";

 

 

 

    card.appendChild(title);

 

    card.appendChild(message);

 

    card.appendChild(date);

 

 

 

    container.appendChild(card);

 

  }

 

}

 

 

 

 

 

/* =========================

 

   SUPPORT

 

========================= */

 

 

 

let currentTickets = [];

function renderTickets(tickets) {



  currentTickets = tickets || [];

  const container = $("ticketList");

 

 

 

  if (!container) return;

 

 

 

  container.innerHTML = "";

 

 

 

  if (!tickets || !tickets.length) {

 

    const card = document.createElement("div");

 

 

 

    card.className = "dashboard-card";

 

    card.textContent = "No support tickets.";

 

 

 

    container.appendChild(card);

 

    return;

 

  }

 

 

 

  for (const ticket of tickets) {

 

    const card = document.createElement("div");

 

 

 

    card.className = "dashboard-card ticket-card";

 

 

 

    const title = document.createElement("strong");

 

    title.textContent =

 

      `${ticket.ticketNumber || "Ticket"} — ${ticket.subject || ""}`;

 

 

 

    const meta = document.createElement("p");

 

 

 

    meta.textContent =

 

      `${ticket.category || "Other"} · ${ticket.status || "open"}`;

 

 

 

    card.appendChild(title);



    card.appendChild(meta);



    card.addEventListener("click", () => openTicketDetail(ticket));



    container.appendChild(card);

 

  }

 

}

 

 

 

async function loadTickets() {

 

  try {

 

    const data = await api(

 

      "/api/support/tickets"

 

    );

 

 

 

    renderTickets(data.tickets || []);

 

 

 

  } catch {



    renderTickets([]);



  }



}

/* =========================================================
   TICKET DETAIL / MESSAGE THREAD
========================================================= */
let currentTicketId = null;

function openTicketDetail(ticket) {
  currentTicketId = ticket.id;
  const titleEl = $("ticketDetailTitle");
  if (titleEl) titleEl.textContent = `${ticket.ticketNumber || "Ticket"} — ${ticket.subject || ""}`;
  $("ticketDetailSection")?.classList.remove("hidden");
  $("ticketFormSection")?.classList.add("hidden");
  loadTicketMessages(ticket.id);
}

function closeTicketDetail() {
  currentTicketId = null;
  $("ticketDetailSection")?.classList.add("hidden");
  const reply = $("ticketReplyMessage");
  if (reply) reply.value = "";
  setText("ticketReplyState", "");
}

async function loadTicketMessages(ticketId) {
  const container = $("ticketMessages");
  if (container) container.textContent = "Loading…";
  try {
    const data = await api(`/api/support/messages?ticket=${encodeURIComponent(ticketId)}`);
    renderTicketMessages(data.messages || []);
  } catch (error) {
    console.error("Load ticket messages:", error);
    if (container) container.textContent = "Couldn't load this conversation. Please try again.";
  }
}

function renderTicketMessages(messages) {
  const container = $("ticketMessages");
  if (!container) return;
  container.innerHTML = "";
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No messages yet.";
    container.appendChild(empty);
    return;
  }
  for (const msg of messages) {
    const isUser = msg.senderRole === "user";
    const bubble = document.createElement("div");
    bubble.className = `ticket-message ${isUser ? "from-user" : "from-admin"}`;

    const meta = document.createElement("span");
    meta.className = "ticket-message-meta";
    meta.textContent = `${isUser ? "You" : "GOLDITY Support"} · ${new Date(msg.createdAt).toLocaleString()}`;

    const body = document.createElement("p");
    body.textContent = msg.message;

    bubble.appendChild(meta);
    bubble.appendChild(body);
    container.appendChild(bubble);
  }
  container.scrollTop = container.scrollHeight;
}

function setupTicketDetail() {
  $("closeTicketDetail")?.addEventListener("click", closeTicketDetail);

  $("ticketReplyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentTicketId) return;
    const textarea = $("ticketReplyMessage");
    const message = textarea?.value.trim() || "";
    if (!message) return;
    const btn = $("sendTicketReply");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    setText("ticketReplyState", "Sending…");
    try {
      await api("/api/support/messages", {
        method: "POST",
        body: JSON.stringify({ ticketId: currentTicketId, message })
      });
      if (textarea) textarea.value = "";
      setText("ticketReplyState", "Message sent.");
      await loadTicketMessages(currentTicketId);
      await loadTickets();
    } catch (error) {
      console.error("Send ticket reply:", error);
      setText("ticketReplyState", "Couldn't send your message. Please try again.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Send Reply"; }
    }
  });
}



 

 

 

 

/* =========================

 

   COPY BUTTONS

 

========================= */

 

 

 

async function copyText(text, button) {

 

  if (!text) return;

 

 

 

  try {

 

    await navigator.clipboard.writeText(text);

 

 

 

    if (button) {

 

      const old = button.textContent;

 

 

 

      button.textContent = "Copied";

 

 

 

      setTimeout(() => {

 

        button.textContent = old;

 

      }, 1500);

 

    }

 

 

 

  } catch {

 

    window.prompt(

 

      "Copy this value:",

 

      text

 

    );

 

  }

 

}

 

 

 

function setupTicketForm() {

 

 

 

  $("newTicket")?.addEventListener(

 

    "click",

 

    () => {

 

 

 

      const section =

 

        $("ticketFormSection");

 

 

 

      if (!section) return;







      $("ticketDetailSection")?.classList.add("hidden");



      section.classList.remove(



        "hidden"



      );







      section.scrollIntoView({

 

        behavior:"smooth",

 

        block:"start"

 

      });

 

    }

 

  );

 

 

 

  $("cancelTicket")?.addEventListener(

 

    "click",

 

    () => {

 

 

 

      $("ticketFormSection")

 

        ?.classList.add("hidden");

 

 

 

      $("ticketForm")?.reset();

 

    }

 

  );

 

 

 

  $("ticketForm")?.addEventListener(

 

    "submit",

 

    async event => {

 

 

 

      event.preventDefault();

 

 

 

      const category =

 

        $("ticketCategory")?.value || "";

 

 

 

      const subject =

 

        $("ticketSubject")?.value.trim() || "";

 

 

 

      const message =

 

        $("ticketMessage")?.value.trim() || "";

 

 

 

      if (!category || !subject || !message) {

 

        setText(

 

          "supportState",

 

          "Please complete all ticket fields."

 

        );

 

        return;

 

      }

 

 

 

      try {

 

 

 

        setText(

 

          "supportState",

 

          "Submitting ticket…"

 

        );

 

 

 

        const data =

 

          await api(

 

            "/api/support/tickets",

 

            {

 

              method:"POST",

 

              body:JSON.stringify({

 

                category,

 

                subject,

 

                message

 

              })

 

            }

 

          );

 

 

 

        $("ticketForm")?.reset();

 

 

 

        $("ticketFormSection")

 

          ?.classList.add("hidden");

 

 

 

        setText(

 

          "supportState",

 

          `Ticket created: ${data.ticket.ticketNumber}`

 

        );

 

 

 

        await loadTickets();

 

 

 

      } catch (error) {

 

 

 

        setText(

 

          "supportState",

 

          error.message ||

 

          "Unable to create ticket."

 

        );

 

      }

 

    }

 

  );

 

}

 

 

 

 

 

/* =========================

 

   LOGOUT

 

========================= */

 

 

 

function setupLogout() {

 

 

 

  $("logout")?.addEventListener(

 

    "click",

 

    async () => {

 

 

 

      try {

 

        await fetch(

 

          API_BASE + "/api/logout",

 

          {

 

            method:"POST",

 

            credentials:"include"

 

          }

 

        );

 

      } finally {

 

        location.href = "/";

 

      }

 

    }

 

  );

 

}

 

 

 

 

 

/* =========================

 

   WALLET EVENTS

 

========================= */

 

 

 

/* =========================================================
   WALLET PROVIDER DISCOVERY (EIP-6963)
========================================================= */
let activeProvider = null;
const discoveredWallets = [];

window.addEventListener("eip6963:announceProvider", event => {
  const detail = event.detail;
  if (!detail?.info?.uuid) return;
  if (discoveredWallets.some(w => w.info.uuid === detail.info.uuid)) return;
  discoveredWallets.push(detail);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

function getEthereum() {
  return activeProvider || window.ethereum || null;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function showMobileWalletRedirect() {
  const currentUrl = window.location.href;
  const bareUrl = currentUrl.replace(/^https?:\/\//, "");
  const options = [
    { name: "Trust Wallet", url: `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}` },
    { name: "MetaMask", url: `https://metamask.app.link/dapp/${bareUrl}` },
    { name: "Coinbase Wallet", url: `https://go.cb-wallet.com/dapp?cb_url=${encodeURIComponent(currentUrl)}` },
    { name: "OKX Wallet", url: `https://web3.okx.com/download?deeplink=${encodeURIComponent('okx://wallet/dapp/url?dappUrl=' + encodeURIComponent(currentUrl))}` }
  ];
  const overlay = document.createElement("div");
  overlay.className = "wallet-picker-overlay";
  overlay.innerHTML = `
    <div class="wallet-picker" role="dialog" aria-label="Open in your wallet app">
      <h3>Open in your wallet app</h3>
      <p class="wallet-picker-hint">Your wallet app isn't detected in this browser. Tap your wallet below to open this page inside it.</p>
      <div class="wallet-picker-list">
        ${options.map(o => `<a class="wallet-picker-item" href="${o.url}">${o.name}</a>`).join("")}
      </div>
      <button type="button" class="wallet-picker-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const cleanup = () => overlay.remove();
  overlay.querySelector(".wallet-picker-cancel")?.addEventListener("click", cleanup);
  overlay.addEventListener("click", e => { if (e.target === overlay) cleanup(); });
}

function pickWalletProvider() {
  return new Promise(resolve => {
    setTimeout(() => {
      if (discoveredWallets.length === 0) {
        if (!window.ethereum && isMobileDevice()) { showMobileWalletRedirect(); resolve(null); return; }
        resolve(window.ethereum || null);
        return;
      }
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

function bindWalletEvents(eth) {
  if (!eth || eth.__gdtyBound) return;
  eth.__gdtyBound = true;
  eth.on?.("accountsChanged", () => load());
  eth.on?.("chainChanged", () => load());
}

async function connectWallet() {
  const provider = await pickWalletProvider();
  if (!provider) {
    setState("MetaMask or a compatible Web3 wallet is required.", true);
    return;
  }
  activeProvider = provider;
  bindWalletEvents(provider);
  try {
    await provider.request({ method: "eth_requestAccounts" });
    const chainId = await provider.request({ method: "eth_chainId" });
    if (chainId !== "0x38") {
      setState("Please switch your wallet network to BNB Smart Chain.", true);
      return;
    }
    const accounts = await provider.request({ method: "eth_accounts" });
    const address = accounts?.[0];
    if (!address) { setState("No wallet account available.", true); return; }

    setState("Requesting verification message…");
    const challenge = await api("/api/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ address })
    });

    setState("Please sign the message in your wallet…");
    const signature = await provider.request({
      method: "personal_sign",
      params: [challenge.message, address]
    });

    setState("Verifying signature…");
    await api("/api/wallet/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId: challenge.challengeId, signature })
    });

    setState("Wallet connected.");
    await load();
  } catch (err) {
    setState(err.message || "Could not connect wallet.", true);
  }
}

function renderWallet(wallet) {
  const statusEl = $("walletStatus");
  if (statusEl) statusEl.textContent = wallet?.connected ? "Connected" : "Not connected";
  setText("walletAddress", wallet?.connected ? wallet.address : "—");
}

/* =========================================================
   ADD TOKEN TO WALLET
========================================================= */
async function ensureBscNetwork(eth) {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await eth.request({
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

function setupAddToken() {
  $("addGdtyToken")?.addEventListener("click", async () => {
    const eth = getEthereum();
    if (!eth) {
      alert("No wallet detected. Open this page inside your wallet's browser (e.g. MetaMask app) first.");
      return;
    }
    try {
      await ensureBscNetwork(eth);
      await eth.request({
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
    } catch (error) {
      console.error("Add to wallet:", error);
      alert("Couldn't switch to BNB Smart Chain in your wallet. Please switch networks manually, then try again.");
    }
  });
}

function setupWalletEvents() {
  $("connectWallet")?.addEventListener("click", connectWallet);
  bindWalletEvents(getEthereum());
}

/* =========================================================
   REFERRAL RENDERING
========================================================= */
function renderRewards(user, rewards) {
  setText("ref", user?.referralCode || "—");
  setText("refs", String(user?.referrals || 0));
  const link = user?.referralCode ? `${location.origin}/register.html?ref=${encodeURIComponent(user.referralCode)}` : "";
  const linkInput = $("referralLink");
  if (linkInput) linkInput.value = link;

  setText("rewardPaid", fmtGdty(rewards?.paidWei || "0"));
  setText("rewardPending", fmtGdty(rewards?.pendingWei || "0"));
  setText("rewardFrozen", fmtGdty(rewards?.frozenWei || "0"));
}

function setupCopyButtons() {
  $("copyReferralCode")?.addEventListener("click", () => copyText($("ref")?.textContent || "", $("copyReferralCode")));
  $("copyReferralLink")?.addEventListener("click", () => copyText($("referralLink")?.value || "", $("copyReferralLink")));
}

/* =========================================================
   TRADE HISTORY RENDERING
========================================================= */
function renderTrades(trades) {
  const body = $("tradesBody");
  if (!body) return;
  if (!trades || !trades.length) {
    body.innerHTML = `<tr><td colspan="7">No verified trades yet.</td></tr>`;
    return;
  }
  body.innerHTML = trades.map(t => `
    <tr>
      <td>${new Date(t.createdAt).toLocaleDateString()}</td>
      <td>${t.dex || "—"}</td>
      <td>${t.side === "buy" ? "Buy" : "Sell"}</td>
      <td>${fmtGdty(t.gdtyAmountWei)}</td>
      <td>${fmtGdty(t.usdtAmountWei).replace("GDTY", "USDT")}</td>
      <td>${t.status}</td>
      <td><a href="https://bscscan.com/tx/${encodeURIComponent(t.txHash)}" target="_blank" rel="noopener noreferrer">${shortTx(t.txHash)}</a></td>
    </tr>
  `).join("");
}

/* =========================================================
   AIRDROP ADMIN
========================================================= */
function renderAirdropAdmin(stats) {
  const section = $("airdropAdminSection");
  if (!section) return;
  if (!stats) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  setText("airdropAdminClaimed", `${stats.claimed.toLocaleString()} / ${stats.max.toLocaleString()}`);
  setText("airdropAdminDistributed", fmtGdty(stats.distributedWei));
  setText("airdropAdminRemaining", stats.remaining.toLocaleString());
  setText("airdropAdminStatus", stats.paused ? "Paused" : "Active");
  const btn = $("toggleAirdropPause");
  if (btn) btn.textContent = stats.paused ? "Resume" : "Pause";
}

function setupAirdropAdmin() {
  $("toggleAirdropPause")?.addEventListener("click", async () => {
    try {
      await api("/api/airdrop/toggle-pause", { method: "POST" });
      await load();
    } catch (error) {
      console.error("Toggle airdrop pause:", error);
    }
  });
}

/* =========================================================
   REFERRAL REWARDS ADMIN
========================================================= */
function shortAddr(addr) {
  if (!addr) return "—";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

async function loadReferralAdmin() {
  const section = $("referralAdminSection");
  if (!section) return;
  try {
    const data = await api("/api/admin/referral-rewards");
    const rewards = data?.rewards || [];
    section.classList.remove("hidden");
    renderReferralAdmin(rewards);
  } catch (error) {
    console.error("Load referral admin:", error);
    section.classList.add("hidden");
  }
}

function renderReferralAdmin(rewards) {
  const body = $("referralAdminBody");
  if (!body) return;
  if (!rewards.length) {
    body.innerHTML = `<tr><td colspan="7">No flagged rewards right now.</td></tr>`;
    return;
  }
  body.innerHTML = rewards.map(r => `
    <tr>
      <td>${r.status === "frozen" ? "Under Review" : "Payout Failed"}</td>
      <td>${r.referrerEmail || "—"}<br><small>${shortAddr(r.referrerWallet)}</small></td>
      <td>${r.referredEmail || "—"}</td>
      <td>${fmtGdty(r.rewardAmountWei)}</td>
      <td>${r.sourceTxHash ? `<a href="https://bscscan.com/tx/${encodeURIComponent(r.sourceTxHash)}" target="_blank" rel="noopener noreferrer">${shortTx(r.sourceTxHash)}</a>` : "—"}</td>
      <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      <td><button class="btn btn-small btn-outline" type="button" data-release="${r.id}">Release</button></td>
    </tr>
  `).join("");
}

function setupReferralAdmin() {
  $("referralAdminBody")?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-release]");
    if (!btn) return;
    const rewardId = btn.getAttribute("data-release");
    if (!confirm("Release this reward back into the normal payout queue?")) return;
    btn.disabled = true;
    btn.textContent = "Releasing…";
    try {
      await api("/api/admin/referral-rewards/release", {
        method: "POST",
        body: JSON.stringify({ rewardId })
      });
      await loadReferralAdmin();
    } catch (error) {
      console.error("Release reward:", error);
      alert("Couldn't release this reward. Please try again.");
      btn.disabled = false;
      btn.textContent = "Release";
    }
  });
}

async function load() {

 

 

 

  try {

 

 

 

    setState(

 

      "Loading dashboard…"

 

    );

 

 

 

    const data =

 

      await api("/api/me");

 

 

 

    renderAccount(data);

    renderWallet(data.wallet);

    renderRewards(data.user, data.referralRewards);

    renderAirdropAdmin(data.airdropAdmin);

    if (data.user?.role === "admin") {
      await loadReferralAdmin();
    } else {
      $("referralAdminSection")?.classList.add("hidden");
    }

    renderTrades(data.trades);

    renderNotifications(data.notifications);

    await loadTickets();

 

 

 

    setState(

 

      "Dashboard updated."

 

    );

 

 

 

  } catch (error) {

 

 

 

    if (

 

      error.message === "unauthorized" ||

 

      error.message ===

 

        "Please sign in first."

 

    ) {

 

      location.href =

 

        "/login.html";

 

      return;

 

    }

 

 

 

    setState(

 

      error.message ||

 

      "Unable to load dashboard.",

 

      true

 

    );

 

  }

 

}

 

 

 

 

 

/* =========================

 

   INIT

 

========================= */

 

 

 

setupTicketForm();

setupTicketDetail();

setupLogout();

setupWalletEvents();

setupAddToken();

setupCopyButtons();

setupAirdropAdmin();

setupReferralAdmin();

load();
