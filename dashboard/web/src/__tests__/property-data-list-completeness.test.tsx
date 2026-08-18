/**
 * Property 7: Data list rendering completeness
 *
 * For any non-empty array of data items passed to a list-rendering panel
 * (pipeline stages, canary events, routing entries, protocol cards),
 * every item in the array SHALL produce a corresponding rendered element
 * containing all required fields for that panel type.
 *
 * **Validates: Requirements 4.4, 6.2, 6.3, 7.2, 7.3, 7.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';

// ─── Mock useCachedQuery ─────────────────────────────────────────────────────

let mockData: unknown = null;

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: () => ({
    data: mockData,
    isLoading: false,
    error: null,
    invalidate: vi.fn(),
  }),
}));

// ─── Import components after mock ────────────────────────────────────────────

import { DefensePipelineFlow } from '@/panels/DefensePipelineFlow';
import type { PipelineStage } from '@/panels/DefensePipelineFlow';
import { CanaryAlertsPanel } from '@/panels/CanaryAlertsPanel';
import type { CanaryEvent } from '@/panels/CanaryAlertsPanel';
import { ModelRoutingPanel } from '@/panels/ModelRoutingPanel';
import type { RoutingEntry } from '@/panels/ModelRoutingPanel';
import { ProtocolGovernancePanel } from '@/panels/ProtocolGovernancePanel';
import type { GovernanceProtocol } from '@/panels/ProtocolGovernancePanel';

// ─── Suppress console.error from error boundaries during tests ───────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  cleanup();
});

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Arbitrary for non-empty alphanumeric strings, used for names and descriptions.
 */
const nameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -'.split('')), {
    minLength: 1,
    maxLength: 30,
  })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for model name strings (e.g., "gpt-4", "claude-3-sonnet").
 */
const modelNameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_.'.split('')), {
    minLength: 3,
    maxLength: 25,
  })
  .filter((s) => s.trim().length >= 3);

/** Positive integer for counts */
const positiveInt = fc.integer({ min: 0, max: 99999 });

/** Positive float for dollar amounts */
const positiveFloat = fc.double({ min: 0.0001, max: 1000, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for PipelineStage: name, tokenRange, and metrics.
 */
const pipelineStageArb: fc.Arbitrary<PipelineStage> = fc.record({
  name: nameArb,
  tokenRange: fc.record({
    min: fc.integer({ min: 1, max: 5000 }),
    max: fc.integer({ min: 5001, max: 100000 }),
  }),
  metrics: fc.dictionary(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 3, maxLength: 12 }),
    fc.integer({ min: 0, max: 10000 }),
    { minKeys: 0, maxKeys: 4 }
  ),
});

/**
 * Arbitrary for CanaryEvent: agentName, description, isFrozen, timestamp.
 */
const canaryEventArb: fc.Arbitrary<CanaryEvent> = fc.record({
  agentName: nameArb,
  description: nameArb,
  isFrozen: fc.boolean(),
  timestamp: fc.integer({ min: 1700000000000, max: 1800000000000 }),
});

/**
 * Arbitrary for RoutingEntry: sourceModel, targetModel, perRequestSavings.
 */
const routingEntryArb: fc.Arbitrary<RoutingEntry> = fc.record({
  sourceModel: modelNameArb,
  targetModel: modelNameArb,
  perRequestSavings: positiveFloat,
});

/**
 * Arbitrary for GovernanceProtocol: id, name, description, mode, evaluationsToday, denials, status.
 */
