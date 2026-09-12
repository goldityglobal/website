const API_BASE = "";

 

const WITHDRAW_POLL_INTERVAL_MS = 5000;

const WITHDRAW_POLL_MAX_ATTEMPTS = 24;

 

let withdrawPollTimer = null;

let withdrawPollAttempts = 0;

let withdrawBusy = false;

let walletConnected = false;

let activePayoutStatus = null;

 

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

 

  setText("ref", user.referralCode || "—");

  setText("refs", String(user.referrals || 0));

 

  const link = user.referralCode

    ? `${location.origin}/register.html?ref=${encodeURIComponent(user.referralCode)}`

    : "";

 

  const input = $("referralLink");

 

  if (input) {

    input.value = link;

  }

}

 

 

/* =========================

   WALLET

========================= */

 

function renderWallet(wallet) {

  walletConnected = !!(wallet && wallet.connected);

 

  if (!walletConnected) {

    setText("walletStatus", "Not connected");

    setText("walletAddress", "—");

    setText("gdtyBalance", "—");

    setText("usdtBalance", "—");

    setText("bnbBalance", "—");

    updateWithdrawButton();

    return;

  }

 

  setText("walletStatus", "Connected");

  setText("walletAddress", shortAddress(wallet.address));

 

  setText(

    "gdtyBalance",

    fmtGdty(wallet.gdtyWei)

  );

 

  setText(

    "usdtBalance",

    fmtUsdt(wallet.usdtWei)

  );

 

  try {

    setText(

      "bnbBalance",

      `${fmt(Number(BigInt(wallet.bnbWei || "0")) / 1e18, 6)} BNB`

    );

  } catch {

    setText("bnbBalance", "0 BNB");

  }

 

  updateWithdrawButton();

}

 

 

/* =========================

   PORTFOLIO

========================= */

 

async function loadMarketPrice() {

  try {

    const data = await api("/api/market");

 

    if (

      data.dataStatus !== "live" ||

      !Number.isFinite(Number(data.referencePrice))

    ) {

      return null;

    }

 

    return Number(data.referencePrice);

  } catch {

    return null;

  }

}

 

async function renderPortfolio(portfolio) {

  if (!portfolio) return;

 

  const bought = Number(

    BigInt(portfolio.gdtyBoughtWei || "0")

  ) / 1e18;

 

  const sold = Number(

    BigInt(portfolio.gdtySoldWei || "0")

  ) / 1e18;

 

  const spent = Number(

    BigInt(portfolio.usdtSpentWei || "0")

  ) / 1e18;

 

  const received = Number(

    BigInt(portfolio.usdtReceivedWei || "0")

  ) / 1e18;

 

  const costBasis = Number(

    BigInt(portfolio.costBasisWei || "0")

  ) / 1e18;

 

  const realized = Number(

    BigInt(portfolio.realizedPnlWei || "0")

  ) / 1e18;

 

  const held = Math.max(0, bought - sold);

 

  const averageBuy =

    bought > 0

      ? spent / bought

      : 0;

 

  setText(

    "totalPurchased",

    `${fmt(bought, 4)} GDTY`

  );

 

  setText(

    "totalSold",

    `${fmt(sold, 4)} GDTY`

  );

 

  setText(

    "averageBuyPrice",

    averageBuy > 0

      ? `$${fmt(averageBuy, 6)}`

      : "—"

  );

 

  setText(

    "realizedPnl",

    `${realized >= 0 ? "+" : ""}$${fmt(realized, 4)}`

  );

 

  const price = await loadMarketPrice();

 

  if (price === null) {

    setText("portfolioValue", "Market unavailable");

    setText("pnl", "—");

    return;

  }

 

  const value = held * price;

 

  const unrealized =

    value - costBasis;

 

  const totalPnl =

    realized + unrealized;

 

  setText(

    "accountStatus",

  "Active"

);

 

  setText(

    "pnl",

    `${totalPnl >= 0 ? "+" : ""}$${fmt(totalPnl, 4)}`

  );

}

 

 

/* =========================

   REFERRAL

========================= */

 

function setWithdrawState(message, error = false) {

  const el = $("withdrawState");

  if (!el) return;

 

  el.textContent = message || "";

  el.classList.toggle("error", error);

}

 

