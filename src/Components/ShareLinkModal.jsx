import React, { useMemo, useState } from "react";

export default function ShareLinkModal({ open, onClose, configId }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const shareUrl = useMemo(() => {
    if (!configId) return "";
    return `${window.location.origin}/c/${configId}`;
  }, [configId]);

  if (!open) return null;

  async function copy() {
    setErr("");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (e2) {
        setErr("Could not copy. Please copy manually.");
      }
    }
  }

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
          width: 520,
          maxWidth: "92vw",
          background: "#111",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 18,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Your link is ready</div>
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
          Share this link with anyone you want.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <input
            value={shareUrl}
            readOnly
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "#fff",
              fontSize: 14,
            }}
          />
          <button
            onClick={copy}
            disabled={!shareUrl}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: shareUrl ? "#2b6fff" : "#333",
              color: "#fff",
              cursor: shareUrl ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {err && <div style={{ marginTop: 10, color: "#ff6b6b" }}>{err}</div>}

        {!configId && (
          <div style={{ marginTop: 10, opacity: 0.8 }}>
            Save a config first to generate a share link.
          </div>
        )}
      </div>
    </div>
  );
}
