import z from "@deepseek-ai/schemastery"

export const name = 'tealtiger-harness';
export const inject = ['tools'];

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
    sessionBudgetUsd: z.number().min(0),
    defaultToolCostUsd: z.number().min(0),
    toolCostsUsd: z.dict(z.number().min(0)).default({}),
})

