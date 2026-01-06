const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

// Load pdf-parse v1 for rooming list PDF import
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not available');
}

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
        }
      }
    });

    // Sort by accommodation (Uzbekistan first, Turkmenistan second), then by name
    const sortedTourists = sortTouristsByAccommodation(tourists);

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
    const { firstName, lastName, gender, passportNumber, dateOfBirth, passportExpiryDate, roomPreference, roommateId, isGroupLeader, notes, country, accommodation, remarks } = req.body;

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
        isGroupLeader: p.isGroupLeader || false,
        notes: p.notes,
        country: p.country || 'Not provided',
        accommodation: p.accommodation || 'Not assigned',
        remarks: p.remarks || null
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
// Supports Agenturdaten format: first 4 rows are metadata, row 5 is header, data starts at row 6
// Missing fields are set to "Not provided" - import never stops due to missing data
function parseExcelFile(buffer, filename = '') {
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

  // Map room type codes (EZ = SNGL, DZ = DBL)
  const mapRoomType = (rm) => {
    if (!rm) return NOT_PROVIDED;
    const code = rm.toString().toUpperCase().trim();
    const roomMap = {
      'EZ': 'SNGL',      // Einzelzimmer -> Single
      'DZ': 'DBL',       // Doppelzimmer -> Double
      'DRZ': 'DBL',      // Dreibettzimmer -> Double (treat as double)
      'DOUBLE': 'DBL',
      'SINGLE': 'SNGL',
      'TWIN': 'TWN',
      'DBL': 'DBL',
      'SGL': 'SNGL',
      'SNGL': 'SNGL',
      'TWN': 'TWN'
    };
    return roomMap[code] || code;
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

    // Build notes from vegetarian info (internal notes, not exported)
    let notes = [];
    if (vegetarian && vegetarian.toString().toLowerCase() === 'yes') {
      notes.push('Vegetarian');
    }

    // Remarks is a separate field now (exported)
    const remarks = remarksCell ? remarksCell.toString().trim() : null;

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

    tourists.push({
      rowIndex: i + 1,
      firstName,
      lastName,
      gender: gender || NOT_PROVIDED,
      passportNumber: passport ? passport.toString().trim() : NOT_PROVIDED,
      dateOfBirth: parseDate(dob),
      passportExpiryDate: parseDate(passportExpiry),
      roomPreference: mapRoomType(roomPref),
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
        const result = parseExcelFile(file.buffer, file.originalname);
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
    const { tourists } = req.body;

    if (!Array.isArray(tourists) || tourists.length === 0) {
      return res.status(400).json({ error: 'Tourist list is empty' });
    }

    const NOT_PROVIDED = 'Not provided';
    const bookingIdInt = parseInt(bookingId);

    // Filter only selected tourists
    const toCreate = tourists.filter(p => p.selected !== false);

    if (toCreate.length === 0) {
      return res.status(400).json({ error: 'No tourists selected for import' });
    }

    // FULL REPLACE MODE: Delete all existing tourists for this booking first
    // This also cascades to delete their room assignments
    const deleteResult = await prisma.tourist.deleteMany({
      where: { bookingId: bookingIdInt }
    });

    // Insert all new tourists
    const created = await prisma.tourist.createMany({
      data: toCreate.map(p => ({
        bookingId: bookingIdInt,
        firstName: p.firstName?.toString().trim() || NOT_PROVIDED,
        lastName: p.lastName?.toString().trim() || NOT_PROVIDED,
        fullName: `${p.lastName || NOT_PROVIDED}, ${p.firstName || NOT_PROVIDED}`.trim(),
        gender: p.gender || NOT_PROVIDED,
        passportNumber: p.passportNumber || NOT_PROVIDED,
        dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
        passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate) : null,
        roomPreference: p.roomPreference || NOT_PROVIDED,
        accommodation: p.tripType || 'Not assigned',
        country: p.country || NOT_PROVIDED,
        isGroupLeader: p.isGroupLeader || false,
        notes: p.notes || null,
        remarks: p.remarks || null
      }))
    });

    // Update booking pax count
    await updateBookingPaxCount(bookingIdInt);

    // Return updated tourists list (sorted by accommodation)
    const updatedTourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      include: { roomAssignments: true }
    });

    const sortedTourists = sortTouristsByAccommodation(updatedTourists);

    res.status(201).json({
      count: created.count,
      deleted: deleteResult.count,
      message: `Replaced: deleted ${deleteResult.count}, imported ${created.count} tourists`,
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
    let globalRemark = '';

    // Room grouping counters for DBL and TWN
    let roomCounters = { DBL: 0, TWN: 0, SNGL: 0 };
    let currentRoomPersonCount = 0; // Track people in current room (for DBL/TWN pairing)
    let currentRoomNumber = null;

    // Split text into lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Detect tour sections
    let inTurkmenistanSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      // Detect Turkmenistan section
      if (lowerLine.includes('turkmenistan') && lowerLine.includes('tour:')) {
        inTurkmenistanSection = true;
        currentTourType = 'Uzbekistan mit Turkmenistan';
        // Reset room counters for new tour section
        roomCounters = { DBL: 0, TWN: 0, SNGL: 0 };
        currentRoomPersonCount = 0;
      }

      // Detect room type sections
      // Room type mapping: DOUBLE → DBL, TWIN → TWN, SINGLE → SNGL
      if (line === 'DOUBLE' || lowerLine === 'double') {
        currentRoomType = 'DBL';
        currentRoomPersonCount = 0; // Reset person count for new section
        continue;
      }
      if (line === 'TWIN' || lowerLine === 'twin') {
        currentRoomType = 'TWN';
        currentRoomPersonCount = 0; // Reset person count for new section
        continue;
      }
      if (line === 'SINGLE' || lowerLine === 'single') {
        currentRoomType = 'SNGL';
        currentRoomPersonCount = 0; // Reset person count for new section
        continue;
      }

      // Skip section markers and metadata
      if (lowerLine.includes('final rooming list') ||
          lowerLine.includes('tour:') ||
          lowerLine.includes('date:') ||
          lowerLine.includes('total') ||
          lowerLine.includes('additional information') ||
          lowerLine.includes('vegetarians:') ||
          lowerLine.includes('birthdays:') ||
          lowerLine.startsWith('*pax') ||
          lowerLine.startsWith('___') ||
          line === '//' ||
          line === '-') {
        continue;
      }

      // Extract remark
      if (lowerLine.startsWith('remark:')) {
        const remarkValue = line.substring(7).trim();
        if (remarkValue && remarkValue !== '//') {
          globalRemark = remarkValue;
        }
        continue;
      }

      // Parse tourist names (Mr./Mrs./Ms. patterns)
      const nameMatch = line.match(/^(Mr\.|Mrs\.|Ms\.)\s+(.+)$/i);
      if (nameMatch && currentRoomType) {
        const fullName = `${nameMatch[1]} ${nameMatch[2]}`.trim();
        const nameParts = nameMatch[2].split(',').map(p => p.trim());

        let lastName = '', firstName = '';
        if (nameParts.length >= 2) {
          lastName = nameParts[0];
          firstName = nameParts.slice(1).join(' ');
        } else {
          lastName = nameMatch[2];
        }

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

        tourists.push({
          fullName,
          firstName,
          lastName,
          gender: nameMatch[1].toLowerCase().includes('mr.') ? 'M' : 'F',
          roomType: currentRoomType,
          roomNumber: roomNumber, // Room grouping identifier
          tourType: currentTourType,
          remarks: globalRemark || '-'
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

    // Parse flights from structured table data (screenshot format)
    // Look for patterns like: TK 1664 Fr, 03OKT HAM - IST 18:40 - 23:00
    const flightTablePattern = /(TK|HY)\s*(\d{2,4})\s+\w+[,.]?\s*(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;
    let flightTableMatch;
    while ((flightTableMatch = flightTablePattern.exec(text)) !== null) {
      const [, airline, num, dateStr, dep, arr, depTime, arrTime] = flightTableMatch;

      const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];
      const isInternational = dep === 'IST' || arr === 'IST' ||
        (!uzbekAirports.includes(dep) || !uzbekAirports.includes(arr));

      const flightInfo = {
        flightNumber: `${airline.toUpperCase()} ${num}`,
        departure: dep,
        arrival: arr,
        departureTime: depTime,
        arrivalTime: arrTime,
        type: isInternational ? 'INTERNATIONAL' : 'DOMESTIC'
      };

      // Parse date
      const monthMap = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OKT': '10', 'OCT': '10', 'NOV': '11',
        'DEC': '12', 'DEZ': '12'
      };
      const dateMatch = dateStr.match(/(\d{2})([A-Z]{3})/i);
      if (dateMatch) {
        const day = dateMatch[1];
        const month = monthMap[dateMatch[2].toUpperCase()] || '01';
        const year = new Date().getFullYear();
        flightInfo.date = `${year}-${month}-${day}`;
      }

      const targetArray = isInternational ? flights.international : flights.domestic;
      const exists = targetArray.find(f =>
        f.flightNumber === flightInfo.flightNumber && f.departure === dep && f.arrival === arr
      );
      if (!exists) {
        targetArray.push(flightInfo);
      }
    }

    if (tourists.length === 0) {
      return res.status(400).json({ error: 'No tourists found in PDF. Make sure PDF contains rooming list with Mr./Mrs. names.' });
    }

    // Delete existing tourists and flights for this booking
    await prisma.$transaction([
      prisma.tourist.deleteMany({ where: { bookingId: bookingIdInt } }),
      prisma.flight.deleteMany({ where: { bookingId: bookingIdInt } })
    ]);

    // Create tourists - sorted by tour type (Uzbekistan first)
    const sortedTourists = [...tourists].sort((a, b) => {
      if (a.tourType === 'Uzbekistan' && b.tourType !== 'Uzbekistan') return -1;
      if (a.tourType !== 'Uzbekistan' && b.tourType === 'Uzbekistan') return 1;
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

    const createdTourists = await prisma.tourist.createMany({
      data: sortedTourists.map(t => ({
        bookingId: bookingIdInt,
        firstName: t.firstName || 'Not provided',
        lastName: t.lastName || 'Not provided',
        fullName: t.fullName || `${t.lastName}, ${t.firstName}`,
        gender: t.gender || 'Not provided',
        roomPreference: t.roomType,
        roomNumber: t.roomNumber,
        accommodation: t.tourType,
        remarks: t.remarks || '-',
        country: 'Not provided',
        passportNumber: 'Not provided'
      }))
    });

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
      message: `Imported ${createdTourists.count} tourists and ${allFlights.length} flights from PDF`,
      tourists: updatedTourists,
      flights: updatedFlights,
      summary: {
        touristsImported: createdTourists.count,
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

  await prisma.booking.update({
    where: { id: bookingId },
    data: { pax: count }
  });
}

module.exports = router;
