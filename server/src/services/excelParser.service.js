const XLSX = require('xlsx');

/**
 * Excel Parser Service
 * Parses Agenturdaten Excel files from World Insight
 * File format: booking/tour data with columns like
 * Reisename, Untertitel, Von, Bis, Gebuchte Pax, etc.
 */
class ExcelParserService {
  /**
   * Parse an Agenturdaten Excel file buffer
   * Returns structured booking data similar to Claude Vision output
   */
  parseAgenturdaten(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

    const allBookings = [];

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length === 0) continue;

      // Find header row (first row with content)
      let headerRowIndex = -1;
      let headers = [];

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        const nonEmpty = row.filter(cell => cell !== '' && cell !== null && cell !== undefined);
        if (nonEmpty.length >= 3) {
          headerRowIndex = i;
          headers = row.map(h => String(h || '').trim().toLowerCase());
          break;
        }
      }

      if (headerRowIndex === -1) continue;

      // Map column indices
      const colMap = this.mapColumns(headers);

      // Parse data rows
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];

        // Skip empty rows
        const nonEmpty = row.filter(c => c !== '' && c !== null && c !== undefined);
        if (nonEmpty.length === 0) continue;

        const booking = this.parseRow(row, colMap, sheetName);
        if (booking) {
          allBookings.push(booking);
        }
      }
    }

    return { bookings: allBookings };
  }

  /**
   * Map column headers to indices
   */
  mapColumns(headers) {
    const map = {};

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];

      if (!map.reisename && (h.includes('reisename') || h.includes('reise') || h.includes('tour'))) {
        map.reisename = i;
      } else if (!map.untertitel && (h.includes('untertitel') || h.includes('subtitle'))) {
        map.untertitel = i;
      } else if (!map.von && (h === 'von' || h.includes('von') || h === 'start' || h === 'beginn')) {
        map.von = i;
      } else if (!map.bis && (h === 'bis' || h.includes('bis') || h === 'ende' || h === 'end')) {
        map.bis = i;
      } else if (!map.pax && (h.includes('gebuchte pax') || h.includes('gebuchte') || h === 'pax' || h.includes('teilnehmer'))) {
        map.pax = i;
      } else if (!map.minPax && (h.includes('mindest') || h.includes('min'))) {
        map.minPax = i;
      } else if (!map.maxPax && (h.includes('maximal') || h.includes('max'))) {
        map.maxPax = i;
      } else if (!map.buchungsnummer && (h.includes('buchung') || h.includes('nummer') || h.includes('code') || h.includes('nr'))) {
        map.buchungsnummer = i;
      } else if (!map.status && h.includes('status')) {
        map.status = i;
      }
    }

    return map;
  }

  /**
   * Parse a single data row into booking object
   */
  parseRow(row, colMap, sheetName) {
    const get = (idx) => {
      if (idx === undefined || idx === null) return '';
      const val = row[idx];
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    const reisename = get(colMap.reisename);
    const buchungsnummer = get(colMap.buchungsnummer);

    // Skip rows without a tour name or booking number
    if (!reisename && !buchungsnummer) return null;

    const vonRaw = row[colMap.von];
    const bisRaw = row[colMap.bis];

    const von = this.parseDate(vonRaw);
    const bis = this.parseDate(bisRaw);

    const paxStr = get(colMap.pax);
    const pax = paxStr ? parseInt(paxStr.replace(/[^0-9]/g, ''), 10) || 0 : 0;

    // Try to extract booking code from reisename or buchungsnummer
    const bookingCode = buchungsnummer || this.extractBookingCode(reisename) || reisename;

    return {
      bookingCode: bookingCode,
      reisename: reisename,
      untertitel: get(colMap.untertitel),
      departureDate: von,
      returnArrivalDate: bis,
      arrivalDate: von, // Same as departure for summary files
      pax: pax,
      minPax: parseInt(get(colMap.minPax)) || 0,
      maxPax: parseInt(get(colMap.maxPax)) || 0,
      status: get(colMap.status),
      sheetName: sheetName,
      source: 'excel'
    };
  }

  /**
   * Parse date from Excel cell value
   * Handles: Date objects, DD.MM.YYYY strings, Excel serial numbers
   */
  parseDate(value) {
    if (!value) return null;

    // Already a Date object (when cellDates: true)
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      const d = String(value.getDate()).padStart(2, '0');
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const y = value.getFullYear();
      return `${d}.${m}.${y}`;
    }

    const str = String(value).trim();

    // DD.MM.YYYY or DD.MM.YY
    const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (dotMatch) {
      const d = dotMatch[1].padStart(2, '0');
      const m = dotMatch[2].padStart(2, '0');
      let y = dotMatch[3];
      if (y.length === 2) y = '20' + y;
      return `${d}.${m}.${y}`;
    }

    // YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
    }

    // Excel serial number
    if (/^\d+(\.\d+)?$/.test(str)) {
      const serial = parseFloat(str);
      if (serial > 1000) {
        const date = XLSX.SSF.parse_date_code(serial);
        if (date) {
          const d = String(date.d).padStart(2, '0');
          const m = String(date.m).padStart(2, '0');
          return `${d}.${m}.${date.y}`;
        }
      }
    }

    return null;
  }

  /**
   * Try to extract a booking code like "26CO-USB01" from tour name
   */
  extractBookingCode(reisename) {
    if (!reisename) return null;
    const match = reisename.match(/\b(\d{2}[A-Z]{2,3}-[A-Z]{2,3}\d+)\b/);
    return match ? match[1] : null;
  }

  /**
   * Determine tour type from reisename
   * Maps German tour names to tour type codes (CO, ER, KAS, ZA)
   */
  extractTourType(reisename) {
    if (!reisename) return null;
    const name = reisename.toLowerCase();

    if (name.includes('co') || name.includes('classic') || name.includes('klassik')) {
      return 'CO';
    }
    if (name.includes('er') || name.includes('erlebnis')) {
      return 'ER';
    }
    if (name.includes('kas') || name.includes('kasach') || name.includes('kazakh') || name.includes('kirgis')) {
      return 'KAS';
    }
    if (name.includes('za') || name.includes('zentral') || name.includes('tadschik')) {
      return 'ZA';
    }

    return null;
  }
}

module.exports = new ExcelParserService();
