// Controllers orchestrating the event lifecycle: creation, assignment, invitations, and reporting.
import mongoose from 'mongoose';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import Event from '../models/Event.js';
import EventInvitation from '../models/EventInvitation.js';
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';

const allowedStatuses = ['draft', 'scheduled', 'ongoing', 'completed']; // canonical status transitions

// Lightweight guard to avoid casting invalid ids into queries.
const isObjectId = (value) => {
  if (!value) return false;
  try {
    return mongoose.Types.ObjectId.isValid(value.toString());
  } catch (_) {
    return false;
  }
};

// Convert ObjectId/documents/strings into a canonical string id.
const normaliseIdValue = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value?._id) return value._id.toString();
  if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
    return value.toString();
  }
  return null;
};

// Deduplicate and cast arrays of ids provided by clients.
const normalizeObjectIdArray = (values = []) => {
  const unique = new Set();
  const normalized = [];
  for (const value of values || []) {
    const stringValue = normaliseIdValue(value);
    if (!isObjectId(stringValue) || unique.has(stringValue)) continue;
    unique.add(stringValue);
    normalized.push(new mongoose.Types.ObjectId(stringValue));
  }
  return normalized;
};

// Determines whether the user has sufficient privileges to mutate an event.
const canManageEvent = (event, user) => {
  if (!event || !user) return false;
  if (['dean', 'superadmin'].includes(user.role)) return true;
  const createdById = normaliseIdValue(event.createdBy);
  const userId = user._id?.toString?.() || normaliseIdValue(user);
  if (createdById && userId && createdById === userId) return true;
  return event.coordinators?.some((coordId) => normaliseIdValue(coordId) === userId);
};

// Reply with 403 if the caller lacks management rights.
const ensureManageAccess = (event, user, res) => {
  if (!canManageEvent(event, user)) {
    res.status(403).json({ message: 'Not authorized to manage this event' });
    return false;
  }
  return true;
};

const mapStatus = (status) => (allowedStatuses.includes(status) ? status : undefined);

// Accept both comma-delimited strings and arrays for tag-like fields.
const normaliseStringArray = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

// Standardise agenda entries while stripping empty placeholders.
const normaliseAgenda = (agenda) => {
  if (!Array.isArray(agenda)) return [];
  return agenda
    .filter((item) => item && (item.title || item.startTime || item.endTime || item.speaker))
    .map((item) => ({
      title: item.title || '',
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      speaker: item.speaker || '',
      location: item.location || '',
    }));
};

// Guard against malformed coordinator contact inputs.
const normaliseContacts = (contacts) => {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .filter((item) => item && (item.name || item.email || item.phone))
    .map((item) => ({
      name: item.name || '',
      role: item.role || '',
      email: item.email || '',
      phone: item.phone || '',
    }));
};

// Consolidate attendance into a roster with timestamps/signatures where available.
const buildAttendanceSnapshot = (event) => {
  const roster = new Map();

  (event.attendanceLog || []).forEach((log) => {
    const user = log?.user || log;
    const id = user?._id?.toString?.() || user?.toString?.();
    if (!id) return;
    const registrationFromLog = typeof log?.registrationId === 'string' ? log.registrationId : undefined;
    const registrationId = registrationFromLog || user.registrationId || user.userID;
    roster.set(id, {
      userId: id,
      registrationId,
      name: user.name,
      email: user.email,
      signature: log.signature || null,
      timestamp: log.capturedAt ? log.capturedAt.toISOString() : null,
      school: user.school,
      department: user.department,
    });
  });

  (event.attendance || []).forEach((user) => {
    const id = user?._id?.toString?.() || user?.toString?.();
    if (!id || roster.has(id)) return;
    const registrationId = user.registrationId || user.userID;
    roster.set(id, {
      userId: id,
      registrationId,
      name: user.name,
      email: user.email,
      signature: null,
      timestamp: null,
      school: user.school,
      department: user.department,
    });
  });

  return Array.from(roster.values());
};

// Calculate feedback averages while retaining the raw responses.
const buildFeedbackSummary = (feedbackDocs = []) => {
  const total = feedbackDocs.length;
  const average = total > 0
    ? feedbackDocs.reduce((sum, item) => sum + (item.rating || 0), 0) / total
    : 0;
  return {
    averageRating: Number(average.toFixed(2)),
    total,
  };
};

