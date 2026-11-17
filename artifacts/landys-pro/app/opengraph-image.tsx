import { ImageResponse } from "next/og";

export const alt = "Landy's Pro: job requests from homeowners near you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share image for links to Landy's Pro (Google, Facebook, iMessage, Slack...). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#2F4A3C",
          color: "#F3ECDF",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ fontSize: 64, fontStyle: "italic" }}>Landy&apos;s</span>
          <span
            style={{
              fontSize: 26,
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
              color: "#E0A95C",
              border: "3px solid #E0A95C",
              borderRadius: 10,
              padding: "4px 12px",
            }}
          >
            PRO
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, lineHeight: 1.08, fontWeight: 700, maxWidth: 960 }}>
            Job requests from homeowners near you.
          </div>
          <div style={{ fontSize: 34, fontFamily: "Arial, sans-serif", color: "#D6CDBB" }}>
            No lead fees. Pay only when you get paid.
          </div>
        </div>
        <div style={{ fontSize: 26, fontFamily: "Arial, sans-serif", color: "#E0A95C" }}>landys.co</div>
      </div>
    ),
    { ...size },
  );
}
