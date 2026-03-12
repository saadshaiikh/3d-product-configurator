const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value) {
  return HEX_COLOR_RE.test(String(value || "").trim());
}
