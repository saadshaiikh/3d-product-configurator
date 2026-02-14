// fixed Teapot component

import { useState } from "react";
import { useGLTF } from "@react-three/drei";
import useHoverCursor from "../hooks/useHoverCursor";

// Neutral highlight so it doesn't tint the picked color.
const HOVER_EMISSIVE = "#FFFFFF";
const SELECT_EMISSIVE = "#FFFFFF";

export default function Teapot({
  colors = {},
  updateCurrent,
  hoveredPart,
  selectedPart,
  onHover,
  ...props
}) {
  const { nodes } = useGLTF("/Teapot/scene.gltf");
  const [isPointerOverMesh, setIsPointerOverMesh] = useState(false);
  const hoveredKey = hoveredPart ?? null;
  const hoveredColor = hoveredKey ? colors?.[hoveredKey] : null;
  useHoverCursor(isPointerOverMesh, hoveredKey, hoveredColor);

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
      scale={[0.01, 0.01, 0.01]}
      position={[0, -0.3, 0]}
      rotation={[0.2, 0.2, -0.2]}
      onPointerMissed={() => {
        updateCurrent?.(null);
        onHover?.(null);
        setIsPointerOverMesh(false);
      }}
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          castShadow
          geometry={nodes.Object_2.geometry}
          onPointerOver={(e) => handleOver(e, "lid")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "lid")}
        >
          <meshStandardMaterial
            name="lid"
            color={colors?.lid ?? "#D3D3D3"}
            {...matProps("lid")}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_3.geometry}
          onPointerOver={(e) => handleOver(e, "base")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "base")}
        >
          <meshStandardMaterial
            name="base"
            color={colors?.base ?? "#A8A8A8"}
            {...matProps("base")}
          />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload("/Teapot/scene.gltf");
