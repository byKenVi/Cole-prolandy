/**
 * Dashboard loading skeleton — mirrors the redesigned dashboard: a header, the
 * revenue hero + wallet/stat column, then the pipeline + recent-leads row. Uses
 * the admin theme tokens so it looks correct in both light and dark modes.
 */
const block = (style: React.CSSProperties): React.CSSProperties => ({
  background: "var(--card2)",
  borderRadius: 8,
  ...style,
});

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 20,
  boxShadow: "var(--shadowSm)",
  padding: "20px 22px",
};

export default function Loading() {
  return (
    <div className="admin-fade-up">
      <div style={{ marginBottom: 22 }}>
        <div className="animate-pulse" style={block({ height: 12, width: 180, marginBottom: 12 })} />
        <div className="animate-pulse" style={block({ height: 34, width: 320, marginBottom: 10 })} />
        <div className="animate-pulse" style={block({ height: 14, width: 220 })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 16 }}>
        <div
          className="animate-pulse"
          style={{ height: 250, borderRadius: 22, background: "var(--card2)" }}
        />
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 16 }}>
          <div className="animate-pulse" style={{ height: 118, borderRadius: 20, background: "var(--card2)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="animate-pulse" style={{ borderRadius: 20, background: "var(--card2)" }} />
            <div className="animate-pulse" style={{ borderRadius: 20, background: "var(--card2)" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        <div style={card}>
          <div className="animate-pulse" style={block({ height: 14, width: 120, marginBottom: 10 })} />
          <div className="animate-pulse" style={block({ height: 14, width: 22, borderRadius: 999, marginBottom: 18 })} />
          <div className="animate-pulse" style={block({ height: 14, borderRadius: 999, marginBottom: 22 })} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={block({ height: 16, marginBottom: 14, width: `${80 - i * 12}%` })}
            />
          ))}
        </div>
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)" }}>
            <div className="animate-pulse" style={block({ height: 16, width: 120 })} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto",
                gap: 14,
                alignItems: "center",
                padding: "13px 24px",
                borderBottom: "1px solid var(--line2)",
              }}
            >
              <div className="animate-pulse" style={block({ width: 44, height: 44, borderRadius: 13 })} />
              <div>
                <div className="animate-pulse" style={block({ height: 14, width: "60%", marginBottom: 6 })} />
                <div className="animate-pulse" style={block({ height: 11, width: "40%" })} />
              </div>
              <div className="animate-pulse" style={block({ height: 16, width: 70 })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
