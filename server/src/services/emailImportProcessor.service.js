const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const gmailService = require('./gmail.service');
const claudeVision = require('./claudeVision.service');
const excelParser = require('./excelParser.service');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

class EmailImportProcessor {
  /**
   * Process a single email import
   */
  async processEmailImport(emailImportId) {
    const emailImport = await prisma.emailImport.findUnique({
      where: { id: emailImportId }
    });

    if (!emailImport) {
      throw new Error(`EmailImport ${emailImportId} not found`);
    }

    console.log(`📦 Processing email import ${emailImportId}: ${emailImport.emailSubject}`);

    try {
      // Update status to PROCESSING
      await prisma.emailImport.update({
        where: { id: emailImportId },
        data: { status: 'PROCESSING' }
      });

      // Read attachment from disk
      const fileBuffer = await fs.readFile(emailImport.attachmentUrl);

      // Handle EMAIL_BODY_TABLE (HTML PAX table from email body)
      if (emailImport.attachmentName === 'EMAIL_BODY_TABLE') {
        console.log(`📋 Processing HTML body PAX table from email`);
        const html = fileBuffer.toString('utf-8');
        const rows = await this.parseHtmlTableForPax(html);

        if (rows.length === 0) {
          await prisma.emailImport.update({
            where: { id: emailImportId },
            data: {
              status: 'MANUAL_REVIEW',
              errorMessage: 'No valid PAX rows found in HTML table',
              processedAt: new Date()
            }
          });
          return { created: 0, updated: 0, ids: [] };
        }

        console.log(`📊 Found ${rows.length} tour row(s) in HTML table`);
        const result = await this.updateBookingsFromTableRows(rows);

        await prisma.emailImport.update({
          where: { id: emailImportId },
          data: {
            status: 'SUCCESS',
            bookingsCreated: 0,
            bookingsUpdated: result.updated,
            bookingIds: result.ids.join(','),
            rawParsedData: JSON.stringify(rows, null, 2),
            processedAt: new Date()
          }
        });

        console.log(`✅ HTML table processed: ${result.updated} booking(s) updated`);
        return { created: 0, updated: result.updated, ids: result.ids };
      }

      // Determine file type and parse accordingly
      const isExcel = this.isExcelFile(emailImport.attachmentName, emailImport.attachmentType);
      const isPdf = !isExcel && emailImport.attachmentName?.toLowerCase().endsWith('.pdf');

      // PDF Final Rooming List → import tourists directly
      if (isPdf) {
        console.log(`📄 Trying PDF rooming list import: ${emailImport.attachmentName}`);
        const pdfResult = await this.importRoomingListPdfForEmail(fileBuffer);
        if (pdfResult) {
          await prisma.emailImport.update({
            where: { id: emailImportId },
            data: {
              status: 'SUCCESS',
              bookingsCreated: 0,
              bookingsUpdated: 1,
              bookingIds: String(pdfResult.bookingId),
              rawParsedData: JSON.stringify(pdfResult.summary),
              processedAt: new Date()
            }
          });
          const realMessageId = emailImport.gmailMessageId.includes('::')
            ? emailImport.gmailMessageId.split('::')[0]
            : emailImport.gmailMessageId;
          await gmailService.markAsProcessed(realMessageId);
          await this.sendNotification('SUCCESS', {
            emailFrom: emailImport.emailFrom,
            emailSubject: emailImport.emailSubject,
            bookingsCreated: 0,
            bookingsUpdated: 1,
            bookingIds: [pdfResult.bookingId]
          });
          console.log(`✅ PDF rooming list imported for booking ${pdfResult.bookingId}`);
          return { created: 0, updated: 1, ids: [pdfResult.bookingId] };
        }
        // PDF rooming list not recognized — mark for manual review, no Claude Vision
        console.log(`⚠️  PDF not recognized as rooming list — marking MANUAL_REVIEW`);
        await prisma.emailImport.update({
          where: { id: emailImportId },
          data: {
            status: 'MANUAL_REVIEW',
            errorMessage: `PDF not recognized as Final Rooming List: ${emailImport.attachmentName}`,
            retryCount: emailImport.retryCount,
            processedAt: new Date()
          }
        });
        return { created: 0, updated: 0, ids: [] };
      }

      // Images — skip Claude Vision, mark for manual review
      if (!isExcel) {
        console.log(`🖼️  Image/unknown file — marking MANUAL_REVIEW (Claude Vision disabled)`);
        await prisma.emailImport.update({
          where: { id: emailImportId },
          data: {
            status: 'MANUAL_REVIEW',
            errorMessage: `Image/unknown file type — manual processing required: ${emailImport.attachmentName}`,
            retryCount: emailImport.retryCount,
            processedAt: new Date()
          }
        });
        return { created: 0, updated: 0, ids: [] };
      }

      let parsedData;
      if (isExcel) {
        console.log(`📊 Parsing Excel file: ${emailImport.attachmentName}`);
        parsedData = excelParser.parseAgenturdaten(fileBuffer);
      }

      // Validate structure
      await claudeVision.validateParsedData(parsedData);

      // Save raw parsed data
      await prisma.emailImport.update({
        where: { id: emailImportId },
        data: { rawParsedData: JSON.stringify(parsedData, null, 2) }
      });

      // Import bookings
      const results = await this.importBookings(parsedData.bookings);

      // Update status to SUCCESS
      await prisma.emailImport.update({
        where: { id: emailImportId },
        data: {
          status: 'SUCCESS',
          bookingsCreated: results.created,
          bookingsUpdated: results.updated,
          bookingIds: results.ids.join(','),
          processedAt: new Date()
        }
      });

      // Mark email as processed in Gmail
      // gmailMessageId may be "messageId::filename" format for Excel files
      const realMessageId = emailImport.gmailMessageId.includes('::')
        ? emailImport.gmailMessageId.split('::')[0]
        : emailImport.gmailMessageId;
      await gmailService.markAsProcessed(realMessageId);

      // Send success notification
      await this.sendNotification('SUCCESS', {
        emailFrom: emailImport.emailFrom,
        emailSubject: emailImport.emailSubject,
        bookingsCreated: results.created,
        bookingsUpdated: results.updated,
        bookingIds: results.ids
      });

      console.log(`✅ Successfully processed import ${emailImportId}: ${results.created} created, ${results.updated} updated`);

      return results;

    } catch (error) {
      console.error(`❌ Failed to process email import ${emailImportId}:`, error);

      // Increment retry count
      const retryCount = emailImport.retryCount + 1;
      const status = retryCount >= 3 ? 'MANUAL_REVIEW' : 'FAILED';

      await prisma.emailImport.update({
        where: { id: emailImportId },
        data: {
          status,
          errorMessage: error.message,
          retryCount,
          processedAt: new Date()
        }
      });

      // Send failure notification
      await this.sendNotification('FAILURE', {
        emailFrom: emailImport.emailFrom,
        emailSubject: emailImport.emailSubject,
        errorMessage: error.message,
        retryCount
      });

      throw error;
    }
  }

