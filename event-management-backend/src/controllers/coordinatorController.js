// Coordinator workflows including event creation and collaborator management.
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import EventInvitation from '../models/EventInvitation.js';
import User from '../models/User.js';

// Support comma-delimited or array form inputs for UI flexibility.
const parseList = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

// Ensure agenda entries are normalised before persistence.
const parseAgenda = (agenda) => {
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

// Strip empty contact placeholders and provide defaults.
const parseContacts = (contacts) => {
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

// Confirms the current coordinator is associated with the event being modified.
const coordinatorOwnsEvent = (event, userId) => {
  if (!event || !userId) return false;
  const idString = userId.toString();
  return (
    event.createdBy?.toString() === idString ||
    event.coordinators?.some((coord) => coord.toString() === idString)
  );
};

// Normalise participant-facing roles into supported account types.
const normaliseAccountType = (incomingRole) => {
  if (incomingRole === 'coordinator') return 'coordinator';
  return 'student';
};

// Provision a participant account and attach them to an active event roster.
export const createParticipantAccount = async (req, res) => {
  try {
    const { name, email, password, role, school, department, registrationId, phone } = req.body;
    const eventId = req.params.id || req.body?.eventId;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (!eventId) {
      return res.status(400).json({ message: 'Active event is required to create an account' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!coordinatorOwnsEvent(event, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to add participants for this event' });
    }
    if (event.status === 'completed') {
      return res.status(400).json({ message: 'Event already completed' });
    }
    if (event.approvalStatus !== 'approved') {
      return res.status(400).json({ message: 'Event must be approved before adding participants' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: normaliseAccountType(role),
      school,
      department,
      registrationId,
      phone,
    });

    await Event.updateOne(
      { _id: event._id },
      { $addToSet: { attendees: user._id } }
    );

    await EventInvitation.findOneAndUpdate(
      { event: event._id, invitee: user._id },
      {
        $set: {
          invitedBy: req.user._id,
          roleAtEvent: 'attendee',
          status: 'accepted',
          respondedAt: new Date(),
        },
        $setOnInsert: {
          event: event._id,
          invitee: user._id,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      message: 'Participant account created and added to the event',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationId: user.registrationId,
        school: user.school,
        department: user.department,
        phone: user.phone,
      },
      eventId: event._id,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'A participant with this registration ID already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Allow coordinators to draft new events awaiting approval.
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      name,
      description,
      date,
      location,
      time,
      capacity,
      banner,
      school,
      department,
      category,
      eventFormat,
      deliveryMode,
      tags,
      sponsors,
      agenda,
      importantContacts,
      budget,
      invitationMode,
      allowSelfCheckIn,
      sdg, // Extract sdg
    } = req.body;

    const eventName = name || title;
    const tagList = parseList(tags);
    const sponsorList = parseList(sponsors);
    const parsedBudget = {
      currency: (budget && budget.currency) || 'INR',
      amount: budget && budget.amount ? Number(budget.amount) || 0 : 0,
    };

    const event = await Event.create({
      name: eventName,
      description,
      date,
      location,
      createdBy: req.user._id,
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
      agenda: parseAgenda(agenda),
      importantContacts: parseContacts(importantContacts),
      invitationMode: invitationMode === 'open' ? 'open' : 'invite-only',
      allowSelfCheckIn: allowSelfCheckIn !== false,
      sdg: parseList(sdg), // Save sdg
      status: 'draft',
      requiresApproval: true,
      approvalStatus: 'pending',
      coordinators: [req.user._id],
    });

    await EventInvitation.findOneAndUpdate(
      { event: event._id, invitee: req.user._id },
      {
        $set: {
          invitedBy: req.user._id,
          roleAtEvent: 'coordinator',
          status: 'accepted',
          respondedAt: new Date(),
        },
        $setOnInsert: {
          event: event._id,
          invitee: req.user._id,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an event owned by the coordinator and flag if the dean should re-review.
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!coordinatorOwnsEvent(event, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    const editableFields = [
      'name',
      'description',
      'date',
      'location',
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
      'sdg', // Add sdg to editable fields
    ];

    let requiresReapproval = false;

    for (const field of editableFields) {
      if (!(field in req.body)) continue;
      if (field === 'invitationMode') {
        const nextMode = req.body.invitationMode === 'open' ? 'open' : 'invite-only';
        if (event.invitationMode !== nextMode) {
          requiresReapproval = true;
        }
        event.invitationMode = nextMode;
        continue;
      }
      if (field === 'allowSelfCheckIn') {
        const nextValue = req.body.allowSelfCheckIn !== false;
        if (event.allowSelfCheckIn !== nextValue) {
          requiresReapproval = true;
        }
        event.allowSelfCheckIn = nextValue;
        continue;
      }
      if (event[field] !== req.body[field]) {
        requiresReapproval = true;
      }
      event[field] = req.body[field];
    }

    if ('sdg' in req.body) {
      event.sdg = parseList(req.body.sdg);
    }

    if ('tags' in req.body) {
      const newTags = parseList(req.body.tags);
      event.tags = newTags;
      requiresReapproval = true;
    }
    if ('sponsors' in req.body) {
      event.sponsors = parseList(req.body.sponsors);
      requiresReapproval = true;
    }
    if ('agenda' in req.body) {
      event.agenda = parseAgenda(req.body.agenda);
      requiresReapproval = true;
    }
    if ('importantContacts' in req.body) {
      event.importantContacts = parseContacts(req.body.importantContacts);
    }
    if ('budget' in req.body) {
      const nextBudget = req.body.budget || {};
      event.budget = {
        currency: nextBudget.currency || event.budget?.currency || 'INR',
        amount: nextBudget.amount ? Number(nextBudget.amount) || 0 : event.budget?.amount || 0,
      };
      requiresReapproval = true;
    }

    if ('status' in req.body) {
      const status = req.body.status;
      if (['draft', 'scheduled', 'ongoing', 'completed'].includes(status)) {
        event.status = status;
      }
    }

    if (requiresReapproval && event.approvalStatus === 'approved') {
      event.approvalStatus = 'pending';
      event.requiresApproval = true;
      event.approvedBy = undefined;
      event.approvedAt = undefined;
      if (event.status !== 'completed') {
        event.status = 'draft';
      }
    }

    await event.save();

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Soft governance: remove events a coordinator owns when necessary.
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!coordinatorOwnsEvent(event, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await Event.deleteOne({ _id: event._id });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Return a list of potential invitees filtered by role to help build teams.
export const getDirectory = async (req, res) => {
  try {
    const role = req.query?.role === 'coordinator' ? 'coordinator' : 'student';
    const filter = { role };

    if (req.query?.school) {
      filter.school = req.query.school;
    }
    if (req.query?.department) {
      filter.department = req.query.department;
    }

    const users = await User.find(filter)
      .select('name email school department role')
      .sort({ school: 1, department: 1, name: 1 })
      .lean();

    const grouping = new Map();

    users.forEach((user) => {
      const schoolName = (user.school || 'Unassigned').trim() || 'Unassigned';
      const departmentName = (user.department || 'General').trim() || 'General';

      if (!grouping.has(schoolName)) {
        grouping.set(schoolName, new Map());
      }
      const deptMap = grouping.get(schoolName);

      if (!deptMap.has(departmentName)) {
        deptMap.set(departmentName, []);
      }
      deptMap.get(departmentName).push({
        id: user._id?.toString?.() || String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        school: user.school || schoolName,
        department: user.department || departmentName,
      });
    });

    const schools = Array.from(grouping.entries()).map(([schoolName, departments]) => ({
      school: schoolName,
      totalMembers: Array.from(departments.values()).reduce((sum, members) => sum + members.length, 0),
      departments: Array.from(departments.entries()).map(([departmentName, members]) => ({
        department: departmentName,
        count: members.length,
        members,
      })),
    }));

    res.json({ role, schools });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
