// Strips MongoDB operator injection ({"$gt": ""}) and prototype-pollution keys from user input.
const BAD_KEY = /^\$|\./;
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

const clean = (value, depth = 0) => {
  if (depth > 12 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v) => clean(v, depth + 1));
    return;
  }
  for (const key of Object.keys(value)) {
    if (BAD_KEY.test(key) || FORBIDDEN.has(key)) delete value[key];
    else clean(value[key], depth + 1);
  }
};

export const sanitizeInput = (req, _res, next) => {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};
