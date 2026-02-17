import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi, hotelsApi, touristsApi, routesApi, transportApi, accommodationsApi, flightsApi, railwaysApi, tourServicesApi, invoicesApi, opexApi } from '../services/api';
import { format, addDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ItineraryPreview from '../components/booking/ItineraryPreview';
import { useIsMobile } from '../hooks/useMediaQuery';
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
  ChevronUp,
  ChevronRight,
  Car,
  Database,
  Download,
  Upload,
  Folder,
  FolderOpen,
  CheckCircle2,
  Menu
} from 'lucide-react';
import {
  isFileSystemAccessSupported,
  selectBaseFolder,
  getBaseFolderHandle,
  downloadAndSavePdf
} from '../utils/fileSystemUtils';
import html2pdf from 'html2pdf.js';

// Import booking components
import TouristsList from '../components/booking/TouristsList';
import RoomingList from '../components/booking/RoomingList';
import RoomingListModule from '../components/booking/RoomingListModule';
import CostSummary from '../components/booking/CostSummary';
import HotelAccommodationForm from '../components/booking/HotelAccommodationForm';
import HotellisteDocument from '../components/booking/HotellisteDocument';
import RechnungDocument from '../components/booking/RechnungDocument';
import GutschriftDocument from '../components/booking/GutschriftDocument';

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
// Function to organize flight data from Opex database
const getFlightsFromOpex = (planesData = []) => {
  // Organize flights by type (INTERNATIONAL vs DOMESTIC)
  const flightsByType = {
    INTERNATIONAL: [],
    DOMESTIC: []
  };

  planesData.forEach(plane => {
    const flightType = (plane.type || plane.flightType || '').toUpperCase();
    const isInternational = flightType.includes('INTERNATIONAL') || flightType.includes('XALQARO');
    const isDomestic = flightType.includes('DOMESTIC') || flightType.includes('ICHKI') || flightType.includes("O'ZBEKISTON");

    // CRITICAL: In OPEX, flight number is stored in 'trainNumber' field (shared with trains)
    // name = airline name, trainNumber = flight number (e.g., HY-101, TK-1000)
    const flightData = {
      flightNumber: plane.trainNumber || plane.flightNumber || plane.number || '',
      airline: plane.name || plane.airline || plane.airlineName || 'Unknown Airline',
      route: plane.route || `${plane.departure || ''} - ${plane.arrival || ''}`,
      departure: plane.departure || plane.from || '',
      arrival: plane.arrival || plane.to || '',
      departureTime: plane.departure || '',
      arrivalTime: plane.arrival || ''
    };

    // Only add flights that have a flight number
    if (flightData.flightNumber) {
      if (isInternational) {
        flightsByType.INTERNATIONAL.push(flightData);
      } else if (isDomestic) {
        flightsByType.DOMESTIC.push(flightData);
      } else {
        // Default to DOMESTIC if type not specified
        flightsByType.DOMESTIC.push(flightData);
      }
    }
  });

  console.log('✈️ Organized flights:', {
    INTERNATIONAL: flightsByType.INTERNATIONAL.length,
    DOMESTIC: flightsByType.DOMESTIC.length,
    data: flightsByType
  });
  return flightsByType;
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
  const isMobile = useIsMobile();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew || startEditing);
  const [saving, setSaving] = useState(false);

  // Invoice states for different document types
  const [rechnungInvoice, setRechnungInvoice] = useState(null);
  const [neueRechnungInvoice, setNeueRechnungInvoice] = useState(null);
  const [gutschriftInvoice, setGutschriftInvoice] = useState(null);

  // Sequential numbers for Rechnung module display
  const [rechnungSequentialNumber, setRechnungSequentialNumber] = useState(0);
  const [neueRechnungSequentialNumber, setNeueRechnungSequentialNumber] = useState(0);
  const [gutschriftSequentialNumber, setGutschriftSequentialNumber] = useState(0);

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

  // Initialize sub-tabs from URL parameters
  const getInitialSubTab = (paramKey, defaultValue) => {
    if (isNew) return defaultValue;
    const urlValue = searchParams.get(paramKey);
    return urlValue || defaultValue;
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab());
  const [flyRailwayTab, setFlyRailwayTabState] = useState(() => getInitialSubTab('subTab', 'fly')); // Sub-tab for Fly&Railway module
  const [documentsTab, setDocumentsTabState] = useState(() => getInitialSubTab('docTab', 'tourist-list')); // Sub-tab for Documents module
  const [tourServicesTab, setTourServicesTabState] = useState(() => getInitialSubTab('serviceTab', 'hotels')); // Sub-tab for Tour Services module
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile hamburger menu
  const [costsTab, setCostsTabState] = useState(() => getInitialSubTab('costTab', 'rl')); // Sub-tab for Costs module (payment methods)
  const [flights, setFlights] = useState([]);
  const [flightSections, setFlightSections] = useState([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [planeVehicles, setPlaneVehicles] = useState([]); // Planes from OPEX database
  const [trainVehicles, setTrainVehicles] = useState([]); // Trains from OPEX database
  const [mealsData, setMealsData] = useState([]); // Meals from OPEX database
  const [sightseeingData, setSightseeingData] = useState([]); // Sightseeing from OPEX database
  const [showsData, setShowsData] = useState([]); // Shows from OPEX database
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

  // Tour Services state (Eintritt, Metro, Shou, Other)
  const [tourServices, setTourServices] = useState({ eintritt: [], metro: [], shou: [], other: [] });
  const [loadingTourServices, setLoadingTourServices] = useState(false);
  const [tourServiceModalOpen, setTourServiceModalOpen] = useState(false);
  const [tourServiceType, setTourServiceType] = useState('EINTRITT'); // Current service type being edited
  const [editingTourService, setEditingTourService] = useState(null);
  const [editingEintrittDate, setEditingEintrittDate] = useState(null); // Track which Eintritt row date is being edited
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState([]); // Track hidden template entries
  const [tourServiceForm, setTourServiceForm] = useState({
    name: '',
    city: '',
    date: '',
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
      // Update URL with new tab
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);

      // Add appropriate sub-tab parameter based on main tab
      if (tab === 'fly-railway') {
        params.set('subTab', flyRailwayTab);
      } else if (tab === 'documents') {
        params.set('docTab', documentsTab);
      } else if (tab === 'tour-services') {
        params.set('serviceTab', tourServicesTab);
      } else if (tab === 'costs') {
        params.set('costTab', costsTab);
      }

      navigate(`?${params.toString()}`, { replace: true });
    }
  };

  // Wrapper functions for sub-tabs with URL parameter persistence
  const setFlyRailwayTab = (tab) => {
    setFlyRailwayTabState(tab);
    if (!isNew && activeTab === 'fly-railway') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'fly-railway');
      params.set('subTab', tab);
      navigate(`?${params.toString()}`, { replace: true });
    }
  };

  const setDocumentsTab = (tab) => {
    setDocumentsTabState(tab);
    if (!isNew && activeTab === 'documents') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'documents');
      params.set('docTab', tab);
      navigate(`?${params.toString()}`, { replace: true });
    }
  };

  const setTourServicesTab = (tab) => {
    setTourServicesTabState(tab);
    if (!isNew && activeTab === 'tour-services') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'tour-services');
      params.set('serviceTab', tab);
      navigate(`?${params.toString()}`, { replace: true });
    }
  };

  const setCostsTab = (tab) => {
    setCostsTabState(tab);
    if (!isNew && activeTab === 'costs') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'costs');
      params.set('costTab', tab);
      navigate(`?${params.toString()}`, { replace: true });
    }
  };

  const [tourTypes, setTourTypes] = useState([]);
  const [guides, setGuides] = useState([]);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [guideDays, setGuideDays] = useState({ fullDays: 0, halfDays: 0 });
  const [guideRates, setGuideRates] = useState({ dayRate: 110, halfDayRate: 55 });
  const [guideType, setGuideType] = useState('main'); // 'main', 'second', 'bergreiseleiter'
  const [manualGuideEntry, setManualGuideEntry] = useState(false);
  const [manualGuideName, setManualGuideName] = useState('');
  const [mainGuide, setMainGuide] = useState(null);
  const [secondGuide, setSecondGuide] = useState(null);
  const [bergreiseleiter, setBergreiseleiter] = useState(null);
  const [rlExchangeRate, setRlExchangeRate] = useState(null); // Load from database, default null
  const [hotels, setHotels] = useState([]);
  const [bookingRooms, setBookingRooms] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [openCalculationBreakdowns, setOpenCalculationBreakdowns] = useState({}); // Track which breakdown sections are open
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

  // PDF Auto-save folder configuration
  const [pdfFolderConfigured, setPdfFolderConfigured] = useState(false);
  const [pdfFolderName, setPdfFolderName] = useState('');

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

  // Save RL exchange rate to database when it changes
  useEffect(() => {
    if (id && rlExchangeRate !== null && booking) {
      // Debounce API call to avoid too many requests
      const timeoutId = setTimeout(async () => {
        try {
          await bookingsApi.update(id, { rlExchangeRate });
          console.log('✅ RL exchange rate saved:', rlExchangeRate);
        } catch (error) {
          console.error('Error saving RL exchange rate:', error);
        }
      }, 500); // Wait 500ms after user stops typing

      return () => clearTimeout(timeoutId);
    }
  }, [id, rlExchangeRate, booking]);

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

      // NOTE: Include all tourists (with or without room numbers)
      // Room numbers are optional - tourists added manually won't have them

      // Fallback: filter tourists by hotel name and date overlap if rooming list not loaded
      if (!accTourists || accTourists.length === 0) {
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
  const [sevilErVehicles, setSevilErVehicles] = useState(defaultSevilVehicles);
  const [sevilCoVehicles, setSevilCoVehicles] = useState(defaultSevilVehicles);
  const [sevilKasVehicles, setSevilKasVehicles] = useState(defaultSevilVehicles);
  const [sevilZaVehicles, setSevilZaVehicles] = useState(defaultSevilVehicles);
  const [xayrullaVehicles, setXayrullaVehicles] = useState(defaultXayrullaVehicles);
  const [nosirVehicles, setNosirVehicles] = useState(defaultNosirVehicles);
  const [metroVehicles, setMetroVehicles] = useState([]);

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
      if (grouped['sevil-er']?.length > 0) setSevilErVehicles(grouped['sevil-er']);
      if (grouped['sevil-co']?.length > 0) setSevilCoVehicles(grouped['sevil-co']);
      if (grouped['sevil-kas']?.length > 0) setSevilKasVehicles(grouped['sevil-kas']);
      if (grouped['sevil-za']?.length > 0) setSevilZaVehicles(grouped['sevil-za']);
      if (grouped.xayrulla?.length > 0) setXayrullaVehicles(grouped.xayrulla);
      if (grouped.nosir?.length > 0) setNosirVehicles(grouped.nosir);
      if (grouped.metro?.length > 0) setMetroVehicles(grouped.metro);
      if (grouped.plane?.length > 0) {
        setPlaneVehicles(grouped.plane);
        console.log('✈️ Loaded planes from OPEX:', grouped.plane.length, 'flights');
      }
      if (grouped.train?.length > 0) {
        setTrainVehicles(grouped.train);
        console.log('🚂 Loaded trains from OPEX:', grouped.train.length, 'trains');
      }
    } catch (error) {
      console.error('Error loading vehicle data from API:', error);
      // Keep default values on error
    }
  };

  // Load meals data from OPEX API
  const loadMealsFromApi = async () => {
    if (!booking?.tourType?.code) return;

    try {
      const tourTypeCode = booking.tourType.code.toUpperCase();
      console.log(`🍽️ Loading meals from OPEX database for ${tourTypeCode}...`);

      const response = await opexApi.get(tourTypeCode, 'meal');

      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        setMealsData(response.data.items);
        console.log(`✅ Loaded ${response.data.items.length} meals from OPEX database`);
      } else {
        console.log('⚠️ No meals found in OPEX database');
        setMealsData([]);
      }
    } catch (error) {
      console.error('❌ Error loading meals from OPEX:', error);
      setMealsData([]);
    }
  };

  // Load sightseeing data from OPEX API
  const loadSightseeingFromApi = async () => {
    if (!booking?.tourType?.code) return;

    try {
      const tourTypeCode = booking.tourType.code.toUpperCase();
      console.log(`🎫 Loading sightseeing from OPEX database for ${tourTypeCode}...`);

      const response = await opexApi.get(tourTypeCode, 'sightseeing');

      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        setSightseeingData(response.data.items);
        console.log(`✅ Loaded ${response.data.items.length} sightseeing items from OPEX database`);
      } else {
        console.log('⚠️ No sightseeing found in OPEX database');
        setSightseeingData([]);
      }
    } catch (error) {
      console.error('❌ Error loading sightseeing from OPEX:', error);
      setSightseeingData([]);
    }
  };

  // Load shows data from OPEX API
  const loadShowsFromApi = async () => {
    if (!booking?.tourType?.code) return;

    try {
      const tourTypeCode = booking.tourType.code.toUpperCase();
      console.log(`🎭 Loading shows from OPEX database for ${tourTypeCode}...`);

      const response = await opexApi.get(tourTypeCode, 'shows');

      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        setShowsData(response.data.items);
        console.log(`✅ Loaded ${response.data.items.length} shows from OPEX database`);
      } else {
        console.log('⚠️ No shows found in OPEX database');
        setShowsData([]);
      }
    } catch (error) {
      console.error('❌ Error loading shows from OPEX:', error);
      setShowsData([]);
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

  // Refresh meals data from OPEX API when booking is loaded or updated
  useEffect(() => {
    if (booking?.tourType?.code) {
      loadMealsFromApi();
    }

    // Listen for custom event from Opex page when meals are updated
    const handleMealsUpdated = () => {
      loadMealsFromApi();
    };
    window.addEventListener('opexUpdated', handleMealsUpdated);
    return () => {
      window.removeEventListener('opexUpdated', handleMealsUpdated);
    };
  }, [booking?.tourType?.code]);

  // Refresh sightseeing data from OPEX API when booking is loaded or updated
  useEffect(() => {
    if (booking?.tourType?.code) {
      loadSightseeingFromApi();
    }

    // Listen for custom event from Opex page when sightseeing is updated
    const handleSightseeingUpdated = () => {
      loadSightseeingFromApi();
    };
    window.addEventListener('opexUpdated', handleSightseeingUpdated);
    return () => {
      window.removeEventListener('opexUpdated', handleSightseeingUpdated);
    };
  }, [booking?.tourType?.code]);

  // Refresh shows data from OPEX API when booking is loaded or updated
  useEffect(() => {
    if (booking?.tourType?.code) {
      loadShowsFromApi();
    }

    // Listen for custom event from Opex page when shows are updated
    const handleShowsUpdated = () => {
      loadShowsFromApi();
    };
    window.addEventListener('opexUpdated', handleShowsUpdated);
    return () => {
      window.removeEventListener('opexUpdated', handleShowsUpdated);
    };
  }, [booking?.tourType?.code]);

  // Transform OPEX train data to PREDEFINED_RAILWAYS format for Railway modal
  const transformedTrainVehicles = React.useMemo(() => {
    if (!trainVehicles || trainVehicles.length === 0) {
      return PREDEFINED_RAILWAYS; // Fallback to hardcoded data if no OPEX data
    }

    return trainVehicles.map(train => {
      // Parse route to extract departure and arrival stations
      // Supports: "Tashkent - Samarkand", "Tashkent-Samarkand", "Qoqon_Bukhara"
      const routeParts = (train.route || '').split(/[-_]/).map(s => s.trim()).filter(Boolean);
      const departureStation = routeParts[0] || '';
      const arrivalStation = routeParts[1] || '';

      // Extract train name from full name (e.g., "Afrosiyob764Ф..." → "Afrosiyob")
      const trainNameMatch = (train.name || '').match(/^([A-Za-z]+)/);
      const trainName = trainNameMatch ? trainNameMatch[1] : '';

      // Convert price strings to numbers (e.g., "270 000" → 270000)
      const parsePrice = (priceStr) => {
        if (!priceStr) return 0;
        return parseInt(String(priceStr).replace(/\s/g, ''), 10) || 0;
      };

      return {
        trainNumber: train.trainNumber || '',
        trainName: trainName,
        route: train.route || '',
        departure: departureStation,
        arrival: arrivalStation,
        departureTime: train.departure || '',
        arrivalTime: train.arrival || '',
        priceEconomy: parsePrice(train.economPrice),
        priceBusiness: parsePrice(train.businessPrice)
      };
    });
  }, [trainVehicles]);

  useEffect(() => {
    setDatesInitialized(false); // Reset when booking changes
    loadData();
  }, [id]);

  // Handle URL parameters for tab navigation
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlSubTab = searchParams.get('subTab');
    const urlDocTab = searchParams.get('docTab');
    const urlServiceTab = searchParams.get('serviceTab');
    const urlCostTab = searchParams.get('costTab');

    if (urlTab) {
      setActiveTab(urlTab);
    }

    // Restore sub-tabs from URL parameters
    if (urlSubTab && urlTab === 'fly-railway') {
      setFlyRailwayTabState(urlSubTab);
    }

    if (urlDocTab && urlTab === 'documents') {
      setDocumentsTabState(urlDocTab);
    }

    if (urlServiceTab && urlTab === 'tour-services') {
      setTourServicesTabState(urlServiceTab);
    }

    if (urlCostTab && urlTab === 'costs') {
      setCostsTabState(urlCostTab);
    }
  }, [searchParams]);

  // Load tour services when tab changes
  useEffect(() => {
    if (!isNew && id && activeTab === 'tour-services') {
      const typeMap = {
        'eintritt': 'EINTRITT',
        'metro': 'METRO',
        'shou': 'SHOU',
        'other': 'OTHER'
      };
      const serviceType = typeMap[tourServicesTab];
      if (serviceType) {
        loadTourServices(serviceType);
      }
    }
  }, [tourServicesTab, activeTab, id, isNew]);

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
      // IMPORTANT: Only update dates for NEW routes (from template)
      // DO NOT recalculate dates for routes loaded from database (they have saved dates!)
      const hasRoutesFromDatabase = erRoutes.some(r => r.id);

      if (hasRoutesFromDatabase) {
        // Routes loaded from database - preserve their saved dates!
        console.log('✅ Routes loaded from database, preserving saved dates');
        setDatesInitialized(true);
        return;
      }

      // Only NEW routes from template - calculate dates
      const departureDate = new Date(formData.departureDate);
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
    console.log('🔄 AUTO-UPDATE useEffect triggered');
    console.log('   erRoutes.length:', erRoutes.length);
    console.log('   tourists.length:', tourists.length);

    if (tourists.length > 0 && erRoutes.length > 0) {
      const newPersonCount = tourists.length.toString();
      const departureDate = formData.departureDate ? new Date(formData.departureDate) : null;

      // Log first 5 routes PAX
      console.log('   First 5 routes PAX:', erRoutes.slice(0, 5).map(r => `${r.route}=${r.person}`));

      // IMPORTANT: Check separately for PAX updates and date updates
      // DO NOT mix them - date updates should NOT trigger PAX recalculation!
      const hasMissingPax = erRoutes.some(r => !r.person || r.person === '0' || r.person === 0);
      // Only check dates for NEW routes (without database ID) - preserve saved routes' dates
      const hasWrongDates = departureDate && erRoutes.some((r, idx) => {
        if (r.id) return false; // Skip routes loaded from database - their dates are correct!
        const expectedDate = format(addDays(departureDate, idx + 1), 'yyyy-MM-dd');
        return r.sana !== expectedDate;
      });

      console.log('   hasMissingPax:', hasMissingPax);
      console.log('   hasWrongDates:', hasWrongDates);

      const needsUpdate = hasMissingPax || hasWrongDates;
      console.log('   needsUpdate:', needsUpdate);

      if (needsUpdate) {
        const updatedRoutes = erRoutes.map((route, index) => {
          // Calculate date using dayOffset from route or template
          const template = defaultERRoutesTemplate[index];
          const dayOffset = route.dayOffset ?? template?.dayOffset ?? index;
          const routeDate = departureDate ? format(addDays(departureDate, dayOffset + 1), 'yyyy-MM-dd') : route.sana;

          // CRITICAL: Preserve saved route data (person, vehicle, rate, price, dates)
          // Only update if route is NEW (no saved data)
          const hasSavedPax = route.person && route.person !== '0' && route.person !== 0;
          const hasSavedVehicle = route.transportType && route.transportType !== '';

          // If route has saved PAX, vehicle, AND database ID, preserve EVERYTHING including dates
          // This prevents overwriting manually edited dates that were saved to database
          if (hasSavedPax && hasSavedVehicle && route.id) {
            return route; // Don't touch routes loaded from database!
          }

          // Only for NEW routes without saved data: calculate vehicle and PAX
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

  // Auto-sync Arrival date with Tour Start date (departureDate + 1 day for ER/CO, +4 days for ZA, +14 days for KAS)
  // Updates arrivalDate when departureDate changes
  useEffect(() => {
    if (formData.departureDate) {
      const departureDate = new Date(formData.departureDate);
      const tourTypeCode = booking?.tourType?.code;
      const daysToAdd = tourTypeCode === 'KAS' ? 14 : (tourTypeCode === 'ZA' ? 4 : 1);
      const expectedArrivalDate = addDays(departureDate, daysToAdd);
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
  }, [formData.departureDate, booking?.tourType?.code]);

  // Auto-calculate PAX from tourists (Final List)
  // Count tourists by accommodation (Uzbekistan vs Turkmenistan)
  useEffect(() => {
    if (tourists.length > 0) {
      console.log('🧮 Auto-calculating PAX from', tourists.length, 'tourists');
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

      console.log(`📊 PAX breakdown: Total=${totalCount}, UZB=${uzbekCount}, TKM=${turkmenCount}`);

      // Only update if values have changed
      if (
        parseInt(formData.paxUzbekistan) !== uzbekCount ||
        parseInt(formData.paxTurkmenistan) !== turkmenCount ||
        parseInt(formData.pax) !== totalCount
      ) {
        console.log('✅ Updating formData.pax from', formData.pax, 'to', totalCount);
        setFormData(prev => ({
          ...prev,
          paxUzbekistan: uzbekCount.toString(),
          paxTurkmenistan: turkmenCount.toString(),
          pax: totalCount
        }));
      } else {
        console.log('ℹ️ PAX values unchanged, skipping update');
      }
    }
  }, [tourists]);

  // Auto-populate route PAX when Route tab is opened and PAX is 0
  useEffect(() => {
    if (activeTab === 'route' && erRoutes.length > 0 && tourists.length > 0) {
      // Check if any route has PAX = 0
      const hasZeroPax = erRoutes.some(r => !r.person || r.person === '0');

      if (hasZeroPax) {
        console.log('🔄 Auto-populating route PAX from', tourists.length, 'tourists');
        const totalPax = tourists.length.toString();

        const updatedRoutes = erRoutes.map(route => ({
          ...route,
          person: totalPax
        }));

        setErRoutes(updatedRoutes);
        console.log('✅ Route PAX auto-updated to', totalPax);
      }
    }
  }, [activeTab, erRoutes.length, tourists.length]);

  const loadData = async () => {
    try {
      console.log('📊 BookingDetail loadData called for booking', id);
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
        console.log('📊 Booking loaded:', b.bookingNumber, 'PAX:', b.pax);
        console.log('👥 Tourists loaded:', touristsRes.data.tourists?.length, 'tourists');
        setBooking(b);
        setBookingRooms(b.bookingRooms || []);
        setAccommodations(accommodationsRes.data.accommodations || []);
        setTourists(touristsRes.data.tourists || []);
        setRailways(railwaysRes.data.railways || []);
        // Load RL exchange rate from database
        if (b.rlExchangeRate) {
          setRlExchangeRate(b.rlExchangeRate);
          console.log('💱 RL exchange rate loaded from DB:', b.rlExchangeRate);
        }

        // Load invoices for this booking
        try {
          const invoicesRes = await invoicesApi.getAll({ bookingId: id });
          const invoices = invoicesRes.data.invoices || [];

          // Set invoices by type
          const rechnung = invoices.find(inv => inv.invoiceType === 'Rechnung');
          const neueRechnung = invoices.find(inv => inv.invoiceType === 'Neue Rechnung');
          const gutschrift = invoices.find(inv => inv.invoiceType === 'Gutschrift');

          setRechnungInvoice(rechnung || null);
          setNeueRechnungInvoice(neueRechnung || null);
          setGutschriftInvoice(gutschrift || null);

          // Fetch ALL invoices globally to calculate sequential numbers (matching Rechnung module display)
          const allInvoicesRes = await invoicesApi.getAll({});
          const allInvoices = allInvoicesRes.data.invoices || [];

          // EXACT logic from Rechnung.jsx:
          // Filter: Rechnung/Neue Rechnung + firma selected
          // Sort: by ID ascending (creation order)
          const rechnungTypeInvoices = allInvoices
            .filter(inv =>
              (inv.invoiceType === 'Rechnung' || inv.invoiceType === 'Neue Rechnung') &&
              inv.firma
            )
            .sort((a, b) => a.id - b.id); // Sort by ID (creation order)

          const gutschriftTypeInvoices = allInvoices
            .filter(inv => inv.invoiceType === 'Gutschrift' && inv.firma)
            .sort((a, b) => a.id - b.id);

          // Find index in sorted list (1-based for display)
          const rechnungSeqNumber = rechnung ? rechnungTypeInvoices.findIndex(inv => inv.id === rechnung.id) + 1 : 0;
          const neueRechnungSeqNumber = neueRechnung ? rechnungTypeInvoices.findIndex(inv => inv.id === neueRechnung.id) + 1 : 0;
          const gutschriftSeqNumber = gutschrift ? gutschriftTypeInvoices.findIndex(inv => inv.id === gutschrift.id) + 1 : 0;

          // Store sequential numbers
          setRechnungSequentialNumber(rechnungSeqNumber);
          setNeueRechnungSequentialNumber(neueRechnungSeqNumber);
          setGutschriftSequentialNumber(gutschriftSeqNumber);
        } catch (error) {
          console.error('Error loading invoices:', error);
        }

        // Helper: get current rate from Guide module (overrides saved rate)
        const allGuidesList = guidesRes.data.guides || [];
        const getCurrentGuideRate = (savedGuide) => {
          if (!savedGuide) return { dayRate: 110, halfDayRate: 55 };
          const guideId = typeof savedGuide === 'object' ? savedGuide.id : null;
          const guideName = typeof savedGuide === 'object' ? savedGuide.name : savedGuide;
          const liveGuide = guideId
            ? allGuidesList.find(g => g.id === guideId)
            : allGuidesList.find(g => g.name === guideName);
          return {
            dayRate: liveGuide?.dayRate || (typeof savedGuide === 'object' ? savedGuide.dayRate : null) || 110,
            halfDayRate: liveGuide?.halfDayRate || (typeof savedGuide === 'object' ? savedGuide.halfDayRate : null) || 55
          };
        };

        // Load guide assignment if exists
        // Priority: mainGuideData (JSON) > guide + guideId (database relation)
        if (b.mainGuideData) {
          const rates = getCurrentGuideRate(b.mainGuideData.guide);
          const fullDays = b.mainGuideData.fullDays || 0;
          const halfDays = b.mainGuideData.halfDays || 0;
          setMainGuide({
            ...b.mainGuideData,
            dayRate: rates.dayRate,
            halfDayRate: rates.halfDayRate,
            totalPayment: (fullDays * rates.dayRate) + (halfDays * rates.halfDayRate)
          });
        } else if (b.guide && b.guideId) {
          const rates = getCurrentGuideRate(b.guide);
          const dayRate = rates.dayRate;
          const halfDayRate = rates.halfDayRate;
          // Auto-calculate days based on tour type
          let defaultFullDays = 0;
          let defaultHalfDays = 0;
          if (b.tourType?.code === 'ER' || b.tourType?.code === 'CO') {
            defaultFullDays = 12;
            defaultHalfDays = 1;
          } else if (b.tourType?.code === 'ZA') {
            defaultFullDays = 5;
            defaultHalfDays = 1;
          } else if (b.tourType?.code === 'KAS') {
            defaultFullDays = 7;
            defaultHalfDays = 0;
          }
          const fullDays = b.guideFullDays || defaultFullDays;
          const halfDays = b.guideHalfDays || defaultHalfDays;
          const totalPayment = (fullDays * dayRate) + (halfDays * halfDayRate);

          setMainGuide({
            guide: b.guide,
            fullDays: fullDays,
            halfDays: halfDays,
            dayRate: dayRate,
            halfDayRate: halfDayRate,
            totalPayment: totalPayment
          });
        } else if (b.tourType?.code === 'ER') {
          // For ER tours without a guide, show default values
          // This will automatically display when the Guide tab is opened
          // User can edit or remove if needed
        }

        // Load additional guides (second guide) from additionalGuides JSON field
        if (b.additionalGuides && b.additionalGuides.length > 0) {
          // Load the first additional guide as second guide
          const secondGuideData = b.additionalGuides[0];
          if (secondGuideData) {
            const rates = getCurrentGuideRate(secondGuideData.guide);
            const fullDays = secondGuideData.fullDays || 0;
            const halfDays = secondGuideData.halfDays || 0;
            setSecondGuide({
              guide: secondGuideData.guide,
              fullDays,
              halfDays,
              dayRate: rates.dayRate,
              halfDayRate: rates.halfDayRate,
              totalPayment: (fullDays * rates.dayRate) + (halfDays * rates.halfDayRate)
            });
          }
        } else if (b.tourType?.code === 'ZA' || b.tourType?.code === 'KAS') {
          // For ZA and KAS tours without second guide, auto-select Feruz (1 full day)
          const feruzGuide = guidesRes.data.guides.find(g => g.name === 'Feruz' || g.name === 'Феруз');
          const feruzDayRate = feruzGuide?.dayRate || 110;
          const feruzHalfDayRate = feruzGuide?.halfDayRate || Math.round(feruzDayRate / 2);
          setSecondGuide({
            guide: feruzGuide || null,
            fullDays: 1,
            halfDays: 0,
            dayRate: feruzDayRate,
            halfDayRate: feruzHalfDayRate,
            totalPayment: feruzDayRate
          });
        }

        // Load bergreiseleiter from bergreiseleiter JSON field
        if (b.bergreiseleiter) {
          const rates = getCurrentGuideRate(b.bergreiseleiter.guide);
          const fullDays = b.bergreiseleiter.fullDays || 0;
          const halfDays = b.bergreiseleiter.halfDays || 0;
          setBergreiseleiter({
            guide: b.bergreiseleiter.guide,
            fullDays,
            halfDays,
            dayRate: rates.dayRate,
            halfDayRate: rates.halfDayRate,
            totalPayment: (fullDays * rates.dayRate) + (halfDays * rates.halfDayRate)
          });
        }

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

        // Use database routes if available (for ALL tour types including ER!)
        // Only load from template if no routes exist
        if (loadedRoutes.length > 0) {
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
          console.log('🔍 PAGE LOAD: Loading routes from database');
          console.log('📊 Total routes:', routesToProcess.length, 'Total PAX:', totalPax);

          const mappedRoutes = routesToProcess.map((r, index) => {
            const provider = r.provider || '';
            // IMPORTANT: Use saved personCount from database (for UZB/TKM splits)
            // Only fallback to totalPax if no saved personCount exists
            const personCount = r.personCount?.toString() || (totalPax > 0 ? totalPax.toString() : '');
            const paxNum = parseInt(personCount) || 0;

            console.log(`\n Route ${index + 1}: ${r.routeName || 'unnamed'}`);
            console.log(`  DB: transportType="${r.transportType || 'NULL'}", provider="${r.provider || 'NULL'}", price=${r.price || 0}`);

            // IMPORTANT: Check if route has saved transportType
            // If transportType exists and valid, use it directly (don't recalculate!)
            const hasSavedVehicle = r.transportType &&
                                    r.transportType !== '' &&
                                    r.transportType !== 'Select' &&
                                    r.transportType !== null;

            console.log(`  hasSavedVehicle = ${hasSavedVehicle}`);

            let transportType, finalProvider, finalRateType, finalPrice;

            if (hasSavedVehicle) {
              // Route has saved vehicle - use ALL saved data directly!
              transportType = r.transportType;
              finalProvider = provider || r.provider;
              finalRateType = r.optionRate || '';
              finalPrice = r.price?.toString() || '';
              console.log(`✅ Route ${index + 1}: Using saved vehicle - ${r.routeName}`);
              console.log(`   DB: transportType="${r.transportType}", optionRate="${r.optionRate || 'NULL'}", price=${r.price}`);
              console.log(`   UI: vehicle="${transportType}", rate="${finalRateType}", price=$${finalPrice}`);
            } else {
              // Route has no saved vehicle - calculate it
              console.log(`🔧 Route ${index + 1}: No saved vehicle, calculating - ${r.routeName} (DB transportType: "${r.transportType || 'NULL'}"))`);
              const vehicles = getVehicles(provider);
              const bestVehicle = findVehicle(vehicles, personCount, provider);

              // Special handling for Chimgan routes: ALWAYS use Sprinter
              const isChimganRoute = r.routeName === 'Tashkent - Chimgan' || r.routeName === 'Tashkent - Chimgan - Tashkent' || r.routeName === 'Chimgan Excursion';

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

            const tourTypeCode = b.tourType?.code;
            const daysToAdd = tourTypeCode === 'KAS' ? 14 : 1;
            const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, daysToAdd) : null;
            // IMPORTANT: Prioritize saved date from database over calculated date
            // This preserves manually edited dates after save
            const routeDate = r.date
              ? format(new Date(r.date), 'yyyy-MM-dd')
              : (arrivalDate ? format(addDays(arrivalDate, dayOffset), 'yyyy-MM-dd') : '');

            return {
              id: r.id,
              nomer: r.dayNumber?.toString() || '',
              sana: routeDate,
              dayOffset: dayOffset,
              shahar: r.city || '',
              sayohatDasturi: r.itinerary || '',  // Load itinerary for Marshrut varaqasi
              route: r.routeName || '',
              person: personCount,
              transportType: r.transportType || '',  // DIRECT from database!
              choiceTab: r.provider || '',           // DIRECT from database!
              choiceRate: r.optionRate || '',        // DIRECT from database!
              price: r.price?.toString() || ''       // DIRECT from database!
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
                const tourTypeCode = b.tourType?.code;
                const daysToAdd = tourTypeCode === 'KAS' ? 14 : 1;
                const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, daysToAdd) : null;
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
              const tourTypeCode = b.tourType?.code;
              const daysToAdd = tourTypeCode === 'KAS' ? 14 : 1;
              const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, daysToAdd) : null;
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

            const tourTypeCode = b.tourType?.code;
            const daysToAdd = tourTypeCode === 'KAS' ? 14 : 1;
            const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, daysToAdd) : null;
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

        // Calculate arrivalDate: +1 day for ER/CO, +14 days for KAS
        const departureDateStr = b.departureDate ? format(new Date(b.departureDate), 'yyyy-MM-dd') : '';
        const tourTypeCode = b.tourType?.code;
        const daysToAdd = tourTypeCode === 'KAS' ? 14 : 1;
        const arrivalDateStr = b.departureDate ? format(addDays(new Date(b.departureDate), daysToAdd), 'yyyy-MM-dd') : '';

        // Auto-set country to Germany for all tours if not set
        const autoCountry = !b.country ? 'Germany' : b.country;

        setFormData({
          bookingNumber: b.bookingNumber,
          tourTypeId: b.tourTypeId?.toString() || '',
          country: autoCountry,
          departureDate: departureDateStr,
          arrivalDate: arrivalDateStr, // +1 day for ER/CO, +14 days for KAS
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

  // Check if PDF folder is configured
  useEffect(() => {
    const checkFolderConfiguration = async () => {
      if (!isFileSystemAccessSupported()) {
        return; // API not supported
      }

      try {
        const handle = await getBaseFolderHandle();
        if (handle) {
          setPdfFolderConfigured(true);
          setPdfFolderName(handle.name);
        }
      } catch (error) {
        console.error('Error checking folder configuration:', error);
      }
    };

    checkFolderConfiguration();
  }, []);

  // Configure PDF auto-save folder
  const handleConfigurePdfFolder = async () => {
    try {
      const result = await selectBaseFolder();

      if (result.success) {
        setPdfFolderConfigured(true);
        setPdfFolderName(result.folderName);
        toast.success(`Papka tanlandi: ${result.folderName}`);
      } else if (result.error && !result.error.includes('cancelled')) {
        toast.error(`Xatolik: ${result.error}`);
      }
    } catch (error) {
      console.error('Error configuring folder:', error);
      toast.error('Papka tanlashda xatolik');
    }
  };

  // Download PDF and auto-save to folder
  const handleDownloadPdfWithAutoSave = async (hotelId, accommodationId, hotelName, isCombined) => {
    try {
      // Determine preview URL
      const previewUrl = isCombined
        ? bookingsApi.getHotelRequestCombined(id, hotelId)
        : bookingsApi.getHotelRequestPreview(id, accommodationId);

      // Open in new window for printing (traditional behavior)
      const printWindow = window.open(previewUrl, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        });
      }

      // Auto-save to folder if configured
      if (pdfFolderConfigured && booking?.tourType?.code && booking?.bookingNumber) {
        toast.loading('Papkaga saqlanmoqda...', { id: 'pdf-save' });

        const result = await downloadAndSavePdf({
          url: previewUrl,
          tourType: booking.tourType.code,
          bookingNumber: booking.bookingNumber,
          hotelName: hotelName,
          isCombined
        });

        if (result.success) {
          toast.success(`✓ Saqlandi: ${result.path}`, { id: 'pdf-save', duration: 4000 });
        } else {
          toast.error(`Xatolik: ${result.error}`, { id: 'pdf-save' });
        }
      }

    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('PDF yuklanmadi');
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

  // Helper function to calculate PAX based on tour type, flight type, and route
  const calculateFlightPax = (flightType, route = '') => {
    console.log('✈️ CALCULATING FLIGHT PAX:', { tourType: booking?.tourType, flightType, route, totalTourists: tourists.length });

    // For ER tours: distinguish between UZ and TM tourists
    // Check tourType.code since tourType is an object {id, code, name}
    if (booking?.tourType?.code === 'ER') {
      // Calculate UZ and TM tourist counts
      const uzbekistanTourists = tourists.filter(t => {
        const acc = (t.accommodation || '').toLowerCase();
        return !acc.includes('turkmen') && !acc.includes('туркмен');
      });
      const uzCount = uzbekistanTourists.length;
      const totalCount = tourists.length;

      if (flightType === 'DOMESTIC') {
        // DOMESTIC flights: only UZ tourists fly (TM tourists don't fly domestic routes)
        console.log(`✅ ER + DOMESTIC → UZ tourists only: ${uzCount} PAX`);
        return uzCount;
      } else if (flightType === 'INTERNATIONAL') {
        // Check if it's Tashkent-Istanbul (return flight) - only UZ fly
        const routeLower = route.toLowerCase();
        const isTashkentToIstanbul =
          routeLower.includes('tashkent-istanbul') ||
          routeLower.includes('tas-ist') ||
          routeLower.includes('ташкент-стамбул');

        if (isTashkentToIstanbul) {
          // Tashkent → Istanbul (return): only UZ tourists fly
          console.log(`✅ ER + INTERNATIONAL (TAS→IST return) → UZ tourists only: ${uzCount} PAX`);
          return uzCount;
        } else {
          // Istanbul → Tashkent (arrival): all tourists fly (both UZ and TM)
          console.log(`✅ ER + INTERNATIONAL (IST→TAS arrival) → All tourists: ${totalCount} PAX`);
          return totalCount;
        }
      }
    }

    // For non-ER tours or fallback
    const pax = booking?.pax || tourists.length || 0;
    console.log(`✅ Non-ER tour or fallback: ${pax} PAX`);
    return pax;
  };

  // Handle flight PDF import
  // Open flight modal for adding new flight
  const openFlightModal = () => {
    setEditingFlight(null);
    const initialPax = calculateFlightPax('INTERNATIONAL', ''); // Default to INTERNATIONAL, no route yet
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
      pax: initialPax,
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

  // ===================== TOUR SERVICES FUNCTIONS =====================

  // Load tour services by type
  const loadTourServices = async (type) => {
    if (!id || isNew) return;

    try {
      setLoadingTourServices(true);
      const res = await tourServicesApi.getAll(id, type);
      const servicesData = Array.isArray(res.data?.services) ? res.data.services : [];

      setTourServices(prev => ({
        ...prev,
        [type.toLowerCase()]: servicesData
      }));
      console.log(`✅ Loaded ${type} services:`, servicesData.length);
    } catch (error) {
      console.error(`Error loading ${type} services:`, error);
      toast.error('Xizmatlarni yuklashda xatolik');
    } finally {
      setLoadingTourServices(false);
    }
  };

  // Open tour service modal
  const openTourServiceModal = (type) => {
    setTourServiceType(type);
    setEditingTourService(null);
    setTourServiceForm({
      name: '',
      city: '',
      date: '',
      pricePerPerson: 0,
      pax: booking?.pax || 0,
      price: 0,
      notes: ''
    });
    setTourServiceModalOpen(true);
  };

  // Edit tour service
  const editTourService = (service) => {
    setTourServiceType(service.type);
    setEditingTourService(service);

    const pax = service.pax || 0;
    const totalPrice = service.price || 0;
    const pricePerPerson = pax > 0 ? totalPrice / pax : service.pricePerPerson || 0;

    setTourServiceForm({
      name: service.name || '',
      city: service.city || '',
      date: service.date ? format(new Date(service.date), 'yyyy-MM-dd') : '',
      pricePerPerson: pricePerPerson,
      pax: pax,
      price: totalPrice,
      notes: service.notes || ''
    });
    setTourServiceModalOpen(true);
  };

  // Save tour service
  const saveTourService = async (e) => {
    e.preventDefault();
    if (!id) return;

    try {
      const data = {
        type: tourServiceType,
        name: tourServiceForm.name,
        city: tourServiceForm.city || null,
        date: tourServiceForm.date || null,
        pricePerPerson: parseFloat(tourServiceForm.pricePerPerson) || 0,
        pax: parseInt(tourServiceForm.pax) || 0,
        notes: tourServiceForm.notes || null
      };

      if (editingTourService) {
        await tourServicesApi.update(id, editingTourService.id, data);
        toast.success('Xizmat yangilandi');
      } else {
        await tourServicesApi.create(id, data);
        toast.success('Xizmat qo\'shildi');
      }

      setTourServiceModalOpen(false);
      await loadTourServices(tourServiceType);
    } catch (error) {
      console.error('Error saving tour service:', error);
      toast.error(error.response?.data?.error || 'Xizmatni saqlashda xatolik');
    }
  };

  // Delete tour service
  const deleteTourService = async (serviceId, type) => {
    if (!id) return;

    if (!window.confirm('Xizmatni o\'chirmoqchimisiz?')) {
      return;
    }

    try {
      await tourServicesApi.delete(id, serviceId);
      toast.success('Xizmat o\'chirildi');
      await loadTourServices(type);
    } catch (error) {
      console.error('Error deleting tour service:', error);
      toast.error(error.response?.data?.error || 'Xizmatni o\'chirishda xatolik');
    }
  };

  // Update Eintritt date
  const updateEintrittDate = async (item, newDate) => {
    if (!id) return;

    try {
      // Check if this is a template entry (from Opex) or saved entry
      const isTemplate = item.isTemplate && item.id.startsWith('opex-');

      const data = {
        type: 'EINTRITT',
        name: item.name,
        date: newDate || null,
        pricePerPerson: item.pricePerPerson || 0,
        pax: item.pax || 0,
        notes: item.city ? `City: ${item.city}` : null
      };

      if (isTemplate) {
        // Create new entry in database
        await tourServicesApi.create(id, data);
        toast.success('Sana saqlandi');
      } else {
        // Update existing entry
        const actualId = parseInt(item.id);
        await tourServicesApi.update(id, actualId, data);
        toast.success('Sana yangilandi');
      }

      await loadTourServices('EINTRITT');
      setEditingEintrittDate(null);
    } catch (error) {
      console.error('Error updating Eintritt date:', error);
      toast.error(error.response?.data?.error || 'Sanani saqlashda xatolik');
    }
  };

  // Delete Eintritt entry
  const deleteEintrittEntry = async (item) => {
    if (!id) return;

    if (!window.confirm(`"${item.name}" yozuvini o'chirmoqchimisiz?`)) {
      return;
    }

    try {
      if (item.isTemplate) {
        // For template entries, just hide them from view
        setHiddenTemplateIds(prev => [...prev, item.id]);
        toast.success('Yozuv yashirildi');
      } else {
        // For saved entries, delete from database
        await tourServicesApi.delete(id, item.id);
        toast.success('Yozuv o\'chirildi');
        await loadTourServices('EINTRITT');
      }
    } catch (error) {
      console.error('Error deleting Eintritt entry:', error);
      toast.error(error.response?.data?.error || 'O\'chirishda xatolik');
    }
  };

  // Move Eintritt entry up/down
  const moveEintrittEntry = async (item, direction) => {
    if (!id) return;

    try {
      // If template, auto-save it first, then user needs to click again to move
      if (item.isTemplate) {
        const data = {
          type: 'EINTRITT',
          name: item.name,
          date: item.date || null,
          pricePerPerson: item.pricePerPerson || 0,
          pax: item.pax || 0,
          notes: item.city ? `City: ${item.city}` : null
        };
        await tourServicesApi.create(id, data);
        await loadTourServices('EINTRITT');
        toast.success('Yozuv saqlandi. Yana bosing tartibni o\'zgartirish uchun');
        return;
      }

      const services = tourServices.eintritt || [];
      const currentIndex = services.findIndex(s => s.id === item.id);

      if (currentIndex === -1) {
        console.error('Entry not found in services:', item.id);
        return;
      }

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (newIndex < 0 || newIndex >= services.length) {
        console.log('Cannot move beyond bounds');
        return;
      }

      console.log('Moving entry:', currentIndex, '->', newIndex);

      // Swap sortOrder values
      const currentSortOrder = services[currentIndex].sortOrder || currentIndex;
      const targetSortOrder = services[newIndex].sortOrder || newIndex;

      // Update with only the necessary fields
      await tourServicesApi.update(id, services[currentIndex].id, {
        type: 'EINTRITT',
        name: services[currentIndex].name,
        date: services[currentIndex].date,
        pricePerPerson: services[currentIndex].pricePerPerson,
        pax: services[currentIndex].pax,
        notes: services[currentIndex].notes,
        sortOrder: targetSortOrder
      });

      await tourServicesApi.update(id, services[newIndex].id, {
        type: 'EINTRITT',
        name: services[newIndex].name,
        date: services[newIndex].date,
        pricePerPerson: services[newIndex].pricePerPerson,
        pax: services[newIndex].pax,
        notes: services[newIndex].notes,
        sortOrder: currentSortOrder
      });

      await loadTourServices('EINTRITT');
      toast.success('Tartib o\'zgartirildi');
    } catch (error) {
      console.error('Error moving Eintritt entry:', error);
      toast.error(error.response?.data?.error || 'Tartibni o\'zgartirishda xatolik');
    }
  };

  // Move tour service entry up/down (generic for Metro, Shou, Other)
  const moveTourService = async (item, direction, type) => {
    if (!id) return;

    try {
      const typeKey = type.toLowerCase();
      const services = tourServices[typeKey] || [];
      const currentIndex = services.findIndex(s => s.id === item.id);

      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (newIndex < 0 || newIndex >= services.length) return;

      // Swap sortOrder values
      const currentSortOrder = services[currentIndex].sortOrder || currentIndex;
      const targetSortOrder = services[newIndex].sortOrder || newIndex;

      await tourServicesApi.update(id, services[currentIndex].id, {
        ...services[currentIndex],
        sortOrder: targetSortOrder
      });

      await tourServicesApi.update(id, services[newIndex].id, {
        ...services[newIndex],
        sortOrder: currentSortOrder
      });

      await loadTourServices(type);
      toast.success('Tartib o\'zgartirildi');
    } catch (error) {
      console.error(`Error moving ${type} entry:`, error);
      toast.error(error.response?.data?.error || 'Tartibni o\'zgartirishda xatolik');
    }
  };

  // ===================== END TOUR SERVICES FUNCTIONS =====================

  // ===================== GUIDE FUNCTIONS =====================

  // Open guide modal for specific guide type
  const openGuideModal = (type = 'main') => {
    setGuideType(type);

    // Set defaults based on type and existing data
    if (type === 'main' && mainGuide) {
      // Check if it's a manual entry
      if (mainGuide.guide && typeof mainGuide.guide === 'string') {
        setManualGuideEntry(true);
        setManualGuideName(mainGuide.guide);
        setSelectedGuide(null);
      } else {
        setManualGuideEntry(false);
        setSelectedGuide(mainGuide.guide);
        setManualGuideName('');
      }
      setGuideDays({ fullDays: mainGuide.fullDays, halfDays: mainGuide.halfDays });
      setGuideRates({ dayRate: mainGuide.dayRate, halfDayRate: mainGuide.halfDayRate });
    } else if (type === 'second' && secondGuide) {
      if (secondGuide.guide && typeof secondGuide.guide === 'string') {
        setManualGuideEntry(true);
        setManualGuideName(secondGuide.guide);
        setSelectedGuide(null);
      } else {
        setManualGuideEntry(false);
        setSelectedGuide(secondGuide.guide);
        setManualGuideName('');
      }
      setGuideDays({ fullDays: secondGuide.fullDays, halfDays: secondGuide.halfDays });
      setGuideRates({ dayRate: secondGuide.dayRate, halfDayRate: secondGuide.halfDayRate });
    } else if (type === 'bergreiseleiter' && bergreiseleiter) {
      if (bergreiseleiter.guide && typeof bergreiseleiter.guide === 'string') {
        setManualGuideEntry(true);
        setManualGuideName(bergreiseleiter.guide);
        setSelectedGuide(null);
      } else {
        setManualGuideEntry(false);
        setSelectedGuide(bergreiseleiter.guide);
        setManualGuideName('');
      }
      setGuideDays({ fullDays: bergreiseleiter.fullDays, halfDays: bergreiseleiter.halfDays });
      setGuideRates({ dayRate: bergreiseleiter.dayRate, halfDayRate: bergreiseleiter.halfDayRate });
    } else {
      // New guide - set defaults
      setManualGuideEntry(false);
      setManualGuideName('');

      // Auto-select Feruz for ZA/KAS second guide and use their actual rates from DB
      if (type === 'second' && (booking?.tourType?.code === 'ZA' || booking?.tourType?.code === 'KAS')) {
        const feruzGuide = guides.find(g => g.name === 'Feruz' || g.name === 'Феруз');
        setSelectedGuide(feruzGuide || null);
        const feruzDayRate = feruzGuide?.dayRate || 110;
        const feruzHalfDayRate = feruzGuide?.halfDayRate || Math.round(feruzDayRate / 2);
        setGuideRates({ dayRate: feruzDayRate, halfDayRate: feruzHalfDayRate });
      } else {
        setSelectedGuide(null);
        setGuideRates({ dayRate: 110, halfDayRate: 55 });
      }

      if (type === 'main') {
        if (booking?.tourType?.code === 'ER' || booking?.tourType?.code === 'CO') {
          setGuideDays({ fullDays: 12, halfDays: 1 });
        } else if (booking?.tourType?.code === 'ZA') {
          setGuideDays({ fullDays: 5, halfDays: 1 });
        } else if (booking?.tourType?.code === 'KAS') {
          setGuideDays({ fullDays: 7, halfDays: 0 });
        } else {
          setGuideDays({ fullDays: 0, halfDays: 0 });
        }
      } else {
        // For second guide in ZA/KAS tours, default to 1 full day
        if (type === 'second' && (booking?.tourType?.code === 'ZA' || booking?.tourType?.code === 'KAS')) {
          setGuideDays({ fullDays: 1, halfDays: 0 });
        } else {
          setGuideDays({ fullDays: 0, halfDays: 0 });
        }
      }
    }

    setGuideModalOpen(true);
  };

  // Save guide assignment
  const saveGuideAssignment = async () => {
    // Validate guide selection or manual entry
    if (!manualGuideEntry && !selectedGuide) {
      toast.error('Please select a guide or enter manually');
      return;
    }

    if (manualGuideEntry && !manualGuideName.trim()) {
      toast.error('Please enter guide name');
      return;
    }

    if (guideDays.fullDays <= 0 && guideDays.halfDays <= 0) {
      toast.error('Please enter working days');
      return;
    }

    const totalPayment =
      (parseFloat(guideDays.fullDays) || 0) * (parseFloat(guideRates.dayRate) ?? 110) +
      (parseFloat(guideDays.halfDays) || 0) * (parseFloat(guideRates.halfDayRate) ?? 55);

    const guideData = {
      guide: manualGuideEntry ? manualGuideName.trim() : selectedGuide,
      fullDays: parseFloat(guideDays.fullDays) || 0,
      halfDays: parseFloat(guideDays.halfDays) || 0,
      dayRate: parseFloat(guideRates.dayRate) ?? 110,
      halfDayRate: parseFloat(guideRates.halfDayRate) ?? 55,
      totalPayment: totalPayment
    };

    // Set the appropriate guide based on type
    if (guideType === 'main') {
      setMainGuide(guideData);

      // Save main guide to database
      try {
        await bookingsApi.update(id, {
          guideId: manualGuideEntry ? null : selectedGuide,
          guideFullDays: parseFloat(guideDays.fullDays) || 0,
          guideHalfDays: parseFloat(guideDays.halfDays) || 0,
          mainGuideData: guideData
        });
        toast.success('Main guide assigned successfully');
      } catch (error) {
        console.error('Error saving main guide:', error);
        toast.error('Failed to save main guide');
      }
    } else if (guideType === 'second') {
      // When adding second guide, automatically adjust main guide's days
      if (mainGuide) {
        const totalERDays = 12.5; // 12 full days + 1 half day for ER tours
        const secondGuideTotalDays = guideData.fullDays + (guideData.halfDays * 0.5);
        const remainingDays = totalERDays - secondGuideTotalDays;

        // Split remaining days into full and half days
        const newMainFullDays = Math.floor(remainingDays);
        const newMainHalfDays = (remainingDays % 1) > 0 ? 1 : 0;

        const newMainPayment =
          (newMainFullDays * mainGuide.dayRate) +
          (newMainHalfDays * mainGuide.halfDayRate);

        setMainGuide({
          ...mainGuide,
          fullDays: newMainFullDays,
          halfDays: newMainHalfDays,
          totalPayment: newMainPayment
        });
      }

      setSecondGuide(guideData);

      // Save second guide to database
      try {
        await bookingsApi.update(id, {
          additionalGuides: [guideData]
        });
        toast.success('Second guide assigned successfully');
      } catch (error) {
        console.error('Error saving second guide:', error);
        toast.error('Failed to save second guide');
      }
    } else if (guideType === 'bergreiseleiter') {
      setBergreiseleiter(guideData);

      // Save bergreiseleiter to database
      try {
        await bookingsApi.update(id, {
          bergreiseleiter: guideData
        });
        toast.success('Bergreiseleiter assigned successfully');
      } catch (error) {
        console.error('Error saving bergreiseleiter:', error);
        toast.error('Failed to save bergreiseleiter');
      }
    }

    setGuideModalOpen(false);
  };

  // Remove guide by type
  const removeGuide = async (type) => {
    if (type === 'main') {
      setMainGuide(null);

      // Remove main guide from database
      try {
        await bookingsApi.update(id, {
          guideId: null,
          guideFullDays: 0,
          guideHalfDays: 0,
          mainGuideData: null
        });
        toast.success('Main guide removed');
      } catch (error) {
        console.error('Error removing main guide:', error);
        toast.error('Failed to remove main guide');
      }
    } else if (type === 'second') {
      setSecondGuide(null);

      // Remove second guide from database
      try {
        await bookingsApi.update(id, {
          additionalGuides: null
        });
        toast.success('Second guide removed');
      } catch (error) {
        console.error('Error removing second guide:', error);
        toast.error('Failed to remove second guide');
      }
    } else if (type === 'bergreiseleiter') {
      setBergreiseleiter(null);

      // Remove bergreiseleiter from database
      try {
        await bookingsApi.update(id, {
          bergreiseleiter: null
        });
        toast.success('Bergreiseleiter removed');
      } catch (error) {
        console.error('Error removing bergreiseleiter:', error);
        toast.error('Failed to remove bergreiseleiter');
      }
    }
  };

  // ===================== END GUIDE FUNCTIONS =====================

  // Export RL (Reiseleiter) to PDF
  const exportRLToPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4'); // Portrait format
      const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
      const pax = tourists?.length || 0;

      // Collect all expenses and organize by city (same as display)
      const expensesByCity = {};
      const cityOrder = ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Nurota', 'Bukhara', 'Qizilqum', 'Khiva'];

      // Initialize city sections
      cityOrder.forEach(city => {
        expensesByCity[city] = [];
      });
      expensesByCity['Reiseleiter'] = [];
      expensesByCity['Extra Kosten'] = [];

      // Helper function to map city names
      const mapCityName = (text) => {
        if (!text) return null;
        const str = text.toLowerCase().trim();
        if (str.includes('tashkent') || str.includes('тошкент')) return 'Tashkent';
        if (str.includes('samarkand') || str.includes('samarqand') || str.includes('самарканд')) return 'Samarkand';
        if (str.includes('asraf') || str.includes('асраф')) return 'Asraf';
        if (str.includes('nurota') || str.includes('нурата')) return 'Nurota';
        if (str.includes('bukhara') || str.includes('buxoro') || str.includes('бухара')) return 'Bukhara';
        if (str.includes('khiva') || str.includes('xiva') || str.includes('хива')) return 'Khiva';
        if (str.includes('fergana') || str.includes('farg\'ona') || str.includes('фергана') || str.includes('margilan') || str.includes('qoqon') || str.includes('kokand')) return 'Fergana';
        if (str.includes('qizilqum') || str.includes('kyzylkum') || str.includes('қизилқум') || str.includes('choyxona') || str.includes('чойхона') || str.includes('chayhana') || str.includes('tea house')) return 'Qizilqum';
        return null;
      };

      // 1. Process Hotels
      if (grandTotalData && grandTotalData.hotelBreakdown) {
        grandTotalData.hotelBreakdown.forEach(hotelData => {
          const acc = accommodations.find(a => a.id === hotelData.accommodationId);
          const hotelName = hotelData.hotel || acc?.hotel?.name || 'Unknown Hotel';
          const cityName = acc?.hotel?.city?.name || '';

          // Skip Samarkand hotels in RL PDF (they belong to Später tab)
          const cityNameLower = cityName.toLowerCase();
          const isSamarkand = cityNameLower.includes('samarkand') || cityNameLower.includes('самарканд');
          if (isSamarkand) {
            return; // Skip Samarkand hotels
          }

          let targetCity = mapCityName(cityName) || mapCityName(hotelName);
          if (!targetCity) targetCity = 'Extra Kosten';

          const totalUSD = hotelData.USD || hotelData.totalUSD || 0;
          const totalUZS = hotelData.UZS || hotelData.totalUZS || 0;

          expensesByCity[targetCity].push({
            name: hotelName,
            pricePerPerson: null,
            pax: null,
            usd: totalUSD,
            uzs: totalUZS
          });
        });
      }

      // 2. Process Meals (from OPEX database state)
      // Use mealsData state loaded from database
      mealsData.forEach(meal => {
        const name = meal.name || 'Unknown Meal';
        const city = meal.city || '';
        const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        const total = pricePerPerson * pax;

        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = 'Extra Kosten';

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: pax,
            usd: 0,
            uzs: total
          });
        }
      });

      // 3. Process Metro - Skip for ZA tours
      if (metroVehicles && metroVehicles.length > 0 && booking?.tourType?.code !== 'ZA') {
        metroVehicles.forEach(metro => {
          const name = metro.name || 'Metro';
          const city = metro.city || '';
          const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
          const pricePerPerson = parseFloat(rawPrice.toString().replace(/\s/g, '')) || 0;
          const metroPax = (tourists?.length || 0) + 1;
          const total = pricePerPerson * metroPax;

          let targetCity = mapCityName(city) || mapCityName(name);
          if (!targetCity) targetCity = 'Extra Kosten';

          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: metroPax,
            usd: 0,
            uzs: total
          });
        });
      }

      // 4. Process Shows (from OPEX database state)
      // Use showsData state loaded from database
      showsData.forEach(show => {
        const name = show.name || 'Unknown Show';
        const city = show.city || '';
        const priceStr = (show.price || show.pricePerPerson || '0').toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        const total = pricePerPerson * pax;

        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = 'Extra Kosten';

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: pax,
            usd: 0,
            uzs: total
          });
        }
      });

      // 5. Process Guides
      if (mainGuide && mainGuide.guide) {
        const guideName = typeof mainGuide.guide === 'string' ? mainGuide.guide : mainGuide.guide?.name || 'Main Guide';
        const totalPayment = mainGuide.totalPayment || 0;
        if (totalPayment > 0) {
          expensesByCity['Reiseleiter'].push({
            name: guideName,
            pricePerPerson: null,
            pax: null,
            usd: totalPayment,
            uzs: 0
          });
        }
      }

      // Second Guide - Moved to Später PDF
      // if (secondGuide && secondGuide.guide) {
      //   const guideName = typeof secondGuide.guide === 'string' ? secondGuide.guide : secondGuide.guide?.name || 'Second Guide';
      //   const totalPayment = secondGuide.totalPayment || 0;
      //   if (totalPayment > 0) {
      //     expensesByCity['Reiseleiter'].push({
      //       name: guideName,
      //       pricePerPerson: null,
      //       pax: null,
      //       usd: totalPayment,
      //       uzs: 0
      //     });
      //   }
      // }

      if (bergreiseleiter && bergreiseleiter.guide) {
        const guideName = typeof bergreiseleiter.guide === 'string' ? bergreiseleiter.guide : bergreiseleiter.guide?.name || 'Bergreiseleiter';
        const totalPayment = bergreiseleiter.totalPayment || 0;
        if (totalPayment > 0) {
          expensesByCity['Reiseleiter'].push({
            name: guideName,
            pricePerPerson: null,
            pax: null,
            usd: totalPayment,
            uzs: 0
          });
        }
      }

      // 6. Process Other (from tourServices.other) - Extra Kosten
      if (tourServices.other && tourServices.other.length > 0) {
        tourServices.other.forEach(item => {
          const name = item.name || 'Other';
          const pricePerPerson = item.pricePerPerson || 0;
          const itemPax = item.pax || 0;
          const total = pricePerPerson * itemPax;

          expensesByCity['Extra Kosten'].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: itemPax,
            usd: 0,
            uzs: total
          });
        });
      }

      // Calculate totals
      let totalUSD = 0;
      let totalUZS = 0;
      Object.values(expensesByCity).forEach(cityExpenses => {
        cityExpenses.forEach(expense => {
          totalUSD += expense.usd;
          totalUZS += expense.uzs;
        });
      });

      // Convert UZS to USD and combine
      const uzsToUsd = rlExchangeRate > 0 ? totalUZS / rlExchangeRate : 0;
      const combinedTotalUSD = totalUSD + uzsToUsd;

      // Filter out empty sections
      const sections = [...cityOrder, 'Reiseleiter', 'Extra Kosten'].filter(section =>
        expensesByCity[section] && expensesByCity[section].length > 0
      );

      // Build table data
      const tableData = [];
      sections.forEach(section => {
        // Section header
        tableData.push([
          { content: section, colSpan: 6, styles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' } }
        ]);

        // Section items
        expensesByCity[section].forEach(expense => {
          tableData.push([
            '', // Stadte column (empty)
            expense.name, // Item
            expense.pricePerPerson ? Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : '', // Preis
            expense.pax || '', // PAX
            expense.usd > 0 ? Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ') : '', // Dollar
            expense.uzs > 0 ? Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ') : '' // Som
          ]);
        });
      });

      // Row 1 - Separate USD and UZS (gray, larger)
      tableData.push([
        { content: '', colSpan: 4, styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 9 } },
        { content: `$${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`, styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 9 } },
        { content: Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' '), styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 9 } }
      ]);

      // Row 2 - Converted UZS to USD (gray, larger)
      tableData.push([
        {
          content: `Kurs: 1 USD = ${Math.round(rlExchangeRate).toLocaleString('en-US').replace(/,/g, ' ')} UZS`,
          colSpan: 5,
          styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 9 }
        },
        {
          content: `$${Math.round(uzsToUsd).toLocaleString('en-US').replace(/,/g, ' ')}`,
          styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 9 }
        }
      ]);

      // Row 3 - Total sum (gray, larger Total label)
      tableData.push([
        {
          content: `Total:     $${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')} + $${Math.round(uzsToUsd).toLocaleString('en-US').replace(/,/g, ' ')}`,
          colSpan: 5,
          styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 11 }
        },
        {
          content: `= $${Math.round(combinedTotalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`,
          styles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'right', fontSize: 9 }
        }
      ]);

      // Add title with booking number
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const rlTitle = `Ausgaben ${booking?.bookingNumber || ''} (Reiseleiter)`;
      doc.text(rlTitle, 105, 15, { align: 'center' });

      // Add booking info
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const bookingInfo = `${booking?.tourType?.code || ''}-${booking?.bookingCode || ''} | PAX: ${pax}`;
      doc.text(bookingInfo, 105, 21, { align: 'center' });

      // Generate table (optimized for portrait orientation)
      autoTable(doc, {
        startY: 26,
        head: [['Städte', 'Item', 'Preis', 'PAX', 'Dollar', 'Som']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: [102, 187, 106],  // Lighter green color
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9.5,
          cellPadding: 2.5
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Städte
          1: { cellWidth: 60 }, // Item
          2: { halign: 'right', cellWidth: 25 }, // Preis
          3: { halign: 'center', cellWidth: 18 }, // PAX
          4: { halign: 'right', cellWidth: 30 }, // Dollar
          5: { halign: 'right', cellWidth: 38 }  // Som
        },
        margin: { top: 26, bottom: 10, left: 7, right: 7 }
      });

      // Save PDF
      const fileName = `RL_${booking?.tourType?.code || 'TOUR'}-${booking?.bookingCode || 'BOOKING'}.pdf`;
      doc.save(fileName);

      toast.success('PDF muvaffaqiyatli yaratildi');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF yaratishda xatolik');
    }
  };

  // Export Ausgaben to PDF
  const exportAusgabenToPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
      const pax = tourists?.length || 0;

      // Collect all expenses and organize by city (same logic as display)
      const expensesByCity = {};
      const cityOrder = ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Nurota', 'Bukhara', 'Qizilqum', 'Khiva'];

      // Initialize sections
      cityOrder.forEach(city => {
        expensesByCity[city] = [];
      });
      expensesByCity['Transport'] = [];
      expensesByCity['Reiseleiter'] = [];
      expensesByCity['Railway & Flights'] = [];
      expensesByCity['Extra Kosten'] = [];

      // Helper function to map city names
      const mapCityName = (text) => {
        if (!text) return null;
        const str = text.toLowerCase().trim();
        if (str.includes('tashkent') || str.includes('toshkent')) return 'Tashkent';
        if (str.includes('samarkand') || str.includes('samarqand')) return 'Samarkand';
        if (str.includes('asraf')) return 'Asraf';
        if (str.includes('nurota') || str.includes('nurata')) return 'Nurota';
        if (str.includes('bukhara') || str.includes('buxoro')) return 'Bukhara';
        if (str.includes('khiva') || str.includes('xiva')) return 'Khiva';
        if (str.includes('fergana') || str.includes('farg\'ona') || str.includes('фергана') || str.includes('margilan') || str.includes('qoqon') || str.includes('kokand')) return 'Fergana';
        if (str.includes('qizilqum') || str.includes('kyzylkum') || str.includes('қизилқум') || str.includes('choyxona') || str.includes('чойхона') || str.includes('chayhana') || str.includes('tea house')) return 'Qizilqum';
        return null;
      };

      // Capitalize first letter
      const capitalizeFirstLetter = (str) => {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
      };

      // Process all data sources (same logic as Ausgaben tab)
      // 1. Hotels (from grandTotalData.hotelBreakdown)
      if (grandTotalData && grandTotalData.hotelBreakdown) {
        grandTotalData.hotelBreakdown.forEach(hotelData => {
          // Find the accommodation to get city info
          const acc = accommodations.find(a => a.id === hotelData.accommodationId);
          const hotelName = hotelData.hotel || 'Unknown Hotel';
          const cityName = acc?.hotel?.city?.name || '';

          let targetCity = mapCityName(cityName) || mapCityName(hotelName);
          if (!targetCity) targetCity = 'Extra Kosten';

          // Use costs from grandTotalData
          const totalUSD = hotelData.USD || 0;
          const totalUZS = hotelData.UZS || 0;

          expensesByCity[targetCity].push({
            name: hotelName,
            pricePerPerson: null,
            pax: null,
            usd: totalUSD,
            uzs: totalUZS
          });
        });
      }

      // 2. Process Metro (from metroVehicles state) - Skip for ZA tours
      if (metroVehicles && metroVehicles.length > 0 && booking?.tourType?.code !== 'ZA') {
        metroVehicles.forEach(metro => {
          const name = metro.name || 'Metro';
          const city = metro.city || '';
          const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
          const pricePerPerson = parseFloat(rawPrice.toString().replace(/\s/g, '')) || 0;
          const metroPax = (tourists?.length || 0) + 1; // +1 for guide
          const total = pricePerPerson * metroPax;

          // Map to standard city name
          let targetCity = mapCityName(city) || mapCityName(name);
          if (!targetCity) targetCity = 'Extra Kosten';

          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: metroPax,
            usd: 0,
            uzs: total
          });
        });
      }

      // 3. Process Meals (from OPEX database state)
      // Use mealsData state loaded from database
      mealsData.forEach(meal => {
        const name = meal.name || 'Unknown Meal';
        const city = meal.city || '';
        const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        const mealPax = tourists?.length || 0;
        const total = pricePerPerson * mealPax;

        // Map to standard city name
        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = 'Extra Kosten';

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: mealPax,
            usd: 0,
            uzs: total
          });
        }
      });

      // 4. Process Shows (from OPEX database state)
      // Use showsData state loaded from database
      showsData.forEach(show => {
        const name = show.name || 'Unknown Show';
        const city = show.city || '';
        const rawPrice = show.price || show.pricePerPerson || 0;
        const priceStr = rawPrice.toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        const showPax = tourists?.length || 0;
        const total = pricePerPerson * showPax;

        // Map to standard city name
        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = 'Extra Kosten';

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: showPax,
            usd: 0,
            uzs: total
          });
        }
      });

      // 5. Process Eintritt (from OPEX database state merged with tourServices.eintritt)
      // Use sightseeingData state loaded from database
      const eintrittServices = tourServices.eintritt || [];
      const savedEntriesMap = new Map(eintrittServices.map(s => [s.name.toLowerCase().trim(), s]));

      // Merge template entries with saved entries
      sightseeingData.forEach(item => {
        const name = item.name || 'Unknown Entry';
        const itemName = name.toLowerCase().trim();
        const city = item.city || '';
        const savedEntry = savedEntriesMap.get(itemName);

        let pricePerPerson;
        if (savedEntry) {
          // Use saved entry price
          pricePerPerson = savedEntry.pricePerPerson || 0;
          savedEntriesMap.delete(itemName);
        } else {
          // Use template price
          pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
        }

        const servicePax = tourists?.length || 0;
        const total = pricePerPerson * servicePax;

        // Map to standard city name
        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = 'Extra Kosten';

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: servicePax,
            usd: 0,
            uzs: total
          });
        }
      });

      // Add remaining saved entries not in template
      savedEntriesMap.forEach(savedEntry => {
        const name = savedEntry.name || 'Unknown Entry';
        const city = savedEntry.city || '';
        const pricePerPerson = savedEntry.pricePerPerson || 0;
        const servicePax = tourists?.length || 0;
        const total = pricePerPerson * servicePax;

        // Map to standard city name
        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = 'Extra Kosten';

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: servicePax,
            usd: 0,
            uzs: total
          });
        }
      });

      // 6. Transport
      if (routes && routes.length > 0) {
        const transportByProvider = {};
        routes.forEach(route => {
          const providerName = route.provider || 'Unknown Provider';
          const price = route.price || 0;
          if (!transportByProvider[providerName]) {
            transportByProvider[providerName] = 0;
          }
          transportByProvider[providerName] += price;
        });

        Object.entries(transportByProvider).forEach(([provider, total]) => {
          expensesByCity['Transport'].push({
            name: capitalizeFirstLetter(provider),
            pricePerPerson: null,
            pax: null,
            usd: total,
            uzs: 0
          });
        });
      }

      // 7. Guides
      if (mainGuide && mainGuide.totalPayment) {
        const guideName = typeof mainGuide.guide === 'string' ? mainGuide.guide : mainGuide.guide?.name || 'Main Guide';
        expensesByCity['Reiseleiter'].push({
          name: guideName,
          pricePerPerson: null,
          pax: null,
          usd: mainGuide.totalPayment || 0,
          uzs: 0
        });
      }

      if (secondGuide && secondGuide.totalPayment) {
        const guideName = typeof secondGuide.guide === 'string' ? secondGuide.guide : secondGuide.guide?.name || 'Second Guide';
        expensesByCity['Reiseleiter'].push({
          name: guideName,
          pricePerPerson: null,
          pax: null,
          usd: secondGuide.totalPayment || 0,
          uzs: 0
        });
      }

      if (bergreiseleiter && bergreiseleiter.totalPayment) {
        const guideName = typeof bergreiseleiter.guide === 'string' ? bergreiseleiter.guide : bergreiseleiter.guide?.name || 'Bergreiseleiter';
        expensesByCity['Reiseleiter'].push({
          name: guideName,
          pricePerPerson: null,
          pax: null,
          usd: bergreiseleiter.totalPayment || 0,
          uzs: 0
        });
      }

      // 8. Railways
      if (railways && railways.length > 0) {
        railways.forEach(railway => {
          const departure = railway.departure || railway.from || '';
          const arrival = railway.arrival || railway.to || '';
          const routeName = railway.route || `${departure}-${arrival}`.trim();
          const name = routeName ? `Railway: ${routeName}` : 'Railway';
          const railwayPax = railway.pax || tourists?.length || 0;
          const totalPrice = railway.price || 0;
          const pricePerPerson = railwayPax > 0 ? totalPrice / railwayPax : 0;

          expensesByCity['Railway & Flights'].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: railwayPax,
            usd: 0,
            uzs: totalPrice
          });
        });
      }

      // 9. Flights
      if (flights && flights.length > 0) {
        flights.forEach(flight => {
          const departure = flight.departure || flight.from || '';
          const arrival = flight.arrival || flight.to || '';
          const routeName = flight.route || `${departure}-${arrival}`.trim();
          const name = routeName ? `Flight: ${routeName}` : 'Flight';
          const pricePerPerson = flight.pricePerTicket || flight.price || 0;
          const flightPax = flight.pax || 1;
          const total = pricePerPerson * flightPax;

          // Only add if there's a price
          if (total > 0) {
            expensesByCity['Railway & Flights'].push({
              name: name,
              pricePerPerson: pricePerPerson,
              pax: flightPax,
              usd: 0,
              uzs: total
            });
          }
        });
      }

      // 10. Other
      if (tourServices.other && tourServices.other.length > 0) {
        tourServices.other.forEach(item => {
          const name = item.name || 'Other';
          const pricePerPerson = item.pricePerPerson || 0;
          const itemPax = item.pax || 0;
          const total = pricePerPerson * itemPax;

          expensesByCity['Extra Kosten'].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: itemPax,
            usd: 0,
            uzs: total
          });
        });
      }

      // Calculate totals
      let totalUSD = 0;
      let totalUZS = 0;
      Object.values(expensesByCity).forEach(cityExpenses => {
        cityExpenses.forEach(expense => {
          totalUSD += expense.usd;
          totalUZS += expense.uzs;
        });
      });

      // Filter out empty sections
      const sections = [
        ...cityOrder,
        'Transport',
        'Reiseleiter',
        'Railway & Flights',
        'Extra Kosten'
      ].filter(section => expensesByCity[section] && expensesByCity[section].length > 0);

      // Build table data
      const tableData = [];
      sections.forEach(section => {
        // Section header
        tableData.push([
          { content: section, colSpan: 6, styles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' } }
        ]);

        // Section items
        expensesByCity[section].forEach(expense => {
          tableData.push([
            '', // Empty Stadte column
            expense.name,
            expense.pricePerPerson ? Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : '',
            expense.pax !== null ? expense.pax : '',
            expense.usd > 0 ? Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ') : '',
            expense.uzs > 0 ? Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ') : ''
          ]);
        });
      });

      // Total row
      tableData.push([
        { content: 'TOTAL', colSpan: 4, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: `$${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' '), styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } }
      ]);

      // Add title with booking number
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      const ausgabenTitle = `Ausgaben ${booking?.bookingNumber || ''}`;
      doc.text(ausgabenTitle, 105, 10, { align: 'center' });

      // Add booking info
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      const bookingInfo = `${booking?.tourType?.code || ''}-${booking?.bookingCode || ''} | PAX: ${pax}`;
      doc.text(bookingInfo, 105, 15, { align: 'center' });

      const pageHeight = 297; // A4 height in mm
      const startY = 19;
      const bottomMargin = 8;
      const availableHeight = pageHeight - startY - bottomMargin;

      const tableOptions = (fs, cp) => ({
        startY: startY,
        head: [['Städte', 'Item', 'Preis', 'PAX', 'Dollar', 'Som']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: fs,
          cellPadding: cp,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [102, 187, 106],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: fs + 0.5,
          cellPadding: cp + 0.2
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 58 },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 16 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', cellWidth: 34 }
        },
        margin: { top: startY, bottom: bottomMargin, left: 10, right: 10 }
      });

      // First pass: measure actual table height with base font size
      const testDoc = new jsPDF('p', 'mm', 'a4');
      autoTable(testDoc, tableOptions(6.5, 1.2));
      const numPages = testDoc.getNumberOfPages();
      const finalY = testDoc.lastAutoTable.finalY;

      // Calculate true total content height across all pages
      // Page 1: availableHeight (startY to pageHeight-bottomMargin)
      // Page 2+: each page adds (finalY_on_that_page - startY)
      let fs = 6.5;
      let cp = 1.2;
      if (numPages > 1) {
        const totalContentHeight = (numPages - 1) * availableHeight + (finalY - startY);
        const scale = (availableHeight / totalContentHeight) * 0.97; // 3% extra buffer
        fs = Math.max(4.0, 6.5 * scale);
        cp = Math.max(0.3, 1.2 * scale);
      }

      // Second pass: generate actual PDF with correct scale
      autoTable(doc, tableOptions(fs, cp));

      // Save PDF
      const fileName = `Ausgaben_${booking?.tourType?.code || 'TOUR'}-${booking?.bookingCode || 'BOOKING'}.pdf`;
      doc.save(fileName);

      toast.success('PDF muvaffaqiyatli yaratildi');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF yaratishda xatolik');
    }
  };

  // Export Später to PDF
  const exportSpaterToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Collect expenses for Später tab (same logic as display)
      const expensesByCity = {};
      expensesByCity['Samarkand'] = [];
      expensesByCity['Transport'] = [];
      expensesByCity['Reiseleiter'] = [];

      // 1. Process Hotels in Samarkand
      if (grandTotalData && grandTotalData.hotelBreakdown) {
        grandTotalData.hotelBreakdown.forEach(hotelData => {
          const acc = accommodations.find(a => a.id === hotelData.accommodationId);
          const hotelName = hotelData.hotel || acc?.hotel?.name || 'Unknown Hotel';
          const cityName = acc?.hotel?.city?.name?.toLowerCase() || '';

          // Check by CITY, not hotel name
          const isSamarkand = cityName.includes('samarkand') || cityName.includes('самарканд');

          if (isSamarkand) {
            const totalUSD = hotelData.USD || hotelData.totalUSD || 0;
            const totalUZS = hotelData.UZS || hotelData.totalUZS || 0;

            expensesByCity['Samarkand'].push({
              name: hotelName,
              pricePerPerson: null,
              pax: null,
              usd: totalUSD,
              uzs: totalUZS
            });
          }
        });
      }

      // 2. Process Routes/Transport - Calculate totals by Provider
      if (routes && routes.length > 0) {
        const providerTotals = { xayrulla: 0, sevil: 0, nosir: 0 };

        routes.forEach(route => {
          const price = route.price || 0;
          const provider = route.provider || '';

          if (price > 0) {
            const providerLower = provider.toLowerCase().trim();
            if (providerLower.includes('sevil')) {
              providerTotals.sevil += price;
            } else if (providerLower.includes('xayrulla') || providerLower.includes('hayrulla') || providerLower.includes('хайрулла')) {
              providerTotals.xayrulla += price;
            } else if (providerLower.includes('nosir') || providerLower.includes('носир')) {
              providerTotals.nosir += price;
            } else {
              providerTotals.xayrulla += price;
            }
          }
        });

        if (providerTotals.xayrulla > 0) {
          expensesByCity['Transport'].push({
            name: 'Xayrulla',
            pricePerPerson: null,
            pax: null,
            usd: providerTotals.xayrulla,
            uzs: 0
          });
        }

        if (providerTotals.sevil > 0) {
          expensesByCity['Transport'].push({
            name: 'Sevil',
            pricePerPerson: null,
            pax: null,
            usd: providerTotals.sevil,
            uzs: 0
          });
        }

        if (providerTotals.nosir > 0) {
          expensesByCity['Transport'].push({
            name: 'Nosir',
            pricePerPerson: null,
            pax: null,
            usd: providerTotals.nosir,
            uzs: 0
          });
        }
      }

      // 3. Process Second Guide (moved from RL PDF)
      if (secondGuide && secondGuide.guide) {
        const guideName = typeof secondGuide.guide === 'string' ? secondGuide.guide : secondGuide.guide?.name || 'Second Guide';
        const totalPayment = secondGuide.totalPayment || 0;
        if (totalPayment > 0) {
          expensesByCity['Reiseleiter'].push({
            name: guideName,
            pricePerPerson: null,
            pax: null,
            usd: totalPayment,
            uzs: 0
          });
        }
      }

      // Calculate totals
      let totalUSD = 0;
      let totalUZS = 0;
      Object.values(expensesByCity).forEach(cityExpenses => {
        cityExpenses.forEach(expense => {
          totalUSD += expense.usd;
          totalUZS += expense.uzs;
        });
      });

      // Filter out empty sections
      const sections = ['Samarkand', 'Transport', 'Reiseleiter'].filter(section =>
        expensesByCity[section] && expensesByCity[section].length > 0
      );

      // Build table data
      const tableData = [];
      sections.forEach(section => {
        // Section header
        tableData.push([
          { content: section, colSpan: 6, styles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' } }
        ]);

        // Section items
        expensesByCity[section].forEach(expense => {
          tableData.push([
            '', // Stadte column (empty)
            expense.name, // Item
            expense.pricePerPerson ? Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : '', // Preis
            expense.pax || '', // PAX
            expense.usd > 0 ? Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ') : '', // Dollar
            expense.uzs > 0 ? Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ') : '' // Som
          ]);
        });
      });

      // Total row
      tableData.push([
        { content: 'TOTAL', colSpan: 4, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: `$${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' '), styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } }
      ]);

      // Add title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Spater (Deferred Payments)', 148.5, 13, { align: 'center' });

      // Add booking info
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      const bookingInfo = `${booking?.tourType?.code || ''}-${booking?.bookingCode || ''} | PAX: ${tourists?.length || 0}`;
      doc.text(bookingInfo, 148.5, 20, { align: 'center' });

      // Generate table
      autoTable(doc, {
        startY: 25,
        head: [['Stadte', 'Item', 'Preis', 'PAX', 'Dollar', 'Som']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: 2.5
        },
        columnStyles: {
          0: { cellWidth: 30 }, // Stadte
          1: { cellWidth: 80 }, // Item
          2: { halign: 'right', cellWidth: 30 }, // Preis
          3: { halign: 'center', cellWidth: 20 }, // PAX
          4: { halign: 'right', cellWidth: 35 }, // Dollar
          5: { halign: 'right', cellWidth: 35 }  // Som
        },
        margin: { top: 20, bottom: 7, left: 7, right: 7 }
      });

      // Save PDF
      const fileName = `Spater_${booking?.tourType?.code || 'TOUR'}-${booking?.bookingCode || 'BOOKING'}.pdf`;
      doc.save(fileName);

      toast.success('PDF muvaffaqiyatli yaratildi');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF yaratishda xatolik');
    }
  };

  // Export Überweisung to PDF
  const exportUberweisungToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
      const pax = tourists?.length || 0;

      // Collect Eintritt expenses and organize by city
      const expensesByCity = {};
      const cityOrder = ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Nurota', 'Bukhara', 'Qizilqum', 'Khiva'];

      // Initialize city sections
      cityOrder.forEach(city => {
        expensesByCity[city] = [];
      });

      // Helper function to map city names
      const mapCityName = (text) => {
        if (!text) return null;
        const str = text.toLowerCase().trim();
        if (str.includes('tashkent') || str.includes('тошкент')) return 'Tashkent';
        if (str.includes('samarkand') || str.includes('samarqand') || str.includes('самарканд')) return 'Samarkand';
        if (str.includes('asraf') || str.includes('асраф')) return 'Asraf';
        if (str.includes('nurota') || str.includes('нурата')) return 'Nurota';
        if (str.includes('bukhara') || str.includes('buxoro') || str.includes('бухара')) return 'Bukhara';
        if (str.includes('khiva') || str.includes('xiva') || str.includes('хива')) return 'Khiva';
        if (str.includes('fergana') || str.includes('farg\'ona') || str.includes('фергана') || str.includes('margilan') || str.includes('qoqon') || str.includes('kokand')) return 'Fergana';
        if (str.includes('qizilqum') || str.includes('kyzylkum') || str.includes('қизилқум') || str.includes('choyxona') || str.includes('чойхона') || str.includes('chayhana') || str.includes('tea house')) return 'Qizilqum';
        return null;
      };

      // Process Entrance Fees (Eintritt)
      const sightseeingKey = `${tourTypeCode}Sightseeing`;
      let sightseeingData = [];
      try {
        const saved = localStorage.getItem(sightseeingKey);
        if (saved) sightseeingData = JSON.parse(saved);
      } catch (e) {
        console.error('Error loading sightseeing:', e);
      }

      sightseeingData.forEach(sight => {
        const name = sight.name || 'Unknown Entrance';
        const city = sight.city || '';
        const priceStr = (sight.price || sight.pricePerPerson || '0').toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        const sightPax = pax;
        const total = pricePerPerson * sightPax;

        let targetCity = mapCityName(city) || mapCityName(name);
        if (!targetCity) targetCity = cityOrder[0];

        if (total > 0) {
          expensesByCity[targetCity].push({
            name: name,
            pricePerPerson: pricePerPerson,
            pax: sightPax,
            usd: 0,
            uzs: total
          });
        }
      });

      // Calculate totals
      let totalUSD = 0;
      let totalUZS = 0;
      Object.values(expensesByCity).forEach(cityExpenses => {
        cityExpenses.forEach(expense => {
          totalUSD += expense.usd;
          totalUZS += expense.uzs;
        });
      });

      // Filter out empty sections
      const sections = cityOrder.filter(section =>
        expensesByCity[section] && expensesByCity[section].length > 0
      );

      // Build table data
      const tableData = [];
      sections.forEach(section => {
        tableData.push([
          { content: section, colSpan: 6, styles: { fillColor: [168, 85, 247], textColor: 255, fontStyle: 'bold' } }
        ]);

        expensesByCity[section].forEach(expense => {
          tableData.push([
            '',
            expense.name,
            expense.pricePerPerson ? Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : '',
            expense.pax || '',
            expense.usd > 0 ? Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ') : '',
            expense.uzs > 0 ? Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ') : ''
          ]);
        });
      });

      // Total row
      tableData.push([
        { content: 'TOTAL', colSpan: 4, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: `$${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' '), styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } }
      ]);

      // Add title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Uberweisung (Bank Transfer)', 148.5, 13, { align: 'center' });

      // Add booking info
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      const bookingInfo = `${booking?.tourType?.code || ''}-${booking?.bookingCode || ''} | PAX: ${pax}`;
      doc.text(bookingInfo, 148.5, 20, { align: 'center' });

      // Generate table
      autoTable(doc, {
        startY: 25,
        head: [['Stadte', 'Item', 'Preis', 'PAX', 'Dollar', 'Som']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [168, 85, 247],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: 2.5
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 80 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 35 },
          5: { halign: 'right', cellWidth: 35 }
        },
        margin: { top: 20, bottom: 7, left: 7, right: 7 }
      });

      // Save PDF
      const fileName = `Uberweisung_${booking?.tourType?.code || 'TOUR'}-${booking?.bookingCode || 'BOOKING'}.pdf`;
      doc.save(fileName);

      toast.success('PDF muvaffaqiyatli yaratildi');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF yaratishda xatolik');
    }
  };

  // Export Karta to PDF
  const exportKartaToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Collect Railway & Flights expenses only
      const expensesByCity = {};
      expensesByCity['Railway & Flights'] = [];

      // Process Railways
      if (railways && railways.length > 0) {
        railways.forEach(railway => {
          const departure = railway.departure || railway.from || '';
          const arrival = railway.arrival || railway.to || '';
          const routeName = railway.route || `${departure}-${arrival}`.trim();
          const name = routeName ? `Railway: ${routeName}` : 'Railway';
          const pax = railway.pax || 1;
          const total = railway.price || 0;
          const pricePerTicket = railway.pricePerTicket || (total > 0 && pax > 0 ? total / pax : 0);

          if (total > 0) {
            expensesByCity['Railway & Flights'].push({
              name: name,
              pricePerPerson: pricePerTicket,
              pax: pax,
              usd: 0,
              uzs: total
            });
          }
        });
      }

      // Process Flights
      if (flights && flights.length > 0) {
        flights.forEach(flight => {
          const departure = flight.departure || flight.from || '';
          const arrival = flight.arrival || flight.to || '';
          const routeName = flight.route || `${departure}-${arrival}`.trim();
          const name = routeName ? `Flight: ${routeName}` : 'Flight';
          const pax = flight.pax || 1;
          const total = flight.price || 0;
          const pricePerTicket = flight.pricePerTicket || (total > 0 && pax > 0 ? total / pax : 0);

          if (total > 0) {
            expensesByCity['Railway & Flights'].push({
              name: name,
              pricePerPerson: pricePerTicket,
              pax: pax,
              usd: 0,
              uzs: total
            });
          }
        });
      }

      // Calculate totals
      let totalUSD = 0;
      let totalUZS = 0;
      Object.values(expensesByCity).forEach(cityExpenses => {
        cityExpenses.forEach(expense => {
          totalUSD += expense.usd;
          totalUZS += expense.uzs;
        });
      });

      // Filter out empty sections
      const sections = ['Railway & Flights'].filter(section =>
        expensesByCity[section] && expensesByCity[section].length > 0
      );

      // Build table data
      const tableData = [];
      sections.forEach(section => {
        tableData.push([
          { content: section, colSpan: 6, styles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' } }
        ]);

        expensesByCity[section].forEach(expense => {
          tableData.push([
            '',
            expense.name,
            expense.pricePerPerson ? Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : '',
            expense.pax || '',
            expense.usd > 0 ? Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ') : '',
            expense.uzs > 0 ? Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ') : ''
          ]);
        });
      });

      // Total row
      tableData.push([
        { content: 'TOTAL', colSpan: 4, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: `$${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}`, styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } },
        { content: Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' '), styles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'right' } }
      ]);

      // Add title with booking number
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      const kartaTitle = `Ausgaben ${booking?.bookingNumber || ''} (Card Payments)`;
      doc.text(kartaTitle, 148.5, 13, { align: 'center' });

      // Add booking info
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      const bookingInfo = `${booking?.tourType?.code || ''}-${booking?.bookingCode || ''} | PAX: ${tourists?.length || 0}`;
      doc.text(bookingInfo, 148.5, 20, { align: 'center' });

      // Generate table
      autoTable(doc, {
        startY: 25,
        head: [['Stadte', 'Item', 'Preis', 'PAX', 'Dollar', 'Som']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [249, 115, 22],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: 2.5
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 80 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 35 },
          5: { halign: 'right', cellWidth: 35 }
        },
        margin: { top: 20, bottom: 7, left: 7, right: 7 }
      });

      // Save PDF
      const fileName = `Karta_${booking?.tourType?.code || 'TOUR'}-${booking?.bookingCode || 'BOOKING'}.pdf`;
      doc.save(fileName);

      toast.success('PDF muvaffaqiyatli yaratildi');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF yaratishda xatolik');
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

  // Load flights and railways when Fly&Railway or Tour Services tab is accessed
  useEffect(() => {
    if ((activeTab === 'rooming' || activeTab === 'tour-services') && !isNew && id) {
      loadFlights();
      loadRailways();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, isNew]);

  // Reload all Tour Services data when Total tab is accessed
  useEffect(() => {
    if (activeTab === 'costs' && (costsTab === 'total' || costsTab === 'ausgaben') && !isNew && id) {
      // Reload all data sources for Total and Ausgaben tabs
      loadFlights();
      loadRailways();
      loadTourServices('EINTRITT');
      loadTourServices('METRO');
      loadTourServices('OTHER');
      loadVehiclesFromApi(); // Reload metro and other transport
      // Hotels and guides are already loaded via other mechanisms
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, costsTab, id, isNew]);

  // Auto-fill accommodations from tour itinerary
  const autoFillAccommodationsFromItinerary = async () => {
    if (!booking?.tourTypeId) {
      toast.error('Нет программы тура');
      return;
    }

    const tourTypeCode = booking?.tourType?.code;

    // Check tour type - only ER, CO, KAS, and ZA supported
    if (tourTypeCode !== 'ER' && tourTypeCode !== 'CO' && tourTypeCode !== 'KAS' && tourTypeCode !== 'ZA') {
      toast.error('Бу функция фақат ER, CO, KAS ва ZA турлари учун');
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

      // Step 3: Build accommodation list from itinerary
      // CRITICAL: Use parseISO() to avoid timezone shift
      const departureDate = parseISO(booking.departureDate);
      const arrivalDate = parseISO(booking.arrivalDate);

      // CRITICAL: Calculate base date for different tour types
      // - ER/CO tours: arrivalDate = day tourists arrive (tour starts)
      // - KAS tours: departureDate = tour start in Kazakhstan/Kyrgyzstan
      //              arrivalDate in Uzbekistan = departureDate + offset to first Uzbekistan hotel
      // - ZA tours: Excel date → booking.departureDate (+4) → Uzbekistan arrival (+4)
      // tourTypeCode already declared above at line 4224

      let baseDate;
      let baseDateLabel;

      if (tourTypeCode === 'ZA') {
        // ZA tours: departureDate + 4 days for Tajikistan
        baseDate = new Date(departureDate.getTime() + (4 * 24 * 60 * 60 * 1000));
        baseDateLabel = 'Uzbekistan arrival (departureDate + 4)';
        console.log(`📅 ZA tour: Base date = ${format(baseDate, 'yyyy-MM-dd')} (${baseDateLabel})`);
      } else if (tourTypeCode === 'KAS') {
        // KAS tours: Calculate Uzbekistan arrival from first Uzbekistan hotel in itinerary
        // We'll calculate this after finding first Uzbekistan hotel
        baseDate = departureDate; // Temporary - will be updated below
        baseDateLabel = 'departureDate (tour start)';
        console.log(`📅 KAS tour: Temporary base date = ${format(baseDate, 'yyyy-MM-dd')} (will be recalculated)`);
      } else {
        // ER/CO tours: use arrivalDate as-is
        baseDate = arrivalDate;
        baseDateLabel = 'arrivalDate';
        console.log(`📅 ${tourTypeCode} tour: Base date = ${format(baseDate, 'yyyy-MM-dd')} (${baseDateLabel})`);
      }

      const accommodationsToCreate = [];

      // Log itinerary for debugging
      console.log('🔍 Itinerary loaded:', itinerary.length, 'days');

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

      console.log('📊 Grouped hotel stays:', hotelStays.length);

      if (hotelStays.length === 0) {
        toast.error('Нет отелей в программе тура');
        setSaving(false);
        return;
      }

      // ========================================
      // NEW CLEAN LOGIC - 3 Scenarios (ER only)
      // ========================================

      // Determine tourist composition (ER tours only)
      const isERTour = tourTypeCode === 'ER';
      const onlyTM = isERTour && turkmenistanTourists.length > 0 && uzbekistanTourists.length === 0;
      const onlyUZ = isERTour && uzbekistanTourists.length > 0 && turkmenistanTourists.length === 0;
      const mixed = isERTour && uzbekistanTourists.length > 0 && turkmenistanTourists.length > 0;

      console.log(`📊 Tour: ${tourTypeCode}, Tourist composition: onlyTM=${onlyTM}, onlyUZ=${onlyUZ}, mixed=${mixed}`);
      console.log(`📋 Hotels from itinerary: ${hotelStays.length}`);

      // Merge CONSECUTIVE same-hotel stays
      const mergedStays = [];
      for (let i = 0; i < hotelStays.length; i++) {
        const stay = hotelStays[i];
        const prevStay = mergedStays[mergedStays.length - 1];

        // Merge if SAME hotel AND CONSECUTIVE days (no gap)
        if (prevStay && prevStay.hotelName === stay.hotelName && stay.startDay === prevStay.endDay + 1) {
          prevStay.endDay = stay.endDay;
          console.log(`🔗 Merged: ${stay.hotelName} (days ${prevStay.startDay}-${prevStay.endDay})`);
        } else {
          mergedStays.push({ ...stay });
        }
      }

      console.log(`📋 After merge: ${mergedStays.length} hotels`);
      const staysToProcess = mergedStays;

      // ========================================
      // Step 4: Create hotels 1-5 from itinerary
      // ========================================

      const lastDay = Math.max(...itinerary.map(d => d.dayNumber));

      for (let i = 0; i < staysToProcess.length; i++) {
        const stay = staysToProcess[i];
        const isLastStay = (i === staysToProcess.length - 1);

        // Skip departure-only days
        if (stay.endDay === lastDay && stay.startDay === lastDay) {
          continue;
        }

        // Find hotel in database
        let hotel = hotels.find(h =>
          h.name.toLowerCase().includes(stay.hotelName.toLowerCase()) ||
          stay.hotelName.toLowerCase().includes(h.name.toLowerCase())
        );

        if (!hotel) {
          const normalized = stay.hotelName.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
          hotel = hotels.find(h => {
            const hn = h.name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
            return hn.includes(normalized) || normalized.includes(hn);
          });
        }

        if (!hotel) {
          toast.error(`Отель не найден: ${stay.hotelName}`);
          continue;
        }

        // SKIP: For ONLY TM groups, skip last hotel if it's in Tashkent (return hotel)
        const cityName = hotel.city?.name?.toLowerCase() || '';
        const isTashkent = cityName.includes('ташкент') || cityName.includes('tashkent');

        if (onlyTM && isLastStay && isTashkent) {
          console.log(`ℹ️ Only TM: Skipped last Tashkent hotel (TM tourists don't return)`);
          continue;
        }

        // Check if this is a hotel in Khiva (check both city name AND hotel name)
        // City name can be: "Khiva" (English), "Хива" (Russian/Uzbek), "Chiwa" (German)
        const hotelNameLower = hotel.name.toLowerCase();
        const isKhivaByCity = cityName.includes('хива') || cityName.includes('khiva') || cityName.includes('chiwa');
        const isKhivaByName = hotelNameLower.includes('khiva') || hotelNameLower.includes('хива') || hotelNameLower.includes('chiwa');
        const isKhiva = isKhivaByCity || isKhivaByName;
        const isMalikaKhorazm = hotelNameLower.includes('malika') && hotelNameLower.includes('khorazm');

        console.log(`🏨 Hotel: ${hotel.name}, City: ${cityName}, isKhiva: ${isKhiva}`);

        // Adjust Khiva hotels to 2 nights:
        // - ER tours: Only UZ groups get Malika Khorazm 2 nights
        // - CO tours: All Khiva hotels should be 2 nights
        let adjustedEndDay = stay.endDay;
        const isCOTour = tourTypeCode === 'CO';

        if (isKhiva) {
          // IMPORTANT: nights = (endDay - startDay) + 1 because checkout adds +1 day
          // Example: startDay=11, endDay=12 → 2 days in itinerary → 2 nights
          const nights = (stay.endDay - stay.startDay) + 1;
          console.log(`🌙 ${hotel.name}: ${nights} nights (startDay: ${stay.startDay}, endDay: ${stay.endDay})`);

          if (isCOTour && nights !== 2) {
            // CO tours: ALWAYS force Khiva to exactly 2 nights
            adjustedEndDay = stay.startDay + 1; // startDay + 1 = 2 nights
            console.log(`✅ CO tour: FORCED ${hotel.name} to exactly 2 nights (was ${nights})`);
          } else if (onlyUZ && isKhiva && nights > 2) {
            // ER Only UZ: Reduce ANY Khiva hotel to 2 nights (not just Malika Khorazm)
            adjustedEndDay = stay.endDay - 1;
            console.log(`✅ ER Only UZ: Reduced ${hotel.name} to 2 nights (was ${nights})`);
          } else {
            console.log(`ℹ️ ${hotel.name}: ${nights} nights - no adjustment`);
          }
        }

        // Create hotel for ALL tourists (simple logic)
        accommodationsToCreate.push({
          hotel,
          startDay: stay.startDay,
          endDay: adjustedEndDay,
          tourists: [...uzbekistanTourists, ...turkmenistanTourists],
          groupName: 'All'
        });
      }

      // ========================================
      // Step 5: Add 6th hotel for UZ return (if needed)
      // ========================================

      if (onlyUZ || mixed) {
        // Check if last hotel is already in Tashkent
        const lastStay = staysToProcess[staysToProcess.length - 1];
        let lastHotelInTashkent = false;

        if (lastStay) {
          const lastHotel = hotels.find(h =>
            h.name.toLowerCase().includes(lastStay.hotelName.toLowerCase()) ||
            lastStay.hotelName.toLowerCase().includes(h.name.toLowerCase())
          );
          const isTashkent = lastHotel?.city?.name?.toLowerCase().includes('ташкент') ||
                            lastHotel?.city?.name?.toLowerCase().includes('tashkent');
          lastHotelInTashkent = isTashkent;
        }

        if (!lastHotelInTashkent) {
          // Last hotel is NOT in Tashkent (probably Khiva), so add return hotel
          // Find FIRST Tashkent hotel from itinerary (tourists return to where they started)
          let tashkentReturnHotel = null;

          for (const stay of staysToProcess) {
            const hotel = hotels.find(h =>
              h.name.toLowerCase().includes(stay.hotelName.toLowerCase()) ||
              stay.hotelName.toLowerCase().includes(h.name.toLowerCase())
            );
            const cityName = hotel?.city?.name?.toLowerCase() || '';
            const isTashkent = cityName.includes('ташкент') || cityName.includes('tashkent');

            if (isTashkent && hotel) {
              tashkentReturnHotel = hotel;
              break; // Use first Tashkent hotel found
            }
          }

          if (tashkentReturnHotel) {
            const uzTourists = onlyUZ ? tourists : uzbekistanTourists;
            accommodationsToCreate.push({
              hotel: tashkentReturnHotel,
              startDay: lastDay,
              endDay: lastDay,
              tourists: uzTourists,
              groupName: onlyUZ ? 'All' : 'Uzbekistan'
            });
            console.log(`✅ Added 6th hotel: ${tashkentReturnHotel.name} (return to first Tashkent hotel) for ${onlyUZ ? 'ALL (onlyUZ)' : 'UZ tourists (mixed)'}`);
          } else {
            toast.error('Тошкентда отель топилмади! Программада Тошкент отели бўлиши керак.');
          }
        } else {
          console.log(`ℹ️ Last hotel already in Tashkent, not adding 6th hotel`);
        }
      }

      console.log(`📊 Total hotels to create: ${accommodationsToCreate.length}`);

      // Step 5: Create accommodations in database
      if (accommodationsToCreate.length === 0) {
        toast.error('Нет размещений для создания');
        setSaving(false);
        return;
      }

      console.log('✅ Hotels to create:', accommodationsToCreate.map(a => `${a.hotel.name} (${a.groupName})`).join(', '));

      // No deduplication - new logic creates exact hotels needed
      const finalAccommodationsToCreate = accommodationsToCreate;

      let createdCount = 0;

      // CRITICAL: Find the first hotel's day number in itinerary
      // For KAS tours: find first UZBEKISTAN hotel day and calculate arrivalDate from it
      // For ER/CO/ZA tours: use first hotel day as normal
      let firstHotelDay;

      if (tourTypeCode === 'KAS') {
        // For KAS tours, find the first hotel in Uzbekistan
        // Check by country OR by known Uzbekistan city names
        const uzbekistanCities = ['tashkent', 'ташкент', 'samarkand', 'самарканд', 'bukhara', 'бухара',
                                  'khiva', 'хива', 'chiwa', 'fergana', 'фергана', 'shakhrisabz', 'шахрисабз',
                                  'termez', 'термез', 'nukus', 'нукус', 'urgench', 'ургенч'];

        const uzbekistanHotels = finalAccommodationsToCreate.filter(acc => {
          const country = acc.hotel.city?.country?.toLowerCase() || '';
          const cityName = acc.hotel.city?.name?.toLowerCase() || '';

          // Check country field
          const isUzbekByCountry = country.includes('uzbek') || country.includes('узбек');

          // Check city name against known Uzbekistan cities
          const isUzbekByCity = uzbekistanCities.some(city => cityName.includes(city));

          return isUzbekByCountry || isUzbekByCity;
        });

        if (uzbekistanHotels.length > 0) {
          firstHotelDay = Math.min(...uzbekistanHotels.map(acc => acc.startDay));

          // CRITICAL: For KAS tours, calculate baseDate (Uzbekistan arrival) from departureDate
          // Example: departureDate = 01.09, firstHotelDay = 15 → baseDate = 01.09 + 14 days = 15.09
          baseDate = new Date(departureDate);
          baseDate.setDate(baseDate.getDate() + (firstHotelDay - 1));

          console.log(`📅 KAS tour: First Uzbekistan hotel on Day ${firstHotelDay}`);
          console.log(`📅 KAS tour: Calculated Uzbekistan arrival = departureDate (${format(departureDate, 'yyyy-MM-dd')}) + ${firstHotelDay - 1} days = ${format(baseDate, 'yyyy-MM-dd')}`);
          console.log(`📍 Uzbekistan hotels found: ${uzbekistanHotels.map(h => `${h.hotel.name} (${h.hotel.city?.name}, Day ${h.startDay})`).join(', ')}`);
        } else {
          // Fallback if no Uzbekistan hotels found
          firstHotelDay = Math.min(...finalAccommodationsToCreate.map(acc => acc.startDay));
          console.log(`⚠️ KAS tour: No Uzbekistan hotels found, using first hotel day: ${firstHotelDay}`);
        }
      } else {
        // For ER/CO/ZA tours, use first hotel day as normal
        firstHotelDay = Math.min(...finalAccommodationsToCreate.map(acc => acc.startDay));
        console.log(`📅 ${tourTypeCode} tour: First hotel day: ${firstHotelDay}, baseDate: ${format(baseDate, 'yyyy-MM-dd')}`);
      }

      for (const accData of finalAccommodationsToCreate) {
        const { hotel, startDay, endDay, tourists: groupTourists, groupName } = accData;

        // Calculate dates using baseDate
        // - KAS tours: arrivalDate = first day in Uzbekistan, offset from first Uzbekistan hotel
        // - ER/CO tours: arrivalDate = first day of tour, offset from first hotel
        // - ZA tours: baseDate = arrivalDate + 4 days, offset from first hotel
        const checkInDate = new Date(baseDate);
        checkInDate.setDate(checkInDate.getDate() + (startDay - firstHotelDay));

        // IMPORTANT: For CO tours and ER Only UZ with Khiva, don't add +1 to checkout
        const cityName = hotel.city?.name?.toLowerCase() || '';
        const hotelName = hotel.name.toLowerCase();
        const isKhivaHotel = cityName.includes('хива') || cityName.includes('khiva') || cityName.includes('chiwa') ||
                            hotelName.includes('khiva') || hotelName.includes('chiwa') || hotelName.includes('хива');
        const isCOKhiva = tourTypeCode === 'CO' && isKhivaHotel;
        const isEROnlyUZKhiva = isERTour && onlyUZ && isKhivaHotel;

        const checkOutDate = new Date(baseDate);
        if (isCOKhiva || isEROnlyUZKhiva) {
          // For CO Khiva or ER Only UZ Khiva: Fixed to 2 nights (endDay without +1)
          checkOutDate.setDate(checkOutDate.getDate() + (endDay - firstHotelDay));
          console.log(`✅ ${tourTypeCode} ${onlyUZ ? 'Only UZ' : ''} Khiva: checkout WITHOUT +1 (2 nights)`);
        } else {
          checkOutDate.setDate(checkOutDate.getDate() + (endDay - firstHotelDay) + 1);
        }

        const hotelCountry = hotel.city?.country || 'Unknown';
        const dateLabel = tourTypeCode === 'KAS' ? 'baseDate (UZ arrival)' : 'baseDate';
        console.log(`  → ${hotel.name} (${hotelCountry}): Day ${startDay}-${endDay}, checkIn = ${dateLabel} + (${startDay} - ${firstHotelDay}) = ${format(checkInDate, 'yyyy-MM-dd')}, checkOut = ${format(checkOutDate, 'yyyy-MM-dd')}`);

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
        // CRITICAL: Use format() instead of toISOString() to avoid timezone shift (+1 day bug)
        const data = {
          hotelId: hotel.id,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
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

      // CRITICAL FOR KAS TOURS: Update all tourists' checkInDate to Uzbekistan arrival
      if (tourTypeCode === 'KAS') {
        console.log('📅 KAS tour: Updating tourists checkInDate to Uzbekistan arrival:', format(baseDate, 'yyyy-MM-dd'));

        try {
          for (const tourist of tourists) {
            await touristsApi.update(booking.id, tourist.id, {
              checkInDate: baseDate.toISOString()
            });
          }
          console.log(`✅ Updated ${tourists.length} tourists checkInDate to ${format(baseDate, 'yyyy-MM-dd')}`);
        } catch (error) {
          console.error('Error updating tourists:', error);
        }
      }

      // CRITICAL FOR ZA TOURS: Update all tourists' checkInDate to Uzbekistan arrival (departureDate + 4)
      if (tourTypeCode === 'ZA') {
        console.log('📅 ZA tour: Updating tourists checkInDate to Uzbekistan arrival:', format(baseDate, 'yyyy-MM-dd'));

        try {
          for (const tourist of tourists) {
            await touristsApi.update(booking.id, tourist.id, {
              checkInDate: baseDate.toISOString()
            });
          }
          console.log(`✅ Updated ${tourists.length} tourists checkInDate to ${format(baseDate, 'yyyy-MM-dd')}`);
        } catch (error) {
          console.error('Error updating tourists:', error);
        }
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

            // Filter tourists for this hotel (by date overlap)
            // NOTE: Room number is optional - manually added tourists won't have it
            const accTourists = allTourists.filter(t => {
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

        // For all tours: auto-set country to Germany (unless already set)
        const newCountry = !prev.country ? 'Germany' : prev.country;

        return {
          ...prev,
          [name]: value,
          paxTurkmenistan: newTurkmen,
          pax: totalPax,
          country: newCountry
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

  // Update Rechnung Firma and create/update invoice
  const handleRechnungFirmaChange = async (firma, invoiceType = 'Rechnung') => {
    try {
      // Check if invoice already exists for this booking and type
      const invoicesResponse = await invoicesApi.getAll({
        bookingId: id,
        invoiceType: invoiceType
      });
      const existingInvoice = invoicesResponse.data.invoices?.[0];

      // If firma is empty, delete the invoice if it exists
      if (!firma || firma === '') {
        if (existingInvoice) {
          await invoicesApi.delete(existingInvoice.id);
        }

        // Clear state based on invoice type
        if (invoiceType === 'Rechnung') {
          setRechnungInvoice(null);
          setRechnungSequentialNumber(0);
        } else if (invoiceType === 'Neue Rechnung') {
          setNeueRechnungInvoice(null);
          setNeueRechnungSequentialNumber(0);
        } else if (invoiceType === 'Gutschrift') {
          setGutschriftInvoice(null);
          setGutschriftSequentialNumber(0);
        }

        toast.success('Invoice o\'chirildi');
        return;
      }

      let updatedInvoice;
      if (existingInvoice) {
        // Update existing invoice
        const response = await invoicesApi.update(existingInvoice.id, { firma });
        updatedInvoice = response.data.invoice;
      } else {
        // Create new invoice only if firma is selected
        const response = await invoicesApi.create({
          bookingId: parseInt(id),
          invoiceType: invoiceType,
          firma: firma,
          totalAmount: 0, // TODO: Calculate from document items
          currency: 'USD'
        });
        updatedInvoice = response.data.invoice;
      }

      // Update state based on invoice type
      if (invoiceType === 'Rechnung') {
        setRechnungInvoice(updatedInvoice);
      } else if (invoiceType === 'Neue Rechnung') {
        setNeueRechnungInvoice(updatedInvoice);
      } else if (invoiceType === 'Gutschrift') {
        setGutschriftInvoice(updatedInvoice);
      }

      // Recalculate sequential numbers based on global list (matching Rechnung module)
      const allInvoicesRes = await invoicesApi.getAll({});
      const allInvoices = allInvoicesRes.data.invoices || [];

      const rechnungTypeInvoices = allInvoices
        .filter(inv =>
          (inv.invoiceType === 'Rechnung' || inv.invoiceType === 'Neue Rechnung') &&
          inv.firma
        )
        .sort((a, b) => a.id - b.id); // Sort by ID (creation order)

      const gutschriftTypeInvoices = allInvoices
        .filter(inv => inv.invoiceType === 'Gutschrift' && inv.firma)
        .sort((a, b) => a.id - b.id);

      if (invoiceType === 'Rechnung' && updatedInvoice) {
        const seqNum = rechnungTypeInvoices.findIndex(inv => inv.id === updatedInvoice.id) + 1;
        setRechnungSequentialNumber(seqNum);
      } else if (invoiceType === 'Neue Rechnung' && updatedInvoice) {
        const seqNum = rechnungTypeInvoices.findIndex(inv => inv.id === updatedInvoice.id) + 1;
        setNeueRechnungSequentialNumber(seqNum);
      } else if (invoiceType === 'Gutschrift' && updatedInvoice) {
        const seqNum = gutschriftTypeInvoices.findIndex(inv => inv.id === updatedInvoice.id) + 1;
        setGutschriftSequentialNumber(seqNum);
      }

      toast.success('Firma saqlandi');
    } catch (error) {
      console.error('Error updating firma:', error);
      toast.error('Xatolik yuz berdi');
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
      'jartepaRate': 'jartepaRate',
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
    // IMPORTANT: Check specific provider variants first, before fallback logic
    if (provider === 'sevil-er') {
      vehicles = sevilErVehicles;
    } else if (provider === 'sevil-co') {
      vehicles = sevilCoVehicles;
    } else if (provider === 'sevil-kas') {
      vehicles = sevilKasVehicles;
    } else if (provider === 'sevil-za') {
      vehicles = sevilZaVehicles;
    } else if (provider === 'sevil') {
      vehicles = sevilVehicles;
    } else if (provider === 'xayrulla') {
      vehicles = xayrullaVehicles;
    } else if (provider === 'nosir') {
      vehicles = nosirVehicles;
    } else if (['pickupDropoff', 'tagRate', 'urgenchRate', 'shovotRate'].includes(rateType)) {
      // Fallback: if no provider set, guess from rate type (Sevil rates)
      vehicles = sevilVehicles;
    } else if (['vstrecha', 'chimgan', 'tag', 'oybek', 'chernyayevka', 'cityTour'].includes(rateType)) {
      // Fallback: Xayrulla rates
      vehicles = xayrullaVehicles;
    } else if (['margilan', 'qoqon', 'dostlik', 'toshkent'].includes(rateType)) {
      // Fallback: Nosir rates
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
    if (provider === 'sevil-er') return sevilErVehicles;
    if (provider === 'sevil-co') return sevilCoVehicles;
    if (provider === 'sevil-kas') return sevilKasVehicles;
    if (provider === 'sevil-za') return sevilZaVehicles;
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
      // For xayrulla and sevil: prefer Yutong over Sprinter when both match
      if (provider === 'xayrulla' || provider === 'sevil' || provider?.startsWith('sevil-')) {
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

    // Determine default Sevil variant based on tour type
    let defaultProvider = 'sevil';
    if (!route.choiceTab) {
      // If no provider set, default to tour-type-specific Sevil
      const tourCode = tourTypeCode || booking?.tourType?.code;
      if (tourCode === 'KAS') defaultProvider = 'sevil-kas';
      else if (tourCode === 'CO') defaultProvider = 'sevil-co';
      else if (tourCode === 'ZA') defaultProvider = 'sevil-za';
      else if (tourCode === 'ER') defaultProvider = 'sevil-er';
    }

    const providerTab = route.choiceTab || defaultProvider;
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
  const getProviderByCity = (city, explicitTourTypeCode = null) => {
    if (!city) return '';
    const cityLower = city.toLowerCase().trim();
    const tourTypeCode = explicitTourTypeCode || booking?.tourType?.code;

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

    // For ZA tours: Samarkand and Bukhara -> Sevil-Za
    if (tourTypeCode === 'ZA') {
      return 'sevil-za';
    }

    // For KAS tours: Samarkand and Bukhara -> Sevil-KAS
    if (tourTypeCode === 'KAS') {
      return 'sevil-kas';
    }

    // For CO tours: Samarkand and Bukhara -> Sevil-CO
    if (tourTypeCode === 'CO') {
      return 'sevil-co';
    }

    // For ER tours: Samarkand and Bukhara -> Sevil-ER
    if (tourTypeCode === 'ER') {
      return 'sevil-er';
    }

    // Fallback: generic Sevil (should not reach here if tour type is set)
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

    // 🚀 AUTO-ADJUST NEXT ROUTE DATE (same-day rules)
    const currentRoute = updatedRoutes[routeIndex];
    const nextRoute = updatedRoutes[routeIndex + 1];

    if (currentRoute && nextRoute && newDate) {
      const currentRouteName = (currentRoute.route || '').toLowerCase();
      const nextRouteName = (nextRoute.route || '').toLowerCase();

      // RULE 1: Train Station Drop-off → Samarkand City Tour (SAME DAY)
      if ((currentRouteName.includes('train station') && currentRouteName.includes('drop')) &&
          (nextRouteName.includes('samarkand') || nextRouteName.includes('samarqand'))) {
        updatedRoutes[routeIndex + 1].sana = newDate;
        console.log(`✅ Auto-adjusted: ${nextRoute.route} → ${newDate} (same day as Train Station)`);
        toast.success('Next route date auto-adjusted to same day', { duration: 2000 });
      }
      // RULE 2: Train Station Drop-off → Qoqon/Fergana (SAME DAY)
      else if ((currentRouteName.includes('train station') && currentRouteName.includes('drop')) &&
               (nextRouteName.includes('qoqon') || (nextRouteName.includes('fergana') && !nextRouteName.includes('tashkent')))) {
        updatedRoutes[routeIndex + 1].sana = newDate;
        console.log(`✅ Auto-adjusted: ${nextRoute.route} → ${newDate} (same day as Train Station)`);
        toast.success('Next route date auto-adjusted to same day', { duration: 2000 });
      }
      // RULE 3: Airport Pickup → Samarkand City Tour (SAME DAY)
      else if (currentRouteName.includes('airport pickup') &&
               (nextRouteName.includes('samarkand') || nextRouteName.includes('samarqand'))) {
        updatedRoutes[routeIndex + 1].sana = newDate;
        console.log(`✅ Auto-adjusted: ${nextRoute.route} → ${newDate} (same day as Airport Pickup)`);
        toast.success('Next route date auto-adjusted to same day', { duration: 2000 });
      }
    }

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
    // FIX: Find route with LATEST date, not just last array element
    const routesWithDates = erRoutes.filter(r => r.sana && r.sana !== 'Invalid Date');
    let lastRoute = null;

    if (routesWithDates.length > 0) {
      // Sort by date and get the latest one
      const sortedByDate = [...routesWithDates].sort((a, b) => {
        const dateA = new Date(a.sana);
        const dateB = new Date(b.sana);
        return dateB - dateA; // Descending order (latest first)
      });
      lastRoute = sortedByDate[0];
    } else {
      lastRoute = erRoutes[erRoutes.length - 1];
    }

    // Use Math.max to find highest ID
    const newId = erRoutes.length > 0 ? Math.max(...erRoutes.map(r => r.id)) + 1 : 1;

    // Calculate next dayOffset and date
    const newDayOffset = lastRoute?.dayOffset != null ? lastRoute.dayOffset + 1 : erRoutes.length;
    let nextDate = '';

    // Calculate date: latest route date + 1 day
    if (lastRoute?.sana) {
      const lastDate = new Date(lastRoute.sana);
      nextDate = format(addDays(lastDate, 1), 'yyyy-MM-dd');
      console.log(`📅 New route date: ${nextDate} (latest route was ${lastRoute.sana})`);
    } else if (formData.departureDate) {
      const arrivalDate = addDays(new Date(formData.departureDate), 1);
      nextDate = format(addDays(arrivalDate, newDayOffset), 'yyyy-MM-dd');
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
        itinerary: r.sayohatDasturi || null,  // Save itinerary field
        routeName: r.route || '',
        personCount: parseInt(r.person) || 0,
        transportType: r.transportType || null,
        provider: r.choiceTab || null,
        optionRate: r.choiceRate || null,
        price: parseFloat(r.price) || 0
      }));

      console.log(`💾 Saving ${routesToSave.length} routes to database`);
      await routesApi.bulkUpdate(id, routesToSave);

      // IMPORTANT: Reload routes from database to ensure state matches database
      console.log('🔄 Reloading routes from database...');
      const reloadedRes = await bookingsApi.getRoutes(id);
      const reloadedRoutes = reloadedRes.data.routes || [];

      const mappedReloaded = reloadedRoutes.map((r, index) => ({
        id: r.id,
        nomer: r.dayNumber?.toString() || (index + 1).toString(),
        sana: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
        dayOffset: index,
        shahar: r.city || '',
        sayohatDasturi: r.itinerary || '',
        route: r.routeName || '',
        person: r.personCount?.toString() || '0',
        transportType: r.transportType || '',
        choiceTab: r.provider || '',
        choiceRate: r.optionRate || '',
        price: r.price?.toString() || ''
      }));

      setErRoutes(mappedReloaded);
      console.log('✅ Routes saved and reloaded from database');
      toast.success('Маршруты сохранены');
    } catch (error) {
      console.error('Error saving routes:', error);
      toast.error('Ошибка сохранения маршрутов');
    }
  };

  // Save current routes as template for any tour type (ER, CO, KAS, ZA)
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

      // Allow template saving for all tour types (ER, CO, KAS, ZA)
      // Each tour type can have its own template

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

      // Allow template loading for all tour types (ER, CO, KAS, ZA)
      // Each tour type has its own template in the database

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
        // ZA tours: arrival = departure + 4 days. Other tours: arrival = departure + 1
        const daysToAdd = tourTypeCode === 'ZA' ? 4 : 1;
        const arrivalDate = bookingDepartureDate ? addDays(bookingDepartureDate, daysToAdd) : null;
        const routeDate = arrivalDate ? format(addDays(arrivalDate, template.dayOffset), 'yyyy-MM-dd') : '';

        // Auto-select vehicle based on PAX
        const autoVehicle = template.provider ? getBestVehicleForRoute(template.provider, totalPax) : '';

        // Auto-calculate price from Opex
        const autoPrice = (template.provider && autoVehicle && template.optionRate)
          ? getPriceFromOpex(template.provider, autoVehicle, template.optionRate)
          : '';

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
          price: autoPrice
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

  // Save current accommodations as template for any tour type (ER, CO, KAS, ZA)
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
      const arrivalDate = booking?.arrivalDate ? new Date(booking.arrivalDate) : formData.arrivalDate ? new Date(formData.arrivalDate) : null;

      if (!departureDate) {
        toast.error('Дата вылета не установлена');
        return;
      }

      if (!arrivalDate) {
        toast.error('Дата прибытия не установлена');
        return;
      }

      // CRITICAL: Use arrivalDate as base for tourist dates
      // - ER/CO/KAS tours: tourists' Tour Start = arrivalDate (day they arrive in Uzbekistan)
      // - ZA tours: Excel date → booking.departureDate (+4) → Uzbekistan arrival (+4)
      // Example: Excel 23.08 → departureDate 27.08 → arrival 31.08
      const baseDate = tourTypeCode === 'ZA'
        ? new Date(departureDate.getTime() + (4 * 24 * 60 * 60 * 1000)) // +4 days
        : arrivalDate; // Use arrivalDate for ER/CO/KAS tours

      if (tourTypeCode === 'ZA') {
        console.log(`📅 ZA tour: Base date adjusted from ${departureDate.toISOString().split('T')[0]} to ${baseDate.toISOString().split('T')[0]} (arrival in Uzbekistan)`);
      } else {
        console.log(`📅 ${tourTypeCode} tour: Base date = ${baseDate.toISOString().split('T')[0]} (arrival date)`);
      }

      // Create accommodations from templates
      console.log(`🏨 Creating ${templates.length} accommodations from template...`);
      setSaving(true);

      const createdAccommodations = [];
      for (const template of templates) {
        // Calculate actual dates from offsets using baseDate (adjusted for ZA)
        const checkInDate = new Date(baseDate);
        checkInDate.setDate(checkInDate.getDate() + template.checkInOffset);

        const checkOutDate = new Date(baseDate);
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
      const accResponse = await bookingsApi.getAccommodations(booking.id);
      setAccommodations(accResponse.data.accommodations || []);
    } catch (error) {
      console.error('❌ Error loading accommodation template:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Ошибка загрузки шаблона: ' + (error.response?.data?.error || error.message));
      setSaving(false);
    }
  };

  // Auto-fix all routes: set correct PAX, vehicle, and price
  // Main dispatcher function - calls appropriate fix function based on tour type
  const autoFixAllRoutes = async () => {
    if (!erRoutes || erRoutes.length === 0) {
      toast.error('No routes to fix');
      return;
    }

    const tourTypeCode = booking?.tourType?.code;
    console.log(`🎯 Fix Vehicle clicked for tour type: ${tourTypeCode}`);

    try {
      setSaving(true);
      toast.loading('Fixing all routes...', { id: 'auto-fix' });

      // Call appropriate function based on tour type
      switch(tourTypeCode) {
        case 'ER':
          await autoFixRoutesER();
          break;
        case 'CO':
          await autoFixRoutesCO();
          break;
        case 'KAS':
          await autoFixRoutesKAS();
          break;
        case 'ZA':
          await autoFixRoutesZA();
          break;
        default:
          toast.error(`Unknown tour type: ${tourTypeCode}`, { id: 'auto-fix' });
      }
    } catch (error) {
      console.error('Error auto-fixing routes:', error);
      toast.error('Error auto-fixing routes', { id: 'auto-fix' });
    } finally {
      setSaving(false);
    }
  };

  // ==================== ER FIX FUNCTION ====================
  const autoFixRoutesER = async () => {
    console.log('🔵 Running ER fix logic...');
    console.log('📊 ER: Loaded vehicles:', {
      'sevil-er': sevilErVehicles.length,
      'sevil-co': sevilCoVehicles.length,
      'sevil-kas': sevilKasVehicles.length,
      'xayrulla': xayrullaVehicles.length,
      'nosir': nosirVehicles.length
    });
    if (sevilErVehicles.length > 0) {
      console.log('  Sevil ER vehicles:', sevilErVehicles.map(v => `${v.name} (${v.person})`));
    } else {
      console.warn('⚠️ WARNING: sevilErVehicles is EMPTY! This will cause pricing issues.');
    }

    try {
      // Load existing routes from database (user's manually corrected structure)
      // We PRESERVE the structure and only update vehicle/provider/price
      const routesRes = await bookingsApi.getRoutes(id);
      const freshRoutes = routesRes.data.routes || [];

      console.log(`📋 ER: Loaded ${freshRoutes.length} existing routes from database`);

      // Check if routes exist and have proper structure
      if (freshRoutes.length === 0) {
        toast.error('No routes found! Please load template or create routes first.', { id: 'auto-fix' });
        return;
      }

      // Map database routes to erRoutes format, preserving city and itinerary fields
      const freshErRoutes = freshRoutes.map((dbRoute, index) => {
        const existingRoute = erRoutes.find(r => r.id === dbRoute.id) || erRoutes[index] || {};
        return {
          ...existingRoute,
          id: dbRoute.id,
          nomer: dbRoute.dayNumber?.toString() || (index + 1).toString(),
          sana: dbRoute.date,
          shahar: dbRoute.city || existingRoute.shahar || '', // city field for Route module
          sayohatDasturi: dbRoute.itinerary || existingRoute.sayohatDasturi || '', // itinerary field for Marshrut varaqasi
          route: dbRoute.routeName || existingRoute.route || '',
          person: dbRoute.personCount?.toString() || existingRoute.person || '0',
          transportType: dbRoute.transportType || existingRoute.transportType || '',
          choiceTab: dbRoute.provider || existingRoute.choiceTab || '',
          choiceRate: dbRoute.optionRate || existingRoute.choiceRate || '',
          price: dbRoute.price?.toString() || existingRoute.price || ''
        };
      });

      console.log('📋 Reloaded routes from database with city and itinerary (Sayohat dasturi) preserved');

      // Calculate PAX counts
      const paxUzb = tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length;
      const paxTkm = tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;
      const totalPax = paxUzb + paxTkm;

      console.log(`🔧 Auto-fixing routes: PAX Total=${totalPax}, UZB=${paxUzb}, TKM=${paxTkm}`);

      // 🎯 DETERMINE SPLIT SCENARIO
      let splitScenario = 'MIXED'; // Default: both UZB and TKM
      if (paxUzb > 0 && paxTkm === 0) {
        splitScenario = 'UZB_ONLY';
        console.log('📍 Scenario: UZB ONLY - All go to Urgench → Tashkent (no Shovot)');
      } else if (paxUzb === 0 && paxTkm > 0) {
        splitScenario = 'TKM_ONLY';
        console.log('📍 Scenario: TKM ONLY - All stay in Khiva → Shovot (no Urgench, no Tashkent)');
      } else if (paxUzb > 0 && paxTkm > 0) {
        splitScenario = 'MIXED';
        console.log('📍 Scenario: MIXED - UZB to Urgench/Tashkent, TKM to Shovot');
      }

      // 🚀 FILTER/MODIFY ROUTES based on scenario BEFORE processing
      let routesToProcess = [...freshErRoutes];

      // 🚂 ENSURE TRAIN STATION DROP-OFF exists (required for ALL ER tours)
      const hasTrainStation = routesToProcess.some(r => {
        const routeLower = (r.route || '').toLowerCase();
        return routeLower.includes('train station') && routeLower.includes('drop');
      });
      const hasSamarkandTour = routesToProcess.some(r => {
        const routeLower = (r.route || '').toLowerCase();
        return routeLower.includes('samarkand') && routeLower.includes('city tour');
      });

      if (!hasTrainStation && hasSamarkandTour) {
        // Train Station Drop-off is missing - create it before Samarkand City Tour
        const samarkandIndex = routesToProcess.findIndex(r => {
          const routeLower = (r.route || '').toLowerCase();
          return routeLower.includes('samarkand') && routeLower.includes('city tour');
        });

        if (samarkandIndex !== -1) {
          const samarkandRoute = routesToProcess[samarkandIndex];
          const nextId = Math.max(...routesToProcess.map(r => r.id || 0), 0) + 1;

          const trainStationRoute = {
            ...samarkandRoute,
            id: nextId,
            route: 'Train Station Drop-off',
            shahar: 'Tashkent',
            person: totalPax.toString(),
            choiceTab: 'xayrulla',
            transportType: null,
            choiceRate: 'vstrecha',
            price: '0'
          };

          // Insert BEFORE first Samarkand City Tour
          routesToProcess.splice(samarkandIndex, 0, trainStationRoute);
          console.log(`✅ ER: Auto-created Train Station Drop-off route (${totalPax} PAX)`);
        }
      }

      if (splitScenario === 'UZB_ONLY') {
        // Remove Shovot route (UZB tourists don't need it)
        routesToProcess = routesToProcess.filter(r => r.route !== 'Khiva - Shovot');
        console.log(`❌ UZB_ONLY: Removed Shovot route`);
      } else if (splitScenario === 'TKM_ONLY') {
        // Remove Urgench route (TKM tourists don't go to Urgench)
        routesToProcess = routesToProcess.filter(r => r.route !== 'Khiva - Urgench');
        console.log(`❌ TKM_ONLY: Removed Urgench route`);

        // Remove Tashkent flight routes (TKM tourists don't fly to Tashkent)
        routesToProcess = routesToProcess.filter(r => {
          const routeLower = (r.route || '').toLowerCase();
          const cityLower = (r.shahar || '').toLowerCase();
          const isTashkentFlight = (routeLower.includes('airport') && cityLower.includes('tashkent'));
          if (isTashkentFlight) {
            console.log(`❌ TKM_ONLY: Removed Tashkent flight route: ${r.route}`);
          }
          return !isTashkentFlight;
        });
      } else if (splitScenario === 'MIXED') {
        // For MIXED scenario, ensure BOTH UZB and TKM routes exist
        let hasUrgenchRoute = routesToProcess.some(r => r.route === 'Khiva - Urgench');
        let hasAirportPickup = routesToProcess.some(r => (r.route || '').toLowerCase().includes('airport pickup'));
        let hasAirportDropoff = routesToProcess.some(r => (r.route || '').toLowerCase().includes('airport drop'));
        let hasShovotRoute = routesToProcess.some(r => r.route === 'Khiva - Shovot');

        // Find reference route - try Urgench first, then Shovot, then any Khiva route
        let referenceRoute = routesToProcess.find(r => r.route === 'Khiva - Urgench') ||
                             routesToProcess.find(r => r.route === 'Khiva - Shovot') ||
                             routesToProcess.find(r => (r.shahar || '').toLowerCase().includes('khiva'));

        if (!referenceRoute) {
          console.warn('⚠️ MIXED: No reference route found for auto-creation, skipping');
        } else {
          let nextId = Math.max(...routesToProcess.map(r => r.id || 0), 0) + 1;

          // Find insertion point - after last Khiva route
          const lastKhivaIndex = routesToProcess.map((r, i) =>
            (r.shahar || '').toLowerCase().includes('khiva') ? i : -1
          ).filter(i => i !== -1).pop();
          let insertIndex = lastKhivaIndex !== -1 ? lastKhivaIndex + 1 : routesToProcess.length;

          // 1. Create Urgench route if missing (UZB group needs this)
          if (!hasUrgenchRoute) {
            const urgenchRoute = {
              ...referenceRoute,
              id: nextId++,
              route: 'Khiva - Urgench',
              shahar: 'Khiva',
              person: paxUzb.toString(),
              choiceTab: 'sevil-er',
              transportType: 'Yutong',
              choiceRate: 'urgenchRate',
              price: '25' // Default price, will be recalculated
            };
            routesToProcess.splice(insertIndex++, 0, urgenchRoute);
            hasUrgenchRoute = true;
            console.log(`✅ MIXED: Auto-created Khiva-Urgench route for UZB group (${paxUzb} PAX)`);
          } else {
            // Urgench exists, insertIndex should be after it
            const urgenchIndex = routesToProcess.findIndex(r => r.route === 'Khiva - Urgench');
            insertIndex = urgenchIndex !== -1 ? urgenchIndex + 1 : insertIndex;
          }

          // 2. Create Airport Pickup if missing (after Urgench)
          if (!hasAirportPickup) {
            const airportPickupRoute = {
              ...referenceRoute,
              id: nextId++,
              route: 'Airport Pickup',
              shahar: 'Tashkent',
              person: paxUzb.toString(),
              choiceTab: 'xayrulla',
              transportType: null,
              choiceRate: 'vstrecha',
              price: '0' // Will be recalculated
            };
            routesToProcess.splice(insertIndex++, 0, airportPickupRoute);
            hasAirportPickup = true;
            console.log(`✅ MIXED: Auto-created Airport Pickup for UZB group (${paxUzb} PAX)`);
          } else {
            const pickupIndex = routesToProcess.findIndex(r => (r.route || '').toLowerCase().includes('airport pickup'));
            insertIndex = pickupIndex !== -1 ? pickupIndex + 1 : insertIndex;
          }

          // 3. Create Airport Drop-off if missing (after Pickup)
          if (!hasAirportDropoff) {
            const airportDropoffRoute = {
              ...referenceRoute,
              id: nextId++,
              route: 'Airport Drop-off',
              shahar: 'Tashkent',
              person: paxUzb.toString(),
              choiceTab: 'xayrulla',
              transportType: null,
              choiceRate: 'vstrecha',
              price: '0' // Will be recalculated
            };
            routesToProcess.splice(insertIndex++, 0, airportDropoffRoute);
            hasAirportDropoff = true;
            console.log(`✅ MIXED: Auto-created Airport Drop-off for UZB group (${paxUzb} PAX)`);
          } else {
            const dropoffIndex = routesToProcess.findIndex(r => (r.route || '').toLowerCase().includes('airport drop'));
            insertIndex = dropoffIndex !== -1 ? dropoffIndex + 1 : insertIndex;
          }

          // 4. Create Shovot route LAST (after Airport Drop-off) - TKM group goes to Shovot on last day
          if (!hasShovotRoute) {
            const shovotRoute = {
              ...referenceRoute,
              id: nextId++,
              route: 'Khiva - Shovot',
              shahar: 'Khiva',
              person: paxTkm.toString(),
              choiceTab: 'sevil-er',
              transportType: 'Yutong',
              choiceRate: 'shovotRate',
              price: '50' // Default price, will be recalculated
            };
            routesToProcess.splice(insertIndex, 0, shovotRoute);
            hasShovotRoute = true;
            console.log(`✅ MIXED: Auto-created Khiva-Shovot route for TKM group (${paxTkm} PAX) - LAST DAY`);
          }
        }

        console.log(`✅ MIXED: Routes ready for split logic - UZB (${paxUzb} PAX) to Urgench/Tashkent, TKM (${paxTkm} PAX) to Shovot`);
      }

      console.log(`📋 Routes after scenario filtering: ${routesToProcess.length} routes`);

      // Recalculate indices after filtering
      const urgenchIndex = routesToProcess.findIndex(r => r.route === 'Khiva - Urgench');
      const hasShovotRoute = routesToProcess.some(r => r.route === 'Khiva - Shovot');

      // Smart consolidation: Remove exact duplicates while preserving legitimate splits
      // Duplicate = same route name + same date + same vehicle type
      // Split = same route name + same date + DIFFERENT vehicle types (keep all)
      const consolidatedRoutes = [];
      const seenRoutes = new Map(); // Track "routeName|date|vehicle" -> true

      for (const route of routesToProcess) {
        // Skip routes without valid date
        if (!route.sana || route.sana === 'Invalid Date') {
          console.log(`⏭️ ER: Skipping route without valid date: ${route.route}`);
          continue;
        }

        const routeName = route.route || '';
        const routeDate = route.sana;
        const routeVehicle = route.transportType || 'NONE'; // Use 'NONE' if no vehicle set
        const routeKey = `${routeName}|${routeDate}|${routeVehicle}`; // Unique key including vehicle

        // Check if this exact combination already exists
        if (seenRoutes.has(routeKey)) {
          console.log(`⏭️ ER: Skipping EXACT DUPLICATE: ${routeName} on ${routeDate} with ${routeVehicle}`);
          continue;
        }

        // Mark this combination as seen
        seenRoutes.set(routeKey, true);
        consolidatedRoutes.push(route);
      }

      console.log(`📋 ER: Consolidated routes: ${freshErRoutes.length} → ${consolidatedRoutes.length} (removed ${freshErRoutes.length - consolidatedRoutes.length} exact duplicates)`);

      // IMPORTANT: Recalculate indices AFTER consolidation
      const urgenchIndexConsolidated = consolidatedRoutes.findIndex(r => r.route === 'Khiva - Urgench');
      const hasShovotRouteConsolidated = consolidatedRoutes.some(r => r.route === 'Khiva - Shovot');
      console.log(`🔍 ER: After consolidation - Urgench index=${urgenchIndexConsolidated}, Shovot exists=${hasShovotRouteConsolidated}`);

      // Fix each route (using fresh data with Sayohat dasturi preserved)
      // Use flatMap to allow splitting Fergana routes into multiple rows
      const fixedRoutes = consolidatedRoutes.flatMap((route, index) => {
        // Determine PAX for this route
        let routePax = totalPax;

        if (urgenchIndexConsolidated !== -1 && hasShovotRouteConsolidated) {
          if (route.route === 'Khiva - Urgench') {
            routePax = paxUzb;
            console.log(`  Route ${index + 1}: Khiva - Urgench → UZB PAX = ${paxUzb}`);
          } else if (route.route === 'Khiva - Shovot') {
            routePax = paxTkm;
            console.log(`  Route ${index + 1}: Khiva - Shovot → TKM PAX = ${paxTkm}`);
          } else if (index > urgenchIndexConsolidated && route.shahar === 'Tashkent') {
            routePax = paxUzb;
            console.log(`  Route ${index + 1}: ${route.route} (after split, Tashkent) → UZB PAX = ${paxUzb}`);
          }
        }

        if (routePax <= 0) {
          console.log(`  Route ${index + 1}: ${route.route} → Skipped (PAX = 0)`);
          return [route];
        }

        // Get provider - upgrade generic 'sevil' to 'sevil-er' for ER groups
        let provider = route.choiceTab || getProviderByCity(route.shahar, 'ER');
        if (provider === 'sevil') {
          provider = 'sevil-er';  // Upgrade to ER-specific Sevil
          console.log(`  ⬆️ ER: Upgraded generic 'sevil' to 'sevil-er' for route: ${route.route}`);
        }
        console.log(`  🔍 ER Route ${index + 1}: ${route.route} → Provider="${provider}", PAX=${routePax}`);

        // Special handling for Chimgan routes
        const isChimganRoute = route.route === 'Tashkent - Chimgan' ||
                               route.route === 'Tashkent - Chimgan - Tashkent' ||
                               route.route === 'Chimgan Excursion';

        if (isChimganRoute) {
          const chimganPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
          console.log(`  Route ${index + 1}: ${route.route} → Chimgan (Sprinter, $${chimganPrice})`);
          return [{
            ...route,
            person: routePax.toString(),
            choiceTab: 'xayrulla',
            transportType: 'Sprinter',
            choiceRate: 'chimgan',
            price: chimganPrice || route.price
          }];
        }

        // Get best vehicle
        const vehicle = getBestVehicleForRoute(provider, routePax);
        console.log(`  🚗 ER Route ${index + 1}: Best vehicle for ${routePax} PAX = "${vehicle}"`);

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
          if (provider.includes('sevil')) rate = 'tagRate';  // Changed to .includes() for sevil-er, sevil-co, etc.
          else if (provider === 'xayrulla') rate = 'tag';
          else if (provider === 'nosir') rate = 'toshkent';
        }

        // Get price
        const price = getPriceFromOpex(provider, vehicle, rate);
        console.log(`  💰 ER Route ${index + 1}: getPriceFromOpex(provider="${provider}", vehicle="${vehicle}", rate="${rate}") = $${price || '?'}`);
        console.log(`  ✅ ER Route ${index + 1}: ${route.route} → PAX=${routePax}, ${provider}, ${vehicle}, ${rate}, $${price || '?'}`);

        return [{
          ...route,
          person: routePax.toString(),
          choiceTab: provider,
          transportType: vehicle || route.transportType,
          choiceRate: rate || route.choiceRate,
          price: price || route.price
        }];
      });

      // MIXED SCENARIO: Set Airport Drop-off and Shovot to END DATE
      // Both groups leave on the same day (End date)
      if (splitScenario === 'MIXED') {
        const endDate = formData.endDate || booking?.endDate;

        if (endDate) {
          const endFormatted = format(new Date(endDate), 'yyyy-MM-dd');
          const shovotRoute = fixedRoutes.find(r => r.route === 'Khiva - Shovot');
          const airportDropRoute = fixedRoutes.find(r => (r.route || '').toLowerCase().includes('airport drop'));

          // Set Airport Drop-off to End date (UZB group leaves)
          if (airportDropRoute) {
            airportDropRoute.sana = endFormatted;
            console.log(`🔧 MIXED: Set Airport Drop-off date to ${endFormatted} (END DATE - UZB leaves)`);
          }

          // Set Shovot to End date (TKM group leaves)
          if (shovotRoute) {
            shovotRoute.sana = endFormatted;
            console.log(`🔧 MIXED: Set Shovot date to ${endFormatted} (END DATE - TKM leaves)`);
          }
        } else {
          console.warn('⚠️ MIXED: No end date found, cannot set final routes');
        }
      }

      // Sort routes by date to maintain correct order after splitting
      // Secondary sort: Airport Drop-off before Shovot if same date
      const sortedRoutes = fixedRoutes.sort((a, b) => {
        const dateA = a.sana ? new Date(a.sana) : new Date(0);
        const dateB = b.sana ? new Date(b.sana) : new Date(0);
        const dateDiff = dateA - dateB;

        // If dates are equal, ensure Airport Drop-off comes before Shovot
        if (dateDiff === 0) {
          const aIsAirportDrop = (a.route || '').toLowerCase().includes('airport drop');
          const bIsAirportDrop = (b.route || '').toLowerCase().includes('airport drop');
          const aIsShovot = a.route === 'Khiva - Shovot';
          const bIsShovot = b.route === 'Khiva - Shovot';

          if (aIsAirportDrop && bIsShovot) return -1; // Airport Drop first
          if (aIsShovot && bIsAirportDrop) return 1;  // Shovot last
        }

        return dateDiff;
      });

      // SINGLE PASS: Fill dates sequentially with same-day rules applied inline
      console.log('===== AUTO DATE FILLING START =====');

      // IMPORTANT: Set first route date to ARRIVAL date
      if (sortedRoutes.length > 0) {
        // Try multiple sources for arrival date
        const arrivalDate = formData.arrivalDate || booking?.arrivalDate;

        console.log('🔍 ER: Checking arrival date sources:');
        console.log('  - formData.arrivalDate:', formData.arrivalDate);
        console.log('  - booking.arrivalDate:', booking?.arrivalDate);

        if (arrivalDate) {
          const arrivalFormatted = format(new Date(arrivalDate), 'yyyy-MM-dd');
          sortedRoutes[0].sana = arrivalFormatted;
          console.log(`0. ER: First route (${sortedRoutes[0].route}) → ${arrivalFormatted} (ARRIVAL DATE)`);
        } else {
          console.warn('⚠️ ER: No arrival date found, using existing date for first route');
        }
      }

      for (let i = 1; i < sortedRoutes.length; i++) {
        const prevRoute = sortedRoutes[i - 1];
        const currentRoute = sortedRoutes[i];
        const prevRouteName = (prevRoute.route || '').toLowerCase();
        const currentRouteName = (currentRoute.route || '').toLowerCase();

        // Calculate next day from previous route
        const prevDate = new Date(prevRoute.sana);
        const nextDay = new Date(prevDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayFormatted = format(nextDay, 'yyyy-MM-dd');

        // RULE 1: Airport Pickup (to train station) + Samarkand City Tour (SAME DAY)
        // Also handles "Train Station Drop-off" name variant
        if ((prevRouteName.includes('airport pickup') || (prevRouteName.includes('train station') && prevRouteName.includes('drop'))) &&
            (currentRouteName.includes('samarkand') || currentRouteName.includes('samarqand'))) {
          currentRoute.sana = prevRoute.sana; // Same day
          console.log(`${i}. ${currentRoute.route} → ${prevRoute.sana} (same day as train to Samarkand)`);
        }
        // RULE 2: Khiva-Urgench + Airport Pickup (SAME DAY)
        else if (prevRouteName.includes('khiva') && prevRouteName.includes('urgench') &&
                 (currentRouteName.includes('airport') || currentRouteName.includes('pickup'))) {
          currentRoute.sana = prevRoute.sana; // Same day
          console.log(`${i}. ${currentRoute.route} → ${prevRoute.sana} (same day as Khiva-Urgench)`);
        }
        // RULE 3: Before Khiva-Urgench → +2 days (rest day)
        else if (currentRouteName.includes('khiva') && currentRouteName.includes('urgench')) {
          const twoDaysLater = new Date(prevDate);
          twoDaysLater.setDate(twoDaysLater.getDate() + 2);
          const twoDaysFormatted = format(twoDaysLater, 'yyyy-MM-dd');
          currentRoute.sana = twoDaysFormatted;
          console.log(`${i}. ${currentRoute.route} → ${twoDaysFormatted} (rest day +2)`);
        }
        // RULE 4: Airport Drop-off + Khiva-Shovot (SAME DAY) - Final split day
        else if ((prevRouteName.includes('airport') && prevRouteName.includes('drop')) &&
                 (currentRouteName.includes('khiva') && currentRouteName.includes('shovot'))) {
          currentRoute.sana = prevRoute.sana; // Same day
          console.log(`${i}. ${currentRoute.route} → ${prevRoute.sana} (same day as Airport Drop-off - final split)`);
        }
        // DEFAULT: Next day (+1)
        else {
          currentRoute.sana = nextDayFormatted;
          console.log(`${i}. ${currentRoute.route} → ${nextDayFormatted} (sequential +1)`);
        }
      }

      console.log('===== AUTO DATE FILLING END =====');

      // Re-assign row numbers sequentially
      const numberedRoutes = sortedRoutes.map((route, index) => ({
        ...route,
        nomer: (index + 1).toString(),
        id: route.id || index + 1
      }));

      console.log('✅ Routes sorted and re-numbered:', numberedRoutes.map((r, i) =>
        `${i+1}. ${r.sana} ${r.route} → ${r.person} PAX, ${r.transportType || '?'}`
      ));

      // DO NOT update state here - wait for database reload
      // setErRoutes(numberedRoutes); ← REMOVED to prevent duplicates

      // Save to database with smart dayNumber handling for splits (preserve both city and itinerary fields!)
      let currentDay = 1;
      let lastSplitGroup = null;
      const routesToSave = numberedRoutes.map((r, index) => {
        // If this is a split route and part of the same split group as previous, keep same day
        if (r.isSplit && r.splitGroup === lastSplitGroup) {
          // Same day as previous split route
        } else {
          // New day (either not a split, or first route in a new split group)
          if (index > 0) currentDay++;
          lastSplitGroup = r.isSplit ? r.splitGroup : null;
        }

        return {
          dayNumber: currentDay,
          date: r.sana || null,
          city: r.shahar || null,
          itinerary: r.sayohatDasturi || null,  // Preserve Sayohat dasturi!
          routeName: r.route || '',
          personCount: parseInt(r.person) || 0,
          transportType: r.transportType || null,
          provider: r.choiceTab || null,
          optionRate: r.choiceRate || null,
          price: parseFloat(r.price) || 0
        };
      });

      console.log(`💾 Saving ${routesToSave.length} routes to database:`);
      routesToSave.forEach((r, i) => {
        console.log(`  ${i+1}. [Day ${r.dayNumber}] ${r.date} - ${r.routeName} → ${r.personCount} PAX, ${r.transportType || 'NULL'}, $${r.price}`);
      });

      await routesApi.bulkUpdate(id, routesToSave);

      // IMPORTANT: Reload routes from database to ensure state matches database
      console.log('🔄 Reloading routes from database...');
      const reloadedRes = await bookingsApi.getRoutes(id);
      const reloadedRoutes = reloadedRes.data.routes || [];

      console.log(`📥 Reloaded ${reloadedRoutes.length} routes from database:`);
      reloadedRoutes.forEach((r, i) => {
        console.log(`  ${i+1}. [Day ${r.dayNumber}] ${r.date} - ${r.routeName} → ${r.personCount} PAX, ${r.transportType || 'NULL'}, $${r.price}`);
      });

      // Map reloaded routes to erRoutes format
      const mappedReloaded = reloadedRoutes.map((r, index) => ({
        id: r.id,
        nomer: r.dayNumber?.toString() || (index + 1).toString(),
        sana: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
        dayOffset: index,
        shahar: r.city || '',
        sayohatDasturi: r.itinerary || '',
        route: r.routeName || '',
        person: r.personCount?.toString() || '0',
        transportType: r.transportType || '',
        choiceTab: r.provider || '',
        choiceRate: r.optionRate || '',
        price: r.price?.toString() || ''
      }));

      setErRoutes(mappedReloaded);

      toast.success('ER routes auto-fixed!', { id: 'auto-fix' });
      console.log('✅ ER routes fixed, saved, and reloaded from database');
    } catch (error) {
      console.error('Error auto-fixing ER routes:', error);
      throw error; // Re-throw to be caught by main dispatcher
    }
  };

  // ==================== CO FIX FUNCTION ====================
  const autoFixRoutesCO = async () => {
    console.log('🟢 Running CO fix logic...');
    console.log('📊 CO: Loaded vehicles:', {
      'sevil-co': sevilCoVehicles.length,
      'sevil-kas': sevilKasVehicles.length,
      'sevil-er': sevilErVehicles.length,
      'xayrulla': xayrullaVehicles.length,
      'nosir': nosirVehicles.length
    });
    if (sevilCoVehicles.length > 0) {
      console.log('  Sevil CO vehicles:', sevilCoVehicles.map(v => `${v.name} (${v.person})`));
    } else {
      console.warn('⚠️ WARNING: sevilCoVehicles is EMPTY! This will cause pricing issues.');
    }

    try {
      // Reload routes from database
      const routesRes = await bookingsApi.getRoutes(id);
      let freshRoutes = routesRes.data.routes || [];

      // Use booking.arrivalDate as the starting point for routes
      // (dates are automatically calculated when PDF is imported)
      const routeStartDate = new Date(booking.arrivalDate);
      console.log(`📅 CO: Route dates will start from Arrival date: ${routeStartDate.toISOString().split('T')[0]}`);

      // Recalculate route dates based on arrivalDate (accounting for dayNumber, not index)
      freshRoutes = freshRoutes.map((route, index) => {
        // Use dayNumber to calculate date (split routes share same dayNumber)
        const dayOffset = (route.dayNumber || (index + 1)) - 1;
        const routeDate = new Date(routeStartDate);
        routeDate.setDate(routeDate.getDate() + dayOffset);
        return {
          ...route,
          date: routeDate.toISOString().split('T')[0]
        };
      });

      console.log(`📅 CO: Recalculated ${freshRoutes.length} route dates starting from ${routeStartDate.toISOString().split('T')[0]}`);

      // Map database routes to erRoutes format (using recalculated dates!)
      const freshErRoutes = freshRoutes.map((dbRoute, index) => {
        const existingRoute = erRoutes.find(r => r.id === dbRoute.id) || erRoutes[index] || {};
        return {
          ...existingRoute,
          id: dbRoute.id,
          nomer: dbRoute.dayNumber?.toString() || (index + 1).toString(),
          sana: dbRoute.date, // Use the recalculated date from freshRoutes!
          shahar: dbRoute.city || existingRoute.shahar || '',
          sayohatDasturi: dbRoute.itinerary || existingRoute.sayohatDasturi || '',
          route: dbRoute.routeName || existingRoute.route || '',
          person: dbRoute.personCount?.toString() || existingRoute.person || '0',
          transportType: dbRoute.transportType || existingRoute.transportType || '',
          choiceTab: dbRoute.provider || existingRoute.choiceTab || '',
          choiceRate: dbRoute.optionRate || existingRoute.choiceRate || '',
          price: dbRoute.price?.toString() || existingRoute.price || ''
        };
      });

      console.log('📋 CO: Reloaded routes from database');

      // Calculate PAX (CO groups have NO TKM split - all tourists go together)
      const totalPax = tourists.length;
      console.log(`🔧 CO Auto-fixing routes: PAX Total=${totalPax} (no UZB/TKM split)`);

      // Consolidate Fergana routes (CO groups ALWAYS have Fergana)
      const consolidatedRoutes = [];
      let ferganaRouteFound = false;

      for (const route of freshErRoutes) {
        const isFergana = route.route === 'Fergana - Tashkent';

        if (!route.sana || route.sana === 'Invalid Date') {
          console.log(`⏭️ Skipping route without valid date: ${route.route}`);
          continue;
        }

        if (isFergana) {
          if (!ferganaRouteFound) {
            ferganaRouteFound = true;
            console.log(`✅ CO: Keeping first Fergana-Tashkent route: ${route.sana}`);
            consolidatedRoutes.push(route);
          } else {
            console.log(`⏭️ CO: Skipping duplicate Fergana-Tashkent: ${route.sana}`);
          }
        } else {
          consolidatedRoutes.push(route);
        }
      }

      console.log(`📋 CO: Consolidated ${freshErRoutes.length} → ${consolidatedRoutes.length} routes`);

      // Fix each route
      const fixedRoutes = consolidatedRoutes.flatMap((route, index) => {
        let routePax = totalPax; // CO: all tourists go together (no split)

        if (routePax <= 0) {
          console.log(`  CO Route ${index + 1}: ${route.route} → Skipped (PAX = 0)`);
          return [route];
        }

        // Get provider - upgrade generic 'sevil' to 'sevil-co' for CO groups
        let provider = route.choiceTab || getProviderByCity(route.shahar, 'CO');
        if (provider === 'sevil') {
          provider = 'sevil-co';  // Upgrade to CO-specific Sevil
          console.log(`  ⬆️ CO: Upgraded generic 'sevil' to 'sevil-co' for route: ${route.route}`);
        }

        // DEBUG: Check provider and available vehicles
        const availableVehicles = getVehiclesByProvider(provider);
        console.log(`  🔍 CO Route ${index + 1}: City="${route.shahar}", Provider="${provider}", Available vehicles:`, availableVehicles.length, availableVehicles.map(v => v.name));

        // Chimgan routes
        const isChimganRoute = route.route === 'Tashkent - Chimgan - Tashkent';
        if (isChimganRoute) {
          const chimganPrice = getPriceFromOpex('xayrulla', 'Sprinter', 'chimgan');
          console.log(`  CO Route ${index + 1}: ${route.route} → Chimgan (Sprinter, $${chimganPrice})`);
          return [{
            ...route,
            person: routePax.toString(),
            choiceTab: 'xayrulla',
            transportType: 'Sprinter',
            choiceRate: 'chimgan',
            price: chimganPrice || route.price
          }];
        }

        // Fergana-Tashkent routes (DYNAMIC split based on PAX)
        const isFerganaRoute = route.route === 'Fergana - Tashkent';
        if (isFerganaRoute) {
          const provider = 'nosir';
          const rateType = 'toshkent';
          const ferganaPax = routePax + 1; // +1 for guide

          console.log(`  CO Route ${index + 1}: ${route.route} → Fergana with guide: ${routePax} + 1 = ${ferganaPax}`);

          // CO: DYNAMIC split - calculate optimal Staria + PKW combination
          const stariaCapacity = 5;
          const pkwCapacity = 3;

          // Maximize Staria usage (more efficient)
          const stariaCount = Math.floor(ferganaPax / stariaCapacity);
          const remaining = ferganaPax % stariaCapacity;

          // Calculate PKWs for remaining passengers
          const pkwCount = remaining > 0 ? Math.ceil(remaining / pkwCapacity) : 0;

          console.log(`    → CO: ${ferganaPax} PAX → ${stariaCount}× Staria (${stariaCount * 5} PAX) + ${pkwCount}× PKW (${remaining} PAX)`);

          const stariaPrice = getPriceFromOpex(provider, 'Staria', rateType);
          const pkwPrice = getPriceFromOpex(provider, 'PKW', rateType);
          const splitRoutes = [];

          // Generate unique split group ID (using date + route name)
          const splitGroupId = `${route.sana}_${route.route}`;

          // Add Staria routes
          for (let i = 0; i < stariaCount; i++) {
            splitRoutes.push({
              ...route,
              person: '5',
              choiceTab: provider,
              transportType: 'Staria',
              choiceRate: rateType,
              price: stariaPrice || route.price,
              isSplit: true,
              splitGroup: splitGroupId,
              splitIndex: i
            });
          }

          // Add PKW routes
          for (let i = 0; i < pkwCount; i++) {
            splitRoutes.push({
              ...route,
              person: remaining.toString(),
              choiceTab: provider,
              transportType: 'PKW',
              choiceRate: rateType,
              price: pkwPrice || route.price,
              isSplit: true,
              splitGroup: splitGroupId,
              splitIndex: stariaCount + i
            });
          }

          console.log(`    → CO: Split result: ${stariaCount}× Staria ($${stariaPrice} each) + ${pkwCount}× PKW ($${pkwPrice} each)`);
          console.log(`    → CO: All split routes marked with splitGroup="${splitGroupId}"`);
          return splitRoutes;
        }

        // Get best vehicle for route
        const vehicle = getBestVehicleForRoute(provider, routePax);
        console.log(`  🚗 CO Route ${index + 1}: Best vehicle for ${routePax} PAX = "${vehicle}"`);

        // Get rate type
        let rate = '';
        const routeLower = route.route.toLowerCase();
        if (routeLower.includes('city tour')) {
          rate = provider === 'xayrulla' ? 'cityTour' : 'tagRate';
        } else if (routeLower.includes('urgench')) {
          rate = 'urgenchRate';
        } else if (routeLower.includes('airport') || routeLower.includes('pickup') || routeLower.includes('drop')) {
          rate = provider === 'xayrulla' ? 'vstrecha' : 'pickupDropoff';
        } else if (routeLower.includes('train station')) {
          rate = provider === 'xayrulla' ? 'vstrecha' : 'pickupDropoff';
        } else {
          if (provider.includes('sevil')) rate = 'tagRate';  // Changed to .includes() for sevil-co, sevil-er, etc.
          else if (provider === 'xayrulla') rate = 'tag';
          else if (provider === 'nosir') rate = 'toshkent';
        }

        const price = getPriceFromOpex(provider, vehicle, rate);
        console.log(`  💰 CO Route ${index + 1}: getPriceFromOpex(provider="${provider}", vehicle="${vehicle}", rate="${rate}") = $${price || '?'}`);
        console.log(`  ✅ CO Route ${index + 1}: ${route.route} → PAX=${routePax}, ${provider}, ${vehicle}, ${rate}, $${price || '?'}`);

        return [{
          ...route,
          person: routePax.toString(),
          choiceTab: provider,
          transportType: vehicle || route.transportType,
          choiceRate: rate || route.choiceRate,
          price: price || route.price
        }];
      });

      console.log(`✅ CO: Fixed ${fixedRoutes.length} routes (after Fergana split)`);

      // Re-assign row numbers
      const numberedRoutes = fixedRoutes.map((route, index) => ({
        ...route,
        nomer: (index + 1).toString(),
        id: route.id || index + 1
      }));

      // Save to database with smart dayNumber handling for splits and same-day routes
      let currentDay = 1;
      let lastSplitGroup = null;
      let lastSavedDate = null;
      const routesToSave = numberedRoutes.map((r, index) => {
        const prevRoute = index > 0 ? numberedRoutes[index - 1] : null;
        const currentRouteLower = (r.route || '').toLowerCase();
        const prevRouteLower = prevRoute ? (prevRoute.route || '').toLowerCase() : '';
        let isSameDay = false;

        // RULE 1: Split routes (same splitGroup) → same day
        if (r.isSplit && r.splitGroup === lastSplitGroup) {
          isSameDay = true;
          // Same day as previous split route
        }
        // RULE 2: Train Station Drop-off + Qoqon-Fergana → same day
        else if (prevRouteLower.includes('train station') && prevRouteLower.includes('drop') &&
                 (currentRouteLower.includes('qoqon') || currentRouteLower.includes('fergana'))) {
          isSameDay = true;
          console.log(`  📅 CO: ${r.route} → Same day as Train Station Drop-off (Qoqon/Fergana)`);
          // Same day as previous route (don't increment)
        }
        // RULE 3: Train Station Drop-off + Samarkand City Tour → same day
        else if (prevRouteLower.includes('train station') && prevRouteLower.includes('drop') &&
                 (currentRouteLower.includes('samarkand') || currentRouteLower.includes('samarqand'))) {
          isSameDay = true;
          console.log(`  📅 CO: ${r.route} → Same day as Train Station Drop-off (Samarkand)`);
          // Same day as previous route (don't increment)
        }
        // DEFAULT: New day
        else {
          if (index > 0) currentDay++;
          lastSplitGroup = r.isSplit ? r.splitGroup : null;
        }

        // Use previous route's date if same day, otherwise use current route's date
        const routeDate = isSameDay && lastSavedDate ? lastSavedDate : (r.sana || null);
        lastSavedDate = routeDate;

        return {
          dayNumber: currentDay,
          date: routeDate,
          city: r.shahar || null,
          itinerary: r.sayohatDasturi || null,
          routeName: r.route || '',
          personCount: parseInt(r.person) || 0,
          transportType: r.transportType || null,
          provider: r.choiceTab || null,
          optionRate: r.choiceRate || null,
          price: parseFloat(r.price) || 0
        };
      });

      // 🚀 RECALCULATE DATES based on new dayNumbers
      console.log('📅 CO: Recalculating dates based on new dayNumbers...');
      const arrivalDate = new Date(booking.arrivalDate);
      routesToSave.forEach((route, index) => {
        const dayOffset = route.dayNumber - 1;
        const calculatedDate = new Date(arrivalDate);
        calculatedDate.setDate(calculatedDate.getDate() + dayOffset);
        route.date = format(calculatedDate, 'yyyy-MM-dd');
        console.log(`  Route ${index + 1} (${route.routeName}): dayNumber=${route.dayNumber} → date=${route.date}`);
      });

      console.log(`💾 CO: Saving ${routesToSave.length} routes to database`);
      await routesApi.bulkUpdate(id, routesToSave);

      // Reload from database
      console.log('🔄 CO: Reloading routes from database...');
      const reloadedRes = await bookingsApi.getRoutes(id);
      const reloadedRoutes = reloadedRes.data.routes || [];

      const mappedReloaded = reloadedRoutes.map((r, index) => ({
        id: r.id,
        nomer: r.dayNumber?.toString() || (index + 1).toString(),
        sana: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
        dayOffset: index,
        shahar: r.city || '',
        sayohatDasturi: r.itinerary || '',
        route: r.routeName || '',
        person: r.personCount?.toString() || '0',
        transportType: r.transportType || '',
        choiceTab: r.provider || '',
        choiceRate: r.optionRate || '',
        price: r.price?.toString() || ''
      }));

      setErRoutes(mappedReloaded);

      toast.success('CO routes auto-fixed!', { id: 'auto-fix' });
      console.log('✅ CO routes fixed, saved, and reloaded from database');
    } catch (error) {
      console.error('Error auto-fixing CO routes:', error);
      throw error; // Re-throw to be caught by main dispatcher
    }
  };

  // ==================== KAS FIX FUNCTION ====================
  const autoFixRoutesKAS = async () => {
    console.log('🟡 Running KAS fix logic...');

    try {
      // Reload routes from database
      const routesRes = await bookingsApi.getRoutes(id);
      const freshRoutes = routesRes.data.routes || [];

      // Map database routes
      const freshErRoutes = freshRoutes.map((dbRoute, index) => {
        const existingRoute = erRoutes.find(r => r.id === dbRoute.id) || erRoutes[index] || {};
        return {
          ...existingRoute,
          id: dbRoute.id,
          nomer: dbRoute.dayNumber?.toString() || (index + 1).toString(),
          sana: dbRoute.date,
          shahar: dbRoute.city || existingRoute.shahar || '',
          sayohatDasturi: dbRoute.itinerary || existingRoute.sayohatDasturi || '',
          route: dbRoute.routeName || existingRoute.route || '',
          person: dbRoute.personCount?.toString() || existingRoute.person || '0',
          transportType: dbRoute.transportType || existingRoute.transportType || '',
          choiceTab: dbRoute.provider || existingRoute.choiceTab || '',
          choiceRate: dbRoute.optionRate || existingRoute.choiceRate || '',
          price: dbRoute.price?.toString() || existingRoute.price || ''
        };
      });

      console.log(`📋 KAS: Reloaded ${freshErRoutes.length} routes from database`);
      freshErRoutes.forEach((r, i) => {
        console.log(`  Route ${i+1}: ${r.route} (date: ${r.sana}, city: ${r.shahar})`);
      });

      // Calculate PAX (KAS groups: all tourists go together, no split)
      const totalPax = tourists.length;
      console.log(`🔧 KAS Auto-fixing routes: PAX Total=${totalPax} (no UZB/TKM split)`);

      // Fix each route
      const fixedRoutes = freshErRoutes.map((route, index) => {
        let routePax = totalPax; // KAS: all tourists go together

        if (routePax <= 0) {
          console.log(`  KAS Route ${index + 1}: ${route.route} → Skipped (PAX = 0)`);
          return route;
        }

        // Get provider - upgrade generic 'sevil' to 'sevil-kas'
        let provider = route.choiceTab || getProviderByCity(route.shahar);
        if (provider === 'sevil') {
          provider = 'sevil-kas';  // Upgrade to KAS-specific Sevil
          console.log(`  ⬆️ Upgraded generic 'sevil' to 'sevil-kas' for route: ${route.route}`);
        }

        // Get best vehicle for route
        const vehicle = getBestVehicleForRoute(provider, routePax);

        // Get rate type
        let rate = '';
        const routeLower = route.route.toLowerCase();
        if (routeLower.includes('city tour')) {
          rate = provider === 'xayrulla' ? 'cityTour' : 'tagRate';
        } else if (routeLower.includes('dostlik') || routeLower.includes('fergana')) {
          // Dostlik-Fergana and Fergana-Qoqon use Nosir
          rate = 'toshkent';
        } else if (routeLower.includes('airport') || routeLower.includes('pickup') || routeLower.includes('drop')) {
          rate = provider === 'xayrulla' ? 'vstrecha' : 'pickupDropoff';
        } else if (routeLower.includes('train station')) {
          rate = provider === 'xayrulla' ? 'vstrecha' : 'pickupDropoff';
        } else {
          // Inter-city routes
          if (provider.includes('sevil')) rate = 'tagRate';  // Changed to .includes() for sevil-kas, sevil-er, etc.
          else if (provider === 'xayrulla') rate = 'tag';
          else if (provider === 'nosir') rate = 'toshkent';
        }

        const price = getPriceFromOpex(provider, vehicle, rate);
        console.log(`  KAS Route ${index + 1}: ${route.route} → PAX=${routePax}, ${provider}, ${vehicle}, ${rate}, $${price || '?'}`);

        return {
          ...route,
          person: routePax.toString(),
          choiceTab: provider,
          transportType: vehicle || route.transportType,
          choiceRate: rate || route.choiceRate,
          price: price || route.price
        };
      });

      console.log(`📊 KAS: Fixed ${fixedRoutes.length} routes`);
      fixedRoutes.forEach((r, i) => {
        console.log(`  Fixed ${i+1}: ${r.route} → ${r.person} PAX, ${r.transportType}, ${r.choiceTab}, $${r.price}`);
      });

      // Sort routes by date
      const sortedRoutes = fixedRoutes.sort((a, b) => {
        const dateA = a.sana ? new Date(a.sana) : new Date(0);
        const dateB = b.sana ? new Date(b.sana) : new Date(0);
        return dateA - dateB;
      });

      // KAS DATE FILLING RULES
      console.log('===== KAS AUTO DATE FILLING START =====');

      // Set first route date to ARRIVAL date
      if (sortedRoutes.length > 0) {
        const arrivalDate = formData.arrivalDate || booking?.arrivalDate;

        console.log('🔍 KAS: Checking arrival date sources:');
        console.log('  - formData.arrivalDate:', formData.arrivalDate);
        console.log('  - booking.arrivalDate:', booking?.arrivalDate);

        if (arrivalDate) {
          const arrivalFormatted = format(new Date(arrivalDate), 'yyyy-MM-dd');
          sortedRoutes[0].sana = arrivalFormatted;
          console.log(`0. KAS: First route (${sortedRoutes[0].route}) → ${arrivalFormatted} (ARRIVAL DATE)`);
        } else {
          console.warn('⚠️ KAS: No arrival date found, using existing date for first route');
        }
      }

      // Fill remaining dates
      for (let i = 1; i < sortedRoutes.length; i++) {
        const prevRoute = sortedRoutes[i - 1];
        const currentRoute = sortedRoutes[i];
        const prevRouteName = (prevRoute.route || '').toLowerCase();
        const currentRouteName = (currentRoute.route || '').toLowerCase();

        const prevDate = new Date(prevRoute.sana);
        const nextDay = new Date(prevDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayFormatted = format(nextDay, 'yyyy-MM-dd');

        // RULE 1: Day 7 - Samarkand City Tour + Train Station (SAME DAY)
        // If previous route is Samarkand City Tour and current is Train Station, same day
        if (prevRouteName.includes('samarkand') && prevRouteName.includes('city') &&
            currentRouteName.includes('train station')) {
          currentRoute.sana = prevRoute.sana;
          console.log(`${i}. KAS: ${currentRoute.route} → ${prevRoute.sana} (same day as Samarkand City Tour)`);
        }
        // RULE 2: Train Station + next route (SAME DAY if it's pickup/hotel)
        else if (prevRouteName.includes('train station') &&
                 (currentRouteName.includes('pickup') || currentRouteName.includes('hotel'))) {
          currentRoute.sana = prevRoute.sana;
          console.log(`${i}. KAS: ${currentRoute.route} → ${prevRoute.sana} (same day as Train Station)`);
        }
        // DEFAULT: Next day (+1)
        else {
          currentRoute.sana = nextDayFormatted;
          console.log(`${i}. KAS: ${currentRoute.route} → ${nextDayFormatted} (sequential +1)`);
        }
      }

      console.log('===== KAS AUTO DATE FILLING END =====');

      // Re-assign row numbers
      const numberedRoutes = sortedRoutes.map((route, index) => ({
        ...route,
        nomer: (index + 1).toString(),
        id: route.id || index + 1
      }));

      // Save to database
      const routesToSave = numberedRoutes.map((r, index) => ({
        dayNumber: index + 1,
        date: r.sana || null,
        city: r.shahar || null,
        itinerary: r.sayohatDasturi || null,
        routeName: r.route || '',
        personCount: parseInt(r.person) || 0,
        transportType: r.transportType || null,
        provider: r.choiceTab || null,
        optionRate: r.choiceRate || null,
        price: parseFloat(r.price) || 0
      }));

      console.log(`💾 KAS: Saving ${routesToSave.length} routes to database`);
      await routesApi.bulkUpdate(id, routesToSave);

      // Reload from database
      console.log('🔄 KAS: Reloading routes from database...');
      const reloadedRes = await bookingsApi.getRoutes(id);
      const reloadedRoutes = reloadedRes.data.routes || [];

      const mappedReloaded = reloadedRoutes.map((r, index) => ({
        id: r.id,
        nomer: r.dayNumber?.toString() || (index + 1).toString(),
        sana: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
        dayOffset: index,
        shahar: r.city || '',
        sayohatDasturi: r.itinerary || '',
        route: r.routeName || '',
        person: r.personCount?.toString() || '0',
        transportType: r.transportType || '',
        choiceTab: r.provider || '',
        choiceRate: r.optionRate || '',
        price: r.price?.toString() || ''
      }));

      setErRoutes(mappedReloaded);

      toast.success('KAS routes auto-fixed!', { id: 'auto-fix' });
      console.log('✅ KAS routes fixed, saved, and reloaded from database');
    } catch (error) {
      console.error('Error auto-fixing KAS routes:', error);
      throw error; // Re-throw to be caught by main dispatcher
    }
  };

  // ==================== ZA FIX FUNCTION ====================
  const autoFixRoutesZA = async () => {
    console.log('🟣 Running ZA fix logic...');

    try {
      // Reload routes from database
      const routesRes = await bookingsApi.getRoutes(id);
      const freshRoutes = routesRes.data.routes || [];

      let freshErRoutes;

      if (freshRoutes.length === 0) {
        // Database has no routes yet - use current state (from Load Template)
        console.log('📋 ZA: No routes in database, using current state');
        freshErRoutes = [...erRoutes];
      } else {
        // Map database routes
        freshErRoutes = freshRoutes.map((dbRoute, index) => {
          const existingRoute = erRoutes.find(r => r.id === dbRoute.id) || erRoutes[index] || {};
          return {
            ...existingRoute,
            id: dbRoute.id,
            nomer: dbRoute.dayNumber?.toString() || (index + 1).toString(),
            sana: dbRoute.date,
            shahar: dbRoute.city || existingRoute.shahar || '',
            sayohatDasturi: dbRoute.itinerary || existingRoute.sayohatDasturi || '',
            route: dbRoute.routeName || existingRoute.route || '',
            person: dbRoute.personCount?.toString() || existingRoute.person || '0',
            transportType: dbRoute.transportType || existingRoute.transportType || '',
            choiceTab: dbRoute.provider || existingRoute.choiceTab || '',
            choiceRate: dbRoute.optionRate || existingRoute.choiceRate || '',
            price: dbRoute.price?.toString() || existingRoute.price || ''
          };
        });
      }

      console.log(`📋 ZA: Working with ${freshErRoutes.length} routes`);

      // Calculate PAX (ZA groups: all tourists go together, no split)
      const totalPax = tourists.length;
      console.log(`🔧 ZA Auto-fixing routes: PAX Total=${totalPax}`);

      // Fix each route
      const fixedRoutes = freshErRoutes.map((route, index) => {
        let routePax = totalPax;

        if (routePax <= 0) {
          console.log(`  ZA Route ${index + 1}: ${route.route} → Skipped (PAX = 0)`);
          return route;
        }

        const routeLower = (route.route || '').toLowerCase();
        let provider = route.choiceTab || 'sevil-za';
        let rate = '';

        // Determine provider and rate based on route name
        if (routeLower.includes('olot') || routeLower.includes('buxoro') || routeLower.includes('bukhara')) {
          // Olot → Bukhara: use sevil-za with tagRate
          provider = 'sevil-za';
          rate = 'tagRate';
        } else if (routeLower.includes('jartepa') || routeLower.includes('jarteppa')) {
          // Samarkand → Jartepa: use sevil-za with jartepaRate
          provider = 'sevil-za';
          rate = 'jartepaRate';
        } else if (routeLower.includes('samarqand') || routeLower.includes('samarkand')) {
          // Inter-city to Samarkand: use sevil-za with tagRate
          provider = 'sevil-za';
          rate = 'tagRate';
        } else if (routeLower.includes('oybek') || routeLower.includes('toshkent') || routeLower.includes('tashkent')) {
          // Oybek → Tashkent or Tashkent city: use xayrulla
          provider = 'xayrulla';
          if (routeLower.includes('oybek')) {
            rate = 'oybek';
          } else if (routeLower.includes('chernyayevka') || routeLower.includes('city') || routeLower.includes('shahar')) {
            rate = 'chernyayevka';
          } else {
            rate = 'tag'; // Default for Tashkent routes
          }
        } else {
          // Default: sevil-za with tagRate
          provider = 'sevil-za';
          rate = 'tagRate';
        }

        // Get best vehicle for route
        const vehicle = getBestVehicleForRoute(provider, routePax);
        const price = getPriceFromOpex(provider, vehicle, rate);

        console.log(`  ZA Route ${index + 1}: ${route.route} → PAX=${routePax}, ${provider}, ${vehicle}, ${rate}, $${price || '?'}`);

        return {
          ...route,
          person: routePax.toString(),
          choiceTab: provider,
          transportType: vehicle || route.transportType,
          choiceRate: rate || route.choiceRate,
          price: price || route.price
        };
      });

      console.log(`📊 ZA: Fixed ${fixedRoutes.length} routes`);

      // Sort routes by date
      const sortedRoutes = fixedRoutes.sort((a, b) => {
        const dateA = a.sana ? new Date(a.sana) : new Date(0);
        const dateB = b.sana ? new Date(b.sana) : new Date(0);
        return dateA - dateB;
      });

      // Set first route date to ARRIVAL date (arrival = departure + 4 days for ZA)
      if (sortedRoutes.length > 0) {
        const arrivalDate = formData.arrivalDate || booking?.arrivalDate;
        if (arrivalDate) {
          const arrivalFormatted = format(new Date(arrivalDate), 'yyyy-MM-dd');
          sortedRoutes[0].sana = arrivalFormatted;
          console.log(`  ZA: First route (${sortedRoutes[0].route}) → ${arrivalFormatted} (ARRIVAL DATE)`);
        }
      }

      // Fill remaining dates sequentially with Tajikistan gap logic
      for (let i = 1; i < sortedRoutes.length; i++) {
        const prevRoute = sortedRoutes[i - 1];
        const currentRoute = sortedRoutes[i];

        const prevRouteLower = (prevRoute.route || '').toLowerCase();
        const currentRouteLower = (currentRoute.route || '').toLowerCase();

        let daysToAdd = 1; // Default: next day

        // SPECIAL CASE: Jartepa (Tajikistan entry) → Oybek/Tashkent (return from Tajikistan)
        // Group spends 4 days total (including entry day), so next Uzbek route is +4 days
        if ((prevRouteLower.includes('jartepa') || prevRouteLower.includes('jarteppa')) &&
            (currentRouteLower.includes('oybek') || currentRouteLower.includes('tashkent') || currentRouteLower.includes('toshkent'))) {
          daysToAdd = 4; // 4 days in Tajikistan (05.09 → 09.09)
          console.log(`  🇹🇯 ZA: Tajikistan gap detected (${prevRoute.route} → ${currentRoute.route})`);
        }

        const prevDate = new Date(prevRoute.sana);
        const nextDay = new Date(prevDate);
        nextDay.setDate(nextDay.getDate() + daysToAdd);
        const nextDayFormatted = format(nextDay, 'yyyy-MM-dd');

        currentRoute.sana = nextDayFormatted;
        console.log(`  ZA: ${currentRoute.route} → ${nextDayFormatted} (${daysToAdd === 1 ? 'sequential +1' : `+${daysToAdd} days`})`);
      }

      // Re-assign row numbers
      const numberedRoutes = sortedRoutes.map((route, index) => ({
        ...route,
        nomer: (index + 1).toString(),
        id: route.id || index + 1
      }));

      // Save to database
      const routesToSave = numberedRoutes.map((r, index) => ({
        dayNumber: index + 1,
        date: r.sana || null,
        city: r.shahar || null,
        itinerary: r.sayohatDasturi || null,
        routeName: r.route || '',
        personCount: parseInt(r.person) || 0,
        transportType: r.transportType || null,
        provider: r.choiceTab || null,
        optionRate: r.choiceRate || null,
        price: parseFloat(r.price) || 0
      }));

      console.log(`💾 ZA: Saving ${routesToSave.length} routes to database`);
      await routesApi.bulkUpdate(id, routesToSave);

      // Reload from database
      console.log('🔄 ZA: Reloading routes from database...');
      const reloadedRes = await bookingsApi.getRoutes(id);
      const reloadedRoutes = reloadedRes.data.routes || [];

      const mappedReloaded = reloadedRoutes.map((r, index) => ({
        id: r.id,
        nomer: r.dayNumber?.toString() || (index + 1).toString(),
        sana: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
        dayOffset: index,
        shahar: r.city || '',
        sayohatDasturi: r.itinerary || '',
        route: r.routeName || '',
        person: r.personCount?.toString() || '0',
        transportType: r.transportType || '',
        choiceTab: r.provider || '',
        choiceRate: r.optionRate || '',
        price: r.price?.toString() || ''
      }));

      setErRoutes(mappedReloaded);

      toast.success('ZA routes auto-fixed!', { id: 'auto-fix' });
      console.log('✅ ZA routes fixed, saved, and reloaded from database');
    } catch (error) {
      console.error('Error auto-fixing ZA routes:', error);
      throw error; // Re-throw to be caught by main dispatcher
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-blue-100 p-4 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3 md:gap-6 w-full sm:w-auto">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 md:p-3 rounded-xl md:rounded-2xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white transition-all duration-300 shadow-md hover:shadow-xl min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-3xl lg:text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1 md:mb-2 truncate">
                {isNew ? 'Новое бронирование' : formData.bookingNumber}
              </h1>
              {!isNew && booking?.tourType && (
                <p className="text-gray-600 font-semibold text-xs md:text-base flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full text-xs md:text-sm">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0" style={{ backgroundColor: booking.tourType.color }}></span>
                    <span className="truncate">{booking.tourType.code} - {booking.tourType.name}</span>
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
            {editing ? (
              <>
                <button
                  onClick={() => isNew ? navigate(-1) : setEditing(false)}
                  className="px-4 md:px-6 py-2.5 md:py-3 border-2 border-gray-300 rounded-xl md:rounded-2xl hover:bg-white hover:shadow-lg transition-all duration-300 font-bold text-gray-700 min-h-[44px] flex items-center justify-center flex-1 sm:flex-initial"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-4 md:px-8 py-2.5 md:py-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white rounded-xl md:rounded-2xl shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 font-bold text-sm md:text-base min-h-[44px] flex-1 sm:flex-initial"
                >
                  <Save className="w-5 h-5" />
                  <span className="hidden sm:inline">{saving ? 'Сохранение...' : 'Сохранить'}</span>
                  <span className="sm:hidden">{saving ? '...' : 'Save'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 border-2 border-gray-300 rounded-xl md:rounded-2xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-blue-500 transition-all duration-300 font-bold shadow-md hover:shadow-xl text-sm md:text-base min-h-[44px] flex-1 sm:flex-initial"
                >
                  <Edit className="w-5 h-5" />
                  <span className="hidden sm:inline">Редактировать</span>
                  <span className="sm:hidden">Edit</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2.5 md:p-3 text-red-600 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl md:rounded-2xl transition-all duration-300 shadow-md hover:shadow-xl min-w-[44px] min-h-[44px] flex items-center justify-center"
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
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl md:rounded-3xl shadow-2xl border-2 border-gray-100 p-2 md:p-4">
          {/* DESKTOP: Horizontal tabs */}
          {!isMobile && (
            <nav className="flex space-x-2 md:space-x-3 overflow-x-auto pb-1">
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
                  className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2.5 md:py-3.5 text-xs md:text-sm font-bold rounded-xl md:rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white shadow-blue-500/30 scale-105 md:scale-110 -translate-y-0.5'
                      : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                  }`}
                >
                  <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          )}

          {/* MOBILE: Hamburger menu */}
          {isMobile && (
            <div className="relative">
              {/* Current tab + Menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const tabs = [
                      { id: 'info', label: 'Information', icon: MapPin },
                      { id: 'rooms', label: 'Rooms', icon: Building2 },
                      { id: 'tourists', label: 'Tourists', icon: Users },
                      { id: 'rooming-list', label: 'Final List', icon: List },
                      { id: 'rooming', label: 'Fly&Railway', icon: Plane },
                      { id: 'route', label: 'Route', icon: Car },
                      { id: 'documents', label: 'Documents', icon: FileText },
                      { id: 'tour-services', label: 'Tour Services', icon: ClipboardList },
                      { id: 'costs', label: 'Costs', icon: DollarSign }
                    ];
                    const currentTab = tabs.find(t => t.id === activeTab);
                    const Icon = currentTab?.icon || MapPin;
                    return (
                      <>
                        <Icon className="w-5 h-5" />
                        <span className="font-bold text-sm">{currentTab?.label || 'Menu'}</span>
                      </>
                    );
                  })()}
                </div>
                <Menu className="w-5 h-5" />
              </button>

              {/* Dropdown menu */}
              {mobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileMenuOpen(false)}
                  />

                  {/* Menu items */}
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-gray-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
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
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-all border-b border-gray-100 last:border-b-0 ${
                          activeTab === tab.id
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <tab.icon className="w-5 h-5" />
                          <span className="font-semibold text-sm">{tab.label}</span>
                        </div>
                        {activeTab === tab.id && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Content */}
      {!isNew && activeTab === 'tourists' && (
        <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-blue-100 p-4 md:p-8">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <TouristsList bookingId={parseInt(id)} onUpdate={loadData} />
        </div>
      )}

      {!isNew && activeTab === 'rooming-list' && (
        <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-indigo-100 p-4 md:p-8">
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
                                      <td className="px-4 py-3 font-medium text-gray-700">{flight.route || `${flight.departure || '-'} → ${flight.arrival || '-'}`}</td>
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
                                      <td className="px-4 py-3 font-medium text-gray-700">{flight.route || `${flight.departure || '-'} → ${flight.arrival || '-'}`}</td>
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
                                      <td className="px-4 py-3 font-bold text-blue-900">{railway.trainName || railway.trainNumber || '-'}</td>
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
                                      <td className="px-4 py-3 font-bold text-emerald-900">{railway.trainName || railway.trainNumber || '-'}</td>
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
          {flightModalOpen && (() => {
            // Load flights from Opex database (loaded from API on mount)
            const opexFlights = getFlightsFromOpex(planeVehicles);

            return (
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
                      onChange={(e) => {
                        const newType = e.target.value;
                        const newPax = calculateFlightPax(newType, flightForm.route);
                        console.log(`🔄 Flight type changed to ${newType}, PAX updated to ${newPax}`);
                        setFlightForm({ ...flightForm, type: newType, pax: newPax });
                      }}
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
                        const selectedFlight = opexFlights[flightForm.type]?.find(f => f.flightNumber === e.target.value);
                        if (selectedFlight) {
                          // Auto-populate date based on flight type and route
                          let autoDate = '';
                          if (booking) {
                            // Check if it's Tashkent-Istanbul return flight
                            const routeLower = (selectedFlight.route || '').toLowerCase();
                            const isTashkentToIstanbul =
                              routeLower.includes('tashkent-istanbul') ||
                              routeLower.includes('tas-ist') ||
                              routeLower.includes('ташкент-стамбул');

                            if (flightForm.type === 'INTERNATIONAL') {
                              if (isTashkentToIstanbul) {
                                // Tashkent → Istanbul (return): tour end date
                                autoDate = booking.endDate ? format(new Date(booking.endDate), 'yyyy-MM-dd') : '';
                                console.log('📅 TAS→IST return flight: using tour end date', autoDate);
                              } else {
                                // Istanbul → Tashkent (arrival): arrival date (group arrives +1 day)
                                autoDate = booking.departureDate ? format(addDays(new Date(booking.departureDate), 1), 'yyyy-MM-dd') : '';
                                console.log('📅 IST→TAS arrival flight: using arrival date (+1 day)', autoDate);
                              }
                            } else if (flightForm.type === 'DOMESTIC') {
                              // Domestic: 1 day before group departure
                              if (booking.endDate) {
                                const endDate = new Date(booking.endDate);
                                const oneDayBefore = addDays(endDate, -1);
                                autoDate = format(oneDayBefore, 'yyyy-MM-dd');
                                console.log('📅 DOMESTIC flight: using 1 day before end date', autoDate);
                              }
                            }
                          }

                          // Calculate smart PAX based on tour type, flight type, and route
                          const smartPax = calculateFlightPax(flightForm.type, selectedFlight.route);

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
                            pax: smartPax
                          });
                        } else {
                          setFlightForm({ ...flightForm, flightNumber: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="">Select flight number...</option>
                      {opexFlights[flightForm.type]?.map(flight => (
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      {/* Info message for ER + DOMESTIC or ER + TAS-IST auto-calculation */}
                      {booking?.tourType?.code === 'ER' && (() => {
                        const routeLower = (flightForm.route || '').toLowerCase();
                        const isTashkentToIstanbul =
                          routeLower.includes('tashkent-istanbul') ||
                          routeLower.includes('tas-ist') ||
                          routeLower.includes('ташкент-стамбул');
                        const shouldShowInfo =
                          flightForm.type === 'DOMESTIC' ||
                          (flightForm.type === 'INTERNATIONAL' && isTashkentToIstanbul);

                        if (shouldShowInfo) {
                          const uzTourists = tourists.filter(t => {
                            const acc = (t.accommodation || '').toLowerCase();
                            return !acc.includes('turkmen') && !acc.includes('туркмен');
                          });
                          return (
                            <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                              <span className="font-semibold">ℹ️ Auto:</span> Faqat UZ turistlar ({uzTourists.length}/{tourists.length})
                              {isTashkentToIstanbul && <span className="ml-1">(TAS→IST qaytish)</span>}
                            </p>
                          );
                        }
                        return null;
                      })()}
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
            );
          })()}

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
                        const selectedTrain = transformedTrainVehicles.find(t => t.trainNumber === e.target.value);
                        if (selectedTrain) {
                          // Auto-populate date based on tour type and train route
                          let autoDate = '';
                          if (booking && booking.departureDate) {
                            const tourTypeCode = typeof booking.tourType === 'string' ? booking.tourType : booking.tourType?.code;
                            const isKAS = tourTypeCode === 'KAS';
                            const routeLower = (selectedTrain.route || '').toLowerCase();
                            const depLower = (selectedTrain.departure || '').toLowerCase();
                            const arrLower = (selectedTrain.arrival || '').toLowerCase();

                            if (isKAS) {
                              const isQoqonBukhara =
                                (depLower.includes('qoqon') || depLower.includes('qqon') || routeLower.includes('qoqon')) &&
                                (arrLower.includes('bukhara') || arrLower.includes('buxoro') || routeLower.includes('bukhara') || routeLower.includes('buxoro'));
                              const isSamarkandTashkent =
                                (depLower.includes('samarkand') || depLower.includes('samarqand') || routeLower.includes('samarkand')) &&
                                (arrLower.includes('tashkent') || arrLower.includes('toshkent') || routeLower.includes('tashkent'));

                              if (isQoqonBukhara) {
                                // 2nd day in Uzbekistan = min tourist checkInDate + 1 day
                                const uzTourists = tourists?.filter(t => t.checkInDate) || [];
                                const uzArrival = uzTourists.length > 0
                                  ? new Date(Math.min(...uzTourists.map(t => new Date(t.checkInDate).getTime())))
                                  : new Date(booking.departureDate);
                                uzArrival.setDate(uzArrival.getDate() + 1);
                                autoDate = format(uzArrival, 'yyyy-MM-dd');
                              } else if (isSamarkandTashkent) {
                                // endDate - 2 days
                                const endDate = new Date(booking.endDate);
                                endDate.setDate(endDate.getDate() - 2);
                                autoDate = format(endDate, 'yyyy-MM-dd');
                              } else {
                                // KAS default: departureDate + 3
                                const d = new Date(booking.departureDate);
                                d.setDate(d.getDate() + 3);
                                autoDate = format(d, 'yyyy-MM-dd');
                              }
                            } else {
                              // ER/CO/ZA: departureDate + 3 days
                              const departureDate = new Date(booking.departureDate);
                              departureDate.setDate(departureDate.getDate() + 3);
                              autoDate = format(departureDate, 'yyyy-MM-dd');
                            }
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
                      {transformedTrainVehicles.map(train => (
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
                        const selectedTrain = transformedTrainVehicles.find(t => t.trainNumber === railwayForm.trainNumber);
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <button
                onClick={() => setDocumentsTab('rechnung')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'rechnung'
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 text-white shadow-amber-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <DollarSign className="w-5 h-5" />
                Rechnung
              </button>
              <button
                onClick={() => setDocumentsTab('neue-rechnung')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'neue-rechnung'
                    ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-600 hover:via-blue-600 hover:to-indigo-600 text-white shadow-cyan-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <FileText className="w-5 h-5" />
                Neue Rechnung
              </button>
              <button
                onClick={() => setDocumentsTab('gutschrift')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  documentsTab === 'gutschrift'
                    ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500 hover:from-emerald-600 hover:via-green-600 hover:to-lime-600 text-white shadow-emerald-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <FileText className="w-5 h-5" />
                Gutschrift
              </button>
            </nav>
          </div>

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
            <HotellisteDocument
              booking={booking}
              tourists={tourists}
              accommodations={accommodations}
              guide={booking?.guide}
            />
          )}

          {/* Rechnung Tab Content */}
          {documentsTab === 'rechnung' && (
            <div className="space-y-4">
              {/* Firma Selector */}
              <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Firma auswählen:
                </label>
                <select
                  value={rechnungInvoice?.firma || ''}
                  onChange={(e) => handleRechnungFirmaChange(e.target.value, 'Rechnung')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Firma wählen...</option>
                  <option value="Orient Insight">Orient Insight</option>
                  <option value="INFUTURESTORM">INFUTURESTORM</option>
                </select>
              </div>

              <RechnungDocument
                booking={booking}
                tourists={tourists}
                invoice={rechnungInvoice}
                sequentialNumber={rechnungSequentialNumber}
              />
            </div>
          )}

          {/* Neue Rechnung Tab Content */}
          {documentsTab === 'neue-rechnung' && (
            <div className="space-y-4">
              {/* Firma Selector */}
              <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Firma auswählen:
                </label>
                <select
                  value={neueRechnungInvoice?.firma || ''}
                  onChange={(e) => handleRechnungFirmaChange(e.target.value, 'Neue Rechnung')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Firma wählen...</option>
                  <option value="Orient Insight">Orient Insight</option>
                  <option value="INFUTURESTORM">INFUTURESTORM</option>
                </select>
              </div>

              <RechnungDocument
                booking={booking}
                tourists={tourists}
                showThreeRows={true}
                invoice={neueRechnungInvoice}
                invoiceType="Neue Rechnung"
                previousInvoiceNumber={rechnungSequentialNumber > 0 ? rechnungSequentialNumber.toString() : ''}
                previousInvoiceAmount={rechnungInvoice?.totalAmount || 0}
                sequentialNumber={neueRechnungSequentialNumber}
              />
            </div>
          )}

          {/* Gutschrift Tab Content */}
          {documentsTab === 'gutschrift' && (
            <div className="space-y-4">
              {/* Firma Selector */}
              <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Firma auswählen:
                </label>
                <select
                  value={gutschriftInvoice?.firma || ''}
                  onChange={(e) => handleRechnungFirmaChange(e.target.value, 'Gutschrift')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Firma wählen...</option>
                  <option value="Orient Insight">Orient Insight</option>
                  <option value="INFUTURESTORM">INFUTURESTORM</option>
                </select>
              </div>

              <RechnungDocument
                booking={booking}
                tourists={tourists}
                showThreeRows={true}
                invoice={gutschriftInvoice}
                invoiceType="Gutschrift"
                previousInvoiceNumber={rechnungSequentialNumber > 0 ? rechnungSequentialNumber.toString() : ''}
                previousInvoiceAmount={rechnungInvoice?.totalAmount || 0}
                sequentialNumber={gutschriftSequentialNumber}
              />
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
              <button
                onClick={() => setTourServicesTab('eintritt')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'eintritt'
                    ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 hover:from-cyan-600 hover:via-sky-600 hover:to-blue-600 text-white shadow-cyan-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <span className="text-lg">🎫</span>
                Eintritt
              </button>
              {/* Hide Metro tab for ZA tours */}
              {booking?.tourType?.code !== 'ZA' && (
                <button
                  onClick={() => setTourServicesTab('metro')}
                  className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                    tourServicesTab === 'metro'
                      ? 'bg-gradient-to-r from-lime-500 via-green-500 to-emerald-500 hover:from-lime-600 hover:via-green-600 hover:to-emerald-600 text-white shadow-lime-500/30 scale-110 -translate-y-0.5'
                      : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                  }`}
                >
                  <span className="text-lg">🚇</span>
                  Metro
                </button>
              )}
              <button
                onClick={() => setTourServicesTab('shou')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'shou'
                    ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:from-pink-600 hover:via-rose-600 hover:to-red-600 text-white shadow-pink-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <span className="text-lg">🎭</span>
                Shou
              </button>
              <button
                onClick={() => setTourServicesTab('other')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  tourServicesTab === 'other'
                    ? 'bg-gradient-to-r from-slate-500 via-gray-500 to-zinc-500 hover:from-slate-600 hover:via-gray-600 hover:to-zinc-600 text-white shadow-slate-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <span className="text-lg">📋</span>
                Other
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
                              .filter(r => r.provider?.toLowerCase().includes('sevil'))
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
                      {/* Nosir Total */}
                      <tr className="bg-gradient-to-r from-blue-50 to-sky-50">
                        <td colSpan="6" className="px-4 py-3 text-right font-bold text-gray-700 border-r border-gray-300">
                          Nosir Total:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-blue-700">
                          {(() => {
                            const nosirTotal = routes
                              .filter(r => r.provider?.toLowerCase() === 'nosir')
                              .reduce((sum, r) => sum + (r.price || 0), 0);
                            return nosirTotal > 0
                              ? Math.round(nosirTotal).toLocaleString('en-US').replace(/,/g, ' ')
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
                        <th className="px-4 py-3 text-right text-sm font-bold border-r border-orange-400">Price (UZS)</th>
                        <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
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
                          <td className="px-4 py-3 text-right font-bold border-r border-gray-200">
                            {railway.price > 0 ? (
                              <span className="text-orange-700">{Math.round(railway.price).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => deleteRailway(railway.id)}
                                className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                title="O'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-orange-100 to-amber-100 border-t-2 border-orange-300">
                        <td colSpan="8" className="px-4 py-4 text-right font-bold text-gray-900 text-lg border-r border-orange-200">
                          Total:
                        </td>
                        <td className="px-4 py-4 text-right font-black text-xl text-orange-700 border-r border-orange-200">
                          {railways.reduce((sum, r) => sum + (r.price || 0), 0) > 0
                            ? Math.round(railways.reduce((sum, r) => sum + (r.price || 0), 0)).toLocaleString('en-US').replace(/,/g, ' ')
                            : '-'}
                        </td>
                        <td></td>
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
                        <th className="px-4 py-3 text-right text-sm font-bold">Price (UZS)</th>
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

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Users className="w-7 h-7 text-rose-600" />
                  Guide Services
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openGuideModal('main')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Add Main Guide (12 days + 1 half day)"
                  >
                    <Plus className="w-5 h-5" />
                    Main Guide
                  </button>
                  <button
                    onClick={() => openGuideModal('second')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Add Second Guide"
                  >
                    <Plus className="w-5 h-5" />
                    Second Guide
                  </button>
                  <button
                    onClick={() => openGuideModal('bergreiseleiter')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    title="Add Bergreiseleiter"
                  >
                    <Plus className="w-5 h-5" />
                    Bergreiseleiter
                  </button>
                </div>
              </div>

              {(mainGuide || secondGuide || bergreiseleiter) ? (
                <div className="space-y-6">
                  {/* Main Guide Table */}
                  {mainGuide && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-blue-200">Guide name</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-blue-200">Type</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-blue-200">Full days</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-blue-200">Half days</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-blue-200">Day rate</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-blue-200">Half day rate</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-blue-200">Total payment</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-blue-200 hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 border-r border-blue-200">
                              {typeof mainGuide.guide === 'string'
                                ? mainGuide.guide
                                : mainGuide.guide?.name || mainGuide.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-center border-r border-blue-200">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                Main
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-200">
                              {mainGuide.fullDays}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-200">
                              {mainGuide.halfDays || '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-200">
                              ${mainGuide.dayRate}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-blue-200">
                              ${mainGuide.halfDayRate}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-blue-700 border-r border-blue-200">
                              ${Math.round(mainGuide.totalPayment).toLocaleString('en-US').replace(/,/g, ' ')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openGuideModal('main')}
                                  className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeGuide('main')}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Second Guide Table */}
                  {secondGuide && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200">
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-green-200">Guide name</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-green-200">Type</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-green-200">Full days</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-green-200">Half days</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-green-200">Day rate</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-green-200">Half day rate</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-green-200">Total payment</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-green-200 hover:bg-green-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 border-r border-green-200">
                              {typeof secondGuide.guide === 'string'
                                ? secondGuide.guide
                                : secondGuide.guide?.name || secondGuide.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-center border-r border-green-200">
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                Second
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-green-200">
                              {secondGuide.fullDays}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-green-200">
                              {secondGuide.halfDays || '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-green-200">
                              ${secondGuide.dayRate}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-green-200">
                              ${secondGuide.halfDayRate}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-green-700 border-r border-green-200">
                              ${Math.round(secondGuide.totalPayment).toLocaleString('en-US').replace(/,/g, ' ')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openGuideModal('second')}
                                  className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeGuide('second')}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Bergreiseleiter Table */}
                  {bergreiseleiter && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-purple-200">Guide name</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-purple-200">Type</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-purple-200">Full days</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-purple-200">Half days</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-purple-200">Day rate</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-purple-200">Half day rate</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-purple-200">Total payment</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-purple-200 hover:bg-purple-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 border-r border-purple-200">
                              {typeof bergreiseleiter.guide === 'string'
                                ? bergreiseleiter.guide
                                : bergreiseleiter.guide?.name || bergreiseleiter.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-center border-r border-purple-200">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                Bergreiseleiter
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-purple-200">
                              {bergreiseleiter.fullDays}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-purple-200">
                              {bergreiseleiter.halfDays || '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-purple-200">
                              ${bergreiseleiter.dayRate}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 border-r border-purple-200">
                              ${bergreiseleiter.halfDayRate}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-purple-700 border-r border-purple-200">
                              ${Math.round(bergreiseleiter.totalPayment).toLocaleString('en-US').replace(/,/g, ' ')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openGuideModal('bergreiseleiter')}
                                  className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeGuide('bergreiseleiter')}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Total Payment Summary */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-rose-100 to-pink-100 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total Guide Payment:</span>
                      <span className="text-2xl font-bold text-rose-700">
                        ${Math.round(
                          (mainGuide?.totalPayment || 0) +
                          (secondGuide?.totalPayment || 0) +
                          (bergreiseleiter?.totalPayment || 0)
                        ).toLocaleString('en-US').replace(/,/g, ' ')} USD
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No guides assigned yet</p>
                  <p className="text-sm mt-2">Click buttons above to assign guides</p>
                </div>
              )}
            </div>
          )}

          {/* Meals Tab */}
          {tourServicesTab === 'meals' && (() => {
            // Use meals data loaded from OPEX database (state)
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
            const pax = tourists?.length || 0;

            // Calculate total
            const grandTotal = mealsData.reduce((sum, meal) => {
              // OPEX stores price as string with spaces (e.g., "150 000")
              const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              return sum + (pricePerPerson * pax);
            }, 0);

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-red-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500"></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Meal Services</h3>

                {mealsData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-500 to-blue-600 border-b-2 border-blue-700">
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-blue-400">#</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-blue-400">CITY</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-blue-400">RESTAURANT</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white border-r border-blue-400">PRICE (UZS)</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-blue-400">PAX</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white">TOTAL (UZS)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mealsData.map((meal, index) => {
                          // OPEX stores price as string with spaces (e.g., "150 000")
                          const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
                          const pricePerPerson = parseFloat(priceStr) || 0;
                          const total = pricePerPerson * pax;

                          return (
                            <tr key={index} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold mx-auto">
                                  {index + 1}
                                </div>
                              </td>
                              <td className="px-4 py-3 border-r border-gray-200">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                  <span className="font-medium text-gray-900">{meal.city || '-'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-900 border-r border-gray-200">
                                {meal.name || meal.restaurant || '-'}
                              </td>
                              <td className="px-4 py-3 text-right border-r border-gray-200">
                                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-md font-medium">
                                  {pricePerPerson.toLocaleString('en-US').replace(/,/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-blue-600 text-lg border-r border-gray-200">
                                {pax}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg">
                                {Math.round(total).toLocaleString('en-US').replace(/,/g, ' ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-orange-100 to-orange-200 border-t-2 border-orange-300">
                          <td colSpan="5" className="px-4 py-4 text-right font-bold text-gray-900 text-lg">
                            Grand Total:
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-orange-700 text-xl">
                            {Math.round(grandTotal).toLocaleString('en-US').replace(/,/g, ' ')} UZS
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>No meals data found for {tourTypeCode.toUpperCase()} tours</p>
                    <p className="text-sm mt-2">Please add meals in OPEX → Meals → {tourTypeCode.toUpperCase()} tab</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Eintritt Tab */}
          {tourServicesTab === 'eintritt' && (() => {
            // Use sightseeing data loaded from OPEX database (state)
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
            const services = tourServices.eintritt || [];

            // Function to calculate date for ER tour attractions based on arrival date
            const getERAttractionDate = (attractionName, arrivalDate) => {
              if (!arrivalDate) return null;

              const arrival = new Date(arrivalDate);
              const name = attractionName.toLowerCase().trim().replace(/\s+/g, ' '); // Normalize spaces

              console.log('🔍 Checking attraction:', attractionName, '→ normalized:', name);

              // Day 1 (13.10): Tashkent - Hast Imam, Kukeldash
              if (name.includes('hast') || name.includes('imam') ||
                  name.includes('kukeldash') || name.includes('kukeldas') || name.includes('madrasah')) {
                console.log('✅ Day 1 (13.10) - Tashkent');
                return format(arrival, 'yyyy-MM-dd');
              }

              // Day 3 (15.10): Samarkand - Registan, Bibi-Khanum
              if (name.includes('registan') || name.includes('bibi') || name.includes('khanum') || name.includes('khanym')) {
                console.log('✅ Day 3 (15.10) - Samarkand');
                return format(addDays(arrival, 2), 'yyyy-MM-dd');
              }

              // Day 4 (16.10): Samarkand - Amir Temur, Ulugbek, Daniel, Shah-i-Zinda
              if (name.includes('amir') || name.includes('temur') ||
                  name.includes('ulugbek') || name.includes('ulug bek') ||
                  name.includes('daniel') || name.includes('shah') || name.includes('zinda')) {
                console.log('✅ Day 4 (16.10) - Samarkand');
                return format(addDays(arrival, 3), 'yyyy-MM-dd');
              }

              // Day 5 (17.10): Samarkand - Konigil Paper Workshop
              if (name.includes('konigil') || name.includes('paper') || name.includes('workshop')) {
                console.log('✅ Day 5 (17.10) - Samarkand');
                return format(addDays(arrival, 4), 'yyyy-MM-dd');
              }

              // Day 7 (19.10): Nurata - Nurota Chashma
              if (name.includes('nurata') || name.includes('nurota') ||
                  (name.includes('chashma') && !name.includes('ayub'))) {
                console.log('✅ Day 7 (19.10) - Nurata');
                return format(addDays(arrival, 6), 'yyyy-MM-dd');
              }

              // Day 8 (20.10): Bukhara - Samanid, Chashma Ayub, Ark, Kalon, Magoki Attori
              if (name.includes('samanid') ||
                  (name.includes('chashma') && name.includes('ayub')) ||
                  name.includes('ark') ||
                  name.includes('kalon') || name.includes('kalyan') ||
                  name.includes('magoki') || name.includes('attori') || name.includes('attor')) {
                console.log('✅ Day 8 (20.10) - Bukhara');
                return format(addDays(arrival, 7), 'yyyy-MM-dd');
              }

              // Day 9 (21.10): Bukhara - Mohi Khosa
              if (name.includes('mohi') || name.includes('khosa') || name.includes('xosa')) {
                console.log('✅ Day 9 (21.10) - Bukhara');
                return format(addDays(arrival, 8), 'yyyy-MM-dd');
              }

              // Day 11 (23.10): Khiva - Itchan Kala, Pahlavon Mahmud
              if (name.includes('itchan') || name.includes('ichan') || name.includes('kala') ||
                  name.includes('pahlavon') || name.includes('pahlavan') || name.includes('mahmud') || name.includes('mahmood')) {
                console.log('✅ Day 11 (23.10) - Khiva');
                return format(addDays(arrival, 10), 'yyyy-MM-dd');
              }

              console.warn('⚠️ No date match for:', attractionName);
              return null;
            };

            // Get arrival date - for ER tours, ALWAYS use departureDate + 1 (reliable calculation)
            // Because tourist check-in dates may not be filled yet or include early arrivals
            let arrivalDate = null;

            if (booking?.tourType?.code === 'ER' && booking?.departureDate) {
              // For ER tours: arrival is ALWAYS departureDate + 1 day (12.10 → 13.10)
              // This is the main group arrival, excluding early arrivals like Baetgen
              arrivalDate = format(addDays(new Date(booking.departureDate), 1), 'yyyy-MM-dd');
              console.log('✈️ ER Tour - Using departureDate + 1:', arrivalDate);
            } else if (tourists && tourists.length > 0) {
              // For other tour types, use tourist check-in dates
              const dateCounts = {};
              tourists
                .filter(t => t.checkInDate)
                .forEach(t => {
                  const dateStr = format(new Date(t.checkInDate), 'yyyy-MM-dd');
                  dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
                });

              console.log('📊 Tourist check-in dates:', dateCounts);

              if (Object.keys(dateCounts).length > 0) {
                const sortedDates = Object.entries(dateCounts)
                  .sort((a, b) => b[1] - a[1]);
                arrivalDate = sortedDates[0][0];
                console.log('✅ Most common arrival:', arrivalDate);
              }
            }

            // Final fallback: use booking departure date
            if (!arrivalDate && booking?.departureDate) {
              arrivalDate = booking.departureDate;
              console.log('🔄 Using booking departure date:', arrivalDate);
            }

            console.log('🔍 Final Eintritt Arrival Date:', arrivalDate);

            // Create a map of saved entries by name for quick lookup
            const savedEntriesMap = new Map(services.map(s => [s.name.toLowerCase().trim(), s]));

            // Merge template entries with saved entries (saved entries override templates)
            const allEntries = sightseeingData.map(item => {
              const itemName = item.name.toLowerCase().trim();
              const savedEntry = savedEntriesMap.get(itemName);

              // Calculate auto-date for ER tours
              const autoDate = booking?.tourType?.code === 'ER'
                ? getERAttractionDate(item.name, arrivalDate)
                : null;

              if (savedEntry) {
                // Use saved entry data, but use auto-date if saved date is null/invalid
                savedEntriesMap.delete(itemName); // Mark as used

                // Check if saved date is valid (can be parsed and is in year 2024+)
                let hasValidDate = false;
                if (savedEntry.date && savedEntry.date !== 'null' && savedEntry.date !== 'undefined') {
                  try {
                    const parsedDate = new Date(savedEntry.date);
                    const year = parsedDate.getFullYear();
                    // Valid if it's a real date and year is 2024 or later
                    hasValidDate = !isNaN(parsedDate.getTime()) && year >= 2024 && year <= 2030;
                  } catch (e) {
                    hasValidDate = false;
                  }
                }

                // Always use tourists count from Final List, not saved PAX
                const currentPax = tourists?.length || 0;
                const pricePerPerson = savedEntry.pricePerPerson || 0;
                const totalPrice = pricePerPerson * currentPax;

                return {
                  id: savedEntry.id,
                  name: savedEntry.name,
                  city: item.city, // Keep city from template
                  date: hasValidDate ? savedEntry.date : autoDate, // Use auto-date if no valid saved date
                  pricePerPerson: pricePerPerson,
                  pax: currentPax, // Use tourists count from Final List
                  price: totalPrice, // Recalculate with current PAX
                  isTemplate: false // This is a saved entry
                };
              } else {
                // Use template data with auto-calculated date for ER tours
                const currentPax = tourists?.length || 0;
                const pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
                return {
                  id: `opex-${item.id}`,
                  name: item.name,
                  city: item.city,
                  date: autoDate || item.date || null,
                  pricePerPerson: pricePerPerson,
                  pax: currentPax,
                  price: pricePerPerson * currentPax,
                  isTemplate: true
                };
              }
            });

            // Add any remaining saved entries that didn't match templates (custom entries)
            savedEntriesMap.forEach(savedEntry => {
              // Always use tourists count from Final List for custom entries too
              const currentPax = tourists?.length || 0;
              const pricePerPerson = savedEntry.pricePerPerson || 0;
              const totalPrice = pricePerPerson * currentPax;

              allEntries.push({
                id: savedEntry.id,
                name: savedEntry.name,
                city: null,
                date: savedEntry.date,
                pricePerPerson: pricePerPerson,
                pax: currentPax, // Use tourists count from Final List
                price: totalPrice, // Recalculate with current PAX
                isTemplate: false
              });
            });

            // Filter out hidden template entries
            const visibleEntries = allEntries
              .filter(entry => {
                if (entry.isTemplate && hiddenTemplateIds.includes(entry.id)) {
                  return false; // Hide this template
                }
                return true; // Show all others
              })
              .sort((a, b) => {
                // Sort by city in tour order: Tashkent → Samarkand → Nurota → Bukhara → Khiva
                const cityOrder = { 'tashkent': 1, 'samarkand': 2, 'nurota': 3, 'bukhara': 4, 'khiva': 5 };
                const cityA = (a.city || '').toLowerCase().trim();
                const cityB = (b.city || '').toLowerCase().trim();
                const orderA = cityOrder[cityA] || 999;
                const orderB = cityOrder[cityB] || 999;
                return orderA - orderB;
              });

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-cyan-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500"></div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <span className="text-3xl">🎫</span>
                    Eintritt (Entrance Fees) - {booking?.tourType?.code || 'ER'} Tour
                  </h3>
                  <button
                    onClick={() => openTourServiceModal('EINTRITT')}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
                  >
                    + Add Custom
                  </button>
                </div>
                {visibleEntries.length > 0 ? (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                        <th className="px-4 py-3 text-center">#</th>
                        <th className="px-4 py-3 text-left">City</th>
                        <th className="px-4 py-3 text-center">Date</th>
                        <th className="px-4 py-3 text-left">Attraction</th>
                        <th className="px-4 py-3 text-right">Price/Person (UZS)</th>
                        <th className="px-4 py-3 text-center">PAX</th>
                        <th className="px-4 py-3 text-right">Total (UZS)</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEntries.map((item, idx) => (
                        <tr key={item.id} className="border-b hover:bg-cyan-50">
                          <td className="px-4 py-3 text-center text-gray-600">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-700">{item.city || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            {editingEintrittDate === item.id ? (
                              <input
                                type="date"
                                defaultValue={item.date ? format(new Date(item.date), 'yyyy-MM-dd') : ''}
                                onChange={(e) => updateEintrittDate(item, e.target.value)}
                                onBlur={() => setEditingEintrittDate(null)}
                                autoFocus
                                className="px-2 py-1 border border-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingEintrittDate(item.id)}
                                className="text-gray-600 hover:text-cyan-600 hover:bg-cyan-100 px-3 py-1 rounded transition-colors flex items-center gap-2 mx-auto"
                                title="Click to select date"
                              >
                                <Calendar className="w-4 h-4" />
                                {item.date ? new Date(item.date).toLocaleDateString('en-GB') : 'Select date'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-right">{item.pricePerPerson > 0 ? Math.round(item.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ') : '-'}</td>
                          <td className="px-4 py-3 text-center font-semibold">{item.pax || '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-cyan-700">{item.price > 0 ? Math.round(item.price).toLocaleString('en-US').replace(/,/g, ' ') : '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => moveEintrittEntry(item, 'up')}
                                disabled={idx === 0}
                                className={`p-1.5 rounded-lg transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-600'}`}
                                title="Move up"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moveEintrittEntry(item, 'down')}
                                disabled={idx === visibleEntries.length - 1}
                                className={`p-1.5 rounded-lg transition-colors ${idx === visibleEntries.length - 1 ? 'opacity-30 cursor-not-allowed' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-600'}`}
                                title="Move down"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteEintrittEntry(item)}
                                className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-cyan-100 font-bold">
                        <td colSpan="6" className="px-4 py-3 text-right">Total:</td>
                        <td className="px-4 py-3 text-right text-cyan-700 text-lg">{Math.round(visibleEntries.reduce((sum, s) => sum + (s.price || 0), 0)).toLocaleString('en-US').replace(/,/g, ' ')}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p className="text-gray-500 text-center py-8">No sightseeing data found for {booking?.tourType?.code || 'ER'} tour type. Please add data in Opex → Sightseeing.</p>
                )}
              </div>
            );
          })()}

          {/* Metro Tab - Hidden for ZA tours */}
          {tourServicesTab === 'metro' && booking?.tourType?.code !== 'ZA' && (() => {
            // Use metro data from API (loaded in metroVehicles state)
            const metroData = metroVehicles || [];
            const pax = (tourists?.length || 0) + 1; // +1 for guide

            // Calculate total
            const grandTotal = metroData.reduce((sum, metro) => {
              // Get price from API (metro uses economPrice field)
              const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
              const priceStr = rawPrice.toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              return sum + (pricePerPerson * pax);
            }, 0);

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-lime-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-lime-500 via-green-500 to-emerald-500"></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-3xl">🚇</span>
                  Metro
                </h3>

                {metroData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-lime-600 to-emerald-600 border-b-2 border-lime-700">
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-lime-400">#</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-lime-400">SERVICE</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white border-r border-lime-400">PRICE (UZS)</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-lime-400">PAX</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white">TOTAL (UZS)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metroData.map((metro, index) => {
                          // Get price from API (metro uses economPrice field)
                          const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
                          const priceStr = rawPrice.toString().replace(/\s/g, '');
                          const pricePerPerson = parseFloat(priceStr) || 0;
                          const total = pricePerPerson * pax;

                          return (
                            <tr key={index} className="border-b border-gray-200 hover:bg-lime-50 transition-colors">
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <div className="w-8 h-8 rounded-full bg-lime-500 text-white flex items-center justify-center font-semibold mx-auto">
                                  {index + 1}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-900 border-r border-gray-200">
                                {metro.name || metro.service || '-'}
                              </td>
                              <td className="px-4 py-3 text-right border-r border-gray-200">
                                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-md font-medium">
                                  {pricePerPerson.toLocaleString('en-US').replace(/,/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-lime-600 text-lg border-r border-gray-200">
                                {pax}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg">
                                {Math.round(total).toLocaleString('en-US').replace(/,/g, ' ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-lime-100 to-emerald-200 border-t-2 border-lime-300">
                          <td colSpan="4" className="px-4 py-4 text-right font-bold text-gray-900 text-lg">
                            Grand Total:
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-lime-700 text-xl">
                            {Math.round(grandTotal).toLocaleString('en-US').replace(/,/g, ' ')} UZS
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-6xl mb-4 block">🚇</span>
                    <p className="text-lg">No metro data found for {booking?.tourType?.code || 'ER'} tour type.</p>
                    <p className="text-sm mt-2">Please add data in Opex → Transport → Metro.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Shou Tab */}
          {tourServicesTab === 'shou' && (() => {
            // Use shows data loaded from OPEX database (state)
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
            const pax = tourists?.length || 0;

            // Calculate total
            const grandTotal = showsData.reduce((sum, show) => {
              // Get price from Opex (can be string or number)
              const rawPrice = show.price || show.pricePerPerson || 0;
              const priceStr = rawPrice.toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              return sum + (pricePerPerson * pax);
            }, 0);

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-pink-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500"></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-3xl">🎭</span>
                  Shou (Shows)
                </h3>

                {showsData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-pink-600 to-red-600 border-b-2 border-pink-700">
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-pink-400">#</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-pink-400">CITY</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-pink-400">SERVICE</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white border-r border-pink-400">PRICE (UZS)</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-pink-400">PAX</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white">TOTAL (UZS)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {showsData.map((show, index) => {
                          // Get price from Opex (can be string or number)
                          const rawPrice = show.price || show.pricePerPerson || 0;
                          const priceStr = rawPrice.toString().replace(/\s/g, '');
                          const pricePerPerson = parseFloat(priceStr) || 0;
                          const total = pricePerPerson * pax;

                          return (
                            <tr key={index} className="border-b border-gray-200 hover:bg-pink-50 transition-colors">
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center font-semibold mx-auto">
                                  {index + 1}
                                </div>
                              </td>
                              <td className="px-4 py-3 border-r border-gray-200">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                                  <span className="font-medium text-gray-900">{show.city || '-'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-900 border-r border-gray-200">
                                {show.name || show.service || '-'}
                              </td>
                              <td className="px-4 py-3 text-right border-r border-gray-200">
                                <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-md font-medium">
                                  {pricePerPerson.toLocaleString('en-US').replace(/,/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-pink-600 text-lg border-r border-gray-200">
                                {pax}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg">
                                {Math.round(total).toLocaleString('en-US').replace(/,/g, ' ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-pink-100 to-rose-200 border-t-2 border-pink-300">
                          <td colSpan="5" className="px-4 py-4 text-right font-bold text-gray-900 text-lg">
                            Grand Total:
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-pink-700 text-xl">
                            {Math.round(grandTotal).toLocaleString('en-US').replace(/,/g, ' ')} UZS
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-6xl mb-4 block">🎭</span>
                    <p className="text-lg">No shows data found for {booking?.tourType?.code || 'ER'} tour type.</p>
                    <p className="text-sm mt-2">Please add data in Opex → Shows.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Other Tab */}
          {tourServicesTab === 'other' && (() => {
            // Use database services (manually added by user)
            const services = tourServices.other || [];

            // Calculate total (using individual PAX for each item)
            const grandTotal = services.reduce((sum, item) => {
              const pricePerPerson = item.pricePerPerson || 0;
              const itemPax = item.pax || 0;
              return sum + (pricePerPerson * itemPax);
            }, 0);

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-slate-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-slate-500 via-gray-500 to-zinc-500"></div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <span className="text-3xl">📋</span>
                    Other Expenses
                  </h3>
                  <button
                    onClick={() => openTourServiceModal('OTHER')}
                    className="px-6 py-3 bg-gradient-to-r from-slate-500 to-zinc-500 text-white font-bold rounded-xl hover:from-slate-600 hover:to-zinc-600 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    + Add Other
                  </button>
                </div>

                {services.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-600 to-zinc-600 border-b-2 border-slate-700">
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-slate-400">#</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-slate-400">CITY</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-slate-400">SERVICE</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white border-r border-slate-400">PRICE (UZS)</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-slate-400">PAX</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-white border-r border-slate-400">TOTAL (UZS)</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-white">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((item, index) => {
                          const pricePerPerson = item.pricePerPerson || 0;
                          const itemPax = item.pax || 0;
                          const total = pricePerPerson * itemPax;

                          return (
                            <tr key={item.id} className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <div className="w-8 h-8 rounded-full bg-slate-500 text-white flex items-center justify-center font-semibold mx-auto">
                                  {index + 1}
                                </div>
                              </td>
                              <td className="px-4 py-3 border-r border-gray-200">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                  <span className="font-medium text-gray-900">{item.city || '-'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-900 border-r border-gray-200">
                                {item.name || '-'}
                              </td>
                              <td className="px-4 py-3 text-right border-r border-gray-200">
                                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium">
                                  {Math.round(pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-600 text-lg border-r border-gray-200">
                                {itemPax}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                                {Math.round(total).toLocaleString('en-US').replace(/,/g, ' ')}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => moveTourService(item, 'up', 'OTHER')}
                                    disabled={index === 0}
                                    className={`p-1.5 rounded-lg transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                    title="Move up"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => moveTourService(item, 'down', 'OTHER')}
                                    disabled={index === services.length - 1}
                                    className={`p-1.5 rounded-lg transition-colors ${index === services.length - 1 ? 'opacity-30 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                    title="Move down"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => editTourService(item)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteTourService(item.id, 'OTHER')}
                                    className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg"
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
                      <tfoot>
                        <tr className="bg-gradient-to-r from-slate-100 to-gray-200 border-t-2 border-slate-300">
                          <td colSpan="5" className="px-4 py-4 text-right font-bold text-gray-900 text-lg">
                            Grand Total:
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-700 text-xl">
                            {Math.round(grandTotal).toLocaleString('en-US').replace(/,/g, ' ')} UZS
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-6xl mb-4 block">📋</span>
                    <p className="text-lg">No other expenses added yet</p>
                    <p className="text-sm mt-2">Click "+ Add Other" to add manual expenses</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {!isNew && activeTab === 'costs' && (
        <div className="space-y-6">
          {/* Sub-tabs for Costs (Payment Methods) */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-green-100 p-4">
            <nav className="flex space-x-3 overflow-x-auto">
              <button
                onClick={() => setCostsTab('ausgaben')}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all duration-300 whitespace-nowrap shadow-lg hover:shadow-xl ${
                  costsTab === 'ausgaben'
                    ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 hover:from-red-600 hover:via-rose-600 hover:to-pink-600 text-white shadow-red-500/30 scale-110 -translate-y-0.5'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                <FileText className="w-5 h-5" />
                Ausgaben
              </button>
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

          {/* Ausgaben Tab */}
          {costsTab === 'ausgaben' && (() => {
            // Get tour type code for Opex localStorage keys
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
            const pax = tourists?.length || 0;

            // Collect all expenses and organize by city
            const expensesByCity = {};
            const cityOrder = ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Nurota', 'Bukhara', 'Qizilqum', 'Khiva'];

            // Initialize city sections
            cityOrder.forEach(city => {
              expensesByCity[city] = [];
            });

            // Add Transport section
            expensesByCity['Transport'] = [];

            // Add Reiseleiter section
            expensesByCity['Reiseleiter'] = [];

            // Add Railway & Flights section
            expensesByCity['Railway & Flights'] = [];

            // Add Extra Kosten section
            expensesByCity['Extra Kosten'] = [];

            // Helper function to map city names and attraction names to cities
            const mapCityName = (text) => {
              if (!text) return null;
              const str = text.toLowerCase().trim();

              // City name matching
              if (str.includes('tashkent') || str.includes('тошкент')) return 'Tashkent';
              if (str.includes('samarkand') || str.includes('samarqand') || str.includes('самарканд')) return 'Samarkand';
              if (str.includes('asraf') || str.includes('асраф')) return 'Asraf';
              if (str.includes('nurota') || str.includes('nurata') || str.includes('нурата')) return 'Nurota';
              if (str.includes('bukhara') || str.includes('buxoro') || str.includes('бухара')) return 'Bukhara';
              if (str.includes('khiva') || str.includes('xiva') || str.includes('хива')) return 'Khiva';
              if (str.includes('fergana') || str.includes('farg\'ona') || str.includes('фергана') || str.includes('margilan') || str.includes('qoqon') || str.includes('kokand')) return 'Fergana';
              if (str.includes('qizilqum') || str.includes('kyzylkum') || str.includes('қизилқум') || str.includes('choyxona') || str.includes('чойхона') || str.includes('chayhana') || str.includes('tea house')) return 'Qizilqum';

              // Tashkent landmarks
              if (str.includes('hast imam') || str.includes('hazrat imam') || str.includes('хазрат имом')) return 'Tashkent';
              if (str.includes('kukeldash') || str.includes('кукелдаш')) return 'Tashkent';
              if (str.includes('chorsu') || str.includes('чорсу')) return 'Tashkent';
              if (str.includes('amir temur') || str.includes('амир темур') || str.includes('amir timur')) return 'Tashkent';
              if (str.includes('independence square') || str.includes('mustaqillik')) return 'Tashkent';

              // Samarkand landmarks
              if (str.includes('registan') || str.includes('регистан')) return 'Samarkand';
              if (str.includes('gur-e') || str.includes('gur e') || str.includes('guri amir')) return 'Samarkand';
              if (str.includes('shah-i-zinda') || str.includes('шахи зинда') || str.includes('shahi zinda')) return 'Samarkand';
              if (str.includes('bibi') || str.includes('биби')) return 'Samarkand';
              if (str.includes('ulugbek') || str.includes('улугбек')) return 'Samarkand';
              if (str.includes('konigil') || str.includes('konigil')) return 'Samarkand';
              if (str.includes('daniel') || str.includes('даниёр')) return 'Samarkand';
              if (str.includes('afrasiab') || str.includes('афрасиаб')) return 'Samarkand';

              // Bukhara landmarks
              if (str.includes('ark fortress') || str.includes('арк') || str.includes('ark citadel')) return 'Bukhara';
              if (str.includes('poi kalyan') || str.includes('kalon') || str.includes('калон')) return 'Bukhara';
              if (str.includes('samanid') || str.includes('саманид')) return 'Bukhara';
              if (str.includes('chashma') || str.includes('чашма')) return 'Bukhara';
              if (str.includes('lyabi') || str.includes('лаби')) return 'Bukhara';
              if (str.includes('magoki') || str.includes('магоки')) return 'Bukhara';
              if (str.includes('chor minor') || str.includes('чор минор')) return 'Bukhara';
              if (str.includes('mohi khosa') || str.includes('мохи хоса')) return 'Bukhara';
              if (str.includes('nadir divan') || str.includes('надир диван')) return 'Bukhara';
              if (str.includes('sitorai') || str.includes('ситораи')) return 'Bukhara';
              if (str.includes('bolo hauz') || str.includes('боло хауз')) return 'Bukhara';

              // Khiva landmarks
              if (str.includes('itchan kala') || str.includes('ichan kala') || str.includes('ичан кала')) return 'Khiva';
              if (str.includes('kunya ark') || str.includes('куня арк')) return 'Khiva';
              if (str.includes('islam khodja') || str.includes('ислам ходжа')) return 'Khiva';
              if (str.includes('juma mosque') || str.includes('жума')) return 'Khiva';
              if (str.includes('pahlavon') || str.includes('пахлавон') || str.includes('pahlavan')) return 'Khiva';
              if (str.includes('tash hauli') || str.includes('таш хаули')) return 'Khiva';
              if (str.includes('mahmudjon') || str.includes('махмуджон')) return 'Khiva';

              // Nurota landmarks
              if (str.includes('chashma') && str.includes('nurota')) return 'Nurota';
              if (str.includes('alexander') || str.includes('александр')) return 'Nurota';

              return null;
            };

            // 1. Process Hotels (from grandTotalData.hotelBreakdown)
            if (grandTotalData && grandTotalData.hotelBreakdown) {
              grandTotalData.hotelBreakdown.forEach(hotelData => {
                // Find the accommodation to get city info
                const acc = accommodations.find(a => a.id === hotelData.accommodationId);
                const hotelName = hotelData.hotel || 'Unknown Hotel';
                const cityName = acc?.hotel?.city?.name || '';

                // Map to standard city name
                let targetCity = mapCityName(cityName) || mapCityName(hotelName);
                if (!targetCity) targetCity = 'Extra Kosten';

                // Use costs from grandTotalData
                const totalUSD = hotelData.USD || 0;
                const totalUZS = hotelData.UZS || 0;

                expensesByCity[targetCity].push({
                  name: hotelName,
                  pricePerPerson: null,
                  pax: null,
                  usd: totalUSD,
                  uzs: totalUZS
                });
              });
            }

            // 2. Process Metro (from metroVehicles) - Skip for ZA tours
            if (metroVehicles && metroVehicles.length > 0 && booking?.tourType?.code !== 'ZA') {
              metroVehicles.forEach(metro => {
                const name = metro.name || 'Metro';
                const city = metro.city || '';
                const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
                const pricePerPerson = parseFloat(rawPrice.toString().replace(/\s/g, '')) || 0;
                const metroPax = (tourists?.length || 0) + 1; // +1 for guide
                const total = pricePerPerson * metroPax;

                // Map to standard city name
                let targetCity = mapCityName(city) || mapCityName(name);
                if (!targetCity) targetCity = 'Extra Kosten';

                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: metroPax,
                  usd: 0,
                  uzs: total
                });
              });
            }

            // 3. Process Meals (from OPEX database state)
            // Use mealsData state loaded from database
            mealsData.forEach(meal => {
              const name = meal.name || 'Unknown Meal';
              const city = meal.city || '';
              const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              const pax = tourists?.length || 0;
              const total = pricePerPerson * pax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = 'Extra Kosten';

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // 4. Process Shows (from OPEX database state)
            // Use showsData state loaded from database
            showsData.forEach(show => {
              const name = show.name || 'Unknown Show';
              const city = show.city || '';
              const rawPrice = show.price || show.pricePerPerson || 0;
              const priceStr = rawPrice.toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              const pax = tourists?.length || 0;
              const total = pricePerPerson * pax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = 'Extra Kosten';

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // 5. Process Eintritt (from OPEX database state merged with tourServices.eintritt)
            // Use sightseeingData state loaded from database
            const services = tourServices.eintritt || [];
            const savedEntriesMap = new Map(services.map(s => [s.name.toLowerCase().trim(), s]));

            // Merge template entries with saved entries
            sightseeingData.forEach(item => {
              const name = item.name || 'Unknown Entry';
              const itemName = name.toLowerCase().trim();
              const city = item.city || '';
              const savedEntry = savedEntriesMap.get(itemName);

              let pricePerPerson;
              if (savedEntry) {
                // Use saved entry price
                pricePerPerson = savedEntry.pricePerPerson || 0;
                savedEntriesMap.delete(itemName);
              } else {
                // Use template price
                pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
              }

              const pax = tourists?.length || 0;
              const total = pricePerPerson * pax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = 'Extra Kosten';

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // Add remaining saved entries not in template
            savedEntriesMap.forEach(savedEntry => {
              const name = savedEntry.name || 'Unknown Entry';
              const city = savedEntry.city || '';
              const pricePerPerson = savedEntry.pricePerPerson || 0;
              const pax = tourists?.length || 0;
              const total = pricePerPerson * pax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = 'Extra Kosten';

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // 6. Process Transport (from routes) - aggregate by provider
            if (routes && routes.length > 0) {
              const transportByProvider = {};

              routes.forEach(route => {
                const providerName = route.provider || 'Unknown Provider';
                const price = route.price || 0;

                if (!transportByProvider[providerName]) {
                  transportByProvider[providerName] = 0;
                }
                transportByProvider[providerName] += price;
              });

              // Helper function to capitalize first letter
              const capitalizeFirstLetter = (str) => {
                if (!str) return str;
                return str.charAt(0).toUpperCase() + str.slice(1);
              };

              // Add aggregated transport costs
              Object.entries(transportByProvider).forEach(([provider, total]) => {
                expensesByCity['Transport'].push({
                  name: capitalizeFirstLetter(provider),
                  pricePerPerson: null,
                  pax: null,
                  usd: total,
                  uzs: 0
                });
              });
            }

            // 7. Process Guides (mainGuide, secondGuide, bergreiseleiter)
            if (mainGuide && mainGuide.totalPayment) {
              const guideName = typeof mainGuide.guide === 'string' ? mainGuide.guide : mainGuide.guide?.name || 'Main Guide';
              expensesByCity['Reiseleiter'].push({
                name: guideName,
                pricePerPerson: null,
                pax: null,
                usd: mainGuide.totalPayment || 0,
                uzs: 0
              });
            }

            if (secondGuide && secondGuide.totalPayment) {
              const guideName = typeof secondGuide.guide === 'string' ? secondGuide.guide : secondGuide.guide?.name || 'Second Guide';
              expensesByCity['Reiseleiter'].push({
                name: guideName,
                pricePerPerson: null,
                pax: null,
                usd: secondGuide.totalPayment || 0,
                uzs: 0
              });
            }

            if (bergreiseleiter && bergreiseleiter.totalPayment) {
              const guideName = typeof bergreiseleiter.guide === 'string' ? bergreiseleiter.guide : bergreiseleiter.guide?.name || 'Bergreiseleiter';
              expensesByCity['Reiseleiter'].push({
                name: guideName,
                pricePerPerson: null,
                pax: null,
                usd: bergreiseleiter.totalPayment || 0,
                uzs: 0
              });
            }

            // 8. Process Railways (from railways)
            if (railways && railways.length > 0) {
              railways.forEach(railway => {
                const departure = railway.departure || railway.from || '';
                const arrival = railway.arrival || railway.to || '';
                const routeName = railway.route || `${departure}-${arrival}`.trim();
                const name = routeName ? `Railway: ${routeName}` : 'Railway';
                const pax = railway.pax || tourists?.length || 0;
                const totalPrice = railway.price || 0;
                const pricePerPerson = pax > 0 ? totalPrice / pax : 0;

                expensesByCity['Railway & Flights'].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: totalPrice
                });
              });
            }

            // 9. Process Flights (from flights)
            if (flights && flights.length > 0) {
              flights.forEach(flight => {
                const departure = flight.departure || flight.from || '';
                const arrival = flight.arrival || flight.to || '';
                const routeName = flight.route || `${departure}-${arrival}`.trim();
                const name = routeName ? `Flight: ${routeName}` : 'Flight';
                const pricePerPerson = flight.pricePerTicket || flight.price || 0;
                const pax = flight.pax || 1;
                const total = pricePerPerson * pax;

                // Only add if there's a price
                if (total > 0) {
                  expensesByCity['Railway & Flights'].push({
                    name: name,
                    pricePerPerson: pricePerPerson,
                    pax: pax,
                    usd: 0,
                    uzs: total
                  });
                }
              });
            }

            // 10. Process Other (from tourServices.other)
            if (tourServices.other && tourServices.other.length > 0) {
              tourServices.other.forEach(item => {
                const name = item.name || 'Other';
                const pricePerPerson = item.pricePerPerson || 0;
                const pax = item.pax || 0;
                const total = pricePerPerson * pax;

                expensesByCity['Extra Kosten'].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: total
                });
              });
            }

            // Calculate totals
            let totalUSD = 0;
            let totalUZS = 0;

            Object.values(expensesByCity).forEach(cityExpenses => {
              cityExpenses.forEach(expense => {
                totalUSD += expense.usd;
                totalUZS += expense.uzs;
              });
            });

            // Filter out empty sections for display
            const sections = [
              ...cityOrder,
              'Transport',
              'Reiseleiter',
              'Railway & Flights',
              'Extra Kosten'
            ].filter(section => expensesByCity[section] && expensesByCity[section].length > 0);

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-red-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500"></div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Ausgaben {booking?.bookingNumber || ''}</h3>
                  <button
                    onClick={exportAusgabenToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:from-red-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-5 h-5" />
                    PDF saqlab olish
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gradient-to-r from-green-600 to-emerald-600">
                        <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Stadte</th>
                        <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Item</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Preis</th>
                        <th className="border border-gray-300 px-4 py-3 text-center text-white font-bold">PAX</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Dollar</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Som</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((section, sectionIdx) => {
                        const sectionExpenses = expensesByCity[section];

                        return (
                          <React.Fragment key={section}>
                            {/* Section Header Row */}
                            <tr className="bg-gradient-to-r from-green-500 to-emerald-500">
                              <td colSpan="6" className="border border-gray-300 px-4 py-2 text-white font-bold">
                                {section}
                              </td>
                            </tr>

                            {/* Section Items */}
                            {sectionExpenses.map((expense, expIdx) => (
                              <tr key={`${section}-${expIdx}`} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-2"></td>
                                <td className="border border-gray-300 px-4 py-2">{expense.name}</td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  {expense.pricePerPerson ?
                                    Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ')
                                    : ''}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-center">
                                  {expense.pax || ''}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                  {expense.usd > 0 ?
                                    Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ')
                                    : ''}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                  {expense.uzs > 0 ?
                                    Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ')
                                    : ''}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}

                      {/* Total Row */}
                      <tr className="bg-gradient-to-r from-slate-700 to-gray-700">
                        <td colSpan="4" className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                          TOTAL
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                          ${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                          {Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* RL Tab */}
          {costsTab === 'rl' && (() => {
            // Get tour type code for Opex localStorage keys
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
            const pax = tourists?.length || 0;

            // Collect all expenses and organize by city
            const expensesByCity = {};
            const cityOrder = ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Nurota', 'Bukhara', 'Qizilqum', 'Khiva'];

            // Initialize city sections
            cityOrder.forEach(city => {
              expensesByCity[city] = [];
            });

            // Add Reiseleiter section
            expensesByCity['Reiseleiter'] = [];

            // Add Extra Kosten section
            expensesByCity['Extra Kosten'] = [];

            // Helper function to map city names
            const mapCityName = (text) => {
              if (!text) return null;
              const str = text.toLowerCase().trim();

              // City name matching
              if (str.includes('tashkent') || str.includes('тошкент')) return 'Tashkent';
              if (str.includes('samarkand') || str.includes('samarqand') || str.includes('самарканд')) return 'Samarkand';
              if (str.includes('asraf') || str.includes('асраф')) return 'Asraf';
              if (str.includes('nurota') || str.includes('nurata') || str.includes('нурата')) return 'Nurota';
              if (str.includes('bukhara') || str.includes('buxoro') || str.includes('бухара')) return 'Bukhara';
              if (str.includes('khiva') || str.includes('xiva') || str.includes('хива')) return 'Khiva';
              if (str.includes('fergana') || str.includes('farg\'ona') || str.includes('фергана') || str.includes('margilan') || str.includes('qoqon') || str.includes('kokand')) return 'Fergana';
              if (str.includes('qizilqum') || str.includes('kyzylkum') || str.includes('қизилқум') || str.includes('choyxona') || str.includes('чойхона') || str.includes('chayhana') || str.includes('tea house')) return 'Qizilqum';

              return null;
            };

            // 1. Process Hotels (from grandTotalData.hotelBreakdown)
            if (grandTotalData && grandTotalData.hotelBreakdown) {
              grandTotalData.hotelBreakdown.forEach(hotelData => {
                // Find the accommodation to get city info
                const acc = accommodations.find(a => a.id === hotelData.accommodationId);
                const hotelName = hotelData.hotel || acc?.hotel?.name || 'Unknown Hotel';
                const cityName = acc?.hotel?.city?.name || '';

                // Skip Samarkand hotels in RL tab (check by CITY, not hotel name)
                const cityNameLower = cityName.toLowerCase();
                const isSamarkand = cityNameLower.includes('samarkand') || cityNameLower.includes('самарканд');
                if (isSamarkand) {
                  return; // Skip Samarkand hotels
                }

                // Map to standard city name
                let targetCity = mapCityName(cityName) || mapCityName(hotelName);
                if (!targetCity) targetCity = 'Extra Kosten'; // Default to Extra Kosten if unknown

                // Use costs from grandTotalData
                const totalUSD = hotelData.USD || hotelData.totalUSD || 0;
                const totalUZS = hotelData.UZS || hotelData.totalUZS || 0;

                expensesByCity[targetCity].push({
                  name: hotelName,
                  pricePerPerson: null,
                  pax: null,
                  usd: totalUSD,
                  uzs: totalUZS
                });
              });
            }

            // 2. Process Meals (from OPEX database state)
            // Use mealsData state loaded from database
            mealsData.forEach(meal => {
              const name = meal.name || 'Unknown Meal';
              const city = meal.city || '';
              const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              const mealPax = pax; // Use booking PAX, not individual meal PAX
              const total = pricePerPerson * mealPax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = 'Extra Kosten'; // Default to Extra Kosten if unknown

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: mealPax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // 3. Process Metro (from metroVehicles) - Skip for ZA tours
            if (metroVehicles && metroVehicles.length > 0 && booking?.tourType?.code !== 'ZA') {
              metroVehicles.forEach(metro => {
                const name = metro.name || 'Metro';
                const city = metro.city || '';
                const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
                const pricePerPerson = parseFloat(rawPrice.toString().replace(/\s/g, '')) || 0;
                const metroPax = (tourists?.length || 0) + 1; // +1 for guide
                const total = pricePerPerson * metroPax;

                // Map to standard city name
                let targetCity = mapCityName(city) || mapCityName(name);
                if (!targetCity) targetCity = cityOrder[0]; // Default to first city

                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: metroPax,
                  usd: 0,
                  uzs: total
                });
              });
            }

            // 4. Process Shou (from OPEX database state)
            // Use showsData state loaded from database
            showsData.forEach(show => {
              const name = show.name || 'Unknown Show';
              const city = show.city || '';
              const priceStr = (show.price || show.pricePerPerson || '0').toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              const showPax = show.pax || pax;
              const total = pricePerPerson * showPax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = cityOrder[0]; // Default to first city

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: showPax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // 5. Process Guide payments (show as single line with total)
            // Main Guide
            if (mainGuide && mainGuide.guide) {
              const guideName = typeof mainGuide.guide === 'string' ? mainGuide.guide : mainGuide.guide?.name || 'Main Guide';
              const totalPayment = mainGuide.totalPayment || 0;

              if (totalPayment > 0) {
                expensesByCity['Reiseleiter'].push({
                  name: guideName,
                  pricePerPerson: null,
                  pax: null,
                  usd: totalPayment,
                  uzs: 0
                });
              }
            }

            // Second Guide - Moved to Später tab
            // if (secondGuide && secondGuide.guide) {
            //   const guideName = typeof secondGuide.guide === 'string' ? secondGuide.guide : secondGuide.guide?.name || 'Second Guide';
            //   const totalPayment = secondGuide.totalPayment || 0;

            //   if (totalPayment > 0) {
            //     expensesByCity['Reiseleiter'].push({
            //       name: guideName,
            //       pricePerPerson: null,
            //       pax: null,
            //       usd: totalPayment,
            //       uzs: 0
            //     });
            //   }
            // }

            // Bergreiseleiter
            if (bergreiseleiter && bergreiseleiter.guide) {
              const guideName = typeof bergreiseleiter.guide === 'string' ? bergreiseleiter.guide : bergreiseleiter.guide?.name || 'Bergreiseleiter';
              const totalPayment = bergreiseleiter.totalPayment || 0;

              if (totalPayment > 0) {
                expensesByCity['Reiseleiter'].push({
                  name: guideName,
                  pricePerPerson: null,
                  pax: null,
                  usd: totalPayment,
                  uzs: 0
                });
              }
            }

            // 6. Process Other (from tourServices.other) - Extra Kosten
            if (tourServices.other && tourServices.other.length > 0) {
              tourServices.other.forEach(item => {
                const name = item.name || 'Other';
                const pricePerPerson = item.pricePerPerson || 0;
                const pax = item.pax || 0;
                const total = pricePerPerson * pax;

                expensesByCity['Extra Kosten'].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: pax,
                  usd: 0,
                  uzs: total
                });
              });
            }

            // Calculate totals
            let totalUSD = 0;
            let totalUZS = 0;

            Object.values(expensesByCity).forEach(cityExpenses => {
              cityExpenses.forEach(expense => {
                totalUSD += expense.usd;
                totalUZS += expense.uzs;
              });
            });

            // Convert UZS to USD and combine
            const uzsToUsd = rlExchangeRate > 0 ? totalUZS / rlExchangeRate : 0;
            const combinedTotalUSD = totalUSD + uzsToUsd;

            // Filter out empty sections for display
            const sections = [
              ...cityOrder,
              'Reiseleiter',
              'Extra Kosten'
            ].filter(section => expensesByCity[section] && expensesByCity[section].length > 0);

            const hasData = sections.length > 0;

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-green-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Ausgaben {booking?.bookingNumber || ''} (Reiseleiter)</h3>
                  <div className="flex items-center gap-4">
                    {/* Exchange Rate Input */}
                    <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border-2 border-blue-200">
                      <label className="text-sm font-semibold text-blue-900 whitespace-nowrap">Kurs (USD → UZS):</label>
                      <input
                        type="text"
                        value={rlExchangeRate ? rlExchangeRate.toLocaleString('en-US').replace(/,/g, ' ') : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\s/g, '');
                          const numValue = parseFloat(value) || null;
                          setRlExchangeRate(numValue);
                        }}
                        className="w-28 px-3 py-1.5 text-right font-bold text-blue-900 bg-white border-2 border-blue-300 rounded focus:outline-none focus:border-blue-500"
                        placeholder="12 800"
                      />
                    </div>
                    {hasData && (
                      <button
                        onClick={exportRLToPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                      >
                        <Download className="w-5 h-5" />
                        PDF saqlab olish
                      </button>
                    )}
                  </div>
                </div>

                {hasData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gradient-to-r from-green-600 to-emerald-600">
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Stadte</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Item</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Preis</th>
                          <th className="border border-gray-300 px-4 py-3 text-center text-white font-bold">PAX</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Dollar</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Som</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map((section, sectionIdx) => {
                          const sectionExpenses = expensesByCity[section];

                          return (
                            <React.Fragment key={section}>
                              {/* Section Header Row */}
                              <tr className="bg-gradient-to-r from-green-500 to-emerald-500">
                                <td colSpan="6" className="border border-gray-300 px-4 py-2 text-white font-bold">
                                  {section}
                                </td>
                              </tr>

                              {/* Section Items */}
                              {sectionExpenses.map((expense, expIdx) => (
                                <tr key={`${section}-${expIdx}`} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2"></td>
                                  <td className="border border-gray-300 px-4 py-2">{expense.name}</td>
                                  <td className="border border-gray-300 px-4 py-2 text-right">
                                    {expense.pricePerPerson ?
                                      Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-center">
                                    {expense.pax || ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.usd > 0 ?
                                      Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.uzs > 0 ?
                                      Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}

                        {/* Row 1 - Separate USD and UZS (gray, larger) */}
                        <tr className="bg-gray-200">
                          <td colSpan="4" className="border border-gray-300 px-4 py-2 text-right text-gray-900 font-bold text-base">
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right text-gray-900 font-bold text-base">
                            ${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right text-gray-900 font-bold text-base">
                            {Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                        </tr>
                        {/* Row 2 - Converted UZS to USD (gray, larger) */}
                        <tr className="bg-gray-200">
                          <td colSpan="5" className="border border-gray-300 px-4 py-2 text-right text-gray-900 font-bold text-base">
                            Kurs: 1 USD = {Math.round(rlExchangeRate).toLocaleString('en-US').replace(/,/g, ' ')} UZS
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right text-gray-900 font-bold text-base">
                            ${Math.round(uzsToUsd).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                        </tr>
                        {/* Row 3 - Total Sum (gray, larger) */}
                        <tr className="bg-gray-200">
                          <td colSpan="5" className="border border-gray-300 px-4 py-3 text-right text-gray-900 font-bold text-lg">
                            <span className="text-2xl font-extrabold mr-4">Total:</span>
                            <span className="text-base">${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')} + ${Math.round(uzsToUsd).toLocaleString('en-US').replace(/,/g, ' ')}</span>
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-gray-900 font-bold text-lg">
                            = ${Math.round(combinedTotalUSD).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <User className="w-16 h-16 mx-auto" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">No data available</p>
                    <p className="text-gray-500 text-sm mt-2">Add hotels, meals, or assign guides to see RL data</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Spater Tab */}
          {costsTab === 'spater' && (() => {
            // Collect expenses for Später tab
            const expensesByCity = {};
            expensesByCity['Samarkand'] = [];
            expensesByCity['Transport'] = [];
            expensesByCity['Reiseleiter'] = [];

            // 1. Process Hotels in Samarkand
            if (grandTotalData && grandTotalData.hotelBreakdown) {
              grandTotalData.hotelBreakdown.forEach(hotelData => {
                const acc = accommodations.find(a => a.id === hotelData.accommodationId);
                const hotelName = hotelData.hotel || acc?.hotel?.name || 'Unknown Hotel';
                const cityName = acc?.hotel?.city?.name || '';

                // Only include Samarkand hotels (check by CITY, not hotel name)
                const cityNameLower = cityName.toLowerCase();
                const isSamarkand = cityNameLower.includes('samarkand') || cityNameLower.includes('самарканд');

                if (isSamarkand) {
                  const totalUSD = hotelData.USD || hotelData.totalUSD || 0;
                  const totalUZS = hotelData.UZS || hotelData.totalUZS || 0;

                  expensesByCity['Samarkand'].push({
                    name: hotelName,
                    pricePerPerson: null,
                    pax: null,
                    usd: totalUSD,
                    uzs: totalUZS
                  });
                }
              });
            }

            // 2. Process Routes/Transport - Calculate totals by Provider
            if (routes && routes.length > 0) {
              const providerTotals = {
                xayrulla: 0,
                sevil: 0,
                nosir: 0
              };

              routes.forEach(route => {
                const price = route.price || 0;
                const provider = route.provider || '';

                if (price > 0) {
                  const providerLower = provider.toLowerCase().trim();
                  if (providerLower.includes('sevil')) {
                    providerTotals.sevil += price;
                  } else if (providerLower.includes('xayrulla') || providerLower.includes('hayrulla') || providerLower.includes('хайрулла')) {
                    providerTotals.xayrulla += price;
                  } else if (providerLower.includes('nosir') || providerLower.includes('носир')) {
                    providerTotals.nosir += price;
                  } else {
                    // Default to xayrulla if provider not specified
                    providerTotals.xayrulla += price;
                  }
                }
              });

              // Add provider totals as single rows
              if (providerTotals.xayrulla > 0) {
                expensesByCity['Transport'].push({
                  name: 'Xayrulla',
                  pricePerPerson: null,
                  pax: null,
                  usd: providerTotals.xayrulla,
                  uzs: 0
                });
              }

              if (providerTotals.sevil > 0) {
                expensesByCity['Transport'].push({
                  name: 'Sevil',
                  pricePerPerson: null,
                  pax: null,
                  usd: providerTotals.sevil,
                  uzs: 0
                });
              }

              if (providerTotals.nosir > 0) {
                expensesByCity['Transport'].push({
                  name: 'Nosir',
                  pricePerPerson: null,
                  pax: null,
                  usd: providerTotals.nosir,
                  uzs: 0
                });
              }
            }

            // 3. Process Second Guide (moved from RL tab)
            if (secondGuide && secondGuide.guide) {
              const guideName = typeof secondGuide.guide === 'string' ? secondGuide.guide : secondGuide.guide?.name || 'Second Guide';
              const totalPayment = secondGuide.totalPayment || 0;

              if (totalPayment > 0) {
                expensesByCity['Reiseleiter'].push({
                  name: guideName,
                  pricePerPerson: null,
                  pax: null,
                  usd: totalPayment,
                  uzs: 0
                });
              }
            }

            // Calculate totals
            let totalUSD = 0;
            let totalUZS = 0;

            Object.values(expensesByCity).forEach(cityExpenses => {
              cityExpenses.forEach(expense => {
                totalUSD += expense.usd;
                totalUZS += expense.uzs;
              });
            });

            // Filter out empty sections for display
            const sections = ['Samarkand', 'Transport', 'Reiseleiter'].filter(section => expensesByCity[section] && expensesByCity[section].length > 0);

            const hasData = sections.length > 0;

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500"></div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Ausgaben {booking?.bookingNumber || ''} (Später)</h3>
                  {hasData && (
                    <button
                      onClick={exportSpaterToPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                      PDF saqlab olish
                    </button>
                  )}
                </div>

                {hasData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-600 to-cyan-600">
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Städte</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Item</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Preis</th>
                          <th className="border border-gray-300 px-4 py-3 text-center text-white font-bold">PAX</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Dollar</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Som</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map((section, sectionIdx) => {
                          const sectionExpenses = expensesByCity[section];

                          return (
                            <React.Fragment key={section}>
                              {/* Section Header Row */}
                              <tr className="bg-gradient-to-r from-blue-500 to-cyan-500">
                                <td colSpan="6" className="border border-gray-300 px-4 py-2 text-white font-bold">
                                  {section}
                                </td>
                              </tr>

                              {/* Section Items */}
                              {sectionExpenses.map((expense, expIdx) => (
                                <tr key={`${section}-${expIdx}`} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2"></td>
                                  <td className="border border-gray-300 px-4 py-2">{expense.name}</td>
                                  <td className="border border-gray-300 px-4 py-2 text-right">
                                    {expense.pricePerPerson ?
                                      Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-center">
                                    {expense.pax || ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.usd > 0 ?
                                      Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.uzs > 0 ?
                                      Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}

                        {/* Total Row */}
                        <tr className="bg-gradient-to-r from-slate-700 to-gray-700">
                          <td colSpan="4" className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            ${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            {Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <User className="w-16 h-16 mx-auto" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">Ma'lumot topilmadi</p>
                    <p className="text-gray-500 text-sm mt-2">Kirish to'lovlari, ko'rsatuvlar, transport yoki parvozlarni qo'shing</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Uberweisung Tab */}
          {costsTab === 'uberweisung' && (() => {
            // Get tour type code for Opex localStorage keys
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';
            const pax = tourists?.length || 0;

            // Collect Eintritt expenses and organize by city
            const expensesByCity = {};
            const cityOrder = ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Nurota', 'Bukhara', 'Qizilqum', 'Khiva'];

            // Initialize city sections
            cityOrder.forEach(city => {
              expensesByCity[city] = [];
            });

            // Helper function to map city names
            const mapCityName = (text) => {
              if (!text) return null;
              const str = text.toLowerCase().trim();

              // City name matching
              if (str.includes('tashkent') || str.includes('тошкент')) return 'Tashkent';
              if (str.includes('samarkand') || str.includes('samarqand') || str.includes('самарканд')) return 'Samarkand';
              if (str.includes('asraf') || str.includes('асраф')) return 'Asraf';
              if (str.includes('nurota') || str.includes('nurata') || str.includes('нурата')) return 'Nurota';
              if (str.includes('bukhara') || str.includes('buxoro') || str.includes('бухара')) return 'Bukhara';
              if (str.includes('khiva') || str.includes('xiva') || str.includes('хива')) return 'Khiva';
              if (str.includes('fergana') || str.includes('farg\'ona') || str.includes('фергана') || str.includes('margilan') || str.includes('qoqon') || str.includes('kokand')) return 'Fergana';
              if (str.includes('qizilqum') || str.includes('kyzylkum') || str.includes('қизилқум') || str.includes('choyxona') || str.includes('чойхона') || str.includes('chayhana') || str.includes('tea house')) return 'Qizilqum';

              return null;
            };

            // Process Entrance Fees (Eintritt) - from OPEX database state
            // Use sightseeingData state loaded from database
            sightseeingData.forEach(sight => {
              const name = sight.name || 'Unknown Entrance';
              const city = sight.city || '';
              const priceStr = (sight.price || sight.pricePerPerson || '0').toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              const sightPax = pax;
              const total = pricePerPerson * sightPax;

              // Map to standard city name
              let targetCity = mapCityName(city) || mapCityName(name);
              if (!targetCity) targetCity = cityOrder[0];

              if (total > 0) {
                expensesByCity[targetCity].push({
                  name: name,
                  pricePerPerson: pricePerPerson,
                  pax: sightPax,
                  usd: 0,
                  uzs: total
                });
              }
            });

            // Calculate totals
            let totalUSD = 0;
            let totalUZS = 0;

            Object.values(expensesByCity).forEach(cityExpenses => {
              cityExpenses.forEach(expense => {
                totalUSD += expense.usd;
                totalUZS += expense.uzs;
              });
            });

            // Filter out empty sections for display
            const sections = cityOrder.filter(section => expensesByCity[section] && expensesByCity[section].length > 0);

            const hasData = sections.length > 0;

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-purple-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500"></div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Ausgaben {booking?.bookingNumber || ''} (Überweisung)</h3>
                  {hasData && (
                    <button
                      onClick={exportUberweisungToPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg hover:from-purple-700 hover:to-violet-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                      PDF saqlab olish
                    </button>
                  )}
                </div>

                {hasData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-violet-600">
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Städte</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Item</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Preis</th>
                          <th className="border border-gray-300 px-4 py-3 text-center text-white font-bold">PAX</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Dollar</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Som</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map((section, sectionIdx) => {
                          const sectionExpenses = expensesByCity[section];

                          return (
                            <React.Fragment key={section}>
                              {/* Section Header Row */}
                              <tr className="bg-gradient-to-r from-purple-500 to-violet-500">
                                <td colSpan="6" className="border border-gray-300 px-4 py-2 text-white font-bold">
                                  {section}
                                </td>
                              </tr>

                              {/* Section Items */}
                              {sectionExpenses.map((expense, expIdx) => (
                                <tr key={`${section}-${expIdx}`} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2"></td>
                                  <td className="border border-gray-300 px-4 py-2">{expense.name}</td>
                                  <td className="border border-gray-300 px-4 py-2 text-right">
                                    {expense.pricePerPerson ?
                                      Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-center">
                                    {expense.pax || ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.usd > 0 ?
                                      Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.uzs > 0 ?
                                      Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}

                        {/* Total Row */}
                        <tr className="bg-gradient-to-r from-slate-700 to-gray-700">
                          <td colSpan="4" className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            ${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            {Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <User className="w-16 h-16 mx-auto" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">Ma'lumot topilmadi</p>
                    <p className="text-gray-500 text-sm mt-2">Kirish to'lovlarini (Eintritt) qo'shing</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Karta Tab */}
          {costsTab === 'karta' && (() => {
            // Collect Railway & Flights expenses only
            const expensesByCity = {};
            expensesByCity['Railway & Flights'] = [];

            // 1. Process Railways
            if (railways && railways.length > 0) {
              railways.forEach(railway => {
                const departure = railway.departure || railway.from || '';
                const arrival = railway.arrival || railway.to || '';
                const routeName = railway.route || `${departure}-${arrival}`.trim();
                const name = routeName ? `Railway: ${routeName}` : 'Railway';
                const pax = railway.pax || 1;

                // railway.price is the TOTAL price, not per ticket
                // Calculate price per ticket by dividing total by pax
                const total = railway.price || 0;
                const pricePerTicket = railway.pricePerTicket || (total > 0 && pax > 0 ? total / pax : 0);

                if (total > 0) {
                  expensesByCity['Railway & Flights'].push({
                    name: name,
                    pricePerPerson: pricePerTicket,
                    pax: pax,
                    usd: 0,
                    uzs: total
                  });
                }
              });
            }

            // 2. Process Flights
            if (flights && flights.length > 0) {
              flights.forEach(flight => {
                const departure = flight.departure || flight.from || '';
                const arrival = flight.arrival || flight.to || '';
                const routeName = flight.route || `${departure}-${arrival}`.trim();
                const name = routeName ? `Flight: ${routeName}` : 'Flight';
                const pax = flight.pax || 1;

                // flight.price is the TOTAL price, not per ticket
                // Calculate price per ticket by dividing total by pax
                const total = flight.price || 0;
                const pricePerTicket = flight.pricePerTicket || (total > 0 && pax > 0 ? total / pax : 0);

                if (total > 0) {
                  expensesByCity['Railway & Flights'].push({
                    name: name,
                    pricePerPerson: pricePerTicket,
                    pax: pax,
                    usd: 0,
                    uzs: total
                  });
                }
              });
            }

            // Calculate totals
            let totalUSD = 0;
            let totalUZS = 0;

            Object.values(expensesByCity).forEach(cityExpenses => {
              cityExpenses.forEach(expense => {
                totalUSD += expense.usd;
                totalUZS += expense.uzs;
              });
            });

            // Filter out empty sections for display
            const sections = ['Railway & Flights'].filter(section => expensesByCity[section] && expensesByCity[section].length > 0);

            const hasData = sections.length > 0;

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-orange-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"></div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Ausgaben {booking?.bookingNumber || ''} (Card Payments)</h3>
                  {hasData && (
                    <button
                      onClick={exportKartaToPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                      PDF saqlab olish
                    </button>
                  )}
                </div>

                {hasData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gradient-to-r from-orange-600 to-amber-600">
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Städte</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-white font-bold">Item</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Preis</th>
                          <th className="border border-gray-300 px-4 py-3 text-center text-white font-bold">PAX</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Dollar</th>
                          <th className="border border-gray-300 px-4 py-3 text-right text-white font-bold">Som</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map((section, sectionIdx) => {
                          const sectionExpenses = expensesByCity[section];

                          return (
                            <React.Fragment key={section}>
                              {/* Section Header Row */}
                              <tr className="bg-gradient-to-r from-orange-500 to-amber-500">
                                <td colSpan="6" className="border border-gray-300 px-4 py-2 text-white font-bold">
                                  {section}
                                </td>
                              </tr>

                              {/* Section Items */}
                              {sectionExpenses.map((expense, expIdx) => (
                                <tr key={`${section}-${expIdx}`} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2"></td>
                                  <td className="border border-gray-300 px-4 py-2">{expense.name}</td>
                                  <td className="border border-gray-300 px-4 py-2 text-right">
                                    {expense.pricePerPerson ?
                                      Math.round(expense.pricePerPerson).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-center">
                                    {expense.pax || ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.usd > 0 ?
                                      Math.round(expense.usd).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                                    {expense.uzs > 0 ?
                                      Math.round(expense.uzs).toLocaleString('en-US').replace(/,/g, ' ')
                                      : ''}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}

                        {/* Total Row */}
                        <tr className="bg-gradient-to-r from-slate-700 to-gray-700">
                          <td colSpan="4" className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            ${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right text-white font-bold text-lg">
                            {Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <User className="w-16 h-16 mx-auto" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">Ma'lumot topilmadi</p>
                    <p className="text-gray-500 text-sm mt-2">Temir yo'l yoki parvozlarni qo'shing</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Total Tab */}
          {costsTab === 'total' && (() => {
            // Calculate all totals in their original currencies
            const pax = tourists?.length || 0;
            const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';

            // 1. Hotels - has BOTH USD and UZS (from grandTotalData)
            const hotelsUSD = grandTotalData?.grandTotalUSD || 0;
            const hotelsUZS = grandTotalData?.grandTotalUZS || 0;

            // 2. Transport & Routes - ONLY USD
            const transportUSD = routes?.reduce((sum, r) => sum + (r.price || 0), 0) || 0;

            // 3. Railway - ONLY UZS
            const railwayUZS = railways?.reduce((sum, r) => sum + (r.price || 0), 0) || 0;

            // 4. Flights - ONLY UZS
            const flightsUZS = flights?.reduce((sum, f) => sum + (f.price || 0), 0) || 0;

            // 5. Guide - ONLY USD
            const guideUSD = (mainGuide?.totalPayment || 0) + (secondGuide?.totalPayment || 0) + (bergreiseleiter?.totalPayment || 0);

            // 6. Meals - ONLY UZS (from OPEX database state)
            // Use mealsData state loaded from database
            const mealsUZS = mealsData.reduce((sum, meal) => {
              const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              return sum + (pricePerPerson * pax);
            }, 0);

            // 7. Metro - ONLY UZS (from API) - Skip for ZA tours
            const metroData = (booking?.tourType?.code !== 'ZA') ? (metroVehicles || []) : [];
            const metroPax = pax + 1; // +1 for guide (tourists + guide)
            const metroUZS = metroData.reduce((sum, metro) => {
              const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
              const priceStr = rawPrice.toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              return sum + (pricePerPerson * metroPax);
            }, 0);

            // 8. Shows - ONLY UZS (from OPEX database state)
            // Use showsData state loaded from database
            const showsUZS = showsData.reduce((sum, show) => {
              const rawPrice = show.price || show.pricePerPerson || 0;
              const priceStr = rawPrice.toString().replace(/\s/g, '');
              const pricePerPerson = parseFloat(priceStr) || 0;
              return sum + (pricePerPerson * pax);
            }, 0);

            // 9. Eintritt (Entrance Fees) - ONLY UZS (from OPEX database state)
            // Use sightseeingData state loaded from database
            const services = tourServices.eintritt || [];
            const savedEntriesMap = new Map(services.map(s => [s.name.toLowerCase().trim(), s]));

            // Merge template entries with saved entries (recalculate with current PAX)
            const allEintrittEntries = sightseeingData.map(item => {
              const itemName = item.name.toLowerCase().trim();
              const savedEntry = savedEntriesMap.get(itemName);

              if (savedEntry) {
                savedEntriesMap.delete(itemName);
                // Recalculate price with current tourists count
                const currentPax = tourists?.length || 0;
                const pricePerPerson = savedEntry.pricePerPerson || 0;
                return {
                  price: pricePerPerson * currentPax
                };
              } else {
                // Template entry - use current tourists count
                const currentPax = tourists?.length || 0;
                const pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
                return {
                  price: pricePerPerson * currentPax
                };
              }
            });

            // Add remaining saved entries (recalculate with current PAX)
            savedEntriesMap.forEach(savedEntry => {
              const currentPax = tourists?.length || 0;
              const pricePerPerson = savedEntry.pricePerPerson || 0;
              allEintrittEntries.push({
                price: pricePerPerson * currentPax
              });
            });

            const eintrittUZS = allEintrittEntries.reduce((sum, s) => sum + (s.price || 0), 0);

            // 10. Other Expenses - ONLY UZS
            const otherUZS = tourServices.other ? tourServices.other.reduce((sum, item) => sum + ((item.pricePerPerson || 0) * (item.pax || 0)), 0) : 0;

            // Grand Totals (sum only in their respective currencies)
            const totalUZS = hotelsUZS + railwayUZS + flightsUZS + mealsUZS + metroUZS + showsUZS + eintrittUZS + otherUZS;
            const totalUSD = hotelsUSD + transportUSD + guideUSD;

            return (
              <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-slate-100 p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-slate-700 via-gray-700 to-zinc-700"></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-3xl">💰</span>
                  Total
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-700 to-zinc-700 border-b-2 border-slate-800">
                        <th className="px-4 py-3 text-center text-sm font-bold text-white border-r border-slate-500">#</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-white border-r border-slate-500">CATEGORY</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-white border-r border-slate-500">AMOUNT (UZS)</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-white">AMOUNT ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-semibold mx-auto">
                            1
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Hotels
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {hotelsUZS > 0 ? Math.round(hotelsUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          {hotelsUSD > 0 ? `$${Math.round(hotelsUSD).toLocaleString('en-US').replace(/,/g, ' ')}` : '-'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold mx-auto">
                            2
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Transport & Routes
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          -
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          {transportUSD > 0 ? `$${Math.round(transportUSD).toLocaleString('en-US').replace(/,/g, ' ')}` : '-'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-semibold mx-auto">
                            3
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Railway
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {railwayUZS > 0 ? Math.round(railwayUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          -
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold mx-auto">
                            4
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Flights
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {flightsUZS > 0 ? Math.round(flightsUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          -
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-semibold mx-auto">
                            5
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Guide
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          -
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          {guideUSD > 0 ? `$${Math.round(guideUSD).toLocaleString('en-US').replace(/,/g, ' ')}` : '-'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold mx-auto">
                            6
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Meals
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {mealsUZS > 0 ? Math.round(mealsUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          -
                        </td>
                      </tr>
                      {/* Hide Metro row for ZA tours */}
                      {booking?.tourType?.code !== 'ZA' && (
                        <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-center border-r border-gray-200">
                            <div className="w-8 h-8 rounded-full bg-lime-500 text-white flex items-center justify-center font-semibold mx-auto">
                              7
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                            Metro
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                            {metroUZS > 0 ? Math.round(metroUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                            -
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center font-semibold mx-auto">
                            8
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Shows
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {showsUZS > 0 ? Math.round(showsUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          -
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-cyan-500 text-white flex items-center justify-center font-semibold mx-auto">
                            9
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Eintritt
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {eintrittUZS > 0 ? Math.round(eintrittUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          -
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-slate-500 text-white flex items-center justify-center font-semibold mx-auto">
                            10
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                          Other Expenses
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-r border-gray-200">
                          {otherUZS > 0 ? Math.round(otherUZS).toLocaleString('en-US').replace(/,/g, ' ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                          -
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-slate-100 to-zinc-200 border-t-2 border-slate-300">
                        <td colSpan="2" className="px-4 py-4 text-right font-bold text-gray-900 text-xl">
                          Grand Total:
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-slate-700 text-2xl border-r border-slate-300">
                          {totalUZS > 0 ? `${Math.round(totalUZS).toLocaleString('en-US').replace(/,/g, ' ')} UZS` : '-'}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-green-700 text-2xl">
                          {totalUSD > 0 ? `$${Math.round(totalUSD).toLocaleString('en-US').replace(/,/g, ' ')}` : '-'}
                        </td>
                      </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}
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
                    {formData.departureDate ? (() => {
                      const tourTypeCode = booking?.tourType?.code;
                      const daysToAdd = tourTypeCode === 'KAS' ? 14 : (tourTypeCode === 'ZA' ? 4 : 1);
                      return format(addDays(new Date(formData.departureDate), daysToAdd), 'dd.MM.yyyy');
                    })() : '-'}
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
                  title="Save current routes as default template for this tour type"
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

            {/* DESKTOP: Table view */}
            {!isMobile && (
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
                          {booking?.tourType?.code === 'ZA' ? (
                            // ZA tours: Only Tashkent, Samarkand, Bukhara
                            <>
                              <optgroup label="Tashkent (Xayrulla)">
                                <option value="Tashkent">Tashkent</option>
                              </optgroup>
                              <optgroup label="Samarkand & Bukhara (Sevil-Za)">
                                <option value="Samarkand">Samarkand</option>
                                <option value="Bukhara">Bukhara</option>
                              </optgroup>
                            </>
                          ) : (
                            // Other tours: All cities
                            <>
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
                            </>
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={route.route || ''}
                          onChange={(e) => handleRouteSelectionChange(route.id, e.target.value, index)}
                          className="w-full px-2 py-1.5 bg-violet-50 text-violet-800 rounded-md text-xs font-medium border border-violet-200 focus:ring-1 focus:ring-violet-400 cursor-pointer min-w-[160px]"
                        >
                          <option value="">Select Route</option>
                          {booking?.tourType?.code === 'ZA' ? (
                            // ZA tours: Simplified route list
                            <>
                              <optgroup label="Pickup / Drop-off">
                                <option value="Airport Pickup">Airport Pickup</option>
                                <option value="Airport Drop-off">Airport Drop-off</option>
                                <option value="Train Station Pickup">Train Station Pickup</option>
                                <option value="Train Station Drop-off">Train Station Drop-off</option>
                              </optgroup>
                              <optgroup label="City Tour">
                                <option value="Samarkand City Tour">Samarkand City Tour</option>
                                <option value="Bukhara City Tour">Bukhara City Tour</option>
                              </optgroup>
                              <optgroup label="Transfer">
                                <option value="Olot - Bukhara">Olot - Bukhara</option>
                                <option value="Bukhara - Samarkand">Bukhara - Samarkand</option>
                                <option value="Samarkand - Jartepa">Samarkand - Jartepa</option>
                                <option value="Oybek - Tashkent">Oybek - Tashkent</option>
                                <option value="Tashkent - Chernyayevka">Tashkent - Chernyayevka</option>
                              </optgroup>
                            </>
                          ) : (
                            // Other tours: Full route list
                            <>
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
                                <option value="Qoqon - Fergana">Qoqon - Fergana</option>
                                <option value="Fergana - Qoqon">Fergana - Qoqon</option>
                                <option value="Fergana - Margilan">Fergana - Margilan</option>
                                <option value="Dostlik - Fergana">Dostlik - Fergana</option>
                                <option value="Tashkent - Chimgan - Tashkent">Tashkent - Chimgan - Tashkent</option>
                              </optgroup>
                            </>
                          )}
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
                          {route.choiceTab === 'sevil-er' && sevilErVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                          {route.choiceTab === 'sevil-co' && sevilCoVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                          {route.choiceTab === 'sevil-kas' && sevilKasVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                          {route.choiceTab === 'sevil-za' && sevilZaVehicles.map(v => (
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
                          {route.choiceTab === 'sevil-er' && (
                            <>
                              <option value="pickupDropoff">Pickup/Drop-off</option>
                              <option value="tagRate">TAG Rate</option>
                              <option value="urgenchRate">Urgench</option>
                              <option value="shovotRate">Shovot</option>
                            </>
                          )}
                          {route.choiceTab === 'sevil-co' && (
                            <>
                              <option value="pickupDropoff">Pickup/Drop-off</option>
                              <option value="tagRate">TAG Rate</option>
                              <option value="urgenchRate">Urgench</option>
                              <option value="shovotRate">Shovot</option>
                            </>
                          )}
                          {route.choiceTab === 'sevil-kas' && (
                            <>
                              <option value="pickupDropoff">Pickup/Drop-off</option>
                              <option value="tagRate">TAG Rate</option>
                              <option value="urgenchRate">Urgench</option>
                              <option value="shovotRate">Shovot</option>
                            </>
                          )}
                          {route.choiceTab === 'sevil-za' && (
                            <>
                              <option value="pickupDropoff">Pickup/Drop-off</option>
                              <option value="tagRate">TAG Rate</option>
                              <option value="jartepaRate">Jartepa Rate</option>
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
            )}

            {/* MOBILE: Card view */}
            {isMobile && (
              <div className="p-4 space-y-3">
                {erRoutes.map((route, index) => (
                  <div
                    key={route.id}
                    className={`rounded-2xl border-2 shadow-md p-4 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    {/* Header: Number + City */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-700 text-white rounded-md flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <span className="font-semibold text-gray-900">{route.shahar || 'Select city'}</span>
                      </div>
                      <button
                        onClick={() => deleteERRoute(route.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Date */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {index === 0 ? '📅 Arrival Date' : '📅 Date'}
                      </label>
                      <input
                        type="date"
                        value={route.sana || ''}
                        onChange={(e) => handleRouteDateChange(index, e.target.value)}
                        className="w-full px-3 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm font-medium border border-amber-200 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    {/* Route */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">🚗 Route</label>
                      <div className="text-sm text-gray-900 font-medium bg-violet-50 px-3 py-2 rounded-lg border border-violet-200">
                        {route.route || 'Not selected'}
                      </div>
                    </div>

                    {/* PAX + Price */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">👥 PAX</label>
                        <div className="text-sm font-bold text-gray-900 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 text-center">
                          {route.paxCount || booking?.pax || 0}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">💵 Price</label>
                        <div className="text-sm font-bold text-gray-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 text-center">
                          ${parseFloat(route.price || 0).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {erRoutes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No routes yet</p>
                    <p className="text-xs mt-1">Click "Add Route" to start</p>
                  </div>
                )}
              </div>
            )}

            {/* Cost Summary */}
            {erRoutes.length > 0 && erRoutes.some(r => parseFloat(r.price) > 0) && (
              <div className="mt-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-8">
                  {/* Provider Totals */}
                  <div className="flex items-center gap-5">
                    {erRoutes.some(r => r.choiceTab?.includes('sevil') && parseFloat(r.price) > 0) && (
                      <div className="flex items-center gap-3 px-5 py-3 bg-blue-100 rounded-xl border border-blue-200">
                        <span className="text-sm font-semibold text-blue-700">Sevil</span>
                        <span className="text-xl font-bold text-blue-800">
                          ${erRoutes.filter(r => r.choiceTab?.includes('sevil')).reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0).toFixed(0)}
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
                {(() => {
                  // Determine Sevil tab based on tour type
                  const tourCode = booking?.tourType?.code;
                  let sevilTab = { id: 'sevil', name: 'Sevil', color: 'blue' };

                  if (tourCode === 'KAS') sevilTab = { id: 'sevil-kas', name: 'Sevil KAS', color: 'orange' };
                  else if (tourCode === 'CO') sevilTab = { id: 'sevil-co', name: 'Sevil CO', color: 'emerald' };
                  else if (tourCode === 'ZA') sevilTab = { id: 'sevil-za', name: 'Sevil ZA', color: 'purple' };
                  else if (tourCode === 'ER') sevilTab = { id: 'sevil-er', name: 'Sevil ER', color: 'blue' };

                  return [
                    sevilTab,
                    { id: 'xayrulla', name: 'Xayrulla', color: 'cyan' },
                    { id: 'nosir', name: 'Nosir', color: 'teal' },
                  ];
                })().map((tab) => (
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
                    {(selectedProviderTab === 'sevil' || selectedProviderTab.startsWith('sevil-')) && (
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
                    if (selectedProviderTab === 'sevil-er') vehicles = sevilErVehicles;
                    else if (selectedProviderTab === 'sevil-co') vehicles = sevilCoVehicles;
                    else if (selectedProviderTab === 'sevil-kas') vehicles = sevilKasVehicles;
                    else if (selectedProviderTab === 'sevil-za') vehicles = sevilZaVehicles;
                    else if (selectedProviderTab === 'sevil') vehicles = sevilVehicles;
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
                          {(selectedProviderTab === 'sevil' || selectedProviderTab.startsWith('sevil-')) && (
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
            <div className={`bg-gradient-to-br from-gray-50 via-white to-gray-50 py-4 md:py-8 px-4 md:px-8 w-full ${!isMobile ? '-mx-4' : ''}`} style={!isMobile ? { width: 'calc(100vw - 16rem)', marginLeft: '-1rem' } : {}}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
                <h2 className="text-lg md:text-2xl font-black text-gray-900 flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-primary-600 flex items-center justify-center shadow-lg">
                    <Building2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  Hotel Accommodation
                </h2>
                <div className={`flex items-center gap-2 md:gap-3 ${isMobile ? 'flex-wrap w-full' : ''}`}>
                  {/* PDF Auto-save Folder Configuration */}
                  {isFileSystemAccessSupported() && (
                    <button
                      onClick={handleConfigurePdfFolder}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-bold shadow-md ${
                        pdfFolderConfigured
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                          : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                      }`}
                      title={pdfFolderConfigured ? `PDF auto-save: ${pdfFolderName}` : 'PDF papkasini tanlash (bir marta)'}
                    >
                      {pdfFolderConfigured ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <FolderOpen className="w-4 h-4" />
                          <span className="text-xs">{pdfFolderName}</span>
                        </>
                      ) : (
                        <>
                          <Folder className="w-4 h-4" />
                          <span className="text-xs">PDF Papka</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* ER Hotels button - only for ER tours */}
                  {booking?.tourType?.code === 'ER' && (
                    <button
                      onClick={autoFillAccommodationsFromItinerary}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                      title="Создать отели для ER тура (Eurasia Route)"
                    >
                      <Wand2 className="w-5 h-5" />
                      ER Hotels
                    </button>
                  )}

                  {/* CO Hotels button - only for CO tours */}
                  {booking?.tourType?.code === 'CO' && (
                    <button
                      onClick={autoFillAccommodationsFromItinerary}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                      title="Создать отели для CO тура (Combination)"
                    >
                      <Wand2 className="w-5 h-5" />
                      CO Hotels
                    </button>
                  )}

                  {/* KAS Hotels button - only for KAS tours */}
                  {booking?.tourType?.code === 'KAS' && (
                    <button
                      onClick={autoFillAccommodationsFromItinerary}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                      title="Создать отели для KAS тура (Kasakistan, Kirgistan und Usbekistan)"
                    >
                      <Wand2 className="w-5 h-5" />
                      KAS Hotels
                    </button>
                  )}

                  {/* ZA Hotels button - only for ZA tours */}
                  {booking?.tourType?.code === 'ZA' && (
                    <button
                      onClick={autoFillAccommodationsFromItinerary}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                      title="Создать отели для ZA тура (Zentralasian)"
                    >
                      <Wand2 className="w-5 h-5" />
                      ZA Hotels
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingAccommodation(null); setAccommodationFormOpen(true); }}
                    className={`inline-flex items-center gap-2 px-4 md:px-5 py-2 md:py-3 text-xs md:text-sm bg-gradient-to-r from-blue-600 to-primary-600 text-white rounded-lg md:rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-bold shadow-md ${isMobile ? 'w-full justify-center' : ''}`}
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                    {isMobile ? 'Add Hotel' : 'Добавить отель'}
                  </button>
                  {booking?.tourType?.code && (
                    <>
                      <div className="border-l border-gray-300 h-8"></div>
                      <button
                        onClick={handleSaveAccommodationsAsTemplate}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        title={`Сохранить текущие размещения как шаблон для ${booking.tourType.code} туров`}
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
                // Include ALL tourists (with or without room numbers)
                const touristsWithRooms = tourists; // Use all tourists, not just those with roomNumbers
                const totalGuests = tourists.length;

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

                // Count by placement (all tourists)
                const uzbekCount = tourists.filter(t => {
                  const acc = (t.accommodation || '').toLowerCase();
                  return acc.includes('uzbek') || acc.includes('узбек');
                }).length;

                const turkmCount = tourists.filter(t => {
                  const acc = (t.accommodation || '').toLowerCase();
                  return acc.includes('turkmen') || acc.includes('туркмен');
                }).length;

                return (
                  <div className={`grid grid-cols-2 md:flex md:items-stretch gap-3 md:gap-4 md:flex-wrap mb-6 md:mb-8`}>
                    {/* Total Guests Card */}
                    <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-xl md:rounded-2xl shadow-md hover:shadow-lg transition-all col-span-2 md:col-span-1">
                      <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white shadow-md">
                        <Users className="w-6 h-6 md:w-8 md:h-8 text-primary-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary-700 uppercase tracking-wide mb-0.5 md:mb-1">Total</div>
                        <div className="text-2xl md:text-4xl font-black text-gray-900 mb-0">{ totalGuests}</div>
                        <div className="text-xs md:text-sm text-gray-600 font-medium">guests</div>
                      </div>
                    </div>

                    {/* DBL Rooms Card */}
                    {roomCounts.DBL > 0 && (
                      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl md:rounded-2xl shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white shadow-md">
                          <Bed className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-blue-500 text-white text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">
                            DBL
                          </div>
                          <div className="text-2xl md:text-4xl font-black text-gray-900 mb-0">{roomCounts.DBL}</div>
                          <div className="text-xs md:text-sm text-gray-600 font-medium">rooms</div>
                        </div>
                      </div>
                    )}

                    {/* TWN Rooms Card */}
                    {roomCounts.TWN > 0 && (
                      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl md:rounded-2xl shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white shadow-md">
                          <Bed className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">
                            TWN
                          </div>
                          <div className="text-2xl md:text-4xl font-black text-gray-900 mb-0">{roomCounts.TWN}</div>
                          <div className="text-xs md:text-sm text-gray-600 font-medium">rooms</div>
                        </div>
                      </div>
                    )}

                    {/* SNGL Rooms Card */}
                    {roomCounts.SNGL > 0 && (
                      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200 rounded-xl md:rounded-2xl shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white shadow-md">
                          <User className="w-6 h-6 md:w-8 md:h-8 text-violet-600" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-violet-500 text-white text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">
                            SNGL
                          </div>
                          <div className="text-2xl md:text-4xl font-black text-gray-900 mb-0">{roomCounts.SNGL}</div>
                          <div className="text-xs md:text-sm text-gray-600 font-medium">rooms</div>
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
                    <div key={acc.id} className="w-full bg-white rounded-2xl md:rounded-3xl border border-gray-300 shadow-lg hover:shadow-2xl hover:border-primary-300 transition-all duration-300 p-4 md:p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-blue-500 to-purple-500"></div>
                      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                        <div className="flex items-start gap-3 md:gap-4 flex-1 w-full">
                          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-primary-600 flex items-center justify-center shadow-lg shrink-0 ring-2 md:ring-4 ring-blue-100">
                            <Building2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Hotel Name - Large and prominent */}
                            <div className="font-black text-gray-900 text-lg md:text-3xl mb-2 md:mb-3 tracking-tight truncate">{acc.hotel?.name}</div>

                            {/* City - Large with icon */}
                            <div className="flex items-center gap-2 mb-3 md:mb-4">
                              <div className="p-1 md:p-1.5 rounded-lg bg-primary-100">
                                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary-600" />
                              </div>
                              <span className="text-base md:text-xl font-bold text-gray-700">{acc.hotel?.city?.name}</span>
                            </div>

                            {/* Dates and Nights - Large badges */}
                            <div className="flex items-center gap-2 md:gap-4 flex-wrap mb-3 md:mb-4">
                              <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl md:rounded-2xl shadow-md">
                                <div className="p-1 md:p-2 rounded-lg bg-blue-500">
                                  <Calendar className="w-3 h-3 md:w-5 md:h-5 text-white" />
                                </div>
                                <span className="text-xs md:text-lg font-bold text-blue-900">
                                  {format(parseISO(acc.checkInDate), 'dd.MM.yy')} — {format(parseISO(acc.checkOutDate), 'dd.MM.yy')}
                                </span>
                              </div>
                              <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl md:rounded-2xl shadow-md">
                                <span className="text-xl md:text-3xl font-black text-purple-700">{acc.nights}</span>
                                <span className="text-sm md:text-lg font-bold text-purple-600">
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

                              // NOTE: Include all tourists (with or without room numbers)
                              // Room numbers are optional - manually added tourists won't have them

                              // Debug log
                              console.log(`\n🏨 [${acc.hotel?.name} ID:${acc.id}]`);
                              console.log(`   Rooming list tourists: ${accTourists?.length || 0}`);
                              if (accTourists?.length > 0) {
                                accTourists.forEach(t => {
                                  console.log(`     - ${t.lastName || t.fullName}: ${t.roomPreference}, ${t.accommodation}`);
                                });
                              }

                              // Fallback: filter tourists by hotel name and date overlap if rooming list not loaded
                              if (!accTourists || accTourists.length === 0) {
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

                              // CRITICAL FIX: Check if rooming list matches saved database values
                              // If rooming list tourist count differs from saved totalGuests, recalculate from rooming list
                              // This handles MIXED groups where UZ/TM tourists split differently per hotel

                              // Check if this is a Khiva hotel (ER MIXED scenario)
                              const cityName = acc.hotel?.city?.name?.toLowerCase() || '';
                              const hotelName = acc.hotel?.name?.toLowerCase() || '';
                              const isKhivaHotel = cityName.includes('хива') || cityName.includes('khiva') || cityName.includes('chiwa') ||
                                                   hotelName.includes('khiva') || hotelName.includes('хива') || hotelName.includes('chiwa');

                              // Check if this is ER tour
                              const isERTour = booking?.tourType?.code === 'ER';

                              // For ER tours with Khiva hotels, ALWAYS recalculate because UZ tourists have different nights
                              const shouldRecalculate = (accTourists.length > 0 && acc.totalGuests && accTourists.length !== acc.totalGuests) ||
                                                        (isERTour && isKhivaHotel && accTourists.length > 0);

                              if (shouldRecalculate) {
                                if (isERTour && isKhivaHotel) {
                                  console.log(`   🔥 ER + Khiva: Force recalculate for ${acc.hotel?.name} (UZ tourists have different nights)`);
                                } else {
                                  console.log(`   ⚠️ Rooming list (${accTourists.length} tourists) doesn't match database (${acc.totalGuests} guests) - recalculating...`);
                                }
                              }

                              // Use saved database values ONLY if they match rooming list
                              if (acc.totalCost && acc.totalCost > 0 && !shouldRecalculate) {
                                console.log(`   ✓ Using saved totalCost from database: ${acc.totalCost}`);
                                totalCost = parseFloat(acc.totalCost) || 0;
                                totalRooms = acc.totalRooms || 0;
                                totalGuests = acc.totalGuests || 0;
                                usedRoomingList = false; // Not calculating, just using saved value
                              } else if (accTourists.length > 0 && acc.checkInDate && acc.checkOutDate) {
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

                                // CRITICAL: Populate calculationBreakdown even when using saved values
                                // This ensures "Hisob-kitob tafsilotlari" section always appears
                                console.log(`   🔍 Fallback breakdown for ${acc.hotel?.name}: accTourists.length = ${accTourists?.length || 0}`);
                                if (accTourists && accTourists.length > 0 && acc.checkInDate && acc.checkOutDate) {
                                  const accCheckIn = new Date(acc.checkInDate);
                                  accCheckIn.setHours(0, 0, 0, 0);
                                  const accCheckOut = new Date(acc.checkOutDate);
                                  accCheckOut.setHours(0, 0, 0, 0);

                                  // Calculate guest-nights per room type for breakdown display
                                  const guestNightsPerRoomType = {};
                                  const touristDetails = {};

                                  accTourists.forEach(tourist => {
                                    let checkIn, checkOut;

                                    if (tourist.checkInDate && tourist.checkOutDate) {
                                      checkIn = new Date(tourist.checkInDate);
                                      checkOut = new Date(tourist.checkOutDate);
                                      console.log(`      → ${tourist.fullName || tourist.lastName}: ${tourist.checkInDate} → ${tourist.checkOutDate}`);
                                    } else {
                                      checkIn = new Date(accCheckIn);
                                      checkOut = new Date(accCheckOut);
                                      console.log(`      → ${tourist.fullName || tourist.lastName}: using acc dates (no individual dates)`);
                                    }

                                    checkIn.setHours(0, 0, 0, 0);
                                    checkOut.setHours(0, 0, 0, 0);

                                    const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
                                    console.log(`         Nights: ${nights}`);

                                    let roomType = (tourist.roomPreference || '').toUpperCase();
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

                                  // Populate breakdown from saved rooms data
                                  acc.rooms?.forEach(room => {
                                    const pricePerNight = parseFloat(room.pricePerNight) || 0;
                                    let normalizedRoomType = room.roomTypeCode?.toUpperCase();
                                    if (normalizedRoomType === 'DOUBLE') normalizedRoomType = 'DBL';
                                    if (normalizedRoomType === 'TWIN') normalizedRoomType = 'TWN';
                                    if (normalizedRoomType === 'SINGLE') normalizedRoomType = 'SNGL';

                                    const guestNights = guestNightsPerRoomType[normalizedRoomType] || 0;
                                    if (guestNights === 0) return;

                                    let roomNights;
                                    if (normalizedRoomType === 'PAX') {
                                      roomNights = guestNights;
                                    } else if (normalizedRoomType === 'TWN' || normalizedRoomType === 'DBL') {
                                      roomNights = guestNights / 2;
                                    } else {
                                      roomNights = guestNights;
                                    }

                                    const roomTypeCost = roomNights * pricePerNight;

                                    calculationBreakdown.push({
                                      roomType: normalizedRoomType,
                                      roomNights: roomNights,
                                      pricePerNight: pricePerNight,
                                      totalCost: roomTypeCost,
                                      guestNights: guestNights,
                                      details: touristDetails[normalizedRoomType] || []
                                    });

                                    const hotelRoomType = acc.hotel?.roomTypes?.find(rt => rt.name === room.roomTypeCode);
                                    if (hotelRoomType?.currency) {
                                      currency = hotelRoomType.currency;
                                    }
                                  });

                                  console.log(`   ✓ Populated breakdown from saved data: ${calculationBreakdown.length} room types`);
                                }

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
                                <div className="mb-3 md:mb-4 space-y-2 md:space-y-3">
                                  {/* Main Summary */}
                                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl md:rounded-2xl p-3 md:p-4 border-2 border-blue-200 shadow-md">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                                      {/* Left side - Stats */}
                                      <div className="flex items-center gap-3 md:gap-5 flex-wrap">
                                        {!isPAX && totalRooms > 0 && (
                                          <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center">
                                              <Bed className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                            </div>
                                            <div>
                                              <div className="text-xs text-gray-500 uppercase font-medium">Rooms</div>
                                              <div className="text-xl md:text-2xl font-bold text-gray-800">{totalRooms}</div>
                                            </div>
                                          </div>
                                        )}
                                        {totalGuests > 0 && (
                                          <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-green-100 border border-green-300 flex items-center justify-center">
                                              <Users className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                            </div>
                                            <div>
                                              <div className="text-xs text-gray-500 uppercase font-medium">Guests</div>
                                              <div className="text-xl md:text-2xl font-bold text-gray-800">{totalGuests}</div>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Right side - Total */}
                                      {totalCost > 0 && (
                                        <div className="text-left md:text-right w-full md:w-auto">
                                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Total (incl. tax)</div>
                                          <div className="text-2xl md:text-3xl font-black text-blue-700">
                                            {currency === 'UZS' ? (
                                              <>
                                                {displayCost}
                                                <span className="text-base md:text-lg font-medium text-blue-500 ml-2">{currencySymbol}</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="text-base md:text-lg font-medium text-blue-500 mr-1">{currencySymbol}</span>
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
                                    <details
                                      className="group"
                                      open={openCalculationBreakdowns[acc.id] || false}
                                      onToggle={(e) => {
                                        setOpenCalculationBreakdowns(prev => ({
                                          ...prev,
                                          [acc.id]: e.target.open
                                        }));
                                      }}
                                    >
                                      <summary className="cursor-pointer px-3 md:px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between">
                                        <span className="text-xs md:text-sm font-medium text-gray-700">📊 Hisob-kitob tafsilotlari</span>
                                        <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                      </summary>
                                      <div className="mt-2 p-3 md:p-4 bg-white border border-gray-200 rounded-lg space-y-2 md:space-y-3">
                                        {calculationBreakdown.map((item, idx) => (
                                          <div key={idx} className="pb-2 md:pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 md:gap-2 mb-2">
                                              <div className="flex-1">
                                                <span className="font-bold text-gray-900 text-sm md:text-base">{item.roomType}:</span>
                                                <span className="text-xs md:text-sm text-gray-600 ml-2 block md:inline">
                                                  {item.roomNights.toFixed(1)} room-nights × {currency === 'UZS' ? (
                                                    <>{item.pricePerNight.toLocaleString('ru-RU')} {currencySymbol}</>
                                                  ) : (
                                                    <>{currencySymbol}{item.pricePerNight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                                  )}
                                                </span>
                                              </div>
                                              <span className="font-bold text-blue-700 text-sm md:text-base">
                                                {currency === 'UZS' ? (
                                                  <>{item.totalCost.toLocaleString('ru-RU')} {currencySymbol}</>
                                                ) : (
                                                  <>{currencySymbol}{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                                )}
                                              </span>
                                            </div>
                                            {item.details.length > 0 && (
                                              <div className="ml-2 md:ml-4 space-y-1">
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
                                            <span className="font-bold text-gray-900 text-sm md:text-base">Umumiy:</span>
                                            <span className="text-lg md:text-xl font-black text-blue-700">
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
                                  <div className="mt-3 md:mt-4 flex flex-wrap gap-2 md:gap-4">
                                    <span className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-br from-purple-50 via-purple-100 to-violet-100 text-purple-900 border-2 border-purple-400 rounded-xl md:rounded-2xl text-sm md:text-lg font-black shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                                      <span className="text-purple-800 text-base md:text-xl">PAX:</span>
                                      <span className="text-gray-800 text-sm md:text-base">{totalGuests} guests</span>
                                      {paxPrice > 0 && (
                                        <span className="text-purple-700 text-xs md:text-base font-semibold">
                                          ({displayPrice}{currencyLabel}/person/night)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              }

                              // For regular hotels: show individual room type badges
                              return (
                                <div className="mt-3 md:mt-4 flex flex-wrap gap-2 md:gap-4">
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
                                      <span key={idx} className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 text-green-900 border-2 border-green-400 rounded-xl md:rounded-2xl text-sm md:text-lg font-black shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                                        <span className="text-green-800 text-base md:text-xl">{room.roomTypeCode}:</span>
                                        <span className="text-gray-800 text-sm md:text-base">{room.roomsCount} × {room.guestsPerRoom} guests</span>
                                        {room.pricePerNight > 0 && (
                                          <span className="text-green-700 text-xs md:text-base font-semibold">
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
                        <div className={`flex items-center gap-2 md:gap-3 ${isMobile ? 'flex-col w-full' : ''}`}>
                          <button
                            onClick={() => {
                              // Check if this hotel has multiple visits in the booking
                              const hotelId = acc.hotel?.id;
                              const visitsToSameHotel = accommodations.filter(a => a.hotel?.id === hotelId);
                              const isCombined = visitsToSameHotel.length > 1;

                              // Use new auto-save function
                              handleDownloadPdfWithAutoSave(
                                hotelId,
                                acc.id,
                                acc.hotel?.name || 'Hotel',
                                isCombined
                              );
                            }}
                            className={`p-3 text-green-600 bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 rounded-xl hover:scale-110 transition-all duration-200 shadow-md ${isMobile ? 'w-full flex items-center justify-center gap-2' : ''}`}
                            title={pdfFolderConfigured ? `PDF yuklab olish va papkaga saqlash (${pdfFolderName})` : "Скачать заявку для отеля (Print to PDF)"}
                          >
                            <FileDown className="w-5 h-5" />
                            {isMobile && <span className="font-medium">Download PDF</span>}
                          </button>
                          <button
                            onClick={() => {
                              setEditingAccommodation(acc);
                              setAccommodationFormOpen(true);
                            }}
                            className={`p-3 text-primary-600 bg-primary-50 hover:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 rounded-xl hover:scale-110 transition-all duration-200 shadow-md ${isMobile ? 'w-full flex items-center justify-center gap-2' : ''}`}
                            title="Редактировать"
                          >
                            <Edit className="w-5 h-5" />
                            {isMobile && <span className="font-medium">Edit</span>}
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
                            className={`p-3 text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-200 hover:border-red-400 rounded-xl hover:scale-110 transition-all duration-200 shadow-md ${isMobile ? 'w-full flex items-center justify-center gap-2' : ''}`}
                            title="Удалить"
                          >
                            <Trash2 className="w-5 h-5" />
                            {isMobile && <span className="font-medium">Delete</span>}
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

                                      // Check if this is Khiva hotel and tourist is UZ (stays 2 nights instead of 3 in MIXED groups)
                                      const cityName = acc.hotel?.city?.name?.toLowerCase() || '';
                                      const hotelName = acc.hotel?.name?.toLowerCase() || '';
                                      const isKhivaHotel = cityName.includes('хива') || cityName.includes('khiva') || cityName.includes('chiwa') ||
                                                           hotelName.includes('khiva') || hotelName.includes('хива') || hotelName.includes('chiwa');
                                      const isUzTourist = t.accommodation?.toLowerCase().includes('uzbek') || t.accommodation?.toLowerCase() === 'uz';
                                      const isKhivaUzTourist = isKhivaHotel && isUzTourist;

                                      // Tourist's individual dates - ONLY use for FIRST accommodation
                                      // For other hotels, use accommodation's standard dates
                                      // For Khiva UZ tourists (MIXED groups) - check out 1 day earlier (2 nights instead of 3)
                                      const touristCheckInDate = (isFirstAccommodation && t.checkInDate) ? new Date(t.checkInDate) : accCheckIn;
                                      let touristCheckOutDate;
                                      if (isKhivaUzTourist) {
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

                                      const hasCustomDates = hasAccommodationOverride || hasDifferentDates || isKhivaUzTourist;
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
                                              if (isKhivaUzTourist) {
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
              {/* Info box about automatic calculation */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-blue-700">Tourist counts</p>
                  <p className="text-blue-600">
                    Auto-calculated from Final List: <span className="font-bold">{tourists.filter(t => (t.accommodation || '').toLowerCase().includes('uzbek') || (t.accommodation || '').toLowerCase() === 'uz').length} Uzbekistan</span>
                    {(() => {
                      const selectedTourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
                      return selectedTourType?.code === 'ER' ? (
                        <span>, <span className="font-bold">{tourists.filter(t => {
                          const acc = (t.accommodation || '').toLowerCase();
                          return acc.includes('turkmen') || acc === 'tm' || acc === 'tkm';
                        }).length} Turkmenistan</span></span>
                      ) : null;
                    })()}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">You can edit these numbers manually below if needed</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Total (Pax)
                  <span className="ml-1 text-xs font-normal text-gray-500">(automatic sum)</span>
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
                  <span className="ml-1 text-xs font-normal text-blue-500">(editable)</span>
                </label>
                <input
                  type="number"
                  name="paxUzbekistan"
                  value={formData.paxUzbekistan}
                  onChange={(e) => {
                    const uzbekCount = parseInt(e.target.value) || 0;
                    const turkCount = parseInt(formData.paxTurkmenistan) || 0;
                    setFormData(prev => ({
                      ...prev,
                      paxUzbekistan: uzbekCount,
                      pax: uzbekCount + turkCount
                    }));
                  }}
                  min="0"
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-bold text-gray-900 hover:border-blue-400"
                  placeholder="0"
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
                      <span className="ml-1 text-xs font-normal text-blue-500">(editable)</span>
                    </label>
                    <input
                      type="number"
                      name="paxTurkmenistan"
                      value={formData.paxTurkmenistan}
                      onChange={(e) => {
                        const turkCount = parseInt(e.target.value) || 0;
                        const uzbekCount = parseInt(formData.paxUzbekistan) || 0;
                        setFormData(prev => ({
                          ...prev,
                          paxTurkmenistan: turkCount,
                          pax: uzbekCount + turkCount
                        }));
                      }}
                      min="0"
                      className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-bold text-gray-900 hover:border-blue-400"
                      placeholder="0"
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
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
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
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
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
                    {booking?.tourType?.code === 'ZA' ? (
                      // ZA tours: Only Tashkent, Samarkand, Bukhara
                      <>
                        <optgroup label="Tashkent (Xayrulla)">
                          <option value="Tashkent">Tashkent</option>
                        </optgroup>
                        <optgroup label="Samarkand & Bukhara (Sevil-Za)">
                          <option value="Samarkand">Samarkand</option>
                          <option value="Bukhara">Bukhara</option>
                        </optgroup>
                      </>
                    ) : (
                      // Other tours: All cities
                      <>
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
                      </>
                    )}
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
                    {routeForm.choiceTab === 'sevil-er' && sevilErVehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.person} pax)</option>
                    ))}
                    {routeForm.choiceTab === 'sevil-co' && sevilCoVehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.person} pax)</option>
                    ))}
                    {routeForm.choiceTab === 'sevil-kas' && sevilKasVehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.person} pax)</option>
                    ))}
                    {routeForm.choiceTab === 'sevil-za' && sevilZaVehicles.map(v => (
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
                    {routeForm.choiceTab === 'sevil-er' && (
                      <>
                        <option value="pickupDropoff">Pickup / Drop-off</option>
                        <option value="tagRate">TAG Rate</option>
                        <option value="urgenchRate">Urgench Rate</option>
                        <option value="shovotRate">Shovot Rate</option>
                      </>
                    )}
                    {routeForm.choiceTab === 'sevil-co' && (
                      <>
                        <option value="pickupDropoff">Pickup / Drop-off</option>
                        <option value="tagRate">TAG Rate</option>
                        <option value="urgenchRate">Urgench Rate</option>
                        <option value="shovotRate">Shovot Rate</option>
                      </>
                    )}
                    {routeForm.choiceTab === 'sevil-kas' && (
                      <>
                        <option value="pickupDropoff">Pickup / Drop-off</option>
                        <option value="tagRate">TAG Rate</option>
                        <option value="urgenchRate">Urgench Rate</option>
                        <option value="shovotRate">Shovot Rate</option>
                      </>
                    )}
                    {routeForm.choiceTab === 'sevil-za' && (
                      <>
                        <option value="pickupDropoff">Pickup / Drop-off</option>
                        <option value="tagRate">TAG Rate</option>
                        <option value="jartepaRate">Jartepa Rate</option>
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

      {/* Tour Service Modal (Eintritt, Metro, Shou, Other) */}
      {tourServiceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">{editingTourService ? 'Edit' : 'Add'} {tourServiceType}</h2>
            </div>
            <form onSubmit={saveTourService} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Name *</label>
                <input type="text" required value={tourServiceForm.name} onChange={(e) => setTourServiceForm({...tourServiceForm, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" placeholder="Service name" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">City</label>
                <input type="text" value={tourServiceForm.city} onChange={(e) => setTourServiceForm({...tourServiceForm, city: e.target.value})} className="w-full px-4 py-2 border rounded-lg" placeholder="Tashkent, Samarkand, Bukhara, etc." />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Date</label>
                <input type="date" value={tourServiceForm.date} onChange={(e) => setTourServiceForm({...tourServiceForm, date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Price/Person (UZS)</label>
                  <input type="number" value={tourServiceForm.pricePerPerson} onChange={(e) => {
                    const pricePerPerson = parseFloat(e.target.value) || 0;
                    const pax = parseInt(tourServiceForm.pax) || 0;
                    setTourServiceForm({...tourServiceForm, pricePerPerson, price: pricePerPerson * pax});
                  }} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">PAX</label>
                  <input type="number" value={tourServiceForm.pax} onChange={(e) => {
                    const pax = parseInt(e.target.value) || 0;
                    const pricePerPerson = parseFloat(tourServiceForm.pricePerPerson) || 0;
                    setTourServiceForm({...tourServiceForm, pax, price: pricePerPerson * pax});
                  }} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Total (UZS)</label>
                  <input type="number" value={tourServiceForm.price} readOnly className="w-full px-4 py-2 border rounded-lg bg-gray-50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Notes</label>
                <textarea value={tourServiceForm.notes} onChange={(e) => setTourServiceForm({...tourServiceForm, notes: e.target.value})} className="w-full px-4 py-2 border rounded-lg" rows="3"></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setTourServiceModalOpen(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </form>
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

      {/* Guide Selection Modal */}
      {guideModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-rose-500 to-pink-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  {guideType === 'main' ? 'Main Guide' : guideType === 'second' ? 'Second Guide' : 'Bergreiseleiter'}
                </h2>
                <button
                  onClick={() => setGuideModalOpen(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Manual Entry Toggle */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="manualGuideEntry"
                  checked={manualGuideEntry}
                  onChange={(e) => {
                    setManualGuideEntry(e.target.checked);
                    if (e.target.checked) {
                      setSelectedGuide(null);
                    } else {
                      setManualGuideName('');
                    }
                  }}
                  className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
                />
                <label htmlFor="manualGuideEntry" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Enter guide name manually
                </label>
              </div>

              {/* Guide Selection */}
              <div>
                {manualGuideEntry ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Guide Name *
                    </label>
                    <input
                      type="text"
                      value={manualGuideName}
                      onChange={(e) => setManualGuideName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="Enter guide name"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Guide *
                    </label>
                    <select
                      value={selectedGuide?.id || ''}
                      onChange={(e) => {
                        const guide = guides.find(g => g.id === parseInt(e.target.value));
                        setSelectedGuide(guide);
                        // Auto-fill rates from Guides Payment module
                        // Use ?? instead of || to properly handle 0 values
                        if (guide) {
                          setGuideRates({
                            dayRate: guide.dayRate ?? 110,
                            halfDayRate: guide.halfDayRate ?? 55
                          });
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      required
                    >
                      <option value="">-- Select Guide --</option>
                      {guides
                        .filter(g => g.isActive)
                        .map(guide => (
                          <option key={guide.id} value={guide.id}>
                            {guide.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Days Worked */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full days *
                  </label>
                  <input
                    type="number"
                    value={guideDays.fullDays}
                    onChange={(e) => setGuideDays(prev => ({ ...prev, fullDays: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="e.g., 12"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Half days
                  </label>
                  <input
                    type="number"
                    value={guideDays.halfDays}
                    onChange={(e) => setGuideDays(prev => ({ ...prev, halfDays: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="e.g., 0.5"
                  />
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full day rate (USD) *
                  </label>
                  <input
                    type="number"
                    value={guideRates.dayRate}
                    onChange={(e) => setGuideRates(prev => ({ ...prev, dayRate: parseFloat(e.target.value) || 110 }))}
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="110"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Half day rate (USD) *
                  </label>
                  <input
                    type="number"
                    value={guideRates.halfDayRate}
                    onChange={(e) => setGuideRates(prev => ({ ...prev, halfDayRate: parseFloat(e.target.value) || 55 }))}
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="55"
                  />
                </div>
              </div>

              {/* Total Payment Calculation */}
              {selectedGuide && (guideDays.fullDays > 0 || guideDays.halfDays > 0) && (
                <div className="p-4 bg-gradient-to-r from-rose-100 to-pink-100 rounded-lg">
                  <div className="space-y-2 text-sm">
                    {guideDays.fullDays > 0 && (
                      <p className="flex justify-between">
                        <span>Full days: {guideDays.fullDays} × ${guideRates.dayRate}</span>
                        <strong>${(guideDays.fullDays * guideRates.dayRate).toFixed(2)}</strong>
                      </p>
                    )}
                    {guideDays.halfDays > 0 && (
                      <p className="flex justify-between">
                        <span>Half days: {guideDays.halfDays} × ${guideRates.halfDayRate}</span>
                        <strong>${(guideDays.halfDays * guideRates.halfDayRate).toFixed(2)}</strong>
                      </p>
                    )}
                    <div className="pt-2 mt-2 border-t-2 border-rose-300">
                      <p className="flex justify-between text-lg font-bold text-rose-700">
                        <span>Total payment:</span>
                        <span>
                          ${Math.round(
                            (guideDays.fullDays * guideRates.dayRate) +
                            (guideDays.halfDays * guideRates.halfDayRate)
                          ).toLocaleString('en-US').replace(/,/g, ' ')} USD
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setGuideModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveGuideAssignment}
                  className="px-6 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg hover:from-rose-700 hover:to-pink-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
