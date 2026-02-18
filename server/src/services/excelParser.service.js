const XLSX = require('xlsx');

/**
 * Excel Parser Service
 * Parses Agenturdaten Excel files from World Insight
 *
 * File format:
 *   Row 0: "Agenturdaten"
 *   Row 1: "Reise: Usbekistan ComfortPlus"
 *   Row 2: "Datum: 29.03.2026 - 11.04.2026"
 *   Row 5: Headers: ID | Name | DoB | Nat | Pass-No | DoI | DoE | PoI | Rm | Veg. | ...
 *   Row 6+: Tourist data rows
 */
class ExcelParserService {
  /**
   * Parse an Agenturdaten Excel file buffer
   * Returns structured data with booking info + tourist list
   */
  parseAgenturdaten(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

    const allBookings = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length === 0) continue;

      // Parse header section (rows 0-4): tour name and dates
      const tourInfo = this.parseTourInfo(rows);
      if (!tourInfo) continue;

      // Find the column header row (contains "ID", "Name", "Rm", etc.)
      const headerRowIndex = this.findHeaderRow(rows);
      if (headerRowIndex === -1) {
        // No tourist data, but we still have tour info - return minimal booking
        allBookings.push({
          bookingCode: tourInfo.bookingCode,
          reisename: tourInfo.reisename,
          departureDate: tourInfo.departureDate,
          returnArrivalDate: tourInfo.returnArrivalDate,
          arrivalDate: tourInfo.departureDate,
          pax: 0,
          tourists: [],
          source: 'excel'
        });
        continue;
      }

      // Map column indices from header row
      const colMap = this.mapTouristColumns(rows[headerRowIndex]);

      // Parse tourist rows
      const tourists = [];
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const nonEmpty = row.filter(c => c !== '' && c !== null && c !== undefined);
        if (nonEmpty.length === 0) continue;

