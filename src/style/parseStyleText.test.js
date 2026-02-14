import { parseStyleText } from "./parseStyleText";
import { MODEL_ALIASES, MODEL_PARTS } from "./models";
import { COLOR_MAP } from "./colors";

describe("parseStyleText", () => {
  test("applies simple part-color list", () => {
    const res = parseStyleText("laces black, mesh white, stripes #ff0000", {
      validParts: MODEL_PARTS.Shoe,
      aliasMap: MODEL_ALIASES.Shoe,
      colorMap: COLOR_MAP,
    });

    expect(res.assignments.laces).toBe("#000000");
    expect(res.assignments.mesh).toBe("#FFFFFF");
    expect(res.assignments.stripes).toBe("#FF0000");
  });

  test("supports aliases bottom->sole and inside->inner", () => {
    const res = parseStyleText("make bottom grey and inside light blue", {
      validParts: MODEL_PARTS.Shoe,
      aliasMap: MODEL_ALIASES.Shoe,
      colorMap: COLOR_MAP,
    });

    expect(res.assignments.sole).toBe("#808080");
    expect(res.assignments.inner).toBe("#60A5FA");
  });

  test("applies one color to multiple parts", () => {
    const res = parseStyleText("laces and mesh black", {
      validParts: MODEL_PARTS.Shoe,
      aliasMap: MODEL_ALIASES.Shoe,
      colorMap: COLOR_MAP,
    });

    expect(res.assignments.laces).toBe("#000000");
    expect(res.assignments.mesh).toBe("#000000");
  });

  test("unknown part does not crash and is reported", () => {
    const res = parseStyleText("tongue purple", {
      validParts: MODEL_PARTS.Shoe,
      aliasMap: MODEL_ALIASES.Shoe,
      colorMap: COLOR_MAP,
    });

    expect(Object.keys(res.assignments)).toHaveLength(0);
    expect(res.unknownParts.length).toBeGreaterThan(0);
  });

  test("unknown color phrase prevents applying", () => {
    const res = parseStyleText("laces galaxy purple", {
      validParts: MODEL_PARTS.Shoe,
      aliasMap: MODEL_ALIASES.Shoe,
      colorMap: COLOR_MAP,
    });

    expect(Object.keys(res.assignments)).toHaveLength(0);
    expect(res.unknownColors).toContain("galaxy purple");
  });

  test("garbage input never throws", () => {
    const res = parseStyleText("!!! ??? 🤝", {
      validParts: MODEL_PARTS.Shoe,
      aliasMap: MODEL_ALIASES.Shoe,
      colorMap: COLOR_MAP,
    });
    expect(res).toBeTruthy();
  });
});

