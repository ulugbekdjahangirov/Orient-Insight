const pdfParse = require('pdf-parse');

/**
 * Parse Final Rooming List PDF and extract tourists, rooms, remarks, and flights
 */
async function parseRoomingListPdf(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;

  const result = {
    uzbekistanTourists: [],
    turkmenistanTourists: [],
    internationalFlights: [],
    domesticFlights: [],
    tourInfo: {}
  };

  // Split text into pages/sections
  const sections = text.split(/Final Rooming List/i);

  for (const section of sections) {
    if (!section.trim()) continue;

    // Determine tour type
    const isTurkmenistan = /Turkmenistan|mit Verl/i.test(section);
    const tourType = isTurkmenistan ? 'turkmenistan' : 'uzbekistan';

    // Extract tour dates
    const dateMatch = section.match(/Date:\s*(\d{2}\.\d{2}\.\d{4})\s*[–-]\s*(\d{2}\.\d{2}\.\d{4})/);
    if (dateMatch) {
      result.tourInfo[tourType] = {
        startDate: dateMatch[1],
        endDate: dateMatch[2]
      };
    }

    // Extract tourists from room sections
    const tourists = extractTouristsFromSection(section, tourType);
    if (tourType === 'turkmenistan') {
      result.turkmenistanTourists.push(...tourists);
    } else {
      result.uzbekistanTourists.push(...tourists);
    }

    // Extract remarks from Additional Information
    const remarkMatch = section.match(/Remark:\s*([^\n]+)/i);
    const remark = remarkMatch ? remarkMatch[1].trim() : '';
    if (remark && remark !== '//' && remark !== '-') {
      // Apply remark to all tourists in this section
      const targetList = tourType === 'turkmenistan' ? result.turkmenistanTourists : result.uzbekistanTourists;
      targetList.forEach(t => {
        if (!t.remarks) t.remarks = remark;
      });
    }
  }

  // Extract flights from entire text
  result.internationalFlights = extractInternationalFlights(text);
  result.domesticFlights = extractDomesticFlights(text);

  return result;
}

/**
 * Extract tourists from a rooming list section
 */
function extractTouristsFromSection(text, tourType) {
  const tourists = [];

  // Room type patterns
  const roomPatterns = [
    { pattern: /DOUBLE\s*([\s\S]*?)(?=TWIN|SINGLE|___|TOTAL|Additional|$)/i, roomType: 'DBL' },
    { pattern: /TWIN\s*([\s\S]*?)(?=SINGLE|___|TOTAL|Additional|$)/i, roomType: 'TWIN' },
    { pattern: /SINGLE\s*([\s\S]*?)(?=___|TOTAL|Additional|$)/i, roomType: 'SNGL' }
  ];

  for (const { pattern, roomType } of roomPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const sectionText = match[1];

      // Skip if section is empty (marked with //)
      if (sectionText.trim() === '//' || !sectionText.trim()) continue;

      // Extract names - look for Mr./Mrs./Ms. patterns
      const namePattern = /(?:Mr\.|Mrs\.|Ms\.)\s+([A-Za-zäöüÄÖÜß\s,'-]+?)(?=(?:Mr\.|Mrs\.|Ms\.|\n\n|\*|$))/gi;
      let nameMatch;

      while ((nameMatch = namePattern.exec(sectionText)) !== null) {
        const fullName = nameMatch[0].trim();
        if (fullName && !fullName.includes('PAX booked')) {
          tourists.push({
            fullName: cleanName(fullName),
            roomType,
            tourType,
            remarks: ''
          });
        }
      }
    }
  }

  return tourists;
}

/**
 * Clean and normalize tourist name
 */
function cleanName(name) {
  return name
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Extract international flights (routes involving IST or European airports)
 */
function extractInternationalFlights(text) {
  const flights = [];

  // Flight pattern: AIRLINE CODE + DATE + ROUTE + TIMES
  const flightPattern = /(?:TK|HY)\s*(\d{2,4})\s+(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;

  // European/International airports (not in Uzbekistan)
  const internationalAirports = ['FRA', 'HAM', 'BER', 'MUC', 'STR', 'NUE', 'IST', 'ASB'];
  // Uzbekistan domestic airports
  const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];

  let match;
  while ((match = flightPattern.exec(text)) !== null) {
    const [fullMatch, flightNum, dateStr, dep, arr, depTime, arrTime] = match;
    const airline = fullMatch.trim().startsWith('HY') ? 'HY' : 'TK';

    // International = involves IST, European airports, or ASB (Ashgabat)
    // NOT domestic = both airports are within Uzbekistan
    const depIsUzbek = uzbekAirports.includes(dep);
    const arrIsUzbek = uzbekAirports.includes(arr);
    const isInternational = internationalAirports.includes(dep) || internationalAirports.includes(arr) ||
                           !(depIsUzbek && arrIsUzbek);

    if (isInternational) {
      const existing = flights.find(f =>
        f.flightNumber === `${airline} ${flightNum}` && f.departure === dep && f.arrival === arr
      );

      if (!existing) {
        flights.push({
          flightNumber: `${airline} ${flightNum}`,
          departure: dep,
          arrival: arr,
          date: parseFlightDate(dateStr),
          departureTime: depTime,
          arrivalTime: arrTime,
          type: 'INTERNATIONAL'
        });
      }
    }
  }

  // Sort by date and route
  return flights.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // Outbound flights first (to TAS), then return flights
    if (a.arrival === 'TAS' && b.arrival !== 'TAS') return -1;
    if (a.arrival !== 'TAS' && b.arrival === 'TAS') return 1;
    return 0;
  });
}

