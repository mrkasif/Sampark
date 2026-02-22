import mongoose from 'mongoose';

const metricSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Metric = mongoose.model('Metric', metricSchema);
