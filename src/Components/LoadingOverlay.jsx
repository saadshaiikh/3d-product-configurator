import React, { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";

/**
 * Full-screen loader overlay (renders ABOVE the Canvas).
 * Uses drei's useProgress() to track GLTF/texture loading.
 */
export default function LoadingOverlay({ forceActive = false, minShowMs = 450 }) {
  const { active, progress, item, loaded, total } = useProgress();

  const shouldShow = !!active || !!forceActive;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef(0);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!shouldShow && !visible) return;

    if (shouldShow) {
      if (!visible) shownAtRef.current = Date.now();
      setVisible(true);
      return;
    }

    const elapsed = Date.now() - (shownAtRef.current || 0);
    const remaining = Math.max(0, minShowMs - elapsed);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, remaining);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [shouldShow, minShowMs, visible]);

  const pct = Math.max(
    0,
    Math.min(100, Math.round((active ? progress : 100) || 0))
  );
  const fileName = item ? String(item).split("/").pop() : "";

  return (
    <div
      className={`loading-overlay${visible ? " is-active" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="loading-overlay__card">
        <div className="loading-overlay__row">
          <div className="loading-overlay__spinner" aria-hidden="true" />
          <div className="loading-overlay__text">
            <div className="loading-overlay__title">Loading…</div>
            <div className="loading-overlay__meta">
              {total > 0 ? `${loaded}/${total}` : ""}
              {fileName ? ` • ${fileName}` : ""}
            </div>
          </div>
          <div className="loading-overlay__pct">{pct}%</div>
        </div>

        <div className="loading-overlay__bar" aria-hidden="true">
          <div
            className="loading-overlay__barFill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
