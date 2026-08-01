import Ajv2020, { type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';

import type { Action } from './generated/action';
import type { Approval } from './generated/approval';
import type { Decision } from './generated/decision';
import type { ExecutionReceipt } from './generated/execution-receipt';
import type { TargetCapability } from './generated/target-capability';

// Keep schema loading compatible with both ts-node source tests and compiled CommonJS output.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const actionSchema = require('../schemas/action.schema.json') as AnySchema;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const approvalSchema = require('../schemas/approval.schema.json') as AnySchema;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const decisionSchema = require('../schemas/decision.schema.json') as AnySchema;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const executionReceiptSchema = require('../schemas/execution-receipt.schema.json') as AnySchema;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const targetCapabilitySchema = require('../schemas/target-capability.schema.json') as AnySchema;

export const CONTRACT_VERSION = '1.0.0' as const;

export type ContractName =
  | 'Action'
  | 'Decision'
  | 'Approval'
  | 'ExecutionReceipt'
  | 'TargetCapability';

export class ContractValidationError extends Error {
  readonly contract: ContractName;
  readonly errors: readonly string[];

  constructor(contract: ContractName, errors: readonly string[]) {
    super(`${contract} validation failed: ${errors.join('; ')}`);
    this.name = 'ContractValidationError';
    this.contract = contract;
    this.errors = errors;
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});

const validators: Record<ContractName, ValidateFunction> = {
  Action: ajv.compile(actionSchema),
  Decision: ajv.compile(decisionSchema),
  Approval: ajv.compile(approvalSchema),
  ExecutionReceipt: ajv.compile(executionReceiptSchema),
  TargetCapability: ajv.compile(targetCapabilitySchema),
};

function errorPath(error: ErrorObject): string {
  if (error.keyword === 'required') {
    const missingProperty = String(error.params.missingProperty ?? '');
    return `${error.instancePath}/${missingProperty}` || '/';
  }

  return error.instancePath || '/';
}

function describeErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) {
    return ['/: instance is invalid'];
  }

  return errors.map((error) => {
    const message = error.message ?? `failed ${error.keyword}`;
    return `${errorPath(error)}: ${message}`;
  });
}

function validateContract<T>(contract: ContractName, value: unknown): T {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContractValidationError(contract, ['/: must be an object']);
  }

  const validator = validators[contract];
  if (!validator(value)) {
    throw new ContractValidationError(contract, describeErrors(validator.errors));
  }

  // Ajv is configured without mutation/coercion, so all unknown extension fields survive.
  return value as T;
}

function isContract(contract: ContractName, value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && validators[contract](value);
}

export function validateAction(value: unknown): Action {
  return validateContract<Action>('Action', value);
}

export function validateDecision(value: unknown): Decision {
  return validateContract<Decision>('Decision', value);
}

export function validateApproval(value: unknown): Approval {
  return validateContract<Approval>('Approval', value);
}

export function validateExecutionReceipt(value: unknown): ExecutionReceipt {
  return validateContract<ExecutionReceipt>('ExecutionReceipt', value);
}

export function validateTargetCapability(value: unknown): TargetCapability {
  return validateContract<TargetCapability>('TargetCapability', value);
}

export function isAction(value: unknown): value is Action {
  return isContract('Action', value);
}

export function isDecision(value: unknown): value is Decision {
  return isContract('Decision', value);
}

export function isApproval(value: unknown): value is Approval {
  return isContract('Approval', value);
}

export function isExecutionReceipt(value: unknown): value is ExecutionReceipt {
  return isContract('ExecutionReceipt', value);
}

export function isTargetCapability(value: unknown): value is TargetCapability {
  return isContract('TargetCapability', value);
}