const protocolCardArb: fc.Arbitrary<GovernanceProtocol> = fc.record({
  id: fc.uuid(),
  name: nameArb,
  description: nameArb,
  mode: fc.constantFrom('ENFORCE' as const, 'MONITOR' as const, 'REPORT_ONLY' as const),
  evaluationsToday: positiveInt,
  denials: positiveInt,
  status: fc.constantFrom('active', 'inactive'),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 7: Data list rendering completeness', { timeout: 60000 }, () => {
  describe('DefensePipelineFlow — pipeline stages', () => {
    it('renders one stage card per pipeline stage with name and token range', () => {
      fc.assert(
        fc.property(
          fc.array(pipelineStageArb, { minLength: 1, maxLength: 20 }),
          (stages) => {
            mockData = { stages, connections: [] };
            cleanup();

            render(<DefensePipelineFlow />);

            // Every stage produces a rendered card
            const stageCards = screen.getAllByTestId('pipeline-stage-card');
            expect(stageCards).toHaveLength(stages.length);

            // Each card contains its stage name as text content
            stageCards.forEach((card, i) => {
              expect(card.textContent).toContain(stages[i].name);
            });

            // Each card contains a token range element
            const tokenRanges = screen.getAllByTestId('token-range');
            expect(tokenRanges).toHaveLength(stages.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('CanaryAlertsPanel — canary events', () => {
    it('renders one event item per canary event with agent name, description, and freeze status', () => {
      fc.assert(
        fc.property(
          fc.array(canaryEventArb, { minLength: 1, maxLength: 20 }),
          (events) => {
            mockData = events;
            cleanup();

            render(<CanaryAlertsPanel />);

            // Every event produces a rendered list item
            const eventItems = screen.getAllByTestId('canary-event-item');
            expect(eventItems).toHaveLength(events.length);

            // Each event has an agent name element
            const agentNames = screen.getAllByTestId('canary-event-agent');
            expect(agentNames).toHaveLength(events.length);

            // Each event has a description element
            const descriptions = screen.getAllByTestId('canary-event-description');
            expect(descriptions).toHaveLength(events.length);

            // Each event has a freeze status indicator (either frozen or active)
            const frozenCount = events.filter((e) => e.isFrozen).length;
            const activeCount = events.length - frozenCount;

            const frozenIndicators = screen.queryAllByTestId('freeze-status-frozen');
            const activeIndicators = screen.queryAllByTestId('freeze-status-active');

            expect(frozenIndicators).toHaveLength(frozenCount);
            expect(activeIndicators).toHaveLength(activeCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ModelRoutingPanel — routing entries', () => {
    it('renders one table row per routing entry with source, target, and savings', () => {
      fc.assert(
        fc.property(
          fc.array(routingEntryArb, { minLength: 1, maxLength: 20 }),
          (entries) => {
            mockData = entries;
            cleanup();

            render(<ModelRoutingPanel />);

            // Every entry produces a rendered table row
            const routingRows = screen.getAllByTestId('routing-entry');
            expect(routingRows).toHaveLength(entries.length);

            // Each row has source model, target model, and savings cells
            const sourceModels = screen.getAllByTestId('routing-source-model');
            expect(sourceModels).toHaveLength(entries.length);

            const targetModels = screen.getAllByTestId('routing-target-model');
            expect(targetModels).toHaveLength(entries.length);

            const savings = screen.getAllByTestId('routing-savings');
            expect(savings).toHaveLength(entries.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ProtocolGovernancePanel — protocol cards', () => {
    it('renders one protocol card per entry with name, mode badge, evaluations count, and denial count', () => {
      fc.assert(
        fc.property(
          fc.array(protocolCardArb, { minLength: 1, maxLength: 20 }),
          (protocols) => {
            mockData = protocols;
            cleanup();

            render(<ProtocolGovernancePanel />);

            // Every protocol produces a rendered card
            const protocolCards = screen.getAllByTestId('protocol-card');
            expect(protocolCards).toHaveLength(protocols.length);

            // Each card has a name element
            const names = screen.getAllByTestId('protocol-name');
            expect(names).toHaveLength(protocols.length);

            // Each card has a mode badge
            const modeBadges = screen.getAllByTestId('protocol-mode-badge');
            expect(modeBadges).toHaveLength(protocols.length);

            // Each card has evaluations count and denial count
            const evaluationsCounts = screen.getAllByTestId('protocol-evaluations-count');
            expect(evaluationsCounts).toHaveLength(protocols.length);

            const denialCounts = screen.getAllByTestId('protocol-denial-count');
            expect(denialCounts).toHaveLength(protocols.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
