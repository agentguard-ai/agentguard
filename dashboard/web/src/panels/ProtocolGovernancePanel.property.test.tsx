import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, within, cleanup } from '@testing-library/react';
import fc from 'fast-check';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCachedQuery = vi.fn();

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: (...args: unknown[]) => mockUseCachedQuery(...args),
}));

// Must import AFTER mocks are set up
import { ProtocolGovernancePanel } from './ProtocolGovernancePanel';
import type { GovernanceProtocol } from './ProtocolGovernancePanel';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const protocolArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{0,28}[A-Za-z0-9]$/),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  mode: fc.constantFrom('ENFORCE', 'MONITOR', 'REPORT_ONLY') as fc.Arbitrary<'ENFORCE' | 'MONITOR' | 'REPORT_ONLY'>,
  evaluationsToday: fc.nat(10000),
  denials: fc.nat(1000),
  status: fc.constantFrom('active', 'inactive'),
});

// ─── Setup ───────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('ProtocolGovernancePanel (property-based)', () => {
  // Feature: dashboard-overview-redesign, Property 12: Protocol Card Field Completeness
  // **Validates: Requirements 10.1, 10.3, 10.4, 10.5**
  it('Property 12: For any valid governance protocol, rendered card contains protocol name, mode badge text (ENFORCE/MONITOR/REPORT_ONLY), evaluations count (integer ≥ 0), and denial count (integer ≥ 0)', () => {
    fc.assert(
      fc.property(protocolArb, (protocol: GovernanceProtocol) => {
        // Clean up any previous render
        cleanup();

        mockUseCachedQuery.mockReturnValue({
          data: [protocol],
          isLoading: false,
          error: null,
          invalidate: vi.fn(),
        });

        const { container } = render(<ProtocolGovernancePanel />);

        // Scope all queries to this render's container
        const view = within(container);

        // Find the protocol card
        const card = view.getByTestId('protocol-card');

        // 1. Protocol name is displayed
        const nameEl = within(card).getByTestId('protocol-name');
        expect(nameEl).toBeInTheDocument();
        const renderedName = (nameEl.textContent ?? '').trim();
        // The protocol name should be present in the element
        expect(renderedName).toBe(protocol.name);

        // 2. Mode badge displays the correct mode text (one of ENFORCE, MONITOR, REPORT_ONLY)
        const modeBadge = within(card).getByTestId('protocol-mode-badge');
        expect(modeBadge).toBeInTheDocument();
        const modeText = modeBadge.textContent ?? '';
        const validModes = ['ENFORCE', 'MONITOR', 'REPORT_ONLY'];
        expect(validModes).toContain(modeText);
        expect(modeText).toBe(protocol.mode);

        // 3. Evaluations count is displayed as a non-negative integer
        const evaluationsEl = within(card).getByTestId('protocol-evaluations-count');
        expect(evaluationsEl).toBeInTheDocument();
        const evaluationsText = evaluationsEl.textContent ?? '';
        const evaluationsValue = parseInt(evaluationsText, 10);
        expect(Number.isNaN(evaluationsValue)).toBe(false);
        expect(evaluationsValue).toBeGreaterThanOrEqual(0);
        expect(evaluationsValue).toBe(protocol.evaluationsToday);

        // 4. Denial count is displayed as a non-negative integer
        const denialEl = within(card).getByTestId('protocol-denial-count');
        expect(denialEl).toBeInTheDocument();
        const denialText = denialEl.textContent ?? '';
        // Denial text may contain a warning icon (⚠) prefix; extract numeric portion
        const numericMatch = denialText.match(/\d+/);
        expect(numericMatch).not.toBeNull();
        const denialValue = parseInt(numericMatch![0], 10);
        expect(Number.isNaN(denialValue)).toBe(false);
        expect(denialValue).toBeGreaterThanOrEqual(0);
        expect(denialValue).toBe(protocol.denials);
      }),
      { numRuns: 100 }
    );
  });
});
