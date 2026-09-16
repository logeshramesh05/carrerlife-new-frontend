import { useCallback, useEffect, useRef, useState } from "react";
import { pickIndianFemaleVoice, isIOS } from "../utils/voicePick";
import { clampRate, clampPitch } from "../utils/prosody";

const PREF_VOICE_URI = "ttsVoiceURI";
const PREF_RATE = "ttsRate";
const PREF_PITCH = "ttsPitch";

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export default function useSpeechSynthesis() {
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(() => {
    const v = parseFloat(readPref(PREF_RATE, "1"));
    return Number.isFinite(v) ? clampRate(v) : 1;
  });
  const [pitch, setPitchState] = useState(() => {
    const v = parseFloat(readPref(PREF_PITCH, "1"));
    return Number.isFinite(v) ? clampPitch(v) : 1;
  });
  const [voice, setVoiceState] = useState(null);
  const [voiceQuality, setVoiceQuality] = useState(null);

  const voicesRef = useRef([]);
  const utteranceRef = useRef(null);
  const voiceRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const chunkQueueRef = useRef(null);
  const pausedChunkRef = useRef(null);

  /*
   * Every new speech request gets a unique ID.
   * This prevents old callbacks from modifying
   * the state of a newer utterance.
   */
  const speechIdRef = useRef(0);

  /*
   * Prevent duplicate requests for the same text.
   */
  const lastSpokenTextRef = useRef("");

  // ============================================================
  // LOAD VOICES
  // ============================================================

  useEffect(() => {
    if (!supported) {
      return;
    }

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const list = synth.getVoices();

      if (!list || list.length === 0) {
        return;
      }

      voicesRef.current = list;
      setVoices(list);

      // Prefer the stored choice; otherwise auto-pick a female Indian voice.
      const storedUri = readPref(PREF_VOICE_URI, null);
      const stored = storedUri && list.find((v) => v.voiceURI === storedUri);
      if (stored) {
        voiceRef.current = stored;
        setVoiceState(stored);
        setVoiceQuality("custom");
      } else if (!voiceRef.current) {
        const { voice: picked, quality } = pickIndianFemaleVoice(list);
        if (picked) {
          voiceRef.current = picked;
          setVoiceState(picked);
          setVoiceQuality(quality);
        }
      }

      const defaultVoice = list.find(
        (voice) => voice.default === true
      );

      if (import.meta.env.DEV) console.log(
        "TTS voices:",
        list.length
      );

      if (defaultVoice) {
        if (import.meta.env.DEV) console.log(
          "TTS default voice:",
          defaultVoice.name,
          defaultVoice.lang
        );
      }
    };

    /*
     * Some browsers provide voices immediately.
     */
    loadVoices();

    /*
     * Chrome often provides them later.
     */
    synth.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      synth.removeEventListener(
        "voiceschanged",
        loadVoices
      );
    };
  }, [supported]);

  // ============================================================
  // SPEAK
  // ============================================================

  const speak = useCallback(
    (text) => {
      if (!supported) {
        if (import.meta.env.DEV) console.warn(
          "Speech synthesis is not supported."
        );
        return false;
      }

      const cleanText =
        text?.trim();

      if (!cleanText) {
        return false;
      }

      const synth =
        window.speechSynthesis;

      /*
       * IMPORTANT:
       *
       * If exactly the same text is already
       * speaking or pending, do not queue it again.
       */
      if (
        lastSpokenTextRef.current ===
          cleanText &&
        (synth.speaking ||
          synth.pending)
      ) {
        if (import.meta.env.DEV) console.log(
          "TTS duplicate blocked"
        );

        return false;
      }

      /*
       * Mark this text immediately.
       *
       * This happens BEFORE the asynchronous
       * queue operation.
       */
      lastSpokenTextRef.current =
        cleanText;

      /*
       * Invalidate all previous utterances.
       */
      const speechId =
        ++speechIdRef.current;

      /*
       * Cancel existing speech only when
       * something is actually active.
       */
      if (
        synth.speaking ||
        synth.pending ||
        synth.paused
      ) {
        synth.cancel();
      }

      /*
       * Always get the latest voice list.
       */
      const availableVoices =
        synth.getVoices();

      if (
        availableVoices.length > 0
      ) {
        voicesRef.current =
          availableVoices;

        setVoices(
          availableVoices
        );
      }

      /*
       * Browser / OS DEFAULT VOICE
       *
       * First preference:
       * voice.default === true
       *
       * Then sensible language fallback.
       */
      const defaultVoice =
        availableVoices.find(
          (voice) =>
            voice.default === true
        ) ||
        availableVoices.find(
          (voice) =>
            /^en-IN$/i.test(
              voice.lang
            )
        ) ||
        availableVoices.find(
          (voice) =>
            /^en-/i.test(
              voice.lang
            )
        ) ||
        null;

      if (defaultVoice) {
        if (import.meta.env.DEV) console.log(
          "TTS using voice:",
          defaultVoice.name,
          defaultVoice.lang
        );
      } else {
        if (import.meta.env.DEV) console.log(
          "TTS using browser default voice"
        );
      }

      const utterance =
        new SpeechSynthesisUtterance(
          cleanText
        );

      utterance.rate = clampRate(rate);
      utterance.pitch = clampPitch(pitch);
      utterance.volume = 1;

      /*
       * Prefer the selected (female Indian-first) voice, falling back to
       * the previous default-voice logic when nothing is selected.
       */
      const selected = voiceRef.current;
      if (selected) {
        utterance.voice = selected;
        utterance.lang = selected.lang;
      } else if (defaultVoice) {
        utterance.voice =
          defaultVoice;

        utterance.lang =
          defaultVoice.lang;
      } else {
        /*
         * Let browser choose its own voice.
         */
        utterance.lang =
          "en-IN";
      }

      // --------------------------------------------------------
      // START
      // --------------------------------------------------------

      utterance.onstart = () => {
        if (
          speechId !==
          speechIdRef.current
        ) {
          return;
        }

        if (import.meta.env.DEV) console.log(
          "TTS START"
        );

        setSpeaking(true);
        setPaused(false);
      };

      // --------------------------------------------------------
      // PAUSE
      // --------------------------------------------------------

      utterance.onpause = () => {
        if (
          speechId !==
          speechIdRef.current
        ) {
          return;
        }

        if (import.meta.env.DEV) console.log(
          "TTS PAUSE"
        );

        setPaused(true);
      };

      // --------------------------------------------------------
      // RESUME
      // --------------------------------------------------------

      utterance.onresume = () => {
        if (
          speechId !==
          speechIdRef.current
        ) {
          return;
        }

        if (import.meta.env.DEV) console.log(
          "TTS RESUME"
        );

        setPaused(false);
      };

      // --------------------------------------------------------
      // END
      // --------------------------------------------------------

      utterance.onend = () => {
        if (
          speechId !==
          speechIdRef.current
        ) {
          return;
        }

        if (import.meta.env.DEV) console.log(
          "TTS END"
        );

        setSpeaking(false);
        setPaused(false);

        utteranceRef.current =
          null;

        /*
         * Allow this text to be spoken
         * again manually later.
         */
        lastSpokenTextRef.current =
          "";
      };

      // --------------------------------------------------------
      // ERROR
      // --------------------------------------------------------

      utterance.onerror = (event) => {
        /*
         * Chrome/Safari can emit these when
         * speech is intentionally cancelled.
         *
         * They are NOT application errors.
         */
        if (
          event.error !==
            "canceled" &&
          event.error !==
            "interrupted"
        ) {
          console.error(
            "TTS ERROR:",
            event.error
          );
        } else {
          if (import.meta.env.DEV) console.log(
            "TTS canceled/interrupted"
          );
        }

        /*
         * Ignore callbacks from old utterances.
         */
        if (
          speechId !==
          speechIdRef.current
        ) {
          return;
        }

        setSpeaking(false);
        setPaused(false);

        utteranceRef.current =
          null;

        lastSpokenTextRef.current =
          "";
      };

      utteranceRef.current =
        utterance;

      /*
       * Chrome is more reliable if speak()
       * happens after cancel() has completed.
       */
      window.setTimeout(() => {
        if (
          speechId !==
          speechIdRef.current
        ) {
          return;
        }

        if (import.meta.env.DEV) console.log(
          "TTS QUEUE"
        );

        synth.speak(
          utterance
        );

        /*
         * Recover if the browser is
         * unexpectedly left paused.
         */
        if (synth.paused) {
          synth.resume();
        }
      }, 50);

      return true;
    },
    [supported, rate, pitch]
  );

  // ============================================================
  // VOICE + PITCH PREFS (persisted)
  // ============================================================

  const persist = (key, value) => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* storage blocked — prefs simply won't persist */
    }
  };

  const setVoice = useCallback((v) => {
    const resolved =
      typeof v === "string"
        ? voicesRef.current.find((x) => x.voiceURI === v) || null
        : v || null;
    voiceRef.current = resolved;
    setVoiceState(resolved);
    setVoiceQuality(resolved ? "custom" : null);
    if (resolved) persist(PREF_VOICE_URI, resolved.voiceURI);
    else {
      try {
        localStorage.removeItem(PREF_VOICE_URI);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setPitch = useCallback((v) => {
    const next = clampPitch(Number(v) || 1);
    setPitchState(next);
    persist(PREF_PITCH, next);
  }, []);

  const setRatePersisted = useCallback(
    (v) => {
      const next = clampRate(Number(v) || 1);
      setRate(next);
      persist(PREF_RATE, next);
    },
    // setRate is a stable state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ============================================================
  // EXPRESSIVE CHUNK QUEUE
  // ============================================================

  const clearChunkTimer = () => {
    if (chunkTimerRef.current) {
      window.clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
  };

  const playChunk = useCallback(
    (queue, speechId) => {
      if (speechId !== speechIdRef.current) return;
      const chunk = queue.chunks[queue.index];
      if (!chunk) {
        chunkQueueRef.current = null;
        setSpeaking(false);
        setPaused(false);
        lastSpokenTextRef.current = "";
        return;
      }
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.rate = clampRate(queue.baseRate * (chunk.rate || 1));
      u.pitch = clampPitch(queue.basePitch * (chunk.pitch || 1));
      u.volume = 1;
      if (queue.voice) {
        u.voice = queue.voice;
        u.lang = queue.voice.lang;
      } else {
        u.lang = "en-IN";
      }
      u.onstart = () => {
        if (speechId !== speechIdRef.current) return;
        setSpeaking(true);
        setPaused(false);
      };
      u.onend = () => {
        if (speechId !== speechIdRef.current) return;
        queue.index += 1;
        if (queue.index >= queue.chunks.length) {
          chunkQueueRef.current = null;
          setSpeaking(false);
          setPaused(false);
          lastSpokenTextRef.current = "";
          return;
        }
        chunkTimerRef.current = window.setTimeout(() => {
          chunkTimerRef.current = null;
          playChunk(queue, speechId);
        }, queue.chunks[queue.index - 1].pauseAfter ?? 200);
      };
      u.onerror = (event) => {
        if (speechId !== speechIdRef.current) return;
        if (event.error === "canceled" || event.error === "interrupted") return;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error("TTS chunk error:", event.error);
        }
        chunkQueueRef.current = null;
        setSpeaking(false);
        setPaused(false);
      };
      utteranceRef.current = u;
      synth.speak(u);
      if (synth.paused) synth.resume();
    },
    []
  );

  /*
   * Speak pre-built prosody chunks (see utils/prosody.js) as one
   * expressive delivery. Fully cancellable via stop().
   */
  const speakChunks = useCallback(
    (chunks, opts = {}) => {
      if (!supported) return false;
      const list = (Array.isArray(chunks) ? chunks : []).filter((c) => c?.text?.trim());
      if (list.length === 0) return false;
      const synth = window.speechSynthesis;
      ++speechIdRef.current;
      clearChunkTimer();
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      const speechId = speechIdRef.current;
      const queue = {
        chunks: list,
        index: 0,
        baseRate: clampRate(opts.rate ?? rate),
        basePitch: clampPitch(opts.pitch ?? pitch),
        voice: opts.voice || voiceRef.current,
      };
      chunkQueueRef.current = queue;
      pausedChunkRef.current = null;
      lastSpokenTextRef.current = list.map((c) => c.text).join(" ");
      setPaused(false);
      playChunk(queue, speechId);
      return true;
    },
    [supported, rate, pitch, playChunk]
  );

  // ============================================================
  // PAUSE
  // ============================================================

  const pause = useCallback(() => {
    if (!supported) {
      return;
    }

    const synth =
      window.speechSynthesis;

    /*
     * iOS Safari pause()/resume() is unreliable, so for an active chunk
     * queue we cancel and remember the position instead — resume()
     * restarts from the current chunk.
     */
    if (isIOS() && chunkQueueRef.current) {
      pausedChunkRef.current = {
        chunks: chunkQueueRef.current.chunks,
        index: chunkQueueRef.current.index,
        baseRate: chunkQueueRef.current.baseRate,
        basePitch: chunkQueueRef.current.basePitch,
        voice: chunkQueueRef.current.voice,
      };
      clearChunkTimer();
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      setPaused(true);
      return;
    }

    if (
      synth.speaking &&
      !synth.paused
    ) {
      synth.pause();
    }
  }, [supported]);

  // ============================================================
  // RESUME
  // ============================================================

  const resume = useCallback(() => {
    if (!supported) {
      return;
    }

    const synth =
      window.speechSynthesis;

    if (pausedChunkRef.current) {
      const saved = pausedChunkRef.current;
      pausedChunkRef.current = null;
      const speechId = ++speechIdRef.current;
      const queue = { ...saved };
      chunkQueueRef.current = queue;
      setPaused(false);
      playChunk(queue, speechId);
      return;
    }

    if (synth.paused) {
      synth.resume();
    }
  }, [supported, playChunk]);

  // ============================================================
  // STOP
  // ============================================================

  const stop = useCallback(() => {
    if (!supported) {
      return;
    }

    /*
     * Invalidate all pending callbacks + the chunk queue.
     */
    ++speechIdRef.current;
    clearChunkTimer();
    chunkQueueRef.current = null;
    pausedChunkRef.current = null;

    window.speechSynthesis.cancel();

    utteranceRef.current =
      null;

    lastSpokenTextRef.current =
      "";

    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  // ============================================================
  // CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      if (!supported) {
        return;
      }

      ++speechIdRef.current;
      clearChunkTimer();
      chunkQueueRef.current = null;
      pausedChunkRef.current = null;

      window.speechSynthesis.cancel();

      utteranceRef.current =
        null;
    };
  }, [supported]);

  return {
    supported,
    voices,
    voice,
    voiceQuality,
    setVoice,
    speaking,
    paused,
    rate,
    setRate: setRatePersisted,
    pitch,
    setPitch,
    speak,
    speakChunks,
    pause,
    resume,
    stop,
  };
}