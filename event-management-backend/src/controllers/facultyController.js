// Manage the faculty directory leveraged by the events workflow.
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';

// List all faculty members stored in the directory.
export const getAllFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.find();
    res.json(faculty);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add a faculty entry if one does not already exist for the email.
export const inviteFaculty = async (req, res) => {
  try {
    const { name, designation, department, email } = req.body;
    const exists = await Faculty.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Faculty already invited' });
    const faculty = await Faculty.create({ name, designation, department, email });
    res.status(201).json(faculty);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove an outdated faculty record.
export const deleteFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id);
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });
    res.json({ message: 'Faculty deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
