import * as z from 'zod/v4';

import {
  CapabilityInputField,
} from '../../../runtime/registry/capability.js';

function createFieldSchema(
  field: CapabilityInputField
): z.ZodType {
  let schema: z.ZodType;

  switch (field.type) {
    case 'string':
      schema = z.string();
      break;

    case 'number':
      schema = z.number();
      break;

    case 'boolean':
      schema = z.boolean();
      break;

    case 'array':
      schema = z.array(z.unknown());
      break;

    case 'object':
      schema = z.record(
        z.string(),
        z.unknown()
      );
      break;

    default:
      schema = z.unknown();
      break;
  }

  if (field.description) {
    schema = schema.describe(
      field.description
    );
  }

  if (!field.required) {
    schema = schema.optional();
  }

  return schema;
}

export function createMcpInputSchema(
  inputSchema: Record<
    string,
    CapabilityInputField
  >
): Record<string, z.ZodType> {
  return Object.fromEntries(
    Object.entries(
      inputSchema
    ).map(
      ([name, field]) => [
        name,
        createFieldSchema(field),
      ]
    )
  );
}