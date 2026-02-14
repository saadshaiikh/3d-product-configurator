// fixed Axe model component

import { useState } from "react";
import { useGLTF } from "@react-three/drei";
import useHoverCursor from "../hooks/useHoverCursor";

// Neutral highlight so it doesn't tint the picked color.
const HOVER_EMISSIVE = "#FFFFFF";
const SELECT_EMISSIVE = "#FFFFFF";

export default function Axe({
  colors = {},
  updateCurrent,
  hoveredPart,
  selectedPart,
  onHover,
  ...props
}) {
  const { nodes } = useGLTF("/Axe/scene.gltf");
  const [isPointerOverMesh, setIsPointerOverMesh] = useState(false);
  const hoveredColor = hoveredPart ? colors?.[hoveredPart] : null;
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
      scale={[0.02, 0.02, 0.02]}
      rotation={[-Math.PI / 3 + 0.5, 0, -Math.PI / 2 + 0.3]}
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
          onPointerOver={(e) => handleOver(e, "design")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "design")}
        >
          <meshStandardMaterial
            name="design"
            color={colors?.design ?? "#D3D3D3"}
            emissive={emissive("design")}
            emissiveIntensity={emissiveIntensity("design")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_3.geometry}
          onPointerOver={(e) => handleOver(e, "inner")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "inner")}
        >
          <meshStandardMaterial
            name="inner"
            color={colors?.inner ?? "#D3D3D3"}
            emissive={emissive("inner")}
            emissiveIntensity={emissiveIntensity("inner")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_4.geometry}
          onPointerOver={(e) => handleOver(e, "design")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "design")}
        >
          <meshStandardMaterial
            name="design"
            color={colors?.design ?? "#D3D3D3"}
            emissive={emissive("design")}
            emissiveIntensity={emissiveIntensity("design")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_5.geometry}
          onPointerOver={(e) => handleOver(e, "support")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "support")}
        >
          <meshStandardMaterial
            name="support"
            color={colors?.support ?? "#D3D3D3"}
            emissive={emissive("support")}
            emissiveIntensity={emissiveIntensity("support")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_6.geometry}
          onPointerOver={(e) => handleOver(e, "design")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "design")}
        >
          <meshStandardMaterial
            name="design"
            color={colors?.design ?? "#D3D3D3"}
            emissive={emissive("design")}
            emissiveIntensity={emissiveIntensity("design")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_7.geometry}
          onPointerOver={(e) => handleOver(e, "body")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "body")}
        >
          <meshStandardMaterial
            name="body"
            color={colors?.body ?? "#A8A8A8"}
            emissive={emissive("body")}
            emissiveIntensity={emissiveIntensity("body")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh
          castShadow
          geometry={nodes.Object_8.geometry}
          onPointerOver={(e) => handleOver(e, "design")}
          onPointerOut={handleOut}
          onPointerDown={(e) => handleDown(e, "design")}
        >
          <meshStandardMaterial
            name="design"
            color={colors?.design ?? "#D3D3D3"}
            emissive={emissive("design")}
            emissiveIntensity={emissiveIntensity("design")}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload("/Axe/scene.gltf");
