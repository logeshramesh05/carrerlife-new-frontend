import client from "./client";

// Normalize the same way the backend does (trim + lowercase email) so the
// value sent, and any client-side comparisons against it, stay consistent
// with what actually gets stored.
const normalizeEmail = (email) => (email || "").trim().toLowerCase();

export const register = (name, email, password) =>
  client
    .post("/auth/register", {
      name: (name || "").trim(),
      email: normalizeEmail(email),
      password,
    })
    .then((r) => r.data);

export const login = (email, password) =>
  client
    .post("/auth/login", { email: normalizeEmail(email), password })
    .then((r) => r.data);

export const refresh = (refreshToken) =>
  client.post("/auth/refresh", { refreshToken }).then((r) => r.data);

export const logout = (refreshToken) =>
  client.post("/auth/logout", { refreshToken }).then((r) => r.data);