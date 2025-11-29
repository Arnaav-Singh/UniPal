// Local email/password authentication and profile retrieval endpoints.
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

// Collapse legacy or aliased roles used by clients into the canonical set.
const normaliseRole = (incomingRole) => {
  const allowed = ['student', 'coordinator', 'dean', 'admin'];
  if (allowed.includes(incomingRole)) return incomingRole;
  if (incomingRole === 'superadmin') return 'dean';
  if (incomingRole === 'attender') return 'student';
  return 'student';
};

// Handle signup and normalise incoming roles to supported values.
export const register = async (req, res) => {
  try {
    const { name, email, password, role, school, department, designation } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const resolvedRole = normaliseRole(role);

    const user = await User.create({
      name,
      email,
      password,
      role: resolvedRole,
      school,
      department,
      designation,
    });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.school,
      department: user.department,
      designation: user.designation,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Authenticate with email/password and return a session token.
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: normaliseRole(user.role),
      school: user.school,
      department: user.department,
      designation: user.designation,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Respond with the hydrated user object set by auth middleware.
export const getProfile = async (req, res) => {
  res.json(req.user);
};
