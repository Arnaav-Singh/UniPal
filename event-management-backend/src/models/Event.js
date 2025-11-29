// Stores rich event metadata including scheduling, approvals, and attendance tracking.
import mongoose from 'mongoose';


const eventSchema = new mongoose.Schema({
  eventID: { type: String, unique: true, default: function() { return this._id.toString(); } },
  name: { type: String, required: true },
  date: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String },
  time: { type: String },
  capacity: { type: Number },
  banner: { type: String },
  school: { type: String },
  department: { type: String },
  category: {
    type: String,
    enum: ['seminar', 'workshop', 'competition', 'guest-lecture', 'hackathon', 'orientation', 'cultural', 'sports', 'other'],
    default: 'other',
  },
  eventFormat: {
    type: String,
    enum: ['seminar', 'panel', 'hands-on', 'networking', 'ceremony', 'other'],
    default: 'other',
  },
  deliveryMode: {
    type: String,
    enum: ['in-person', 'online', 'hybrid'],
    default: 'in-person',
  },
  tags: [{ type: String }],
  sponsors: [{ type: String }],
  budget: {
    currency: { type: String, default: 'INR' },
    amount: { type: Number, default: 0 },
  },
  invitationMode: {
    type: String,
    enum: ['open', 'invite-only'],
    default: 'invite-only',
  },
  allowSelfCheckIn: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'ongoing', 'completed'],
    default: 'draft',
  },
  requiresApproval: { type: Boolean, default: true },
  approvalStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvalNotes: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attendance: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  coordinators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  agenda: [{
    title: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    speaker: { type: String },
    location: { type: String },
  }],
  importantContacts: [{
    name: { type: String },
    role: { type: String },
    email: { type: String },
    phone: { type: String },
  }],
  attendanceCode: { type: String },
  attendanceCodeExpiresAt: { type: Date },
  feedbackCode: { type: String },
  feedbackCodeExpiresAt: { type: Date },
  finalizedAt: { type: Date },
  attendanceLog: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registrationId: { type: String },
    signature: { type: String },
    capturedAt: { type: Date, default: Date.now },
  }],
  feedbackOpen: { type: Boolean, default: false },
  report: {
    generatedAt: { type: Date },
    attendeeCount: { type: Number, default: 0 },
    feedbackCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    notes: { type: String },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  reportSentAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('Event', eventSchema);
