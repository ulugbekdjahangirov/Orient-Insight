const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

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
// PARTICIPANTS CRUD
// ============================================

// GET /api/bookings/:bookingId/participants - Get all participants for booking
router.get('/:bookingId/participants', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const participants = await prisma.tourParticipant.findMany({
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
      },
      orderBy: [
        { isGroupLeader: 'desc' },
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    res.json({ participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Ошибка загрузки участников' });
  }
});

// POST /api/bookings/:bookingId/participants - Add participant
router.post('/:bookingId/participants', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { firstName, lastName, gender, passportNumber, dateOfBirth, passportExpiryDate, roomPreference, roommateId, isGroupLeader, notes } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Имя и фамилия обязательны' });
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({ where: { id: parseInt(bookingId) } });
    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    const participant = await prisma.tourParticipant.create({
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
        notes
      },
      include: {
        roomAssignments: true
      }
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    res.status(201).json({ participant });
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Ошибка добавления участника' });
  }
});

// PUT /api/bookings/:bookingId/participants/:id - Update participant
router.put('/:bookingId/participants/:id', authenticate, async (req, res) => {
  try {
    const { bookingId, id } = req.params;
    const { firstName, lastName, gender, passportNumber, dateOfBirth, passportExpiryDate, roomPreference, roommateId, isGroupLeader, notes } = req.body;

    const participant = await prisma.tourParticipant.update({
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
        notes
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

    res.json({ participant });
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Ошибка обновления участника' });
  }
});

// DELETE /api/bookings/:bookingId/participants/:id - Remove participant
router.delete('/:bookingId/participants/:id', authenticate, async (req, res) => {
  try {
    const { bookingId, id } = req.params;

    await prisma.tourParticipant.delete({
      where: { id: parseInt(id) }
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({ error: 'Ошибка удаления участника' });
  }
});

// POST /api/bookings/:bookingId/participants/bulk - Bulk add participants
router.post('/:bookingId/participants/bulk', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { participants } = req.body;

    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Список участников пуст' });
    }

    const created = await prisma.tourParticipant.createMany({
      data: participants.map(p => ({
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
        notes: p.notes
      }))
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    res.status(201).json({ count: created.count });
  } catch (error) {
    console.error('Error bulk creating participants:', error);
    res.status(500).json({ error: 'Ошибка массового добавления' });
  }
});

// ============================================
// IMPORT PREVIEW & EXECUTE
// ============================================

// Helper: Detect trip type (Размещение) from filename or Excel content
function detectTripType(filename, rawData) {
  // Check filename first
  const lowerFilename = (filename || '').toLowerCase();

  // Check for "mit Verlängerung" (extension) patterns
  if (lowerFilename.includes('verlängerung') || lowerFilename.includes('verlangerung')) {
    if (lowerFilename.includes('turkmenistan')) {
      return 'Turkmenistan';
    }
    if (lowerFilename.includes('kirgistan') || lowerFilename.includes('kyrgyzstan')) {
      return 'Kyrgyzstan';
    }
    if (lowerFilename.includes('tadschikistan') || lowerFilename.includes('tajikistan')) {
      return 'Tajikistan';
    }
    if (lowerFilename.includes('kasachstan') || lowerFilename.includes('kazakhstan')) {
      return 'Kazakhstan';
    }
    // Default extension destination
    return 'Extension';
  }

  // Check Excel content (row 2 typically contains "Reise: ...")
  if (rawData && rawData[1] && rawData[1][0]) {
    const reiseRow = rawData[1][0].toString().toLowerCase();

    if (reiseRow.includes('verlängerung') || reiseRow.includes('verlangerung')) {
      if (reiseRow.includes('turkmenistan')) return 'Turkmenistan';
      if (reiseRow.includes('kirgistan') || reiseRow.includes('kyrgyzstan')) return 'Kyrgyzstan';
      if (reiseRow.includes('tadschikistan') || reiseRow.includes('tajikistan')) return 'Tajikistan';
      if (reiseRow.includes('kasachstan') || reiseRow.includes('kazakhstan')) return 'Kazakhstan';
      return 'Extension';
    }
  }

  // Default: determine from base destination
  if (lowerFilename.includes('usbekistan') || lowerFilename.includes('uzbekistan')) {
    return 'Uzbekistan';
  }
  if (lowerFilename.includes('turkmenistan')) {
    return 'Turkmenistan';
  }
  if (lowerFilename.includes('kirgistan') || lowerFilename.includes('kyrgyzstan')) {
    return 'Kyrgyzstan';
  }
  if (lowerFilename.includes('tadschikistan') || lowerFilename.includes('tajikistan')) {
    return 'Tajikistan';
  }
  if (lowerFilename.includes('kasachstan') || lowerFilename.includes('kazakhstan')) {
    return 'Kazakhstan';
  }

  // Check Excel content for destination
  if (rawData && rawData[1] && rawData[1][0]) {
    const reiseRow = rawData[1][0].toString().toLowerCase();
    if (reiseRow.includes('usbekistan') || reiseRow.includes('uzbekistan')) return 'Uzbekistan';
    if (reiseRow.includes('turkmenistan')) return 'Turkmenistan';
    if (reiseRow.includes('kirgistan') || reiseRow.includes('kyrgyzstan')) return 'Kyrgyzstan';
    if (reiseRow.includes('tadschikistan') || reiseRow.includes('tajikistan')) return 'Tajikistan';
    if (reiseRow.includes('kasachstan') || reiseRow.includes('kazakhstan')) return 'Kazakhstan';
  }

  return 'Uzbekistan'; // Default
}

// Helper: Parse Excel file and extract participants
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
      'EZ': 'SNGL',      // Einzelzimmer → Single
      'DZ': 'DBL',       // Doppelzimmer → Double
      'DRZ': 'DBL',      // Dreibettzimmer → Double (treat as double)
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

  const participants = [];

  // Process data rows
  for (let i = dataStartIndex; i < rawData.length; i++) {
    const row = rawData[i];

    // Skip empty rows (check if row has any meaningful data)
    const hasData = row.some(cell => cell !== null && cell !== undefined && cell !== '');
    if (!hasData) continue;

    // Get name and parse it
    const nameValue = getCell(row, 'Name', 'FullName', 'Full Name', 'Имя');
    const { firstName, lastName, gender: titleGender } = parseName(nameValue);

    // Skip row if no name at all (likely empty/separator row)
    if (firstName === NOT_PROVIDED && lastName === NOT_PROVIDED) continue;

    // Get other fields
    const passport = getCell(row, 'Pass-No', 'Passport', 'PassportNumber', 'Passport Number', 'Паспорт');
    const dob = getCell(row, 'DoB', 'DateOfBirth', 'Date of Birth', 'DOB', 'Birth Date', 'Дата рождения');
    const passportExpiry = getCell(row, 'DoE', 'PassportExpiry', 'Passport Expiry', 'Expiry Date', 'Expiry', 'Срок паспорта');
    const roomPref = getCell(row, 'Rm', 'Room', 'RoomPreference', 'Room Type', 'Номер');
    const nationality = getCell(row, 'Nat', 'Nationality', 'Гражданство');
    const vegetarian = getCell(row, 'Veg.', 'Veg', 'Vegetarian');
    const remarks = getCell(row, 'Remarks', 'Notes', 'Примечания', 'Comm.');

    // Determine gender (from title or explicit column)
    let gender = titleGender;
    if (!gender) {
      const genderCell = getCell(row, 'Gender', 'Пол', 'Sex');
      if (genderCell) {
        const g = genderCell.toString().toLowerCase();
        if (g === 'm' || g === 'male' || g === 'муж') gender = 'M';
        else if (g === 'f' || g === 'female' || g === 'жен') gender = 'F';
      }
    }

    // Build notes from vegetarian and remarks
    let notes = [];
    if (vegetarian && vegetarian.toString().toLowerCase() === 'yes') {
      notes.push('Vegetarian');
    }
    if (remarks) {
      notes.push(remarks.toString());
    }

    participants.push({
      rowIndex: i + 1,
      firstName,
      lastName,
      gender: gender || NOT_PROVIDED,
      passportNumber: passport ? passport.toString().trim() : NOT_PROVIDED,
      dateOfBirth: parseDate(dob),
      passportExpiryDate: parseDate(passportExpiry),
      roomPreference: mapRoomType(roomPref),
      nationality: nationality ? nationality.toString().trim() : null,
      tripType, // Размещение - determined from filename/content
      isGroupLeader: false,
      notes: notes.length > 0 ? notes.join('; ') : null
    });
  }

  return { participants, tripType, filename };
}

// Helper: Parse PDF file and extract participants (structured tables)
async function parsePdfFile(buffer) {
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
        // Extract text from PDF
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

        const participants = [];
        let rowIndex = 0;

        // Process lines
        for (const line of lines) {
          // Skip header-like lines
          if (line.toLowerCase().includes('lastname') || line.toLowerCase().includes('name') && line.toLowerCase().includes('passport')) {
            continue;
          }

          // Try to parse as space-separated values
          const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);

          if (parts.length >= 2) {
            rowIndex++;

            let firstName = '', lastName = '', passportNumber = null, dateOfBirth = null, passportExpiryDate = null, gender = null;

            // Try to identify passport number (alphanumeric, 6-12 chars)
            const passportIdx = parts.findIndex(p => /^[A-Z]{0,2}\d{6,12}[A-Z]?$/i.test(p));

            if (passportIdx > 0) {
              if (passportIdx === 1) {
                const nameParts = parts[0].split(/[,\s]+/);
                lastName = nameParts[0] || '';
                firstName = nameParts.slice(1).join(' ') || '';
              } else {
                lastName = parts[0] || '';
                firstName = parts.slice(1, passportIdx).join(' ') || '';
              }
              passportNumber = parts[passportIdx];

              for (let i = passportIdx + 1; i < parts.length; i++) {
                const date = parseDate(parts[i]);
                if (date) {
                  if (!dateOfBirth) {
                    dateOfBirth = date;
                  } else if (!passportExpiryDate) {
                    passportExpiryDate = date;
                  }
                }
                if (/^(M|F|Male|Female|Муж|Жен)\.?$/i.test(parts[i])) {
                  gender = parts[i].charAt(0).toUpperCase();
                }
              }
            } else if (parts.length >= 2) {
              lastName = parts[0] || '';
              firstName = parts[1] || '';

              for (let i = 2; i < parts.length; i++) {
                if (/^[A-Z]{0,2}\d{6,12}[A-Z]?$/i.test(parts[i])) {
                  passportNumber = parts[i];
                } else {
                  const date = parseDate(parts[i]);
                  if (date) {
                    if (!dateOfBirth) {
                      dateOfBirth = date;
                    } else if (!passportExpiryDate) {
                      passportExpiryDate = date;
                    }
                  }
                }
                if (/^(M|F|Male|Female|Муж|Жен)\.?$/i.test(parts[i])) {
                  gender = parts[i].charAt(0).toUpperCase();
                }
              }
            }

            if (firstName || lastName) {
              participants.push({
                rowIndex,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                gender,
                passportNumber,
                dateOfBirth,
                passportExpiryDate,
                roomPreference: null,
                isGroupLeader: false,
                notes: null
              });
            }
          }
        }

        resolve(participants);
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

// POST /api/bookings/:bookingId/participants/import/preview - Preview import data (supports multiple files)
router.post('/:bookingId/participants/import/preview', authenticate, (req, res, next) => {
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
      return res.status(400).json({ error: 'Файлы не загружены' });
    }

    const NOT_PROVIDED = 'Not provided';
    let allParticipants = [];
    const filesSummary = [];

    // Process each file
    for (const file of files) {
      const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';

      let result;
      if (isPdf) {
        if (!PDFParser) {
          filesSummary.push({
            filename: file.originalname,
            error: 'PDF импорт недоступен',
            count: 0
          });
          continue;
        }
        const pdfParticipants = await parsePdfFile(file.buffer);
        result = { participants: pdfParticipants, tripType: 'Unknown', filename: file.originalname };
      } else {
        result = parseExcelFile(file.buffer, file.originalname);
      }

      // Add source file info to each participant
      const participantsWithSource = result.participants.map(p => ({
        ...p,
        sourceFile: file.originalname,
        tripType: p.tripType || result.tripType
      }));

      allParticipants = allParticipants.concat(participantsWithSource);

      filesSummary.push({
        filename: file.originalname,
        tripType: result.tripType,
        count: result.participants.length
      });
    }

    if (allParticipants.length === 0) {
      return res.status(400).json({ error: 'Не найдены данные участников' });
    }

    // Check for duplicates within all files (ignore "Not provided" passports)
    const passportSet = new Set();
    const duplicatesInFiles = [];

    for (const p of allParticipants) {
      if (p.passportNumber && p.passportNumber !== NOT_PROVIDED) {
        if (passportSet.has(p.passportNumber)) {
          duplicatesInFiles.push(p.passportNumber);
          p.isDuplicateInFiles = true;
        } else {
          passportSet.add(p.passportNumber);
        }
      }
    }

    // Check for duplicates in database (ignore "Not provided" passports)
    const existingParticipants = await prisma.tourParticipant.findMany({
      where: { bookingId: parseInt(bookingId) },
      select: { passportNumber: true }
    });

    const existingPassports = new Set(
      existingParticipants
        .map(p => p.passportNumber)
        .filter(p => p && p !== NOT_PROVIDED)
    );

    // Mark duplicates - "Not provided" passports are never considered duplicates
    const previewData = allParticipants.map((p, idx) => {
      const passport = p.passportNumber;
      const isRealPassport = passport && passport !== NOT_PROVIDED;
      const isDuplicateInDb = isRealPassport && existingPassports.has(passport);
      const isDuplicateInFiles = p.isDuplicateInFiles || false;
      const isDuplicate = isDuplicateInDb || isDuplicateInFiles;

      return {
        ...p,
        id: idx + 1,
        isDuplicate,
        isDuplicateInDb,
        isDuplicateInFiles,
        selected: !isDuplicate
      };
    });

    const duplicateCount = previewData.filter(p => p.isDuplicate).length;
    const duplicateInDbCount = previewData.filter(p => p.isDuplicateInDb).length;
    const duplicateInFilesCount = previewData.filter(p => p.isDuplicateInFiles && !p.isDuplicateInDb).length;

    res.json({
      participants: previewData,
      total: previewData.length,
      duplicates: duplicateCount,
      duplicatesInDb: duplicateInDbCount,
      duplicatesInFiles: duplicateInFilesCount,
      toImport: previewData.length - duplicateCount,
      files: filesSummary,
      fileCount: files.length
    });
  } catch (error) {
    console.error('Error previewing import:', error);
    res.status(500).json({ error: 'Ошибка предпросмотра: ' + error.message });
  }
});

// POST /api/bookings/:bookingId/participants/import - Import participants (from preview data)
// Excel is the main data source - all rows are imported, missing fields use "Not provided"
router.post('/:bookingId/participants/import', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { participants } = req.body;

    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Список участников пуст' });
    }

    const NOT_PROVIDED = 'Not provided';

    // Get existing passport numbers to skip duplicates silently
    // "Not provided" passports are never considered duplicates
    const existingParticipants = await prisma.tourParticipant.findMany({
      where: { bookingId: parseInt(bookingId) },
      select: { passportNumber: true }
    });

    const existingPassports = new Set(
      existingParticipants
        .map(p => p.passportNumber)
        .filter(p => p && p !== NOT_PROVIDED)
    );

    // Filter only by selection and real duplicates
    const toCreate = participants.filter(p => {
      // Skip if marked as not selected
      if (p.selected === false) return false;
      // Skip duplicates by passport (but not "Not provided" ones)
      const passport = p.passportNumber;
      if (passport && passport !== NOT_PROVIDED && existingPassports.has(passport)) return false;
      // Import all rows - even if names are "Not provided"
      return true;
    });

    if (toCreate.length === 0) {
      return res.status(400).json({ error: 'Нет участников для импорта (все дубликаты или не выбраны)' });
    }

    const created = await prisma.tourParticipant.createMany({
      data: toCreate.map(p => ({
        bookingId: parseInt(bookingId),
        firstName: p.firstName?.toString().trim() || NOT_PROVIDED,
        lastName: p.lastName?.toString().trim() || NOT_PROVIDED,
        fullName: `${p.lastName || NOT_PROVIDED}, ${p.firstName || NOT_PROVIDED}`.trim(),
        gender: p.gender || NOT_PROVIDED,
        passportNumber: p.passportNumber || NOT_PROVIDED,
        dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
        passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate) : null,
        roomPreference: p.roomPreference || NOT_PROVIDED,
        isGroupLeader: p.isGroupLeader || false,
        notes: p.notes || null
      }))
    });

    // Update booking pax count
    await updateBookingPaxCount(parseInt(bookingId));

    const skipped = participants.length - toCreate.length;

    // Return updated participants list
    const updatedParticipants = await prisma.tourParticipant.findMany({
      where: { bookingId: parseInt(bookingId) },
      include: { roomAssignments: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    res.status(201).json({
      count: created.count,
      skipped,
      message: `Импортировано ${created.count} участников${skipped > 0 ? `, пропущено ${skipped} дубликатов` : ''}`,
      participants: updatedParticipants
    });
  } catch (error) {
    console.error('Error importing participants:', error);
    res.status(500).json({ error: 'Ошибка импорта: ' + error.message });
  }
});

