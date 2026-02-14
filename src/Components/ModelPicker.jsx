// fixed ModelPicker component

import React, { useCallback, useMemo, useState } from "react";
import shoe from "../img/shoe.png";
import rocket from "../img/rocket.png";
import axe from "../img/axe.png";
import insect from "../img/insect.png";
import teapot from "../img/teapot.png";
import { usePanelEnter, usePulseOnChange } from "../hooks/useUiMotion";

export default function ModelPicker({
  selectedModel,
  updateSelectedModel,
  disabled = false,
  showSearch = false,
}) {
  const visible = usePanelEnter(selectedModel);
  const pulseKey = usePulseOnChange(selectedModel, 300);
  const [query, setQuery] = useState("");
  const items = useMemo(
    () => [
      { key: "Shoe", label: "Shoe", img: shoe },
      { key: "Rocket", label: "Rocket", img: rocket },
      { key: "Axe", label: "Axe", img: axe },
      { key: "Insect", label: "Insect", img: insect },
      { key: "Teapot", label: "Teapot", img: teapot },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, query]);

  const pick = useCallback(
    (modelKey) => {
      if (disabled) return;
      if (typeof updateSelectedModel !== "function") {
        console.error("ModelPicker: updateSelectedModel is not a function");
        return;
      }
      updateSelectedModel(modelKey);
    },
    [disabled, updateSelectedModel]
  );

  return (
    <div
      className={`model-dock panel ${visible ? "panel--visible" : ""}`}
      role="navigation"
      aria-label="Model picker"
    >
      <div className="model-dock__header">
        <div className="model-dock__title">Model</div>
        <div className="model-dock__meta">{filtered.length}</div>
      </div>

      {showSearch ? (
        <input
          className="model-dock__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search models"
          disabled={disabled}
        />
      ) : null}

      <div className="model-dock__list" role="list" aria-label="Models">
        {filtered.map((it) => {
        const active = selectedModel === it.key;
        return (
          <button
            key={it.key}
            type="button"
            className={`model-selector__item${active ? " is-active" : ""}${
              pulseKey === it.key ? " ui-pulse" : ""
            }`}
            onClick={() => pick(it.key)}
            aria-label={`Select model ${it.label}`}
            aria-pressed={active}
            disabled={disabled}
          >
            <img src={it.img} alt="" aria-hidden="true" />
            <div className="model-selector__label">
              <div className="model-selector__name">{it.label}</div>
              {active ? <div className="model-selector__sub">Selected</div> : null}
            </div>
            <div className="model-selector__check" aria-hidden="true">
              ✓
            </div>
          </button>
        );
        })}
      </div>
    </div>
  );
}
