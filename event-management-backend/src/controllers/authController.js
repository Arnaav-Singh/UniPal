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

// Determine the final role based on the staff category.
// - student        → always 'student'
// - non-teaching   → always 'coordinator'
// - teaching       → honour the role the user selected
const resolveRoleByCategory = (staffCategory, requestedRole) => {
  if (staffCategory === 'student') return 'student';
  if (staffCategory === 'non-teaching') return 'coordinator';
  // teaching staff — allow role selection
  return normaliseRole(requestedRole);
};

// Handle signup and normalise incoming roles to supported values.
export const register = async (req, res) => {
  try {
    const { name, email, password, role, school, department, designation, staffCategory, registrationId, section, semester } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const category = ['teaching', 'non-teaching', 'student'].includes(staffCategory)
      ? staffCategory
      : 'student';
    const resolvedRole = resolveRoleByCategory(category, role);

    const user = await User.create({
      name,
      email,
      password,
      role: resolvedRole,
      staffCategory: category,
      school,
      department,
      designation,
      registrationId: registrationId || undefined,
      section: section || undefined,
      semester: semester ? Number(semester) : undefined,
    });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffCategory: user.staffCategory,
      school: user.school,
      department: user.department,
      designation: user.designation,
      registrationId: user.registrationId,
      section: user.section,
      semester: user.semester,
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
      staffCategory: user.staffCategory,
      school: user.school,
      department: user.department,
      designation: user.designation,
      registrationId: user.registrationId,
      section: user.section,
      semester: user.semester,
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
