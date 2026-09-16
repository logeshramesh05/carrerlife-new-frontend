import { useEffect, useRef, useState, useCallback } from "react";

export default function useSpeechRecognition({ lang = "en-US" } = {}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [confidence, setConfidence] = useState(null);
  const recRef = useRef(null);
  const finalRef = useRef("");
  const shouldContinueRef = useRef(false);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return undefined; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interimText = "";
      let newestConfidence = null;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) {
          finalRef.current += text.trim() + " ";
          newestConfidence = result[0]?.confidence ?? null;
        } else interimText += text;
      }
      setTranscript(finalRef.current.trim());
      setInterim(interimText);
      if (newestConfidence != null) setConfidence(newestConfidence);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "permission-denied") setError("Microphone access was denied. Allow microphone access in your browser.");
      else if (e.error === "audio-capture") setError("No working microphone was found.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Speech recognition: ${e.error}`);
      if (e.error !== "no-speech") shouldContinueRef.current = false;
    };
    rec.onend = () => {
      if (shouldContinueRef.current) {
        try { rec.start(); } catch { /* browser may already be restarting */ }
      } else setListening(false);
    };
    recRef.current = rec;
    return () => { shouldContinueRef.current = false; try { rec.stop(); } catch {} };
  }, [lang]);

  const start = useCallback(async () => {
    setError("");
    if (!recRef.current) return;
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError("Microphone access was denied. Allow microphone access in your browser."); return; }
    finalRef.current = "";
    setTranscript(""); setInterim(""); setConfidence(null);
    shouldContinueRef.current = true;
    try { recRef.current.start(); setListening(true); } catch { setListening(true); }
  }, []);

  const stop = useCallback(() => {
    shouldContinueRef.current = false;
    try { recRef.current?.stop(); } catch {}
    setListening(false);
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript(""); setInterim(""); setConfidence(null); setError("");
  }, []);

  return { supported, listening, transcript, interim, confidence, error, start, stop, reset };
}