/**
 * Extract domestic flights (internal Uzbekistan flights)
 */
function extractDomesticFlights(text) {
  const flights = [];

  // Uzbekistan domestic airports
  const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];

  // Flight pattern: AIRLINE CODE + DATE + ROUTE + TIMES
  const flightPattern = /(?:TK|HY)\s*(\d{2,4})\s+(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;

  let match;
  while ((match = flightPattern.exec(text)) !== null) {
    const [fullMatch, flightNum, dateStr, dep, arr, depTime, arrTime] = match;
    const airline = fullMatch.trim().startsWith('HY') ? 'HY' : 'TK';

    // Domestic = both airports are within Uzbekistan
    const depIsUzbek = uzbekAirports.includes(dep);
    const arrIsUzbek = uzbekAirports.includes(arr);
    const isDomestic = depIsUzbek && arrIsUzbek;

    if (isDomestic) {
      const existing = flights.find(f =>
        f.flightNumber === `${airline} ${flightNum}` && f.departure === dep && f.arrival === arr
      );

      if (!existing) {
        flights.push({
          flightNumber: `${airline} ${flightNum}`,
          departure: dep,
          arrival: arr,
          date: parseFlightDate(dateStr),
          departureTime: depTime,
          arrivalTime: arrTime,
          type: 'DOMESTIC'
        });
      }
    }
  }

  return flights;
}

/**
 * Parse flight date from format like "03OKT" to ISO date
 */
function parseFlightDate(dateStr) {
  if (!dateStr) return '';

  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OKT': '10', 'OCT': '10', 'NOV': '11',
    'DEC': '12', 'DEZ': '12'
  };

  const match = dateStr.match(/(\d{2})([A-Z]{3})/i);
  if (!match) return '';

  const day = match[1];
  const month = monthMap[match[2].toUpperCase()] || '01';
  const year = new Date().getFullYear();

  // Assume current year or next year if month is in the past
  const currentMonth = new Date().getMonth() + 1;
  const flightMonth = parseInt(month);
  const actualYear = flightMonth < currentMonth ? year + 1 : year;

  return `${actualYear}-${month}-${day}`;
}

/**
 * Airport code to city name mapping
 */
const airportNames = {
  'TAS': 'Tashkent',
  'SKD': 'Samarkand',
  'UGC': 'Urgench',
  'BHK': 'Bukhara',
  'NCU': 'Nukus',
  'NVI': 'Navoi',
  'KSQ': 'Karshi',
  'TMJ': 'Termez',
  'FEG': 'Fergana',
  'IST': 'Istanbul',
  'FRA': 'Frankfurt',
  'HAM': 'Hamburg',
  'BER': 'Berlin',
  'MUC': 'Munich',
  'STR': 'Stuttgart',
  'NUE': 'Nuremberg',
  'ASB': 'Ashgabat'
};

function getAirportName(code) {
  return airportNames[code] || code;
}

module.exports = {
  parseRoomingListPdf,
  getAirportName
};
