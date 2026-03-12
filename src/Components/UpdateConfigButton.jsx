import { useCallback, useState } from "react";

import { patchConfig } from "../api/configs";
import { normalizeColorMap } from "../utils/colorNormalize";
import {
  getDefaultColors,
  replaceModelColors,
  store,
} from "../state/store";

export default function UpdateConfigButton({
  config,
  modelId,
  colors,
  disabled = false,
  onToast,
}) {
  const [updating, setUpdating] = useState(false);

  const handleUpdate = useCallback(async () => {
    if (!config?.id) {
      onToast?.("No active config to update");
      return;
    }

    let normalizedColors;
    try {
      normalizedColors = normalizeColorMap(colors || {});
    } catch (err) {
      onToast?.(err.message || "Invalid colors");
      return;
    }

    setUpdating(true);
    store.status.isUpdatingConfig = true;

    try {
      const res = await patchConfig(config.id, {
        baseRevision: config.revision,
        colors: normalizedColors,
        title: config.title,
        isPublic: config.isPublic,
      });

      if (res.conflict) {
        if (res.config) {
          store.activeConfigId = res.config.id;
          store.activeConfig = res.config;
          if (modelId) {
            replaceModelColors(
              modelId,
              res.config.colors || {},
              getDefaultColors(modelId)
            );
          }
        }
        onToast?.("Out of date — reloaded latest");
        return;
      }

      if (res.config) {
        store.activeConfigId = res.config.id;
        store.activeConfig = res.config;
        if (modelId) {
          replaceModelColors(
            modelId,
            res.config.colors || {},
            getDefaultColors(modelId)
          );
        }
      }

      onToast?.("Config updated");
    } catch (err) {
      onToast?.(err.message || "Failed to update config");
    } finally {
      setUpdating(false);
      store.status.isUpdatingConfig = false;
    }
  }, [colors, config, modelId, onToast]);

  if (!config?.id) return null;

  return (
    <button
      type="button"
      className="selection-bar__btn"
      data-testid="update-config"
      onClick={handleUpdate}
      disabled={disabled || updating}
      title="Update this shared config"
    >
      {updating ? "Updating..." : "Update"}
    </button>
  );
}
