const API_BASE = "";
const form = document.getElementById("forgotForm");
const state = document.getElementById("forgotState");

function setState(message, error = false) {
  if (!state) return;
  state.textContent = message || "";
  state.classList.toggle("error", error);
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { message: "Unexpected server response." }; }
}

if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = form.email.value.trim();
    if (!email) return;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    setState("Sending…");
    try {
      const response = await fetch(API_BASE + "/api/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) {
        setState(
          data.error === "rate_limited"
            ? "Too many attempts. Please wait a moment and try again."
            : (data.message || "Something went wrong. Please try again."),
          true
        );
        button.disabled = false;
        return;
      }
      setState("If that email has a GOLDITY account, a reset link has been sent. Please check your inbox (and spam folder).");
      form.reset();
    } catch {
      setState("Network error. Please try again.", true);
      button.disabled = false;
    }
  });
}
