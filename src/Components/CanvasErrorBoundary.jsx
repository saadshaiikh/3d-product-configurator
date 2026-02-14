import React from "react";

export default class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    // Allow the app to recover without a full reload when switching models, etc.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    // Helpful for debugging in DevTools
    console.error("Canvas crashed:", error);
    console.error("Component stack:", info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.55)",
            color: "white",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div style={{ maxWidth: 820, width: "100%", background: "#111", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>3D Canvas crashed</div>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, lineHeight: 1.4 }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
              Check DevTools Console for the full stack trace.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
