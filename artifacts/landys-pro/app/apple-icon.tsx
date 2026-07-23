import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon — brand green with gold script L. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2F4A3C",
          color: "#C9A86A",
          fontSize: 118,
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          letterSpacing: "-0.04em",
        }}
      >
        L
      </div>
    ),
    { ...size },
  );
}
