const Anthropic = require('@anthropic-ai/sdk');

class ClaudeVisionService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Parse booking screenshot using Claude Vision
   */
  async parseBookingScreenshot(imageBuffer) {
    const base64Image = imageBuffer.toString('base64');


    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Parse this booking schedule table into JSON format.

Extract data with these exact field names:
{
  "bookings": [
    {
      "bookingCode": "26CO-USB01",           // From "Reise" column
      "departureDay": "Sonntag",             // From "Abflugtag DEP" column
      "departureDate": "15.03.2026",         // From "DEP FRA" column (first date)
      "arrivalDate": "16.03.2026",           // From "ARR TAS" column (first date)
      "arrivalDay": "Freitag",               // From ARR TAS row
      "returnUgcDate": "27.03.2026",         // From "UGC-TAS" column
      "returnDepartureDay": "Samstag",       // From second "Abflugtag DEP"
      "returnDepartureDate": "28.03.2026",   // From "DEP TAS" column
      "returnArrivalDate": "28.03.2026",     // From "ARR FRA" column
      "flightNumberDEP": "TK368",            // From "DEP FRA" column header
      "flightNumberRETURN": "TK369"          // From "ARR FRA" column header
    }
  ]
}

Rules:
- Extract ALL rows from the table
- Keep dates in DD.MM.YYYY format
- Extract flight numbers from column headers (e.g., "TK368" from "DEP FRA" section)
- Extract day names (Sonntag, Montag, etc.)
- If a cell is green, note it in a "highlights" field
- If "bevorzugt nachmittags" appears, add it to "notes" field
- Return valid JSON only, no markdown code blocks
- If this is not a booking table, return: {"error": "Not a booking table"}`
            }
          ]
        }],
        temperature: 0
      });

      const responseText = message.content[0].text.trim();

      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      const parsedData = JSON.parse(jsonText);


      return parsedData;
    } catch (error) {
      console.error('❌ Claude Vision parsing failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate parsed data structure
   */
  async validateParsedData(data) {
    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.bookings || !Array.isArray(data.bookings)) {
      throw new Error('Invalid data structure: missing bookings array');
    }

    if (data.bookings.length === 0) {
      throw new Error('No bookings found in screenshot');
    }

    // Validate each booking has required fields
    for (const booking of data.bookings) {
      if (!booking.bookingCode) {
        throw new Error(`Missing bookingCode for booking: ${JSON.stringify(booking)}`);
      }
      // departureDate is required for screenshot imports but may be absent in Excel summary files
      if (!booking.departureDate && booking.source !== 'excel') {
        throw new Error(`Missing departureDate for booking: ${booking.bookingCode}`);
      }
    }

    return true;
  }

  /**
   * Transform parsed booking to database format
   */
  transformToBookingData(parsedBooking) {
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      // Parse DD.MM.YYYY format
      const parts = dateStr.split('.');
      if (parts.length !== 3) return null;

      const [day, month, year] = parts;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    };

    const departureDate = parseDate(parsedBooking.departureDate);
    const arrivalDate = parseDate(parsedBooking.arrivalDate);
    const endDate = parseDate(parsedBooking.returnArrivalDate);

    // Build avia field
    const avia = [
      parsedBooking.flightNumberDEP,
      parsedBooking.flightNumberRETURN
    ].filter(Boolean).join(' / ');

    return {
      bookingNumber: parsedBooking.bookingCode,
      departureDate,
      arrivalDate,
      endDate,
      avia: avia || null,
      pax: parsedBooking.pax || 0,
      // These fields will be filled by existing import logic:
      // tourTypeId, guide, status, etc.
    };
  }

  /**
   * Extract tour type code from booking number
   */
  extractTourTypeCode(bookingNumber) {
    // Examples: "26CO-USB01" -> "CO", "26ER-USB01" -> "ER"
    const match = bookingNumber.match(/^\d+([A-Z]+)/);
    if (match) {
      return match[1];
    }
    return null;
  }
}

module.exports = new ClaudeVisionService();
