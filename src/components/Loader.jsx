export function Spinner({ dark }) {
  return <span className={`spinner${dark ? " dark" : ""}`} />;
}

export function LoadingScreen({ text = "Loading" }) {
  return (
    <div className="loading-screen">
      <span className="spinner dark" />
      <span>{text}</span>
    </div>
  );
}

export function SkeletonBlock({ className = "", style }) {
  return <div className={`skel ${className}`} style={style} />;
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="skel-card" />
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page">
      <SkeletonBlock className="skel-title" />
      <div className="stat-grid">
        <SkeletonBlock className="skel-card" style={{ minWidth: 240, flex: 1 }} />
        <SkeletonBlock className="skel-card" style={{ minWidth: 240, flex: 1 }} />
      </div>
      <SkeletonCards count={3} />
    </div>
  );
}
