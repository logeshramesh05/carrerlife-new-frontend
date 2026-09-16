import client from "./client";

export const listSkills = () =>
  client.get("/skills").then((r) => r.data);

export const upsertSkill = ({ skill, level, source }) =>
  client.post("/skills", { skill, level, source }).then((r) => r.data);

export const updateSkill = (id, { skill, level }) =>
  client.put(`/skills/${id}`, { skill, level }).then((r) => r.data);

export const deleteSkill = (id) =>
  client.delete(`/skills/${id}`).then((r) => r.data);

export const getSkillTracks = () =>
  client.get("/skills/tracks").then((r) => r.data);

export const getSkillGaps = () =>
  client.get("/skills/gaps").then((r) => r.data);

export const getResumeProfile = () =>
  client.get("/resume-profile").then((r) => r.data);

export const saveResumeProfile = (profile) =>
  client.put("/resume-profile", profile).then((r) => r.data);

export const importResumeToProfile = (resumeId) =>
  client.post(`/resume-profile/import/${resumeId}`).then((r) => r.data);

export const SKILL_LEVELS = ["LEARNING", "PROFICIENT", "EXPERT"];

export const LEVEL_LABEL = {
  LEARNING: "Learning",
  PROFICIENT: "Proficient",
  EXPERT: "Expert",
};

export const STAGE_LABEL = {
  STUDENT: "Student",
  EARLY_CAREER: "Early career",
  SENIOR: "Senior",
  UNSPECIFIED: "Not set",
};
