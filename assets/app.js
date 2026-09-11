const API_BASE = "";

const GDTY = "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BSC_CHAIN_ID = "0x38";

const PANCAKESWAP_URL =
  `https://pancakeswap.finance/swap?chain=bsc&inputCurrency=${USDT}&outputCurrency=${GDTY}`;

const UNISWAP_URL =
  `https://app.uniswap.org/swap?chain=bnb&inputCurrency=${USDT}&outputCurrency=${GDTY}`;

const $ = id => document.getElementById(id);

let currentRange = "1D";
let candles = [];


/* =========================================================
   FORMATTERS
   ========================================================= */

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";

  const number = Number(value);

  return `$${number.toLocaleString(undefined, {
    minimumFractionDigits: number < 1 ? 4 : 2,
    maximumFractionDigits: number < 1 ? 8 : 4
  })}`;
}


function compact(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return `$${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2
  })}`;
}


function shortAddress(address) {
  return address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "—";
}


/* =========================================================
   MARKET
   ========================================================= */

async function loadMarket() {

  try {

    const response = await fetch(
      `${API_BASE}/api/market`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Market data unavailable");
    }

    if ($("price")) {
      $("price").textContent = money(data.referencePrice);
    }

    if ($("status")) {
      $("status").textContent =
        data.dataStatus === "live"
          ? "LIVE · verified on-chain sources"
          : "LIVE DATA UNAVAILABLE";
    }

    if ($("updated")) {
      $("updated").textContent = data.lastUpdated
        ? `Updated ${new Date(data.lastUpdated).toLocaleTimeString()}`
        : "Update unavailable";
    }

    if ($("liq")) {
      $("liq").textContent = compact(data.liquidityUsd);
    }

    if ($("uni")) {
      $("uni").textContent =
        money(data.markets?.uniswap?.price);
    }

    if ($("pcs")) {
      $("pcs").textContent =
        money(data.markets?.pancakeswap?.price);
    }

  } catch (error) {

    console.error("Market error:", error);

    if ($("price")) $("price").textContent = "—";
    if ($("liq")) $("liq").textContent = "—";
    if ($("uni")) $("uni").textContent = "—";
    if ($("pcs")) $("pcs").textContent = "—";

    if ($("status")) {
      $("status").textContent = "LIVE DATA UNAVAILABLE";
    }

    if ($("updated")) {
      $("updated").textContent = "Market data unavailable";
    }
  }
}


/* =========================================================
   CHART
   ========================================================= */

function drawChart() {

  const canvas = $("chart");

  if (!canvas) return;

  const context = canvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (!width || !height) return;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  if (!candles.length) {

    if ($("chartState")) {
      $("chartState").textContent =
        "Verified historical data unavailable";
    }

    return;
  }

  if ($("chartState")) {
    $("chartState").textContent = "";
  }

  const padding = {
    left: 58,
    right: 22,
    top: 24,
    bottom: 34
  };

  const chartWidth =
    width - padding.left - padding.right;

  const chartHeight =
    height - padding.top - padding.bottom;

  const values =
    candles.flatMap(item => [
      Number(item.high),
      Number(item.low)
    ]);

  let minimum = Math.min(...values);
  let maximum = Math.max(...values);

  if (minimum === maximum) {
    minimum *= 0.99;
    maximum *= 1.01;
  }

  const x = index =>
    padding.left +
    (index / (candles.length - 1 || 1)) *
    chartWidth;

  const y = value =>
    padding.top +
    ((maximum - value) / (maximum - minimum)) *
    chartHeight;


  context.strokeStyle = "#27231c";
  context.lineWidth = 1;

  for (let i = 0; i < 5; i++) {

    const lineY =
      padding.top +
      i * chartHeight / 4;

    context.beginPath();
    context.moveTo(padding.left, lineY);
    context.lineTo(width - padding.right, lineY);
    context.stroke();

    context.fillStyle = "#716b61";
    context.font = "10px system-ui";

    context.fillText(
      money(maximum - (maximum - minimum) * i / 4),
      6,
      lineY + 3
    );
  }


  context.beginPath();

  candles.forEach((item, index) => {

    const pointX = x(index);
    const pointY = y(Number(item.close));

    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  });

  context.strokeStyle = "#d9b45b";
  context.lineWidth = 1.6;
  context.stroke();


  const last = candles[candles.length - 1];

  context.fillStyle = "#d9b45b";

  context.beginPath();

  context.arc(
    x(candles.length - 1),
    y(Number(last.close)),
    3,
    0,
    Math.PI * 2
  );

  context.fill();
}


