import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelErrorBoundary } from './PanelErrorBoundary';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** A component that throws on render (simulates a panel crash) */
function ThrowingPanel({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Panel render error');
  }
  return <div data-testid="working-panel">Panel content</div>;
}

/** A normal panel that renders successfully */
function WorkingPanel() {
  return <div data-testid="working-panel">Panel content</div>;
}

// Suppress React error boundary console.error noise during tests
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PanelErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <PanelErrorBoundary panelName="Test Panel">
        <WorkingPanel />
      </PanelErrorBoundary>
    );

    expect(screen.getByTestId('working-panel')).toBeInTheDocument();
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('catches render errors and shows "Panel unavailable" fallback', () => {
    render(
      <PanelErrorBoundary panelName="Pipeline Status">
        <ThrowingPanel />
      </PanelErrorBoundary>
    );

    // Should show the fallback UI
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('An error occurred while rendering this panel.')).toBeInTheDocument();
    // Should show the panel name in the header
    expect(screen.getByText('Pipeline Status')).toBeInTheDocument();
    // Should show a retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // Original panel content should not be visible
    expect(screen.queryByTestId('working-panel')).not.toBeInTheDocument();
  });

  it('displays the panel name in the fallback header', () => {
    render(
      <PanelErrorBoundary panelName="Cost Tracker">
        <ThrowingPanel />
      </PanelErrorBoundary>
    );

    expect(screen.getByText('Cost Tracker')).toBeInTheDocument();
  });

  it('retry button resets error state and re-attempts rendering', () => {
    // Use a stateful wrapper to control whether ThrowingPanel throws
    let shouldThrow = true;

    function ConditionalPanel() {
      if (shouldThrow) {
        throw new Error('Panel render error');
      }
      return <div data-testid="recovered-panel">Recovered content</div>;
    }

    const { rerender } = render(
      <PanelErrorBoundary panelName="Test Panel">
        <ConditionalPanel />
      </PanelErrorBoundary>
    );

    // Initially should show the error fallback
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();

    // Fix the issue (stop throwing)
    shouldThrow = false;

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    // After retry, should render the recovered panel
    expect(screen.getByTestId('recovered-panel')).toBeInTheDocument();
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByText('Panel unavailable')).not.toBeInTheDocument();
  });

  it('other panels remain functional when one fails', () => {
    render(
      <div>
        <PanelErrorBoundary panelName="Broken Panel">
          <ThrowingPanel />
        </PanelErrorBoundary>
        <PanelErrorBoundary panelName="Healthy Panel">
          <WorkingPanel />
        </PanelErrorBoundary>
      </div>
    );

    // Broken panel shows error fallback
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('Broken Panel')).toBeInTheDocument();

    // Healthy panel still renders its children successfully
    expect(screen.getByTestId('working-panel')).toBeInTheDocument();
    expect(screen.getByText('Panel content')).toBeInTheDocument();

    // Only one "Panel unavailable" message should exist (from the broken panel only)
    expect(screen.getAllByText('Panel unavailable')).toHaveLength(1);
  });

  it('logs the error to console for debugging', () => {
    render(
      <PanelErrorBoundary panelName="Debug Panel">
        <ThrowingPanel />
      </PanelErrorBoundary>
    );

    // console.error should have been called with boundary context
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PanelErrorBoundary] Error in panel "Debug Panel"'),
      expect.any(Error),
      expect.anything()
    );
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(
      <PanelErrorBoundary panelName="Accessible Panel">
        <ThrowingPanel />
      </PanelErrorBoundary>
    );

    // Error region should have proper label
    expect(screen.getByRole('region', { name: 'Accessible Panel - Error' })).toBeInTheDocument();
    // Error message should have alert role
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Retry button should have proper aria-label
    expect(screen.getByRole('button', { name: 'Retry loading Accessible Panel' })).toBeInTheDocument();
  });

  it('has data-testid on the error fallback wrapper', () => {
    render(
      <PanelErrorBoundary panelName="Testable Panel">
        <ThrowingPanel />
      </PanelErrorBoundary>
    );

    expect(screen.getByTestId('panel-error-boundary')).toBeInTheDocument();
  });

  it('displays the actual error message text in the fallback', () => {
    render(
      <PanelErrorBoundary panelName="Error Detail Panel">
        <ThrowingPanel />
      </PanelErrorBoundary>
    );

    // The error message from ThrowingPanel is "Panel render error"
    expect(screen.getByText('Panel render error')).toBeInTheDocument();
    // Should also have title attribute for full message on hover
    expect(screen.getByTitle('Panel render error')).toBeInTheDocument();
  });
});
