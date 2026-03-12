import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";

export default function VisualSearchModal({
  open,
  onClose,
  capturePng,
  configId,
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [err, setErr] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [queryUsed, setQueryUsed] = useState("");
  const [refineError, setRefineError] = useState("");

  const shareUrl = useMemo(() => {
    if (!configId) return "";
    return `${window.location.origin}/c/${configId}`;
  }, [configId]);

  useEffect(() => {
    if (!open) return;
    if (!capturePng) {
      setErr("Canvas not ready.");
      return;
    }
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runSearch() {
    if (!capturePng) return;
    setErr("");
    setLoading(true);
    setResults([]);
    setImageUrl("");
    setQueryUsed("");
    setRefineError("");
    try {
      const blob = await capturePng();
      const fd = new FormData();
      fd.append("image", blob, "render.png");
      if (configId) fd.append("configId", configId);

      const data = await apiClient.requestForm("/agent/lens", fd);
      setResults([]);
      if (data?.imageUrl) setImageUrl(data.imageUrl);
      if (data?.refinement?.query) setQueryUsed(data.refinement.query);
      if (data?.refinementError) setRefineError(data.refinementError);
      if (data?.lensUrl) {
        window.open(data.lensUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      const msg = String(e?.message || "Search failed.");
      if (msg.includes("proxy") || msg.includes("Failed to fetch")) {
        setErr("Backend not reachable (start API on :8080)");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy link:", url);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: "94vw",
          maxHeight: "90vh",
          overflow: "auto",
          background: "#111",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 18,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Find similar online</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.85 }}>
          We used an image-based search on your current view.
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={runSearch}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: loading ? "#333" : "#2b6fff",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Searching..." : "Search again"}
          </button>

          {shareUrl ? (
            <button
              onClick={() => copyLink(shareUrl)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "#1f1f1f",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Copy share link
            </button>
          ) : null}
          {imageUrl ? (
            <button
              onClick={() => window.open(imageUrl, "_blank", "noopener,noreferrer")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "#1f1f1f",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Open image URL
            </button>
          ) : null}
          {queryUsed ? (
            <button
              onClick={() => copyLink(queryUsed)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "#1f1f1f",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Copy refinement query
            </button>
          ) : null}
        </div>

        {err ? (
          <div style={{ marginTop: 12, color: "#ff6b6b" }}>{err}</div>
        ) : null}

        {imageUrl ? (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Image URL: {imageUrl}
          </div>
        ) : null}
        {queryUsed ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Refinement query: {queryUsed}
          </div>
        ) : null}
        {refineError ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#ffb347" }}>
            Refinement unavailable: {refineError}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {!loading && !err ? (
            <div style={{ opacity: 0.7 }}>
              Google Lens opened in a new tab. Paste the refinement query there
              to narrow results.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
