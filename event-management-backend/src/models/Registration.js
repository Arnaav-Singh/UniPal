// Links users to events and tracks approval state for participation.
import mongoose from 'mongoose';


const registrationSchema = new mongoose.Schema({
  regID: { type: String, unique: true, default: function() { return this._id.toString(); } },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

export default mongoose.model('Registration', registrationSchema);
