import mongoose from 'mongoose';

const riskSchema = new mongoose.Schema(
  {
    level: { type: String, default: 'low' },
    label: { type: String, default: 'Low Risk' },
    emoji: { type: String, default: '🟢' },
    reason: { type: String, default: 'Listing details look consistent.' },
    source: { type: String, default: 'heuristic' }
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    condition: { type: String, required: true },
    distance: { type: Number, required: true },
    category: { type: String, required: true },
    zone: { type: String, required: true, index: true },
    image: { type: String, default: '' },
    status: { type: String, default: 'available', index: true },
    risk: { type: riskSchema, default: () => ({}) }
  },
  { timestamps: true }
);

export const Listing = mongoose.model('Listing', listingSchema);
