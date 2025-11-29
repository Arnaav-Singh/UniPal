// Administrative API endpoints requiring dean-level privileges.
import express from 'express';
const router = express.Router();
import { getUsers, createUser, deleteUser, getAllEvents } from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const deanRoles = ['dean', 'superadmin'];

router.get('/users', authMiddleware, roleMiddleware(deanRoles), getUsers);
router.post('/users', authMiddleware, roleMiddleware(deanRoles), createUser);
router.delete('/users/:id', authMiddleware, roleMiddleware(deanRoles), deleteUser);
router.get('/events', authMiddleware, roleMiddleware(deanRoles), getAllEvents);

export default router;
