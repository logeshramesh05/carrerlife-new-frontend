import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://carrerlife-new-build1.onrender.com/api/v1";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

async function doRefresh() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("no refresh token");
  const res = await axios.post(
    `${API_BASE}/auth/refresh`,
    { refreshToken },
    { timeout: 15000 }
  );
  localStorage.setItem("accessToken", res.data.accessToken);
  localStorage.setItem("refreshToken", res.data.refreshToken);
  return res.data.accessToken;
}

// Ping the backend so a cold instance wakes before the user submits a form.
// Fire-and-forget: never blocks UI, never throws, never touches auth state.
// NOTE: uses bare fetch (not the axios client) so a 401 here can never
// trigger the refresh/redirect interceptor.
export function warmBackend() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const base = API_BASE.replace(/\/api\/v1\/?$/, "");
  fetch(`${base}/actuator/health`, { signal: controller.signal })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

export function friendlyApiError(err, fallback) {
  if (err?.code === "ECONNABORTED" || err?.message?.includes("timeout")) {
    return "Server is taking too long. The backend may be busy — please retry.";
  }
  if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
    return "Request was cancelled. Please retry.";
  }
  if (!err?.response) {
    return "Cannot reach the server. Check your connection and retry.";
  }
  return err.response?.data?.message || fallback;
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Retry idempotent GETs once on timeout / network loss (never POSTs).
    const isGet = original?.method?.toLowerCase() === "get";
    const isTimeout = error?.code === "ECONNABORTED" || error?.message?.includes("timeout");
    const isNetwork = !error?.response && (error?.code === "ERR_NETWORK" || isTimeout);
    if (isGet && isNetwork && original && !original._retryGet) {
      original._retryGet = true;
      try {
        return await client(original);
      } catch (retryErr) {
        return Promise.reject(retryErr);
      }
    }
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default client;