// ============================================
// ROOM ASSIGNMENTS
// ============================================

// POST /api/bookings/:bookingId/room-assignments - Assign participant to room
router.post('/:bookingId/room-assignments', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { participantId, bookingRoomId, checkInDate, checkOutDate, extraNights, extraCost, notes } = req.body;

    if (!participantId || !bookingRoomId) {
      return res.status(400).json({ error: 'Участник и номер обязательны' });
    }

    // Check if assignment already exists
    const existing = await prisma.participantRoomAssignment.findUnique({
      where: {
        participantId_bookingRoomId: {
          participantId: parseInt(participantId),
          bookingRoomId: parseInt(bookingRoomId)
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Участник уже назначен в этот номер' });
    }

    const assignment = await prisma.participantRoomAssignment.create({
      data: {
        participantId: parseInt(participantId),
        bookingRoomId: parseInt(bookingRoomId),
        checkInDate: checkInDate ? new Date(checkInDate) : null,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
        extraNights: extraNights || 0,
        extraCost: extraCost || 0,
        notes
      },
      include: {
        participant: true,
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
    res.status(500).json({ error: 'Ошибка назначения в номер' });
  }
});

// PUT /api/bookings/:bookingId/room-assignments/:id - Update assignment
router.put('/:bookingId/room-assignments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkInDate, checkOutDate, extraNights, extraCost, notes } = req.body;

    const assignment = await prisma.participantRoomAssignment.update({
      where: { id: parseInt(id) },
      data: {
        checkInDate: checkInDate ? new Date(checkInDate) : null,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
        extraNights: extraNights || 0,
        extraCost: extraCost || 0,
        notes
      },
      include: {
        participant: true,
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
    res.status(500).json({ error: 'Ошибка обновления назначения' });
  }
});

// DELETE /api/bookings/:bookingId/room-assignments/:id - Remove assignment
router.delete('/:bookingId/room-assignments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.participantRoomAssignment.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room assignment:', error);
    res.status(500).json({ error: 'Ошибка удаления назначения' });
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
        participants: {
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        },
        bookingRooms: {
          include: {
            hotel: { include: { city: true } },
            roomType: true,
            participantAssignments: {
              include: {
                participant: true
              }
            }
          },
          orderBy: { checkInDate: 'asc' }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    // Group by hotel
    const hotelMap = new Map();

    for (const room of booking.bookingRooms) {
      const hotelKey = room.hotelId;

      if (!hotelMap.has(hotelKey)) {
        hotelMap.set(hotelKey, {
          hotel: room.hotel,
          checkIn: room.checkInDate,
          checkOut: room.checkOutDate,
          rooms: [],
          guests: [],
          roomSummary: {}
        });
      }

      const hotelData = hotelMap.get(hotelKey);

      // Update date range
      if (room.checkInDate < hotelData.checkIn) {
        hotelData.checkIn = room.checkInDate;
      }
      if (room.checkOutDate > hotelData.checkOut) {
        hotelData.checkOut = room.checkOutDate;
      }

      // Add room
      hotelData.rooms.push(room);

      // Update room summary
      const roomTypeName = room.roomType.name;
      hotelData.roomSummary[roomTypeName] = (hotelData.roomSummary[roomTypeName] || 0) + room.quantity;

      // Add guests
      for (const assignment of room.participantAssignments) {
        const effectiveCheckIn = assignment.checkInDate || room.checkInDate;
        const effectiveCheckOut = assignment.checkOutDate || room.checkOutDate;
        const nights = Math.ceil((new Date(effectiveCheckOut) - new Date(effectiveCheckIn)) / (1000 * 60 * 60 * 24));

        hotelData.guests.push({
          assignmentId: assignment.id,
          participantId: assignment.participant.id,
          name: assignment.participant.fullName || `${assignment.participant.lastName}, ${assignment.participant.firstName}`,
          roomType: room.roomType.name,
          roomId: room.id,
          checkIn: effectiveCheckIn,
          checkOut: effectiveCheckOut,
          nights,
          extraNights: assignment.extraNights,
          notes: assignment.notes
        });
      }
    }

    // Find unassigned participants for each hotel
    const assignedParticipantIds = new Set();
    for (const room of booking.bookingRooms) {
      for (const assignment of room.participantAssignments) {
        assignedParticipantIds.add(assignment.participantId);
      }
    }

    const unassignedParticipants = booking.participants.filter(
      p => !assignedParticipantIds.has(p.id)
    );

    // Convert to array
    const roomingList = Array.from(hotelMap.values()).map(h => ({
      ...h,
      roomSummary: Object.entries(h.roomSummary).map(([type, quantity]) => ({ type, quantity })),
      guests: h.guests.sort((a, b) => a.name.localeCompare(b.name))
    }));

    res.json({
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        tourType: booking.tourType,
        country: booking.country,
        pax: booking.pax,
        departureDate: booking.departureDate,
        endDate: booking.endDate
      },
      roomingList,
      unassignedParticipants,
      totalParticipants: booking.participants.length,
      assignedCount: assignedParticipantIds.size
    });
  } catch (error) {
    console.error('Error fetching rooming list:', error);
    res.status(500).json({ error: 'Ошибка загрузки rooming list' });
  }
});

// ============================================
// HOTEL REQUESTS
// ============================================

// GET /api/bookings/:bookingId/hotel-requests - Get summary of all hotels with full data for preview
router.get('/:bookingId/hotel-requests', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });

    const bookingRooms = await prisma.bookingRoom.findMany({
      where: { bookingId: parseInt(bookingId) },
      include: {
        hotel: { include: { city: true } },
        roomType: true,
        participantAssignments: {
          include: { participant: true }
        }
      },
      orderBy: { checkInDate: 'asc' }
    });

    // Group by hotel with full details
    const hotelMap = new Map();

    for (const room of bookingRooms) {
      const hotelKey = room.hotelId;

      if (!hotelMap.has(hotelKey)) {
        hotelMap.set(hotelKey, {
          hotel: {
            id: room.hotel.id,
            name: room.hotel.name,
            city: room.hotel.city
          },
          checkIn: room.checkInDate,
          checkOut: room.checkOutDate,
          roomSummary: {},
          totalRooms: 0,
          totalCost: 0,
          guests: [],
          nights: 0
        });
      }

      const hotelData = hotelMap.get(hotelKey);

      // Update date range
      if (room.checkInDate < hotelData.checkIn) {
        hotelData.checkIn = room.checkInDate;
      }
      if (room.checkOutDate > hotelData.checkOut) {
        hotelData.checkOut = room.checkOutDate;
      }

      // Room summary by type
      const typeName = room.roomType.name;
      hotelData.roomSummary[typeName] = (hotelData.roomSummary[typeName] || 0) + room.quantity;
      hotelData.totalRooms += room.quantity;
      hotelData.totalCost += room.totalPrice;

      // Add guests
      for (const assignment of room.participantAssignments) {
        const effectiveCheckIn = assignment.checkInDate || room.checkInDate;
        const effectiveCheckOut = assignment.checkOutDate || room.checkOutDate;
        const nights = Math.ceil((new Date(effectiveCheckOut) - new Date(effectiveCheckIn)) / (1000 * 60 * 60 * 24));

        hotelData.guests.push({
          name: assignment.participant.fullName || `${assignment.participant.lastName}, ${assignment.participant.firstName}`,
          roomType: room.roomType.name,
          checkIn: effectiveCheckIn,
          checkOut: effectiveCheckOut,
          nights,
          notes: assignment.notes || (assignment.extraNights > 0 ? `+${assignment.extraNights} ночей` : '')
        });
      }
    }

    // Convert to array with proper structure
    const hotelRequests = Array.from(hotelMap.values()).map(h => {
      const nights = Math.ceil((new Date(h.checkOut) - new Date(h.checkIn)) / (1000 * 60 * 60 * 24));
      return {
        hotel: h.hotel,
        checkIn: h.checkIn,
        checkOut: h.checkOut,
        nights,
        roomSummary: Object.entries(h.roomSummary).map(([type, quantity]) => ({ type, quantity })),
        totalRooms: h.totalRooms,
        totalGuests: h.guests.length,
        guests: h.guests.sort((a, b) => a.name.localeCompare(b.name)),
        totalCost: h.totalCost,
        booking: booking ? {
          bookingNumber: booking.bookingNumber,
          country: booking.country,
          tourType: booking.tourType
        } : null
      };
    });

    res.json({ hotelRequests });
  } catch (error) {
    console.error('Error fetching hotel requests:', error);
    res.status(500).json({ error: 'Ошибка загрузки запросов' });
  }
});

