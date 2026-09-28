import express from 'express';
import { generateEventReport, exportEvents } from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Generate PDF Report for a specific event (Accessible by Coordinators, Deans, Admins)
router.post('/event/:id/pdf', protect, authorize('coordinator', 'dean', 'admin', 'superadmin'), generateEventReport);

// Export all events to Excel (Accessible by Deans, Admins)
router.get('/export/excel', protect, authorize('dean', 'admin', 'superadmin'), exportEvents);

export default router;
