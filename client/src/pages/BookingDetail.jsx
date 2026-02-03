import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi, hotelsApi, touristsApi, routesApi, transportApi, accommodationsApi, flightsApi, railwaysApi } from '../services/api';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import ItineraryPreview from '../components/booking/ItineraryPreview';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Trash2,
  Calendar,
  Users,
  User,
  MapPin,
  Home,
  Train,
  Plane,
  Building2,
  Plus,
  Bed,
  DollarSign,
  FileText,
  ClipboardList,
  List,
  Wand2,
  FileDown,
  ChevronDown,
  Car,
  Database,
  Download,
  Upload
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

// Import booking components
import TouristsList from '../components/booking/TouristsList';
import RoomingList from '../components/booking/RoomingList';
import RoomingListModule from '../components/booking/RoomingListModule';
import HotelRequestPreview from '../components/booking/HotelRequestPreview';
import CostSummary from '../components/booking/CostSummary';
import HotelAccommodationForm from '../components/booking/HotelAccommodationForm';

const statusLabels = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

const statusOptions = Object.entries(statusLabels);

// Transport ticket status options
const ticketStatusOptions = [
  { value: '', label: 'Not specified' },
  { value: 'Issued', label: 'Issued' },
  { value: 'Not issued', label: 'Not issued' }
];

// Countries list in English (ISO countries commonly used in tourism)
const countriesList = [
  { code: 'DE', name: 'Germany' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'IE', name: 'Ireland' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'CA', name: 'Canada' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'GE', name: 'Georgia' },
  { code: 'AM', name: 'Armenia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'IL', name: 'Israel' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' }
].sort((a, b) => a.name.localeCompare(b.name, 'en'));

