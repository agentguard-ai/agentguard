'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

// ─── Props & State ───────────────────────────────────────────────────────────

interface PanelErrorBoundaryProps {
  /** The panel content to render */
  children: ReactNode;
  /** Identifier for which panel this boundary wraps (used in fallback UI) */
  panelName: string;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * PanelErrorBoundary — React Error Boundary that wraps individual dashboard panels.
 *
 * When a render error occurs in a panel, this boundary:
 * - Catches the error (prevents crashing other panels)
 * - Displays a "Panel unavailable" fallback UI with the panel name
 * - Provides a "Retry" button to reset error state and re-attempt rendering
 * - Logs the error to console for debugging
 *
 * Each panel is wrapped independently so that one panel failure
 * does not affect the others.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */
export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[PanelErrorBoundary] Error in panel "${this.props.panelName}":`,
      error,
      errorInfo.componentStack
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="panel flex min-h-[200px] flex-col"
          role="region"
          aria-label={`${this.props.panelName} - Error`}
          data-testid="panel-error-boundary"
        >
          <div className="panel-header">
            <span>{this.props.panelName}</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="text-center">
              <p
                className="text-sm font-medium text-[var(--color-danger)]"
                role="alert"
              >
                Panel unavailable
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                An error occurred while rendering this panel.
              </p>
              {this.state.error?.message && (
                <p className="mt-1 max-w-[280px] truncate text-xs text-[var(--color-text-tertiary)]" title={this.state.error.message}>
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleRetry}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
              aria-label={`Retry loading ${this.props.panelName}`}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PanelErrorBoundary;
