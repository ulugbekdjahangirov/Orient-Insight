const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Load pdf-parse v1 for rooming list PDF import
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not available');
}

// Load Anthropic SDK for Claude API (multimodal PDF processing)
let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk').default;
} catch (e) {
  console.warn('Anthropic SDK not available');
}


// Import PDF rooming list parser utility
const { parseRoomingListPdf: utilParseRoomingListPdf, getAirportName } = require('../utils/pdfRoomingListParser');

// Try to load pdf2json (optional dependency for PDF parsing)
let PDFParser;
try {
  PDFParser = require('pdf2json');
} catch (e) {
  console.warn('pdf2json not available, PDF import disabled');
}

const router = express.Router();
const prisma = new PrismaClient();

// Multer for Excel/PDF file upload (in memory) - supports multiple files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv|pdf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel/CSV/PDF files allowed'));
    }
  }
});

// Multiple files upload (up to 10 files)
const uploadMultiple = upload.array('files', 10);

// ============================================
// DATE PARSING HELPER
// ============================================

function parseDate(dateValue) {
  if (!dateValue) return null;

  // Already a Date
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  // Excel serial date
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }

  // String date - try various formats
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;

    // DD.MM.YYYY or DD/MM/YYYY
    let match = trimmed.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }

    // YYYY-MM-DD (ISO)
    match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? null : date;
    }

    // Try native parsing as last resort
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

// ============================================
// TOURISTS CRUD
// ============================================

// Helper: Sort tourists by accommodation (Uzbekistan first, then Turkmenistan), then by name
function sortTouristsByAccommodation(tourists) {
  const accommodationOrder = {
    'Uzbekistan': 1,
    'Turkmenistan': 2,
    'Kyrgyzstan': 3,
    'Tajikistan': 4,
    'Kazakhstan': 5,
    'Not assigned': 99
  };

  return tourists.sort((a, b) => {
    // First sort by accommodation
    const orderA = accommodationOrder[a.accommodation] || 99;
    const orderB = accommodationOrder[b.accommodation] || 99;
    if (orderA !== orderB) return orderA - orderB;

    // Then by group leader (leaders first)
    if (a.isGroupLeader !== b.isGroupLeader) {
      return a.isGroupLeader ? -1 : 1;
    }

    // Then by lastName
    const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
    if (lastNameCompare !== 0) return lastNameCompare;

    // Then by firstName
    return (a.firstName || '').localeCompare(b.firstName || '');
  });
}

// GET /api/bookings/:bookingId/tourists - Get all tourists for booking
router.get('/:bookingId/tourists', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const tourists = await prisma.tourist.findMany({
      where: { bookingId: parseInt(bookingId) },
      include: {
        roomAssignments: {
          include: {
            bookingRoom: {
              include: {
                hotel: { include: { city: true } },
                roomType: true
              }
            }
          }
        },
        accommodationRoomingList: {
          include: {
            accommodation: true
          }
        }
      }
    });

    // Sort by accommodation (Uzbekistan first, Turkmenistan second), then by name
    const sortedTourists = sortTouristsByAccommodation(tourists);

    // Return sorted tourists
    // console.log(`Returning ${sortedTourists.length} tourists for booking ${bookingId}`);

    res.json({ tourists: sortedTourists });
  } catch (error) {
    console.error('Error fetching tourists:', error);
    res.status(500).json({ error: 'Error loading tourists' });
  }
});

// POST /api/bookings/:bookingId/tourists - Add tourist
router.post('/:bookingId/tourists', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { firstName, lastName, gender, passportNumber, dateOfBirth, passportExpiryDate, roomPreference, roommateId, isGroupLeader, notes, country, accommodation, remarks } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({ where: { id: parseInt(bookingId) } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const tourist = await prisma.tourist.create({
      data: {
        bookingId: parseInt(bookingId),
        firstName,
        lastName,
        fullName: `${lastName}, ${firstName}`,
        gender,
        passportNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        passportExpiryDate: passportExpiryDate ? new Date(passportExpiryDate) : null,
        roomPreference,
        roommateId,
        isGroupLeader: isGroupLeader || false,
        notes,
        country: country || 'Not provided',
        accommodation: accommodation || 'Not assigned',
        remarks: remarks || null
      },
      include: {
        roomAssignments: true
      }
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    res.status(201).json({ tourist });
  } catch (error) {
    console.error('Error creating tourist:', error);
    res.status(500).json({ error: 'Error adding tourist' });
  }
});

// PUT /api/bookings/:bookingId/tourists/:id - Update tourist
router.put('/:bookingId/tourists/:id', authenticate, async (req, res) => {
  try {
    const { bookingId, id } = req.params;
    const { firstName, lastName, gender, passportNumber, dateOfBirth, passportExpiryDate, roomPreference, roommateId, isGroupLeader, notes, country, accommodation, remarks, checkInDate, checkOutDate } = req.body;

    console.log(`🔄 Updating tourist ${id}: checkInDate=${checkInDate}, checkOutDate=${checkOutDate}`);

    const tourist = await prisma.tourist.update({
      where: { id: parseInt(id) },
      data: {
        firstName,
        lastName,
        fullName: firstName && lastName ? `${lastName}, ${firstName}` : undefined,
        gender,
        passportNumber,
        dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : undefined,
        passportExpiryDate: passportExpiryDate !== undefined ? (passportExpiryDate ? new Date(passportExpiryDate) : null) : undefined,
        checkInDate: checkInDate !== undefined ? (checkInDate ? new Date(checkInDate) : null) : undefined,
        checkOutDate: checkOutDate !== undefined ? (checkOutDate ? new Date(checkOutDate) : null) : undefined,
        roomPreference,
        roommateId,
        isGroupLeader,
        notes,
        country,
        accommodation,
        remarks
      },
      include: {
        roomAssignments: {
          include: {
            bookingRoom: {
              include: {
                hotel: { include: { city: true } },
                roomType: true
              }
            }
          }
        }
      }
    });

    res.json({ tourist });
  } catch (error) {
    console.error('Error updating tourist:', error);
    res.status(500).json({ error: 'Error updating tourist' });
  }
});

// DELETE /api/bookings/:bookingId/tourists/:id - Remove tourist
router.delete('/:bookingId/tourists/:id', authenticate, async (req, res) => {
  try {
    const { bookingId, id } = req.params;

    await prisma.tourist.delete({
      where: { id: parseInt(id) }
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tourist:', error);
    res.status(500).json({ error: 'Error deleting tourist' });
  }
});

// POST /api/bookings/:bookingId/tourists/bulk - Bulk add tourists
router.post('/:bookingId/tourists/bulk', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { tourists } = req.body;

    if (!Array.isArray(tourists) || tourists.length === 0) {
      return res.status(400).json({ error: 'Tourist list is empty' });
    }

    const created = await prisma.tourist.createMany({
      data: tourists.map(p => ({
        bookingId: parseInt(bookingId),
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.lastName}, ${p.firstName}`,
        gender: p.gender,
        passportNumber: p.passportNumber,
        dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
        passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate) : null,
        roomPreference: p.roomPreference,
        roomNumber: p.roomNumber || null,
        isGroupLeader: p.isGroupLeader || false,
        notes: p.notes,
        country: p.country || 'Not provided',
        accommodation: p.accommodation || 'Not assigned',
        remarks: p.remarks || null,
        // Individual hotel check-in/out dates (for calculating extra nights)
        checkInDate: p.checkInDate ? new Date(p.checkInDate) : null,
        checkOutDate: p.checkOutDate ? new Date(p.checkOutDate) : null
      }))
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    res.status(201).json({ count: created.count });
  } catch (error) {
    console.error('Error bulk creating tourists:', error);
    res.status(500).json({ error: 'Error bulk adding tourists' });
  }
});

// ============================================
// IMPORT HELPERS
// ============================================

// Helper: Detect trip type from filename or Excel content
function detectTripType(filename, rawData) {
  const lowerFilename = (filename || '').toLowerCase();

  // Check filename for country indicators
  if (lowerFilename.includes('turkmenistan') || lowerFilename.includes('tm_') || lowerFilename.includes('_tm')) {
    return 'Turkmenistan';
  }
  if (lowerFilename.includes('kyrgyzstan') || lowerFilename.includes('kg_') || lowerFilename.includes('_kg')) {
    return 'Kyrgyzstan';
  }
  if (lowerFilename.includes('tajikistan') || lowerFilename.includes('tj_') || lowerFilename.includes('_tj')) {
    return 'Tajikistan';
  }
  if (lowerFilename.includes('kazakhstan') || lowerFilename.includes('kz_') || lowerFilename.includes('_kz')) {
    return 'Kazakhstan';
  }

  // Check Excel content (first few rows)
  if (rawData && rawData.length > 0) {
    const contentCheck = rawData.slice(0, 10).flat().join(' ').toLowerCase();
    if (contentCheck.includes('turkmenistan')) return 'Turkmenistan';
    if (contentCheck.includes('kyrgyzstan')) return 'Kyrgyzstan';
    if (contentCheck.includes('tajikistan')) return 'Tajikistan';
    if (contentCheck.includes('kazakhstan')) return 'Kazakhstan';
  }

  return 'Uzbekistan'; // Default
}

// Helper: Parse Excel file and extract tourists
// Supports Agenturdagen format: first 4 rows are metadata, row 5 is header, data starts at row 6
// Missing fields are set to "Not provided" - import never stops due to missing data
function parseExcelFile(buffer, filename = '', booking = null) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];

  // Read raw data as array of arrays to handle row skipping
  const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });

  const NOT_PROVIDED = 'Not provided';

  // Detect trip type from filename or Excel content
  const tripType = detectTripType(filename, rawData);

  // Detect if this is Agenturdaten format (check if first row starts with "Agenturdaten" or has metadata)
  const isAgenturdatenFormat = rawData.length > 6 && (
    (rawData[0] && rawData[0][0] && rawData[0][0].toString().toLowerCase().includes('agenturdaten')) ||
    (rawData[1] && rawData[1][0] && rawData[1][0].toString().toLowerCase().includes('reise'))
  );

  let headerRowIndex = 0;
  let dataStartIndex = 1;

  if (isAgenturdatenFormat) {
    // Agenturdaten format: skip first 4 rows, row 5 (index 4) is header, data starts at row 6 (index 5)
    // Note: Row 5 in Excel = index 4 (0-based), but headers are at index 5 based on actual file structure
    // Let's find the actual header row by looking for "ID" or "Name" column
    for (let i = 3; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.some(cell => {
        const val = (cell || '').toString().toLowerCase();
        return val === 'id' || val === 'name' || val === 'pass-no';
      })) {
        headerRowIndex = i;
        dataStartIndex = i + 1;
        break;
      }
    }
    // Fallback to default if not found
    if (headerRowIndex === 0) {
      headerRowIndex = 5;
      dataStartIndex = 6;
    }
  }

  // Get headers (normalize to lowercase for matching)
  const headers = rawData[headerRowIndex] || [];
  const headerMap = {};
  headers.forEach((h, idx) => {
    if (h) {
      headerMap[h.toString().toLowerCase().trim()] = idx;
    }
  });

  // Helper to get cell value by header name
  const getCell = (row, ...possibleHeaders) => {
    for (const header of possibleHeaders) {
      const idx = headerMap[header.toLowerCase()];
      if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
        return row[idx];
      }
    }
    return null;
  };

  // Parse name from "Mr./Mrs. LastName, FirstName" or "LastName, FirstName" format
  const parseName = (nameStr) => {
    if (!nameStr) return { firstName: NOT_PROVIDED, lastName: NOT_PROVIDED, gender: null };

    const name = nameStr.toString().trim();
    let gender = null;
    let cleanName = name;

    // Extract gender from title
    if (name.toLowerCase().startsWith('mr.') || name.toLowerCase().startsWith('mr ')) {
      gender = 'M';
      cleanName = name.replace(/^mr\.?\s*/i, '').trim();
    } else if (name.toLowerCase().startsWith('mrs.') || name.toLowerCase().startsWith('mrs ')) {
      gender = 'F';
      cleanName = name.replace(/^mrs\.?\s*/i, '').trim();
    } else if (name.toLowerCase().startsWith('ms.') || name.toLowerCase().startsWith('ms ')) {
      gender = 'F';
      cleanName = name.replace(/^ms\.?\s*/i, '').trim();
    }

    // Split by comma: "LastName, FirstName"
    if (cleanName.includes(',')) {
      const parts = cleanName.split(',').map(p => p.trim());
      return {
        lastName: parts[0] || NOT_PROVIDED,
        firstName: parts.slice(1).join(' ').trim() || NOT_PROVIDED,
        gender
      };
    }

    // If no comma, try space split (FirstName LastName)
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0] || NOT_PROVIDED,
        lastName: parts.slice(1).join(' ') || NOT_PROVIDED,
        gender
      };
    }

    return { firstName: NOT_PROVIDED, lastName: cleanName || NOT_PROVIDED, gender };
  };

  // Map room type codes (EZ = SNGL, DZ = DBL) and extract room number if present
  const mapRoomType = (rm) => {
    if (!rm) return { preference: NOT_PROVIDED, number: null };
    const code = rm.toString().toUpperCase().trim();

    // Check if it contains a room number (e.g., "DBL-1", "DZ-1", "EZ-2")
    const roomNumberMatch = code.match(/^([A-Z]+)[-\s]*(\d+)$/);
    if (roomNumberMatch) {
      const roomType = roomNumberMatch[1];
      const roomNum = roomNumberMatch[2];

      const roomMap = {
        'EZ': 'SNGL',
        'DZ': 'DBL',
        'DRZ': 'DBL',
        'DOUBLE': 'DBL',
        'SINGLE': 'SNGL',
        'TWIN': 'TWN',
        'DBL': 'DBL',
        'SGL': 'SNGL',
        'SNGL': 'SNGL',
        'TWN': 'TWN'
      };

      const mappedType = roomMap[roomType] || roomType;
      return { preference: mappedType, number: `${mappedType}-${roomNum}` };
    }

    // No room number, just type
    const roomMap = {
      'EZ': 'SNGL',
      'DZ': 'DBL',
      'DRZ': 'DBL',
      'DOUBLE': 'DBL',
      'SINGLE': 'SNGL',
      'TWIN': 'TWN',
      'DBL': 'DBL',
      'SGL': 'SNGL',
      'SNGL': 'SNGL',
      'TWN': 'TWN'
    };
    return { preference: roomMap[code] || code, number: null };
  };

  // Map nationality codes to country names
  const mapNationality = (nat) => {
    if (!nat) return NOT_PROVIDED;
    const code = nat.toString().trim().toUpperCase();
    const nationalityMap = {
      'D': 'Germany',
      'DE': 'Germany',
      'GER': 'Germany',
      'GERMANY': 'Germany',
      'A': 'Austria',
      'AT': 'Austria',
      'AUT': 'Austria',
      'AUSTRIA': 'Austria',
      'CH': 'Switzerland',
      'SUI': 'Switzerland',
      'SWITZERLAND': 'Switzerland',
      'F': 'France',
      'FR': 'France',
      'FRA': 'France',
      'FRANCE': 'France',
      'NL': 'Netherlands',
      'NED': 'Netherlands',
      'NETHERLANDS': 'Netherlands',
      'BE': 'Belgium',
      'BEL': 'Belgium',
      'BELGIUM': 'Belgium',
      'IT': 'Italy',
      'ITA': 'Italy',
      'ITALY': 'Italy',
      'ES': 'Spain',
      'ESP': 'Spain',
      'SPAIN': 'Spain',
      'GB': 'United Kingdom',
      'UK': 'United Kingdom',
      'GBR': 'United Kingdom',
      'US': 'United States',
      'USA': 'United States'
    };
    return nationalityMap[code] || nat.toString().trim();
  };

  const tourists = [];

  // Process data rows
  for (let i = dataStartIndex; i < rawData.length; i++) {
    const row = rawData[i];

    // Skip empty rows (check if row has any meaningful data)
    const hasData = row.some(cell => cell !== null && cell !== undefined && cell !== '');
    if (!hasData) continue;

    // Get name and parse it
    const nameValue = getCell(row, 'Name', 'FullName', 'Full Name', 'Surname');
    const { firstName, lastName, gender: titleGender } = parseName(nameValue);

    // Skip row if no name at all (likely empty/separator row)
    if (firstName === NOT_PROVIDED && lastName === NOT_PROVIDED) continue;

    // Get other fields
    const passport = getCell(row, 'Pass-No', 'Passport', 'PassportNumber', 'Passport Number');
    const dob = getCell(row, 'DoB', 'DateOfBirth', 'Date of Birth', 'DOB', 'Birth Date', 'Birth');
    const passportExpiry = getCell(row, 'DoE', 'PassportExpiry', 'Passport Expiry', 'Expiry Date', 'Expiry', 'Pass. exp.');
    const roomPref = getCell(row, 'Rm', 'Room', 'RoomPreference', 'Room Type', 'Room type');
    const nationality = getCell(row, 'Nat', 'Nationality', 'Country');
    const vegetarian = getCell(row, 'Veg.', 'Veg', 'Vegetarian');
    const remarksCell = getCell(row, 'Remarks', 'Comm.');
    const placementCell = getCell(row, 'Placement', 'Trip', 'Country', 'Destination');

    // Determine gender (from title or explicit column)
    let gender = titleGender;
    if (!gender) {
      const genderCell = getCell(row, 'Gender', 'Sex');
      if (genderCell) {
        const g = genderCell.toString().toLowerCase();
        if (g === 'm' || g === 'male') gender = 'M';
        else if (g === 'f' || g === 'female') gender = 'F';
      }
    }

    // Build remarks from vegetarian info and birthday
    const remarksParts = [];

    // Add vegetarian to remarks
    const vegValue = vegetarian ? vegetarian.toString().toLowerCase() : '';
    if (vegValue === 'yes' || vegValue === 'ja' || vegValue === 'x') {
      remarksParts.push('Vegetarian');
    }

    // Check if birthday during tour
    if (booking && dob) {
      const dobDate = parseDate(dob);
      if (dobDate && booking.departureDate && booking.endDate) {
        const birthMonth = dobDate.getMonth();
        const birthDay = dobDate.getDate();

        // Create birthday this year (using tour year)
        const tourYear = new Date(booking.departureDate).getFullYear();
        const birthdayThisYear = new Date(tourYear, birthMonth, birthDay);

        // Check if birthday is during tour
        const tourStart = new Date(booking.departureDate);
        const tourEnd = new Date(booking.endDate);

        if (birthdayThisYear >= tourStart && birthdayThisYear <= tourEnd) {
          remarksParts.push('Geburtstag');
        }
      }
    }

    // Add existing remarks if any
    if (remarksCell && remarksCell.toString().trim()) {
      remarksParts.push(remarksCell.toString().trim());
    }

    const remarks = remarksParts.length > 0 ? remarksParts.join(', ') : null;

    // Notes field can be empty now (or keep for internal use)
    const notes = [];

    // Determine placement
    let placement = tripType;
    if (placementCell) {
      const pVal = placementCell.toString().toLowerCase();
      if (pVal.includes('turkmenistan')) placement = 'Turkmenistan';
      else if (pVal.includes('uzbekistan')) placement = 'Uzbekistan';
      else if (pVal.includes('kyrgyzstan')) placement = 'Kyrgyzstan';
      else if (pVal.includes('tajikistan')) placement = 'Tajikistan';
      else if (pVal.includes('kazakhstan')) placement = 'Kazakhstan';
    }

    const roomInfo = mapRoomType(roomPref);
    tourists.push({
      rowIndex: i + 1,
      firstName,
      lastName,
      gender: gender || NOT_PROVIDED,
      passportNumber: passport ? passport.toString().trim() : NOT_PROVIDED,
      dateOfBirth: parseDate(dob),
      passportExpiryDate: parseDate(passportExpiry),
      roomPreference: roomInfo.preference,
      roomNumber: roomInfo.number,
      country: mapNationality(nationality),
      tripType: placement,
      remarks: remarks,
      isGroupLeader: false,
      notes: notes.length > 0 ? notes.join('; ') : null,
      source: 'excel'
    });
  }

  return { tourists, tripType, filename };
}

// Helper: Parse PDF file and extract flight + remarks data for merge
async function parsePdfForFlights(buffer) {
  if (!PDFParser) {
    throw new Error('PDF parsing not available');
  }

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', pdfData => {
      try {
        // Extract text from PDF with coordinates
        const texts = [];
        if (pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const text of page.Texts) {
                if (text.R) {
                  for (const r of text.R) {
                    if (r.T) {
                      texts.push({
                        text: decodeURIComponent(r.T),
                        x: text.x,
                        y: text.y
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Sort by y then x to get reading order
        texts.sort((a, b) => {
          if (Math.abs(a.y - b.y) < 0.5) return a.x - b.x;
          return a.y - b.y;
        });

        // Group texts into lines
        const lines = [];
        let currentLine = [];
        let lastY = -1;

        for (const t of texts) {
          if (lastY >= 0 && Math.abs(t.y - lastY) > 0.5) {
            if (currentLine.length > 0) {
              lines.push(currentLine.map(item => item.text).join(' '));
            }
            currentLine = [];
          }
          currentLine.push(t);
          lastY = t.y;
        }
        if (currentLine.length > 0) {
          lines.push(currentLine.map(item => item.text).join(' '));
        }

        const entries = [];
        let rowIndex = 0;

        // Process lines - look for tourist data with flight info
        for (const line of lines) {
          // Skip header-like lines
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('lastname') ||
              (lowerLine.includes('name') && lowerLine.includes('passport')) ||
              lowerLine.includes('rooming list') ||
              lowerLine.includes('final rooming')) {
            continue;
          }

          // Try to parse as table row (multiple spaces separate columns)
          const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);

          if (parts.length >= 2) {
            rowIndex++;

            let firstName = '', lastName = '', dateOfBirth = null;
            let remarks = null;

            // First part is usually name
            const namePart = parts[0];
            if (namePart.includes(',')) {
              const nameParts = namePart.split(',').map(p => p.trim());
              lastName = nameParts[0] || '';
              firstName = nameParts.slice(1).join(' ') || '';
            } else {
              const nameParts = namePart.split(/\s+/);
              if (nameParts.length >= 2) {
                lastName = nameParts[0] || '';
                firstName = nameParts.slice(1).join(' ') || '';
              } else {
                lastName = namePart;
              }
            }

            // Skip if no name
            if (!firstName && !lastName) continue;

            // Look for date and remarks in remaining parts
            for (let i = 1; i < parts.length; i++) {
              const part = parts[i];

              // Date pattern
              if (/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}$/.test(part)) {
                if (!dateOfBirth) {
                  dateOfBirth = parseDate(part);
                }
              }
              // Last part is often remarks
              else if (i === parts.length - 1 && part.length > 3) {
                remarks = part;
              }
            }

            if (firstName || lastName) {
              entries.push({
                rowIndex,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                dateOfBirth,
                remarks,
                source: 'pdf'
              });
            }
          }
        }

        resolve(entries);
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

// Helper: Normalize name key for matching
function normalizeNameKey(lastName, firstName, dob) {
  const normalizedLast = (lastName || '').toLowerCase().trim().replace(/[^a-z]/g, '');
  const normalizedFirst = (firstName || '').toLowerCase().trim().replace(/[^a-z]/g, '');
  const dobStr = dob ? new Date(dob).toISOString().split('T')[0] : '';
  return `${normalizedLast}|${normalizedFirst}|${dobStr}`;
}

// Helper: Merge Excel tourists with PDF flight data
function mergeTouristData(excelTourists, pdfEntries) {
  const merged = new Map();
  const NOT_PROVIDED = 'Not provided';

  // 1. Add all Excel tourists first (primary source)
  for (const tourist of excelTourists) {
    const key = normalizeNameKey(tourist.lastName, tourist.firstName, tourist.dateOfBirth);
    merged.set(key, { ...tourist, source: 'excel' });
  }

  // 2. Merge PDF data (fills missing fields, doesn't overwrite valid values)
  for (const entry of pdfEntries) {
    const keyWithDob = normalizeNameKey(entry.lastName, entry.firstName, entry.dateOfBirth);
    const keyWithoutDob = normalizeNameKey(entry.lastName, entry.firstName, null);

    // Try to find match with DOB first, then without
    let matchKey = null;
    if (merged.has(keyWithDob)) {
      matchKey = keyWithDob;
    } else if (merged.has(keyWithoutDob)) {
      matchKey = keyWithoutDob;
    } else {
      // Try partial match (same last name, similar first name)
      for (const [key, tourist] of merged) {
        const [mLast, mFirst] = key.split('|');
        const eLast = (entry.lastName || '').toLowerCase().trim().replace(/[^a-z]/g, '');
        const eFirst = (entry.firstName || '').toLowerCase().trim().replace(/[^a-z]/g, '');

        if (mLast === eLast && (mFirst.startsWith(eFirst) || eFirst.startsWith(mFirst))) {
          matchKey = key;
          break;
        }
      }
    }

    if (matchKey) {
      // Merge: PDF fills missing fields only
      const existing = merged.get(matchKey);
      merged.set(matchKey, {
        ...existing,
        remarks: existing.remarks || entry.remarks,
        source: 'merged'
      });
    } else {
      // PDF-only tourist: create with name + remarks
      const newKey = normalizeNameKey(entry.lastName, entry.firstName, entry.dateOfBirth);
      merged.set(newKey, {
        firstName: entry.firstName || NOT_PROVIDED,
        lastName: entry.lastName || NOT_PROVIDED,
        gender: NOT_PROVIDED,
        passportNumber: NOT_PROVIDED,
        dateOfBirth: entry.dateOfBirth,
        passportExpiryDate: null,
        roomPreference: NOT_PROVIDED,
        country: NOT_PROVIDED,
        tripType: 'Uzbekistan',
        remarks: entry.remarks,
        isGroupLeader: false,
        notes: null,
        source: 'pdf-only'
      });
    }
  }

  return Array.from(merged.values());
}

// POST /api/bookings/:bookingId/tourists/import/preview - Preview import data (supports multiple files)
router.post('/:bookingId/tourists/import/preview', authenticate, (req, res, next) => {
  // Use uploadMultiple middleware, fallback to single file
  uploadMultiple(req, res, (err) => {
    if (err) {
      // Try single file upload as fallback
      upload.single('file')(req, res, next);
    } else {
      next();
    }
  });
}, async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Handle both single file (req.file) and multiple files (req.files)
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Fetch booking data to check birthday during tour
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      select: {
        id: true,
        departureDate: true,
        endDate: true
      }
    });

    const NOT_PROVIDED = 'Not provided';
    let allExcelTourists = [];
    let allPdfEntries = [];
    const filesSummary = [];

    // Separate and process files by type
    for (const file of files) {
      const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';

      if (isPdf) {
        // PDF files - extract flight + remarks data
        if (!PDFParser) {
          filesSummary.push({
            filename: file.originalname,
            type: 'pdf',
            error: 'PDF import not available',
            count: 0
          });
          continue;
        }
        try {
          const pdfEntries = await parsePdfForFlights(file.buffer);
          allPdfEntries = allPdfEntries.concat(pdfEntries);
          filesSummary.push({
            filename: file.originalname,
            type: 'pdf',
            count: pdfEntries.length,
            purpose: 'flights + remarks'
          });
        } catch (pdfError) {
          filesSummary.push({
            filename: file.originalname,
            type: 'pdf',
            error: pdfError.message,
            count: 0
          });
        }
      } else {
        // Excel/CSV files - extract core tourist data
        const result = parseExcelFile(file.buffer, file.originalname, booking);
        allExcelTourists = allExcelTourists.concat(result.tourists);
        filesSummary.push({
          filename: file.originalname,
          type: 'excel',
          tripType: result.tripType,
          count: result.tourists.length,
          purpose: 'tourist data'
        });
      }
    }

    // Merge Excel + PDF data
    const mergedTourists = mergeTouristData(allExcelTourists, allPdfEntries);

    if (mergedTourists.length === 0) {
      return res.status(400).json({ error: 'No tourist data found in files' });
    }

    // Sort by placement (Uzbekistan first), then by name
    mergedTourists.sort((a, b) => {
      const placementOrder = { 'Uzbekistan': 1, 'Turkmenistan': 2, 'Kyrgyzstan': 3, 'Tajikistan': 4, 'Kazakhstan': 5 };
      const orderA = placementOrder[a.tripType] || 99;
      const orderB = placementOrder[b.tripType] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

    // Get count of existing tourists (for info only - will be replaced)
    const existingCount = await prisma.tourist.count({
      where: { bookingId: parseInt(bookingId) }
    });

    // FULL REPLACE MODE: No duplicate validation needed
    // All tourists will be imported, replacing existing data
    const previewData = mergedTourists.map((p, idx) => ({
      ...p,
      id: idx + 1,
      selected: true  // All selected by default in replace mode
    }));

    res.json({
      tourists: previewData,
      total: previewData.length,
      existingCount,  // How many will be deleted
      toImport: previewData.length,
      files: filesSummary,
      fileCount: files.length,
      excelCount: allExcelTourists.length,
      pdfCount: allPdfEntries.length,
      mergedCount: mergedTourists.filter(t => t.source === 'merged').length,
      mode: 'replace'  // Indicate this is replace mode
    });
  } catch (error) {
    console.error('Error previewing import:', error);
    res.status(500).json({ error: 'Preview error: ' + error.message });
  }
});

// POST /api/bookings/:bookingId/tourists/import - Import tourists (FULL REPLACE mode)
// Deletes all existing tourists and replaces with new data from Excel/PDF
router.post('/:bookingId/tourists/import', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { tourists, createOnly, replaceAll } = req.body;

    console.log(`\n🔵 [BACKEND] Import API called for booking ${bookingId}`);
    console.log(`📥 Received ${tourists?.length || 0} tourists`);
    console.log(`⚙️ Mode: ${replaceAll ? 'REPLACE ALL' : createOnly ? 'CREATE ONLY' : 'MERGE'}`);

    if (!Array.isArray(tourists) || tourists.length === 0) {
      return res.status(400).json({ error: 'Tourist list is empty' });
    }

    const NOT_PROVIDED = 'Not provided';
    const bookingIdInt = parseInt(bookingId);

    // Filter only selected tourists
    const toCreate = tourists.filter(p => p.selected !== false);

    console.log(`✅ After filtering selected: ${toCreate.length} tourists`);
    console.log(`📋 List of tourists to create:`);
    toCreate.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.fullName} - tripType: "${t.tripType}"`);
    });

    if (toCreate.length === 0) {
      return res.status(400).json({ error: 'No tourists selected for import' });
    }

    // REPLACE ALL mode: Delete all existing tourists first
    if (replaceAll) {
      const existingTourists = await prisma.tourist.findMany({
        where: { bookingId: bookingIdInt },
        select: { id: true }
      });

      if (existingTourists.length > 0) {
        const touristIds = existingTourists.map(t => t.id);
        console.log(`🗑️ REPLACE ALL: Deleting ${existingTourists.length} existing tourists...`);

        // Delete related data first (foreign key constraints)
        await prisma.accommodationRoomingList.deleteMany({
          where: { touristId: { in: touristIds } }
        });
        await prisma.touristRoomAssignment.deleteMany({
          where: { touristId: { in: touristIds } }
        });

        // Delete tourists
        await prisma.tourist.deleteMany({
          where: { bookingId: bookingIdInt }
        });
        console.log(`✅ Deleted ${existingTourists.length} existing tourists`);
      }
    }

    // MERGE MODE: Update existing tourists or create new ones
    // This preserves room assignments set by Rooming List PDF import
    const existingTourists = replaceAll ? [] : await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt }
    });

    console.log(`📋 Found ${existingTourists.length} existing tourists in database`);

    // Helper function to match tourists by name
    const findExistingTourist = (excelTourist) => {
      const excelFirstName = (excelTourist.firstName || '').toLowerCase().trim();
      const excelLastName = (excelTourist.lastName || '').toLowerCase().trim();

      return existingTourists.find(existing => {
        const existingFirstName = (existing.firstName || '').toLowerCase().trim();
        const existingLastName = (existing.lastName || '').toLowerCase().trim();

        // Match by last name and first name
        return existingLastName === excelLastName && existingFirstName === excelFirstName;
      });
    };

    const touristsToCreate = [];
    const touristsToUpdate = [];

    toCreate.forEach(excelTourist => {
      const existing = findExistingTourist(excelTourist);

      if (existing) {
        if (createOnly) {
          // CREATE ONLY mode (from Updates module): Skip existing tourists
          console.log(`   ⏭️ Skipping existing tourist: ${existing.fullName}`);
        } else {
          // MERGE mode (from Tourists module): Update only personal data (passport, birth date, nationality)
          // DO NOT update room info (roomPreference, roomNumber, accommodation) - preserve from PDF import
          touristsToUpdate.push({
            id: existing.id,
            gender: excelTourist.gender || existing.gender,
            passportNumber: excelTourist.passportNumber || existing.passportNumber,
            dateOfBirth: excelTourist.dateOfBirth ? new Date(excelTourist.dateOfBirth) : existing.dateOfBirth,
            passportExpiryDate: excelTourist.passportExpiryDate ? new Date(excelTourist.passportExpiryDate) : existing.passportExpiryDate,
            country: excelTourist.country || existing.country,
            isGroupLeader: excelTourist.isGroupLeader || existing.isGroupLeader,
            notes: excelTourist.notes || existing.notes
          });
          console.log(`   🔄 Updating personal data: ${existing.fullName}`);
        }
      } else {
        // Create new tourist
        touristsToCreate.push({
          bookingId: bookingIdInt,
          firstName: excelTourist.firstName?.toString().trim() || NOT_PROVIDED,
          lastName: excelTourist.lastName?.toString().trim() || NOT_PROVIDED,
          fullName: `${excelTourist.lastName || NOT_PROVIDED}, ${excelTourist.firstName || NOT_PROVIDED}`.trim(),
          gender: excelTourist.gender || NOT_PROVIDED,
          passportNumber: excelTourist.passportNumber || NOT_PROVIDED,
          dateOfBirth: excelTourist.dateOfBirth ? new Date(excelTourist.dateOfBirth) : null,
          passportExpiryDate: excelTourist.passportExpiryDate ? new Date(excelTourist.passportExpiryDate) : null,
          roomPreference: excelTourist.roomPreference || NOT_PROVIDED,
          roomNumber: excelTourist.roomNumber || null,
          accommodation: excelTourist.tripType || 'Not assigned',
          country: excelTourist.country || NOT_PROVIDED,
          isGroupLeader: excelTourist.isGroupLeader || false,
          notes: excelTourist.notes || null,
          remarks: null  // Excel import should not set remarks
        });
        console.log(`   ➕ Creating new tourist: ${excelTourist.firstName} ${excelTourist.lastName}`);
      }
    });

    // Update existing tourists
    for (const update of touristsToUpdate) {
      await prisma.tourist.update({
        where: { id: update.id },
        data: {
          gender: update.gender,
          passportNumber: update.passportNumber,
          dateOfBirth: update.dateOfBirth,
          passportExpiryDate: update.passportExpiryDate,
          country: update.country,
          isGroupLeader: update.isGroupLeader,
          notes: update.notes
        }
      });
    }

    // Create new tourists
    let createdCount = 0;
    if (touristsToCreate.length > 0) {
      const created = await prisma.tourist.createMany({
        data: touristsToCreate
      });
      createdCount = created.count;
    }

    const skippedCount = toCreate.length - touristsToUpdate.length - touristsToCreate.length;
    console.log(`✅ Updated ${touristsToUpdate.length} tourists, created ${createdCount} new tourists${skippedCount > 0 ? `, skipped ${skippedCount} existing` : ''}`);

    // Update booking pax count
    await updateBookingPaxCount(bookingIdInt);

    // Return updated tourists list (sorted by accommodation)
    const updatedTourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      include: { roomAssignments: true }
    });

    const sortedTourists = sortTouristsByAccommodation(updatedTourists);

    const totalProcessed = touristsToUpdate.length + createdCount;

    res.status(201).json({
      count: totalProcessed,
      updated: touristsToUpdate.length,
      created: createdCount,
      skipped: skippedCount,
      message: createOnly
        ? `Created ${createdCount} new tourists${skippedCount > 0 ? `, skipped ${skippedCount} existing` : ''}`
        : `Processed ${totalProcessed} tourists (${touristsToUpdate.length} updated, ${createdCount} created)`,
      tourists: sortedTourists
    });
  } catch (error) {
    console.error('Error importing tourists:', error);
    res.status(500).json({ error: 'Import error: ' + error.message });
  }
});

