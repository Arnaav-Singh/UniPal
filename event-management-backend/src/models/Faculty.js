// Maintains contact info for faculty members referenced across the portal.
import mongoose from 'mongoose';


const facultySchema = new mongoose.Schema({
  name: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: String, required: true },
  email: { type: String, required: true, unique: true },
});

export default mongoose.model('Faculty', facultySchema);