// Return events with optional filtering by school/department/status.
export const getAllEvents = async (req, res) => {
  try {
    const { school, department, status } = req.query || {};
    const filter = {};
    if (school) filter.school = school;
    if (department) filter.department = department;
    if (status && allowedStatuses.includes(status)) filter.status = status;

    const events = await Event.find(filter)
      .populate('createdBy', 'name email role designation')
      .populate('coordinators', 'name email role designation')
      .populate('attendance', 'name email role');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Fetch a single event with related participants.
export const getEventById = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email role designation')
      .populate('coordinators', 'name email role designation')
      .populate('attendees', 'name email role')
      .populate('attendance', 'name email role');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new event record and seed coordinator invitations.
export const createEvent = async (req, res) => {
  try {
    const {
      name,
      date,
      location,
      description,
      time,
      capacity,
      banner,
      school,
      department,
      invitationMode,
      allowSelfCheckIn,
      status,
      coordinatorIds,
      category,
      eventFormat,
      deliveryMode,
      tags,
      sponsors,
      budget,
      agenda,
      importantContacts,
      requiresApproval,
      approvalNotes,
    } = req.body;

    const coordinatorObjectIds = normalizeObjectIdArray(coordinatorIds);
    const tagList = normaliseStringArray(tags);
    const sponsorList = normaliseStringArray(sponsors);
    const parsedBudget = {
      currency: (budget && budget.currency) || 'INR',
      amount: budget && budget.amount ? Number(budget.amount) : 0,
    };

    const actorRole = req.user?.role;
    const needsApproval = typeof requiresApproval === 'boolean' ? requiresApproval : true;
    let approvalStatus = needsApproval ? 'pending' : 'approved';
    let approvedBy;
    let approvedAt;
    let approvalNotesToPersist;

    if (!needsApproval || ['dean', 'superadmin'].includes(actorRole)) {
      approvalStatus = 'approved';
      approvedBy = req.user?._id || undefined;
      approvedAt = new Date();
      approvalNotesToPersist = approvalNotes;
    }

    const initialStatus = approvalStatus === 'approved'
      ? (mapStatus(status) || 'scheduled')
      : 'draft';

    const event = await Event.create({
      name,
      date,
      location,
      description,
      time,
      capacity,
      banner,
      school,
      department,
      category: category || 'other',
      eventFormat: eventFormat || 'other',
      deliveryMode: deliveryMode || 'in-person',
      tags: tagList,
      sponsors: sponsorList,
      budget: parsedBudget,
      invitationMode: invitationMode === 'open' ? 'open' : 'invite-only',
      allowSelfCheckIn: allowSelfCheckIn !== false,
      status: initialStatus,
      requiresApproval: needsApproval,
      approvalStatus,
      approvalNotes: approvalNotesToPersist,
      approvedBy,
      approvedAt,
      agenda: normaliseAgenda(agenda),
      importantContacts: normaliseContacts(importantContacts),
      createdBy: req.user?._id,
      coordinators: coordinatorObjectIds,
    });

    // Automatically create accepted invitations for assigned coordinators
    if (coordinatorObjectIds.length > 0) {
      const invitationDocs = coordinatorObjectIds.map((coordId) => ({
        event: event._id,
        invitee: coordId,
        invitedBy: req.user?._id || coordId,
        roleAtEvent: 'coordinator',
        status: 'accepted',
        respondedAt: new Date(),
      }));
      await EventInvitation.bulkWrite(
        invitationDocs.map((doc) => ({
          updateOne: {
            filter: { event: doc.event, invitee: doc.invitee },
            update: { $set: doc },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }

    const populated = await Event.findById(event._id)
      .populate('createdBy', 'name email role')
      .populate('coordinators', 'name email role');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Apply updates to mutable fields and keep derived state in sync.
export const updateEvent = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    const editableFields = [
      'name',
      'date',
      'location',
      'description',
      'time',
      'capacity',
      'banner',
      'school',
      'department',
      'invitationMode',
      'allowSelfCheckIn',
      'category',
      'eventFormat',
      'deliveryMode',
    ];

    for (const field of editableFields) {
      if (!(field in req.body)) continue;
      if (field === 'invitationMode') {
        event.invitationMode = req.body.invitationMode === 'open' ? 'open' : 'invite-only';
        continue;
      }
      if (field === 'allowSelfCheckIn') {
        event.allowSelfCheckIn = req.body.allowSelfCheckIn !== false;
        continue;
      }
      event[field] = req.body[field];
    }

    if ('tags' in req.body) {
      event.tags = normaliseStringArray(req.body.tags);
    }
    if ('sponsors' in req.body) {
      event.sponsors = normaliseStringArray(req.body.sponsors);
    }
    if ('agenda' in req.body) {
      event.agenda = normaliseAgenda(req.body.agenda);
    }
    if ('importantContacts' in req.body) {
      event.importantContacts = normaliseContacts(req.body.importantContacts);
    }
    if ('budget' in req.body) {
      const incomingBudget = req.body.budget || {};
      event.budget = {
        currency: incomingBudget.currency || event.budget?.currency || 'INR',
        amount: incomingBudget.amount ? Number(incomingBudget.amount) || 0 : event.budget?.amount || 0,
      };
    }

    if ('requiresApproval' in req.body) {
      const needsApproval = Boolean(req.body.requiresApproval);
      event.requiresApproval = needsApproval;
      if (!needsApproval && event.approvalStatus !== 'approved') {
        event.approvalStatus = 'approved';
        event.approvedBy = req.user?._id;
        event.approvedAt = new Date();
        if (event.status === 'draft') {
          event.status = 'scheduled';
        }
      }
    }

    if ('status' in req.body) {
      const newStatus = mapStatus(req.body.status);
      if (newStatus) {
        event.status = newStatus;
        if (newStatus === 'completed' && !event.finalizedAt) {
          event.finalizedAt = new Date();
        }
      }
    }

    if (Array.isArray(req.body.coordinatorIds)) {
      const coordinatorObjectIds = normalizeObjectIdArray(req.body.coordinatorIds);
      event.coordinators = coordinatorObjectIds;
      // Ensure invitations reflect coordinator assignment
      if (coordinatorObjectIds.length > 0) {
        await EventInvitation.bulkWrite(
          coordinatorObjectIds.map((coordId) => ({
            updateOne: {
              filter: { event: event._id, invitee: coordId },
              update: {
                $set: {
                  invitedBy: req.user?._id || coordId,
                  roleAtEvent: 'coordinator',
                  status: 'accepted',
                  respondedAt: new Date(),
                },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }
    }

    await event.save();

    const populated = await Event.findById(event._id)
      .populate('createdBy', 'name email role')
      .populate('coordinators', 'name email role')
      .populate('attendees', 'name email role');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove an event along with its invitation side effects.
export const deleteEvent = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    await Promise.all([
      EventInvitation.deleteMany({ event: event._id }),
      Event.deleteOne({ _id: event._id }),
    ]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Append coordinators to an event and ensure they have invitations.
export const assignCoordinators = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    const coordinatorIds = normalizeObjectIdArray(req.body.coordinatorIds || []);
    if (coordinatorIds.length === 0) {
      return res.status(400).json({ message: 'No coordinators provided' });
    }

    const updated = await Event.findByIdAndUpdate(
      event._id,
      { $addToSet: { coordinators: { $each: coordinatorIds } } },
      { new: true }
    ).populate('coordinators', 'name email role');

    await EventInvitation.bulkWrite(
      coordinatorIds.map((coordId) => ({
        updateOne: {
          filter: { event: event._id, invitee: coordId },
          update: {
            $set: {
              invitedBy: req.user?._id || coordId,
              roleAtEvent: 'coordinator',
              status: 'accepted',
              respondedAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Invite attendees or coordinators explicitly and email them the details.
export const inviteParticipants = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    const { invitees } = req.body;
    if (!Array.isArray(invitees) || invitees.length === 0) {
      return res.status(400).json({ message: 'No invitees provided' });
    }

    const operations = [];
    const invitedUsers = [];

    for (const invite of invitees) {
      let resolvedUserId = invite?.userId || invite?._id || invite;
      const emailCandidate = invite?.email?.toLowerCase?.().trim?.();

      if (!resolvedUserId && emailCandidate) {
        const userDoc = await User.findOne({ email: emailCandidate });
        if (userDoc) {
          resolvedUserId = userDoc._id;
        }
      }

      if (!isObjectId(resolvedUserId)) continue;

      const roleAtEvent = invite?.roleAtEvent === 'coordinator' ? 'coordinator' : 'attendee';
      const message = invite?.message;

      operations.push({
        updateOne: {
          filter: { event: event._id, invitee: new mongoose.Types.ObjectId(resolvedUserId) },
          update: {
            $set: {
              invitedBy: req.user?._id,
              roleAtEvent,
              status: 'pending',
              respondedAt: null,
              message,
            },
            $setOnInsert: {
              event: event._id,
              invitee: new mongoose.Types.ObjectId(resolvedUserId),
            },
          },
          upsert: true,
        },
      });
      invitedUsers.push(resolvedUserId.toString());
    }

    if (operations.length === 0) {
      return res.status(400).json({ message: 'No valid invitees provided' });
    }

    await EventInvitation.bulkWrite(operations, { ordered: false });

    const invitations = await EventInvitation.find({
      event: event._id,
      invitee: { $in: invitedUsers.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .populate('invitee', 'name email role')
      .populate('invitedBy', 'name email role');

    // Notify invitees (stubbed email service)
    const eventName = event.name;
    await Promise.all(
      invitations.map(async (invitation) => {
        const invitee = invitation.invitee;
        if (!invitee?.email) return;
        const subject = `[UniPal MIT] Invitation: ${eventName}`;
        const text = [
          `Hello ${invitee.name || 'there'},`,
          ``,
          `${req.user?.name || 'A coordinator'} has invited you to join the event "${eventName}" scheduled on ${event.date}.`,
          `Role at event: ${invitation.roleAtEvent === 'coordinator' ? 'Coordinator' : 'Attendee'}.`,
          invitation.message ? `Message: ${invitation.message}` : '',
          ``,
          `Please log in to UniPal MIT to accept or decline this invitation.`,
          ``,
          `- UniPal MIT`,
        ].filter(Boolean).join('\n');
        await sendEmail(invitee.email, subject, text);
      })
    );

    res.status(201).json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Provide a full list of invitations for an event managers can review.
export const listEventInvitations = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    const invitations = await EventInvitation.find({ event: event._id })
      .populate('invitee', 'name email role designation')
      .populate('invitedBy', 'name email role designation');

    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Allow privileged roles to approve or reject an event.
export const updateEventApproval = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { decision, notes } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approved or rejected' });
    }

    event.requiresApproval = false;
    event.approvalStatus = decision;
    event.approvalNotes = notes;
    if (decision === 'approved') {
      event.approvedBy = req.user._id;
      event.approvedAt = new Date();
      if (event.status === 'draft') {
        event.status = 'scheduled';
      }
    } else {
      // Rejected events are removed to keep calendars clean
      await EventInvitation.deleteMany({ event: event._id });
      await Event.deleteOne({ _id: event._id });
      return res.json({ message: 'Event rejected and deleted' });
    }

    await event.save();

    const populated = await Event.findById(event._id)
      .populate('createdBy', 'name email role')
      .populate('coordinators', 'name email role')
      .populate('approvedBy', 'name email role');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Let a user see invitations sent to them.
export const getMyInvitations = async (req, res) => {
  try {
    const invitations = await EventInvitation.find({ invitee: req.user._id })
      .populate('event', 'name date location status')
      .populate('invitedBy', 'name email role');
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Accept or decline a specific event invitation.
export const respondToInvitation = async (req, res) => {
  try {
    if (!isObjectId(req.params.invitationId)) {
      return res.status(400).json({ message: 'Invalid invitation id' });
    }
    const invitation = await EventInvitation.findById(req.params.invitationId).populate('event');
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
    if (invitation.invitee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized for this invitation' });
    }

    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitation.save();

    const event = await Event.findById(invitation.event._id);
    if (event) {
      if (status === 'accepted') {
        if (invitation.roleAtEvent === 'coordinator') {
          await Event.updateOne(
            { _id: event._id },
            { $addToSet: { coordinators: req.user._id } }
          );
        } else {
          await Event.updateOne(
            { _id: event._id },
            { $addToSet: { attendees: req.user._id } }
          );
        }
      }
    }

    res.json(invitation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Provide a consolidated view of attendance and feedback for managers.
export const getEventOverview = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email role designation')
      .populate('coordinators', 'name email role designation')
      .populate('attendance', 'name email role registrationId userID school department')
      .populate('attendanceLog.user', 'name email role registrationId userID school department');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    const feedbackDocs = await Feedback.find({ event: event._id })
      .populate('user', 'name email role registrationId userID');
    const attendance = buildAttendanceSnapshot(event);
    const summary = buildFeedbackSummary(feedbackDocs);

    res.json({
      event,
      attendance,
      feedback: {
        ...summary,
        entries: feedbackDocs,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Allow coordinators to close an event and open the feedback window.
export const endEvent = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id)
      .populate('attendance', 'name email role registrationId userID school department')
      .populate('attendanceLog.user', 'name email role registrationId userID school department');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    event.status = 'completed';
    event.feedbackOpen = true;
    event.attendanceCode = undefined;
    event.attendanceCodeExpiresAt = undefined;
    event.finalizedAt = event.finalizedAt || new Date();
    await event.save();

    const feedbackDocs = await Feedback.find({ event: event._id })
      .populate('user', 'name email role registrationId userID');
    const attendance = buildAttendanceSnapshot(event);
    const summary = buildFeedbackSummary(feedbackDocs);

    res.json({
      message: 'Event closed and feedback activated',
      event,
      attendance,
      feedback: {
        ...summary,
        entries: feedbackDocs,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Issue a short-lived attendance code that participants can scan.
export const generateAttendanceCode = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    if (event.approvalStatus !== 'approved') {
      return res.status(400).json({ message: 'Event approval pending. Please approve before generating attendance codes.' });
    }

    const code = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    event.attendanceCode = code;
    event.attendanceCodeExpiresAt = expiresAt;
    await event.save();
    res.json({ code, expiresAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Issue a short-lived feedback code that participants can scan.
export const generateFeedbackCode = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;

    if (event.approvalStatus !== 'approved') {
      return res.status(400).json({ message: 'Event approval pending. Please approve before generating feedback codes.' });
    }
    if (!event.feedbackOpen) {
      return res.status(400).json({ message: 'Feedback is not open for this event yet. End the event first.' });
    }

    const code = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes for feedback
    event.feedbackCode = code;
    event.feedbackCodeExpiresAt = expiresAt;
    await event.save();
    res.json({ code, expiresAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Validate an attendance code and register the participant's presence.
export const checkInWithCode = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const { code, registrationId, signature } = req.body || {};
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Event not approved yet' });
    }
    if (!event.attendanceCode || event.attendanceCode !== code) {
      return res.status(400).json({ message: 'Invalid code' });
    }
    if (!event.attendanceCodeExpiresAt || event.attendanceCodeExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Code expired' });
    }

    const userId = req.user._id.toString();
    const isCoordinator = event.coordinators?.some((coord) => coord.toString() === userId);
    const isAttendee = event.attendees?.some((att) => att.toString() === userId);
    if (event.invitationMode === 'invite-only' && !isCoordinator && !isAttendee) {
      return res.status(403).json({ message: 'This event requires an invitation' });
    }
    if (!event.allowSelfCheckIn && !isCoordinator) {
      return res.status(403).json({ message: 'Coordinator must record attendance for you' });
    }

    const alreadyChecked = event.attendance?.some((att) => att.toString() === userId);
    if (alreadyChecked) {
      return res.json({ message: 'Already checked in' });
    }

    const providedRegistration = typeof registrationId === 'string' ? registrationId.trim() : '';
    const derivedRegistrationId = providedRegistration || req.user.registrationId || req.user.userID;
    if (!derivedRegistrationId) {
      return res.status(400).json({ message: 'Registration number is required' });
    }
    const signaturePayload = typeof signature === 'string' && signature.length > 0 ? signature : undefined;

    const now = new Date();
    event.attendance.push(req.user._id);
    if (!Array.isArray(event.attendanceLog)) {
      event.attendanceLog = [];
    }
    const existingLogIndex = event.attendanceLog.findIndex((log) => log?.user?.toString() === userId);
    if (existingLogIndex === -1) {
      event.attendanceLog.push({
        user: req.user._id,
        registrationId: derivedRegistrationId,
        signature: signaturePayload,
        capturedAt: now,
      });
    } else {
      const current = event.attendanceLog[existingLogIndex];
      current.capturedAt = current.capturedAt || now;
      current.registrationId = derivedRegistrationId;
      if (signaturePayload) {
        current.signature = signaturePayload;
      }
      event.attendanceLog[existingLogIndex] = current;
    }
    await event.save();

    await EventInvitation.findOneAndUpdate(
      { event: event._id, invitee: req.user._id },
      { status: 'accepted', respondedAt: new Date() },
    );

    res.json({ message: 'Checked in' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Compile post-event metrics, notify deans, and mark the event as complete.
export const finalizeEvent = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findById(req.params.id)
      .populate('coordinators', 'name email role')
      .populate('attendance', 'name email role');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;
    if (event.approvalStatus !== 'approved') {
      return res.status(400).json({ message: 'Event must be approved before finalisation' });
    }

    const forceResend = Boolean(req.body?.forceResend);
    const notes = req.body?.notes;

    const feedback = await Feedback.find({ event: event._id });
    const feedbackCount = feedback.length;
    const averageRating = feedbackCount > 0
      ? feedback.reduce((sum, item) => sum + (item.rating || 0), 0) / feedbackCount
      : 0;

    event.status = 'completed';
    event.finalizedAt = event.finalizedAt || new Date();
    event.feedbackOpen = true;
    event.report = {
      generatedAt: new Date(),
      attendeeCount: event.attendance?.length || 0,
      feedbackCount,
      averageRating: Number(averageRating.toFixed(2)),
      notes,
      recipients: event.report?.recipients || [],
    };

    if (notes) {
      event.report.notes = notes;
    }

    const alreadySent = Boolean(event.reportSentAt);
    await event.save();

    if (alreadySent && !forceResend) {
      return res.json({ message: 'Report already sent to deans', report: event.report });
    }

    const deanRecipients = await User.find({ role: { $in: ['dean', 'superadmin'] } });
    const recipients = deanRecipients.filter((user) => Boolean(user.email));

    if (recipients.length > 0) {
      const subject = `[UniPal MIT] Event Report: ${event.name}`;
      const reportLines = [
        `Event: ${event.name}`,
        `Date: ${event.date}`,
        event.location ? `Location: ${event.location}` : null,
        event.school ? `School: ${event.school}` : null,
        event.department ? `Department: ${event.department}` : null,
        '',
        `Total Coordinators: ${event.coordinators?.length || 0}`,
        `Total Invitees: ${event.attendees?.length || 0}`,
        `Attendance Marked: ${event.attendance?.length || 0}`,
        '',
        `Feedback received: ${feedbackCount}`,
        `Average rating: ${Number(averageRating.toFixed(2))}`,
        '',
        notes ? `Notes from coordinator: ${notes}` : null,
        '',
        'Thank you for supporting UniPal MIT.',
      ].filter(Boolean).join('\n');

      await Promise.all(
        recipients.map((recipient) =>
          sendEmail(recipient.email, subject, reportLines)
        )
      );

      event.report.recipients = recipients.map((user) => user._id);
      event.reportSentAt = new Date();
      await event.save();
    }

    res.json({ message: 'Event finalized', report: event.report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Generate a PDF report combining attendance, feedback, and coordinator notes.
export const generateEventReportPdf = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const { summary, photos } = req.body || {};
    const event = await Event.findById(req.params.id)
      .populate('coordinators', 'name email role designation')
      .populate('attendance', 'name email role registrationId userID school department')
      .populate('attendanceLog.user', 'name email role registrationId userID school department');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!ensureManageAccess(event, req.user, res)) return;
    if (event.status !== 'completed') {
      return res.status(400).json({ message: 'End the event before generating a report' });
    }

    const feedbackDocs = await Feedback.find({ event: event._id })
      .populate('user', 'name email role registrationId userID');
    const attendance = buildAttendanceSnapshot(event);
    const feedbackSummary = buildFeedbackSummary(feedbackDocs);

    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const safeTitle = event.name?.replace?.(/[^\w\d-_]+/g, '_') || 'event';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_report.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text(event.name || 'Event Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${event.date || 'TBD'}`);
    if (event.time) doc.text(`Time: ${event.time}`);
    doc.text(`Location: ${event.location || 'Not set'}`);
    if (event.school) doc.text(`School: ${event.school}`);
    if (event.department) doc.text(`Department: ${event.department}`);
    doc.moveDown();
    if (event.coordinators?.length) {
      doc.fontSize(12).text(`Coordinator: ${event.coordinators.map((c) => c.name).join(', ')}`);
    }

    doc.moveDown().fontSize(14).text('Summary / Minutes of Meeting', { underline: true });
    doc.fontSize(12).text(summary || 'No summary provided.');

    doc.moveDown().fontSize(14).text('Attendance', { underline: true });
    if (attendance.length === 0) {
      doc.fontSize(11).text('No attendance records captured.');
    } else {
      attendance.forEach((att, idx) => {
        doc.fontSize(10).text(
          `${idx + 1}. ${att.name} (${att.registrationId || 'N/A'}) - ${att.email}${att.timestamp ? ` • ${new Date(att.timestamp).toLocaleString()}` : ''}`
        );
      });
    }

    doc.moveDown().fontSize(14).text('Feedback', { underline: true });
    doc.fontSize(12).text(`Average Rating: ${feedbackSummary.averageRating} (${feedbackSummary.total} responses)`);
    doc.moveDown(0.5);
    feedbackDocs.forEach((fb) => {
      const author = fb.user?.name || 'Anonymous';
      doc.fontSize(10).text(`${author}: ${fb.rating}/5${fb.comments ? ` — ${fb.comments}` : ''}`);
    });

    const photoInputs = Array.isArray(photos) ? photos.slice(0, 3) : [];
    const photoBuffers = photoInputs
      .map((photo) => {
        if (typeof photo !== 'string') return null;
        const base64 = photo.includes(',') ? photo.split(',').pop() : photo;
        try {
          return Buffer.from(base64, 'base64');
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

    if (photoBuffers.length > 0) {
      doc.addPage().fontSize(14).text('Event Photos', { underline: true });
      photoBuffers.forEach((buffer, idx) => {
        try {
          doc.moveDown(idx === 0 ? 1 : 0.5);
          doc.image(buffer, { fit: [500, 320], align: 'center', valign: 'center' });
        } catch (_) {
          doc.fontSize(10).text('Unable to render one of the provided images.');
        }
      });
    }

    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
};

// Surface aggregate counts used by the admin dashboard.
export const getAdminStats = async (_req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const totalAttendance = await Event.aggregate([
      { $project: { count: { $size: { $ifNull: ['$attendance', []] } } } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);
    const completedEvents = await Event.countDocuments({ status: 'completed' });
    res.json({
      events: totalEvents,
      attendance: totalAttendance[0]?.total || 0,
      completedEvents,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Provide coordinators with a snapshot of their event performance.
export const getCoordinatorStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const events = await Event.find({ coordinators: userId });
    const attendance = events.reduce((sum, ev) => sum + (ev.attendance?.length || 0), 0);
    const completedEvents = events.filter((ev) => ev.status === 'completed').length;
    res.json({ assignedEvents: events.length, attendance, completedEvents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Supply superadmins with high-level adoption figures.
export const getSuperadminOverview = async (_req, res) => {
  try {
    const [pendingApprovals, rejectedApprovals, upcomingApproved] = await Promise.all([
      Event.countDocuments({ approvalStatus: 'pending' }),
      Event.countDocuments({ approvalStatus: 'rejected' }),
      Event.countDocuments({ approvalStatus: 'approved', status: { $in: ['scheduled', 'ongoing'] } }),
    ]);

    const attendanceAggregate = await Event.aggregate([
      { $match: { approvalStatus: 'approved' } },
      {
        $project: {
          attendanceCount: { $size: { $ifNull: ['$attendance', []] } },
        },
      },
      {
        $group: {
          _id: null,
          totalAttendance: { $sum: '$attendanceCount' },
        },
      },
    ]);

    const topDepartments = await Event.aggregate([
      { $match: { approvalStatus: 'approved' } },
      {
        $project: {
          department: {
            $cond: [
              { $or: [{ $eq: ['$department', null] }, { $eq: ['$department', ''] }] },
              'General',
              '$department',
            ],
          },
          attendanceCount: { $size: { $ifNull: ['$attendance', []] } },
        },
      },
      {
        $group: {
          _id: '$department',
          events: { $sum: 1 },
          attendance: { $sum: '$attendanceCount' },
        },
      },
      { $sort: { attendance: -1, events: -1 } },
      { $limit: 5 },
    ]);

    const recentEvents = await Event.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name date status approvalStatus school department createdAt')
      .lean();

    res.json({
      pendingApprovals,
      rejectedApprovals,
      upcomingApproved,
      totalAttendance: attendanceAggregate[0]?.totalAttendance || 0,
      topDepartments: topDepartments.map((dept) => ({
        department: dept._id,
        events: dept.events,
        attendance: dept.attendance,
      })),
      recentEvents,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
