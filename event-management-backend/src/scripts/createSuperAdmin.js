// Utility script to bootstrap a dean/super admin account into a fresh database.
import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if dean already exists
    const existingSuperAdmin = await User.findOne({ email: 'admin@unievents.com' });
    if (existingSuperAdmin) {
      console.log('Dean account already exists');
      process.exit(0);
    }

    // Create dean user
    const superAdmin = await User.create({
      name: 'Dean',
      email: 'admin@unievents.com',
      password: 'superadmin123',
      role: 'dean'
    });

    console.log('Dean account created successfully:');
    console.log('Email: admin@unievents.com');
    console.log('Password: superadmin123');
    console.log('Role: dean');
    console.log('User ID:', superAdmin._id);

    process.exit(0);
  } catch (error) {
    console.error('Error creating dean account:', error);
    process.exit(1);
  }
};

createSuperAdmin();
