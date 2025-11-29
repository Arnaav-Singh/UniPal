// Feedback submission/retrieval interfaces.
import express from 'express';
const router = express.Router();
import { submitFeedback, getFeedbackForEvent } from '../controllers/feedbackController.js';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validateRequest.js';
import authMiddleware from '../middleware/authMiddleware.js';

router.post('/:eventId',
  authMiddleware,
  param('eventId').isMongoId().withMessage('Invalid event id'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating 1-5 required'),
  validate,
  submitFeedback
);
router.get('/:eventId', authMiddleware, param('eventId').isMongoId(), validate, getFeedbackForEvent);

export default router;
