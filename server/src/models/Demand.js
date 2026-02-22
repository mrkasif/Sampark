import mongoose from 'mongoose';

const demandSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: 'No additional details.', trim: true },
    count: { type: Number, default: 2 },
    zone: { type: String, required: true, index: true },
    postedAt: { type: String, required: true }
  },
  { timestamps: true }
);

export const Demand = mongoose.model('Demand', demandSchema);
