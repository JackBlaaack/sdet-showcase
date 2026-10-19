import { readFileSync } from 'node:fs';
import { Ajv, type SchemaObject, type ValidateFunction } from 'ajv';
import ajvFormats from 'ajv-formats';
import type { components } from '../clients/generated/schema.js';

// ajv-formats is a CommonJS package: under NodeNext its default import is typed
// as a namespace, so the callable plugin is reached through `.default`.
const addFormats = ajvFormats.default;

/** Names of the schemas in the OpenAPI document, for example 'Order'. */
export type SchemaName = keyof components['schemas'];

interface OpenApiDocument {
  components: { schemas: Record<string, SchemaObject> };
}

const spec = JSON.parse(
  readFileSync(new URL('../spec/openapi.json', import.meta.url), 'utf8'),
) as OpenApiDocument;

/**
 * The OpenAPI document does not close its objects, so an unexpected extra field
 * in a response would pass. Every object that lists properties and says nothing
 * about additional ones is closed here, which makes the contract check strict.
 */
function forbidExtraProperties(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(forbidExtraProperties);
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  const copy: Record<string, unknown> = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      forbidExtraProperties(value),
    ]),
  );
  if (
    copy['type'] === 'object' &&
    'properties' in copy &&
    !('additionalProperties' in copy)
  ) {
    copy['additionalProperties'] = false;
  }
  return copy;
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
// `components` only holds the schemas that `$ref` points into; it validates nothing itself.
ajv.addKeyword('components');
ajv.addSchema({
  $id: 'orders-sut',
  components: { schemas: forbidExtraProperties(spec.components.schemas) },
});

/** Validator for a schema of the OpenAPI document. `validator.errors` explains a failure. */
export function schemaValidator(name: SchemaName): ValidateFunction {
  return ajv.compile({ $ref: `orders-sut#/components/schemas/${name}` });
}

export const validateOrder = schemaValidator('Order');
export const validateProduct = schemaValidator('Product');
