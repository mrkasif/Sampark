import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const PRIMARY_NAV_ITEMS = [
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'add-listing', label: 'Add Listing' },
  { id: 'dashboard', label: 'Impact' }
];

const SECONDARY_NAV_ITEMS = [
  { id: 'landing', label: 'Landing' },
  { id: 'demand', label: 'Demand Board' },
  { id: 'leaderboard', label: 'Leaderboard' }
];

const DEFAULT_CATEGORIES = ['Mobiles', 'Electronics', 'Furniture', 'Books', 'Fashion', 'Home'];
const DEFAULT_CONDITIONS = ['New', 'Like New', 'Used', 'Refurbished'];
const CATEGORY_REFERENCE_PRICE = {
  Mobiles: 22000,
  Electronics: 30000,
  Furniture: 7000,
  Books: 600,
  Fashion: 1800,
  Home: 9000
};

const FALLBACK_LISTINGS = [
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

const FALLBACK_DEMANDS = [
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
  }
];

const FALLBACK_LEADERBOARD = [
  { zone: 'Kothrud Zone', co2Saved: 172, itemsReused: 81 },
  { zone: 'Aundh Zone', co2Saved: 158, itemsReused: 74 },
  { zone: 'Baner Zone', co2Saved: 149, itemsReused: 69 },
  { zone: 'Wakad Zone', co2Saved: 131, itemsReused: 62 }
];

const INITIAL_SUCCESSFUL_SWAPS = 24;

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function computeImpact(listings, successfulSwaps) {
  const itemsReused = listings.filter((item) => item.status === 'sold').length;
  const co2Saved = Number((itemsReused * 2.4 + successfulSwaps * 1.7).toFixed(1));
  return { itemsReused, successfulSwaps, co2Saved };
}

function computeLocalSwapSuggestions(listings, selectedListing, zone) {
  if (!selectedListing) {
    return [];
  }

  return listings
    .filter((item) => item.zone === zone && item.distance <= 5)
    .filter((candidate) => candidate.id !== selectedListing.id && candidate.status === 'available')
    .map((candidate) => {
      const ratio = Math.abs(candidate.price - selectedListing.price) / selectedListing.price;
      const compatibility = Math.max(65, Math.round(99 - ratio * 130));
      return { ...candidate, ratio, compatibility };
    })
    .filter((candidate) => candidate.ratio <= 0.2)
    .sort((a, b) => a.ratio - b.ratio);
}

function normalizeRisk(level, reason, source = 'heuristic') {
  const normalized = String(level || 'low').toLowerCase();
  if (normalized === 'high') {
    return { level: 'high', label: 'Suspicious Listing', emoji: '🔴', reason, source };
  }
  if (normalized === 'medium') {
    return { level: 'medium', label: 'Medium Risk', emoji: '🟡', reason, source };
  }
  return { level: 'low', label: 'Low Risk', emoji: '🟢', reason, source };
}