function setWithdrawTx(txHash) {

  const el = $("withdrawTx");

  if (!el) return;

 

  el.textContent = "";

  el.classList.add("hidden");

 

  if (!txHash) return;

 

  const label = document.createElement("span");

  label.textContent = "Transaction: ";

 

  const link = document.createElement("a");

  link.href = `https://bscscan.com/tx/${encodeURIComponent(txHash)}`;

  link.target = "_blank";

  link.rel = "noopener noreferrer";

  link.textContent = shortTx(txHash);

 

  el.appendChild(label);

  el.appendChild(link);

  el.classList.remove("hidden");

}

 

function updateWithdrawButton() {

  const button = $("withdrawRewards");

  if (!button) return;

 

  let availableWei = 0n;

 

  try {

    availableWei = BigInt(

      button.dataset.availableWei || "0"

    );

  } catch {

    availableWei = 0n;

  }

 

  const active =

    activePayoutStatus === "processing" ||

    activePayoutStatus === "broadcast";

 

  button.disabled =

    withdrawBusy ||

    !walletConnected ||

    availableWei <= 0n ||

    active;

}

 

function payoutErrorMessage(code) {

  const messages = {

    unauthorized: "Please sign in first.",

    wallet_not_connected: "Please connect and verify your BNB Smart Chain wallet before withdrawing.",

    wallet_not_verified: "Your wallet must be verified before withdrawing referral rewards.",

    no_rewards_available: "There are no referral rewards available for withdrawal.",

    insufficient_payout_gdty: "The referral payout wallet does not currently have enough GDTY to complete this withdrawal.",

    insufficient_payout_bnb: "The referral payout wallet does not currently have enough BNB to cover this withdrawal and other reserved payout fees.",

    payout_not_configured: "Referral withdrawals are temporarily unavailable. Please try again later.",

    payout_wallet_mismatch: "Referral withdrawals are temporarily unavailable. Please contact support.",

    payout_reservation_failed: "The referral reward withdrawal could not be reserved. Please try again.",

    payout_transaction_failed: "The referral payout transaction failed on-chain. Your rewards have been released for another withdrawal attempt.",

    payout_processing_error: "The referral payout is still being processed. Please check the status again shortly.",

    payout_broadcast_pending_retry: "The referral payout transaction is pending confirmation. Please check the status again shortly.",

    payout_recovery_data_missing: "The referral payout needs recovery data. Please contact support if this persists.",

    payout_transaction_integrity_mismatch: "The referral payout could not be safely recovered. Please contact support.",

    rate_limited: "Too many withdrawal attempts. Please wait a moment and try again.",

    forbidden: "This request was blocked for security reasons.",

    database_not_configured: "Referral withdrawals are temporarily unavailable. Please try again later."

  };

 

  return messages[code] || "Unable to process the referral withdrawal.";

}

 

function renderRewards(rewards) {

  const availableWei = rewards?.availableWei || "0";

  const totalWei = rewards?.totalWei || "0";

 

  setText(

    "rewardAvailable",

    fmtGdty(availableWei)

  );

 

  setText(

    "rewardTotal",

    fmtGdty(totalWei)

  );

 

  setText(

    "withdrawAvailable",

    fmtGdty(availableWei)

  );

 

  const button = $("withdrawRewards");

  if (button) {

    try {

      button.dataset.availableWei = BigInt(availableWei).toString();

    } catch {

      button.dataset.availableWei = "0";

    }

  }

 

  updateWithdrawButton();

}

 

function renderPayout(payout) {

  activePayoutStatus = payout?.status || null;

  setWithdrawTx(payout?.txHash || null);

 

  if (!payout) {

    setWithdrawState(

      walletConnected

        ? "No referral withdrawal has been made yet."

        : "Connect and verify your BNB Smart Chain wallet to withdraw rewards."

    );

    updateWithdrawButton();

    return;

  }

 

  if (payout.status === "paid") {

    setWithdrawState("Referral rewards paid successfully.");

  } else if (payout.status === "broadcast") {

    setWithdrawState("Referral payout transaction broadcast. Waiting for blockchain confirmation…");

  } else if (payout.status === "processing") {

    setWithdrawState("Referral payout is being processed. Please keep this page open or check the status again shortly…");

  } else if (payout.status === "failed") {

    setWithdrawState(

      payoutErrorMessage(payout.errorMessage),

      true

    );

  } else {

    setWithdrawState("Withdrawal status updated.");

  }

 

  updateWithdrawButton();

}

 

