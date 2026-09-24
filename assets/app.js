/* GOLDITY AUTH MODAL — HARD CLOSE CONTROLLER */

(() => {

  const close = () => {

    const modal = document.getElementById("loginModal");

    if (!modal) return false;


    modal.hidden = true;

    modal.setAttribute("aria-hidden", "true");

    modal.classList.remove("open", "active", "is-open");

    document.documentElement.classList.remove("modal-open");

    document.body.classList.remove("modal-open", "no-scroll");

    document.body.style.removeProperty("overflow");

    return true;

  };


  const isCloseTarget = target => {

    if (!(target instanceof Element)) return false;

    return Boolean(

      target.closest("#closeLogin") ||

      target.closest("[data-close-login=\"true\"]")

    );

  };


  // Capture phase: this remains independent of the rest of app.js.

  ["pointerdown", "mousedown", "click"].forEach(type => {

    document.addEventListener(type, event => {

      if (!isCloseTarget(event.target)) return;

      event.preventDefault();

      event.stopImmediatePropagation();

      close();

    }, true);

  });


  document.addEventListener("keydown", event => {

    if (event.key !== "Escape") return;

    const modal = document.getElementById("loginModal");

    if (!modal || modal.hidden) return;

    event.preventDefault();

    event.stopImmediatePropagation();

    close();

  }, true);


  // Handles dynamically inserted/re-rendered close buttons too.

  const bindDirect = () => {

    const button = document.getElementById("closeLogin");

    if (!button || button.dataset.goldityCloseBound === "1") return;

    button.dataset.goldityCloseBound = "1";

    button.addEventListener("click", event => {

      event.preventDefault();

      event.stopImmediatePropagation();

      close();

    }, true);

  };


  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", bindDirect, { once: true });

  } else {

    bindDirect();

  }

})();


const API_BASE = "";


const GDTY =

  "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801";


const USDT =

  "0x55d398326f99059fF775485246999027B3197955";




const PANCAKESWAP_URL =

  `https://pancakeswap.finance/swap?chain=bsc&inputCurrency=${USDT}&outputCurrency=${GDTY}`;


const UNISWAP_URL =

  `https://app.uniswap.org/swap?chain=bnb&inputCurrency=${USDT}&outputCurrency=${GDTY}`;


const COINGECKO_SEARCH =

  "https://www.coingecko.com/en/search?query=GDTY";


const $ = id => document.getElementById(id);



/* =========================================================

   FORMATTERS

========================================================= */


