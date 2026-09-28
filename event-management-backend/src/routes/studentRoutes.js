// Student focused routes for registrations and attendance.
import express from 'express';
const router = express.Router();
import { registerForEvent, getMyEvents, markAttendance, listAttendance } from '../controllers/studentController.js';
import { protect as authMiddleware } from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const deanRoles = ['dean', 'superadmin']; // reused for privileged attendance lookups

router.post('/events/:id/register', authMiddleware, roleMiddleware(['student']), registerForEvent);
router.get('/my-events', authMiddleware, roleMiddleware(['student']), getMyEvents);
router.post('/events/:id/attendance', authMiddleware, roleMiddleware(['student']), markAttendance);
router.get('/events/:id/attendance', authMiddleware, listAttendance);

export default router;
