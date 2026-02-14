import React from "react";

export default function OnboardingHint({
  open = false,
  onDismiss,
}) {
  if (!open) return null;

  return (
    <div className="onboarding-hint" role="dialog" aria-live="polite">
      <div className="onboarding-hint__content">
        <div className="onboarding-hint__title">Quick controls</div>
        <div className="onboarding-hint__text">
          <div>Drag to rotate • Scroll to zoom • Click a part to edit</div>
          <div>Shortcuts: R reset • Esc clear • H hints • D reset model colors</div>
        </div>
      </div>

      <button
        className="onboarding-hint__btn"
        onClick={() => onDismiss?.()}
        type="button"
      >
        Got it
      </button>
    </div>
  );
}