function analyzeRiskLocal({ description = '', price, category = '', condition = '' }) {
  const text = String(description).trim().toLowerCase();
  const numericPrice = Number(price);
  const referencePrice = Number(CATEGORY_REFERENCE_PRICE[category] || 10000);
  const cond = String(condition || '').toLowerCase();
  let score = 0;
  const reasons = [];

  if (/(urgent sale|need money now|must sell|sell fast|immediately)/i.test(text)) {
    score += 2;
    reasons.push('Pressure-based urgency language detected.');
  }
  if (/(advance payment|upi first|otp|pay now|whatsapp only|no meetup)/i.test(text)) {
    score += 3;
    reasons.push('Potential scam tone or payment request pattern.');
  }
  if (text.length < 28 || /(good condition|best item|serious buyers only)$/i.test(text)) {
    score += 1;
    reasons.push('Description is vague and lacks detail.');
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
  if (cond === 'new' && numericPrice > 0 && numericPrice < referencePrice * 0.5) {
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
    reasons[0] || 'Listing details look consistent.',
    'heuristic'
  );
}

function heuristicSuggestedPrice({ category = '', condition = 'Used' }) {
  const base = Number(CATEGORY_REFERENCE_PRICE[category] || 10000);
  const factor = {
    New: 1.1,
    'Like New': 0.95,
    Used: 0.75,
    Refurbished: 0.8
  }[condition] || 0.75;
  const suggestedPrice = Math.max(200, Math.round(base * factor));
  return {
    suggestedPrice,
    minPrice: Math.round(suggestedPrice * 0.9),
    maxPrice: Math.round(suggestedPrice * 1.1),
    reason: `Estimated from ${condition.toLowerCase()} ${category} listings.`
  };
}

function localNegotiationAdvice({ offerPrice, listedPrice, category }) {
  const offer = Number(offerPrice);
  const listed = Number(listedPrice);
  const reference = Number(CATEGORY_REFERENCE_PRICE[category] || listed || 10000);
  const offerDelta = listed > 0 ? (offer - listed) / listed : 0;
  const listedDelta = reference > 0 ? (listed - reference) / reference : 0;

  if (offerDelta <= -0.35) {
    return {
      type: 'lowball',
      message: `Offer is ${Math.round(Math.abs(offerDelta) * 100)}% below fair range. Consider counter-offer.`,
      severity: 'medium'
    };
  }
  if (listedDelta >= 0.3) {
    return {
      type: 'overpriced',
      message: 'Price is above neighborhood average. Consider a small reduction.',
      severity: 'medium'
    };
  }
  if (offerDelta >= -0.1 && offerDelta <= 0.1) {
    return {
      type: 'fair',
      message: 'This offer is within fair range and can close quickly.',
      severity: 'low'
    };
  }
  return {
    type: 'neutral',
    message: 'Offer looks negotiable. A minor counter-offer can help.',
    severity: 'low'
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed with ${response.status}`);
  }

  return response.json();
}

function App() {
  const [activePage, setActivePage] = useState('landing');
  const [currentZone] = useState('Kothrud Zone');
  const [apiStatus, setApiStatus] = useState('connecting');

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [listings, setListings] = useState(FALLBACK_LISTINGS);
  const [demands, setDemands] = useState(FALLBACK_DEMANDS);
  const [impact, setImpact] = useState(computeImpact(FALLBACK_LISTINGS, INITIAL_SUCCESSFUL_SWAPS));
  const [leaderboard, setLeaderboard] = useState(FALLBACK_LEADERBOARD);

  const [selectedListing, setSelectedListing] = useState(null);
  const [swapSuggestions, setSwapSuggestions] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapMessage, setSwapMessage] = useState('');

  const [aiDrafts, setAiDrafts] = useState({});
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [chatListing, setChatListing] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [postMessage, setPostMessage] = useState('');
  const [demandMessage, setDemandMessage] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verificationOtp, setVerificationOtp] = useState('');
  const [verificationOwnershipAccepted, setVerificationOwnershipAccepted] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginDemoOtp, setLoginDemoOtp] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginOwnershipAccepted, setLoginOwnershipAccepted] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [loginSendingOtp, setLoginSendingOtp] = useState(false);
  const [loginVerifyingOtp, setLoginVerifyingOtp] = useState(false);

  const [newListing, setNewListing] = useState({
    imageFile: null,
    title: '',
    description: '',
    price: '',
    category: DEFAULT_CATEGORIES[0],
    condition: DEFAULT_CONDITIONS[2]
  });

  const [newDemand, setNewDemand] = useState({
    title: '',
    notes: ''
  });

  const localListings = useMemo(
    () => listings.filter((item) => item.zone === currentZone && Number(item.distance) <= 5),
    [listings, currentZone]
  );

  const filteredListings = useMemo(() => {
    return localListings.filter((item) => {
      const byCategory = category === 'All' || item.category === category;
      const q = query.trim().toLowerCase();
      const byQuery = !q || item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      return byCategory && byQuery;
    });
  }, [localListings, category, query]);

  const localDemands = useMemo(
    () => demands.filter((item) => item.zone === currentZone),
    [demands, currentZone]
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const data = await request(`/api/bootstrap?zone=${encodeURIComponent(currentZone)}`, { method: 'GET' });
        if (!mounted) {
          return;
        }

        setApiStatus('online');
        setCategories(data.categories?.length ? data.categories : DEFAULT_CATEGORIES);
        setConditions(data.listingConditions?.length ? data.listingConditions : DEFAULT_CONDITIONS);
        setListings(data.listings || FALLBACK_LISTINGS);
        setDemands(data.demands || FALLBACK_DEMANDS);
        setImpact(data.impact || computeImpact(data.listings || FALLBACK_LISTINGS, INITIAL_SUCCESSFUL_SWAPS));
        setLeaderboard(data.leaderboard || FALLBACK_LEADERBOARD);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setApiStatus('offline');
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [currentZone]);

  useEffect(() => {
    let mounted = true;

    const loadSuggestions = async () => {
      if (!selectedListing) {
        setSwapSuggestions([]);
        return;
      }

      setSwapLoading(true);
      setAiDrafts({});
      setSwapMessage('');

      try {
        const data = await request('/api/swaps/suggestions', {
          method: 'POST',
          body: JSON.stringify({ listingId: selectedListing.id, zone: currentZone })
        });

        if (!mounted) {
          return;
        }

        setSwapSuggestions(data.suggestions || []);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setSwapSuggestions(computeLocalSwapSuggestions(listings, selectedListing, currentZone));
      } finally {
        if (mounted) {
          setSwapLoading(false);
        }
      }
    };

    loadSuggestions();

    return () => {
      mounted = false;
    };
  }, [selectedListing, currentZone, listings]);

  const handlePostListing = async (event) => {
    event.preventDefault();

    const parsedPrice = Number(newListing.price);
    if (
      !newListing.title.trim() ||
      !newListing.description.trim() ||
      Number.isNaN(parsedPrice) ||
      parsedPrice <= 0 ||
      !newListing.condition
    ) {
      setPostMessage('Please provide a valid title, description and price.');
      return;
    }
    if (!verifiedUserId) {
      setPostMessage('Please verify your phone number before uploading a listing.');
      return;
    }

    try {
      const image = newListing.imageFile ? await fileToDataUrl(newListing.imageFile) : '';

      const data = await request('/api/listings', {
        method: 'POST',
        body: JSON.stringify({
          title: newListing.title.trim(),
          description: newListing.description.trim(),
          price: parsedPrice,
          category: newListing.category,
          condition: newListing.condition,
          image,
          verifiedUserId,
          ownershipConfirmed: verificationOwnershipAccepted || Boolean(authUser),
          zone: currentZone
        })
      });

      setListings((prev) => [data.listing, ...prev]);
      setImpact(data.impact || impact);
      setLeaderboard(data.leaderboard || leaderboard);
      setPostMessage(
        `Listing posted: ${data.listing.risk?.emoji || '🟢'} ${data.listing.risk?.label || 'Low Risk'}`
      );
    } catch (error) {
      const imagePreview = newListing.imageFile ? URL.createObjectURL(newListing.imageFile) : '';
      const risk = analyzeRiskLocal({
        description: newListing.description,
        price: parsedPrice,
        category: newListing.category,
        condition: newListing.condition
      });
      const localListing = {
        id: Date.now(),
        title: newListing.title.trim(),
        description: newListing.description.trim(),
        price: parsedPrice,
        condition: newListing.condition,
        distance: Number((Math.random() * 4.5 + 0.4).toFixed(1)),
        category: newListing.category,
        zone: currentZone,
        image:
          imagePreview ||
          'https://images.unsplash.com/photo-1517142089942-ba376ce32a0f?auto=format&fit=crop&w=900&q=80',
        status: 'available',
        risk
      };

      setListings((prev) => [localListing, ...prev]);
      setPostMessage(`Posted locally: ${risk.emoji} ${risk.label}`);
    }

    setNewListing({
      imageFile: null,
      title: '',
      description: '',
      price: '',
      category: categories[0] || DEFAULT_CATEGORIES[0],
      condition: conditions[2] || DEFAULT_CONDITIONS[2]
    });
    setPriceSuggestion(null);
    setActivePage('marketplace');
  };

  const handleSendOtp = async () => {
    if (!verificationOwnershipAccepted) {
      setVerificationMessage('Please accept the ownership declaration before verification.');
      return;
    }
    if (!/^\d{10}$/.test(verificationPhone)) {
      setVerificationMessage('Enter a valid 10-digit phone number.');
      return;
    }
    setSendingOtp(true);
    setVerificationMessage('');
    try {
      const data = await request('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: verificationPhone })
      });
      setDemoOtp(data.demoOtp || '');
      setVerificationMessage(
        data.demoOtp
          ? `OTP sent. Demo OTP: ${data.demoOtp}`
          : 'OTP sent. Check your device and enter the code.'
      );
    } catch (error) {
      setDemoOtp('123456');
      setVerificationMessage('Backend unavailable. Use demo OTP: 123456');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLoginSendOtp = async () => {
    if (!loginOwnershipAccepted) {
      setLoginMessage('Please accept the ownership declaration before verification.');
      return;
    }
    if (!/^\d{10}$/.test(loginPhone)) {
      setLoginMessage('Enter a valid 10-digit phone number.');
      return;
    }
    setLoginSendingOtp(true);
    setLoginMessage('');
    try {
      const data = await request('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone })
      });
      setLoginDemoOtp(data.demoOtp || '');
      setLoginMessage(data.demoOtp ? `OTP sent. Demo OTP: ${data.demoOtp}` : 'OTP sent to your phone.');
    } catch (error) {
      setLoginDemoOtp('123456');
      setLoginMessage('Backend unavailable. Demo OTP: 123456');
    } finally {
      setLoginSendingOtp(false);
    }
  };

  const handleLoginVerifyOtp = async () => {
    if (!loginOtp.trim()) {
      setLoginMessage('Enter OTP first.');
      return;
    }
    if (authMode === 'register' && (!registerName.trim() || !registerEmail.trim())) {
      setLoginMessage('Enter name and email to register.');
      return;
    }
    setLoginVerifyingOtp(true);
    try {
      const data =
        authMode === 'register'
          ? await request('/api/auth/register', {
              method: 'POST',
              body: JSON.stringify({
                name: registerName.trim(),
                email: registerEmail.trim(),
                phone: loginPhone,
                otp: loginOtp
              })
            })
          : await request('/api/auth/login', {
              method: 'POST',
              body: JSON.stringify({ phone: loginPhone, otp: loginOtp })
            });
      const user =
        data.user || {
          userId: `usr_${loginPhone}`,
          phone: loginPhone,
          name: registerName.trim() || 'User',
          email: registerEmail.trim() || ''
        };
      setAuthUser(user);
      setVerifiedUserId(user.userId || '');
      setVerificationPhone(loginPhone);
      setVerificationMessage('Phone verified via login.');
      setLoginMessage(authMode === 'register' ? 'Registration successful.' : 'Login successful.');
      setShowLoginModal(false);
    } catch (error) {
      if (loginOtp === loginDemoOtp && loginDemoOtp) {
        const user = {
          userId: `usr_${loginPhone}`,
          phone: loginPhone,
          name: registerName.trim() || 'Demo User',
          email: registerEmail.trim() || ''
        };
        setAuthUser(user);
        setVerifiedUserId(user.userId);
        setVerificationPhone(loginPhone);
        setVerificationMessage('Phone verified in demo mode.');
        setLoginMessage(
          authMode === 'register'
            ? 'Registration successful (demo mode).'
            : 'Login successful (demo mode).'
        );
        setShowLoginModal(false);
      } else {
        setLoginMessage(
          authMode === 'register'
            ? 'Registration failed. Check OTP or try a new phone.'
            : 'Login failed. Check OTP or register first.'
        );
      }
    } finally {
      setLoginVerifyingOtp(false);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setVerifiedUserId('');
    setLoginPhone('');
    setLoginOtp('');
    setLoginDemoOtp('');
    setLoginMessage('');
    setLoginOwnershipAccepted(false);
    setRegisterName('');
    setRegisterEmail('');
  };

  const handleVerifyOtp = async () => {
    if (!verificationOtp.trim()) {
      setVerificationMessage('Enter OTP first.');
      return;
    }
    setVerifyingOtp(true);
    try {
      const data = await request('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: verificationPhone, otp: verificationOtp })
      });
      setVerifiedUserId(data.userId || '');
      setVerificationMessage('Phone verified. You can now publish listings.');
    } catch (error) {
      if (verificationOtp === demoOtp && demoOtp) {
        setVerifiedUserId(`usr_${verificationPhone}`);
        setVerificationMessage('Phone verified in demo mode.');
      } else {
        setVerifiedUserId('');
        setVerificationMessage('OTP verification failed.');
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSuggestPrice = async () => {
    if (!newListing.category || !newListing.condition) {
      setPostMessage('Select category and condition first.');
      return;
    }
    setSuggestionLoading(true);
    setPostMessage('');
    try {
      const data = await request('/api/ai/suggest-price', {
        method: 'POST',
        body: JSON.stringify({
          title: newListing.title,
          description: newListing.description,
          category: newListing.category,
          condition: newListing.condition
        })
      });
      const suggestion = data.suggestion;
      setPriceSuggestion(suggestion);
      if (suggestion?.suggestedPrice) {
        setNewListing((prev) => ({ ...prev, price: String(suggestion.suggestedPrice) }));
      }
    } catch (error) {
      const local = heuristicSuggestedPrice({
        category: newListing.category,
        condition: newListing.condition
      });
      setPriceSuggestion({ ...local, source: 'heuristic' });
      setNewListing((prev) => ({ ...prev, price: String(local.suggestedPrice) }));
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handlePostDemand = async (event) => {
    event.preventDefault();

    if (!newDemand.title.trim()) {
      setDemandMessage('Please enter an item name.');
      return;
    }

    try {
      const data = await request('/api/demands', {
        method: 'POST',
        body: JSON.stringify({
          title: newDemand.title.trim(),
          notes: newDemand.notes.trim(),
          zone: currentZone
        })
      });

      setDemands((prev) => [data.demand, ...prev]);
      setDemandMessage('Demand posted. Nearby neighbors can now respond.');
    } catch (error) {
      const localDemand = {
        id: Date.now(),
        title: newDemand.title.trim(),
        notes: newDemand.notes.trim() || 'No additional details.',
        count: Math.floor(Math.random() * 4) + 2,
        zone: currentZone,
        postedAt: new Date().toISOString().slice(0, 10)
      };

      setDemands((prev) => [localDemand, ...prev]);
      setDemandMessage('Demand posted in local demo mode.');
    }

    setNewDemand({ title: '', notes: '' });
  };

  const markAsSold = async (id) => {
    try {
      const data = await request(`/api/listings/${id}/sold`, { method: 'PATCH' });
      setListings((prev) => prev.map((item) => (item.id === id ? data.listing : item)));
      setImpact(data.impact || impact);
      setLeaderboard(data.leaderboard || leaderboard);
    } catch (error) {
      setListings((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'sold' } : item)));
      setImpact((prev) => ({
        ...prev,
        itemsReused: prev.itemsReused + 1,
        co2Saved: Number((prev.co2Saved + 2.4).toFixed(1))
      }));
    }
  };

  const handleSendSwapRequest = async () => {
    try {
      const data = await request('/api/swaps/request', {
        method: 'POST',
        body: JSON.stringify({})
      });

      setImpact(data.impact || impact);
      setSwapMessage(data.message || 'Swap request sent.');
    } catch (error) {
      setImpact((prev) => ({
        ...prev,
        successfulSwaps: prev.successfulSwaps + 1,
        co2Saved: Number((prev.co2Saved + 1.7).toFixed(1))
      }));
      setSwapMessage('Swap request sent in local demo mode.');
    }
  };

  const generateAiMessage = async (candidate) => {
    if (!selectedListing) {
      return;
    }

    setAiLoadingId(candidate.id);

    try {
      const data = await request('/api/ai/swap-message', {
        method: 'POST',
        body: JSON.stringify({
          listingTitle: selectedListing.title,
          candidateTitle: candidate.title,
          compatibility: candidate.compatibility,
          zone: currentZone
        })
      });

      setAiDrafts((prev) => ({
        ...prev,
        [candidate.id]: data.message
      }));
    } catch (error) {
      setAiDrafts((prev) => ({
        ...prev,
        [candidate.id]: `Hi, I can offer my ${selectedListing.title} for your ${candidate.title}. The match looks fair and I can exchange this week within ${currentZone}.`
      }));
    } finally {
      setAiLoadingId(null);
    }
  };

  const openNegotiationChat = (listing) => {
    setChatListing(listing);
    setChatInput('');
    setChatMessages([
      {
        role: 'assistant',
        text: `AI Fairness Assistant active for ${listing.title}. Share an offer amount and I will mediate.`,
        tone: 'neutral'
      }
    ]);
  };

  const sendChatMessage = async () => {
    if (!chatListing || !chatInput.trim()) {
      return;
    }

    const userText = chatInput.trim();
    const numeric = Number(userText.replace(/[^\d]/g, ''));
    setChatMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setChatInput('');

    if (!numeric || Number.isNaN(numeric)) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Please include a numeric offer amount so I can evaluate fairness.',
          tone: 'neutral'
        }
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const data = await request('/api/ai/negotiation-assist', {
        method: 'POST',
        body: JSON.stringify({
          offerPrice: numeric,
          listedPrice: chatListing.price,
          category: chatListing.category,
          condition: chatListing.condition || 'Used'
        })
      });
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.advice?.message || 'Offer reviewed.', tone: data.advice?.type || 'neutral' }
      ]);
    } catch (error) {
      const fallback = localNegotiationAdvice({
        offerPrice: numeric,
        listedPrice: chatListing.price,
        category: chatListing.category
      });
      setChatMessages((prev) => [...prev, { role: 'assistant', text: fallback.message, tone: fallback.type }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleQuickOffer = (ratio) => {
    if (!chatListing) {
      return;
    }
    setChatInput(String(Math.round(chatListing.price * ratio)));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Sampark</div>
        <div className="zone-pill">{currentZone}</div>
        <div className={`system-pill ${apiStatus}`}>
          {apiStatus === 'online' ? 'Backend Connected' : apiStatus === 'offline' ? 'Demo Mode' : 'Connecting...'}
        </div>
        <button
          className="ghost-btn auth-btn"
          onClick={() => {
            if (authUser) {
              handleLogout();
              return;
            }
            setAuthMode('login');
            setShowLoginModal(true);
          }}
        >
          {authUser ? `Logout (${authUser.name || authUser.phone})` : 'Login'}
        </button>
        <nav className="nav-row primary">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-btn ${activePage === item.id ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.id);
                setSwapMessage('');
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <nav className="nav-row secondary">
          {SECONDARY_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-btn secondary ${activePage === item.id ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.id);
                setSwapMessage('');
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page-shell">
        {activePage === 'landing' && (
          <section className="landing-section">
            <p className="eyebrow">Hyperlocal Recommerce Platform</p>
            <h1>Buy & Sell Within 5km.</h1>
            <p className="subtext">No Middlemen. Just Sampark.</p>
            <button className="primary-btn" onClick={() => setActivePage('marketplace')}>
              Start Exploring
            </button>

            <div className="feature-grid">
              <article className="surface-card">
                <h3>5km Visibility Rule</h3>
                <p>Only neighbors in your zone can view listings, ensuring real hyperlocal trust and faster exchanges.</p>
              </article>
              <article className="surface-card">
                <h3>Smart Swap</h3>
                <p>Suggests fair swaps by value similarity within plus or minus 20 percent to keep exchange offers practical.</p>
              </article>
              <article className="surface-card">
                <h3>Sustainability Tracking</h3>
                <p>Every sold item and successful swap contributes to your community carbon savings in real time.</p>
              </article>
            </div>

            <div className="co2-strip">
              <span>Community CO2 Saved</span>
              <strong>{impact.co2Saved} kg</strong>
            </div>
          </section>
        )}

        {activePage === 'marketplace' && (
          <section>
            <div className="section-head">
              <div>
                <h2>Marketplace Feed</h2>
                <p>{currentZone} listings within 5km radius</p>
              </div>
              <div className="stat-inline">
                <div>
                  <span>CO2 Saved</span>
                  <strong>{impact.co2Saved} kg</strong>
                </div>
                <div>
                  <span>Items Reused</span>
                  <strong>{impact.itemsReused}</strong>
                </div>
              </div>
            </div>

            <div className="filters-row">
              <input
                type="text"
                placeholder="Search listings"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="All">All Categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="card-grid">
              {filteredListings.map((item) => (
                <article key={item.id} className="listing-card">
                  <img src={item.image} alt={item.title} />
                  <div className="card-content">
                    <h3>{item.title}</h3>
                    <p className="price-text">{formatCurrency(item.price)}</p>
                    <div className={`trust-strip risk-${item.risk?.level || 'low'}`}>
                      <p className="trust-label">Trust AI</p>
                      <p className="risk-chip">
                        {item.risk?.emoji || '🟢'} {item.risk?.label || 'Low Risk'}
                      </p>
                      <p className="meta-text">{item.risk?.reason || 'Listing details look consistent.'}</p>
                    </div>
                    <p className="meta-text">{item.distance} km away</p>
                    <div className="action-row">
                      <button className="ghost-btn" onClick={() => openNegotiationChat(item)}>
                        Message Seller
                      </button>
                      <button
                        className="primary-btn"
                        onClick={() => {
                          setSelectedListing(item);
                          setSwapMessage('');
                        }}
                      >
                        Propose Swap
                      </button>
                    </div>
                    {item.status === 'available' ? (
                      <button className="link-btn" onClick={() => markAsSold(item.id)}>
                        Mark as Sold
                      </button>
                    ) : (
                      <span className="status-chip">Sold</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activePage === 'add-listing' && (
          <section>
            <div className="section-head">
              <div>
                <h2>Add Listing</h2>
                <p>Post for your local 5km community.</p>
              </div>
            </div>

            <form className="form-card" onSubmit={handlePostListing}>
              <h3 className="form-step-title">Step 1: Verify User Identity</h3>
              {authUser ? (
                <div className="inline-actions">
                  <span className="verified-text">Logged in as {authUser.phone}</span>
                </div>
              ) : (
                <>
                  <div className="legal-notice">
                    <p className="legal-title">Ownership Declaration</p>
                    <p>
                      By verifying, you confirm items listed on Sampark are legally owned by you and are not stolen,
                      counterfeit, or prohibited. Fraudulent activity may lead to account suspension and reporting to
                      law enforcement.
                    </p>
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={verificationOwnershipAccepted}
                      onChange={(event) => setVerificationOwnershipAccepted(event.target.checked)}
                    />
                    <span>I confirm the listed items are legally mine to sell.</span>
                  </label>
                  <label>
                    Verify User (Phone)
                    <input
                      type="tel"
                      placeholder="10-digit phone"
                      value={verificationPhone}
                      onChange={(event) => setVerificationPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                  </label>
                  <div className="inline-actions">
                    <button type="button" className="ghost-btn" onClick={handleSendOtp} disabled={sendingOtp}>
                      {sendingOtp ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                  </div>
                  <label>
                    OTP
                    <input
                      type="text"
                      placeholder="Enter OTP"
                      value={verificationOtp}
                      onChange={(event) => setVerificationOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </label>
                  <div className="inline-actions">
                    <button type="button" className="ghost-btn" onClick={handleVerifyOtp} disabled={verifyingOtp}>
                      {verifyingOtp ? 'Verifying...' : 'Verify User'}
                    </button>
                    {verifiedUserId ? <span className="verified-text">Verified</span> : null}
                  </div>
                </>
              )}
              {verificationMessage ? <p className="form-message">{verificationMessage}</p> : null}

              <h3 className="form-step-title">Step 2: Price with AI Guidance</h3>
              <label>
                Image Upload
                <input
                  type="file"
                  accept="image/*"
                  key={newListing.imageFile ? 'with-file' : 'empty-file'}
                  onChange={(event) =>
                    setNewListing((prev) => ({ ...prev, imageFile: event.target.files?.[0] || null }))
                  }
                />
              </label>
              <label>
                Title
                <input
                  type="text"
                  value={newListing.title}
                  onChange={(event) => setNewListing((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Description
                <textarea
                  rows="4"
                  value={newListing.description}
                  onChange={(event) => setNewListing((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label>
                Price
                <input
                  type="number"
                  min="1"
                  value={newListing.price}
                  onChange={(event) => setNewListing((prev) => ({ ...prev, price: event.target.value }))}
                />
              </label>
              <div className="inline-actions">
                <button type="button" className="ghost-btn" onClick={handleSuggestPrice} disabled={suggestionLoading}>
                  {suggestionLoading ? 'Analyzing...' : 'AI Suggest Price'}
                </button>
              </div>
              {priceSuggestion ? (
                <p className="meta-text">
                  Suggested: {formatCurrency(priceSuggestion.suggestedPrice)} (range {formatCurrency(priceSuggestion.minPrice)} -{' '}
                  {formatCurrency(priceSuggestion.maxPrice)}). {priceSuggestion.reason}
                </p>
              ) : null}
              <h3 className="form-step-title">Step 3: Final Classification</h3>
              <label>
                Category
                <select
                  value={newListing.category}
                  onChange={(event) => setNewListing((prev) => ({ ...prev, category: event.target.value }))}
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Condition
                <select
                  value={newListing.condition}
                  onChange={(event) => setNewListing((prev) => ({ ...prev, condition: event.target.value }))}
                >
                  {conditions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="primary-btn">
                Submit Listing
              </button>
              {postMessage ? <p className="form-message">{postMessage}</p> : null}
            </form>
          </section>
        )}

        {activePage === 'demand' && (
          <section>
            <div className="section-head">
              <div>
                <h2>I Need This</h2>
                <p>Ask your zone before buying new.</p>
              </div>
            </div>

            <form className="form-card" onSubmit={handlePostDemand}>
              <label>
                Item Needed
                <input
                  type="text"
                  value={newDemand.title}
                  onChange={(event) => setNewDemand((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Details
                <textarea
                  rows="3"
                  value={newDemand.notes}
                  onChange={(event) => setNewDemand((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
              <button type="submit" className="primary-btn">
                Post Demand
              </button>
              {demandMessage ? <p className="form-message">{demandMessage}</p> : null}
            </form>

            <div className="card-grid compact">
              {localDemands.map((item) => (
                <article key={item.id} className="surface-card demand-card">
                  <h3>{item.title}</h3>
                  <p>{item.notes}</p>
                  <strong>{item.count} neighbors are looking for this item.</strong>
                </article>
              ))}
            </div>
          </section>
        )}

        {activePage === 'leaderboard' && (
          <section>
            <div className="section-head">
              <div>
                <h2>Carbon Leaderboard</h2>
                <p>Zone level impact rankings</p>
              </div>
            </div>

            <div className="leaderboard-grid">
              {leaderboard.map((row, index) => (
                <article key={row.zone} className={`surface-card leaderboard-card ${index === 0 ? 'winner' : ''}`}>
                  <div>
                    <h3>{row.zone}</h3>
                    {index === 0 ? <span className="status-chip">Top Zone</span> : null}
                  </div>
                  <div className="leader-numbers">
                    <p>{row.co2Saved} kg CO2 saved</p>
                    <p>{row.itemsReused} items reused</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activePage === 'dashboard' && (
          <section>
            <div className="section-head">
              <div>
                <h2>Sustainability Dashboard</h2>
                <p>Community progress snapshot</p>
              </div>
            </div>

            <div className="metrics-grid">
              <article className="surface-card metric-card">
                <span>Total CO2 Saved</span>
                <strong>{impact.co2Saved} kg</strong>
              </article>
              <article className="surface-card metric-card">
                <span>Items Reused</span>
                <strong>{impact.itemsReused}</strong>
              </article>
              <article className="surface-card metric-card">
                <span>Successful Swaps</span>
                <strong>{impact.successfulSwaps}</strong>
              </article>
            </div>
          </section>
        )}
      </main>

      {selectedListing ? (
        <div className="modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Smart Swap Suggestions</h3>
            <p className="modal-subtitle">
              Suggestions for {selectedListing.title} in {currentZone} within 5km.
            </p>

            {swapSuggestions.length > 0 ? (
              <div className="swap-list">
                {swapSuggestions.map((candidate) => (
                  <article key={candidate.id} className="surface-card swap-item">
                    <div>
                      <h4>{candidate.title}</h4>
                      <p>{formatCurrency(candidate.price)}</p>
                      <p>{candidate.distance} km away</p>
                    </div>
                    <div className="swap-actions">
                      <span className="match-chip">{candidate.compatibility}% Match</span>
                      <button className="primary-btn" onClick={handleSendSwapRequest}>
                        Send Swap Request
                      </button>
                      <button className="ghost-btn" onClick={() => generateAiMessage(candidate)}>
                        {aiLoadingId === candidate.id ? 'Generating...' : 'AI Draft Message'}
                      </button>
                      {aiDrafts[candidate.id] ? <p className="meta-text">{aiDrafts[candidate.id]}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : swapLoading ? (
              <p className="empty-note">Finding relevant swap suggestions...</p>
            ) : (
              <p className="empty-note">
                No close value matches found right now. Suggestions use +/- 20% price similarity.
              </p>
            )}

            {swapMessage ? <p className="form-message">{swapMessage}</p> : null}

            <button className="ghost-btn" onClick={() => setSelectedListing(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {chatListing ? (
        <div className="modal-overlay" onClick={() => setChatListing(null)}>
          <div className="modal-card chat-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Negotiation Chat</h3>
            <p className="modal-subtitle">
              <span className="mediator-badge">AI Fairness Mediator</span> for {chatListing.title} ({formatCurrency(chatListing.price)})
            </p>
            <div className="quick-offers">
              <button className="ghost-btn" onClick={() => handleQuickOffer(0.8)}>Offer 80%</button>
              <button className="ghost-btn" onClick={() => handleQuickOffer(0.9)}>Offer 90%</button>
              <button className="ghost-btn" onClick={() => handleQuickOffer(0.95)}>Offer 95%</button>
            </div>

            <div className="chat-thread">
              {chatMessages.map((msg, idx) => (
                <div key={`${msg.role}-${idx}`} className={`chat-bubble ${msg.role} ${msg.tone || 'neutral'}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="chat-input-row">
              <input
                type="text"
                placeholder="Type your offer, e.g. 25000"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <button className="primary-btn" onClick={sendChatMessage} disabled={chatLoading}>
                {chatLoading ? 'Analyzing...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLoginModal ? (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{authMode === 'register' ? 'Register' : 'Login'}</h3>
            <p className="modal-subtitle">
              {authMode === 'register'
                ? 'Create account with OTP verification.'
                : 'Login with phone OTP.'}
            </p>
            <div className="inline-actions">
              <button
                type="button"
                className={`ghost-btn ${authMode === 'login' ? 'active-toggle' : ''}`}
                onClick={() => {
                  setAuthMode('login');
                  setLoginMessage('');
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={`ghost-btn ${authMode === 'register' ? 'active-toggle' : ''}`}
                onClick={() => {
                  setAuthMode('register');
                  setLoginMessage('');
                }}
              >
                Register
              </button>
            </div>
            <div className="form-card" style={{ maxWidth: '100%', marginTop: '0.8rem' }}>
              <div className="legal-notice">
                <p className="legal-title">Ownership Declaration</p>
                <p>
                  By verifying, you confirm items listed on Sampark are legally owned by you and are not stolen,
                  counterfeit, or prohibited. Fraudulent activity may lead to account suspension and reporting to law
                  enforcement.
                </p>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={loginOwnershipAccepted}
                  onChange={(event) => setLoginOwnershipAccepted(event.target.checked)}
                />
                <span>I accept this ownership declaration.</span>
              </label>
              {authMode === 'register' ? (
                <>
                  <label>
                    Full Name
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      placeholder="Enter email"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label>
                Phone
                <input
                  type="tel"
                  placeholder="10-digit phone"
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </label>
              <div className="inline-actions">
                <button type="button" className="ghost-btn" onClick={handleLoginSendOtp} disabled={loginSendingOtp}>
                  {loginSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
              <label>
                OTP
                <input
                  type="text"
                  placeholder="Enter OTP"
                  value={loginOtp}
                  onChange={(event) => setLoginOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>
              <div className="inline-actions">
                <button type="button" className="primary-btn" onClick={handleLoginVerifyOtp} disabled={loginVerifyingOtp}>
                  {loginVerifyingOtp
                    ? 'Verifying...'
                    : authMode === 'register'
                      ? 'Verify & Register'
                      : 'Verify & Login'}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setShowLoginModal(false)}>
                  Cancel
                </button>
              </div>
              {loginMessage ? <p className="form-message">{loginMessage}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;

