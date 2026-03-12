import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";
import { useSnapshot } from "valtio";

import CanvasErrorBoundary from "../Components/CanvasErrorBoundary";

import "../loading-overlay.css";

import Shoe from "../Components/Shoe";
import Rocket from "../Components/Rocket";
import Axe from "../Components/Axe";
import Insect from "../Components/Insect";
import Teapot from "../Components/Teapot";

import SelectionBar from "../Components/SelectionBar";
import ModelPicker from "../Components/ModelPicker";
import ColorPicker from "../Components/ColorPicker";
import LoadingOverlay from "../Components/LoadingOverlay";
import SceneRig from "../Components/SceneRig";
import OnboardingHint from "../Components/OnboardingHint";
import StyleAssistant from "../Components/StyleAssistant";
import SaveShareButton from "../Components/SaveShareButton";
import ShareLinkButton from "../Components/ShareLinkButton";
import UpdateConfigButton from "../Components/UpdateConfigButton";
import CaptureBridge from "../Components/CaptureBridge";
import VisualSearchModal from "../Components/VisualSearchModal";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { MODEL_PARTS, MODEL_ALIASES } from "../style/models";
import {
  COLOR_MAP,
  normalizeHex,
  resolveNamedColor,
  rgbStringToHex,
} from "../style/colors";
import { parseStyleText } from "../style/parseStyleText";
import { applyAssignments } from "../style/applyAssignments";
import { getModel, normalizeModelDetail } from "../api/models";
import {
  ensureModelColors,
  getDefaultColors,
  setModelMeta,
  store,
} from "../state/store";

const SHOW_HINT_STORAGE_KEY = "p3d_show_hint_v1";
const LEGACY_ONBOARDING_DISMISSED_KEY = "p3d_onboarding_dismissed_v1";

const MODEL_COMPONENTS = {
  shoe: Shoe,
  rocket: Rocket,
  axe: Axe,
  insect: Insect,
  teapot: Teapot,
};

function extractFallbackColor(input) {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;

  const rgbMatch = s.match(/\brgba?\([^)]+\)/i);
  if (rgbMatch) {
    const hex = rgbStringToHex(rgbMatch[0]);
    if (hex) return hex;
  }

  const hex3 = s.match(/#([0-9a-f]{3})\b/i);
  if (hex3) {
    const hex = normalizeHex(`#${hex3[1]}`);
    if (hex) return hex;
  }

  const hex6 = s.match(/(^|[\s,;()[\]{}])#?([0-9a-f]{6})(?=$|[\s,;()[\]{}.!?])/i);
  if (hex6) {
    const hex = normalizeHex(hex6[2]);
    if (hex) return hex;
  }

  const names = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (s.includes(name)) {
      const hex = resolveNamedColor(name, COLOR_MAP);
      if (hex) return hex;
    }
  }

  return null;
}

