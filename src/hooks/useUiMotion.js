import { useEffect, useMemo, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!mq.matches);
    update();

    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  return reduced;
}

export function usePanelEnter(triggerKey) {
  const reduced = usePrefersReducedMotion();
  const stableKey = useMemo(() => String(triggerKey ?? ""), [triggerKey]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [stableKey, reduced]);

  return visible;
}

export function usePulseOnChange(value, durationMs = 280) {
  const reduced = usePrefersReducedMotion();
  const stableVal = useMemo(() => value ?? null, [value]);
  const [pulseKey, setPulseKey] = useState(null);

  useEffect(() => {
    if (reduced) {
      setPulseKey(null);
      return;
    }
    if (stableVal == null) return;

    setPulseKey(stableVal);
    const t = window.setTimeout(() => setPulseKey(null), durationMs);
    return () => window.clearTimeout(t);
  }, [stableVal, durationMs, reduced]);

  return pulseKey;
}