// ============================================
// ROOM ASSIGNMENTS
// ============================================

// POST /api/bookings/:bookingId/room-assignments - Assign tourist to room
router.post('/:bookingId/room-assignments', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { touristId, bookingRoomId, checkInDate, checkOutDate, extraNights, extraCost, notes } = req.body;

    if (!touristId || !bookingRoomId) {
      return res.status(400).json({ error: 'Tourist and room are required' });
    }

    // Check if assignment already exists
    const existing = await prisma.touristRoomAssignment.findUnique({
      where: {
        touristId_bookingRoomId: {
          touristId: parseInt(touristId),
          bookingRoomId: parseInt(bookingRoomId)
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Tourist already assigned to this room' });
    }

    const assignment = await prisma.touristRoomAssignment.create({
      data: {
        touristId: parseInt(touristId),
        bookingRoomId: parseInt(bookingRoomId),
        checkInDate: checkInDate ? new Date(checkInDate) : null,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
        extraNights: extraNights || 0,
        extraCost: extraCost || 0,
        notes
      },
      include: {
        tourist: true,
        bookingRoom: {
          include: {
            hotel: { include: { city: true } },
            roomType: true
          }
        }
      }
    });

    res.status(201).json({ assignment });
  } catch (error) {
    console.error('Error creating room assignment:', error);
    res.status(500).json({ error: 'Error assigning to room' });
  }
});

// PUT /api/bookings/:bookingId/room-assignments/:id - Update assignment
router.put('/:bookingId/room-assignments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkInDate, checkOutDate, extraNights, extraCost, notes } = req.body;

    const assignment = await prisma.touristRoomAssignment.update({
      where: { id: parseInt(id) },
      data: {
        checkInDate: checkInDate ? new Date(checkInDate) : null,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
        extraNights: extraNights || 0,
        extraCost: extraCost || 0,
        notes
      },
      include: {
        tourist: true,
        bookingRoom: {
          include: {
            hotel: { include: { city: true } },
            roomType: true
          }
        }
      }
    });

    res.json({ assignment });
  } catch (error) {
    console.error('Error updating room assignment:', error);
    res.status(500).json({ error: 'Error updating assignment' });
  }
});

// DELETE /api/bookings/:bookingId/room-assignments/:id - Remove assignment
router.delete('/:bookingId/room-assignments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.touristRoomAssignment.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room assignment:', error);
    res.status(500).json({ error: 'Error deleting assignment' });
  }
});

// ============================================
// ROOMING LIST
// ============================================

// GET /api/bookings/:bookingId/rooming-list - Get complete rooming list grouped by hotel
router.get('/:bookingId/rooming-list', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        tourType: true,
        tourists: {
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        },
        bookingRooms: {
          include: {
            hotel: { include: { city: true } },
            roomType: true,
            touristAssignments: {
              include: {
                tourist: true
              }
            }
          },
          orderBy: [{ checkInDate: 'asc' }]
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Group by hotel
    const hotelGroups = {};
    for (const room of booking.bookingRooms) {
      const hotelId = room.hotelId;
      if (!hotelGroups[hotelId]) {
        hotelGroups[hotelId] = {
          hotel: room.hotel,
          checkInDate: room.checkInDate,
          checkOutDate: room.checkOutDate,
          rooms: []
        };
      }
      hotelGroups[hotelId].rooms.push({
        ...room,
        guests: room.touristAssignments.map(a => ({
          ...a.tourist,
          assignmentId: a.id,
          customCheckIn: a.checkInDate,
          customCheckOut: a.checkOutDate,
          extraNights: a.extraNights,
          extraCost: a.extraCost
        }))
      });
    }

    // Calculate unassigned tourists
    const assignedTouristIds = new Set();
    for (const room of booking.bookingRooms) {
      for (const assignment of room.touristAssignments) {
        assignedTouristIds.add(assignment.touristId);
      }
    }
    const unassignedTourists = booking.tourists.filter(p => !assignedTouristIds.has(p.id));

    res.json({
      booking: {
        id: booking.id,
        number: booking.bookingNumber,
        tourType: booking.tourType?.code,
        pax: booking.pax,
        departureDate: booking.departureDate,
        endDate: booking.endDate
      },
      hotelGroups: Object.values(hotelGroups),
      unassignedTourists,
      totalTourists: booking.tourists.length,
      assignedCount: assignedTouristIds.size
    });
  } catch (error) {
    console.error('Error fetching rooming list:', error);
    res.status(500).json({ error: 'Error loading rooming list' });
  }
});

// ============================================
// HOTEL REQUESTS
// ============================================

// GET /api/bookings/:bookingId/hotel-requests - Get summary of all hotels with full data
router.get('/:bookingId/hotel-requests', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        tourType: true,
        bookingRooms: {
          include: {
            hotel: { include: { city: true } },
            roomType: true,
            touristAssignments: {
              include: { tourist: true }
            }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Group by hotel
    const hotelRequests = {};
    for (const room of booking.bookingRooms) {
      const hotelId = room.hotelId;
      if (!hotelRequests[hotelId]) {
        hotelRequests[hotelId] = {
          hotelId,
          hotelName: room.hotel.name,
          city: room.hotel.city.name,
          checkInDate: room.checkInDate,
          checkOutDate: room.checkOutDate,
          rooms: {},
          totalRooms: 0,
          totalGuests: 0
        };
      }

      const typeName = room.roomType.name;
      if (!hotelRequests[hotelId].rooms[typeName]) {
        hotelRequests[hotelId].rooms[typeName] = { count: 0, guests: [] };
      }
      hotelRequests[hotelId].rooms[typeName].count += room.quantity;
      hotelRequests[hotelId].totalRooms += room.quantity;
      hotelRequests[hotelId].totalGuests += room.touristAssignments.length;
      hotelRequests[hotelId].rooms[typeName].guests.push(
        ...room.touristAssignments.map(a => a.tourist.fullName || `${a.tourist.lastName}, ${a.tourist.firstName}`)
      );
    }

    res.json({
      booking: {
        id: booking.id,
        number: booking.bookingNumber,
        tourType: booking.tourType?.code
      },
      hotelRequests: Object.values(hotelRequests)
    });
  } catch (error) {
    console.error('Error fetching hotel requests:', error);
    res.status(500).json({ error: 'Error loading hotel requests' });
  }
});

