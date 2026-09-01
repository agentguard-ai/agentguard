import {Service, type Context} from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type {ToolExecution} from "@deepseek-ai/dsh-tools";

export const name = 'tealtiger-harness';
export const inject = ['tools'];

const USD_SCALE = 1.0;
const MAX_USD = Number.MAX_SAFE_INTEGER / USD_SCALE;


export type GovernanceMode = 'ENFORCE' | 'MONITOR' | 'REPORT_ONLY';

export interface Config{
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
    toolCostsUsd: z.dict(z.number().min(0)).max(MAX_USD).default({}),
})

declare module "@deepseek-ai/cordis" {
    interface Context{
        tealtiger: TealTigerHarnessService;
    }
}

function normalizeToolNames(values: readonly string[], fieldName: string): ReadonlySet<string> {
    const names = new Set<string>();
    for(const value of values){
        const name = value.trim();

        if (name.length === 0){
            throw new Error(`Invalid ${fieldName}: tool name cannot be empty`);
        }
        if(names.has(name)){
            throw new Error(`Invalid ${fieldName}: duplicate tool name "${name}"`);
        }
        names.add(name);
    }
    return names;
}

interface ResolvedConfig{
    readonly mode: GovernanceMode;
    readonly allowedTools: ReadonlySet<string>;
    readonly frozenTools: ReadonlySet<string>;
    readonly piiDetection: boolean;
    readonly secretDetection: boolean;
    readonly sessionBudgetMicroUsd?: number;
    readonly defaultToolCostMicroUsd?: number;
    readonly toolCostsMicroUsd: ReadonlyMap<string, number>;
}

function toMicroUsd(value: number): number {
    return Math.round(value * USD_SCALE);
}

function resolveConfig(input:Config): ResolvedConfig {
    const config = Config(input);
    if(config.sessionBudgetUsd !== undefined && config.defaultToolCostUsd === undefined){
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
    public readonly mode : GovernanceMode;

    private readonly config: ResolvedConfig;

    constructor(ctx: Context, input: Config = {}) {
        super(ctx, 'tealtiger');

        this.config = resolveConfig(input);
        this.mode = this.config.mode;
        ctx.tools.guard((execution)=>{
            return this.guardReason(execution);
        })
    }

    private guardReason(execution: Readonly<ToolExecution>): string | undefined {
        if(this.isFrozen(execution.name)){
            return `Tool "${execution.name}" is frozen and cannot be used.`;
        }
        if(this.mode === 'ENFORCE' && !this.isAllowed(execution.name)){
            return `Tool "${execution.name}" is not allowed in the current configuration.`;
        }
        return undefined;
    }
    
    public isFrozen(toolName: string): boolean {
        return this.config.frozenTools.has(toolName);
    }

    public isAllowed(toolName: string): boolean {
        if(this.isFrozen(toolName)){
            return false;
        }
        
        return(
            this.config.allowedTools.has('*') || this.config.allowedTools.has(toolName)
        );
    }
}

export function apply(ctx: Context, config: Config = {}): void{
    new TealTigerHarnessService(ctx, config);
}

