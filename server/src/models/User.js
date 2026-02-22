import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, unique: true, index: true },
    verified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
