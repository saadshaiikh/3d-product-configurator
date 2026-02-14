// src/hooks/useHoverCursor.js
import { useEffect } from "react";

/**
 * Supported call signatures:
 *
 * 1) NEW (recommended): useHoverCursor(isActive, hoveredKey, hoveredColor)
 *    - isActive: boolean (true only when pointer is over the 3D mesh)
 *    - hoveredKey: string|null (part name)
 *    - hoveredColor: string|null (hex color)
 *
 * 2) Old: useHoverCursor(hoveredKey, hoveredColor)
 *    - will show cursor whenever hoveredKey is truthy
 *
 * 3) Old (Shoe style): useHoverCursor(isActive, hoveredColor)
 *    - no label (because no hoveredKey passed)
 */
export default function useHoverCursor(a, b, c) {
  let isActive = false;
  let hoveredKey = null;
  let hoveredColor = null;

  // NEW: (isActive, hoveredKey, hoveredColor)
  if (typeof c !== "undefined") {
    isActive = !!a;
    hoveredKey = b ?? null;
    hoveredColor = c ?? null;

    // Old Shoe style: (isActive, hoveredColor)
  } else if (typeof a === "boolean") {
    isActive = a;
    hoveredKey = null;
    hoveredColor = b ?? null;

    // Old: (hoveredKey, hoveredColor)
  } else {
    hoveredKey = a ?? null;
    hoveredColor = b ?? null;
    isActive = !!hoveredKey;
  }

  useEffect(() => {
    // ✅ Only show cursor when active AND actually hovering a part
    if (!isActive || !hoveredKey) {
      document.body.style.cursor = "auto";
      return;
    }

    const fill = hoveredColor ?? "rgba(0,0,0,0)";
    const label = String(hoveredKey);

    const cursor = `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0)">
        <path fill="rgba(255, 255, 255, 0.5)" d="M29.5 54C43.031 54 54 43.031 54 29.5S43.031 5 29.5 5 5 15.969 5 29.5 15.969 54 29.5 54z" stroke="#000"/>
        <g filter="url(#filter0_d)">
          <path d="M29.5 47C39.165 47 47 39.165 47 29.5S39.165 12 29.5 12 12 19.835 12 29.5 19.835 47 29.5 47z" fill="${fill}"/>
        </g>
        <path d="M2 2l11 2.947L4.947 13 2 2z" fill="#000"/>
        <text fill="#000" style="white-space:pre" font-family="Inter var, sans-serif" font-size="10" letter-spacing="-.01em">
          <tspan x="35" y="63">${label}</tspan>
        </text>
      </g>
      <defs>
        <clipPath id="clip0"><path fill="#fff" d="M0 0h64v64H0z"/></clipPath>
        <filter id="filter0_d" x="6" y="8" width="47" height="47" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"/>
          <feOffset dy="2"/>
          <feGaussianBlur stdDeviation="3"/>
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
          <feBlend in2="BackgroundImageFix" result="effect1_dropShadow"/>
          <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
        </filter>
      </defs>
    </svg>`;

    document.body.style.cursor = `url('data:image/svg+xml;base64,${btoa(
      cursor
    )}'), auto`;

    return () => {
      document.body.style.cursor = "auto";
    };
  }, [isActive, hoveredKey, hoveredColor]);
}
