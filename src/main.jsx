import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// This app uses no service worker. Unregister any stale worker left on this
// origin (e.g. from another local project on the same port) — a stale worker
// intercepts our API calls and throws "Failed to fetch" spam from sw.js.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((r) => {
        r.unregister();
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[sw] unregistered stale worker:", r.scope);
        }
      });
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
