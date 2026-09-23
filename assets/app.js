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