// GET /api/bookings/:bookingId/hotel-requests/:hotelId - Get request data for specific hotel
router.get('/:bookingId/hotel-requests/:hotelId', authenticate, async (req, res) => {
  try {
    const { bookingId, hotelId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(hotelId) },
      include: { city: true }
    });

    if (!hotel) {
      return res.status(404).json({ error: 'Отель не найден' });
    }

    const bookingRooms = await prisma.bookingRoom.findMany({
      where: {
        bookingId: parseInt(bookingId),
        hotelId: parseInt(hotelId)
      },
      include: {
        roomType: true,
        participantAssignments: {
          include: { participant: true }
        }
      },
      orderBy: { checkInDate: 'asc' }
    });

    if (bookingRooms.length === 0) {
      return res.status(404).json({ error: 'Нет размещения в этом отеле' });
    }

    // Calculate date range
    let checkIn = bookingRooms[0].checkInDate;
    let checkOut = bookingRooms[0].checkOutDate;

    for (const room of bookingRooms) {
      if (room.checkInDate < checkIn) checkIn = room.checkInDate;
      if (room.checkOutDate > checkOut) checkOut = room.checkOutDate;
    }

    // Room summary
    const roomSummary = {};
    let totalRooms = 0;
    let totalCost = 0;

    for (const room of bookingRooms) {
      const typeName = room.roomType.name;
      roomSummary[typeName] = (roomSummary[typeName] || 0) + room.quantity;
      totalRooms += room.quantity;
      totalCost += room.totalPrice;
    }

    // Rooming list
    const roomingList = [];
    for (const room of bookingRooms) {
      for (const assignment of room.participantAssignments) {
        const effectiveCheckIn = assignment.checkInDate || room.checkInDate;
        const effectiveCheckOut = assignment.checkOutDate || room.checkOutDate;
        const nights = Math.ceil((new Date(effectiveCheckOut) - new Date(effectiveCheckIn)) / (1000 * 60 * 60 * 24));

        roomingList.push({
          guestName: assignment.participant.fullName || `${assignment.participant.lastName}, ${assignment.participant.firstName}`,
          roomType: room.roomType.name,
          checkIn: effectiveCheckIn,
          checkOut: effectiveCheckOut,
          nights,
          notes: assignment.notes || (assignment.extraNights > 0 ? `+${assignment.extraNights} Nights` : '')
        });
      }
    }

    // Sort rooming list by name
    roomingList.sort((a, b) => a.guestName.localeCompare(b.guestName));

    const hotelRequest = {
      hotel: {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city.name,
        address: hotel.address,
        phone: hotel.phone,
        email: hotel.email
      },
      booking: {
        id: booking.id,
        number: booking.bookingNumber,
        tourType: booking.tourType.code,
        country: booking.country || 'Unknown',
        pax: booking.pax
      },
      checkIn,
      checkOut,
      nights: Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
      roomSummary: Object.entries(roomSummary).map(([type, quantity]) => ({ type, quantity })),
      totalRooms,
      roomingList,
      totalCost
    };

    res.json({ hotelRequest });
  } catch (error) {
    console.error('Error fetching hotel request:', error);
    res.status(500).json({ error: 'Ошибка загрузки запроса' });
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
        participants: {
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
      return res.status(404).json({ error: 'Бронирование не найдено' });
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

    // By participant
    const participantCosts = booking.participants.map(p => {
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
        participantId: p.id,
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
      byParticipant: participantCosts,
      totals: {
        rooms: totalRooms,
        nights: totalNights,
        cost: totalCost
      }
    });
  } catch (error) {
    console.error('Error fetching cost summary:', error);
    res.status(500).json({ error: 'Ошибка расчёта стоимости' });
  }
});

