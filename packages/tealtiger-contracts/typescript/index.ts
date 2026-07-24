export type { Action } from './generated/action';
export type { Approval } from './generated/approval';
export type { Decision } from './generated/decision';
export type { ExecutionReceipt } from './generated/execution-receipt';
export type { TargetCapability } from './generated/target-capability';

export {
  CONTRACT_VERSION,
  ContractValidationError,
  isAction,
  isApproval,
  isDecision,
  isExecutionReceipt,
  isTargetCapability,
  validateAction,
  validateApproval,
  validateDecision,
  validateExecutionReceipt,
  validateTargetCapability,
} from './validation';