function stopWithdrawPolling() {

  if (withdrawPollTimer) {

    clearTimeout(withdrawPollTimer);

    withdrawPollTimer = null;

  }

 

  withdrawPollAttempts = 0;

}

 

function scheduleWithdrawPolling() {

  if (withdrawPollTimer) return;

 

  if (withdrawPollAttempts >= WITHDRAW_POLL_MAX_ATTEMPTS) {

    setWithdrawState(

      "The withdrawal is still being processed. Use Check Withdrawal Status to refresh it."

    );

    return;

  }

 

  withdrawPollTimer = setTimeout(async () => {

    withdrawPollTimer = null;

    withdrawPollAttempts += 1;

    await loadWithdrawStatus(true);

  }, WITHDRAW_POLL_INTERVAL_MS);

}

 

async function loadWithdrawStatus(silent = false) {

  try {

    const data = await api(

      "/api/referral/withdraw/status"

    );

 

    renderPayout(data.payout);

 

    const active =

      data.payout?.status === "processing" ||

      data.payout?.status === "broadcast";

 

    if (active) {

      if (!silent) {

        setWithdrawState(

          data.payout.status === "broadcast"

            ? "Referral payout transaction broadcast. Waiting for blockchain confirmation…"

            : "Referral payout is being processed…"

        );

      }

      scheduleWithdrawPolling();

    } else {

      stopWithdrawPolling();

    }

 

    return data.payout || null;

  } catch (error) {

    if (!silent) {

      setWithdrawState(

        error.message || "Unable to check withdrawal status.",

        true

      );

    }

    return null;

  }

}

 

async function withdrawRewards() {

  if (withdrawBusy) return;

 

  const button = $("withdrawRewards");

  if (!button) return;

 

  let availableWei = 0n;

 

  try {

    availableWei = BigInt(

      button.dataset.availableWei || "0"

    );

  } catch {

    availableWei = 0n;

  }

 

  if (availableWei <= 0n) {

    setWithdrawState(

      "There are no referral rewards available for withdrawal.",

      true

    );

    return;

  }

 

  if (!walletConnected) {

    setWithdrawState(

      "Please connect and verify your BNB Smart Chain wallet before withdrawing.",

      true

    );

    return;

  }

 

  withdrawBusy = true;

  updateWithdrawButton();

  setWithdrawTx(null);

  setWithdrawState("Preparing referral reward withdrawal…");

 

  try {

    const data = await api(

      "/api/referral/withdraw",

      {

        method: "POST",

        body: JSON.stringify({})

      }

    );

 

    renderPayout(data);

 

    const active =

      data.status === "processing" ||

      data.status === "broadcast";

 

    if (active) {

      withdrawPollAttempts = 0;

      scheduleWithdrawPolling();

    } else {

      stopWithdrawPolling();

    }

 

    if (data.status === "paid" || data.status === "failed") {

      await load();

    }

  } catch (error) {

    setWithdrawState(

      payoutErrorMessage(error.message),

      true

    );

 

    if (

      error.message === "unauthorized" ||

      error.message === "Please sign in first."

    ) {

      location.href = "/login.html";

      return;

    }

  } finally {

    withdrawBusy = false;

    updateWithdrawButton();

  }

}

 

function setupWithdrawal() {

  $("withdrawRewards")?.addEventListener(

    "click",

    withdrawRewards

  );

 

  $("refreshWithdrawStatus")?.addEventListener(

    "click",

    async () => {

      stopWithdrawPolling();

      setWithdrawState("Checking withdrawal status…");

      await loadWithdrawStatus(false);

    }

  );

}

 

 

 

/* =========================

   TRADES

========================= */

 

