// High-level administrative controls for deans and superadmins.
import User from '../models/User.js';
import Event from '../models/Event.js';
import Feedback from '../models/Feedback.js';
import mongoose from 'mongoose';
import EventInvitation from '../models/EventInvitation.js';

// Search and filter across the user directory with dean scoping rules applied.
export const getAllUsers = async (req, res) => {
  try {
    const { role, roles, school, department, search, scope } = req.query || {};
    const normalizedScope = typeof scope === 'string' ? scope.trim().toLowerCase() : undefined;

    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : undefined;
    const roleListArray = Array.isArray(roles)
      ? roles
      : typeof roles === 'string'
        ? roles.split(',')
        : [];
    const roleList = roleListArray
      .map((r) => (typeof r === 'string' ? r.trim().toLowerCase() : ''))
      .filter(Boolean);

    const filters = {};

    if (req.user?.role === 'dean') {
      const defaultRoles = ['dean', 'superadmin', 'coordinator'];
      const allowedRoles = new Set(defaultRoles);
      let selectedRoles = roleList.length
        ? roleList
        : normalizedRole
          ? [normalizedRole]
          : defaultRoles;

      selectedRoles = selectedRoles.filter((r) => allowedRoles.has(r));
      if (selectedRoles.length === 0) {
        selectedRoles = defaultRoles;
      }

      filters.role = selectedRoles.length === 1 ? selectedRoles[0] : { $in: selectedRoles };

      if (school) {
        filters.school = school;
      } else if (normalizedScope === 'others' && req.user.school) {
        filters.school = { $ne: req.user.school };
      } else if (normalizedScope !== 'all' && req.user.school) {
        filters.school = req.user.school;
      }
    } else {
      if (roleList.length) {
        filters.role = roleList.length === 1 ? roleList[0] : { $in: roleList };
      } else if (normalizedRole) {
        filters.role = normalizedRole;
      }
      if (school) filters.school = school;
    }

    if (department) filters.department = department;

    const queryConditions = [{ _id: { $ne: req.user?._id } }];

    if (Object.keys(filters).length > 0) {
      queryConditions.push(filters);
    }

    if (search && typeof search === 'string') {
      const safeSearch = search.trim();
      if (safeSearch.length > 0) {
        queryConditions.push({
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { email: { $regex: safeSearch, $options: 'i' } },
            { school: { $regex: safeSearch, $options: 'i' } },
            { department: { $regex: safeSearch, $options: 'i' } },
          ],
        });
      }
    }

    const users = await User.find({ $and: queryConditions }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Allow privileged roles to remove an account after password confirmation.
export const deleteUser = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password confirmation is required' });
    }

    const actor = await User.findById(req.user?._id);
    if (!actor) {
      return res.status(401).json({ message: 'Session invalid. Please sign in again.' });
    }

    const passwordMatches = await actor.matchPassword(password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (actor._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (actor.role === 'dean' && !['coordinator', 'dean'].includes(user.role)) {
      return res.status(403).json({ message: 'Deans may only remove coordinators or fellow deans' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Give superadmins a filtered view of every event in the system.
export const getAllEvents = async (req, res) => {
  try {
    const filter = {};
    if (req.query?.school) filter.school = req.query.school;
    if (req.query?.department) filter.department = req.query.department;
    if (req.query?.status) filter.status = req.query.status;
    if (req.query?.approvalStatus) filter.approvalStatus = req.query.approvalStatus;

    const events = await Event.find(filter)
      .populate('createdBy', 'name email role designation')
      .populate('coordinators', 'name email role designation')
      .populate('approvedBy', 'name email role designation');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Hard delete an event when governance requires it.
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Review feedback system-wide or by specific event.
export const getAllFeedback = async (req, res) => {
  try {
    const filter = {};
    if (req.query?.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
      filter.event = req.query.eventId;
    }
    const feedbacks = await Feedback.find(filter)
      .populate('user', 'name email role')
      .populate('event', 'name date location');
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add a new dean-level operator to the platform.
export const createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, school, department, designation } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create({
      name,
      email,
      password,
      role: 'dean',
      school,
      department,
      designation: designation || 'Dean',
    });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.school,
      department: user.department,
      designation: user.designation,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Quickly seed multiple coordinator accounts from a payload.
export const bulkCreateCoordinators = async (req, res) => {
  try {
    const { coordinators } = req.body; // [{name,email,password,school,department}]
    if (!Array.isArray(coordinators) || coordinators.length === 0) {
      return res.status(400).json({ message: 'No coordinators provided' });
    }
    const docs = coordinators.map((c) => ({
      ...c,
      role: 'coordinator',
      school: c.school || req.user.school,
      department: c.department || req.user.department,
    }));
    const result = await User.insertMany(docs, { ordered: false });
    res.status(201).json({ created: result.length, importFailed: coordinators.length - result.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Attach a coordinator to an event and ensure an invitation is issued.
export const assignEventToCoordinator = async (req, res) => {
  try {
    const { coordinatorId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(coordinatorId)) {
      return res.status(400).json({ message: 'Invalid coordinator id' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      { $addToSet: { coordinators: new mongoose.Types.ObjectId(coordinatorId) } },
      { new: true }
    ).populate('coordinators', 'name email role designation');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    await EventInvitation.findOneAndUpdate(
      { event: event._id, invitee: coordinatorId },
      {
        $set: {
          invitedBy: req.user._id,
          roleAtEvent: 'coordinator',
          status: 'accepted',
          respondedAt: new Date(),
        },
        $setOnInsert: {
          event: event._id,
          invitee: coordinatorId,
        },
      },
      { upsert: true }
    );

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
