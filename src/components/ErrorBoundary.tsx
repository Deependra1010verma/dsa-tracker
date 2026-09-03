import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary-shell">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p className="error-boundary-msg">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <div className="error-boundary-actions">
              <button
                className="primary-btn"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Reload app
              </button>
              <button
                className="secondary-btn"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try to recover
              </button>
            </div>
            {this.state.error?.stack ? (
              <details className="error-boundary-stack">
                <summary>Stack trace</summary>
                <pre>{this.state.error.stack}</pre>
              </details>
            ) : null}
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
