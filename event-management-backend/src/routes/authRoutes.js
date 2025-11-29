// Authentication and session management endpoints.
import express from 'express';
const router = express.Router();
import { register, login, getProfile } from '../controllers/authController.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validateRequest.js';
import authMiddleware from '../middleware/authMiddleware.js';

router.post('/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  validate,
  register
);
router.post('/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  login
);
router.get('/me', authMiddleware, getProfile);

export default router;
