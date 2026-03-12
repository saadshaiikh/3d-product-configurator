import { apiClient } from "./client";

export async function getModels(options = {}) {
  return apiClient.request("/models", options);
}

export async function getModel(id, options = {}) {
  return apiClient.request(`/models/${encodeURIComponent(id)}`, options);
}

export function normalizeModelDetail(model) {
  if (!model || typeof model !== "object") return null;

  const partsList = Array.isArray(model.parts) ? model.parts : [];
  const parts = [];
  const partLabels = {};
  const defaultColors = { ...(model.defaultColors || {}) };

  for (const p of partsList) {
    if (!p || !p.id) continue;
    parts.push(p.id);
    if (p.displayName) partLabels[p.id] = p.displayName;
    if (p.defaultColor && !defaultColors[p.id]) {
      defaultColors[p.id] = p.defaultColor;
    }
  }

  return {
    id: model.id,
    displayName: model.displayName || model.id,
    status: model.status,
    thumbnailUrl: model.thumbnailUrl || "",
    assets: model.assets || { gltfUrl: "" },
    parts,
    partLabels,
    aliases: model.aliases || {},
    defaultColors,
    updatedAt: model.updatedAt,
  };
}
