import client from "./client";

const DASH_CACHE_KEY = "dashboard:v1";
const DASH_TTL = 60 * 1000;
const SWR_TTL = 60 * 1000;
// Aggregation endpoints legitimately take longer server-side (they scan all
// sessions/analyses), so they get a longer client timeout than the 15s default.
const HEAVY_TIMEOUT = 30000;
let dashInflight = null;
const inflight = new Map();

function readCache(key, ttl) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > ttl) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore quota errors */
  }
}

// Repeat visits within TTL resolve instantly from sessionStorage and
// dedupe concurrent callers; otherwise fetch and repopulate the cache.
function cachedGet(key, url, config = {}) {
  const cached = readCache(key, SWR_TTL);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(key)) return inflight.get(key);
  const p = client
    .get(url, config)
    .then((r) => {
      writeCache(key, r.data);
      return r.data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function invalidateDashboardCache() {
  try {
    sessionStorage.removeItem(DASH_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function getCachedDashboard() {
  return readCache(DASH_CACHE_KEY, DASH_TTL);
}

function setCachedDashboard(data) {
  writeCache(DASH_CACHE_KEY, data);
}

export const getDashboard = (days, options = {}) => {
  const params = days ? { days } : {};
  const signal = options.signal;
  if (dashInflight) return dashInflight;
  dashInflight = client
    .get("/dashboard", { params, signal, timeout: HEAVY_TIMEOUT })
    .then((r) => {
      setCachedDashboard(r.data);
      return r.data;
    })
    .finally(() => {
      dashInflight = null;
    });
  return dashInflight;
};

export const refreshDashboard = (days, options = {}) =>
  client
    .get("/dashboard", { params: days ? { days } : {}, signal: options.signal, timeout: HEAVY_TIMEOUT })
    .then((r) => {
      setCachedDashboard(r.data);
      return r.data;
    });

export const getInterviewPerformance = (days) =>
  client
    .get("/dashboard/interview", { params: days ? { days } : {} })
    .then((r) => r.data);

export const getResumePerformance = (days) =>
  client
    .get("/dashboard/resume", { params: days ? { days } : {} })
    .then((r) => r.data);

export const getSuggestions = () =>
  cachedGet("suggestions:v1", "/dashboard/suggestions", { timeout: HEAVY_TIMEOUT });

export const getMissingSkills = () =>
  cachedGet("missing-skills:v1", "/dashboard/missing-skills", { timeout: HEAVY_TIMEOUT });

export const getImprovementAreas = () =>
  cachedGet("improvement:v1", "/dashboard/improvement-areas", { timeout: HEAVY_TIMEOUT });

export const getEssentials = () =>
  client.get("/dashboard/essentials").then((r) => r.data);

export const getBenchmark = () =>
  cachedGet("benchmark:v1", "/dashboard/benchmark", { timeout: HEAVY_TIMEOUT });

export const setCareerStage = (careerStage) =>
  client.put("/dashboard/career-stage", { careerStage }).then((r) => r.data);