// GET /api/bookings/:bookingId/hotel-requests/:hotelId - Get request data for specific hotel
router.get('/:bookingId/hotel-requests/:hotelId', authenticate, async (req, res) => {
  try {
    const { bookingId, hotelId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        tourType: true,
        bookingRooms: {
          where: { hotelId: parseInt(hotelId) },
          include: {
            hotel: { include: { city: true } },
            roomType: true,
            touristAssignments: {
              include: { tourist: true }
            }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.bookingRooms.length === 0) {
      return res.status(404).json({ error: 'No rooms found for this hotel' });
    }

    const hotel = booking.bookingRooms[0].hotel;
    const rooms = {};
    let totalRooms = 0;
    let totalCost = 0;

    for (const room of booking.bookingRooms) {
      const typeName = room.roomType.name;
      if (!rooms[typeName]) {
        rooms[typeName] = {
          type: typeName,
          count: 0,
          pricePerNight: room.pricePerNight,
          nights: Math.ceil((new Date(room.checkOutDate) - new Date(room.checkInDate)) / (1000 * 60 * 60 * 24)),
          guests: []
        };
      }
      rooms[typeName].count += room.quantity;
      totalRooms += room.quantity;
      totalCost += room.totalPrice;
      rooms[typeName].guests.push(...room.touristAssignments.map(a => ({
        id: a.tourist.id,
        name: a.tourist.fullName || `${a.tourist.lastName}, ${a.tourist.firstName}`,
        checkIn: a.checkInDate || room.checkInDate,
        checkOut: a.checkOutDate || room.checkOutDate
      })));
    }

    // Build rooming list
    const roomingList = [];
    for (const room of booking.bookingRooms) {
      for (const assignment of room.touristAssignments) {
        roomingList.push({
          guestName: assignment.tourist.fullName || `${assignment.tourist.lastName}, ${assignment.tourist.firstName}`,
          roomType: room.roomType.name,
          checkIn: assignment.checkInDate || room.checkInDate,
          checkOut: assignment.checkOutDate || room.checkOutDate
        });
      }
    }

    const hotelRequest = {
      hotel: {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city.name,
        address: hotel.address
      },
      booking: {
        id: booking.id,
        number: booking.bookingNumber,
        tourType: booking.tourType?.code,
        tourName: booking.tourType?.name
      },
      checkInDate: booking.bookingRooms[0].checkInDate,
      checkOutDate: booking.bookingRooms[0].checkOutDate,
      rooms: Object.values(rooms),
      totalRooms,
      roomingList,
      totalCost
    };

    res.json({ hotelRequest });
  } catch (error) {
    console.error('Error fetching hotel request:', error);
    res.status(500).json({ error: 'Error loading request' });
  }
});

// ============================================
// COST SUMMARY
// ============================================

// GET /api/bookings/:bookingId/cost-summary - Get full cost breakdown
router.get('/:bookingId/cost-summary', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        tourType: true,
        tourists: {
          include: {
            roomAssignments: {
              include: {
                bookingRoom: {
                  include: {
                    hotel: { include: { city: true } },
                    roomType: true
                  }
                }
              }
            }
          }
        },
        bookingRooms: {
          include: {
            hotel: { include: { city: true } },
            roomType: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // By hotel
    const hotelCosts = {};
    for (const room of booking.bookingRooms) {
      const hotelId = room.hotelId;
      if (!hotelCosts[hotelId]) {
        hotelCosts[hotelId] = {
          hotelId,
          hotelName: room.hotel.name,
          city: room.hotel.city.name,
          rooms: 0,
          nights: 0,
          subtotal: 0
        };
      }

      const nights = Math.ceil((new Date(room.checkOutDate) - new Date(room.checkInDate)) / (1000 * 60 * 60 * 24));
      hotelCosts[hotelId].rooms += room.quantity;
      hotelCosts[hotelId].nights += nights * room.quantity;
      hotelCosts[hotelId].subtotal += room.totalPrice;
    }

    // By tourist
    const touristCosts = booking.tourists.map(p => {
      const breakdown = p.roomAssignments.map(a => {
        const room = a.bookingRoom;
        const effectiveCheckIn = a.checkInDate || room.checkInDate;
        const effectiveCheckOut = a.checkOutDate || room.checkOutDate;
        const nights = Math.ceil((new Date(effectiveCheckOut) - new Date(effectiveCheckIn)) / (1000 * 60 * 60 * 24));

        // Cost per person = room price / typical occupancy (simplified)
        const costPerNight = room.pricePerNight / (room.roomType.maxGuests || 2);
        const cost = costPerNight * nights + a.extraCost;

        return {
          hotel: room.hotel.name,
          roomType: room.roomType.name,
          nights,
          cost: Math.round(cost * 100) / 100
        };
      });

      return {
        touristId: p.id,
        name: p.fullName || `${p.lastName}, ${p.firstName}`,
        totalNights: breakdown.reduce((sum, b) => sum + b.nights, 0),
        totalCost: breakdown.reduce((sum, b) => sum + b.cost, 0),
        breakdown
      };
    });

    // Totals
    const byHotel = Object.values(hotelCosts);
    const totalRooms = byHotel.reduce((sum, h) => sum + h.rooms, 0);
    const totalNights = byHotel.reduce((sum, h) => sum + h.nights, 0);
    const totalCost = byHotel.reduce((sum, h) => sum + h.subtotal, 0);

    res.json({
      booking: {
        id: booking.id,
        number: booking.bookingNumber,
        tourType: booking.tourType.code,
        pax: booking.pax
      },
      byHotel,
      byTourist: touristCosts,
      totals: {
        rooms: totalRooms,
        nights: totalNights,
        cost: totalCost
      }
    });
  } catch (error) {
    console.error('Error fetching cost summary:', error);
    res.status(500).json({ error: 'Error calculating costs' });
  }
});

// ============================================
// EXPORT ENDPOINTS
// ============================================

// GET /api/bookings/:bookingId/tourists/export/excel - Export to Excel
router.get('/:bookingId/tourists/export/excel', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const tourists = await prisma.tourist.findMany({
      where: { bookingId: parseInt(bookingId) }
    });

    // Sort by accommodation (Uzbekistan first), then by name
    const sortedTourists = sortTouristsByAccommodation(tourists);

    // Format data for Excel - matching table column order
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    };

    const data = sortedTourists.map((p, idx) => ({
      'No': idx + 1,
      'Name': `${p.lastName || ''}, ${p.firstName || ''}`,
      'Gender': p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : '',
      'Nationality': p.country || '',
      'Passport': p.passportNumber || '',
      'Birth': formatDate(p.dateOfBirth),
      'Pass. exp.': formatDate(p.passportExpiryDate),
      'Room': p.roomPreference || '',
      'Placement': p.accommodation || '',
      'Remarks': p.remarks || ''
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths - matching table columns
    worksheet['!cols'] = [
      { width: 5 },   // No
      { width: 25 },  // Name
      { width: 8 },   // Gender
      { width: 15 },  // Nationality
      { width: 15 },  // Passport
      { width: 12 },  // Birth
      { width: 12 },  // Pass. exp.
      { width: 8 },   // Room
      { width: 15 },  // Placement
      { width: 30 }   // Remarks
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tourists');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `tourists-${booking.bookingNumber}-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
});

// GET /api/bookings/:bookingId/tourists/export/pdf - Export to PDF
router.get('/:bookingId/tourists/export/pdf', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch tourists and sort by accommodation (Uzbekistan first, then Turkmenistan)
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: parseInt(bookingId) }
    });

    // Sort by accommodation (same as table sorting)
    const sortedTourists = sortTouristsByAccommodation(tourists);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30
    });

    const filename = `tourists-${booking.bookingNumber}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Helper function to format dates
    const formatDate = (date) => {
      if (!date) return '-';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    };

    // Title
    doc.fontSize(16).font('Helvetica-Bold');
    doc.text(`Tourists List - ${booking.bookingNumber}`, { align: 'center' });
    doc.moveDown(0.3);

    // Booking info
    doc.fontSize(10).font('Helvetica');
    doc.text(`Tour: ${booking.tourType?.code || ''} | Country: ${booking.country || '-'} | Tourists: ${sortedTourists.length}`, { align: 'center' });
    doc.text(`Dates: ${formatDate(booking.departureDate)} - ${formatDate(booking.endDate)}`, { align: 'center' });
    doc.moveDown(0.8);

    // Table headers - matching table columns
    const startX = 20;
    let y = doc.y;
    // Columns: No, Name, Gender, Nationality, Passport, Birth, Exp., Room, Placement, Remarks
    const colWidths = [25, 130, 30, 70, 80, 60, 60, 45, 85, 115];
    const headers = ['No', 'Name', 'Gender', 'Nat.', 'Passport', 'Birth', 'Pass.exp.', 'Room', 'Placement', 'Remarks'];
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    // Draw header background
    doc.fillColor('#374151').rect(startX, y, totalWidth, 18).fill();

    // Draw header text
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    let x = startX + 3;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 5, { width: colWidths[i] - 6 });
      x += colWidths[i];
    });

    y += 20;
    doc.fillColor('#000000');

    // Draw rows
    doc.font('Helvetica').fontSize(8);
    sortedTourists.forEach((p, idx) => {
      // Check for page break
      if (y > 520) {
        doc.addPage();
        y = 30;

        // Redraw header on new page
        doc.fillColor('#374151').rect(startX, y, totalWidth, 18).fill();
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        x = startX + 3;
        headers.forEach((header, i) => {
          doc.text(header, x, y + 5, { width: colWidths[i] - 6 });
          x += colWidths[i];
        });
        y += 20;
        doc.fillColor('#000000').font('Helvetica').fontSize(8);
      }

      // Alternating row background
      if (idx % 2 === 0) {
        doc.fillColor('#F9FAFB').rect(startX, y - 1, totalWidth, 14).fill();
      }

      doc.fillColor('#000000');
      x = startX + 3;

      // Full name in format "LastName, FirstName"
      const fullName = `${p.lastName || ''}, ${p.firstName || ''}`;

      const rowData = [
        (idx + 1).toString(),
        fullName,
        p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : '-',
        p.country || '-',
        p.passportNumber || '-',
        formatDate(p.dateOfBirth),
        formatDate(p.passportExpiryDate),
        p.roomPreference || '-',
        p.accommodation || '-',
        p.remarks || '-'
      ];

      rowData.forEach((cell, i) => {
        const maxChars = Math.floor(colWidths[i] / 4); // Approximate chars that fit
        doc.text(cell.substring(0, maxChars), x, y, { width: colWidths[i] - 4 });
        x += colWidths[i];
      });

      y += 16;
    });

    // Footer
    doc.fontSize(8).fillColor('#6B7280');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 555, { align: 'left' });
    doc.text(`Page 1`, 750, 555, { align: 'right' });

    doc.end();
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({ error: 'Error exporting to PDF' });
  }
});

// ============================================
// FLIGHTS CRUD
// ============================================

// GET /api/bookings/:bookingId/flights - Get all flights for a booking
router.get('/:bookingId/flights', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const flights = await prisma.flight.findMany({
      where: { bookingId: parseInt(bookingId) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }]
    });

    res.json({ flights });
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.status(500).json({ error: 'Error loading flights' });
  }
});

// POST /api/bookings/:bookingId/flights - Create a new flight
router.post('/:bookingId/flights', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { type, flightNumber, airline, departure, arrival, date, departureTime, arrivalTime, notes } = req.body;

    // Get max sortOrder for this type
    const maxSort = await prisma.flight.aggregate({
      where: { bookingId: parseInt(bookingId), type: type || 'INTERNATIONAL' },
      _max: { sortOrder: true }
    });

    const flight = await prisma.flight.create({
      data: {
        bookingId: parseInt(bookingId),
        type: type || 'INTERNATIONAL',
        flightNumber: flightNumber || null,
        airline: airline || null,
        departure: departure || '',
        arrival: arrival || '',
        date: date ? new Date(date) : null,
        departureTime: departureTime || null,
        arrivalTime: arrivalTime || null,
        notes: notes || null,
        sortOrder: (maxSort._max.sortOrder || 0) + 1
      }
    });

    res.status(201).json({ flight });
  } catch (error) {
    console.error('Error creating flight:', error);
    res.status(500).json({ error: 'Error creating flight' });
  }
});

// PUT /api/bookings/:bookingId/flights/:id - Update a flight
router.put('/:bookingId/flights/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, flightNumber, airline, departure, arrival, date, departureTime, arrivalTime, notes } = req.body;

    const flight = await prisma.flight.update({
      where: { id: parseInt(id) },
      data: {
        type,
        flightNumber,
        airline,
        departure,
        arrival,
        date: date ? new Date(date) : null,
        departureTime,
        arrivalTime,
        notes
      }
    });

    res.json({ flight });
  } catch (error) {
    console.error('Error updating flight:', error);
    res.status(500).json({ error: 'Error updating flight' });
  }
});

// DELETE /api/bookings/:bookingId/flights/:id - Delete a flight
router.delete('/:bookingId/flights/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.flight.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error);
    res.status(500).json({ error: 'Error deleting flight' });
  }
});

// ============================================
// FLIGHT SECTIONS (Raw content from PDF)
// ============================================

// GET /api/bookings/:bookingId/flight-sections - Get raw flight sections
router.get('/:bookingId/flight-sections', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const sections = await prisma.flightSection.findMany({
      where: { bookingId: parseInt(bookingId) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }]
    });

    // Separate by type
    const international = sections.filter(s => s.type === 'INTERNATIONAL');
    const domestic = sections.filter(s => s.type === 'DOMESTIC');

    res.json({
      flightSections: sections,
      international: international.length > 0 ? international[0] : null,
      domestic: domestic.length > 0 ? domestic[0] : null
    });
  } catch (error) {
    console.error('Error loading flight sections:', error);
    res.status(500).json({ error: 'Error loading flight sections' });
  }
});

// DELETE /api/bookings/:bookingId/flight-sections - Delete all flight sections
router.delete('/:bookingId/flight-sections', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    await prisma.flightSection.deleteMany({
      where: { bookingId: parseInt(bookingId) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight sections:', error);
    res.status(500).json({ error: 'Error deleting flight sections' });
  }
});

// POST /api/bookings/:bookingId/flights/import-pdf - Import ONLY flights from PDF
router.post('/:bookingId/flights/import-pdf', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'PDF fayl yuklanmadi' });
    }

    if (!pdfParse) {
      return res.status(500).json({ error: 'PDF parsing mavjud emas' });
    }

    const bookingIdInt = parseInt(bookingId);

    // Parse PDF
    console.log(`\n📄 Importing flights from PDF: ${req.file.originalname}`);
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    // Debug: Print FULL PDF text to find flight data
    console.log('📋 PDF Text Length:', text.length, 'characters');
    console.log('📋 FULL PDF TEXT:');
    console.log('='.repeat(80));
    console.log(text);
    console.log('='.repeat(80));

    // Parse flights only
    const flights = { international: [], domestic: [] };
    const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];
    const monthMap = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OKT': '10', 'OCT': '10', 'NOV': '11',
      'DEC': '12', 'DEZ': '12'
    };

    const addFlightInfo = (flightInfo) => {
      const dep = flightInfo.departure;
      const arr = flightInfo.arrival;
      const airline = flightInfo.flightNumber?.split(' ')[0];

      // International = IST ↔ TAS only, Domestic = HY flights only
      const isIstTas = (dep === 'IST' && arr === 'TAS') || (dep === 'TAS' && arr === 'IST');
      const isHYFlight = airline === 'HY' && uzbekAirports.includes(dep) && uzbekAirports.includes(arr);

      if (!isIstTas && !isHYFlight) return;

      flightInfo.type = isIstTas ? 'INTERNATIONAL' : 'DOMESTIC';
      const targetArray = isIstTas ? flights.international : flights.domestic;

      const existingIndex = targetArray.findIndex(f =>
        f.flightNumber === flightInfo.flightNumber && f.departure === dep && f.arrival === arr
      );

      if (existingIndex >= 0) {
        targetArray[existingIndex] = { ...targetArray[existingIndex], ...flightInfo };
      } else {
        targetArray.push(flightInfo);
      }
    };

    // Pattern 1: "TK 1664 Fr, 03OKT HAM - IST 18:40 - 23:00"
    const pattern1 = /(TK|HY)\s*(\d{2,4})\s+(?:\w+[,.]?\s*)?(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;
    let match1;
    while ((match1 = pattern1.exec(text)) !== null) {
      const [, airline, num, dateStr, dep, arr, depTime, arrTime] = match1;
      const flightInfo = {
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime
      };
      const dateMatch = dateStr.match(/(\d{2})([A-Z]{3})/i);
      if (dateMatch) {
        const day = dateMatch[1];
        const month = monthMap[dateMatch[2].toUpperCase()] || '01';
        const year = new Date().getFullYear();
        flightInfo.date = `${year}-${month}-${day}`;
      }
      addFlightInfo(flightInfo);
    }

    // Pattern 1b: "TK 368 Mo. 13OCT IST - TAS 01:20 - 07:55" (day + period format)
    const pattern1b = /(TK|HY)\s*(\d{2,4})\s+\w+[.,]?\s+(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;
    let match1b;
    while ((match1b = pattern1b.exec(text)) !== null) {
      const [, airline, num, dateStr, dep, arr, depTime, arrTime] = match1b;
      const flightInfo = {
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime
      };
      const dateMatch = dateStr.match(/(\d{2})([A-Z]{3})/i);
      if (dateMatch) {
        const day = dateMatch[1];
        const month = monthMap[dateMatch[2].toUpperCase()] || '01';
        const year = new Date().getFullYear();
        flightInfo.date = `${year}-${month}-${day}`;
      }
      addFlightInfo(flightInfo);
    }

    // Pattern 2: "TK 1994 - HK FX Fri 03/10/2025 18:35 - 23:05 FRA - IST"
    // Also matches: "TK 368 - HK FX Sat 04/10/2025 01:20 - 07:55 IST - TAS"
    const pattern2 = /(TK|HY)\s*(\d{2,4})(?:\s*-\s*\w+\s*\w+)?\s+\w+[,.]?\s+(\d{2})[\/\.](\d{2})[\/\.](\d{4})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})/gi;
    let match2;
    while ((match2 = pattern2.exec(text)) !== null) {
      const [, airline, num, day, month, year, depTime, arrTime, dep, arr] = match2;
      addFlightInfo({
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime,
        date: `${year}-${month}-${day}`
      });
    }

    // Pattern 3: "TK 1884 03.10.2025 FRA - IST 11:00 - 16:30" (German date format, route before time)
    const pattern3 = /(TK|HY)\s*(\d{2,4})\s+(\d{2})[.\/](\d{2})[.\/]?(\d{2,4})?\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;
    let match3;
    while ((match3 = pattern3.exec(text)) !== null) {
      const [, airline, num, day, month, yearPart, dep, arr, depTime, arrTime] = match3;
      const year = yearPart ? (yearPart.length === 2 ? '20' + yearPart : yearPart) : new Date().getFullYear().toString();
      addFlightInfo({
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime,
        date: `${year}-${month}-${day}`
      });
    }

    console.log(`✈️ Parsed flights (text-based):`, {
      international: flights.international.length,
      domestic: flights.domestic.length
    });

    // If no flights found from text AND Claude API is available, try multimodal extraction
    if (flights.international.length === 0 && flights.domestic.length === 0 && Anthropic) {
      console.log('📸 No flights found in text, trying Claude API for image-based extraction...');

      try {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });

        // Convert PDF buffer to base64
        const pdfBase64 = req.file.buffer.toString('base64');

        // Call Claude API with multimodal prompt
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64
                }
              },
              {
                type: 'text',
                text: `Extract ALL flight information from this PDF. I need ONLY:
- IST ↔ TAS flights (International - Istanbul to/from Tashkent)
- HY flights between Uzbekistan airports: TAS, SKD, UGC, BHK, NCU, NVI, KSQ, TMJ, FEG (Domestic)

Return ONLY a JSON object in this exact format (no markdown, no explanations):
{
  "international": [
    {
      "flightNumber": "TK 368",
      "departure": "IST",
      "arrival": "TAS",
      "date": "2025-10-13",
      "departureTime": "01:20",
      "arrivalTime": "07:55"
    }
  ],
  "domestic": [
    {
      "flightNumber": "HY 1057",
      "departure": "TAS",
      "arrival": "UGC",
      "date": "2025-10-14",
      "departureTime": "07:00",
      "arrivalTime": "08:20"
    }
  ]
}