const money = value => {

  if (value == null || !Number.isFinite(Number(value))) {

    return "—";

  }


  const number = Number(value);


  return `$${number.toLocaleString(undefined, {

    minimumFractionDigits: number < 1 ? 4 : 2,

    maximumFractionDigits: number < 1 ? 4 : 2

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



const numberFormat = value => {

  if (value == null || !Number.isFinite(Number(value))) {

    return "—";

  }


  return Number(value).toLocaleString(undefined, {

    maximumFractionDigits: 6

  });

};



/* =========================================================

   MARKET

========================================================= */



let candles = [];



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

      throw new Error(

        data.error || "Market data unavailable"

      );

    }


    const referencePriceText =

      money(data.referencePrice);


    if ($("price")) {

      $("price").textContent =

        referencePriceText;

    }


    if ($("sidePrice")) {

      $("sidePrice").textContent =

        referencePriceText;

    }


    if ($("status")) {

      $("status").textContent =

        data.dataStatus === "live"

          ? "LIVE"

          : "UNAVAILABLE";

      $("status").classList.toggle(

        "is-down",

        data.dataStatus !== "live"

      );

    }


    if ($("updated")) {

      $("updated").textContent =

        data.lastUpdated

          ? `Updated ${new Date(

              data.lastUpdated

            ).toLocaleTimeString()}`

          : "—";

    }


    if ($("liq")) {

      $("liq").textContent =

        compact(data.liquidityUsd);

    }
     if ($("totalUsdtReserve")) {
  $("totalUsdtReserve").textContent =
    numberFormat(data.totalUsdtReserve);
}

if ($("totalGdtyReserve")) {
  $("totalGdtyReserve").textContent =
    numberFormat(data.totalGdtyReserve);
}

    if ($("network")) {

      $("network").textContent =

        data.network ||

        "BNB Smart Chain";

    }


    /*

      Optional market fields.

      These only update when the HTML contains

      the corresponding IDs.

    */


    if ($("uniswapLiquidity")) {

      $("uniswapLiquidity").textContent =

        compact(data.uniswapLiquidityUsd);

    }


    if ($("pancakeLiquidity")) {

      $("pancakeLiquidity").textContent =

        compact(data.pancakeLiquidityUsd);

    }


    if ($("referenceSource")) {

      $("referenceSource").textContent =

        data.referencePrice != null

          ? "UNISWAP V2 + PANCAKESWAP V2"

          : "PRICE UNAVAILABLE";

    }


  } catch (error) {

    console.error("Market:", error);


    if ($("price")) {

      $("price").textContent = "—";

    }


    if ($("sidePrice")) {

      $("sidePrice").textContent = "—";

    }


    if ($("status")) {

      $("status").textContent =

        "UNAVAILABLE";

      $("status").classList.add("is-down");

    }


    if ($("updated")) {

      $("updated").textContent =

        error.message || "Unavailable";

    }


    if ($("referenceSource")) {

      $("referenceSource").textContent =

        "PRICE UNAVAILABLE";

    }

  }

}



/* =========================================================

   CHART

   GOLDITY / XALGO-LIKE MINIMAL MARKET STYLE

========================================================= */


async function loadChart() {
  const wrap = $("chartWrap");
  const state = $("chartState");
  if (!wrap) return;
  try {
    const response = await fetch(API_BASE + "/api/dexscreener-pair");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.url) {
      if (state) state.textContent = "Chart unavailable right now.";
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.src = data.url + "?embed=1&theme=dark&trades=0&info=0";
    iframe.loading = "lazy";
    iframe.title = "GDTY/USDT chart on DexScreener";
    iframe.style.cssText = "width:100%;height:100%;border:0;display:block";
    wrap.appendChild(iframe);
    if (state) state.remove();
  } catch {
    if (state) state.textContent = "Chart unavailable right now.";
  }
}
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

    await ethCall(

      token,

      data

    );


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






/* =========================================================

   DEX

========================================================= */


async function openDex(url) {

  window.location.href =

    url;

}



/* =========================================================

   COPY CONTRACT

========================================================= */


async function copyContract() {

  const address =

    GDTY;


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


      setTimeout(

        () => {

          button.textContent =

            original;

        },

        1500

      );

    }


  } catch {

    alert(

      `GDTY Contract:\n${address}`

    );

  }

}









/* =========================================================

   COPY / DEX BUTTONS

========================================================= */


if ($("copyContract")) {

  $("copyContract").addEventListener(

    "click",

    copyContract

  );

}

/* =========================================================
   ADD TO WALLET (EIP-6963 wallet picker)
========================================================= */
const discoveredWalletsHome = [];

window.addEventListener("eip6963:announceProvider", event => {
  const detail = event.detail;
  if (!detail?.info?.uuid) return;
  if (discoveredWalletsHome.some(w => w.info.uuid === detail.info.uuid)) return;
  discoveredWalletsHome.push(detail);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

function isMobileDeviceHome() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function showMobileWalletRedirectHome() {
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

function pickHomeWalletProvider() {
  return new Promise(resolve => {
    setTimeout(() => {
      if (discoveredWalletsHome.length === 0) {
        if (!window.ethereum && isMobileDeviceHome()) { showMobileWalletRedirectHome(); resolve(null); return; }
        resolve(window.ethereum || null);
        return;
      }
      if (discoveredWalletsHome.length === 1) { resolve(discoveredWalletsHome[0].provider); return; }
      showHomeWalletPicker(discoveredWalletsHome, chosen => resolve(chosen ? chosen.provider : null));
    }, 150);
  });
}

function showHomeWalletPicker(wallets, onChoose) {
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

if ($("addToMetaMask")) {

  $("addToMetaMask").addEventListener(

    "click",

    async () => {

      const provider = await pickHomeWalletProvider();

      if (!provider) {

        alert(

          "No wallet detected. Open this page inside your wallet's browser (e.g. MetaMask app) first."

        );

        return;

      }

      try {

        await provider.request({

          method: "eth_requestAccounts"

        });

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

        await provider.request({

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

    }

  );

}






if ($("buyUniswap")) {

  $("buyUniswap").addEventListener(

    "click",

    () =>

      openDex(

        UNISWAP_URL

      )

  );

}



if ($("buyPancake")) {

  $("buyPancake").addEventListener(

    "click",

    () =>

      openDex(

        PANCAKESWAP_URL

      )

  );

}



/* =========================================================

   COINGECKO

========================================================= */


if ($("coinGecko")) {

  $("coinGecko").addEventListener(

    "click",

    () => {

      window.open(

        COINGECKO_SEARCH,

        "_blank",

        "noopener,noreferrer"

      );

    }

  );

}






/* =========================================================

   ACCOUNT / AUTH

========================================================= */


function setAccountState(user) {

  const menu =

    $("accountMenu");


  const label =

    $("accountLabel");


  const guest =

    $("accountGuest");


  const signedIn =

    $("accountSignedIn");


  const userName =

    $("accountUserName");


  const userEmail =

    $("accountUserEmail");


  const mobileLogin =

    $("mobileLogin");


  const mobileRegister =

    document.querySelector(

      '.mobile-account-links a[href="/register.html"]'

    );



  if (user) {


    const name =

      user.firstName ||

      user.email ||

      "Account";



    if (menu) {

      menu.classList.add(

        "signed-in"

      );

    }


    if (label) {

      label.textContent =

        `My Account · ${name}`;

    }


    if (guest) {

      guest.hidden = true;

    }


    if (signedIn) {

      signedIn.hidden = false;

    }


    if (userName) {

      userName.textContent =

        name;

    }


    if (userEmail) {

      userEmail.textContent =

        user.email ||

        "Signed in";

    }


    if (mobileLogin) {

      mobileLogin.textContent =

        "Sign Out";


      mobileLogin.classList.add(

        "account-mobile-signed"

      );

    }


    if (mobileRegister) {

      mobileRegister.hidden =

        true;

    }


  } else {


    if (menu) {

      menu.classList.remove(

        "signed-in"

      );

    }


    if (label) {

      label.textContent =

        "Sign In";

    }


    if (guest) {

      guest.hidden = false;

    }


    if (signedIn) {

      signedIn.hidden = true;

    }


    if (userName) {

      userName.textContent =

        "Account";

    }


    if (userEmail) {

      userEmail.textContent =

        "Signed out";

    }


    if (mobileLogin) {

      mobileLogin.textContent =

        "Sign In";


      mobileLogin.classList.remove(

        "account-mobile-signed"

      );

    }


    if (mobileRegister) {

      mobileRegister.hidden =

        false;

    }

  }

}



function closeLoginModal() {

  const modal =

    $("loginModal");


  if (!modal) {

    return;

  }


  modal.hidden = true;


  modal.setAttribute(

    "aria-hidden",

    "true"

  );

}



function openLoginModal() {

  const modal =

    $("loginModal");


  if (!modal) {

    return;

  }


  const menu =

    $("accountMenu");


  if (menu) {

    menu.open = false;

  }


  modal.hidden = false;


  modal.setAttribute(

    "aria-hidden",

    "false"

  );


  const state =

    $("loginState");


  if (state) {

    state.textContent = "";


    state.className =

      "status-text";

  }


  setTimeout(

    () => {

      $("loginEmail")?.focus();

    },

    0

  );

}



async function loadAccountSession() {

  try {

    const response =

      await fetch(

        `${API_BASE}/api/me`,

        {

          method: "GET",

          credentials:

            "same-origin",

          cache: "no-store"

        }

      );


    const data =

      await response

        .json()

        .catch(() => ({}));


    if (

      response.ok &&

      data.ok &&

      data.user

    ) {

      setAccountState(

        data.user

      );


      return data.user;

    }


  } catch (error) {

    console.error(

      "Account session:",

      error

    );

  }


  setAccountState(null);


  return null;

}



async function signIn(event) {

  event.preventDefault();


  const email =

    $("loginEmail")?.value.trim() ||

    "";


  const password =

    $("loginPassword")?.value ||

    "";


  const submit =

    $("loginSubmit");


  const state =

    $("loginState");



  if (!email || !password) {


    if (state) {

      state.className =

        "status-text error";


      state.textContent =

        "Please enter your email and password.";

    }


    return;

  }



  if (submit) {

    submit.disabled = true;


    submit.textContent =

      "Signing in…";

  }



  if (state) {

    state.className =

      "status-text";


    state.textContent =

      "Checking your account…";

  }



  try {


    const response =

      await fetch(

        `${API_BASE}/api/login`,

        {

          method: "POST",

          credentials:

            "same-origin",

          headers: {

            "content-type":

              "application/json"

          },

          body:

            JSON.stringify({

              email,

              password

            })

        }

      );



    const data =

      await response

        .json()

        .catch(() => ({}));



    if (

      !response.ok ||

      !data.ok

    ) {


      const messages = {


        invalid_credentials:

          "Email or password is incorrect.",


        email_not_verified:

          "Please verify your email before signing in.",


        rate_limited:

          "Too many attempts. Please try again shortly.",


        registration_not_configured:

          "Account service is temporarily unavailable."

      };



      throw new Error(

        messages[data.error] ||

        data.message ||

        "Sign in failed. Please try again."

      );

    }



    setAccountState(

      data.user ||

      null

    );


    closeLoginModal();



    if (data.user) {

      window.location.href =

        "/dashboard.html";

    }


  } catch (error) {


    console.error(

      "Sign in:",

      error

    );


    if (state) {

      state.className =

        "status-text error";


      state.textContent =

        error.message ||

        "Sign in failed.";

    }


  } finally {


    if (submit) {

      submit.disabled = false;


      submit.textContent =

        "Sign In";

    }

  }

}



async function signOut() {

  try {


    await fetch(

      `${API_BASE}/api/logout`,

      {

        method: "POST",

        credentials:

          "same-origin",

        headers: {

          "content-type":

            "application/json"

        }

      }

    );


  } catch (error) {


    console.error(

      "Sign out:",

      error

    );

  }


  setAccountState(null);


  const menu =

    $("accountMenu");


  if (menu) {

    menu.open = false;

  }

}



/* =========================================================

   LOGIN EVENTS

========================================================= */


const openLogin =

  $("openLogin");


if (openLogin) {

  openLogin.addEventListener(

    "click",

    openLoginModal

  );

}



const mobileLogin =

  $("mobileLogin");


if (mobileLogin) {

  mobileLogin.addEventListener(

    "click",

    async () => {


      const signedIn =

        $("accountMenu")

          ?.classList

          .contains(

            "signed-in"

          );


      const mobileNav =

        document.querySelector(

          ".mobile-nav"

        );


      if (mobileNav) {

        mobileNav.open = false;

      }


      if (signedIn) {

        await signOut();

      } else {

        openLoginModal();

      }

    }

  );

}



const accountLogout =

  $("accountLogout");


if (accountLogout) {

  accountLogout.addEventListener(

    "click",

    signOut

  );

}



const closeLogin =

  $("closeLogin");


if (closeLogin) {

  closeLogin.addEventListener(

    "click",

    closeLoginModal

  );

}



const loginModal =

  $("loginModal");


if (loginModal) {

  loginModal.addEventListener(

    "click",

    event => {


      if (

        event.target.matches(

          '[data-close-login="true"]'

        )

      ) {

        closeLoginModal();

      }

    }

  );

}



const loginForm =

  $("loginForm");


if (loginForm) {

  loginForm.addEventListener(

    "submit",

    signIn

  );

}



document.addEventListener(

  "keydown",

  event => {


    if (

      event.key === "Escape" &&

      !$("loginModal")?.hidden

    ) {

      closeLoginModal();

    }

  }

);



/* =========================================================

   START

========================================================= */


loadMarket();


loadChart();






loadAccountSession();



/*

  Refresh live market data

  every 15 seconds.

*/


setInterval(

  loadMarket,

  15000

);




/* =========================================================
   HEADER MENUS: close account menu on outside click
========================================================= */
document.addEventListener("click", function (e) {
  var accountMenu = document.getElementById("accountMenu");

  if (accountMenu && accountMenu.open && !accountMenu.contains(e.target)) {
    accountMenu.open = false;
  }
});