  /**
   * Check if a file is an Excel file based on name or MIME type
   */
  isExcelFile(filename, mimeType) {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || mimeType === 'application/vnd.ms-excel') {
      return true;
    }
    if (filename) {
      const lower = filename.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Import bookings from parsed data
   */
  async importBookings(parsedBookings) {
    let created = 0;
    let updated = 0;
    const ids = [];

    for (const parsedBooking of parsedBookings) {
      try {
        // Excel files: match by tourType + departure date, then import tourists
        if (parsedBooking.source === 'excel') {
          const result = await this.importExcelBooking(parsedBooking);
          if (result) {
            if (result.action === 'created') created++;
            else updated++;
            ids.push(result.bookingId);
          }
          continue;
        }

        // Screenshot imports: original logic using booking number
        const bookingData = claudeVision.transformToBookingData(parsedBooking);

        const existing = await prisma.booking.findFirst({
          where: { bookingNumber: bookingData.bookingNumber }
        });

        if (existing) {
          const updateData = {
            departureDate: bookingData.departureDate,
            arrivalDate: bookingData.arrivalDate,
            endDate: bookingData.endDate,
            avia: bookingData.avia
          };
          await prisma.booking.update({
            where: { id: existing.id },
            data: updateData
          });
          updated++;
          ids.push(existing.id);
          console.log(`✏️  Updated booking: ${bookingData.bookingNumber}`);
        } else {
          const tourTypeCode = claudeVision.extractTourTypeCode(bookingData.bookingNumber);
          if (!tourTypeCode) {
            console.warn(`⚠️  Cannot extract tour type from: ${bookingData.bookingNumber}`);
            continue;
          }
          const tourType = await prisma.tourType.findFirst({ where: { code: tourTypeCode } });
          if (!tourType) { console.warn(`⚠️  Unknown tour type: ${tourTypeCode}`); continue; }

          const newBooking = await prisma.booking.create({
            data: {
              ...bookingData,
              tourTypeId: tourType.id,
              status: 'PENDING',
              pax: 0,
              roomsDbl: 0, roomsTwn: 0, roomsSngl: 0, roomsTotal: 0
            }
          });
          created++;
          ids.push(newBooking.id);
          console.log(`✨ Created booking: ${bookingData.bookingNumber}`);
        }
      } catch (error) {
        console.error(`❌ Failed to import booking ${parsedBooking.bookingCode}:`, error.message);
        // For Excel imports, re-throw so the error is recorded as FAILED (not swallowed as SUCCESS)
        if (parsedBooking.source === 'excel') {
          throw error;
        }
      }
    }

    return { created, updated, ids };
  }

  /**
   * Import an Excel (Agenturdaten) booking:
   * 1. Find matching booking by tourType + departureDate
   * 2. Import tourists into found booking
   */
  async importExcelBooking(parsedBooking) {
    const reisename = parsedBooking.reisename || '';
    const lowerName = reisename.toLowerCase();

    // Detect tour type from Excel filename patterns
    let tourTypeCode;

    // ER: "Usbekistan" or "Usbekistan mit Verlängerung Turkmenistan"
    const isER = (lowerName.includes('usbekistan') || lowerName.includes('uzbekistan')) &&
                 !lowerName.includes('comfortplus') &&
                 !lowerName.includes('comfort') &&
                 !lowerName.includes('kasachstan') &&
                 !lowerName.includes('kirgistan') &&
                 !lowerName.includes('tadschikistan');

    // CO: "Usbekistan ComfortPlus" or "ComfortPlus"
    const isCO = (lowerName.includes('comfortplus') || lowerName.includes('comfort')) &&
                 (lowerName.includes('usbekistan') || lowerName.includes('uzbekistan'));

    // KAS: "Kasachstan, Kirgistan und Usbekistan"
    const isKAS = (lowerName.includes('kasachstan') || lowerName.includes('kazakhstan')) &&
                  (lowerName.includes('kirgistan') || lowerName.includes('kyrgyzstan')) &&
                  (lowerName.includes('usbekistan') || lowerName.includes('uzbekistan')) &&
                  !lowerName.includes('turkmenistan') &&
                  !lowerName.includes('tadschikistan');

    // ZA: "Turkmenistan, Usbekistan, Tadschikistan, Kasachstan und Kirgistan" (all 5 countries)
    const isZA = (lowerName.includes('turkmenistan') || lowerName.includes('turkmen')) &&
                 (lowerName.includes('usbekistan') || lowerName.includes('uzbekistan')) &&
                 (lowerName.includes('tadschikistan') || lowerName.includes('tajikistan')) &&
                 (lowerName.includes('kasachstan') || lowerName.includes('kazakhstan')) &&
                 (lowerName.includes('kirgistan') || lowerName.includes('kyrgyzstan'));

    if (isER) {
      tourTypeCode = 'ER';
      console.log(`📍 Uzbekistan/Turkmenistan Excel detected → forcing ER tour type`);
    } else if (isCO) {
      tourTypeCode = 'CO';
      console.log(`📍 Usbekistan ComfortPlus Excel detected → forcing CO tour type`);
    } else if (isKAS) {
      tourTypeCode = 'KAS';
      console.log(`📍 Kasachstan, Kirgistan und Usbekistan Excel detected → forcing KAS tour type`);
    } else if (isZA) {
      tourTypeCode = 'ZA';
      console.log(`📍 Zentralasien (5 countries) Excel detected → forcing ZA tour type`);
    } else {
      tourTypeCode = excelParser.extractTourType(parsedBooking.reisename);
      if (!tourTypeCode) {
        console.warn(`⚠️  Cannot determine tour type from: ${parsedBooking.reisename}`);
        return null;
      }
    }

    const tourType = await prisma.tourType.findFirst({ where: { code: tourTypeCode } });
    if (!tourType) {
      console.warn(`⚠️  Unknown tour type code: ${tourTypeCode}`);
      return null;
    }

    // Parse departure date
    const departureDate = this.parseDateString(parsedBooking.departureDate);
    const endDate = this.parseDateString(parsedBooking.returnArrivalDate);

    // Find booking by tourType + departure date with tolerance:
    // - ZA: ±5 days (Excel has Germany departure date, DB has Uzbekistan arrival ~4 days later)
    // - Others: ±1 day (timezone fix: server UTC+5 may shift date by ±1 day)
    let booking = null;
    if (!departureDate) {
      throw new Error(`Excel faylda sana topilmadi: ${parsedBooking.departureDate}`);
    }

    // Search ±1 day to handle timezone differences
    // Server UTC+5 stores "March 29 local midnight" as "March 28 19:00 UTC"
    // So we search from day-1 to day+1 to catch both UTC and UTC+5 stored dates
    const [d, m, y] = parsedBooking.departureDate.split('.');
    const from = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d) - 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d) + 1, 23, 59, 59, 999));

    booking = await prisma.booking.findFirst({
      where: {
        tourTypeId: tourType.id,
        departureDate: { gte: from, lte: to }
      }
    });

    if (booking) {
      console.log(`🔍 Date match: Excel=${parsedBooking.departureDate}, DB=${booking.departureDate.toLocaleDateString('de-DE')}`);
    }

    if (!booking) {
      // Gruppa topilmadi - xato berish (yangi gruppa yaratmaymiz!)
      throw new Error(`Gruppa topilmadi: ${tourTypeCode} tour type, sana ${parsedBooking.departureDate}. Iltimos, avval gruppani yarating yoki sanani tekshiring.`);
    }

    console.log(`🔗 Matched booking: ${booking.bookingNumber} (exact date match: ${departureDate.toLocaleDateString('de-DE')})`);
    const action = 'updated';

    // Determine placement from Excel filename (Reisename)
    // ER: "Usbekistan" → Uzbekistan, "Usbekistan mit Verlängerung Turkmenistan" → Turkmenistan
    // CO: "Usbekistan ComfortPlus" → Uzbekistan (ComfortPlus has no Turkmenistan)
    // KAS/ZA: always "Not assigned" (no Uzbekistan/Turkmenistan split)
    let placement;

    if (tourTypeCode === 'ER') {
      // ER tours: check for Turkmenistan
      const hasTurkmen = lowerName.includes('turkmenistan') || lowerName.includes('turkmen');
      placement = hasTurkmen ? 'Turkmenistan' : 'Uzbekistan';
    } else if (tourTypeCode === 'CO') {
      // CO tours: always Uzbekistan (ComfortPlus)
      placement = 'Uzbekistan';
    } else {
      // KAS, ZA: no placement split
      placement = 'Not assigned';
    }

    console.log(`📍 Excel placement detected: ${placement} (${tourTypeCode} tour, from: ${parsedBooking.reisename})`);

    // SELECTIVE REPLACE: Delete only tourists with matching placement
    if (parsedBooking.tourists && parsedBooking.tourists.length > 0) {
      // Delete existing tourists with same placement OR null/empty accommodation
      // This handles old tourists that were created before accommodation field was implemented
      const deletedCount = await prisma.tourist.deleteMany({
        where: {
          bookingId: booking.id,
          OR: [
            { accommodation: placement },
            { accommodation: null },
            { accommodation: '' },
            { accommodation: 'Not assigned' }
          ]
        }
      });
      if (deletedCount.count > 0) {
        console.log(`🗑️  SELECTIVE REPLACE: Deleted ${deletedCount.count} tourists (${placement} + null/empty) from ${booking.bookingNumber}`);
      }

      // Import all tourists from Excel with correct placement
      let touristsAdded = 0;
      for (const t of parsedBooking.tourists) {
        // Create new tourist with placement
        await prisma.tourist.create({
          data: {
            bookingId: booking.id,
            firstName: t.firstName || '',
            lastName: t.lastName || '',
            fullName: t.fullName || `${t.firstName} ${t.lastName}`.trim(),
            gender: t.gender,
            dateOfBirth: t.dateOfBirth ? this.parseDateString(t.dateOfBirth) : null,
            passportNumber: t.passport || null,
            passportExpiryDate: t.passportExpiry ? this.parseDateString(t.passportExpiry) : null,
            country: t.nationality || 'Deutschland',
            roomPreference: t.roomType || 'SNGL',
            accommodation: placement,
            remarks: [t.remarks, t.voyageOption].filter(Boolean).join('; ') || null,
            notes: t.vegetarian ? 'Vegetarian' : null
          }
        });
        touristsAdded++;
      }

      // Update booking PAX count (pax + paxUzbekistan + paxTurkmenistan)
      const allTourists = await prisma.tourist.findMany({
        where: { bookingId: booking.id },
        select: { accommodation: true }
      });
      const totalTourists = allTourists.length;
      const uzbekCount = allTourists.filter(t => (t.accommodation || '').toLowerCase().includes('uzbek')).length;
      const turkCount = allTourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;
      await prisma.booking.update({
        where: { id: booking.id },
        data: { pax: totalTourists, paxUzbekistan: uzbekCount, paxTurkmenistan: turkCount, paxSource: 'EXCEL' }
      });

      console.log(`👥 Imported ${touristsAdded} new tourists for booking ${booking.bookingNumber} (total: ${totalTourists})`);
    }

    return { bookingId: booking.id, action };
  }

  /**
   * Import tourists from a Final Rooming List PDF (email attachment).
   * Finds matching booking by tour type code + departure date (±3 days).
   * Calls the existing import-pdf endpoint in UPDATE-ONLY mode (no deletions).
   */
  async importRoomingListPdfForEmail(fileBuffer) {
    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text;

      // Extract departure date from "Date: DD.MM.YYYY" or "DD.MM.YYYY – DD.MM.YYYY" range
      const dateMatch = text.match(/(?:Date:|Datum:)?\s*(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]/i)
        || text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]/);
      if (!dateMatch) {
        console.log('⚠️  PDF: no departure date found');
        return null;
      }
      const [, d, m, y] = dateMatch;
      const departureDate = new Date(`${y}-${m}-${d}`);

      // Find matching booking (±3 days tolerance)
      const from = new Date(departureDate); from.setDate(from.getDate() - 3);
      const to = new Date(departureDate); to.setDate(to.getDate() + 3);

      let booking = null;

      // Try 1: extract 2-3 letter tour code ("Tour: ER Uzbekistan" or "Tour: CO ...")
      const tourMatch = text.match(/Tour:\s*([A-Z]{2,3})\s/i);
      const tourTypeCode = tourMatch?.[1]?.toUpperCase();
      if (tourTypeCode) {
        const tourType = await prisma.tourType.findFirst({ where: { code: tourTypeCode } });
        if (tourType) {
          booking = await prisma.booking.findFirst({
            where: { tourTypeId: tourType.id, departureDate: { gte: from, lte: to } },
            orderBy: { departureDate: 'asc' }
          });
        }
      }

      // Try 2: date-only search (PDF format "Tour: Uzbekistan Date: 13.03.2026")
      if (!booking) {
        // Use ±1 day for date-only (no tour code) to avoid matching nearby bookings
        const from1 = new Date(departureDate); from1.setDate(from1.getDate() - 1);
        const to1 = new Date(departureDate); to1.setDate(to1.getDate() + 1);
        console.log(`⚠️  PDF: no tour code found — searching by date only (${y}-${m}-${d} ±1 day)`);
        const candidates = await prisma.booking.findMany({
          where: { departureDate: { gte: from1, lte: to1 } },
          orderBy: { departureDate: 'asc' }
        });
        if (candidates.length === 1) {
          booking = candidates[0];
          console.log(`✅ PDF: matched by date → ${booking.bookingNumber}`);
        } else if (candidates.length > 1) {
          console.log(`⚠️  PDF: ${candidates.length} bookings found for date range — ambiguous, skipping`);
          return null;
        }
      }

      if (!booking) {
        console.log(`⚠️  PDF: no booking found around ${y}-${m}-${d}`);
        return null;
      }

      console.log(`🔗 PDF matched booking: ${booking.bookingNumber} (id=${booking.id})`);

      // Call existing import-pdf endpoint internally (FULL REPLACE — same as manual import)
      const FormData = require('form-data');
      const axios = require('axios');
      const form = new FormData();
      form.append('file', fileBuffer, { filename: 'rooming.pdf', contentType: 'application/pdf' });

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      const response = await axios.post(
        `${baseUrl}/api/bookings/${booking.id}/rooming-list/import-pdf`,
        form,
        { headers: { ...form.getHeaders(), 'x-internal-call': 'true' } }
      );

      return { bookingId: booking.id, summary: response.data };
    } catch (err) {
      console.error('❌ importRoomingListPdfForEmail error:', err.message);
      return null;
    }
  }

  /**
   * Map German Reisename to { tourCode, paxField }
   * EMAIL_TABLE priorities:
   *   "Turkmenistan, Usbekistan, Tadschikistan..." → ZA, paxUzbekistan
   *   "Kasachstan, Kirgistan und Usbekistan"       → KAS, paxUzbekistan
   *   "Usbekistan ComfortPlus"                     → CO, paxUzbekistan
   *   "Usbekistan mit Verlängerung Turkmenistan"   → ER, paxTurkmenistan
   *   "Usbekistan"                                 → ER, paxUzbekistan
   */
  mapReisename(reisename) {
    const lower = reisename.toLowerCase();

    const isZA = (lower.includes('turkmenistan') || lower.includes('turkmen')) &&
                 (lower.includes('usbekistan') || lower.includes('uzbekistan')) &&
                 (lower.includes('tadschikistan') || lower.includes('tajikistan')) &&
                 (lower.includes('kasachstan') || lower.includes('kazakhstan')) &&
                 (lower.includes('kirgistan') || lower.includes('kyrgyzstan'));

    const isKAS = !isZA &&
                  (lower.includes('kasachstan') || lower.includes('kazakhstan')) &&
                  (lower.includes('kirgistan') || lower.includes('kyrgyzstan')) &&
                  (lower.includes('usbekistan') || lower.includes('uzbekistan'));

    const isCO = !isZA && !isKAS &&
                 (lower.includes('comfortplus') || lower.includes('comfort plus')) &&
                 (lower.includes('usbekistan') || lower.includes('uzbekistan'));

    const isERTurkmen = !isZA && !isKAS && !isCO &&
                        (lower.includes('usbekistan') || lower.includes('uzbekistan')) &&
                        (lower.includes('turkmenistan') || lower.includes('turkmen'));

    const isER = !isZA && !isKAS && !isCO && !isERTurkmen &&
                 (lower.includes('usbekistan') || lower.includes('uzbekistan'));

    if (isZA) return { tourCode: 'ZA', paxField: 'paxUzbekistan' };
    if (isKAS) return { tourCode: 'KAS', paxField: 'paxUzbekistan' };
    if (isCO) return { tourCode: 'CO', paxField: 'paxUzbekistan' };
    if (isERTurkmen) return { tourCode: 'ER', paxField: 'paxTurkmenistan' };
    if (isER) return { tourCode: 'ER', paxField: 'paxUzbekistan' };

    return null;
  }

  /**
   * Parse HTML email body to extract PAX table rows
   * Expects columns: Reisename | Von | Bis | Gebuchte Pax
   */
  async parseHtmlTableForPax(html) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const rows = [];

    // Find the table that contains "Reisename" and "Pax"
    let targetTable = null;
    $('table').each((i, table) => {
      const text = $(table).text();
      if (text.toLowerCase().includes('reisename') && text.toLowerCase().includes('pax')) {
        targetTable = table;
        return false; // break each()
      }
    });

    if (!targetTable) {
      console.log('⚠️  parseHtmlTableForPax: no table with Reisename+Pax found');
      return [];
    }

    // Get column headers from first row (th or td)
    const headerCells = [];
    $(targetTable).find('tr').first().find('th, td').each((i, el) => {
      headerCells.push($(el).text().trim().toLowerCase());
    });

    const reisIdx = headerCells.findIndex(h => h.includes('reisename') || h === 'reise');
    const vonIdx  = headerCells.findIndex(h => h === 'von' || h.startsWith('von'));
    const bisIdx  = headerCells.findIndex(h => h === 'bis' || h.startsWith('bis'));
    // "Gebuchte Pax" or just "Pax"
    const paxIdx  = headerCells.findIndex(h => h.includes('pax'));

    if (reisIdx === -1 || paxIdx === -1) {
      console.log(`⚠️  parseHtmlTableForPax: required columns not found. Headers: ${headerCells.join(' | ')}`);
      return [];
    }

    console.log(`📋 Table headers: ${headerCells.join(' | ')} (reisIdx=${reisIdx}, vonIdx=${vonIdx}, paxIdx=${paxIdx})`);

    // Parse data rows (skip header row)
    $(targetTable).find('tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cells = $(row).find('td');
      if (cells.length === 0) return;

      const reisename = $(cells[reisIdx]).text().trim();
      const von = vonIdx >= 0 ? $(cells[vonIdx]).text().trim() : null;
      const bis = bisIdx >= 0 ? $(cells[bisIdx]).text().trim() : null;
      const paxText = $(cells[paxIdx]).text().trim();
      const pax = parseInt(paxText, 10);

      if (!reisename || isNaN(pax) || pax <= 0) return;

      rows.push({ reisename, departureDate: von, returnDate: bis, pax });
      console.log(`  → ${reisename} | Von: ${von} | Pax: ${pax}`);
    });

    return rows;
  }

  /**
   * Update booking pax fields from HTML table rows.
   * Priority: EMAIL_TABLE < EXCEL < PDF — never overrides higher-priority source.
   */
  async updateBookingsFromTableRows(rows) {
    const PRIORITY = ['EMAIL_TABLE', 'EXCEL', 'PDF', 'MANUAL'];
    let updated = 0;
    const ids = [];

    for (const row of rows) {
      try {
        const mapped = this.mapReisename(row.reisename);
        if (!mapped) {
          console.log(`⚠️  Could not map tour type from: "${row.reisename}"`);
          continue;
        }

        const { tourCode, paxField } = mapped;
        const tourType = await prisma.tourType.findFirst({ where: { code: tourCode } });
        if (!tourType) {
          console.log(`⚠️  Tour type not found: ${tourCode}`);
          continue;
        }

        // Parse departure date (DD.MM.YYYY)
        const departureDate = this.parseDateString(row.departureDate);
        if (!departureDate) {
          console.log(`⚠️  Could not parse departure date: "${row.departureDate}" for ${row.reisename}`);
          continue;
        }

        const d = departureDate.getUTCDate();
        const m = departureDate.getUTCMonth();
        const y = departureDate.getUTCFullYear();
        const from = new Date(Date.UTC(y, m, d - 2));
        const to   = new Date(Date.UTC(y, m, d + 2, 23, 59, 59));

        const booking = await prisma.booking.findFirst({
          where: { tourTypeId: tourType.id, departureDate: { gte: from, lte: to } }
        });

        if (!booking) {
          console.log(`⚠️  No booking found for ${tourCode} around ${row.departureDate}`);
          continue;
        }

        // Check priority: skip if booking already has a higher-priority pax source
        const currentPriority = PRIORITY.indexOf(booking.paxSource || 'EMAIL_TABLE');
        const newPriority = PRIORITY.indexOf('EMAIL_TABLE');
        if (currentPriority > newPriority) {
          console.log(`⏭️  ${booking.bookingNumber}: skipping (existing source=${booking.paxSource} has higher priority)`);
          continue;
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: { [paxField]: row.pax, paxSource: 'EMAIL_TABLE' }
        });

        console.log(`✅ ${booking.bookingNumber}: ${paxField} = ${row.pax} (EMAIL_TABLE)`);
        updated++;
        ids.push(booking.id);

      } catch (err) {
        console.error(`❌ updateBookingsFromTableRows error for "${row.reisename}":`, err.message);
      }
    }

    return { updated, ids };
  }

  /**
   * Parse "DD.MM.YYYY" date string to Date object
   */
  parseDateString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Send email notification
   */
  async sendNotification(type, data) {
    try {
      const adminEmail = process.env.GMAIL_NOTIFY_EMAIL || 'admin@orient-insight.com';
      const gmailUser = process.env.GMAIL_USER;
      const gmailPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailUser || !gmailPassword) {
        console.log('⚠️  Gmail credentials not configured, skipping notification');
        return;
      }

      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword
        }
      });

      const subject = type === 'SUCCESS'
        ? '✅ Gmail Import Success'
        : '❌ Gmail Import Failed';

      const escapeHtml = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const html = type === 'SUCCESS' ? `
        <h2>Gmail Import Successful</h2>
        <p><strong>From:</strong> ${escapeHtml(data.emailFrom)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(data.emailSubject)}</p>
        <p><strong>Bookings Created:</strong> ${data.bookingsCreated}</p>
        <p><strong>Bookings Updated:</strong> ${data.bookingsUpdated}</p>
        ${data.bookingIds && data.bookingIds.length > 0 ? `<p><strong>Booking IDs:</strong> ${data.bookingIds.join(', ')}</p>` : ''}
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-imports">View Details</a></p>
      ` : `
        <h2>Gmail Import Failed</h2>
        <p><strong>From:</strong> ${escapeHtml(data.emailFrom)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(data.emailSubject)}</p>
        <p><strong>Error:</strong> ${escapeHtml(data.errorMessage)}</p>
        <p><strong>Retry Count:</strong> ${data.retryCount || 0}</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-imports">View Details</a></p>
      `;

      await transporter.sendMail({
        from: gmailUser,
        to: adminEmail,
        subject,
        html
      });

      console.log(`📧 Notification sent to ${adminEmail}`);
    } catch (error) {
      console.error('❌ Failed to send notification:', error.message);
    }
  }
}

module.exports = new EmailImportProcessor();