IMPORTANT:
- Extract ALL matching flights you see
- Use YYYY-MM-DD format for dates
- Use HH:MM format for times (24-hour)
- Ignore all other flights (not IST-TAS and not HY domestic)`
              }
            ]
          }],
          temperature: 0
        });

        // Parse Claude's response
        const responseText = message.content[0].text.trim();
        console.log('🤖 Claude API response:', responseText);

        // Try to parse JSON from response
        let claudeFlights;
        try {
          claudeFlights = JSON.parse(responseText);
        } catch (parseError) {
          // If response has markdown code blocks, extract JSON
          const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            claudeFlights = JSON.parse(jsonMatch[1]);
          } else {
            throw new Error('Could not parse JSON from Claude response');
          }
        }

        // Add flights using existing addFlightInfo function
        if (claudeFlights.international && Array.isArray(claudeFlights.international)) {
          claudeFlights.international.forEach(f => {
            if (f.flightNumber && f.departure && f.arrival) {
              addFlightInfo({
                flightNumber: f.flightNumber,
                departure: f.departure,
                arrival: f.arrival,
                date: f.date,
                departureTime: f.departureTime,
                arrivalTime: f.arrivalTime
              });
            }
          });
        }

        if (claudeFlights.domestic && Array.isArray(claudeFlights.domestic)) {
          claudeFlights.domestic.forEach(f => {
            if (f.flightNumber && f.departure && f.arrival) {
              addFlightInfo({
                flightNumber: f.flightNumber,
                departure: f.departure,
                arrival: f.arrival,
                date: f.date,
                departureTime: f.departureTime,
                arrivalTime: f.arrivalTime
              });
            }
          });
        }

        console.log(`✈️ Parsed flights (Claude API):`, {
          international: flights.international.length,
          domestic: flights.domestic.length
        });

      } catch (claudeError) {
        console.error('❌ Claude API error:', claudeError.message);
        // Continue with empty flights (don't fail the whole import)
      }
    }

    // Delete existing flights
    await prisma.flight.deleteMany({
      where: { bookingId: bookingIdInt }
    });

    // Save new flights
    const allFlights = [
      ...flights.international.map((f, idx) => ({ ...f, sortOrder: idx + 1 })),
      ...flights.domestic.map((f, idx) => ({ ...f, sortOrder: idx + 1 }))
    ];

    if (allFlights.length > 0) {
      await prisma.flight.createMany({
        data: allFlights.map(f => ({
          bookingId: bookingIdInt,
          type: f.type,
          flightNumber: f.flightNumber || null,
          airline: f.airline || null,
          departure: f.departure,
          arrival: f.arrival,
          date: f.date ? new Date(f.date) : null,
          departureTime: f.departureTime || null,
          arrivalTime: f.arrivalTime || null,
          sortOrder: f.sortOrder
        }))
      });
    }

    // Extract raw flight sections (using existing helper function)
    const flightSections = [];

    const internationalRawContent = extractRawFlightSection(text, 'INTERNATIONAL', uzbekAirports);
    if (internationalRawContent || flights.international.length > 0) {
      flightSections.push({
        bookingId: bookingIdInt,
        type: 'INTERNATIONAL',
        rawContent: internationalRawContent || formatFlightListAsRaw(flights.international),
        sourceFileName: req.file.originalname || 'imported.pdf',
        sortOrder: 1
      });
    }

    const domesticRawContent = extractRawFlightSection(text, 'DOMESTIC', uzbekAirports);
    if (domesticRawContent || flights.domestic.length > 0) {
      flightSections.push({
        bookingId: bookingIdInt,
        type: 'DOMESTIC',
        rawContent: domesticRawContent || formatFlightListAsRaw(flights.domestic),
        sourceFileName: req.file.originalname || 'imported.pdf',
        sortOrder: 2
      });
    }

    // Delete existing sections and save new ones
    await prisma.flightSection.deleteMany({
      where: { bookingId: bookingIdInt }
    });

    if (flightSections.length > 0) {
      await prisma.flightSection.createMany({
        data: flightSections
      });
    }

    // Return updated flights
    const updatedFlights = await prisma.flight.findMany({
      where: { bookingId: bookingIdInt },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }]
    });

    const updatedSections = await prisma.flightSection.findMany({
      where: { bookingId: bookingIdInt },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }]
    });

    console.log(`✅ Flight import complete: ${updatedFlights.length} flights, ${updatedSections.length} sections`);

    res.json({
      success: true,
      message: `✅ ${updatedFlights.length} ta parvoz import qilindi`,
      flights: updatedFlights,
      flightSections: updatedSections,
      summary: {
        internationalFlights: flights.international.length,
        domesticFlights: flights.domestic.length
      }
    });
  } catch (error) {
    console.error('Error importing flight PDF:', error);
    res.status(500).json({ error: 'PDF import xatosi: ' + error.message });
  }
});

// ============================================
// ROOMING LIST PDF IMPORT
// ============================================

// POST /api/bookings/:bookingId/rooming-list/import-pdf - Import rooming list from PDF
router.post('/:bookingId/rooming-list/import-pdf', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (!pdfParse) {
      return res.status(500).json({ error: 'PDF parsing not available' });
    }

    const bookingIdInt = parseInt(bookingId);

    // Parse PDF
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    // Parse tourists from PDF sections
    const tourists = [];
    const flights = { international: [], domestic: [] };
    let currentRoomType = null;
    let currentTourType = 'Uzbekistan';

    // Tour dates from PDF
    let tourStartDate = null;
    let tourEndDate = null;

    // Additional information from PDF (global)
    let vegetariansList = []; // Array of vegetarian names
    let birthdaysMap = new Map(); // Map of name -> birthday date
    let globalRemark = ''; // General remark for all tourists

    // Room grouping counters for DBL and TWN
    let roomCounters = { DBL: 0, TWN: 0, SNGL: 0 };
    let currentRoomPersonCount = 0; // Track people in current room (for DBL/TWN pairing)
    let currentRoomNumber = null;

    // Split text into lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Detect tour sections
    let inTurkmenistanSection = false;

    // Section flags for parsing additional information
    let inBirthdaysSection = false;
    let inRemarkSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      // Detect tour sections (IMPORTANT: Order matters - check Turkmenistan first!)
      if (lowerLine.includes('tour:')) {
        // Check for "Tour: Usbekistan mit Verlängerung Turkmenistan"
        if (lowerLine.includes('turkmenistan') || lowerLine.includes('turkmen')) {
          inTurkmenistanSection = true;
          currentTourType = 'Turkmenistan';
          console.log(`📍 Detected Turkmenistan section: ${line}`);
        }
        // Check for "Tour: Usbekistan" (without Turkmenistan)
        else if (lowerLine.includes('usbekistan') || lowerLine.includes('uzbekistan')) {
          inTurkmenistanSection = false;
          currentTourType = 'Uzbekistan';
          console.log(`📍 Detected Uzbekistan section: ${line}`);
        }
        // DON'T reset room counters - continue numbering across both sections
        // This ensures Uzbekistan gets DBL-1, DBL-2... and Turkmenistan gets DBL-3, DBL-4...
        currentRoomPersonCount = 0;
      }

      // Detect room type sections
      // Room type mapping: DOUBLE → DBL, TWIN → TWN, SINGLE → SNGL
      if (line === 'DOUBLE' || lowerLine === 'double') {
        currentRoomType = 'DBL';
        currentRoomPersonCount = 0; // Reset person count for new section
        inBirthdaysSection = false; // Exit additional info sections
        inRemarkSection = false;
        continue;
      }
      if (line === 'TWIN' || lowerLine === 'twin') {
        currentRoomType = 'TWN';
        currentRoomPersonCount = 0; // Reset person count for new section
        inBirthdaysSection = false; // Exit additional info sections
        inRemarkSection = false;
        continue;
      }
      if (line === 'SINGLE' || lowerLine === 'single') {
        currentRoomType = 'SNGL';
        currentRoomPersonCount = 0; // Reset person count for new section
        inBirthdaysSection = false; // Exit additional info sections
        inRemarkSection = false;
        continue;
      }

      // Extract tour dates: "Date: 03.10.2025 – 16.10.2025"
      if (lowerLine.includes('date:')) {
        const dateMatch = line.match(/Date:\s*(\d{2}\.\d{2}\.\d{4})\s*[–-]\s*(\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch && !tourStartDate) { // Only capture first occurrence (Uzbekistan dates)
          tourStartDate = dateMatch[1]; // 03.10.2025
          tourEndDate = dateMatch[2];   // 16.10.2025
          console.log(`Extracted tour dates from PDF: ${tourStartDate} - ${tourEndDate}`);
        }
        continue;
      }

      // Extract additional information (support both "Vegetarian:" and "Vegetarians:")
      if (lowerLine.startsWith('vegetarian:') || lowerLine.startsWith('vegetarians:')) {
        inBirthdaysSection = false;
        inRemarkSection = false;
        const colonIndex = line.indexOf(':');
        const value = line.substring(colonIndex + 1).trim();
        if (value && value !== '//' && value !== '-') {
          // Parse vegetarian names: "Mr. Maier, Heinz Peter // Mrs. Maier, Andrea // Mrs. Maier, Nadja Daniela"
          // Split by "//" first, then clean up each name
          vegetariansList = value.split('//').map(name => name.trim()).filter(n => n);
          console.log(`📋 Vegetarians found (inline): ${vegetariansList.join(' | ')}`);
        } else {
          // Next lines might contain vegetarian names with bullet points
          // Look ahead for bullet-pointed names
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j].trim();
            const nextLower = nextLine.toLowerCase();

            // Stop if we hit another section
            if (nextLower.startsWith('birthdays:') || nextLower.startsWith('remark:') ||
                nextLower === 'double' || nextLower === 'twin' || nextLower === 'single') {
              break;
            }

            // Skip empty lines and //
            if (!nextLine || nextLine === '//' || nextLine === '-') {
              j++;
              continue;
            }

            // Parse bullet-pointed names: "• Mr. Rotter, Roman Martin"
            let vegName = nextLine;
            // Remove bullet point if present
            vegName = vegName.replace(/^[•·●○◦▪▫■□]\s*/, '').trim();

            // Check if it's a name (starts with Mr./Mrs./Ms.)
            if (vegName.match(/^(Mr\.|Mrs\.|Ms\.)\s+/i)) {
              vegetariansList.push(vegName);
              console.log(`📋 Vegetarian found (bullet): ${vegName}`);
              i = j; // Skip this line in main loop
            } else {
              break; // Not a name, stop looking
            }

            j++;
          }
        }
        continue;
      }

      if (lowerLine.startsWith('birthdays:')) {
        inBirthdaysSection = true;
        inRemarkSection = false;
        const value = line.substring(10).trim();
        // Check if there's content on the same line
        if (value && value !== '//' && value !== '-') {
          // Parse birthdays on same line: "05.10.2025 Mr. Smith, John // 12.10.2025 Mrs. Johnson, Mary"
          const birthdayEntries = value.split('//').map(entry => entry.trim());
          birthdayEntries.forEach(entry => {
            // Extract date and name: "05.10.2025 Mr. Smith, John"
            const match = entry.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+)$/);
            if (match) {
              const [, date, name] = match;
              birthdaysMap.set(name.trim(), date);
              console.log(`🎂 Birthday found: ${name.trim()} - ${date}`);
            }
          });
        }
        continue;
      }

      if (lowerLine.startsWith('remark:')) {
        inBirthdaysSection = false;
        inRemarkSection = true;
        const value = line.substring(7).trim();
        if (value && value !== '//' && value !== '-') {
          globalRemark = value;
          console.log(`📝 Global Remark: ${globalRemark}`);
        }
        continue;
      }

      // If we're in birthdays section, parse birthday entries
      if (inBirthdaysSection) {
        // Check for section end markers
        if (lowerLine.startsWith('remark:') || lowerLine === 'double' || lowerLine === 'twin' || lowerLine === 'single') {
          inBirthdaysSection = false;
        } else {
          // Parse birthday line: "Mrs. Diermeier, Melanie Katrin                18.10.1980"
          // OR: "Mrs. Diermeier, Melanie Katrin 18.10.1980"
          // Match: name + spaces/tabs + date (DD.MM.YYYY)
          const birthdayMatch = line.match(/^((?:Mr\.|Mrs\.|Ms\.)\s+.+?)\s+(\d{2}\.\d{2}\.\d{4})$/);
          if (birthdayMatch) {
            const [, name, date] = birthdayMatch;
            birthdaysMap.set(name.trim(), date);
            console.log(`🎂 Birthday found: ${name.trim()} - ${date}`);
            continue; // Don't parse this as a tourist
          }
        }
      }

      // If we're in remark section, collect multi-line remarks
      if (inRemarkSection) {
        // Check for section end markers
        if (lowerLine.startsWith('vegetarians:') || lowerLine.startsWith('birthdays:') ||
            lowerLine === 'double' || lowerLine === 'twin' || lowerLine === 'single' ||
            lowerLine.startsWith('total') || lowerLine.includes('additional information')) {
          inRemarkSection = false;
        } else {
          // Append to global remark
          if (line && line !== '//' && line !== '-') {
            globalRemark += (globalRemark ? '\n' : '') + line;
            console.log(`📝 Remark line: ${line}`);
            continue; // Don't parse this as a tourist
          }
        }
      }

      // Skip section markers and metadata
      if (lowerLine.includes('final rooming list') ||
          lowerLine.includes('tour:') ||
          lowerLine.includes('total') ||
          lowerLine.includes('additional information') ||
          lowerLine.startsWith('*pax') ||
          lowerLine.startsWith('___') ||
          line === '//' ||
          line === '-') {
        // Exit additional info sections when encountering these markers
        inBirthdaysSection = false;
        inRemarkSection = false;
        continue;
      }

      // Parse tourist names (Mr./Mrs./Ms. patterns)
      const nameMatch = line.match(/^(Mr\.|Mrs\.|Ms\.)\s+(.+)$/i);
      if (nameMatch && currentRoomType) {
        let fullName = `${nameMatch[1]} ${nameMatch[2]}`.trim();

        // Extract additional information from the same line (after name)
        // Format in PDF table: "Mr. Smith, John       Additional info here"
        // or: "Mr. Smith, John Additional info"
        let additionalInfo = '';
        const restOfLine = nameMatch[2];

        // Split by multiple spaces (table column separator) or look for text after name
        // Name format: "LastName, FirstName(s)"
        const nameAndInfoMatch = restOfLine.match(/^([^,]+,\s*[^,\s]+(?:\s+[^,\s]+)*)\s{2,}(.+)$/);
        if (nameAndInfoMatch) {
          // Found additional info separated by multiple spaces
          additionalInfo = nameAndInfoMatch[2].trim();
          fullName = `${nameMatch[1]} ${nameAndInfoMatch[1]}`.trim();
          console.log(`   📋 Additional info in same line: "${additionalInfo}"`);
        }

        // Look ahead for additional information in next lines
        // Continue reading lines until we hit another tourist name or section marker
        let j = i + 1;
        const additionalLines = [];
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          const nextLower = nextLine.toLowerCase();

          // Stop if we hit another tourist name
          if (nextLine.match(/^(Mr\.|Mrs\.|Ms\.)\s+/i)) {
            break;
          }

          // Stop if we hit a section marker
          if (nextLower === 'double' || nextLower === 'twin' || nextLower === 'single' ||
              nextLower.startsWith('total') || nextLower.includes('additional information') ||
              nextLower.startsWith('vegetarian') || nextLower.startsWith('birthdays') ||
              nextLower.startsWith('remark') || nextLower.startsWith('tour:') ||
              nextLine === '//' || nextLine === '-' || nextLine === '' ||
              nextLine.startsWith('___')) {
            break;
          }

          // This line is additional information for the tourist
          additionalLines.push(nextLine);
          i = j; // Skip this line in main loop
          j++;
        }

        // Combine additional info from same line and next lines
        if (additionalLines.length > 0) {
          const additionalFromNextLines = additionalLines.join(' ').trim();
          console.log(`   📋 Additional info from next lines: "${additionalFromNextLines}"`);
          if (additionalInfo) {
            additionalInfo += ' ' + additionalFromNextLines;
          } else {
            additionalInfo = additionalFromNextLines;
          }
        }

        const nameParts = fullName.replace(/^(Mr\.|Mrs\.|Ms\.)\s+/i, '').split(',').map(p => p.trim());

        let lastName = '', firstName = '';
        if (nameParts.length >= 2) {
          lastName = nameParts[0];
          firstName = nameParts.slice(1).join(' ');
        } else {
          lastName = nameParts[0];
        }

        // 🔍 Check if name ends with asterisk (*) - means "half double room, no roommate found"
        const hasAsterisk = firstName.endsWith('*') || lastName.endsWith('*') || fullName.endsWith('*');

        if (hasAsterisk) {
          // Remove asterisk from names
          firstName = firstName.replace(/\*$/, '').trim();
          lastName = lastName.replace(/\*$/, '').trim();
          fullName = fullName.replace(/\*$/, '').trim();

          console.log(`   ⚠️ Asterisk detected: "${fullName}" - half double room, no roommate found`);

          // Find the existing tourist with the same name (normalized)
          const normalizeName = (name) => name.toLowerCase().replace(/[*\s]/g, '');
          const normalizedSearchName = normalizeName(fullName);

          const existingTourist = tourists.find(t =>
            normalizeName(t.fullName) === normalizedSearchName
          );

          if (existingTourist) {
            // Update existing tourist to SNGL room instead of adding duplicate
            existingTourist.roomType = 'SNGL';
            roomCounters.SNGL++;
            existingTourist.roomNumber = `SNGL-${roomCounters.SNGL}`;
            // Don't set remarks - keep existing remarks or leave empty
            console.log(`   ✅ Updated existing tourist "${existingTourist.fullName}" to SNGL room`);
            continue; // Skip adding duplicate
          } else {
            console.log(`   ⚠️ Warning: No matching tourist found for "${fullName}", will create as new`);
          }
        }

        console.log(`   👤 Parsed: "${fullName}" → lastName="${lastName}", firstName="${firstName}"`);

        // Room grouping logic:
        // - DBL: 2 people share one room
        // - TWN: 2 people share one room
        // - SNGL: 1 person per room
        let roomNumber;
        if (currentRoomType === 'DBL' || currentRoomType === 'TWN') {
          // For DBL/TWN: every 2 people share a room
          if (currentRoomPersonCount % 2 === 0) {
            // Start new room
            roomCounters[currentRoomType]++;
            currentRoomNumber = `${currentRoomType}-${roomCounters[currentRoomType]}`;
          }
          roomNumber = currentRoomNumber;
          currentRoomPersonCount++;
        } else {
          // SNGL: each person gets their own room
          roomCounters.SNGL++;
          roomNumber = `SNGL-${roomCounters.SNGL}`;
        }

        // Store basic tourist info with additional info from table
        tourists.push({
          fullName,
          firstName,
          lastName,
          gender: nameMatch[1].toLowerCase().includes('mr.') ? 'M' : 'F',
          roomType: currentRoomType,
          roomNumber: roomNumber, // Room grouping identifier
          tourType: currentTourType,
          remarks: '-', // Will be updated later with vegetarian/birthday/global remarks
          additionalInfoFromTable: additionalInfo // Store table column data separately
        });
        continue;
      }

      // Parse flight information from screenshots/tables
      // Look for flight patterns: TK 1234, HY 54, etc.
      const flightMatch = line.match(/(TK|HY)\s*(\d{2,4})/i);
      if (flightMatch) {
        // Try to extract route from same or nearby lines
        const routeMatch = text.match(new RegExp(`${flightMatch[1]}\\s*${flightMatch[2]}[^\\n]*([A-Z]{3})\\s*[-–]\\s*([A-Z]{3})`, 'i'));
        if (routeMatch) {
          const dep = routeMatch[1].toUpperCase();
          const arr = routeMatch[2].toUpperCase();

          const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];
          const isInternational = dep === 'IST' || arr === 'IST' ||
            (!uzbekAirports.includes(dep) || !uzbekAirports.includes(arr));

          const flightInfo = {
            flightNumber: `${flightMatch[1].toUpperCase()} ${flightMatch[2]}`,
            departure: dep,
            arrival: arr,
            type: isInternational ? 'INTERNATIONAL' : 'DOMESTIC'
          };

          // Check if already added
          const targetArray = isInternational ? flights.international : flights.domestic;
          const exists = targetArray.find(f =>
            f.flightNumber === flightInfo.flightNumber && f.departure === dep && f.arrival === arr
          );
          if (!exists) {
            targetArray.push(flightInfo);
          }
        }
      }
    }

    // Parse flights from structured table data with multiple flexible patterns
    const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];
    const monthMap = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OKT': '10', 'OCT': '10', 'NOV': '11',
      'DEC': '12', 'DEZ': '12'
    };

    const addFlightInfo = (flightInfo) => {
      const dep = flightInfo.departure;
      const arr = flightInfo.arrival;

      // FILTER: International flights = ONLY IST ↔ TAS routes (per requirements)
      const isIstTas = (dep === 'IST' && arr === 'TAS') || (dep === 'TAS' && arr === 'IST');
      // FILTER: Domestic flights = only within Uzbekistan
      const isDomestic = uzbekAirports.includes(dep) && uzbekAirports.includes(arr);

      // Skip flights that don't match our filter criteria
      if (!isIstTas && !isDomestic) {
        return; // Skip non-IST-TAS international and non-Uzbekistan domestic flights
      }

      flightInfo.type = isIstTas ? 'INTERNATIONAL' : 'DOMESTIC';

      const targetArray = isIstTas ? flights.international : flights.domestic;
      const existingIndex = targetArray.findIndex(f =>
        f.flightNumber === flightInfo.flightNumber && f.departure === dep && f.arrival === arr
      );
      if (existingIndex >= 0) {
        targetArray[existingIndex] = { ...targetArray[existingIndex], ...flightInfo };
      } else {
        targetArray.push(flightInfo);
      }
    };

    // Pattern 1: "TK 1884 15FEB IST - TAS 23:55 - 06:15" or "TK 1664 Fr, 03OKT HAM - IST 18:40 - 23:00"
    const pattern1 = /(TK|HY)\s*(\d{2,4})\s+(?:\w+[,.]?\s*)?(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;
    let match1;
    while ((match1 = pattern1.exec(text)) !== null) {
      const [, airline, num, dateStr, dep, arr, depTime, arrTime] = match1;
      const flightInfo = {
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime
      };
      const dateMatch = dateStr.match(/(\d{2})([A-Z]{3})/i);
      if (dateMatch) {
        const day = dateMatch[1];
        const month = monthMap[dateMatch[2].toUpperCase()] || '01';
        const year = new Date().getFullYear();
        flightInfo.date = `${year}-${month}-${day}`;
      }
      addFlightInfo(flightInfo);
    }

    // Pattern 2: "TK 1884 03.10.2025 FRA - IST 11:00 - 16:30" (German date format)
    const pattern2 = /(TK|HY)\s*(\d{2,4})\s+(\d{2})[.\/](\d{2})[.\/]?(\d{2,4})?\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;
    let match2;
    while ((match2 = pattern2.exec(text)) !== null) {
      const [, airline, num, day, month, yearPart, dep, arr, depTime, arrTime] = match2;
      const year = yearPart ? (yearPart.length === 2 ? '20' + yearPart : yearPart) : new Date().getFullYear().toString();
      addFlightInfo({
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime,
        date: `${year}-${month}-${day}`
      });
    }

    // Pattern 3: "TK 1884 FRA-IST 11:00-16:30" (no date, route with hyphen)
    const pattern3 = /(TK|HY)\s*(\d{2,4})\s+([A-Z]{3})[-–]([A-Z]{3})\s+(\d{2}:\d{2})[-–](\d{2}:\d{2})/gi;
    let match3;
    while ((match3 = pattern3.exec(text)) !== null) {
      const [, airline, num, dep, arr, depTime, arrTime] = match3;
      addFlightInfo({
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime
      });
    }

    // Pattern 4: "TK 1884 FRA IST" (basic route without times) - only if no other matches found
    if (flights.international.length === 0 && flights.domestic.length === 0) {
      const pattern4 = /(TK|HY)\s*(\d{2,4})\s+([A-Z]{3})\s+[-–]?\s*([A-Z]{3})/gi;
      let match4;
      while ((match4 = pattern4.exec(text)) !== null) {
        const [, airline, num, dep, arr] = match4;
        if (dep !== arr) { // Avoid matching non-route patterns
          addFlightInfo({
            flightNumber: `${airline.toUpperCase()} ${num}`,
            departure: dep,
            arrival: arr
          });
        }
      }
    }

    // Pattern 5: Look for flight tables by searching for lines with airport codes
    // Matches: "FRA - IST", "TAS-SKD", etc. and associates with nearby flight numbers
    const airportPairs = text.match(/([A-Z]{3})\s*[-–]\s*([A-Z]{3})/g) || [];
    const flightNumbers = text.match(/(TK|HY)\s*(\d{2,4})/gi) || [];

    // If we found flight numbers but no structured flights, try to pair them
    if (flights.international.length === 0 && flights.domestic.length === 0 && flightNumbers.length > 0) {
      for (const fnMatch of flightNumbers) {
        const [, airline, num] = fnMatch.match(/(TK|HY)\s*(\d{2,4})/i) || [];
        if (!airline || !num) continue;

        // Find the nearest airport pair in the text
        const fnIndex = text.indexOf(fnMatch);
        let nearestPair = null;
        let nearestDist = Infinity;

        for (const pair of airportPairs) {
          const pairIndex = text.indexOf(pair);
          const dist = Math.abs(fnIndex - pairIndex);
          if (dist < nearestDist && dist < 200) { // Within 200 chars
            nearestDist = dist;
            nearestPair = pair;
          }
        }

        if (nearestPair) {
          const [dep, arr] = nearestPair.split(/\s*[-–]\s*/);
          if (dep && arr && dep !== arr) {
            addFlightInfo({
              flightNumber: `${airline.toUpperCase()} ${num}`,
              departure: dep,
              arrival: arr
            });
          }
        }
      }
    }

    console.log(`PDF Import - Found flights: ${flights.international.length} international, ${flights.domestic.length} domestic`);
    console.log(`📋 Found ${vegetariansList.length} vegetarians, ${birthdaysMap.size} birthdays${globalRemark ? ', 1 global remark' : ''}`);

    if (tourists.length === 0) {
      return res.status(400).json({ error: 'No tourists found in PDF. Make sure PDF contains rooming list with Mr./Mrs. names.' });
    }

    // Helper function to parse individual remarks for a tourist
    const parseIndividualRemarks = (remarkText, tourist) => {
      const remarks = [];
      const lines = remarkText.split('\n');

      const lastNameLower = tourist.lastName.toLowerCase();
      const firstNameLower = tourist.firstName.toLowerCase();
      const lastNameFirstWord = lastNameLower.split(' ')[0]; // Define at function scope

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line === '//') continue;

        const lowerLine = line.toLowerCase();

        // Check if this line mentions the tourist (check first word of last name for "Dr. Baetgen" cases)
        const mentionsTourist = lowerLine.includes(lastNameFirstWord);

        if (mentionsTourist) {
          console.log(`   🔍 Found mention of ${tourist.fullName} in line: "${line}"`);

          // Helper function to extract info from a line
          const extractInfoFromLine = (checkLine, checkLower) => {
            // Extract earlier flight and arrival info
            // Support both DD.MM and DD.MM.YYYY formats
            if (checkLower.includes('earlier flight') || checkLower.includes('arrival on') || checkLower.includes('arrival:')) {
              const flightMatch = checkLine.match(/earlier flight[^\d]*(\d{2}\.\d{2}(?:\.\d{4})?)/i);
              const arrivalMatch = checkLine.match(/arrival[^\d]*(\d{2}\.\d{2}(?:\.\d{4})?)/i);

              if (flightMatch && arrivalMatch) {
                // Extract just DD.MM part
                const flightDate = flightMatch[1].substring(0, 5);
                const arrivalDate = arrivalMatch[1].substring(0, 5);
                remarks.push(`Flight: ${flightDate}, Arrival: ${arrivalDate}`);
                console.log(`      📋 Found flight ${flightDate}, arrival ${arrivalDate}`);
              } else if (arrivalMatch) {
                const arrivalDate = arrivalMatch[1].substring(0, 5);
                remarks.push(`Early arrival: ${arrivalDate}`);
                console.log(`      📋 Found early arrival ${arrivalDate}`);
              }

              // Extra nights request
              if (checkLower.includes('extra night') || checkLower.includes('book extra')) {
                remarks.push('Book extra nights');
              }
            }

            // Extract departure date
            if (checkLower.includes('departure on') || checkLower.includes('later departure') || checkLower.includes('departure:')) {
              const dateMatch = checkLine.match(/(?:departure[^\d]*)(\d{2}\.\d{2}(?:\.\d{4})?)/i);
              if (dateMatch) {
                const depDate = dateMatch[1].substring(0, 5);
                remarks.push(`Late departure: ${depDate}`);
                console.log(`      📋 Found late departure ${depDate}`);
              }
            }

            // Extract extra transfer request
            if (checkLower.includes('extra transfer') || checkLower.includes('need transfer')) {
              remarks.push('Extra transfer needed');
            }
          };

          // FIRST: Check the SAME line for arrival/departure info
          extractInfoFromLine(line, lowerLine);

          // THEN: Check next line(s) for additional information
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j].trim();
            const nextLowerLine = nextLine.toLowerCase();

            // Stop if we encounter another tourist name or section marker
            if (nextLine.match(/^(Mr\.|Mrs\.|Ms\.|SINGLE|TWIN|DOUBLE|Traveltogether)/i)) {
              break;
            }

            extractInfoFromLine(nextLine, nextLowerLine);

            j++;
            if (j - i > 3) break; // Don't look more than 3 lines ahead
          }
        }
      }

      return remarks;
    };

    // Helper function to parse DD.MM date string into Date object for current tour year
    const parseDateInTourYear = (dateStr, tourYear) => {
      if (!dateStr) return null;
      const match = dateStr.match(/(\d{2})\.(\d{2})/);
      if (!match) return null;

      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed

      return new Date(tourYear, month, day);
    };

    // Get tour year from tour start date
    const tourYear = tourStartDate ? parseInt(tourStartDate.split('.')[2], 10) : new Date().getFullYear();

    // Fetch first accommodation to use its checkout date for tourists with early arrival
    const firstAccommodation = await prisma.accommodation.findFirst({
      where: { bookingId: bookingIdInt },
      orderBy: { checkInDate: 'asc' }
    });

    // Now match tourists with additional information (vegetarians, birthdays, remarks)
    console.log('🔄 Matching tourists with additional information...');
    tourists.forEach(tourist => {
      const additionalInfo = [];

      // Initialize individual dates (will be set if found in remarks)
      tourist.checkInDate = null;
      tourist.checkOutDate = null;

      // Check if this tourist is vegetarian
      const matchedVeg = vegetariansList.find(vegName => {
        const vegLower = vegName.toLowerCase();
        const lastNameLower = tourist.lastName.toLowerCase();
        const firstNameLower = tourist.firstName.toLowerCase();
        return vegLower.includes(lastNameLower) && vegLower.includes(firstNameLower);
      });
      if (matchedVeg) {
        additionalInfo.push('Vegetarian');
        console.log(`   ✅ ${tourist.fullName} is vegetarian (matched: "${matchedVeg}")`);
      }

      // Check if this tourist has a birthday
      let birthdayDate = null;
      for (const [name, date] of birthdaysMap.entries()) {
        const nameLower = name.toLowerCase();
        const lastNameLower = tourist.lastName.toLowerCase();
        const firstNameLower = tourist.firstName.toLowerCase();
        if (nameLower.includes(lastNameLower) && nameLower.includes(firstNameLower)) {
          birthdayDate = date;
          console.log(`   🎂 ${tourist.fullName} has birthday: ${date} (matched: "${name}")`);
          break;
        }
      }
      if (birthdayDate) {
        additionalInfo.push(`Birthday: ${birthdayDate}`);
      }

      // Add additional info from PDF table column (if exists)
      if (tourist.additionalInfoFromTable && tourist.additionalInfoFromTable.trim() !== '' && tourist.additionalInfoFromTable !== '-') {
        const tableInfo = tourist.additionalInfoFromTable.trim();
        additionalInfo.push(tableInfo);
        console.log(`   📋 ${tourist.fullName} has table additional info: "${tableInfo}"`);

        // Parse dates from additionalInfoFromTable (e.g., "Flight: 09.10, Arrival: 10.10")
        const tableInfoLower = tableInfo.toLowerCase();

        // Extract Arrival date (when tourist arrives in Uzbekistan) → checkInDate
        const arrivalTableMatch = tableInfo.match(/Arrival[:\s]*(\d{2}\.\d{2})/i);
        if (arrivalTableMatch) {
          const arrivalDate = parseDateInTourYear(arrivalTableMatch[1], tourYear);
          if (arrivalDate) {
            tourist.checkInDate = arrivalDate;
            console.log(`   📅 ${tourist.fullName} arrival from table: ${arrivalTableMatch[1]} → ${arrivalDate}`);
          }
        }

        // Extract Flight date (when flight departs) - store as separate info but also consider for early arrival
        const flightTableMatch = tableInfo.match(/Flight[:\s]*(\d{2}\.\d{2})/i);
        if (flightTableMatch && !tourist.checkInDate) {
          // If no explicit Arrival but Flight exists, tourist might arrive next day
          // For now, just log it - the arrival date should be explicit
          console.log(`   ✈️ ${tourist.fullName} flight date from table: ${flightTableMatch[1]}`);
        }

        // Extract Late departure date → checkOutDate
        const departureTableMatch = tableInfo.match(/(?:departure|depart)[:\s]*(\d{2}\.\d{2})/i);
        if (departureTableMatch) {
          const departureDate = parseDateInTourYear(departureTableMatch[1], tourYear);
          if (departureDate) {
            tourist.checkOutDate = departureDate;
            console.log(`   📅 ${tourist.fullName} departure from table: ${departureTableMatch[1]} → ${departureDate}`);
          }
        }

        // Check for early arrival pattern
        const earlyArrivalMatch = tableInfo.match(/(?:early arrival|earlier arrival)[:\s]*(\d{2}\.\d{2})/i);
        if (earlyArrivalMatch && !tourist.checkInDate) {
          const arrivalDate = parseDateInTourYear(earlyArrivalMatch[1], tourYear);
          if (arrivalDate) {
            tourist.checkInDate = arrivalDate;
            console.log(`   📅 ${tourist.fullName} early arrival from table: ${earlyArrivalMatch[1]} → ${arrivalDate}`);
          }
        }
      }

      // Parse individual remarks from global remark
      if (globalRemark) {
        const individualRemarks = parseIndividualRemarks(globalRemark, tourist);
        if (individualRemarks.length > 0) {
          console.log(`   📝 ${tourist.fullName} remarks: ${individualRemarks.join(', ')}`);
          additionalInfo.push(...individualRemarks);

          // Extract individual arrival/departure dates from remarks
          individualRemarks.forEach(remark => {
            console.log(`   🔍 Checking remark: "${remark}"`);

            // Check for arrival date: "Flight: 09.10, Arrival: 10.10" or "Early arrival: 10.10"
            const arrivalMatch = remark.match(/Arrival:\s*(\d{2}\.\d{2})/i) || remark.match(/Early arrival:\s*(\d{2}\.\d{2})/i);
            if (arrivalMatch) {
              console.log(`   ✓ Arrival match found: ${arrivalMatch[1]}`);
              const arrivalDate = parseDateInTourYear(arrivalMatch[1], tourYear);
              if (arrivalDate) {
                tourist.checkInDate = arrivalDate;
                console.log(`   📅 ${tourist.fullName} custom arrival: ${arrivalMatch[1]} → ${arrivalDate}`);
              }
            }

            // Check for departure date: "Late departure: 25.10"
            const departureMatch = remark.match(/Late departure:\s*(\d{2}\.\d{2})/i);
            if (departureMatch) {
              const departureDate = parseDateInTourYear(departureMatch[1], tourYear);
              if (departureDate) {
                tourist.checkOutDate = departureDate;
                console.log(`   📅 ${tourist.fullName} custom departure: ${departureMatch[1]}`);
              }
            }
          });
        }
      }

      // If tourist has custom check-in but no custom check-out, use first accommodation's checkout date
      if (tourist.checkInDate && !tourist.checkOutDate) {
        if (firstAccommodation && firstAccommodation.checkOutDate) {
          tourist.checkOutDate = firstAccommodation.checkOutDate;
          const checkoutDate = new Date(firstAccommodation.checkOutDate);
          const formattedDate = `${String(checkoutDate.getDate()).padStart(2, '0')}.${String(checkoutDate.getMonth() + 1).padStart(2, '0')}.${checkoutDate.getFullYear()}`;
          console.log(`   📅 ${tourist.fullName} using first accommodation checkout date: ${formattedDate}`);
        } else if (tourEndDate) {
          // Fallback to tour end date if no accommodation found
          const tourEnd = parseDateInTourYear(tourEndDate.split('.')[0] + '.' + tourEndDate.split('.')[1], tourYear);
          if (tourEnd) {
            tourist.checkOutDate = tourEnd;
            console.log(`   📅 ${tourist.fullName} using tour end date for checkout: ${tourEndDate}`);
          }
        }
      }

      // Update tourist remarks
      tourist.remarks = additionalInfo.length > 0 ? additionalInfo.join('\n') : '-';
    });

    // 🔄 FULL REPLACE MODE: Replace all tourists with PDF data (update matched, delete ALL unmatched, create new)
    console.log(`🔍 FULL REPLACE: Processing ${tourists.length} tourists from PDF...`);

    let updatedCount = 0;
    let createdCount = 0;
    let deletedCount = 0;

    // Fetch all existing tourists for this booking
    const existingTourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt }
    });

    console.log(`📋 Found ${existingTourists.length} existing tourists in database`);

    // Track which tourists were matched from PDF
    const matchedTouristIds = new Set();

    // Update or create tourists from PDF
    for (const pdfTourist of tourists) {
      // Try to find existing tourist by matching name
      const existingTourist = existingTourists.find(t => {
        const existingFullName = t.fullName?.toLowerCase().trim() || '';
        const pdfFullName = pdfTourist.fullName?.toLowerCase().trim() || '';

        // Match by full name
        if (existingFullName === pdfFullName) return true;

        // Fallback: match by first and last name
        const existingFirst = t.firstName?.toLowerCase().trim() || '';
        const existingLast = t.lastName?.toLowerCase().trim() || '';
        const pdfFirst = pdfTourist.firstName?.toLowerCase().trim() || '';
        const pdfLast = pdfTourist.lastName?.toLowerCase().trim() || '';

        return existingFirst === pdfFirst && existingLast === pdfLast;
      });

      if (existingTourist) {
        // Mark as matched
        matchedTouristIds.add(existingTourist.id);

        // Update existing tourist - ONLY update rooming list specific fields
        const updateData = {
          roomNumber: pdfTourist.roomNumber,
          accommodation: pdfTourist.tourType,
          roomPreference: pdfTourist.roomType
        };

        // Only update checkIn/checkOut dates if they are provided in PDF
        if (pdfTourist.checkInDate) {
          updateData.checkInDate = new Date(pdfTourist.checkInDate);
        }
        if (pdfTourist.checkOutDate) {
          updateData.checkOutDate = new Date(pdfTourist.checkOutDate);
        }

        // Append PDF remarks to existing remarks (don't overwrite)
        if (pdfTourist.remarks && pdfTourist.remarks !== '-') {
          const existingRemarks = existingTourist.remarks || '';
          const pdfRemarks = pdfTourist.remarks;

          // Only append if PDF remarks are not already in existing remarks
          if (!existingRemarks.includes(pdfRemarks)) {
            updateData.remarks = existingRemarks
              ? `${existingRemarks}\n${pdfRemarks}`
              : pdfRemarks;
          }
        }

        await prisma.tourist.update({
          where: { id: existingTourist.id },
          data: updateData
        });

        console.log(`   ✅ Updated: ${pdfTourist.fullName} (Room: ${pdfTourist.roomNumber})`);
        updatedCount++;
      } else {
        // Create new tourist (only if not found in existing list)
        const touristData = {
          bookingId: bookingIdInt,
          fullName: pdfTourist.fullName,
          firstName: pdfTourist.firstName || '',
          lastName: pdfTourist.lastName || '',
          gender: pdfTourist.gender || 'unknown',
          roomPreference: pdfTourist.roomType,
          roomNumber: pdfTourist.roomNumber,
          accommodation: pdfTourist.tourType,
          remarks: pdfTourist.remarks && pdfTourist.remarks !== '-' ? pdfTourist.remarks : null
        };

        // Add dates if available
        if (pdfTourist.checkInDate) {
          touristData.checkInDate = new Date(pdfTourist.checkInDate);
        }
        if (pdfTourist.checkOutDate) {
          touristData.checkOutDate = new Date(pdfTourist.checkOutDate);
        }

        const created = await prisma.tourist.create({ data: touristData });
        matchedTouristIds.add(created.id); // Mark new tourist as matched
        console.log(`   ➕ Created new: ${pdfTourist.fullName} (Room: ${pdfTourist.roomNumber})`);
        createdCount++;
      }
    }

    // Delete tourists that are NOT in the PDF (were not matched)
    // FULL REPLACE: Delete ALL unmatched tourists (including those with passport/country)
    const unmatchedTourists = existingTourists.filter(t => !matchedTouristIds.has(t.id));

    if (unmatchedTourists.length > 0) {
      console.log(`🗑️ FULL REPLACE: Deleting ${unmatchedTourists.length} unmatched tourists...`);

      for (const tourist of unmatchedTourists) {
        console.log(`   🗑️  Deleting: ${tourist.fullName}`);

        // Delete related data first (foreign key constraints)
        await prisma.accommodationRoomingList.deleteMany({
          where: { touristId: tourist.id }
        });
        await prisma.touristRoomAssignment.deleteMany({
          where: { touristId: tourist.id }
        });

        await prisma.tourist.delete({
          where: { id: tourist.id }
        });
        deletedCount++;
      }
    }

    // Delete old flights and flight sections only (not tourists)
    console.log('🗑️  Updating flights data...');
    await prisma.$transaction([
      prisma.flight.deleteMany({ where: { bookingId: bookingIdInt } }),
      prisma.flightSection.deleteMany({ where: { bookingId: bookingIdInt } })
    ]);

    console.log(`✅ FULL REPLACE complete: ${updatedCount} updated, ${createdCount} created, ${deletedCount} deleted`);

    // Update booking with extracted tour dates
    if (tourStartDate && tourEndDate) {
      try {
        // Convert DD.MM.YYYY to Date object
        const [startDay, startMonth, startYear] = tourStartDate.split('.');
        const [endDay, endMonth, endYear] = tourEndDate.split('.');

        const departureDate = new Date(`${startYear}-${startMonth}-${startDay}`);
        const endDate = new Date(`${endYear}-${endMonth}-${endDay}`);

        await prisma.booking.update({
          where: { id: bookingIdInt },
          data: {
            departureDate,
            endDate
          }
        });

        console.log(`✓ Updated booking with tour dates: ${tourStartDate} to ${tourEndDate}`);
      } catch (dateError) {
        console.error('Error updating booking dates:', dateError);
        // Continue with import even if date update fails
      }
    }

    // Create flights
    const allFlights = [
      ...flights.international.map((f, i) => ({ ...f, sortOrder: i + 1 })),
      ...flights.domestic.map((f, i) => ({ ...f, sortOrder: i + 1 }))
    ];

    if (allFlights.length > 0) {
      await prisma.flight.createMany({
        data: allFlights.map(f => ({
          bookingId: bookingIdInt,
          type: f.type,
          flightNumber: f.flightNumber,
          departure: f.departure,
          arrival: f.arrival,
          date: f.date ? new Date(f.date) : null,
          departureTime: f.departureTime || null,
          arrivalTime: f.arrivalTime || null,
          sortOrder: f.sortOrder
        }))
      });
    }

    // Extract and save raw flight sections for display
    const flightSections = [];

    // Extract raw International Flights section (IST ↔ TAS only)
    const internationalRawContent = extractRawFlightSection(text, 'INTERNATIONAL', uzbekAirports);
    if (internationalRawContent || flights.international.length > 0) {
      flightSections.push({
        bookingId: bookingIdInt,
        type: 'INTERNATIONAL',
        rawContent: internationalRawContent || formatFlightListAsRaw(flights.international),
        sourceFileName: req.file.originalname || 'imported.pdf',
        sortOrder: 1
      });
    }

    // Extract raw Domestic Flights section (Uzbekistan internal only)
    const domesticRawContent = extractRawFlightSection(text, 'DOMESTIC', uzbekAirports);
    if (domesticRawContent || flights.domestic.length > 0) {
      flightSections.push({
        bookingId: bookingIdInt,
        type: 'DOMESTIC',
        rawContent: domesticRawContent || formatFlightListAsRaw(flights.domestic),
        sourceFileName: req.file.originalname || 'imported.pdf',
        sortOrder: 2
      });
    }

    // Save flight sections
    if (flightSections.length > 0) {
      await prisma.flightSection.createMany({
        data: flightSections
      });
    }

    console.log(`PDF Import - Saved ${flightSections.length} flight sections`);

    // Update booking pax count
    await updateBookingPaxCount(bookingIdInt);

    // Return updated data
    const updatedTourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      orderBy: [{ accommodation: 'asc' }, { lastName: 'asc' }]
    });

    const updatedFlights = await prisma.flight.findMany({
      where: { bookingId: bookingIdInt },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }]
    });

    res.json({
      success: true,
      message: `✅ Full replace: ${updatedCount} updated, ${createdCount} created, ${deletedCount} deleted`,
      tourists: updatedTourists,
      flights: updatedFlights,
      summary: {
        touristsImported: updatedCount + createdCount,
        touristsUpdated: updatedCount,
        touristsCreated: createdCount,
        touristsDeleted: deletedCount,
        internationalFlights: flights.international.length,
        domesticFlights: flights.domestic.length,
        uzbekistanCount: tourists.filter(t => t.tourType === 'Uzbekistan').length,
        turkmenistanCount: tourists.filter(t => t.tourType !== 'Uzbekistan').length
      }
    });
  } catch (error) {
    console.error('Error importing rooming list PDF:', error);
    res.status(500).json({ error: 'Error importing PDF: ' + error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function updateBookingPaxCount(bookingId) {
  const count = await prisma.tourist.count({
    where: { bookingId }
  });

  // Get all tourists to calculate room counts
  const tourists = await prisma.tourist.findMany({
    where: { bookingId },
    select: { id: true, roomPreference: true, roomNumber: true }
  });

  // Check if any tourist has roomNumber set (not null and not "null" string)
  const hasRoomNumbers = tourists.some(t => t.roomNumber && t.roomNumber !== 'null');

  let roomsDbl, roomsTwn, roomsSngl;

  if (hasRoomNumbers) {
    // Count unique room numbers
    const uniqueRooms = {
      DBL: new Set(),
      TWN: new Set(),
      SNGL: new Set()
    };

    tourists.forEach(tourist => {
      if (tourist.roomNumber && tourist.roomNumber !== 'null') {
        const room = tourist.roomNumber.toUpperCase();
        if (room.startsWith('DBL')) {
          uniqueRooms.DBL.add(room);
        } else if (room.startsWith('SNGL') || room.startsWith('SGL')) {
          uniqueRooms.SNGL.add(room);
        } else if (room.startsWith('TWN')) {
          uniqueRooms.TWN.add(room);
        }
      }
    });

    roomsDbl = uniqueRooms.DBL.size;
    roomsTwn = uniqueRooms.TWN.size;
    roomsSngl = uniqueRooms.SNGL.size;
  } else {
    // Fallback: count by roomPreference
    let dblCount = 0;
    let twnCount = 0;
    let snglCount = 0;

    tourists.forEach(tourist => {
      const roomPref = (tourist.roomPreference || '').toUpperCase().trim();

      // DZ or DBL = Double room
      if (roomPref === 'DZ' || roomPref === 'DBL' || roomPref.includes('DBL') || roomPref.includes('DOUBLE')) {
        dblCount++;
      }
      // EZ or SNGL = Single room
      else if (roomPref === 'EZ' || roomPref === 'SNGL' || roomPref === 'SGL' || roomPref.includes('SNGL') || roomPref.includes('SINGLE')) {
        snglCount++;
      }
      // TWN = Twin room
      else if (roomPref === 'TWN' || roomPref.includes('TWN') || roomPref.includes('TWIN')) {
        twnCount++;
      }
    });

    // Calculate actual room numbers
    // If there's an odd number of DZ (single DZ without pair), count it as 0.5 TWN
    console.log(`📊 Room calculation: dblCount=${dblCount}, twnCount=${twnCount}, snglCount=${snglCount}`);

    if (dblCount % 2 === 1) {
      // Odd number of DZ: one person alone, rest in pairs
      roomsDbl = Math.floor(dblCount / 2); // Full DBL rooms for pairs
      roomsTwn = Math.ceil(twnCount / 2) + 0.5; // Regular TWN rooms + 0.5 for single DZ
      console.log(`✅ ODD DZ count: roomsDbl=${roomsDbl}, roomsTwn=${roomsTwn} (includes 0.5 for single DZ)`);
    } else {
      // Even number of DZ: all in pairs
      roomsDbl = dblCount / 2;
      roomsTwn = Math.ceil(twnCount / 2);
      console.log(`✅ EVEN DZ count: roomsDbl=${roomsDbl}, roomsTwn=${roomsTwn}`);
    }
    roomsSngl = snglCount;
    console.log(`📌 Final rooms: DBL=${roomsDbl}, TWN=${roomsTwn}, SNGL=${roomsSngl}`);
  }

  // Auto-set status based on PAX count
  let status = 'PENDING';
  if (count >= 6) {
    status = 'CONFIRMED';
  } else if (count === 4 || count === 5) {
    status = 'IN_PROGRESS';
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      pax: count,
      status: status,
      roomsDbl: roomsDbl,
      roomsTwn: roomsTwn,
      roomsSngl: roomsSngl
    }
  });

  // Reset all accommodation totalCost to 0 so backend will auto-recalculate based on new rooming list
  await prisma.accommodation.updateMany({
    where: { bookingId: bookingId },
    data: { totalCost: 0 }
  });
  console.log(`🔄 Reset accommodation costs for booking ${bookingId} - will auto-recalculate on next request`);
}

/**
 * Extract raw flight section content from PDF text
 * @param {string} text - Full PDF text
 * @param {string} type - 'INTERNATIONAL' or 'DOMESTIC'
 * @param {string[]} uzbekAirports - List of Uzbekistan airport codes
 * @returns {string|null} Raw content or null
 */
function extractRawFlightSection(text, type, uzbekAirports) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const relevantLines = [];

  // Headers that indicate flight sections
  const internationalHeaders = [
    /international\s*fl[iüu]gh?te?s?/i,
    /internationale?\s*fl[üu]ge/i,
    /IST\s*[-–→]\s*TAS|TAS\s*[-–→]\s*IST/i
  ];
  const domesticHeaders = [
    /domestic\s*fl[iüu]gh?te?s?/i,
    /inlands?fl[üu]ge/i,
    /interne?\s*fl[üu]ge/i
  ];

  let inTargetSection = false;
  let sectionDepth = 0;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check section headers
    const isIntlHeader = internationalHeaders.some(p => p.test(line));
    const isDomHeader = domesticHeaders.some(p => p.test(line));

    if (type === 'INTERNATIONAL' && isIntlHeader) {
      inTargetSection = true;
      relevantLines.push(line);
      continue;
    } else if (type === 'DOMESTIC' && isDomHeader) {
      inTargetSection = true;
      relevantLines.push(line);
      continue;
    }

    // Exit section on next major header
    if (inTargetSection && (
      /^(?:DOUBLE|TWIN|SINGLE|TOTAL|PAX|Additional|Remark:|Name|Tour:)/i.test(line) ||
      (type === 'INTERNATIONAL' && isDomHeader) ||
      (type === 'DOMESTIC' && isIntlHeader)
    )) {
      inTargetSection = false;
    }

    // Collect lines in target section
    if (inTargetSection) {
      relevantLines.push(line);
      continue;
    }

    // Also detect flight lines by pattern
    const flightPattern = /(TK|HY)\s*(\d{2,4}).*?([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/i;
    const flightMatch = line.match(flightPattern);
    if (flightMatch) {
      const dep = flightMatch[3];
      const arr = flightMatch[4];

      if (type === 'INTERNATIONAL') {
        // Only IST ↔ TAS
        if ((dep === 'IST' && arr === 'TAS') || (dep === 'TAS' && arr === 'IST')) {
          relevantLines.push(line);
        }
      } else if (type === 'DOMESTIC') {
        // Only within Uzbekistan
        if (uzbekAirports.includes(dep) && uzbekAirports.includes(arr)) {
          relevantLines.push(line);
        }
      }
    }
  }

  // Return unique lines
  const uniqueLines = [...new Set(relevantLines)];
  return uniqueLines.length > 0 ? uniqueLines.join('\n') : null;
}

/**
 * Format structured flight list as raw text for display
 * @param {object[]} flights - Array of flight objects
 * @returns {string} Formatted text
 */
function formatFlightListAsRaw(flights) {
  if (!flights || flights.length === 0) return '';

  return flights.map(f => {
    const parts = [f.flightNumber || ''];
    if (f.date) {
      const d = new Date(f.date);
      parts.push(d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    }
    parts.push(`${f.departure} → ${f.arrival}`);
    if (f.departureTime) {
      parts.push(`${f.departureTime}${f.arrivalTime ? ' - ' + f.arrivalTime : ''}`);
    }
    return parts.filter(p => p).join('  ');
  }).join('\n');
}

// ============================================
// PDF PREVIEW (HTML for printing)
// ============================================

console.log('🔧 Registering PDF preview route: /:bookingId/rooming-list-preview');

// Remove authenticate middleware for preview - no auth required for PDF view
router.get('/:bookingId/rooming-list-preview', async (req, res) => {
  console.log('📄 PDF Preview Request - BookingId:', req.params.bookingId);
  try {
    const { bookingId } = req.params;
    const bookingIdInt = parseInt(bookingId);
    console.log('✅ Generating preview for booking:', bookingIdInt);

    // Fetch booking with all necessary data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdInt },
      include: {
        tourType: true,
        guide: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch tourists
    const touristsRaw = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      include: {
        roomAssignments: {
          include: {
            bookingRoom: {
              include: {
                hotel: true,
                roomType: true
              }
            }
          }
        }
      },
      orderBy: [{ lastName: 'asc' }]
    });

    // Sort tourists: Uzbekistan first, then Turkmenistan
    const tourists = touristsRaw.sort((a, b) => {
      const aAccommodation = (a.accommodation || '').toLowerCase();
      const bAccommodation = (b.accommodation || '').toLowerCase();

      const aIsUzbekistan = aAccommodation.includes('uzbek') || aAccommodation.includes('узбек');
      const bIsUzbekistan = bAccommodation.includes('uzbek') || bAccommodation.includes('узбек');
      const aIsTurkmenistan = aAccommodation.includes('turkmen') || aAccommodation.includes('туркмен');
      const bIsTurkmenistan = bAccommodation.includes('turkmen') || bAccommodation.includes('туркмен');

      // UZ first (return -1), then TM (return 1)
      if (aIsUzbekistan && !bIsUzbekistan) return -1;
      if (!aIsUzbekistan && bIsUzbekistan) return 1;
      if (aIsTurkmenistan && !bIsTurkmenistan) return 1;
      if (!aIsTurkmenistan && bIsTurkmenistan) return -1;

      // If same type, sort by lastName
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

    // Helper function to format dates
    const formatDisplayDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const bookingNumber = booking.bookingNumber || 'N/A';
    const country = 'Германия'; // Default country
    const arrivalDate = formatDisplayDate(booking.departureDate);
    const departureDate = formatDisplayDate(booking.endDate);
    const currentDate = formatDisplayDate(new Date().toISOString());
    const totalPax = tourists.length;

    // Calculate room counts
    const dblRooms = tourists.filter(t => ['DBL', 'DOUBLE', 'DZ'].includes(t.roomPreference)).length / 2;
    const twnRooms = tourists.filter(t => ['TWN', 'TWIN'].includes(t.roomPreference)).length / 2;
    const snglRooms = tourists.filter(t => ['SNGL', 'SINGLE', 'EZ'].includes(t.roomPreference)).length;

    const hotelName = 'Hotel Name'; // You can get this from accommodations if available

    // For rooming-list-preview (whole tour), always use "Первый заезд/выезд"
    const arrivalHeader = 'Первый<br>заезд';
    const departureHeader = 'Первый<br>выезд';

    // Load logo as base64
    const logoPath = path.join(__dirname, '../../uploads/logo.png');
    let logoDataUrl = '';
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.warn('Could not load logo:', err);
    }

    // Build tourist rows HTML
    // Group tourists by room number for TWN and DBL
    const roomGroups = {};
    const singleTourists = [];

    tourists.forEach(tourist => {
      let roomCategory = tourist.roomPreference || '';
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

    // Sort room numbers
    const sortedRoomNumbers = Object.keys(roomGroups).sort();

    // Create combined array
    const allEntries = [];
    sortedRoomNumbers.forEach(roomNumber => {
      allEntries.push({
        type: 'group',
        tourists: roomGroups[roomNumber]
      });
    });
    singleTourists.forEach(tourist => {
      allEntries.push({
        type: 'single',
        tourist
      });
    });

    let touristRows = '';
    let counter = 0;

    allEntries.forEach(entry => {
      if (entry.type === 'group') {
        const group = entry.tourists;
        group.forEach((t, groupIndex) => {
          counter++;
          const isFirstInGroup = groupIndex === 0;
          const name = t.fullName || `${t.lastName}, ${t.firstName}`;
          let roomCategory = t.roomPreference || '';
          if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
          if (roomCategory === 'TWIN') roomCategory = 'TWN';
          if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

          // Determine placement (Uzbekistan or Turkmenistan)
          const placement = t.accommodation || '';
          const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
          const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек') || placement === 'uz';
          const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

          // Get accommodation-specific dates if available
          const roomingEntry = roomingListEntries.find(e => e.touristId === t.id);
          const touristCheckInDate = roomingEntry?.checkInDate || t.checkInDate;
          const touristCheckOutDate = roomingEntry?.checkOutDate || t.checkOutDate;

          // Get remarks only from roomAssignments.notes and custom dates
          const remarksLines = [];

          // Add custom check-in date if exists
          if (touristCheckInDate) {
            remarksLines.push(`Заезд: ${formatDisplayDate(touristCheckInDate)}`);
          }

          // Add room assignment notes (from Rooming list tab)
          if (t.roomAssignments && t.roomAssignments.length > 0 && t.roomAssignments[0].notes) {
            // Filter out "PAX booked half double room" messages
            const notes = t.roomAssignments[0].notes;
            if (!notes.includes('PAX booked half double room') && !notes.includes('no roommate found')) {
              remarksLines.push(notes);
            }
          }

          let displayArrival = touristCheckInDate ? formatDisplayDate(touristCheckInDate) : arrivalDate;
          let displayDeparture = touristCheckOutDate ? formatDisplayDate(touristCheckOutDate) : departureDate;
          let customDeparture = false;

          // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier (if isTurkmenistanHotel is defined)
          if (typeof isTurkmenistanHotel !== 'undefined' && isTurkmenistanHotel && isUzbekistan) {
            console.log(`   🟢 PDF: UZ tourist in TM hotel: ${name}`);

            // Calculate departure date 1 day earlier
            const depDate = new Date(touristCheckOutDate || (typeof accommodation !== 'undefined' ? accommodation.checkOutDate : departureDate));
            const originalDepDate = new Date(depDate);
            depDate.setDate(depDate.getDate() - 1);
            displayDeparture = formatDisplayDate(depDate.toISOString());
            customDeparture = true;

            console.log(`      Original departure: ${originalDepDate.toISOString().split('T')[0]}`);
            console.log(`      Adjusted departure: ${depDate.toISOString().split('T')[0]}`);

            // Calculate nights
            const arrDate = new Date(touristCheckInDate || (typeof accommodation !== 'undefined' ? accommodation.checkInDate : arrivalDate));
            const nights = Math.ceil((depDate - arrDate) / (1000 * 60 * 60 * 24));
            remarksLines.push(`${nights} Nights`);

            console.log(`      Nights: ${nights}, Remarks: "${nights} Nights"`);
          }

          const remarks = remarksLines.filter(Boolean).join('\n');
          const rowBgColor = (touristCheckInDate || touristCheckOutDate || customDeparture) ? '#fffacd' : '';

          touristRows += `
        <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${touristCheckInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${customDeparture || touristCheckOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          ${isFirstInGroup ? `<td rowspan="${group.length}" style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;vertical-align:middle;">${roomCategory}</td>` : ''}
        </tr>
      `;
        });
      } else if (entry.type === 'single') {
        // Handle single tourists
        counter++;
        const t = entry.tourist;
        const name = t.fullName || `${t.lastName}, ${t.firstName}`;
        let roomCategory = t.roomPreference || '';
        if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
        if (roomCategory === 'TWIN') roomCategory = 'TWN';
        if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

        // Determine placement (Uzbekistan or Turkmenistan)
        const placement = t.accommodation || '';
        const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
        const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек') || placement === 'uz';
        const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

        // Get accommodation-specific dates if available
        const roomingEntry = roomingListEntries.find(e => e.touristId === t.id);
        const touristCheckInDate = roomingEntry?.checkInDate || t.checkInDate;
        const touristCheckOutDate = roomingEntry?.checkOutDate || t.checkOutDate;

        // Get remarks only from roomAssignments.notes and custom dates
        const remarksLines = [];

        // Add custom check-in date if exists
        if (touristCheckInDate) {
          remarksLines.push(`Заезд: ${formatDisplayDate(touristCheckInDate)}`);
        }

        // Add room assignment notes (from Rooming list tab)
        if (t.roomAssignments && t.roomAssignments.length > 0 && t.roomAssignments[0].notes) {
          // Filter out "PAX booked half double room" messages
          const notes = t.roomAssignments[0].notes;
          if (!notes.includes('PAX booked half double room') && !notes.includes('no roommate found')) {
            remarksLines.push(notes);
          }
        }

        let displayArrival = touristCheckInDate ? formatDisplayDate(touristCheckInDate) : arrivalDate;
        let displayDeparture = touristCheckOutDate ? formatDisplayDate(touristCheckOutDate) : departureDate;
        let customDeparture = false;

        // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier (if isTurkmenistanHotel is defined)
        if (typeof isTurkmenistanHotel !== 'undefined' && isTurkmenistanHotel && isUzbekistan) {
          console.log(`   🟢 PDF: UZ tourist in TM hotel: ${name}`);

          // Calculate departure date 1 day earlier
          const depDate = new Date(touristCheckOutDate || (typeof accommodation !== 'undefined' ? accommodation.checkOutDate : departureDate));
          const originalDepDate = new Date(depDate);
          depDate.setDate(depDate.getDate() - 1);
          displayDeparture = formatDisplayDate(depDate.toISOString());
          customDeparture = true;

          console.log(`      Original departure: ${originalDepDate.toISOString().split('T')[0]}`);
          console.log(`      Adjusted departure: ${depDate.toISOString().split('T')[0]}`);

          // Calculate nights
          const arrDate = new Date(touristCheckInDate || (typeof accommodation !== 'undefined' ? accommodation.checkInDate : arrivalDate));
          const nights = Math.ceil((depDate - arrDate) / (1000 * 60 * 60 * 24));
          remarksLines.push(`${nights} Nights`);

          console.log(`      Nights: ${nights}, Remarks: "${nights} Nights"`);
        }

        const remarks = remarksLines.filter(Boolean).join('\n');
        const rowBgColor = (touristCheckInDate || touristCheckOutDate || customDeparture) ? '#fffacd' : '';

        touristRows += `
        <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${touristCheckInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${customDeparture || touristCheckOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomCategory}</td>
        </tr>
      `;
      }
    });

    // Build HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          @page {
            /* Remove browser headers and footers */
            margin-top: 0;
            margin-bottom: 0;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
          }
          .action-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #2c3e50;
            padding: 12px 20px;
            display: flex;
            gap: 10px;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
          }
          .action-bar button {
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-print {
            background: #3498db;
            color: white;
          }
          .btn-print:hover {
            background: #2980b9;
          }
          .btn-close {
            background: #95a5a6;
            color: white;
          }
          .btn-close:hover {
            background: #7f8c8d;
          }
          .content-wrapper {
            margin-top: 60px;
          }
          @media print {
            .action-bar {
              display: none !important;
            }
            .content-wrapper {
              margin-top: 0 !important;
            }
            /* Force background colors to print */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
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
          .date-hotel-row {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0 5px 0;
          }
          .date-hotel-row td {
            border: none;
            padding: 5px;
            font-size: 9pt;
            color: #333;
            vertical-align: top;
          }
          .date-cell {
            text-align: left;
            width: 50%;
          }
          .hotel-cell {
            text-align: right;
            width: 50%;
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
        <!-- Action Bar (hidden when printing) -->
        <div class="action-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить как PDF</button>
          <button class="btn-close" onclick="window.close()">✕ Закрыть</button>
          <div style="position: absolute; right: 20px; color: white; font-size: 11px; opacity: 0.9;">
            💡 В диалоге печати отключите "Верхние и нижние колонтитулы"
          </div>
        </div>

        <!-- Main Content -->
        <div class="content-wrapper">
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

        <!-- Date and Hotel Info -->
        <table class="date-hotel-row">
          <tr>
            <td class="date-cell">
              <strong>Дата:</strong> ${currentDate}
            </td>
            <td class="hotel-cell">
              <strong>Директору гостиницы</strong><br>
              <strong>${hotelName}</strong>
            </td>
          </tr>
        </table>

        <!-- ЗАЯВКА Title with Booking Number -->
        <div class="zayvka-title">ЗАЯВКА ${bookingNumber}</div>

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
              <th>${arrivalHeader}</th>
              <th>${departureHeader}</th>
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
              <td>${Math.floor(dblRooms)}</td>
              <td>${Math.floor(twnRooms)}</td>
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
              <th style="width:30%">ФИО</th>
              <th style="width:12%">Дата заезда</th>
              <th style="width:12%">дата выезда</th>
              <th style="width:8%">Размещение</th>
              <th>Дополнительная<br>информация</th>
              <th style="width:10%">Категория<br>номера</th>
            </tr>
          </thead>
          <tbody>
            ${touristRows}
          </tbody>
        </table>

        <!-- Footer Text -->
        <div class="footer-text">Оплату гости производят на месте.</div>

        <!-- Signature Table -->
        <table class="signature-table">
          <tr>
            <td style="width:40%"><strong>Директор ООО «ORIENT INSIGHT»</strong></td>
            <td style="width:40%;text-align:center">_________________________</td>
            <td style="width:20%;text-align:center"><strong>Милиев С.Р.</strong></td>
          </tr>
        </table>
        </div><!-- End content-wrapper -->
      </body>
      </html>
    `;

    // Send HTML for browser preview and printing
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);

  } catch (error) {
    console.error('PDF preview error:', error);
    res.status(500).json({ error: 'Failed to generate preview: ' + error.message });
  }
});

