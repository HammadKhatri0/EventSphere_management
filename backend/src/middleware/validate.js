import { ApiError } from '../utils/ApiError.js';

/**
 * Validates request parts against zod schemas and replaces them with the parsed (coerced, stripped) values.
 * Usage: validate({ body: schema, query: schema, params: schema })
 */
export const validate = (schemas) => (req, _res, next) => {
  const errors = [];
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      if (part === 'query') {
        // keep a mutable object on req.query
        Object.keys(req.query).forEach((k) => delete req.query[k]);
        Object.assign(req.query, result.data);
      } else {
        req[part] = result.data;
      }
    } else {
      errors.push(...result.error.issues.map((i) => ({ field: [part !== 'body' ? part : null, ...i.path].filter(Boolean).join('.'), message: i.message })));
    }
  }
  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
  next();
};
