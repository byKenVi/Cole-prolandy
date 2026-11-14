/** Quiet placeholder while a contractor page loads (no shimmer, no motion). */
export function ProLoading({ tickets = 2 }: { tickets?: number }) {
  const bar = (width: string, height = 18) => (
    <div style={{ width, height, borderRadius: 8, background: "#e8dfcf" }} />
  );
  return (
    <div aria-busy="true" aria-label="Loading">
      <div style={{ display: "grid", gap: 12, marginBottom: 26 }}>
        {bar("55%", 32)}
        {bar("80%")}
      </div>
      <div className="pro-stack">
        {Array.from({ length: tickets }).map((_, i) => (
          <div key={i} className="pro-ticket" style={{ padding: 20, display: "grid", gap: 12 }}>
            {bar("40%")}
            {bar("65%", 28)}
            {bar("30%")}
            <div style={{ height: 58, borderRadius: 14, background: "#efe7d7", marginTop: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
