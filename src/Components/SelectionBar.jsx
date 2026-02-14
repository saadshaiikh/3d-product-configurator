// fixed SelectionBar component

import { usePanelEnter } from "../hooks/useUiMotion";

export default function SelectionBar({ modelName, current, labels = {}, onClear, onResetView }) {
  const visible = usePanelEnter(modelName);
  // map current part key to user-friendly label if provided
  const partLabel = current == null ? "None" : (labels[current] || String(current));
  return (
    <div className={`selection-bar panel ${visible ? "panel--visible" : ""}`}>
      <div className="selection-bar__left">
        <h4 className="selection-bar__title">Selection</h4>
        <div className="selection-bar__row">
          <span className="selection-bar__label">Model</span>
          <span className="selection-bar__value">{modelName}</span>
        </div>
        <div className="selection-bar__row">
          <span className="selection-bar__label">Part</span>
          <span className="selection-bar__value">{partLabel}</span>
        </div>
      </div>
      <div className="selection-bar__actions">
        <button
          className="selection-bar__btn selection-bar__btn--ghost"
          type="button"
          onClick={onClear}
          disabled={!current}
          title="Clear selected part"
        >
          Clear
        </button>
        <button
          className="selection-bar__btn"
          type="button"
          onClick={onResetView}
          title="Reset camera view"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
