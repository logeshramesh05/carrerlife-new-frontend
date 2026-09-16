/*
 * Female-first Indian voice ranking for speechSynthesis.getVoices().
 *
 * The API exposes {name, lang, voiceURI, localService, default} — NO gender
 * flag — so selection is curated name matching + lang filtering. Always
 * degrade gracefully: not every device ships an en-IN female voice.
 */

// Best-known en-IN female voices first (Edge natural > legacy Windows).
const IN_FEMALE_NAMES = [/neerja/i, /heera/i, /swara/i, /divya/i];
// Well-known natural female voices used as cross-platform fallbacks.
const FALLBACK_FEMALE_NAMES = [
  /google\s+us\s+english/i,
  /google\s+uk\s+english\s+female/i,
  /^samantha/i,
  /jenny/i,
  /aria/i,
  /zira/i,
];

const isEnIn = (v) => /^en[-_]IN/i.test(v?.lang || "");
const isEn = (v) => /^en[-_]/i.test(v?.lang || "");
const matchesAny = (v, patterns) =>
  patterns.some((re) => re.test(v?.name || ""));

export function pickIndianFemaleVoice(voices) {
  const list = Array.isArray(voices) ? voices : [];
  if (list.length === 0) return { voice: null, quality: null };

  // 1. Named en-IN female (e.g. Neerja natural on Edge/Windows).
  const namedIn =
    list.find((v) => isEnIn(v) && matchesAny(v, IN_FEMALE_NAMES)) ||
    list.find((v) => matchesAny(v, IN_FEMALE_NAMES));
  if (namedIn) {
    const natural = /natural|online|google/i.test(namedIn.name);
    return { voice: namedIn, quality: natural ? "natural" : "standard" };
  }

  // 2. Any en-IN voice (device default for the locale).
  const anyIn = list.find(isEnIn);
  if (anyIn) return { voice: anyIn, quality: "standard" };

  // 3. Known natural female voices in other English accents.
  const fallback = list.find((v) => isEn(v) && matchesAny(v, FALLBACK_FEMALE_NAMES));
  if (fallback) return { voice: fallback, quality: "standard" };

  // 4. Any English voice at all.
  const anyEn = list.find(isEn);
  if (anyEn) return { voice: anyEn, quality: "fallback" };

  return { voice: null, quality: null };
}

export const QUALITY_LABEL = {
  natural: "Natural",
  standard: "Standard",
  fallback: "Basic",
};

// Sort for the picker: en-IN first, then known female names,
// then other English, then everything else.
export function sortVoicesFemaleFirst(voices) {
  const list = Array.isArray(voices) ? [...voices] : [];
  const score = (v) => {
    if (isEnIn(v) && matchesAny(v, IN_FEMALE_NAMES)) return 0;
    if (isEnIn(v)) return 1;
    if (isEn(v) && matchesAny(v, FALLBACK_FEMALE_NAMES)) return 2;
    if (isEn(v)) return 3;
    return 4;
  };
  return list.sort((a, b) => score(a) - score(b));
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