// ============================================
// HOTEL REQUEST PREVIEW (for specific hotel/accommodation)
// ============================================

console.log('🔧 Registering hotel request preview route: /:bookingId/hotel-request-preview/:accommodationId');

// Remove authenticate middleware for preview - no auth required for PDF view
router.get('/:bookingId/hotel-request-preview/:accommodationId', async (req, res) => {
  console.log('📄 Hotel Request Preview - BookingId:', req.params.bookingId, 'AccommodationId:', req.params.accommodationId);
  try {
    const { bookingId, accommodationId } = req.params;
    const bookingIdInt = parseInt(bookingId);
    const accommodationIdInt = parseInt(accommodationId);
    console.log('✅ Generating hotel request for booking:', bookingIdInt, 'accommodation:', accommodationIdInt);

    // Fetch booking with all necessary data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdInt },
      include: {
        tourType: true,
        guide: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch specific accommodation with hotel and room details
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationIdInt },
      include: {
        hotel: {
          include: {
            city: true
          }
        },
        rooms: true
      }
    });

    if (!accommodation) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }

    // Fetch accommodation-specific rooming list entries
    const roomingListEntries = await prisma.accommodationRoomingList.findMany({
      where: { accommodationId: accommodationIdInt },
      include: {
        tourist: true
      }
    });

    // Fetch all tourists for this booking
    const allTourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      include: {
        roomAssignments: {
          include: {
            bookingRoom: {
              include: {
                hotel: true,
                roomType: true
              }
            }
          }
        }
      },
      orderBy: [{ lastName: 'asc' }]
    });

    // Filter tourists whose dates overlap with this accommodation's dates
    // A tourist overlaps if their checkIn/checkOut dates fall within the accommodation dates
    const touristsFiltered = allTourists.filter(t => {
      // Check for accommodation-specific dates first
      const entry = roomingListEntries.find(e => e.touristId === t.id);
      const hasAccommodationDates = entry?.checkInDate || entry?.checkOutDate;

      // If tourist has no specific dates (neither accommodation-specific nor global), include them
      if (!hasAccommodationDates && !t.checkInDate && !t.checkOutDate) {
        return true;
      }

      // Use accommodation-specific dates if available, otherwise fall back to global dates
      const touristCheckIn = entry?.checkInDate || t.checkInDate || new Date(booking.departureDate);
      const touristCheckOut = entry?.checkOutDate || t.checkOutDate || new Date(booking.endDate);
      const accCheckIn = new Date(accommodation.checkInDate);
      const accCheckOut = new Date(accommodation.checkOutDate);

      // Overlap logic: tourist checkout > acc checkin AND tourist checkin < acc checkout
      return new Date(touristCheckOut) > accCheckIn && new Date(touristCheckIn) < accCheckOut;
    });

    // Sort tourists: Uzbekistan first, then Turkmenistan
    let tourists = touristsFiltered.sort((a, b) => {
      const aAccommodation = (a.accommodation || '').toLowerCase();
      const bAccommodation = (b.accommodation || '').toLowerCase();

      const aIsUzbekistan = aAccommodation.includes('uzbek') || aAccommodation.includes('узбек');
      const bIsUzbekistan = bAccommodation.includes('uzbek') || bAccommodation.includes('узбек');
      const aIsTurkmenistan = aAccommodation.includes('turkmen') || aAccommodation.includes('туркмен');
      const bIsTurkmenistan = bAccommodation.includes('turkmen') || bAccommodation.includes('туркмен');

      // UZ first (return -1), then TM (return 1)
      if (aIsUzbekistan && !bIsUzbekistan) return -1;
      if (!aIsUzbekistan && bIsUzbekistan) return 1;
      if (aIsTurkmenistan && !bIsTurkmenistan) return 1;
      if (!aIsTurkmenistan && bIsTurkmenistan) return -1;

      // If same type, sort by lastName
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

    // Helper function to format dates
    const formatDisplayDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const bookingNumber = booking.bookingNumber || 'N/A';
    const country = 'Германия'; // Default country
    const arrivalDate = formatDisplayDate(accommodation.checkInDate);
    const departureDate = formatDisplayDate(accommodation.checkOutDate);
    const currentDate = formatDisplayDate(new Date().toISOString());

    const hotelName = accommodation.hotel?.name || 'Hotel Name';

    // Check if this is a Turkmenistan/Khiva hotel
    const cityNameCheck = accommodation.hotel?.city?.name?.toLowerCase() || '';
    const isTurkmenistanHotel = cityNameCheck.includes('хива') || cityNameCheck.includes('khiva') ||
                                 cityNameCheck.includes('туркмен') || cityNameCheck.includes('turkmen');

    // Determine if this is the first Tashkent hotel
    // Fetch all accommodations for this booking to check position
    const allAccommodations = await prisma.accommodation.findMany({
      where: { bookingId: bookingIdInt },
      include: {
        hotel: {
          include: {
            city: true
          }
        }
      },
      orderBy: { checkInDate: 'asc' }
    });

    // Filter Tashkent hotels
    const tashkentAccommodations = allAccommodations.filter(acc => {
      const cityName = acc.hotel?.city?.name?.toLowerCase() || '';
      return cityName.includes('ташкент') || cityName.includes('tashkent') || cityName.includes('toshkent');
    });

    // Check if current accommodation is the first Tashkent hotel
    const isFirstTashkentHotel = tashkentAccommodations.length > 0 &&
                                  tashkentAccommodations[0].id === accommodationIdInt;

    // Check if current accommodation is the last Tashkent hotel and same as first hotel
    // (second visit to the same hotel at the end of tour)
    const isSecondVisitSameHotel = tashkentAccommodations.length > 1 &&
                                    tashkentAccommodations[tashkentAccommodations.length - 1].id === accommodationIdInt &&
                                    tashkentAccommodations[0].hotelId === tashkentAccommodations[tashkentAccommodations.length - 1].hotelId &&
                                    tashkentAccommodations[0].id !== tashkentAccommodations[tashkentAccommodations.length - 1].id;

    // Set table headers based on position
    let arrivalHeader = 'Заезд';
    let departureHeader = 'Выезд';

    if (isFirstTashkentHotel) {
      arrivalHeader = 'Первый<br>заезд';
      departureHeader = 'Первый<br>выезд';
    } else if (isSecondVisitSameHotel) {
      arrivalHeader = 'Второй<br>заезд';
      departureHeader = 'Второй<br>выезд';

      // Filter tourists for second visit - only UZ tourists return to Tashkent
      // TM tourists stay in Khiva (Malika Khorazm)
      tourists = tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
        return isUzbekistan;
      });
    }

    // Calculate totalPax and room counts AFTER filtering tourists
    const totalPax = tourists.length;

    // Calculate room counts from accommodation.rooms or from tourists
    let dblRooms = 0;
    let twnRooms = 0;
    let snglRooms = 0;

    if (accommodation.rooms && accommodation.rooms.length > 0 && !isSecondVisitSameHotel) {
      // Use accommodation.rooms only if not second visit
      accommodation.rooms.forEach(room => {
        const code = room.roomTypeCode?.toUpperCase();
        if (code === 'DBL' || code === 'DOUBLE' || code === 'DZ') {
          dblRooms += room.roomsCount || 0;
        } else if (code === 'TWN' || code === 'TWIN') {
          twnRooms += room.roomsCount || 0;
        } else if (code === 'SNGL' || code === 'SINGLE' || code === 'EZ') {
          snglRooms += room.roomsCount || 0;
        }
      });
    } else {
      // Calculate from filtered tourists
      dblRooms = tourists.filter(t => ['DBL', 'DOUBLE', 'DZ'].includes(t.roomPreference)).length / 2;
      twnRooms = tourists.filter(t => ['TWN', 'TWIN'].includes(t.roomPreference)).length / 2;
      snglRooms = tourists.filter(t => ['SNGL', 'SINGLE', 'EZ'].includes(t.roomPreference)).length;
    }

    // Load logo as base64
    const logoPath = path.join(__dirname, '../../uploads/logo.png');
    let logoDataUrl = '';
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.warn('Could not load logo:', err);
    }

    // Build tourist rows HTML
    // Group tourists by room number for TWN and DBL
    const roomGroups = {};
    const singleTourists = [];

    tourists.forEach(tourist => {
      let roomCategory = tourist.roomPreference || '';
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

    // Sort room numbers
    const sortedRoomNumbers = Object.keys(roomGroups).sort();

    // Create combined array
    const allEntries = [];
    sortedRoomNumbers.forEach(roomNumber => {
      allEntries.push({
        type: 'group',
        tourists: roomGroups[roomNumber]
      });
    });
    singleTourists.forEach(tourist => {
      allEntries.push({
        type: 'single',
        tourist
      });
    });

    let touristRows = '';
    let counter = 0;

    allEntries.forEach(entry => {
      if (entry.type === 'group') {
        const group = entry.tourists;
        group.forEach((t, groupIndex) => {
          counter++;
          const isFirstInGroup = groupIndex === 0;
          const name = t.fullName || `${t.lastName}, ${t.firstName}`;
          let roomCategory = t.roomPreference || '';
          if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
          if (roomCategory === 'TWIN') roomCategory = 'TWN';
          if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

          // Determine placement (Uzbekistan or Turkmenistan)
          const placement = t.accommodation || '';
          const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
          const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек') || placement === 'uz';
          const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

          // Get accommodation-specific dates if available
          const roomingEntry = roomingListEntries.find(e => e.touristId === t.id);
          const touristCheckInDate = roomingEntry?.checkInDate || t.checkInDate;
          const touristCheckOutDate = roomingEntry?.checkOutDate || t.checkOutDate;

          // Get remarks only from roomAssignments.notes and custom dates
          const remarksLines = [];

          // Add custom check-in date if exists
          if (touristCheckInDate) {
            remarksLines.push(`Заезд: ${formatDisplayDate(touristCheckInDate)}`);
          }

          // Add room assignment notes (from Rooming list tab)
          if (t.roomAssignments && t.roomAssignments.length > 0 && t.roomAssignments[0].notes) {
            // Filter out "PAX booked half double room" messages
            const notes = t.roomAssignments[0].notes;
            if (!notes.includes('PAX booked half double room') && !notes.includes('no roommate found')) {
              remarksLines.push(notes);
            }
          }

          let displayArrival = touristCheckInDate ? formatDisplayDate(touristCheckInDate) : arrivalDate;
          let displayDeparture = touristCheckOutDate ? formatDisplayDate(touristCheckOutDate) : departureDate;
          let customDeparture = false;

          // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier (if isTurkmenistanHotel is defined)
          if (typeof isTurkmenistanHotel !== 'undefined' && isTurkmenistanHotel && isUzbekistan) {
            console.log(`   🟢 PDF: UZ tourist in TM hotel: ${name}`);

            // Calculate departure date 1 day earlier
            const depDate = new Date(touristCheckOutDate || (typeof accommodation !== 'undefined' ? accommodation.checkOutDate : departureDate));
            const originalDepDate = new Date(depDate);
            depDate.setDate(depDate.getDate() - 1);
            displayDeparture = formatDisplayDate(depDate.toISOString());
            customDeparture = true;

            console.log(`      Original departure: ${originalDepDate.toISOString().split('T')[0]}`);
            console.log(`      Adjusted departure: ${depDate.toISOString().split('T')[0]}`);

            // Calculate nights
            const arrDate = new Date(touristCheckInDate || (typeof accommodation !== 'undefined' ? accommodation.checkInDate : arrivalDate));
            const nights = Math.ceil((depDate - arrDate) / (1000 * 60 * 60 * 24));
            remarksLines.push(`${nights} Nights`);

            console.log(`      Nights: ${nights}, Remarks: "${nights} Nights"`);
          }

          const remarks = remarksLines.filter(Boolean).join('\n');
          const rowBgColor = (touristCheckInDate || touristCheckOutDate || customDeparture) ? '#fffacd' : '';

          touristRows += `
        <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${touristCheckInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${customDeparture || touristCheckOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          ${isFirstInGroup ? `<td rowspan="${group.length}" style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;vertical-align:middle;">${roomCategory}</td>` : ''}
        </tr>
      `;
        });
      } else if (entry.type === 'single') {
        // Handle single tourists
        counter++;
        const t = entry.tourist;
        const name = t.fullName || `${t.lastName}, ${t.firstName}`;
        let roomCategory = t.roomPreference || '';
        if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
        if (roomCategory === 'TWIN') roomCategory = 'TWN';
        if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

        // Determine placement (Uzbekistan or Turkmenistan)
        const placement = t.accommodation || '';
        const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
        const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек') || placement === 'uz';
        const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

        // Get accommodation-specific dates if available
        const roomingEntry = roomingListEntries.find(e => e.touristId === t.id);
        const touristCheckInDate = roomingEntry?.checkInDate || t.checkInDate;
        const touristCheckOutDate = roomingEntry?.checkOutDate || t.checkOutDate;

        // Get remarks only from roomAssignments.notes and custom dates
        const remarksLines = [];

        // Add custom check-in date if exists
        if (touristCheckInDate) {
          remarksLines.push(`Заезд: ${formatDisplayDate(touristCheckInDate)}`);
        }

        // Add room assignment notes (from Rooming list tab)
        if (t.roomAssignments && t.roomAssignments.length > 0 && t.roomAssignments[0].notes) {
          // Filter out "PAX booked half double room" messages
          const notes = t.roomAssignments[0].notes;
          if (!notes.includes('PAX booked half double room') && !notes.includes('no roommate found')) {
            remarksLines.push(notes);
          }
        }

        let displayArrival = touristCheckInDate ? formatDisplayDate(touristCheckInDate) : arrivalDate;
        let displayDeparture = touristCheckOutDate ? formatDisplayDate(touristCheckOutDate) : departureDate;
        let customDeparture = false;

        // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier (if isTurkmenistanHotel is defined)
        if (typeof isTurkmenistanHotel !== 'undefined' && isTurkmenistanHotel && isUzbekistan) {
          console.log(`   🟢 PDF: UZ tourist in TM hotel: ${name}`);

          // Calculate departure date 1 day earlier
          const depDate = new Date(touristCheckOutDate || (typeof accommodation !== 'undefined' ? accommodation.checkOutDate : departureDate));
          const originalDepDate = new Date(depDate);
          depDate.setDate(depDate.getDate() - 1);
          displayDeparture = formatDisplayDate(depDate.toISOString());
          customDeparture = true;

          console.log(`      Original departure: ${originalDepDate.toISOString().split('T')[0]}`);
          console.log(`      Adjusted departure: ${depDate.toISOString().split('T')[0]}`);

          // Calculate nights
          const arrDate = new Date(touristCheckInDate || (typeof accommodation !== 'undefined' ? accommodation.checkInDate : arrivalDate));
          const nights = Math.ceil((depDate - arrDate) / (1000 * 60 * 60 * 24));
          remarksLines.push(`${nights} Nights`);

          console.log(`      Nights: ${nights}, Remarks: "${nights} Nights"`);
        }

        const remarks = remarksLines.filter(Boolean).join('\n');
        const rowBgColor = (touristCheckInDate || touristCheckOutDate || customDeparture) ? '#fffacd' : '';

        touristRows += `
        <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${touristCheckInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${customDeparture || touristCheckOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
          <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomCategory}</td>
        </tr>
      `;
      }
    });

    // Build HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          @page {
            /* Remove browser headers and footers */
            margin-top: 0;
            margin-bottom: 0;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
          }
          .action-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #2c3e50;
            padding: 12px 20px;
            display: flex;
            gap: 10px;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
          }
          .action-bar button {
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-print {
            background: #3498db;
            color: white;
          }
          .btn-print:hover {
            background: #2980b9;
          }
          .btn-close {
            background: #95a5a6;
            color: white;
          }
          .btn-close:hover {
            background: #7f8c8d;
          }
          .content-wrapper {
            margin-top: 60px;
          }
          @media print {
            .action-bar {
              display: none !important;
            }
            .content-wrapper {
              margin-top: 0 !important;
            }
            /* Force background colors to print */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
          }
          .header-table {
            width: 100%;
            border: none;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .date-hotel-row {
            width: 100%;
            border: none;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .date-hotel-row td {
            vertical-align: top;
            padding: 3px;
          }
          .date-cell {
            width: 50%;
            text-align: left;
          }
          .hotel-cell {
            width: 50%;
            text-align: right;
          }
          .zayvka-title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            margin: 15px 0;
            text-decoration: underline;
          }
          .intro-text {
            margin-bottom: 15px;
            text-align: justify;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .summary-table th, .summary-table td {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
            font-size: 8pt;
          }
          .summary-table th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .rooming-title {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            margin: 15px 0 10px 0;
            text-decoration: underline;
          }
          .rooming-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .rooming-table th, .rooming-table td {
            border: 1px solid #000;
            padding: 3px;
            font-size: 8pt;
          }
          .rooming-table th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          .footer-text {
            margin: 15px 0;
            font-style: italic;
          }
          .signature-table {
            width: 100%;
            border: none;
            border-collapse: collapse;
            margin-top: 30px;
          }
          .signature-table td {
            padding: 5px;
          }
          .print-notice {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 8px 12px;
            margin-bottom: 12px;
            border-radius: 4px;
            font-size: 11px;
            color: #856404;
          }
          @media print {
            .print-notice { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Action Bar -->
        <div class="action-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить как PDF</button>
          <button class="btn-close" onclick="window.close()">✕ Закрыть</button>
        </div>

        <!-- Print Notice -->
        <div class="content-wrapper">
        <div class="print-notice">
          💡 В диалоге печати отключите "Верхние и нижние колонтитулы"
        </div>

        <!-- Main Content -->
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

        <!-- Date and Hotel Info -->
        <table class="date-hotel-row">
          <tr>
            <td class="date-cell">
              <strong>Дата:</strong> ${currentDate}
            </td>
            <td class="hotel-cell">
              <strong>Директору гостиницы</strong><br>
              <strong>${hotelName}</strong>
            </td>
          </tr>
        </table>

        <!-- ЗАЯВКА Title with Booking Number -->
        <div class="zayvka-title">ЗАЯВКА ${bookingNumber}</div>

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
              <th>${arrivalHeader}</th>
              <th>${departureHeader}</th>
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
              <td>${Math.floor(dblRooms)}</td>
              <td>${Math.floor(twnRooms)}</td>
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
              <th style="width:30%">ФИО</th>
              <th style="width:12%">Дата заезда</th>
              <th style="width:12%">дата выезда</th>
              <th style="width:8%">Размещение</th>
              <th>Дополнительная<br>информация</th>
              <th style="width:10%">Категория<br>номера</th>
            </tr>
          </thead>
          <tbody>
            ${touristRows}
          </tbody>
        </table>

        <!-- Footer Text -->
        <div class="footer-text">Оплату гости производят на месте.</div>

        <!-- Signature Table -->
        <table class="signature-table">
          <tr>
            <td style="width:40%"><strong>Директор ООО «ORIENT INSIGHT»</strong></td>
            <td style="width:40%;text-align:center">_________________________</td>
            <td style="width:20%;text-align:center"><strong>Милиев С.Р.</strong></td>
          </tr>
        </table>
        </div><!-- End content-wrapper -->
      </body>
      </html>
    `;

    // Send HTML for browser preview and printing
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);

  } catch (error) {
    console.error('Hotel request preview error:', error);
    res.status(500).json({ error: 'Failed to generate preview: ' + error.message });
  }
});

// ============================================
// HOTEL REQUEST PREVIEW - COMBINED (all visits to same hotel)
// ============================================
console.log('🔧 Registering combined hotel request preview route: /:bookingId/hotel-request-combined/:hotelId');

router.get('/:bookingId/hotel-request-combined/:hotelId', async (req, res) => {
  console.log('📄 Combined Hotel Request Preview - BookingId:', req.params.bookingId, 'HotelId:', req.params.hotelId);
  try {
    const { bookingId, hotelId } = req.params;
    const bookingIdInt = parseInt(bookingId);
    const hotelIdInt = parseInt(hotelId);

    // Fetch booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdInt },
      include: { tourType: true, guide: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch all accommodations for this hotel in this booking
    const hotelAccommodations = await prisma.accommodation.findMany({
      where: {
        bookingId: bookingIdInt,
        hotelId: hotelIdInt
      },
      include: {
        hotel: { include: { city: true } },
        rooms: true
      },
      orderBy: { checkInDate: 'asc' }
    });

    if (hotelAccommodations.length === 0) {
      return res.status(404).json({ error: 'No accommodations found for this hotel' });
    }

    const hotel = hotelAccommodations[0].hotel;
    const hotelName = hotel?.name || 'Hotel';

    // Helper function to format dates
    const formatDisplayDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const bookingNumber = booking.bookingNumber || 'N/A';
    const country = 'Германия';
    const currentDate = formatDisplayDate(new Date().toISOString());

    // Load logo as base64
    const logoPath = path.join(__dirname, '../../uploads/logo.png');
    let logoDataUrl = '';
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.warn('Could not load logo:', err);
    }

    // Fetch all tourists for this booking
    const allTourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      include: {
        roomAssignments: {
          include: {
            bookingRoom: { include: { hotel: true, roomType: true } }
          }
        }
      },
      orderBy: [{ lastName: 'asc' }]
    });

    // Get all Tashkent accommodations to determine first/second visit
    const allAccommodations = await prisma.accommodation.findMany({
      where: { bookingId: bookingIdInt },
      include: { hotel: { include: { city: true } } },
      orderBy: { checkInDate: 'asc' }
    });

    const tashkentAccommodations = allAccommodations.filter(acc => {
      const cityName = acc.hotel?.city?.name?.toLowerCase() || '';
      return cityName.includes('ташкент') || cityName.includes('tashkent') || cityName.includes('toshkent');
    });

    // Check if this hotel is in Turkmenistan region
    const cityNameCheck = hotel?.city?.name?.toLowerCase() || '';
    const isTurkmenistanHotel = cityNameCheck.includes('хива') || cityNameCheck.includes('khiva') ||
                                 cityNameCheck.includes('туркмен') || cityNameCheck.includes('turkmen');

    // Build pages for each visit
    let pagesHtml = '';

    for (let visitIndex = 0; visitIndex < hotelAccommodations.length; visitIndex++) {
      const accommodation = hotelAccommodations[visitIndex];
      const isFirstVisit = visitIndex === 0;
      const isLastVisit = visitIndex === hotelAccommodations.length - 1;

      // Determine visit labels
      let visitLabel = '';
      let arrivalHeader = 'Заезд';
      let departureHeader = 'Выезд';

      if (hotelAccommodations.length > 1) {
        if (isFirstVisit) {
          visitLabel = ' (Первый заезд)';
          arrivalHeader = 'Первый<br>заезд';
          departureHeader = 'Первый<br>выезд';
        } else if (isLastVisit) {
          visitLabel = ' (Второй заезд)';
          arrivalHeader = 'Второй<br>заезд';
          departureHeader = 'Второй<br>выезд';
        } else {
          visitLabel = ` (Заезд ${visitIndex + 1})`;
        }
      }

      // Check if this is the second visit to the same Tashkent hotel
      const isSecondVisitSameHotel = tashkentAccommodations.length > 1 &&
                                      tashkentAccommodations[tashkentAccommodations.length - 1].id === accommodation.id &&
                                      tashkentAccommodations[0].hotelId === tashkentAccommodations[tashkentAccommodations.length - 1].hotelId &&
                                      tashkentAccommodations[0].id !== tashkentAccommodations[tashkentAccommodations.length - 1].id;

      // Fetch accommodation-specific rooming list entries
      const roomingListEntries = await prisma.accommodationRoomingList.findMany({
        where: { accommodationId: accommodation.id },
        include: { tourist: true }
      });

      // Filter tourists for this accommodation
      let tourists = allTourists.filter(t => {
        const entry = roomingListEntries.find(e => e.touristId === t.id);
        const hasAccommodationDates = entry?.checkInDate || entry?.checkOutDate;

        if (!hasAccommodationDates && !t.checkInDate && !t.checkOutDate) {
          return true;
        }

        const touristCheckIn = entry?.checkInDate || t.checkInDate || new Date(booking.departureDate);
        const touristCheckOut = entry?.checkOutDate || t.checkOutDate || new Date(booking.endDate);
        const accCheckIn = new Date(accommodation.checkInDate);
        const accCheckOut = new Date(accommodation.checkOutDate);

        return new Date(touristCheckOut) > accCheckIn && new Date(touristCheckIn) < accCheckOut;
      });

      // Sort tourists: UZ first, then TM
      tourists = tourists.sort((a, b) => {
        const aAcc = (a.accommodation || '').toLowerCase();
        const bAcc = (b.accommodation || '').toLowerCase();
        const aIsTM = aAcc.includes('turkmen') || aAcc.includes('туркмен');
        const bIsTM = bAcc.includes('turkmen') || bAcc.includes('туркмен');

        if (!aIsTM && bIsTM) return -1;
        if (aIsTM && !bIsTM) return 1;
        return (a.lastName || '').localeCompare(b.lastName || '');
      });

      // For second visit to same hotel - only UZ tourists return
      if (isSecondVisitSameHotel) {
        tourists = tourists.filter(t => {
          const placement = (t.accommodation || '').toLowerCase();
          const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
          return isUzbekistan;
        });
      }

      const totalPax = tourists.length;
      const arrivalDate = formatDisplayDate(accommodation.checkInDate);
      const departureDate = formatDisplayDate(accommodation.checkOutDate);

      // Calculate room counts
      let dblRooms = 0, twnRooms = 0, snglRooms = 0;

      if (accommodation.rooms && accommodation.rooms.length > 0 && !isSecondVisitSameHotel) {
        accommodation.rooms.forEach(room => {
          const code = room.roomTypeCode?.toUpperCase();
          if (code === 'DBL' || code === 'DOUBLE' || code === 'DZ') dblRooms += room.roomsCount || 0;
          else if (code === 'TWN' || code === 'TWIN') twnRooms += room.roomsCount || 0;
          else if (code === 'SNGL' || code === 'SINGLE' || code === 'EZ') snglRooms += room.roomsCount || 0;
        });
      } else {
        dblRooms = tourists.filter(t => ['DBL', 'DOUBLE', 'DZ'].includes(t.roomPreference)).length / 2;
        twnRooms = tourists.filter(t => ['TWN', 'TWIN'].includes(t.roomPreference)).length / 2;
        snglRooms = tourists.filter(t => ['SNGL', 'SINGLE', 'EZ'].includes(t.roomPreference)).length;
      }

      // Build tourist rows with room grouping
      // Group tourists by room number for TWN and DBL
      const roomGroups = {};
      const singleTourists = [];

      console.log(`\n🏨 Processing ${tourists.length} tourists for grouping`);
      tourists.forEach(tourist => {
        let roomCategory = tourist.roomPreference || '';
        if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
        if (roomCategory === 'TWIN') roomCategory = 'TWN';
        if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

        console.log(`  - ${tourist.lastName}, ${tourist.firstName}: Category=${roomCategory}, RoomNumber=${tourist.roomNumber || 'NULL'}`);

        if (tourist.roomNumber && (roomCategory === 'DBL' || roomCategory === 'TWN')) {
          if (!roomGroups[tourist.roomNumber]) {
            roomGroups[tourist.roomNumber] = [];
          }
          roomGroups[tourist.roomNumber].push(tourist);
          console.log(`    ✅ Added to group: ${tourist.roomNumber}`);
        } else {
          singleTourists.push(tourist);
          console.log(`    ➡️ Added to singles`);
        }
      });

      console.log(`\n📊 Grouping results:`);
      console.log(`  Room groups: ${Object.keys(roomGroups).length}`);
      Object.keys(roomGroups).forEach(roomNum => {
        console.log(`    ${roomNum}: ${roomGroups[roomNum].length} tourists`);
      });
      console.log(`  Single tourists: ${singleTourists.length}`);

      // Sort room numbers
      const sortedRoomNumbers = Object.keys(roomGroups).sort();

      // Create combined array and sort by placement (UZ first, then TM)
      const allEntries = [];
      sortedRoomNumbers.forEach(roomNumber => {
        allEntries.push({
          type: 'group',
          tourists: roomGroups[roomNumber]
        });
      });
      singleTourists.forEach(tourist => {
        allEntries.push({
          type: 'single',
          tourist
        });
      });

      // Sort entries: UZ groups/singles first, then TM
      allEntries.sort((a, b) => {
        const getPlacement = (entry) => {
          const tourist = entry.type === 'group' ? entry.tourists[0] : entry.tourist;
          const placement = (tourist.accommodation || '').toLowerCase();
          const isTM = placement.includes('turkmen') || placement.includes('туркмен');
          const isUZ = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
          return isTM ? 'TM' : isUZ ? 'UZ' : 'OTHER';
        };

        const aPlace = getPlacement(a);
        const bPlace = getPlacement(b);

        if (aPlace === 'UZ' && bPlace !== 'UZ') return -1;
        if (aPlace !== 'UZ' && bPlace === 'UZ') return 1;
        if (aPlace === 'TM' && bPlace !== 'TM') return -1;
        if (aPlace !== 'TM' && bPlace === 'TM') return 1;
        return 0;
      });

      let touristRows = '';
      let counter = 0;

      allEntries.forEach(entry => {
        if (entry.type === 'group') {
          const group = entry.tourists;
          group.forEach((t, groupIndex) => {
            counter++;
            const isFirstInGroup = groupIndex === 0;
            const name = t.fullName || `${t.lastName}, ${t.firstName}`;
            let roomCategory = t.roomPreference || '';
            if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
            if (roomCategory === 'TWIN') roomCategory = 'TWN';
            if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

            const placement = t.accommodation || '';
            const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
            const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек') || placement === 'uz';
            const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

            const roomingEntry = roomingListEntries.find(e => e.touristId === t.id);
            const touristCheckInDate = roomingEntry?.checkInDate || t.checkInDate;
            const touristCheckOutDate = roomingEntry?.checkOutDate || t.checkOutDate;

            const remarksLines = [];
            if (touristCheckInDate) remarksLines.push(`Заезд: ${formatDisplayDate(touristCheckInDate)}`);
            if (t.roomAssignments && t.roomAssignments.length > 0 && t.roomAssignments[0].notes) {
              // Filter out "PAX booked half double room" messages
              const notes = t.roomAssignments[0].notes;
              if (!notes.includes('PAX booked half double room') && !notes.includes('no roommate found')) {
                remarksLines.push(notes);
              }
            }

            let displayArrival = touristCheckInDate ? formatDisplayDate(touristCheckInDate) : arrivalDate;
            let displayDeparture = touristCheckOutDate ? formatDisplayDate(touristCheckOutDate) : departureDate;
            let customDeparture = false;

            // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier
            if (isTurkmenistanHotel && isUzbekistan) {
              const depDate = new Date(touristCheckOutDate || accommodation.checkOutDate);
              depDate.setDate(depDate.getDate() - 1);
              displayDeparture = formatDisplayDate(depDate.toISOString());
              customDeparture = true;

              const arrDate = new Date(touristCheckInDate || accommodation.checkInDate);
              const nights = Math.ceil((depDate - arrDate) / (1000 * 60 * 60 * 24));
              remarksLines.push(`${nights} Nights`);
            }

            const remarks = remarksLines.filter(Boolean).join('\n');
            const rowBgColor = (touristCheckInDate || touristCheckOutDate || customDeparture) ? '#fffacd' : '';

            touristRows += `
          <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
            <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${touristCheckInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${customDeparture || touristCheckOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
            ${isFirstInGroup ? `<td rowspan="${group.length}" style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;vertical-align:middle;">${roomCategory}</td>` : ''}
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
            <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          </tr>
        `;
          });
        } else if (entry.type === 'single') {
          counter++;
          const t = entry.tourist;
          const name = t.fullName || `${t.lastName}, ${t.firstName}`;
          let roomCategory = t.roomPreference || '';
          if (roomCategory === 'DOUBLE' || roomCategory === 'DZ') roomCategory = 'DBL';
          if (roomCategory === 'TWIN') roomCategory = 'TWN';
          if (roomCategory === 'SINGLE' || roomCategory === 'EZ') roomCategory = 'SNGL';

          const placement = t.accommodation || '';
          const isTurkmenistan = placement.toLowerCase().includes('turkmen') || placement.toLowerCase().includes('туркмен');
          const isUzbekistan = placement.toLowerCase().includes('uzbek') || placement.toLowerCase().includes('узбек') || placement === 'uz';
          const placementText = isTurkmenistan ? 'TM' : isUzbekistan ? 'UZ' : '-';

          const roomingEntry = roomingListEntries.find(e => e.touristId === t.id);
          const touristCheckInDate = roomingEntry?.checkInDate || t.checkInDate;
          const touristCheckOutDate = roomingEntry?.checkOutDate || t.checkOutDate;

          const remarksLines = [];
          if (touristCheckInDate) remarksLines.push(`Заезд: ${formatDisplayDate(touristCheckInDate)}`);
          if (t.roomAssignments && t.roomAssignments.length > 0 && t.roomAssignments[0].notes) {
            // Filter out "PAX booked half double room" messages
            const notes = t.roomAssignments[0].notes;
            if (!notes.includes('PAX booked half double room') && !notes.includes('no roommate found')) {
              remarksLines.push(notes);
            }
          }

          let displayArrival = touristCheckInDate ? formatDisplayDate(touristCheckInDate) : arrivalDate;
          let displayDeparture = touristCheckOutDate ? formatDisplayDate(touristCheckOutDate) : departureDate;
          let customDeparture = false;

          // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier
          if (isTurkmenistanHotel && isUzbekistan) {
            const depDate = new Date(touristCheckOutDate || accommodation.checkOutDate);
            depDate.setDate(depDate.getDate() - 1);
            displayDeparture = formatDisplayDate(depDate.toISOString());
            customDeparture = true;

            const arrDate = new Date(touristCheckInDate || accommodation.checkInDate);
            const nights = Math.ceil((depDate - arrDate) / (1000 * 60 * 60 * 24));
            remarksLines.push(`${nights} Nights`);
          }

          const remarks = remarksLines.filter(Boolean).join('\n');
          const rowBgColor = (touristCheckInDate || touristCheckOutDate || customDeparture) ? '#fffacd' : '';

          touristRows += `
          <tr style="${rowBgColor ? `background-color:${rowBgColor}` : ''}">
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;">${counter}</td>
            <td style="border:1px solid #000;padding:3px;font-size:8pt;">${name}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${touristCheckInDate ? 'font-weight:bold;' : ''}">${displayArrival}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;${customDeparture || touristCheckOutDate ? 'font-weight:bold;' : ''}">${displayDeparture}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8pt;font-weight:bold;">${roomCategory}</td>
            <td style="border:1px solid #000;padding:3px;text-align:center;font-size:7pt;font-weight:bold;color:${isTurkmenistan ? '#8b5cf6' : '#10b981'};">${placementText}</td>
            <td style="border:1px solid #000;padding:3px;font-size:8pt;">${remarks}</td>
          </tr>
        `;
        }
      });

      // Build page HTML with page-break
      const pageBreak = visitIndex > 0 ? 'page-break-before: always;' : '';

      pagesHtml += `
        <div class="page-content" style="${pageBreak}">
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

          <!-- Date and Hotel Info -->
          <table class="date-hotel-row">
            <tr>
              <td class="date-cell">
                <strong>Дата:</strong> ${currentDate}
              </td>
              <td class="hotel-cell">
                <strong>Директору гостиницы</strong><br>
                <strong>${hotelName}</strong>
              </td>
            </tr>
          </table>

          <!-- ЗАЯВКА Title with Booking Number and Visit Label -->
          <div class="zayvka-title">ЗАЯВКА ${bookingNumber}${visitLabel}</div>

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
                <th>${arrivalHeader}</th>
                <th>${departureHeader}</th>
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
                <td>${Math.floor(dblRooms)}</td>
                <td>${Math.floor(twnRooms)}</td>
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
                <th style="width:30%">ФИО</th>
                <th style="width:12%">Дата заезда</th>
                <th style="width:12%">дата выезда</th>
                <th style="width:10%">Категория<br>номера</th>
                <th style="width:8%">Размещение</th>
                <th>Дополнительная<br>информация</th>
              </tr>
            </thead>
            <tbody>
              ${touristRows}
            </tbody>
          </table>

          <!-- Footer Text -->
          <div class="footer-text">Оплату гости производят на месте.</div>

          <!-- Signature Table -->
          <table class="signature-table">
            <tr>
              <td style="width:40%"><strong>Директор ООО «ORIENT INSIGHT»</strong></td>
              <td style="width:40%;text-align:center">_________________________</td>
              <td style="width:20%;text-align:center"><strong>Милиев С.Р.</strong></td>
            </tr>
          </table>
        </div>
      `;
    }

    // Build full HTML document
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ЗАЯВКА ${bookingNumber} - ${hotelName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
          }
          .action-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #2c3e50;
            padding: 12px 20px;
            display: flex;
            gap: 10px;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
          }
          .action-bar button {
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-print { background: #3498db; color: white; }
          .btn-print:hover { background: #2980b9; }
          .btn-close { background: #95a5a6; color: white; }
          .btn-close:hover { background: #7f8c8d; }
          .content-wrapper { margin-top: 60px; }
          @media print {
            .action-bar { display: none !important; }
            .content-wrapper { margin-top: 0 !important; }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
          }
          .header-table { width: 100%; border: none; border-collapse: collapse; margin-bottom: 10px; }
          .date-hotel-row { width: 100%; border: none; border-collapse: collapse; margin-bottom: 15px; }
          .date-hotel-row td { vertical-align: top; padding: 3px; }
          .date-cell { width: 50%; text-align: left; }
          .hotel-cell { width: 50%; text-align: right; }
          .zayvka-title { text-align: center; font-size: 14pt; font-weight: bold; margin: 15px 0; text-decoration: underline; }
          .intro-text { margin-bottom: 15px; text-align: justify; }
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .summary-table th, .summary-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 8pt; }
          .summary-table th { background-color: #f0f0f0; font-weight: bold; }
          .rooming-title { text-align: center; font-size: 12pt; font-weight: bold; margin: 15px 0 10px 0; text-decoration: underline; }
          .rooming-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .rooming-table th, .rooming-table td { border: 1px solid #000; padding: 3px; font-size: 8pt; }
          .rooming-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .footer-text { margin: 15px 0; font-style: italic; }
          .signature-table { width: 100%; border: none; border-collapse: collapse; margin-top: 30px; }
          .signature-table td { padding: 5px; }
          .print-notice { background: #fff3cd; border: 1px solid #ffc107; padding: 8px 12px; margin-bottom: 12px; border-radius: 4px; font-size: 11px; color: #856404; }
          .visit-count-notice { background: #d4edda; border: 1px solid #28a745; padding: 8px 12px; margin-bottom: 12px; border-radius: 4px; font-size: 11px; color: #155724; }
          @media print { .print-notice, .visit-count-notice { display: none; } }
          .page-content { padding: 12mm; }
        </style>
      </head>
      <body>
        <!-- Action Bar -->
        <div class="action-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить как PDF</button>
          <button class="btn-close" onclick="window.close()">✕ Закрыть</button>
        </div>

        <div class="content-wrapper">
          <div class="print-notice">
            💡 В диалоге печати отключите "Верхние и нижние колонтитулы"
          </div>
          ${hotelAccommodations.length > 1 ? `
          <div class="visit-count-notice">
            📋 Этот документ содержит ${hotelAccommodations.length} заезда в гостиницу "${hotelName}" (${hotelAccommodations.length} страниц)
          </div>
          ` : ''}

          ${pagesHtml}
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);

  } catch (error) {
    console.error('Combined hotel request preview error:', error);
    res.status(500).json({ error: 'Failed to generate combined preview: ' + error.message });
  }
});

module.exports = router;
