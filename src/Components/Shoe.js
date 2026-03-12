// fixed Shoe model component

import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import useHoverCursor from "../hooks/useHoverCursor";
import { useSnapshot } from "valtio";

// Neutral highlight so it doesn't tint the picked color.
const HOVER_EMISSIVE = "#FFFFFF";
const SELECT_EMISSIVE = "#FFFFFF";
const FALLBACK_COLOR = "#D3D3D3";

const PART_MATERIALS = {
  laces: "laces",
  mesh: "mesh",
  caps: "caps",
  inner: "inner",
  sole: "sole",
  stripes: "stripes",
  band: "band",
  patch: "patch",
};

export default function Shoe({
  colors = {},
  updateCurrent,
  hoveredPart,
  selectedPart,
  onHover,
  ...props
}) {
  const { nodes, materials } = useGLTF("/Shoe/shoe.gltf");
  const colorsSnap = useSnapshot(colors);

  // track pointer over status for custom cursor
  const [isPointerOverMesh, setIsPointerOverMesh] = useState(false);
  const hoveredColor = hoveredPart ? colorsSnap?.[hoveredPart] : null;
  useHoverCursor(isPointerOverMesh, hoveredPart, hoveredColor);

  const isHovered = (key) => hoveredPart === key;
  const isSelected = (key) => selectedPart === key;

  const emissive = (key) => {
    if (isSelected(key)) return SELECT_EMISSIVE;
    if (isHovered(key)) return HOVER_EMISSIVE;
    return "#000000";
  };

  const emissiveIntensity = (key) => {
    const h = isHovered(key);
    const s = isSelected(key);
    if (h && s) return 0.26;
    if (s) return 0.22;
    if (h) return 0.14;
    return 0;
  };

  const materialPairs = useMemo(
    () =>
      Object.entries(PART_MATERIALS).map(([partKey, matKey]) => ({
        partKey,
        matKey,
      })),
    []
  );

  useEffect(() => {
    if (!materials) return;
    for (const { partKey, matKey } of materialPairs) {
      const mat = materials[matKey];
      if (!mat || !mat.color) continue;
      const nextColor = colorsSnap?.[partKey] ?? FALLBACK_COLOR;
      mat.color.set(nextColor);
      mat.needsUpdate = true;
    }
  }, [colorsSnap, materialPairs, materials]);

  // pointer handlers
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

  return (
    <group
      {...props}
      dispose={null}
      onPointerMissed={() => {
        updateCurrent?.(null);
        onHover?.(null);
        setIsPointerOverMesh(false);
      }}
    >
      <mesh
        castShadow
        geometry={nodes.shoe.geometry}
        material={materials.laces}
        material-color={colors?.laces ?? "#D3D3D3"}
        material-emissive={emissive("laces")}
        material-emissiveIntensity={emissiveIntensity("laces")}
        onPointerOver={(e) => handleOver(e, "laces")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "laces")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_1.geometry}
        material={materials.mesh}
        material-color={colors?.mesh ?? "#D3D3D3"}
        material-emissive={emissive("mesh")}
        material-emissiveIntensity={emissiveIntensity("mesh")}
        onPointerOver={(e) => handleOver(e, "mesh")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "mesh")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_2.geometry}
        material={materials.caps}
        material-color={colors?.caps ?? "#D3D3D3"}
        material-emissive={emissive("caps")}
        material-emissiveIntensity={emissiveIntensity("caps")}
        onPointerOver={(e) => handleOver(e, "caps")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "caps")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_3.geometry}
        material={materials.inner}
        material-color={colors?.inner ?? "#D3D3D3"}
        material-emissive={emissive("inner")}
        material-emissiveIntensity={emissiveIntensity("inner")}
        onPointerOver={(e) => handleOver(e, "inner")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "inner")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_4.geometry}
        material={materials.sole}
        material-color={colors?.sole ?? "#D3D3D3"}
        material-emissive={emissive("sole")}
        material-emissiveIntensity={emissiveIntensity("sole")}
        onPointerOver={(e) => handleOver(e, "sole")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "sole")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_5.geometry}
        material={materials.stripes}
        material-color={colors?.stripes ?? "#D3D3D3"}
        material-emissive={emissive("stripes")}
        material-emissiveIntensity={emissiveIntensity("stripes")}
        onPointerOver={(e) => handleOver(e, "stripes")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "stripes")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_6.geometry}
        material={materials.band}
        material-color={colors?.band ?? "#D3D3D3"}
        material-emissive={emissive("band")}
        material-emissiveIntensity={emissiveIntensity("band")}
        onPointerOver={(e) => handleOver(e, "band")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "band")}
      />
      <mesh
        castShadow
        geometry={nodes.shoe_7.geometry}
        material={materials.patch}
        material-color={colors?.patch ?? "#D3D3D3"}
        material-emissive={emissive("patch")}
        material-emissiveIntensity={emissiveIntensity("patch")}
        onPointerOver={(e) => handleOver(e, "patch")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "patch")}
      />
    </group>
  );
}

useGLTF.preload("/Shoe/shoe.gltf");