// ============================================
// EXPORT ENDPOINTS
// ============================================

// GET /api/bookings/:bookingId/participants/export/excel - Export to Excel
router.get('/:bookingId/participants/export/excel', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    const participants = await prisma.tourParticipant.findMany({
      where: { bookingId: parseInt(bookingId) },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    // Format data for Excel
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    };

    const data = participants.map((p, idx) => ({
      '№': idx + 1,
      'Фамилия': p.lastName,
      'Имя': p.firstName,
      'Пол': p.gender === 'M' ? 'Муж' : p.gender === 'F' ? 'Жен' : '',
      'Паспорт': p.passportNumber || '',
      'Дата рождения': formatDate(p.dateOfBirth),
      'Срок паспорта': formatDate(p.passportExpiryDate),
      'Тип номера': p.roomPreference || '',
      'Лидер': p.isGroupLeader ? 'Да' : '',
      'Примечания': p.notes || ''
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { width: 5 },   // №
      { width: 20 },  // Фамилия
      { width: 20 },  // Имя
      { width: 8 },   // Пол
      { width: 15 },  // Паспорт
      { width: 15 },  // Дата рождения
      { width: 15 },  // Срок паспорта
      { width: 12 },  // Тип номера
      { width: 8 },   // Лидер
      { width: 25 }   // Примечания
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Участники');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `participants-${booking.bookingNumber}-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({ error: 'Ошибка экспорта в Excel' });
  }
});

// GET /api/bookings/:bookingId/participants/export/pdf - Export to PDF
router.get('/:bookingId/participants/export/pdf', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    const participants = await prisma.tourParticipant.findMany({
      where: { bookingId: parseInt(bookingId) },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40
    });

    const filename = `participants-${booking.bookingNumber}-${new Date().toISOString().split('T')[0]}.pdf`;

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
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text(`Список участников - ${booking.bookingNumber}`, { align: 'center' });
    doc.moveDown(0.5);

    // Booking info
    doc.fontSize(10).font('Helvetica');
    doc.text(`Тур: ${booking.tourType?.code || ''} | Страна: ${booking.country || '-'} | Участников: ${participants.length}`, { align: 'center' });
    doc.text(`Даты: ${formatDate(booking.departureDate)} - ${formatDate(booking.endDate)}`, { align: 'center' });
    doc.moveDown(1);

    // Table headers
    const startX = 40;
    let y = doc.y;
    const colWidths = [30, 100, 80, 40, 90, 80, 80, 50, 120];
    const headers = ['№', 'Фамилия', 'Имя', 'Пол', 'Паспорт', 'Дата рожд.', 'Срок пасп.', 'Номер', 'Примечания'];

    // Draw header background
    doc.fillColor('#4B5563').rect(startX, y, 750, 18).fill();

    // Draw header text
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    let x = startX + 5;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 4, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });

    y += 22;
    doc.fillColor('#000000');

    // Draw rows
    doc.font('Helvetica').fontSize(8);
    participants.forEach((p, idx) => {
      // Check for page break
      if (y > 520) {
        doc.addPage();
        y = 40;
      }

      // Alternating row background
      if (idx % 2 === 0) {
        doc.fillColor('#F3F4F6').rect(startX, y - 2, 750, 16).fill();
      }

      doc.fillColor('#000000');
      x = startX + 5;

      const rowData = [
        (idx + 1).toString(),
        p.lastName || '',
        p.firstName || '',
        p.gender === 'M' ? 'М' : p.gender === 'F' ? 'Ж' : '-',
        p.passportNumber || '-',
        formatDate(p.dateOfBirth),
        formatDate(p.passportExpiryDate),
        p.roomPreference || '-',
        p.notes || ''
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell.substring(0, 25), x, y, { width: colWidths[i] - 10 });
        x += colWidths[i];
      });

      y += 16;
    });

    // Footer
    doc.fontSize(8).fillColor('#6B7280');
    doc.text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, 40, 555, { align: 'left' });
    doc.text(`Страница 1`, 750, 555, { align: 'right' });

    doc.end();
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({ error: 'Ошибка экспорта в PDF' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function updateBookingPaxCount(bookingId) {
  const count = await prisma.tourParticipant.count({
    where: { bookingId }
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { pax: count }
  });
}

module.exports = router;
