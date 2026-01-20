import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi, hotelsApi, touristsApi } from '../services/api';
import { format } from 'date-fns';
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
  Wand2
} from 'lucide-react';

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

  useEffect(() => {
    loadData();
  }, [id]);

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
        const [bookingRes, accommodationsRes, touristsRes] = await Promise.all([
          bookingsApi.getById(id),
          bookingsApi.getAccommodations(id),
          touristsApi.getAll(id)
        ]);
        const b = bookingRes.data.booking;
        setBooking(b);
        setBookingRooms(b.bookingRooms || []);
        setAccommodations(accommodationsRes.data.accommodations || []);
        setTourists(touristsRes.data.tourists || []);
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

      // Step 4: Create accommodations for each hotel stay
      // For split groups, handle last day specially
      const lastDay = Math.max(...itinerary.map(d => d.dayNumber));

      for (let i = 0; i < hotelStays.length; i++) {
        const stay = hotelStays[i];
        const isLastStay = (i === hotelStays.length - 1);

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

        // If this is the last stay and group splits
        if (isLastStay && hasSplit) {
          // Last stay handles BOTH groups separately

          // 1. Create accommodation for the group that stays in this city
          if (isKhiva && turkmenistanTourists.length > 0) {
            // Khiva hotel - for Turkmenistan group only
            accommodationsToCreate.push({
              hotel,
              startDay: stay.startDay,
              endDay: stay.endDay,
              tourists: turkmenistanTourists,
              groupName: 'Turkmenistan'
            });
          } else if (isTashkent && uzbekistanTourists.length > 0) {
            // Tashkent hotel - for Uzbekistan group only
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

          // 2. Add the OTHER group's accommodation on last day
          if (isKhiva && uzbekistanTourists.length > 0) {
            // Add Tashkent hotel for Uzbekistan group
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
          } else if (isTashkent && turkmenistanTourists.length > 0) {
            // Add Khiva hotel for Turkmenistan group
            const khivaHotel = hotels.find(h =>
              h.name.toLowerCase().includes('malika') ||
              (h.city?.name?.toLowerCase().includes('хива') || h.city?.name?.toLowerCase().includes('khiva'))
            );
            if (khivaHotel) {
              accommodationsToCreate.push({
                hotel: khivaHotel,
                startDay: lastDay,
                endDay: lastDay,
                tourists: turkmenistanTourists,
                groupName: 'Turkmenistan'
              });
            } else {
              toast.error('Отель в Хиве не найден для группы Turkmenistan');
            }
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
        checkOutDate.setDate(checkOutDate.getDate() + endDay);

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

          // DBL rooms (pairs of DOUBLE)
          if (doubleCount >= 2) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'DBL');
            rooms.push({
              roomTypeCode: 'DBL',
              roomsCount: Math.floor(doubleCount / 2),
              guestsPerRoom: 2,
              pricePerNight: hotelRoomType?.pricePerNight || 0
            });
          }

          // TWN rooms (pairs of TWIN + odd DOUBLE)
          const twinPairs = Math.floor(twinCount / 2);
          const oddDouble = doubleCount % 2 === 1 ? 1 : 0;
          const oddTwin = twinCount % 2 === 1 ? 1 : 0;
          const totalTwnRooms = twinPairs + (oddDouble > 0 || oddTwin > 0 ? 1 : 0);

          if (totalTwnRooms > 0) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'TWN');
            rooms.push({
              roomTypeCode: 'TWN',
              roomsCount: totalTwnRooms,
              guestsPerRoom: 2,
              pricePerNight: hotelRoomType?.pricePerNight || 0
            });
          }

          // SNGL rooms
          if (singleCount > 0) {
            const hotelRoomType = hotel.roomTypes?.find(rt => rt.name === 'SNGL');
            rooms.push({
              roomTypeCode: 'SNGL',
              roomsCount: singleCount,
              guestsPerRoom: 1,
              pricePerNight: hotelRoomType?.pricePerNight || 0
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
        toast.success('Размещение обновлено');
      } else {
        await bookingsApi.addRoom(id, roomAllocForm);
        toast.success('Размещение добавлено');
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
      toast.success('Размещение удалено');
      loadData();
    } catch (error) {
      toast.error('Ошибка удаления');
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
    <div className="space-y-6">
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
              { id: 'rooms', label: 'Размещение', icon: Building2 },
              { id: 'tourists', label: 'Tourists', icon: Users },
              { id: 'rooming-list', label: 'Rooming List', icon: List },
              { id: 'rooming', label: 'Назначения', icon: ClipboardList },
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-sm">
                    <Building2 className="w-5 h-5 text-primary-600" />
                  </div>
                  Размещение в отелях
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={autoFillAccommodationsFromItinerary}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    title="Автоматически создать размещения из программы тура"
                  >
                    <Wand2 className="w-4 h-4" />
                    Из программы тура
                  </button>
                  <button
                    onClick={() => { setEditingAccommodation(null); setAccommodationFormOpen(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить отель
                  </button>
                </div>
              </div>

              {/* Accommodations (Simplified structure) */}
              {accommodations.length > 0 && (
                <div className="space-y-4">
                  {accommodations.map((acc) => (
                    <div key={acc.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-200 shadow-md hover:shadow-xl hover:scale-[1.005] transition-all duration-300 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 border-2 border-primary-300 flex items-center justify-center shadow-sm">
                            <Building2 className="w-6 h-6 text-primary-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 text-base mb-1">{acc.hotel?.name}</div>
                            <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1 font-medium">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {acc.hotel?.city?.name}
                              </span>
                              <span className="mx-1 text-gray-400">•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {format(new Date(acc.checkInDate), 'dd.MM.yy')} — {format(new Date(acc.checkOutDate), 'dd.MM.yy')}
                              </span>
                              <span className="mx-1 text-gray-400">•</span>
                              <span className="font-medium">{acc.nights} {acc.nights === 1 ? 'ночь' : acc.nights < 5 ? 'ночи' : 'ночей'}</span>
                            </div>
                            {/* Room Types Display */}
                            {acc.rooms && acc.rooms.length > 0 && (() => {
                              // Determine hotel's primary currency - if any room type uses UZS, use UZS for all
                              const hasUZS = acc.hotel?.roomTypes?.some(rt => rt.currency === 'UZS');
                              const hotelCurrency = hasUZS ? 'UZS' : (acc.hotel?.roomTypes?.[0]?.currency || 'UZS');

                              return (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {acc.rooms.map((room, idx) => {
                                    const currencySymbol = hotelCurrency === 'USD' ? '$' : hotelCurrency === 'EUR' ? '€' : ' UZS';

                                    return (
                                      <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-br from-green-50 to-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold shadow-sm">
                                        {room.roomTypeCode}: {room.roomsCount} x {room.guestsPerRoom} чел.
                                        {room.pricePerNight > 0 && ` (${room.pricePerNight.toLocaleString()}${currencySymbol}/ночь)`}
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
                                <div className="mt-3 text-sm text-gray-700 bg-gradient-to-r from-gray-50 to-transparent rounded-lg px-3 py-2 border-l-4 border-primary-400">
                                  <span className="font-bold text-gray-800">Итого:</span>
                                  {!isPAX && acc.totalRooms > 0 && <span className="ml-2 font-medium">{acc.totalRooms} номеров</span>}
                                  {acc.totalGuests > 0 && <span className="ml-2 font-medium">{!isPAX && '• '}{acc.totalGuests} гостей</span>}
                                  {acc.totalCost > 0 && <span className="ml-2 text-primary-600 font-bold">• {displayCost}{currencySymbol}</span>}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingAccommodation(acc);
                              setAccommodationFormOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl hover:scale-110 transition-all duration-200"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Удалить это размещение?')) {
                                try {
                                  await bookingsApi.deleteAccommodation(id, acc.id);
                                  toast.success('Размещение удалено');
                                  loadData();
                                } catch (error) {
                                  toast.error('Ошибка удаления');
                                }
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl hover:scale-110 transition-all duration-200"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
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
