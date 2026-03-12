import { useState } from "react";
import { useSnapshot } from "valtio";

import { store } from "../state/store";
import ShareLinkModal from "./ShareLinkModal";

export default function ShareLinkButton({ disabled = false }) {
  const snap = useSnapshot(store);
  const [open, setOpen] = useState(false);

  const configId = snap.activeConfigId || snap.activeConfig?.id || "";

  return (
    <>
      <button
        type="button"
        className="selection-bar__btn selection-bar__btn--ghost"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={configId ? "Share link" : "Save a config first"}
      >
        Share link
      </button>

      <ShareLinkModal
        open={open}
        onClose={() => setOpen(false)}
        configId={configId}
      />
    </>
  );
}
