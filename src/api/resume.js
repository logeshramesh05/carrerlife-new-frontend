import client from "./client";

const LIST_KEY = "resumes:v1";
const LIST_TTL = 30 * 1000;
let listInflight = null;

function readListCache() {
  try {
    const raw = sessionStorage.getItem(LIST_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > LIST_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

export function getCachedResumes() {
  return readListCache();
}

function writeListCache(data) {
  try {
    sessionStorage.setItem(LIST_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore quota errors */
  }
}

export function invalidateResumeCache() {
  try {
    sessionStorage.removeItem(LIST_KEY);
  } catch {
    /* ignore */
  }
}

export const listResumes = (options = {}) => {
  const cached = !options.signal && readListCache();
  if (cached) return Promise.resolve(cached);
  if (listInflight) return listInflight;
  listInflight = client
    .get("/resumes", { signal: options.signal })
    .then((r) => {
      writeListCache(r.data);
      return r.data;
    })
    .finally(() => {
      listInflight = null;
    });
  return listInflight;
};

export const uploadResume = (file) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post("/resumes/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => {
      invalidateResumeCache();
      return r.data;
    });
};

export const analyzeResume = (resumeId, jobDescription) =>
  client
    .post(`/resumes/${resumeId}/analyze`, { jobDescription }, { timeout: 90000 })
    .then((r) => r.data);

export const getAnalyses = (resumeId) =>
  client.get(`/resumes/${resumeId}/analyses`).then((r) => r.data);

export const getAnalysis = (resumeId, analysisId) =>
  client.get(`/resumes/${resumeId}/analyses/${analysisId}`).then((r) => r.data);

export const getAllAnalyses = () =>
  client.get("/analyses").then((r) => r.data);

export const checkAts = (resumeId) =>
  client
    .post(`/resumes/${resumeId}/ats-check`, {}, { timeout: 90000 })
    .then((r) => r.data);
