// fixed SelectionBar component

import { usePanelEnter } from "../hooks/useUiMotion";

export default function SelectionBar({
  modelName,
  current,
  labels = {},
  onClear,
  onResetView,
  actions = null,
  wsStatus = "idle",
}) {
  const visible = usePanelEnter(modelName);
  const partLabel = current == null ? "None" : labels[current] || String(current);
  const wsLabel = wsStatus === "connected" ? "Live" : "Offline";
  return (
    <div className={`selection-bar panel ${visible ? "panel--visible" : ""}`}>
      <div className="selection-bar__left">
        <div className="selection-bar__titleRow">
          <h4 className="selection-bar__title">Selection</h4>
          <span
            className={`selection-bar__ws ${
              wsStatus === "connected" ? "is-live" : ""
            }`}
            data-testid="ws-status"
          >
            {wsLabel}
          </span>
        </div>
        <div className="selection-bar__row">
          <span className="selection-bar__label">Model</span>
          <span className="selection-bar__value" data-testid="selected-model">
            {modelName}
          </span>
        </div>
        <div className="selection-bar__row">
          <span className="selection-bar__label">Part</span>
          <span className="selection-bar__value">{partLabel}</span>
        </div>
      </div>
      <div className="selection-bar__actions">
        {actions}
        <button
          className="selection-bar__btn selection-bar__btn--ghost"
          type="button"
          onClick={() => onClear?.()}
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
