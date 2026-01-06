import { useState, useEffect } from 'react';
import { touristsApi, flightsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Edit, Upload, Users, User, Plane, FileText,
  X, Save, Search, Download, ChevronDown, Check, Plus, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Airport code to city name mapping
const airportNames = {
  'TAS': 'Tashkent',
  'SKD': 'Samarkand',
  'UGC': 'Urgench',
  'BHK': 'Bukhara',
  'NCU': 'Nukus',
  'NVI': 'Navoi',
  'IST': 'Istanbul',
  'FRA': 'Frankfurt',
  'HAM': 'Hamburg',
  'BER': 'Berlin',
  'MUC': 'Munich',
  'STR': 'Stuttgart',
  'NUE': 'Nuremberg',
  'ASB': 'Ashgabat'
};

export default function RoomingListModule({ bookingId, onUpdate }) {
  const [tourists, setTourists] = useState([]);
  const [flights, setFlights] = useState([]);
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

  // Flight modal state
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [flightForm, setFlightForm] = useState({
    type: 'INTERNATIONAL',
    flightNumber: '',
    departure: '',
    arrival: '',
    date: '',
    departureTime: '',
    arrivalTime: '',
    notes: ''
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
      const [touristsRes, flightsRes] = await Promise.all([
        touristsApi.getAll(bookingId),
        flightsApi.getAll(bookingId)
      ]);
      setTourists(touristsRes.data.tourists || []);
      setFlights(flightsRes.data.flights || []);
    } catch (error) {
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
  // FLIGHT HANDLERS
  // ============================================

  const internationalFlights = flights.filter(f => f.type === 'INTERNATIONAL');
  const domesticFlights = flights.filter(f => f.type === 'DOMESTIC');

  const openFlightModal = (flight = null, type = 'INTERNATIONAL') => {
    if (flight) {
      setEditingFlight(flight);
      setFlightForm({
        type: flight.type,
        flightNumber: flight.flightNumber || '',
        departure: flight.departure || '',
        arrival: flight.arrival || '',
        date: formatDate(flight.date),
        departureTime: flight.departureTime || '',
        arrivalTime: flight.arrivalTime || '',
        notes: flight.notes || ''
      });
    } else {
      setEditingFlight(null);
      setFlightForm({
        type,
        flightNumber: '',
        departure: '',
        arrival: '',
        date: '',
        departureTime: '',
        arrivalTime: '',
        notes: ''
      });
    }
    setFlightModalOpen(true);
  };

  const saveFlight = async () => {
    if (!flightForm.departure.trim() || !flightForm.arrival.trim()) {
      toast.error('Enter departure and arrival');
      return;
    }

    try {
      if (editingFlight) {
        await flightsApi.update(bookingId, editingFlight.id, flightForm);
        toast.success('Flight updated');
      } else {
        await flightsApi.create(bookingId, flightForm);
        toast.success('Flight added');
      }
      setFlightModalOpen(false);
      loadData();
      onUpdate?.();
    } catch (error) {
      toast.error('Error saving flight');
    }
  };

  const deleteFlight = async (flight) => {
    if (!confirm(`Delete flight ${flight.flightNumber || flight.departure + ' - ' + flight.arrival}?`)) return;

    try {
      await flightsApi.delete(bookingId, flight.id);
      toast.success('Flight deleted');
      loadData();
      onUpdate?.();
    } catch (error) {
      toast.error('Error deleting flight');
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
        toast.success(
          `Imported ${summary.touristsImported} tourists (${summary.uzbekistanCount} UZ, ${summary.turkmenistanCount} TM) and ${summary.internationalFlights + summary.domesticFlights} flights`
        );
        setTourists(response.data.tourists || []);
        setFlights(response.data.flights || []);
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
        const wsData = [
          ['ROOMING LIST'],
          [],
          ['INTERNATIONAL FLIGHTS']
        ];

        if (internationalFlights.length > 0) {
          internationalFlights.forEach(f => {
            const depCity = airportNames[f.departure] || f.departure;
            const arrCity = airportNames[f.arrival] || f.arrival;
            wsData.push([
              f.flightNumber || '-',
              `${depCity} (${f.departure}) → ${arrCity} (${f.arrival})`,
              formatDisplayDate(f.date),
              f.departureTime ? `${f.departureTime} - ${f.arrivalTime || ''}` : '-'
            ]);
          });
        } else {
          wsData.push(['No international flights']);
        }

        wsData.push([]);
        wsData.push(['DOMESTIC FLIGHTS']);

        if (domesticFlights.length > 0) {
          domesticFlights.forEach(f => {
            const depCity = airportNames[f.departure] || f.departure;
            const arrCity = airportNames[f.arrival] || f.arrival;
            wsData.push([
              f.flightNumber || '-',
              `${depCity} (${f.departure}) → ${arrCity} (${f.arrival})`,
              formatDisplayDate(f.date),
              f.departureTime ? `${f.departureTime} - ${f.arrivalTime || ''}` : '-'
            ]);
          });
        } else {
          wsData.push(['No domestic flights']);
        }

        // Export tourists grouped by country, then by room type
        let globalIdx = 1;
        const roomTypes = ['DBL', 'TWN', 'SNGL', 'other'];
        const roomLabels = { DBL: 'DOUBLE', TWN: 'TWIN', SNGL: 'SINGLE', other: 'NOT ASSIGNED' };

        // Uzbekistan section
        if (uzbekistanTourists.length > 0) {
          wsData.push([]);
          wsData.push(['UZBEKISTAN (' + uzbekistanTourists.length + ' persons)']);

          roomTypes.forEach(roomType => {
            const touristsInGroup = uzbekistanByRoomType[roomType];
            if (touristsInGroup.length === 0) return;

            wsData.push([]);
            wsData.push([`  ${roomLabels[roomType]} (${touristsInGroup.length} persons)`]);
            wsData.push(['No', 'Name', 'Room', 'Room #', 'Remarks']);

            touristsInGroup.forEach((t) => {
              const name = t.fullName || `${t.lastName}, ${t.firstName}`;
              const roomNum = t.roomNumber ? t.roomNumber.split('-')[1] || t.roomNumber : '-';
              wsData.push([globalIdx++, name, t.roomPreference || roomType, roomNum, t.remarks || '-']);
            });
          });
        }

        // Turkmenistan section
        if (turkmenistanTourists.length > 0) {
          wsData.push([]);
          wsData.push(['TURKMENISTAN (' + turkmenistanTourists.length + ' persons)']);

          roomTypes.forEach(roomType => {
            const touristsInGroup = turkmenistanByRoomType[roomType];
            if (touristsInGroup.length === 0) return;

            wsData.push([]);
            wsData.push([`  ${roomLabels[roomType]} (${touristsInGroup.length} persons)`]);
            wsData.push(['No', 'Name', 'Room', 'Room #', 'Remarks']);

            touristsInGroup.forEach((t) => {
              const name = t.fullName || `${t.lastName}, ${t.firstName}`;
              const roomNum = t.roomNumber ? t.roomNumber.split('-')[1] || t.roomNumber : '-';
              wsData.push([globalIdx++, name, t.roomPreference || roomType, roomNum, t.remarks || '-']);
            });
          });
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        worksheet['!cols'] = [{ width: 8 }, { width: 35 }, { width: 10 }, { width: 10 }, { width: 40 }];
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rooming List');

        const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'rooming-list.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        // Generate PDF using browser print
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.error('Please allow popups to export PDF');
          return;
        }

        const flightsHtml = (flightList, title) => {
          if (flightList.length === 0) return `<p style="color:#666;font-style:italic;">No ${title.toLowerCase()}</p>`;
          return flightList.map(f => {
            const depCity = airportNames[f.departure] || f.departure;
            const arrCity = airportNames[f.arrival] || f.arrival;
            return `<div style="display:inline-block;border:1px solid #ddd;border-radius:8px;padding:12px;margin:4px;min-width:200px;">
              <div style="font-weight:bold;color:#333;">${f.flightNumber || 'Flight'}</div>
              <div style="font-size:18px;margin:8px 0;">
                <strong>${f.departure}</strong> → <strong>${f.arrival}</strong>
              </div>
              <div style="font-size:12px;color:#666;">${depCity} → ${arrCity}</div>
              <div style="font-size:12px;color:#666;margin-top:4px;">
                ${formatDisplayDate(f.date)} ${f.departureTime ? `| ${f.departureTime} - ${f.arrivalTime || ''}` : ''}
              </div>
            </div>`;
          }).join('');
        };

        // Generate tourists HTML grouped by country, then by room type
        const roomTypesForPdf = ['DBL', 'TWN', 'SNGL', 'other'];
        const roomLabelsForPdf = {
          DBL: { label: 'DOUBLE', color: '#dbeafe', textColor: '#1d4ed8' },
          TWN: { label: 'TWIN', color: '#dcfce7', textColor: '#15803d' },
          SNGL: { label: 'SINGLE', color: '#f3e8ff', textColor: '#7c3aed' },
          other: { label: 'NOT ASSIGNED', color: '#f3f4f6', textColor: '#6b7280' }
        };

        const countryInfoForPdf = {
          uzbekistan: { label: 'UZBEKISTAN', color: '#0284c7', icon: '🇺🇿' },
          turkmenistan: { label: 'TURKMENISTAN', color: '#ea580c', icon: '🇹🇲' }
        };

        let globalPdfIdx = 1;
        let touristsSectionsHtml = '';

        // Generate HTML for each country section
        const generateCountrySectionHtml = (countryKey, countryTouristsList, byRoomType) => {
          if (countryTouristsList.length === 0) return '';

          const cInfo = countryInfoForPdf[countryKey];
          let html = `
            <div style="margin-top:32px;">
              <div style="background:${cInfo.color};color:white;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
                <span style="font-size:20px;margin-right:8px;">${cInfo.icon}</span>
                <strong style="font-size:18px;">${cInfo.label}</strong>
                <span style="margin-left:12px;opacity:0.9;">(${countryTouristsList.length} ${countryTouristsList.length === 1 ? 'person' : 'persons'})</span>
              </div>
          `;

          roomTypesForPdf.forEach(roomType => {
            const touristsInGroup = byRoomType[roomType];
            if (touristsInGroup.length === 0) return;

            const { label, color, textColor } = roomLabelsForPdf[roomType];

            html += `
              <div style="margin-top:16px;margin-left:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <div style="background:${color};color:${textColor};padding:10px 16px;border-bottom:1px solid #e5e7eb;">
                  <strong>${label}</strong>
                  <span style="margin-left:8px;opacity:0.8;">(${touristsInGroup.length} ${touristsInGroup.length === 1 ? 'person' : 'persons'})</span>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th style="background:#f9fafb;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;width:40px;">No</th>
                      <th style="background:#f9fafb;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;">Name</th>
                      <th style="background:#f9fafb;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;width:100px;">Room</th>
                      <th style="background:#f9fafb;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${touristsInGroup.map((t) => {
                      const name = t.fullName || `${t.lastName}, ${t.firstName}`;
                      const roomNum = t.roomNumber ? `#${t.roomNumber.split('-')[1] || t.roomNumber}` : '';
                      return `<tr>
                        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${globalPdfIdx++}</td>
                        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${name}</td>
                        <td style="padding:6px 8px;border-bottom:1px solid #eee;">
                          <span style="background:${color};color:${textColor};padding:2px 6px;border-radius:4px;font-size:11px;">${t.roomPreference || roomType}</span>
                          ${roomNum ? `<span style="color:#9ca3af;font-size:10px;margin-left:4px;">${roomNum}</span>` : ''}
                        </td>
                        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${t.remarks && t.remarks !== '-' ? t.remarks : '-'}</td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `;
          });

          html += '</div>';
          return html;
        };

        touristsSectionsHtml += generateCountrySectionHtml('uzbekistan', uzbekistanTourists, uzbekistanByRoomType);
        touristsSectionsHtml += generateCountrySectionHtml('turkmenistan', turkmenistanTourists, turkmenistanByRoomType);

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Rooming List</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
              h2 { color: #666; margin-top: 24px; }
              @media print {
                body { padding: 0; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>Rooming List</h1>

            <h2>International Flights (${internationalFlights.length})</h2>
            <div>${flightsHtml(internationalFlights, 'International Flights')}</div>

            <h2>Domestic Flights (${domesticFlights.length})</h2>
            <div>${flightsHtml(domesticFlights, 'Domestic Flights')}</div>

            <h2>Tourists (${filteredTourists.length})</h2>
            ${touristsSectionsHtml}

            <p style="margin-top:24px;color:#999;font-size:12px;">Generated: ${new Date().toLocaleString()}</p>
            <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Print / Save as PDF</button>
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

  // Flight Card Component - Modern design with gradient left border
  const FlightCard = ({ flight }) => {
    const depCity = airportNames[flight.departure] || flight.departure;
    const arrCity = airportNames[flight.arrival] || flight.arrival;
    const isInternational = flight.type === 'INTERNATIONAL';

    return (
      <div className={`bg-white rounded-xl border-l-4 ${
        isInternational ? 'border-l-indigo-500' : 'border-l-teal-500'
      } border border-gray-200 p-4 relative group shadow-sm hover:shadow-md transition-shadow`}>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <button
            onClick={() => openFlightModal(flight)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => deleteFlight(flight)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Plane className={`w-4 h-4 ${isInternational ? 'text-indigo-500' : 'text-teal-500'}`} />
          <span className="text-sm font-semibold text-gray-600">{flight.flightNumber || 'Flight'}</span>
        </div>
        <div className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-1">
          <span>{flight.departure}</span>
          <span className="text-gray-300">→</span>
          <span>{flight.arrival}</span>
        </div>
        <div className="text-sm text-gray-500 mb-2">
          {depCity} → {arrCity}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 pt-2 border-t border-gray-100">
          <span className="font-medium">{flight.date ? formatDisplayDate(flight.date) : 'Date TBD'}</span>
          {flight.departureTime && (
            <span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium">
              {flight.departureTime} - {flight.arrivalTime || '?'}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Flight Section Component
  const FlightSection = ({ title, flightsList, type }) => {
    const isInternational = type === 'INTERNATIONAL';
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isInternational ? 'bg-indigo-100' : 'bg-teal-100'}`}>
              <Plane className={`w-5 h-5 ${isInternational ? 'text-indigo-600' : 'text-teal-600'}`} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-800">{title}</h4>
              <p className="text-sm text-gray-500">{flightsList.length} {flightsList.length === 1 ? 'flight' : 'flights'}</p>
            </div>
          </div>
          <button
            onClick={() => openFlightModal(null, type)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isInternational
                ? 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                : 'text-teal-600 hover:bg-teal-50 border border-teal-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Flight
          </button>
        </div>

        {flightsList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flightsList.map(flight => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Plane className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No {title.toLowerCase()} added yet</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-white p-4 rounded-xl border border-primary-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Users className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Rooming List</h3>
            <p className="text-sm text-gray-500">{tourists.length} {tourists.length === 1 ? 'tourist' : 'tourists'} registered</p>
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

      {/* Flight Sections */}
      <div>
        <FlightSection
          title="International Flights"
          flightsList={internationalFlights}
          type="INTERNATIONAL"
        />
        <FlightSection
          title="Domestic Flights"
          flightsList={domesticFlights}
          type="DOMESTIC"
        />
      </div>

      {/* Search */}
      {tourists.length > 5 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tourists by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-50 focus:bg-white transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Tourists Table: Grouped by Country (Uzbekistan first, then Turkmenistan), then by Room Type */}
      {filteredTourists.length > 0 ? (
        <div className="space-y-8">
          {/* Render country sections */}
          {[
            { key: 'uzbekistan', tourists: uzbekistanTourists, byRoomType: uzbekistanByRoomType },
            { key: 'turkmenistan', tourists: turkmenistanTourists, byRoomType: turkmenistanByRoomType }
          ].map(({ key: countryKey, tourists: countryTourists, byRoomType }) => {
            if (countryTourists.length === 0) return null;

            const cInfo = countryInfo[countryKey];
            let countryGlobalIndex = 0;

            return (
              <div key={countryKey} className="space-y-4">
                {/* Country Header */}
                <div className={`${cInfo.color} px-6 py-4 rounded-xl`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl drop-shadow-sm">{cInfo.icon}</span>
                      <div>
                        <h3 className="font-bold text-2xl tracking-wide">{cInfo.label}</h3>
                        <p className="text-sm opacity-80 mt-0.5">Tour Group</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                        <span className="text-2xl font-bold">{countryTourists.length}</span>
                        <span className="text-sm ml-1 opacity-90">{countryTourists.length === 1 ? 'person' : 'persons'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Room type sections within country */}
                <div className="space-y-4 pl-2">
                  {['DBL', 'TWN', 'SNGL', 'other'].map(roomType => {
                    const touristsInGroup = byRoomType[roomType];
                    if (touristsInGroup.length === 0) return null;

                    const info = roomTypeInfo[roomType];
                    const startIndex = countryGlobalIndex;
                    countryGlobalIndex += touristsInGroup.length;

                    return (
                      <div key={roomType} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Room Type Section Header */}
                        <div className={`px-4 py-3 ${info.headerBg} text-white`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{info.icon}</span>
                              <span className="font-bold text-lg">{info.label}</span>
                              <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                                {touristsInGroup.length} {touristsInGroup.length === 1 ? 'person' : 'persons'}
                              </span>
                            </div>
                            <span className="text-sm opacity-90">{info.description}</span>
                          </div>
                        </div>

                        {/* Tourists Table for this Room Type */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs uppercase bg-gray-50/80">
                                <th className="py-3 px-4 w-12 font-semibold text-gray-500">No</th>
                                <th className="py-3 px-4 font-semibold text-gray-500">Guest Name</th>
                                <th className="py-3 px-4 w-32 font-semibold text-gray-500">Room Type</th>
                                <th className="py-3 px-4 font-semibold text-gray-500">Remarks / Notes</th>
                                <th className="py-3 px-4 text-right w-20 font-semibold text-gray-500">Edit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {touristsInGroup.map((p, index) => {
                                // Check if this tourist shares a room with the previous one (for DBL/TWN)
                                const prevTourist = index > 0 ? touristsInGroup[index - 1] : null;
                                const nextTourist = index < touristsInGroup.length - 1 ? touristsInGroup[index + 1] : null;
                                const isRoomPair = prevTourist && p.roomNumber && p.roomNumber === prevTourist.roomNumber;
                                const isFirstInPair = nextTourist && p.roomNumber && p.roomNumber === nextTourist.roomNumber && !isRoomPair;
                                const roomNum = p.roomNumber ? p.roomNumber.split('-')[1] || p.roomNumber : '';

                                return (
                                  <tr
                                    key={p.id}
                                    className={`border-b border-gray-100 hover:bg-gray-50/80 transition-colors
                                      ${isFirstInPair ? 'bg-gradient-to-r from-gray-50/80 to-transparent border-b-0' : ''}
                                      ${isRoomPair ? 'bg-gradient-to-r from-gray-50/80 to-transparent' : ''}`}
                                  >
                                    <td className="py-3 px-4 relative">
                                      {/* Room pair connector line */}
                                      {(isFirstInPair || isRoomPair) && (roomType === 'DBL' || roomType === 'TWN') && (
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                          roomType === 'DBL' ? 'bg-blue-400' : 'bg-emerald-400'
                                        } ${isFirstInPair ? 'rounded-t-full top-1/2' : ''} ${isRoomPair ? 'rounded-b-full bottom-1/2' : ''}`} />
                                      )}
                                      <span className="text-gray-400 font-medium">{startIndex + index + 1}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                          isFirstInPair || isRoomPair ? 'bg-gray-100' : 'bg-gray-50'
                                        }`}>
                                          <User className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-900">
                                            {p.fullName || `${p.lastName}, ${p.firstName}`}
                                          </span>
                                          {(isFirstInPair || isRoomPair) && roomNum && (
                                            <span className="ml-2 text-xs text-gray-400">Room #{roomNum}</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      {editingRoomId === p.id ? (
                                        <div className="flex items-center gap-1">
                                          <select
                                            value={roomValue}
                                            onChange={(e) => setRoomValue(e.target.value)}
                                            className="text-sm border border-gray-300 rounded px-2 py-1"
                                            autoFocus
                                          >
                                            <option value="">-</option>
                                            {roomOptions.map(opt => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                          <button
                                            onClick={() => saveRoom(p.id)}
                                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => setEditingRoomId(null)}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditRoom(p)}
                                          className="px-2 py-1 rounded-lg hover:bg-gray-100 flex items-center gap-2 group"
                                        >
                                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${info.badgeColor}`}>
                                            {p.roomPreference || roomType}
                                          </span>
                                          {roomNum && (roomType === 'DBL' || roomType === 'TWN') && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 group-hover:bg-gray-200">
                                              <span className="text-gray-400">#</span>{roomNum}
                                            </span>
                                          )}
                                        </button>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {editingRemarksId === p.id ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            value={remarksValue}
                                            onChange={(e) => setRemarksValue(e.target.value)}
                                            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                                            placeholder="Remarks..."
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => saveRemarks(p.id)}
                                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => setEditingRemarksId(null)}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditRemarks(p)}
                                          className="text-left w-full px-2 py-1 rounded hover:bg-gray-100 text-gray-600 truncate max-w-xs"
                                          title={p.remarks || ''}
                                        >
                                          {p.remarks && p.remarks !== '-' ? p.remarks : <span className="text-gray-400">-</span>}
                                        </button>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <button
                                        onClick={() => openModal(p)}
                                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
                                        title="Edit"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Remarks</label>
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

      {/* Flight Modal */}
      {flightModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`px-5 py-4 ${flightForm.type === 'INTERNATIONAL' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700' : 'bg-gradient-to-r from-teal-600 to-teal-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Plane className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {editingFlight ? 'Edit Flight' : 'Add Flight'}
                    </h2>
                    <p className="text-sm text-white/70">{flightForm.type === 'INTERNATIONAL' ? 'International' : 'Domestic'} flight</p>
                  </div>
                </div>
                <button onClick={() => setFlightModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Flight Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFlightForm({ ...flightForm, type: 'INTERNATIONAL' })}
                    className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                      flightForm.type === 'INTERNATIONAL'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    International
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlightForm({ ...flightForm, type: 'DOMESTIC' })}
                    className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                      flightForm.type === 'DOMESTIC'
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Domestic
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Flight Number</label>
                <input
                  type="text"
                  value={flightForm.flightNumber}
                  onChange={(e) => setFlightForm({ ...flightForm, flightNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="TK 1234 / HY 54"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Departure *</label>
                  <input
                    type="text"
                    value={flightForm.departure}
                    onChange={(e) => setFlightForm({ ...flightForm, departure: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-lg"
                    placeholder="IST"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Arrival *</label>
                  <input
                    type="text"
                    value={flightForm.arrival}
                    onChange={(e) => setFlightForm({ ...flightForm, arrival: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-lg"
                    placeholder="TAS"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</label>
                <input
                  type="date"
                  value={flightForm.date}
                  onChange={(e) => setFlightForm({ ...flightForm, date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Departure Time</label>
                  <input
                    type="time"
                    value={flightForm.departureTime}
                    onChange={(e) => setFlightForm({ ...flightForm, departureTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Arrival Time</label>
                  <input
                    type="time"
                    value={flightForm.arrivalTime}
                    onChange={(e) => setFlightForm({ ...flightForm, arrivalTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setFlightModalOpen(false)}
                className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveFlight}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium shadow-md transition-all ${
                  flightForm.type === 'INTERNATIONAL'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'
                    : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800'
                }`}
              >
                <Save className="w-4 h-4" />
                Save Flight
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
