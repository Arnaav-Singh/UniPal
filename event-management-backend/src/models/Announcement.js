// Broadcasts campaign-style announcements optionally tied to specific events.
import mongoose from 'mongoose';


const announcementSchema = new mongoose.Schema({
  announceID: { type: String, required: true, unique: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // optional
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Announcement', announcementSchema);
