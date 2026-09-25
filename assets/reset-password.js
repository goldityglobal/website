const API_BASE = "";
const form = document.getElementById("resetForm");
const state = document.getElementById("resetState");
const token = new URLSearchParams(location.search).get("token") || "";
// SECURITY: remove the secret token from the address bar/history once read.
if (token) { try { history.replaceState(null, "", location.pathname); } catch {} }

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

if (!token) {
  setState("This reset link is missing its token. Please request a new one from the forgot password page.", true);
  if (form) form.querySelector("button[type='submit']").disabled = true;
}

if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const password = form.password.value;
    if (password.length < 10) {
      setState("Password must be at least 10 characters.", true);
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    setState("Updating…");
    try {
      const response = await fetch(API_BASE + "/api/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) {
        const messages = {
          expired_or_invalid_token: "This reset link is invalid or has expired. Please request a new one.",
          weak_password: "Password must be at least 10 characters."
        };
        setState(messages[data.error] || data.message || "Something went wrong. Please try again.", true);
        button.disabled = false;
        return;
      }
      setState("Password updated. Redirecting you to sign in…");
      form.reset();
      setTimeout(() => { location.href = "/login.html"; }, 1800);
    } catch {
      setState("Network error. Please try again.", true);
      button.disabled = false;
    }
  });
}
