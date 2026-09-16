import { memo } from "react";

function ScorePill({ score, max = 100 }) {
  if (score === null || score === undefined) return <span className="score-pill s-mid">-</span>;
  const pct = score / max;
  const cls = pct >= 0.7 ? "s-high" : pct >= 0.4 ? "s-mid" : "s-low";
  return <span className={`score-pill ${cls}`}>{score}<span style={{ opacity: 0.6, fontWeight: 600 }}>/{max}</span></span>;
}

export default memo(ScorePill);
