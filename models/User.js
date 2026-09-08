const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  // One super admin (seeded). Everyone else is "staff" with tickable permissions.
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  // A staff member can have BOTH: 'issue' (ticketer) and/or 'scan' (scanner).
  permissions: [{ type: String, enum: ['issue', 'scan'] }],
  isActive: { type: Boolean, default: true },
  // Single active session enforcement
  activeSessionId: { type: String, default: null },
  sessionLastActiveAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.activeSessionId;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
