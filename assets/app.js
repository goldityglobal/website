const API_BASE = "";

const GDTY =
  "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801";

const USDT =
  "0x55d398326f99059fF775485246999027B3197955";

const BSC_CHAIN_ID = "0x38";

const PANCAKESWAP_URL =
  `https://pancakeswap.finance/swap?chain=bsc&inputCurrency=${USDT}&outputCurrency=${GDTY}`;

const UNISWAP_URL =
  `https://app.uniswap.org/swap?chain=bnb&inputCurrency=${USDT}&outputCurrency=${GDTY}`;


const $ = id => document.getElementById(id);


const money = value => {
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }

  const number = Number(value);

  return `$${number.toLocaleString(undefined, {
    minimumFractionDigits: number < 1 ? 4 : 2,
    maximumFractionDigits: number < 1 ? 8 : 4
  })}`;
};


const compact = value => {
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }

  return `$${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2
  })}`;
};


let currentRange = "1D";
let candles = [];


/* MARKET */

async function loadMarket() {

  try {

    const response = await fetch(
      `${API_BASE}/api/market`,
      {
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Market data unavailable");
    }


    if ($("price")) {
      $("price").textContent =
        money(data.referencePrice);
    }


    if ($("status")) {
      $("status").textContent =
        data.dataStatus === "live"
          ? "LIVE · verified on-chain sources"
          : "LIVE DATA UNAVAILABLE";
    }


    if ($("updated")) {
      $("updated").textContent =
        data.lastUpdated
          ? `Updated ${new Date(data.lastUpdated).toLocaleTimeString()}`
          : "—";
    }


    if ($("liq")) {
      $("liq").textContent =
        compact(data.liquidityUsd);
    }


    if ($("uni")) {
      $("uni").textContent =
        money(data.markets?.uniswap?.price);
    }


    if ($("pcs")) {
      $("pcs").textContent =
        money(data.markets?.pancakeswap?.price);
    }


    if ($("network")) {
      $("network").textContent =
        data.network || "BNB Smart Chain";
    }

  } catch (error) {

    console.error("Market:", error);

    if ($("price")) $("price").textContent = "—";

    if ($("status")) {
      $("status").textContent =
        "LIVE DATA UNAVAILABLE";
    }

    if ($("updated")) {
      $("updated").textContent =
        error.message || "Unavailable";
    }

  }

}


/* CHART */

function draw() {

  const canvas = $("chart");

  if (!canvas) return;

  const context = canvas.getContext("2d");

  const ratio = window.devicePixelRatio || 1;

  const width = canvas.clientWidth;

  const height = canvas.clientHeight;

  canvas.width = width * ratio;

  canvas.height = height * ratio;

  context.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  context.clearRect(
    0,
    0,
    width,
    height
  );


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
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  const values =
    candles.flatMap(item => [
      item.high,
      item.low
    ]);


  let minimum =
    Math.min(...values);

  let maximum =
    Math.max(...values);


  if (minimum === maximum) {
    minimum *= 0.99;
    maximum *= 1.01;
  }


  const x = index =>
    padding.left +
    (
      index /
      (candles.length - 1 || 1)
    ) *
    chartWidth;


  const y = value =>
    padding.top +
    (
      (maximum - value) /
      (maximum - minimum)
    ) *
    chartHeight;


  context.strokeStyle = "#27231c";

  context.lineWidth = 1;


  for (let i = 0; i < 5; i++) {

    const yy =
      padding.top +
      i * chartHeight / 4;

    context.beginPath();

    context.moveTo(
      padding.left,
      yy
    );

    context.lineTo(
      width - padding.right,
      yy
    );

    context.stroke();


    context.fillStyle = "#716b61";

    context.font =
      "10px system-ui";

    context.fillText(
      money(
        maximum -
        (
          maximum - minimum
        ) *
        i / 4
      ),
      6,
      yy + 3
    );

  }


  context.beginPath();


  candles.forEach((item, index) => {

    const xx = x(index);

    const yy = y(item.close);

    if (index === 0) {
      context.moveTo(xx, yy);
    } else {
      context.lineTo(xx, yy);
    }

  });


  context.strokeStyle = "#d9b45b";

  context.lineWidth = 1.6;

  context.stroke();


  const last =
    candles[candles.length - 1];


  context.fillStyle = "#d9b45b";

  context.beginPath();

  context.arc(
    x(candles.length - 1),
    y(last.close),
    3,
    0,
    Math.PI * 2
  );

  context.fill();

}


async function loadChart(
  range = currentRange
) {

  currentRange = range;

  if ($("chartState")) {
    $("chartState").textContent =
      "Loading real market history…";
  }


  try {

    const response = await fetch(
      `${API_BASE}/api/chart?range=${encodeURIComponent(range)}`,
      {
        cache: "no-store"
      }
    );


    const data =
      await response.json();


    if (!data.ok) {
      throw new Error(
        data.error ||
        "Historical data unavailable"
      );
    }


    candles =
      Array.isArray(data.candles)
        ? data.candles
        : [];


    draw();


    if (!candles.length && $("chartState")) {
      $("chartState").textContent =
        "Verified historical data unavailable";
    }

  } catch (error) {

    console.error("Chart:", error);

    candles = [];

    draw();

    if ($("chartState")) {
      $("chartState").textContent =
        "Historical data unavailable";
    }

  }

}


/* WALLET */

function short(address) {

  return address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "—";

}


function hexAddress(address) {

  return address
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0");

}


async function ethCall(
  to,
  data
) {

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


async function tokenBalance(
  token,
  account
) {

  const data =
    "0x70a08231" +
    hexAddress(account);

  const raw =
    await ethCall(token, data);

  return Number(
    BigInt(raw)
  ) / 1e18;

}


async function nativeBalance(account) {

  const raw =
    await window.ethereum.request({
      method: "eth_getBalance",
      params: [
        account,
        "latest"
      ]
    });

  return Number(
    BigInt(raw)
  ) / 1e18;

}


async function ensureBsc() {

  const chain =
    await window.ethereum.request({
      method: "eth_chainId"
    });


  if (
    chain &&
    chain.toLowerCase() === BSC_CHAIN_ID
  ) {
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

    if (error.code === 4902) {

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

    throw error;
  }

}


async function refreshWallet(account) {

  if (!account) return;


  if ($("walletAddress")) {
    $("walletAddress").textContent =
      short(account);
  }


  try {

    const gdty =
      await tokenBalance(
        GDTY,
        account
      );


    const usdt =
      await tokenBalance(
        USDT,
        account
      );


    const bnb =
      await nativeBalance(account);


    if ($("walletGdty")) {
      $("walletGdty").textContent =
        gdty.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 6
          }
        );
    }


    if ($("walletUsdt")) {
      $("walletUsdt").textContent =
        usdt.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 4
          }
        );
    }


    if ($("walletBnb")) {
      $("walletBnb").textContent =
        bnb.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 5
          }
        );
    }

  } catch (error) {

    console.error("Wallet:", error);

    if ($("walletGdty")) {
      $("walletGdty").textContent = "—";
    }

    if ($("walletUsdt")) {
      $("walletUsdt").textContent = "—";
    }

    if ($("walletBnb")) {
      $("walletBnb").textContent = "—";
    }

  }

}


