import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Listing } from './models/Listing.js';
import { Demand } from './models/Demand.js';
import { User } from './models/User.js';
import { Otp } from './models/Otp.js';
import { Metric } from './models/Metric.js';

const app = express();

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sampark';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const OTP_PROVIDER = String(process.env.OTP_PROVIDER || 'demo').toLowerCase();
const OTP_ENABLE_DEMO_FALLBACK = String(process.env.OTP_ENABLE_DEMO_FALLBACK || 'true').toLowerCase() === 'true';
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'SMSIND';
const MSG91_COUNTRY_CODE = process.env.MSG91_COUNTRY_CODE || '91';

app.use(
  cors({
    origin: CLIENT_ORIGIN
  })
);
app.use(express.json({ limit: '2mb' }));

const categories = ['Mobiles', 'Electronics', 'Furniture', 'Books', 'Fashion', 'Home'];
const listingConditions = ['New', 'Like New', 'Used', 'Refurbished'];
const categoryReferencePrice = {
  Mobiles: 22000,
  Electronics: 30000,
  Furniture: 7000,
  Books: 600,
  Fashion: 1800,
  Home: 9000
};

const leaderboardSeed = [
  { zone: 'Kothrud Zone', co2Saved: 172, itemsReused: 81 },
  { zone: 'Aundh Zone', co2Saved: 158, itemsReused: 74 },
  { zone: 'Baner Zone', co2Saved: 149, itemsReused: 69 },
  { zone: 'Wakad Zone', co2Saved: 131, itemsReused: 62 }
];

const seedListings = [
  {
    id: 1,
    title: 'iPhone 13 128GB',
    description: 'Single owner phone in clean condition.',
    price: 38000,
    condition: 'Used',
    distance: 1.2,
    category: 'Mobiles',
    zone: 'Kothrud Zone',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    status: 'available'
  },
  {
    id: 2,
    title: 'Study Table',
    description: 'Solid wood table, good for WFH setup.',
    price: 5200,
    condition: 'Used',
    distance: 2.8,
    category: 'Furniture',
    zone: 'Kothrud Zone',
    image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80',
    status: 'available'
  },
  {
    id: 3,
    title: 'Canon EOS M50',
    description: 'Mirrorless camera with two lenses.',
    price: 42000,
    condition: 'Used',
    distance: 4.6,
    category: 'Electronics',
    zone: 'Kothrud Zone',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
    status: 'available'
  },
  {
    id: 4,
    title: 'Road Bike',
    description: 'Serviced recently, lightweight alloy frame.',
    price: 16000,
    condition: 'Used',
    distance: 5.7,
    category: 'Home',
    zone: 'Kothrud Zone',
    image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80',
    status: 'available'
  },
  {
    id: 5,
    title: 'MacBook Air M1',
    description: 'Battery health 93%, charger included.',
    price: 59000,
    condition: 'Used',
    distance: 2.1,
    category: 'Electronics',
    zone: 'Aundh Zone',
    image: 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
    status: 'available'
  },
  {
    id: 6,
    title: 'Bookshelf',
    description: '4 shelf unit, matte finish, easy assembly.',
    price: 2800,
    condition: 'Used',
    distance: 3.4,
    category: 'Furniture',
    zone: 'Kothrud Zone',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    status: 'sold'
  }
];

const seedDemands = [
  {
    id: 1,
    title: 'Office Chair',
    notes: 'Ergonomic and budget under 4k.',
    count: 3,
    zone: 'Kothrud Zone',
    postedAt: '2026-02-20'
  },
  {
    id: 2,
    title: 'Cycle Helmet',
    notes: 'Size M/L preferred.',
    count: 2,
    zone: 'Kothrud Zone',
    postedAt: '2026-02-19'
  },
  {
    id: 3,
    title: 'Monitor 24 inch',
    notes: 'IPS panel preferred.',
    count: 4,
    zone: 'Aundh Zone',
    postedAt: '2026-02-18'
  }
];

