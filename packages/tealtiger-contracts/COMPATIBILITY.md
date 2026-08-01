# Contract Compatibility Policy

`@tealtiger/contracts` and `tealtiger-contracts` share one independent semantic version. The npm package, Python package, schema identifiers, generated code, and conformance-vector document must publish the same version.

## Version Handling

- Version 1 validators accept well-formed `1.x.y` contract versions.
- The current package emits `1.0.0`.
- A different major version is rejected during parsing with an error at `contract_version`.
- Compatible minor releases may add optional fields. Version 1 consumers must preserve unknown fields when validating and relaying an instance.
- Optional means a property may be absent. It does not permit `null` unless the schema explicitly includes the null type.
- Consumers that require an exact producer version may compare `contract_version` after structural validation, but should not discard unknown fields before making that decision.

Pre-release and build metadata are not part of the version 1 wire pattern. A later major version may adopt full SemVer metadata if a concrete interoperability need appears.

## Change Classification

### Patch Release

A patch release may:

- clarify descriptions or examples without changing accepted instances;
- fix validation error wording while retaining field paths;
- add tests or vectors that document behavior already required by the schemas;
- update generated formatting without changing public types or validation behavior.

### Minor Release

A minor release may:

- add an optional property with a backward-compatible type;
- add a new schema that does not change existing schemas;
- add non-normative metadata or documentation;
- add validation utilities that do not change acceptance of existing schemas.

Every minor-version field must be optional. Existing version 1 instances must continue to validate, and older version 1 validators must preserve the new field as unknown data.

### Major Release

The following require a major version:

- removing or renaming a property;
- adding a required property;
- changing a property's type, meaning, or nullability;
- narrowing numeric, string, array, or object constraints;
- adding, removing, or renaming a value in a closed enum or `const`;
- changing public outcomes, internal gate levels, reversibility classes, execution outcomes, or mapping fidelity values;
- changing `additionalProperties` so unknown fields are no longer preserved;
- changing strict validation to permit coercion;
- changing approval from exact-action scope;
- changing a field from opaque data to an incompatible canonical representation.

Although some schema validators consider adding an enum member additive, generated clients may use exhaustive matching. Closed-enum changes therefore require a major version in this package.

## Conformance Requirements

A contract change is releasable only when all of the following are true:

1. Draft 2020-12 schemas compile successfully.
2. TypeScript and Python generated files match deterministic generator output.
3. Both languages evaluate every shared vector with the same expected result.
4. Valid instances round-trip to the identical JSON value.
5. Unknown fields survive that round trip.
6. Invalid instances produce a descriptive field path.
7. Incompatible major versions are rejected during parsing.
8. Mutable language models are revalidated before serialization so invalid state cannot bypass the wire contract.

The schemas define structural interoperability. Cross-field lifecycle rules that JSON Schema cannot express, such as checking whether an approval is currently expired, remain the responsibility of the runtime gate and belong in a later runtime-focused change.
