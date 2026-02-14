// fixed Insect model component

import { useState } from "react";
import { useGLTF } from "@react-three/drei";
import useHoverCursor from "../hooks/useHoverCursor";

// Neutral highlight so it doesn't tint the picked color.
const HOVER_EMISSIVE = "#FFFFFF";
const SELECT_EMISSIVE = "#FFFFFF";

export default function Insect({
  colors = {},
  updateCurrent,
  hoveredPart,
  selectedPart,
  onHover,
  ...props
}) {
  const { nodes } = useGLTF("/Insect/scene.gltf");
  const [isPointerOverMesh, setIsPointerOverMesh] = useState(false);
  const hoveredColor = hoveredPart ? colors?.[hoveredPart] : null;
  useHoverCursor(isPointerOverMesh, hoveredPart, hoveredColor);

  const isHovered = (key) => hoveredPart === key;
  const isSelected = (key) => selectedPart === key;
  const matProps = (partKey) => {
    const hovered = isHovered(partKey);
    const selected = isSelected(partKey);
    return {
      emissive: selected ? SELECT_EMISSIVE : hovered ? HOVER_EMISSIVE : "#000000",
      emissiveIntensity: selected ? 0.22 : hovered ? 0.14 : 0,
      roughness: 0.55,
      metalness: 0.05,
    };
  };

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
      scale={[0.04, 0.04, 0.04]}
      rotation={[-0.1, 2, 0.5]}
      onPointerMissed={() => {
        updateCurrent?.(null);
        onHover?.(null);
        setIsPointerOverMesh(false);
      }}
    >
      {/* Example shell part: replace geometry with your actual nodes and apply handlers */}
      <mesh
        castShadow
        geometry={nodes?.shell1_low_lambert1_0?.geometry}
        onPointerOver={(e) => handleOver(e, "shell")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "shell")}
      >
        <meshStandardMaterial
          name="shell"
          color={colors?.shell ?? "#D3D3D3"}
          {...matProps("shell")}
        />
      </mesh>
      {/* Example body part: replace geometry with your actual node for body and apply handlers */}
      <mesh
        castShadow
        geometry={nodes?.pCylinder11_low_lambert1_0?.geometry}
        onPointerOver={(e) => handleOver(e, "body")}
        onPointerOut={handleOut}
        onPointerDown={(e) => handleDown(e, "body")}
      >
        <meshStandardMaterial
          name="body"
          color={colors?.body ?? "#D3D3D3"}
          {...matProps("body")}
        />
      </mesh>
      {/* TODO: repeat the pattern above for every mesh in your GLTF file.
          Each mesh should set its material name to either "shell" or "body",
          set the color from `colors` prop, spread emissive via matProps,
          and attach onPointerOver/Out/Down handlers. */}
    </group>
  );
}

useGLTF.preload("/Insect/scene.gltf");
