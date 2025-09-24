require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const initializeAdmin = async () => {
  try {
    console.log('🔧 Initializing default admin account...');
    
    await connectDB();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('❌ Admin account already exists:', existingAdmin.username);
      process.exit(0);
    }

    // Create default admin
    const adminData = {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@actionsa.org.za',
      password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
      role: 'admin',
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin account created successfully!');
    console.log(`👤 Username: ${admin.username}`);
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔐 Password: ${adminData.password}`);
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
    process.exit(1);
  }
};

initializeAdmin();