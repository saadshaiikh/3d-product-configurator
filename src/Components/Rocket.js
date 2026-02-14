// fixed Rocket model component

import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import useHoverCursor from "../hooks/useHoverCursor";
import * as THREE from "three";
import { useSnapshot } from "valtio";

// Neutral highlight so it doesn't tint the picked color.
const HOVER_EMISSIVE = "#FFFFFF";
const SELECT_EMISSIVE = "#FFFFFF";

function pickAxisIndex(sizeVec3) {
  const { x, y, z } = sizeVec3;
  if (x >= y && x >= z) return 0;
  if (y >= x && y >= z) return 1;
  return 2;
}

function distance(a, b) {
  return a.distanceTo(b);
}

function setStandardMaterial(mesh) {
  mesh.material = new THREE.MeshStandardMaterial({
    color: "#D3D3D3",
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
}

export default function Rocket({
  colors = {},
  updateCurrent,
  hoveredPart,
  selectedPart,
  onHover,
  ...props
}) {
  const { scene } = useGLTF("/Rocket/scene.gltf");
  const colorsSnap = useSnapshot(colors);
  const [isPointerOverMesh, setIsPointerOverMesh] = useState(false);
  const hoveredColor = hoveredPart ? colorsSnap?.[hoveredPart] : null;
  useHoverCursor(isPointerOverMesh, hoveredPart, hoveredColor);

  const rocket = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);

    const meshes = [];
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      setStandardMaterial(obj);

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const volume = Math.max(0, size.x * size.y * size.z);
      const isWing = /cube/i.test(obj.name);
      meshes.push({ mesh: obj, name: obj.name, box, size, center, volume });
      obj.userData.partKey = null;
      obj.userData.__isWing = isWing;
    });

    // Heuristic mapping that works even if node names change:
    // - Wings: meshes with "Cube" in name
    // - Hull: largest non-wing mesh
    // - Top/Base: two extreme meshes along the rocket's main axis (top = smaller-volume extreme)
    // - Window: anything leftover (usually glass + border)
    const overall = new THREE.Box3().setFromObject(root);
    const overallSize = overall.getSize(new THREE.Vector3());
    const axisIndex = pickAxisIndex(overallSize);

    for (const m of meshes) {
      m.proj =
        axisIndex === 0 ? m.center.x : axisIndex === 1 ? m.center.y : m.center.z;
      m.isWing = !!m.mesh.userData.__isWing;
    }

    const nonWings = meshes.filter((m) => !m.isWing);
    const hullMesh =
      nonWings.length > 0
        ? nonWings.reduce((a, b) => (a.volume >= b.volume ? a : b))
        : null;

    const body = nonWings.filter((m) => m !== hullMesh);

    // Determine end caps by projection extremes *within the body* (excluding hull).
    const minProj = body.length > 0 ? body.reduce((a, b) => (a.proj <= b.proj ? a : b)) : null;
    const maxProj = body.length > 0 ? body.reduce((a, b) => (a.proj >= b.proj ? a : b)) : null;

    const projMin = body.length > 0 ? Math.min(...body.map((m) => m.proj)) : 0;
    const projMax = body.length > 0 ? Math.max(...body.map((m) => m.proj)) : 0;
    const projLen = Math.max(1e-6, projMax - projMin);
    const endThreshold = projLen * 0.18;

    // Group top/base by "near end" region, then keep window from stealing end meshes.
    const topEnd = maxProj;
    const baseEnd = minProj;

    const topGroup = topEnd
      ? body.filter((m) => m.proj >= topEnd.proj - endThreshold)
      : [];
    const baseGroup = baseEnd
      ? body.filter((m) => m.proj <= baseEnd.proj + endThreshold)
      : [];

    // Window candidates must be in the mid region (not close to top/base ends).
    const midCandidates = body.filter(
      (m) =>
        !topGroup.includes(m) &&
        !baseGroup.includes(m)
    );

    // Window: smallest mid mesh + nearest neighbor (border/ring).
    const windowGlass =
      midCandidates.length > 0
        ? midCandidates.reduce((a, b) => (a.volume <= b.volume ? a : b))
        : null;
    const windowBorder =
      windowGlass && midCandidates.length > 1
        ? midCandidates
            .filter((m) => m !== windowGlass)
            .map((m) => ({ m, dist: distance(m.center, windowGlass.center) }))
            .reduce((a, b) => (a.dist <= b.dist ? a : b)).m
        : null;
    const windowSet = new Set([windowGlass, windowBorder].filter(Boolean));

    // Make top include 2 meshes when possible: choose the 2 closest meshes to the top end within the end region.
    let topSet = new Set();
    if (topEnd) {
      const sorted = topGroup
        .filter((m) => !windowSet.has(m))
        .map((m) => ({ m, dist: distance(m.center, topEnd.center) }))
        .sort((a, b) => a.dist - b.dist)
        .map((x) => x.m);
      topSet = new Set(sorted.slice(0, 2));
      if (topSet.size === 0) topSet.add(topEnd);
    }

    // Base: use closest mesh(es) to base end within the end region (usually 1 is enough).
    let baseSet = new Set();
    if (baseEnd) {
      const sorted = baseGroup
        .filter((m) => !windowSet.has(m) && !topSet.has(m))
        .map((m) => ({ m, dist: distance(m.center, baseEnd.center) }))
        .sort((a, b) => a.dist - b.dist)
        .map((x) => x.m);
      baseSet = new Set(sorted.slice(0, 1));
      if (baseSet.size === 0 && baseEnd) baseSet.add(baseEnd);
    }

    for (const m of meshes) {
      let key = null;
      if (m.isWing) key = "wings";
      else if (m === hullMesh) key = "hull";
      else if (windowSet.has(m)) key = "window";
      else if (topSet.has(m)) key = "top";
      else if (baseSet.has(m)) key = "base";
      else key = "hull";

      m.mesh.userData.partKey = key;
    }

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.table(
        meshes.map((m) => ({
          name: m.name,
          partKey: m.mesh.userData.partKey ?? "(unmapped)",
          volume: Math.round(m.volume),
          proj: Math.round(m.proj ?? 0),
        }))
      );
    }

    return root;
  }, [scene]);

  const handleOver = (e, key) => {
    e.stopPropagation();
    setIsPointerOverMesh(true);
    onHover?.(key);
  };
  const handleOut = (e) => {
    e.stopPropagation();
    if (e.intersections.length === 0) {
      setIsPointerOverMesh(false);
      onHover?.(null);
    }
  };
  const handleDown = (e, key) => {
    e.stopPropagation();
    updateCurrent?.(key);
  };

  useEffect(() => {
    rocket.traverse((obj) => {
      if (!obj.isMesh) return;
      const partKey = obj.userData.partKey;
      if (!partKey) return;

      const hex =
        colorsSnap?.[partKey] ?? (partKey === "wings" ? "#A8A8A8" : "#D3D3D3");
      const em =
        selectedPart === partKey
          ? SELECT_EMISSIVE
          : hoveredPart === partKey
            ? HOVER_EMISSIVE
            : "#000000";
      const emInt =
        selectedPart === partKey ? 0.22 : hoveredPart === partKey ? 0.14 : 0;

      if (!(obj.material instanceof THREE.MeshStandardMaterial)) {
        setStandardMaterial(obj);
      }
      const mat = obj.material;
      mat.color.set(hex);
      mat.emissive.set(em);
      mat.emissiveIntensity = emInt;
      mat.needsUpdate = true;
    });
  }, [colorsSnap, hoveredPart, rocket, selectedPart]);

  return (
    <group
      {...props}
      dispose={null}
      scale={[0.9, 0.9, 0.9]}
      onPointerMissed={() => {
        updateCurrent?.(null);
        onHover?.(null);
        setIsPointerOverMesh(false);
      }}
    >
      <primitive
        object={rocket}
        onPointerOver={(e) => {
          const key = e.object?.userData?.partKey ?? null;
          if (!key) return;
          handleOver(e, key);
        }}
        onPointerOut={handleOut}
        onPointerDown={(e) => {
          const key = e.object?.userData?.partKey ?? null;
          if (!key) return;
          handleDown(e, key);
        }}
      />
    </group>
  );
}

useGLTF.preload("/Rocket/scene.gltf");
