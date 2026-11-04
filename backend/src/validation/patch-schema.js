import { z } from 'zod';

// Zod 4 applies nested defaults even inside optional fields. PATCH must change
// only supplied fields, so remove creation defaults before making fields optional.
export function patchSchema(schema) {
  return z.object(Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [
    key, (value instanceof z.ZodDefault ? value.removeDefault() : value).optional(),
  ]))).strict();
}