// Helper function to get ticket status style
const getTicketStatusStyle = (status) => {
  if (status === 'Issued') {
    return 'bg-green-100 text-green-800 border-green-200';
  } else if (status === 'Not issued') {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const getTicketStatusIcon = (status) => {
  if (status === 'Issued') return '✓';
  if (status === 'Not issued') return '○';
  return '—';
};

// Migration v7: Keep user's saved vehicle data
// This runs ONCE when the module is loaded, before any component renders
(function migrateVehicles() {
  const migrationVersion = 'v7_vstrecha_prices';
  const lastMigration = localStorage.getItem('vehicleMigration');

  if (lastMigration !== migrationVersion) {
    // Don't clear vehicles anymore - keep user's saved data
    localStorage.setItem('vehicleMigration', migrationVersion);
    console.log('Migration version updated to', migrationVersion);
  }
})();

// Predefined flight data for selection
const PREDEFINED_FLIGHTS = {
  INTERNATIONAL: [
    {
      flightNumber: 'TK 368',
      airline: 'Turkish Airlines',
      route: 'IST - TAS',
      departure: 'IST',
      arrival: 'TAS',
      departureTime: '02:05',
      arrivalTime: '09:10'
    },
    {
      flightNumber: 'TK 371',
      airline: 'Turkish Airlines',
      route: 'TAS - IST',
      departure: 'TAS',
      arrival: 'IST',
      departureTime: '15:00',
      arrivalTime: '17:45'
    },
    {
      flightNumber: 'HY 251',
      airline: 'Uzbekistan Airways',
      route: 'IST - TAS',
      departure: 'IST',
      arrival: 'TAS',
      departureTime: '03:30',
      arrivalTime: '10:20'
    },
    {
      flightNumber: 'HY 252',
      airline: 'Uzbekistan Airways',
      route: 'TAS - IST',
      departure: 'TAS',
      arrival: 'IST',
      departureTime: '16:30',
      arrivalTime: '19:15'
    }
  ],
  DOMESTIC: [
    {
      flightNumber: 'HY 1053',
      airline: 'Uzbekistan Airways',
      route: 'TAS - UGC',
      departure: 'TAS',
      arrival: 'UGC',
      departureTime: '12:50',
      arrivalTime: '14:30'
    },
    {
      flightNumber: 'HY 1054',
      airline: 'Uzbekistan Airways',
      route: 'UGC - TAS',
      departure: 'UGC',
      arrival: 'TAS',
      departureTime: '15:30',
      arrivalTime: '17:10'
    },
    {
      flightNumber: 'HY 1007',
      airline: 'Uzbekistan Airways',
      route: 'TAS - SKD',
      departure: 'TAS',
      arrival: 'SKD',
      departureTime: '08:00',
      arrivalTime: '08:50'
    },
    {
      flightNumber: 'HY 1008',
      airline: 'Uzbekistan Airways',
      route: 'SKD - TAS',
      departure: 'SKD',
      arrival: 'TAS',
      departureTime: '09:50',
      arrivalTime: '10:40'
    }
  ]
};

// Predefined railway data for selection (Uzbekistan domestic trains)
// Prices from Opex → Transport → Train tab (from database)
const PREDEFINED_RAILWAYS = [
  // Tashkent → Samarkand
  {
    trainNumber: '764Т',
    trainName: 'Afrosiyob',
    route: 'Tashkent - Samarkand',
    departure: 'Tashkent',
    arrival: 'Samarkand',
    departureTime: '6:33',
    arrivalTime: '8:46',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '766Т',
    trainName: 'Afrosiyob',
    route: 'Tashkent - Samarkand',
    departure: 'Tashkent',
    arrival: 'Samarkand',
    departureTime: '7:30',
    arrivalTime: '9:49',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '768Т',
    trainName: 'Afrosiyob',
    route: 'Tashkent - Samarkand',
    departure: 'Tashkent',
    arrival: 'Samarkand',
    departureTime: '8:00',
    arrivalTime: '10:25',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '770Т',
    trainName: 'Afrosiyob',
    route: 'Tashkent - Samarkand',
    departure: 'Tashkent',
    arrival: 'Samarkand',
    departureTime: '8:30',
    arrivalTime: '10:49',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '710Т',
    trainName: 'Sharq',
    route: 'Tashkent - Samarkand',
    departure: 'Tashkent',
    arrival: 'Samarkand',
    departureTime: '8:37',
    arrivalTime: '11:46',
    priceEconomy: 200060,
    priceBusiness: 300560
  },
  {
    trainNumber: '716Т',
    trainName: 'Nasaf',
    route: 'Tashkent - Samarkand',
    departure: 'Tashkent',
    arrival: 'Samarkand',
    departureTime: '8:55',
    arrivalTime: '12:20',
    priceEconomy: 200060,
    priceBusiness: 300560
  },
  // Samarkand → Tashkent
  {
    trainNumber: '769S',
    trainName: 'Afrosiyob',
    route: 'Samarkand - Tashkent',
    departure: 'Samarkand',
    arrival: 'Tashkent',
    departureTime: '16:56',
    arrivalTime: '19:17',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '767S',
    trainName: 'Afrosiyob',
    route: 'Samarkand - Tashkent',
    departure: 'Samarkand',
    arrival: 'Tashkent',
    departureTime: '17:40',
    arrivalTime: '20:07',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '765S',
    trainName: 'Afrosiyob',
    route: 'Samarkand - Tashkent',
    departure: 'Samarkand',
    arrival: 'Tashkent',
    departureTime: '18:15',
    arrivalTime: '20:30',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '763S',
    trainName: 'Afrosiyob',
    route: 'Samarkand - Tashkent',
    departure: 'Samarkand',
    arrival: 'Tashkent',
    departureTime: '18:49',
    arrivalTime: '21:04',
    priceEconomy: 270000,
    priceBusiness: 396000
  },
  {
    trainNumber: '709S',
    trainName: 'Sharq',
    route: 'Samarkand - Tashkent',
    departure: 'Samarkand',
    arrival: 'Tashkent',
    departureTime: '19:23',
    arrivalTime: '23:06',
    priceEconomy: 179250,
    priceBusiness: 266800
  },
  {
    trainNumber: '715S',
    trainName: 'Nasaf',
    route: 'Samarkand - Tashkent',
    departure: 'Samarkand',
    arrival: 'Tashkent',
    departureTime: '20:24',
    arrivalTime: '23:54',
    priceEconomy: 179250,
    priceBusiness: 266800
  }
];

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';
  const startEditing = searchParams.get('edit') === 'true' || location.state?.editing === true;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew || startEditing);
  const [saving, setSaving] = useState(false);

  // Initialize activeTab from localStorage or default to 'info'
  const getInitialTab = () => {
    if (isNew) return 'info';
    try {
      const savedTab = localStorage.getItem(`bookingDetail_${id}_activeTab`);
      return savedTab || 'info';
    } catch (e) {
      return 'info';
    }
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab());
  const [flyRailwayTab, setFlyRailwayTab] = useState('fly'); // Sub-tab for Fly&Railway module
  const [documentsTab, setDocumentsTab] = useState('hotel-requests'); // Sub-tab for Documents module
  const [tourServicesTab, setTourServicesTab] = useState('hotels'); // Sub-tab for Tour Services module
  const [costsTab, setCostsTab] = useState('rl'); // Sub-tab for Costs module (payment methods)
  const [flights, setFlights] = useState([]);
  const [flightSections, setFlightSections] = useState([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [flightForm, setFlightForm] = useState({
    type: 'INTERNATIONAL',
    flightNumber: '',
    airline: '',
    route: '',
    departure: '',
    arrival: '',
    date: '',
    departureTime: '',
    arrivalTime: '',
    pax: 0,
    price: 0,
    tariff: 'economy',
    notes: ''
  });

  // Railway state
  const [railways, setRailways] = useState([]);
  const [railwaySections, setRailwaySections] = useState([]);
  const [loadingRailways, setLoadingRailways] = useState(false);
  const [railwayModalOpen, setRailwayModalOpen] = useState(false);
  const [editingRailway, setEditingRailway] = useState(null);
  const [railwayForm, setRailwayForm] = useState({
    trainNumber: '',
    trainName: '',
    route: '',
    departure: '',
    arrival: '',
    date: '',
    departureTime: '',
    arrivalTime: '',
    tariff: 'Economy',
    pricePerPerson: 0,
    pax: 0,
    price: 0,
    notes: ''
  });

  // Wrapper function to save tab to localStorage when changed
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (!isNew) {
      try {
        localStorage.setItem(`bookingDetail_${id}_activeTab`, tab);
      } catch (e) {
        console.error('Failed to save active tab to localStorage:', e);
      }
    }
  };

  const [tourTypes, setTourTypes] = useState([]);
  const [guides, setGuides] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [bookingRooms, setBookingRooms] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [roomsTotalAmount, setRoomsTotalAmount] = useState(0);
  const [tourists, setTourists] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [guestDates, setGuestDates] = useState({}); // Track individual guest check-in/out dates for Total calculation
  const [expandedHotels, setExpandedHotels] = useState({});
  const [editingTouristId, setEditingTouristId] = useState(null);
  const [editForm, setEditForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    roomPreference: '',
    accommodation: '',
    remarks: ''
  });
  // Accommodation-specific rooming lists (keyed by accommodationId)
  const [accommodationRoomingLists, setAccommodationRoomingLists] = useState({});

  // Track previous departureDate to detect when it changes
  const prevDepartureDateRef = useRef(null);

  // Calculate room counts from tourists' roomPreference/roomNumber
  // Room numbers are unique per accommodation group (Uzbekistan vs Turkmenistan)
  const calculatedRoomCounts = useMemo(() => {
    if (!tourists.length) {
      return { dbl: 0, twn: 0, sgl: 0, total: 0 };
    }

    // Count unique room numbers by type, considering accommodation group
    const roomNumbers = {
      DBL: new Set(),
      TWN: new Set(),
      SNGL: new Set(),
      TRPL: new Set(),
      other: new Set()
    };

    tourists.forEach(tourist => {
      const roomNumber = tourist.roomNumber;
      const preference = tourist.roomPreference?.toUpperCase() || '';
      const accommodation = tourist.accommodation || 'default';

      // Create unique key combining accommodation group and room number
      const uniqueKey = `${accommodation}::${roomNumber}`;

      if (roomNumber) {
        // Use roomNumber to determine room type and count unique rooms
        if (roomNumber.startsWith('DBL')) {
          roomNumbers.DBL.add(uniqueKey);
        } else if (roomNumber.startsWith('TWN')) {
          roomNumbers.TWN.add(uniqueKey);
        } else if (roomNumber.startsWith('SNGL') || roomNumber.startsWith('SGL')) {
          roomNumbers.SNGL.add(uniqueKey);
        } else if (roomNumber.startsWith('TRPL')) {
          roomNumbers.TRPL.add(uniqueKey);
        } else {
          roomNumbers.other.add(uniqueKey);
        }
      } else if (preference) {
        // Fallback: count by roomPreference if no roomNumber assigned
        // Use a unique identifier based on preference type
        if (preference === 'DBL') {
          roomNumbers.DBL.add(`${accommodation}::DBL-unassigned-${tourist.id}`);
        } else if (preference === 'TWN') {
          roomNumbers.TWN.add(`${accommodation}::TWN-unassigned-${tourist.id}`);
        } else if (preference === 'SNGL' || preference === 'SGL') {
          roomNumbers.SNGL.add(`${accommodation}::SNGL-${tourist.id}`);
        } else if (preference === 'TRPL') {
          roomNumbers.TRPL.add(`${accommodation}::TRPL-unassigned-${tourist.id}`);
        }
      }
    });

    // For unassigned DBL/TWN tourists, calculate rooms (2 per room)
    // Count unique rooms from assigned + estimate from unassigned
    const dblAssigned = [...roomNumbers.DBL].filter(r => !r.includes('unassigned')).length;
    const dblUnassigned = [...roomNumbers.DBL].filter(r => r.includes('unassigned')).length;
    const dbl = dblAssigned + Math.ceil(dblUnassigned / 2);

    const twnAssigned = [...roomNumbers.TWN].filter(r => !r.includes('unassigned')).length;
    const twnUnassigned = [...roomNumbers.TWN].filter(r => r.includes('unassigned')).length;
    const twn = twnAssigned + Math.ceil(twnUnassigned / 2);

    const sgl = roomNumbers.SNGL.size;

    const trplAssigned = [...roomNumbers.TRPL].filter(r => !r.includes('unassigned')).length;
    const trplUnassigned = [...roomNumbers.TRPL].filter(r => r.includes('unassigned')).length;
    const trpl = trplAssigned + Math.ceil(trplUnassigned / 3);

    const total = dbl + twn + sgl + trpl;

    return { dbl, twn, sgl, trpl, total };
  }, [tourists]);

  // Calculate Grand Total for all hotels (using Final List individual dates)
  // Re-renders when accommodations or accommodationRoomingLists changes
  const grandTotalData = useMemo(() => {
    if (accommodations.length === 0) return null;

    let grandTotalUSD = 0;
    let grandTotalUZS = 0;
    const hotelBreakdown = [];

    accommodations.forEach(acc => {
      if (!acc.rooms?.length || !acc.checkInDate || !acc.checkOutDate) return;

      // Use accommodation-specific rooming list if available
      let accTourists = accommodationRoomingLists[acc.id];

      // IMPORTANT: Filter to only show tourists with room numbers
      if (accTourists) {
        accTourists = accTourists.filter(t => t.roomNumber);
      }

      // Fallback: filter tourists by hotel name and date overlap if rooming list not loaded
      if (!accTourists) {
        accTourists = tourists.filter(t => {
          if (!t.hotelName || !acc.hotel?.name) return false;

          // Check hotel name match
          const hotelFirstWord = acc.hotel.name.toLowerCase().split(' ')[0];
          if (!t.hotelName.toLowerCase().includes(hotelFirstWord)) return false;

          // Check date overlap - tourist dates must overlap with accommodation dates
          if (t.checkInDate && t.checkOutDate && acc.checkInDate && acc.checkOutDate) {
            const touristCheckIn = new Date(t.checkInDate);
            const touristCheckOut = new Date(t.checkOutDate);
            const accCheckIn = new Date(acc.checkInDate);
            const accCheckOut = new Date(acc.checkOutDate);

            touristCheckIn.setHours(0, 0, 0, 0);
            touristCheckOut.setHours(0, 0, 0, 0);
            accCheckIn.setHours(0, 0, 0, 0);
            accCheckOut.setHours(0, 0, 0, 0);

            // Tourist dates must overlap with accommodation dates
            return touristCheckIn < accCheckOut && touristCheckOut > accCheckIn;
          }

          return true; // If no dates, match by hotel name only
        });
      }

      if (accTourists.length === 0) return;

      const accCheckIn = new Date(acc.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(acc.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);

      // Calculate guest-nights per room type FROM FINAL LIST
      const guestNightsPerRoomType = {};
      accTourists.forEach(tourist => {
        // Use INDIVIDUAL check-in/check-out dates from Final List
        const checkIn = tourist.checkInDate ? new Date(tourist.checkInDate) : accCheckIn;
        const checkOut = tourist.checkOutDate ? new Date(tourist.checkOutDate) : accCheckOut;
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);

        const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

        let roomType = (tourist.roomPreference || '').toUpperCase();
        if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
        if (roomType === 'TWIN') roomType = 'TWN';
        if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';

        if (!guestNightsPerRoomType[roomType]) {
          guestNightsPerRoomType[roomType] = 0;
        }
        guestNightsPerRoomType[roomType] += nights;
      });

      // Determine currency for this hotel (same logic as individual cards)
      const firstRoom = acc.rooms?.[0];
      const roomType = firstRoom ? acc.hotel?.roomTypes?.find(rt => rt.name === firstRoom.roomTypeCode) : null;
      let hotelCurrency = roomType?.currency || acc.hotel?.roomTypes?.[0]?.currency || 'UZS';

      // Auto-detect from room prices
      if (acc.rooms?.length > 0) {
        const firstRoomPrice = parseFloat(acc.rooms[0].pricePerNight) || 0;
        if (firstRoomPrice > 10000) {
          hotelCurrency = 'UZS';
        }
      }

      let hotelTotalUSD = 0;
      let hotelTotalUZS = 0;

      // Calculate cost ONLY from rooming list data (ignore saved rooms if no guests)
      acc.rooms.forEach(room => {
        const pricePerNight = parseFloat(room.pricePerNight) || 0;
        let normalizedRoomType = room.roomTypeCode?.toUpperCase();
        if (normalizedRoomType === 'DOUBLE') normalizedRoomType = 'DBL';
        if (normalizedRoomType === 'TWIN') normalizedRoomType = 'TWN';
        if (normalizedRoomType === 'SINGLE') normalizedRoomType = 'SNGL';

        const guestNights = guestNightsPerRoomType[normalizedRoomType] || 0;

        // Skip if no guests in rooming list for this room type (unless it's PAX which uses all guests)
        if (guestNights === 0 && normalizedRoomType !== 'PAX') return;

        // Convert guest-nights to room-nights
        let roomNights;
        if (normalizedRoomType === 'PAX') {
          roomNights = guestNights || accTourists.length; // For PAX, use total guest count if guestNights is 0
        } else if (normalizedRoomType === 'TWN' || normalizedRoomType === 'DBL') {
          roomNights = guestNights / 2;
        } else {
          roomNights = guestNights;
        }

        const roomCost = roomNights * pricePerNight;

        // Debug log
        console.log(`  [${acc.hotel?.name}] ${normalizedRoomType}: ${pricePerNight} → ${hotelCurrency} (first room price: ${parseFloat(acc.rooms[0].pricePerNight)})`);

        if (hotelCurrency === 'USD' || hotelCurrency === 'EUR') {
          grandTotalUSD += roomCost;
          hotelTotalUSD += roomCost;
        } else {
          grandTotalUZS += roomCost;
          hotelTotalUZS += roomCost;
        }
      });

      // Store breakdown with accommodation ID for proper matching
      hotelBreakdown.push({
        accommodationId: acc.id,
        hotel: acc.hotel?.name,
        USD: hotelTotalUSD,
        UZS: hotelTotalUZS
      });
    });

    // Debug Grand Total calculation
    console.log('\n🌍 GRAND TOTAL CALCULATION:');
    console.log('Hotel Breakdown:', hotelBreakdown);
    hotelBreakdown.forEach(h => {
      if (h.USD > 0) console.log(`  ${h.hotel}: USD ${h.USD.toFixed(2)}`);
      if (h.UZS > 0) console.log(`  ${h.hotel}: UZS ${h.UZS.toLocaleString()}`);
    });
    console.log(`  ─────────────────────────────`);
    if (grandTotalUSD > 0) console.log(`  💵 Total USD: $${grandTotalUSD.toFixed(2)}`);
    if (grandTotalUZS > 0) console.log(`  💸 Total UZS: ${grandTotalUZS.toLocaleString()} UZS`);

    if (grandTotalUSD === 0 && grandTotalUZS === 0) return null;

    // Separate hotels by currency - each hotel in only ONE group
    const usdHotels = [];
    const uzsHotels = [];

    hotelBreakdown.forEach(h => {
      // If hotel has both currencies, use the larger one
      if (h.USD > 0 && h.UZS > 0) {
        // Compare: rough conversion UZS to USD (1 USD ≈ 12,000 UZS)
        if (h.UZS > h.USD * 10000) {
          uzsHotels.push({ hotel: h.hotel, UZS: h.UZS, USD: 0 });
        } else {
          usdHotels.push({ hotel: h.hotel, USD: h.USD, UZS: 0 });
        }
      } else if (h.USD > 0) {
        usdHotels.push(h);
      } else if (h.UZS > 0) {
        uzsHotels.push(h);
      }
    });

    console.log('\n💰 HOTEL SEPARATION:');
    console.log('💵 USD Hotels:', usdHotels.map(h => `${h.hotel} ($${h.USD.toFixed(2)})`));
    console.log('💸 UZS Hotels:', uzsHotels.map(h => `${h.hotel} (${h.UZS.toLocaleString()} so'm)`));

    return {
      grandTotalUSD,
      grandTotalUZS,
      usdHotels,
      uzsHotels,
      hotelBreakdown  // Include full breakdown with accommodation IDs
    };
  }, [accommodations, accommodationRoomingLists, tourists]);

  // Room allocation modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [accommodationFormOpen, setAccommodationFormOpen] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState(null);
  const [editingRoomAlloc, setEditingRoomAlloc] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [roomTypeAvailabilities, setRoomTypeAvailabilities] = useState({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [roomAllocForm, setRoomAllocForm] = useState({
    hotelId: '',
    roomTypeId: '',
    quantity: 1,
    checkInDate: '',
    checkOutDate: '',
    pricePerNight: 0,
    notes: ''
  });

  // Route module state
  const [activeRouteTab, setActiveRouteTab] = useState('er');
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [selectedProviderTab, setSelectedProviderTab] = useState('sevil');
  const [editingRouteForProvider, setEditingRouteForProvider] = useState(null);

  // Default vehicle data (prices match ER-01)

  // Default vehicles - synced with Opex.jsx (names without person range)
  const defaultSevilVehicles = [
    { id: 1, name: 'Starex', seats: '7', person: '1-4', pickupDropoff: '', tagRate: 30, urgenchRate: 80, shovotRate2: '' },
    { id: 2, name: 'Joylong', seats: '30', person: '5-8', pickupDropoff: '', tagRate: 50, urgenchRate: 110, shovotRate2: 60 },
    { id: 3, name: 'Yutong 33', seats: '45', person: '9-20', pickupDropoff: '', tagRate: 50, urgenchRate: 160, shovotRate2: 120 },
  ];

  const defaultXayrullaVehicles = [
    { id: 1, name: 'Starex', seats: '7', person: '1-4', vstrecha: 35, chimgan: 100, tag: 85, oybek: 100, chernyayevka: 90, cityTour: 80 },
    { id: 2, name: 'Joylong', seats: '30', person: '5-8', vstrecha: 50, chimgan: 120, tag: 90, oybek: 100, chernyayevka: 110, cityTour: 100 },
    { id: 3, name: 'Sprinter', seats: '20', person: '9-16', vstrecha: 70, chimgan: 150, tag: 100, oybek: 120, chernyayevka: 130, cityTour: 120 },
    { id: 4, name: 'Yutong 33', seats: '45', person: '9-30', vstrecha: 80, chimgan: 220, tag: 130, oybek: 150, chernyayevka: 160, cityTour: 150 },
  ];

  const defaultNosirVehicles = [
    { id: 1, name: 'PKW', seats: '4', person: '1-2', margilan: '', qoqon: 20, dostlik: 60, toshkent: 170, extra: 60 },
    { id: 2, name: 'Starex', seats: '7', person: '3-4', margilan: 30, qoqon: 100, dostlik: 100, toshkent: 120, extra: '' },
    { id: 3, name: 'Joylong', seats: '30', person: '5-8', margilan: 80, qoqon: 180, dostlik: 180, toshkent: 200, extra: '' },
    { id: 4, name: 'Yutong 33', seats: '45', person: '9-20', margilan: 100, qoqon: 220, dostlik: 220, toshkent: '', extra: '' },
  ];

  // Vehicle data from API (initialized with defaults)
  const [sevilVehicles, setSevilVehicles] = useState(defaultSevilVehicles);
  const [xayrullaVehicles, setXayrullaVehicles] = useState(defaultXayrullaVehicles);
  const [nosirVehicles, setNosirVehicles] = useState(defaultNosirVehicles);

  // Route data - ER
  // Default ER route template - used for all ER bookings
  // dayOffset: days after Arrival (Arrival = Departure + 1, so dayOffset 0 = Arrival day)
  // Same dayOffset = same day (e.g., Train Drop-off + Samarkand City Tour on same day)
  const defaultERRoutesTemplate = [
    { id: 1, shahar: 'Tashkent', route: 'Tashkent City Tour', choiceTab: 'xayrulla', dayOffset: 0, choiceRate: 'cityTour' },
    { id: 2, shahar: 'Tashkent', route: 'Tashkent - Chimgan - Tashkent', choiceTab: 'xayrulla', dayOffset: 1, transportType: 'Sprinter', choiceRate: 'chimgan' },
    { id: 3, shahar: 'Tashkent', route: 'Train Station Drop-off', choiceTab: 'xayrulla', dayOffset: 2, choiceRate: 'vstrecha' },
    { id: 4, shahar: 'Samarkand', route: 'Samarkand City Tour', choiceTab: 'sevil', dayOffset: 2, choiceRate: 'tagRate' },  // Same day as row 3!
    { id: 5, shahar: 'Samarkand', route: 'Samarkand City Tour', choiceTab: 'sevil', dayOffset: 3, choiceRate: 'tagRate' },
    { id: 6, shahar: 'Samarkand', route: 'Samarkand City Tour', choiceTab: 'sevil', dayOffset: 4, choiceRate: 'tagRate' },
    { id: 7, shahar: 'Asraf', route: 'Samarkand - Asraf', choiceTab: 'sevil', dayOffset: 5, choiceRate: 'tagRate' },
    { id: 8, shahar: 'Bukhara', route: 'Asraf - Bukhara', choiceTab: 'sevil', dayOffset: 6, choiceRate: 'tagRate' },
    { id: 9, shahar: 'Bukhara', route: 'Bukhara City Tour', choiceTab: 'sevil', dayOffset: 7, choiceRate: 'tagRate' },
    { id: 10, shahar: 'Bukhara', route: 'Bukhara City Tour', choiceTab: 'sevil', dayOffset: 8, choiceRate: 'tagRate' },
    { id: 11, shahar: 'Khiva', route: 'Bukhara - Khiva', choiceTab: 'sevil', dayOffset: 9, choiceRate: 'tagRate' },
    { id: 12, shahar: 'Khiva', route: 'Khiva - Urgench', choiceTab: 'sevil', dayOffset: 10, choiceRate: 'urgenchRate' },
    { id: 13, shahar: 'Tashkent', route: 'Airport Pickup', choiceTab: 'xayrulla', dayOffset: 10, choiceRate: 'vstrecha' },
    { id: 14, shahar: 'Tashkent', route: 'Airport Drop-off', choiceTab: 'xayrulla', dayOffset: 11, choiceRate: 'vstrecha' },
    { id: 15, shahar: 'Khiva', route: 'Khiva - Shovot', choiceTab: 'sevil', dayOffset: 12, choiceRate: 'shovotRate' },
  ];

  const [erRoutes, setErRoutes] = useState([]);

  // Route sub-tabs configuration (only ER for now)
  const routeSubTabs = [
    { id: 'er', name: 'ER', icon: MapPin, color: 'blue' },
  ];

  const [formData, setFormData] = useState({
    bookingNumber: '',
    tourTypeId: '',
    country: '',
    departureDate: '',
    arrivalDate: '',
    endDate: '',
    pax: 0,
    paxUzbekistan: '',
    paxTurkmenistan: '',
    guideId: '',
    trainTickets: '',
    avia: '',
    roomsDbl: 0,
    roomsTwn: 0,
    roomsSngl: 0,
    roomsTotal: 0,
    status: 'PENDING',
    notes: ''
  });

  const [datesInitialized, setDatesInitialized] = useState(false);

  // Load vehicle data from API
  const loadVehiclesFromApi = async () => {
    try {
      const response = await transportApi.getAll();
      const { grouped } = response.data;

      if (grouped.sevil?.length > 0) setSevilVehicles(grouped.sevil);
      if (grouped.xayrulla?.length > 0) setXayrullaVehicles(grouped.xayrulla);
      if (grouped.nosir?.length > 0) setNosirVehicles(grouped.nosir);
    } catch (error) {
      console.error('Error loading vehicle data from API:', error);
      // Keep default values on error
    }
  };

  // Refresh vehicle data from API when component mounts or when updated
  useEffect(() => {
    // Load on mount
    loadVehiclesFromApi();

    // Listen for custom event from Opex page (same tab)
    const handleVehiclesUpdated = () => {
      loadVehiclesFromApi();
    };
    window.addEventListener('vehiclesUpdated', handleVehiclesUpdated);
    return () => {
      window.removeEventListener('vehiclesUpdated', handleVehiclesUpdated);
    };
  }, []);

  useEffect(() => {
    setDatesInitialized(false); // Reset when booking changes
    loadData();
  }, [id]);

  // Load accommodation-specific rooming lists for all accommodations
  useEffect(() => {
    if (accommodations.length > 0 && !isNew) {
      // Load rooming lists for all accommodations to ensure calculations are accurate
      accommodations.forEach(acc => {
        loadAccommodationRoomingList(acc.id);
      });
    }
  }, [accommodations.length, id]); // Trigger when accommodations count changes

  // Auto-populate route dates based on departure date (дата заезда)
  // Arrival in Tashkent = departure date + 1 day (tourists fly one day, arrive next day)

  useEffect(() => {
    if (formData.departureDate && erRoutes.length > 0 && !datesInitialized) {
      const departureDate = new Date(formData.departureDate);
      const firstExpectedDate = format(addDays(departureDate, 1), 'yyyy-MM-dd');

      // Always update dates on first load to match template dayOffset
      // Arrival date = departure + 1, so we add 1 to dayOffset
      const updatedRoutes = erRoutes.map((route, index) => {
        // Use dayOffset from route if available, otherwise use template or default
        const template = defaultERRoutesTemplate[index];
        const dayOffset = route.dayOffset ?? template?.dayOffset ?? index;
        const routeDate = addDays(departureDate, dayOffset + 1); // +1 for arrival date
        return {
          ...route,
          sana: format(routeDate, 'yyyy-MM-dd'),
          dayOffset: dayOffset
        };
      });
      setErRoutes(updatedRoutes);
      setDatesInitialized(true);
    }
  }, [formData.departureDate, erRoutes.length, datesInitialized]);

  // Auto-update route person count and dates when tourists change (from Rooming List import)
  useEffect(() => {
    if (tourists.length > 0 && erRoutes.length > 0) {
      const newPersonCount = tourists.length.toString();
      const departureDate = formData.departureDate ? new Date(formData.departureDate) : null;

      // Check if any route needs updating (person count or dates)
      // Arrival = departure + 1 day
      const needsUpdate = erRoutes.some(r => r.person !== newPersonCount) ||
        (departureDate && erRoutes.some((r, idx) => {
          const expectedDate = format(addDays(departureDate, idx + 1), 'yyyy-MM-dd');
          return r.sana !== expectedDate;
        }));

      if (needsUpdate) {
        const updatedRoutes = erRoutes.map((route, index) => {
          // Get best vehicle for this provider and new person count from localStorage data
          const count = parseInt(newPersonCount);
          let newTransportType = route.transportType;

          const vehicles = route.choiceTab === 'sevil' ? sevilVehicles
            : route.choiceTab === 'xayrulla' ? xayrullaVehicles
            : route.choiceTab === 'nosir' ? nosirVehicles
            : [];

          const suitable = vehicles.filter(v => {
            const personRange = v.person || '';
            if (personRange.includes('-')) {
              const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
              return !isNaN(min) && !isNaN(max) && count >= min && count <= max;
            }
            return false;
          });

          if (suitable.length > 0) {
            // For xayrulla and sevil: prefer Yutong over Sprinter when both match
            if (route.choiceTab === 'xayrulla' || route.choiceTab === 'sevil') {
              const yutong = suitable.find(v => v.name.toLowerCase().includes('yutong'));
              const sprinter = suitable.find(v => v.name.toLowerCase().includes('sprinter'));
              if (yutong && sprinter) {
                newTransportType = yutong.name; // Prefer Yutong over Sprinter
              } else {
                newTransportType = suitable[0].name;
              }
            } else {
              newTransportType = suitable[0].name;
            }
          }

          // Calculate date using dayOffset from route or template
          // Arrival date = departure + 1, so we add 1 to dayOffset
          const template = defaultERRoutesTemplate[index];
          const dayOffset = route.dayOffset ?? template?.dayOffset ?? index;
          const routeDate = departureDate ? format(addDays(departureDate, dayOffset + 1), 'yyyy-MM-dd') : route.sana;

          return {
            ...route,
            sana: routeDate,
            dayOffset: dayOffset,
            person: newPersonCount,
            transportType: newTransportType,
            // Clear rate and price if transport type changed
            choiceRate: newTransportType !== route.transportType ? '' : route.choiceRate,
            price: newTransportType !== route.transportType ? '' : route.price
          };
        });
        setErRoutes(updatedRoutes);
      }
    }
  }, [tourists.length, formData.departureDate, sevilVehicles, xayrullaVehicles, nosirVehicles]);

  // Auto-sync Arrival date with Tour Start date (departureDate + 1 day)
  // Updates arrivalDate when departureDate changes
  useEffect(() => {
    if (formData.departureDate) {
      const departureDate = new Date(formData.departureDate);
      const expectedArrivalDate = addDays(departureDate, 1);
      const expectedArrivalDateStr = format(expectedArrivalDate, 'yyyy-MM-dd');

      // Auto-update if departureDate has changed (comparing with previous value)
      if (prevDepartureDateRef.current !== formData.departureDate) {
        // departureDate changed, update arrivalDate
        setFormData(prev => ({
          ...prev,
          arrivalDate: expectedArrivalDateStr
        }));
        prevDepartureDateRef.current = formData.departureDate;
      }
    }
  }, [formData.departureDate]);

  // Auto-calculate PAX from tourists (Final List)
  // Count tourists by accommodation (Uzbekistan vs Turkmenistan)
  useEffect(() => {
    if (tourists.length > 0) {
      // Filter tourists by accommodation
      const uzbekistanTourists = tourists.filter(t => {
        const acc = (t.accommodation || '').toLowerCase();
        return !acc.includes('turkmen') && !acc.includes('туркмен');
      });

      const turkmenistanTourists = tourists.filter(t => {
        const acc = (t.accommodation || '').toLowerCase();
        return acc.includes('turkmen') || acc.includes('туркмен');
      });

      const uzbekCount = uzbekistanTourists.length;
      const turkmenCount = turkmenistanTourists.length;
      const totalCount = tourists.length;

      // Only update if values have changed
      if (
        parseInt(formData.paxUzbekistan) !== uzbekCount ||
        parseInt(formData.paxTurkmenistan) !== turkmenCount ||
        parseInt(formData.pax) !== totalCount
      ) {
        setFormData(prev => ({
          ...prev,
          paxUzbekistan: uzbekCount.toString(),
          paxTurkmenistan: turkmenCount.toString(),
          pax: totalCount
        }));
      }
    }
  }, [tourists]);

  const loadData = async () => {
    try {
      const [tourTypesRes, guidesRes, hotelsRes] = await Promise.all([
        tourTypesApi.getAll(),
        guidesApi.getAll(),
        hotelsApi.getAll()
      ]);
      setTourTypes(tourTypesRes.data.tourTypes);
      setGuides(guidesRes.data.guides);
      setHotels(hotelsRes.data.hotels || []);

      if (!isNew) {
        const [bookingRes, accommodationsRes, touristsRes, routesRes, railwaysRes] = await Promise.all([
          bookingsApi.getById(id),
          bookingsApi.getAccommodations(id),
          touristsApi.getAll(id),
          routesApi.getAll(id),
          railwaysApi.getAll(id)
        ]);
        const b = bookingRes.data.booking;
        setBooking(b);
        setBookingRooms(b.bookingRooms || []);
        setAccommodations(accommodationsRes.data.accommodations || []);
        setTourists(touristsRes.data.tourists || []);
        setRailways(railwaysRes.data.railways || []);

        // CRITICAL FOR ER TOURS: Load rooming lists for all accommodations
        // This ensures card view displays correct costs using backend-adjusted dates
        // Without this, Malika Khorazm and other hotels will show incorrect totals
        // DO NOT REMOVE this auto-load logic
        const accommodationsList = accommodationsRes.data.accommodations || [];
        if (accommodationsList.length > 0) {
          const roomingListPromises = accommodationsList.map(acc =>
            bookingsApi.getAccommodationRoomingList(id, acc.id)
              .then(response => ({ id: acc.id, data: response.data.roomingList || [] }))
              .catch(err => {
                console.error(`Error loading rooming list for accommodation ${acc.id}:`, err);
                return { id: acc.id, data: [] };
              })
          );
          const roomingListResults = await Promise.all(roomingListPromises);
          const roomingListsObj = {};
          roomingListResults.forEach(result => {
            roomingListsObj[result.id] = result.data;
          });
          setAccommodationRoomingLists(roomingListsObj);
        }

        // Load routes from database
        const loadedRoutes = routesRes.data.routes || [];
        setRoutes(loadedRoutes); // Store routes in state for Tour Services tab
        // For ER bookings: ALWAYS use template (ignore old database routes)
        // For non-ER bookings: use database if available
        if (loadedRoutes.length > 0 && b.tourType?.code !== 'ER') {
          // Helper to get vehicles by provider - use state values that match dropdown options
          // If localStorage has old data, use defaults
          const getVehiclesFromState = (provider) => {
            const getSavedOrDefault = (key, defaults) => {
              const saved = localStorage.getItem(key);
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed[0]?.person?.includes('-')) return parsed;
              }
              return defaults;
            };
            if (provider === 'sevil') return getSavedOrDefault('sevilVehicles', defaultSevilVehicles);
            if (provider === 'xayrulla') return getSavedOrDefault('xayrullaVehicles', defaultXayrullaVehicles);
            if (provider === 'nosir') return getSavedOrDefault('nosirVehicles', defaultNosirVehicles);
            return [];
          };
          const getVehicles = getVehiclesFromState;

          // Helper to find best vehicle based on person count
          // Prefers Yutong 33 over Sprinter when both match
          const findVehicle = (vehicles, personCount, provider) => {
            if (!personCount) return null;
            const count = parseInt(personCount);
            if (isNaN(count)) return null;

            const suitable = vehicles.filter(v => {
              const personRange = v.person || '';
              if (personRange.includes('-')) {
                const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
                return !isNaN(min) && !isNaN(max) && count >= min && count <= max;
              }
              return false;
            });

            if (suitable.length > 0) {
              // For xayrulla and sevil: prefer Yutong 33 over Sprinter
              if (provider === 'xayrulla' || provider === 'sevil') {
                const yutong = suitable.find(v => v.name.toLowerCase().includes('yutong'));
                const sprinter = suitable.find(v => v.name.toLowerCase().includes('sprinter'));
                if (yutong && sprinter) return yutong;
              }
              return suitable[0];
            }
            return null;
          };

          // Local helper: Auto-determine Rate Type based on route name and provider
          const localGetAutoRateType = (routeName, provider) => {
            if (!routeName || !provider) return '';
            const route = routeName.toLowerCase();
            if (provider === 'xayrulla') {
              if (route.includes('pickup') || route.includes('drop-off') || route.includes('train station')) return 'vstrecha';
              if (route.includes('chimgan') || route.includes('charvak')) return 'chimgan';
              if (route.includes('city tour')) return 'cityTour';
              return 'tag';
            }
            if (provider === 'sevil') {
              if (route.includes('pickup') || route.includes('drop-off') || route.includes('train station')) return 'pickupDropoff';
              if (route.includes('urgench')) return 'urgenchRate';
              if (route.includes('shovot')) return 'shovotRate';
              return 'tagRate';
            }
            if (provider === 'nosir') {
              if (route.includes('margilan')) return 'margilan';
              if (route.includes('kokand') || route.includes('qoqon')) return 'qoqon';
              return 'toshkent';
            }
            return '';
          };

          // Local helper: Get price from vehicle data
          const localGetPrice = (provider, transportType, rateType) => {
            if (!provider || !transportType || !rateType) return '';
            const vehicles = getVehicles(provider);
            const rateFieldMap = {
              'pickupDropoff': 'pickupDropoff', 'tagRate': 'tagRate', 'urgenchRate': 'urgenchRate', 'shovotRate': 'shovotRate2',
              'vstrecha': 'vstrecha', 'chimgan': 'chimgan', 'tag': 'tag', 'oybek': 'oybek', 'chernyayevka': 'chernyayevka', 'cityTour': 'cityTour',
              'margilan': 'margilan', 'qoqon': 'qoqon', 'dostlik': 'dostlik', 'toshkent': 'toshkent'
            };
            const rateField = rateFieldMap[rateType] || rateType;
            // Use partial matching to support both old names ("Yutong 33") and new names ("Yutong 33 (9-20)")
            const transportLower = transportType?.toLowerCase() || '';
            const vehicle = vehicles.find(v => {
              const vNameLower = v.name?.toLowerCase() || '';
              return vNameLower === transportLower || vNameLower.includes(transportLower) || transportLower.includes(vNameLower.split(' (')[0]);
            });
            if (vehicle && vehicle[rateField]) return vehicle[rateField].toString();
            return '';
          };

          // Get departure date for calculating arrival-based dates
          const bookingDepartureDate = b.departureDate ? new Date(b.departureDate) : null;
          // Get total PAX from tourists
          const totalPax = touristsRes.data.tourists?.length || 0;

          // Check if Chimgan route exists in loaded routes
          const hasChimganRoute = loadedRoutes.some(r =>
            r.routeName === 'Tashkent - Chimgan' || r.routeName === 'Tashkent - Chimgan - Tashkent' || r.routeName === 'Chimgan Excursion'
          );

          // If no Chimgan route, inject it after the last Airport Pickup in Tashkent
          let routesToProcess = loadedRoutes;
          if (!hasChimganRoute) {
            // Find the index of Airport Pickup in Tashkent (day 10) - usually near the end
            const lastAirportPickupIndex = loadedRoutes.findIndex((r, idx) =>
              idx >= 10 && r.routeName === 'Airport Pickup' && r.city === 'Tashkent'
            );
            if (lastAirportPickupIndex >= 0) {
              // Insert Chimgan route after Airport Pickup
              const chimganRoute = {
                id: 'chimgan-injected',
                routeName: 'Tashkent - Chimgan',
                city: 'Tashkent',
                provider: 'xayrulla',
                transportType: 'Sprinter',
                optionRate: 'chimgan',
                price: 150
              };
              routesToProcess = [
                ...loadedRoutes.slice(0, lastAirportPickupIndex + 1),
                chimganRoute,
                ...loadedRoutes.slice(lastAirportPickupIndex + 1)
              ];
            }
          }

          // Map routes and sort by date
          const mappedRoutes = routesToProcess.map((r, index) => {
            const provider = r.provider || '';
            // Use total PAX from tourists as person count
            const personCount = totalPax > 0 ? totalPax.toString() : (r.personCount?.toString() || '');
            const paxNum = parseInt(personCount) || 0;
            const vehicles = getVehicles(provider);
            const bestVehicle = findVehicle(vehicles, personCount, provider);

            // Special handling for Chimgan routes: ALWAYS use Sprinter
            const isChimganRoute = r.routeName === 'Tashkent - Chimgan' || r.routeName === 'Tashkent - Chimgan - Tashkent' || r.routeName === 'Chimgan Excursion';
            let transportType, finalProvider, finalRateType, finalPrice;

            if (isChimganRoute) {
              finalProvider = 'xayrulla';
              transportType = 'Sprinter';
              finalRateType = 'chimgan';
              finalPrice = localGetPrice('xayrulla', 'Sprinter', 'chimgan');
            } else {
              // Find all matching vehicles from localStorage data
              const suitable = vehicles.filter(v => {
                const personRange = v.person || '';
                if (personRange.includes('-')) {
                  const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
                  return !isNaN(min) && !isNaN(max) && paxNum >= min && paxNum <= max;
                }
                return false;
              });

              if (suitable.length > 0) {
                // For xayrulla and sevil: prefer Yutong 33 over Sprinter when both match
                if (provider === 'xayrulla' || provider === 'sevil') {
                  const yutong = suitable.find(v => v.name.toLowerCase().includes('yutong'));
                  const sprinter = suitable.find(v => v.name.toLowerCase().includes('sprinter'));
                  if (yutong && sprinter) {
                    transportType = yutong.name;
                  } else {
                    transportType = suitable[0].name;
                  }
                } else {
                  transportType = suitable[0].name;
                }
              } else {
                transportType = r.transportType || '';
              }
              finalProvider = provider;
              // Auto-calculate Rate Type if not saved
              const savedRateType = r.optionRate || '';
              finalRateType = savedRateType || localGetAutoRateType(r.routeName, finalProvider);
              // Auto-calculate Price if not saved
              const savedPrice = r.price?.toString() || '';
              finalPrice = savedPrice || (finalRateType && transportType
                ? localGetPrice(finalProvider, transportType, finalRateType)
                : '');
            }

            // Calculate date: Arrival + dayOffset
            // Row 3-4: same day | Row 11-12: skip one day | Row 12-13: same day | Row 14-15: same day
            let dayOffset;
            if (index === 0) dayOffset = 0;           // Row 1: Arrival
            else if (index === 1) dayOffset = 1;      // Row 2
            else if (index === 2) dayOffset = 2;      // Row 3
            else if (index === 3) dayOffset = 2;      // Row 4 (same as row 3!)
            else if (index <= 10) dayOffset = index - 1;  // Row 5-11
            else if (index === 11) dayOffset = 11;    // Row 12 (skip one day)
            else if (index === 12) dayOffset = 11;    // Row 13 (same as row 12!)
            else if (index === 13) dayOffset = 12;    // Row 14
            else if (index === 14) dayOffset = 12;    // Row 15 (same as row 14!)
            else dayOffset = index - 2;               // Row 16+

            const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, 1) : null;
            const routeDate = arrivalDate
              ? format(addDays(arrivalDate, dayOffset), 'yyyy-MM-dd')
              : (r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '');

            return {
              id: r.id,
              nomer: r.dayNumber?.toString() || '',
              sana: routeDate,
              dayOffset: dayOffset,
              shahar: r.city || '',
              route: r.routeName || '',
              person: personCount,
              transportType: transportType,
              choiceTab: finalProvider,
              choiceRate: finalRateType,
              price: finalPrice
            };
          });
          // Auto-sort routes by date after loading from database
          setErRoutes(sortRoutesByDate(mappedRoutes));
        } else if (b.tourType?.code === 'ER') {
          // No saved routes - try loading from database template first
          console.log('📋 No routes saved, checking database template for ER...');

          try {
            const templateResponse = await routesApi.getTemplate('ER');
            const templates = templateResponse.data.templates;

            if (templates && templates.length > 0) {
              console.log(`✅ Found ${templates.length} templates in database, using them`);
              const bookingDepartureDate = b.departureDate ? new Date(b.departureDate) : null;
              const totalPax = touristsRes.data.tourists?.length || 0;

              const loadedRoutes = templates.map((template, index) => {
                const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, 1) : null;
                const routeDate = arrivalDate ? format(addDays(arrivalDate, template.dayOffset), 'yyyy-MM-dd') : '';

                return {
                  id: index + 1,
                  nomer: template.dayNumber?.toString() || '',
                  sana: routeDate,
                  dayOffset: template.dayOffset,
                  shahar: template.city || '',
                  route: template.routeName || '',
                  person: totalPax.toString(),
                  transportType: '',
                  choiceTab: template.provider || '',
                  choiceRate: template.optionRate || '',
                  price: ''
                };
              });

              // Auto-sort routes by date after loading from template
              setErRoutes(sortRoutesByDate(loadedRoutes));
            } else {
              // No template in database, use hardcoded default
              console.log('⚠️ No template in database, using hardcoded default');
              throw new Error('No template found');
            }
          } catch (templateError) {
            // Fallback to hardcoded template
            console.log('📝 Using hardcoded default ER template');
            const bookingDepartureDate = b.departureDate ? new Date(b.departureDate) : null;
            const totalPax = touristsRes.data.tourists?.length || 0;

          // Helper to get vehicles by provider - use state values that match dropdown options
          const getVehiclesFromState = (provider) => {
            const getSavedOrDefault = (key, defaults) => {
              const saved = localStorage.getItem(key);
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed[0]?.person?.includes('-')) return parsed;
              }
              return defaults;
            };
            if (provider === 'sevil') return getSavedOrDefault('sevilVehicles', defaultSevilVehicles);
            if (provider === 'xayrulla') return getSavedOrDefault('xayrullaVehicles', defaultXayrullaVehicles);
            if (provider === 'nosir') return getSavedOrDefault('nosirVehicles', defaultNosirVehicles);
            return [];
          };
          const getVehicles = getVehiclesFromState;

          // Helper to find best vehicle based on person count
          // Prefers Yutong 33 over Sprinter when both match
          const findVehicle = (vehicles, personCount, provider) => {
            if (!personCount) return null;
            const count = parseInt(personCount);
            if (isNaN(count)) return null;
            const suitable = vehicles.filter(v => {
              const personRange = v.person || '';
              if (personRange.includes('-')) {
                const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
                return !isNaN(min) && !isNaN(max) && count >= min && count <= max;
              }
              return false;
            });

            if (suitable.length > 0) {
              // For xayrulla and sevil: prefer Yutong 33 over Sprinter
              if (provider === 'xayrulla' || provider === 'sevil') {
                const yutong = suitable.find(v => v.name.toLowerCase().includes('yutong'));
                const sprinter = suitable.find(v => v.name.toLowerCase().includes('sprinter'));
                if (yutong && sprinter) return yutong;
              }
              return suitable[0];
            }
            return null;
          };

          // Local helper: Auto-determine Rate Type
          const localGetAutoRateType = (routeName, provider) => {
            if (!routeName || !provider) return '';
            const route = routeName.toLowerCase();
            if (provider === 'xayrulla') {
              if (route.includes('pickup') || route.includes('drop-off') || route.includes('train station')) return 'vstrecha';
              if (route.includes('chimgan') || route.includes('charvak')) return 'chimgan';
              if (route.includes('city tour')) return 'cityTour';
              return 'tag';
            }
            if (provider === 'sevil') {
              if (route.includes('pickup') || route.includes('drop-off') || route.includes('train station')) return 'pickupDropoff';
              if (route.includes('urgench')) return 'urgenchRate';
              if (route.includes('shovot')) return 'shovotRate';
              return 'tagRate';
            }
            return '';
          };

          // Local helper: Get price from vehicle data
          const localGetPrice = (provider, transportType, rateType) => {
            if (!provider || !transportType || !rateType) return '';
            const vehicles = getVehicles(provider);
            const rateFieldMap = {
              'pickupDropoff': 'pickupDropoff', 'tagRate': 'tagRate', 'urgenchRate': 'urgenchRate', 'shovotRate': 'shovotRate2',
              'vstrecha': 'vstrecha', 'chimgan': 'chimgan', 'tag': 'tag', 'cityTour': 'cityTour'
            };
            const rateField = rateFieldMap[rateType] || rateType;
            // Use partial matching to support both old names ("Yutong 33") and new names ("Yutong 33 (9-20)")
            const transportLower = transportType?.toLowerCase() || '';
            const vehicle = vehicles.find(v => {
              const vNameLower = v.name?.toLowerCase() || '';
              return vNameLower === transportLower || vNameLower.includes(transportLower) || transportLower.includes(vNameLower.split(' (')[0]);
            });
            if (vehicle && vehicle[rateField]) return vehicle[rateField].toString();
            return '';
          };

          // Map routes from template
          const mappedTemplateRoutes = defaultERRoutesTemplate.map((template, index) => {
            const personCount = totalPax > 0 ? totalPax.toString() : '';
            const paxNum = parseInt(personCount) || 0;

            // Special handling for Chimgan routes: ALWAYS use Sprinter
            const isChimganRoute = template.route === 'Tashkent - Chimgan' || template.route === 'Tashkent - Chimgan - Tashkent' || template.route === 'Chimgan Excursion';
            if (isChimganRoute) {
              const chimganPrice = localGetPrice('xayrulla', 'Sprinter', 'chimgan');
              const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, 1) : null;
              let dayOffset;
              if (index === 0) dayOffset = 0;
              else if (index === 1) dayOffset = 1;
              else if (index === 2) dayOffset = 2;
              else if (index === 3) dayOffset = 2;
              else if (index <= 10) dayOffset = index - 1;
              else if (index === 11) dayOffset = 11;
              else if (index === 12) dayOffset = 11;
              else if (index === 13) dayOffset = 12;
              else if (index === 14) dayOffset = 12;
              else dayOffset = index - 2;
              const routeDate = arrivalDate ? format(addDays(arrivalDate, dayOffset), 'yyyy-MM-dd') : '';
              return {
                id: template.id,
                nomer: '',
                sana: routeDate,
                dayOffset: dayOffset,
                shahar: template.shahar,
                route: template.route,
                person: personCount,
                transportType: 'Sprinter',
                choiceTab: 'xayrulla',
                choiceRate: 'chimgan',
                price: chimganPrice
              };
            }

            // Vehicle selection from localStorage data
            let transportType = '';
            const vehicles = getVehicles(template.choiceTab);
            const suitable = vehicles.filter(v => {
              const personRange = v.person || '';
              if (personRange.includes('-')) {
                const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
                return !isNaN(min) && !isNaN(max) && paxNum >= min && paxNum <= max;
              }
              return false;
            });

            if (suitable.length > 0) {
              // For xayrulla and sevil: prefer Yutong 33 over Sprinter when both match
              if (template.choiceTab === 'xayrulla' || template.choiceTab === 'sevil') {
                const yutong = suitable.find(v => v.name.toLowerCase().includes('yutong'));
                const sprinter = suitable.find(v => v.name.toLowerCase().includes('sprinter'));
                if (yutong && sprinter) {
                  transportType = yutong.name;
                } else {
                  transportType = suitable[0].name;
                }
              } else {
                transportType = suitable[0].name;
              }
            }

            // Auto-calculate Rate Type based on route name
            const autoRateType = localGetAutoRateType(template.route, template.choiceTab);
            // Auto-calculate Price based on Rate Type
            const autoPrice = autoRateType && transportType
              ? localGetPrice(template.choiceTab, transportType, autoRateType)
              : '';

            // Calculate date: Arrival + dayOffset
            // Row 3-4: same day | Row 11-12: skip one day | Row 12-13: same day | Row 14-15: same day
            let dayOffset;
            if (index === 0) dayOffset = 0;
            else if (index === 1) dayOffset = 1;
            else if (index === 2) dayOffset = 2;
            else if (index === 3) dayOffset = 2;      // Same as row 3!
            else if (index <= 10) dayOffset = index - 1;
            else if (index === 11) dayOffset = 11;    // Row 12 (skip one day)
            else if (index === 12) dayOffset = 11;    // Row 13 (same as row 12!)
            else if (index === 13) dayOffset = 12;    // Row 14
            else if (index === 14) dayOffset = 12;    // Row 15 (same as row 14!)
            else dayOffset = index - 2;

            const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, 1) : null;
            const routeDate = arrivalDate
              ? format(addDays(arrivalDate, dayOffset), 'yyyy-MM-dd')
              : '';

            return {
              id: template.id,
              nomer: '',
              sana: routeDate,
              dayOffset: dayOffset,
              shahar: template.shahar,
              route: template.route,
              person: personCount,
              transportType: transportType,
              choiceTab: template.choiceTab,
              choiceRate: autoRateType,
              price: autoPrice
            };
          });
          // Auto-sort routes by date after loading from template
          setErRoutes(sortRoutesByDate(mappedTemplateRoutes));
          }
        }
        const uzbek = parseInt(b.paxUzbekistan) || 0;
        const turkmen = parseInt(b.paxTurkmenistan) || 0;

        // Only include Turkmenistan in PAX calculation for ER tour type
        const isER = b.tourType?.code === 'ER';
        const calculatedPax = isER ? (uzbek + turkmen) : uzbek;

        // Calculate arrivalDate as departureDate + 1 day
        const departureDateStr = b.departureDate ? format(new Date(b.departureDate), 'yyyy-MM-dd') : '';
        const arrivalDateStr = b.departureDate ? format(addDays(new Date(b.departureDate), 1), 'yyyy-MM-dd') : '';

        setFormData({
          bookingNumber: b.bookingNumber,
          tourTypeId: b.tourTypeId?.toString() || '',
          country: b.country || '',
          departureDate: departureDateStr,
          arrivalDate: arrivalDateStr, // Always departureDate + 1 day
          endDate: b.endDate ? format(new Date(b.endDate), 'yyyy-MM-dd') : '',
          pax: calculatedPax, // Auto-calculated from Uzbekistan + Turkmenistan
          paxUzbekistan: b.paxUzbekistan?.toString() || '',
          paxTurkmenistan: b.paxTurkmenistan?.toString() || '',
          guideId: b.guideId?.toString() || '',
          trainTickets: b.trainTickets || '',
          avia: b.avia || '',
          roomsDbl: b.roomsDbl || 0,
          roomsTwn: b.roomsTwn || 0,
          roomsSngl: b.roomsSngl || 0,
          roomsTotal: b.roomsTotal || 0,
          status: b.status || 'PENDING',
          notes: b.notes || ''
        });
      }
    } catch (error) {
      toast.error('Ошибка загрузки данных');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Load accommodation-specific rooming list
  const loadAccommodationRoomingList = async (accommodationId) => {
    try {
      const response = await bookingsApi.getAccommodationRoomingList(id, accommodationId);
      setAccommodationRoomingLists(prev => ({
        ...prev,
        [accommodationId]: response.data.roomingList || []
      }));
    } catch (error) {
      console.error('Error loading accommodation rooming list:', error);
    }
  };

  // Load flight data
  const loadFlights = async () => {
    if (!id || isNew) return;

    try {
      setLoadingFlights(true);
      const [flightsRes, sectionsRes] = await Promise.all([
        flightsApi.getAll(id),
        flightsApi.getSections(id)
      ]);

      // Backend returns { flights: [...] } and { flightSections: [...] }
      const flightsData = Array.isArray(flightsRes.data?.flights) ? flightsRes.data.flights : [];
      const sectionsData = Array.isArray(sectionsRes.data?.flightSections) ? sectionsRes.data.flightSections : [];

      setFlights(flightsData);
      setFlightSections(sectionsData);
      console.log('✈️ Loaded flights:', flightsData);
      console.log('📄 Loaded flight sections:', sectionsData);
    } catch (error) {
      console.error('Error loading flights:', error);
      // Set empty arrays on error
      setFlights([]);
      setFlightSections([]);
    } finally {
      setLoadingFlights(false);
    }
  };

  // Handle flight PDF import
  // Open flight modal for adding new flight
  const openFlightModal = () => {
    setEditingFlight(null);
    setFlightForm({
      type: 'INTERNATIONAL',
      flightNumber: '',
      airline: '',
      route: '',
      departure: '',
      arrival: '',
      date: '',
      departureTime: '',
      arrivalTime: '',
      pax: 0,
      price: 0,
      tariff: 'economy',
      notes: ''
    });
    setFlightModalOpen(true);
  };

  // Open flight modal for editing
  const editFlight = (flight) => {
    setEditingFlight(flight);
    setFlightForm({
      type: flight.type || 'INTERNATIONAL',
      flightNumber: flight.flightNumber || '',
      airline: flight.airline || '',
      route: flight.route || `${flight.departure || ''} - ${flight.arrival || ''}`.trim(),
      departure: flight.departure || '',
      arrival: flight.arrival || '',
      date: flight.date ? format(new Date(flight.date), 'yyyy-MM-dd') : '',
      departureTime: flight.departureTime || '',
      arrivalTime: flight.arrivalTime || '',
      pax: flight.pax || 0,
      price: flight.price || 0,
      tariff: flight.tariff || 'economy',
      notes: flight.notes || ''
    });
    setFlightModalOpen(true);
  };

  // Close flight modal
  const closeFlightModal = () => {
    setFlightModalOpen(false);
    setEditingFlight(null);
  };

  // Save flight (create or update)
  const saveFlight = async () => {
    if (!id) return;

    // Validation
    if (!flightForm.departure || !flightForm.arrival) {
      toast.error('Departure va Arrival maydonlari majburiy');
      return;
    }

    try {
      if (editingFlight) {
        // Update existing flight
        await flightsApi.update(id, editingFlight.id, flightForm);
        toast.success('Parvoz yangilandi');
      } else {
        // Create new flight
        await flightsApi.create(id, flightForm);
        toast.success('Parvoz qo\'shildi');
      }

      closeFlightModal();
      await loadFlights();
    } catch (error) {
      console.error('Error saving flight:', error);
      toast.error(error.response?.data?.error || 'Parvoz saqlashda xatolik');
    }
  };

  // Delete flight
  const deleteFlight = async (flightId) => {
    if (!id) return;

    if (!window.confirm('Parvozni o\'chirmoqchimisiz?')) {
      return;
    }

    try {
      await flightsApi.delete(id, flightId);
      toast.success('Parvoz o\'chirildi');
      await loadFlights();
    } catch (error) {
      console.error('Error deleting flight:', error);
      toast.error(error.response?.data?.error || 'Parvoz o\'chirishda xatolik');
    }
  };

  // Load railway data
  const loadRailways = async () => {
    if (!id || isNew) return;

    try {
      setLoadingRailways(true);
      const [railwaysRes, sectionsRes] = await Promise.all([
        railwaysApi.getAll(id),
        railwaysApi.getSections(id)
      ]);

      // Backend returns { railways: [...] } and { railwaySections: [...] }
      const railwaysData = Array.isArray(railwaysRes.data?.railways) ? railwaysRes.data.railways : [];
      const sectionsData = Array.isArray(sectionsRes.data?.railwaySections) ? sectionsRes.data.railwaySections : [];

      setRailways(railwaysData);
      setRailwaySections(sectionsData);
      console.log('🚂 Loaded railways:', railwaysData);
      console.log('💰 Railway prices:', railwaysData.map(r => ({
        trainNumber: r.trainNumber,
        pax: r.pax,
        price: r.price,
        hasPrice: !!r.price && r.price > 0
      })));
      console.log('📄 Loaded railway sections:', sectionsData);
    } catch (error) {
      console.error('Error loading railways:', error);
      // Set empty arrays on error
      setRailways([]);
      setRailwaySections([]);
    } finally {
      setLoadingRailways(false);
    }
  };

  // Open railway modal for adding new railway
  const openRailwayModal = () => {
    setEditingRailway(null);
    setRailwayForm({
      trainNumber: '',
      trainName: '',
      route: '',
      departure: '',
      arrival: '',
      date: '',
      departureTime: '',
      arrivalTime: '',
      tariff: 'Economy',
      pricePerPerson: 0,
      pax: 0,
      price: 0,
      notes: ''
    });
    setRailwayModalOpen(true);
  };

  // Open railway modal for editing
  const editRailway = (railway) => {
    setEditingRailway(railway);

    // Calculate pricePerPerson from total price and pax
    const pax = railway.pax || 0;
    const totalPrice = railway.price || 0;
    const pricePerPerson = pax > 0 ? totalPrice / pax : 0;

    setRailwayForm({
      trainNumber: railway.trainNumber || '',
      trainName: railway.trainName || '',
      route: railway.route || `${railway.departure || ''} - ${railway.arrival || ''}`.trim(),
      departure: railway.departure || '',
      arrival: railway.arrival || '',
      date: railway.date ? format(new Date(railway.date), 'yyyy-MM-dd') : '',
      departureTime: railway.departureTime || '',
      arrivalTime: railway.arrivalTime || '',
      tariff: 'Economy', // Default to Economy when editing
      pricePerPerson: pricePerPerson,
      pax: pax,
      price: totalPrice,
      notes: railway.notes || ''
    });
    setRailwayModalOpen(true);
  };

  // Close railway modal
  const closeRailwayModal = () => {
    setRailwayModalOpen(false);
    setEditingRailway(null);
  };

  // Save railway (create or update)
  const saveRailway = async () => {
    if (!id) return;

    // Validation
    if (!railwayForm.departure || !railwayForm.arrival) {
      toast.error('Departure va Arrival maydonlari majburiy');
      return;
    }

    console.log('🚂 Saving railway with data:', {
      trainNumber: railwayForm.trainNumber,
      pax: railwayForm.pax,
      price: railwayForm.price,
      pricePerPerson: railwayForm.pricePerPerson,
      fullData: railwayForm
    });

    try {
      if (editingRailway) {
        // Update existing railway
        const response = await railwaysApi.update(id, editingRailway.id, railwayForm);
        console.log('✅ Railway updated, response:', response.data);
        toast.success('Poezd yangilandi');
      } else {
        // Create new railway
        const response = await railwaysApi.create(id, railwayForm);
        console.log('✅ Railway created, response:', response.data);
        toast.success('Poezd qo\'shildi');
      }

      closeRailwayModal();
      await loadRailways();
    } catch (error) {
      console.error('❌ Error saving railway:', error);
      toast.error(error.response?.data?.error || 'Poezd saqlashda xatolik');
    }
  };

  // Delete railway
  const deleteRailway = async (railwayId) => {
    if (!id) return;

    if (!window.confirm('Poezdni o\'chirmoqchimisiz?')) {
      return;
    }

    try {
      await railwaysApi.delete(id, railwayId);
      toast.success('Poezd o\'chirildi');
      await loadRailways();
    } catch (error) {
      console.error('Error deleting railway:', error);
      toast.error(error.response?.data?.error || 'Poezd o\'chirishda xatolik');
    }
  };

  // Export Tourist List as PDF
  const exportTouristListPDF = () => {
    if (!tourists || tourists.length === 0) {
      toast.error('Turistlar ro\'yxati bo\'sh');
      return;
    }

    const tourName = booking?.tourType?.name || 'Tour';
    const bookingCode = booking?.bookingCode || 'BOOKING';
    const departureDate = booking?.departureDate ? format(new Date(booking.departureDate), 'dd.MM.yyyy') : '';
    const endDate = booking?.endDate ? format(new Date(booking.endDate), 'dd.MM.yyyy') : '';

    // Group tourists by room number for DBL and TWN
    const roomGroups = {};
    const singleTourists = [];

    tourists.forEach(tourist => {
      // Get room type from roomAssignments or fallback to roomPreference
      const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
      const roomType = assignedRoomType || tourist.roomPreference;

      if (tourist.roomNumber && (roomType === 'DZ' || roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'TWN' || roomType === 'TWIN')) {
        if (!roomGroups[tourist.roomNumber]) {
          roomGroups[tourist.roomNumber] = [];
        }
        roomGroups[tourist.roomNumber].push(tourist);
      } else {
        singleTourists.push(tourist);
      }
    });

    // Sort room groups by accommodation (Uzbekistan first) then room number
    const sortedRoomNumbers = Object.keys(roomGroups).sort((a, b) => {
      const groupA = roomGroups[a];
      const groupB = roomGroups[b];

      // Get accommodation of first tourist in each group
      const accA = (groupA[0]?.accommodation || 'Uzbekistan').toLowerCase();
      const accB = (groupB[0]?.accommodation || 'Uzbekistan').toLowerCase();

      // Sort by accommodation first (Uzbekistan before Turkmenistan)
      if (accA.includes('uzbek') && !accB.includes('uzbek')) return -1;
      if (!accA.includes('uzbek') && accB.includes('uzbek')) return 1;

      // Then sort by room type and number
      const aMatch = a.match(/(DBL|TWN)-(\d+)/);
      const bMatch = b.match(/(DBL|TWN)-(\d+)/);
      if (aMatch && bMatch) {
        if (aMatch[1] !== bMatch[1]) {
          return aMatch[1] === 'DBL' ? -1 : 1; // DBL first
        }
        return parseInt(aMatch[2]) - parseInt(bMatch[2]);
      }
      return 0;
    });

    // Sort single tourists by accommodation
    singleTourists.sort((a, b) => {
      const accA = (a.accommodation || 'Uzbekistan').toLowerCase();
      const accB = (b.accommodation || 'Uzbekistan').toLowerCase();
      if (accA.includes('uzbek') && !accB.includes('uzbek')) return -1;
      if (!accA.includes('uzbek') && accB.includes('uzbek')) return 1;
      return 0;
    });

    // Create combined array of room groups and single tourists
    const allEntries = [];

    // Add room groups
    sortedRoomNumbers.forEach(roomNumber => {
      const group = roomGroups[roomNumber];
      allEntries.push({
        type: 'group',
        accommodation: (group[0]?.accommodation || 'Uzbekistan').toLowerCase(),
        roomNumber,
        tourists: group
      });
    });

    // Add single tourists
    singleTourists.forEach(tourist => {
      allEntries.push({
        type: 'single',
        accommodation: (tourist.accommodation || 'Uzbekistan').toLowerCase(),
        tourist
      });
    });

    // Sort all entries by accommodation (Uzbekistan first)
    allEntries.sort((a, b) => {
      const accA = a.accommodation;
      const accB = b.accommodation;
      if (accA.includes('uzbek') && !accB.includes('uzbek')) return -1;
      if (!accA.includes('uzbek') && accB.includes('uzbek')) return 1;
      return 0;
    });

    // Build table rows with room grouping
    let counter = 0;
    let tableRows = '';

    // Render entries in sorted order
    allEntries.forEach(entry => {
      if (entry.type === 'group') {
        // Render paired tourists (DBL and TWN)
        const group = entry.tourists;
        group.forEach((tourist, groupIndex) => {
          counter++;
          const isFirstInGroup = groupIndex === 0;

          // Get room type from roomAssignments or fallback to roomPreference
          const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
          let roomType = assignedRoomType || tourist.roomPreference || '';

          // Normalize room type
          if (roomType === 'DZ' || roomType === 'DOUBLE') roomType = 'DBL';
          else if (roomType === 'TWIN') roomType = 'TWN';
          else if (roomType === 'EZ' || roomType === 'SINGLE') roomType = 'SNGL';

          // Filter remarks
          let remarks = '-';
          if (tourist.remarks) {
            let filtered = tourist.remarks
              .replace(/\*\s*PAX\s+booked\s+half\s+double\s+room.*?single\s+room/gi, '')
              .replace(/\d+ Nights?\s*\|?\s*/gi, '')
              .replace(/TWIN\s*\/\/\s*/gi, '')
              .replace(/DBL\s*\/\/\s*/gi, '')
              .replace(/SNGL\s*\/\/\s*/gi, '')
              .replace(/^\s*\|?\s*/g, '')
              .replace(/\s*\|?\s*$/g, '')
              .trim();
            if (filtered && filtered !== '|' && filtered !== '//') {
              remarks = filtered;
            }
          }

          const roomBgColor = roomType === 'DBL' ? '#dbeafe' : '#d1fae5';
          const roomTextColor = roomType === 'DBL' ? '#1e40af' : '#065f46';

          const tourStart = tourist.checkInDate
            ? format(new Date(tourist.checkInDate), 'dd.MM.yyyy')
            : booking?.departureDate ? format(new Date(booking.departureDate), 'dd.MM.yyyy') : '-';
          const tourEnd = tourist.checkOutDate
            ? format(new Date(tourist.checkOutDate), 'dd.MM.yyyy')
            : booking?.endDate ? format(new Date(booking.endDate), 'dd.MM.yyyy') : '-';

          tableRows += `
            <tr style="border-bottom: 1px solid #dbeafe;">
              <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-size: 10px;">${counter}</td>
              <td style="border: 1px solid #dbeafe; padding: 5px 5px; font-size: 10px;">${tourist.gender === 'M' ? 'Mr.' : tourist.gender === 'F' ? 'Mrs.' : ''} ${tourist.lastName}, ${tourist.firstName}</td>
              <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-size: 9px;">${tourStart}</td>
              <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-size: 9px;">${tourEnd}</td>
              <td style="border: 1px solid #dbeafe; padding: 5px 5px; font-size: 9px;">${remarks}</td>
              ${isFirstInGroup ? `<td rowspan="${group.length}" style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-weight: bold; vertical-align: middle; background-color: ${roomBgColor}; color: ${roomTextColor}; font-size: 10px;">${roomType}</td>` : ''}
              <td style="border: 1px solid #dbeafe; padding: 5px 4px; font-size: 10px;">${tourist.accommodation || 'Uzbekistan'}</td>
            </tr>
          `;
        });
      } else if (entry.type === 'single') {
        // Render single tourist
        const tourist = entry.tourist;
        counter++;

        // Get room type from roomAssignments or fallback to roomPreference
        const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
        let roomType = assignedRoomType || tourist.roomPreference || 'SNGL';

        // Normalize room type
        if (roomType === 'DZ' || roomType === 'DOUBLE') roomType = 'DBL';
        else if (roomType === 'TWIN') roomType = 'TWN';
        else if (roomType === 'EZ' || roomType === 'SINGLE') roomType = 'SNGL';

        const roomBgColor = roomType === 'DBL' ? '#dbeafe' : roomType === 'TWN' ? '#d1fae5' : '#e9d5ff';
        const roomTextColor = roomType === 'DBL' ? '#1e40af' : roomType === 'TWN' ? '#065f46' : '#6b21a8';

        // Filter remarks
        let remarks = '-';
        if (tourist.remarks) {
          let filtered = tourist.remarks
            .replace(/\*PAX booked half double room, no roommate found -> single room/gi, '')
            .replace(/\d+ Nights?\s*\|?\s*/gi, '')
            .replace(/^\s*\|?\s*/g, '')
            .replace(/\s*\|?\s*$/g, '')
            .trim();
          if (filtered && filtered !== '|' && filtered !== '//') {
            remarks = filtered;
          }
        }

        const tourStart = tourist.checkInDate
          ? format(new Date(tourist.checkInDate), 'dd.MM.yyyy')
          : booking?.departureDate ? format(new Date(booking.departureDate), 'dd.MM.yyyy') : '-';
        const tourEnd = tourist.checkOutDate
          ? format(new Date(tourist.checkOutDate), 'dd.MM.yyyy')
          : booking?.endDate ? format(new Date(booking.endDate), 'dd.MM.yyyy') : '-';

        tableRows += `
          <tr style="border-bottom: 1px solid #dbeafe;">
            <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-size: 10px;">${counter}</td>
            <td style="border: 1px solid #dbeafe; padding: 5px 5px; font-size: 10px;">${tourist.gender === 'M' ? 'Mr.' : tourist.gender === 'F' ? 'Mrs.' : ''} ${tourist.lastName}, ${tourist.firstName}</td>
            <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-size: 9px;">${tourStart}</td>
            <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-size: 9px;">${tourEnd}</td>
            <td style="border: 1px solid #dbeafe; padding: 5px 5px; font-size: 9px;">${remarks}</td>
            <td style="border: 1px solid #dbeafe; padding: 5px 3px; text-align: center; font-weight: bold; background-color: ${roomBgColor}; color: ${roomTextColor}; font-size: 10px;">${roomType}</td>
            <td style="border: 1px solid #dbeafe; padding: 5px 4px; font-size: 10px;">${tourist.accommodation || 'Uzbekistan'}</td>
          </tr>
        `;
      }
    });

    // Calculate statistics
    const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
    const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };

    tourists.forEach(t => {
      const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
      const roomType = (assignedRoomType || t.roomPreference || '').toUpperCase();
      const roomNum = t.roomNumber;

      if (roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'DZ') {
        if (roomNum && !seenRooms.DBL.has(roomNum)) {
          roomCounts.DBL++;
          seenRooms.DBL.add(roomNum);
        }
      } else if (roomType === 'TWN' || roomType === 'TWIN') {
        if (roomNum && !seenRooms.TWN.has(roomNum)) {
          roomCounts.TWN++;
          seenRooms.TWN.add(roomNum);
        }
      } else if (roomType === 'SNGL' || roomType === 'SINGLE' || roomType === 'EZ') {
        if (roomNum && !seenRooms.SNGL.has(roomNum)) {
          roomCounts.SNGL++;
          seenRooms.SNGL.add(roomNum);
        }
      }
    });

    const uzbekistanCount = tourists.filter(t => {
      const placement = (t.accommodation || 'Uzbekistan').toLowerCase();
      return placement.includes('uzbek') || placement === 'uz' || placement === 'uzbekistan';
    }).length;

    const turkmenistanCount = tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('turkmen') || placement === 'tm';
    }).length;

    // Create HTML content for PDF
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 12px;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 18px;">Tourist List</h1>
          <h2 style="color: #4b5563; margin: 5px 0; font-size: 14px;">${bookingCode} - ${tourName}</h2>
          <p style="color: #6b7280; margin: 3px 0; font-size: 11px;">Date: ${departureDate} – ${endDate}</p>
        </div>

        <!-- Statistics Cards -->
        <div style="display: flex; gap: 3px; margin-bottom: 8px; justify-content: space-between;">
          <!-- Total -->
          <div style="flex: 1; background: linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%); border: 1px solid #3b82f6; border-radius: 4px; padding: 3px 4px; text-align: center;">
            <div style="font-size: 10px; font-weight: bold; color: #1e40af; margin-bottom: 1px;">TOTAL</div>
            <div style="font-size: 18px; font-weight: bold; color: #1e3a8a; line-height: 1;">${tourists.length}</div>
            <div style="font-size: 9px; color: #2563eb; margin-top: 1px;">guests</div>
          </div>

          <!-- DBL -->
          <div style="flex: 1; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 1px solid #3b82f6; border-radius: 4px; padding: 3px 4px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: white; background-color: #3b82f6; border-radius: 3px; padding: 1px 7px; margin-bottom: 1px; display: inline-block;">DBL</div>
            <div style="font-size: 18px; font-weight: bold; color: #1e3a8a; line-height: 1;">${roomCounts.DBL}</div>
            <div style="font-size: 9px; color: #2563eb; margin-top: 1px;">rooms</div>
          </div>

          <!-- TWN -->
          <div style="flex: 1; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 1px solid #10b981; border-radius: 4px; padding: 3px 4px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: white; background-color: #10b981; border-radius: 3px; padding: 1px 7px; margin-bottom: 1px; display: inline-block;">TWN</div>
            <div style="font-size: 18px; font-weight: bold; color: #064e3b; line-height: 1;">${roomCounts.TWN}</div>
            <div style="font-size: 9px; color: #059669; margin-top: 1px;">rooms</div>
          </div>

          <!-- SNGL -->
          <div style="flex: 1; background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%); border: 1px solid #8b5cf6; border-radius: 4px; padding: 3px 4px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: white; background-color: #8b5cf6; border-radius: 3px; padding: 1px 7px; margin-bottom: 1px; display: inline-block;">SNGL</div>
            <div style="font-size: 18px; font-weight: bold; color: #4c1d95; line-height: 1;">${roomCounts.SNGL}</div>
            <div style="font-size: 9px; color: #7c3aed; margin-top: 1px;">rooms</div>
          </div>

          <!-- Placement -->
          <div style="flex: 1; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border: 1px solid #9ca3af; border-radius: 4px; padding: 2px 4px; font-size: 9px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; gap: 2px;">
                <div style="width: 4px; height: 4px; border-radius: 50%; background-color: #10b981;"></div>
                <span style="font-weight: bold; color: #374151; font-size: 9px;">UZBEKISTAN</span>
              </div>
              <span style="font-size: 13px; font-weight: bold; color: #111827;">${uzbekistanCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 2px;">
                <div style="width: 4px; height: 4px; border-radius: 50%; background-color: #8b5cf6;"></div>
                <span style="font-weight: bold; color: #374151; font-size: 9px;">TURKMENISTAN</span>
              </div>
              <span style="font-size: 13px; font-weight: bold; color: #111827;">${turkmenistanCount}</span>
            </div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
          <thead>
            <tr style="background: linear-gradient(to right, #2563eb, #7c3aed); color: white;">
              <th style="border: 1px solid #93c5fd; padding: 6px 3px; text-align: center; font-size: 10px;">No</th>
              <th style="border: 1px solid #93c5fd; padding: 6px 5px; text-align: left; font-size: 10px;">Name</th>
              <th style="border: 1px solid #93c5fd; padding: 6px 3px; text-align: center; font-size: 9px;">Tour Start</th>
              <th style="border: 1px solid #93c5fd; padding: 6px 3px; text-align: center; font-size: 9px;">Tour End</th>
              <th style="border: 1px solid #93c5fd; padding: 6px 5px; text-align: left; font-size: 10px;">Remarks</th>
              <th style="border: 1px solid #93c5fd; padding: 6px 3px; text-align: center; font-size: 10px;">Rm</th>
              <th style="border: 1px solid #93c5fd; padding: 6px 4px; text-align: left; font-size: 10px;">Placement</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;

    // Create temporary element
    const element = document.createElement('div');
    element.innerHTML = htmlContent;

    // PDF options
    const opt = {
      margin: 8,
      filename: `Tourist_List_${bookingCode}_${departureDate.replace(/\./g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate PDF
    toast.loading('PDF yaratilmoqda...');
    html2pdf().set(opt).from(element).save().then(() => {
      toast.dismiss();
      toast.success('PDF yuklab olindi!');
    }).catch((error) => {
      toast.dismiss();
      console.error('PDF export error:', error);
      toast.error('PDF yaratishda xatolik');
    });
  };

  // Load flights and railways when Fly&Railway tab is accessed
  useEffect(() => {
    if (activeTab === 'rooming' && !isNew && id) {
      loadFlights();
      loadRailways();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, isNew]);

  // Auto-fill accommodations from tour itinerary
  const autoFillAccommodationsFromItinerary = async () => {
    if (!booking?.tourTypeId) {
      toast.error('Нет программы тура');
      return;
    }

    // If accommodations exist, ask for confirmation to replace
    if (accommodations.length > 0) {
      if (!confirm(`У вас уже есть ${accommodations.length} размещений. Удалить их и создать заново из программы тура?`)) {
        return;
      }
    }

    try {
      setSaving(true);

      // Delete existing accommodations if any
      if (accommodations.length > 0) {
        let deletedCount = 0;
        for (const acc of accommodations) {
          try {
            await bookingsApi.deleteAccommodation(booking.id, acc.id);
            deletedCount++;
          } catch (error) {
            // Ignore 404 errors (already deleted)
            if (error.response?.status !== 404) {
              console.warn('Failed to delete accommodation:', acc.id, error);
            }
          }
        }
        if (deletedCount > 0) {
          toast(`Удалено размещений: ${deletedCount}`);
        }
      }

      // Step 1: Load tour itinerary
      const itineraryResponse = await tourTypesApi.getItinerary(booking.tourTypeId);
      const itinerary = itineraryResponse.data.itinerary || [];

      if (itinerary.length === 0) {
        toast.error('Программа тура пуста');
        setSaving(false);
        return;
      }

      // Step 2: Load tourists from Rooming List
      const touristsResponse = await touristsApi.getAll(booking.id);
      const tourists = touristsResponse.data.tourists || [];

      console.log('🔍 DEBUG: Total tourists loaded:', tourists.length);
      console.log('🔍 DEBUG: Tourists data:', tourists.map(t => ({
        name: t.fullName,
        roomPreference: t.roomPreference,
        accommodation: t.accommodation
      })));

      // Separate tourists by accommodation
      // IMPORTANT: Tourists with "Turkmenistan" go ONLY to Turkmenistan group
      // Only tourists with just "Uzbekistan" (no Turkmenistan) go to Uzbekistan group

      const turkmenistanTourists = tourists.filter(t => {
        const acc = (t.accommodation || '').toLowerCase();
        // Anyone with "turkmen" in placement goes to Turkmenistan group
        const isTurkmenistan = acc.includes('turkmen') || acc.includes('туркмен');
        return isTurkmenistan;
      });

      const uzbekistanTourists = tourists.filter(t => {
        const acc = (t.accommodation || '').toLowerCase();
        // Only those with "uzbek" BUT WITHOUT "turkmen" go to Uzbekistan-only group
        const hasUzbek = acc.includes('uzbek') || acc.includes('узбек');
        const hasTurkmen = acc.includes('turkmen') || acc.includes('туркмен');
        const isUzbekistanOnly = hasUzbek && !hasTurkmen;
        return isUzbekistanOnly;
      });

      const hasSplit = uzbekistanTourists.length > 0 && turkmenistanTourists.length > 0;

      console.log('🔍 DEBUG: Uzbekistan-only tourists:', uzbekistanTourists.length, uzbekistanTourists.map(t => t.fullName));
      console.log('🔍 DEBUG: Turkmenistan tourists:', turkmenistanTourists.length, turkmenistanTourists.map(t => t.fullName));
      console.log('🔍 DEBUG: Group split:', hasSplit);

      console.log('🔍 DEBUG: Uzbekistan tourists:', uzbekistanTourists.length, uzbekistanTourists.map(t => t.fullName));
      console.log('🔍 DEBUG: Turkmenistan tourists:', turkmenistanTourists.length, turkmenistanTourists.map(t => t.fullName));
      console.log('🔍 DEBUG: Group split:', hasSplit);

      // Step 3: Build accommodation list from itinerary
      const departureDate = new Date(booking.departureDate);
      const accommodationsToCreate = [];

      // Group consecutive days by hotel
      let currentStay = null;
      const hotelStays = [];

      itinerary.forEach((day) => {
        if (day.accommodation && day.accommodation.trim().length > 0) {
          if (!currentStay || currentStay.hotelName !== day.accommodation) {
            if (currentStay) {
              hotelStays.push(currentStay);
            }
            currentStay = {
              hotelName: day.accommodation,
              startDay: day.dayNumber,
              endDay: day.dayNumber
            };
          } else {
            currentStay.endDay = day.dayNumber;
          }
        }
      });
      if (currentStay) {
        hotelStays.push(currentStay);
      }

      if (hotelStays.length === 0) {
        toast.error('Нет отелей в программе тура');
        setSaving(false);
        return;
      }

      // Merge consecutive stays in the same hotel (e.g., two Malika Khorazm periods)
      const mergedStays = [];
      for (let i = 0; i < hotelStays.length; i++) {
        const stay = hotelStays[i];
        const prevStay = mergedStays[mergedStays.length - 1];

        // If previous stay is same hotel and days are consecutive or overlapping, merge them
        if (prevStay && prevStay.hotelName === stay.hotelName && stay.startDay <= prevStay.endDay + 2) {
          prevStay.endDay = Math.max(prevStay.endDay, stay.endDay);
        } else {
          mergedStays.push({ ...stay });
        }
      }

      console.log('🔍 DEBUG: Hotel stays after merge:', mergedStays);
      console.log('🔍 UPDATED CODE v2: Merge logic is now active');

      // Step 4: Create accommodations for each hotel stay
      // For split groups, handle last day specially
      const lastDay = Math.max(...itinerary.map(d => d.dayNumber));

      for (let i = 0; i < mergedStays.length; i++) {
        const stay = mergedStays[i];
        const isLastStay = (i === mergedStays.length - 1);

        console.log(`🏨 Processing stay ${i + 1}/${mergedStays.length}: ${stay.hotelName} (days ${stay.startDay}-${stay.endDay}, isLastStay=${isLastStay})`);

        // Skip if this is just the departure day (no overnight stay)
        // If endDay equals lastDay, it means the itinerary includes the departure day
        // but there's no actual overnight on that day
        if (stay.endDay === lastDay && stay.startDay === lastDay) {
          console.log(`Skipping departure day accommodation: ${stay.hotelName} on day ${lastDay}`);
          continue;
        }

        // Find hotel in database - try multiple matching strategies
        let hotel = hotels.find(h =>
          h.name.toLowerCase().includes(stay.hotelName.toLowerCase()) ||
          stay.hotelName.toLowerCase().includes(h.name.toLowerCase())
        );

        // If not found, try without special characters and extra spaces
        if (!hotel) {
          const normalizedStayName = stay.hotelName.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
          hotel = hotels.find(h => {
            const normalizedHotelName = h.name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
            return normalizedHotelName.includes(normalizedStayName) || normalizedStayName.includes(normalizedHotelName);
          });
        }

        if (!hotel) {
          console.warn(`Hotel not found: "${stay.hotelName}"`);
          toast.error(`Отель не найден: ${stay.hotelName}`);
          continue;
        }

        const cityName = hotel.city?.name?.toLowerCase() || '';
        const isKhiva = cityName.includes('хива') || cityName.includes('khiva');
        const isTashkent = cityName.includes('ташкент') || cityName.includes('tashkent');

        console.log(`  → City: ${cityName}, isKhiva=${isKhiva}, isTashkent=${isTashkent}, hasSplit=${hasSplit}`);

        // If this is the last stay and group splits
        if (isLastStay && hasSplit) {
          // Last stay handles group separation

          // If last hotel is Khiva: DON'T create it (TM tourists already in previous Khiva)
          // Only add Tashkent for UZ tourists
          if (isKhiva) {
            // TM tourists already have Malika Khorazm from previous iteration
            // Only create Tashkent for UZ tourists returning
            if (uzbekistanTourists.length > 0) {
              const tashkentHotel = hotels.find(h =>
                h.name.toLowerCase().includes('arien') ||
                (h.city?.name?.toLowerCase().includes('ташкент') || h.city?.name?.toLowerCase().includes('tashkent'))
              );
              if (tashkentHotel) {
                accommodationsToCreate.push({
                  hotel: tashkentHotel,
                  startDay: lastDay,
                  endDay: lastDay,
                  tourists: uzbekistanTourists,
                  groupName: 'Uzbekistan'
                });
              } else {
                toast.error('Отель в Ташкенте не найден для группы Uzbekistan');
              }
            }
            // Note: No Khiva accommodation created here - TM tourists use previous one
          } else if (isTashkent && uzbekistanTourists.length > 0) {
            // If last hotel is Tashkent: create it for UZ tourists only
            accommodationsToCreate.push({
              hotel,
              startDay: stay.startDay,
              endDay: stay.endDay,
              tourists: uzbekistanTourists,
              groupName: 'Uzbekistan'
            });
          } else {
            // Not a split city, use all tourists
            accommodationsToCreate.push({
              hotel,
              startDay: stay.startDay,
              endDay: stay.endDay,
              tourists: [...uzbekistanTourists, ...turkmenistanTourists],
              groupName: 'All'
            });
          }
        } else {
          // Not last stay, or no split - use all tourists
          accommodationsToCreate.push({
            hotel,
            startDay: stay.startDay,
            endDay: stay.endDay,
            tourists: [...uzbekistanTourists, ...turkmenistanTourists],
            groupName: 'All'
          });
        }
      }

      // Step 5: Create accommodations in database
      if (accommodationsToCreate.length === 0) {
        toast.error('Нет размещений для создания');
        setSaving(false);
        return;
      }

      let createdCount = 0;

      for (const accData of accommodationsToCreate) {
        const { hotel, startDay, endDay, tourists: groupTourists, groupName } = accData;

        // Calculate dates
        const checkInDate = new Date(departureDate);
        checkInDate.setDate(checkInDate.getDate() + (startDay - 1));

        const checkOutDate = new Date(departureDate);
        checkOutDate.setDate(checkOutDate.getDate() + (endDay - 1) + 1); // endDay is the last night, checkout is next morning

        // Validation: don't create accommodation if checkout is after tour end date
        const tourEndDate = new Date(booking.endDate);
        if (checkOutDate > tourEndDate) {
          console.warn(`Skipping accommodation ${hotel.name}: checkout ${checkOutDate.toISOString().split('T')[0]} is after tour end ${tourEndDate.toISOString().split('T')[0]}`);
          continue;
        }

        // Calculate rooms based on tourists in this group
        const rooms = [];
        const isGuesthouseOrYurta = hotel.stars === 'Guesthouse' || hotel.stars === 'Yurta';

        if (isGuesthouseOrYurta) {
          // PAX pricing - count people
          if (groupTourists.length > 0) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'PAX');
            rooms.push({
              roomTypeCode: 'PAX',
              roomsCount: groupTourists.length,
              guestsPerRoom: 1,
              pricePerNight: hotelRoomType?.pricePerNight || 0
            });
          }
        } else {
          // Regular hotel - count rooms from Rooming List assignments
          // Get room type from roomAssignments or roomPreference (fallback)
          console.log(`🔍 DEBUG: Calculating rooms for ${hotel.name} (${groupName})`);
          console.log(`🔍 DEBUG: Group tourists:`, groupTourists.map(t => ({
            name: t.fullName,
            roomPreference: t.roomPreference,
            roomAssignment: t.roomAssignments?.[0]?.bookingRoom?.roomType?.name
          })));

          const doubleCount = groupTourists.filter(t => {
            // Try roomAssignments first (from Rooming List)
            const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
            // Fallback to roomPreference (from Excel import)
            const roomType = assignedRoomType || t.roomPreference;
            return roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'DZ';
          }).length;

          const twinCount = groupTourists.filter(t => {
            const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
            const roomType = assignedRoomType || t.roomPreference;
            return roomType === 'TWN' || roomType === 'TWIN';
          }).length;

          const singleCount = groupTourists.filter(t => {
            const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
            const roomType = assignedRoomType || t.roomPreference;
            return roomType === 'SNGL' || roomType === 'SINGLE' || roomType === 'EZ';
          }).length;

          console.log(`🔍 DEBUG: Room counts - DBL=${doubleCount}, TWN=${twinCount}, SNGL=${singleCount}`);

          // Helper function to calculate price with tourist tax
          const calculatePriceWithTax = (roomType, guestsPerRoom) => {
            if (!roomType) return 0;

            let basePrice = roomType.pricePerNight || 0;
            const vatAmount = roomType.vatIncluded ? basePrice * 0.12 : 0;
            let priceWithVat = basePrice + vatAmount;

            // Calculate tourist tax if enabled
            let touristTax = 0;
            if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
              const totalRooms = hotel.totalRooms || 0;
              let percentage = totalRooms <= 10 ? 0.05 : totalRooms <= 40 ? 0.10 : 0.15;
              let touristTaxUZS = roomType.brvValue * percentage * guestsPerRoom;

              // Convert to room currency
              if (roomType.currency === 'USD') {
                touristTax = touristTaxUZS / 12700;
              } else if (roomType.currency === 'EUR') {
                touristTax = touristTaxUZS / 13500;
              } else {
                touristTax = touristTaxUZS;
              }
            }

            return priceWithVat + touristTax;
          };

          // DBL rooms (pairs of DOUBLE) - round up for odd numbers
          if (doubleCount > 0) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'DBL');
            rooms.push({
              roomTypeCode: 'DBL',
              roomsCount: Math.ceil(doubleCount / 2),
              guestsPerRoom: 2,
              pricePerNight: calculatePriceWithTax(hotelRoomType, 2)
            });
          }

          // TWN rooms (pairs of TWIN) - round up for odd numbers
          if (twinCount > 0) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'TWN');
            rooms.push({
              roomTypeCode: 'TWN',
              roomsCount: Math.ceil(twinCount / 2),
              guestsPerRoom: 2,
              pricePerNight: calculatePriceWithTax(hotelRoomType, 2)
            });
          }

          // SNGL rooms
          if (singleCount > 0) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'SNGL');
            rooms.push({
              roomTypeCode: 'SNGL',
              roomsCount: singleCount,
              guestsPerRoom: 1,
              pricePerNight: calculatePriceWithTax(hotelRoomType, 1)
            });
          }
        }

        if (rooms.length === 0) {
          console.warn(`No rooms calculated for ${hotel.name} (${groupName}): ${groupTourists.length} tourists`);
          toast.error(`Нет комнат для ${hotel.name}: проверьте предпочтения туристов`);
          continue;
        }

        // Create accommodation
        const data = {
          hotelId: hotel.id,
          checkInDate: checkInDate.toISOString().split('T')[0],
          checkOutDate: checkOutDate.toISOString().split('T')[0],
          rooms
        };

        await bookingsApi.createAccommodation(booking.id, data);
        createdCount++;
      }

      if (createdCount > 0) {
        toast.success(`Создано размещений: ${createdCount}`);
      } else {
        toast.error('Не создано ни одного размещения');
      }

      // Reload data to get newly created accommodations
      await loadData();

      // CRITICAL FOR ER TOURS: Auto-recalculate totals after creating accommodations from itinerary
      // This ensures correct costs considering:
      // 1. Early arrivals (Baetgen at Arien Plaza: 5 nights instead of 2)
      // 2. UZ/TM splits (Malika Khorazm: UZ tourists 2 nights, TM tourists 3 nights)
      // DO NOT REMOVE this setTimeout logic - it's needed for accurate initial display
      console.log('🔄 Recalculating totals for all accommodations...');
      setTimeout(async () => {
        try {
          // Reload accommodations list
          const accResponse = await bookingsApi.getAccommodations(booking.id);
          const createdAccs = accResponse.data.accommodations;

          // Reload tourists with individual dates
          const touristsResp = await touristsApi.getAll(booking.id);
          const allTourists = touristsResp.data.tourists || [];

          // Determine first accommodation (earliest check-in date)
          const sortedAccs = [...createdAccs].sort((a, b) =>
            new Date(a.checkInDate) - new Date(b.checkInDate)
          );
          const firstAccId = sortedAccs[0]?.id;

          for (const acc of createdAccs) {
            // Calculate correct totalCost for this accommodation
            const accCheckIn = new Date(acc.checkInDate);
            accCheckIn.setHours(0, 0, 0, 0);
            const accCheckOut = new Date(acc.checkOutDate);
            accCheckOut.setHours(0, 0, 0, 0);

            // Filter tourists for this hotel (by date overlap and room number)
            const accTourists = allTourists.filter(t => {
              if (!t.roomNumber) return false;

              // Check date overlap if tourist has custom dates
              if (t.checkInDate && t.checkOutDate) {
                const touristCheckIn = new Date(t.checkInDate);
                const touristCheckOut = new Date(t.checkOutDate);
                touristCheckIn.setHours(0, 0, 0, 0);
                touristCheckOut.setHours(0, 0, 0, 0);

                // Tourist dates must overlap with accommodation dates
                return touristCheckIn < accCheckOut && touristCheckOut > accCheckIn;
              }

              // If no custom dates, assume tourist is in this hotel
              return true;
            });

            if (accTourists.length === 0 || !acc.rooms) continue;

            // Check if this is the first accommodation
            const isFirstAccommodation = acc.id === firstAccId;

            // Calculate guest-nights per room type
            const guestNightsPerRoomType = {};
            accTourists.forEach(tourist => {
              let checkIn = new Date(accCheckIn);
              let checkOut = new Date(accCheckOut);

              // Handle early arrival ONLY for first accommodation (like Baetgen at Arien Plaza)
              if (isFirstAccommodation && tourist.checkInDate) {
                const touristCheckIn = new Date(tourist.checkInDate);
                touristCheckIn.setHours(0, 0, 0, 0);
                const daysDiff = Math.round((accCheckIn - touristCheckIn) / (1000 * 60 * 60 * 24));

                if (daysDiff >= 2) {
                  // Early arrival - use tourist check-in but accommodation check-out
                  checkIn = touristCheckIn;
                }
              }

              const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

              let roomType = (tourist.roomPreference || '').toUpperCase();
              if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
              if (roomType === 'TWIN') roomType = 'TWN';
              if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';

              if (!guestNightsPerRoomType[roomType]) {
                guestNightsPerRoomType[roomType] = 0;
              }
              guestNightsPerRoomType[roomType] += nights;
            });

            // Calculate totalCost from room-nights
            let totalCost = 0;
            acc.rooms.forEach(room => {
              const pricePerNight = parseFloat(room.pricePerNight) || 0;
              let normalizedRoomType = room.roomTypeCode?.toUpperCase();
              if (normalizedRoomType === 'DOUBLE') normalizedRoomType = 'DBL';
              if (normalizedRoomType === 'TWIN') normalizedRoomType = 'TWN';
              if (normalizedRoomType === 'SINGLE') normalizedRoomType = 'SNGL';

              const guestNights = guestNightsPerRoomType[normalizedRoomType] || 0;
              if (guestNights === 0) return;

              // Convert guest-nights to room-nights
              let roomNights;
              if (normalizedRoomType === 'TWN' || normalizedRoomType === 'DBL') {
                roomNights = guestNights / 2;
              } else {
                roomNights = guestNights;
              }

              totalCost += roomNights * pricePerNight;
            });

            // Update accommodation with correct totalCost
            if (totalCost > 0) {
              await bookingsApi.updateAccommodation(booking.id, acc.id, {
                totalCost,
                totalRooms: acc.rooms.reduce((sum, r) => sum + (r.roomsCount || 0), 0),
                totalGuests: accTourists.length
              });
              console.log(`✅ Updated ${acc.hotel?.name}: ${totalCost.toLocaleString()} UZS`);
            }
          }

          // Final reload to show updated totals
          await loadData();
          console.log('✅ All totals updated');
        } catch (error) {
          console.error('Auto-update totals error:', error);
        }
      }, 1500);

    } catch (error) {
      console.error('Auto-fill error:', error);
      toast.error(error.response?.data?.error || error.message || 'Ошибка автозаполнения');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Auto-calculate PAX when Uzbekistan or Turkmenistan changes
    if (name === 'paxUzbekistan' || name === 'paxTurkmenistan') {
      setFormData((prev) => {
        const uzbek = name === 'paxUzbekistan' ? (parseInt(value) || 0) : (parseInt(prev.paxUzbekistan) || 0);
        const turkmen = name === 'paxTurkmenistan' ? (parseInt(value) || 0) : (parseInt(prev.paxTurkmenistan) || 0);

        // Check if current tour type is ER (only ER has Turkmenistan)
        const selectedTourType = tourTypes.find(t => t.id === parseInt(prev.tourTypeId));
        const isER = selectedTourType?.code === 'ER';

        // For ER: PAX = Uzbekistan + Turkmenistan
        // For CO, KAS, ZA: PAX = Uzbekistan only
        const totalPax = isER ? (uzbek + turkmen) : uzbek;

        return {
          ...prev,
          [name]: value,
          pax: totalPax
        };
      });
    }
    // Recalculate PAX when tour type changes
    else if (name === 'tourTypeId') {
      setFormData((prev) => {
        const selectedTourType = tourTypes.find(t => t.id === parseInt(value));
        const isER = selectedTourType?.code === 'ER';

        const uzbek = parseInt(prev.paxUzbekistan) || 0;
        const turkmen = parseInt(prev.paxTurkmenistan) || 0;

        // For ER: PAX = Uzbekistan + Turkmenistan
        // For CO, KAS, ZA: PAX = Uzbekistan only (reset Turkmenistan to 0)
        const totalPax = isER ? (uzbek + turkmen) : uzbek;
        const newTurkmen = isER ? prev.paxTurkmenistan : '0';

        return {
          ...prev,
          [name]: value,
          paxTurkmenistan: newTurkmen,
          pax: totalPax
        };
      });
    }
    else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!formData.bookingNumber || !formData.tourTypeId || !formData.departureDate) {
      toast.error('Заполните обязательные поля');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await bookingsApi.create(formData);
        toast.success('Бронирование создано');
        navigate(`/bookings/${response.data.booking.id}`);
      } else {
        await bookingsApi.update(id, formData);
        toast.success('Изменения сохранены');
        setEditing(false);
        loadData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить это бронирование?')) return;

    try {
      await bookingsApi.delete(id);
      toast.success('Бронирование удалено');
      navigate('/bookings');
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // ========== Room Allocation Functions ==========
  const openRoomAllocModal = (roomAlloc = null) => {
    setAvailability(null);
    if (roomAlloc) {
      setEditingRoomAlloc(roomAlloc);
      const hotel = hotels.find(h => h.id === roomAlloc.hotelId);
      setSelectedHotel(hotel);
      setRoomAllocForm({
        hotelId: roomAlloc.hotelId.toString(),
        roomTypeId: roomAlloc.roomTypeId.toString(),
        quantity: roomAlloc.quantity,
        checkInDate: roomAlloc.checkInDate ? format(new Date(roomAlloc.checkInDate), 'yyyy-MM-dd') : '',
        checkOutDate: roomAlloc.checkOutDate ? format(new Date(roomAlloc.checkOutDate), 'yyyy-MM-dd') : '',
        pricePerNight: roomAlloc.pricePerNight,
        notes: roomAlloc.notes || ''
      });
    } else {
      setEditingRoomAlloc(null);
      setSelectedHotel(null);
      // Default dates from booking
      setRoomAllocForm({
        hotelId: '',
        roomTypeId: '',
        quantity: 1,
        checkInDate: formData.departureDate || '',
        checkOutDate: formData.endDate || '',
        pricePerNight: 0,
        notes: ''
      });
    }
    setRoomModalOpen(true);
  };

  const handleHotelChange = (e) => {
    const hotelId = e.target.value;
    const hotel = hotels.find(h => h.id === parseInt(hotelId));
    setSelectedHotel(hotel);
    setRoomAllocForm(prev => ({
      ...prev,
      hotelId,
      roomTypeId: '',
      pricePerNight: 0
    }));
    setRoomTypeAvailabilities({});
    // Fetch availability for all room types if dates are set
    if (hotel && roomAllocForm.checkInDate && roomAllocForm.checkOutDate) {
      fetchAllRoomTypeAvailabilities(hotel, roomAllocForm.checkInDate, roomAllocForm.checkOutDate);
    }
  };

  const handleRoomTypeChange = (e) => {
    const roomTypeId = e.target.value;
    const roomType = selectedHotel?.roomTypes?.find(r => r.id === parseInt(roomTypeId));
    setRoomAllocForm(prev => ({
      ...prev,
      roomTypeId,
      pricePerNight: roomType?.pricePerNight || 0
    }));
    setAvailability(null);
  };

  // Fetch availability for all room types in a hotel
  const fetchAllRoomTypeAvailabilities = async (hotel, checkInDate, checkOutDate) => {
    if (!hotel?.roomTypes?.length || !checkInDate || !checkOutDate) return;

    setLoadingAvailability(true);
    const availabilities = {};

    try {
      await Promise.all(
        hotel.roomTypes.map(async (roomType) => {
          const params = {
            hotelId: hotel.id,
            roomTypeId: roomType.id,
            checkInDate,
            checkOutDate
          };
          if (editingRoomAlloc && editingRoomAlloc.roomTypeId === roomType.id) {
            params.excludeRoomId = editingRoomAlloc.id;
          }
          const response = await bookingsApi.checkRoomAvailability(id, params);
          availabilities[roomType.id] = response.data;
        })
      );
      setRoomTypeAvailabilities(availabilities);
    } catch (error) {
      console.error('Fetch availabilities error:', error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Re-fetch availabilities when dates change
  const handleDateChange = (field, value) => {
    setRoomAllocForm(prev => ({ ...prev, [field]: value }));
    setAvailability(null);

    const newCheckIn = field === 'checkInDate' ? value : roomAllocForm.checkInDate;
    const newCheckOut = field === 'checkOutDate' ? value : roomAllocForm.checkOutDate;

    if (selectedHotel && newCheckIn && newCheckOut) {
      fetchAllRoomTypeAvailabilities(selectedHotel, newCheckIn, newCheckOut);
    }
  };

  const checkAvailability = async () => {
    if (!roomAllocForm.hotelId || !roomAllocForm.roomTypeId || !roomAllocForm.checkInDate || !roomAllocForm.checkOutDate) {
      return;
    }
    try {
      const params = {
        hotelId: roomAllocForm.hotelId,
        roomTypeId: roomAllocForm.roomTypeId,
        checkInDate: roomAllocForm.checkInDate,
        checkOutDate: roomAllocForm.checkOutDate
      };
      if (editingRoomAlloc) {
        params.excludeRoomId = editingRoomAlloc.id;
      }
      const response = await bookingsApi.checkRoomAvailability(id, params);
      setAvailability(response.data);
    } catch (error) {
      console.error('Availability check error:', error);
    }
  };

  // Calculate nights from dates
  const calculateNights = () => {
    if (!roomAllocForm.checkInDate || !roomAllocForm.checkOutDate) return 0;
    const checkIn = new Date(roomAllocForm.checkInDate);
    const checkOut = new Date(roomAllocForm.checkOutDate);
    return Math.max(0, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  };

  const saveRoomAlloc = async () => {
    if (!roomAllocForm.hotelId || !roomAllocForm.roomTypeId) {
      toast.error('Выберите отель и тип номера');
      return;
    }

    if (!roomAllocForm.checkInDate || !roomAllocForm.checkOutDate) {
      toast.error('Укажите даты заезда и выезда');
      return;
    }

    const nights = calculateNights();
    if (nights <= 0) {
      toast.error('Дата выезда должна быть позже даты заезда');
      return;
    }

    try {
      if (editingRoomAlloc) {
        await bookingsApi.updateRoom(id, editingRoomAlloc.id, roomAllocForm);
        toast.success('Accommodation updated');
      } else {
        await bookingsApi.addRoom(id, roomAllocForm);
        toast.success('Accommodation added');
      }
      setRoomModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const deleteRoomAlloc = async (roomAllocId) => {
    if (!confirm('Удалить это размещение?')) return;

    try {
      await bookingsApi.deleteRoom(id, roomAllocId);
      toast.success('Accommodation deleted');
      loadData();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // Route module helper functions

  // Auto-determine Rate Type based on route name and provider
  const getAutoRateType = (routeName, provider) => {
    if (!routeName || !provider) return '';

    const route = routeName.toLowerCase();

    if (provider === 'xayrulla') {
      if (route.includes('pickup') || route.includes('drop-off') || route.includes('train station')) {
        return 'vstrecha';
      }
      if (route.includes('chimgan') || route.includes('charvak')) {
        return 'chimgan';
      }
      if (route.includes('city tour')) {
        return 'cityTour';
      }
      return 'tag'; // Default for transfers
    }

    if (provider === 'sevil') {
      if (route.includes('pickup') || route.includes('drop-off') || route.includes('train station')) {
        return 'pickupDropoff';
      }
      if (route.includes('urgench')) {
        return 'urgenchRate';
      }
      if (route.includes('shovot')) {
        return 'shovotRate';
      }
      return 'tagRate'; // Default for city tours and transfers
    }

    if (provider === 'nosir') {
      if (route.includes('margilan')) return 'margilan';
      if (route.includes('kokand') || route.includes('qoqon')) return 'qoqon';
      return 'toshkent';
    }

    return '';
  };

  // Get price from Opex data based on provider, transport type, and rate
  const getPriceFromOpex = (provider, transportType, rateType) => {
    if (!provider || !transportType || !rateType) return '';

    let vehicles = [];
    let rateField = rateType;

    // Map rate type to actual field name
    const rateFieldMap = {
      // Sevil
      'pickupDropoff': 'pickupDropoff',
      'tagRate': 'tagRate',
      'urgenchRate': 'urgenchRate',
      'shovotRate': 'shovotRate2',
      // Xayrulla
      'vstrecha': 'vstrecha',
      'chimgan': 'chimgan',
      'tag': 'tag',
      'oybek': 'oybek',
      'chernyayevka': 'chernyayevka',
      'cityTour': 'cityTour',
      // Nosir
      'margilan': 'margilan',
      'qoqon': 'qoqon',
      'dostlik': 'dostlik',
      'toshkent': 'toshkent'
    };

    rateField = rateFieldMap[rateType] || rateType;

    // Select the right vehicle list based on provider
    if (provider === 'sevil' || ['pickupDropoff', 'tagRate', 'urgenchRate', 'shovotRate'].includes(rateType)) {
      vehicles = sevilVehicles;
    } else if (provider === 'xayrulla' || ['vstrecha', 'chimgan', 'tag', 'oybek', 'chernyayevka', 'cityTour'].includes(rateType)) {
      vehicles = xayrullaVehicles;
    } else if (provider === 'nosir' || ['margilan', 'qoqon', 'dostlik', 'toshkent'].includes(rateType)) {
      vehicles = nosirVehicles;
    }

    // Find the vehicle by transport type name (partial match)
    const transportLower = transportType?.toLowerCase() || '';
    const vehicle = vehicles.find(v => {
      const vName = v.name?.toLowerCase() || '';
      // Exact match or partial match (e.g., "Joylong" matches "Joylong (5-8)")
      return vName === transportLower ||
             transportLower.includes(vName) ||
             vName.includes(transportLower.split(' (')[0]);
    });

    if (vehicle && vehicle[rateField]) {
      return vehicle[rateField].toString();
    }

    return '';
  };

  const findBestVehicle = (vehicles, personCount, provider) => {
    if (!personCount || personCount === '') return null;

    const count = parseInt(personCount);
    if (isNaN(count)) return null;

    // Parse person range (e.g., "5-8" or "9-20") and find vehicle where count falls within range
    const suitableVehicles = vehicles.filter(v => {
      const personRange = v.person || '';
      if (personRange.includes('-')) {
        const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
        return !isNaN(min) && !isNaN(max) && count >= min && count <= max;
      }
      // Fallback to seats if person range not defined
      const seats = parseInt(v.seats);
      return !isNaN(seats) && seats >= count;
    });

    if (suitableVehicles.length === 0) {
      // If no exact match, find vehicle with capacity >= person count
      const largerVehicles = vehicles.filter(v => {
        const seats = parseInt(v.seats);
        return !isNaN(seats) && seats >= count;
      });
      if (largerVehicles.length > 0) {
        largerVehicles.sort((a, b) => parseInt(a.seats) - parseInt(b.seats));
        return largerVehicles[0];
      }
      return null;
    }

    // For xayrulla and sevil: prefer Yutong 33 over Sprinter when both match
    if (provider === 'xayrulla' || provider === 'sevil') {
      const yutong = suitableVehicles.find(v => v.name.toLowerCase().includes('yutong'));
      const sprinter = suitableVehicles.find(v => v.name.toLowerCase().includes('sprinter'));
      if (yutong && sprinter) return yutong;
    }

    // Return first suitable vehicle
    return suitableVehicles[0];
  };

  // Get vehicles list by provider
  const getVehiclesByProvider = (provider) => {
    if (provider === 'sevil') return sevilVehicles;
    if (provider === 'xayrulla') return xayrullaVehicles;
    if (provider === 'nosir') return nosirVehicles;
    return [];
  };

  // Get best vehicle for provider and person count from localStorage data
  // Custom logic: For xayrulla and sevil, prefer Yutong 33 over Sprinter when both match
  // Sprinter is only for Chimgan routes (handled separately)
  const getBestVehicleForRoute = (provider, personCount) => {
    const count = parseInt(personCount) || 0;
    if (count <= 0) return '';

    // Get vehicles from localStorage
    const vehicles = getVehiclesByProvider(provider);

    // Find all vehicles that match the person count
    const suitable = vehicles.filter(v => {
      const personRange = v.person || '';
      if (personRange.includes('-')) {
        const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
        return !isNaN(min) && !isNaN(max) && count >= min && count <= max;
      }
      return false;
    });

    if (suitable.length > 0) {
      // For xayrulla and sevil: prefer Yutong 33 over Sprinter when both match
      if (provider === 'xayrulla' || provider === 'sevil') {
        const yutong = suitable.find(v => v.name.toLowerCase().includes('yutong'));
        const sprinter = suitable.find(v => v.name.toLowerCase().includes('sprinter'));
        if (yutong && sprinter) {
          return yutong.name;
        }
      }
      return suitable[0].name;
    }

    // If no match by person range, use the standard logic
    const allVehicles = getVehiclesByProvider(provider);
    const bestVehicle = findBestVehicle(allVehicles, personCount, provider);
    return bestVehicle ? bestVehicle.name : '';
  };

  // Get rate type by route name
  const getRateByRoute = (routeName) => {
    if (!routeName) return '';

    const route = routeName.toLowerCase();

    // Chimgan routes
    if (route.includes('chimgan')) return 'chimgan';

    // Airport pickup/drop-off
    if (route.includes('airport') || route.includes('pickup') || route.includes('drop-off')) {
      return '';  // Pickup/drop-off uses special rate
    }

    // Train station
    if (route.includes('train station')) return '';

    // City tours
    if (route.includes('city tour')) return 'city';

    // Khiva - Urgench (UZ tourists)
    if (route.includes('khiva') && route.includes('urgench')) return 'urgench';

    // Khiva - Shovot (TM tourists)
    if (route.includes('khiva') && route.includes('shovot')) return 'shovot';

    // Inter-city routes (Tashkent - Samarkand, etc.)
    if (route.includes(' - ') && !route.includes('city tour')) {
      return 'inter';
    }

    // Default to inter
    return 'inter';
  };

  const handleOpenProviderModal = (route) => {
    setEditingRouteForProvider(route);
    const providerTab = route.choiceTab || 'sevil';
    setSelectedProviderTab(providerTab);
    setShowProviderModal(true);
  };

  const handleSelectProvider = (vehicleData, selectedRate = null) => {
    // Check if vehicle can accommodate the person count
    const personCount = editingRouteForProvider?.person;
    if (personCount && vehicleData.seats) {
      const count = parseInt(personCount);
      const seats = parseInt(vehicleData.seats);

      if (!isNaN(count) && !isNaN(seats) && seats < count) {
        toast.error(`This vehicle (${seats} seats) cannot accommodate ${count} people`);
        return;
      }
    }

    // Update the route with selected provider info (only ER now)
    const updatedRoutes = erRoutes.map(r =>
      r.id === editingRouteForProvider.id
        ? {
            ...r,
            choiceTab: selectedProviderTab,
            transportType: vehicleData.name,
            choiceRate: selectedRate,
            price: vehicleData.selectedRate || ''
          }
        : r
    );
    setErRoutes(updatedRoutes);

    setShowProviderModal(false);
    toast.success('Transport selected');
  };

  // Route edit and delete handlers
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState({
    nomer: '',
    sana: '',
    shahar: '',
    route: '',
    person: '',
    transportType: '',
    choiceTab: '',
    choiceRate: '',
    price: ''
  });
  const [showRouteModal, setShowRouteModal] = useState(false);

  const handleEditRoute = (route) => {
    setEditingRoute(route);
    setRouteForm({
      nomer: route.nomer || '',
      sana: route.sana || '',
      shahar: route.shahar || '',
      route: route.route,
      person: route.person,
      transportType: route.transportType,
      choiceTab: route.choiceTab,
      choiceRate: route.choiceRate,
      price: route.price
    });
    setShowRouteModal(true);
  };

  const handleDeleteRoute = (routeId) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      setErRoutes(erRoutes.filter(r => r.id !== routeId));
      toast.success('Route deleted');
    }
  };

  // Determine provider based on city
  const getProviderByCity = (city) => {
    if (!city) return '';
    const cityLower = city.toLowerCase().trim();

    // Tashkent -> Xayrulla
    if (cityLower.includes('tashkent') || cityLower.includes('toshkent') || cityLower.includes('ташкент')) {
      return 'xayrulla';
    }
    // Fergana region -> Nosir
    if (cityLower.includes('fergana') || cityLower.includes('fargona') || cityLower.includes('фергана') ||
        cityLower.includes('andijan') || cityLower.includes('andijon') || cityLower.includes('андижан') ||
        cityLower.includes('namangan') || cityLower.includes('наманган') ||
        cityLower.includes('kokand') || cityLower.includes('qoqon') || cityLower.includes('коканд') ||
        cityLower.includes('margilan') || cityLower.includes('margʻilon') || cityLower.includes('маргилан')) {
      return 'nosir';
    }
    // Other cities (Samarkand, Bukhara, Khiva, etc.) -> Sevil
    return 'sevil';
  };

  // Auto-determine rate based on route name and provider
  const getAutoRateByRoute = (routeName, provider) => {
    if (!routeName || !provider) return '';
    const routeLower = routeName.toLowerCase();

    if (provider === 'xayrulla') {
      if (routeLower.includes('chimgan') || routeLower.includes('chimyon')) return 'chimgan';
      if (routeLower.includes('city tour') || routeLower.includes('sightseeing')) return 'cityTour';
      if (routeLower.includes('pick-up') || routeLower.includes('drop-off') || routeLower.includes('pickup') || routeLower.includes('dropoff') || routeLower.includes('airport') || routeLower.includes('train station')) return 'vstrecha';
      if (routeLower.includes('tag') || routeLower.includes('таг')) return 'tag';
      if (routeLower.includes('oybek') || routeLower.includes('ойбек')) return 'oybek';
      if (routeLower.includes('chernyayevka') || routeLower.includes('чернявка')) return 'chernyayevka';
      return 'vstrecha'; // Default for xayrulla
    }

    if (provider === 'sevil') {
      if (routeLower.includes('pick-up') || routeLower.includes('drop-off') || routeLower.includes('pickup') || routeLower.includes('dropoff')) return 'pickupDropoff';
      if (routeLower.includes('tag') || routeLower.includes('таг')) return 'tagRate';
      if (routeLower.includes('urgench') || routeLower.includes('ургенч')) return 'urgenchRate';
      if (routeLower.includes('shovot') || routeLower.includes('шовот')) return 'shovotRate';
      return 'pickupDropoff'; // Default for sevil
    }

    if (provider === 'nosir') {
      if (routeLower.includes('margilan') || routeLower.includes('margʻilon') || routeLower.includes('маргилан')) return 'margilan';
      if (routeLower.includes('kokand') || routeLower.includes('qoqon') || routeLower.includes('коканд')) return 'qoqon';
      if (routeLower.includes('dostlik') || routeLower.includes('дустлик')) return 'dostlik';
      if (routeLower.includes('tashkent') || routeLower.includes('toshkent') || routeLower.includes('ташкент')) return 'toshkent';
      return 'margilan'; // Default for nosir
    }

    return '';
  };

  const handleCityChange = (routeId, newCity) => {
    const autoProvider = getProviderByCity(newCity);
    setErRoutes(erRoutes.map(r => {
      if (r.id === routeId) {
        // If provider changes, auto-select best vehicle for person count
        const providerChanged = autoProvider && autoProvider !== r.choiceTab;
        const newProvider = autoProvider || r.choiceTab;
        const autoVehicle = providerChanged ? getBestVehicleForRoute(newProvider, r.person) : r.transportType;
        return {
          ...r,
          shahar: newCity,
          choiceTab: newProvider,
          transportType: autoVehicle,
          choiceRate: providerChanged ? '' : r.choiceRate,
          price: providerChanged ? '' : r.price
        };
      }
      return r;
    }));
  };

  // Sort routes by date chronologically
  const sortRoutesByDate = (routes) => {
    return [...routes].sort((a, b) => {
      // Routes without dates go to the end
      if (!a.sana && !b.sana) return 0;
      if (!a.sana) return 1;
      if (!b.sana) return -1;

      const dateA = new Date(a.sana);
      const dateB = new Date(b.sana);
      return dateA - dateB;
    });
  };

  const handleRouteDateChange = (routeIndex, newDate) => {
    const updatedRoutes = [...erRoutes];
    updatedRoutes[routeIndex].sana = newDate;

    // Auto-sort routes by date after changing date
    // This will move the route to its correct chronological position
    const sortedRoutes = sortRoutesByDate(updatedRoutes);
    setErRoutes(sortedRoutes);
  };


  const handleSaveRoute = () => {
    if (!routeForm.route) {
      toast.error('Please enter route name');
      return;
    }

    if (editingRoute) {
      // Update existing route
      const updatedRoutes = erRoutes.map(r =>
        r.id === editingRoute.id
          ? { ...r, ...routeForm }
          : r
      );
      // Auto-sort routes by date after updating
      setErRoutes(sortRoutesByDate(updatedRoutes));
      toast.success('Route updated');
    } else {
      // Add new route
      const newRoute = {
        id: Math.max(...erRoutes.map(r => r.id), 0) + 1,
        ...routeForm
      };
      // Auto-sort routes by date after adding new route
      const updatedRoutes = sortRoutesByDate([...erRoutes, newRoute]);
      setErRoutes(updatedRoutes);
      toast.success('Route added');
    }

    setShowRouteModal(false);
    setEditingRoute(null);
    setRouteForm({
      nomer: '',
      sana: '',
      shahar: '',
      route: '',
      person: '',
      transportType: '',
      choiceTab: '',
      choiceRate: '',
      price: ''
    });
  };

  const handleAddRoute = () => {
    const lastRoute = erRoutes[erRoutes.length - 1];
    const newId = lastRoute ? lastRoute.id + 1 : 1;

    // Calculate next dayOffset and date
    const newDayOffset = lastRoute?.dayOffset != null ? lastRoute.dayOffset + 1 : erRoutes.length;
    let nextDate = '';

    // Calculate date from Arrival + dayOffset
    if (formData.departureDate) {
      const arrivalDate = addDays(new Date(formData.departureDate), 1);
      nextDate = format(addDays(arrivalDate, newDayOffset), 'yyyy-MM-dd');
    } else if (lastRoute?.sana) {
      const lastDate = new Date(lastRoute.sana);
      nextDate = format(addDays(lastDate, 1), 'yyyy-MM-dd');
    }

    const newRoute = {
      id: newId,
      nomer: '',
      sana: nextDate,
      dayOffset: newDayOffset,
      shahar: '',
      route: '',
      person: lastRoute?.person || '',
      transportType: lastRoute?.transportType || '',
      choiceTab: '',
      choiceRate: '',
      price: ''
    };

    // Auto-sort routes by date after adding new route
    const updatedRoutes = sortRoutesByDate([...erRoutes, newRoute]);
    setErRoutes(updatedRoutes);
  };

  // Handle route selection with auto-split for Uzbekistan/Turkmenistan groups
  const handleRouteSelectionChange = (routeId, newRouteValue, routeIndex) => {
    // Calculate pax from tourists data
    const uzbekistanTourists = tourists.filter(t => {
      const acc = (t.accommodation || '').toLowerCase();
      return !acc.includes('turkmen') && !acc.includes('туркмен');
    });
    const turkmenistanTourists = tourists.filter(t => {
      const acc = (t.accommodation || '').toLowerCase();
      return acc.includes('turkmen') || acc.includes('туркмен');
    });

    const paxUzb = uzbekistanTourists.length || parseInt(formData.paxUzbekistan) || 0;
    const paxTkm = turkmenistanTourists.length || parseInt(formData.paxTurkmenistan) || 0;
    const currentRoute = erRoutes.find(r => r.id === routeId);
    const currentDate = currentRoute?.sana || '';

    // Check if this is a split route
    if (newRouteValue === 'Khiva - Urgench' && paxUzb > 0) {
      // Uzbekistan group: Khiva -> Urgench -> fly to Tashkent
      const autoVehicleUzb = getBestVehicleForRoute('sevil', paxUzb);

      // Create routes for split
      const maxId = Math.max(...erRoutes.map(r => r.id));
      const nextDate = currentDate ? format(addDays(new Date(currentDate), 1), 'yyyy-MM-dd') : '';

      // Uzbekistan group: Airport Pickup in Tashkent (same day)
      const tashkentPickup = {
        id: maxId + 1,
        nomer: '',
        sana: currentDate, // Same day - they fly to Tashkent
        shahar: 'Tashkent',
        route: 'Airport Pickup',
        person: paxUzb.toString(),
        transportType: getBestVehicleForRoute('xayrulla', paxUzb),
        choiceTab: 'xayrulla',
        choiceRate: '',
        price: ''
      };

      // Uzbekistan group: Airport Drop-off in Tashkent (next day)
      const tashkentDropoff = {
        id: maxId + 2,
        nomer: '',
        sana: nextDate,
        shahar: 'Tashkent',
        route: 'Airport Drop-off',
        person: paxUzb.toString(),
        transportType: getBestVehicleForRoute('xayrulla', paxUzb),
        choiceTab: 'xayrulla',
        choiceRate: '',
        price: ''
      };

      // Turkmenistan group: Khiva -> Shovot (next day) - if there are Turkmenistan tourists
      const newRoutesToAdd = [tashkentPickup, tashkentDropoff];
      if (paxTkm > 0) {
        const autoVehicleTkm = getBestVehicleForRoute('sevil', paxTkm);
        const khivaShovot = {
          id: maxId + 3,
          nomer: '',
          sana: nextDate, // Next day - Turkmenistan group leaves
          shahar: 'Khiva',
          route: 'Khiva - Shovot',
          person: paxTkm.toString(),
          transportType: autoVehicleTkm,
          choiceTab: 'sevil',
          choiceRate: '',
          price: ''
        };
        newRoutesToAdd.push(khivaShovot);
      }

      // Update current route and add new routes
      const updatedRoutes = erRoutes.map(r => {
        if (r.id === routeId) {
          return {
            ...r,
            route: newRouteValue,
            person: paxUzb.toString(),
            transportType: autoVehicleUzb,
            choiceTab: 'sevil',
            choiceRate: '',
            price: ''
          };
        }
        return r;
      });

      // Insert new routes after the current route
      const insertIndex = routeIndex + 1;
      updatedRoutes.splice(insertIndex, 0, ...newRoutesToAdd);

      // Auto-sort routes by date after adding split routes
      setErRoutes(sortRoutesByDate(updatedRoutes));
      return;
    }

    if (newRouteValue === 'Khiva - Shovot' && paxTkm > 0) {
      // Turkmenistan group: Khiva -> Shovot
      const autoVehicle = getBestVehicleForRoute('sevil', paxTkm);

      const updatedRoutes = erRoutes.map(r => {
        if (r.id === routeId) {
          return {
            ...r,
            route: newRouteValue,
            person: paxTkm.toString(),
            transportType: autoVehicle,
            choiceTab: 'sevil',
            choiceRate: '',
            price: ''
          };
        }
        return r;
      });

      // Auto-sort routes by date after updating route
      setErRoutes(sortRoutesByDate(updatedRoutes));
      return;
    }

    // Special handling for Tashkent - Chimgan route: ALWAYS use Sprinter
    if (newRouteValue === 'Tashkent - Chimgan' || newRouteValue === 'Chimgan Excursion') {
      const currentRoute = erRoutes.find(r => r.id === routeId);
      const personCount = parseInt(currentRoute?.person) || paxUzb || 0;

      const updatedRoutes = erRoutes.map(r => {
        if (r.id === routeId) {
          const autoPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
          return {
            ...r,
            route: newRouteValue,
            person: personCount > 0 ? personCount.toString() : r.person,
            choiceTab: 'xayrulla',
            transportType: 'Sprinter',
            choiceRate: 'chimgan',
            price: autoPrice || ''
          };
        }
        return r;
      });
      // Auto-sort routes by date after updating route
      setErRoutes(sortRoutesByDate(updatedRoutes));
      return;
    }

    // Default behavior for other routes
    const updatedRoutes = erRoutes.map(r =>
      r.id === routeId ? { ...r, route: newRouteValue } : r
    );
    // Auto-sort routes by date after updating route
    setErRoutes(sortRoutesByDate(updatedRoutes));
  };

  // Auto-fix all routes when tourists data changes
  useEffect(() => {
    console.log('🔍 Auto-fix useEffect triggered:', { routesCount: erRoutes?.length, touristsCount: tourists.length });

    if (!erRoutes || erRoutes.length === 0 || tourists.length === 0) {
      console.log('❌ Skipped: No routes or tourists');
      return;
    }

    // Calculate PAX counts
    const paxUzb = tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length;
    const paxTkm = tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;
    const totalPax = paxUzb + paxTkm;

    console.log('📊 PAX:', { total: totalPax, uzb: paxUzb, tkm: paxTkm });

    // Check if any route has "Select" vehicle or empty price
    const routesWithIssues = erRoutes.filter(r =>
      !r.transportType ||
      r.transportType === 'Select' ||
      r.transportType === ''
    );

    console.log('🚗 Routes with missing vehicles:', routesWithIssues.length, routesWithIssues.map(r => r.route));

    if (routesWithIssues.length === 0) {
      console.log('✅ All routes have vehicles');
      return;
    }

    console.log('🔄 Auto-fixing routes (vehicles missing)...');

    // Find split point
    const urgenchIndex = erRoutes.findIndex(r => r.route === 'Khiva - Urgench');
    const hasShovotRoute = erRoutes.some(r => r.route === 'Khiva - Shovot');

    // Fix each route
    const fixedRoutes = erRoutes.map((route, index) => {
      // Determine PAX for this route
      let routePax = totalPax;

      if (urgenchIndex !== -1 && hasShovotRoute) {
        if (route.route === 'Khiva - Urgench') {
          routePax = paxUzb;
        } else if (route.route === 'Khiva - Shovot') {
          routePax = paxTkm;
        } else if (index > urgenchIndex && route.shahar === 'Tashkent') {
          routePax = paxUzb;
        }
      }

      // Skip if PAX matches and vehicle exists
      if (parseInt(route.person) === routePax && route.transportType && route.transportType !== 'Select' && route.price) {
        return route;
      }

      if (routePax <= 0) return route;

      // Get provider
      const provider = route.choiceTab || getProviderByCity(route.shahar);

      // Special handling for Chimgan routes
      const isChimganRoute = route.route === 'Tashkent - Chimgan' ||
                             route.route === 'Tashkent - Chimgan - Tashkent' ||
                             route.route === 'Chimgan Excursion';

      if (isChimganRoute) {
        const chimganPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
        return {
          ...route,
          person: routePax.toString(),
          choiceTab: 'xayrulla',
          transportType: 'Sprinter',
          choiceRate: 'chimgan',
          price: chimganPrice || route.price
        };
      }

      // Get best vehicle
      const vehicle = getBestVehicleForRoute(provider, routePax);

      // IMPORTANT: Keep existing rate type - do NOT auto-change it
      // User wants to manually control Rate Type
      const rate = route.choiceRate || '';

      // Get price using existing rate (if rate exists)
      let price = route.price;
      if (vehicle && rate) {
        const calculatedPrice = getPriceFromOpex(provider, vehicle, rate);
        if (calculatedPrice) {
          price = calculatedPrice;
        }
      }

      return {
        ...route,
        person: routePax.toString(),
        choiceTab: provider,
        transportType: vehicle || route.transportType,
        choiceRate: rate, // Keep existing rate
        price: price
      };
    });

    setErRoutes(fixedRoutes);
  }, [tourists.length]); // Re-run when tourist count changes

  // Auto-update PAX for split routes when tourists data changes
  useEffect(() => {
    if (tourists.length === 0) return;

    // Calculate pax from tourists
    const paxUzb = tourists.filter(t => {
      const acc = (t.accommodation || '').toLowerCase();
      return !acc.includes('turkmen') && !acc.includes('туркмен');
    }).length;
    const paxTkm = tourists.filter(t => {
      const acc = (t.accommodation || '').toLowerCase();
      return acc.includes('turkmen') || acc.includes('туркмен');
    }).length;

    // Find the index of Khiva - Urgench route (split point)
    const urgenchIndex = erRoutes.findIndex(r => r.route === 'Khiva - Urgench');
    const hasShovotRoute = erRoutes.some(r => r.route === 'Khiva - Shovot');

    // Calculate total PAX
    const totalPax = tourists.length;

    // Update ALL routes with auto-calculated vehicle, rate, and price
    const updatedRoutes = erRoutes.map((r, index) => {
      // Determine which PAX to use based on route position and type
      let routePax = totalPax;

      // Special handling for split routes (Turkmenistan extension)
      if (urgenchIndex !== -1 && hasShovotRoute) {
        if (r.route === 'Khiva - Urgench') {
          routePax = paxUzb;
        } else if (r.route === 'Khiva - Shovot') {
          routePax = paxTkm;
        } else if (index > urgenchIndex && r.shahar === 'Tashkent') {
          routePax = paxUzb; // Only Uzbekistan group returns to Tashkent
        }
      }

      // Skip if no PAX to update
      if (routePax <= 0) return r;

      // Special handling for Chimgan routes - always use Sprinter
      const isChimganRoute = r.route === 'Tashkent - Chimgan' || r.route === 'Tashkent - Chimgan - Tashkent' || r.route === 'Chimgan Excursion';
      if (isChimganRoute) {
        const chimganPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
        return {
          ...r,
          person: routePax.toString(),
          choiceTab: 'xayrulla',
          transportType: 'Sprinter',
          choiceRate: 'chimgan',
          price: chimganPrice || r.price
        };
      }

      // Auto-determine provider from city
      const provider = r.choiceTab || getProviderByCity(r.shahar);
      if (!provider) return r;

      // Auto-select vehicle based on PAX
      const newVehicle = getBestVehicleForRoute(provider, routePax);
      if (!newVehicle) return r;

      // Auto-determine rate from route name
      const autoRate = r.choiceRate || getAutoRateByRoute(r.route, provider);

      // Calculate price
      const newPrice = autoRate ? getPriceFromOpex(provider, newVehicle, autoRate) : '';

      return {
        ...r,
        person: routePax.toString(),
        choiceTab: provider,
        transportType: newVehicle,
        choiceRate: autoRate || r.choiceRate,
        price: newPrice || r.price
      };
    });

    // Only update if something changed
    const hasChanges = updatedRoutes.some((r, i) =>
      r.person !== erRoutes[i].person ||
      r.transportType !== erRoutes[i].transportType ||
      r.price !== erRoutes[i].price ||
      r.choiceTab !== erRoutes[i].choiceTab ||
      r.choiceRate !== erRoutes[i].choiceRate
    );
    if (hasChanges) {
      setErRoutes(updatedRoutes);
    }
  }, [tourists]);

  // Chimgan routes are now handled in the template - no need for additional fix

  // Save all routes to database
  const handleSaveAllRoutes = async () => {
    if (!id || isNew) {
      toast.error('Сначала сохраните бронирование');
      return;
    }

    try {
      const routesToSave = erRoutes.map((r, index) => ({
        dayNumber: index + 1,
        date: r.sana || null,
        city: r.shahar || null,
        routeName: r.route || '',
        personCount: parseInt(r.person) || 0,
        transportType: r.transportType || null,
        provider: r.choiceTab || null,
        optionRate: r.choiceRate || null,
        price: parseFloat(r.price) || 0
      }));

      await routesApi.bulkUpdate(id, routesToSave);
      toast.success('Маршруты сохранены');
    } catch (error) {
      console.error('Error saving routes:', error);
      toast.error('Ошибка сохранения маршрутов');
    }
  };

  // Save current routes as template for ER tour type
  const handleSaveAsTemplate = async () => {
    console.log('💾 Save as Template clicked');

    if (!erRoutes || erRoutes.length === 0) {
      toast.error('Нет маршрутов для сохранения');
      return;
    }

    try {
      // Get tour type code (ER, CO, KAS, ZA)
      let tourTypeCode = booking?.tourType?.code;
      if (!tourTypeCode && formData.tourTypeId) {
        const tourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
        tourTypeCode = tourType?.code;
      }
      console.log('📋 Tour type code:', tourTypeCode);

      if (!tourTypeCode) {
        toast.error('Тип тура не определён');
        return;
      }

      const routesToSave = erRoutes.map((r, index) => ({
        dayNumber: index + 1,
        dayOffset: r.dayOffset || index,
        city: r.shahar || null,
        routeName: r.route || '',
        provider: r.choiceTab || null,
        optionRate: r.choiceRate || null,
        sortOrder: index
      }));

      console.log(`💾 Saving ${routesToSave.length} routes as template for ${tourTypeCode}`);
      const response = await routesApi.saveTemplate(tourTypeCode, routesToSave);
      console.log('✅ Save response:', response.data);
      toast.success(`✅ Шаблон ${tourTypeCode} сохранён в базу данных`);
    } catch (error) {
      console.error('❌ Error saving route template:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Ошибка сохранения шаблона: ' + (error.response?.data?.error || error.message));
    }
  };

  // Load routes from database template
  const handleLoadFromTemplate = async () => {
    console.log('📥 Load Template clicked');

    try {
      // Get tour type code (ER, CO, KAS, ZA)
      let tourTypeCode = booking?.tourType?.code;
      if (!tourTypeCode && formData.tourTypeId) {
        const tourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
        tourTypeCode = tourType?.code;
      }
      console.log('📋 Tour type code:', tourTypeCode);

      if (!tourTypeCode) {
        toast.error('Тип тура не определён');
        return;
      }

      console.log(`📥 Loading template for ${tourTypeCode}...`);
      const response = await routesApi.getTemplate(tourTypeCode);
      const templates = response.data.templates;

      console.log(`📋 Received ${templates?.length || 0} templates from database`);

      if (!templates || templates.length === 0) {
        toast.error(`Шаблон для ${tourTypeCode} не найден в базе данных`);
        return;
      }

      // Calculate dates and populate routes
      const bookingDepartureDate = booking?.departureDate ? new Date(booking.departureDate) : formData.departureDate ? new Date(formData.departureDate) : null;
      const totalPax = tourists.length || 0;

      const loadedRoutes = templates.map((template, index) => {
        const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, 1) : null;
        const routeDate = arrivalDate ? format(addDays(arrivalDate, template.dayOffset), 'yyyy-MM-dd') : '';

        // Auto-select vehicle based on PAX
        const autoVehicle = template.provider ? getBestVehicleForRoute(template.provider, totalPax) : '';

        return {
          id: index + 1,
          nomer: template.dayNumber?.toString() || '',
          sana: routeDate,
          dayOffset: template.dayOffset,
          shahar: template.city || '',
          route: template.routeName || '',
          person: totalPax.toString(),
          transportType: autoVehicle,
          choiceTab: template.provider || '',
          choiceRate: template.optionRate || '',
          price: ''
        };
      });

      // Auto-sort routes by date after loading from template
      setErRoutes(sortRoutesByDate(loadedRoutes));
      console.log(`✅ Loaded ${loadedRoutes.length} routes from template`);
      toast.success(`✅ Загружено ${templates.length} маршрутов из шаблона ${tourTypeCode}`);
    } catch (error) {
      console.error('❌ Error loading route template:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Ошибка загрузки шаблона: ' + (error.response?.data?.error || error.message));
    }
  };

  // Save current accommodations as template for ER tour type
  const handleSaveAccommodationsAsTemplate = async () => {
    console.log('💾 Save Accommodations as Template clicked');

    if (!accommodations || accommodations.length === 0) {
      toast.error('Нет размещений для сохранения');
      return;
    }

    try {
      // Get tour type code (ER, CO, KAS, ZA)
      let tourTypeCode = booking?.tourType?.code;
      if (!tourTypeCode && formData.tourTypeId) {
        const tourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
        tourTypeCode = tourType?.code;
      }
      console.log('📋 Tour type code:', tourTypeCode);

      if (!tourTypeCode) {
        toast.error('Тип тура не определён');
        return;
      }

      // Calculate check-in/out offsets from departure date
      const departureDate = booking?.departureDate ? new Date(booking.departureDate) : formData.departureDate ? new Date(formData.departureDate) : null;

      const accommodationsToSave = accommodations.map((acc, index) => {
        let checkInOffset = 0;
        let checkOutOffset = 1;
        let nights = 1;

        if (departureDate && acc.checkInDate) {
          const checkIn = new Date(acc.checkInDate);
          const checkOut = acc.checkOutDate ? new Date(acc.checkOutDate) : addDays(checkIn, 1);

          // Calculate offset from departure date
          checkInOffset = Math.floor((checkIn - departureDate) / (1000 * 60 * 60 * 24));
          checkOutOffset = Math.floor((checkOut - departureDate) / (1000 * 60 * 60 * 24));
          nights = Math.max(1, checkOutOffset - checkInOffset);
        }

        return {
          hotelId: acc.hotelId,
          hotelName: acc.hotel?.name,
          cityId: acc.hotel?.cityId,
          cityName: acc.hotel?.city?.name,
          checkInOffset,
          checkOutOffset,
          nights,
          sortOrder: index
        };
      });

      console.log(`💾 Saving ${accommodationsToSave.length} accommodations as template for ${tourTypeCode}`);
      const response = await accommodationsApi.saveTemplate(tourTypeCode, accommodationsToSave);
      console.log('✅ Save response:', response.data);
      toast.success(`✅ Шаблон размещений ${tourTypeCode} сохранён в базу данных`);
    } catch (error) {
      console.error('❌ Error saving accommodation template:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Ошибка сохранения шаблона: ' + (error.response?.data?.error || error.message));
    }
  };

  // Load accommodations from database template
  const handleLoadAccommodationsFromTemplate = async () => {
    console.log('📥 Load Accommodations Template clicked');

    try {
      // Get tour type code (ER, CO, KAS, ZA)
      let tourTypeCode = booking?.tourType?.code;
      if (!tourTypeCode && formData.tourTypeId) {
        const tourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
        tourTypeCode = tourType?.code;
      }
      console.log('📋 Tour type code:', tourTypeCode);

      if (!tourTypeCode) {
        toast.error('Тип тура не определён');
        return;
      }

      console.log(`📥 Loading accommodation template for ${tourTypeCode}...`);
      const response = await accommodationsApi.getTemplate(tourTypeCode);
      const templates = response.data.templates;

      console.log(`📋 Received ${templates?.length || 0} accommodation templates from database`);

      if (!templates || templates.length === 0) {
        toast.error(`Шаблон размещений для ${tourTypeCode} не найден в базе данных`);
        return;
      }

      // Calculate actual dates from offsets
      const departureDate = booking?.departureDate ? new Date(booking.departureDate) : formData.departureDate ? new Date(formData.departureDate) : null;

      if (!departureDate) {
        toast.error('Дата вылета не установлена');
        return;
      }

      // Create accommodations from templates
      console.log(`🏨 Creating ${templates.length} accommodations from template...`);
      setSaving(true);

      const createdAccommodations = [];
      for (const template of templates) {
        // Calculate actual dates from offsets
        const checkInDate = new Date(departureDate);
        checkInDate.setDate(checkInDate.getDate() + template.checkInOffset);

        const checkOutDate = new Date(departureDate);
        checkOutDate.setDate(checkOutDate.getDate() + template.checkOutOffset);

        const accommodationData = {
          hotelId: template.hotelId,
          checkInDate: checkInDate.toISOString().split('T')[0],
          checkOutDate: checkOutDate.toISOString().split('T')[0]
        };

        console.log(`   Creating: ${template.hotelName} (${accommodationData.checkInDate} → ${accommodationData.checkOutDate})`);

        const response = await bookingsApi.createAccommodation(booking.id, accommodationData);
        createdAccommodations.push(response.data);
      }

      setSaving(false);
      console.log(`✅ Created ${createdAccommodations.length} accommodations from template`);
      toast.success(`✅ Загружено ${createdAccommodations.length} размещений из шаблона ${tourTypeCode}`);

      // Reload accommodations list
      await fetchAccommodations();
    } catch (error) {
      console.error('❌ Error loading accommodation template:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Ошибка загрузки шаблона: ' + (error.response?.data?.error || error.message));
    }
  };

  // Auto-fix all routes: set correct PAX, vehicle, and price
  const autoFixAllRoutes = async () => {
    if (!erRoutes || erRoutes.length === 0) {
      toast.error('No routes to fix');
      return;
    }

    try {
      setSaving(true);
      toast.loading('Fixing all routes...', { id: 'auto-fix' });

      // Calculate PAX counts
      const paxUzb = tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length;
      const paxTkm = tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;
      const totalPax = paxUzb + paxTkm;

      console.log(`🔧 Auto-fixing routes: PAX Total=${totalPax}, UZB=${paxUzb}, TKM=${paxTkm}`);

      // Find split point
      const urgenchIndex = erRoutes.findIndex(r => r.route === 'Khiva - Urgench');
      const hasShovotRoute = erRoutes.some(r => r.route === 'Khiva - Shovot');

      // Fix each route
      const fixedRoutes = erRoutes.map((route, index) => {
        // Determine PAX for this route
        let routePax = totalPax;

        if (urgenchIndex !== -1 && hasShovotRoute) {
          if (route.route === 'Khiva - Urgench') {
            routePax = paxUzb;
            console.log(`  Route ${index + 1}: Khiva - Urgench → UZB PAX = ${paxUzb}`);
          } else if (route.route === 'Khiva - Shovot') {
            routePax = paxTkm;
            console.log(`  Route ${index + 1}: Khiva - Shovot → TKM PAX = ${paxTkm}`);
          } else if (index > urgenchIndex && route.shahar === 'Tashkent') {
            routePax = paxUzb;
            console.log(`  Route ${index + 1}: ${route.route} (after split, Tashkent) → UZB PAX = ${paxUzb}`);
          }
        }

        if (routePax <= 0) {
          console.log(`  Route ${index + 1}: ${route.route} → Skipped (PAX = 0)`);
          return route;
        }

        // Get provider
        const provider = route.choiceTab || getProviderByCity(route.shahar);

        // Special handling for Chimgan routes
        const isChimganRoute = route.route === 'Tashkent - Chimgan' ||
                               route.route === 'Tashkent - Chimgan - Tashkent' ||
                               route.route === 'Chimgan Excursion';

        if (isChimganRoute) {
          const chimganPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
          console.log(`  Route ${index + 1}: ${route.route} → Chimgan (Sprinter, $${chimganPrice})`);
          return {
            ...route,
            person: routePax.toString(),
            choiceTab: 'xayrulla',
            transportType: 'Sprinter',
            choiceRate: 'chimgan',
            price: chimganPrice || route.price
          };
        }

        // Get best vehicle
        const vehicle = getBestVehicleForRoute(provider, routePax);

        // Get rate type based on route and provider
        let rate = '';
        const routeLower = route.route.toLowerCase();

        if (routeLower.includes('city tour')) {
          rate = provider === 'xayrulla' ? 'cityTour' : 'tagRate';
        } else if (routeLower.includes('urgench')) {
          rate = 'urgenchRate';
        } else if (routeLower.includes('shovot')) {
          rate = 'shovotRate';
        } else if (routeLower.includes('airport') || routeLower.includes('pickup') || routeLower.includes('drop')) {
          rate = provider === 'xayrulla' ? 'vstrecha' : 'pickupDropoff';
        } else if (routeLower.includes('train station')) {
          rate = provider === 'xayrulla' ? 'vstrecha' : 'pickupDropoff';
        } else {
          // Inter-city routes
          if (provider === 'sevil') rate = 'tagRate';
          else if (provider === 'xayrulla') rate = 'tag';
          else if (provider === 'nosir') rate = 'toshkent';
        }

        // Get price
        const price = getPriceFromOpex(provider, vehicle, rate);

        console.log(`  Route ${index + 1}: ${route.route} → PAX=${routePax}, ${provider}, ${vehicle}, ${rate}, $${price || '?'}`);

        return {
          ...route,
          person: routePax.toString(),
          choiceTab: provider,
          transportType: vehicle || route.transportType,
          choiceRate: rate || route.choiceRate,
          price: price || route.price
        };
      });

      // Update state
      setErRoutes(fixedRoutes);

      // Save to database
      const routesToSave = fixedRoutes.map((r, index) => ({
        dayNumber: index + 1,
        date: r.sana || null,
        city: r.shahar || null,
        routeName: r.route || '',
        personCount: parseInt(r.person) || 0,
        transportType: r.transportType || null,
        provider: r.choiceTab || null,
        optionRate: r.choiceRate || null,
        price: parseFloat(r.price) || 0
      }));

      await routesApi.bulkUpdate(id, routesToSave);

      toast.success('All routes auto-fixed!', { id: 'auto-fix' });
      console.log('✅ All routes fixed and saved');
    } catch (error) {
      console.error('Error auto-fixing routes:', error);
      toast.error('Error auto-fixing routes', { id: 'auto-fix' });
    } finally {
      setSaving(false);
    }
  };

  // Export PDF ЗАЯВКА for specific accommodation
  const handleAccommodationPdfExport = async (accommodation) => {
    try {
      console.log('🚀 Starting PDF export for accommodation:', accommodation.hotel?.name);
      toast.loading('Generating PDF...', { id: 'pdf-gen' });

      // Load logo
      let logoDataUrl = '';
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        logoDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        console.log('✅ Logo loaded');
      } catch (error) {
        console.warn('⚠️ Could not load logo:', error);
      }

      const hotelName = accommodation.hotel?.name || 'Не указан отель';
      const bookingNumber = booking?.bookingNumber || 'N/A';
      const country = 'Германия';

      // Get tourists for this accommodation (all tourists for now)
      const totalPax = tourists.length;

      // Calculate room counts from accommodation rooms
      let dblRooms = 0, twnRooms = 0, snglRooms = 0;
      accommodation.rooms?.forEach(room => {
        const roomType = room.roomTypeCode?.toUpperCase();
        if (roomType === 'DBL' || roomType === 'DOUBLE') dblRooms += room.roomsCount || 0;
        if (roomType === 'TWN' || roomType === 'TWIN') twnRooms += room.roomsCount || 0;
        if (roomType === 'SNGL' || roomType === 'SINGLE') snglRooms += room.roomsCount || 0;
      });

      // Format dates
      const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const arrivalDate = formatDisplayDate(accommodation.checkInDate);
      const departureDate = formatDisplayDate(accommodation.checkOutDate);

      // Build tourist rows
      let touristRows = '';
      tourists.forEach((t, idx) => {
        const name = t.fullName || `${t.lastName}, ${t.firstName}`;
        const roomType = t.roomPreference || '';
        const remarks = t.remarks && t.remarks !== '-' ? t.remarks : '';

        const displayArrival = t.checkInDate ? formatDisplayDate(t.checkInDate) : arrivalDate;
        const displayDeparture = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : departureDate;
        const rowBgColor = (t.checkInDate || t.checkOutDate) ? '#fffacd' : '';

        touristRows += `
          <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${idx + 1}</td>
            <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${displayArrival}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${displayDeparture}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomType}</td>
            <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          </tr>
        `;
      });

      // Create temp div
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '210mm';

      tempDiv.innerHTML = `
        <html><head><meta charset="UTF-8"><style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 9pt; line-height: 1.2; color: #000; padding: 12mm; }
          .header-table { width: 100%; border: none; border-collapse: collapse; margin-bottom: 15px; }
          .header-table td { border: none; padding: 8px; font-size: 7.5pt; }
          .logo-cell { text-align: center; vertical-align: middle; }
          .zayvka-title { text-align: center; font-size: 13pt; font-weight: bold; margin: 8px 0; }
          .intro-text { text-align: justify; margin: 6px 0; font-size: 9pt; }
          .summary-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .summary-table th, .summary-table td { border: 1px solid #000; padding: 3px; text-align: center; font-size: 8pt; }
          .summary-table th { background: #f0f0f0; font-weight: bold; }
          .rooming-title { text-align: center; font-size: 12pt; font-weight: bold; margin: 10px 0 6px 0; }
          .rooming-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          .rooming-table th, .rooming-table td { border: 1px solid #000; padding: 3px; font-size: 8pt; }
          .rooming-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
          .footer-text { margin: 8px 0; font-size: 8.5pt; }
          .signature-table { width: 100%; margin-top: 15px; }
          .signature-table td { padding: 3px; font-size: 8.5pt; }
        </style></head><body>
          <table class="header-table"><tr><td class="logo-cell" style="width:100%;text-align:center">
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Orient Insight" style="width:150px;height:auto;margin-bottom:8px" />` : '<div style="font-size:18pt;font-weight:bold;color:#D4842F;margin-bottom:8px">ORIENT INSIGHT</div>'}
            <div style="font-size:9pt;margin-top:5px"><strong>Республика Узбекистан,</strong><br>г.Самарканд, Шота Руставели, дом 45<br>Тел/fax.: +998 933484208, +998 97 9282814<br>E-Mail: orientinsightreisen@gmail.com<br>Website: orient-insight.uz</div>
          </td></tr></table>
          <div style="text-align:right;margin-bottom:10px;font-size:9pt"><strong>Директору гостиницы</strong><br><strong style="font-size:11pt">${hotelName}</strong></div>
          <div class="zayvka-title">ЗАЯВКА</div>
          <div class="intro-text">ООО <strong>"ORIENT INSIGHT"</strong> приветствует Вас, и просит забронировать места с учетом нижеследующих деталей.</div>
          <table class="summary-table"><thead><tr><th>№</th><th>Группа</th><th>Страна</th><th>PAX</th><th>Первый<br>заезд</th><th>Первый<br>выезд</th><th>DBL</th><th>TWN</th><th>SNGL</th><th>Тип номера</th></tr></thead>
          <tbody><tr><td>1</td><td>${bookingNumber}</td><td>${country}</td><td>${totalPax}</td><td>${arrivalDate}</td><td>${departureDate}</td><td>${dblRooms}</td><td>${twnRooms}</td><td>${snglRooms}</td><td>стандарт</td></tr></tbody></table>
          <div class="rooming-title">ROOMING LISTE</div>
          <table class="rooming-table"><thead><tr><th style="width:30px">№</th><th style="width:35%">ФИО</th><th style="width:15%">Дата заезда</th><th style="width:15%">дата выезда</th><th style="width:12%">Категория<br>номера</th><th>Дополнительная<br>информация</th></tr></thead>
          <tbody>${touristRows}</tbody></table>
          <div class="footer-text"><p style="margin-bottom:10px">Оплату гости произведут на месте.</p></div>
          <table class="signature-table"><tr><td style="width:60%"><strong>Директор ООО «ORIENT INSIGHT»</strong></td><td style="width:20%;border-bottom:1px solid #000;text-align:center"></td><td style="width:20%;text-align:center"><strong>Одилова М.У.</strong></td></tr></table>
        </body></html>
      `;

      document.body.appendChild(tempDiv);

      const opt = {
        margin: 0,
        filename: `ZAYVKA-${bookingNumber}-${hotelName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      console.log('🔄 Generating PDF...');
      await html2pdf().set(opt).from(tempDiv).save();

      document.body.removeChild(tempDiv);
      console.log('✅ PDF downloaded');
      toast.success('PDF downloaded successfully!', { id: 'pdf-gen' });
    } catch (error) {
      console.error('❌ PDF Export error:', error);
      toast.error('Error exporting PDF: ' + error.message, { id: 'pdf-gen' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 absolute top-0"></div>
          </div>
          <p className="text-gray-700 font-bold text-lg">Loading Booking Details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate(-1)}
              className="p-3 rounded-2xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white transition-all duration-300 shadow-md hover:shadow-xl"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {isNew ? 'Новое бронирование' : formData.bookingNumber}
              </h1>
              {!isNew && booking?.tourType && (
                <p className="text-gray-600 font-semibold text-base flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: booking.tourType.color }}></span>
                    <span>{booking.tourType.code} - {booking.tourType.name}</span>
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {editing ? (
              <>
                <button
                  onClick={() => isNew ? navigate(-1) : setEditing(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-2xl hover:bg-white hover:shadow-lg transition-all duration-300 font-bold text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white rounded-2xl shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 font-bold"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 rounded-2xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-blue-500 transition-all duration-300 font-bold shadow-md hover:shadow-xl"
                >
                  <Edit className="w-5 h-5" />
                  Редактировать
                </button>
                <button
                  onClick={handleDelete}
                  className="p-3 text-red-600 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation - only show for existing bookings */}
      {!isNew && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-gray-100 p-4">
          <nav className="flex space-x-3 overflow-x-auto">
            {[
              { id: 'info', label: 'Information', icon: MapPin },
              { id: 'rooms', label: 'Rooms', icon: Building2 },
              { id: 'tourists', label: 'Tourists', icon: Users },
              { id: 'rooming-list', label: 'Final List', icon: List },
              { id: 'rooming', label: 'Fly&Railway', icon: Plane },
              { id: 'route', label: 'Route', icon: Car },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'tour-services', label: 'Tour Services', icon: ClipboardList },
              { id: 'costs', label: 'Costs', icon: DollarSign }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white shadow-blue-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {!isNew && activeTab === 'tourists' && (
        <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <TouristsList bookingId={parseInt(id)} onUpdate={loadData} />
        </div>
      )}

      {!isNew && activeTab === 'rooming-list' && (
        <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-indigo-100 p-8">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <RoomingListModule bookingId={parseInt(id)} onUpdate={loadData} />
        </div>
      )}

      {!isNew && activeTab === 'rooming' && (
        <div className="space-y-6">
          {/* Sub-tabs for Fly & Railway */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-purple-100 p-4">
            <nav className="flex space-x-3">
              <button
                onClick={() => setFlyRailwayTab('fly')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  flyRailwayTab === 'fly'
                    ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 hover:from-sky-600 hover:via-blue-600 hover:to-indigo-600 text-white shadow-sky-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Plane className="w-5 h-5" />
                Fly
              </button>
              <button
                onClick={() => setFlyRailwayTab('railway')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  flyRailwayTab === 'railway'
                    ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 text-white shadow-emerald-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Train className="w-5 h-5" />
                Railway
              </button>
            </nav>
          </div>

          {/* Fly Tab Content */}
          {flyRailwayTab === 'fly' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-sky-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"></div>
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-sky-400/10 to-blue-400/10 rounded-full blur-3xl"></div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                    <Plane className="w-6 h-6 text-white" />
                  </div>
                  Flight Information
                </h2>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={openFlightModal}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
                  >
                    <Plus className="w-5 h-5" />
                    Add Flight
                  </button>
                </div>
              </div>

              {loadingFlights ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-200"></div>
                      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-sky-600 absolute top-0"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Loading flights...</p>
                  </div>
                </div>
              ) : (!Array.isArray(flights) || flights.length === 0) && (!Array.isArray(flightSections) || flightSections.length === 0) ? (
                <div className="text-center py-12 bg-gradient-to-b from-sky-50 to-white rounded-2xl border-2 border-dashed border-sky-200">
                  <div className="w-20 h-20 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Plane className="w-10 h-10 text-sky-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">No Flight Information</h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Flight information will be automatically extracted when you import a Final Rooming List PDF in the "Final List" tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* International Flights Section */}
                  {(() => {
                    const internationalFlights = Array.isArray(flights) ? flights.filter(f => f.type === 'INTERNATIONAL') : [];
                    const internationalSection = Array.isArray(flightSections) ? flightSections.find(s => s.type === 'INTERNATIONAL') : null;

                    if (internationalFlights.length === 0 && !internationalSection) return null;

                    return (
                      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-300/20 to-indigo-300/20 rounded-full blur-2xl"></div>

                        <h3 className="text-xl font-black text-blue-900 mb-4 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                            <Plane className="w-4 h-4 text-white" />
                          </div>
                          International Flights
                        </h3>

                        {internationalFlights.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                  <th className="px-4 py-3 text-left text-sm font-bold">Flight</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Route</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Departure</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Arrival</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">PAX</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Per Person (UZS)</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Total (UZS)</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {internationalFlights.map((flight, idx) => {
                                  const pax = flight.pax || 0;
                                  const totalPrice = flight.price || 0;
                                  const perPersonPrice = pax > 0 ? totalPrice / pax : 0;
                                  return (
                                    <tr key={flight.id || idx} className="border-b border-blue-200 hover:bg-blue-50 transition-colors">
                                      <td className="px-4 py-3 font-bold text-blue-900">{flight.flightNumber || '-'}</td>
                                      <td className="px-4 py-3 font-medium text-gray-700">{flight.departure || '-'} → {flight.arrival || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{flight.date ? format(new Date(flight.date), 'dd.MM.yyyy') : '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{flight.departureTime || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{flight.arrivalTime || '-'}</td>
                                      <td className="px-4 py-3 text-center text-gray-900 font-semibold">{pax > 0 ? pax : '-'}</td>
                                      <td className="px-4 py-3 text-right text-gray-900 font-semibold">{perPersonPrice > 0 ? Math.round(perPersonPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}</td>
                                      <td className="px-4 py-3 text-right text-blue-700 font-bold">{totalPrice > 0 ? Math.round(totalPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                          <button
                                            onClick={() => editFlight(flight)}
                                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                                            title="Edit"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => deleteFlight(flight.id)}
                                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Domestic Flights Section */}
                  {(() => {
                    const domesticFlights = Array.isArray(flights) ? flights.filter(f => f.type === 'DOMESTIC') : [];
                    const domesticSection = Array.isArray(flightSections) ? flightSections.find(s => s.type === 'DOMESTIC') : null;

                    if (domesticFlights.length === 0 && !domesticSection) return null;

                    return (
                      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-300/20 to-teal-300/20 rounded-full blur-2xl"></div>

                        <h3 className="text-xl font-black text-emerald-900 mb-4 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                            <Plane className="w-4 h-4 text-white" />
                          </div>
                          Domestic Flights
                        </h3>

                        {domesticFlights.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                                  <th className="px-4 py-3 text-left text-sm font-bold">Flight</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Route</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Departure</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Arrival</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">PAX</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Per Person (UZS)</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Total (UZS)</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {domesticFlights.map((flight, idx) => {
                                  const pax = flight.pax || 0;
                                  const totalPrice = flight.price || 0;
                                  const perPersonPrice = pax > 0 ? totalPrice / pax : 0;
                                  return (
                                    <tr key={flight.id || idx} className="border-b border-emerald-200 hover:bg-emerald-50 transition-colors">
                                      <td className="px-4 py-3 font-bold text-emerald-900">{flight.flightNumber || '-'}</td>
                                      <td className="px-4 py-3 font-medium text-gray-700">{flight.departure || '-'} → {flight.arrival || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{flight.date ? format(new Date(flight.date), 'dd.MM.yyyy') : '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{flight.departureTime || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{flight.arrivalTime || '-'}</td>
                                      <td className="px-4 py-3 text-center text-gray-900 font-semibold">{pax > 0 ? pax : '-'}</td>
                                      <td className="px-4 py-3 text-right text-gray-900 font-semibold">{perPersonPrice > 0 ? Math.round(perPersonPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}</td>
                                      <td className="px-4 py-3 text-right text-emerald-700 font-bold">{totalPrice > 0 ? Math.round(totalPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                          <button
                                            onClick={() => editFlight(flight)}
                                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition-colors"
                                            title="Edit"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => deleteFlight(flight.id)}
                                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Railway Tab Content */}
          {flyRailwayTab === 'railway' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-emerald-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500"></div>
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-green-400/10 rounded-full blur-3xl"></div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Train className="w-6 h-6 text-white" />
                  </div>
                  Railway Information
                </h2>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={openRailwayModal}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
                  >
                    <Plus className="w-5 h-5" />
                    Add Railway
                  </button>
                </div>
              </div>

              {loadingRailways ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200"></div>
                      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600 absolute top-0"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Loading railways...</p>
                  </div>
                </div>
              ) : (!Array.isArray(railways) || railways.length === 0) && (!Array.isArray(railwaySections) || railwaySections.length === 0) ? (
                <div className="text-center py-12 bg-gradient-to-b from-emerald-50 to-white rounded-2xl border-2 border-dashed border-emerald-200">
                  <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Train className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">No Railway Information</h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Add railway information manually or import from PDF.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* International Railways Section */}
                  {(() => {
                    const internationalRailways = Array.isArray(railways) ? railways.filter(r => r.type === 'INTERNATIONAL') : [];
                    const internationalSection = Array.isArray(railwaySections) ? railwaySections.find(s => s.type === 'INTERNATIONAL') : null;

                    if (internationalRailways.length === 0 && !internationalSection) return null;

                    return (
                      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-300/20 to-indigo-300/20 rounded-full blur-2xl"></div>

                        <h3 className="text-xl font-black text-blue-900 mb-4 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                            <Train className="w-4 h-4 text-white" />
                          </div>
                          International Railways
                        </h3>

                        {internationalRailways.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                  <th className="px-4 py-3 text-left text-sm font-bold">Train</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Route</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Departure</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Arrival</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">PAX</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Per Person (UZS)</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Total (UZS)</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {internationalRailways.map((railway, idx) => {
                                  const pax = railway.pax || 0;
                                  const totalPrice = railway.price || 0;
                                  const perPersonPrice = pax > 0 ? totalPrice / pax : 0;

                                  return (
                                    <tr key={railway.id || idx} className="border-b border-blue-200 hover:bg-blue-50 transition-colors">
                                      <td className="px-4 py-3 font-bold text-blue-900">{railway.trainNumber || railway.trainName || '-'}</td>
                                      <td className="px-4 py-3 font-medium text-gray-700">{railway.departure || '-'} → {railway.arrival || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{railway.date ? format(new Date(railway.date), 'dd.MM.yyyy') : '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{railway.departureTime || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{railway.arrivalTime || '-'}</td>
                                      <td className="px-4 py-3 text-center font-bold text-gray-900">{pax > 0 ? pax : '-'}</td>
                                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                                        {perPersonPrice > 0 ? Math.round(perPersonPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-blue-700">
                                        {totalPrice > 0 ? Math.round(totalPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                                      </td>
                                      <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => editRailway(railway)}
                                          className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                                          title="Edit"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => deleteRailway(railway.id)}
                                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Domestic Railways Section */}
                  {(() => {
                    const domesticRailways = Array.isArray(railways) ? railways.filter(r => r.type === 'DOMESTIC') : [];
                    const domesticSection = Array.isArray(railwaySections) ? railwaySections.find(s => s.type === 'DOMESTIC') : null;

                    if (domesticRailways.length === 0 && !domesticSection) return null;

                    return (
                      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-300/20 to-teal-300/20 rounded-full blur-2xl"></div>

                        <h3 className="text-xl font-black text-emerald-900 mb-4 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                            <Train className="w-4 h-4 text-white" />
                          </div>
                          Domestic Railways
                        </h3>

                        {domesticRailways.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                                  <th className="px-4 py-3 text-left text-sm font-bold">Train</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Route</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Departure</th>
                                  <th className="px-4 py-3 text-left text-sm font-bold">Arrival</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">PAX</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Per Person (UZS)</th>
                                  <th className="px-4 py-3 text-right text-sm font-bold">Total (UZS)</th>
                                  <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {domesticRailways.map((railway, idx) => {
                                  const pax = railway.pax || 0;
                                  const totalPrice = railway.price || 0;
                                  const perPersonPrice = pax > 0 ? totalPrice / pax : 0;

                                  return (
                                    <tr key={railway.id || idx} className="border-b border-emerald-200 hover:bg-emerald-50 transition-colors">
                                      <td className="px-4 py-3 font-bold text-emerald-900">{railway.trainNumber || railway.trainName || '-'}</td>
                                      <td className="px-4 py-3 font-medium text-gray-700">{railway.departure || '-'} → {railway.arrival || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{railway.date ? format(new Date(railway.date), 'dd.MM.yyyy') : '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{railway.departureTime || '-'}</td>
                                      <td className="px-4 py-3 text-gray-600">{railway.arrivalTime || '-'}</td>
                                      <td className="px-4 py-3 text-center font-bold text-gray-900">{pax > 0 ? pax : '-'}</td>
                                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                                        {perPersonPrice > 0 ? Math.round(perPersonPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                        {totalPrice > 0 ? Math.round(totalPrice).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                                      </td>
                                      <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => editRailway(railway)}
                                          className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition-colors"
                                          title="Edit"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => deleteRailway(railway.id)}
                                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Flight Add/Edit Modal */}
          {flightModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gradient-to-r from-sky-500 to-blue-500 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Plane className="w-6 h-6" />
                    {editingFlight ? 'Edit Flight' : 'Add New Flight'}
                  </h3>
                  <button
                    onClick={closeFlightModal}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Flight Type */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Flight Type *
                    </label>
                    <select
                      value={flightForm.type}
                      onChange={(e) => setFlightForm({ ...flightForm, type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="INTERNATIONAL">International (IST ↔ TAS)</option>
                      <option value="DOMESTIC">Domestic (O'zbekiston ichida)</option>
                    </select>
                  </div>

                  {/* Flight Number - Dropdown with auto-populate */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Flight Number *
                    </label>
                    <select
                      value={flightForm.flightNumber}
                      onChange={(e) => {
                        const selectedFlight = PREDEFINED_FLIGHTS[flightForm.type]?.find(f => f.flightNumber === e.target.value);
                        if (selectedFlight) {
                          // Auto-populate date based on flight type
                          let autoDate = '';
                          if (booking) {
                            if (flightForm.type === 'INTERNATIONAL') {
                              // International: arrival date (group arrives)
                              autoDate = booking.departureDate ? format(new Date(booking.departureDate), 'yyyy-MM-dd') : '';
                            } else if (flightForm.type === 'DOMESTIC') {
                              // Domestic: 1 day before group departure
                              if (booking.endDate) {
                                const endDate = new Date(booking.endDate);
                                const oneDayBefore = addDays(endDate, -1);
                                autoDate = format(oneDayBefore, 'yyyy-MM-dd');
                              }
                            }
                          }

                          setFlightForm({
                            ...flightForm,
                            flightNumber: selectedFlight.flightNumber,
                            airline: selectedFlight.airline,
                            route: selectedFlight.route,
                            departure: selectedFlight.departure,
                            arrival: selectedFlight.arrival,
                            departureTime: selectedFlight.departureTime,
                            arrivalTime: selectedFlight.arrivalTime,
                            date: autoDate,
                            pax: booking?.pax || 0
                          });
                        } else {
                          setFlightForm({ ...flightForm, flightNumber: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="">Select flight number...</option>
                      {PREDEFINED_FLIGHTS[flightForm.type]?.map(flight => (
                        <option key={flight.flightNumber} value={flight.flightNumber}>
                          {flight.flightNumber} - {flight.route}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Airline - Auto-populated, read-only */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Airline
                    </label>
                    <input
                      type="text"
                      value={flightForm.airline}
                      readOnly
                      placeholder="Auto-populated from flight selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  {/* Route - Auto-populated, read-only */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Route
                    </label>
                    <input
                      type="text"
                      value={flightForm.route}
                      readOnly
                      placeholder="Auto-populated from flight selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  {/* Tariff - Dropdown */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Tariff *
                    </label>
                    <select
                      value={flightForm.tariff}
                      onChange={(e) => setFlightForm({ ...flightForm, tariff: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="economy">Economy</option>
                      <option value="business">Business</option>
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={flightForm.date}
                      onChange={(e) => setFlightForm({ ...flightForm, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>

                  {/* Departure and Arrival Times - Auto-populated, read-only */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Departure Time
                      </label>
                      <input
                        type="text"
                        value={flightForm.departureTime}
                        readOnly
                        placeholder="Auto-populated"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Arrival Time
                      </label>
                      <input
                        type="text"
                        value={flightForm.arrivalTime}
                        readOnly
                        placeholder="Auto-populated"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                      />
                    </div>
                  </div>

                  {/* PAX and Price */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        PAX (Passengers) *
                      </label>
                      <input
                        type="number"
                        value={flightForm.pax}
                        onChange={(e) => setFlightForm({ ...flightForm, pax: parseInt(e.target.value) || 0 })}
                        min="0"
                        placeholder="Number of passengers"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Price (UZS)
                      </label>
                      <input
                        type="number"
                        value={flightForm.price || ''}
                        onChange={(e) => setFlightForm({ ...flightForm, price: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="1"
                        placeholder="Enter price"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={flightForm.notes}
                      onChange={(e) => setFlightForm({ ...flightForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={saveFlight}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-600 transition-all shadow-lg"
                    >
                      <Save className="w-5 h-5 inline mr-2" />
                      {editingFlight ? 'Update Flight' : 'Save Flight'}
                    </button>
                    <button
                      onClick={closeFlightModal}
                      className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Railway Add/Edit Modal */}
          {railwayModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Train className="w-6 h-6" />
                    {editingRailway ? 'Edit Railway' : 'Add New Railway'}
                  </h3>
                  <button
                    onClick={closeRailwayModal}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Train Number - Dropdown with auto-populate */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Train Number *
                    </label>
                    <select
                      value={railwayForm.trainNumber}
                      onChange={(e) => {
                        const selectedTrain = PREDEFINED_RAILWAYS.find(t => t.trainNumber === e.target.value);
                        if (selectedTrain) {
                          // Auto-populate date: arrival date + 2 days
                          let autoDate = '';
                          if (booking && booking.departureDate) {
                            const arrivalDate = new Date(booking.departureDate);
                            const trainDate = addDays(arrivalDate, 2);
                            autoDate = format(trainDate, 'yyyy-MM-dd');
                          }

                          // Default tariff to Economy
                          const defaultTariff = 'Economy';
                          const pricePerPerson = defaultTariff === 'Economy' ? selectedTrain.priceEconomy : selectedTrain.priceBusiness;
                          const paxCount = (booking?.pax || 0) + 1;
                          const totalPrice = pricePerPerson * paxCount;

                          setRailwayForm({
                            ...railwayForm,
                            trainNumber: selectedTrain.trainNumber,
                            trainName: selectedTrain.trainName,
                            route: selectedTrain.route,
                            departure: selectedTrain.departure,
                            arrival: selectedTrain.arrival,
                            departureTime: selectedTrain.departureTime,
                            arrivalTime: selectedTrain.arrivalTime,
                            date: autoDate,
                            tariff: defaultTariff,
                            pricePerPerson: pricePerPerson,
                            pax: paxCount,
                            price: totalPrice
                          });
                        } else {
                          setRailwayForm({ ...railwayForm, trainNumber: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select train number...</option>
                      {PREDEFINED_RAILWAYS.map(train => (
                        <option key={train.trainNumber} value={train.trainNumber}>
                          {train.trainNumber} - {train.trainName} - {train.route}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Train Name - Auto-populated, read-only */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Train Name
                    </label>
                    <input
                      type="text"
                      value={railwayForm.trainName}
                      readOnly
                      placeholder="Auto-populated from train selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  {/* Route - Auto-populated, read-only */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Route
                    </label>
                    <input
                      type="text"
                      value={railwayForm.route}
                      readOnly
                      placeholder="Auto-populated from train selection"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  {/* Tariff - Dropdown to select Economy or Business */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Tariff *
                    </label>
                    <select
                      value={railwayForm.tariff || 'Economy'}
                      onChange={(e) => {
                        const selectedTrain = PREDEFINED_RAILWAYS.find(t => t.trainNumber === railwayForm.trainNumber);
                        if (selectedTrain) {
                          const newTariff = e.target.value;
                          const pricePerPerson = newTariff === 'Economy' ? selectedTrain.priceEconomy : selectedTrain.priceBusiness;
                          const totalPrice = pricePerPerson * (railwayForm.pax || 0);
                          setRailwayForm({
                            ...railwayForm,
                            tariff: newTariff,
                            pricePerPerson: pricePerPerson,
                            price: totalPrice
                          });
                        } else {
                          setRailwayForm({ ...railwayForm, tariff: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="Economy">Economy</option>
                      <option value="Business">Business</option>
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={railwayForm.date}
                      onChange={(e) => setRailwayForm({ ...railwayForm, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  {/* Departure and Arrival Times - Auto-populated, read-only */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Departure Time
                      </label>
                      <input
                        type="text"
                        value={railwayForm.departureTime}
                        readOnly
                        placeholder="Auto-populated"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Arrival Time
                      </label>
                      <input
                        type="text"
                        value={railwayForm.arrivalTime}
                        readOnly
                        placeholder="Auto-populated"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                      />
                    </div>
                  </div>

                  {/* PAX - Auto-calculated as booking.pax + 1 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      PAX (Passengers) *
                    </label>
                    <input
                      type="number"
                      value={railwayForm.pax}
                      onChange={(e) => {
                        const newPax = parseInt(e.target.value) || 0;
                        const totalPrice = (railwayForm.pricePerPerson || 0) * newPax;
                        setRailwayForm({
                          ...railwayForm,
                          pax: newPax,
                          price: totalPrice
                        });
                      }}
                      min="0"
                      placeholder="Number of passengers"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  {/* Price Per Person - Auto-populated, read-only */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Price Per Person (UZS)
                    </label>
                    <input
                      type="text"
                      value={railwayForm.pricePerPerson ? Math.round(railwayForm.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : ''}
                      readOnly
                      placeholder="Auto-calculated from tariff"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  {/* Total Price - Auto-calculated */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Total Price (UZS)
                    </label>
                    <input
                      type="text"
                      value={railwayForm.price ? Math.round(railwayForm.price).toLocaleString('en-US').replace(/,/g, ' ') : ''}
                      readOnly
                      placeholder="Auto-calculated (per person × PAX)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-bold"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={railwayForm.notes}
                      onChange={(e) => setRailwayForm({ ...railwayForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={saveRailway}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all shadow-lg"
                    >
                      <Save className="w-5 h-5 inline mr-2" />
                      {editingRailway ? 'Update Railway' : 'Save Railway'}
                    </button>
                    <button
                      onClick={closeRailwayModal}
                      className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isNew && activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Sub-tabs for Documents */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-amber-100 p-4">
            <nav className="flex space-x-3">
              <button
                onClick={() => setDocumentsTab('hotel-requests')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'hotel-requests'
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 text-white shadow-amber-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Building2 className="w-5 h-5" />
                Hotel Requests
              </button>
              <button
                onClick={() => setDocumentsTab('tourist-list')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'tourist-list'
                    ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white shadow-blue-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Users className="w-5 h-5" />
                Tourist List
              </button>
              <button
                onClick={() => setDocumentsTab('marshrutiy')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'marshrutiy'
                    ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white shadow-green-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <MapPin className="w-5 h-5" />
                Marshrut varaqasi
              </button>
              <button
                onClick={() => setDocumentsTab('hotelliste')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'hotelliste'
                    ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:from-pink-600 hover:via-rose-600 hover:to-red-600 text-white shadow-pink-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Building2 className="w-5 h-5" />
                Hotelliste
              </button>
            </nav>
          </div>

          {/* Hotel Requests Tab Content */}
          {documentsTab === 'hotel-requests' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-amber-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500"></div>
              <HotelRequestPreview bookingId={parseInt(id)} booking={booking} />
            </div>
          )}

          {/* Tourist List Tab Content */}
          {documentsTab === 'tourist-list' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"></div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  Tourist List
                </h2>

                <button
                  onClick={exportTouristListPDF}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
                >
                  <FileDown className="w-5 h-5" />
                  Export PDF
                </button>
              </div>

              {/* Statistics Cards */}
              {tourists.length > 0 && (() => {
                // Calculate room counts from tourists
                const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };

                tourists.forEach(t => {
                  const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
                  const roomType = (assignedRoomType || t.roomPreference || '').toUpperCase();
                  const roomNum = t.roomNumber;

                  if (roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'DZ') {
                    if (roomNum && !seenRooms.DBL.has(roomNum)) {
                      roomCounts.DBL++;
                      seenRooms.DBL.add(roomNum);
                    }
                  } else if (roomType === 'TWN' || roomType === 'TWIN') {
                    if (roomNum && !seenRooms.TWN.has(roomNum)) {
                      roomCounts.TWN++;
                      seenRooms.TWN.add(roomNum);
                    }
                  } else if (roomType === 'SNGL' || roomType === 'SINGLE' || roomType === 'EZ') {
                    if (roomNum && !seenRooms.SNGL.has(roomNum)) {
                      roomCounts.SNGL++;
                      seenRooms.SNGL.add(roomNum);
                    }
                  }
                });

                const uzbekistanCount = tourists.filter(t => {
                  const placement = (t.accommodation || 'Uzbekistan').toLowerCase();
                  return placement.includes('uzbek') || placement === 'uz' || placement === 'uzbekistan';
                }).length;

                const turkmenistanCount = tourists.filter(t => {
                  const placement = (t.accommodation || '').toLowerCase();
                  return placement.includes('turkmen') || placement === 'tm';
                }).length;

                return (
                  <div className="flex items-stretch gap-4 flex-wrap mb-8">
                    {/* Total Guests Card */}
                    <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                        <Users className="w-8 h-8 text-primary-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1">Total</div>
                        <div className="text-4xl font-black text-gray-900 mb-0.5">{tourists.length}</div>
                        <div className="text-sm text-gray-600 font-medium">guests</div>
                      </div>
                    </div>

                    {/* DBL Rooms Card */}
                    <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                        <Bed className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                          DBL
                        </div>
                        <div className="text-4xl font-black text-gray-900 mb-0.5">{roomCounts.DBL}</div>
                        <div className="text-sm text-gray-600 font-medium">rooms</div>
                      </div>
                    </div>

                    {/* TWN Rooms Card */}
                    <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                        <Bed className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                          TWN
                        </div>
                        <div className="text-4xl font-black text-gray-900 mb-0.5">{roomCounts.TWN}</div>
                        <div className="text-sm text-gray-600 font-medium">rooms</div>
                      </div>
                    </div>

                    {/* SNGL Rooms Card */}
                    <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                        <User className="w-8 h-8 text-violet-600" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                          SNGL
                        </div>
                        <div className="text-4xl font-black text-gray-900 mb-0.5">{roomCounts.SNGL}</div>
                        <div className="text-sm text-gray-600 font-medium">rooms</div>
                      </div>
                    </div>

                    {/* Uzbekistan/Turkmenistan Split Card */}
                    <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl shadow-md">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-sm" />
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Uzbekistan</span>
                          <span className="text-2xl font-black text-gray-900">{uzbekistanCount}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm" />
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Turkmenistan</span>
                          <span className="text-2xl font-black text-gray-900">{turkmenistanCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tourist List Table */}
              {tourists.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">No</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-blue-400">Name</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">Tour Start</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">Tour End</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-blue-400">Remarks</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">Rm</th>
                        <th className="px-4 py-3 text-left text-sm font-bold">Placement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Group tourists by room number for DBL and TWN
                        const roomGroups = {};
                        const singleTourists = [];

                        tourists.forEach(tourist => {
                          // Get room type from roomAssignments or fallback to roomPreference
                          const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
                          const roomType = assignedRoomType || tourist.roomPreference;

                          if (tourist.roomNumber && (roomType === 'DZ' || roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'TWN' || roomType === 'TWIN')) {
                            if (!roomGroups[tourist.roomNumber]) {
                              roomGroups[tourist.roomNumber] = [];
                            }
                            roomGroups[tourist.roomNumber].push(tourist);
                          } else {
                            singleTourists.push(tourist);
                          }
                        });

                        // Sort room groups by accommodation (Uzbekistan first) then room number
                        const sortedRoomNumbers = Object.keys(roomGroups).sort((a, b) => {
                          const groupA = roomGroups[a];
                          const groupB = roomGroups[b];

                          // Get accommodation of first tourist in each group
                          const accA = (groupA[0]?.accommodation || 'Uzbekistan').toLowerCase();
                          const accB = (groupB[0]?.accommodation || 'Uzbekistan').toLowerCase();

                          // Sort by accommodation first (Uzbekistan before Turkmenistan)
                          if (accA.includes('uzbek') && !accB.includes('uzbek')) return -1;
                          if (!accA.includes('uzbek') && accB.includes('uzbek')) return 1;

                          // Then sort by room type and number
                          const aMatch = a.match(/(DBL|TWN)-(\d+)/);
                          const bMatch = b.match(/(DBL|TWN)-(\d+)/);
                          if (aMatch && bMatch) {
                            if (aMatch[1] !== bMatch[1]) {
                              return aMatch[1] === 'DBL' ? -1 : 1; // DBL first
                            }
                            return parseInt(aMatch[2]) - parseInt(bMatch[2]);
                          }
                          return 0;
                        });

                        // Sort single tourists by accommodation
                        singleTourists.sort((a, b) => {
                          const accA = (a.accommodation || 'Uzbekistan').toLowerCase();
                          const accB = (b.accommodation || 'Uzbekistan').toLowerCase();
                          if (accA.includes('uzbek') && !accB.includes('uzbek')) return -1;
                          if (!accA.includes('uzbek') && accB.includes('uzbek')) return 1;
                          return 0;
                        });

                        // Create combined array of room groups and single tourists
                        const allEntries = [];

                        // Add room groups
                        sortedRoomNumbers.forEach(roomNumber => {
                          const group = roomGroups[roomNumber];
                          allEntries.push({
                            type: 'group',
                            accommodation: (group[0]?.accommodation || 'Uzbekistan').toLowerCase(),
                            roomNumber,
                            tourists: group
                          });
                        });

                        // Add single tourists
                        singleTourists.forEach(tourist => {
                          allEntries.push({
                            type: 'single',
                            accommodation: (tourist.accommodation || 'Uzbekistan').toLowerCase(),
                            tourist
                          });
                        });

                        // Sort all entries by accommodation (Uzbekistan first)
                        allEntries.sort((a, b) => {
                          const accA = a.accommodation;
                          const accB = b.accommodation;
                          if (accA.includes('uzbek') && !accB.includes('uzbek')) return -1;
                          if (!accA.includes('uzbek') && accB.includes('uzbek')) return 1;
                          return 0;
                        });

                        let counter = 0;
                        const rows = [];

                        // Render entries in sorted order
                        allEntries.forEach(entry => {
                          if (entry.type === 'group') {
                            // Render paired tourists (DBL and TWN)
                            const group = entry.tourists;
                            group.forEach((tourist, groupIndex) => {
                              counter++;
                              const isFirstInGroup = groupIndex === 0;

                              // Get room type from roomAssignments or fallback to roomPreference
                              const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
                              let roomType = assignedRoomType || tourist.roomPreference || '';

                              // Normalize room type
                              if (roomType === 'DZ' || roomType === 'DOUBLE') roomType = 'DBL';
                              else if (roomType === 'TWIN') roomType = 'TWN';
                              else if (roomType === 'EZ' || roomType === 'SINGLE') roomType = 'SNGL';

                              // Filter remarks
                              let remarks = '-';
                              if (tourist.remarks) {
                                let filtered = tourist.remarks
                                  .replace(/\*\s*PAX\s+booked\s+half\s+double\s+room.*?single\s+room/gi, '')
                                  .replace(/\d+ Nights?\s*\|?\s*/gi, '')
                                  .replace(/TWIN\s*\/\/\s*/gi, '')
                                  .replace(/DBL\s*\/\/\s*/gi, '')
                                  .replace(/SNGL\s*\/\/\s*/gi, '')
                                  .replace(/^\s*\|?\s*/g, '')
                                  .replace(/\s*\|?\s*$/g, '')
                                  .trim();
                                if (filtered && filtered !== '|' && filtered !== '//') {
                                  remarks = filtered;
                                }
                              }

                              rows.push(
                                <tr key={tourist.id} className="border-b border-blue-100 hover:bg-blue-50 transition-colors">
                                  <td className="px-4 py-3 text-center font-medium text-gray-700 border-r border-blue-100">{counter}</td>
                                  <td className="px-4 py-3 text-left font-medium text-gray-800 border-r border-blue-100">
                                    {tourist.gender === 'M' ? 'Mr.' : tourist.gender === 'F' ? 'Mrs.' : ''} {tourist.lastName}, {tourist.firstName}
                                  </td>
                                  <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-100 text-sm">
                                    {tourist.checkInDate ? format(new Date(tourist.checkInDate), 'dd.MM.yyyy') : booking?.departureDate ? format(new Date(booking.departureDate), 'dd.MM.yyyy') : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-100 text-sm">
                                    {tourist.checkOutDate ? format(new Date(tourist.checkOutDate), 'dd.MM.yyyy') : booking?.endDate ? format(new Date(booking.endDate), 'dd.MM.yyyy') : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-left text-gray-700 border-r border-blue-100 text-sm">
                                    {remarks}
                                  </td>
                                  {isFirstInGroup ? (
                                    <td
                                      rowSpan={group.length}
                                      className="px-4 py-3 text-center font-bold border-r border-blue-100 align-middle"
                                    >
                                      <span className={`px-3 py-2 rounded text-lg ${
                                        roomType === 'DBL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                      }`}>
                                        {roomType}
                                      </span>
                                    </td>
                                  ) : null}
                                  <td className="px-4 py-3 text-left text-gray-700">
                                    {tourist.accommodation || 'Uzbekistan'}
                                  </td>
                                </tr>
                              );
                            });
                          } else if (entry.type === 'single') {
                            // Render single tourist (SNGL)
                            const tourist = entry.tourist;
                            counter++;

                            // Get room type from roomAssignments or fallback to roomPreference
                            const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
                            let roomType = assignedRoomType || tourist.roomPreference || 'SNGL';

                            // Normalize room type
                            if (roomType === 'DZ' || roomType === 'DOUBLE') roomType = 'DBL';
                            else if (roomType === 'TWIN') roomType = 'TWN';
                            else if (roomType === 'EZ' || roomType === 'SINGLE') roomType = 'SNGL';

                            // Filter remarks
                            let remarks = '-';
                            if (tourist.remarks) {
                              let filtered = tourist.remarks
                                .replace(/\*PAX booked half double room, no roommate found -> single room/gi, '')
                                .replace(/\d+ Nights?\s*\|?\s*/gi, '')
                                .replace(/^\s*\|?\s*/g, '')
                                .replace(/\s*\|?\s*$/g, '')
                                .trim();
                              if (filtered && filtered !== '|' && filtered !== '//') {
                                remarks = filtered;
                              }
                            }

                            rows.push(
                              <tr key={tourist.id} className="border-b border-blue-100 hover:bg-blue-50 transition-colors">
                                <td className="px-4 py-3 text-center font-medium text-gray-700 border-r border-blue-100">{counter}</td>
                                <td className="px-4 py-3 text-left font-medium text-gray-800 border-r border-blue-100">
                                  {tourist.gender === 'M' ? 'Mr.' : tourist.gender === 'F' ? 'Mrs.' : ''} {tourist.lastName}, {tourist.firstName}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-100 text-sm">
                                  {tourist.checkInDate ? format(new Date(tourist.checkInDate), 'dd.MM.yyyy') : booking?.departureDate ? format(new Date(booking.departureDate), 'dd.MM.yyyy') : '-'}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-100 text-sm">
                                  {tourist.checkOutDate ? format(new Date(tourist.checkOutDate), 'dd.MM.yyyy') : booking?.endDate ? format(new Date(booking.endDate), 'dd.MM.yyyy') : '-'}
                                </td>
                                <td className="px-4 py-3 text-left text-gray-700 border-r border-blue-100 text-sm">
                                  {remarks}
                                </td>
                                <td className="px-4 py-3 text-center font-bold border-r border-blue-100">
                                  <span className={`px-3 py-2 rounded text-lg ${
                                    roomType === 'DBL' ? 'bg-blue-100 text-blue-700' :
                                    roomType === 'TWN' ? 'bg-green-100 text-green-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {roomType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-left text-gray-700">
                                  {tourist.accommodation || 'Uzbekistan'}
                                </td>
                              </tr>
                            );
                          }
                        });

                        return rows;
                      })()}
                    </tbody>
                  </table>

                  {/* Summary Footer */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">Total Tourists:</span>
                      <span className="text-lg font-black text-blue-600">{tourists.length}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gradient-to-b from-blue-50 to-white rounded-2xl border-2 border-dashed border-blue-200">
                  <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">No Tourists Found</h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Import tourists from the Final List tab to see them here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Marshrut varaqasi (Itinerary) Tab Content */}
          {documentsTab === 'marshrutiy' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
              <ItineraryPreview bookingId={parseInt(id)} booking={booking} />
            </div>
          )}

          {/* Hotelliste Tab Content */}
          {documentsTab === 'hotelliste' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-pink-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500"></div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-pink-600" />
                  Hotelliste
                </h2>
              </div>

              {accommodations && accommodations.length > 0 ? (
                <div className="space-y-4">
                  {accommodations.map((acc, idx) => (
                    <div key={acc.id} className="p-6 bg-gradient-to-r from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{acc.hotel?.name || 'Unknown Hotel'}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            {acc.hotel?.city?.name || 'Unknown City'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Check-in</div>
                          <div className="font-bold text-gray-900">
                            {acc.checkInDate ? format(new Date(acc.checkInDate), 'dd.MM.yyyy') : '-'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Check-out</div>
                          <div className="font-bold text-gray-900">
                            {acc.checkOutDate ? format(new Date(acc.checkOutDate), 'dd.MM.yyyy') : '-'}
                          </div>
                        </div>
                      </div>
                      {acc.hotel?.phone && (
                        <div className="text-sm text-gray-700 mt-2">
                          📞 {acc.hotel.phone}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No hotels added yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tour Services Module */}
      {!isNew && activeTab === 'tour-services' && (
        <div className="space-y-6">
          {/* Sub-tabs for Tour Services */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-purple-100 p-4">
            <nav className="flex space-x-3 overflow-x-auto">
              <button
                onClick={() => setTourServicesTab('hotels')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'hotels'
                    ? 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600 text-white shadow-purple-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Building2 className="w-5 h-5" />
                Hotels
              </button>
              <button
                onClick={() => setTourServicesTab('transport')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'transport'
                    ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500 hover:from-blue-600 hover:via-cyan-600 hover:to-sky-600 text-white shadow-blue-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Car className="w-5 h-5" />
                Transport
              </button>
              <button
                onClick={() => setTourServicesTab('railway')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'railway'
                    ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white shadow-orange-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Train className="w-5 h-5" />
                Railway
              </button>
              <button
                onClick={() => setTourServicesTab('flights')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'flights'
                    ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white shadow-green-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Plane className="w-5 h-5" />
                Flights
              </button>
              <button
                onClick={() => setTourServicesTab('guide')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'guide'
                    ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 hover:from-rose-600 hover:via-pink-600 hover:to-fuchsia-600 text-white shadow-rose-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <User className="w-5 h-5" />
                Guide
              </button>
              <button
                onClick={() => setTourServicesTab('meals')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'meals'
                    ? 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 hover:from-red-600 hover:via-orange-600 hover:to-amber-600 text-white shadow-red-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <span className="text-lg">🍽️</span>
                Meals
              </button>
            </nav>
          </div>

          {/* Hotels Tab */}
          {tourServicesTab === 'hotels' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-purple-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500"></div>

              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Building2 className="w-7 h-7 text-purple-600" />
                Hotels Summary
              </h3>

              {grandTotalData ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-purple-400">No.</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-purple-400">City</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-purple-400">Hotel</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-purple-400">Dates</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-purple-400">Nights</th>
                        <th className="px-4 py-3 text-right text-sm font-bold border-r border-purple-400">USD</th>
                        <th className="px-4 py-3 text-right text-sm font-bold">UZS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accommodations.map((acc, index) => {
                        // Calculate nights
                        let nights = acc.nights || 0;
                        if (!nights && acc.checkInDate && acc.checkOutDate) {
                          const checkIn = new Date(acc.checkInDate);
                          const checkOut = new Date(acc.checkOutDate);
                          nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                        }

                        // Find hotel in grandTotalData by accommodation ID (not hotel name!)
                        const hotelData = grandTotalData.hotelBreakdown?.find(h => h.accommodationId === acc.id);

                        const totalUSD = hotelData?.USD || 0;
                        const totalUZS = hotelData?.UZS || 0;

                        return (
                          <tr key={acc.id} className="border-b border-gray-200 hover:bg-purple-50 transition-colors">
                            <td className="px-4 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3 text-gray-800 border-r border-gray-200">
                              {acc.hotel?.city?.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-800 font-medium border-r border-gray-200">
                              {acc.hotel?.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200 whitespace-nowrap">
                              {acc.checkInDate && acc.checkOutDate ? (
                                <span>
                                  {format(new Date(acc.checkInDate), 'dd.MM')}
                                  <span className="text-gray-500 mx-1">-</span>
                                  {format(new Date(acc.checkOutDate), 'dd.MM')}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">
                              {nights > 0 ? nights : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold border-r border-gray-200">
                              {totalUSD > 0 ? (
                                <span className="text-green-700">{Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              {totalUZS > 0 ? (
                                <span className="text-blue-700">{Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-purple-100 to-indigo-100 border-t-2 border-purple-300">
                        <td colSpan="4" className="px-4 py-4 text-right font-bold text-gray-900 text-lg border-r border-purple-200">
                          Total:
                        </td>
                        <td className="px-4 py-4 text-center font-black text-xl text-gray-900 border-r border-purple-200">
                          {accommodations.reduce((sum, acc) => {
                            let nights = acc.nights || 0;
                            if (!nights && acc.checkInDate && acc.checkOutDate) {
                              const checkIn = new Date(acc.checkInDate);
                              const checkOut = new Date(acc.checkOutDate);
                              nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                            }
                            return sum + nights;
                          }, 0)}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-xl text-green-700 border-r border-purple-200">
                          {grandTotalData.grandTotalUSD > 0
                            ? `$${Math.round(grandTotalData.grandTotalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`
                            : '-'}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-xl text-blue-700">
                          {grandTotalData.grandTotalUZS > 0
                            ? Math.round(grandTotalData.grandTotalUZS).toLocaleString('en-US').replace(/,/g, ' ')
                            : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Hali hotel qo'shilmagan</p>
                </div>
              )}
            </div>
          )}

          {/* Transport Tab */}
          {tourServicesTab === 'transport' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500"></div>

              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Car className="w-7 h-7 text-blue-600" />
                Transport Summary
              </h3>

              {routes && routes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">No.</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-blue-400">Route</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-blue-400">PAX</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-blue-400">Vehicle</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-blue-400">Provider</th>
                        <th className="px-4 py-3 text-right text-sm font-bold">Price (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map((route, index) => (
                        <tr key={route.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200 whitespace-nowrap">
                            {route.date ? format(new Date(route.date), 'dd.MM.yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium border-r border-gray-200">
                            {route.routeName || '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">
                            {route.personCount > 0 ? route.personCount : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 border-r border-gray-200">
                            {route.transportType || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 border-r border-gray-200 capitalize">
                            {route.provider || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {route.price > 0 ? (
                              <span className="text-blue-700">{Math.round(route.price).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {/* Sevil Total */}
                      <tr className="bg-gradient-to-r from-purple-50 to-pink-50 border-t border-gray-300">
                        <td colSpan="6" className="px-4 py-3 text-right font-bold text-gray-700 border-r border-gray-300">
                          Sevil Total:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-purple-700">
                          {(() => {
                            const sevilTotal = routes
                              .filter(r => r.provider?.toLowerCase() === 'sevil')
                              .reduce((sum, r) => sum + (r.price || 0), 0);
                            return sevilTotal > 0
                              ? Math.round(sevilTotal).toLocaleString('en-US').replace(/,/g, ' ')
                              : '-';
                          })()}
                        </td>
                      </tr>
                      {/* Xayrulla Total */}
                      <tr className="bg-gradient-to-r from-green-50 to-emerald-50">
                        <td colSpan="6" className="px-4 py-3 text-right font-bold text-gray-700 border-r border-gray-300">
                          Xayrulla Total:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-green-700">
                          {(() => {
                            const xayrullaTotal = routes
                              .filter(r => r.provider?.toLowerCase() === 'xayrulla')
                              .reduce((sum, r) => sum + (r.price || 0), 0);
                            return xayrullaTotal > 0
                              ? Math.round(xayrullaTotal).toLocaleString('en-US').replace(/,/g, ' ')
                              : '-';
                          })()}
                        </td>
                      </tr>
                      {/* Grand Total */}
                      <tr className="bg-gradient-to-r from-blue-100 to-cyan-100 border-t-2 border-blue-300">
                        <td colSpan="6" className="px-4 py-4 text-right font-bold text-gray-900 text-lg border-r border-blue-200">
                          Grand Total:
                        </td>
                        <td className="px-4 py-4 text-right font-black text-xl text-blue-700">
                          {routes.reduce((sum, r) => sum + (r.price || 0), 0) > 0
                            ? Math.round(routes.reduce((sum, r) => sum + (r.price || 0), 0)).toLocaleString('en-US').replace(/,/g, ' ')
                            : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Car className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No transport routes added yet</p>
                </div>
              )}
            </div>
          )}

          {/* Railway Tab */}
          {tourServicesTab === 'railway' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-orange-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"></div>

              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Train className="w-7 h-7 text-orange-600" />
                Railway Summary
              </h3>

              {railways && railways.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-orange-600 to-amber-600 text-white">
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-orange-400">No.</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-orange-400">Train No.</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-orange-400">Train Name</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-orange-400">Route</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-orange-400">Date</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-orange-400">Departure</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-orange-400">Arrival</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-orange-400">PAX</th>
                        <th className="px-4 py-3 text-right text-sm font-bold">Price (UZS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {railways.map((railway, index) => (
                        <tr key={railway.id} className="border-b border-gray-200 hover:bg-orange-50 transition-colors">
                          <td className="px-4 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">
                            {railway.trainNumber || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium border-r border-gray-200">
                            {railway.trainName || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 border-r border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{railway.departure}</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium">{railway.arrival}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200 whitespace-nowrap">
                            {railway.date ? format(new Date(railway.date), 'dd.MM.yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200">
                            {railway.departureTime || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200">
                            {railway.arrivalTime || '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">
                            {railway.pax > 0 ? railway.pax : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {railway.price > 0 ? (
                              <span className="text-orange-700">{Math.round(railway.price).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-orange-100 to-amber-100 border-t-2 border-orange-300">
                        <td colSpan="8" className="px-4 py-4 text-right font-bold text-gray-900 text-lg border-r border-orange-200">
                          Total:
                        </td>
                        <td className="px-4 py-4 text-right font-black text-xl text-orange-700">
                          {railways.reduce((sum, r) => sum + (r.price || 0), 0) > 0
                            ? Math.round(railways.reduce((sum, r) => sum + (r.price || 0), 0)).toLocaleString('en-US').replace(/,/g, ' ')
                            : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Train className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No railway tickets added yet</p>
                </div>
              )}
            </div>
          )}

          {/* Flights Tab */}
          {tourServicesTab === 'flights' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>

              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Plane className="w-7 h-7 text-green-600" />
                Flight Summary
              </h3>

              {flights && flights.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">No.</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">Type</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">Flight No.</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-green-400">Airline</th>
                        <th className="px-4 py-3 text-left text-sm font-bold border-r border-green-400">Route</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">Date</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">Departure</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">Arrival</th>
                        <th className="px-4 py-3 text-center text-sm font-bold border-r border-green-400">PAX</th>
                        <th className="px-4 py-3 text-right text-sm font-bold">Price (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flights.map((flight, index) => (
                        <tr key={flight.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors">
                          <td className="px-4 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-center text-sm border-r border-gray-200">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              flight.type === 'INTERNATIONAL'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {flight.type === 'INTERNATIONAL' ? 'International' : 'Domestic'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">
                            {flight.flightNumber || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium border-r border-gray-200">
                            {flight.airline || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 border-r border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{flight.departure}</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium">{flight.arrival}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200 whitespace-nowrap">
                            {flight.date ? format(new Date(flight.date), 'dd.MM.yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200">
                            {flight.departureTime || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 border-r border-gray-200">
                            {flight.arrivalTime || '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">
                            {flight.pax > 0 ? flight.pax : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {flight.price > 0 ? (
                              <span className="text-green-700">{Math.round(flight.price).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-green-100 to-teal-100 border-t-2 border-green-300">
                        <td colSpan="9" className="px-4 py-4 text-right font-bold text-gray-900 text-lg border-r border-green-200">
                          Total:
                        </td>
                        <td className="px-4 py-4 text-right font-black text-xl text-green-700">
                          {flights.reduce((sum, f) => sum + (f.price || 0), 0) > 0
                            ? Math.round(flights.reduce((sum, f) => sum + (f.price || 0), 0)).toLocaleString('en-US').replace(/,/g, ' ')
                            : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Plane className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No flights added yet</p>
                </div>
              )}
            </div>
          )}

          {/* Guide Tab */}
          {tourServicesTab === 'guide' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-rose-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Guide Services</h3>
              <p className="text-gray-600">Guide costs and details will be displayed here</p>
            </div>
          )}

          {/* Meals Tab */}
          {tourServicesTab === 'meals' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-red-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Meal Services</h3>
              <p className="text-gray-600">Meal costs and details will be displayed here</p>
            </div>
          )}
        </div>
      )}

      {!isNew && activeTab === 'costs' && (
        <div className="space-y-6">
          {/* Sub-tabs for Costs (Payment Methods) */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-green-100 p-4">
            <nav className="flex space-x-3 overflow-x-auto">
              <button
                onClick={() => setCostsTab('rl')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  costsTab === 'rl'
                    ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white shadow-green-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <User className="w-5 h-5" />
                RL
              </button>
              <button
                onClick={() => setCostsTab('spater')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  costsTab === 'spater'
                    ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500 hover:from-blue-600 hover:via-cyan-600 hover:to-sky-600 text-white shadow-blue-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Später
              </button>
              <button
                onClick={() => setCostsTab('uberweisung')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  costsTab === 'uberweisung'
                    ? 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600 text-white shadow-purple-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <DollarSign className="w-5 h-5" />
                Überweisung
              </button>
              <button
                onClick={() => setCostsTab('karta')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  costsTab === 'karta'
                    ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white shadow-orange-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <span className="text-lg">💳</span>
                Karta
              </button>
              <button
                onClick={() => setCostsTab('total')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  costsTab === 'total'
                    ? 'bg-gradient-to-r from-slate-700 via-gray-700 to-zinc-700 hover:from-slate-800 hover:via-gray-800 hover:to-zinc-800 text-white shadow-slate-700/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <DollarSign className="w-5 h-5" />
                Total
              </button>
            </nav>
          </div>

          {/* RL Tab */}
          {costsTab === 'rl' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">RL (Reiseleiter) Payments</h3>
              <p className="text-gray-600">Tour leader payment details will be displayed here</p>
            </div>
          )}

          {/* Spater Tab */}
          {costsTab === 'spater' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Später (Deferred Payments)</h3>
              <p className="text-gray-600">Deferred payment details will be displayed here</p>
            </div>
          )}

          {/* Uberweisung Tab */}
          {costsTab === 'uberweisung' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-purple-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Überweisung (Bank Transfer)</h3>
              <p className="text-gray-600">Bank transfer payment details will be displayed here</p>
            </div>
          )}

          {/* Karta Tab */}
          {costsTab === 'karta' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-orange-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Karta (Card Payments)</h3>
              <p className="text-gray-600">Card payment details will be displayed here</p>
            </div>
          )}

          {/* Total Tab */}
          {costsTab === 'total' && (
            <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-slate-100 p-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-slate-700 via-gray-700 to-zinc-700"></div>
              <CostSummary bookingId={parseInt(id)} booking={booking} />
            </div>
          )}
        </div>
      )}

      {/* Route Tab */}
      {!isNew && activeTab === 'route' && (
        <div className="space-y-6">
          {/* Compact Header */}
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-cyan-100 p-6">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Group Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1.5 rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: booking?.tourType?.color || '#3B82F6' }}
                  >
                    {booking?.bookingNumber || '-'}
                  </span>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-gray-500">Departure:</span>
                  <span className="font-semibold text-gray-800">
                    {formData.departureDate ? format(new Date(formData.departureDate), 'dd.MM.yyyy') : '-'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-sm">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Arrival</span>
                  <span className="font-semibold text-green-700">
                    {formData.departureDate ? format(addDays(new Date(formData.departureDate), 1), 'dd.MM.yyyy') : '-'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-sm">
                  <span className="text-gray-500">End:</span>
                  <span className="font-semibold text-gray-800">
                    {formData.endDate ? format(new Date(formData.endDate), 'dd.MM.yyyy') : '-'}
                  </span>
                </div>

                <div className="h-6 w-px bg-gray-200"></div>

                {/* PAX Info */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg">
                    <span className="text-xs text-blue-600">PAX</span>
                    <span className="text-sm font-bold text-blue-700">{tourists.length || formData.pax || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-emerald-600">UZB</span>
                    <span className="text-sm font-bold text-emerald-700">{tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length || formData.paxUzbekistan || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="text-xs text-purple-600">TKM</span>
                    <span className="text-sm font-bold text-purple-700">{tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length || formData.paxTurkmenistan || 0}</span>
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-200"></div>

                {/* Manual Fix Button - for when auto-fix doesn't trigger */}
                <button
                  onClick={autoFixAllRoutes}
                  disabled={saving || erRoutes.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Fix all vehicles and prices"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fix Vehicles
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveAllRoutes}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white text-sm rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleAddRoute}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  Add Route
                </button>
                <div className="border-l-2 border-gray-300 h-8"></div>
                <button
                  onClick={handleSaveAsTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-xs rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl hover:scale-105"
                  title="Save current routes as default template for ER tours"
                >
                  <Database className="w-4 h-4" />
                  Save as Template
                </button>
                <button
                  onClick={handleLoadFromTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  title="Load routes from database template"
                >
                  <Download className="w-4 h-4" />
                  Load Template
                </button>
              </div>
            </div>
          </div>

          {/* Route Table Card */}
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 via-gray-800 to-slate-800 text-white">
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide w-12">#</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide w-36">Date</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide">City</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Route</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide w-16">PAX</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide">Provider</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide">Vehicle</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide">Rate Type</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide w-20">Price</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {erRoutes.map((route, index) => (
                    <tr
                      key={route.id}
                      className={`group border-b border-gray-100 transition-all duration-200 hover:bg-blue-50/50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          <div className="w-7 h-7 bg-slate-700 text-white rounded-md flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          {index === 0 && (
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Arrival</span>
                          )}
                          <input
                            type="date"
                            value={route.sana || ''}
                            onChange={(e) => handleRouteDateChange(index, e.target.value)}
                            className="w-full px-2 py-1.5 bg-amber-50 text-amber-800 rounded-md text-xs font-medium border border-amber-200 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 cursor-pointer"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={route.shahar || ''}
                          onChange={(e) => handleCityChange(route.id, e.target.value)}
                          className="w-full px-2 py-1.5 bg-emerald-50 text-emerald-800 rounded-md text-xs font-medium border border-emerald-200 focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                        >
                          <option value="">Select</option>
                          <optgroup label="Tashkent (Xayrulla)">
                            <option value="Tashkent">Tashkent</option>
                          </optgroup>
                          <optgroup label="Fergana (Nosir)">
                            <option value="Fergana">Fergana</option>
                          </optgroup>
                          <optgroup label="Other (Sevil)">
                            <option value="Samarkand">Samarkand</option>
                            <option value="Bukhara">Bukhara</option>
                            <option value="Khiva">Khiva</option>
                            <option value="Urgench">Urgench</option>
                            <option value="Asraf">Asraf</option>
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={route.route || ''}
                          onChange={(e) => handleRouteSelectionChange(route.id, e.target.value, index)}
                          className="w-full px-2 py-1.5 bg-violet-50 text-violet-800 rounded-md text-xs font-medium border border-violet-200 focus:ring-1 focus:ring-violet-400 cursor-pointer min-w-[160px]"
                        >
                          <option value="">Select Route</option>
                          <optgroup label="Pickup / Drop-off">
                            <option value="Airport Pickup">Airport Pickup</option>
                            <option value="Airport Drop-off">Airport Drop-off</option>
                            <option value="Train Station Pickup">Train Station Pickup</option>
                            <option value="Train Station Drop-off">Train Station Drop-off</option>
                          </optgroup>
                          <optgroup label="City Tour">
                            <option value="Tashkent City Tour">Tashkent City Tour</option>
                            <option value="Samarkand City Tour">Samarkand City Tour</option>
                            <option value="Bukhara City Tour">Bukhara City Tour</option>
                          </optgroup>
                          <optgroup label="Transfer">
                            <option value="Tashkent - Samarkand">Tashkent - Samarkand</option>
                            <option value="Samarkand - Asraf">Samarkand - Asraf</option>
                            <option value="Asraf - Bukhara">Asraf - Bukhara</option>
                            <option value="Samarkand - Bukhara">Samarkand - Bukhara</option>
                            <option value="Bukhara - Samarkand">Bukhara - Samarkand</option>
                            <option value="Bukhara - Khiva">Bukhara - Khiva</option>
                            <option value="Olot - Bukhara">Olot - Bukhara</option>
                            <option value="Khiva - Urgench">Khiva - Urgench</option>
                            <option value="Khiva - Shovot">Khiva - Shovot</option>
                            <option value="Tashkent - Fergana">Tashkent - Fergana</option>
                            <option value="Fergana - Tashkent">Fergana - Tashkent</option>
                            <option value="Tashkent - Chimgan - Tashkent">Tashkent - Chimgan - Tashkent</option>
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={route.person || ''}
                          onChange={(e) => {
                            const newPersonCount = parseInt(e.target.value) || 0;

                            // Special handling for Tashkent-Chimgan: ALWAYS use Sprinter + chimgan
                            const isChimganRoute = route.route === 'Tashkent - Chimgan' || route.route === 'Tashkent - Chimgan - Tashkent' || route.route === 'Chimgan Excursion';
                            if (isChimganRoute && newPersonCount > 0) {
                              const autoPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
                              const updatedRoutes = erRoutes.map(r =>
                                r.id === route.id ? {
                                  ...r,
                                  person: newPersonCount.toString(),
                                  choiceTab: 'xayrulla',
                                  transportType: 'Sprinter',
                                  choiceRate: 'chimgan',
                                  price: autoPrice || ''
                                } : r
                              );
                              setErRoutes(updatedRoutes);
                              return;
                            }

                            // Default behavior - auto-set provider, vehicle, rate, and price
                            // Auto-determine provider from city if not set
                            const effectiveProvider = route.choiceTab || getProviderByCity(route.shahar);
                            // Auto-select vehicle based on PAX
                            const autoVehicle = effectiveProvider ? getBestVehicleForRoute(effectiveProvider, newPersonCount) : '';
                            const effectiveVehicle = autoVehicle || route.transportType;
                            // Auto-determine rate from route name
                            const autoRate = route.choiceRate || getAutoRateByRoute(route.route, effectiveProvider);
                            // Always calculate price if we have all required info
                            const autoPrice = (effectiveVehicle && autoRate && effectiveProvider)
                              ? getPriceFromOpex(effectiveProvider, effectiveVehicle, autoRate)
                              : '';

                            const updatedRoutes = erRoutes.map(r =>
                              r.id === route.id ? {
                                ...r,
                                person: newPersonCount.toString(),
                                choiceTab: effectiveProvider || r.choiceTab,
                                transportType: effectiveVehicle,
                                choiceRate: autoRate || r.choiceRate,
                                price: autoPrice ? autoPrice : r.price
                              } : r
                            );
                            setErRoutes(updatedRoutes);
                          }}
                          className="w-14 px-2 py-1.5 bg-blue-50 text-blue-800 rounded-md text-xs font-bold text-center border border-blue-200 focus:ring-1 focus:ring-blue-400"
                          placeholder="0"
                          min="1"
                        />
                      </td>
                      <td
                        className="px-3 py-2.5 cursor-pointer"
                        onClick={() => handleOpenProviderModal(route)}
                      >
                        {route.choiceTab ? (
                          <div className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all hover:scale-105 ${
                            route.choiceTab === 'xayrulla'
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                              : route.choiceTab === 'sevil'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-teal-100 text-teal-800 border border-teal-200'
                          }`}>
                            <span className="capitalize">{route.choiceTab}</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2.5 py-1.5 border border-dashed border-gray-300 rounded-md text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                            Select
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={route.transportType || ''}
                          onChange={(e) => {
                            const newTransportType = e.target.value;
                            // Auto-determine rate if not already set
                            const autoRate = route.choiceRate || getAutoRateByRoute(route.route, route.choiceTab);
                            // Auto-calculate price
                            const autoPrice = autoRate ? getPriceFromOpex(route.choiceTab, newTransportType, autoRate) : '';
                            const updatedRoutes = erRoutes.map(r =>
                              r.id === route.id ? {
                                ...r,
                                transportType: newTransportType,
                                choiceRate: autoRate,
                                price: autoPrice || ''
                              } : r
                            );
                            setErRoutes(updatedRoutes);
                          }}
                          className="w-full px-2 py-1.5 bg-indigo-50 text-indigo-800 rounded-md text-xs font-medium border border-indigo-200 focus:ring-1 focus:ring-indigo-400 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          disabled={!route.choiceTab}
                        >
                          <option value="">{route.choiceTab ? 'Select' : '-'}</option>
                          {route.choiceTab === 'sevil' && sevilVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                          {route.choiceTab === 'xayrulla' && (
                            <>
                              {xayrullaVehicles.map(v => (
                                <option key={v.id} value={v.name}>{v.name}</option>
                              ))}
                              {/* Add Sprinter if not in list */}
                              {!xayrullaVehicles.some(v => v.name?.includes('Sprinter')) && (
                                <option value="Sprinter">Sprinter</option>
                              )}
                            </>
                          )}
                          {route.choiceTab === 'nosir' && nosirVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={route.choiceRate || ''}
                          onChange={(e) => {
                            const selectedRate = e.target.value;
                            const autoPrice = getPriceFromOpex(route.choiceTab, route.transportType, selectedRate);
                            const updatedRoutes = erRoutes.map(r =>
                              r.id === route.id ? { ...r, choiceRate: selectedRate, price: autoPrice || r.price } : r
                            );
                            setErRoutes(updatedRoutes);
                          }}
                          className="w-full px-2 py-1.5 bg-rose-50 text-rose-800 rounded-md text-xs font-medium border border-rose-200 focus:ring-1 focus:ring-rose-400 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          disabled={!route.choiceTab || !route.transportType}
                        >
                          <option value="">{!route.choiceTab || !route.transportType ? '-' : 'Select'}</option>
                          {route.choiceTab === 'sevil' && (
                            <>
                              <option value="pickupDropoff">Pickup/Drop-off</option>
                              <option value="tagRate">TAG Rate</option>
                              <option value="urgenchRate">Urgench</option>
                              <option value="shovotRate">Shovot</option>
                            </>
                          )}
                          {route.choiceTab === 'xayrulla' && (
                            <>
                              <option value="vstrecha">Pickup/Drop-off</option>
                              <option value="chimgan">Chimgan</option>
                              <option value="tag">Tag</option>
                              <option value="oybek">Oybek</option>
                              <option value="chernyayevka">Chernyayevka</option>
                              <option value="cityTour">City Tour</option>
                            </>
                          )}
                          {route.choiceTab === 'nosir' && (
                            <>
                              <option value="margilan">Margilan</option>
                              <option value="qoqon">Qoqon</option>
                              <option value="dostlik">Dostlik</option>
                              <option value="toshkent">Toshkent</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          {route.price ? (
                            <span className="px-3 py-1.5 bg-emerald-500 text-white rounded-md text-xs font-bold shadow-sm">
                              ${route.price}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteRoute(route.id)}
                            className="p-1.5 text-red-500 hover:text-white hover:bg-red-500 rounded-md transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {erRoutes.length === 0 && (
                    <tr>
                      <td colSpan="10" className="px-6 py-12">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                            <MapPin className="w-8 h-8 text-gray-400" />
                          </div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-1">No Routes Yet</h3>
                          <p className="text-xs text-gray-500 mb-4">Add your first route to start planning</p>
                          <button
                            onClick={handleAddRoute}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add Route
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cost Summary */}
            {erRoutes.length > 0 && erRoutes.some(r => parseFloat(r.price) > 0) && (
              <div className="mt-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-8">
                  {/* Provider Totals */}
                  <div className="flex items-center gap-5">
                    {erRoutes.some(r => r.choiceTab === 'sevil' && parseFloat(r.price) > 0) && (
                      <div className="flex items-center gap-3 px-5 py-3 bg-blue-100 rounded-xl border border-blue-200">
                        <span className="text-sm font-semibold text-blue-700">Sevil</span>
                        <span className="text-xl font-bold text-blue-800">
                          ${erRoutes.filter(r => r.choiceTab === 'sevil').reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0).toFixed(0)}
                        </span>
                      </div>
                    )}
                    {erRoutes.some(r => r.choiceTab === 'xayrulla' && parseFloat(r.price) > 0) && (
                      <div className="flex items-center gap-3 px-5 py-3 bg-cyan-100 rounded-xl border border-cyan-200">
                        <span className="text-sm font-semibold text-cyan-700">Xayrulla</span>
                        <span className="text-xl font-bold text-cyan-800">
                          ${erRoutes.filter(r => r.choiceTab === 'xayrulla').reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0).toFixed(0)}
                        </span>
                      </div>
                    )}
                    {erRoutes.some(r => r.choiceTab === 'nosir' && parseFloat(r.price) > 0) && (
                      <div className="flex items-center gap-3 px-5 py-3 bg-teal-100 rounded-xl border border-teal-200">
                        <span className="text-sm font-semibold text-teal-700">Nosir</span>
                        <span className="text-xl font-bold text-teal-800">
                          ${erRoutes.filter(r => r.choiceTab === 'nosir').reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0).toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center gap-4 px-6 py-3 bg-emerald-600 rounded-xl shadow-lg">
                    <span className="text-base font-semibold text-emerald-100">TOTAL</span>
                    <span className="text-2xl font-bold text-white">
                      ${erRoutes.reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider Selection Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Select Transport Provider</h2>
                  <p className="text-gray-600">Choose provider and vehicle for the route</p>
                </div>
              </div>
              <button
                onClick={() => setShowProviderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Person Count Info */}
            {editingRouteForProvider?.person && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Person Count:</span> {editingRouteForProvider.person} people
                  <span className="ml-2 text-blue-600">→ Selecting best vehicle based on capacity</span>
                </p>
              </div>
            )}

            {/* Provider Tabs */}
            <div className="mb-6">
              <div className="flex gap-2">
                {[
                  { id: 'sevil', name: 'Sevil', color: 'blue' },
                  { id: 'xayrulla', name: 'Xayrulla', color: 'cyan' },
                  { id: 'nosir', name: 'Nosir', color: 'teal' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedProviderTab(tab.id)}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                      selectedProviderTab === tab.id
                        ? `bg-gradient-to-r from-${tab.color}-500 to-${tab.color}-600 text-white shadow-lg`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Vehicles Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Vehicle Name
                    </th>
                    {selectedProviderTab === 'sevil' && (
                      <>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          TAG Rate
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Urgench Rate
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Shovot Rate
                        </th>
                      </>
                    )}
                    {selectedProviderTab === 'xayrulla' && (
                      <>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Chimgan Rate
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Tag Rate
                        </th>
                      </>
                    )}
                    {selectedProviderTab === 'nosir' && (
                      <>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Margilan
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Qoqon
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Dostlik
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Toshkent
                        </th>
                      </>
                    )}
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    let vehicles = [];
                    if (selectedProviderTab === 'sevil') vehicles = sevilVehicles;
                    else if (selectedProviderTab === 'xayrulla') vehicles = xayrullaVehicles;
                    else if (selectedProviderTab === 'nosir') vehicles = nosirVehicles;

                    const personCount = editingRouteForProvider?.person ? parseInt(editingRouteForProvider.person) : null;
                    const bestVehicle = findBestVehicle(vehicles, editingRouteForProvider?.person, selectedProviderTab);

                    return vehicles.map((vehicle) => {
                      const vehicleSeats = parseInt(vehicle.seats);
                      const canAccommodate = !personCount || isNaN(vehicleSeats) || vehicleSeats >= personCount;
                      const isBestMatch = bestVehicle && bestVehicle.id === vehicle.id;
                      const isInsufficient = personCount && !isNaN(vehicleSeats) && vehicleSeats < personCount;

                      return (
                        <tr
                          key={vehicle.id}
                          className={`transition-all duration-200 ${
                            isBestMatch
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500'
                              : isInsufficient
                              ? 'bg-gray-50 opacity-50'
                              : 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900">
                                {vehicle.name}
                              </div>
                              {isBestMatch && (
                                <span className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
                                  Best Match
                                </span>
                              )}
                              {isInsufficient && (
                                <span className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full">
                                  Too Small
                                </span>
                              )}
                            </div>
                          </td>
                          {selectedProviderTab === 'sevil' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.tagRate }, 'tagRate')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  {vehicle.tagRate || '-'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.urgenchRate }, 'urgenchRate')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  {vehicle.urgenchRate || '-'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.shovotRate2 }, 'shovotRate2')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  {vehicle.shovotRate2 || '-'}
                                </button>
                              </td>
                            </>
                          )}
                          {selectedProviderTab === 'xayrulla' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.chimgan }, 'chimgan')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                                  }`}
                                >
                                  {vehicle.chimgan || '-'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.tag }, 'tag')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                                  }`}
                                >
                                  {vehicle.tag || '-'}
                                </button>
                              </td>
                            </>
                          )}
                          {selectedProviderTab === 'nosir' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.margilan }, 'margilan')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                  }`}
                                >
                                  {vehicle.margilan || '-'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.qoqon }, 'qoqon')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                  }`}
                                >
                                  {vehicle.qoqon || '-'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.dostlik }, 'dostlik')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                  }`}
                                >
                                  {vehicle.dostlik || '-'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleSelectProvider({ ...vehicle, selectedRate: vehicle.toshkent }, 'toshkent')}
                                  disabled={isInsufficient}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                    isInsufficient
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                  }`}
                                >
                                  {vehicle.toshkent || '-'}
                                </button>
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => handleSelectProvider(vehicle, null)}
                              disabled={isInsufficient}
                              className={`px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium ${
                                isInsufficient
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : isBestMatch
                                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl hover:scale-105'
                                  : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl hover:scale-105'
                              }`}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Form - show for Info and Rooms tabs, or for new bookings */}
      {(isNew || activeTab === 'info' || activeTab === 'rooms') && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info */}
          {(isNew || activeTab === 'info') && (
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-full blur-3xl"></div>

            <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              Basic Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Booking Number *
                </label>
                <input
                  type="text"
                  name="bookingNumber"
                  value={formData.bookingNumber}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                  placeholder="ER-01"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Tour Type *
                </label>
                <select
                  name="tourTypeId"
                  value={formData.tourTypeId}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                >
                  <option value="">Select type</option>
                  {tourTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.code} - {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Guide
                </label>
                <select
                  name="guideId"
                  value={formData.guideId}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                >
                  <option value="">Not assigned</option>
                  {guides.map((guide) => (
                    <option key={guide.id} value={guide.id}>
                      {guide.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Group Country
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                >
                  <option value="">Select country</option>
                  {countriesList.map((country) => (
                    <option key={country.code} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Dates */}
          {(isNew || activeTab === 'info') && (
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-indigo-100 p-8">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-purple-400/10 to-indigo-400/10 rounded-full blur-3xl"></div>

            <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              Dates
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Tour Start *
                </label>
                <input
                  type="date"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Arrival
                  <span className="ml-1 text-xs font-normal text-gray-500">(auto: Tour Start + 1 day)</span>
                </label>
                <input
                  type="date"
                  name="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Tour End
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
                />
              </div>
            </div>
          </div>
          )}

          {/* Transport */}
          {(isNew || activeTab === 'info') && (
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-8">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-green-400/10 to-emerald-400/10 rounded-full blur-3xl"></div>

            <h2 className="text-2xl font-black bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                <Train className="w-6 h-6 text-white" />
              </div>
              Transportation
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Train Tickets
                </label>
                {editing ? (
                  <select
                    name="trainTickets"
                    value={formData.trainTickets}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {ticketStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getTicketStatusStyle(formData.trainTickets)}`}>
                    <span className="font-medium">{getTicketStatusIcon(formData.trainTickets)}</span>
                    <span>{formData.trainTickets || 'Not specified'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Air Tickets
                </label>
                {editing ? (
                  <select
                    name="avia"
                    value={formData.avia}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {ticketStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getTicketStatusStyle(formData.avia)}`}>
                    <span className="font-medium">{getTicketStatusIcon(formData.avia)}</span>
                    <span>{formData.avia || 'Not specified'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Hotel Room Allocations */}
          {!isNew && activeTab === 'rooms' && (
            <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 py-8 px-8 w-full -mx-4" style={{ width: 'calc(100vw - 16rem)', marginLeft: '-1rem' }}>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-primary-600 flex items-center justify-center shadow-lg">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  Hotel Accommodation
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={autoFillAccommodationsFromItinerary}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                    title="Автоматически создать размещения из программы тура"
                  >
                    <Wand2 className="w-5 h-5" />
                    Из программы тура
                  </button>
                  <button
                    onClick={() => { setEditingAccommodation(null); setAccommodationFormOpen(true); }}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-gradient-to-r from-blue-600 to-primary-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-bold shadow-md"
                  >
                    <Plus className="w-5 h-5" />
                    Добавить отель
                  </button>
                  {booking?.tourType?.code === 'ER' && (
                    <>
                      <div className="border-l border-gray-300 h-8"></div>
                      <button
                        onClick={handleSaveAccommodationsAsTemplate}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        title="Сохранить текущие размещения как шаблон по умолчанию для ER туров"
                      >
                        <Database className="w-4 h-4" />
                        Save as Template
                      </button>
                      <button
                        onClick={handleLoadAccommodationsFromTemplate}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                        title="Загрузить размещения из шаблона базы данных"
                      >
                        <Download className="w-4 h-4" />
                        Load Template
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Statistics Cards */}
              {(() => {
                // Calculate statistics from tourists
                // IMPORTANT: Only count tourists with room numbers (from rooming list PDF)
                const touristsWithRooms = tourists.filter(t => t.roomNumber);
                const totalGuests = touristsWithRooms.length;

                // Count unique rooms by type
                const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };
                const touristsWithoutRoom = { DBL: 0, TWN: 0, SNGL: 0 };

                touristsWithRooms.forEach(t => {
                  const roomNum = t.roomNumber;
                  const roomPreference = (t.roomPreference || '').toUpperCase();

                  // Determine room type from roomNumber first, then fall back to roomPreference
                  let roomType = '';
                  if (roomNum) {
                    const roomNumUpper = roomNum.toUpperCase();
                    if (roomNumUpper.startsWith('DBL')) {
                      roomType = 'DBL';
                    } else if (roomNumUpper.startsWith('TWN')) {
                      roomType = 'TWN';
                    } else if (roomNumUpper.startsWith('SNGL') || roomNumUpper.startsWith('SGL')) {
                      roomType = 'SNGL';
                    }
                  }

                  // Fall back to roomPreference if roomType not determined from roomNumber
                  if (!roomType) {
                    if (roomPreference === 'DBL' || roomPreference === 'DOUBLE' || roomPreference === 'DZ') {
                      roomType = 'DBL';
                    } else if (roomPreference === 'TWN' || roomPreference === 'TWIN') {
                      roomType = 'TWN';
                    } else if (roomPreference === 'SNGL' || roomPreference === 'SINGLE' || roomPreference === 'EZ' || roomPreference === 'SGL') {
                      roomType = 'SNGL';
                    }
                  }

                  // Count unique rooms by type
                  if (roomType === 'DBL') {
                    if (roomNum && !seenRooms.DBL.has(roomNum)) {
                      roomCounts.DBL++;
                      seenRooms.DBL.add(roomNum);
                    } else if (!roomNum) {
                      touristsWithoutRoom.DBL++;
                    }
                  } else if (roomType === 'TWN') {
                    if (roomNum && !seenRooms.TWN.has(roomNum)) {
                      roomCounts.TWN++;
                      seenRooms.TWN.add(roomNum);
                    } else if (!roomNum) {
                      touristsWithoutRoom.TWN++;
                    }
                  } else if (roomType === 'SNGL') {
                    if (roomNum && !seenRooms.SNGL.has(roomNum)) {
                      roomCounts.SNGL++;
                      seenRooms.SNGL.add(roomNum);
                    } else if (!roomNum) {
                      touristsWithoutRoom.SNGL++;
                    }
                  }
                });

                // Add tourists without room numbers (DBL/TWN: 2 people = 1 room, SNGL: 1 person = 1 room)
                roomCounts.DBL += Math.ceil(touristsWithoutRoom.DBL / 2);
                roomCounts.TWN += Math.ceil(touristsWithoutRoom.TWN / 2);
                roomCounts.SNGL += touristsWithoutRoom.SNGL;

                // Count by placement (only tourists with room numbers)
                const uzbekCount = touristsWithRooms.filter(t => {
                  const acc = (t.accommodation || '').toLowerCase();
                  return acc.includes('uzbek') || acc.includes('узбек');
                }).length;

                const turkmCount = touristsWithRooms.filter(t => {
                  const acc = (t.accommodation || '').toLowerCase();
                  return acc.includes('turkmen') || acc.includes('туркмен');
                }).length;

                return (
                  <div className="flex items-stretch gap-4 flex-wrap mb-8">
                    {/* Total Guests Card */}
                    <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                        <Users className="w-8 h-8 text-primary-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary-700 uppercase tracking-wide mb-1">Total</div>
                        <div className="text-4xl font-black text-gray-900 mb-0.5">{totalGuests}</div>
                        <div className="text-sm text-gray-600 font-medium">guests</div>
                      </div>
                    </div>

                    {/* DBL Rooms Card */}
                    {roomCounts.DBL > 0 && (
                      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                          <Bed className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                            DBL
                          </div>
                          <div className="text-4xl font-black text-gray-900 mb-0.5">{roomCounts.DBL}</div>
                          <div className="text-sm text-gray-600 font-medium">rooms</div>
                        </div>
                      </div>
                    )}

                    {/* TWN Rooms Card */}
                    {roomCounts.TWN > 0 && (
                      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                          <Bed className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                            TWN
                          </div>
                          <div className="text-4xl font-black text-gray-900 mb-0.5">{roomCounts.TWN}</div>
                          <div className="text-sm text-gray-600 font-medium">rooms</div>
                        </div>
                      </div>
                    )}

                    {/* SNGL Rooms Card */}
                    {roomCounts.SNGL > 0 && (
                      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200 rounded-2xl shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
                          <User className="w-8 h-8 text-violet-600" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                            SNGL
                          </div>
                          <div className="text-4xl font-black text-gray-900 mb-0.5">{roomCounts.SNGL}</div>
                          <div className="text-sm text-gray-600 font-medium">rooms</div>
                        </div>
                      </div>
                    )}

                    {/* Uzbekistan/Turkmenistan Split Card */}
                    {uzbekCount > 0 && turkmCount > 0 && (
                      <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl shadow-md">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-sm" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Uzbekistan</span>
                            <span className="text-2xl font-black text-gray-900">{uzbekCount}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Turkmenistan</span>
                            <span className="text-2xl font-black text-gray-900">{turkmCount}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Accommodations (Simplified structure) */}
              {accommodations.length > 0 && (() => {
                // Determine first accommodation (earliest check-in date)
                const sortedAccs = [...accommodations].sort((a, b) =>
                  new Date(a.checkInDate) - new Date(b.checkInDate)
                );
                const firstAccId = sortedAccs[0]?.id;

                return (
                  <div className="space-y-6 w-full">
                    {accommodations.map((acc, accIndex) => {
                      const isFirstAccommodation = acc.id === firstAccId;
                      return (
                    <div key={acc.id} className="w-full bg-white rounded-3xl border border-gray-300 shadow-lg hover:shadow-2xl hover:border-primary-300 transition-all duration-300 p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-blue-500 to-purple-500"></div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-primary-600 flex items-center justify-center shadow-lg shrink-0 ring-4 ring-blue-100">
                            <Building2 className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            {/* Hotel Name - Large and prominent */}
                            <div className="font-black text-gray-900 text-3xl mb-3 tracking-tight">{acc.hotel?.name}</div>

                            {/* City - Large with icon */}
                            <div className="flex items-center gap-2 mb-4">
                              <div className="p-1.5 rounded-lg bg-primary-100">
                                <MapPin className="w-5 h-5 text-primary-600" />
                              </div>
                              <span className="text-xl font-bold text-gray-700">{acc.hotel?.city?.name}</span>
                            </div>

                            {/* Dates and Nights - Large badges */}
                            <div className="flex items-center gap-4 flex-wrap mb-4">
                              <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl shadow-md">
                                <div className="p-2 rounded-lg bg-blue-500">
                                  <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-lg font-bold text-blue-900">
                                  {format(new Date(acc.checkInDate), 'dd.MM.yy')} — {format(new Date(acc.checkOutDate), 'dd.MM.yy')}
                                </span>
                              </div>
                              <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-2xl shadow-md">
                                <span className="text-3xl font-black text-purple-700">{acc.nights}</span>
                                <span className="text-lg font-bold text-purple-600">
                                  {acc.nights === 1 ? 'night' : 'nights'}
                                </span>
                              </div>
                            </div>

                            {/* Summary Card (ROOMS, GUESTS, TOTAL) - Calculate from Final List */}
                            {(acc.rooms?.length > 0) && (() => {
                              // Get currency - auto-detect from price if needed
                              const firstRoom = acc.rooms?.[0];
                              const roomType = firstRoom ? acc.hotel?.roomTypes?.find(rt => rt.name === firstRoom.roomTypeCode) : null;
                              let currency = roomType?.currency || acc.hotel?.roomTypes?.[0]?.currency || 'UZS';

                              // Auto-detect from room prices
                              if (acc.rooms?.length > 0) {
                                const firstRoomPrice = parseFloat(acc.rooms[0].pricePerNight) || 0;
                                if (firstRoomPrice > 10000) {
                                  currency = 'UZS';
                                }
                              }
                              const isPAX = acc.hotel?.stars === 'Guesthouse' || acc.hotel?.stars === 'Yurta';

                              let totalRooms = 0;
                              let totalGuests = 0;
                              let totalCost = 0;
                              let usedRoomingList = false;
                              let calculationBreakdown = [];

                              // Use accommodation-specific rooming list if available
                              let accTourists = accommodationRoomingLists[acc.id];

                              // IMPORTANT: Filter to only show tourists with room numbers
                              if (accTourists) {
                                accTourists = accTourists.filter(t => t.roomNumber);
                              }

                              // Debug log
                              console.log(`\n🏨 [${acc.hotel?.name} ID:${acc.id}]`);
                              console.log(`   Rooming list tourists: ${accTourists?.length || 0}`);
                              if (accTourists?.length > 0) {
                                accTourists.forEach(t => {
                                  console.log(`     - ${t.lastName || t.fullName}: ${t.roomPreference}, ${t.accommodation}`);
                                });
                              }

                              // Fallback: filter tourists by hotel name and date overlap if rooming list not loaded
                              if (!accTourists) {
                                console.log(`  → Using fallback filtering`);
                                accTourists = tourists.filter(t => {
                                  if (!t.hotelName || !acc.hotel?.name) return false;

                                  // Check hotel name match
                                  const hotelFirstWord = acc.hotel.name.toLowerCase().split(' ')[0];
                                  if (!t.hotelName.toLowerCase().includes(hotelFirstWord)) return false;

                                  // Check date overlap - tourist dates must overlap with accommodation dates
                                  if (t.checkInDate && t.checkOutDate && acc.checkInDate && acc.checkOutDate) {
                                    const touristCheckIn = new Date(t.checkInDate);
                                    const touristCheckOut = new Date(t.checkOutDate);
                                    const accCheckIn = new Date(acc.checkInDate);
                                    const accCheckOut = new Date(acc.checkOutDate);

                                    touristCheckIn.setHours(0, 0, 0, 0);
                                    touristCheckOut.setHours(0, 0, 0, 0);
                                    accCheckIn.setHours(0, 0, 0, 0);
                                    accCheckOut.setHours(0, 0, 0, 0);

                                    // Tourist dates must overlap with accommodation dates
                                    return touristCheckIn < accCheckOut && touristCheckOut > accCheckIn;
                                  }

                                  return true; // If no dates, match by hotel name only
                                });
                              }

                              if (accTourists.length > 0 && acc.checkInDate && acc.checkOutDate) {
                                const accCheckIn = new Date(acc.checkInDate);
                                accCheckIn.setHours(0, 0, 0, 0);
                                const accCheckOut = new Date(acc.checkOutDate);
                                accCheckOut.setHours(0, 0, 0, 0);

                                // Calculate guest-nights per room type from Final List
                                const guestNightsPerRoomType = {};
                                const touristDetails = {}; // Track individual tourist nights for breakdown

                                accTourists.forEach(tourist => {
                                  // Determine check-in/check-out dates
                                  let checkIn, checkOut;

                                  // CRITICAL FOR ER TOURS: Card view date calculation
                                  // PRIORITY 1: If tourist has checkInDate/checkOutDate (from rooming list API), use them
                                  // Backend already calculates UZ tourists in TM hotels with -1 day checkout
                                  // DO NOT MODIFY without testing ER-03 card display
                                  if (tourist.checkInDate && tourist.checkOutDate) {
                                    checkIn = new Date(tourist.checkInDate);
                                    checkOut = new Date(tourist.checkOutDate);
                                  } else {
                                    // PRIORITY 2: Use accommodation dates as fallback
                                    checkIn = new Date(accCheckIn);
                                    checkOut = new Date(accCheckOut);
                                  }

                                  checkIn.setHours(0, 0, 0, 0);
                                  checkOut.setHours(0, 0, 0, 0);

                                  const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

                                  let roomType = (tourist.roomPreference || '').toUpperCase();

                                  // For PAX hotels, all guests are counted as PAX
                                  if (isPAX) {
                                    roomType = 'PAX';
                                  } else {
                                    if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
                                    if (roomType === 'TWIN') roomType = 'TWN';
                                    if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';
                                  }

                                  if (!guestNightsPerRoomType[roomType]) {
                                    guestNightsPerRoomType[roomType] = 0;
                                  }
                                  guestNightsPerRoomType[roomType] += nights;

                                  // Track details for breakdown
                                  if (!touristDetails[roomType]) {
                                    touristDetails[roomType] = [];
                                  }
                                  touristDetails[roomType].push({
                                    name: tourist.lastName || 'Guest',
                                    nights: nights,
                                    checkIn: checkIn.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
                                    checkOut: checkOut.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
                                  });
                                });

                                totalGuests = accTourists.length;

                                console.log(`   Guest-nights per room type:`, guestNightsPerRoomType);

                                // First, calculate room count from guest count (not guest-nights!)
                                const guestCountPerRoomType = {};
                                accTourists.forEach(tourist => {
                                  let roomType = (tourist.roomPreference || '').toUpperCase();

                                  // For PAX hotels, all guests are counted as PAX regardless of preference
                                  if (isPAX) {
                                    roomType = 'PAX';
                                  } else {
                                    if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
                                    if (roomType === 'TWIN') roomType = 'TWN';
                                    if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';
                                  }

                                  if (!guestCountPerRoomType[roomType]) {
                                    guestCountPerRoomType[roomType] = 0;
                                  }
                                  guestCountPerRoomType[roomType] += 1; // Count guests, not nights
                                });

                                console.log(`   Guest count per room type:`, guestCountPerRoomType);

                                // Calculate cost ONLY from rooming list data (ignore saved rooms data)
                                acc.rooms.forEach(room => {
                                  const pricePerNight = parseFloat(room.pricePerNight) || 0;

                                  let normalizedRoomType = room.roomTypeCode?.toUpperCase();
                                  if (normalizedRoomType === 'DOUBLE') normalizedRoomType = 'DBL';
                                  if (normalizedRoomType === 'TWIN') normalizedRoomType = 'TWN';
                                  if (normalizedRoomType === 'SINGLE') normalizedRoomType = 'SNGL';

                                  // Get guest-nights from rooming list
                                  const guestNights = guestNightsPerRoomType[normalizedRoomType] || 0;

                                  // ONLY calculate if there are guests in rooming list for this room type
                                  if (guestNights === 0) return; // Skip this room type - no guests

                                  // Calculate room count from guest count (not guest-nights!)
                                  const guestCount = guestCountPerRoomType[normalizedRoomType] || 0;
                                  let roomCount;
                                  if (normalizedRoomType === 'PAX') {
                                    // PAX: no room count, just guest count
                                    roomCount = 0;
                                  } else if (normalizedRoomType === 'TWN' || normalizedRoomType === 'DBL') {
                                    roomCount = Math.ceil(guestCount / 2); // 2 guests per room
                                    totalRooms += roomCount;
                                  } else if (normalizedRoomType === 'SNGL') {
                                    roomCount = guestCount; // 1 guest per room
                                    totalRooms += roomCount;
                                  } else {
                                    roomCount = guestCount;
                                    totalRooms += roomCount;
                                  }

                                  // Convert guest-nights to room-nights for cost calculation
                                  let roomNights;
                                  if (normalizedRoomType === 'PAX') {
                                    roomNights = guestNights;
                                  } else if (normalizedRoomType === 'TWN' || normalizedRoomType === 'DBL') {
                                    roomNights = guestNights / 2;
                                  } else { // SNGL
                                    roomNights = guestNights;
                                  }

                                  const roomTypeCost = roomNights * pricePerNight;
                                  totalCost += roomTypeCost;

                                  // Add to breakdown
                                  calculationBreakdown.push({
                                    roomType: normalizedRoomType,
                                    roomNights: roomNights,
                                    pricePerNight: pricePerNight,
                                    totalCost: roomTypeCost,
                                    guestNights: guestNights,
                                    details: touristDetails[normalizedRoomType] || []
                                  });

                                  // Update currency from room type
                                  const hotelRoomType = acc.hotel?.roomTypes?.find(rt => rt.name === room.roomTypeCode);
                                  if (hotelRoomType?.currency) {
                                    currency = hotelRoomType.currency;
                                  }
                                });

                                usedRoomingList = true;
                                console.log(`   ✓ Used rooming list - Total: ${totalCost.toLocaleString()} (${totalGuests} guests, ${totalRooms} rooms)`);
                              }

                              // Fallback: calculate from rooms data ONLY if no rooming list available
                              if (!usedRoomingList) {
                                console.log(`   → Using fallback: saved database values`);
                                totalRooms = acc.totalRooms || 0;
                                totalGuests = acc.totalGuests || 0;
                                totalCost = parseFloat(acc.totalCost) || 0;

                                // If still 0, calculate from rooms
                                if (totalCost === 0 && acc.rooms?.length > 0) {
                                  acc.rooms.forEach(room => {
                                    const roomCount = parseInt(room.roomsCount) || 0;
                                    const guestsPerRoom = parseInt(room.guestsPerRoom) || 2;
                                    const pricePerNight = parseFloat(room.pricePerNight) || 0;
                                    const nights = acc.nights || 1;

                                    if (!isPAX) totalRooms += roomCount;
                                    totalGuests += roomCount * guestsPerRoom;
                                    totalCost += roomCount * pricePerNight * nights;

                                    const hotelRoomType = acc.hotel?.roomTypes?.find(rt => rt.name === room.roomTypeCode);
                                    if (hotelRoomType?.currency) {
                                      currency = hotelRoomType.currency;
                                    }
                                  });
                                }
                              }

                              // Final currency check - if total cost is high, it's UZS
                              if (totalCost > 10000) {
                                currency = 'UZS';
                              }

                              const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'so\'m';
                              const displayCost = currency === 'UZS' ? totalCost.toLocaleString('ru-RU') : totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                              // Debug log - VERY DETAILED breakdown
                              console.groupCollapsed(`💰 ${acc.hotel?.name} - TOTAL: ${displayCost} ${currencySymbol}`);
                              console.log('Hotel dates:', {
                                checkIn: acc.checkInDate,
                                checkOut: acc.checkOutDate,
                                nights: acc.nights
                              });
                              console.log('Summary:', {
                                totalCost,
                                currency,
                                totalRooms,
                                totalGuests,
                                usedRoomingList: usedRoomingList ? 'YES ✓' : 'NO ✗',
                                touristsFiltered: accTourists.length
                              });

                              // Detailed tourist breakdown
                              if (accTourists.length > 0) {
                                console.log(`\n📋 Individual tourists (${accTourists.length}):`);
                                accTourists.forEach((t, idx) => {
                                  const tCheckIn = t.checkInDate ? new Date(t.checkInDate) : new Date(acc.checkInDate);
                                  const tCheckOut = t.checkOutDate ? new Date(t.checkOutDate) : new Date(acc.checkOutDate);
                                  tCheckIn.setHours(0, 0, 0, 0);
                                  tCheckOut.setHours(0, 0, 0, 0);
                                  const nights = Math.max(0, Math.round((tCheckOut - tCheckIn) / (1000 * 60 * 60 * 24)));
                                  console.log(`  ${idx + 1}. ${t.lastName || 'Unknown'} (${t.roomPreference || '?'}):`);
                                  console.log(`     Check-in:  ${tCheckIn.toLocaleDateString('ru-RU')}`);
                                  console.log(`     Check-out: ${tCheckOut.toLocaleDateString('ru-RU')}`);
                                  console.log(`     Nights: ${nights} | Placement: ${t.accommodation || 'N/A'}`);
                                  console.log('     ---');
                                });
                              }

                              // Room type calculation breakdown
                              if (calculationBreakdown.length > 0) {
                                console.log(`\n💵 Cost calculation by room type:`);
                                calculationBreakdown.forEach(item => {
                                  console.log(`  ${item.roomType}:`);
                                  console.log(`    Guest-nights: ${item.guestNights} (${item.details.length} guests)`);
                                  console.log(`    Room-nights: ${item.roomNights.toFixed(2)}`);
                                  console.log(`    Price/night: ${currency === 'UZS' ? item.pricePerNight.toLocaleString() : item.pricePerNight} ${currencySymbol}`);
                                  console.log(`    Subtotal: ${currency === 'UZS' ? item.totalCost.toLocaleString() : item.totalCost.toFixed(2)} ${currencySymbol}`);
                                  console.log('    ---');
                                });
                                console.log(`  🟢 TOTAL: ${displayCost} ${currencySymbol}`);
                              } else {
                                console.warn('  ⚠️ No calculation breakdown available (using fallback)');
                              }

                              console.groupEnd();

                              // Only show if we have any data at all
                              if (totalRooms === 0 && totalGuests === 0 && totalCost === 0) {
                                return null;
                              }

                              return (
                                <div className="mb-4 space-y-3">
                                  {/* Main Summary */}
                                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-4 border-2 border-blue-200 shadow-md">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                      {/* Left side - Stats */}
                                      <div className="flex items-center gap-5">
                                        {!isPAX && totalRooms > 0 && (
                                          <div className="flex items-center gap-2">
                                            <div className="w-12 h-12 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center">
                                              <Bed className="w-6 h-6 text-orange-600" />
                                            </div>
                                            <div>
                                              <div className="text-xs text-gray-500 uppercase font-medium">Rooms</div>
                                              <div className="text-2xl font-bold text-gray-800">{totalRooms}</div>
                                            </div>
                                          </div>
                                        )}
                                        {totalGuests > 0 && (
                                          <div className="flex items-center gap-2">
                                            <div className="w-12 h-12 rounded-xl bg-green-100 border border-green-300 flex items-center justify-center">
                                              <Users className="w-6 h-6 text-green-600" />
                                            </div>
                                            <div>
                                              <div className="text-xs text-gray-500 uppercase font-medium">Guests</div>
                                              <div className="text-2xl font-bold text-gray-800">{totalGuests}</div>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Right side - Total */}
                                      {totalCost > 0 && (
                                        <div className="text-right">
                                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Total (incl. tax)</div>
                                          <div className="text-3xl font-black text-blue-700">
                                            {currency === 'UZS' ? (
                                              <>
                                                {displayCost}
                                                <span className="text-lg font-medium text-blue-500 ml-2">{currencySymbol}</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="text-lg font-medium text-blue-500 mr-1">{currencySymbol}</span>
                                                {displayCost}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Calculation Breakdown */}
                                  {calculationBreakdown.length > 0 && (
                                    <details className="group">
                                      <summary className="cursor-pointer px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">📊 Hisob-kitob tafsilotlari</span>
                                        <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                      </summary>
                                      <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg space-y-3">
                                        {calculationBreakdown.map((item, idx) => (
                                          <div key={idx} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                            <div className="flex justify-between items-start mb-2">
                                              <div>
                                                <span className="font-bold text-gray-900">{item.roomType}:</span>
                                                <span className="text-sm text-gray-600 ml-2">
                                                  {item.roomNights.toFixed(1)} room-nights × {currency === 'UZS' ? (
                                                    <>{item.pricePerNight.toLocaleString('ru-RU')} {currencySymbol}</>
                                                  ) : (
                                                    <>{currencySymbol}{item.pricePerNight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                                  )}
                                                </span>
                                              </div>
                                              <span className="font-bold text-blue-700">
                                                {currency === 'UZS' ? (
                                                  <>{item.totalCost.toLocaleString('ru-RU')} {currencySymbol}</>
                                                ) : (
                                                  <>{currencySymbol}{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                                )}
                                              </span>
                                            </div>
                                            {item.details.length > 0 && (
                                              <div className="ml-4 space-y-1">
                                                {item.details.slice(0, 3).map((guest, gidx) => (
                                                  <div key={gidx} className="text-xs text-gray-500">
                                                    • {guest.name}: {guest.nights} nights ({guest.checkIn} - {guest.checkOut})
                                                  </div>
                                                ))}
                                                {item.details.length > 3 && (
                                                  <div className="text-xs text-gray-400 italic">
                                                    ... va yana {item.details.length - 3} mehmon
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                        <div className="pt-2 border-t-2 border-gray-300">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-gray-900">Umumiy:</span>
                                            <span className="text-xl font-black text-blue-700">
                                              {currency === 'UZS' ? (
                                                <>{displayCost} {currencySymbol}</>
                                              ) : (
                                                <>{currencySymbol}{displayCost}</>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              );
                            })()}
                            {/* Room Types Display */}
                            {acc.rooms && acc.rooms.length > 0 && (() => {
                              // Check if hotel is Guesthouse/Yurta - use PAX display
                              const isGuesthouse = acc.hotel?.stars === 'Guesthouse' || acc.hotel?.stars === 'Yurta';
                              const hasPaxRoom = acc.rooms?.some(r => r.roomTypeCode === 'PAX');

                              if (isGuesthouse || hasPaxRoom) {
                                // For Guesthouse/Yurta: show PAX badge with total guests
                                const paxRoom = acc.rooms?.find(r => r.roomTypeCode === 'PAX');
                                const paxRoomType = acc.hotel?.roomTypes?.find(rt => rt.name === 'PAX');

                                // Calculate total guests from all rooms or use PAX count
                                const totalGuests = paxRoom?.roomsCount || acc.rooms.reduce((sum, r) => sum + (r.roomsCount || 0) * (r.guestsPerRoom || 1), 0);

                                // Get PAX price from hotel's room types
                                const paxPrice = paxRoomType?.pricePerNight || paxRoom?.pricePerNight || 0;
                                const paxCurrency = paxRoomType?.currency || 'USD';
                                const currencyLabel = paxCurrency === 'USD' ? '$' : paxCurrency === 'EUR' ? '€' : ' UZS';
                                const displayPrice = paxCurrency === 'UZS' ? Math.round(paxPrice).toLocaleString() : paxPrice;

                                return (
                                  <div className="mt-4 flex flex-wrap gap-4">
                                    <span className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-purple-50 via-purple-100 to-violet-100 text-purple-900 border-2 border-purple-400 rounded-2xl text-lg font-black shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                                      <span className="text-purple-800 text-xl">PAX:</span>
                                      <span className="text-gray-800">{totalGuests} guests</span>
                                      {paxPrice > 0 && (
                                        <span className="text-purple-700 text-base font-semibold">
                                          ({displayPrice}{currencyLabel}/person/night)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              }

                              // For regular hotels: show individual room type badges
                              return (
                                <div className="mt-4 flex flex-wrap gap-4">
                                  {acc.rooms.map((room, idx) => {
                                    // Find matching room type to check if tourist tax is enabled
                                    const matchingRoomType = acc.hotel?.roomTypes?.find(rt =>
                                      rt.name === room.roomTypeCode ||
                                      rt.displayName === room.roomTypeCode ||
                                      rt.name?.toUpperCase() === room.roomTypeCode?.toUpperCase()
                                    );

                                    // Get currency from room type, or infer from price
                                    // If price > 10000, likely UZS; if < 1000, likely USD/EUR
                                    let roomCurrency = matchingRoomType?.currency || 'UZS';
                                    if (room.pricePerNight > 10000) {
                                      roomCurrency = 'UZS'; // High prices are in UZS
                                    } else if (room.pricePerNight < 1000 && !matchingRoomType?.currency) {
                                      roomCurrency = 'USD'; // Low prices without explicit currency are USD
                                    }
                                    const currencyLabel = roomCurrency === 'USD' ? '$' : roomCurrency === 'EUR' ? '€' : ' UZS';

                                    // Use saved price (already includes tourist tax and VAT)
                                    const displayPrice = roomCurrency === 'UZS'
                                      ? Math.round(room.pricePerNight).toLocaleString()
                                      : room.pricePerNight.toFixed(2);

                                    // Check if room type has taxes enabled
                                    const hasTax = matchingRoomType?.touristTaxEnabled || matchingRoomType?.vatIncluded;

                                    return (
                                      <span key={idx} className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 text-green-900 border-2 border-green-400 rounded-2xl text-lg font-black shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                                        <span className="text-green-800 text-xl">{room.roomTypeCode}:</span>
                                        <span className="text-gray-800">{room.roomsCount} × {room.guestsPerRoom} guests</span>
                                        {room.pricePerNight > 0 && (
                                          <span className="text-green-700 text-base font-semibold">
                                            ({displayPrice}{currencyLabel}/night)
                                            {hasTax && (
                                              <span className="text-green-600 text-xs ml-1">
                                                (incl. tax)
                                              </span>
                                            )}
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              // Check if this hotel has multiple visits in the booking
                              const hotelId = acc.hotel?.id;
                              const visitsToSameHotel = accommodations.filter(a => a.hotel?.id === hotelId);

                              // Use combined route if multiple visits, otherwise single accommodation route
                              const previewUrl = visitsToSameHotel.length > 1
                                ? bookingsApi.getHotelRequestCombined(id, hotelId)
                                : bookingsApi.getHotelRequestPreview(id, acc.id);

                              // Open in new window for printing/PDF download
                              const printWindow = window.open(previewUrl, '_blank');
                              if (printWindow) {
                                // Wait for content to load then trigger print dialog
                                printWindow.addEventListener('load', () => {
                                  setTimeout(() => {
                                    printWindow.print();
                                  }, 500);
                                });
                              }
                            }}
                            className="p-3 text-green-600 bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 rounded-xl hover:scale-110 transition-all duration-200 shadow-md"
                            title="Скачать заявку для отеля (Print to PDF)"
                          >
                            <FileDown className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingAccommodation(acc);
                              setAccommodationFormOpen(true);
                            }}
                            className="p-3 text-primary-600 bg-primary-50 hover:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 rounded-xl hover:scale-110 transition-all duration-200 shadow-md"
                            title="Редактировать"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Удалить это размещение?')) {
                                try {
                                  await bookingsApi.deleteAccommodation(id, acc.id);
                                  toast.success('Accommodation deleted');
                                  loadData();
                                } catch (error) {
                                  toast.error('Ошибка удаления');
                                }
                              }
                            }}
                            className="p-3 text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-200 hover:border-red-400 rounded-xl hover:scale-110 transition-all duration-200 shadow-md"
                            title="Удалить"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Rooming List Toggle Button and Content */}
                      {(() => {
                        // Check if this is second visit to same Tashkent hotel
                        const tashkentAccommodations = accommodations.filter(a => {
                          const cityName = a.hotel?.city?.name?.toLowerCase() || '';
                          return cityName.includes('ташкент') || cityName.includes('tashkent') || cityName.includes('toshkent');
                        });

                        const isSecondVisitSameHotel = tashkentAccommodations.length > 1 &&
                                                        tashkentAccommodations[tashkentAccommodations.length - 1].id === acc.id &&
                                                        tashkentAccommodations[0].hotel?.id === tashkentAccommodations[tashkentAccommodations.length - 1].hotel?.id &&
                                                        tashkentAccommodations[0].id !== tashkentAccommodations[tashkentAccommodations.length - 1].id;

                        // Filter tourists for this accommodation
                        // isFirstAccommodation already defined in outer scope
                        let accTourists = tourists.filter(t => {
                          const accCheckIn = new Date(acc.checkInDate);
                          const accCheckOut = new Date(acc.checkOutDate);

                          // If tourist has hotel name, match by it
                          if (t.hotelName && acc.hotel?.name) {
                            const hotelMatches = t.hotelName.toLowerCase().includes(acc.hotel.name.toLowerCase().split(' ')[0].toLowerCase());
                            if (!hotelMatches) return false;
                          }

                          // Only check custom dates for first accommodation
                          // For other accommodations, ignore custom dates and show all tourists
                          if (isFirstAccommodation && t.checkInDate && t.checkOutDate) {
                            const touristCheckIn = new Date(t.checkInDate);
                            const touristCheckOut = new Date(t.checkOutDate);
                            const datesOverlap = touristCheckIn <= accCheckOut && touristCheckOut >= accCheckIn;
                            return datesOverlap;
                          }

                          // If no specific dates on tourist, check if booking dates overlap with accommodation
                          if (booking?.departureDate && booking?.endDate) {
                            const bookingStart = new Date(booking.departureDate);
                            const bookingEnd = new Date(booking.endDate);
                            const datesOverlap = bookingStart <= accCheckOut && bookingEnd >= accCheckIn;
                            return datesOverlap;
                          }

                          // Default: show all tourists
                          return true;
                        });

                        // For second visit to same hotel - only UZ tourists return to Tashkent
                        if (isSecondVisitSameHotel) {
                          accTourists = accTourists.filter(t => {
                            const placement = (t.accommodation || '').toLowerCase();
                            const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
                            return isUzbekistan;
                          });
                          console.log(`⚠️ Second visit to ${acc.hotel?.name} - filtered UZ tourists: ${accTourists.length}`);
                        }

                        // Always show the section, even if empty (for debugging)
                        console.log('🏨 Hotel:', acc.hotel?.name, '- Tourists:', accTourists.length, '/', tourists.length);
                        console.log('   All tourists:', tourists.map(t => ({ name: t.fullName, hotel: t.hotelName, checkIn: t.checkInDate })));

                        const isExpanded = expandedHotels[acc.id];

                        // Use accommodation-specific rooming list if available, otherwise use filtered tourists
                        const accommodationRoomingList = accommodationRoomingLists[acc.id];
                        // IMPORTANT: Only show tourists with room numbers (from rooming list PDF)
                        const touristsToDisplay = (accommodationRoomingList || accTourists).filter(t => t.roomNumber);

                        // Use touristsToDisplay for counting (fixes mismatch between header count and actual list)
                        const displayCount = touristsToDisplay.length;

                        // Sort tourists: UZ group first, then TM group, then by room number
                        const sortedAccTourists = [...touristsToDisplay].sort((a, b) => {
                          // First: group by placement (UZ first, TM second)
                          const accA = (a.accommodation || '').toLowerCase();
                          const accB = (b.accommodation || '').toLowerCase();
                          const isTmA = accA.includes('turkmen') || accA.includes('туркмен');
                          const isTmB = accB.includes('turkmen') || accB.includes('туркмен');

                          // UZ (non-TM) comes first, TM comes after
                          if (!isTmA && isTmB) return -1; // UZ before TM
                          if (isTmA && !isTmB) return 1;  // TM after UZ

                          // Within same group: sort by room number
                          const roomA = a.roomNumber || '';
                          const roomB = b.roomNumber || '';
                          if (roomA !== roomB) return roomA.localeCompare(roomB);
                          return (a.lastName || '').localeCompare(b.lastName || '');
                        });

                        return (
                          <div className="mt-6 pt-6 border-t-2 border-gray-200">
                            {/* Toggle Button */}
                            <button
                              onClick={() => {
                                const willExpand = !expandedHotels[acc.id];
                                setExpandedHotels(prev => ({ ...prev, [acc.id]: willExpand }));
                                // Load accommodation-specific rooming list when expanding
                                if (willExpand && !accommodationRoomingLists[acc.id]) {
                                  loadAccommodationRoomingList(acc.id);
                                }
                              }}
                              className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-50 to-blue-50 hover:from-primary-100 hover:to-blue-100 rounded-xl border-2 border-primary-200 transition-all mb-4 shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <Users className="w-5 h-5 text-primary-600" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-lg font-bold text-gray-900">Rooming List</h3>
                                  <p className="text-sm text-gray-600">{displayCount} {displayCount === 1 ? 'турист' : 'туристов'}</p>
                                </div>
                              </div>
                              <div className={`p-2 bg-white rounded-lg shadow-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-5 h-5 text-primary-600" />
                              </div>
                            </button>

                            {/* Rooming List Content */}
                            {isExpanded && (
                              <div className="space-y-4 animate-in fade-in duration-200">
                                {/* Statistics Cards */}
                                {(() => {
                                  // Calculate statistics from touristsToDisplay (not accTourists)
                                  const totalGuests = touristsToDisplay.length;

                                  // Count unique rooms by type
                                  const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                                  const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };
                                  const touristsWithoutRoom = { DBL: 0, TWN: 0, SNGL: 0 };

                                  touristsToDisplay.forEach(t => {
                                    const roomType = (t.roomPreference || '').toUpperCase();
                                    const roomNum = t.roomNumber;

                                    if (roomType === 'DBL' || roomType === 'DOUBLE') {
                                      if (roomNum && !seenRooms.DBL.has(roomNum)) {
                                        roomCounts.DBL++;
                                        seenRooms.DBL.add(roomNum);
                                      } else if (!roomNum) {
                                        touristsWithoutRoom.DBL++;
                                      }
                                    } else if (roomType === 'TWN' || roomType === 'TWIN') {
                                      if (roomNum && !seenRooms.TWN.has(roomNum)) {
                                        roomCounts.TWN++;
                                        seenRooms.TWN.add(roomNum);
                                      } else if (!roomNum) {
                                        touristsWithoutRoom.TWN++;
                                      }
                                    } else if (roomType === 'SNGL' || roomType === 'SINGLE') {
                                      if (roomNum && !seenRooms.SNGL.has(roomNum)) {
                                        roomCounts.SNGL++;
                                        seenRooms.SNGL.add(roomNum);
                                      } else if (!roomNum) {
                                        touristsWithoutRoom.SNGL++;
                                      }
                                    }
                                  });

                                  // Add tourists without room numbers (DBL/TWN: 2 people = 1 room, SNGL: 1 person = 1 room)
                                  roomCounts.DBL += Math.ceil(touristsWithoutRoom.DBL / 2);
                                  roomCounts.TWN += Math.ceil(touristsWithoutRoom.TWN / 2);
                                  roomCounts.SNGL += touristsWithoutRoom.SNGL;

                                  // Count by placement
                                  const uzbekCount = touristsToDisplay.filter(t => {
                                    const acc = (t.accommodation || '').toLowerCase();
                                    return acc.includes('uzbek') || acc.includes('узбек');
                                  }).length;

                                  const turkmCount = touristsToDisplay.filter(t => {
                                    const acc = (t.accommodation || '').toLowerCase();
                                    return acc.includes('turkmen') || acc.includes('туркмен');
                                  }).length;

                                  return (
                                    <div className="flex items-stretch gap-4 flex-wrap mb-6">
                                      {/* Total Guests Card */}
                                      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                                          <Users className="w-7 h-7 text-primary-600" />
                                        </div>
                                        <div>
                                          <div className="text-xs font-medium text-primary-700 uppercase tracking-wide">Total</div>
                                          <div className="text-3xl font-bold text-gray-900">{totalGuests}</div>
                                          <div className="text-xs text-gray-600">{totalGuests === 1 ? 'guest' : 'guests'}</div>
                                        </div>
                                      </div>

                                      {/* DBL Rooms Card */}
                                      {roomCounts.DBL > 0 && (
                                        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                                          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                                            <Bed className="w-7 h-7 text-blue-600" />
                                          </div>
                                          <div>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                                              DBL
                                            </div>
                                            <div className="text-3xl font-bold text-gray-900">{roomCounts.DBL}</div>
                                            <div className="text-xs text-gray-600">{roomCounts.DBL === 1 ? 'room' : 'rooms'}</div>
                                          </div>
                                        </div>
                                      )}

                                      {/* TWN Rooms Card */}
                                      {roomCounts.TWN > 0 && (
                                        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                                          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                                            <Bed className="w-7 h-7 text-emerald-600" />
                                          </div>
                                          <div>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                                              TWN
                                            </div>
                                            <div className="text-3xl font-bold text-gray-900">{roomCounts.TWN}</div>
                                            <div className="text-xs text-gray-600">{roomCounts.TWN === 1 ? 'room' : 'rooms'}</div>
                                          </div>
                                        </div>
                                      )}

                                      {/* SNGL Rooms Card */}
                                      {roomCounts.SNGL > 0 && (
                                        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                                          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white shadow-sm">
                                            <User className="w-7 h-7 text-violet-600" />
                                          </div>
                                          <div>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500 text-white text-xs font-bold uppercase tracking-wider mb-1">
                                              SNGL
                                            </div>
                                            <div className="text-3xl font-bold text-gray-900">{roomCounts.SNGL}</div>
                                            <div className="text-xs text-gray-600">{roomCounts.SNGL === 1 ? 'room' : 'rooms'}</div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Uzbekistan/Turkmenistan Split Card */}
                                      {uzbekCount > 0 && turkmCount > 0 && (
                                        <div className="flex items-center gap-4 px-5 py-4 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl shadow-sm">
                                          <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-sm" />
                                              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Uzbekistan</span>
                                              <span className="text-lg font-bold text-gray-900">{uzbekCount}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm" />
                                              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Turkmenistan</span>
                                              <span className="text-lg font-bold text-gray-900">{turkmCount}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Header */}
                                <div className="bg-gradient-to-br from-gray-100 via-gray-50 to-white rounded-2xl border-2 border-gray-300 p-5 shadow-lg">
                                  <div className="grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">№</div>
                                    <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Имя</div>
                                    <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Дата заезда</div>
                                    <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Дата выезда</div>
                                    <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Тип</div>
                                    <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Placement</div>
                                    <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Примечание</div>
                                    <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">Actions</div>
                                  </div>
                                </div>

                                {/* Tourist Cards with Room Pairing */}
                                {(() => {
                                  const renderedIds = new Set();
                                  const cards = [];

                                  sortedAccTourists.forEach((tourist, index) => {
                                    if (renderedIds.has(tourist.id)) return;

                                    const roomType = (tourist.roomPreference || '').toUpperCase();
                                    const isDBL = roomType === 'DBL' || roomType === 'DOUBLE';
                                    const isTWN = roomType === 'TWN' || roomType === 'TWIN';
                                    const isSNGL = roomType === 'SNGL' || roomType === 'SINGLE';

                                    const roomBadgeColor = isDBL
                                      ? 'bg-blue-500 text-white'
                                      : isTWN
                                      ? 'bg-emerald-500 text-white'
                                      : isSNGL
                                      ? 'bg-violet-500 text-white'
                                      : 'bg-gray-400 text-white';

                                    // Check if this is part of a room pair
                                    const isRoomPair = (isTWN || isDBL) && tourist.roomNumber;
                                    const roommate = isRoomPair ? sortedAccTourists.find(t =>
                                      t.roomNumber === tourist.roomNumber && t.id !== tourist.id
                                    ) : null;

                                    // Visual grouping for room pairs
                                    let roomPairClasses = 'border-gray-200';
                                    if (roommate) {
                                      const roomPairIndex = parseInt(tourist.roomNumber?.match(/\d+/)?.[0] || 0);
                                      const borderColor = roomPairIndex % 2 === 0 ? 'border-blue-500' : 'border-emerald-500';
                                      const bgColor = roomPairIndex % 2 === 0 ? 'bg-blue-50/30' : 'bg-emerald-50/30';
                                      roomPairClasses = `${borderColor} ${bgColor}`;
                                      renderedIds.add(roommate.id);
                                    }

                                    renderedIds.add(tourist.id);

                                    // Render function for a single tourist row
                                    const renderTouristRow = (t, idx) => {
                                      // Check if this tourist has accommodation-specific override
                                      const hasAccommodationOverride = t.hasAccommodationOverride || false;

                                      // Accommodation default dates
                                      const accCheckIn = new Date(acc.checkInDate);
                                      const accCheckOut = new Date(acc.checkOutDate);

                                      // Check if this is Malika Khorazm hotel and tourist is UZ (stays 2 nights instead of 3)
                                      const hotelName = acc.hotel?.name?.toLowerCase() || '';
                                      const isMalikaKhorazm = hotelName.includes('malika') && hotelName.includes('khorazm');
                                      const isUzTourist = t.accommodation?.toLowerCase().includes('uzbek') || t.accommodation?.toLowerCase() === 'uz';
                                      const isMalikaUzTourist = isMalikaKhorazm && isUzTourist;

                                      // Tourist's individual dates - ONLY use for FIRST accommodation
                                      // For other hotels, use accommodation's standard dates
                                      // For Malika Khorazm UZ tourists - check out 1 day earlier (2 nights instead of 3)
                                      const touristCheckInDate = (isFirstAccommodation && t.checkInDate) ? new Date(t.checkInDate) : accCheckIn;
                                      let touristCheckOutDate;
                                      if (isMalikaUzTourist) {
                                        // UZ tourists leave 1 day earlier at Malika Khorazm
                                        touristCheckOutDate = new Date(accCheckOut);
                                        touristCheckOutDate.setDate(touristCheckOutDate.getDate() - 1);
                                      } else if (isFirstAccommodation && t.checkOutDate) {
                                        // For first accommodation: if tourist checks in early (before accCheckIn),
                                        // they should still check out with the group (at accCheckOut)
                                        const touristCheckInTime = t.checkInDate ? new Date(t.checkInDate).setHours(0,0,0,0) : null;
                                        const accCheckInTime = accCheckIn.getTime();

                                        if (touristCheckInTime && touristCheckInTime < accCheckInTime) {
                                          // Early arrival - check out with group at accommodation checkout
                                          touristCheckOutDate = accCheckOut;
                                        } else {
                                          // Normal arrival - use tourist's checkout date
                                          touristCheckOutDate = new Date(t.checkOutDate);
                                        }
                                      } else {
                                        touristCheckOutDate = accCheckOut;
                                      }

                                      // Check if tourist has different dates than accommodation (extra nights)
                                      // Only highlight for first accommodation
                                      const hasDifferentDates = isFirstAccommodation && (
                                        touristCheckInDate.getTime() !== accCheckIn.getTime() ||
                                        touristCheckOutDate.getTime() !== accCheckOut.getTime()
                                      );

                                      const hasCustomDates = hasAccommodationOverride || hasDifferentDates || isMalikaUzTourist;
                                      const isEditing = editingTouristId === t.id;

                                      return (
                                        <div key={t.id} className={`grid grid-cols-12 gap-4 items-center rounded-xl p-3 ${hasCustomDates ? 'bg-yellow-50 border-2 border-yellow-300' : ''} ${isEditing ? 'bg-primary-50 border-2 border-primary-300' : ''}`}>
                                          {/* Number */}
                                          <div className="col-span-1">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm">
                                              <span className="text-sm font-bold text-gray-700">{idx + 1}</span>
                                            </div>
                                          </div>

                                          {/* Name */}
                                          <div className="col-span-2">
                                            <div className="flex items-center gap-2">
                                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                <User className="w-5 h-5 text-blue-700" />
                                              </div>
                                              <div>
                                                <div className="font-semibold text-gray-900 text-sm leading-tight">
                                                  {t.fullName || `${t.lastName}, ${t.firstName}`}
                                                </div>
                                                {hasAccommodationOverride && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full border border-yellow-300 mt-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                                    </svg>
                                                    Custom
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Check-in Date - Show individual tourist date from Rooming List */}
                                          <div className="col-span-2">
                                            {isEditing ? (
                                              <input
                                                type="date"
                                                value={editForm.checkInDate}
                                                onChange={(e) => setEditForm({...editForm, checkInDate: e.target.value})}
                                                className="w-full px-3 py-2 border border-primary-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                              />
                                            ) : (
                                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hasCustomDates ? 'bg-yellow-100 border border-yellow-400' : 'bg-blue-50 border border-blue-200'}`}>
                                                <span className={`text-xs font-medium ${hasCustomDates ? 'text-yellow-900' : 'text-blue-700'}`}>
                                                  {format(touristCheckInDate, 'dd.MM.yyyy')}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Check-out Date - Show individual tourist date from Rooming List */}
                                          <div className="col-span-2">
                                            {isEditing ? (
                                              <input
                                                type="date"
                                                value={editForm.checkOutDate}
                                                onChange={(e) => setEditForm({...editForm, checkOutDate: e.target.value})}
                                                className="w-full px-3 py-2 border border-primary-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                              />
                                            ) : (
                                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hasCustomDates ? 'bg-yellow-100 border border-yellow-400' : 'bg-red-50 border border-red-200'}`}>
                                                <span className={`text-xs font-medium ${hasCustomDates ? 'text-yellow-900' : 'text-red-700'}`}>
                                                  {format(touristCheckOutDate, 'dd.MM.yyyy')}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Room Type */}
                                          <div className="col-span-1">
                                            {isEditing ? (
                                              <select
                                                value={editForm.roomPreference}
                                                onChange={(e) => setEditForm({...editForm, roomPreference: e.target.value})}
                                                className="w-full px-2 py-2 border border-primary-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                              >
                                                <option value="">-</option>
                                                <option value="DBL">DBL</option>
                                                <option value="TWN">TWN</option>
                                                <option value="SNGL">SNGL</option>
                                                <option value="TRPL">TRPL</option>
                                              </select>
                                            ) : (
                                              <span className={`inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm ${roomBadgeColor}`}>
                                                {t.roomPreference || '-'}
                                              </span>
                                            )}
                                          </div>

                                          {/* Placement */}
                                          <div className="col-span-1">
                                            {isEditing ? (
                                              <select
                                                value={editForm.accommodation}
                                                onChange={(e) => setEditForm({...editForm, accommodation: e.target.value})}
                                                className="w-full px-2 py-2 border border-primary-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                              >
                                                <option value="">-</option>
                                                <option value="Uzbekistan">UZ</option>
                                                <option value="Turkmenistan">TM</option>
                                              </select>
                                            ) : (
                                              <>
                                                {t.accommodation?.toLowerCase().includes('turkmen') ? (
                                                  <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm">
                                                    TM
                                                  </span>
                                                ) : t.accommodation?.toLowerCase().includes('uzbek') ? (
                                                  <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                                                    UZ
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-400 text-center text-xs">-</span>
                                                )}
                                              </>
                                            )}
                                          </div>

                                          {/* Примечание - Show individual dates if different from group */}
                                          <div className="col-span-2">
                                            {(() => {
                                              const notes = [];

                                              // Check if early arrival (tourist arrives before group)
                                              if (touristCheckInDate.getTime() < accCheckIn.getTime()) {
                                                const earlyDate = format(touristCheckInDate, 'dd.MM.yyyy');
                                                notes.push(`Заезд: ${earlyDate}`);
                                              }

                                              // Check if late departure (tourist leaves after group)
                                              if (touristCheckOutDate.getTime() > accCheckOut.getTime()) {
                                                const lateDate = format(touristCheckOutDate, 'dd.MM.yyyy');
                                                notes.push(`Выезд: ${lateDate}`);
                                              }

                                              // Malika Khorazm: UZ tourists stay 2 nights (TM tourists stay 3 nights)
                                              if (isMalikaUzTourist) {
                                                notes.push('2 Nights');
                                              }

                                              return notes.length > 0 ? (
                                                <div className="text-gray-700 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-lg px-3 py-2 shadow-sm">
                                                  <div className="text-xs leading-relaxed font-medium space-y-1">
                                                    {notes.map((note, idx) => (
                                                      <div key={idx}>{note}</div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                              );
                                            })()}
                                          </div>

                                          {/* Actions */}
                                          <div className="col-span-1">
                                            <div className="flex items-center justify-end gap-2">
                                              {isEditing ? (
                                                <>
                                                  {/* Save Button */}
                                                  <button
                                                    onClick={async () => {
                                                      try {
                                                        // Use accommodation-specific API to save dates for this hotel only
                                                        await bookingsApi.updateAccommodationRoomingList(
                                                          booking.id,
                                                          acc.id,
                                                          t.id,
                                                          {
                                                            checkInDate: editForm.checkInDate || null,
                                                            checkOutDate: editForm.checkOutDate || null,
                                                            roomPreference: editForm.roomPreference,
                                                            notes: editForm.remarks
                                                          }
                                                        );
                                                        toast.success('Tourist updated for this hotel');
                                                        setEditingTouristId(null);
                                                        // Reload accommodation-specific rooming list
                                                        await loadAccommodationRoomingList(acc.id);
                                                        // Also reload main data to refresh calculations
                                                        await loadData();
                                                      } catch (error) {
                                                        console.error('Update error:', error);
                                                        toast.error('Error updating tourist');
                                                      }
                                                    }}
                                                    className="p-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all hover:scale-110 shadow-sm"
                                                    title="Save"
                                                  >
                                                    <Save className="w-4 h-4" />
                                                  </button>
                                                  {/* Cancel Button */}
                                                  <button
                                                    onClick={() => {
                                                      setEditingTouristId(null);
                                                      setEditForm({
                                                        checkInDate: '',
                                                        checkOutDate: '',
                                                        roomPreference: '',
                                                        accommodation: '',
                                                        remarks: ''
                                                      });
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all hover:scale-110 shadow-sm"
                                                    title="Cancel"
                                                  >
                                                    <X className="w-4 h-4" />
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  {/* Edit Button */}
                                                  <button
                                                    onClick={() => {
                                                      setEditingTouristId(t.id);
                                                      setEditForm({
                                                        checkInDate: t.checkInDate ? format(new Date(t.checkInDate), 'yyyy-MM-dd') : '',
                                                        checkOutDate: t.checkOutDate ? format(new Date(t.checkOutDate), 'yyyy-MM-dd') : '',
                                                        roomPreference: t.roomPreference || '',
                                                        accommodation: t.accommodation || '',
                                                        remarks: t.remarks || ''
                                                      });
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all hover:scale-110 shadow-sm"
                                                    title="Edit"
                                                  >
                                                    <Edit className="w-4 h-4" />
                                                  </button>
                                                  {/* Delete Button */}
                                                  <button
                                                    onClick={async () => {
                                                      if (window.confirm(`Delete ${t.fullName || t.firstName + ' ' + t.lastName}?`)) {
                                                        try {
                                                          await touristsApi.delete(booking.id, t.id);
                                                          toast.success('Tourist deleted');
                                                          loadData();
                                                        } catch (error) {
                                                          console.error('Delete error:', error);
                                                          toast.error('Error deleting tourist');
                                                        }
                                                      }
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110 shadow-sm"
                                                    title="Delete"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    };

                                    cards.push(
                                      <div
                                        key={`card-${tourist.id}`}
                                        className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 shadow-md hover:shadow-lg transition-all duration-300 p-4 ${roomPairClasses}`}
                                      >
                                        {roommate ? (
                                          // Room pair - 2 tourists in one card
                                          <div className="space-y-3">
                                            {renderTouristRow(tourist, index)}
                                            <div className="border-t-2 border-dashed border-gray-300 pt-3">
                                              {renderTouristRow(roommate, sortedAccTourists.indexOf(roommate))}
                                            </div>
                                          </div>
                                        ) : (
                                          // Single tourist
                                          renderTouristRow(tourist, index)
                                        )}
                                      </div>
                                    );
                                  });

                                  return cards;
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                  })}

                  {/* Summary */}
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl border-2 border-primary-200 shadow-md p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary-700">Всего размещений</div>
                        <div className="text-xs text-primary-600 font-medium">
                          {accommodations.length} {accommodations.length === 1 ? 'отель' : 'отелей'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })()}

              {/* Grand Total - All Hotels (using Final List individual dates) */}
              {grandTotalData && (
                <div className="mt-8 mb-6">
                  {/* Header */}
                  <div className="mb-6 text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 shadow-md">
                      <span className="text-4xl">💰</span>
                      <div className="text-left">
                        <h3 className="text-2xl font-black text-gray-900">Total Price</h3>
                        <p className="text-xs text-gray-600">Barcha hotellar bo'yicha umumiy xarajat</p>
                      </div>
                    </div>
                  </div>

                  {/* Grand Total Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* USD Card */}
                    {grandTotalData.grandTotalUSD > 0 && (
                      <div className="relative bg-white rounded-2xl p-5 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-100/40 to-indigo-100/20 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-500"></div>

                        <div className="relative z-10">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">💵</span>
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Dollar</span>
                              </div>
                              <div className="text-xs text-gray-600 font-medium">
                                {grandTotalData.usdHotels.length} ta hotel
                              </div>
                            </div>
                          </div>

                          {/* Total Amount */}
                          <div className="mb-4">
                            <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                              ${grandTotalData.grandTotalUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>

                          {/* Hotel Breakdown */}
                          {grandTotalData.usdHotels.length > 0 && (
                            <div className="space-y-1 pt-3 border-t border-blue-100">
                              {grandTotalData.usdHotels.map((h, i) => (
                                <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded-lg hover:bg-blue-50 transition-colors">
                                  <span className="text-xs text-gray-700 font-medium truncate max-w-[60%]">{h.hotel}</span>
                                  <span className="text-xs font-bold text-blue-700">${h.USD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* UZS Card */}
                    {grandTotalData.grandTotalUZS > 0 && (
                      <div className="relative bg-white rounded-2xl p-5 border border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-100/40 to-green-100/20 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-500"></div>

                        <div className="relative z-10">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">🇺🇿</span>
                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">O'zbek so'mi</span>
                              </div>
                              <div className="text-xs text-gray-600 font-medium">
                                {grandTotalData.uzsHotels.length} ta hotel
                              </div>
                            </div>
                          </div>

                          {/* Total Amount */}
                          <div className="mb-4">
                            <div className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent leading-tight">
                              {grandTotalData.grandTotalUZS.toLocaleString('ru-RU')}
                              <span className="text-2xl ml-2">so'm</span>
                            </div>
                          </div>

                          {/* Hotel Breakdown */}
                          {grandTotalData.uzsHotels.length > 0 && (
                            <div className="space-y-1 pt-3 border-t border-emerald-100">
                              {grandTotalData.uzsHotels.map((h, i) => (
                                <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded-lg hover:bg-emerald-50 transition-colors">
                                  <span className="text-xs text-gray-700 font-medium truncate max-w-[50%]">{h.hotel}</span>
                                  <span className="text-xs font-bold text-emerald-700">{h.UZS.toLocaleString('ru-RU')} so'm</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {accommodations.length === 0 && bookingRooms.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Bed className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Нет размещения в отелях</p>
                  <button
                    onClick={() => { setEditingAccommodation(null); setAccommodationFormOpen(true); }}
                    className="mt-2 text-primary-600 hover:underline text-sm"
                  >
                    Добавить размещение
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {(isNew || activeTab === 'info') && (
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-amber-100 p-8">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-gradient-to-br from-amber-400/10 to-orange-400/10 rounded-full blur-3xl"></div>

            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <FileText className="w-6 h-6 text-white" />
              </div>
              Notes
            </h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              disabled={!editing}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-50 transition-all duration-200 font-medium"
              placeholder="Additional notes..."
            />
          </div>
          )}
        </div>

        {/* Sidebar - show for Info tab or new booking */}
        {(isNew || activeTab === 'info') && (
        <div className="space-y-6">
          {/* Tourists */}
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-purple-100 p-6">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500"></div>
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl"></div>

            <h2 className="text-xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent mb-5 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Users className="w-5 h-5 text-white" />
              </div>
              Tourists
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Total (Pax)
                  <span className="ml-1 text-xs font-normal text-gray-500">(automatic)</span>
                </label>
                <input
                  type="number"
                  name="pax"
                  value={formData.pax}
                  disabled={true}
                  min="0"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 cursor-not-allowed font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Uzbekistan
                  <span className="ml-1 text-xs font-normal text-gray-500">(from Final List)</span>
                </label>
                <input
                  type="number"
                  name="paxUzbekistan"
                  value={formData.paxUzbekistan}
                  onChange={handleChange}
                  disabled={true}
                  min="0"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 cursor-not-allowed font-bold text-gray-900"
                />
              </div>

              {/* Only show Turkmenistan field for ER tour type */}
              {(() => {
                const selectedTourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
                const tourTypeCode = selectedTourType?.code;
                return tourTypeCode === 'ER' ? (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Turkmenistan
                      <span className="ml-1 text-xs font-normal text-gray-500">(from Final List)</span>
                    </label>
                    <input
                      type="number"
                      name="paxTurkmenistan"
                      value={formData.paxTurkmenistan}
                      onChange={handleChange}
                      disabled={true}
                      min="0"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 cursor-not-allowed font-bold text-gray-900"
                    />
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Rooms - calculated from Rooming List */}
          <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-cyan-100 p-6">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>
            <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-br from-cyan-400/10 to-blue-400/10 rounded-full blur-3xl"></div>

            <h2 className="text-xl font-black bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-5 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Home className="w-5 h-5 text-white" />
              </div>
              Rooms
            </h2>

            {!isNew && tourists.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">DBL</label>
                    <div className="w-full px-3 py-3 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl text-gray-900 font-black text-lg text-center">
                      {calculatedRoomCounts.dbl}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">TWN</label>
                    <div className="w-full px-3 py-3 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl text-gray-900 font-black text-lg text-center">
                      {calculatedRoomCounts.twn}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">SGL</label>
                    <div className="w-full px-3 py-3 bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200 rounded-xl text-gray-900 font-black text-lg text-center">
                      {calculatedRoomCounts.sgl}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Total Rooms
                  </label>
                  <div className="w-full px-4 py-3 bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl text-gray-900 font-black text-xl text-center">
                    {calculatedRoomCounts.total}
                  </div>
                </div>

                <p className="text-xs text-gray-600 font-medium flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-lg">
                  <List className="w-3.5 h-3.5" />
                  Calculated from Rooming List ({tourists.length} tourists)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">DBL</label>
                    <input
                      type="number"
                      name="roomsDbl"
                      value={formData.roomsDbl}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">TWN</label>
                    <input
                      type="number"
                      name="roomsTwn"
                      value={formData.roomsTwn}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">SGL</label>
                    <input
                      type="number"
                      name="roomsSngl"
                      value={formData.roomsSngl}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Total Rooms
                  </label>
                  <input
                    type="number"
                    name="roomsTotal"
                    value={formData.roomsTotal}
                    onChange={handleChange}
                    disabled={!editing}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 font-bold text-center"
                  />
                </div>

                {!isNew && (
                  <p className="text-xs text-gray-600 font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                    Add tourists to Rooming List for automatic calculation
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {/* Room Allocation Modal */}
      {roomModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRoomAlloc ? 'Редактировать размещение' : 'Добавить размещение'}
              </h2>
              <button
                onClick={() => setRoomModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Hotel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Отель *
                </label>
                <select
                  value={roomAllocForm.hotelId}
                  onChange={handleHotelChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Выберите отель</option>
                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name} ({hotel.city?.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates - moved before room type for availability display */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата заезда *
                  </label>
                  <input
                    type="date"
                    value={roomAllocForm.checkInDate}
                    onChange={(e) => handleDateChange('checkInDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата выезда *
                  </label>
                  <input
                    type="date"
                    value={roomAllocForm.checkOutDate}
                    onChange={(e) => handleDateChange('checkOutDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Room Type with availability */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип номера * {loadingAvailability && <span className="text-gray-400 text-xs">(загрузка...)</span>}
                </label>
                <select
                  value={roomAllocForm.roomTypeId}
                  onChange={handleRoomTypeChange}
                  disabled={!selectedHotel}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  <option value="">Выберите тип номера</option>
                  {selectedHotel?.roomTypes?.map((roomType) => {
                    const avail = roomTypeAvailabilities[roomType.id];
                    const availText = avail ? ` [${avail.availableRooms}/${avail.totalRooms} своб.]` : '';
                    const isUnavailable = avail && avail.availableRooms === 0;
                    return (
                      <option
                        key={roomType.id}
                        value={roomType.id}
                        disabled={isUnavailable}
                        className={isUnavailable ? 'text-gray-400' : ''}
                      >
                        {roomType.name} {roomType.displayName ? `(${roomType.displayName})` : ''} - ${roomType.pricePerNight}{availText}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity and Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Кол-во номеров
                  </label>
                  <input
                    type="number"
                    value={roomAllocForm.quantity}
                    onChange={(e) => setRoomAllocForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Цена за ночь ($)
                  </label>
                  <input
                    type="number"
                    value={roomAllocForm.pricePerNight}
                    onChange={(e) => setRoomAllocForm(prev => ({ ...prev, pricePerNight: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Availability check */}
              {roomAllocForm.hotelId && roomAllocForm.roomTypeId && roomAllocForm.checkInDate && roomAllocForm.checkOutDate && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={checkAvailability}
                    className="px-3 py-1.5 text-sm border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50"
                  >
                    Проверить доступность
                  </button>
                  {availability && (
                    <span className={`text-sm ${availability.availableRooms >= roomAllocForm.quantity ? 'text-green-600' : 'text-red-600'}`}>
                      Доступно: {availability.availableRooms} из {availability.totalRooms}
                    </span>
                  )}
                </div>
              )}

              {/* Total calculation */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Расчёт:</span>
                  <span className="text-gray-900">
                    {roomAllocForm.quantity} ном. × {calculateNights()} ноч. × ${roomAllocForm.pricePerNight}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-medium text-gray-700">Итого:</span>
                  <span className="text-lg font-bold text-green-600">
                    ${(roomAllocForm.quantity * calculateNights() * roomAllocForm.pricePerNight).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Примечания
                </label>
                <input
                  type="text"
                  value={roomAllocForm.notes}
                  onChange={(e) => setRoomAllocForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Особые пожелания..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setRoomModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveRoomAlloc}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Edit Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold mb-1">
                      {editingRoute ? 'Edit Route' : 'Add New Route'}
                    </h2>
                    <p className="text-blue-100">Configure transportation details</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRouteModal(false);
                    setEditingRoute(null);
                  }}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:rotate-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-xs font-bold">1</span>
                    Day
                  </label>
                  <input
                    type="text"
                    value={routeForm.nomer}
                    onChange={(e) => setRouteForm({ ...routeForm, nomer: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 transition-all duration-300 text-gray-900 font-medium placeholder-gray-400"
                    placeholder="e.g., 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600 text-xs font-bold">2</span>
                    Date
                  </label>
                  <input
                    type="date"
                    value={routeForm.sana}
                    onChange={(e) => setRouteForm({ ...routeForm, sana: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all duration-300 text-gray-900 font-medium placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-xs font-bold">3</span>
                    City
                  </label>
                  <select
                    value={routeForm.shahar}
                    onChange={(e) => {
                      const newCity = e.target.value;
                      const autoProvider = getProviderByCity(newCity);
                      const providerChanged = autoProvider && autoProvider !== routeForm.choiceTab;
                      const newProvider = autoProvider || routeForm.choiceTab;
                      const autoVehicle = providerChanged ? getBestVehicleForRoute(newProvider, routeForm.person) : routeForm.transportType;
                      setRouteForm({
                        ...routeForm,
                        shahar: newCity,
                        choiceTab: newProvider,
                        transportType: autoVehicle,
                        choiceRate: providerChanged ? '' : routeForm.choiceRate,
                        price: providerChanged ? '' : routeForm.price
                      });
                    }}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-300 text-gray-900 font-medium"
                  >
                    <option value="">Select City</option>
                    <optgroup label="Tashkent (Xayrulla)">
                      <option value="Tashkent">Tashkent</option>
                    </optgroup>
                    <optgroup label="Fergana (Nosir)">
                      <option value="Fergana">Fergana</option>
                    </optgroup>
                    <optgroup label="Other (Sevil)">
                      <option value="Samarkand">Samarkand</option>
                      <option value="Bukhara">Bukhara</option>
                      <option value="Khiva">Khiva</option>
                      <option value="Urgench">Urgench</option>
                      <option value="Asraf">Asraf</option>
                    </optgroup>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs font-bold">4</span>
                    Route Name *
                  </label>
                  <input
                    type="text"
                    value={routeForm.route}
                    onChange={(e) => setRouteForm({ ...routeForm, route: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-300 text-gray-900 font-medium placeholder-gray-400"
                    placeholder="e.g., Tashkent Airport PickUp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-xs font-bold">5</span>
                    Person Count
                  </label>
                  <input
                    type="number"
                    value={routeForm.person}
                    onChange={(e) => {
                      const newPersonCount = e.target.value;
                      // Auto-select best vehicle for new person count
                      const autoVehicle = routeForm.choiceTab ? getBestVehicleForRoute(routeForm.choiceTab, newPersonCount) : '';
                      const vehicleChanged = autoVehicle && autoVehicle !== routeForm.transportType;
                      setRouteForm({
                        ...routeForm,
                        person: newPersonCount,
                        transportType: autoVehicle || routeForm.transportType,
                        choiceRate: vehicleChanged ? '' : routeForm.choiceRate,
                        price: vehicleChanged ? '' : routeForm.price
                      });
                    }}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all duration-300 text-gray-900 font-medium placeholder-gray-400"
                    placeholder="15"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-xs font-bold">6</span>
                    Transport Type
                  </label>
                  <select
                    value={routeForm.transportType}
                    onChange={(e) => {
                      // Clear rate and price when transport type changes
                      setRouteForm({ ...routeForm, transportType: e.target.value, choiceRate: '', price: '' });
                    }}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-300 text-gray-900 font-medium"
                    disabled={!routeForm.choiceTab}
                  >
                    <option value="">{routeForm.choiceTab ? 'Select Vehicle' : 'Select City First'}</option>
                    {routeForm.choiceTab === 'sevil' && sevilVehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.person} pax)</option>
                    ))}
                    {routeForm.choiceTab === 'xayrulla' && xayrullaVehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.person} pax)</option>
                    ))}
                    {routeForm.choiceTab === 'nosir' && nosirVehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.person} pax)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-cyan-100 rounded-lg flex items-center justify-center text-cyan-600 text-xs font-bold">7</span>
                    Provider
                  </label>
                  <select
                    value={routeForm.choiceTab}
                    onChange={(e) => setRouteForm({ ...routeForm, choiceTab: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-cyan-100 focus:border-cyan-500 transition-all duration-300 text-gray-900 font-medium"
                  >
                    <option value="">Select Provider</option>
                    <option value="sevil">Sevil</option>
                    <option value="xayrulla">Xayrulla</option>
                    <option value="nosir">Nosir</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 text-xs font-bold">8</span>
                    Option Rate
                  </label>
                  <select
                    value={routeForm.choiceRate}
                    onChange={(e) => {
                      const selectedRate = e.target.value;
                      // Get price from Opex data
                      const autoPrice = getPriceFromOpex(routeForm.choiceTab, routeForm.transportType, selectedRate);
                      setRouteForm({
                        ...routeForm,
                        choiceRate: selectedRate,
                        price: autoPrice || routeForm.price
                      });
                    }}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-100 focus:border-pink-500 transition-all duration-300 text-gray-900 font-medium"
                    disabled={!routeForm.choiceTab}
                  >
                    <option value="">{routeForm.choiceTab ? 'Select Rate' : 'Select City First'}</option>
                    {routeForm.choiceTab === 'sevil' && (
                      <>
                        <option value="pickupDropoff">Pickup / Drop-off</option>
                        <option value="tagRate">TAG Rate</option>
                        <option value="urgenchRate">Urgench Rate</option>
                        <option value="shovotRate">Shovot Rate</option>
                      </>
                    )}
                    {routeForm.choiceTab === 'xayrulla' && (
                      <>
                        <option value="vstrecha">Pickup / Drop-off</option>
                        <option value="chimgan">Chimgan Rate</option>
                        <option value="tag">Tag Rate</option>
                        <option value="oybek">Oybek Rate</option>
                        <option value="chernyayevka">Chernyayevka Rate</option>
                        <option value="cityTour">City Tour Rate</option>
                      </>
                    )}
                    {routeForm.choiceTab === 'nosir' && (
                      <>
                        <option value="margilan">Margilan Rate</option>
                        <option value="qoqon">Qoqon Rate</option>
                        <option value="dostlik">Dostlik Rate</option>
                        <option value="toshkent">Toshkent Rate</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center text-green-600 text-xs font-bold">9</span>
                    Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">$</span>
                    <input
                      type="text"
                      value={routeForm.price}
                      onChange={(e) => setRouteForm({ ...routeForm, price: e.target.value })}
                      className="w-full pl-10 pr-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all duration-300 text-gray-900 font-bold text-lg placeholder-gray-400"
                      placeholder="50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-8 py-6 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {editingRoute ? 'Update your route information' : 'All fields are optional except Route Name'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRouteModal(false);
                    setEditingRoute(null);
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all duration-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoute}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold flex items-center gap-2"
                >
                  {editingRoute ? (
                    <>
                      <Edit className="w-4 h-4" />
                      Update Route
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Route
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotel Accommodation Form Modal */}
      {accommodationFormOpen && (
        <HotelAccommodationForm
          bookingId={parseInt(id)}
          booking={booking}
          hotels={hotels}
          editingAccommodation={editingAccommodation}
          onSave={() => loadData()}
          onClose={() => { setAccommodationFormOpen(false); setEditingAccommodation(null); }}
        />
      )}
    </div>
  );
}
