import { useCallback } from "react";
import { useThree } from "@react-three/fiber";

export function useCaptureCanvasPng() {
  const { gl, scene, camera } = useThree();

  return useCallback(
    () =>
      new Promise((resolve, reject) => {
        gl.render(scene, camera);
        gl.domElement.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("capture failed"))),
          "image/png",
          0.95
        );
      }),
    [gl, scene, camera]
  );
}
