// CRUD flows for user-facing notifications.
import Notification from '../models/Notification.js';

// Create a notification for a target user.
export const sendNotification = async (req, res) => {
  try {
    const { userId, message } = req.body;
    const notification = await Notification.create({ user: userId, message });
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Retrieve notifications for the authenticated user in reverse chronological order.
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Flag a notification as read once the user has seen it.
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
