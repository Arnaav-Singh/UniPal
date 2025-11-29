// Event lifecycle endpoints spanning creation, invitations, attendance, and stats.
import express from 'express';
const router = express.Router();
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  assignCoordinators,
  generateAttendanceCode,
  generateFeedbackCode,
  checkInWithCode,
  getAdminStats,
  getCoordinatorStats,
  inviteParticipants,
  listEventInvitations,
  getMyInvitations,
  respondToInvitation,
  finalizeEvent,
  updateEventApproval,
  getSuperadminOverview,
  getEventOverview,
  endEvent,
  generateEventReportPdf,
} from '../controllers/eventController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { param } from 'express-validator';
import { validate } from '../middleware/validateRequest.js';

const deanRoles = ['dean']; // superadmin is normalized to dean in authMiddleware

// Stats routes must be defined before dynamic :id routes
router.get('/stats/admin/summary', authMiddleware, roleMiddleware(deanRoles), getAdminStats);
router.get('/stats/dean/summary', authMiddleware, roleMiddleware(deanRoles), getAdminStats);
router.get('/stats/coordinator/summary', authMiddleware, roleMiddleware(['coordinator']), getCoordinatorStats);
router.get('/stats/superadmin/overview', authMiddleware, roleMiddleware(deanRoles), getSuperadminOverview);
router.get('/stats/dean/overview', authMiddleware, roleMiddleware(deanRoles), getSuperadminOverview);

// Invitation management
router.get('/invitations/mine', authMiddleware, getMyInvitations);
router.post('/invitations/:invitationId/respond',
  authMiddleware,
  param('invitationId').isMongoId().withMessage('Invalid invitation id'),
  validate,
  respondToInvitation
);

// Public access to view events
router.get('/', getAllEvents);

// Create/update/delete managed events
router.post('/', authMiddleware, roleMiddleware(deanRoles), createEvent);
router.get('/:id',
  param('id').isMongoId().withMessage('Invalid event id'),
  validate,
  getEventById
);
router.put('/:id', authMiddleware, roleMiddleware(deanRoles), updateEvent);
router.delete('/:id', authMiddleware, roleMiddleware(deanRoles), deleteEvent);

router.post('/:id/approval',
  authMiddleware,
  roleMiddleware(deanRoles),
  param('id').isMongoId(),
  validate,
  updateEventApproval
);

// Assign coordinators (dean-level access)
router.post('/:id/assign', authMiddleware, roleMiddleware(deanRoles), assignCoordinators);

// Event invitations (deans and assigned coordinators - controller double checks)
router.get('/:id/invitations',
  authMiddleware,
  roleMiddleware([...deanRoles, 'coordinator']),
  param('id').isMongoId(),
  validate,
  listEventInvitations
);
router.post('/:id/invitations',
  authMiddleware,
  roleMiddleware([...deanRoles, 'coordinator']),
  param('id').isMongoId(),
  validate,
  inviteParticipants
);

router.post('/:id/finalize',
  authMiddleware,
  roleMiddleware([...deanRoles, 'coordinator']),
  param('id').isMongoId(),
  validate,
  finalizeEvent
);

router.get('/:id/overview',
  authMiddleware,
  roleMiddleware([...deanRoles, 'coordinator']),
  param('id').isMongoId(),
  validate,
  getEventOverview
);

router.post('/:id/end',
  authMiddleware,
  roleMiddleware([...deanRoles, 'coordinator']),
  param('id').isMongoId(),
  validate,
  endEvent
);

router.post('/:id/report',
  authMiddleware,
  roleMiddleware([...deanRoles, 'coordinator']),
  param('id').isMongoId(),
  validate,
  generateEventReportPdf
);

// Attendance QR code generate (event managers only - enforced in controller)
router.post('/:id/attendance/code', authMiddleware, param('id').isMongoId(), validate, generateAttendanceCode);

// Feedback QR code generate (event managers only - enforced in controller)
router.post('/:id/feedback/code', authMiddleware, param('id').isMongoId(), validate, generateFeedbackCode);

// Check-in with code (any authenticated user)
router.post('/:id/attendance/check-in',
  authMiddleware,
  param('id').isMongoId(),
  validate,
  checkInWithCode
);

export default router;
