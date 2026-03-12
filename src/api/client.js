const API_BASE = process.env.REACT_APP_API_BASE || "";
const DEV_FALLBACK_BASES =
  process.env.NODE_ENV === "development"
    ? ["http://localhost:8080", "http://127.0.0.1:8080"]
    : [];

async function request(path, { method = "GET", body, headers, signal } = {}) {
  const bases = [API_BASE, ...DEV_FALLBACK_BASES].filter(
    (base, idx, arr) => arr.indexOf(base) === idx
  );

  let lastErr;
  for (const base of bases) {
    try {
      return await doFetch(base, path, {
        method,
        body,
        headers,
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (!isNetworkError(err)) throw err;
      lastErr = err;
    }
  }

  throw lastErr || new Error("Failed to fetch");
}

async function doFetch(
  base,
  path,
  { method = "GET", body, headers, signal }
) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  const isJSON = res.headers
    .get("content-type")
    ?.includes("application/json");

  if (!res.ok) {
    const msg = text?.trim() || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return isJSON ? JSON.parse(text) : text;
}

export const apiClient = { request, API_BASE };

function isNetworkError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return false;
  const msg = String(err.message || "");
  return err.name === "TypeError" || msg.includes("Failed to fetch");
}

async function requestForm(path, formData, { method = "POST", headers, signal } = {}) {
  const bases = [API_BASE, ...DEV_FALLBACK_BASES].filter(
    (base, idx, arr) => arr.indexOf(base) === idx
  );

  let lastErr;
  for (const base of bases) {
    try {
      return await doFormFetch(base, path, {
        method,
        body: formData,
        headers,
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (!isNetworkError(err)) throw err;
      lastErr = err;
    }
  }

  throw lastErr || new Error("Failed to fetch");
}

async function doFormFetch(base, path, { method = "POST", body, headers, signal }) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(headers || {}),
    },
    body,
    signal,
  });

  const text = await res.text();
  const isJSON = res.headers
    .get("content-type")
    ?.includes("application/json");

  if (!res.ok) {
    const msg = text?.trim() || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return isJSON ? JSON.parse(text) : text;
}

apiClient.requestForm = requestForm;

export function connectConfigWS(configId) {
  const isDev = process.env.NODE_ENV === "development";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = isDev ? "localhost:8080" : window.location.host;
  const wsBase = `${proto}//${host}`;
  return new WebSocket(`${wsBase}/ws?configId=${encodeURIComponent(configId)}`);
}
