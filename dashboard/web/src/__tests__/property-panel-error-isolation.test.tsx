/**
 * Property 8: Panel error isolation
 *
 * For any panel that throws a render error, all other panels in the dashboard
 * SHALL continue to render their content normally, and the errored panel SHALL
 * display an error boundary fallback with a retry action.
 *
 * **Validates: Requirements 11.2, 11.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, within } from '@testing-library/react';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';

// ─── Suppress console.error from error boundaries during tests ───────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

// ─── Test Panel Component ────────────────────────────────────────────────────

/**
 * A panel component that conditionally throws based on the shouldThrow prop.
 * Non-throwing panels render identifiable content via data-testid.
 */
function TestPanel({ shouldThrow, id }: { shouldThrow: boolean; id: string }) {
  if (shouldThrow) {
    throw new Error(`Simulated error in panel ${id}`);
  }
  return <div data-testid={`panel-content-${id}`}>Content of panel {id}</div>;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate panel names that are safe for DOM rendering and unique enough
 * to use in test assertions.
 */
const panelNameArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0);

/**
 * Generate an array of panel configurations.
 * Each panel has a name and a shouldThrow flag.
 * We constrain that at least one panel throws and at least one doesn't,
 * which is the interesting scenario for error isolation.
 */
const panelConfigsArb = fc
  .array(
    fc.record({
      name: panelNameArb,
      shouldThrow: fc.boolean(),
    }),
    { minLength: 2, maxLength: 8 }
  )
  .filter(
    (panels) =>
      panels.some((p) => p.shouldThrow) && panels.some((p) => !p.shouldThrow)
  );

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 8: Panel error isolation', () => {
  it('errored panels show error boundary fallback while other panels render normally', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(panelConfigsArb, (panels) => {
        const { unmount, container } = render(
          <div data-testid="dashboard-container">
            {panels.map((panel, i) => (
              <PanelErrorBoundary key={i} panelName={panel.name}>
                <TestPanel shouldThrow={panel.shouldThrow} id={`${i}`} />
              </PanelErrorBoundary>
            ))}
          </div>
        );

        const throwingIndices = panels
          .map((p, i) => (p.shouldThrow ? i : -1))
          .filter((i) => i !== -1);
        const nonThrowingIndices = panels
          .map((p, i) => (!p.shouldThrow ? i : -1))
          .filter((i) => i !== -1);

        // ── Verify errored panels show fallback UI ────────────────────────

        // Each errored panel should render the error boundary fallback
        const errorBoundaries = screen.getAllByTestId('panel-error-boundary');
        expect(errorBoundaries).toHaveLength(throwingIndices.length);

        // Each errored panel should have a retry button
        const retryButtons = screen.getAllByRole('button', { name: /retry/i });
        expect(retryButtons).toHaveLength(throwingIndices.length);

        // Each error boundary should show "Panel unavailable" text
        errorBoundaries.forEach((boundary) => {
          expect(within(boundary).getByText('Panel unavailable')).toBeInTheDocument();
        });

        // ── Verify non-throwing panels render their content normally ──────

        nonThrowingIndices.forEach((i) => {
          const panelContent = screen.getByTestId(`panel-content-${i}`);
          expect(panelContent).toBeInTheDocument();
          expect(panelContent).toHaveTextContent(`Content of panel ${i}`);
        });

        // ── Verify throwing panels do NOT render their content ────────────

        throwingIndices.forEach((i) => {
          expect(screen.queryByTestId(`panel-content-${i}`)).not.toBeInTheDocument();
        });

        // Clean up to avoid state leaking between iterations
        unmount();
      }),
      { numRuns: 50 }
    );
  });
});
