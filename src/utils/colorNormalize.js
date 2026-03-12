import { isHexColor } from "./isHexColor";

export function normalizeColorMap(input) {
  if (!input || typeof input !== "object") {
    throw new Error("colors must be an object");
  }
  const entries = Object.entries(input);
  if (entries.length === 0) {
    throw new Error("colors must be non-empty");
  }

  const out = {};
  for (const [key, value] of entries) {
    const partKey = String(key || "").trim();
    if (!partKey) throw new Error("color key must be non-empty");

    const color = String(value || "").trim();
    if (!isHexColor(color)) {
      throw new Error("invalid color value");
    }
    out[partKey] = color.toLowerCase();
  }
  return out;
}