function formatModelName(id) {
  if (!id) return "";
  const v = String(id);
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export default function MainApp() {
  const snap = useSnapshot(store);
  const location = useLocation();

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
      return true;
    } catch {
      return true;
    }
  });
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [styleStatus, setStyleStatus] = useState("");
  const [visualOpen, setVisualOpen] = useState(false);
  const captureRef = useRef(null);

  const selectedModel = snap.selectedModel;
  const hoveredPart = snap.hoveredPart;
  const selectedPart = snap.selectedPart;

  const modelMeta = snap.modelMetaById?.[selectedModel] || null;
  const modelLabel = modelMeta?.displayName || formatModelName(selectedModel);
  const activeConfig = snap.activeConfig;
  const activeConfigId = snap.activeConfigId || activeConfig?.id || "";
  const wsStatus = snap.ws?.status || "idle";

  const defaultColors = getDefaultColors(selectedModel);
  const baseParts = MODEL_PARTS[selectedModel] || [];
  const metaParts = modelMeta?.parts || [];
  const colorKeys = Object.keys(defaultColors || {});
  const parts = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const p of baseParts) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    for (const p of metaParts) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    for (const p of colorKeys) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    return out;
  }, [baseParts, metaParts, colorKeys]);

  const partLabels = modelMeta?.partLabels || {};
  const aliasMap = {
    ...(MODEL_ALIASES[selectedModel] || {}),
    ...(modelMeta?.aliases || {}),
  };

  const styleExamples = useMemo(() => {
    switch (selectedModel) {
      case "rocket":
        return [
          { label: "hull silver, top red, wings black", value: "hull silver, top red, wings black" },
          { label: "base gray, window light blue", value: "base gray, window light blue" },
          { label: "wings white", value: "wings white" },
        ];
      case "axe":
        return [
          { label: "design silver, body brown", value: "design silver, body brown" },
          { label: "support black, inner gray", value: "support black, inner gray" },
          { label: "blade silver, handle brown", value: "blade silver, handle brown" },
        ];
      case "insect":
        return [
          { label: "shell green, body black", value: "shell green, body black" },
          { label: "shell teal, body dark gray", value: "shell teal, body dark gray" },
          { label: "body blue", value: "body blue" },
        ];
      case "teapot":
        return [
          { label: "lid white, base blue", value: "lid white, base blue" },
          { label: "base red", value: "base red" },
          { label: "top white", value: "top white" },
        ];
      default:
        return [
          { label: "laces black, mesh white, stripes red", value: "laces black, mesh white, stripes red" },
          { label: "bottom grey and inside light blue", value: "bottom grey and inside light blue" },
          { label: "stealth: laces black, mesh dark grey, stripes white", value: "stealth: laces black, mesh dark grey, stripes white" },
        ];
    }
  }, [selectedModel]);

  const stylePlaceholder = useMemo(() => {
    if (parts.length > 0) {
      const sample = parts.slice(0, 3).join(", ");
      return `e.g. "${sample} red"`;
    }
    return 'e.g. "Make the laces black, mesh white, stripes red"';
  }, [parts]);

  const validPartsSet = useMemo(() => new Set(parts), [parts]);

  useEffect(() => {
    setStyleStatus("");
  }, [selectedModel]);

  useEffect(() => {
    if (!location.pathname.startsWith("/c/")) {
      store.activeConfigId = null;
      store.activeConfig = null;
    }
  }, [location.pathname]);

  const showUpdate =
    !!activeConfig?.id && location.pathname.startsWith("/c/");

  const ActiveModel = useMemo(
    () => MODEL_COMPONENTS[selectedModel] ?? Shoe,
    [selectedModel]
  );

  const activeColorsProxy = store.colors[selectedModel] ?? store.colors.shoe;
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
    const name = String(modelName || "");
    if (!name) return;
    store.selectedModel = name;
    ensureModelColors(name, getDefaultColors(name));
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

  const setColorForPart = useCallback(
    (partKey, hex) => {
      const colorsProxy = store.colors[store.selectedModel];
      if (!colorsProxy) return;
      if (!partKey) return;
      if (validPartsSet.size > 0 && !validPartsSet.has(partKey)) return;
      colorsProxy[partKey] = hex;
    },
    [validPartsSet]
  );

  const resetColorsForModel = useCallback(
    (modelName) => {
      const name = String(modelName ?? "");
      const defaults = getDefaultColors(name);
      const colorsProxy = store.colors[name];
      if (!colorsProxy) return;

      const effectiveDefaults =
        Object.keys(defaults).length > 0
          ? defaults
          : { ...colorsProxy };

      const defaultKeys = new Set(Object.keys(effectiveDefaults));
      for (const k of Object.keys(colorsProxy)) {
        if (!defaultKeys.has(k)) delete colorsProxy[k];
      }

      for (const partKey of Object.keys(effectiveDefaults)) {
        colorsProxy[partKey] = effectiveDefaults[partKey];
      }

      pushToast("Colors reset");
    },
    [pushToast]
  );

  const handleClearSelection = useCallback(() => {
    resetAllSelections();
    if (selectedModel) {
      resetColorsForModel(selectedModel);
    }
  }, [resetAllSelections, resetColorsForModel, selectedModel]);

  const toggleHint = useCallback(() => {
    setShowHint((prev) => {
      const next = !prev;
      pushToast(`Hints: ${next ? "ON" : "OFF"}`);
      return next;
    });
  }, [pushToast]);

  const applyStyleText = useCallback(
    (text) => {
      const validParts = parts ?? [];

      const t = String(text ?? "");
      const { assignments, unknownParts, unknownColors, matchedPartsInOrder } =
        parseStyleText(t, { validParts, aliasMap, colorMap: COLOR_MAP });

      const applied = Object.keys(assignments);
      const lastMatchedPart =
        matchedPartsInOrder.length > 0
          ? matchedPartsInOrder[matchedPartsInOrder.length - 1]
          : null;

      if (applied.length === 0) {
        const fallbackColor =
          selectedPart && t.trim() ? extractFallbackColor(t) : null;
        if (fallbackColor && selectedPart) {
          applyAssignments({
            store,
            modelName: selectedModel,
            assignments: { [selectedPart]: fallbackColor },
            selectPart: selectedPart,
          });
          const msg = `Applied: ${selectedPart}`;
          setStyleStatus(msg);
          pushToast(msg);
          return;
        }

        const fallbackAll =
          !selectedPart && t.trim() ? extractFallbackColor(t) : null;
        if (fallbackAll && validParts.length > 0) {
          const allAssignments = {};
          for (const partKey of validParts) {
            if (!partKey) continue;
            allAssignments[partKey] = fallbackAll;
          }
          applyAssignments({
            store,
            modelName: selectedModel,
            assignments: allAssignments,
            selectPart: validParts[0] ?? null,
          });
          const msg = "Applied: all parts";
          setStyleStatus(msg);
          pushToast(msg);
          return;
        }

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
    [aliasMap, parts, pushToast, selectedModel, selectedPart]
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

  const fetchTokenRef = useRef(0);
  useEffect(() => {
    if (!selectedModel) return;

    const existing = store.modelMetaById?.[selectedModel];
    if (existing) {
      ensureModelColors(selectedModel, getDefaultColors(selectedModel));
      return;
    }

    const controller = new AbortController();
    const token = ++fetchTokenRef.current;
    store.status.isLoadingModel = true;

    getModel(selectedModel, { signal: controller.signal })
      .then((res) => {
        if (token !== fetchTokenRef.current) return;
        const meta = normalizeModelDetail(res?.model);
        if (meta) {
          setModelMeta(selectedModel, meta);
        }
        ensureModelColors(selectedModel, getDefaultColors(selectedModel));
      })
      .catch((err) => {
        if (token !== fetchTokenRef.current) return;
        if (err?.name === "AbortError") return;
        pushToast(err?.message || "Failed to load model");
      })
      .finally(() => {
        if (token === fetchTokenRef.current) {
          store.status.isLoadingModel = false;
        }
      });

    return () => controller.abort();
  }, [pushToast, selectedModel]);

  return (
    <div className="app-root">
      <div data-testid="colors-json" style={{ display: "none" }}>
        {JSON.stringify(activeColorsSnap || {})}
      </div>
      <LoadingOverlay forceActive={forceOverlay} />

      <div className="app-container">
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
                debug={selectedModel === "rocket"}
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
                    onHover={updateHovered}
                    updateHovered={updateHovered}
                    updateCurrent={updateCurrent}
                  />
                </Float>
              </SceneRig>
            </Suspense>

            <OrbitControls ref={orbitRef} enableDamping dampingFactor={0.08} />
            <CaptureBridge
              onReady={(fn) => {
                captureRef.current = fn;
              }}
            />
          </Canvas>
        </CanvasErrorBoundary>

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
              modelName={modelLabel}
              current={selectedPart}
              labels={partLabels}
              onResetView={handleResetView}
              onClear={handleClearSelection}
              wsStatus={wsStatus}
              actions={
                <>
                  <SaveShareButton
                    modelId={selectedModel}
                    colors={activeColorsSnap}
                    disabled={forceOverlay}
                    onToast={pushToast}
                  />
                  <button
                    type="button"
                    className="selection-bar__btn selection-bar__btn--ghost"
                    onClick={() => setVisualOpen(true)}
                    disabled={forceOverlay}
                    title="Find similar products online"
                  >
                    Find similar online
                  </button>
                  <ShareLinkButton disabled={forceOverlay} />
                  {showUpdate ? (
                    <UpdateConfigButton
                      config={activeConfig}
                      modelId={selectedModel}
                      colors={activeColorsSnap}
                      disabled={forceOverlay}
                      onToast={pushToast}
                    />
                  ) : null}
                </>
              }
            />
          </div>

          <div
            className="hud-bottom-left hud-clickable"
            onMouseEnter={() => updateHovered(null)}
            onFocusCapture={() => updateHovered(null)}
          >
            <OnboardingHint open={showHint} onDismiss={() => setShowHint(false)} />
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
                      examples={styleExamples}
                      placeholder={stylePlaceholder}
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
                      labels={partLabels}
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
                    />
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
                    examples={styleExamples}
                    placeholder={stylePlaceholder}
                  />
                </div>

                <div className="hud-right__color">
                  <ColorPicker
                    parts={parts}
                    labels={partLabels}
                    selectedPart={selectedPart}
                    colorsSnapshot={activeColorsSnap}
                    panelKey={selectedModel}
                    onResetColors={() => resetColorsForModel(selectedModel)}
                    onPickPart={(p) => updateCurrent(p)}
                    onSetColor={(hex) => {
                      if (!selectedPart) return;
                      setColorForPart(selectedPart, hex);
                    }}
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

      <VisualSearchModal
        open={visualOpen}
        onClose={() => setVisualOpen(false)}
        capturePng={captureRef.current}
        configId={activeConfigId}
      />
    </div>
  );
}