async function connectWallet() {

  if (!window.ethereum) {

    alert(
      "MetaMask or another EVM-compatible wallet was not detected."
    );

    return null;
  }


  const button =
    $("walletBtn");


  if (button) {
    button.disabled = true;
  }


  try {

    await ensureBsc();


    const accounts =
      await window.ethereum.request({
        method: "eth_requestAccounts"
      });


    const account =
      accounts?.[0];


    if (!account) {
      return null;
    }


    localStorage.setItem(
      "gdtyWallet",
      account
    );


    if ($("walletBtn")) {
      $("walletBtn").textContent =
        short(account);

      $("walletBtn").classList.add(
        "connected"
      );
    }


    if ($("walletMenu")) {
      $("walletMenu").hidden = false;
    }


    await refreshWallet(account);


    return account;

  } catch (error) {

    console.error(
      "Wallet connection:",
      error
    );

    alert(
      error.message ||
      "Wallet connection failed."
    );

    return null;

  } finally {

    if (button) {
      button.disabled = false;
    }

  }

}


async function restoreWallet() {

  if (!window.ethereum) return;


  try {

    const accounts =
      await window.ethereum.request({
        method: "eth_accounts"
      });


    const account =
      accounts?.[0];


    if (!account) return;


    localStorage.setItem(
      "gdtyWallet",
      account
    );


    if ($("walletBtn")) {

      $("walletBtn").textContent =
        short(account);

      $("walletBtn").classList.add(
        "connected"
      );

    }


    if ($("walletMenu")) {
      $("walletMenu").hidden = false;
    }


    await refreshWallet(account);

  } catch (error) {

    console.error(
      "Restore wallet:",
      error
    );

  }

}


/* DEX */

async function openDex(url) {

  if (window.ethereum) {
    await connectWallet();
  }

  window.location.href = url;

}


/* COPY */

async function copyContract() {

  const address = GDTY;


  try {

    await navigator.clipboard.writeText(
      address
    );

    const button =
      $("copyContract");


    if (button) {

      const original =
        button.textContent;

      button.textContent =
        "Copied";

      setTimeout(() => {
        button.textContent =
          original;
      }, 1500);

    }

  } catch {

    alert(
      `GDTY Contract:\n${address}`
    );

  }

}


/* EVENTS */

const ranges =
  $("ranges");


if (ranges) {

  ranges.addEventListener(
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
          item.classList.remove(
            "active"
          )
        );


      button.classList.add(
        "active"
      );


      loadChart(
        button.dataset.range
      );

    }
  );

}


if ($("walletBtn")) {

  $("walletBtn").addEventListener(
    "click",
    async () => {

      const connected =
        localStorage.getItem(
          "gdtyWallet"
        );


      if (!connected) {

        await connectWallet();

        return;
      }


      if ($("walletMenu")) {

        $("walletMenu").hidden =
          !$("walletMenu").hidden;

      }

    }
  );

}


if ($("heroWallet")) {

  $("heroWallet").addEventListener(
    "click",
    connectWallet
  );

}


if ($("disconnectBtn")) {

  $("disconnectBtn").addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        "gdtyWallet"
      );


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
  );

}


if ($("copyContract")) {

  $("copyContract").addEventListener(
    "click",
    copyContract
  );

}


if ($("buyUniswap")) {

  $("buyUniswap").addEventListener(
    "click",
    () => openDex(UNISWAP_URL)
  );

}


if ($("buyPancake")) {

  $("buyPancake").addEventListener(
    "click",
    () => openDex(PANCAKESWAP_URL)
  );

}


if (window.ethereum) {

  window.ethereum.on?.(
    "accountsChanged",
    accounts => {

      if (accounts?.[0]) {

        localStorage.setItem(
          "gdtyWallet",
          accounts[0]
        );

        refreshWallet(
          accounts[0]
        );

      } else {

        if ($("disconnectBtn")) {
          $("disconnectBtn").click();
        }

      }

    }
  );


  window.ethereum.on?.(
    "chainChanged",
    () => location.reload()
  );

}


/* START */

loadMarket();

loadChart();

restoreWallet();

setInterval(
  loadMarket,
  15000
);

window.addEventListener(
  "resize",
  draw
);
