import { describe, expect, it } from 'vitest';
import { PIIDetectionGuardrail, TealEngine } from 'tealtiger';

describe('tealtiger smoke capabilities', () => {
  it('import and construct the real SDK exports', async () => {
    const engine = new TealEngine({
      tools: {
        smoke_test: {
          allowed: true,
        },
      },
    });
    const guardrail = new PIIDetectionGuardrail({
      action: 'block',
    });
    const result = await guardrail.evaluate('Contact person@example.com');

    expect(engine).toBeInstanceOf(TealEngine);
    expect(guardrail).toBeInstanceOf(PIIDetectionGuardrail);
    expect(typeof result.shouldBlock).toBe('function');
    expect(result.shouldBlock()).toBe(true);
    expect(result.riskScore).toBeGreaterThan(0);
  });
});
