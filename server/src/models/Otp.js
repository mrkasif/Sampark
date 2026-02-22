import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model('Otp', otpSchema);
