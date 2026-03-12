import { proxy } from "valtio";

export const DEFAULT_COLORS = {
  shoe: {
    laces: "#ffffff",
    mesh: "#ffffff",
    caps: "#ffffff",
    inner: "#ffffff",
    sole: "#ffffff",
    stripes: "#ffffff",
    band: "#ffffff",
    patch: "#ffffff",
  },
  rocket: {
    hull: "#d3d3d3",
    base: "#d3d3d3",
    top: "#d3d3d3",
    wings: "#a8a8a8",
    window: "#a8a8a8",
  },
  axe: {
    design: "#d3d3d3",
    inner: "#d3d3d3",
    support: "#d3d3d3",
    body: "#a8a8a8",
  },
  insect: { shell: "#d3d3d3", body: "#a8a8a8" },
  teapot: { lid: "#d3d3d3", base: "#d3d3d3" },
};

export const store = proxy({
  selectedModel: "shoe",
  hoveredPart: null,
  selectedPart: null,
  colors: {
    shoe: proxy({ ...DEFAULT_COLORS.shoe }),
    rocket: proxy({ ...DEFAULT_COLORS.rocket }),
    axe: proxy({ ...DEFAULT_COLORS.axe }),
    insect: proxy({ ...DEFAULT_COLORS.insect }),
    teapot: proxy({ ...DEFAULT_COLORS.teapot }),
  },
  modelMetaById: {},
  activeConfigId: null,
  activeConfig: null,
  status: {
    isLoadingModel: false,
    isLoadingConfig: false,
    isSavingConfig: false,
    isUpdatingConfig: false,
    error: null,
  },
  ws: {
    status: "idle",
    lastError: null,
  },
});

export function setModelMeta(modelId, meta) {
  if (!modelId) return;
  store.modelMetaById[modelId] = meta;
}

export function getDefaultColors(modelId) {
  const base = DEFAULT_COLORS[modelId] || {};
  const metaDefaults = store.modelMetaById?.[modelId]?.defaultColors || {};
  if (Object.keys(base).length === 0 && Object.keys(metaDefaults).length === 0) {
    return {};
  }
  // Let local defaults win if both define the same part key.
  return { ...metaDefaults, ...base };
}

export function ensureModelColors(modelId, defaults = {}) {
  if (!modelId) return null;
  if (!store.colors[modelId]) {
    store.colors[modelId] = proxy({});
  }
  const colorsProxy = store.colors[modelId];
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in colorsProxy)) {
      colorsProxy[k] = v;
    }
  }
  return colorsProxy;
}

export function replaceModelColors(modelId, colors, defaults = null) {
  const colorsProxy = ensureModelColors(modelId);
  if (!colorsProxy) return;

  const incoming = colors || {};
  const base = defaults && typeof defaults === "object" ? defaults : {};
  const desiredKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(incoming),
  ]);

  for (const k of Object.keys(colorsProxy)) {
    if (!desiredKeys.has(k)) {
      delete colorsProxy[k];
    }
  }

  for (const [k, v] of Object.entries(base)) {
    colorsProxy[k] = v;
  }

  for (const [k, v] of Object.entries(incoming)) {
    colorsProxy[k] = v;
  }
}
