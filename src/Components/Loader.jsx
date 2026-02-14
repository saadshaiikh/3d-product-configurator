// src/Components/Loader.jsx
import React from "react";
import { Html, useProgress } from "@react-three/drei";

export default function Loader({ label = "Loading..." }) {
  const { active, progress, item, loaded, total, errors } = useProgress();

  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const pct = Math.max(0, Math.min(100, Math.round(safeProgress)));

  return (
    <Html fullscreen>
      <div className="loading-overlay" role="status" aria-live="polite">
        <div className="loading-overlay__card">
          <div className="loading-overlay__title">{label}</div>

          <div className="loading-overlay__bar" aria-label="Loading progress">
            <div
              className="loading-overlay__barFill"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="loading-overlay__pct">
            {pct}%{" "}
            <span style={{ opacity: 0.7 }}>
              ({loaded}/{total})
            </span>
          </div>

          {/* Helpful debug info */}
          {active && item ? (
            <div className="card__micro" style={{ marginTop: 10 }}>
              Loading: <span style={{ opacity: 0.8 }}>{String(item)}</span>
            </div>
          ) : null}

          {errors && errors.length ? (
            <div style={{ marginTop: 10, textAlign: "left" }}>
              <div className="card__micro" style={{ fontWeight: 700 }}>
                Loader errors:
              </div>
              <pre
                className="card__micro"
                style={{
                  whiteSpace: "pre-wrap",
                  margin: "6px 0 0",
                  maxHeight: 140,
                  overflow: "auto",
                }}
              >
                {errors.map((e, i) => `• ${e?.message || String(e)}`).join("\n")}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </Html>
  );
}
