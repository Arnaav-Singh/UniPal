// Tracks invitations sent to users to collaborate or attend specific events.
import mongoose from 'mongoose';

const eventInvitationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roleAtEvent: {
    type: String,
    enum: ['coordinator', 'attendee'],
    default: 'attendee',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'revoked'],
    default: 'pending',
  },
  respondedAt: { type: Date },
  message: { type: String },
}, { timestamps: true });

eventInvitationSchema.index({ event: 1, invitee: 1 }, { unique: true });

export default mongoose.model('EventInvitation', eventInvitationSchema);
