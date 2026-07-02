require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Get the User model AFTER connection
    const User = require('../models/User');

    const email = process.env.ADMIN_EMAIL || 'admin@saralpooja.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@1234';

    // Delete existing admin to ensure fresh creation
    await User.deleteOne({ email });
    console.log('Cleared existing admin (if any)...');

    // Create admin with plain password — model will hash it
    const admin = await User.create({
      name: 'Admin',
      email,
      password,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin created successfully!');
    console.log('   Email   :', email);
    console.log('   Password:', password);
    console.log('   Role    :', admin.role);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

seedAdmin();