function renderTrades(trades) {

  const body = $("tradeHistory");

 

  if (!body) return;

 

  body.innerHTML = "";

 

  if (!trades || !trades.length) {

    const row = document.createElement("tr");

 

    const cell = document.createElement("td");

    cell.colSpan = 7;

    cell.textContent = "No verified trades yet.";

 

    row.appendChild(cell);

    body.appendChild(row);

 

    return;

  }

 

  for (const trade of trades) {

    const row = document.createElement("tr");

 

    const values = [

      trade.createdAt

        ? new Date(trade.createdAt).toLocaleString()

        : "—",

 

      trade.dex || "—",

 

      String(trade.side || "—").toUpperCase(),

 

      fmtGdty(trade.gdtyAmountWei),

 

      fmtUsdt(trade.usdtAmountWei),

 

      trade.status || "—",

 

      shortTx(trade.txHash)

    ];

 

    for (const value of values) {

      const cell = document.createElement("td");

      cell.textContent = value;

      row.appendChild(cell);

    }

 

    body.appendChild(row);

  }

}

 

 

/* =========================

   NOTIFICATIONS

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

 

function renderTickets(tickets) {

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

 

function setupCopyButtons() {

 

  $("copyReferralCode")?.addEventListener(

    "click",

    () => {

      copyText(

        $("ref")?.textContent || "",

        $("copyReferralCode")

      );

    }

  );

 

  $("copyReferralLink")?.addEventListener(

    "click",

    () => {

      copyText(

        $("referralLink")?.value || "",

        $("copyReferralLink")

      );

    }

  );

}

 

 

/* =========================

   WALLET SIGNATURE

========================= */

 

async function connectWallet() {

 

  if (!window.ethereum) {

    setState(

      "MetaMask or a compatible Web3 wallet is required.",

      true

    );

    return;

  }

 

  try {

 

    const accounts =

      await window.ethereum.request({

        method: "eth_requestAccounts"

      });

 

    const address =

      String(accounts?.[0] || "").toLowerCase();

 

    if (!address) {

      throw new Error(

        "No wallet account was selected."

      );

    }

 

    const chainId =

      await window.ethereum.request({

        method: "eth_chainId"

      });

 

    if (

      parseInt(chainId, 16) !== 56

    ) {

      setState(

        "Please switch your wallet to BNB Smart Chain.",

        true

      );

      return;

    }

 

    setState(

      "Preparing wallet verification…"

    );

 

    const challenge =

      await api(

        "/api/wallet/challenge",

        {

          method:"POST",

          body:JSON.stringify({

            address

          })

        }

      );

 

    setState(

      "Waiting for wallet signature…"

    );

 

    const signature =

      await window.ethereum.request({

        method:"personal_sign",

        params:[

          challenge.message,

          address

        ]

      });

 

    await api(

      "/api/wallet/verify",

      {

        method:"POST",

        body:JSON.stringify({

          challengeId:

            challenge.challengeId,

          signature

        })

      }

    );

 

    setState(

      "Wallet verified successfully."

    );

 

    await load();

 

  } catch (error) {

 

    setState(

      error.message ||

      "Wallet verification failed.",

      true

    );

  }

}

 

 

/* =========================

   TICKET FORM

========================= */

 

function setupTicketForm() {

 

  $("newTicket")?.addEventListener(

    "click",

    () => {

 

      const section =

        $("ticketFormSection");

 

      if (!section) return;

 

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

 

function setupWalletEvents() {

 

  $("connectWallet")?.addEventListener(

    "click",

    connectWallet

  );

 

  if (!window.ethereum) return;

 

  window.ethereum.on?.(

    "accountsChanged",

    () => load()

  );

 

  window.ethereum.on?.(

    "chainChanged",

    () => load()

  );

}

 

 

/* =========================

   MAIN LOAD

========================= */

 

async function load() {

 

  try {

 

    setState(

      "Loading dashboard…"

    );

 

    const data =

      await api("/api/me");

 

    renderAccount(data);

    renderWallet(data.wallet);

    renderRewards(data.referralRewards);

    renderTrades(data.trades);

    renderNotifications(data.notifications);

 

    await renderPortfolio(

      data.portfolio

    );

 

    await loadWithdrawStatus(true);

 

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

 

setupCopyButtons();

setupTicketForm();

setupLogout();

setupWalletEvents();

setupWithdrawal();

 

load();
