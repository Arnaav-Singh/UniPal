// Validates express-validator chains and short-circuits with HTTP 400 on failure.
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  // Collect validation errors accumulated by prior middleware.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

