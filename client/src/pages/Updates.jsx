import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi, tourTypesApi, touristsApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Bell, Edit, Trash2, Users, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const tourTypeModules = [
  { code: 'ER', name: 'Erlebnisreisen', color: '#3B82F6' },
  { code: 'CO', name: 'Comfort', color: '#10B981' },
  { code: 'KAS', name: 'Karawanen Seidenstrasse', color: '#F59E0B' },
  { code: 'ZA', name: 'Zentralasien', color: '#8B5CF6' }
];

const statusLabels = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждено',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено'
};

const statusClasses = {
  PENDING: 'bg-gradient-to-r from-yellow-200 to-yellow-300 text-yellow-900 border border-yellow-400 shadow-sm',
  CONFIRMED: 'bg-gradient-to-r from-green-200 to-green-300 text-green-900 border border-green-400 shadow-sm',
  IN_PROGRESS: 'bg-gradient-to-r from-purple-200 to-purple-300 text-purple-900 border border-purple-400 shadow-sm',
  COMPLETED: 'bg-gradient-to-r from-blue-200 to-blue-300 text-blue-900 border border-blue-400 shadow-sm',
  CANCELLED: 'bg-gradient-to-r from-red-200 to-red-300 text-red-900 border border-red-400 shadow-sm'
};