async function loadChart(range = currentRange) {

  currentRange = range;

  if ($("chartState")) {
    $("chartState").textContent =
      "Loading real market history…";
  }

  try {

    const response = await fetch(
      `${API_BASE}/api/chart?range=${encodeURIComponent(range)}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(
        data.error || "Historical data unavailable"
      );
    }

    candles = Array.isArray(data.candles)
      ? data.candles
      : [];

    drawChart();

  } catch (error) {

    console.error("Chart error:", error);

    candles = [];

    drawChart();

    if ($("chartState")) {
      $("chartState").textContent =
        "Verified historical data unavailable";
    }
  }
}


/* =========================================================
   WALLET
   ========================================================= */

async function ensureBsc() {

  if (!window.ethereum) {
    throw new Error(
      "MetaMask or another EVM-compatible wallet was not detected."
    );
  }

  const chain =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  if (chain.toLowerCase() === BSC_CHAIN_ID) {
    return true;
  }

  try {

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: BSC_CHAIN_ID
        }
      ]
    });

    return true;

  } catch (error) {

    if (error.code !== 4902) {
      throw error;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BSC_CHAIN_ID,
          chainName: "BNB Smart Chain",
          nativeCurrency: {
            name: "BNB",
            symbol: "BNB",
            decimals: 18
          },
          rpcUrls: [
            "https://bsc-dataseed.bnbchain.org"
          ],
          blockExplorerUrls: [
            "https://bscscan.com"
          ]
        }
      ]
    });

    return true;
  }
}


function encodeAddress(address) {

  return address
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0");
}


async function ethCall(to, data) {

  return window.ethereum.request({
    method: "eth_call",
    params: [
      {
        to,
        data
      },
      "latest"
    ]
  });
}


async function tokenBalance(token, account) {

  const data =
    "0x70a08231" +
    encodeAddress(account);

  const raw =
    await ethCall(token, data);

  return Number(BigInt(raw)) / 1e18;
}


async function nativeBalance(account) {

  const raw =
    await window.ethereum.request({
      method: "eth_getBalance",
      params: [account, "latest"]
    });

  return Number(BigInt(raw)) / 1e18;
}


async function refreshWallet(account) {

  if (!account) return;

  if ($("walletAddress")) {
    $("walletAddress").textContent =
      shortAddress(account);
  }

  try {

    if ($("walletGdty")) {
      $("walletGdty").textContent =
        (
          await tokenBalance(GDTY, account)
        ).toLocaleString(undefined, {
          maximumFractionDigits: 6
        });
    }

    if ($("walletUsdt")) {
      $("walletUsdt").textContent =
        (
          await tokenBalance(USDT, account)
        ).toLocaleString(undefined, {
          maximumFractionDigits: 4
        });
    }

    if ($("walletBnb")) {
      $("walletBnb").textContent =
        (
          await nativeBalance(account)
        ).toLocaleString(undefined, {
          maximumFractionDigits: 5
        });
    }

  } catch (error) {

    console.error("Wallet balance error:", error);

    ["walletGdty", "walletUsdt", "walletBnb"]
      .forEach(id => {
        if ($(id)) $(id).textContent = "—";
      });
  }
}


async function connectWallet() {

  if (!window.ethereum) {

    alert(
      "MetaMask or another EVM-compatible wallet was not detected."
    );

    return null;
  }

  try {

    await ensureBsc();

    const accounts =
      await window.ethereum.request({
        method: "eth_requestAccounts"
      });

    const account = accounts?.[0];

    if (!account) return null;

    localStorage.setItem(
      "gdtyWallet",
      account
    );

    updateWalletUI(account);

    await refreshWallet(account);

    return account;

  } catch (error) {

    console.error("Wallet connection error:", error);

    alert(
      error.message ||
      "Wallet connection failed."
    );

    return null;
  }
}


function updateWalletUI(account) {

  if (!$("walletBtn")) return;

  $("walletBtn").textContent =
    shortAddress(account);

  $("walletBtn").classList.add("connected");

  if ($("walletMenu")) {
    $("walletMenu").hidden = false;
  }
}


async function restoreWallet() {

  if (!window.ethereum) return;

  try {

    const accounts =
      await window.ethereum.request({
        method: "eth_accounts"
      });

    const account = accounts?.[0];

    if (!account) return;

    localStorage.setItem(
      "gdtyWallet",
      account
    );

    updateWalletUI(account);

    await refreshWallet(account);

  } catch (error) {

    console.error(
      "Wallet restore error:",
      error
    );
  }
}


function disconnectWallet() {

  localStorage.removeItem("gdtyWallet");

  if ($("walletMenu")) {
    $("walletMenu").hidden = true;
  }

  if ($("walletBtn")) {
    $("walletBtn").textContent =
      "Connect Wallet";

    $("walletBtn").classList.remove(
      "connected"
    );
  }
}


/* =========================================================
   COPY CONTRACT
   ========================================================= */

async function copyContract(button) {

  if (!button) return;

  try {

    await navigator.clipboard.writeText(GDTY);

    const original =
      button.textContent;

    button.textContent =
      "Copied ✓";

    setTimeout(() => {
      button.textContent = original;
    }, 1500);

  } catch (error) {

    console.error(
      "Copy error:",
      error
    );

    alert(
      `Contract:\n${GDTY}`
    );
  }
}


/* =========================================================
   DEX
   ========================================================= */

async function openDex(dex) {

  const url =
    dex === "uniswap"
      ? UNISWAP_URL
      : PANCAKESWAP_URL;

  /*
   * Connect to BSC first when a wallet is available.
   * The DEX interface will then handle the actual
   * swap approval and transaction confirmation.
   */

  if (window.ethereum) {

    const account =
      await connectWallet();

    if (!account) return;
  }

  window.location.href = url;
}


/* =========================================================
   EVENTS
   ========================================================= */

$("walletBtn")?.addEventListener(
  "click",
  async () => {

    const menu =
      $("walletMenu");

    if (
      localStorage.getItem("gdtyWallet")
    ) {

      if (menu) {
        menu.hidden = !menu.hidden;
      }

      return;
    }

    await connectWallet();
  }
);


$("heroWallet")?.addEventListener(
  "click",
  connectWallet
);


$("disconnectBtn")?.addEventListener(
  "click",
  disconnectWallet
);


$("copyContract")?.addEventListener(
  "click",
  event =>
    copyContract(event.currentTarget)
);


$("copyContractBuy")?.addEventListener(
  "click",
  event =>
    copyContract(event.currentTarget)
);


$("ranges")?.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "button[data-range]"
      );

    if (!button) return;

    document
      .querySelectorAll(
        ".ranges button"
      )
      .forEach(item =>
        item.classList.remove("active")
      );

    button.classList.add("active");

    loadChart(
      button.dataset.range
    );
  }
);


document
  .querySelectorAll(".dex-buy")
  .forEach(button => {

    button.addEventListener(
      "click",
      () =>
        openDex(
          button.dataset.dex
        )
    );
  });


window.addEventListener(
  "resize",
  drawChart
);


if (window.ethereum) {

  window.ethereum.on?.(
    "accountsChanged",
    accounts => {

      if (accounts?.[0]) {

        localStorage.setItem(
          "gdtyWallet",
          accounts[0]
        );

        updateWalletUI(
          accounts[0]
        );

        refreshWallet(
          accounts[0]
        );

      } else {

        disconnectWallet();
      }
    }
  );


  window.ethereum.on?.(
    "chainChanged",
    () => location.reload()
  );
}


/* =========================================================
   START
   ========================================================= */

loadMarket();
loadChart();
restoreWallet();

setInterval(
  loadMarket,
  15000
);
