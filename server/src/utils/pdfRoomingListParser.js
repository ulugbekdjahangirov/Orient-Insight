const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

/**
 * Parse Final Rooming List PDF and extract tourists, rooms, remarks, and flights
 */
async function parseRoomingListPdf(buffer, options = {}) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const sourceFileName = options.filename || 'imported.pdf';

  const result = {
    uzbekistanTourists: [],
    turkmenistanTourists: [],
    internationalFlights: [],
    domesticFlights: [],
    tourInfo: {},
    // NEW: Raw flight sections for display
    flightSections: {
      international: {
        rawContent: '',
        imageData: null,
        imageMimeType: null
      },
      domestic: {
        rawContent: '',
        imageData: null,
        imageMimeType: null
      }
    },
    sourceFileName
  };

  // Split text into pages/sections
  const sections = text.split(/Final Rooming List/i);

  for (const section of sections) {
    if (!section.trim()) continue;

    // Determine tour type
    const isTurkmenistan = /Turkmenistan|mit Verl/i.test(section);
    const tourType = isTurkmenistan ? 'turkmenistan' : 'uzbekistan';

    // Extract tour dates from MAIN HEADER ONLY (not from Additional Information)
    // Split section before "Additional Information" to avoid picking up individual tourist dates
    const beforeAdditionalInfo = section.split(/Additional\s+Information/i)[0];
    const dateMatch = beforeAdditionalInfo.match(/Date:\s*(\d{2}\.\d{2}\.\d{4})\s*[–-]\s*(\d{2}\.\d{2}\.\d{4})/);
    if (dateMatch) {
      result.tourInfo[tourType] = {
        startDate: dateMatch[1],
        endDate: dateMatch[2]
      };
      console.log(`📅 Extracted ${tourType} tour dates: ${dateMatch[1]} - ${dateMatch[2]} (from main header, excluding individual dates)`);
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

  // NEW: Extract raw flight sections for display
  result.flightSections = extractRawFlightSections(text);

  // Try to extract images from PDF
  try {
    const images = await extractPdfImages(buffer);
    if (images.length > 0) {
      // Assign images to flight sections based on context
      // First image likely to be flight table
      for (const img of images) {
        if (!result.flightSections.international.imageData) {
          result.flightSections.international.imageData = img.data;
          result.flightSections.international.imageMimeType = img.mimeType;
        } else if (!result.flightSections.domestic.imageData) {
          result.flightSections.domestic.imageData = img.data;
          result.flightSections.domestic.imageMimeType = img.mimeType;
        }
      }
    }
  } catch (imageError) {
    console.log('Note: Could not extract images from PDF:', imageError.message);
  }

  return result;
}

/**
 * Extract raw flight sections from PDF text
 * Returns structured content for International and Domestic flights
 */
function extractRawFlightSections(text) {
  const sections = {
    international: {
      rawContent: '',
      imageData: null,
      imageMimeType: null
    },
    domestic: {
      rawContent: '',
      imageData: null,
      imageMimeType: null
    }
  };

  // Patterns for flight section headers (German/English)
  const internationalHeaders = [
    /International\s*(?:Fl[üu]ge|Flights?)/i,
    /Internationale\s*Fl[üu]ge/i,
    /Int(?:ernational)?\s*Flights?/i,
    /IST\s*[-–→]\s*TAS/i,
    /TAS\s*[-–→]\s*IST/i
  ];

  const domesticHeaders = [
    /Domestic\s*(?:Fl[üu]ge|Flights?)/i,
    /Inlandsfl[üu]ge/i,
    /Interne\s*Fl[üu]ge/i,
    /Dom(?:estic)?\s*Flights?/i
  ];

  // Split text into lines for easier processing
  const lines = text.split('\n');
  let currentSection = null;
  let sectionStartIdx = -1;
  let internationalLines = [];
  let domesticLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for section headers
    const isInternationalHeader = internationalHeaders.some(p => p.test(line));
    const isDomesticHeader = domesticHeaders.some(p => p.test(line));

    if (isInternationalHeader) {
      currentSection = 'international';
      sectionStartIdx = i;
      continue;
    } else if (isDomesticHeader) {
      currentSection = 'domestic';
      sectionStartIdx = i;
      continue;
    }

    // Check if line contains flight information (TK/HY flight numbers or airport codes)
    const hasFlightInfo = /(?:TK|HY)\s*\d{2,4}|[A-Z]{3}\s*[-–→]\s*[A-Z]{3}|\d{2}:\d{2}/.test(line);

    // If we have flight info and no current section, try to determine section
    if (hasFlightInfo && !currentSection) {
      // Check if this looks like IST-TAS or TAS-IST (international)
      if (/IST|TAS/.test(line) && (/IST.*TAS|TAS.*IST/.test(line) || line.includes('IST') || line.includes('TAS'))) {
        // Check if this is IST ↔ TAS route specifically
        if (/IST\s*[-–→]?\s*TAS|TAS\s*[-–→]?\s*IST/.test(line)) {
          currentSection = 'international';
        }
      }
      // Check if this is a domestic Uzbekistan flight
      const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];
      const airportMatch = line.match(/([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/);
      if (airportMatch) {
        const [, dep, arr] = airportMatch;
        if (uzbekAirports.includes(dep) && uzbekAirports.includes(arr)) {
          currentSection = 'domestic';
        }
      }
    }

    // Collect lines for current section
    if (currentSection && hasFlightInfo) {
      if (currentSection === 'international') {
        internationalLines.push(line);
      } else if (currentSection === 'domestic') {
        domesticLines.push(line);
      }
    }

    // Reset section after empty line or section change
    if (line === '' && currentSection) {
      // Keep section for a few more lines in case of formatting
    }

    // End section detection (next major section like DOUBLE, SINGLE, etc.)
    if (/^(?:DOUBLE|TWIN|SINGLE|TOTAL|PAX|Additional)/i.test(line)) {
      currentSection = null;
    }
  }

  // Build raw content blocks
  // For international flights: extract IST ↔ TAS flights only
  const allFlightLines = [];
  const flightPattern = /(?:TK|HY)\s*(\d{2,4}).*?([A-Z]{3})\s*[-–→]\s*([A-Z]{3}).*?(\d{2}:\d{2})?.*?(\d{2}:\d{2})?/gi;

  let match;
  while ((match = flightPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const dep = match[2];
    const arr = match[3];

    // Filter: International = IST ↔ TAS only
    if ((dep === 'IST' && arr === 'TAS') || (dep === 'TAS' && arr === 'IST')) {
      if (!internationalLines.includes(fullMatch)) {
        internationalLines.push(fullMatch);
      }
    }

    // Filter: Domestic = within Uzbekistan
    const uzbekAirports = ['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG'];
    if (uzbekAirports.includes(dep) && uzbekAirports.includes(arr) && dep !== 'IST' && arr !== 'IST') {
      if (!domesticLines.includes(fullMatch)) {
        domesticLines.push(fullMatch);
      }
    }
  }

  // Format raw content as readable blocks
  if (internationalLines.length > 0) {
    sections.international.rawContent = formatFlightBlock('International Flights', internationalLines, text);
  }

  if (domesticLines.length > 0) {
    sections.domestic.rawContent = formatFlightBlock('Domestic Flights', domesticLines, text);
  }

  return sections;
}

/**
 * Format flight lines into a readable block
 */
function formatFlightBlock(title, lines, fullText) {
  // Try to find the original formatting from the PDF
  const uniqueLines = [...new Set(lines)];

  // Extract more context around each flight line
  const enrichedLines = uniqueLines.map(line => {
    // Try to find the full line with date and times
    const flightNum = line.match(/(TK|HY)\s*(\d{2,4})/i);
    if (flightNum) {
      // Search for more complete version of this flight in fullText
      const searchPattern = new RegExp(
        `(?:\\w+[,.]?\\s*)?${flightNum[1]}\\s*${flightNum[2]}[^\\n]*`,
        'gi'
      );
      const fullMatch = fullText.match(searchPattern);
      if (fullMatch && fullMatch[0].length > line.length) {
        return fullMatch[0].trim();
      }
    }
    return line;
  });

  return enrichedLines.join('\n');
}

/**
 * Extract images from PDF using pdf-lib
 */
async function extractPdfImages(buffer) {
  const images = [];

  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    for (let pageNum = 0; pageNum < pages.length; pageNum++) {
      const page = pages[pageNum];

      // Get the page's resources
      const resources = page.node.Resources();
      if (!resources) continue;

      const xObjects = resources.lookup(require('pdf-lib').PDFName.of('XObject'));
      if (!xObjects) continue;

      // Iterate through XObjects looking for images
      const xObjectNames = xObjects.keys();
      for (const name of xObjectNames) {
        try {
          const xObject = xObjects.lookup(name);
          if (!xObject) continue;

          const subtype = xObject.lookup(require('pdf-lib').PDFName.of('Subtype'));
          if (subtype && subtype.toString() === '/Image') {
            // Try to extract image data
            const width = xObject.lookup(require('pdf-lib').PDFName.of('Width'));
            const height = xObject.lookup(require('pdf-lib').PDFName.of('Height'));

            if (width && height) {
              // For now, we'll note that image exists but full extraction is complex
              // Would need additional libraries like sharp or jimp for full extraction
              images.push({
                pageNumber: pageNum + 1,
                width: width.value(),
                height: height.value(),
                data: null, // Full image extraction requires more processing
                mimeType: 'image/png'
              });
            }
          }
        } catch (xoErr) {
          // Skip problematic XObjects
          continue;
        }
      }
    }
  } catch (err) {
    console.log('Could not extract images from PDF:', err.message);
  }

  return images;
}

/**
 * Extract hotel name from section text
 * Patterns: "Директору гостиницы [HOTEL]", "Hotel: [NAME]", etc.
 */
function extractHotelName(text) {
  // Pattern 1: Директору гостиницы [Hotel Name]
  const pattern1 = /Директору\s+гостиницы\s+([^\n]+)/i;
  const match1 = text.match(pattern1);
  if (match1) {
    return match1[1].trim();
  }

  // Pattern 2: Hotel: [Name]
  const pattern2 = /Hotel:\s*([^\n]+)/i;
  const match2 = text.match(pattern2);
  if (match2) {
    return match2[1].trim();
  }

  // Pattern 3: Look for hotel names in common patterns
  const hotelPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Hotel/i,
    /Hotel\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
  ];

  for (const pattern of hotelPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract check-in and check-out dates from section text
 */
function extractCheckInOutDates(text) {
  // Pattern: "Первый заезд" or "Второй заезд" followed by date
  const checkInPattern = /(?:Первый|Второй)\s+заезд[:\s]*(\d{2}\.\d{2}\.\d{4})/i;
  const checkOutPattern = /(?:Первый|Второй)\s+выезд[:\s]*(\d{2}\.\d{2}\.\d{4})/i;

  const checkInMatch = text.match(checkInPattern);
  const checkOutMatch = text.match(checkOutPattern);

  return {
    checkInDate: checkInMatch ? parseDateDDMMYYYY(checkInMatch[1]) : null,
    checkOutDate: checkOutMatch ? parseDateDDMMYYYY(checkOutMatch[1]) : null
  };
}

/**
 * Parse date in DD.MM.YYYY format to ISO date
 */
function parseDateDDMMYYYY(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

/**
 * Extract tourists from a rooming list section
 */
function extractTouristsFromSection(text, tourType) {
  const tourists = [];

  // Extract hotel name from section
  const hotelName = extractHotelName(text);

  // Extract check-in/out dates
  const dates = extractCheckInOutDates(text);

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
            hotelName: hotelName || null,
            checkInDate: dates.checkInDate,
            checkOutDate: dates.checkOutDate,
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
 * Extract international flights (ONLY IST ↔ TAS routes per requirements)
 * Filter: Show only IST → TAS and TAS → IST flights
 */
function extractInternationalFlights(text) {
  const flights = [];

  // Flight pattern: AIRLINE CODE + DATE + ROUTE + TIMES
  const flightPattern = /(?:TK|HY)\s*(\d{2,4})\s+(\d{2}[A-Z]{3})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/gi;

  let match;
  while ((match = flightPattern.exec(text)) !== null) {
    const [fullMatch, flightNum, dateStr, dep, arr, depTime, arrTime] = match;
    const airline = fullMatch.trim().startsWith('HY') ? 'HY' : 'TK';

    // FILTER: Only IST ↔ TAS routes (per user requirements)
    const isIstTas = (dep === 'IST' && arr === 'TAS') || (dep === 'TAS' && arr === 'IST');

    if (isIstTas) {
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
    // Outbound flights first (IST → TAS), then return flights (TAS → IST)
    if (a.departure === 'IST' && b.departure !== 'IST') return -1;
    if (a.departure !== 'IST' && b.departure === 'IST') return 1;
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
