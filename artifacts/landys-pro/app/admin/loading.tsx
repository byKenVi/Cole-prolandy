/**
 * Dashboard loading skeleton — mirrors the operational dashboard:
 * header → 4 KPIs → revenue hero → two operational rows.
 */
const block = (style: React.CSSProperties): React.CSSProperties => ({
  background: "var(--card2)",
  borderRadius: 8,
  ...style,
});

export default function Loading() {
  return (
    <div className="admin-fade-up">
      <div style={{ marginBottom: 22 }}>
        <div className="animate-pulse" style={block({ height: 12, width: 180, marginBottom: 12 })} />
        <div className="animate-pulse" style={block({ height: 34, maxWidth: 320, marginBottom: 10 })} />
        <div className="animate-pulse" style={block({ height: 14, maxWidth: 260 })} />
      </div>

      <div
        className="admin-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: 92,
              borderRadius: 16,
              background: "var(--card2)",
              border: "1px solid var(--line)",
            }}
          />
        ))}
      </div>

      <div
        className="animate-pulse"
        style={{ height: 220, borderRadius: 22, background: "var(--card2)", marginBottom: 16 }}
      />

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}
      >
        <div
          className="animate-pulse"
          style={{ minHeight: 220, borderRadius: 18, background: "var(--card2)" }}
        />
        <div
          className="animate-pulse"
          style={{ minHeight: 220, borderRadius: 18, background: "var(--card2)" }}
        />
      </div>

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div
          className="animate-pulse"
          style={{ minHeight: 180, borderRadius: 18, background: "var(--card2)" }}
        />
        <div
          className="animate-pulse"
          style={{ minHeight: 180, borderRadius: 18, background: "var(--card2)" }}
        />
      </div>
    </div>
  );
}
