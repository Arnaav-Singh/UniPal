// Faculty directory management routes shared by coordinators and deans.
import express from 'express';
const router = express.Router();
import { getAllFaculty, inviteFaculty, deleteFaculty } from '../controllers/facultyController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const deanRoles = ['dean', 'superadmin'];

// Coordinators and deans can manage faculty
router.get('/', authMiddleware, roleMiddleware(['coordinator', ...deanRoles]), getAllFaculty);
router.post('/invite', authMiddleware, roleMiddleware(['coordinator', ...deanRoles]), inviteFaculty);
router.delete('/:id', authMiddleware, roleMiddleware(['coordinator', ...deanRoles]), deleteFaculty);

export default router;