const normalizeRisk = (level, reason, source = 'heuristic') => {
  const normalized = String(level || 'low').toLowerCase();
  if (normalized === 'high') {
    return {
      level: 'high',
      label: 'Suspicious Listing',
      emoji: '🔴',
      reason: reason || 'Multiple suspicious patterns detected.',
      source
    };
  }
  if (normalized === 'medium') {
    return {
      level: 'medium',
      label: 'Medium Risk',
      emoji: '🟡',
      reason: reason || 'Some trust signals need closer review.',
      source
    };
  }
  return {
    level: 'low',
    label: 'Low Risk',
    emoji: '🟢',
    reason: reason || 'Listing details look consistent.',
    source
  };
};

const heuristicRiskAnalysis = ({ description = '', price, category = '', condition = '' }) => {
  const text = String(description).trim().toLowerCase();
  const numericPrice = Number(price);
  const referencePrice = Number(categoryReferencePrice[category] || 10000);
  const cond = String(condition || '').toLowerCase();

  let score = 0;
  const reasons = [];
  if (/(urgent sale|need money now|final offer today|must sell|leaving city|sell fast|immediately)/i.test(text)) {
    score += 2;
    reasons.push('Pressure-based urgency language detected.');
  }
  if (/(advance payment|upi first|pay now|otp|whatsapp only|no meetup|gift card)/i.test(text)) {
    score += 3;
    reasons.push('Potential scam tone or payment pattern detected.');
  }
  if (text.length < 28 || /(good condition|best item|like new|serious buyers only)$/i.test(text)) {
    score += 1;
    reasons.push('Description is vague and lacks specifics.');
  }
  if (Number.isFinite(numericPrice) && numericPrice > 0) {
    const ratio = numericPrice / referencePrice;
    if (ratio < 0.35) {
      score += 3;
      reasons.push('Price appears extremely below expected range.');
    } else if (ratio < 0.55) {
      score += 1;
      reasons.push('Price appears lower than expected for this category.');
    }
  }
  if (cond === 'new' && Number.isFinite(numericPrice) && numericPrice > 0 && numericPrice < referencePrice * 0.5) {
    score += 1;
    reasons.push('New-condition claim with unusually low price.');
  }

  let level = 'low';
  if (score >= 4) {
    level = 'high';
  } else if (score >= 2) {
    level = 'medium';
  }
  return normalizeRisk(
    level,
    reasons[0] || 'Listing has enough detail with no strong scam patterns in text or pricing.',
    'heuristic'
  );
};

const createOpenAIRiskAnalysis = async ({ description, price, category, condition }) => {
  const prompt = [
    'You are a trust and fraud analyst for a local marketplace.',
    'Classify this listing risk as low, medium, or high.',
    'Consider urgency pressure language, underpricing, vague text, and scam/payment tone.',
    'Return strict JSON only with keys: level, reason.',
    `Description: ${description}`,
    `Price: ${price}`,
    `Category: ${category}`,
    `Condition: ${condition}`
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: OPENAI_MODEL, input: prompt })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${details}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(String(data.output_text || '').trim());
  return normalizeRisk(parsed.level, parsed.reason, 'openai');
};

const analyzeListingRisk = async (payload) => {
  const fallback = heuristicRiskAnalysis(payload);
  if (!OPENAI_API_KEY) return fallback;
  try {
    return await createOpenAIRiskAnalysis(payload);
  } catch (_) {
    return fallback;
  }
};

const heuristicSuggestedPrice = ({ category = '', condition = 'Used' }) => {
  const base = Number(categoryReferencePrice[category] || 10000);
  const factor = { New: 1.1, 'Like New': 0.95, Used: 0.75, Refurbished: 0.8 }[condition] || 0.75;
  const suggestedPrice = Math.max(200, Math.round(base * factor));
  return {
    suggestedPrice,
    minPrice: Math.round(suggestedPrice * 0.9),
    maxPrice: Math.round(suggestedPrice * 1.1),
    reason: `Based on ${condition.toLowerCase()} condition in ${category} listings.`
  };
};

