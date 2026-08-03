import { TealTigerClient, PolicyViolationError } from 'tealtiger-sdk';

/**
 * Options for configuring TealTiger governance on a Mastra tool.
 */
export interface GovernanceOptions {
  /** 
   * The initialized TealTiger client. 
   */
  client: TealTigerClient;
  
  /** 
   * Scan the tool's input arguments before execution. Default true.
   */
  scanInput?: boolean;
  
  /** 
   * Scan the tool's return value after execution. Default false.
   */
  scanOutput?: boolean;
}

/**
 * Wraps a Mastra Tool with TealTiger governance.
 * Intercepts the execution pipeline to enforce security policies (e.g. PII, secrets).
 *
 * @param tool The original Mastra tool configuration
 * @param options Governance options including the TealTiger client
 * @returns A governed tool configuration ready for Mastra
 */
export function withGovernance(tool: any, options: GovernanceOptions): any {
  const originalExecute = tool.execute;
  
  if (typeof originalExecute !== 'function') {
    throw new Error('Tool must have an execute function');
  }

  // Create a governed version of the execute function
  const governedExecute = async (args: any, context?: any) => {
    const { client, scanInput = true, scanOutput = false } = options;

    // 1. Scan Inputs
    if (scanInput) {
      const inputString = typeof args === 'string' ? args : JSON.stringify(args);
      const decision = await client.evaluate({
        text: inputString,
        context: { tool: tool.id || tool.name }
      });

      if (decision.action === 'DENY' || decision.pii_detected) {
        throw new PolicyViolationError(
          `🛑 [TealTiger Governance Blocked]: Tool input violated security policies (Reason: ${decision.reason})`,
          decision
        );
      }
    }

    // 2. Execute the original tool
    const result = await originalExecute(args, context);

    // 3. Scan Outputs (Data Loss Prevention)
    if (scanOutput) {
      const outputString = typeof result === 'string' ? result : JSON.stringify(result);
      const decision = await client.evaluate({
        text: outputString,
        context: { tool: tool.id || tool.name }
      });

      if (decision.action === 'DENY' || decision.pii_detected) {
        throw new PolicyViolationError(
          `🛑 [TealTiger DLP Blocked]: Tool output contained restricted data and was blocked from reaching the LLM (Reason: ${decision.reason})`,
          decision
        );
      }
    }

    return result;
  };

  return {
    ...tool,
    execute: governedExecute
  };
}
