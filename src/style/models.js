export const MODEL_PARTS = {
  Shoe: ["laces", "mesh", "caps", "inner", "sole", "stripes", "band", "patch"],
  Rocket: ["hull", "base", "top", "wings", "window"],
  Axe: ["design", "inner", "support", "body"],
  Insect: ["shell", "body"],
  Teapot: ["lid", "base"],
};

export const MODEL_ALIASES = {
  Shoe: {
    body: "mesh",
    bottom: "sole",
    outsole: "sole",
    inside: "inner",
    interior: "inner",
    "inner lining": "inner",
    logo: "stripes",
    logos: "stripes",
    band: "band",
    bands: "stripes",
  },
  Rocket: {
    tip: "top",
    nose: "top",
    fins: "wings",
    fin: "wings",
  },
  Axe: {
    handle: "body",
    head: "design",
  },
  Insect: {
    abdomen: "body",
    carapace: "shell",
  },
  Teapot: {
    pot: "base",
  },
};

