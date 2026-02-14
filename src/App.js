// src/App.js
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";
import { proxy, useSnapshot } from "valtio";

import CanvasErrorBoundary from "./Components/CanvasErrorBoundary";

import "./loading-overlay.css";


import Shoe from "./Components/Shoe";

import Rocket from "./Components/Rocket";
import Axe from "./Components/Axe";
import Insect from "./Components/Insect";
import Teapot from "./Components/Teapot";

import SelectionBar from "./Components/SelectionBar";
import ModelPicker from "./Components/ModelPicker";
import ColorPicker from "./Components/ColorPicker";
import LoadingOverlay from "./Components/LoadingOverlay";
import SceneRig from "./Components/SceneRig";
import OnboardingHint from "./Components/OnboardingHint";
import StyleAssistant from "./Components/StyleAssistant";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { MODEL_PARTS, MODEL_ALIASES } from "./style/models";
import { COLOR_MAP } from "./style/colors";
import { parseStyleText } from "./style/parseStyleText";
import { applyAssignments } from "./style/applyAssignments";

const SHOW_HINT_STORAGE_KEY = "p3d_show_hint_v1";
const LEGACY_ONBOARDING_DISMISSED_KEY = "p3d_onboarding_dismissed_v1";

// ✅ Defaults match your actual part keys
const DEFAULT_COLORS = {
  Shoe: {
    laces: "#ffffff",
    mesh: "#ffffff",
    caps: "#ffffff",
    inner: "#ffffff",
    sole: "#ffffff",
    stripes: "#ffffff",
    band: "#ffffff",
    patch: "#ffffff",
  },
  Rocket: {
    hull: "#d3d3d3",
    base: "#d3d3d3",
    top: "#d3d3d3",
    wings: "#a8a8a8",
    window: "#a8a8a8",
  },
  Axe: {
    design: "#d3d3d3",
    inner: "#d3d3d3",
    support: "#d3d3d3",
    body: "#a8a8a8",
  },
  Insect: { shell: "#d3d3d3", body: "#a8a8a8" },
  Teapot: { lid: "#d3d3d3", base: "#d3d3d3" },
};

const MODEL_COMPONENTS = { Shoe, Rocket, Axe, Insect, Teapot };

const store = proxy({
  selectedModel: "Shoe",
  hoveredPart: null,
  selectedPart: null,
  colors: {
    Shoe: proxy({ ...DEFAULT_COLORS.Shoe }),
    Rocket: proxy({ ...DEFAULT_COLORS.Rocket }),
    Axe: proxy({ ...DEFAULT_COLORS.Axe }),
    Insect: proxy({ ...DEFAULT_COLORS.Insect }),
    Teapot: proxy({ ...DEFAULT_COLORS.Teapot }),
  },
});

