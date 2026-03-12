import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createConfig } from "../api/configs";
import { normalizeColorMap } from "../utils/colorNormalize";
import { store } from "../state/store";

export default function SaveShareButton({
  modelId,
  colors,
  title,
  isPublic = true,
  disabled = false,
  onToast,
}) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!modelId) {
      onToast?.("Select a model first");
      return;
    }

    let normalizedColors;
    try {
      normalizedColors = normalizeColorMap(colors || {});
    } catch (err) {
      onToast?.(err.message || "Invalid colors");
      return;
    }

    setSaving(true);
    store.status.isSavingConfig = true;

    try {
      const res = await createConfig({
        modelId,
        title,
        colors: normalizedColors,
        isPublic,
      });

      const id = res?.config?.id;
      if (!id) throw new Error("Missing config id");

      store.activeConfigId = id;
      if (res?.config) {
        store.activeConfig = res.config;
      }
      navigate(`/c/${id}`);

      const link = `${window.location.origin}/c/${id}`;
      try {
        await navigator.clipboard.writeText(link);
        onToast?.("Copied share link");
      } catch {
        window.prompt("Copy share link:", link);
        onToast?.("Share link ready");
      }
    } catch (err) {
      if (err?.message === "Failed to fetch") {
        onToast?.("Backend not reachable (start API on :8080)");
      } else {
        onToast?.(err.message || "Failed to save config");
      }
    } finally {
      setSaving(false);
      store.status.isSavingConfig = false;
    }
  }, [colors, isPublic, modelId, navigate, onToast, title]);

  return (
    <button
      type="button"
      className="selection-bar__btn selection-bar__btn--accent"
      data-testid="save-config"
      onClick={handleSave}
      disabled={disabled || saving}
      title="Save and copy a shareable link"
    >
      {saving ? "Saving..." : "Save & Share"}
    </button>
  );
}
