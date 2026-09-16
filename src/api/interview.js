import client from "./client";

export const startInterview = (payload) =>
  client.post("/interview/start", payload).then((r) => r.data);

export const submitAnswer = (sessionId, answer) =>
  client.post(`/interview/${sessionId}/answer`, { answer }).then((r) => r.data);

export const getSummary = (sessionId) =>
  client.get(`/interview/${sessionId}/summary`).then((r) => r.data);
