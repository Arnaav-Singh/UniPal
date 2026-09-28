// Captures attendee feedback and ratings for events.
import mongoose from 'mongoose';


const feedbackSchema = new mongoose.Schema({
  feedbackID: { type: String, unique: true, default: function() { return this._id.toString(); } },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comments: { type: String }, // optional free-form remarks
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Feedback', feedbackSchema);
