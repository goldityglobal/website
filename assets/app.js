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


let currentRange = "4H";

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


function draw() {

  const canvas = $("chart");


  if (!canvas) {

    return;

  }


  const context =

    canvas.getContext("2d");


  if (!context) {

    return;

  }


  const ratio =

    window.devicePixelRatio || 1;


  const width =

    canvas.clientWidth;


  const height =

    canvas.clientHeight;


  if (!width || !height) {

    return;

  }


  canvas.width =

    width * ratio;


  canvas.height =

    height * ratio;


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

      $("chartState").innerHTML =

        '<svg width="30" height="18" viewBox="0 0 30 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 14L8 9L13 12L19 4L29 8" stroke="#5b5247" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>No history indexed for this pool yet</span>';

    }


    return;

  }



  if ($("chartState")) {

    $("chartState").textContent = "";

  }



  const padding = {

    left: 64,

    right: 70,

    top: 24,

    bottom: 42

  };



  const chartWidth =

    width -

    padding.left -

    padding.right;



  const chartHeight =

    height -

    padding.top -

    padding.bottom;



  if (chartWidth <= 0 || chartHeight <= 0) {

    return;

  }



  const values =

    candles.flatMap(item => [

      Number(item.high),

      Number(item.low)

    ]).filter(Number.isFinite);



  if (!values.length) {

    return;

  }



  let minimum =

    Math.min(...values);


  let maximum =

    Math.max(...values);



  if (minimum === maximum) {

    const delta =

      Math.abs(minimum || 1) * 0.01;


    minimum -= delta;

    maximum += delta;

  }



  const range =

    maximum - minimum;



  const x = index =>

    padding.left +

    (

      index /

      Math.max(candles.length - 1, 1)

    ) *

    chartWidth;



  const y = value =>

    padding.top +

    (

      (maximum - value) /

      range

    ) *

    chartHeight;



  /*

    Background grid

  */


  context.strokeStyle =

    "rgba(217,180,91,0.10)";


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



    /*

      Price labels

    */


    context.fillStyle =

      "#77736c";


    context.font =

      "10px system-ui, sans-serif";


    context.textAlign =

      "left";


    context.fillText(

      money(

        maximum -

        (

          range * i / 4

        )

      ),

      width - padding.right + 8,

      yy + 3

    );

  }



  /*

    Vertical guides

  */


  const verticalSteps =

    Math.min(6, candles.length);


  if (verticalSteps > 1) {

    for (let i = 0; i < verticalSteps; i++) {

      const index =

        Math.round(

          i *

          (candles.length - 1) /

          (verticalSteps - 1)

        );


      const xx =

        x(index);


      context.strokeStyle =

        "rgba(217,180,91,0.055)";


      context.beginPath();


      context.moveTo(

        xx,

        padding.top

      );


      context.lineTo(

        xx,

        height - padding.bottom

      );


      context.stroke();

    }

  }



  /*

    Main price line

  */


  context.beginPath();


  candles.forEach(

    (item, index) => {

      const close =

        Number(item.close);


      if (!Number.isFinite(close)) {

        return;

      }


      const xx =

        x(index);


      const yy =

        y(close);


      if (index === 0) {

        context.moveTo(

          xx,

          yy

        );

      } else {

        context.lineTo(

          xx,

          yy

        );

      }

    }

  );



  context.strokeStyle =

    "#d9b45b";


  context.lineWidth = 1.8;


  context.lineJoin =

    "round";


  context.lineCap =

    "round";


  context.stroke();



  /*

    Subtle area below price

  */


  const lastIndex =

    candles.length - 1;


  context.beginPath();


  candles.forEach(

    (item, index) => {

      const close =

        Number(item.close);


      if (!Number.isFinite(close)) {

        return;

      }


      const xx =

        x(index);


      const yy =

        y(close);


      if (index === 0) {

        context.moveTo(

          xx,

          yy

        );

      } else {

        context.lineTo(

          xx,

          yy

        );

      }

    }

  );


  context.lineTo(

    x(lastIndex),

    height - padding.bottom

  );


  context.lineTo(

    x(0),

    height - padding.bottom

  );


  context.closePath();


  const gradient =

    context.createLinearGradient(

      0,

      padding.top,

      0,

      height - padding.bottom

    );


  gradient.addColorStop(

    0,

    "rgba(217,180,91,0.10)"

  );


  gradient.addColorStop(

    1,

    "rgba(217,180,91,0)"

  );


  context.fillStyle =

    gradient;


  context.fill();



  /*

    Last price marker

  */


  const last =

    candles[candles.length - 1];


  const lastClose =

    Number(last.close);


  if (Number.isFinite(lastClose)) {

    const lastX =

      x(lastIndex);


    const lastY =

      y(lastClose);



    context.fillStyle =

      "#d9b45b";


    context.beginPath();


    context.arc(

      lastX,

      lastY,

      3.5,

      0,

      Math.PI * 2

    );


    context.fill();



    /*

      Current price line

    */


    context.strokeStyle =

      "rgba(217,180,91,0.35)";


    context.setLineDash([

      4,

      5

    ]);


    context.beginPath();


    context.moveTo(

      padding.left,

      lastY

    );


    context.lineTo(

      width - padding.right,

      lastY

    );


    context.stroke();


    context.setLineDash([]);



    /*

      Current price label

    */


    context.fillStyle =

      "#d9b45b";


    context.font =

      "600 10px system-ui, sans-serif";


    context.textAlign =

      "left";


    context.fillText(

      money(lastClose),

      width - padding.right + 8,

      lastY + 3

    );

  }



  /*

    Bottom time labels

  */


  context.fillStyle =

    "#6f6b64";


  context.font =

    "10px system-ui, sans-serif";


  context.textAlign =

    "center";


  const labelCount =

    Math.min(5, candles.length);


  for (let i = 0; i < labelCount; i++) {

    const index =

      Math.round(

        i *

        (candles.length - 1) /

        Math.max(labelCount - 1, 1)

      );


    const item =

      candles[index];


    const timestamp =

      Number(

        item.time ??

        item.timestamp ??

        item.t

      );


    let label = "";


    if (Number.isFinite(timestamp)) {

      const date =

        new Date(

          timestamp < 100000000000

            ? timestamp * 1000

            : timestamp

        );


      label =

        date.toLocaleDateString(

          undefined,

          {

            month: "short",

            day: "numeric"

          }

        );

    }


    if (!label && item.timeLabel) {

      label =

        String(item.timeLabel);

    }


    if (label) {

      context.fillText(

        label,

        x(index),

        height - 12

      );

    }

  }

}



async function loadChart(

  range = currentRange

) {

  currentRange =

    range;


  if ($("chartState")) {

    $("chartState").textContent =

      "Loading real market history…";

  }


  try {

    const response =

      await fetch(

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


    if (

      !candles.length &&

      $("chartState")

    ) {

      $("chartState").innerHTML =

        '<svg width="30" height="18" viewBox="0 0 30 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 14L8 9L13 12L19 4L29 8" stroke="#5b5247" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>No history indexed for this pool yet</span>';

    }


  } catch (error) {

    console.error(

      "Chart:",

      error

    );


    candles = [];


    draw();


    if ($("chartState")) {

      $("chartState").textContent =

        "Historical data unavailable";

    }

  }

}



/* =========================================================

   WALLET

========================================================= */


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

   MARKET RANGE EVENTS

========================================================= */


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


      if (!button) {

        return;

      }


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

        "Register / Sign In";

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



window.addEventListener(

  "resize",

  draw

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
