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

 

 

 

async function load() {

 

 

 

  try {

 

 

 

    setState(

 

      "Loading dashboard…"

 

    );

 

 

 

    const data =

 

      await api("/api/me");

 

 

 

    renderAccount(data);

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

setupLogout();

load();
