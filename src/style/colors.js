function clampInt(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function normalizeHex(input) {
  if (!input) return null;
  let v = String(input).trim().toLowerCase();
  if (!v.startsWith("#")) v = `#${v}`;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return null;
  if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v.toUpperCase();
}

export function rgbStringToHex(input) {
  const s = String(input ?? "").trim().toLowerCase();
  const m =
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(s) ||
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/.exec(
      s
    );
  if (!m) return null;
  const r = clampInt(m[1], 0, 255);
  const g = clampInt(m[2], 0, 255);
  const b = clampInt(m[3], 0, 255);
  if (r == null || g == null || b == null) return null;
  const toHex = (x) => x.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const COLOR_MAP = {
  black: "#000000",
  white: "#FFFFFF",
  gray: "#808080",
  grey: "#808080",
  silver: "#C0C0C0",
  navy: "#0B1F3B",
  red: "#FF0000",
  maroon: "#800000",
  green: "#00A86B",
  emerald: "#10B981",
  teal: "#14B8A6",
  blue: "#2563EB",
  "light blue": "#60A5FA",
  "sky blue": "#38BDF8",
  yellow: "#FACC15",
  gold: "#D4AF37",
  orange: "#F97316",
  purple: "#8B5CF6",
  pink: "#EC4899",
  beige: "#D6C7A1",
  cream: "#FFF3D6",
  ivory: "#FFFFF0",
  "off white": "#F8FAFC",
  brown: "#7C4A2D",
  "dark grey": "#374151",
  "dark gray": "#374151",
  "light grey": "#D1D5DB",
  "light gray": "#D1D5DB",
};

export const COLOR_MODIFIERS = new Set([
  "matte",
  "glossy",
  "light",
  "dark",
  "deep",
  "pale",
  "bright",
  "off",
  "warm",
  "cool",
]);

export const BASE_COLOR_WORDS = [
  "black",
  "white",
  "gray",
  "grey",
  "silver",
  "navy",
  "red",
  "maroon",
  "green",
  "emerald",
  "teal",
  "blue",
  "yellow",
  "gold",
  "orange",
  "purple",
  "pink",
  "beige",
  "cream",
  "ivory",
  "brown",
];

export function resolveNamedColor(name, colorMap = COLOR_MAP) {
  const k = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return colorMap[k] ?? null;
}

