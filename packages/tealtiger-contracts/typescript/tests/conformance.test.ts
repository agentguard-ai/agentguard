import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  ContractValidationError,
  validateAction,
  validateApproval,
  validateDecision,
  validateExecutionReceipt,
  validateTargetCapability,
} from '../index';

type ContractName =
  | 'Action'
  | 'Decision'
  | 'Approval'
  | 'ExecutionReceipt'
  | 'TargetCapability';

interface Vector {
  id: string;
  contract: ContractName;
  expected: 'valid' | 'invalid';
  expected_error_path?: string;
  instance: Record<string, unknown>;
}

interface VectorDocument {
  contract_package_version: string;
  vectors: Vector[];
}

const vectorPath = path.resolve(__dirname, '../../vectors/conformance.json');
const vectorDocument = JSON.parse(readFileSync(vectorPath, 'utf8')) as VectorDocument;

const validateByContract: Record<ContractName, (value: unknown) => unknown> = {
  Action: validateAction,
  Decision: validateDecision,
  Approval: validateApproval,
  ExecutionReceipt: validateExecutionReceipt,
  TargetCapability: validateTargetCapability,
};

test('vector corpus covers every contract with positive and negative cases', () => {
  assert.equal(vectorDocument.contract_package_version, '1.0.0');

  for (const contract of Object.keys(validateByContract) as ContractName[]) {
    const vectors = vectorDocument.vectors.filter((vector) => vector.contract === contract);
    assert.ok(vectors.some((vector) => vector.expected === 'valid'), `${contract} needs a valid vector`);
    assert.ok(vectors.some((vector) => vector.expected === 'invalid'), `${contract} needs an invalid vector`);
    assert.ok(
      vectors.some((vector) => vector.instance.contract_version !== '1.0.0'),
      `${contract} needs a version-compatibility vector`,
    );
  }
});

for (const vector of vectorDocument.vectors) {
  test(`${vector.contract}: ${vector.id}`, () => {
    const validate = validateByContract[vector.contract];
    const input = structuredClone(vector.instance);

    if (vector.expected === 'valid') {
      const parsed = validate(input);
      assert.deepEqual(parsed, vector.instance);
      assert.deepEqual(JSON.parse(JSON.stringify(parsed)), vector.instance);
      return;
    }

    assert.throws(
      () => validate(input),
      (error: unknown) => {
        assert.ok(error instanceof ContractValidationError);
        assert.match(error.message, new RegExp(vector.expected_error_path ?? 'validation failed'));
        return true;
      },
    );
  });
}
