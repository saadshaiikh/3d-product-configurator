import { apiClient } from "./client";

export async function createConfig({ modelId, title, colors, isPublic = true }) {
  return apiClient.request("/configs", {
    method: "POST",
    body: { modelId, title, colors, isPublic },
  });
}

export async function getConfig(id, options = {}) {
  return apiClient.request(`/configs/${encodeURIComponent(id)}`, options);
}

export async function patchConfig(id, body) {
  const res = await fetch(`/configs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  const isJSON = res.headers
    .get("content-type")
    ?.includes("application/json");

  if (res.status === 409) {
    const payload = isJSON && text ? JSON.parse(text) : null;
    return { conflict: true, config: payload?.config || null };
  }

  if (!res.ok) {
    const msg = text?.trim() || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const payload = isJSON && text ? JSON.parse(text) : null;
  return { conflict: false, config: payload?.config || null };
}