const createOpenAISuggestedPrice = async ({ title, description, category, condition }) => {
  const prompt = [
    'You are a pricing assistant for a hyperlocal resale marketplace in India.',
    'Estimate a fair selling price in INR.',
    'Return strict JSON with keys: suggestedPrice, minPrice, maxPrice, reason.',
    `Title: ${title || ''}`,
    `Description: ${description || ''}`,
    `Category: ${category}`,
    `Condition: ${condition}`
  ].join(' ');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, input: prompt })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${details}`);
  }
  const data = await response.json();
  const parsed = JSON.parse(String(data.output_text || '').trim());
  return {
    suggestedPrice: Math.max(200, Number(parsed.suggestedPrice) || 200),
    minPrice: Math.max(150, Number(parsed.minPrice) || 150),
    maxPrice: Math.max(250, Number(parsed.maxPrice) || 250),
    reason: String(parsed.reason || 'Estimated using listing details.')
  };
};

const suggestPrice = async (payload) => {
  const fallback = heuristicSuggestedPrice(payload);
  if (!OPENAI_API_KEY) return { ...fallback, source: 'heuristic' };
  try {
    return { ...(await createOpenAISuggestedPrice(payload)), source: 'openai' };
  } catch (_) {
    return { ...fallback, source: 'heuristic' };
  }
};

const heuristicNegotiationAssist = ({ offerPrice, listedPrice, category }) => {
  const offer = Number(offerPrice);
  const listed = Number(listedPrice);
  const reference = Number(categoryReferencePrice[category] || listed || 10000);
  const offerDelta = listed > 0 ? (offer - listed) / listed : 0;
  const listedDelta = reference > 0 ? (listed - reference) / reference : 0;

  if (offerDelta <= -0.35) {
    return {
      type: 'lowball',
      message: `Offer is ${Math.round(Math.abs(offerDelta) * 100)}% below fair range. Consider a counter-offer.`,
      severity: 'medium'
    };
  }
  if (listedDelta >= 0.3) {
    return {
      type: 'overpriced',
      message: 'Listed price is above neighborhood average. Consider reducing it slightly.',
      severity: 'medium'
    };
  }
  if (offerDelta >= -0.1 && offerDelta <= 0.1) {
    return {
      type: 'fair',
      message: 'This offer is within a fair negotiation range. You can close quickly.',
      severity: 'low'
    };
  }
  return {
    type: 'neutral',
    message: 'Offer looks reasonable. A small counter can help both sides agree.',
    severity: 'low'
  };
};

const createOpenAINegotiationAssist = async ({ offerPrice, listedPrice, category, condition }) => {
  const prompt = [
    'You are an AI Fairness Negotiation Assistant for a local resale marketplace.',
    'Be neutral and concise.',
    'Classify negotiation as one of: lowball, overpriced, fair, neutral.',
    'Return strict JSON with keys: type, message, severity.',
    `Offer price: ${offerPrice}`,
    `Listed price: ${listedPrice}`,
    `Category: ${category}`,
    `Condition: ${condition || 'Used'}`
  ].join(' ');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, input: prompt })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${details}`);
  }
  const data = await response.json();
  const parsed = JSON.parse(String(data.output_text || '').trim());
  return {
    type: String(parsed.type || 'neutral'),
    message: String(parsed.message || 'Offer looks reasonable.'),
    severity: String(parsed.severity || 'low')
  };
};

const negotiationAssist = async (payload) => {
  const fallback = heuristicNegotiationAssist(payload);
  if (!OPENAI_API_KEY) return { ...fallback, source: 'heuristic' };
  try {
    return { ...(await createOpenAINegotiationAssist(payload)), source: 'openai' };
  } catch (_) {
    return { ...fallback, source: 'heuristic' };
  }
};

const buildFallbackSwapMessage = ({
  listingTitle = 'your listing',
  candidateTitle = 'their item',
  compatibility = 80
}) =>
  `Hi, I am interested in swapping my ${listingTitle} for your ${candidateTitle}. The app shows a ${compatibility}% value match and I can do the exchange within our 5km zone this week.`;

