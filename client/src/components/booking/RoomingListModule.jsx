import { useState, useEffect, useMemo } from 'react';
import { touristsApi, bookingsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Edit, Upload, Users, User, FileText,
  X, Save, Search, Download, ChevronDown, Check, Plus, Trash2, Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

export default function RoomingListModule({ bookingId, onUpdate }) {
  const [tourists, setTourists] = useState([]);
  const [booking, setBooking] = useState(null); // Booking details for ЗАЯВКА header
  const [accommodations, setAccommodations] = useState([]); // Hotel accommodations
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Import state
  const [importing, setImporting] = useState(false);

  // Modal state for editing tourist
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTourist, setEditingTourist] = useState(null);
  const [form, setForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    roomPreference: '',
    accommodation: '',
    remarks: ''
  });

  // Inline edit states
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRemarksId, setEditingRemarksId] = useState(null);
  const [roomValue, setRoomValue] = useState('');
  const [remarksValue, setRemarksValue] = useState('');

  // Export dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Add Tourist modal state
  const [addTouristModalOpen, setAddTouristModalOpen] = useState(false);
  const [newTouristForm, setNewTouristForm] = useState({
    firstName: '',
    lastName: '',
    fullName: '',
    gender: 'M',
    roomPreference: 'DBL',
    accommodation: 'Uzbekistan',
    country: 'Germany',
    passportNumber: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [touristsRes, bookingRes, accommodationsRes] = await Promise.all([
        touristsApi.getAll(bookingId),
        bookingsApi.getById(bookingId),
        bookingsApi.getAccommodations(bookingId)
      ]);
      console.log('🔍 Booking Response:', bookingRes);
      console.log('🔍 Booking Object:', bookingRes?.data?.booking);
      console.log('🔍 Departure Date:', bookingRes?.data?.booking?.departureDate);
      console.log('🔍 End Date:', bookingRes?.data?.booking?.endDate);
      console.log('🔍 Tourists:', touristsRes.data.tourists);
      console.log('🏨 Accommodations:', accommodationsRes.data);
      // Log remarks for debugging
      touristsRes.data.tourists?.forEach(t => {
        if (t.remarks && t.remarks !== '-') {
          console.log(`📝 ${t.fullName}: ${t.remarks}`);
        }
      });
      setTourists(touristsRes.data.tourists || []);
      setBooking(bookingRes?.data?.booking || null);
      setAccommodations(accommodationsRes.data || []);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    // Use UTC methods to avoid timezone issues
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}.${month}.${year}`;
  };

  // ============================================
  // SORTING & GROUPING: By Country (Uzbekistan first, then Turkmenistan), then by room type
  // ============================================

  // Check if tourist is Turkmenistan
  const isTurkmenistan = (tourist) => {
    const acc = (tourist.accommodation || '').toLowerCase();
    return acc.includes('turkmenistan') ||
           acc.includes('turkmen') ||
           acc.includes('туркмен') ||
           acc === 'tm';
  };

  // Group tourists by room type for display
  const groupTouristsByRoomType = (touristsList) => {
    const groups = {
      DBL: [],
      TWN: [],
      SNGL: [],
      other: []
    };

    touristsList.forEach(tourist => {
      const roomType = tourist.roomPreference?.toUpperCase();
      if (roomType === 'DBL' || roomType === 'DOUBLE') {
        groups.DBL.push(tourist);
      } else if (roomType === 'TWN' || roomType === 'TWIN') {
        groups.TWN.push(tourist);
      } else if (roomType === 'SNGL' || roomType === 'SINGLE') {
        groups.SNGL.push(tourist);
      } else {
        groups.other.push(tourist);
      }
    });

    // Sort within each group by roomNumber to keep pairs together
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        // First by roomNumber to keep room pairs together
        const roomA = a.roomNumber || '';
        const roomB = b.roomNumber || '';
        if (roomA !== roomB) return roomA.localeCompare(roomB);
        // Then by lastName
        return (a.lastName || '').localeCompare(b.lastName || '');
      });
    });

    return groups;
  };

  // Filter tourists by search query
  // Show ALL tourists (with or without room numbers)
  const filteredTourists = tourists
    .filter(p => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });

  // Separate Uzbekistan and Turkmenistan tourists
  const uzbekistanTourists = filteredTourists.filter(t => !isTurkmenistan(t));
  const turkmenistanTourists = filteredTourists.filter(t => isTurkmenistan(t));

  // Find the first accommodation (earliest check-in date or within 2 days of departure)
  const firstAccommodationHotel = useMemo(() => {
    if (!Array.isArray(accommodations) || accommodations.length === 0) return null;

    // Sort accommodations by check-in date
    const sorted = [...accommodations].sort((a, b) => {
      const dateA = new Date(a.checkInDate);
      const dateB = new Date(b.checkInDate);
      return dateA - dateB;
    });

    // First accommodation is the one with earliest check-in
    const firstAcc = sorted[0];

    // Also verify it's within 2 days of departure date
    if (booking?.departureDate && firstAcc) {
      const departureDate = new Date(booking.departureDate);
      departureDate.setHours(0, 0, 0, 0);
      const checkInDate = new Date(firstAcc.checkInDate);
      checkInDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.abs((checkInDate - departureDate) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 2) {
        return firstAcc.hotel?.name || null;
      }
    }

    return firstAcc?.hotel?.name || null;
  }, [accommodations, booking?.departureDate]);

  // Group tourists by hotel (match by dates and accommodation)
  const touristsByHotel = useMemo(() => {
    const groups = {};

    filteredTourists.forEach(tourist => {
      let hotelName = 'Не указан отель';

      // Get tourist's check-in and check-out dates
      const touristCheckIn = tourist.checkInDate ? new Date(tourist.checkInDate) : null;
      const touristCheckOut = tourist.checkOutDate ? new Date(tourist.checkOutDate) : null;

      // If tourist has custom dates, try to match with accommodation
      if (touristCheckIn && touristCheckOut && accommodations.length > 0) {
        // Find matching accommodation by dates
        const matchingAccommodation = accommodations.find(acc => {
          const accCheckIn = new Date(acc.checkInDate);
          const accCheckOut = new Date(acc.checkOutDate);

          // Check if tourist dates overlap with accommodation dates
          return touristCheckIn >= accCheckIn && touristCheckOut <= accCheckOut;
        });

        if (matchingAccommodation && matchingAccommodation.hotel?.name) {
          hotelName = matchingAccommodation.hotel.name;
        }
      } else if (accommodations.length === 1) {
        // If only one accommodation, assign all tourists to it
        hotelName = accommodations[0].hotel?.name || 'Не указан отель';
      }

      if (!groups[hotelName]) {
        groups[hotelName] = [];
      }
      groups[hotelName].push(tourist);
    });

    console.log('🏨 Tourists grouped by hotel:', groups);
    console.log('🏨 Accommodations:', accommodations);
    return groups;
  }, [filteredTourists, accommodations]);

  // Sort uzbekistan tourists by room number (to keep room pairs together)
  uzbekistanTourists.sort((a, b) => {
    const roomA = a.roomNumber || '';
    const roomB = b.roomNumber || '';
    if (roomA !== roomB) return roomA.localeCompare(roomB);
    return (a.lastName || '').localeCompare(b.lastName || '');
  });

  // Sort turkmenistan tourists by room number
  turkmenistanTourists.sort((a, b) => {
    const roomA = a.roomNumber || '';
    const roomB = b.roomNumber || '';
    if (roomA !== roomB) return roomA.localeCompare(roomB);
    return (a.lastName || '').localeCompare(b.lastName || '');
  });

  // Combine: Uzbekistan first, then Turkmenistan
  const sortedTourists = [...uzbekistanTourists, ...turkmenistanTourists];

  // Group each country's tourists by room type
  const uzbekistanByRoomType = groupTouristsByRoomType(uzbekistanTourists);
  const turkmenistanByRoomType = groupTouristsByRoomType(turkmenistanTourists);

  // Room type display info with enhanced styling
  const roomTypeInfo = {
    DBL: {
      label: 'DOUBLE',
      description: '2 persons per room',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeColor: 'bg-blue-500 text-white',
      icon: '👫',
      headerBg: 'bg-gradient-to-r from-blue-500 to-blue-600'
    },
    TWN: {
      label: 'TWIN',
      description: '2 separate beds',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeColor: 'bg-emerald-500 text-white',
      icon: '🛏️',
      headerBg: 'bg-gradient-to-r from-emerald-500 to-emerald-600'
    },
    SNGL: {
      label: 'SINGLE',
      description: '1 person per room',
      color: 'bg-violet-50 text-violet-700 border-violet-200',
      badgeColor: 'bg-violet-500 text-white',
      icon: '👤',
      headerBg: 'bg-gradient-to-r from-violet-500 to-violet-600'
    },
    other: {
      label: 'NOT ASSIGNED',
      description: 'Room type not specified',
      color: 'bg-gray-50 text-gray-600 border-gray-200',
      badgeColor: 'bg-gray-400 text-white',
      icon: '❓',
      headerBg: 'bg-gradient-to-r from-gray-400 to-gray-500'
    }
  };

  // Country section info with enhanced styling
  const countryInfo = {
    uzbekistan: {
      label: 'UZBEKISTAN',
      color: 'bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 text-white shadow-lg shadow-sky-200',
      icon: '🇺🇿',
      borderColor: 'border-l-sky-500'
    },
    turkmenistan: {
      label: 'TURKMENISTAN',
      color: 'bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white shadow-lg shadow-orange-200',
      icon: '🇹🇲',
      borderColor: 'border-l-orange-500'
    }
  };


  // ============================================
  // PDF IMPORT HANDLER
  // ============================================

  const handlePdfImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file');
      e.target.value = '';
      return;
    }

    setImporting(true);
    try {
      const response = await touristsApi.importRoomingListPdf(bookingId, file);

      if (response.data.success) {
        const { summary } = response.data;
        const parts = [];
        if (summary.touristsUpdated > 0) parts.push(`${summary.touristsUpdated} updated`);
        if (summary.touristsCreated > 0) parts.push(`${summary.touristsCreated} created`);
        if (summary.touristsDeleted > 0) parts.push(`${summary.touristsDeleted} deleted`);
        const msg = `${parts.join(', ')} (${summary.uzbekistanCount} UZ, ${summary.turkmenistanCount} TM)`;
        toast.success(msg);
        await loadData();
        onUpdate?.();
      } else {
        toast.error(response.data.error || 'Import failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error importing PDF';
      toast.error(errorMsg);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // ============================================
  // TOURIST HANDLERS
  // ============================================

  const openModal = (tourist) => {
    setEditingTourist(tourist);
    const remarkValue = tourist.remarks && tourist.remarks !== '-' ? tourist.remarks : '';

    // Format dates for input fields
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    };

    setForm({
      checkInDate: formatDateForInput(tourist.checkInDate),
      checkOutDate: formatDateForInput(tourist.checkOutDate),
      roomPreference: tourist.roomPreference || '',
      accommodation: tourist.accommodation || 'Uzbekistan',
      remarks: remarkValue
    });
    setModalOpen(true);
  };

  const saveRoomAndRemarks = async () => {
    try {
      console.log('Saving tourist:', editingTourist.id, 'with data:', form);
      const updateData = {
        checkInDate: form.checkInDate || null,
        checkOutDate: form.checkOutDate || null,
        roomPreference: form.roomPreference || null,
        accommodation: form.accommodation || null,
        remarks: form.remarks || null
      };
      const response = await touristsApi.update(bookingId, editingTourist.id, updateData);
      console.log('Save response:', response);
      toast.success('Updated successfully');
      setModalOpen(false);
      loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving tourist:', error);
      toast.error(error.response?.data?.error || 'Error saving changes');
    }
  };

  const startEditRoom = (tourist) => {
    setEditingRoomId(tourist.id);
    setRoomValue(tourist.roomPreference || '');
  };

  const saveRoom = async (touristId) => {
    try {
      await touristsApi.update(bookingId, touristId, { roomPreference: roomValue });
      setEditingRoomId(null);
      loadData();
      onUpdate?.();
    } catch (error) {
      toast.error('Error saving');
    }
  };

  const startEditRemarks = (tourist) => {
    setEditingRemarksId(tourist.id);
    setRemarksValue(tourist.remarks || '');
  };

  const saveRemarks = async (touristId) => {
    try {
      await touristsApi.update(bookingId, touristId, { remarks: remarksValue });
      setEditingRemarksId(null);
      loadData();
      onUpdate?.();
    } catch (error) {
      toast.error('Error saving');
    }
  };

  // Open Add Tourist modal
  const openAddTouristModal = () => {
    setNewTouristForm({
      firstName: '',
      lastName: '',
      fullName: '',
      gender: 'M',
      roomPreference: 'DBL',
      accommodation: 'Uzbekistan',
      country: 'Germany',
      passportNumber: '',
      remarks: ''
    });
    setAddTouristModalOpen(true);
  };

  // Save new tourist
  const saveNewTourist = async () => {
    try {
      // Validate required fields
      if (!newTouristForm.firstName || !newTouristForm.lastName) {
        toast.error('First name and last name are required');
        return;
      }

      // Build full name
      const fullName = newTouristForm.fullName || `${newTouristForm.lastName}, ${newTouristForm.firstName}`;

      const touristData = {
        ...newTouristForm,
        fullName,
        bookingId: parseInt(bookingId)
      };

      await touristsApi.create(bookingId, touristData);
      toast.success('Tourist added successfully');
      setAddTouristModalOpen(false);

      // Reload data and notify parent
      console.log('🔄 Reloading local tourist data...');
      await loadData(); // Wait for local data to reload
      console.log('✅ Local data reloaded, calling parent onUpdate...');
      if (onUpdate) {
        await onUpdate(); // Wait for parent to reload
        console.log('✅ Parent data reloaded');
      }
    } catch (error) {
      console.error('Error adding tourist:', error);
      toast.error(error.response?.data?.error || 'Error adding tourist');
    }
  };

  // ============================================
  // EXPORT HANDLER (Name, Room, Remarks only)
  // ============================================

  const handleExport = async (format) => {
    setExportMenuOpen(false);
    try {
      if (format === 'excel') {
        const workbook = XLSX.utils.book_new();

        // Group tourists by hotel
        const touristsByHotel = {};
        filteredTourists.forEach(t => {
          const hotel = t.hotelName || 'Не указан отель';
          if (!touristsByHotel[hotel]) {
            touristsByHotel[hotel] = [];
          }
          touristsByHotel[hotel].push(t);
        });

        // Create a sheet for each hotel (ЗАЯВКА format)
        Object.entries(touristsByHotel).forEach(([hotelName, hotelTourists]) => {
          const wsData = [];

          // Header - Orient Insight company info
          wsData.push(['']);
          wsData.push(['', '', '', 'ORIENT INSIGHT']);
          wsData.push(['', '', '', 'Travel & Tourism']);
          wsData.push(['', '', '', 'Республика Узбекистан,']);
          wsData.push(['', '', '', 'г.Самарканд, Шота Руставели, дом 45']);
          wsData.push(['', '', '', 'Тел/fax.: +998 933484208, +998 97 9282814']);
          wsData.push(['', '', '', 'E-Mail: orientinsightreisen@gmail.com']);
          wsData.push(['', '', '', 'Website: orient-insight.uz']);
          wsData.push(['']);

          // Date
          wsData.push(['Дата:', formatDisplayDate(new Date())]);
          wsData.push(['']);

          // Recipient
          wsData.push(['', '', `Директору гостиницы`]);
          wsData.push(['', '', hotelName]);
          wsData.push(['']);

          // Title
          wsData.push(['', '', 'ЗАЯВКА']);
          wsData.push(['']);

          // Opening text
          wsData.push(['ООО "ORIENT INSIGHT" приветствует Вас, и просит забронировать места']);
          wsData.push(['c учётом нижеследующих деталей.']);
          wsData.push(['']);

          // Group info table
          const roomTypeCounts = { DBL: 0, TWN: 0, SNGL: 0 };
          hotelTourists.forEach(t => {
            const rt = t.roomPreference?.toUpperCase();
            if (rt === 'DBL' || rt === 'DOUBLE') roomTypeCounts.DBL++;
            else if (rt === 'TWN' || rt === 'TWIN') roomTypeCounts.TWN++;
            else if (rt === 'SNGL' || rt === 'SINGLE') roomTypeCounts.SNGL++;
          });

          // ARRIVAL = TOUR START + 1 day
          const arrivalDate = booking?.departureDate ? (() => {
            const arrival = new Date(booking.departureDate);
            arrival.setDate(arrival.getDate() + 1);
            return formatDisplayDate(arrival);
          })() : '';

          const checkInDate = hotelTourists[0]?.checkInDate ? formatDisplayDate(hotelTourists[0].checkInDate) : arrivalDate;
          const checkOutDate = hotelTourists[0]?.checkOutDate ? formatDisplayDate(hotelTourists[0].checkOutDate) : booking?.endDate ? formatDisplayDate(booking.endDate) : '';

          wsData.push(['№', 'Группа', 'Страна', 'PAX', 'Первый заезд', 'Первый выезд', 'DBL', 'TWN', 'SNGL', 'Тип номера']);
          wsData.push([
            '1',
            booking?.bookingNumber || 'N/A',
            booking?.country || 'Германия',
            hotelTourists.length,
            checkInDate,
            checkOutDate,
            Math.ceil(roomTypeCounts.DBL / 2) || '',
            Math.ceil(roomTypeCounts.TWN / 2) || '',
            roomTypeCounts.SNGL || '',
            'стандарт'
          ]);
          wsData.push(['']);

          // Rooming List Table
          wsData.push(['', '', 'ROOMING LISTE']);
          wsData.push(['']);
          wsData.push(['№', 'ФИО', 'Дата заезда', 'дата выезда', 'Категория номера', 'Дополнительная информация']);

          // Sort by placement: UZ first, then TM
          const sortedHotelTourists = [...hotelTourists].sort((a, b) => {
            const isATurkmen = isTurkmenistan(a);
            const isBTurkmen = isTurkmenistan(b);
            if (isATurkmen !== isBTurkmen) {
              return isATurkmen ? 1 : -1;
            }
            return 0;
          });

          sortedHotelTourists.forEach((t, idx) => {
            const name = t.fullName || `${t.lastName}, ${t.firstName}`;
            const checkIn = t.checkInDate ? formatDisplayDate(t.checkInDate) : checkInDate;
            const checkOut = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : checkOutDate;
            const roomCat = t.roomPreference || '-';
            const remarks = t.remarks && t.remarks !== '-' ? t.remarks : '';

            wsData.push([idx + 1, name, checkIn, checkOut, roomCat, remarks]);
          });

          wsData.push(['']);
          wsData.push(['']);
          wsData.push(['Оплату гости произведут на месте.']);
          wsData.push(['']);
          wsData.push(['']);
          wsData.push(['Директор ООО «ORIENT INSIGHT»', '', '', 'Одилова М.У.']);

          // Create worksheet
          const worksheet = XLSX.utils.aoa_to_sheet(wsData);
          worksheet['!cols'] = [
            { width: 6 },  // №
            { width: 30 }, // ФИО
            { width: 15 }, // Дата заезда
            { width: 15 }, // дата выезда
            { width: 16 }, // Категория номера
            { width: 40 }  // Дополнительная информация
          ];

          // Add sheet with hotel name (sanitize for Excel sheet name)
          const sheetName = hotelName.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '');
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });

        // If no hotels found, create single sheet with all tourists
        if (Object.keys(touristsByHotel).length === 0 || !tourists.some(t => t.hotelName)) {
          // Fallback: old format (rooming list without hotel grouping)
          const wsData = [
            ['ROOMING LIST'],
            [],
            ['No hotel assignments found. Please import rooming list with hotel data.'],
            [],
            ['№', 'Name', 'Room', 'Additional Information']
          ];

          // Sort by placement: UZ first, then TM
          const sortedTouristsForExcel = [...filteredTourists].sort((a, b) => {
            const isATurkmen = isTurkmenistan(a);
            const isBTurkmen = isTurkmenistan(b);
            if (isATurkmen !== isBTurkmen) {
              return isATurkmen ? 1 : -1;
            }
            return 0;
          });

          sortedTouristsForExcel.forEach((t, idx) => {
            const name = t.fullName || `${t.lastName}, ${t.firstName}`;
            wsData.push([idx + 1, name, t.roomPreference || '-', t.remarks || '-']);
          });

          const worksheet = XLSX.utils.aoa_to_sheet(wsData);
          worksheet['!cols'] = [{ width: 6 }, { width: 35 }, { width: 12 }, { width: 40 }];
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Rooming List');
        }

        const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `zayvka-${booking?.bookingNumber || 'export'}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        // Open server-generated PDF preview in new tab
        const previewUrl = `/api/bookings/${bookingId}/rooming-list-preview`;
        const printWindow = window.open(previewUrl, '_blank');
        if (!printWindow) {
          toast.error('Please allow popups to export PDF');
          return;
        }
        toast.success('PDF preview opened in new tab');
        return;

        // Get booking details
        const bookingNumber = booking?.bookingNumber || 'N/A';
        const tourType = booking?.tourType?.name || '';
        const country = 'Германия'; // Can be made dynamic
        const totalPax = filteredTourists.length;

        // Calculate arrival/departure dates from booking
        // ARRIVAL = TOUR START + 1 day
        const arrivalDate = booking?.departureDate ? (() => {
          const arrival = new Date(booking.departureDate);
          arrival.setDate(arrival.getDate() + 1);
          return formatDisplayDate(arrival);
        })() : '';
        const departureDate = booking?.endDate ? formatDisplayDate(booking.endDate) : '';

        // Calculate room counts
        const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
        filteredTourists.forEach(t => {
          const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
          const roomType = assignedRoomType || t.roomPreference;
          if (roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'DZ') roomCounts.DBL++;
          if (roomType === 'TWN' || roomType === 'TWIN') roomCounts.TWN++;
          if (roomType === 'SNGL' || roomType === 'SINGLE' || roomType === 'EZ') roomCounts.SNGL++;
        });

        // Convert to actual room counts (2 people = 1 DBL room)
        const dblRooms = Math.ceil(roomCounts.DBL / 2);
        const twnRooms = Math.ceil(roomCounts.TWN / 2);
        const snglRooms = roomCounts.SNGL;

        // Get hotel name from first tourist's assignment or use default
        const hotelName = filteredTourists[0]?.roomAssignments?.[0]?.bookingRoom?.hotel?.name ||
                         'Hotel Name';

        const currentDate = formatDisplayDate(new Date().toISOString());

        // Build tourist rows for ROOMING LISTE table - simple sequential list
        // Sort by placement: UZ first, then TM
        const sortedFilteredTourists = [...filteredTourists].sort((a, b) => {
          const isATurkmen = isTurkmenistan(a);
          const isBTurkmen = isTurkmenistan(b);
          if (isATurkmen !== isBTurkmen) {
            return isATurkmen ? 1 : -1;
          }
          return 0;
        });

        let touristRows = '';
        sortedFilteredTourists.forEach((t, idx) => {
          const name = t.fullName || `${t.lastName}, ${t.firstName}`;

          // Get room category - try different sources
          const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
          let roomCategory = assignedRoomType || t.roomPreference || '';

          // Normalize room category names
          if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
          if (roomCategory === 'TWIN') roomCategory = 'TWN';
          if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

          // Determine placement (Uzbekistan or Turkmenistan)
          const placement = t.accommodation || '';
          const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
          const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек');
          const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

          // Get remarks only from roomAssignments.notes (Rooming List tab)
          const remarksLines = [];
          if (t.checkInDate) {
            remarksLines.push(`Заезд: ${formatDisplayDate(t.checkInDate)}`);
          }
          const roomNotes = t.roomAssignments?.[0]?.notes || '';
          if (roomNotes) {
            remarksLines.push(roomNotes);
          }
          const remarks = remarksLines.filter(Boolean).join('\n');

          // Use custom dates if available, otherwise use booking dates
          const displayArrival = t.checkInDate ? formatDisplayDate(t.checkInDate) : arrivalDate;
          const displayDeparture = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : departureDate;

          // Extract flight date from remarks
          let displayFlightDate = booking?.departureDate ? formatDisplayDate(booking.departureDate) : '';
          if (t.remarks) {
            const flightMatch = t.remarks.match(/Flight:\s*(\d{2})\.(\d{2})/i);
            if (flightMatch) {
              const day = flightMatch[1];
              const month = flightMatch[2];
              const year = booking?.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
              displayFlightDate = `${day}.${month}.${year}`;
            }
          }

          // Yellow background if tourist has DIFFERENT dates from booking (early/late arrival)
          // CRITICAL: Compare tour start dates to check if tourist arrives before/after group
          let hasEarlyLateDates = false;
          if (t.checkInDate && booking?.departureDate) {
            const touristTourStart = new Date(t.checkInDate);
            const bookingTourStart = new Date(booking.departureDate);
            touristTourStart.setUTCHours(0, 0, 0, 0);
            bookingTourStart.setUTCHours(0, 0, 0, 0);
            hasEarlyLateDates = touristTourStart.getTime() !== bookingTourStart.getTime();
          }
          const rowBgColor = hasEarlyLateDates ? '#fffacd' : '';

          touristRows += `
            <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${idx + 1}</td>
              <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${displayFlightDate}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomCategory}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
              <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
            </tr>
          `;
        });

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>ЗАЯВКА - ${bookingNumber}</title>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 portrait; margin: 12mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 9pt;
                line-height: 1.2;
                color: #000;
              }
              .header-table {
                width: 100%;
                border: none;
                border-collapse: collapse;
                margin-bottom: 15px;
              }
              .header-table td {
                border: none;
                padding: 8px;
                font-size: 7.5pt;
              }
              .logo-cell {
                text-align: center;
                vertical-align: middle;
              }
              .company-name {
                font-size: 16pt;
                font-weight: bold;
                color: #d4842f;
                margin-top: 3px;
              }
              .company-subtitle {
                font-size: 7pt;
                color: #666;
              }
              .zayvka-title {
                text-align: center;
                font-size: 13pt;
                font-weight: bold;
                margin: 8px 0;
              }
              .intro-text {
                text-align: justify;
                margin: 6px 0;
                font-size: 9pt;
              }
              .summary-table {
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
              }
              .summary-table th,
              .summary-table td {
                border: 1px solid #000;
                padding: 3px;
                text-align: center;
                font-size: 8pt;
              }
              .summary-table th {
                background: #f0f0f0;
                font-weight: bold;
              }
              .rooming-title {
                text-align: center;
                font-size: 12pt;
                font-weight: bold;
                margin: 10px 0 6px 0;
              }
              .rooming-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
              }
              .rooming-table th,
              .rooming-table td {
                border: 1px solid #000;
                padding: 3px;
                font-size: 8pt;
              }
              .rooming-table th {
                background: #f0f0f0;
                font-weight: bold;
                text-align: center;
              }
              .footer-text {
                margin: 8px 0;
                font-size: 8.5pt;
              }
              .signature-table {
                width: 100%;
                margin-top: 15px;
              }
              .signature-table td {
                padding: 3px;
                font-size: 8.5pt;
              }
              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <!-- Header with company info -->
            <table class="header-table">
              <tr>
                <td class="logo-cell" style="width:100%;text-align:center">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Orient Insight" style="width:150px;height:auto;margin-bottom:8px" />` : '<div style="font-size:18pt;font-weight:bold;color:#D4842F;margin-bottom:8px">ORIENT INSIGHT</div>'}
                  <div style="font-size:9pt;margin-top:5px">
                    <strong>Республика Узбекистан,</strong><br>
                    г.Самарканд, Шота Руставели, дом 45<br>
                    Тел/fax.: +998 933484208, +998 97 9282814<br>
                    E-Mail: <a href="mailto:orientinsightreisen@gmail.com">orientinsightreisen@gmail.com</a><br>
                    Website: <a href="http://orient-insight.uz">orient-insight.uz</a>
                  </div>
                </td>
              </tr>
            </table>

            <!-- ЗАЯВКА Title -->
            <div class="zayvka-title">ЗАЯВКА</div>

            <!-- Introduction Text -->
            <div class="intro-text">
              ООО <strong>"ORIENT INSIGHT"</strong> приветствует Вас, и просит забронировать места с учетом нижеследующих деталей.
            </div>

            <!-- Summary Table -->
            <table class="summary-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Группа</th>
                  <th>Страна</th>
                  <th>PAX</th>
                  <th>Первый<br>заезд</th>
                  <th>Первый<br>выезд</th>
                  <th>DBL</th>
                  <th>TWN</th>
                  <th>SNGL</th>
                  <th>Тип номера</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>${bookingNumber}</td>
                  <td>${country}</td>
                  <td>${totalPax}</td>
                  <td>${arrivalDate}</td>
                  <td>${departureDate}</td>
                  <td>${dblRooms}</td>
                  <td>${twnRooms}</td>
                  <td>${snglRooms}</td>
                  <td>стандарт</td>
                </tr>
              </tbody>
            </table>

            <!-- ROOMING LISTE Title -->
            <div class="rooming-title">ROOMING LISTE</div>

            <!-- Rooming Table -->
            <table class="rooming-table">
              <thead>
                <tr>
                  <th style="width:30px">№</th>
                  <th style="width:25%">ФИО</th>
                  <th style="width:10%">Дата<br>вылета</th>
                  <th style="width:10%">Дата<br>заезда</th>
                  <th style="width:10%">Дата<br>выезда</th>
                  <th style="width:8%">Категория<br>номера</th>
                  <th style="width:7%">Размещение</th>
                  <th>Дополнительная<br>информация</th>
                </tr>
              </thead>
              <tbody>
                ${touristRows}
              </tbody>
            </table>

            <!-- Footer Text -->
            <div class="footer-text">
              <p style="margin-bottom:10px">Оплату гости произведут на месте.</p>
            </div>

            <!-- Signature -->
            <table class="signature-table">
              <tr>
                <td style="width:60%"><strong>Директор ООО «ORIENT INSIGHT»</strong></td>
                <td style="width:20%;border-bottom:1px solid #000;text-align:center"></td>
                <td style="width:20%;text-align:center"><strong>Одилова М.У.</strong></td>
              </tr>
            </table>

            <!-- Print Button -->
            <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
              <button onclick="window.print()" style="padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
                🖨️ Print / Save as PDF
              </button>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      toast.error('Export error');
    }
  };

  // Export PDF for a specific hotel
  const handleHotelPdfExport = async (hotelName, hotelTourists) => {
    try {
      console.log('🚀 Starting PDF export for hotel:', hotelName);
      console.log('📊 Tourist count:', hotelTourists.length);

      // Find accommodation ID for this hotel
      const accommodation = accommodations?.find(acc => acc.hotel?.name === hotelName);
      if (!accommodation) {
        toast.error('Accommodation not found for this hotel');
        return;
      }

      // Open server-generated PDF preview in new tab
      const previewUrl = `/api/bookings/${bookingId}/hotel-request-preview/${accommodation.id}`;
      const printWindow = window.open(previewUrl, '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to export PDF');
        return;
      }
      toast.success('PDF preview opened in new tab');
      return;

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
        console.log('✅ Logo loaded successfully');
      } catch (error) {
        console.warn('⚠️ Could not load logo:', error);
      }

      // Get booking details
      const bookingNumber = booking?.bookingNumber || 'N/A';
      const tourType = booking?.tourType?.name || '';
      const country = 'Германия';
      const totalPax = hotelTourists.length;

      // Calculate arrival/departure dates from booking
      // ARRIVAL = TOUR START + 1 day
      const arrivalDate = booking?.departureDate ? (() => {
        const arrival = new Date(booking.departureDate);
        arrival.setDate(arrival.getDate() + 1);
        return formatDisplayDate(arrival);
      })() : '';
      const departureDate = booking?.endDate ? formatDisplayDate(booking.endDate) : '';

      // Calculate room counts
      const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
      hotelTourists.forEach(t => {
        const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
        const roomType = assignedRoomType || t.roomPreference;
        if (roomType === 'DBL' || roomType === 'DOUBLE' || roomType === 'DZ') roomCounts.DBL++;
        if (roomType === 'TWN' || roomType === 'TWIN') roomCounts.TWN++;
        if (roomType === 'SNGL' || roomType === 'SINGLE' || roomType === 'EZ') roomCounts.SNGL++;
      });

      // Convert to actual room counts (2 people = 1 DBL room)
      const dblRooms = Math.ceil(roomCounts.DBL / 2);
      const twnRooms = Math.ceil(roomCounts.TWN / 2);
      const snglRooms = roomCounts.SNGL;

      const currentDate = formatDisplayDate(new Date().toISOString());

      // Build tourist rows for ROOMING LISTE table
      // Group tourists by room number for TWN and DBL
      const roomGroups = {};
      const singleTourists = [];

      hotelTourists.forEach(tourist => {
        // Get room category
        const assignedRoomType = tourist.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
        let roomCategory = assignedRoomType || tourist.roomPreference || '';

        // Normalize room category names
        if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
        if (roomCategory === 'TWIN') roomCategory = 'TWN';
        if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

        if (tourist.roomNumber && (roomCategory === 'DBL' || roomCategory === 'TWN')) {
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

      let touristRows = '';
      let counter = 0;

      // Render entries in sorted order
      allEntries.forEach(entry => {
        if (entry.type === 'group') {
          // Render paired tourists (DBL and TWN)
          const group = entry.tourists;
          group.forEach((t, groupIndex) => {
            counter++;
            const isFirstInGroup = groupIndex === 0;
            const name = t.fullName || `${t.lastName}, ${t.firstName}`;

            // Get room category
            const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
            let roomCategory = assignedRoomType || t.roomPreference || '';

            // Normalize room category names
            if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
            if (roomCategory === 'TWIN') roomCategory = 'TWN';
            if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

            // Determine placement (Uzbekistan or Turkmenistan)
            const placement = t.accommodation || '';
            const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
            const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек');
            const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

            // Get notes from roomAssignments (Rooming List tab's Примечание column)
            const remarks = t.roomAssignments?.[0]?.notes || '';

            // Use custom dates if available, otherwise use booking dates
            const displayArrival = t.checkInDate ? formatDisplayDate(t.checkInDate) : arrivalDate;
            const displayDeparture = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : departureDate;

            // Extract flight date from remarks
            let displayFlightDate = booking?.departureDate ? formatDisplayDate(booking.departureDate) : '';
            if (t.remarks) {
              const flightMatch = t.remarks.match(/Flight:\s*(\d{2})\.(\d{2})/i);
              if (flightMatch) {
                const day = flightMatch[1];
                const month = flightMatch[2];
                const year = booking?.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
                displayFlightDate = `${day}.${month}.${year}`;
              }
            }

            // Yellow background if has custom dates
            const rowBgColor = (t.checkInDate || t.checkOutDate) ? '#fffacd' : '';

            touristRows += `
              <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
                <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
                <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
                <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${displayFlightDate}</td>
                <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
                <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
                ${isFirstInGroup ? `<td rowspan="${group.length}" style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;vertical-align:middle;">${roomCategory}</td>` : ''}
                <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
                <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
              </tr>
            `;
          });
        } else if (entry.type === 'single') {
          // Render single tourist (SNGL)
          const t = entry.tourist;
          counter++;

          const name = t.fullName || `${t.lastName}, ${t.firstName}`;

          // Get room category
          const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
          let roomCategory = assignedRoomType || t.roomPreference || '';

          // Normalize room category names
          if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
          if (roomCategory === 'TWIN') roomCategory = 'TWN';
          if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

          // Determine placement (Uzbekistan or Turkmenistan)
          const placement = t.accommodation || '';
          const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
          const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек');
          const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

          // Get notes from roomAssignments (Rooming List tab's Примечание column)
          const remarks = t.roomAssignments?.[0]?.notes || '';

          // Use custom dates if available, otherwise use booking dates
          const displayArrival = t.checkInDate ? formatDisplayDate(t.checkInDate) : arrivalDate;
          const displayDeparture = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : departureDate;

          // Extract flight date from remarks
          let displayFlightDate = booking?.departureDate ? formatDisplayDate(booking.departureDate) : '';
          if (t.remarks) {
            const flightMatch = t.remarks.match(/Flight:\s*(\d{2})\.(\d{2})/i);
            if (flightMatch) {
              const day = flightMatch[1];
              const month = flightMatch[2];
              const year = booking?.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
              displayFlightDate = `${day}.${month}.${year}`;
            }
          }

          // Yellow background if tourist has DIFFERENT dates from booking (early/late arrival)
          // CRITICAL: Compare tour start dates to check if tourist arrives before/after group
          let hasEarlyLateDates = false;
          if (t.checkInDate && booking?.departureDate) {
            const touristTourStart = new Date(t.checkInDate);
            const bookingTourStart = new Date(booking.departureDate);
            touristTourStart.setUTCHours(0, 0, 0, 0);
            bookingTourStart.setUTCHours(0, 0, 0, 0);
            hasEarlyLateDates = touristTourStart.getTime() !== bookingTourStart.getTime();
          }
          const rowBgColor = hasEarlyLateDates ? '#fffacd' : '';

          touristRows += `
            <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
              <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${displayFlightDate}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomCategory}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
              <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
            </tr>
          `;
        }
      });

      // Create a temporary container for the PDF content
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '210mm'; // A4 width

      tempDiv.innerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 9pt;
              line-height: 1.2;
              color: #000;
              padding: 12mm;
            }
            .header-table {
              width: 100%;
              border: none;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .header-table td {
              border: none;
              padding: 8px;
              font-size: 7.5pt;
            }
            .logo-cell {
              text-align: center;
              vertical-align: middle;
            }
            .zayvka-title {
              text-align: center;
              font-size: 13pt;
              font-weight: bold;
              margin: 8px 0;
            }
            .intro-text {
              text-align: justify;
              margin: 6px 0;
              font-size: 9pt;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            .summary-table th,
            .summary-table td {
              border: 1px solid #000;
              padding: 3px;
              text-align: center;
              font-size: 8pt;
            }
            .summary-table th {
              background: #f0f0f0;
              font-weight: bold;
            }
            .rooming-title {
              text-align: center;
              font-size: 12pt;
              font-weight: bold;
              margin: 10px 0 6px 0;
            }
            .rooming-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
            }
            .rooming-table th,
            .rooming-table td {
              border: 1px solid #000;
              padding: 3px;
              font-size: 8pt;
            }
            .rooming-table th {
              background: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            .footer-text {
              margin: 8px 0;
              font-size: 8.5pt;
            }
            .signature-table {
              width: 100%;
              margin-top: 15px;
            }
            .signature-table td {
              padding: 3px;
              font-size: 8.5pt;
            }
          </style>
        </head>
        <body>
          <!-- Header with company info -->
          <table class="header-table">
            <tr>
              <td class="logo-cell" style="width:100%;text-align:center">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Orient Insight" style="width:150px;height:auto;margin-bottom:8px" />` : '<div style="font-size:18pt;font-weight:bold;color:#D4842F;margin-bottom:8px">ORIENT INSIGHT</div>'}
                <div style="font-size:9pt;margin-top:5px">
                  <strong>Республика Узбекистан,</strong><br>
                  г.Самарканд, Шота Руставели, дом 45<br>
                  Тел/fax.: +998 933484208, +998 97 9282814<br>
                  E-Mail: orientinsightreisen@gmail.com<br>
                  Website: orient-insight.uz
                </div>
              </td>
            </tr>
          </table>

          <div style="text-align:right;margin-bottom:10px;font-size:9pt">
            <strong>Директору гостиницы</strong><br>
            <strong style="font-size:11pt">${hotelName}</strong>
          </div>

          <!-- ЗАЯВКА Title -->
          <div class="zayvka-title">ЗАЯВКА</div>

          <!-- Introduction Text -->
          <div class="intro-text">
            ООО <strong>"ORIENT INSIGHT"</strong> приветствует Вас, и просит забронировать места с учетом нижеследующих деталей.
          </div>

          <!-- Summary Table -->
          <table class="summary-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Группа</th>
                <th>Страна</th>
                <th>PAX</th>
                <th>Первый<br>заезд</th>
                <th>Первый<br>выезд</th>
                <th>DBL</th>
                <th>TWN</th>
                <th>SNGL</th>
                <th>Тип номера</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>${bookingNumber}</td>
                <td>${country}</td>
                <td>${totalPax}</td>
                <td>${arrivalDate}</td>
                <td>${departureDate}</td>
                <td>${dblRooms}</td>
                <td>${twnRooms}</td>
                <td>${snglRooms}</td>
                <td>стандарт</td>
              </tr>
            </tbody>
          </table>

          <!-- ROOMING LISTE Title -->
          <div class="rooming-title">ROOMING LISTE</div>

          <!-- Rooming Table -->
          <table class="rooming-table">
            <thead>
              <tr>
                <th style="width:30px">№</th>
                <th style="width:25%">ФИО</th>
                <th style="width:10%">Дата<br>вылета</th>
                <th style="width:10%">Дата<br>заезда</th>
                <th style="width:10%">Дата<br>выезда</th>
                <th style="width:8%">Категория<br>номера</th>
                <th style="width:7%">Размещение</th>
                <th>Дополнительная<br>информация</th>
              </tr>
            </thead>
            <tbody>
              ${touristRows}
            </tbody>
          </table>

          <!-- Footer Text -->
          <div class="footer-text">
            <p style="margin-bottom:10px">Оплату гости произведут на месте.</p>
          </div>

          <!-- Signature -->
          <table class="signature-table">
            <tr>
              <td style="width:60%"><strong>Директор ООО «ORIENT INSIGHT»</strong></td>
              <td style="width:20%;border-bottom:1px solid #000;text-align:center"></td>
              <td style="width:20%;text-align:center"><strong>Одилова М.У.</strong></td>
            </tr>
          </table>
        </body>
        </html>
      `;

      document.body.appendChild(tempDiv);
      console.log('📝 Temporary div created and added to DOM');

      // Configure pdf options
      const opt = {
        margin: 0,
        filename: `ZAYVKA-${bookingNumber}-${hotelName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      console.log('⚙️ PDF options configured:', opt);
      console.log('🔄 Starting PDF generation...');

      // Generate and download PDF
      await html2pdf().set(opt).from(tempDiv).save();

      console.log('✅ PDF generation complete');

      // Remove temporary div
      document.body.removeChild(tempDiv);
      console.log('🧹 Temporary div removed');

      toast.success('PDF downloaded successfully!', { id: 'pdf-gen' });
    } catch (error) {
      console.error('❌ PDF Export error:', error);
      console.error('Error stack:', error.stack);
      toast.error('Error exporting PDF: ' + error.message, { id: 'pdf-gen' });
    }
  };

  const roomOptions = ['DBL', 'TWN', 'SNGL', 'TRPL', 'Suite'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-white p-4 rounded-xl border border-primary-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Users className="w-6 h-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Rooming List</h3>

            {/* Enhanced Summary Statistics Panel */}
            <div className="flex items-stretch gap-4 flex-wrap">
              {/* Total Guests Card */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <div className="text-xs font-medium text-primary-700 uppercase tracking-wide">Total</div>
                  <div className="text-2xl font-bold text-gray-900">{filteredTourists.length}</div>
                  <div className="text-xs text-gray-600">{filteredTourists.length === 1 ? 'guest' : 'guests'}</div>
                </div>
              </div>

              {/* Room Type Breakdown Cards */}
              {(() => {
                const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };
                const touristsWithoutRoom = { DBL: 0, TWN: 0, SNGL: 0 };

                // IMPORTANT: Use filteredTourists (only those with room numbers)
                filteredTourists.forEach(t => {
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

                const roomTypes = [
                  { key: 'DBL', label: 'Double', count: roomCounts.DBL, gradient: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500', icon: '👫' },
                  { key: 'TWN', label: 'Twin', count: roomCounts.TWN, gradient: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-500', icon: '🛏️' },
                  { key: 'SNGL', label: 'Single', count: roomCounts.SNGL, gradient: 'from-violet-50 to-violet-100', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-500', icon: '👤' }
                ];

                return roomTypes.map(room => {
                  if (room.count === 0) return null;

                  return (
                    <div key={room.key} className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-br ${room.gradient} border-2 ${room.border} rounded-xl shadow-sm hover:shadow-md transition-all`}>
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm`}>
                        <span className="text-2xl">{room.icon}</span>
                      </div>
                      <div>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${room.badge} text-white text-xs font-bold uppercase tracking-wider mb-1`}>
                          {room.key}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{room.count}</div>
                        <div className="text-xs text-gray-600">{room.count === 1 ? 'room' : 'rooms'}</div>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Uzbekistan/Turkmenistan Split Card */}
              {(() => {
                const uzbekCount = uzbekistanTourists.length;
                const turkmCount = turkmenistanTourists.length;

                if (uzbekCount > 0 && turkmCount > 0) {
                  return (
                    <div className="flex items-center gap-4 px-4 py-3 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl shadow-sm">
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
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={openAddTouristModal}
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 text-base font-semibold shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
          {tourists.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 text-base font-semibold text-gray-700 shadow-sm transition-all"
              >
                <Download className="w-5 h-5 text-gray-500" />
                Export
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">Excel</div>
                        <div className="text-xs text-gray-400">.xlsx format</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">PDF</div>
                        <div className="text-xs text-gray-400">Print ready</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <label className="inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 cursor-pointer text-base font-semibold shadow-lg shadow-primary-200 transition-all">
            <Upload className="w-5 h-5" />
            {importing ? 'Importing...' : 'Import PDF'}
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfImport}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hotel-Grouped Tourist List */}
      {filteredTourists.length > 0 ? (
        <div className="space-y-8">
          {(() => {
            let globalTouristIndex = 0; // Global counter for all tourists across all hotels
            return Object.entries(touristsByHotel).map(([hotelName, hotelTourists]) => (
            <div key={hotelName} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">No</div>
                  <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Name</div>
                  <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Tour Start</div>
                  <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Arrival</div>
                  <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Tour End</div>
                  <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Room Type</div>
                  <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Placement</div>
                  <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Additional Information</div>
                  <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">Actions</div>
                </div>
              </div>

              {/* Tourist Cards for this hotel */}
              <div className="px-6 py-4 space-y-2">
                {(() => {
                  const renderedIds = new Set();
                  const cards = [];

                  // Sort hotel tourists: Uzbekistan first, then Turkmenistan
                  const sortedHotelTourists = [...hotelTourists].sort((a, b) => {
                    // First: Sort by country (Uzbekistan before Turkmenistan)
                    const isATurkmen = isTurkmenistan(a);
                    const isBTurkmen = isTurkmenistan(b);

                    if (isATurkmen !== isBTurkmen) {
                      return isATurkmen ? 1 : -1; // Uzbekistan (false) first, Turkmenistan (true) last
                    }

                    // Second: Sort by room number
                    const roomA = a.roomNumber || '';
                    const roomB = b.roomNumber || '';
                    if (roomA !== roomB) return roomA.localeCompare(roomB);

                    // Third: Sort by last name
                    return (a.lastName || '').localeCompare(b.lastName || '');
                  });

                  sortedHotelTourists.forEach((tourist, index) => {
              // Skip if already rendered as part of a pair
              if (renderedIds.has(tourist.id)) return;

              const roomType = (tourist.roomPreference || '').toUpperCase();
              const isDBL = roomType === 'DBL' || roomType === 'DOUBLE';
              const isTWN = roomType === 'TWN' || roomType === 'TWIN';
              const isSNGL = roomType === 'SNGL' || roomType === 'SINGLE';

              const roomBadgeColor = isDBL
                ? 'bg-blue-500 text-white'
                : isTWN
                ? 'bg-green-500 text-white'
                : isSNGL
                ? 'bg-purple-500 text-white'
                : 'bg-gray-400 text-white';

              const placement = tourist.accommodation || '';

              // Check if this is part of a room pair (TWN/DBL)
              const isRoomPair = (isTWN || isDBL) && tourist.roomNumber;

              // Find roommate
              const roommate = isRoomPair ? sortedHotelTourists.find(t =>
                t.roomNumber === tourist.roomNumber && t.id !== tourist.id
              ) : null;

              // Visual grouping for room pairs
              let roomPairClasses = 'border-gray-200';
              if (roommate) {
                const roomPairIndex = parseInt(tourist.roomNumber?.match(/\d+/)?.[0] || 0);
                const borderColor = roomPairIndex % 2 === 0 ? 'border-blue-500' : 'border-green-500';
                const bgColor = roomPairIndex % 2 === 0 ? 'bg-blue-50/50' : 'bg-green-50/50';
                roomPairClasses = `${borderColor} ${bgColor}`;

                // Mark roommate as rendered
                renderedIds.add(roommate.id);
              }

              // Mark current tourist as rendered
              renderedIds.add(tourist.id);

              // Render function for a single tourist row
              const renderTouristRow = (t, idx) => {
                const tPlacement = t.accommodation || '';

                // Check if this is the first hotel - only show custom dates for first hotel
                const isFirstHotel = hotelName === firstAccommodationHotel;

                // Check if tourist has DIFFERENT dates from booking (early/late arrival)
                // CRITICAL: Compare tour start dates, not arrival dates
                // Tourist arrives 1 day after their tour start date
                let hasEarlyLateArrival = false;
                if (isFirstHotel && t.checkInDate && booking?.departureDate) {
                  const touristTourStart = new Date(t.checkInDate);
                  const bookingTourStart = new Date(booking.departureDate);
                  // Normalize to UTC midnight to avoid timezone issues
                  touristTourStart.setUTCHours(0, 0, 0, 0);
                  bookingTourStart.setUTCHours(0, 0, 0, 0);
                  hasEarlyLateArrival = touristTourStart.getTime() !== bookingTourStart.getTime();
                }

                // Check if tourist has custom dates (for backwards compatibility)
                const hasCustomDates = isFirstHotel && (t.checkInDate || t.checkOutDate);
                const customCheckIn = isFirstHotel && t.checkInDate ? formatDisplayDate(t.checkInDate) : null;
                const customCheckOut = isFirstHotel && t.checkOutDate ? formatDisplayDate(t.checkOutDate) : null;

                // Extract flight date and arrival date from remarks: "Flight: 09.10, Arrival: 10.10"
                // Show for ALL hotels (flight/arrival info is about when tourist arrives in country)
                let flightDate = null;
                let displayFlightDate = null;
                let displayArrivalDate = null;

                // Check remarks for flight/arrival dates
                if (t.remarks) {
                  // Extract Flight date (departure from home country)
                  const flightMatch = t.remarks.match(/Flight[:\s]*(\d{2})\.(\d{2})/i);
                  if (flightMatch) {
                    const day = flightMatch[1];
                    const month = flightMatch[2];
                    const year = booking?.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
                    displayFlightDate = `${day}.${month}.${year}`;
                    flightDate = true;
                  }

                  // Extract Arrival date (arrival in Uzbekistan)
                  const arrivalMatch = t.remarks.match(/Arrival[:\s]*(\d{2})\.(\d{2})/i);
                  if (arrivalMatch) {
                    const day = arrivalMatch[1];
                    const month = arrivalMatch[2];
                    const year = booking?.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
                    displayArrivalDate = `${day}.${month}.${year}`;
                  }

                  // Also check for "Early arrival" pattern
                  if (!displayArrivalDate) {
                    const earlyArrivalMatch = t.remarks.match(/Early arrival[:\s]*(\d{2})\.(\d{2})/i);
                    if (earlyArrivalMatch) {
                      const day = earlyArrivalMatch[1];
                      const month = earlyArrivalMatch[2];
                      const year = booking?.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
                      displayArrivalDate = `${day}.${month}.${year}`;
                    }
                  }
                }

                // Use extracted dates, then custom dates from database, then booking dates as fallback
                // IMPORTANT: ARRIVAL is ALWAYS Tour Start + 1 day (departureDate + 1)
                const arrivalDateFallback = booking?.departureDate ? (() => {
                  const arrivalDate = new Date(booking.departureDate);
                  arrivalDate.setDate(arrivalDate.getDate() + 1); // ARRIVAL = TOUR START + 1 day
                  return formatDisplayDate(arrivalDate);
                })() : '-';

                const displayCheckIn = displayArrivalDate || customCheckIn || arrivalDateFallback;
                const displayCheckOut = customCheckOut || (booking?.endDate ? formatDisplayDate(booking.endDate) : '-');
                const displayTourStart = displayFlightDate || (booking?.departureDate ? formatDisplayDate(booking.departureDate) : '-');

                // Yellow background if tourist has custom/different dates
                // CRITICAL: Include hasEarlyLateArrival to highlight tourists arriving before/after group
                const hasSpecialDates = displayArrivalDate || displayFlightDate || hasCustomDates || hasEarlyLateArrival;
                const rowBgClass = hasSpecialDates ? 'bg-yellow-50 border-2 border-yellow-300' : '';

                // Debug logging for Baetgen
                if (t.fullName?.includes('Baetgen') || t.lastName?.includes('Baetgen')) {
                  console.log('🔍 Baetgen RoomingListModule highlight:', {
                    name: t.fullName,
                    hotel: hotelName,
                    isFirstHotel,
                    touristCheckIn: t.checkInDate,
                    bookingDeparture: booking?.departureDate,
                    hasEarlyLateArrival,
                    displayArrivalDate,
                    displayFlightDate,
                    hasCustomDates,
                    hasSpecialDates,
                    rowBgClass
                  });
                }

                return (
                  <div key={t.id} className={`grid grid-cols-12 gap-4 items-center rounded-xl p-2 ${rowBgClass}`}>
                    {/* Number */}
                    <div className="col-span-1">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm">
                        <span className="text-base font-bold text-gray-700">{idx + 1}</span>
                      </div>
                    </div>

                    {/* Name */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <User className="w-6 h-6 text-blue-700" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-base leading-tight">
                            {t.fullName || `${t.lastName}, ${t.firstName}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tour Start (Начало тура from Information module) */}
                    <div className="col-span-1">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${flightDate ? 'bg-yellow-100 border border-yellow-400' : 'bg-blue-50 border border-blue-200'}`}>
                        <span className={`text-xs font-medium ${flightDate ? 'text-yellow-900' : 'text-blue-600'}`}>
                          {displayTourStart}
                        </span>
                      </div>
                    </div>

                    {/* Arrival (Прибытие from Information module) */}
                    <div className="col-span-2">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${displayArrivalDate || customCheckIn ? 'bg-yellow-100 border border-yellow-400' : 'bg-green-50 border border-green-200'}`}>
                        <span className={`text-xs font-medium ${displayArrivalDate || customCheckIn ? 'text-yellow-900' : 'text-green-600'}`}>
                          {displayCheckIn}
                        </span>
                      </div>
                    </div>

                    {/* Tour End (Окончание тура from Information module) */}
                    <div className="col-span-1">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                        <span className="text-xs font-medium text-red-600">
                          {displayCheckOut}
                        </span>
                      </div>
                    </div>

                    {/* Room Type */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm ${roomBadgeColor}`}>
                        {t.roomPreference || '-'}
                      </span>
                    </div>

                    {/* Placement */}
                    <div className="col-span-1">
                      {tPlacement.toLowerCase().includes('turkmen') || tPlacement.toLowerCase().includes('туркмен') ? (
                        <span className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-200 w-full">
                          Turkmenistan
                        </span>
                      ) : tPlacement.toLowerCase().includes('uzbek') || tPlacement.toLowerCase().includes('узбек') ? (
                        <span className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-200 w-full">
                          Uzbekistan
                        </span>
                      ) : (
                        <span className="text-gray-400 text-center">-</span>
                      )}
                    </div>

                    {/* Additional Information / Примечание */}
                    <div className="col-span-2">
                      {editingRemarksId === t.id ? (
                        // Edit mode - show textarea with quick select options
                        <div className="space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            {/* Quick select buttons for common phrases */}
                            {[
                              'Ранний заезд',
                              'Поздний выезд',
                              'Ранний заезд, поздний выезд',
                              'Vegetarian',
                              'Birthday',
                              'Extra nights',
                              'VIP'
                            ].map(phrase => (
                              <button
                                key={phrase}
                                onClick={() => {
                                  const current = remarksValue ? remarksValue + '\n' + phrase : phrase;
                                  setRemarksValue(current);
                                }}
                                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                              >
                                {phrase}
                              </button>
                            ))}
                            {/* Button to insert current date */}
                            <button
                              onClick={() => {
                                const today = new Date();
                                const dateStr = formatDisplayDate(today.toISOString());
                                const current = remarksValue ? remarksValue + ' ' + dateStr : dateStr;
                                setRemarksValue(current);
                              }}
                              className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                              title="Вставить сегодняшнюю дату"
                            >
                              📅 Сегодня
                            </button>
                            {/* Date picker for custom date */}
                            <input
                              type="date"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const dateStr = formatDisplayDate(e.target.value);
                                  const current = remarksValue ? remarksValue + ' ' + dateStr : dateStr;
                                  setRemarksValue(current);
                                  e.target.value = ''; // Reset after selection
                                }
                              }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-lg hover:border-blue-400 transition-colors"
                              title="Выбрать дату"
                            />
                          </div>
                          <textarea
                            value={remarksValue}
                            onChange={(e) => setRemarksValue(e.target.value)}
                            onBlur={() => saveRemarks(t.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.ctrlKey) {
                                saveRemarks(t.id);
                              }
                              if (e.key === 'Escape') {
                                setEditingRemarksId(null);
                              }
                            }}
                            className="w-full px-3 py-2 text-xs border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows="3"
                            placeholder="Добавить примечание... (Ctrl+Enter для сохранения, Esc для отмены)"
                            autoFocus
                          />
                        </div>
                      ) : (
                        // View mode - show remarks with click to edit
                        <div
                          onClick={() => startEditRemarks(t)}
                          className="cursor-pointer hover:bg-blue-50 rounded-xl px-3 py-2 transition-colors group"
                          title="Нажмите, чтобы редактировать"
                        >
                          {(() => {
                            // Show important information from remarks (Vegetarian, Birthday, Flight/Arrival)
                            const remarksLines = [];

                            // Get remarks from tourist (contains Vegetarian, Birthday, Flight info from PDF import)
                            const remarks = t.remarks || '';
                            if (remarks && remarks !== '-') {
                              // Split by newline and filter important info only
                              const lines = remarks.split('\n').filter(line => {
                                const lower = line.toLowerCase();
                                // Include only important information
                                return lower.includes('vegetarian') ||
                                       lower.includes('birthday') ||
                                       lower.includes('flight') ||
                                       lower.includes('arrival') ||
                                       lower.includes('заезд') ||
                                       lower.includes('выезд') ||
                                       lower.includes('ранний') ||
                                       lower.includes('поздний') ||
                                       lower.includes('book extra nights');
                              });
                              remarksLines.push(...lines);
                            }

                            return remarksLines.length > 0 ? (
                              <div className="text-gray-700 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl px-4 py-3 shadow-sm">
                                {remarksLines.map((line, i) => (
                                  <div key={i} className="text-xs leading-relaxed font-medium">{line}</div>
                                ))}
                                <div className="mt-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit className="w-3 h-3 inline mr-1" />
                                  Нажмите для редактирования
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span>-</span>
                                <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit className="w-3 h-3 inline mr-1" />
                                  Добавить
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(t)}
                          className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-xl transition-all hover:scale-110 shadow-sm hover:shadow-md"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Delete this tourist?')) {
                              try {
                                await touristsApi.delete(bookingId, t.id);
                                toast.success('Deleted');
                                loadData();
                                onUpdate?.();
                              } catch (error) {
                                toast.error('Error deleting');
                              }
                            }
                          }}
                          className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-all hover:scale-110 shadow-sm hover:shadow-md"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              };

              const currentIndex = globalTouristIndex;
              globalTouristIndex++; // Increment for the first tourist
              const roommateIndex = roommate ? globalTouristIndex++ : null; // Increment for roommate if exists

              cards.push(

                <div
                  key={`card-${tourist.id}`}
                  className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 shadow-md hover:shadow-xl hover:scale-[1.01] transition-all duration-300 p-6 ${roomPairClasses}`}
                >
                  {roommate ? (
                    // Room pair - 2 tourists in one card
                    <div className="space-y-4">
                      {renderTouristRow(tourist, currentIndex)}
                      <div className="border-t-2 border-dashed border-gray-300 pt-4">
                        {renderTouristRow(roommate, roommateIndex)}
                      </div>
                    </div>
                  ) : (
                    // Single tourist
                    renderTouristRow(tourist, currentIndex)
                  )}
                </div>
              );
            });

            return cards;
          })()}
              </div>
            </div>
          ));
          })()}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-gray-400" />
          </div>
          <h4 className="text-xl font-semibold text-gray-800 mb-2">No Rooming List Data</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Import a Final Rooming List PDF to populate this section with tourist information
          </p>
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 cursor-pointer shadow-lg shadow-primary-200 transition-all font-medium">
            <Upload className="w-5 h-5" />
            Import Rooming List PDF
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfImport}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
      )}

      {/* Edit Room/Remarks Modal */}
      {modalOpen && editingTourist && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Edit Tourist Details</h2>
                    <p className="text-sm text-white/70">Dates, room & placement</p>
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Guest Name</label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-medium">
                  {editingTourist.fullName || `${editingTourist.lastName}, ${editingTourist.firstName}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Arrival Date
                    <span className="ml-1 text-xs text-gray-400 normal-case">(custom)</span>
                  </label>
                  <input
                    type="date"
                    value={form.checkInDate}
                    onChange={(e) => setForm({ ...form, checkInDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    placeholder="Leave empty for default"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to use booking arrival date</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Tour End Date
                    <span className="ml-1 text-xs text-gray-400 normal-case">(custom)</span>
                  </label>
                  <input
                    type="date"
                    value={form.checkOutDate}
                    onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    placeholder="Leave empty for default"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to use booking end date</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Placement</label>
                <select
                  value={form.accommodation}
                  onChange={(e) => setForm({ ...form, accommodation: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  <option value="Uzbekistan">Uzbekistan</option>
                  <option value="Turkmenistan">Turkmenistan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Room Type</label>
                <select
                  value={form.roomPreference}
                  onChange={(e) => {
                    console.log('Room preference changed:', e.target.value);
                    setForm({ ...form, roomPreference: e.target.value });
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  <option value="">Not specified</option>
                  {roomOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Additional Information</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => {
                    console.log('Remarks changed:', e.target.value);
                    setForm({ ...form, remarks: e.target.value });
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRoomAndRemarks}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 font-medium shadow-md transition-all"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tourist Modal */}
      {addTouristModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Add New Tourist</h2>
                    <p className="text-sm text-white/70">Enter tourist information</p>
                  </div>
                </div>
                <button onClick={() => setAddTouristModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTouristForm.firstName}
                    onChange={(e) => setNewTouristForm({ ...newTouristForm, firstName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., Peter"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTouristForm.lastName}
                    onChange={(e) => setNewTouristForm({ ...newTouristForm, lastName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., Schmidt"
                  />
                </div>
              </div>

              {/* Full Name (optional) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Full Name (optional)
                </label>
                <input
                  type="text"
                  value={newTouristForm.fullName}
                  onChange={(e) => setNewTouristForm({ ...newTouristForm, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Leave empty to auto-generate: Last, First"
                />
              </div>

              {/* Gender and Room Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gender</label>
                  <select
                    value={newTouristForm.gender}
                    onChange={(e) => setNewTouristForm({ ...newTouristForm, gender: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Room Type</label>
                  <select
                    value={newTouristForm.roomPreference}
                    onChange={(e) => setNewTouristForm({ ...newTouristForm, roomPreference: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    {roomOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Accommodation and Country */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Placement</label>
                  <select
                    value={newTouristForm.accommodation}
                    onChange={(e) => setNewTouristForm({ ...newTouristForm, accommodation: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="Uzbekistan">Uzbekistan</option>
                    <option value="Turkmenistan">Turkmenistan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Country</label>
                  <input
                    type="text"
                    value={newTouristForm.country}
                    onChange={(e) => setNewTouristForm({ ...newTouristForm, country: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., Germany"
                  />
                </div>
              </div>

              {/* Passport Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passport Number</label>
                <input
                  type="text"
                  value={newTouristForm.passportNumber}
                  onChange={(e) => setNewTouristForm({ ...newTouristForm, passportNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., C01X00T47"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Additional Information</label>
                <textarea
                  value={newTouristForm.remarks}
                  onChange={(e) => setNewTouristForm({ ...newTouristForm, remarks: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={3}
                  placeholder="Vegetarian, Birthday, etc..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setAddTouristModalOpen(false)}
                className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNewTourist}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 font-medium shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Tourist
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
