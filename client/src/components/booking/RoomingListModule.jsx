import { useState, useEffect } from 'react';
import { touristsApi, bookingsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Edit, Upload, Users, User, FileText,
  X, Save, Search, Download, ChevronDown, Check, Plus, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function RoomingListModule({ bookingId, onUpdate }) {
  const [tourists, setTourists] = useState([]);
  const [booking, setBooking] = useState(null); // Booking details for ЗАЯВКА header
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Import state
  const [importing, setImporting] = useState(false);

  // Modal state for editing room/remarks
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTourist, setEditingTourist] = useState(null);
  const [form, setForm] = useState({
    roomPreference: '',
    remarks: ''
  });

  // Inline edit states
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRemarksId, setEditingRemarksId] = useState(null);
  const [roomValue, setRoomValue] = useState('');
  const [remarksValue, setRemarksValue] = useState('');

  // Export dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [touristsRes, bookingRes] = await Promise.all([
        touristsApi.getAll(bookingId),
        bookingsApi.getById(bookingId)
      ]);
      console.log('🔍 Booking Response:', bookingRes);
      console.log('🔍 Booking Object:', bookingRes?.data?.booking);
      console.log('🔍 Departure Date:', bookingRes?.data?.booking?.departureDate);
      console.log('🔍 End Date:', bookingRes?.data?.booking?.endDate);
      console.log('🔍 Tourists:', touristsRes.data.tourists);
      // Log remarks for debugging
      touristsRes.data.tourists?.forEach(t => {
        if (t.remarks && t.remarks !== '-') {
          console.log(`📝 ${t.fullName}: ${t.remarks}`);
        }
      });
      setTourists(touristsRes.data.tourists || []);
      setBooking(bookingRes?.data?.booking || null);
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
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // ============================================
  // SORTING & GROUPING: By Country (Uzbekistan first, then Turkmenistan), then by room type
  // ============================================

  // Check if tourist is Turkmenistan
  const isTurkmenistan = (tourist) => {
    const acc = tourist.accommodation?.toLowerCase() || '';
    return acc.includes('turkmenistan');
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
  const filteredTourists = tourists.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Separate Uzbekistan and Turkmenistan tourists
  const uzbekistanTourists = filteredTourists.filter(t => !isTurkmenistan(t));
  const turkmenistanTourists = filteredTourists.filter(t => isTurkmenistan(t));

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
        const msg = summary.touristsUpdated > 0 && summary.touristsCreated > 0
          ? `Updated ${summary.touristsUpdated} tourists, created ${summary.touristsCreated} new (${summary.uzbekistanCount} UZ, ${summary.turkmenistanCount} TM)`
          : summary.touristsUpdated > 0
          ? `Updated ${summary.touristsUpdated} tourists (${summary.uzbekistanCount} UZ, ${summary.turkmenistanCount} TM)`
          : `Created ${summary.touristsCreated} tourists (${summary.uzbekistanCount} UZ, ${summary.turkmenistanCount} TM)`;
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
    setForm({
      roomPreference: tourist.roomPreference || '',
      remarks: tourist.remarks || ''
    });
    setModalOpen(true);
  };

  const saveRoomAndRemarks = async () => {
    try {
      await touristsApi.update(bookingId, editingTourist.id, {
        roomPreference: form.roomPreference,
        remarks: form.remarks
      });
      toast.success('Updated');
      setModalOpen(false);
      loadData();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
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

          const checkInDate = hotelTourists[0]?.checkInDate ? formatDisplayDate(hotelTourists[0].checkInDate) : booking?.arrivalDate ? formatDisplayDate(booking.arrivalDate) : '';
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

          hotelTourists.forEach((t, idx) => {
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

          filteredTourists.forEach((t, idx) => {
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
        // Generate professional ЗАЯВКА PDF
        // First, load logo and convert to base64
        let logoDataUrl = '';
        try {
          const response = await fetch('/logo.png');
          const blob = await response.blob();
          logoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.warn('Could not load logo:', error);
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.error('Please allow popups to export PDF');
          return;
        }

        // Get booking details
        const bookingNumber = booking?.bookingNumber || 'N/A';
        const tourType = booking?.tourType?.name || '';
        const country = 'Германия'; // Can be made dynamic
        const totalPax = filteredTourists.length;

        // Calculate arrival/departure dates from booking
        const arrivalDate = booking?.departureDate ? formatDisplayDate(booking.departureDate) : '';
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
        let touristRows = '';
        filteredTourists.forEach((t, idx) => {
          const name = t.fullName || `${t.lastName}, ${t.firstName}`;

          // Get room category - try different sources
          const assignedRoomType = t.roomAssignments?.[0]?.bookingRoom?.roomType?.name;
          let roomCategory = assignedRoomType || t.roomPreference || '';

          // Normalize room category names
          if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
          if (roomCategory === 'TWIN') roomCategory = 'TWN';
          if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

          const remarks = t.remarks && t.remarks !== '-' ? t.remarks : '';

          // Use custom dates if available, otherwise use booking dates
          const displayArrival = t.checkInDate ? formatDisplayDate(t.checkInDate) : arrivalDate;
          const displayDeparture = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : departureDate;

          // Yellow background if has custom dates
          const rowBgColor = (t.checkInDate || t.checkOutDate) ? '#fffacd' : '';

          touristRows += `
            <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${idx + 1}</td>
              <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${t.checkOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
              <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomCategory}</td>
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
                  <th style="width:35%">ФИО</th>
                  <th style="width:15%">Дата заезда</th>
                  <th style="width:15%">дата выезда</th>
                  <th style="width:12%">Категория<br>номера</th>
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
                  <div className="text-2xl font-bold text-gray-900">{tourists.length}</div>
                  <div className="text-xs text-gray-600">{tourists.length === 1 ? 'guest' : 'guests'}</div>
                </div>
              </div>

              {/* Room Type Breakdown Cards */}
              {(() => {
                const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
                const seenRooms = { DBL: new Set(), TWN: new Set(), SNGL: new Set() };

                tourists.forEach(t => {
                  const roomType = (t.roomPreference || '').toUpperCase();
                  const roomNum = t.roomNumber;

                  if ((roomType === 'DBL' || roomType === 'DOUBLE') && roomNum && !seenRooms.DBL.has(roomNum)) {
                    roomCounts.DBL++;
                    seenRooms.DBL.add(roomNum);
                  } else if (roomType === 'TWN' && roomNum && !seenRooms.TWN.has(roomNum)) {
                    roomCounts.TWN++;
                    seenRooms.TWN.add(roomNum);
                  } else if ((roomType === 'SNGL' || roomType === 'SINGLE') && roomNum && !seenRooms.SNGL.has(roomNum)) {
                    roomCounts.SNGL++;
                    seenRooms.SNGL.add(roomNum);
                  }
                });

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
        <div className="flex items-center gap-3">
          {tourists.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 shadow-sm transition-all"
              >
                <Download className="w-4 h-4 text-gray-500" />
                Export
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
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

          <label className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 cursor-pointer text-sm font-medium shadow-md shadow-primary-200 transition-all">
            <Upload className="w-4 h-4" />
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

      {/* Card-style List */}
      {filteredTourists.length > 0 ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-50 to-white rounded-2xl border-2 border-gray-300 p-5 shadow-lg">
            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">No</div>
              <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Name</div>
              <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Tour Start</div>
              <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Tour End</div>
              <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Room Type</div>
              <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider">Placement</div>
              <div className="col-span-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Additional Information</div>
              <div className="col-span-1 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">Actions</div>
            </div>
          </div>

          {/* Tourist Cards */}
          {(() => {
            const renderedIds = new Set();
            const cards = [];

            sortedTourists.forEach((tourist, index) => {
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
              const roommate = isRoomPair ? sortedTourists.find(t =>
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

                // Check if tourist has custom arrival/departure dates
                const hasCustomDates = t.checkInDate || t.checkOutDate;
                const customCheckIn = t.checkInDate ? formatDisplayDate(t.checkInDate) : null;
                const customCheckOut = t.checkOutDate ? formatDisplayDate(t.checkOutDate) : null;

                // Use custom dates if available, otherwise use booking dates
                const displayCheckIn = customCheckIn || (booking?.departureDate ? formatDisplayDate(booking.departureDate) : '-');
                const displayCheckOut = customCheckOut || (booking?.endDate ? formatDisplayDate(booking.endDate) : '-');

                // Yellow background if has custom dates
                const rowBgClass = hasCustomDates ? 'bg-yellow-50 border-2 border-yellow-300' : '';

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

                    {/* Tour Dates */}
                    <div className="col-span-2">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${customCheckIn ? 'bg-yellow-100 border border-yellow-400' : 'bg-blue-50 border border-blue-200'}`}>
                        <span className={`text-xs font-medium ${customCheckIn ? 'text-yellow-900' : 'text-blue-600'}`}>
                          {displayCheckIn}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${customCheckOut ? 'bg-yellow-100 border border-yellow-400' : 'bg-red-50 border border-red-200'}`}>
                        <span className={`text-xs font-medium ${customCheckOut ? 'text-yellow-900' : 'text-red-600'}`}>
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

                    {/* Additional Information */}
                    <div className="col-span-2">
                      {t.remarks && t.remarks !== '-' ? (
                        <div className="text-gray-700 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl px-4 py-3 shadow-sm">
                          {t.remarks.split('\n').map((line, i) => (
                            <div key={i} className="text-xs leading-relaxed font-medium">{line}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
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

              cards.push(

                <div
                  key={`card-${tourist.id}`}
                  className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 shadow-md hover:shadow-xl hover:scale-[1.01] transition-all duration-300 p-6 ${roomPairClasses}`}
                >
                  {roommate ? (
                    // Room pair - 2 tourists in one card
                    <div className="space-y-4">
                      {renderTouristRow(tourist, index)}
                      <div className="border-t-2 border-dashed border-gray-300 pt-4">
                        {renderTouristRow(roommate, sortedTourists.indexOf(roommate))}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Edit Assignment</h2>
                    <p className="text-sm text-white/70">Room & remarks</p>
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

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Room Type</label>
                <select
                  value={form.roomPreference}
                  onChange={(e) => setForm({ ...form, roomPreference: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
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

    </div>
  );
}
