import { Context, Service } from '@deepseek-ai/cordis';
import type { ToolExecution } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

vi.mock('tealtiger', () => ({
    TealEngine: class {
        evaluateWithMode() {
            return {
                action: 'ALLOW',
                reason: 'Allowed',
                reason_codes: [],
                risk_score: 0,
                policy_id: 'test-policy',
                policy_version: '1.0.0',
                component_versions: {},
            };
        }
    },

    PIIDetectionGuardrail: class {
        async evaluate(input: string) {
            const detected = input.includes('@');

            return {
                shouldBlock: () => detected,
                riskScore: detected ? 30 : 0,
            };
        }
    },
}));

import { TealTigerHarnessService } from './index';

type TestGuard = (
    execution: Readonly<ToolExecution>,
) => string | undefined;

class TestTools extends Service {
    public guardCallback: TestGuard | undefined;

    constructor(ctx: Context) {
        super(ctx, 'tools');
    }

    guard(callback: TestGuard): () => void {
        this.guardCallback = callback;
        return () => { };
    }
}

function createExecution(argumentsValue: unknown): Readonly<ToolExecution> {
    return {
        callId: 'call-1',
        rootCallId: 'call-1',
        name: 'search',
        arguments: argumentsValue,
        signal: new AbortController().signal,
        token: Symbol('execution'),
    } as unknown as ToolExecution;
}

describe('TealTigerHarnessService', () => {
    it('denies PII in ENFORCE mode without exposing it', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'ENFORCE',
            allowedTools: ['*'],
        });

        const receipt = await service.evaluateTool(
            createExecution({ email: 'person@example.com' }),
        );

        expect(receipt.action).toBe('DENY');
        expect(receipt.reason_code).toContain('PII_DETECTED');
        expect(receipt.reason).not.toContain('person@example.com');

        await ctx.fiber.dispose();
    });
    it('denies secrets in ENFORCE mode', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'ENFORCE',
            allowedTools: ['*'],
        });

        const secret = 'sk-12345678901234567890';
        const receipt = await service.evaluateTool(
            createExecution({ apiKey: secret }),
        );

        expect(receipt.action).toBe('DENY');
        expect(receipt.reason_code).toContain('SECRET_DETECTED');
        expect(receipt.reason).not.toContain(secret);

        await ctx.fiber.dispose();
    });

    it('records violations without denying in MONITOR mode', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'MONITOR',
            allowedTools: ['*'],
        });

        const receipt = await service.evaluateTool(
            createExecution({ email: 'person@example.com' }),
        );

        expect(receipt.action).toBe('ALLOW');
        expect(receipt.reason_code).toContain('PII_DETECTED');
        expect(receipt.reason_code).toContain('MONITOR_MODE_VIOLATION');

        await ctx.fiber.dispose();
    });
    it('skips sensitive-data scanning in REPORT_ONLY mode', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'REPORT_ONLY',
            allowedTools: ['*'],
        });

        const receipt = await service.evaluateTool(
            createExecution({ apiKey: 'sk-12345678901234567890' }),
        );

        expect(receipt.action).toBe('ALLOW');
        expect(receipt.reason_code).not.toContain('SECRET_DETECTED');

        await ctx.fiber.dispose();
    });
    it('preserves a scanner denial in the final guard', async () => {
      const ctx = new Context();
      const tools = new TestTools(ctx);

      const service = new TealTigerHarnessService(ctx, {
          mode: 'ENFORCE',
          allowedTools: ['*'],
      });

      const execution = createExecution({
          apiKey: 'sk-12345678901234567890',
      });

      const receipt = await service.evaluateTool(execution);

      expect(receipt.action).toBe('DENY');
      expect(tools.guardCallback?.(execution)).toBe(receipt.reason);

      await ctx.fiber.dispose();
  });
});