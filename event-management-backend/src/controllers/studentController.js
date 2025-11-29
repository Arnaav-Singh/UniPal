// Student-centric endpoints covering registration, attendance, and personal event lists.
import Event from '../models/Event.js';
import EventInvitation from '../models/EventInvitation.js';
import Feedback from '../models/Feedback.js';

const canManageEvent = (event, user) => {
  if (!event || !user) return false;
  if (['dean', 'superadmin'].includes(user.role)) return true;
  if (event.createdBy && event.createdBy.toString() === user._id.toString()) return true;
  return event.coordinators?.some((coord) => coord.toString() === user._id.toString());
};

// Enrol the authenticated student into an event, honouring invitation rules.
export const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.invitationMode === 'invite-only') {
      const invitation = await EventInvitation.findOne({ event: event._id, invitee: req.user._id });
      if (!invitation || invitation.status === 'declined') {
        return res.status(403).json({ message: 'This event is invite-only. Please contact the coordinator.' });
      }
    }
    if (event.attendees.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already registered' });
    }
    event.attendees.push(req.user._id);
    await event.save();

    await EventInvitation.findOneAndUpdate(
      { event: event._id, invitee: req.user._id },
      {
        $set: {
          invitedBy: req.user._id,
          roleAtEvent: 'attendee',
          status: 'accepted',
          respondedAt: new Date(),
        },
        $setOnInsert: {
          event: event._id,
          invitee: req.user._id,
        },
      },
      { upsert: true }
    );

    res.json({ message: 'Registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List events that the student is currently registered to attend.
export const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({ attendees: req.user._id });
    const eventIds = events.map((event) => event._id);
    let feedbackDocs = [];
    if (eventIds.length > 0) {
      feedbackDocs = await Feedback.find({
        event: { $in: eventIds },
        user: req.user._id,
      }).select('event');
    }
    const submitted = new Set(feedbackDocs.map((fb) => fb.event.toString()));
    const enriched = events.map((event) => {
      const obj = event.toObject();
      obj.feedbackSubmitted = submitted.has(event._id.toString());
      return obj;
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark attendance for the student, ensuring they were previously registered.
export const markAttendance = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const userId = req.user._id.toString();
    if (!event.attendees.map(a => a.toString()).includes(userId)) {
      return res.status(400).json({ message: 'Not registered for this event' });
    }
    if (!event.attendance) event.attendance = [];
    if (event.attendance.map(a => a.toString()).includes(userId)) {
      return res.status(400).json({ message: 'Attendance already marked' });
    }
    const providedRegistration = typeof req.body?.registrationId === 'string' ? req.body.registrationId.trim() : '';
    const derivedRegistrationId = providedRegistration || req.user.registrationId || req.user.userID;
    if (!derivedRegistrationId) {
      return res.status(400).json({ message: 'Registration number is required' });
    }
    const signaturePayload = typeof req.body?.signature === 'string' && req.body.signature
      ? req.body.signature
      : undefined;
    const now = new Date();
    event.attendance.push(req.user._id);
    if (!Array.isArray(event.attendanceLog)) {
      event.attendanceLog = [];
    }
    const existingLogIndex = event.attendanceLog.findIndex((log) => log?.user?.toString?.() === userId);
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
      { status: 'accepted', respondedAt: new Date() }
    );

    res.json({ message: 'Attendance marked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Provide an attendance roster visible to authorised viewers.
export const listAttendance = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('attendance', 'name email role registrationId userID school department')
      .populate('attendanceLog.user', 'name email role registrationId userID school department')
      .populate('coordinators', '_id');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canManageEvent(event, req.user)) {
      return res.status(403).json({ message: 'Not authorized to view attendance for this event' });
    }

    const attendees = new Map();

    (event.attendanceLog || []).forEach((log) => {
      const user = log?.user;
      if (!user?._id) return;
      const id = user._id.toString();
      const registrationId = typeof log?.registrationId === 'string'
        ? log.registrationId
        : (user.registrationId || user.userID);
      attendees.set(id, {
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
      const id = user?._id?.toString?.();
      if (!id || attendees.has(id)) return;
      attendees.set(id, {
        userId: id,
        registrationId: user.registrationId || user.userID,
        name: user.name,
        email: user.email,
        signature: null,
        timestamp: null,
        school: user.school,
        department: user.department,
      });
    });

    res.json({ attendees: Array.from(attendees.values()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