const createOpenAISwapMessage = async ({ listingTitle, candidateTitle, compatibility, zone }) => {
  const prompt = [
    'Write a short, friendly, professional swap proposal message for a hyperlocal marketplace.',
    `Zone: ${zone}.`,
    `My item: ${listingTitle}.`,
    `Candidate item: ${candidateTitle}.`,
    `Compatibility score: ${compatibility}%.`,
    'Keep it under 70 words, confident and community-focused.'
  ].join(' ');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, input: prompt })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${details}`);
  }
  const data = await response.json();
  return String(data.output_text || '').trim();
};

const getMetricValue = async (key, defaultValue = 0) => {
  const metric = await Metric.findOne({ key }).lean();
  return metric ? Number(metric.value || 0) : defaultValue;
};

const setMetricValue = async (key, value) => {
  await Metric.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true });
};

const incrementMetric = async (key, amount = 1) => {
  const metric = await Metric.findOneAndUpdate(
    { key },
    { $inc: { value: amount } },
    { upsert: true, new: true }
  ).lean();
  return Number(metric.value || 0);
};

const nextId = async (Model) => {
  const latest = await Model.findOne().sort({ id: -1 }).select({ id: 1 }).lean();
  return (latest?.id || 0) + 1;
};

const getLocalListings = async (zone) =>
  Listing.find({ zone, distance: { $lte: 5 } }).sort({ id: -1 }).lean();

const getSwapSuggestions = async (listingId, zone) => {
  const source = await Listing.findOne({ id: Number(listingId) }).lean();
  if (!source) return [];
  const local = await getLocalListings(zone);
  return local
    .filter((candidate) => candidate.id !== source.id && candidate.status === 'available')
    .map((candidate) => {
      const ratio = Math.abs(candidate.price - source.price) / source.price;
      return { ...candidate, ratio };
    })
    .filter((candidate) => candidate.ratio <= 0.2)
    .map((candidate) => ({
      ...candidate,
      compatibility: Math.max(65, Math.round(99 - candidate.ratio * 130))
    }))
    .sort((a, b) => a.ratio - b.ratio);
};

const computeImpact = async () => {
  const [itemsReused, successfulSwaps] = await Promise.all([
    Listing.countDocuments({ status: 'sold' }),
    getMetricValue('successfulSwaps', 24)
  ]);
  const co2Saved = Number((itemsReused * 2.4 + successfulSwaps * 1.7).toFixed(1));
  return { itemsReused, co2Saved, successfulSwaps };
};

const computeLeaderboard = async (zone) => {
  const impact = await computeImpact();
  const rows = leaderboardSeed.map((row) => ({ ...row }));
  const idx = rows.findIndex((row) => row.zone === zone);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], co2Saved: impact.co2Saved, itemsReused: impact.itemsReused };
  } else {
    rows.push({ zone, co2Saved: impact.co2Saved, itemsReused: impact.itemsReused });
  }
  return rows.sort((a, b) => b.co2Saved - a.co2Saved);
};

const ensureSeedData = async () => {
  const listingCount = await Listing.countDocuments();
  if (listingCount === 0) {
    const withRisk = seedListings.map((item) => ({
      ...item,
      risk: heuristicRiskAnalysis({
        description: item.description,
        price: item.price,
        category: item.category,
        condition: item.condition
      })
    }));
    await Listing.insertMany(withRisk);
  }

  const demandCount = await Demand.countDocuments();
  if (demandCount === 0) {
    await Demand.insertMany(seedDemands);
  }

  const swapMetric = await Metric.findOne({ key: 'successfulSwaps' }).lean();
  if (!swapMetric) {
    await setMetricValue('successfulSwaps', 24);
  }
};

const normalizeIndianNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `${MSG91_COUNTRY_CODE}${digits}`;
  }
  if (digits.length > 10 && digits.startsWith(MSG91_COUNTRY_CODE)) {
    return digits;
  }
  return digits;
};

const sendOtpViaMsg91 = async ({ phone, otp }) => {
  if (!MSG91_AUTH_KEY) {
    throw new Error('MSG91_AUTH_KEY is missing.');
  }
  const mobile = normalizeIndianNumber(phone);
  const message = encodeURIComponent(`Your Sampark verification OTP is ${otp}.`);
  const sender = encodeURIComponent(MSG91_SENDER_ID);
  const url = `https://api.msg91.com/api/sendotp.php?authkey=${encodeURIComponent(
    MSG91_AUTH_KEY
  )}&mobile=${encodeURIComponent(mobile)}&message=${message}&sender=${sender}&otp=${encodeURIComponent(otp)}`;

  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`MSG91 send failed: ${response.status} ${details}`);
  }
  const raw = await response.text();
  return raw;
};

const sendOtp = async ({ phone, otp }) => {
  if (OTP_PROVIDER === 'msg91') {
    await sendOtpViaMsg91({ phone, otp });
    return { provider: 'msg91' };
  }
  return { provider: 'demo' };
};

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    service: 'sampark-demo-server',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/bootstrap', async (req, res) => {
  try {
    const zone = String(req.query.zone || 'Kothrud Zone');
    const [listings, demands, impact, leaderboard] = await Promise.all([
      getLocalListings(zone),
      Demand.find({ zone }).sort({ id: -1 }).lean(),
      computeImpact(),
      computeLeaderboard(zone)
    ]);
    res.json({
      zone,
      categories,
      listingConditions,
      listings,
      demands,
      impact,
      leaderboard
    });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Provide a valid 10-digit phone number.' });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await Otp.findOneAndUpdate(
      { phone },
      { $set: { otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } },
      { upsert: true, new: true }
    );
    try {
      const sent = await sendOtp({ phone, otp });
      return res.json({
        sent: true,
        provider: sent.provider,
        ...(sent.provider === 'demo' ? { demoOtp: otp } : {})
      });
    } catch (sendError) {
      if (!OTP_ENABLE_DEMO_FALLBACK) {
        return res.status(502).json({
          sent: false,
          error: `OTP provider failed: ${String(sendError.message || sendError)}`
        });
      }
      return res.json({
        sent: true,
        provider: 'demo',
        warning: `OTP provider failed, demo fallback used: ${String(sendError.message || sendError)}`,
        demoOtp: otp
      });
    }
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const otp = String(req.body?.otp || '').trim();
    const entry = await Otp.findOne({ phone }).lean();
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now() || entry.otp !== otp) {
      return res.status(400).json({ verified: false, error: 'Invalid or expired OTP.' });
    }
    await Otp.deleteOne({ phone });
    const userId = `usr_${phone}`;
    await User.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          phone,
          name: `User ${phone.slice(-4)}`,
          email: `user${phone.slice(-4)}@sampark.local`
        },
        $set: { verified: true }
      },
      { upsert: true, new: true }
    );
    return res.json({ verified: true, userId });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const otp = String(req.body?.otp || '').trim();
    if (!name || !email || !/^\d{10}$/.test(phone) || !otp) {
      return res.status(400).json({ error: 'name, email, phone and otp are required.' });
    }

    const otpEntry = await Otp.findOne({ phone }).lean();
    if (!otpEntry || new Date(otpEntry.expiresAt).getTime() < Date.now() || otpEntry.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }
    const existing = await User.findOne({ phone }).lean();
    if (existing) {
      return res.status(409).json({ error: 'User already exists. Please login.' });
    }

    await Otp.deleteOne({ phone });
    const user = await User.create({
      userId: `usr_${phone}`,
      name,
      email,
      phone,
      verified: true
    });
    return res.status(201).json({ user: user.toObject() });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const otp = String(req.body?.otp || '').trim();
    if (!/^\d{10}$/.test(phone) || !otp) {
      return res.status(400).json({ error: 'phone and otp are required.' });
    }
    const otpEntry = await Otp.findOne({ phone }).lean();
    if (!otpEntry || new Date(otpEntry.expiresAt).getTime() < Date.now() || otpEntry.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }
    const user = await User.findOne({ phone }).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }
    await Otp.deleteOne({ phone });
    if (!user.verified) {
      await User.updateOne({ phone }, { $set: { verified: true } });
      user.verified = true;
    }
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/ai/suggest-price', async (req, res) => {
  try {
    const { title, description, category, condition } = req.body || {};
    if (!category || !condition) return res.status(400).json({ error: 'category and condition are required.' });
    return res.json({ suggestion: await suggestPrice({ title, description, category, condition }) });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/ai/negotiation-assist', async (req, res) => {
  try {
    const { offerPrice, listedPrice, category, condition } = req.body || {};
    if (!offerPrice || !listedPrice || !category) {
      return res.status(400).json({ error: 'offerPrice, listedPrice and category are required.' });
    }
    return res.json({ advice: await negotiationAssist({ offerPrice, listedPrice, category, condition }) });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const { title, description, price, category, image, zone, condition, verifiedUserId, ownershipConfirmed } =
      req.body || {};
    if (!title || !description || !price || !category || !zone || !condition || !verifiedUserId) {
      return res.status(400).json({
        error: 'title, description, price, category, condition, verifiedUserId, and zone are required.'
      });
    }
    if (ownershipConfirmed !== true) {
      return res.status(400).json({ error: 'Ownership declaration consent is required before posting.' });
    }
    const user = await User.findOne({ userId: String(verifiedUserId), verified: true }).lean();
    if (!user) {
      return res.status(403).json({ error: 'User is not verified. Please verify before posting.' });
    }

    const risk = await analyzeListingRisk({ description, price, category, condition });
    const listing = await Listing.create({
      id: await nextId(Listing),
      title: String(title).trim(),
      description: String(description).trim(),
      price: Number(price),
      condition,
      distance: Number((Math.random() * 4.5 + 0.4).toFixed(1)),
      category,
      zone,
      image:
        String(image || '').trim() ||
        'https://images.unsplash.com/photo-1517142089942-ba376ce32a0f?auto=format&fit=crop&w=900&q=80',
      status: 'available',
      risk
    });

    return res.status(201).json({
      listing: listing.toObject(),
      impact: await computeImpact(),
      leaderboard: await computeLeaderboard(zone)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/ai/risk-analyze', async (req, res) => {
  try {
    const { description, price, category, condition } = req.body || {};
    if (!description || !price || !category || !condition) {
      return res.status(400).json({ error: 'description, price, category, and condition are required.' });
    }
    return res.json({ risk: await analyzeListingRisk({ description, price, category, condition }) });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.patch('/api/listings/:id/sold', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const listing = await Listing.findOneAndUpdate({ id }, { $set: { status: 'sold' } }, { new: true }).lean();
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    return res.json({
      listing,
      impact: await computeImpact(),
      leaderboard: await computeLeaderboard(listing.zone)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/demands', async (req, res) => {
  try {
    const { title, notes, zone } = req.body || {};
    if (!title || !zone) return res.status(400).json({ error: 'title and zone are required.' });
    const demand = await Demand.create({
      id: await nextId(Demand),
      title: String(title).trim(),
      notes: String(notes || 'No additional details.').trim(),
      count: Math.floor(Math.random() * 4) + 2,
      zone,
      postedAt: new Date().toISOString().slice(0, 10)
    });
    return res.status(201).json({ demand: demand.toObject() });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/swaps/suggestions', async (req, res) => {
  try {
    const { listingId, zone } = req.body || {};
    if (!listingId || !zone) return res.status(400).json({ error: 'listingId and zone are required.' });
    return res.json({ suggestions: await getSwapSuggestions(listingId, zone) });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/swaps/request', async (_, res) => {
  try {
    await incrementMetric('successfulSwaps', 1);
    return res.json({
      message: 'Swap request sent successfully.',
      impact: await computeImpact()
    });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/ai/swap-message', async (req, res) => {
  const payload = req.body || {};
  if (!payload.listingTitle || !payload.candidateTitle) {
    return res.status(400).json({ error: 'listingTitle and candidateTitle are required.' });
  }
  try {
    if (!OPENAI_API_KEY) return res.json({ message: buildFallbackSwapMessage(payload), source: 'mock' });
    const message = await createOpenAISwapMessage(payload);
    if (!message) return res.json({ message: buildFallbackSwapMessage(payload), source: 'mock' });
    return res.json({ message, source: 'openai' });
  } catch (error) {
    return res.json({
      message: buildFallbackSwapMessage(payload),
      source: 'mock',
      warning: String(error.message || error)
    });
  }
});

const start = async () => {
  await mongoose.connect(MONGODB_URI);
  await ensureSeedData();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Sampark server running on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
