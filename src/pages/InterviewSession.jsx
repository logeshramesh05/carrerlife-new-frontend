import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { submitAnswer } from "../api/interview";
import { Spinner } from "../components/Loader";
import ScorePill from "../components/ScorePill";

import useSpeechRecognition from "../hooks/useSpeechRecognition";
import useSpeechSynthesis from "../hooks/useSpeechSynthesis";
import { splitIntoChunks, buildLeadIn, difficultyBase } from "../utils/prosody";
import { sortVoicesFemaleFirst, QUALITY_LABEL } from "../utils/voicePick";

export default function InterviewSession() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ============================================================
  // INTERVIEW STATE (survives refresh via sessionStorage)
  // ============================================================

  const storageKey = sessionId ? `interview:${sessionId}` : null;

  const readStored = () => {
    if (!storageKey) return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const stored = readStored();

  const [question, setQuestion] = useState(
    location.state?.question || stored?.question || ""
  );

  const [questionIndex, setQuestionIndex] = useState(
    location.state?.questionIndex ?? stored?.questionIndex ?? 0
  );

  const [totalQuestions, setTotalQuestions] = useState(
    location.state?.totalQuestions ?? stored?.totalQuestions ?? 0
  );

  const [answer, setAnswer] = useState("");
  const [lastFeedback, setLastFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const [autoRead, setAutoRead] = useState(true);

  const [elapsed, setElapsed] = useState(0);
  const [interimOnly] = useState(false);
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState(
    location.state?.difficulty || stored?.difficulty || "MEDIUM"
  );

  const hasQuestion = Boolean(question?.trim());
  const missingSession = !sessionId;
  const expiredSession = !missingSession && !hasQuestion;

  // Persist current question so a reload doesn't lose the session.
  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ question, questionIndex, totalQuestions, difficulty })
      );
    } catch {
      /* storage full/blocked — session simply won't survive reload */
    }
  }, [storageKey, question, questionIndex, totalQuestions, difficulty]);

  // ============================================================
  // SPEECH RECOGNITION
  // ============================================================

  const {
    supported,
    listening,
    transcript,
    interim,
    confidence,
    error: micError,
    start,
    stop,
    reset,
  } = useSpeechRecognition();

  // ============================================================
  // NATIVE SPEECH SYNTHESIS TTS (replaces talkify-tts which has no ESM build)
  // ============================================================

  const {
    supported: ttsSupported,
    voices: ttsVoices,
    voice: ttsVoice,
    voiceQuality,
    setVoice: setTtsVoice,
    speaking: ttsSpeaking,
    paused: ttsPaused,
    rate: ttsRate,
    setRate: setTtsRate,
    pitch: ttsPitch,
    setPitch: setTtsPitch,
    speakChunks: ttsSpeakChunks,
    pause: ttsPause,
    resume: ttsResume,
    stop: ttsStop,
  } = useSpeechSynthesis();

    const sortedVoices = useMemo(() => sortVoicesFemaleFirst(ttsVoices), [ttsVoices]);

  /*
   * Prevent duplicate automatic playback
   * for the same question.
   */
  const autoReadQuestionRef = useRef("");

  // Stop any speech when the page unmounts (native hook also cleans up).
  useEffect(() => {
    return () => {
      try {
        ttsStop();
      } catch {
        /* ignore cleanup errors */
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // STOP TTS
  // ============================================================

  const stopTTS = () => {
    try {
      ttsStop();
    } catch {
      /* ignore */
    }
  };

  // ============================================================
  // SPEAK QUESTION
  // ============================================================

  const speakQuestion = (text) => {
    const cleanText = text?.trim();

    if (!cleanText) {
      return;
    }

    /*
     * Never speak while candidate is using microphone.
     */
    if (listening) {
      return;
    }

    if (!ttsSupported) {
      setError("Interviewer voice is not supported in this browser.");
      return;
    }

    // Interviewer persona: contextual lead-in + difficulty base tone,
    // delivered as expressive prosody chunks (female Indian voice).
    const leadIn = buildLeadIn({
      questionIndex,
      lastScore: lastFeedback?.score ?? null,
    });
    const base = difficultyBase(difficulty);
    const fullText = leadIn ? `${leadIn} ${cleanText}` : cleanText;
    const chunks = splitIntoChunks(fullText);

    setError("");
    const ok = ttsSpeakChunks(chunks, {
      rate: ttsRate * base.rate,
      pitch: ttsPitch * base.pitch,
    });
    if (!ok) {
      setError("Unable to play interviewer voice.");
    }
  };

  // ============================================================
  // PAUSE TTS
  // ============================================================

  const pauseTTS = () => {
    ttsPause();
  };

  // ============================================================
  // RESUME TTS
  // ============================================================

  const resumeTTS = () => {
    ttsResume();
  };

  // ============================================================
  // PLAY / PAUSE / RESUME
  // ============================================================

  const handlePlayQuestion = () => {
    if (!question || listening) {
      return;
    }

    /*
     * Speaking → pause.
     */
    if (
      ttsSpeaking &&
      !ttsPaused
    ) {
      pauseTTS();
      return;
    }

    /*
     * Paused → resume.
     */
    if (ttsPaused) {
      resumeTTS();
      return;
    }

    /*
     * Ready → speak.
     */
    speakQuestion(question);
  };

  // ============================================================
  // SPEECH RATE
  // ============================================================

  const handleRateChange = (rate) => {
    setTtsRate(rate);
  };

  // ============================================================
  // SPEECH PITCH + VOICE
  // ============================================================

  const handlePitchChange = (pitch) => {
    setTtsPitch(pitch);
  };

  const handleVoiceChange = (voiceURI) => {
    setTtsVoice(voiceURI);
  };

  // ============================================================
  // QUESTION CHANGE
  // ============================================================

  useEffect(() => {
    setElapsed(0);
    setAnswer("");
    setError("");

    /*
     * Stop microphone when question changes.
     */
    if (listening) {
      stop();
    }

    /*
     * Stop previous question speech.
     */
    stopTTS();

    reset();

    /*
     * New question gets a new auto-read opportunity.
     */
    autoReadQuestionRef.current = "";
  }, [question]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // AUTO READ
  // ============================================================

  useEffect(() => {
    if (
      !autoRead ||
      !question ||
      listening
    ) {
      return;
    }

    /*
     * Already auto-read this question.
     */
    if (
      autoReadQuestionRef.current ===
      question
    ) {
      return;
    }

    autoReadQuestionRef.current =
      question;

    /*
     * Small delay so the question state/render
     * settles before speech starts.
     */
    const timer = window.setTimeout(() => {
      if (!listening) {
        speakQuestion(question);
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    question,
    autoRead,
    listening,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // ANSWER TIMER
  // ============================================================

  useEffect(() => {
    if (!listening) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setElapsed(
        (value) => value + 1
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [listening]);

  // ============================================================
  // SPEECH RECOGNITION → ANSWER
  // ============================================================

  useEffect(() => {
    if (
      transcript &&
      !interimOnly
    ) {
      setAnswer(transcript);
    }
  }, [
    transcript,
    interimOnly,
  ]);

  // ============================================================
  // DISPLAY ANSWER
  // ============================================================

  const displayAnswer = useMemo(() => {
    if (!interim) {
      return answer;
    }

    return `${answer}${
      answer ? " " : ""
    }${interim}`;
  }, [
    answer,
    interim,
  ]);

  // ============================================================
  // PROGRESS
  // ============================================================

  const progressPct = totalQuestions
    ? Math.min(
        100,
        ((questionIndex + 1) /
          totalQuestions) *
          100
      )
    : 0;

  // ============================================================
  // TIME
  // ============================================================

  const timeLabel = `${String(
    Math.floor(elapsed / 60)
  ).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  // ============================================================
  // CONFIDENCE
  // ============================================================

  const confidenceLabel =
    confidence == null
      ? "—"
      : `${Math.round(
          confidence * 100
        )}%`;

  // ============================================================
  // MICROPHONE
  // ============================================================

  const toggleMic = async () => {
    setError("");

    /*
     * Stop listening.
     */
    if (listening) {
      stop();
      return;
    }

    if (!hasQuestion) {
      setError("No active question. Please restart the interview.");
      return;
    }

    /*
     * VERY IMPORTANT:
     *
     * Stop interviewer TTS before microphone starts.
     *
     * This prevents the microphone from hearing
     * the interviewer.
     */
    stopTTS();

    try {
      await start();
    } catch (err) {
      console.error(
        "Microphone start error:",
        err
      );

      setError(
        err?.message ||
          "Unable to start microphone."
      );
    }
  };

  // ============================================================
  // AUTO READ TOGGLE
  // ============================================================

  const handleAutoReadChange = (
    checked
  ) => {
    setAutoRead(checked);

    /*
     * Auto-read OFF.
     */
    if (!checked) {
      stopTTS();
      return;
    }

    /*
     * Allow current question to play again.
     */
    autoReadQuestionRef.current =
      "";

    /*
     * Start current question immediately.
     */
    if (
      question &&
      !listening
    ) {
      speakQuestion(question);
    }
  };

  // ============================================================
  // CLEAR ANSWER
  // ============================================================

  const handleClear = () => {
    if (listening) {
      stop();
    }
    setAnswer("");
    setError("");
    reset();
  };

  // ============================================================
  // SUBMIT ANSWER
  // ============================================================

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    if (!sessionId) {
      setError(
        "Missing session id. Please restart the interview."
      );

      return;
    }

    if (!hasQuestion) {
      setError(
        "No active question. Please restart the interview or view the summary."
      );

      return;
    }

    const finalAnswer =
      displayAnswer.trim();

    if (!finalAnswer) {
      setError(
        "Please provide an answer before submitting."
      );

      return;
    }

    /*
     * Stop microphone.
     */
    if (listening) {
      stop();
    }

    /*
     * Stop interviewer speech.
     */
    stopTTS();

    setError("");
    setLoading(true);

    try {
      const data =
        await submitAnswer(
          sessionId,
          finalAnswer
        );

      /*
       * Save feedback.
       */
      setLastFeedback({
        score: data.score,
        feedback:
          data.feedback,
      });

      reset();

      /*
       * Interview completed.
       */
      if (
        data.status ===
          "COMPLETED" ||
        !data.nextQuestion
      ) {
        try {
          if (storageKey) sessionStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        navigate(
          `/interview/${sessionId}/summary`
        );

        return;
      }

      /*
       * Move to next question.
       */
      setQuestion(
        data.nextQuestion
      );

      setQuestionIndex(
        data.nextQuestionIndex ??
          data.questionIndex ??
          questionIndex + 1
      );

      if (data.totalQuestions) {
        setTotalQuestions(data.totalQuestions);
      }
    } catch (err) {
      console.error(
        "Submit answer error:",
        err
      );

      setError(
        err.response?.data
          ?.message ||
          "Failed to submit answer"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="page interview-page">

      {/* ======================================================
          PAGE HEADER
      ======================================================= */}

      <div className="page-header">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-mark" />
            CAREERLIFE / INTERVIEW
          </p>

          <h2>
            Question{" "}
            {questionIndex + 1}

            {totalQuestions
              ? ` / ${totalQuestions}`
              : ""}
          </h2>

          <p className="page-sub">
            Listen, think, speak — then
            refine your answer.
          </p>
        </div>

        {lastFeedback && (
          <ScorePill
            score={
              lastFeedback.score
            }
          />
        )}
      </div>

      {/* ======================================================
          PROGRESS
      ======================================================= */}

      {(missingSession || expiredSession) && (
        <div className="feedback-box" style={{ marginBottom: 16 }}>
          <strong>
            {missingSession ? "Missing session" : "Session expired or reloaded"}
          </strong>
          <p style={{ margin: "6px 0 12px", color: "var(--text)" }}>
            {missingSession
              ? "No session id was found in the URL. Please start a new interview."
              : "This question could not be restored (e.g. after a refresh). You can view the summary or start a new interview."}
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            {!missingSession && (
              <button type="button" onClick={() => navigate(`/interview/${sessionId}/summary`)}>
                View summary
              </button>
            )}
            <button type="button" className="secondary" onClick={() => navigate("/interview")}>
              Restart interview
            </button>
          </div>
        </div>
      )}

      {totalQuestions > 0 && (
        <div
          className="progress-track"
          style={{
            marginBottom: 24,
          }}
        >
          <div
            className="progress-fill"
            style={{
              width: `${progressPct}%`,
            }}
          />
        </div>
      )}

      {/* ======================================================
          PREVIOUS FEEDBACK
      ======================================================= */}

      {lastFeedback && (
        <div className="feedback-box">
          <strong>
            Previous answer feedback
          </strong>

          <p
            style={{
              margin: "6px 0 0",
              color: "var(--text)",
            }}
          >
            {
              lastFeedback.feedback
            }
          </p>
        </div>
      )}

      <div className="interview-layout">

        <main>

          {/* ==================================================
              QUESTION CARD
          =================================================== */}

          <section className="question-card">

            <div className="question-meta">
              <span>
                INTERVIEWER
              </span>

              <span>
                Question{" "}
                {questionIndex + 1}
              </span>
            </div>

            <p className="question-text">
              {question ||
                "Your interview question will appear here."}
            </p>

            {/* =================================================
                VOICE CONTROLS
            ================================================== */}

            <div className="voice-controls">

              <button
                type="button"
                className="secondary voice-btn"
                onClick={
                  handlePlayQuestion
                }
                disabled={
                  !question ||
                  listening
                }
              >
                {ttsSpeaking
                  ? ttsPaused
                    ? "▶ Resume"
                    : "Ⅱ Pause"
                  : "▶ Play question"}
              </button>

              <button
                type="button"
                className="ghost voice-btn"
                onClick={stopTTS}
                disabled={
                  !ttsSpeaking &&
                  !ttsPaused
                }
              >
                ■ Stop
              </button>

              <select
                aria-label="Speech speed"
                value={ttsRate}
                onChange={(e) =>
                  handleRateChange(
                    Number(
                      e.target.value
                    )
                  )
                }
                disabled={
                  listening
                }
              >
                <option value="0.8">
                  Slow
                </option>

                <option value="1">
                  Natural
                </option>

                <option value="1.15">
                  Fast
                </option>

                <option value="1.3">
                  Very fast
                </option>
              </select>

              <select
                aria-label="Voice warmth"
                value={ttsPitch}
                onChange={(e) =>
                  handlePitchChange(
                    Number(
                      e.target.value
                    )
                  )
                }
                disabled={
                  listening
                }
              >
                <option value="0.9">
                  Calm
                </option>

                <option value="1">
                  Natural
                </option>

                <option value="1.1">
                  Warm
                </option>
              </select>

              {sortedVoices.length > 0 && (
                <select
                  aria-label="Interviewer voice"
                  value={ttsVoice?.voiceURI || ""}
                  onChange={(e) =>
                    handleVoiceChange(
                      e.target.value
                    )
                  }
                  disabled={
                    listening
                  }
                  style={{ maxWidth: 190 }}
                >
                  {sortedVoices.map((v) => (
                    <option
                      key={v.voiceURI}
                      value={v.voiceURI}
                    >
                      {v.name.length > 34 ? `${v.name.slice(0, 34)}…` : v.name}
                    </option>
                  ))}
                </select>
              )}

              {voiceQuality && (
                <span
                  className="page-sub"
                  style={{ fontSize: 11 }}
                  title={
                    voiceQuality === "natural"
                      ? "Natural Indian female voice"
                      : voiceQuality === "custom"
                        ? "Your chosen voice"
                        : "Best voice on this device"
                  }
                >
                  {ttsVoice
                    ? `🎙 ${QUALITY_LABEL[voiceQuality] || ""} · ${ttsVoice.lang || ""}`.trim()
                    : ""}
                </span>
              )}

              <label className="check-control">
                <input
                  type="checkbox"
                  checked={autoRead}
                  onChange={(e) =>
                    handleAutoReadChange(
                      e.target.checked
                    )
                  }
                />

                Read questions
                automatically
              </label>

            </div>

          </section>

          {/* ==================================================
              ANSWER CARD
          =================================================== */}

          <section
            className={`answer-card ${
              listening
                ? "answer-card-live"
                : ""
            }`}
          >

            <div className="answer-head">

              <div>
                <span className="section-kicker">
                  YOUR ANSWER
                </span>

                <h3>
                  {listening
                    ? "Listening to you…"
                    : "Take your time"}
                </h3>
              </div>

              <span className="speech-time">
                {timeLabel}
              </span>

            </div>

            {/* =================================================
                SPEECH RECOGNITION
            ================================================== */}

            {supported && (
              <div className="stt-panel">

                <button
                  type="button"
                  className={`mic-btn ${
                    listening
                      ? "recording"
                      : ""
                  }`}
                  onClick={
                    toggleMic
                  }
                  disabled={loading || !hasQuestion}
                >
                  {listening
                    ? "■"
                    : "🎙"}
                </button>

                <div className="stt-copy">

                  <strong>
                    {listening
                      ? "Live speech recognition"
                      : "Answer with your voice"}
                  </strong>

                  <span>
                    {listening
                      ? "Speak naturally. Your words appear below."
                      : "Your transcript stays editable before you submit."}
                  </span>

                </div>

                <div
                  className="stt-meter"
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>

              </div>
            )}

            {/* =================================================
                ANSWER TEXTAREA
            ================================================== */}

            <textarea
              rows="8"
              placeholder="Type your answer, or use the microphone…"
              value={displayAnswer}
              onChange={(e) => {
                setAnswer(
                  e.target.value
                );

                if (listening) {
                  stop();
                }
              }}
              disabled={loading || !hasQuestion}
            />

            {/* =================================================
                ANSWER TOOLS
            ================================================== */}

            <div className="answer-tools">

              <span>
                {interim
                  ? "Listening…"
                  : "You can edit the transcript before submitting."}
              </span>

              <span>
                Recognition confidence:{" "}
                <b>
                  {confidenceLabel}
                </b>
              </span>

            </div>

            {/* =================================================
                ACTIONS
            ================================================== */}

            <div className="answer-actions">

              <button
                type="submit"
                form="answer-form"
                disabled={
                  loading ||
                  !hasQuestion ||
                  !displayAnswer.trim()
                }
              >
                {loading && (
                  <Spinner />
                )}

                {loading
                  ? "Submitting"
                  : "Submit answer →"}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={
                  handleClear
                }
                disabled={loading}
              >
                Clear
              </button>

            </div>

          </section>

          {/* ==================================================
              ERRORS
          =================================================== */}

          {(error ||
            micError) && (
            <p
              className="error"
              style={{
                marginTop: 16,
              }}
            >
              {error ||
                micError}
            </p>
          )}

        </main>

        {/* ====================================================
            SIDEBAR
        ===================================================== */}

        <aside className="interview-side">

          <div className="side-panel">

            <span className="section-kicker">
              VOICE SETUP
            </span>

            <h3>
              Before you begin
            </h3>

            <div className="setup-row">
              <span>
                Speaker
              </span>

              <b>
                {!ttsSupported
                  ? "Unavailable"
                  : ttsVoice
                    ? ttsVoice.name.length > 22
                      ? `${ttsVoice.name.slice(0, 22)}…`
                      : ttsVoice.name
                    : "Browser"}
              </b>
            </div>

            <div className="setup-row">
              <span>
                Microphone
              </span>

              <b>
                {supported
                  ? "Ready"
                  : "Unavailable"}
              </b>
            </div>

            <div className="setup-row">
              <span>
                Auto-read
              </span>

              <b>
                {autoRead
                  ? "On"
                  : "Off"}
              </b>
            </div>

            <div className="setup-row">
              <span>
                Speech
              </span>

              <b>
                {ttsSpeaking
                  ? ttsPaused
                    ? "Paused"
                    : "Speaking"
                  : "Ready"}
              </b>
            </div>

          </div>

          <div className="side-panel interview-tip">

            <span className="section-kicker">
              A SMALL TIP
            </span>

            <h3>
              Think before speaking.
            </h3>

            <p>
              Take a breath, make
              your point, and support
              it with one concrete
              example. A clear answer
              beats a rushed one.
            </p>

          </div>

        </aside>

      </div>

      {/* ======================================================
          HIDDEN SUBMIT FORM
      ======================================================= */}

      <form
        id="answer-form"
        onSubmit={handleSubmit}
        hidden
      >
        <button type="submit" />
      </form>

    </div>
  );
}