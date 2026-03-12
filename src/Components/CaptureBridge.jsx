import { useEffect } from "react";
import { useCaptureCanvasPng } from "./useCaptureCanvasPng";

export default function CaptureBridge({ onReady }) {
  const capture = useCaptureCanvasPng();

  useEffect(() => {
    onReady?.(capture);
  }, [capture, onReady]);

  return null;
}
