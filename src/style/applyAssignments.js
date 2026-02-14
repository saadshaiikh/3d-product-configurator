export function applyAssignments({
  store,
  modelName,
  assignments,
  selectPart = null,
}) {
  if (!store || !modelName) return;
  const colorsProxy = store.colors?.[modelName];
  if (!colorsProxy || !assignments) return;

  for (const [partKey, hex] of Object.entries(assignments)) {
    if (!partKey) continue;
    if (!(partKey in colorsProxy)) continue;
    colorsProxy[partKey] = hex;
  }

  if (selectPart) {
    store.selectedPart = selectPart;
  }
}

