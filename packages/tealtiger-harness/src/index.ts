import { Service, type Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { PreToolDecision, ToolExecution } from "@deepseek-ai/dsh-tools";
import { PIIDetectionGuardrail, TealEngine } from 'tealtiger'
import type { Decision, PolicyMode, TealPolicy } from 'tealtiger'

export const name = 'tealtiger-harness';
export const inject = ['tools'];

const USD_SCALE = 1_000_000;
const MAX_USD = Number.MAX_SAFE_INTEGER / USD_SCALE;
const TEEC_VERSION = '2.0.0';
const SECRET_PATTERNS = [
    /\bsk-[a-zA-Z0-9]{20,}\b/,
    /\bghp_[a-zA-Z0-9]{36,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgsk_[a-zA-Z0-9]{20,}\b/,
    /\bAIza[0-9A-Za-z_-]{35}\b/,
] as const;


export type GovernanceMode = 'ENFORCE' | 'MONITOR' | 'REPORT_ONLY';

export type GovernanceAction = 'ALLOW' | 'DENY';

export interface TealTigerReceipt {
    readonly teec_version: typeof TEEC_VERSION;
    readonly event_type: 'tool/governance-decision';
    readonly timestamp: string;
    readonly correlation_id: string;
    readonly agent_id: string;
    readonly session_id: string;
    readonly tool_name: string;
    readonly action: GovernanceAction;
    readonly mode: GovernanceMode;
    readonly reason: string;
    readonly reason_code: readonly string[];
    readonly risk_score: number;
    readonly policy_id: string;
    readonly policy_version: string;
    readonly component_versions: Readonly<Decision['component_versions']>;
    readonly cost: Readonly<{
        currency: 'USD';
        estimated_call_usd?: number;
        session_total_usd: number;
        session_limit_usd?: number;
    }>;
}

export interface Config {
    mode?: GovernanceMode;
    allowedTools?: string[];
    frozenTools?: string[];
    piiDetection?: boolean;
    secretDetection?: boolean;
    sessionBudgetUsd?: number;
    defaultToolCostUsd?: number;
    toolCostsUsd?: Record<string, number>;
}

export const Config: z<Config> = z.object({
    mode: z.union(['ENFORCE', 'MONITOR', 'REPORT_ONLY']).default('ENFORCE'),
    allowedTools: z.array(z.string()).default([]),
    frozenTools: z.array(z.string()).default([]),
    piiDetection: z.boolean().default(true),
    secretDetection: z.boolean().default(true),
    sessionBudgetUsd: z.number().min(0).max(MAX_USD),
    defaultToolCostUsd: z.number().min(0).max(MAX_USD),
    toolCostsUsd: z.dict(z.number().min(0).max(MAX_USD)).default({}),
})

declare module "@deepseek-ai/cordis" {
    interface Context {
        tealtiger: TealTigerHarnessService;
    }
    interface Events {
        'tealtiger/decision'(receipt: TealTigerReceipt): void;
    }
}

function normalizeToolNames(values: readonly string[], fieldName: string): ReadonlySet<string> {
    const names = new Set<string>();
    for (const value of values) {
        const name = value.trim();

        if (name.length === 0) {
            throw new Error(`Invalid ${fieldName}: tool name cannot be empty`);
        }
        if (names.has(name)) {
            throw new Error(`Invalid ${fieldName}: duplicate tool name "${name}"`);
        }
        names.add(name);
    }
    return names;
}

interface ResolvedConfig {
    readonly mode: GovernanceMode;
    readonly allowedTools: ReadonlySet<string>;
    readonly frozenTools: ReadonlySet<string>;
    readonly piiDetection: boolean;
    readonly secretDetection: boolean;
    readonly sessionBudgetMicroUsd?: number;
    readonly defaultToolCostMicroUsd?: number;
    readonly toolCostsMicroUsd: ReadonlyMap<string, number>;
}

function createToolPolicy(config: ResolvedConfig): TealPolicy {
    const tools: NonNullable<TealPolicy['tools']> = {};
    for (const toolName of config.allowedTools) {
        tools[toolName] = {
            allowed: true,
        }
    }

    for (const toolName of config.frozenTools) {
        tools[toolName] = {
            allowed: false,
        }
    }
    return { tools }
}

function toMicroUsd(value: number): number {
    return Math.round(value * USD_SCALE);
}

function fromMicroUsd(value: number): number {
    return value / USD_SCALE;
}

function serializeArguments(value: unknown): string | undefined {
    try {
        return JSON.stringify(value) ?? '';
    } catch {
        return undefined;
    }
}

function resolveConfig(input: Config): ResolvedConfig {
    const config = Config(input);
    if (config.sessionBudgetUsd !== undefined && config.defaultToolCostUsd === undefined) {
        throw new Error("defaultToolCostUsd is required when sessionBudgetUsd is configured");
    }
    const toolCosts = new Map<string, number>();

    for (const [rawName, cost] of Object.entries(config.toolCostsUsd ?? {})) {
        const name = rawName.trim();
        if (name.length === 0) {
            throw new Error(`Invalid tool cost: tool name cannot be empty`);
        }
        if (toolCosts.has(name)) {
            throw new Error(`Invalid tool cost: duplicate tool name "${name}"`);
        }
        toolCosts.set(name, toMicroUsd(cost));
    }
    return Object.freeze({
        mode: config.mode ?? 'ENFORCE',
        allowedTools: normalizeToolNames(config.allowedTools ?? [], 'allowedTools'),
        frozenTools: normalizeToolNames(config.frozenTools ?? [], 'frozenTools'),
        piiDetection: config.piiDetection ?? true,
        secretDetection: config.secretDetection ?? true,
        sessionBudgetMicroUsd: config.sessionBudgetUsd !== undefined ? toMicroUsd(config.sessionBudgetUsd) : undefined,
        defaultToolCostMicroUsd: config.defaultToolCostUsd !== undefined ? toMicroUsd(config.defaultToolCostUsd) : undefined,
        toolCostsMicroUsd: toolCosts,
    })
}

export class TealTigerHarnessService extends Service {
    public readonly mode: GovernanceMode;

    private readonly config: ResolvedConfig;

    public readonly engine: TealEngine;

    private readonly piiGuardrail: PIIDetectionGuardrail;

    private readonly deniedExecutions = new WeakMap<Readonly<ToolExecution>, string>();

    private readonly sessionCostsMicroUsd = new Map<string, number>();

    constructor(ctx: Context, input: Config = {}) {
        super(ctx, 'tealtiger');

        this.config = resolveConfig(input);
        this.mode = this.config.mode;
        ctx.tools.guard((execution) => {
            return this.guardReason(execution);
        })
        this.engine = new TealEngine(
            createToolPolicy(this.config), {
            mode: {
                default: this.mode as PolicyMode,
            }
        })

        this.piiGuardrail = new PIIDetectionGuardrail({
            action: 'block'
        })
    }

    private guardReason(execution: Readonly<ToolExecution>): string | undefined {
        if (this.isFrozen(execution.name)) {
            return `Tool "${execution.name}" is frozen and cannot be used.`;
        }
        if (this.mode === 'ENFORCE' && !this.isAllowed(execution.name)) {
            return `Tool "${execution.name}" is not allowed in the current configuration.`;
        }
        return this.deniedExecutions.get(execution);
    }

    public isFrozen(toolName: string): boolean {
        return this.config.frozenTools.has(toolName);
    }

    public isAllowed(toolName: string): boolean {
        if (this.isFrozen(toolName)) {
            return false;
        }

        return (
            this.config.allowedTools.has('*') || this.config.allowedTools.has(toolName)
        );
    }

    private toolCostMicroUsd(toolName: string): number | undefined {
        return (this.config.toolCostsMicroUsd.get(toolName) ?? this.config.defaultToolCostMicroUsd);
    }

    public async evaluateTool(
        execution: Readonly<ToolExecution>,
    ): Promise<TealTigerReceipt> {
        const owner =
            execution.agent === undefined ? 'host' : String(execution.agent.id);

        const decision = this.engine.evaluateWithMode({
            agentId: owner,
            action: 'tool.execute',
            tool: execution.name,
        });

        const frozen = this.isFrozen(execution.name);
        const reasonCodes = new Set<string>(decision.reason_codes);
        let riskScore = decision.risk_score;
        let scannerViolation = false;

        if (!frozen && this.mode !== 'REPORT_ONLY') {
            const argumentsText = serializeArguments(execution.arguments);

            if (argumentsText === undefined) {
                reasonCodes.add('ARGUMENT_SERIALIZATION_FAILED');
                riskScore = Math.max(riskScore, 90);
                scannerViolation = true;
            } else {
                if (this.config.piiDetection) {
                    const piiResult = await
                        this.piiGuardrail.evaluate(argumentsText);

                    if (piiResult.shouldBlock()) {
                        reasonCodes.add('PII_DETECTED');
                        riskScore = Math.max(riskScore, piiResult.riskScore);
                        scannerViolation = true;
                    }
                }

                if (
                    this.config.secretDetection &&
                    SECRET_PATTERNS.some((pattern) => pattern.test(argumentsText))
                ) {
                    reasonCodes.add('SECRET_DETECTED');
                    riskScore = Math.max(riskScore, 90);
                    scannerViolation = true;
                }
            }
        }

        const estimatedCallCostMicroUsd =
            this.toolCostMicroUsd(execution.name);

        const currentSessionCostMicroUsd =
            this.sessionCostsMicroUsd.get(owner) ?? 0;

        const projectedSessionCostMicroUsd = Math.min(
            Number.MAX_SAFE_INTEGER,
            currentSessionCostMicroUsd + (estimatedCallCostMicroUsd ?? 0),
        );

        const budgetExceeded =
            this.config.sessionBudgetMicroUsd !== undefined &&
            projectedSessionCostMicroUsd > this.config.sessionBudgetMicroUsd;

        if (budgetExceeded) {
            reasonCodes.add('BUDGET_EXCEEDED');
            riskScore = Math.max(riskScore, 100);
        }

        if (
            (scannerViolation || budgetExceeded) &&
            this.mode === 'MONITOR'
        ) {
            reasonCodes.add('MONITOR_MODE_VIOLATION');
        }

        const scannerDenied =
            scannerViolation && this.mode === 'ENFORCE';

        const budgetDenied = budgetExceeded && this.mode === 'ENFORCE';

        const action: GovernanceAction =
            frozen || decision.action === 'DENY' || scannerDenied || budgetDenied
                ? 'DENY'
                : 'ALLOW';

        const reason = frozen
            ? 'Tool blocked by immutable FREEZE policy'
            : scannerDenied
                ? 'Tool blocked by sensitive-data policy'
                : budgetDenied
                    ? 'Tool blocked because the session budget would be exceeded'
                    : scannerViolation
                        ? 'Tool argument policy violation detected in MONITOR '
                        : budgetExceeded
                            ? 'Session budget limit exceeded'
                            : decision.reason;

        let sessionTotalMicroUsd = currentSessionCostMicroUsd;

        if (action === 'ALLOW' && estimatedCallCostMicroUsd !== undefined) {
            sessionTotalMicroUsd = projectedSessionCostMicroUsd;
            this.sessionCostsMicroUsd.set(owner, sessionTotalMicroUsd);
        }

        const receipt: TealTigerReceipt = Object.freeze({
            teec_version: TEEC_VERSION,
            event_type: 'tool/governance-decision',
            timestamp: new Date().toISOString(),
            correlation_id: String(execution.callId),
            agent_id: owner,
            session_id: owner,
            tool_name: execution.name,
            action,
            mode: this.mode,
            reason,
            reason_code: Object.freeze([...reasonCodes]),
            risk_score: frozen ? 100 : riskScore,
            policy_id: decision.policy_id,
            policy_version: decision.policy_version,
            component_versions: Object.freeze({
                ...decision.component_versions,
            }),
            cost: Object.freeze({
                currency: 'USD',
                session_total_usd: fromMicroUsd(sessionTotalMicroUsd),
                ...(estimatedCallCostMicroUsd === undefined
                    ? {}
                    : {
                        estimated_call_usd: fromMicroUsd(
                            estimatedCallCostMicroUsd,
                        ),
                    }),
                ...(this.config.sessionBudgetMicroUsd === undefined
                    ? {}
                    : {
                        session_limit_usd: fromMicroUsd(
                            this.config.sessionBudgetMicroUsd,
                        ),
                    }),
            }),
        });

        if (receipt.action === 'DENY') {
            this.deniedExecutions.set(execution, receipt.reason);
        }

        return receipt;
    }
}

export function apply(
    ctx: Context,
    config: Config = {},
): void {
    const service = new TealTigerHarnessService(ctx, config);

    ctx.on(
        'tools/pre-execute',
        async (execution, next): Promise<PreToolDecision> => {
            const receipt = await service.evaluateTool(execution);

            ctx.emit('tealtiger/decision', receipt);

            if (receipt.action === 'DENY') {
                return {
                    kind: 'deny',
                    reason: receipt.reason,
                };
            }

            return next();
        },
        {
            prepend: true,
        },
    );
}
