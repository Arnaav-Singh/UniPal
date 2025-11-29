// Notification CRUD endpoints requiring authentication.
import express from 'express';
import { sendNotification, getNotifications, markAsRead } from '../controllers/notificationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
const router = express.Router();

router.post('/', authMiddleware, sendNotification);
router.get('/', authMiddleware, getNotifications);
router.patch('/:id/read', authMiddleware, markAsRead);

export default router;
