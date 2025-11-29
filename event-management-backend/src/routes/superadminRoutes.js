// Routes reserved for dean/superadmin operators.
import express from 'express';
import { getAllUsers, deleteUser, getAllEvents, deleteEvent, getAllFeedback, createSuperAdmin, bulkCreateCoordinators, assignEventToCoordinator } from '../controllers/superadminController.js';
import { getSuperadminOverview } from '../controllers/eventController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

const deanRoles = ['dean', 'superadmin']; // both roles share the same permissions for this router

// All routes require dean-level access
router.get('/users', authMiddleware, roleMiddleware(deanRoles), getAllUsers);
router.delete('/users/:id', authMiddleware, roleMiddleware(deanRoles), deleteUser);
router.get('/events', authMiddleware, roleMiddleware(deanRoles), getAllEvents);
router.delete('/events/:id', authMiddleware, roleMiddleware(deanRoles), deleteEvent);
router.get('/feedback', authMiddleware, roleMiddleware(deanRoles), getAllFeedback);
router.get('/overview', authMiddleware, roleMiddleware(deanRoles), getSuperadminOverview);

// Create superadmin
router.post('/bootstrap/superadmin', authMiddleware, roleMiddleware(deanRoles), createSuperAdmin);

// Bulk create coordinators
router.post('/coordinators/bulk', authMiddleware, roleMiddleware(deanRoles), bulkCreateCoordinators);

// Assign event to coordinator
router.post('/events/:eventId/assign', authMiddleware, roleMiddleware(deanRoles), assignEventToCoordinator);

export default router;
