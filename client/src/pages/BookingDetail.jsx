import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi, hotelsApi, touristsApi, routesApi } from '../services/api';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
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
  Car
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
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждено',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено'
};

const statusOptions = Object.entries(statusLabels);

// Transport ticket status options
const ticketStatusOptions = [
  { value: '', label: 'Не указано' },
  { value: 'Оформлено', label: 'Оформлено' },
  { value: 'Не оформлено', label: 'Не оформлено' }
];

// Countries list in Russian (ISO countries commonly used in tourism)
const countriesList = [
  { code: 'DE', name: 'Германия' },
  { code: 'AT', name: 'Австрия' },
  { code: 'CH', name: 'Швейцария' },
  { code: 'FR', name: 'Франция' },
  { code: 'IT', name: 'Италия' },
  { code: 'ES', name: 'Испания' },
  { code: 'GB', name: 'Великобритания' },
  { code: 'US', name: 'США' },
  { code: 'NL', name: 'Нидерланды' },
  { code: 'BE', name: 'Бельгия' },
  { code: 'PL', name: 'Польша' },
  { code: 'CZ', name: 'Чехия' },
  { code: 'SE', name: 'Швеция' },
  { code: 'NO', name: 'Норвегия' },
  { code: 'DK', name: 'Дания' },
  { code: 'FI', name: 'Финляндия' },
  { code: 'PT', name: 'Португалия' },
  { code: 'GR', name: 'Греция' },
  { code: 'IE', name: 'Ирландия' },
  { code: 'LU', name: 'Люксембург' },
  { code: 'AU', name: 'Австралия' },
  { code: 'NZ', name: 'Новая Зеландия' },
  { code: 'CA', name: 'Канада' },
  { code: 'JP', name: 'Япония' },
  { code: 'KR', name: 'Южная Корея' },
  { code: 'CN', name: 'Китай' },
  { code: 'IN', name: 'Индия' },
  { code: 'BR', name: 'Бразилия' },
  { code: 'MX', name: 'Мексика' },
  { code: 'AR', name: 'Аргентина' },
  { code: 'RU', name: 'Россия' },
  { code: 'UA', name: 'Украина' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'UZ', name: 'Узбекистан' },
  { code: 'TM', name: 'Туркменистан' },
  { code: 'TJ', name: 'Таджикистан' },
  { code: 'KG', name: 'Кыргызстан' },
  { code: 'AZ', name: 'Азербайджан' },
  { code: 'GE', name: 'Грузия' },
  { code: 'AM', name: 'Армения' },
  { code: 'TR', name: 'Турция' },
  { code: 'IL', name: 'Израиль' },
  { code: 'AE', name: 'ОАЭ' },
  { code: 'SA', name: 'Саудовская Аравия' },
  { code: 'EG', name: 'Египет' },
  { code: 'ZA', name: 'ЮАР' },
  { code: 'SG', name: 'Сингапур' },
  { code: 'MY', name: 'Малайзия' },
  { code: 'TH', name: 'Таиланд' },
  { code: 'ID', name: 'Индонезия' },
  { code: 'PH', name: 'Филиппины' },
  { code: 'VN', name: 'Вьетнам' }
].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// Helper function to get ticket status style
const getTicketStatusStyle = (status) => {
  if (status === 'Оформлено') {
    return 'bg-green-100 text-green-800 border-green-200';
  } else if (status === 'Не оформлено') {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const getTicketStatusIcon = (status) => {
  if (status === 'Оформлено') return '✓';
  if (status === 'Не оформлено') return '○';
  return '—';
};

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';
  const startEditing = searchParams.get('edit') === 'true';

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

  // Default vehicle data
  const defaultSevilVehicles = [
    { id: 1, name: 'Starex', seats: '7', person: '1-4', pickupDropoff: 20, tagRate: 30, urgenchRate: 80, shovotRate2: 60 },
    { id: 2, name: 'Joylong', seats: '30', person: '5-8', pickupDropoff: 30, tagRate: 50, urgenchRate: 110, shovotRate2: 60 },
    { id: 3, name: 'Yutong 33', seats: '45', person: '9-20', pickupDropoff: 40, tagRate: 50, urgenchRate: 160, shovotRate2: 120 },
  ];

  const defaultXayrullaVehicles = [
    { id: 1, name: 'Starex', seats: '7', person: '1-4', vstrecha: 30, chimgan: 100, tag: 60, oybek: 70, chernyayevka: 80, cityTour: 80 },
    { id: 2, name: 'Joylong', seats: '30', person: '5-8', vstrecha: 40, chimgan: 120, tag: 90, oybek: 100, chernyayevka: 110, cityTour: 100 },
    { id: 3, name: 'Yutong 33', seats: '45', person: '9-20', vstrecha: 45, chimgan: 220, tag: 130, oybek: 150, chernyayevka: 160, cityTour: 150 },
  ];

  const defaultNosirVehicles = [
    { id: 1, name: 'PKW', seats: '4', person: '1-2', margilan: '', qoqon: 20, dostlik: 60, toshkent: 170, extra: 60 },
    { id: 2, name: 'Starex', seats: '7', person: '3-4', margilan: 30, qoqon: 100, dostlik: 100, toshkent: 120, extra: '' },
    { id: 3, name: 'Joylong', seats: '30', person: '5-8', margilan: 80, qoqon: 180, dostlik: 180, toshkent: 200, extra: '' },
    { id: 4, name: 'Yutong 33', seats: '45', person: '9-20', margilan: 100, qoqon: 220, dostlik: 220, toshkent: '', extra: '' },
  ];

  // Sevil vehicles data with localStorage
  const [sevilVehicles, setSevilVehicles] = useState(() => {
    const saved = localStorage.getItem('sevilVehicles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[0]?.person?.includes('-')) return parsed;
      localStorage.removeItem('sevilVehicles');
    }
    return defaultSevilVehicles;
  });

  // Xayrulla vehicles data with localStorage
  const [xayrullaVehicles, setXayrullaVehicles] = useState(() => {
    const saved = localStorage.getItem('xayrullaVehicles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[0]?.person?.includes('-')) return parsed;
      localStorage.removeItem('xayrullaVehicles');
    }
    return defaultXayrullaVehicles;
  });

  // Nosir vehicles data with localStorage
  const [nosirVehicles, setNosirVehicles] = useState(() => {
    const saved = localStorage.getItem('nosirVehicles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[0]?.person?.includes('-')) return parsed;
      localStorage.removeItem('nosirVehicles');
    }
    return defaultNosirVehicles;
  });

  // Route data - ER
  // Default ER route template - used for all ER bookings
  const defaultERRoutesTemplate = [
    { id: 1, shahar: 'Tashkent', route: 'Airport Pickup', choiceTab: 'xayrulla' },
    { id: 2, shahar: 'Tashkent', route: 'Tashkent City Tour', choiceTab: 'xayrulla' },
    { id: 3, shahar: 'Tashkent', route: 'Tashkent - Chimgan', choiceTab: 'xayrulla' },
    { id: 4, shahar: 'Tashkent', route: 'Train Station Drop-off', choiceTab: 'xayrulla' },
    { id: 5, shahar: 'Samarkand', route: 'Train Station Pickup', choiceTab: 'sevil' },
    { id: 6, shahar: 'Samarkand', route: 'Samarkand City Tour', choiceTab: 'sevil' },
    { id: 7, shahar: 'Samarkand', route: 'Samarkand - Asraf', choiceTab: 'sevil' },
    { id: 8, shahar: 'Bukhara', route: 'Asraf - Bukhara', choiceTab: 'sevil' },
    { id: 9, shahar: 'Bukhara', route: 'Bukhara City Tour', choiceTab: 'sevil' },
    { id: 10, shahar: 'Khiva', route: 'Bukhara - Khiva', choiceTab: 'sevil' },
    { id: 11, shahar: 'Khiva', route: 'Khiva City Tour', choiceTab: 'sevil' },
    { id: 12, shahar: 'Khiva', route: 'Khiva - Urgench', choiceTab: 'sevil' },
    { id: 13, shahar: 'Tashkent', route: 'Airport Pickup', choiceTab: 'xayrulla' },
    { id: 14, shahar: 'Tashkent', route: 'Airport Drop-off', choiceTab: 'xayrulla' },
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

  // Refresh vehicle data from localStorage when component mounts or storage changes
  useEffect(() => {
    const refreshVehiclesFromStorage = () => {
      const savedSevil = localStorage.getItem('sevilVehicles');
      if (savedSevil) {
        const parsed = JSON.parse(savedSevil);
        if (parsed[0]?.person?.includes('-')) setSevilVehicles(parsed);
      }
      const savedXayrulla = localStorage.getItem('xayrullaVehicles');
      if (savedXayrulla) {
        const parsed = JSON.parse(savedXayrulla);
        if (parsed[0]?.person?.includes('-')) setXayrullaVehicles(parsed);
      }
      const savedNosir = localStorage.getItem('nosirVehicles');
      if (savedNosir) {
        const parsed = JSON.parse(savedNosir);
        if (parsed[0]?.person?.includes('-')) setNosirVehicles(parsed);
      }
    };

    // Refresh on mount
    refreshVehiclesFromStorage();

    // Listen for storage changes from other tabs/pages
    window.addEventListener('storage', refreshVehiclesFromStorage);
    // Listen for custom event from Opex page (same tab)
    window.addEventListener('vehiclesUpdated', refreshVehiclesFromStorage);
    return () => {
      window.removeEventListener('storage', refreshVehiclesFromStorage);
      window.removeEventListener('vehiclesUpdated', refreshVehiclesFromStorage);
    };
  }, []);

  useEffect(() => {
    setDatesInitialized(false); // Reset when booking changes
    loadData();
  }, [id]);

  // Auto-populate route dates based on departure date (дата заезда)
  // Arrival in Tashkent = departure date + 1 day (tourists fly one day, arrive next day)

  useEffect(() => {
    if (formData.departureDate && erRoutes.length > 0 && !datesInitialized) {
      const departureDate = new Date(formData.departureDate);
      const firstExpectedDate = format(addDays(departureDate, 1), 'yyyy-MM-dd');

      // Always update dates on first load to match arrival date
      const updatedRoutes = erRoutes.map((route, index) => {
        // Calculate date for this route: departure date + 1 (arrival) + index days
        const routeDate = addDays(departureDate, index + 1);
        return {
          ...route,
          sana: format(routeDate, 'yyyy-MM-dd')
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
          // Get best vehicle for this provider and new person count
          const vehicles = route.choiceTab === 'sevil' ? defaultSevilVehicles
            : route.choiceTab === 'xayrulla' ? defaultXayrullaVehicles
            : route.choiceTab === 'nosir' ? defaultNosirVehicles
            : [];

          const count = parseInt(newPersonCount);
          const suitable = vehicles.filter(v => {
            const personRange = v.person || '';
            if (personRange.includes('-')) {
              const [min, max] = personRange.split('-').map(n => parseInt(n.trim()));
              return !isNaN(min) && !isNaN(max) && count >= min && count <= max;
            }
            return false;
          });
          const bestVehicle = suitable.length > 0 ? suitable[0] : null;
          const newTransportType = bestVehicle ? bestVehicle.name : route.transportType;

          // Calculate date for this route: departure date + 1 (arrival) + index days
          const routeDate = departureDate ? format(addDays(departureDate, index + 1), 'yyyy-MM-dd') : route.sana;

          return {
            ...route,
            sana: routeDate,
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
  }, [tourists.length, formData.departureDate]);

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
        const [bookingRes, accommodationsRes, touristsRes, routesRes] = await Promise.all([
          bookingsApi.getById(id),
          bookingsApi.getAccommodations(id),
          touristsApi.getAll(id),
          routesApi.getAll(id)
        ]);
        const b = bookingRes.data.booking;
        setBooking(b);
        setBookingRooms(b.bookingRooms || []);
        setAccommodations(accommodationsRes.data.accommodations || []);
        setTourists(touristsRes.data.tourists || []);

        // Load routes from database
        const loadedRoutes = routesRes.data.routes || [];
        if (loadedRoutes.length > 0) {
          // Helper to get vehicles by provider for recalculation
          const getVehicles = (provider) => {
            if (provider === 'sevil') return defaultSevilVehicles;
            if (provider === 'xayrulla') return defaultXayrullaVehicles;
            if (provider === 'nosir') return defaultNosirVehicles;
            return [];
          };

          // Helper to find best vehicle based on person count
          const findVehicle = (vehicles, personCount) => {
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
            return suitable.length > 0 ? suitable[0] : null;
          };

          // Get departure date for calculating arrival-based dates
          const bookingDepartureDate = b.departureDate ? new Date(b.departureDate) : null;
          // Get total PAX from tourists
          const totalPax = touristsRes.data.tourists?.length || 0;

          setErRoutes(loadedRoutes.map((r, index) => {
            const provider = r.provider || '';
            // Use total PAX from tourists as person count
            const personCount = totalPax > 0 ? totalPax.toString() : (r.personCount?.toString() || '');
            const vehicles = getVehicles(provider);
            const bestVehicle = findVehicle(vehicles, personCount);
            // Use recalculated transport type if available, otherwise keep saved value
            const transportType = bestVehicle ? bestVehicle.name : (r.transportType || '');

            // Calculate date from Arrival (departure + 1) + index
            const routeDate = bookingDepartureDate
              ? format(addDays(bookingDepartureDate, index + 1), 'yyyy-MM-dd')
              : (r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '');

            return {
              id: r.id,
              nomer: r.dayNumber?.toString() || '',
              sana: routeDate,
              shahar: r.city || '',
              route: r.routeName || '',
              person: personCount,
              transportType: transportType,
              choiceTab: provider,
              choiceRate: r.optionRate || '',
              price: r.price?.toString() || ''
            };
          }));
        } else if (b.tourType?.code === 'ER') {
          // No saved routes - use default ER template
          const bookingDepartureDate = b.departureDate ? new Date(b.departureDate) : null;
          const totalPax = touristsRes.data.tourists?.length || 0;

          // Helper to get vehicles by provider for recalculation
          const getVehicles = (provider) => {
            if (provider === 'sevil') return defaultSevilVehicles;
            if (provider === 'xayrulla') return defaultXayrullaVehicles;
            if (provider === 'nosir') return defaultNosirVehicles;
            return [];
          };

          // Helper to find best vehicle based on person count
          const findVehicle = (vehicles, personCount) => {
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
            return suitable.length > 0 ? suitable[0] : null;
          };

          setErRoutes(defaultERRoutesTemplate.map((template, index) => {
            const personCount = totalPax > 0 ? totalPax.toString() : '';
            const vehicles = getVehicles(template.choiceTab);
            const bestVehicle = findVehicle(vehicles, personCount);
            const transportType = bestVehicle ? bestVehicle.name : '';

            // Calculate date from Arrival (departure + 1) + index
            const routeDate = bookingDepartureDate
              ? format(addDays(bookingDepartureDate, index + 1), 'yyyy-MM-dd')
              : '';

            return {
              id: template.id,
              nomer: '',
              sana: routeDate,
              shahar: template.shahar,
              route: template.route,
              person: personCount,
              transportType: transportType,
              choiceTab: template.choiceTab,
              choiceRate: '',
              price: ''
            };
          }));
        }
        const uzbek = parseInt(b.paxUzbekistan) || 0;
        const turkmen = parseInt(b.paxTurkmenistan) || 0;

        // Only include Turkmenistan in PAX calculation for ER tour type
        const isER = b.tourType?.code === 'ER';
        const calculatedPax = isER ? (uzbek + turkmen) : uzbek;

        setFormData({
          bookingNumber: b.bookingNumber,
          tourTypeId: b.tourTypeId?.toString() || '',
          country: b.country || '',
          departureDate: b.departureDate ? format(new Date(b.departureDate), 'yyyy-MM-dd') : '',
          arrivalDate: b.arrivalDate ? format(new Date(b.arrivalDate), 'yyyy-MM-dd') : '',
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

      await loadData();

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

    // Find the vehicle by transport type name
    const vehicle = vehicles.find(v =>
      v.name?.toLowerCase() === transportType?.toLowerCase()
    );

    if (vehicle && vehicle[rateField]) {
      return vehicle[rateField].toString();
    }

    return '';
  };

  const findBestVehicle = (vehicles, personCount) => {
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

    // Return first suitable vehicle (they should be ordered by size in the data)
    return suitableVehicles[0];
  };

  // Get vehicles list by provider
  const getVehiclesByProvider = (provider) => {
    if (provider === 'sevil') return sevilVehicles;
    if (provider === 'xayrulla') return xayrullaVehicles;
    if (provider === 'nosir') return nosirVehicles;
    return [];
  };

  // Get best vehicle for provider and person count
  const getBestVehicleForRoute = (provider, personCount) => {
    const vehicles = getVehiclesByProvider(provider);
    const bestVehicle = findBestVehicle(vehicles, personCount);
    return bestVehicle ? bestVehicle.name : '';
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

  const handleRouteDateChange = (routeIndex, newDate) => {
    const updatedRoutes = [...erRoutes];
    const oldDate = updatedRoutes[routeIndex].sana;
    updatedRoutes[routeIndex].sana = newDate;

    if (newDate) {
      // Check if the new date is earlier than the previous row's date
      // If so, sort by date to put it in the correct position
      const prevRowDate = routeIndex > 0 ? updatedRoutes[routeIndex - 1].sana : null;
      const isEarlierThanPrev = prevRowDate && new Date(newDate) < new Date(prevRowDate);

      if (isEarlierThanPrev) {
        // Sort routes by date (earlier dates first)
        updatedRoutes.sort((a, b) => {
          if (!a.sana && !b.sana) return 0;
          if (!a.sana) return 1;
          if (!b.sana) return -1;
          return new Date(a.sana) - new Date(b.sana);
        });

        // After sorting, update all dates sequentially from the first one
        for (let i = 1; i < updatedRoutes.length; i++) {
          const previousDate = new Date(updatedRoutes[i - 1].sana);
          const nextDate = addDays(previousDate, 1);
          updatedRoutes[i].sana = format(nextDate, 'yyyy-MM-dd');
        }
      } else {
        // Update all subsequent routes to continue sequentially from the changed date
        for (let i = routeIndex + 1; i < updatedRoutes.length; i++) {
          const previousDate = new Date(updatedRoutes[i - 1].sana);
          const nextDate = addDays(previousDate, 1);
          updatedRoutes[i].sana = format(nextDate, 'yyyy-MM-dd');
        }
      }
    }

    setErRoutes(updatedRoutes);
  };

  const handleSaveRoute = () => {
    if (!routeForm.route) {
      toast.error('Please enter route name');
      return;
    }

    if (editingRoute) {
      // Update existing route
      setErRoutes(erRoutes.map(r =>
        r.id === editingRoute.id
          ? { ...r, ...routeForm }
          : r
      ));
      toast.success('Route updated');
    } else {
      // Add new route
      const newRoute = {
        id: Math.max(...erRoutes.map(r => r.id), 0) + 1,
        ...routeForm
      };
      setErRoutes([...erRoutes, newRoute]);
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

    // Calculate next date if last route has a date
    let nextDate = '';
    if (lastRoute?.sana) {
      const lastDate = new Date(lastRoute.sana);
      const nextDay = addDays(lastDate, 1);
      nextDate = format(nextDay, 'yyyy-MM-dd');
    }

    const newRoute = {
      id: newId,
      nomer: '',
      sana: nextDate,
      shahar: '',
      route: '',
      person: lastRoute?.person || '',
      transportType: lastRoute?.transportType || '',
      choiceTab: '',
      choiceRate: '',
      price: ''
    };

    setErRoutes([...erRoutes, newRoute]);
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

      setErRoutes(updatedRoutes);
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

      setErRoutes(updatedRoutes);
      return;
    }

    // Default behavior for other routes
    const updatedRoutes = erRoutes.map(r =>
      r.id === routeId ? { ...r, route: newRouteValue } : r
    );
    setErRoutes(updatedRoutes);
  };

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

    if (urgenchIndex !== -1 || hasShovotRoute) {
      const updatedRoutes = erRoutes.map((r, index) => {
        // Update Khiva - Urgench with Uzbekistan PAX
        if (r.route === 'Khiva - Urgench' && paxUzb > 0) {
          const newVehicle = getBestVehicleForRoute(r.choiceTab || 'sevil', paxUzb);
          const newPrice = r.choiceRate ? getPriceFromOpex(r.choiceTab || 'sevil', newVehicle, r.choiceRate) : r.price;
          return { ...r, person: paxUzb.toString(), transportType: newVehicle, price: newPrice || r.price };
        }
        // Update Khiva - Shovot with Turkmenistan PAX
        if (r.route === 'Khiva - Shovot' && paxTkm > 0) {
          const newVehicle = getBestVehicleForRoute(r.choiceTab || 'sevil', paxTkm);
          const newPrice = r.choiceRate ? getPriceFromOpex(r.choiceTab || 'sevil', newVehicle, r.choiceRate) : r.price;
          return { ...r, person: paxTkm.toString(), transportType: newVehicle, price: newPrice || r.price };
        }
        // Update Tashkent routes after Khiva - Urgench (Uzbekistan group only)
        if (urgenchIndex !== -1 && index > urgenchIndex && r.shahar === 'Tashkent' && paxUzb > 0) {
          const newVehicle = getBestVehicleForRoute(r.choiceTab || 'xayrulla', paxUzb);
          const newPrice = r.choiceRate ? getPriceFromOpex(r.choiceTab || 'xayrulla', newVehicle, r.choiceRate) : r.price;
          return { ...r, person: paxUzb.toString(), transportType: newVehicle, price: newPrice || r.price };
        }
        return r;
      });

      // Only update if something changed
      const hasChanges = updatedRoutes.some((r, i) =>
        r.person !== erRoutes[i].person || r.transportType !== erRoutes[i].transportType || r.price !== erRoutes[i].price
      );
      if (hasChanges) {
        setErRoutes(updatedRoutes);
      }
    }
  }, [tourists]);

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none overflow-x-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Новое бронирование' : formData.bookingNumber}
            </h1>
            {!isNew && booking?.tourType && (
              <p className="text-gray-500">{booking.tourType.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => isNew ? navigate(-1) : setEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-5 h-5" />
                Редактировать
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Navigation - only show for existing bookings */}
      {!isNew && (
        <div className="bg-gradient-to-b from-gray-50 to-white border-b-2 border-gray-200 shadow-sm">
          <nav className="flex space-x-2 overflow-x-auto px-2 py-2">
            {[
              { id: 'info', label: 'Информация', icon: MapPin },
              { id: 'rooms', label: 'Rooms', icon: Building2 },
              { id: 'tourists', label: 'Tourists', icon: Users },
              { id: 'rooming-list', label: 'Rooming List', icon: List },
              { id: 'rooming', label: 'Назначения', icon: ClipboardList },
              { id: 'route', label: 'Route', icon: Car },
              { id: 'documents', label: 'Документы', icon: FileText },
              { id: 'costs', label: 'Стоимость', icon: DollarSign }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-md border border-gray-200'
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <TouristsList bookingId={parseInt(id)} onUpdate={loadData} />
        </div>
      )}

      {!isNew && activeTab === 'rooming-list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <RoomingListModule bookingId={parseInt(id)} onUpdate={loadData} />
        </div>
      )}

      {!isNew && activeTab === 'rooming' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <RoomingList bookingId={parseInt(id)} bookingRooms={bookingRooms} onUpdate={loadData} />
        </div>
      )}

      {!isNew && activeTab === 'documents' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <HotelRequestPreview bookingId={parseInt(id)} booking={booking} />
        </div>
      )}

      {!isNew && activeTab === 'costs' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <CostSummary bookingId={parseInt(id)} booking={booking} />
        </div>
      )}

      {/* Route Tab */}
      {!isNew && activeTab === 'route' && (
        <div className="space-y-4">
          {/* Compact Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveAllRoutes}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleAddRoute}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Route
                </button>
              </div>
            </div>
          </div>

          {/* Route Table Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide w-12">#</th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide">Date</th>
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
                        <input
                          type="date"
                          value={route.sana || ''}
                          onChange={(e) => handleRouteDateChange(index, e.target.value)}
                          className="w-full px-2 py-1.5 bg-amber-50 text-amber-800 rounded-md text-xs font-medium border border-amber-200 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 cursor-pointer"
                        />
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
                            <option value="Andijan">Andijan</option>
                            <option value="Namangan">Namangan</option>
                            <option value="Kokand">Kokand</option>
                            <option value="Margilan">Margilan</option>
                          </optgroup>
                          <optgroup label="Other (Sevil)">
                            <option value="Samarkand">Samarkand</option>
                            <option value="Bukhara">Bukhara</option>
                            <option value="Khiva">Khiva</option>
                            <option value="Urgench">Urgench</option>
                            <option value="Asraf">Asraf</option>
                            <option value="Nukus">Nukus</option>
                            <option value="Termez">Termez</option>
                            <option value="Karshi">Karshi</option>
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
                            <option value="Khiva City Tour">Khiva City Tour</option>
                            <option value="Fergana City Tour">Fergana City Tour</option>
                            <option value="Nukus City Tour">Nukus City Tour</option>
                            <option value="Termez City Tour">Termez City Tour</option>
                            <option value="Kokand City Tour">Kokand City Tour</option>
                            <option value="Margilan City Tour">Margilan City Tour</option>
                            <option value="Shakhrisabz City Tour">Shakhrisabz City Tour</option>
                          </optgroup>
                          <optgroup label="Transfer">
                            <option value="Tashkent - Samarkand">Tashkent - Samarkand</option>
                            <option value="Samarkand - Asraf">Samarkand - Asraf</option>
                            <option value="Asraf - Bukhara">Asraf - Bukhara</option>
                            <option value="Samarkand - Bukhara">Samarkand - Bukhara</option>
                            <option value="Bukhara - Khiva">Bukhara - Khiva</option>
                            <option value="Olot - Bukhara">Olot - Bukhara</option>
                            <option value="Khiva - Urgench">Khiva - Urgench</option>
                            <option value="Khiva - Shovot">Khiva - Shovot</option>
                            <option value="Khiva - Nukus">Khiva - Nukus</option>
                            <option value="Tashkent - Fergana">Tashkent - Fergana</option>
                            <option value="Fergana - Tashkent">Fergana - Tashkent</option>
                            <option value="Samarkand - Shakhrisabz">Samarkand - Shakhrisabz</option>
                            <option value="Shakhrisabz - Samarkand">Shakhrisabz - Samarkand</option>
                            <option value="Tashkent - Chimgan">Tashkent - Chimgan</option>
                            <option value="Chimgan - Tashkent">Chimgan - Tashkent</option>
                          </optgroup>
                          <optgroup label="Excursion">
                            <option value="Chimgan Excursion">Chimgan Excursion</option>
                            <option value="Charvak Excursion">Charvak Excursion</option>
                            <option value="Nurata Excursion">Nurata Excursion</option>
                            <option value="Aydarkul Excursion">Aydarkul Excursion</option>
                            <option value="Muynak Excursion">Muynak Excursion</option>
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={route.person || ''}
                          onChange={(e) => {
                            const newPersonCount = e.target.value;
                            const autoVehicle = route.choiceTab ? getBestVehicleForRoute(route.choiceTab, newPersonCount) : '';
                            const updatedRoutes = erRoutes.map(r =>
                              r.id === route.id ? {
                                ...r,
                                person: newPersonCount,
                                transportType: autoVehicle || r.transportType,
                                choiceRate: autoVehicle && autoVehicle !== r.transportType ? '' : r.choiceRate,
                                price: autoVehicle && autoVehicle !== r.transportType ? '' : r.price
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
                            const updatedRoutes = erRoutes.map(r =>
                              r.id === route.id ? { ...r, transportType: newTransportType, choiceRate: '', price: '' } : r
                            );
                            setErRoutes(updatedRoutes);
                          }}
                          className="w-full px-2 py-1.5 bg-indigo-50 text-indigo-800 rounded-md text-xs font-medium border border-indigo-200 focus:ring-1 focus:ring-indigo-400 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          disabled={!route.choiceTab}
                        >
                          <option value="">{route.choiceTab ? 'Select' : '-'}</option>
                          {route.choiceTab === 'sevil' && sevilVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name} ({v.person})</option>
                          ))}
                          {route.choiceTab === 'xayrulla' && xayrullaVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name} ({v.person})</option>
                          ))}
                          {route.choiceTab === 'nosir' && nosirVehicles.map(v => (
                            <option key={v.id} value={v.name}>{v.name} ({v.person})</option>
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
                    const bestVehicle = findBestVehicle(vehicles, editingRouteForProvider?.person);

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Основная информация
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Номер бронирования *
                </label>
                <input
                  type="text"
                  name="bookingNumber"
                  value={formData.bookingNumber}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  placeholder="ER-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип тура *
                </label>
                <select
                  name="tourTypeId"
                  value={formData.tourTypeId}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  <option value="">Выберите тип</option>
                  {tourTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.code} - {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Гид
                </label>
                <select
                  name="guideId"
                  value={formData.guideId}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  <option value="">Не назначен</option>
                  {guides.map((guide) => (
                    <option key={guide.id} value={guide.id}>
                      {guide.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Страна группы
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  <option value="">Выберите страну</option>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              Даты
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Начало тура *
                </label>
                <input
                  type="date"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Прибытие
                </label>
                <input
                  type="date"
                  name="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Окончание
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>
            </div>
          </div>
          )}

          {/* Transport */}
          {(isNew || activeTab === 'info') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Train className="w-5 h-5 text-gray-400" />
              Транспорт
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ЖД билеты
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
                    <span>{formData.trainTickets || 'Не указано'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Авиабилеты
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
                    <span>{formData.avia || 'Не указано'}</span>
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
                </div>
              </div>

              {/* Statistics Cards */}
              {(() => {
                // Calculate statistics from tourists
                const totalGuests = tourists.length;

                // Count unique rooms by type
                const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };
                const touristsWithoutRoom = { DBL: 0, TWN: 0, SNGL: 0 };

                tourists.forEach(t => {
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
                const uzbekCount = tourists.filter(t => {
                  const acc = (t.accommodation || '').toLowerCase();
                  return acc.includes('uzbek') || acc.includes('узбек');
                }).length;

                const turkmCount = tourists.filter(t => {
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
              {accommodations.length > 0 && (
                <div className="space-y-6 w-full">
                  {accommodations.map((acc, accIndex) => (
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
                                  {acc.nights === 1 ? 'ночь' : acc.nights < 5 ? 'ночи' : 'ночей'}
                                </span>
                              </div>
                            </div>
                            {/* Room Types Display */}
                            {acc.rooms && acc.rooms.length > 0 && (() => {
                              return (
                                <div className="mt-4 flex flex-wrap gap-4">
                                  {acc.rooms.map((room, idx) => {
                                    // Find matching room type to check if tourist tax is enabled
                                    const matchingRoomType = acc.hotel?.roomTypes?.find(rt =>
                                      rt.name === room.roomTypeCode ||
                                      rt.displayName === room.roomTypeCode ||
                                      rt.name?.toUpperCase() === room.roomTypeCode?.toUpperCase()
                                    );

                                    // Use saved price (already includes tourist tax and VAT)
                                    const displayPrice = Math.round(room.pricePerNight).toLocaleString();

                                    // Check if tourist tax is enabled (for display label)
                                    const hasTouristTax = matchingRoomType?.touristTaxEnabled && matchingRoomType?.brvValue > 0;

                                    return (
                                      <span key={idx} className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 text-green-900 border-2 border-green-400 rounded-2xl text-lg font-black shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                                        <span className="text-green-800 text-xl">{room.roomTypeCode}:</span>
                                        <span className="text-gray-800">{room.roomsCount} × {room.guestsPerRoom} чел.</span>
                                        {room.pricePerNight > 0 && (
                                          <span className="text-green-700 text-base font-semibold">
                                            ({displayPrice} UZS/ночь)
                                            {hasTouristTax && (
                                              <span className="text-green-600 text-xs ml-1">
                                                (вкл. турсбор)
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
                            {/* Totals */}
                            {(acc.totalRooms > 0 || acc.totalGuests > 0 || acc.totalCost > 0) && (() => {
                              // Check if this is PAX-based (Guesthouse/Yurta)
                              const isPAX = acc.rooms?.some(r => r.roomTypeCode === 'PAX');

                              // Determine hotel's primary currency - if any room type uses UZS, use UZS for all
                              const hasUZS = acc.hotel?.roomTypes?.some(rt => rt.currency === 'UZS');
                              const hotelCurrency = hasUZS ? 'UZS' : (acc.hotel?.roomTypes?.[0]?.currency || 'UZS');
                              const currencySymbol = hotelCurrency === 'USD' ? '$' : hotelCurrency === 'EUR' ? '€' : ' UZS';
                              const displayCost = hotelCurrency === 'UZS' ? acc.totalCost.toLocaleString() : acc.totalCost.toFixed(2);

                              return (
                                <div className="mt-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl px-6 py-5 border-2 border-blue-300 shadow-lg">
                                  <div className="flex items-center gap-4 flex-wrap justify-between">
                                    <div className="flex items-center gap-4">
                                      <span className="text-2xl font-black text-gray-900">Итого:</span>
                                      {!isPAX && acc.totalRooms > 0 && (
                                        <span className="inline-flex items-center gap-1 text-lg font-bold text-gray-700">
                                          {acc.totalRooms} номеров
                                        </span>
                                      )}
                                      {acc.totalGuests > 0 && (
                                        <span className="inline-flex items-center gap-1 text-lg font-bold text-gray-700">
                                          {!isPAX && <span className="text-gray-400">•</span>}
                                          {acc.totalGuests} гостей
                                        </span>
                                      )}
                                    </div>
                                    {acc.totalCost > 0 && (
                                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-primary-600 rounded-xl shadow-lg">
                                        <span className="text-3xl font-black text-white">{displayCost}</span>
                                        <span className="text-xl font-bold text-blue-100">{currencySymbol}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const previewUrl = bookingsApi.getHotelRequestPreview(id, acc.id);
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
                        const isFirstAccommodation = accIndex === 0;
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
                        const touristsToDisplay = accommodationRoomingList || accTourists;

                        // Sort tourists by room number to keep pairs together
                        const sortedAccTourists = [...touristsToDisplay].sort((a, b) => {
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
                                  <p className="text-sm text-gray-600">{accTourists.length} {accTourists.length === 1 ? 'турист' : 'туристов'}</p>
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
                                  // Calculate statistics
                                  const totalGuests = accTourists.length;

                                  // Count unique rooms by type
                                  const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                                  const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };
                                  const touristsWithoutRoom = { DBL: 0, TWN: 0, SNGL: 0 };

                                  accTourists.forEach(t => {
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
                                  const uzbekCount = accTourists.filter(t => {
                                    const acc = (t.accommodation || '').toLowerCase();
                                    return acc.includes('uzbek') || acc.includes('узбек');
                                  }).length;

                                  const turkmCount = accTourists.filter(t => {
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

                                      // Tourist's individual dates from Rooming List (use these for display)
                                      const touristCheckInDate = t.checkInDate ? new Date(t.checkInDate) : accCheckIn;
                                      const touristCheckOutDate = t.checkOutDate ? new Date(t.checkOutDate) : accCheckOut;

                                      // Check if tourist has different dates than accommodation (extra nights)
                                      const hasDifferentDates = (
                                        touristCheckInDate.getTime() !== accCheckIn.getTime() ||
                                        touristCheckOutDate.getTime() !== accCheckOut.getTime()
                                      );
                                      const hasCustomDates = hasAccommodationOverride || hasDifferentDates;
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
                  ))}

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Примечания</h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              disabled={!editing}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              placeholder="Дополнительные заметки..."
            />
          </div>
          )}
        </div>

        {/* Sidebar - show for Info tab or new booking */}
        {(isNew || activeTab === 'info') && (
        <div className="space-y-6">
          {/* Tourists */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Tourists
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Всего (Pax)
                  <span className="ml-1 text-xs text-gray-500">(автоматически)</span>
                </label>
                <input
                  type="number"
                  name="pax"
                  value={formData.pax}
                  disabled={true}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Узбекистан
                </label>
                <input
                  type="number"
                  name="paxUzbekistan"
                  value={formData.paxUzbekistan}
                  onChange={handleChange}
                  disabled={!editing}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>

              {/* Only show Turkmenistan field for ER tour type */}
              {(() => {
                const selectedTourType = tourTypes.find(t => t.id === parseInt(formData.tourTypeId));
                const tourTypeCode = selectedTourType?.code;
                return tourTypeCode === 'ER' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Туркменистан
                    </label>
                    <input
                      type="number"
                      name="paxTurkmenistan"
                      value={formData.paxTurkmenistan}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                    />
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Rooms - calculated from Rooming List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Home className="w-5 h-5 text-gray-400" />
              Номера
            </h2>

            {!isNew && tourists.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">DBL</label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium">
                      {calculatedRoomCounts.dbl}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">TWN</label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium">
                      {calculatedRoomCounts.twn}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">SGL</label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium">
                      {calculatedRoomCounts.sgl}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Всего номеров
                  </label>
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium">
                    {calculatedRoomCounts.total}
                  </div>
                </div>

                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <List className="w-3 h-3" />
                  Рассчитано из Rooming List ({tourists.length} туристов)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">DBL</label>
                    <input
                      type="number"
                      name="roomsDbl"
                      value={formData.roomsDbl}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">TWN</label>
                    <input
                      type="number"
                      name="roomsTwn"
                      value={formData.roomsTwn}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">SGL</label>
                    <input
                      type="number"
                      name="roomsSngl"
                      value={formData.roomsSngl}
                      onChange={handleChange}
                      disabled={!editing}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Всего номеров
                  </label>
                  <input
                    type="number"
                    name="roomsTotal"
                    value={formData.roomsTotal}
                    onChange={handleChange}
                    disabled={!editing}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  />
                </div>

                {!isNew && (
                  <p className="text-xs text-gray-500">
                    Добавьте туристов в Rooming List для автоматического расчёта
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
                      <option value="Andijan">Andijan</option>
                      <option value="Namangan">Namangan</option>
                      <option value="Kokand">Kokand</option>
                      <option value="Margilan">Margilan</option>
                    </optgroup>
                    <optgroup label="Other (Sevil)">
                      <option value="Samarkand">Samarkand</option>
                      <option value="Bukhara">Bukhara</option>
                      <option value="Khiva">Khiva</option>
                      <option value="Urgench">Urgench</option>
                      <option value="Asraf">Asraf</option>
                      <option value="Nukus">Nukus</option>
                      <option value="Termez">Termez</option>
                      <option value="Karshi">Karshi</option>
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
