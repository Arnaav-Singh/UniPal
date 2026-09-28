// Core user profile model including role-based access metadata and password helpers.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';


const userSchema = new mongoose.Schema({
  userID: { type: String, unique: true, default: function () { return this._id.toString(); } },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  registrationId: { type: String, unique: true, sparse: true },
  phone: { type: String },
  school: { type: String },
  department: { type: String },
  designation: { type: String },
  role: {
    type: String,
    enum: ['dean', 'admin', 'coordinator', 'student', 'superadmin'],
    default: 'student',
  },
  authToken: { type: String },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
