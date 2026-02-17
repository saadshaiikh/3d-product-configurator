import React, { useCallback, useMemo, useState } from "react";

export default function StyleAssistant({
  disabled = false,
  status = "",
  onApplyText,
  onClear,
}) {
  const [text, setText] = useState("");

  const canApply = !disabled && text.trim().length > 0;

  const examples = useMemo(
    () => [
      {
        label: "laces black, mesh white, stripes red",
        value: "laces black, mesh white, stripes red",
      },
      {
        label: "bottom grey and inside light blue",
        value: "bottom grey and inside light blue",
      },
      {
        label: "stealth: laces black, mesh dark grey, stripes white",
        value: "stealth: laces black, mesh dark grey, stripes white",
      },
    ],
    []
  );

  const apply = useCallback(
    (override) => {
      const t = String(override ?? text).trim();
      if (!t) return;
      onApplyText?.(t);
    },
    [onApplyText, text]
  );

  return (
    <div
      className="style-assistant card panel panel--visible"
      role="region"
      aria-label="Style assistant"
    >
      <div className="style-assistant__header">
        <div className="style-assistant__title">Describe your style</div>
        <div className="style-assistant__status" aria-live="polite">
          {status || "Tip: Ctrl+Enter to apply"}
        </div>
      </div>

      <textarea
        className="style-assistant__textarea"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='e.g. "Make the laces black, mesh white, stripes red"'
        aria-label="Style instructions"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          if (canApply) apply();
        }}
      />

      <div className="style-assistant__actions">
        <button
          type="button"
          className="style-assistant__apply"
          onClick={() => apply()}
          disabled={!canApply}
        >
          Apply
        </button>
        <button
          type="button"
          className="style-assistant__clear"
          onClick={() => {
            setText("");
            onClear?.();
          }}
          disabled={disabled || !text}
        >
          Clear
        </button>
      </div>

      <div className="style-assistant__chips" role="list" aria-label="Examples">
        {examples.map((c) => (
          <button
            key={c.label}
            type="button"
            className="style-assistant__chip"
            onClick={() => {
              setText(c.value);
              apply(c.value);
            }}
            disabled={disabled}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