        const tourist = this.parseTouristRow(row, colMap);
        if (tourist) tourists.push(tourist);
      }

      allBookings.push({
        bookingCode: tourInfo.bookingCode,
        reisename: tourInfo.reisename,
        departureDate: tourInfo.departureDate,
        returnArrivalDate: tourInfo.returnArrivalDate,
        arrivalDate: tourInfo.departureDate,
        pax: tourists.length,
        tourists,
        source: 'excel'
      });
    }

    return { bookings: allBookings };
  }

  /**
   * Parse tour info from the header rows
   * Looks for "Reise: ..." and "Datum: DD.MM.YYYY - DD.MM.YYYY"
   */
  parseTourInfo(rows) {
    let reisename = null;
    let departureDate = null;
    let returnArrivalDate = null;

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const firstCell = String(rows[i][0] || '').trim();

      // "Reise: Usbekistan ComfortPlus"
      if (firstCell.startsWith('Reise:')) {
        reisename = firstCell.replace(/^Reise:\s*/i, '').trim();
      }

      // "Datum: 29.03.2026 - 11.04.2026"
      if (firstCell.startsWith('Datum:')) {
        const datumStr = firstCell.replace(/^Datum:\s*/i, '').trim();
        const dateMatch = datumStr.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–—]\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (dateMatch) {
          departureDate = dateMatch[1];
          returnArrivalDate = dateMatch[2];
        }
      }
    }

    if (!reisename && !departureDate) return null;

    // Build a bookingCode from tour name + date
    const tourTypeCode = this.extractTourType(reisename);
    const dateStr = departureDate ? departureDate.replace(/\./g, '') : 'unknown';
    const bookingCode = tourTypeCode
      ? `${tourTypeCode}-${dateStr}`
      : (reisename || 'UNKNOWN').replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 10) + `-${dateStr}`;

    return { reisename, departureDate, returnArrivalDate, bookingCode };
  }

  /**
   * Find the tourist data header row (contains "ID", "Name", "Rm")
   */
  findHeaderRow(rows) {
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i];
      const rowStr = row.map(c => String(c || '').toLowerCase());
      if (rowStr.includes('id') && rowStr.includes('name') && rowStr.some(c => c === 'rm' || c === 'room')) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Map tourist column headers to indices
   */
  mapTouristColumns(headerRow) {
    const map = {};

    headerRow.forEach((cell, i) => {
      const h = String(cell || '').toLowerCase().trim();

      if (h === 'id') map.id = i;
      else if (h === 'name') map.name = i;
      else if (h === 'dob' || h === 'date of birth' || h === 'geburtsdatum') map.dob = i;
      else if (h === 'nat' || h === 'nationality' || h === 'nationalität') map.nationality = i;
      else if (h === 'pass-no' || h === 'passport' || h === 'pass no' || h === 'reisepass') map.passport = i;
      else if (h === 'doi' || h === 'date of issue') map.passportIssueDate = i;
      else if (h === 'doe' || h === 'date of expiry') map.passportExpiry = i;
      else if (h === 'poi' || h === 'place of issue') map.passportPlaceOfIssue = i;
      else if (h === 'rm' || h === 'room' || h === 'zimmer') map.room = i;
      else if (h === 'veg.' || h === 'veg' || h === 'vegetarian') map.vegetarian = i;
      else if (h === 'voyage option' || h === 'option') map.option = i;
      else if (h === 'remarks' || h === 'notes' || h === 'bemerkungen') map.remarks = i;
    });

    return map;
  }

  /**
   * Parse a single tourist row
   */
  parseTouristRow(row, colMap) {
    const get = (idx) => {
      if (idx === undefined || idx === null) return '';
      const val = row[idx];
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    const fullName = get(colMap.name);
    if (!fullName) return null;

    // Parse name: "Mrs. Richter, Nancy" → firstName: "Nancy", lastName: "Richter"
    const { firstName, lastName, gender } = this.parseName(fullName);

    const room = get(colMap.room).toUpperCase(); // EZ, DZ, etc.
    const roomType = this.mapRoomType(room);

    const dob = this.parseDate(row[colMap.dob]);
    const passportExpiry = this.parseDate(row[colMap.passportExpiry]);
    const passportIssueDate = this.parseDate(row[colMap.passportIssueDate]);

    return {
      worldInsightId: get(colMap.id),
      firstName,
      lastName,
      gender,
      fullName,
      dateOfBirth: dob,
      nationality: get(colMap.nationality),
      passport: get(colMap.passport),
      passportIssueDate,
      passportExpiry,
      passportPlaceOfIssue: get(colMap.passportPlaceOfIssue),
      roomType,
      roomCode: room,       // Original code: EZ, DZ
      vegetarian: get(colMap.vegetarian).toLowerCase() === 'yes',
      voyageOption: get(colMap.option),
      remarks: get(colMap.remarks)
    };
  }

  /**
   * Parse name "Mrs. Richter, Nancy" → { firstName, lastName, gender }
   */
  parseName(fullName) {
    let gender = null;
    let name = fullName;

    // Extract title (Mr./Mrs./Ms./Dr.)
    const titleMatch = name.match(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s*/i);
    if (titleMatch) {
      const title = titleMatch[1].toLowerCase();
      gender = (title === 'mr.') ? 'M' : 'F';
      name = name.replace(titleMatch[0], '').trim();
    }

    // "Richter, Nancy" → lastName: Richter, firstName: Nancy
    const commaParts = name.split(',');
    if (commaParts.length >= 2) {
      return {
        lastName: commaParts[0].trim(),
        firstName: commaParts.slice(1).join(',').trim(),
        gender
      };
    }

    // "Nancy Richter" → firstName: Nancy, lastName: Richter
    const spaceParts = name.split(' ');
    if (spaceParts.length >= 2) {
      return {
        firstName: spaceParts[0].trim(),
        lastName: spaceParts.slice(1).join(' ').trim(),
        gender
      };
    }

    return { firstName: '', lastName: name, gender };
  }

  /**
   * Map room code to our room type
   * EZ = Einzelzimmer = SNGL
   * DZ = Doppelzimmer = TWN or DBL
   */
  mapRoomType(code) {
    switch (code.toUpperCase()) {
      case 'EZ': return 'SNGL';
      case 'DZ': return 'TWN';
      case 'DBL': return 'DBL';
      default: return code || 'SNGL';
    }
  }

  /**
   * Parse date from Excel cell value (Date object or DD.MM.YYYY string)
   */
  parseDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      const d = String(value.getDate()).padStart(2, '0');
      const m = String(value.getMonth() + 1).padStart(2, '0');
      return `${d}.${m}.${value.getFullYear()}`;
    }

    const str = String(value).trim();

    // DD.MM.YYYY
    const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (dotMatch) {
      const d = dotMatch[1].padStart(2, '0');
      const m = dotMatch[2].padStart(2, '0');
      let y = dotMatch[3];
      if (y.length === 2) y = '20' + y;
      return `${d}.${m}.${y}`;
    }

    return null;
  }

  /**
   * Determine tour type code from tour name
   */
  extractTourType(reisename) {
    if (!reisename) return null;
    const name = reisename.toLowerCase();

    // Order matters: check more specific first
    if (name.includes('comfortplus') || name.includes('comfort plus')) return 'CO';
    if (name.includes('kasach') || name.includes('kazakh') || name.includes('kirgis') || name.includes('kyrgyz')) return 'KAS';
    if (name.includes('tadschik') || name.includes('tajik') || name.includes('zentralasien')) return 'ZA';
    if (name.includes('turkmen')) return 'ER'; // Turkmenistan tours are ER (MIXED)
    if (name.includes('usbek') || name.includes('uzbek')) return 'ER'; // Generic Uzbekistan → ER
    return null;
  }
}

module.exports = new ExcelParserService();
