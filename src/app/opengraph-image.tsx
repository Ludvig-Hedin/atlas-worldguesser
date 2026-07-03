import { ImageResponse } from "next/og";

/**
 * Default social share card (1200×630). Next also serves this as the Twitter
 * image when no twitter-image is present. Rendered with next/og — no external
 * fonts/assets, so it stays inside the build sandbox and CSP.
 */
export const alt = "Atlas — a free geography guessing game. Guess the location from Street View.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background:
            "radial-gradient(1000px 600px at 50% 38%, #12233f 0%, #0b0b0c 62%)",
          color: "#fafafa",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "3px solid #6cb2ff",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            Atlas
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            <div style={{ display: "flex" }}>Dropped somewhere on Earth.</div>
            <div style={{ display: "flex", color: "#6cb2ff" }}>Guess where you are.</div>
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa", maxWidth: 820 }}>
            A free geography guessing game — read the Street View, drop a pin, win the round.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#71717a" }}>
          geoatlas.xyz
        </div>
      </div>
    ),
    { ...size },
  );
}