export default function App() {
  const snap = useSnapshot(store);

  const orbitRef = useRef(null);
  const [forceOverlay, setForceOverlay] = useState(false);
  const forceOverlayTimerRef = useRef(null);
  const fitRef = useRef(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [showHint, setShowHint] = useState(() => {
    try {
      const v = localStorage.getItem(SHOW_HINT_STORAGE_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
      // First time on this screen: always show the hint bar.
      return true;
    } catch {
      return true;
    }
  });
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [styleStatus, setStyleStatus] = useState("");

  const selectedModel = snap.selectedModel;
  const hoveredPart = snap.hoveredPart;
  const selectedPart = snap.selectedPart;

  useEffect(() => {
    setStyleStatus("");
  }, [selectedModel]);

  const ActiveModel = useMemo(
    () => MODEL_COMPONENTS[selectedModel] ?? Shoe,
    [selectedModel]
  );

  // ✅ PROXY passed to model components (they can useSnapshot safely if they want)
  const activeColorsProxy = store.colors[selectedModel] ?? store.colors.Shoe;

  // ✅ Snapshot used only for UI widgets like ColorPicker
  const activeColorsSnap = useSnapshot(activeColorsProxy);

  const pulseOverlay = useCallback(() => {
    setForceOverlay(true);
    if (forceOverlayTimerRef.current) {
      window.clearTimeout(forceOverlayTimerRef.current);
    }
    forceOverlayTimerRef.current = window.setTimeout(() => {
      setForceOverlay(false);
      forceOverlayTimerRef.current = null;
    }, 650);
  }, []);

  useEffect(() => {
    return () => {
      if (forceOverlayTimerRef.current) {
        window.clearTimeout(forceOverlayTimerRef.current);
      }
    };
  }, []);

  const pushToast = useCallback((message) => {
    setToast(String(message ?? ""));
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_HINT_STORAGE_KEY, showHint ? "1" : "0");
      // Keep legacy key in sync so existing users who already dismissed stay dismissed.
      if (!showHint) localStorage.setItem(LEGACY_ONBOARDING_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }, [showHint]);

  const handleResetView = useCallback(() => {
    const controls = orbitRef.current;
    if (!controls) return;

    if (typeof fitRef.current === "function") {
      fitRef.current();
      return;
    }

    controls.reset();
    controls.update();
  }, []);

  const setSelectedModel = useCallback((modelName) => {
    store.selectedModel = modelName;
  }, []);

  const resetAllSelections = useCallback(() => {
    store.hoveredPart = null;
    store.selectedPart = null;
  }, []);

  const updateHovered = useCallback((partName) => {
    store.hoveredPart = partName ?? null;
  }, []);

  const updateCurrent = useCallback((partName) => {
    store.selectedPart = partName ?? null;
  }, []);

  const setColorForPart = useCallback((partKey, hex) => {
    const colorsProxy = store.colors[store.selectedModel];
    if (!colorsProxy) return;
    if (!partKey) return;
    if (!(partKey in colorsProxy)) return;
    colorsProxy[partKey] = hex;
  }, []);

  const resetColorsForModel = useCallback(
    (modelName) => {
      const name = String(modelName ?? "");
      const defaults = DEFAULT_COLORS[name];
      const colorsProxy = store.colors[name];
      if (!defaults || !colorsProxy) return;

      const defaultKeys = new Set(Object.keys(defaults));
      for (const k of Object.keys(colorsProxy)) {
        if (!defaultKeys.has(k)) delete colorsProxy[k];
      }

      for (const partKey of Object.keys(defaults)) {
        colorsProxy[partKey] = defaults[partKey];
      }

      pushToast("Colors reset");
    },
    [pushToast]
  );

  const toggleHint = useCallback(() => {
    setShowHint((prev) => {
      const next = !prev;
      pushToast(`Hints: ${next ? "ON" : "OFF"}`);
      return next;
    });
  }, [pushToast]);

  const applyStyleText = useCallback(
    (text) => {
      const validParts = MODEL_PARTS[selectedModel] ?? [];
      const aliasMap = MODEL_ALIASES[selectedModel] ?? {};

      const t = String(text ?? "");
      const { assignments, unknownParts, unknownColors, matchedPartsInOrder } =
        parseStyleText(t, { validParts, aliasMap, colorMap: COLOR_MAP });

      const applied = Object.keys(assignments);
      const lastMatchedPart =
        matchedPartsInOrder.length > 0
          ? matchedPartsInOrder[matchedPartsInOrder.length - 1]
          : null;

      if (applied.length === 0) {
        const warnings = [];
        if (unknownParts.length) warnings.push(`Ignored parts: ${unknownParts.join(", ")}`);
        if (unknownColors.length)
          warnings.push(`Unknown colors: ${unknownColors.join(", ")}`);
        const base =
          unknownParts.length === 0 && unknownColors.length === 0
            ? "No recognized parts found."
            : unknownParts.length > 0
              ? "No recognized parts found."
              : "No assignments applied.";
        setStyleStatus(warnings.length ? `${base} • ${warnings.join(" • ")}` : base);
        return;
      }

      applyAssignments({
        store,
        modelName: selectedModel,
        assignments,
        selectPart: lastMatchedPart,
      });

      const warnings = [];
      if (unknownParts.length) warnings.push(`Ignored parts: ${unknownParts.join(", ")}`);
      if (unknownColors.length) warnings.push(`Unknown colors: ${unknownColors.join(", ")}`);

      const appliedMsg = `Applied: ${applied.join(", ")}`;
      setStyleStatus(warnings.length ? `${appliedMsg} • ${warnings.join(" • ")}` : appliedMsg);
      pushToast(appliedMsg);
    },
    [pushToast, selectedModel]
  );

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      if (e.isComposing) return;

      const key = String(e.key || "").toLowerCase();
      if (!key) return;

      // If the mobile drawer is open, Esc closes it (even if focus is inside an input).
      if (key === "escape" && isMobile && mobileDrawerOpen) {
        e.preventDefault();
        closeMobileDrawer();
        return;
      }

      const el = document.activeElement;
      const tag = el?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable;
      if (isTyping) return;

      if (key === "r") {
        handleResetView();
        pushToast("View reset");
        return;
      }

      if (key === "d") {
        resetColorsForModel(selectedModel);
        return;
      }

      if (key === "escape") {
        e.preventDefault();
        resetAllSelections();
        pushToast("Selection cleared");
        return;
      }

      if (key === "h") {
        toggleHint();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    closeMobileDrawer,
    handleResetView,
    isMobile,
    mobileDrawerOpen,
    pushToast,
    resetColorsForModel,
    resetAllSelections,
    selectedModel,
    toggleHint,
  ]);

  const parts = MODEL_PARTS[selectedModel] ?? [];

  return (
    <div className="app-root">
      {/* ✅ Full-screen overlay loader above Canvas */}
      <LoadingOverlay forceActive={forceOverlay} />

      <div className="app-container">
        {/* ✅ IMPORTANT: boundary wraps the Canvas (prevents blank-screen crashes) */}
        <CanvasErrorBoundary resetKey={selectedModel}>
          <Canvas shadows camera={{ position: [0, 0.6, 2.2], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[5, 8, 3]}
              intensity={1.1}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />

            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.45, 0]}
              receiveShadow
            >
              <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#e9e9e9" />
            </mesh>

            <Suspense fallback={null}>
              <SceneRig
                controlsRef={orbitRef}
                fitKey={selectedModel}
                onFitReady={(fn) => {
                  fitRef.current = fn;
                }}
                debug={selectedModel === "Rocket"}
              >
                <Float
                  speed={1}
                  rotationIntensity={1}
                  floatIntensity={1}
                  floatingRange={[0, 0.3]}
                >
                  <ActiveModel
                    colors={activeColorsProxy}
                    hoveredPart={hoveredPart}
                    selectedPart={selectedPart}
                    // ✅ FIX: there is no setHoveredPart; use updateHovered
                    onHover={updateHovered}
                    updateHovered={updateHovered}
                    updateCurrent={updateCurrent}
                  />
                </Float>
              </SceneRig>
            </Suspense>

            <OrbitControls ref={orbitRef} enableDamping dampingFactor={0.08} />
          </Canvas>
        </CanvasErrorBoundary>

        {/* ✅ HUD overlays above the canvas */}
        <div className="hud">
          {toast ? (
            <div className="hud-toast" role="status" aria-live="polite">
              {toast}
            </div>
          ) : null}

          <div
            className="hud-left hud-clickable"
            onMouseEnter={() => updateHovered(null)}
            onFocusCapture={() => updateHovered(null)}
          >
            <SelectionBar
              modelName={selectedModel}
              current={selectedPart}
              onResetView={handleResetView}
              onClear={resetAllSelections}
            />
          </div>

          <div
            className="hud-bottom-left hud-clickable"
            onMouseEnter={() => updateHovered(null)}
            onFocusCapture={() => updateHovered(null)}
          >
            <OnboardingHint
              open={showHint}
              onDismiss={() => setShowHint(false)}
            />
          </div>

          {isMobile ? (
            <>
              <div className="hud-mobile-actions hud-clickable">
                <button
                  type="button"
                  className="hud-mobile-actions__btn"
                  onClick={() => setMobileDrawerOpen(true)}
                  disabled={forceOverlay}
                  aria-haspopup="dialog"
                  aria-expanded={mobileDrawerOpen}
                >
                  Customize
                </button>
              </div>

              <div
                className={[
                  "mobile-drawer",
                  mobileDrawerOpen ? "is-open" : "",
                ].join(" ")}
                aria-hidden={!mobileDrawerOpen}
              >
                <div
                  className="mobile-drawer__backdrop"
                  onClick={closeMobileDrawer}
                />

                <div
                  className="mobile-drawer__sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Customizer"
                >
                  <div className="mobile-drawer__header">
                    <div className="mobile-drawer__title">Customize</div>
                    <button
                      type="button"
                      className="mobile-drawer__close"
                      onClick={closeMobileDrawer}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mobile-drawer__body">
                    <StyleAssistant
                      disabled={forceOverlay}
                      status={styleStatus}
                      onApplyText={applyStyleText}
                      onClear={() => setStyleStatus("")}
                    />

                    <ModelPicker
                      selectedModel={selectedModel}
                      disabled={forceOverlay}
                      showSearch={false}
                      updateSelectedModel={(m) => {
                        pulseOverlay();
                        resetAllSelections();
                        setSelectedModel(m);
                      }}
                    />

                    <ColorPicker
                      parts={parts}
                      selectedPart={selectedPart}
                      colorsSnapshot={activeColorsSnap}
                      panelKey={`${selectedModel}-drawer`}
                      defaultOpen={true}
                      onResetColors={() => resetColorsForModel(selectedModel)}
                      onPickPart={(p) => updateCurrent(p)}
                      onSetColor={(hex) => {
                        if (!selectedPart) return;
                        setColorForPart(selectedPart, hex);
                      }}
                      onClearSelection={() => updateCurrent(null)}
                    />

                    <button
                      type="button"
                      className="mobile-drawer__clear"
                      onClick={() => {
                        resetAllSelections();
                        pushToast("Selection cleared");
                      }}
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div
              className="hud-right hud-clickable"
              onMouseEnter={() => updateHovered(null)}
              onFocusCapture={() => updateHovered(null)}
            >
              <div className="hud-right__grid">
                <div className="hud-right__assistant">
                  <StyleAssistant
                    disabled={forceOverlay}
                    status={styleStatus}
                    onApplyText={applyStyleText}
                    onClear={() => setStyleStatus("")}
                  />
                </div>

                <div className="hud-right__color">
                  <ColorPicker
                    parts={parts}
                    selectedPart={selectedPart}
                    colorsSnapshot={activeColorsSnap}
                    panelKey={selectedModel}
                    onResetColors={() => resetColorsForModel(selectedModel)}
                    onPickPart={(p) => updateCurrent(p)}
                    onSetColor={(hex) => {
                      if (!selectedPart) return;
                      setColorForPart(selectedPart, hex);
                    }}
                    onClearSelection={() => updateCurrent(null)}
                  />
                </div>

                <div className="hud-right__models">
                  <ModelPicker
                    selectedModel={selectedModel}
                    disabled={forceOverlay}
                    updateSelectedModel={(m) => {
                      pulseOverlay();
                      resetAllSelections();
                      setSelectedModel(m);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
