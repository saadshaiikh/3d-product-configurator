import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getConfig } from "../api/configs";
import { getModel, normalizeModelDetail } from "../api/models";
import { connectConfigWS } from "../api/client";
import MainApp from "./MainApp";
import {
  ensureModelColors,
  getDefaultColors,
  replaceModelColors,
  setModelMeta,
  store,
} from "../state/store";

export default function ConfigPage() {
  const { configId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ loading: true, error: null });
  const requestRef = useRef(0);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const retryRef = useRef(0);

  const applyConfig = useCallback(async (cfg) => {
    if (!cfg || !cfg.id || !cfg.modelId) return;

    const modelId = String(cfg.modelId).toLowerCase();
    store.activeConfigId = cfg.id;
    store.activeConfig = cfg;
    store.selectedModel = modelId;
    store.selectedPart = null;
    store.hoveredPart = null;

    const existingMeta = store.modelMetaById?.[modelId];
    if (!existingMeta) {
      try {
        const modelRes = await getModel(modelId);
        const meta = normalizeModelDetail(modelRes?.model);
        if (meta) setModelMeta(modelId, meta);
      } catch {
        // non-blocking
      }
    }

    const defaults = getDefaultColors(modelId);
    ensureModelColors(modelId, defaults);
    replaceModelColors(modelId, cfg.colors || {}, defaults);
  }, []);

  useEffect(() => {
    if (!configId) {
      setStatus({ loading: false, error: "Invalid link" });
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestRef.current;

    setStatus({ loading: true, error: null });
    store.status.isLoadingConfig = true;

    const run = async () => {
      try {
        const cfgRes = await getConfig(configId, { signal: controller.signal });
        if (requestId !== requestRef.current) return;

        const cfg = cfgRes?.config;
        if (!cfg || !cfg.modelId) {
          throw new Error("Config not found");
        }

        await applyConfig(cfg);
        if (requestId !== requestRef.current) return;

        setStatus({ loading: false, error: null });
      } catch (err) {
        if (requestId !== requestRef.current) return;
        if (err?.name === "AbortError") return;
        setStatus({ loading: false, error: err?.message || "Failed to load" });
      } finally {
        if (requestId === requestRef.current) {
          store.status.isLoadingConfig = false;
        }
      }
    };

    run();
    return () => controller.abort();
  }, [applyConfig, configId]);

  useEffect(() => {
    if (!configId) return;

    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      store.ws.status = "connecting";
      store.ws.lastError = null;

      const ws = connectConfigWS(configId);
      wsRef.current = ws;

      ws.onopen = () => {
        store.ws.status = "connected";
        retryRef.current = 0;
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data || "{}");
          if (!msg || !msg.type) return;

          if (msg.type === "sync" && msg.config) {
            await applyConfig(msg.config);
            return;
          }

          if (msg.type === "patch_applied") {
            if (msg.config) {
              await applyConfig(msg.config);
              return;
            }

            if (msg.colors && store.activeConfig && store.selectedModel) {
              const modelId = store.selectedModel;
              const colorsProxy = store.colors[modelId];
              if (colorsProxy) {
                for (const [k, v] of Object.entries(msg.colors)) {
                  colorsProxy[k] = v;
                }
              }
              if (typeof msg.revision === "number") {
                store.activeConfig = {
                  ...store.activeConfig,
                  revision: msg.revision,
                };
              }
            }
            return;
          }

          if (msg.type === "conflict") {
            try {
              const fresh = await getConfig(configId);
              if (fresh?.config) await applyConfig(fresh.config);
            } catch {
              // ignore
            }
          }

          if (msg.type === "error") {
            store.ws.lastError = msg.message || "ws error";
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        store.ws.status = "disconnected";
      };

      ws.onclose = () => {
        store.ws.status = "disconnected";
        if (!isMounted) return;
        if (reconnectRef.current) {
          window.clearTimeout(reconnectRef.current);
        }
        retryRef.current += 1;
        const backoff = Math.min(1000 * 2 ** (retryRef.current - 1), 15000);
        const jitter = Math.floor(Math.random() * 200);
        reconnectRef.current = window.setTimeout(connect, backoff + jitter);
      };
    };

    connect();

    return () => {
      isMounted = false;
      store.ws.status = "idle";
      retryRef.current = 0;
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [applyConfig, configId]);

  if (status.error) {
    return (
      <div className="config-page">
        <div className="card config-page__card">
          <div className="card__title">Config not found</div>
          <div className="card__body">
            {status.error || "This link is invalid or has expired."}
          </div>
          <div className="config-page__actions">
            <button
              type="button"
              className="selection-bar__btn"
              onClick={() => navigate("/")}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status.loading) {
    return (
      <div className="config-page">
        <div className="card config-page__card">
          <div className="card__title">Loading config...</div>
          <div className="card__body">Fetching your saved setup.</div>
        </div>
      </div>
    );
  }

  return <MainApp />;
}
