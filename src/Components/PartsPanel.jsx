// src/Components/PartsPanel.jsx
import React from "react";

/**
 * Props:
 * - modelName?: string
 * - parts: string[]
 * - current: string | null
 * - hovered?: string | null
 * - onSelect: (partKey: string | null) => void
 * - onHover?: (partKey: string | null) => void
 * - labels?: Record<string, string>
 */
export default function PartsPanel({
  modelName,
  parts,
  current,
  hovered = null,
  onSelect,
  onHover,
  labels = {},
}) {
  const safeParts = Array.isArray(parts) ? parts : [];

  return (
    <div className="parts-panel" role="region" aria-label="Parts panel">
      <div className="parts-panel__header">
        <div className="parts-panel__title">
          {modelName ? `${modelName} Parts` : "Parts"}
        </div>

        <div className="parts-panel__subtitle">
          {current ? `Selected: ${labels[current] || current}` : "Selected: None"}
        </div>
      </div>

      <div className="parts-panel__list" role="list" aria-label="Parts list">
        {safeParts.length === 0 ? (
          <div className="parts-panel__empty">No parts found.</div>
        ) : (
          safeParts.map((key) => {
            const active = current === key;
            const isHovered = hovered === key;

            return (
              <button
                key={key}
                type="button"
                className={[
                  "parts-panel__item",
                  active ? "is-active" : "",
                  isHovered ? "is-hovered" : "",
                ].join(" ")}
                onClick={() => onSelect(key)}
                onMouseEnter={() => onHover?.(key)}
                onMouseLeave={() => onHover?.(null)}
                onFocus={() => onHover?.(key)}
                onBlur={() => onHover?.(null)}
                aria-pressed={active}
              >
                <div className="parts-panel__itemLeft">
                  <span
                    className={[
                      "parts-panel__dot",
                      active ? "is-active" : "",
                      isHovered ? "is-hovered" : "",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="parts-panel__partName">
                    {labels[key] || key}
                  </span>
                </div>

                <span className="parts-panel__chev" aria-hidden="true">
                  ›
                </span>
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        className="parts-panel__clear"
        onClick={() => onSelect(null)}
        disabled={!current}
      >
        Clear selection
      </button>
    </div>
  );
}
