import {
  BASE_COLOR_WORDS,
  COLOR_MAP,
  COLOR_MODIFIERS,
  normalizeHex,
  resolveNamedColor,
  rgbStringToHex,
} from "./colors";

const STOP_WORDS = new Set([
  "make",
  "set",
  "please",
  "the",
  "a",
  "an",
  "to",
  "is",
  "are",
  "be",
  "should",
  "my",
  "your",
  "it",
  "this",
  "that",
  "like",
  "maybe",
  "kind",
  "of",
  "and",
  "then",
  "also",
  "with",
  "in",
  "on",
  "at",
  "for",
]);

function toKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAllPhrases(text, phrases) {
  // phrases: [{ phrase, value }]
  const hits = [];
  const lower = String(text ?? "").toLowerCase();

  for (const p of phrases) {
    if (!p.phrase) continue;
    const phrase = String(p.phrase).toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "g");
    let m;
    while ((m = re.exec(lower))) {
      hits.push({
        value: p.value,
        phrase,
        start: m.index,
        end: m.index + phrase.length,
      });
    }
  }

  hits.sort((a, b) => a.start - b.start || b.phrase.length - a.phrase.length);

  // remove overlaps (prefer earlier, longer)
  const filtered = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start < lastEnd) continue;
    filtered.push(h);
    lastEnd = h.end;
  }
  return filtered;
}

function splitSegments(text) {
  const s = String(text ?? "");
  return s
    .split(/[\n;,]+|\bthen\b|\balso\b/gi)
    .map((x) => x.trim())
    .filter(Boolean);
}

function markUnknownColorPhrasesWithContext(
  segment,
  colorMap,
  unknownColors,
  { hasKnownParts, partWords }
) {
  if (!hasKnownParts) return segment;

  const partSet = partWords instanceof Set ? partWords : new Set();
  let s = segment;
  const baseGroup = BASE_COLOR_WORDS.map(escapeRegExp).join("|");
  const re = new RegExp(`\\b([a-z]+)\\s+(${baseGroup})\\b`, "gi");
  s = s.replace(re, (full, adjRaw, baseRaw) => {
    const adj = String(adjRaw).toLowerCase();
    const base = String(baseRaw).toLowerCase();
    const phrase = `${adj} ${base}`.replace(/\s+/g, " ").trim();
    if (colorMap[phrase]) return full;
    if (COLOR_MODIFIERS.has(adj)) return full;
    if (partSet.has(adj)) return full; // e.g. "laces black" is part+color, not a color phrase
    if (STOP_WORDS.has(adj)) return full;
    unknownColors.add(phrase);
    return " ".repeat(full.length);
  });
  return s;
}

function extractColors(segment, colorMap, unknownColors, context) {
  const colors = [];
  let s = segment;

  // First, block unknown adjective+base color pairs ("galaxy purple") in part-context segments,
  // so we don't accidentally match the base color and apply the wrong thing.
  s = markUnknownColorPhrasesWithContext(s, colorMap, unknownColors, context);

  // rgb()/rgba()
  {
    const re = /\brgba?\([^)]+\)/gi;
    let m;
    while ((m = re.exec(s))) {
      const raw = m[0];
      const hex = rgbStringToHex(raw);
      if (hex) colors.push({ hex, start: m.index, raw });
    }
  }

  // hex (#ff0000 or ff0000 or #f00)
  {
    // Prefer safety over permissiveness:
    // - 3-digit hex requires '#', to avoid matching random word fragments like "l[a c e]s"
    // - 6-digit hex can be with or without '#', but must be token-separated
    const re3 = /#([0-9a-f]{3})\b/gi;
    let m3;
    while ((m3 = re3.exec(s))) {
      const raw = `#${m3[1]}`;
      const hex = normalizeHex(raw);
      if (hex) colors.push({ hex, start: m3.index, raw });
    }

    const re6 =
      /(^|[\s,;()[\]{}])(#?[0-9a-f]{6})(?=$|[\s,;()[\]{}.!?])/gi;
    let m6;
    while ((m6 = re6.exec(s))) {
      const raw = m6[2];
      const hex = normalizeHex(raw);
      if (hex) colors.push({ hex, start: m6.index + (m6[1]?.length || 0), raw });
    }
  }

  // named colors (multi-word supported)
  const names = Object.keys(colorMap).sort((a, b) => b.length - a.length);
  const phrases = names.map((n) => ({ phrase: n, value: n }));
  for (const hit of findAllPhrases(s, phrases)) {
    const hex = resolveNamedColor(hit.value, colorMap);
    if (hex) colors.push({ hex, start: hit.start, raw: hit.value });
  }

  colors.sort((a, b) => a.start - b.start);
  return colors;
}

