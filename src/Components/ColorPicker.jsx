// src/Components/ColorPicker.jsx
import { useMemo, useState, useEffect, useCallback, useId } from "react";
import { HexColorPicker } from "react-colorful";
import { usePanelEnter, usePulseOnChange } from "../hooks/useUiMotion";
import { useMediaQuery } from "../hooks/useMediaQuery";

const PRESET_COLORS = [
  "#111827", // near-black
  "#6B7280", // gray
  "#D1D5DB", // light gray
  "#FFFFFF", // white
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // green
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#EC4899", // pink
];

function normalizeHex(input) {
  if (!input) return null;

  let v = String(input).trim().toLowerCase();
  if (!v.startsWith("#")) v = `#${v}`;

  // allow #rgb or #rrggbb only
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return null;

  // expand #rgb -> #rrggbb
  if (v.length === 4) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }

  return v.toUpperCase();
}

export default function ColorPicker({
  parts = [],
  selectedPart = null,
  colorsSnapshot = null,
  onPickPart,
  onSetColor,
  onClearSelection,
  onResetColors,
  labels = {},
  panelKey = null,
  defaultOpen = null,
}) {
  const visible = usePanelEnter(panelKey);
  const pulseKey = usePulseOnChange(selectedPart, 300);
  const isCompactHud = useMediaQuery("(max-width: 1200px)");
  const key = selectedPart ?? null;
  const value =
    key && colorsSnapshot ? colorsSnapshot[key] ?? "#D3D3D3" : "#D3D3D3";
  const partLabel = key ? labels[key] || key : "";

  // hooks must always run
  const [hexInput, setHexInput] = useState(value);
  const hexInputId = useId();
  const contentId = useId();
  const [open, setOpen] = useState(() =>
    typeof defaultOpen === "boolean" ? defaultOpen : !isCompactHud
  );

  useEffect(() => {
    setHexInput(value);
  }, [value, key]);

  useEffect(() => {
    // On compact HUDs, keep the panel lightweight but auto-open when a part is selected.
    if (typeof defaultOpen === "boolean") return;
    if (!isCompactHud) {
      setOpen(true);
      return;
    }
    if (key) setOpen(true);
  }, [defaultOpen, isCompactHud, key]);

  const chips = useMemo(() => PRESET_COLORS, []);

  const commitHex = useCallback(() => {
    if (!key) return;

    const normalized = normalizeHex(hexInput);
    if (normalized) onSetColor?.(normalized);
    else setHexInput(value); // revert to last valid
  }, [key, hexInput, onSetColor, value]);

  const onPickerChange = useCallback(
    (color) => {
      if (!key) return;
      // react-colorful returns lowercase sometimes; normalize for consistency
      const normalized = normalizeHex(color) || color;
      onSetColor?.(normalized);
    },
    [key, onSetColor]
  );

  const onChipClick = useCallback(
    (c) => {
      if (!key) return;
      onSetColor?.(c.toUpperCase());
    },
    [key, onSetColor]
  );

  const showPartPicker = Array.isArray(parts) && parts.length > 0;

  return (
    <div
      className={`color-card panel ${visible ? "panel--visible" : ""}`}
      role="region"
      aria-label="Color picker"
    >
      <div className="color-card__header">
        <div className="color-card__titleWrap">
          <div className="color-card__titleRow">
            <div className="color-card__title">Color</div>
            {isCompactHud ? (
              <button
                type="button"
                className="color-card__toggle"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((v) => !v)}
                title={open ? "Collapse" : "Expand"}
              >
                {open ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
          <div className="color-card__subtitle">
            {key ? partLabel : "Select a part"}
          </div>
        </div>

        <div
          className="color-card__swatch"
          title={value}
          aria-label={`Current color ${value}`}
          style={{ background: value }}
        />
      </div>

      <div
        id={contentId}
        className="color-card__content"
        hidden={!open}
      >
        {showPartPicker && (
          <div className="color-card__parts" role="list" aria-label="Parts">
            {parts.map((p) => {
              const partKey = String(p);
              const active = partKey === key;
              return (
                <button
                  key={partKey}
                  type="button"
                  className={`color-card__partBtn ${active ? "is-active" : ""}${
                    pulseKey === partKey ? " ui-pulse" : ""
                  }`}
                  onClick={() => onPickPart?.(partKey)}
                  aria-label={`Select part ${labels[partKey] || partKey}`}
                  aria-pressed={active}
                >
                  {labels[partKey] || partKey}
                </button>
              );
            })}

            <button
              type="button"
              className="color-card__partBtn color-card__partBtn--ghost"
              onClick={() => onClearSelection?.()}
              disabled={!key}
              title="Clear selected part"
            >
              Clear
            </button>
          </div>
        )}

        <div className="color-card__picker">
          {key ? (
            <HexColorPicker color={value} onChange={onPickerChange} />
          ) : (
            <div className="color-card__placeholder" aria-hidden="true" />
          )}
        </div>

        <div className="color-card__controls">
          <label className="color-card__hexLabel" htmlFor={hexInputId}>
            HEX
          </label>
          <input
            id={hexInputId}
            className="color-card__hexInput"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitHex();
              if (e.key === "Escape") setHexInput(value);
            }}
            disabled={!key}
            spellCheck={false}
            inputMode="text"
            placeholder="#RRGGBB"
          />
        </div>

        <div className="color-card__chips" role="list" aria-label="Quick colors">
          {chips.map((c) => {
            const active = c.toUpperCase() === value.toUpperCase();

            return (
              <button
                key={c}
                type="button"
                className={`color-card__chip ${active ? "is-active" : ""}`}
                onClick={() => onChipClick(c)}
                disabled={!key}
                title={c}
                aria-label={`Set color ${c}`}
                aria-pressed={active}
                // ✅ IMPORTANT: do NOT add role="listitem" to a button
              >
                <span
                  className="color-card__chipSwatch"
                  style={{ background: c }}
                />
              </button>
            );
          })}
        </div>

        <div className="color-card__footer">
          <button
            type="button"
            className="color-card__resetBtn"
            onClick={() => onResetColors?.()}
            title="Reset colors for this model"
          >
            Reset colors
          </button>
        </div>
      </div>
    </div>
  );
}
