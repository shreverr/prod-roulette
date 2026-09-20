import { ImageResponse } from "next/og";

export const alt = "Prod Roulette — Buckshot Roulette, but you're gambling with production.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The desktop, flattened: striped desk, one window, the pitch. Drawn with plain divs so
 *  there is no binary asset to keep in sync with the game's palette. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f4858",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 960,
            background: "#e8e8e0",
            border: "6px solid #16161a",
            boxShadow: "18px 18px 0 rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 64,
              borderBottom: "6px solid #16161a",
              color: "#16161a",
              fontSize: 26,
              letterSpacing: 6,
            }}
          >
            DEPLOY.APP
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "46px 54px 54px" }}>
            <div style={{ display: "flex", fontSize: 76, color: "#16161a", letterSpacing: 2 }}>
              PROD ROULETTE
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "#5a5a52" }}>
              Buckshot Roulette, but you&apos;re gambling with production.
            </div>
            <div style={{ display: "flex", marginTop: 40, gap: 14 }}>
              {["#2f9e57", "#d33b2d", "#2f9e57", "#e0a41f", "#d33b2d", "#2f9e57"].map((c, i) => (
                <div
                  key={i}
                  style={{ width: 62, height: 62, background: c, border: "5px solid #16161a" }}
                />
              ))}
            </div>
            <div style={{ display: "flex", marginTop: 34, fontSize: 26, color: "#5a5a52" }}>
              six deployments in the queue · some take prod down · you are told how many, never which
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