function extractParts(segment, validParts, aliasMap) {
  const map = aliasMap || {};
  const phrases = [];
  for (const p of validParts || []) phrases.push({ phrase: p, value: p });
  for (const [alias, key] of Object.entries(map)) {
    phrases.push({ phrase: alias, value: key });
  }

  // Prefer longer aliases (e.g. "inner lining") before "inner"
  phrases.sort((a, b) => String(b.phrase).length - String(a.phrase).length);

  const hits = findAllPhrases(segment, phrases);

  // Keep first occurrence per partKey, in order of appearance
  const seen = new Set();
  const partWords = new Set();
  const parts = [];
  for (const h of hits) {
    const key = h.value;
    partWords.add(String(h.phrase).toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push({ key, start: h.start });
  }
  parts.sort((a, b) => a.start - b.start);
  return { parts, partWords };
}

function addUnknownPartFromSegment(segment, colors, unknownParts) {
  if (!colors.length) return;
  const firstColor = colors[0];
  const before = segment.slice(0, firstColor.start).trim();
  if (!before) return;
  const words = before
    .split(/\s+/)
    .map(toKey)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w));
  const phrase = words.slice(-3).join(" ").trim();
  if (phrase) unknownParts.add(phrase);
}

function addUnknownColorTail(segment, parts, colors, unknownColors) {
  if (!parts.length || colors.length) return;
  const lastPart = parts[parts.length - 1];
  const tail = segment.slice(lastPart.start).trim();
  const words = tail
    .split(/\s+/)
    .map(toKey)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w));
  if (!words.length) return;
  const phrase = words.slice(-2).join(" ").trim();
  if (phrase) unknownColors.add(phrase);
}

export function parseStyleText(
  text,
  { validParts = [], aliasMap = {}, colorMap = COLOR_MAP } = {}
) {
  const assignments = {};
  const unknownParts = new Set();
  const unknownColors = new Set();
  const matchedPartsInOrder = [];

  const input = String(text ?? "");
  if (!input.trim()) {
    return {
      assignments,
      unknownParts: [],
      unknownColors: [],
      matchedPartsInOrder: [],
    };
  }

  const partsList = Array.isArray(validParts) ? validParts : [];
  const aliases = aliasMap && typeof aliasMap === "object" ? aliasMap : {};
  const colorsDict = colorMap && typeof colorMap === "object" ? colorMap : COLOR_MAP;

  for (const seg of splitSegments(input.toLowerCase())) {
    const segment = seg.replace(/\s+/g, " ").trim();
    if (!segment) continue;

    const { parts, partWords } = extractParts(segment, partsList, aliases);
    const colors = extractColors(segment, colorsDict, unknownColors, {
      hasKnownParts: parts.length > 0,
      partWords,
    });

    if (!parts.length) addUnknownPartFromSegment(segment, colors, unknownParts);
    addUnknownColorTail(segment, parts, colors, unknownColors);

    if (!parts.length || !colors.length) continue;

    // Ambiguous "laces and mesh black" => one color applies to all parts.
    if (colors.length === 1 && parts.length >= 1) {
      for (const p of parts) {
        assignments[p.key] = colors[0].hex;
        matchedPartsInOrder.push(p.key);
      }
      continue;
    }

    // Pair by region: color after part and before next part.
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const nextStart = parts[i + 1]?.start ?? Number.POSITIVE_INFINITY;
      const regionColors = colors.filter((c) => c.start >= p.start && c.start < nextStart);

      let chosen = regionColors[regionColors.length - 1] ?? null;
      if (!chosen) {
        const after = colors.find((c) => c.start >= p.start);
        chosen = after ?? null;
      }
      if (!chosen) {
        // "black laces" fallback: nearest color before the part within a small window
        const before = [...colors].reverse().find((c) => c.start < p.start);
        chosen = before ?? null;
      }

      if (!chosen) continue;
      assignments[p.key] = chosen.hex;
      matchedPartsInOrder.push(p.key);
    }
  }

  return {
    assignments,
    unknownParts: Array.from(unknownParts),
    unknownColors: Array.from(unknownColors),
    matchedPartsInOrder,
  };
}
