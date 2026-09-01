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

import {
    apply,
    TealTigerHarnessService,
    type TealTigerReceipt,
} from './index';

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
    it('accumulates costs and denies calls over the session budget', async () => {
        const ctx = new Context();
        const tools = new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'ENFORCE',
            allowedTools: ['*'],
            sessionBudgetUsd: 0.15,
            defaultToolCostUsd: 0.01,
            toolCostsUsd: {
                search: 0.1,
            },
        });

        const firstExecution = createExecution({ query: 'first' });
        const firstReceipt = await service.evaluateTool(firstExecution);

        expect(firstReceipt.action).toBe('ALLOW');
        expect(firstReceipt.cost.estimated_call_usd).toBe(0.1);
        expect(firstReceipt.cost.session_total_usd).toBe(0.1);
        expect(firstReceipt.cost.session_limit_usd).toBe(0.15);

        const secondExecution = createExecution({ query: 'second' });
        const secondReceipt = await service.evaluateTool(secondExecution);

        expect(secondReceipt.action).toBe('DENY');
        expect(secondReceipt.reason_code).toContain('BUDGET_EXCEEDED');

        // The denied call must not consume more budget.
        expect(secondReceipt.cost.session_total_usd).toBe(0.1);

        // The final Harness guard must preserve the denial.
        expect(tools.guardCallback?.(secondExecution)).toBe(
            secondReceipt.reason,
        );

        await ctx.fiber.dispose();
    });
    it('reports an exceeded budget without denying in MONITOR mode', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'MONITOR',
            allowedTools: ['*'],
            sessionBudgetUsd: 0.05,
            defaultToolCostUsd: 0.1,
        });

        const receipt = await service.evaluateTool(
            createExecution({ query: 'allowed but reported' }),
        );

        expect(receipt.action).toBe('ALLOW');
        expect(receipt.reason_code).toContain('BUDGET_EXCEEDED');
        expect(receipt.reason_code).toContain('MONITOR_MODE_VIOLATION');
        expect(receipt.cost.session_total_usd).toBe(0.1);

        await ctx.fiber.dispose();
    });
    it('requires a default tool cost when a budget is configured', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        expect(
            () =>
                new TealTigerHarnessService(ctx, {
                    sessionBudgetUsd: 1,
                }),
        ).toThrow(
            'defaultToolCostUsd is required when sessionBudgetUsd is configured',
        );

        await ctx.fiber.dispose();
    });
    it('rejects duplicate tool names after trimming whitespace', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        expect(
            () =>
                new TealTigerHarnessService(ctx, {
                    allowedTools: ['search', ' search '],
                }),
        ).toThrow('duplicate tool name "search"');

        await ctx.fiber.dispose();
    });
    it('rejects negative tool costs', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        expect(
            () =>
                new TealTigerHarnessService(ctx, {
                    defaultToolCostUsd: -0.01,
                }),
        ).toThrow();

        await ctx.fiber.dispose();
    });
    it('creates immutable governance receipts', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const service = new TealTigerHarnessService(ctx, {
            mode: 'ENFORCE',
            allowedTools: ['*'],
        });

        const receipt = await service.evaluateTool(
            createExecution({ query: 'safe' }),
        );

        expect(Object.isFrozen(receipt)).toBe(true);
        expect(Object.isFrozen(receipt.reason_code)).toBe(true);
        expect(Object.isFrozen(receipt.component_versions)).toBe(true);
        expect(Object.isFrozen(receipt.cost)).toBe(true);

        await ctx.fiber.dispose();
    });
    it('emits a sanitized receipt before denying execution', async () => {
        const ctx = new Context();
        new TestTools(ctx);

        const receipts: TealTigerReceipt[] = [];

        ctx.on('tealtiger/decision', (receipt) => {
            receipts.push(receipt);
        });

        apply(ctx, {
            mode: 'ENFORCE',
            allowedTools: ['*'],
        });

        const secret = 'sk-12345678901234567890';
        const execution = createExecution({ apiKey: secret });

        const decision = await ctx.waterfall(
            'tools/pre-execute',
            execution,
            () => Promise.resolve({ kind: 'allow' as const }),
        );

        expect(decision.kind).toBe('deny');
        expect(receipts).toHaveLength(1);
        expect(receipts[0]?.action).toBe('DENY');
        expect(receipts[0]?.reason_code).toContain('SECRET_DETECTED');

        // Audit data must never contain the detected secret.
        expect(JSON.stringify(receipts[0])).not.toContain(secret);

        await ctx.fiber.dispose();
    });
});