export default function Updates() {
  const [activeTab, setActiveTab] = useState('ER');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tourTypes, setTourTypes] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadTourTypes();
  }, []);

  useEffect(() => {
    if (tourTypes.length > 0) {
      loadBookings();
      loadAllBookingsCount();
    }
  }, [activeTab, tourTypes]);

  const loadTourTypes = async () => {
    try {
      const response = await tourTypesApi.getAll();
      setTourTypes(response.data.tourTypes);
    } catch (error) {
      console.error('Error loading tour types:', error);
    }
  };

  const [allBookingsCount, setAllBookingsCount] = useState(0);
  const [bookingCountsByType, setBookingCountsByType] = useState({});
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const loadAllBookingsCount = async () => {
    try {
      // Call debug endpoint
      const debugResponse = await bookingsApi.debugCountByType();
      const debugData = debugResponse.data;

      console.log('\n📊 BOOKING DEBUG INFO:');
      console.log(`   Actual: ${debugData.total} туров`);
      console.log(`   Expected: ${debugData.expected.total} туров`);
      console.log(`   Missing: ${debugData.difference.total} туров`);
      console.log('\n   By Status:');
      console.log(`   Подтверждено (CONFIRMED): ${debugData.statusCounts.CONFIRMED}`);
      console.log(`   В процессе (IN_PROGRESS): ${debugData.statusCounts.IN_PROGRESS}`);
      console.log(`   Ожидает (PENDING): ${debugData.statusCounts.PENDING}`);
      console.log(`   Отменено (CANCELLED): ${debugData.statusCounts.CANCELLED || 0}`);
      console.log(`   Завершено (COMPLETED): ${debugData.statusCounts.COMPLETED || 0}`);
      console.log('\n   By Type (Actual / Expected / Missing):');
      console.log(`   ER:  ${debugData.byType.ER || 0} / ${debugData.expected.ER} / ${debugData.difference.ER}`);
      console.log(`   CO:  ${debugData.byType.CO || 0} / ${debugData.expected.CO} / ${debugData.difference.CO}`);
      console.log(`   KAS: ${debugData.byType.KAS || 0} / ${debugData.expected.KAS} / ${debugData.difference.KAS}`);
      console.log(`   ZA:  ${debugData.byType.ZA || 0} / ${debugData.expected.ZA} / ${debugData.difference.ZA}`);

      setAllBookingsCount(debugData.total);
      setBookingCountsByType(debugData.byType);
      setConfirmedCount(debugData.statusCounts.CONFIRMED);
      setInProgressCount(debugData.statusCounts.IN_PROGRESS);
      setPendingCount(debugData.statusCounts.PENDING);
    } catch (error) {
      console.error('Error loading total bookings count:', error);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const tourType = tourTypes.find(t => t.code === activeTab);
      if (!tourType) {
        setLoading(false);
        return;
      }

      const response = await bookingsApi.getAll({ tourTypeId: tourType.id });
      setBookings(response.data.bookings || []);
    } catch (error) {
      toast.error('Ошибка загрузки бронирований');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, bookingNumber) => {
    if (!confirm(`Удалить бронирование ${bookingNumber}?`)) return;

    try {
      await bookingsApi.delete(id);
      toast.success('Бронирование удалено');
      loadBookings();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };


  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setImporting(true);
      let totalSuccess = 0;
      let totalErrors = 0;

      // Process each file and collect tourists
      const fileDataList = [];
      const errors = [];

      console.log(`\n📦 Processing ${files.length} file(s)...`);

      for (const file of files) {
        try {
          console.log(`\n📄 Processing file: ${file.name}`);
          const fileData = await parseExcelFileOnly(file);
          console.log(`✅ Parsed: ${fileData.tourists.length} tourists, booking: ${fileData.matchedBooking?.bookingNumber}, type: ${fileData.isTurkmenistanExtension ? 'Turkmenistan' : 'Uzbekistan'}`);

          if (fileData.success) {
            fileDataList.push(fileData);
          } else {
            totalErrors++;
            errors.push({ file: file.name, error: fileData.error });
            console.error(`❌ Failed to process ${file.name}:`, fileData.error);
          }
        } catch (fileError) {
          totalErrors++;
          errors.push({ file: file.name, error: fileError.message });
          console.error('❌ Error processing file:', file.name, fileError);
        }
      }

      // Group files by booking
      const bookingGroups = {};
      for (const fileData of fileDataList) {
        const bookingId = fileData.matchedBooking.id;
        if (!bookingGroups[bookingId]) {
          bookingGroups[bookingId] = {
            booking: fileData.matchedBooking,
            uzbekistan: [],
            turkmenistan: []
          };
        }

        if (fileData.isTurkmenistanExtension) {
          bookingGroups[bookingId].turkmenistan.push(...fileData.tourists);
        } else {
          bookingGroups[bookingId].uzbekistan.push(...fileData.tourists);
        }
      }

      console.log(`\n📊 Grouped into ${Object.keys(bookingGroups).length} booking(s)`);

      // Import each booking group
      const results = [];
      for (const [bookingId, group] of Object.entries(bookingGroups)) {
        const allTourists = [...group.uzbekistan, ...group.turkmenistan];
        const uzbekCount = group.uzbekistan.length;
        const turkCount = group.turkmenistan.length;

        console.log(`\n🚀 Importing to ${group.booking.bookingNumber}: ${uzbekCount} Uzbekistan + ${turkCount} Turkmenistan = ${allTourists.length} total`);

        try {
          const importResponse = await touristsApi.import(group.booking.id, allTourists, { createOnly: true });
          const { created, skipped } = importResponse.data;

          // Update booking PAX
          await bookingsApi.update(group.booking.id, {
            paxUzbekistan: uzbekCount,
            paxTurkmenistan: turkCount
          });

          totalSuccess++;
          results.push({
            bookingNumber: group.booking.bookingNumber,
            uzbekCount,
            turkCount,
            total: allTourists.length,
            created: created || 0,
            skipped: skipped || 0
          });

          console.log(`✅ Successfully imported to ${group.booking.bookingNumber}: ${created} created${skipped > 0 ? `, ${skipped} skipped (already exist)` : ''}`);
        } catch (importError) {
          totalErrors++;
          errors.push({
            file: group.booking.bookingNumber,
            error: importError.message
          });
          console.error(`❌ Error importing to ${group.booking.bookingNumber}:`, importError);
        }
      }

      // Show summary
      if (totalSuccess > 0) {
        const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
        const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

        const summary = results
          .map(r => {
            const parts = [];
            if (r.created > 0) parts.push(`создано: ${r.created}`);
            if (r.skipped > 0) parts.push(`пропущено: ${r.skipped}`);
            return `${r.bookingNumber} (${parts.join(', ')})`;
          })
          .join(', ');

        const mainMessage = totalSkipped > 0
          ? `Создано ${totalCreated} туристов, пропущено ${totalSkipped} существующих`
          : `Создано ${totalCreated} туристов`;

        toast.success(`${mainMessage}\n${summary}`);
        loadBookings();
        loadAllBookingsCount();
      }
      if (totalErrors > 0) {
        const errorSummary = errors.map(e => `${e.file}: ${e.error}`).join('\n');
        console.error('Import errors:', errorSummary);
        toast.error(`Ошибок: ${totalErrors}. Проверьте консоль для деталей.`);
      }
      if (totalSuccess === 0 && totalErrors === 0) {
        toast.error('Нет файлов для импорта');
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Ошибка импорта файлов');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const parseExcelFileOnly = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });

      // Helper to parse Excel dates
      const parseExcelDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
          // Excel date serial number
          return new Date((val - 25569) * 86400 * 1000);
        }
        if (typeof val === 'string') {
          // Try parsing DD.MM.YYYY format
          const parts = val.split('.');
          if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
          }
          return new Date(val);
        }
        return null;
      };

      // Helper to compare dates (ignore time)
      const isSameDate = (date1, date2) => {
        if (!date1 || !date2) return false;
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate()
        );
      };

      // Helper to add days to date
      const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      };

      // Process first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to array of arrays (raw data)
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd.mm.yyyy' });

      // Extract header info
      let tourName = '';
      let dateRange = '';
      let departureDate = null;
      let endDate = null;
      let bookingNumber = '';
      let tourTypeCode = '';
      let paxUzbekistan = 0;
      let paxTurkmenistan = 0;

      // Parse header rows (first 5 rows)
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const firstCell = String(row[0] || '').trim();

        // Look for "Reise:" line
        if (firstCell.toLowerCase().includes('reise:')) {
          tourName = String(row[0] || '').replace(/reise:/i, '').trim();
          const tourNameLower = tourName.toLowerCase();

          // Determine tour type from tour name
          // Check in specific order to avoid mismatches

          console.log(`Analyzing tour name: "${tourName}"`);

          // 1. Check for ZA: Turkmenistan, Usbekistan, Tadschikistan, Kasachstan und Kirgistan
          if (
            tourNameLower.includes('turkmenistan') &&
            tourNameLower.includes('tadschikistan') &&
            tourNameLower.includes('kasachstan') &&
            tourNameLower.includes('kirgistan') &&
            tourNameLower.includes('usbekistan')
          ) {
            tourTypeCode = 'ZA';
            console.log('Detected: ZA (Zentralasien)');
          }
          // 2. Check for KAS: Kasachstan, Kirgistan und Usbekistan (without Turkmenistan)
          else if (
            tourNameLower.includes('kasachstan') &&
            tourNameLower.includes('kirgistan') &&
            tourNameLower.includes('usbekistan') &&
            !tourNameLower.includes('turkmenistan') &&
            !tourNameLower.includes('tadschikistan')
          ) {
            tourTypeCode = 'KAS';
            console.log('Detected: KAS (Karawanen Seidenstrasse)');
          }
          // 3. Check for CO: Usbekistan ComfortPlus
          else if (
            tourNameLower.includes('usbekistan') &&
            (tourNameLower.includes('comfort') || tourNameLower.includes('comfortplus'))
          ) {
            tourTypeCode = 'CO';
            console.log('Detected: CO (Comfort)');
          }
          // 4. Check for ER with Turkmenistan extension: Usbekistan mit Verlängerung Turkmenistan
          else if (
            tourNameLower.includes('usbekistan') &&
            tourNameLower.includes('turkmenistan') &&
            (tourNameLower.includes('verlängerung') || tourNameLower.includes('verlangerung'))
          ) {
            tourTypeCode = 'ER';
            console.log('Detected: ER (Erlebnisreisen - with Turkmenistan extension)');
          }
          // 5. Check for ER Uzbekistan only: Usbekistan (without other countries)
          else if (
            tourNameLower.includes('usbekistan') &&
            !tourNameLower.includes('turkmenistan') &&
            !tourNameLower.includes('kasachstan') &&
            !tourNameLower.includes('kirgistan') &&
            !tourNameLower.includes('comfort')
          ) {
            tourTypeCode = 'ER';
            console.log('Detected: ER (Erlebnisreisen - Uzbekistan only)');
          }
          // 6. Fallback: Check for Erlebnis in product name
          else if (tourNameLower.includes('erlebnis')) {
            tourTypeCode = 'ER';
            console.log('Detected: ER (Erlebnisreisen - by product name)');
          }
        }

        // Look for "Datum:" line
        if (firstCell.toLowerCase().includes('datum:')) {
          dateRange = String(row[0] || '').replace(/datum:/i, '').trim();
          console.log(`Found date range: "${dateRange}"`);

          // Parse date range "29.03.2026 - 11.04.2026"
          const dateParts = dateRange.split('-').map(d => d.trim());
          if (dateParts.length === 2) {
            const startParts = dateParts[0].split('.');
            const endParts = dateParts[1].split('.');
            if (startParts.length === 3) {
              departureDate = new Date(startParts[2], startParts[1] - 1, startParts[0]);
              console.log(`Parsed departure date: ${departureDate.toLocaleDateString()}`);
            }
            if (endParts.length === 3) {
              endDate = new Date(endParts[2], endParts[1] - 1, endParts[0]);
              console.log(`Parsed end date: ${endDate.toLocaleDateString()}`);
            }
          }
        }
      }

      if (!tourTypeCode) {
        console.error(`Could not determine tour type from file: ${file.name}, tour name: "${tourName}"`);
        return { success: false, error: `Тип тура не определен: "${tourName}"` };
      }

      if (!departureDate) {
        console.error(`Could not parse departure date from file: ${file.name}`);
        return { success: false, error: 'Дата не найдена в файле' };
      }

      // Find tour type
      const tourType = tourTypes.find(t => t.code === tourTypeCode);
      if (!tourType) {
        return { success: false, error: `Tour type ${tourTypeCode} not found` };
      }

      // Determine if this is Turkmenistan extension
      // Check both tour name and trip type in data (Placement column)
      const tourNameLower = tourName.toLowerCase();

      // Debug: show tour name
      console.log(`DEBUG: tourNameLower = "${tourNameLower}"`);
      console.log(`DEBUG: includes turkmenistan? ${tourNameLower.includes('turkmenistan')}`);
      console.log(`DEBUG: includes verlängerung? ${tourNameLower.includes('verlängerung')}`);
      console.log(`DEBUG: includes verlangerung? ${tourNameLower.includes('verlangerung')}`);

      const isTurkmenistanExtension =
        tourNameLower.includes('turkmenistan') &&
        (tourNameLower.includes('verlängerung') ||
         tourNameLower.includes('verlangerung') ||
         tourNameLower.includes('extension') ||
         // Just "Turkmenistan" without "Uzbekistan" is also extension
         (!tourNameLower.includes('usbekistan') && tourNameLower.includes('turkmenistan')));

      // Adjust date for ZA tours (Excel shows entry date, actual tour starts 4 days later)
      // Example: Excel shows 08.04, but ZA-01 actually arrives on 12.04
      let actualDepartureDate = departureDate;
      if (tourTypeCode === 'ZA' && departureDate) {
        actualDepartureDate = addDays(departureDate, 4);
      }

      console.log(`\n=== Excel File Analysis ===`);
      console.log(`Tour: ${tourName}`);
      console.log(`Tour Type: ${tourTypeCode}`);
      console.log(`Excel Departure: ${departureDate?.toLocaleDateString()}`);
      console.log(`Actual Departure (for matching): ${actualDepartureDate?.toLocaleDateString()}`);
      console.log(`End Date: ${endDate?.toLocaleDateString()}`);
      console.log(`Turkmenistan Extension: ${isTurkmenistanExtension}`);
      console.log(`===========================\n`);

      // Find existing booking to update
      // Fetch all bookings for this tour type
      const allBookingsResponse = await bookingsApi.getAll({ tourTypeId: tourType.id });
      const existingBookings = allBookingsResponse.data.bookings || [];

      console.log(`Found ${existingBookings.length} existing bookings for ${tourTypeCode}`);
      existingBookings.forEach(b => {
        console.log(`  - ${b.bookingNumber}: Departure ${new Date(b.departureDate).toLocaleDateString()}, End ${new Date(b.endDate).toLocaleDateString()}`);
      });

      let matchedBooking = null;

      if (tourTypeCode === 'ER') {
        // ER groups: Both "Usbekistan" and "Usbekistan mit Verlängerung Turkmenistan"
        // Both match by departure date (they start on the same date)
        // Uzbekistan: 17.04.2026 - 30.04.2026
        // Turkmenistan extension: 17.04.2026 - 06.05.2026 (same start, longer duration)
        matchedBooking = existingBookings.find(b =>
          isSameDate(new Date(b.departureDate), departureDate)
        );
        console.log(`ER matching by departure date: ${departureDate?.toLocaleDateString()} ${isTurkmenistanExtension ? '(Turkmenistan extension)' : '(Uzbekistan)'}`);
      } else if (tourTypeCode === 'CO') {
        // CO groups: "Usbekistan ComfortPlus"
        // Match by departure date (arrival date in Excel)
        matchedBooking = existingBookings.find(b =>
          isSameDate(new Date(b.departureDate), departureDate)
        );
        console.log(`CO matching by departure date: ${departureDate?.toLocaleDateString()}`);
      } else if (tourTypeCode === 'KAS') {
        // KAS groups: "Kasachstan, Kirgistan und Usbekistan"
        // Match by end date (departure date from region in Excel)
        matchedBooking = existingBookings.find(b =>
          isSameDate(new Date(b.endDate), endDate)
        );
        console.log(`KAS matching by end date: ${endDate?.toLocaleDateString()}`);
      } else if (tourTypeCode === 'ZA') {
        // ZA groups: "Turkmenistan, Usbekistan, Tadschikistan, Kasachstan und Kirgistan"
        // Excel date + 4 days = actual arrival in Uzbekistan
        matchedBooking = existingBookings.find(b =>
          isSameDate(new Date(b.departureDate), actualDepartureDate)
        );
        console.log(`ZA matching by adjusted departure date (Excel + 4 days): ${actualDepartureDate?.toLocaleDateString()}`);
      }

      if (!matchedBooking) {
        let matchCriteria = '';
        let criteriaDate = '';

        if (tourTypeCode === 'KAS') {
          matchCriteria = 'end date (выезд из региона)';
          criteriaDate = endDate?.toLocaleDateString('ru-RU');
        } else if (tourTypeCode === 'ZA') {
          matchCriteria = 'departure date (приезд в UZ, Excel дата + 4 дня)';
          criteriaDate = `${departureDate?.toLocaleDateString('ru-RU')} + 4 = ${actualDepartureDate?.toLocaleDateString('ru-RU')}`;
        } else {
          matchCriteria = 'departure date (приезд в UZ)';
          criteriaDate = departureDate?.toLocaleDateString('ru-RU');
        }

        console.error(`No booking found for ${tourTypeCode} with ${matchCriteria}: ${criteriaDate}`);
        console.error('Available bookings:', existingBookings.map(b =>
          `${b.bookingNumber}: ${new Date(b.departureDate).toLocaleDateString('ru-RU')} - ${new Date(b.endDate).toLocaleDateString('ru-RU')}`
        ));

        return { success: false, error: `Группа не найдена: ${tourTypeCode} (дата: ${criteriaDate})` };
      }

      console.log(`✓ Matched booking: ${matchedBooking.bookingNumber}`);

      // Find header row (contains "ID", "Name", etc.)
      let headerRowIndex = -1;
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (row && row.some(cell => String(cell).toLowerCase() === 'id' || String(cell).toLowerCase() === 'name')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        toast.error('Не найдены заголовки таблицы в файле');
        return;
      }

      // Determine accommodation/placement based on tour name
      const tripType = isTurkmenistanExtension ? 'Turkmenistan' : 'Uzbekistan';
      console.log(`Trip type for all tourists: ${tripType}`);

      // Parse data rows
      const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
      const tourists = [];

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0 || !row[0]) continue;

        const tourist = {};
        headers.forEach((header, index) => {
          tourist[header] = row[index];
        });

        // Parse tourist data
        const name = String(tourist['Name'] || '').trim();
        const nameParts = name.split(',').map(p => p.trim());
        const lastName = nameParts[0] || '';
        const firstName = nameParts[1] || '';

        // Extract gender from title (Mr./Mrs.)
        let gender = 'Not provided';
        const nameLower = name.toLowerCase();
        if (nameLower.includes('mr.') && !nameLower.includes('mrs.')) {
          gender = 'M';
        } else if (nameLower.includes('mrs.') || nameLower.includes('ms.')) {
          gender = 'F';
        }

        const dob = parseExcelDate(tourist['DoB']);
        const doi = parseExcelDate(tourist['DoI']); // Date of Issue
        const doe = parseExcelDate(tourist['DoE']); // Date of Expiry

        // Get vegetarian status
        const vegCell = String(tourist['Veg.'] || tourist['Veg'] || '').trim().toLowerCase();
        const isVegetarian = vegCell === 'yes' || vegCell === 'ja' || vegCell === 'x';

        // Check if birthday during tour (use booking departure/end dates)
        let isBirthdayDuringTour = false;
        if (dob && departureDate && endDate) {
          // Check if birth month/day falls within tour dates
          const birthMonth = dob.getMonth();
          const birthDay = dob.getDate();

          // Create birthday this year
          const currentYear = departureDate.getFullYear();
          const birthdayThisYear = new Date(currentYear, birthMonth, birthDay);

          // Check if birthday is during tour
          if (birthdayThisYear >= departureDate && birthdayThisYear <= endDate) {
            isBirthdayDuringTour = true;
          }
        }

        // Build remarks
        const remarksParts = [];
        if (isVegetarian) {
          remarksParts.push('Vegetarian');
        }
        if (isBirthdayDuringTour) {
          remarksParts.push('Geburtstag');
        }
        const remarks = remarksParts.length > 0 ? remarksParts.join(', ') : null;

        // Parse room preference and extract room number if present
        const rmValue = String(tourist['Rm'] || '').trim().toUpperCase();
        let roomPreference = rmValue || 'Not assigned';
        let roomNumber = null;

        // Check if it contains a room number (e.g., "DZ-1", "EZ-2")
        const roomNumberMatch = rmValue.match(/^([A-Z]+)[-\s]*(\d+)$/);
        if (roomNumberMatch) {
          const roomType = roomNumberMatch[1];
          const roomNum = roomNumberMatch[2];

          // Map German codes to English
          const roomMap = {
            'EZ': 'SNGL',
            'DZ': 'DBL',
            'DOUBLE': 'DBL',
            'SINGLE': 'SNGL',
            'TWIN': 'TWN',
            'DBL': 'DBL',
            'SGL': 'SNGL',
            'SNGL': 'SNGL',
            'TWN': 'TWN'
          };

          const mappedType = roomMap[roomType] || roomType;
          roomPreference = mappedType;
          roomNumber = `${mappedType}-${roomNum}`;
        } else {
          // No room number, just map the type
          const roomMap = {
            'EZ': 'SNGL',
            'DZ': 'DBL',
            'DOUBLE': 'DBL',
            'SINGLE': 'SNGL',
            'TWIN': 'TWN',
            'DBL': 'DBL',
            'SGL': 'SNGL',
            'SNGL': 'SNGL',
            'TWN': 'TWN'
          };
          roomPreference = roomMap[rmValue] || rmValue || 'Not assigned';
        }

        tourists.push({
          firstName: firstName || 'Not provided',
          lastName: lastName || 'Not provided',
          fullName: name || 'Not provided',
          dateOfBirth: dob,
          passportNumber: String(tourist['Pass-No'] || '').trim() || 'Not provided',
          passportIssueDate: doi,
          passportExpiryDate: doe,
          country: String(tourist['Nat'] || '').trim() || 'Not provided',
          placeOfIssue: String(tourist['Pol'] || '').trim(),
          roomPreference: roomPreference,
          roomNumber: roomNumber,
          tripType: tripType,
          gender: gender,
          remarks: remarks,
          selected: true,
          // Set default check-in/out dates from booking (for calculating extra nights)
          checkInDate: actualDepartureDate,
          checkOutDate: endDate
        });
      }

      console.log(`Parsed ${tourists.length} tourists from Excel`);

      if (tourists.length === 0) {
        return { success: false, error: 'Нет туристов в файле' };
      }

      // Return parsed data without importing
      return {
        success: true,
        matchedBooking,
        tourists,
        isTurkmenistanExtension,
        tourName,
        dateRange
      };

    } catch (error) {
      console.error('processExcelFile error:', error);
      return { success: false, error: error.message };
    }
  };

  const activeModule = tourTypeModules.find(m => m.code === activeTab);

  // Calculate status based on PAX count, departure date, and end date
  const getStatusByPax = (pax, departureDate, endDate) => {
    const paxCount = parseInt(pax) || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if tour has ended
    if (endDate) {
      const tourEndDate = new Date(endDate);
      tourEndDate.setHours(0, 0, 0, 0);
      if (tourEndDate < today) {
        return 'COMPLETED';
      }
    }

    // Check if less than 30 days until departure
    if (departureDate) {
      const daysUntilDeparture = Math.ceil((new Date(departureDate) - today) / (1000 * 60 * 60 * 24));

      // If less than 30 days and PAX < 4 → CANCELLED
      if (daysUntilDeparture < 30 && paxCount < 4) {
        return 'CANCELLED';
      }
    }

    // Regular status calculation
    if (paxCount >= 6) {
      return 'CONFIRMED';
    } else if (paxCount === 4 || paxCount === 5) {
      return 'IN_PROGRESS';
    } else {
      return 'PENDING';
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-3xl shadow-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 border-2 border-primary-300 rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200">
              <Bell className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-2">Updates</h1>
              <p className="text-gray-600 font-medium text-sm">
                Туры по категориям • Всего: <span className="text-primary-600 font-bold text-base">{allBookingsCount}</span> туров
              </p>
            </div>
          </div>

          {/* Import Button */}
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md"
          >
            <Upload className="w-5 h-5" />
            {importing ? 'Импорт...' : 'Импорт Excel'}
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="flex items-center gap-3 mt-6">
          {confirmedCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-green-700 font-bold text-sm">Подтверждено: {confirmedCount}</span>
            </div>
          )}
          {inProgressCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              <span className="text-purple-700 font-bold text-sm">В процессе: {inProgressCount}</span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-yellow-700 font-bold text-sm">Ожидает: {pendingCount}</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden">
        <div className="flex bg-gradient-to-r from-gray-50 to-white gap-2 p-2">
          {tourTypeModules.map((module) => (
            <button
              key={module.code}
              onClick={() => setActiveTab(module.code)}
              className={`flex-1 px-6 py-4 text-base font-bold transition-all duration-200 rounded-xl relative shadow-sm ${
                activeTab === module.code
                  ? 'text-white scale-105 shadow-lg'
                  : 'text-gray-600 hover:bg-white hover:shadow-md bg-gray-50'
              }`}
              style={
                activeTab === module.code
                  ? { backgroundColor: module.color }
                  : undefined
              }
            >
              {module.code}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6 bg-gradient-to-r from-gray-50 to-transparent rounded-xl p-4 border-l-4" style={{ borderColor: activeModule?.color }}>
            <h2 className="text-xl font-bold text-gray-900">{activeModule?.name}</h2>
            <p className="text-sm text-gray-600 font-medium mt-1">
              Всего: <span className="text-primary-600 font-bold">{bookings.length}</span> бронирований
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Bell className="w-12 h-12 mb-4 text-gray-300" />
              <p>Нет бронирований для типа {activeTab}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-gray-300 shadow-lg">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-400 via-primary-300 to-primary-400 border-b-4 border-primary-500 shadow-lg sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider w-24">
                      Номер
                    </th>
                    <th className="px-4 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                      Тип тура
                    </th>
                    <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                      Дата заезда
                    </th>
                    <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                      Дата выезда
                    </th>
                    <th className="px-4 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider w-20">
                      Pax
                    </th>
                    <th className="px-3 py-5 text-center text-sm font-black text-primary-900 uppercase tracking-wider w-24">
                      Узбекистан
                    </th>
                    {activeTab === 'ER' && (
                      <th className="px-3 py-5 text-center text-sm font-black text-primary-900 uppercase tracking-wider w-28">
                        Туркменистан
                      </th>
                    )}
                    <th className="px-4 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider w-32">
                      Гид
                    </th>
                    <th className="px-4 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider w-40">
                      ЖД Билеты
                    </th>
                    <th className="px-3 py-5 text-center text-sm font-black text-primary-900 uppercase tracking-wider w-16">
                      DBL
                    </th>
                    <th className="px-3 py-5 text-center text-sm font-black text-primary-900 uppercase tracking-wider w-16">
                      TWN
                    </th>
                    <th className="px-3 py-5 text-center text-sm font-black text-primary-900 uppercase tracking-wider w-16">
                      SNGL
                    </th>
                    <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-5 text-right text-sm font-black text-primary-900 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookings.map((booking, index) => {
                    const calculatedStatus = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);

                    // Set row background color based on status
                    let rowClass = 'hover:bg-gray-50';
                    if (calculatedStatus === 'CANCELLED') {
                      rowClass = 'bg-red-100 hover:bg-red-200';
                    } else if (calculatedStatus === 'PENDING') {
                      rowClass = 'bg-yellow-100 hover:bg-yellow-200';
                    } else if (calculatedStatus === 'IN_PROGRESS') {
                      rowClass = 'bg-purple-100 hover:bg-purple-200';
                    } else if (calculatedStatus === 'CONFIRMED') {
                      rowClass = 'bg-green-100 hover:bg-green-200';
                    } else if (calculatedStatus === 'COMPLETED') {
                      rowClass = 'bg-blue-100 hover:bg-blue-200';
                    }

                    return (
                    <tr key={booking.id} className={`${rowClass} transition-all duration-200`}>
                      <td className="px-3 py-4">
                        <span className="font-bold text-gray-900 text-base">{index + 1}</span>
                      </td>
                      <td className="px-2 py-4">
                        <Link
                          to={`/bookings/${booking.id}?edit=true`}
                          className="inline-flex items-center"
                        >
                          <span
                            className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold text-white hover:shadow-lg hover:scale-105 transition-all duration-200 whitespace-nowrap shadow-sm"
                            style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                          >
                            {booking.bookingNumber}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                        {format(new Date(booking.departureDate), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                        {format(new Date(booking.endDate), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-primary-500" />
                          <span className="font-bold text-gray-900">{booking.pax}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-700 font-semibold text-center">
                        {booking.paxUzbekistan || 0}
                      </td>
                      {activeTab === 'ER' && (
                        <td className="px-3 py-4 text-sm text-gray-700 font-semibold text-center">
                          {booking.paxTurkmenistan || 0}
                        </td>
                      )}
                      <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                        {booking.guide?.name || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                        <span className="truncate max-w-[140px] block" title={booking.trainTickets || ''}>
                          {booking.trainTickets || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center text-sm text-gray-700 font-semibold">
                        {booking.roomsDbl > 0 ? (Number(booking.roomsDbl) % 1 === 0 ? booking.roomsDbl : booking.roomsDbl.toFixed(1)) : '-'}
                      </td>
                      <td className="px-3 py-4 text-center text-sm text-gray-700 font-semibold">
                        {booking.roomsTwn > 0 ? (Number(booking.roomsTwn) % 1 === 0 ? booking.roomsTwn : booking.roomsTwn.toFixed(1)) : '-'}
                      </td>
                      <td className="px-3 py-4 text-center text-sm text-gray-700 font-semibold">
                        {booking.roomsSngl > 0 ? (Number(booking.roomsSngl) % 1 === 0 ? booking.roomsSngl : booking.roomsSngl.toFixed(1)) : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${statusClasses[calculatedStatus]}`}>
                          {statusLabels[calculatedStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/bookings/${booking.id}?edit=true`}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg hover:scale-110 transition-all duration-200"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(booking.id, booking.bookingNumber)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg hover:scale-110 transition-all duration-200"
                            title="Удалить"
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
      </div>
    </div>
  );
}
