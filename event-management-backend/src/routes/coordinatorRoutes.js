// Coordinator scoped endpoints for managing personal events.
import express from 'express';
const router = express.Router();
import { createEvent, updateEvent, deleteEvent, getDirectory, createParticipantAccount } from '../controllers/coordinatorController.js';
import { protect as authMiddleware } from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

router.post('/events', authMiddleware, roleMiddleware(['coordinator']), createEvent);
router.put('/events/:id', authMiddleware, roleMiddleware(['coordinator']), updateEvent);
router.delete('/events/:id', authMiddleware, roleMiddleware(['coordinator']), deleteEvent);
router.get('/directory', authMiddleware, roleMiddleware(['coordinator']), getDirectory);
router.post('/events/:id/participants', authMiddleware, roleMiddleware(['coordinator']), createParticipantAccount);

export default router;
