import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

function isValidBox3(box) {
  return (
    Number.isFinite(box.min.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.max.y) &&
    Number.isFinite(box.max.z)
  );
}

/**
 * Keeps OrbitControls + camera framed to the rendered model bounds.
 *
 * - Fits on `fitKey` change (e.g., selectedModel).
 * - Exposes the `fit()` function back to parent via `onFitReady`.
 */
export default function SceneRig({
  controlsRef,
  fitKey,
  onFitReady,
  margin = 1.25,
  debug = false,
  children,
}) {
  const groupRef = useRef(null);
  const { camera } = useThree();

  const fit = useCallback(() => {
    const controls = controlsRef?.current;
    const root = groupRef.current;
    if (!controls || !root) return false;

    const box = new THREE.Box3().setFromObject(root);
    if (!isValidBox3(box)) return false;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return false;

    const fov = THREE.MathUtils.degToRad(camera.fov ?? 45);
    const distance = (maxDim * margin) / (2 * Math.tan(fov / 2));

    const prevDir = new THREE.Vector3()
      .copy(camera.position)
      .sub(controls.target);
    const dir =
      prevDir.lengthSq() > 1e-6
        ? prevDir.normalize()
        : new THREE.Vector3(0.15, 0.1, 1).normalize();

    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(dir, distance);

    const near = Math.max(0.01, distance / 100);
    const far = Math.max(near + 1, distance * 100);
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();

    controls.minDistance = distance * 0.25;
    controls.maxDistance = distance * 4;
    controls.update();

    // Make OrbitControls.reset() return to the fitted view.
    controls.saveState?.();

    if (debug && process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[SceneRig] fit", {
        size: size.toArray(),
        center: center.toArray(),
        distance,
        near,
        far,
      });
    }
    return true;
  }, [camera, controlsRef, debug, margin]);

  useLayoutEffect(() => {
    onFitReady?.(fit);
  }, [fit, onFitReady]);

  useEffect(() => {
    // Wait for:
    // - Suspense-loaded meshes to mount into the scene graph
    // - OrbitControls ref to become available
    let raf1 = 0;
    let raf2 = 0;
    let tries = 0;

    const attempt = () => {
      tries += 1;
      const ok = fit();
      if (ok || tries > 30) return;
      raf2 = window.requestAnimationFrame(attempt);
    };

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(attempt);
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [fitKey, fit]);

  return <group ref={groupRef}>{children}</group>;
}
