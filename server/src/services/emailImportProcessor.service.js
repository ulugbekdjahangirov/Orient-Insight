const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const gmailService = require('./gmail.service');
const claudeVision = require('./claudeVision.service');
const excelParser = require('./excelParser.service');
const fsSync = require('fs');
const _debugLog = (...args) => {
  const line = `[${new Date().toISOString()}] ` + args.join(' ') + '\n';
  process.stdout.write(line);
  try { fsSync.appendFileSync('/tmp/pdf-debug.log', line); } catch(e) {}
};
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

        return { created: 0, updated: result.updated, ids: result.ids };
      }

      // Determine file type and parse accordingly
      const isExcel = this.isExcelFile(emailImport.attachmentName, emailImport.attachmentType);
      const fname = (emailImport.attachmentName || '').toLowerCase();
      const isPdf = !isExcel && fname.endsWith('.pdf');
      const isDocx = !isExcel && !isPdf && (fname.endsWith('.docx') || fname.endsWith('.doc') || (emailImport.attachmentType || '').includes('word'));

      // "Booking Overview" Excel — PAX-only update, no tourist import
      const isBookingOverview = isExcel && (fname.includes('booking overview') || fname.includes('buchungsübersicht'));
      if (isBookingOverview) {
        const rows = this.parseBookingOverviewExcel(fileBuffer);
        if (rows.length === 0) {
          await prisma.emailImport.update({
            where: { id: emailImportId },
            data: { status: 'MANUAL_REVIEW', errorMessage: 'No valid PAX rows found in Booking Overview Excel', processedAt: new Date() }
          });
          return { created: 0, updated: 0, ids: [] };
        }
        const result = await this.updateBookingsFromTableRows(rows, 'BOOKING_OVERVIEW');
        await prisma.emailImport.update({
          where: { id: emailImportId },
          data: { status: 'SUCCESS', bookingsCreated: 0, bookingsUpdated: result.updated, bookingIds: result.ids.join(','), rawParsedData: JSON.stringify(rows, null, 2), processedAt: new Date() }
        });
        const realMessageId = emailImport.gmailMessageId.includes('::') ? emailImport.gmailMessageId.split('::')[0] : emailImport.gmailMessageId;
        await gmailService.markAsProcessed(realMessageId);
        await this.sendNotification('SUCCESS', { emailFrom: emailImport.emailFrom, emailSubject: emailImport.emailSubject, bookingsCreated: 0, bookingsUpdated: result.updated, bookingIds: result.ids });
        return { created: 0, updated: result.updated, ids: result.ids };
      }

      // PDF: only process if filename contains "rooming list" or "final list" — skip Laenderinfo, Erlebnisreise, etc.
      const isRoomingListPdf = isPdf && (fname.includes('rooming list') || fname.includes('final list'));
      if (isPdf && !isRoomingListPdf) {
        await prisma.emailImport.delete({ where: { id: emailImportId } });
        return { created: 0, updated: 0, ids: [] };
      }

      // DOCX: only process if filename contains "rooming list" or "final list"
      const isRoomingListDocx = isDocx && (fname.includes('rooming list') || fname.includes('final list'));
      if (isDocx && !isRoomingListDocx) {
        await prisma.emailImport.delete({ where: { id: emailImportId } });
        return { created: 0, updated: 0, ids: [] };
      }

      // Helper: shared result handling for rooming list (PDF or DOCX)
      const handleRoomingListResult = async (result, fileType) => {
        if (result) {
          await prisma.emailImport.update({
            where: { id: emailImportId },
            data: {
              status: 'SUCCESS',
              bookingsCreated: 0,
              bookingsUpdated: 1,
              bookingIds: String(result.bookingId),
              rawParsedData: JSON.stringify(result.summary),
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
            bookingIds: [result.bookingId]
          });
          return { created: 0, updated: 1, ids: [result.bookingId] };
        }
        await prisma.emailImport.update({
          where: { id: emailImportId },
          data: {
            status: 'MANUAL_REVIEW',
            errorMessage: `${fileType} not recognized as Final Rooming List: ${emailImport.attachmentName}`,
            retryCount: emailImport.retryCount,
            processedAt: new Date()
          }
        });
        return { created: 0, updated: 0, ids: [] };
      };

      // PDF Final Rooming List → import tourists directly
      if (isRoomingListPdf) {
        const pdfResult = await this.importRoomingListPdfForEmail(fileBuffer, emailImport);
        return handleRoomingListResult(pdfResult, 'PDF');
      }

      // DOCX Final Rooming List → import tourists directly (same logic as PDF, uses mammoth)
      if (isRoomingListDocx) {
        const docxResult = await this.importRoomingListDocxForEmail(fileBuffer, emailImport);
        return handleRoomingListResult(docxResult, 'Word');
      }

      // Images/unknown — skip, mark for manual review
      if (!isExcel) {
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
    } else if (isCO) {
      tourTypeCode = 'CO';
    } else if (isKAS) {
      tourTypeCode = 'KAS';
    } else if (isZA) {
      tourTypeCode = 'ZA';
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
    }

    if (!booking) {
      // Gruppa topilmadi - xato berish (yangi gruppa yaratmaymiz!)
      throw new Error(`Gruppa topilmadi: ${tourTypeCode} tour type, sana ${parsedBooking.departureDate}. Iltimos, avval gruppani yarating yoki sanani tekshiring.`);
    }

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


    // SELECTIVE REPLACE: Delete only tourists with matching placement
    if (parsedBooking.tourists && parsedBooking.tourists.length > 0) {
      // Delete existing tourists with same placement OR null/empty accommodation
      // This handles old tourists that were created before accommodation field was implemented
      // For KAS/ZA: also delete 'Uzbekistan' tourists since these tours have no country split
      const deleteOrConditions = [
        { accommodation: placement },
        { accommodation: null },
        { accommodation: '' },
        { accommodation: 'Not assigned' }
      ];
      if (tourTypeCode === 'KAS' || tourTypeCode === 'ZA') {
        deleteOrConditions.push({ accommodation: 'Uzbekistan' });
        deleteOrConditions.push({ accommodation: 'Turkmenistan' });
      }
      const deletedCount = await prisma.tourist.deleteMany({
        where: {
          bookingId: booking.id,
          OR: deleteOrConditions
        }
      });
      if (deletedCount.count > 0) {
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
            remarks: null, // Remarks only from PDF "Additional Information", not from Excel
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
      // PDF has highest priority — don't downgrade paxSource if PDF already imported
      const currentBooking = await prisma.booking.findUnique({ where: { id: booking.id }, select: { paxSource: true } });
      const newPaxSource = currentBooking?.paxSource === 'PDF' ? 'PDF' : 'EXCEL';
      await prisma.booking.update({
        where: { id: booking.id },
        data: { pax: totalTourists, paxUzbekistan: uzbekCount, paxTurkmenistan: turkCount, paxSource: newPaxSource }
      });

    }

    return { bookingId: booking.id, action };
  }

  /**
   * Import tourists from a Final Rooming List PDF (email attachment).
   * Finds matching booking by tour type code + departure date (±3 days).
   * Calls the existing import-pdf endpoint in UPDATE-ONLY mode (no deletions).
   */
  async importRoomingListPdfForEmail(fileBuffer, emailImport = null) {
    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text;

      // Detect tour type — 1) from PDF filename, 2) from PDF text content
      _debugLog('📄 PDF text preview:', text.slice(0, 800).replace(/\n/g, '|'));
      const fname = (emailImport?.attachmentName || '').toLowerCase();

      // Extract departure date — priority: filename > PDF text "Date:/Datum:" > date range start > first date in text
      // Filename is most reliable (e.g. "ComfortPlus 12.04.2026.pdf")
      const fnDateMatch = fname.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      // Handle "Date: 12.04. – 25.04.2026" format (start date has no year, take year from end date)
      const partialDateMatch = text.match(/(?:Date:|Datum:)\s*(\d{2})\.(\d{2})\.\s*[–—\-]\s*\d{2}\.\d{2}\.(\d{4})/i);
      const dateMatch = partialDateMatch
        ? [null, partialDateMatch[1], partialDateMatch[2], partialDateMatch[3]]
        : text.match(/(?:Date:|Datum:)\s*(\d{2})\.(\d{2})\.(\d{4})/i)
          || text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]/)
          || text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!dateMatch && !fnDateMatch) {
        _debugLog('📄 PDF date not found, text preview:', text.slice(0, 200).replace(/\n/g, '|'));
        return null;
      }
      // Prefer filename date if available (more reliable than first-found text date)
      const [, d, m, y] = fnDateMatch || dateMatch;
      const departureDate = new Date(`${y}-${m}-${d}`);
      _debugLog('📄 Departure date:', `${d}.${m}.${y}`, fnDateMatch ? '(from filename)' : '(from text)');

      // Try to extract end date from range pattern "DD.MM.YYYY – DD.MM.YYYY"
      let pdfEndDate = null;
      const dateRangeMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]\s*(\d{2})\.(\d{2})\.(\d{4})/);
      if (dateRangeMatch) {
        const [, , , , d2, m2, y2] = dateRangeMatch;
        pdfEndDate = new Date(`${y2}-${m2}-${d2}`);
      }

      // Find matching booking (±3 days tolerance)
      const from = new Date(departureDate); from.setDate(from.getDate() - 3);
      const to = new Date(departureDate); to.setDate(to.getDate() + 3);

      let booking = null;
      let tourTypeCode;

      // Use same filename rules as Excel import
      const fnIsZA  = (fname.includes('turkmenistan') || fname.includes('turkmen')) &&
                      (fname.includes('usbekistan') || fname.includes('uzbekistan')) &&
                      (fname.includes('tadschikistan') || fname.includes('tajikistan')) &&
                      (fname.includes('kasachstan') || fname.includes('kazakhstan')) &&
                      (fname.includes('kirgistan') || fname.includes('kyrgyzstan'));
      const fnIsKAS = (fname.includes('kasachstan') || fname.includes('kazakhstan')) &&
                      (fname.includes('kirgistan') || fname.includes('kyrgyzstan')) &&
                      (fname.includes('usbekistan') || fname.includes('uzbekistan')) &&
                      !fname.includes('turkmenistan') && !fname.includes('tadschikistan');
      const fnIsCO  = (fname.includes('comfortplus') || fname.includes('comfort')) &&
                      (fname.includes('usbekistan') || fname.includes('uzbekistan'));
      const fnIsER  = (fname.includes('usbekistan') || fname.includes('uzbekistan')) &&
                      !fname.includes('comfortplus') && !fname.includes('comfort') &&
                      !fname.includes('kasachstan') && !fname.includes('kirgistan') &&
                      !fname.includes('tadschikistan');

      if (fnIsZA)       tourTypeCode = 'ZA';
      else if (fnIsKAS) tourTypeCode = 'KAS';
      else if (fnIsCO)  tourTypeCode = 'CO';
      else if (fnIsER)  tourTypeCode = 'ER';

      // Fallback: detect from PDF text content
      if (!tourTypeCode) {
        const tourCodeMatch = text.match(/Tour:\s*([A-Z]{2,3})[\s\-_]/i);
        tourTypeCode = tourCodeMatch?.[1]?.toUpperCase();
      }
      if (!tourTypeCode) {
        const lower = text.toLowerCase();
        const hasUzbek = lower.includes('usbekistan') || lower.includes('uzbekistan');
        const hasTurkmen = lower.includes('turkmenistan') || lower.includes('turkmen');
        const hasKasach = lower.includes('kasachstan') || lower.includes('kazakhstan');
        const hasKirgiz = lower.includes('kirgistan') || lower.includes('kyrgyzstan');
        const hasTadschik = lower.includes('tadschikistan') || lower.includes('tajikistan');
        const hasComfort = lower.includes('comfort plus') || lower.includes('comfortplus') || lower.includes('comfort');

        if (hasComfort && hasUzbek) tourTypeCode = 'CO';
        else if (hasKasach && hasKirgiz) tourTypeCode = 'KAS';
        else if (hasUzbek && hasTurkmen && hasTadschik && hasKasach && hasKirgiz) tourTypeCode = 'ZA';
        else if (lower.includes('erlebnisreisen') || lower.includes('erlebnis')) tourTypeCode = 'ER';
        // "Tour: Usbekistan" or "Tour: Usbekistan mit Verlängerung Turkmenistan" → ER
        else if (hasUzbek && !hasComfort && !hasKasach && !hasKirgiz && !hasTadschik) tourTypeCode = 'ER';
        // "Tour: Turkmenistan" alone with Uzbekistan (ER extension tour) → ER
        else if (hasTurkmen && hasUzbek && !hasTadschik && !hasKasach && !hasKirgiz) tourTypeCode = 'ER';
      }
      _debugLog('📄 Detected tourTypeCode:', tourTypeCode, '| filename:', fname);

      // Try 1: tour type code + date
      if (tourTypeCode) {
        const tourType = await prisma.tourType.findFirst({ where: { code: tourTypeCode } });
        if (tourType) {
          booking = await prisma.booking.findFirst({
            where: { tourTypeId: tourType.id, departureDate: { gte: from, lte: to } },
            orderBy: { departureDate: 'asc' },
            select: { id: true, bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true, notes: true }
          });
        }
      }

      // Try 2: date-only search — ONLY if tour type was NOT detected
      // If tour type was detected but no booking found, do NOT fall back to type-ignorant search
      // (prevents importing a CO PDF into an ER booking with the same departure date)
      if (!booking && !tourTypeCode) {
        const from1 = new Date(departureDate); from1.setDate(from1.getDate() - 1);
        const to1 = new Date(departureDate); to1.setDate(to1.getDate() + 1);
        const candidates = await prisma.booking.findMany({
          where: { departureDate: { gte: from1, lte: to1 } },
          orderBy: { departureDate: 'asc' },
          select: { id: true, bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true, notes: true }
        });
        if (candidates.length === 1) {
          booking = candidates[0];
        } else if (candidates.length > 1) {
          _debugLog(`📄 PDF: ${candidates.length} bookings on ${d}.${m}.${y}, tour type not detected. Candidates: ${candidates.map(b => b.bookingNumber).join(', ')}`);
          return null;
        }
      } else if (!booking && tourTypeCode) {
        _debugLog(`📄 PDF: tourTypeCode=${tourTypeCode} detected but no booking found for date ${d}.${m}.${y}. Not falling back to type-ignorant search.`);
        return null;
      }

      if (!booking) {
        return null;
      }


      // Parse tourists directly from the already-parsed text (no second pdfParse call)
      // This avoids making an internal HTTP request (axios.post) which would cause
      // a second pdfParse + SQLite write lock contention with manual imports
      const { tourists: pdfTouristsRaw, birthdaysMap, uzSectionStart, uzSectionEnd, groupRemark, touristSpecificRemarks, extraNightTourists } = this._parseTouristsFromText(text, tourTypeCode);

      if (pdfTouristsRaw.length === 0) {
        return null;
      }

      // Filter out cancelled (strikethrough/red-colored) tourists detected via pdfjs-dist
      const cancelledFragments = await this._extractCancelledNamesFromPdf(fileBuffer);
      const pdfTourists = cancelledFragments.size > 0
        ? pdfTouristsRaw.filter(t => {
            const fullLower   = (t.fullName || '').toLowerCase().trim();
            const nameLower   = fullLower.replace(/^(mr\.|mrs\.|ms\.)\s*/i, '').trim();
            const lastName    = nameLower.split(',')[0].trim();
            for (const frag of cancelledFragments) {
              if (frag.length < 3) continue;
              const fragNoTitle = frag.replace(/^(mr\.|mrs\.|ms\.)\s*/i, '').trim();
              if (fullLower.includes(frag)) return false;                              // full name match (with title)
              if (nameLower.includes(frag)) return false;                              // name match (no title)
              if (lastName.length >= 3 && frag.includes(lastName)) return false;      // fragment contains last name
              if (fragNoTitle.length >= 3 && nameLower.includes(fragNoTitle)) return false; // name contains fragment (no title)
            }
            return true;
          })
        : pdfTouristsRaw;
      if (cancelledFragments.size > 0) {
        _debugLog(`📄 Cancelled fragments detected: [${[...cancelledFragments].join(', ')}] → filtered ${pdfTouristsRaw.length - pdfTourists.length} tourist(s)`);
      }

      // UZ date range: prefer PDF section dates; fall back to booking dates
      const uzStart = uzSectionStart || (booking.departureDate ? new Date(booking.departureDate) : null);
      const uzEnd   = uzSectionEnd   || (booking.endDate ? new Date(booking.endDate) : (booking.arrivalDate ? new Date(booking.arrivalDate) : null));

      // Helper: write birthday remark only if birthday falls within Uzbekistan portion of the tour
      const getBirthdayRemark = (pdfT) => {
        if (!birthdaysMap.size) return null;
        const normN = (n) => n.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '').replace(/\s+/g, ' ').trim();
        const tNorm = normN(pdfT.fullName || '');
        const tLast  = tNorm.split(',')[0].trim();
        const tFirst = tNorm.includes(',') ? tNorm.split(',').slice(1).join(',').trim() : '';
        for (const [bName, bDate] of birthdaysMap.entries()) {
          const bNorm = normN(bName);
          let bLast, bFirst;
          if (bNorm.includes(',')) {
            bLast  = bNorm.split(',')[0].trim();
            bFirst = bNorm.split(',').slice(1).join(',').trim();
          } else {
            const words = bNorm.split(' ').filter(Boolean);
            bLast  = words.pop() || '';
            bFirst = words.join(' ');
          }
          if (!bLast || !tLast || bLast !== tLast || tLast.length < 2) continue;
          // Verify first name — tourist first names must start with birthday entry first name
          if (bFirst && tFirst) {
            if (!tFirst.startsWith(bFirst) && !bFirst.startsWith(tFirst)) {
              const minLen = Math.min(5, Math.min(bFirst.length, tFirst.length));
              if (bFirst.substring(0, minLen) !== tFirst.substring(0, minLen)) continue;
            }
          }
          const parts = bDate.split('.');
          if (parts.length < 2) continue;
          // Only show if birthday falls within Uzbekistan portion (uzStart–uzEnd)
          if (uzStart && uzEnd) {
            const bDay = parseInt(parts[0], 10);
            const bMonth = parseInt(parts[1], 10);
            const bdInTour = new Date(uzStart.getFullYear(), bMonth - 1, bDay);
            if (bdInTour < uzStart || bdInTour > uzEnd) continue;
          }
          return `Birthday: ${parts[0]}.${parts[1]}`; // DD.MM only
        }
        return null;
      };

      // Get existing tourists for this booking
      const existingTourists = await prisma.tourist.findMany({
        where: { bookingId: booking.id }
      });

      // Resolve tourist dates from PDF range or booking dates
      // tourStartDate = departure date (day tourists fly from Germany)
      // checkInDate   = departure + daysOffset (actual arrival in UZ/KAS/ZA)
      const touristTourStart = booking.departureDate ? new Date(booking.departureDate) : null;
      const touristCheckIn = booking.departureDate ? (() => {
        const d = new Date(booking.departureDate);
        const offset = tourTypeCode === 'KAS' ? 14 : tourTypeCode === 'ZA' ? 4 : 1;
        d.setDate(d.getDate() + offset);
        return d;
      })() : null;
      const touristCheckOut = pdfEndDate || (booking.arrivalDate ? new Date(booking.arrivalDate) : null)
                              || (booking.endDate ? new Date(booking.endDate) : null);

      const matchedIds = new Set();
      const toUpdate = [];
      const toCreate = [];

      const normalizeName = (n) => (n || '')
        .toLowerCase()
        .replace(/^(mr\.|mrs\.|ms\.)\s*/i, '')
        .replace(/\b(dr\.|prof\.|dipl\.|ing\.)\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Helper: find tourist-specific remark by full name match (last + first name)
      const makeNameLookup = (map) => (fullName) => {
        if (!map.size) return null;
        const normN = (n) => n.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '').replace(/\b(dr\.|prof\.|dipl\.|ing\.)\s*/gi, '').replace(/\s+/g, ' ').trim();
        const tNorm = normN(fullName);
        const tLast  = tNorm.split(',')[0].trim();
        const tFirst = tNorm.includes(',') ? tNorm.split(',').slice(1).join(',').trim() : '';
        for (const [keyName, val] of map.entries()) {
          const kNorm = normN(keyName);
          let kLast, kFirst;
          if (kNorm.includes(',')) { kLast = kNorm.split(',')[0].trim(); kFirst = kNorm.split(',').slice(1).join(',').trim(); }
          else { const w = kNorm.split(' ').filter(Boolean); kLast = w.pop() || ''; kFirst = w.join(' '); }
          if (!kLast || !tLast || kLast !== tLast || tLast.length < 2) continue;
          if (kFirst && tFirst) {
            if (!tFirst.startsWith(kFirst) && !kFirst.startsWith(tFirst)) {
              const ml = Math.min(5, kFirst.length, tFirst.length);
              if (kFirst.substring(0, ml) !== tFirst.substring(0, ml)) continue;
            }
          }
          return val;
        }
        return null;
      };
      const getSpecificRemark = makeNameLookup(touristSpecificRemarks);
      const getExtraNightInfo = makeNameLookup(extraNightTourists);

      // Helper: merge a new remark line into existing remarks (no duplicates)
      const mergeRemark = (existing, line) => {
        if (!line) return existing;
        const lines = (!existing || existing === '-') ? [] : existing.split('\n').filter(Boolean);
        if (!lines.some(l => l === line)) lines.push(line);
        return lines.join('\n');
      };

      for (const pdfT of pdfTourists) {
        const birthdayRemark = getBirthdayRemark(pdfT);
        const specificRemark = getSpecificRemark(pdfT.fullName);
        const extraNight = getExtraNightInfo(pdfT.fullName);
        const extraNightRemark = extraNight ? `Extra night TAS: arrival ${extraNight.display}` : null;

        // Extra night tourists arrive one day before the main group
        let effectiveCheckIn = touristCheckIn;  // default: departure + offset (actual arrival)
        let effectiveTourStart = touristTourStart; // default: departure date
        if (extraNight) {
          const year = extraNight.year || (booking.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear());
          effectiveCheckIn = new Date(year, extraNight.month - 1, extraNight.day); // arrival = extra night date
          effectiveTourStart = new Date(effectiveCheckIn.getTime() - 86400000);    // tourStart = arrival - 1 day
        } else {
          // Check remarks for "Arrival: DD.MM" pattern (tourist arriving much earlier than group)
          // Sources: specificRemark from PDF, or existing tourist's remarks in DB
          const existingForArrival = existingTourists.find(t => normalizeName(t.fullName) === normalizeName(pdfT.fullName));
          const remarkText = [specificRemark, existingForArrival?.remarks].filter(Boolean).join('\n');
          const arrivalMatch = remarkText.match(/Arrival[:\s]*(\d{2})\.(\d{2})/i);
          if (arrivalMatch) {
            const year = booking.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear();
            effectiveCheckIn = new Date(Date.UTC(year, parseInt(arrivalMatch[2]) - 1, parseInt(arrivalMatch[1])));
            effectiveTourStart = new Date(effectiveCheckIn.getTime() - 86400000);
          }
        }

        const pdfName = normalizeName(pdfT.fullName);
        // Step 1: exact normalized match
        let existing = existingTourists.find(t => normalizeName(t.fullName) === pdfName);
        // Step 2: fuzzy match — handles format mismatch between Excel ("First Last") and PDF ("Last, First")
        // Ensures passport/dateOfBirth from Excel is preserved when PDF is imported after Excel
        if (!existing) {
          const _n = (n) => n.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '').replace(/\s+/g, ' ').trim();
          const _parts = (norm) => {
            if (norm.includes(',')) return { last: norm.split(',')[0].trim(), first: norm.split(',').slice(1).join(',').trim() };
            const w = norm.split(' ').filter(Boolean); return { last: w.pop() || '', first: w.join(' ') };
          };
          const { last: pLast, first: pFirst } = _parts(_n(pdfT.fullName || ''));
          existing = existingTourists.find(t => {
            const { last: tLast, first: tFirst } = _parts(_n(t.fullName || ''));
            if (!pLast || !tLast || pLast !== tLast || tLast.length < 2) return false;
            if (pFirst && tFirst) {
              if (!tFirst.startsWith(pFirst) && !pFirst.startsWith(tFirst)) {
                const ml = Math.min(5, pFirst.length, tFirst.length);
                if (pFirst.substring(0, ml) !== tFirst.substring(0, ml)) return false;
              }
            }
            return true;
          });
        }

        if (existing) {
          matchedIds.add(existing.id);
          // Rebuild remarks from scratch on each import to avoid stale lines accumulating
          const isAutoLine = (l) =>
            /^(vegetarian|vegan|glutenfree)$/i.test(l) ||
            l.startsWith('Birthday:') ||
            l.startsWith('Allergie:') ||
            l.startsWith('Extra night TAS:') ||
            /Indiv\. arrival|Late arrival|Early arrival|Dom\. flight|Last night (in|cancelled)|Use group transfer|Organize transfer himself|Early return flight|Indiv\. departure|Late checkout|Early check-in|Room near /i.test(l) ||
            /earlier.+return flight|later.+return flight|return flight|organiz\w* transfer|transfer him\w*/i.test(l) ||
            /^\*?\s*PAX booked half double|no roommate found/i.test(l) ||
            l.endsWith('...') || l.includes('→') || l.includes('->');
          const existLines = (existing.remarks && existing.remarks !== '-')
            ? existing.remarks.split('\n').filter(Boolean)
            : [];
          const manualLines = existLines.filter(l => !isAutoLine(l));
          const newRemarkLines = [];
          if (pdfT.isVegetarian) newRemarkLines.push(pdfT.dietLabel || 'Vegetarian');
          if (pdfT.isGlutenfree) newRemarkLines.push('Glutenfree');
          if (pdfT.allergyLabel) newRemarkLines.push(pdfT.allergyLabel);
          if (birthdayRemark) newRemarkLines.push(birthdayRemark);
          if (specificRemark) newRemarkLines.push(specificRemark);
          if (extraNightRemark) newRemarkLines.push(extraNightRemark);
          for (const ml of manualLines) {
            if (!newRemarkLines.includes(ml)) newRemarkLines.push(ml);
          }
          // Always rebuild: if manualLines exist but no auto-fields, keep only manual; otherwise use new auto lines
          const updatedRemarks = newRemarkLines.length > 0 ? newRemarkLines.join('\n') : (manualLines.length > 0 ? manualLines.join('\n') : null);
          toUpdate.push({
            id: existing.id,
            data: {
              roomPreference: pdfT.roomPreference,
              accommodation: pdfT.accommodation,
              roomNumber: pdfT.roomNumber || null,
              tourStartDate: effectiveTourStart || null,
              checkInDate: effectiveCheckIn || null,
              checkOutDate: touristCheckOut || null,
              remarks: updatedRemarks
            }
          });
        } else {
          const newRemarks = [];
          if (pdfT.isVegetarian) newRemarks.push(pdfT.dietLabel || 'Vegetarian');
          if (pdfT.isGlutenfree) newRemarks.push('Glutenfree');
          if (pdfT.allergyLabel) newRemarks.push(pdfT.allergyLabel);
          if (birthdayRemark) newRemarks.push(birthdayRemark);
          if (specificRemark) newRemarks.push(specificRemark);
          if (extraNightRemark) newRemarks.push(extraNightRemark);
          toCreate.push({
            bookingId: booking.id,
            fullName: pdfT.fullName || '',
            firstName: '',
            lastName: '',
            gender: 'unknown',
            roomPreference: pdfT.roomPreference,
            accommodation: pdfT.accommodation,
            roomNumber: pdfT.roomNumber || null,
            ...(effectiveTourStart && { tourStartDate: effectiveTourStart }),
            ...(effectiveCheckIn && { checkInDate: effectiveCheckIn }),
            ...(touristCheckOut && { checkOutDate: touristCheckOut }),
            ...(newRemarks.length > 0 && { remarks: newRemarks.join('\n') })
          });
        }
      }

      const toDeleteIds = existingTourists
        .filter(t => !matchedIds.has(t.id))
        .map(t => t.id);

      // Execute all DB operations in a single transaction (one SQLite write lock)
      await prisma.$transaction(async (tx) => {
        for (const { id, data } of toUpdate) {
          await tx.tourist.update({ where: { id }, data });
        }
        for (const data of toCreate) {
          await tx.tourist.create({ data });
        }
        if (toDeleteIds.length > 0) {
          await tx.accommodationRoomingList.deleteMany({ where: { touristId: { in: toDeleteIds } } });
          await tx.touristRoomAssignment.deleteMany({ where: { touristId: { in: toDeleteIds } } });
          await tx.tourist.deleteMany({ where: { id: { in: toDeleteIds } } });
        }
      });

      // Clear system notes that may have been stored as tourist remarks
      await prisma.tourist.updateMany({
        where: { bookingId: booking.id, OR: [{ remarks: { contains: 'PAX booked half double' } }, { remarks: { contains: 'no roommate found' } }] },
        data: { remarks: null }
      });

      const bookingUpdateData = { paxSource: 'PDF', emailImportedAt: new Date(), status: 'FINAL_CONFIRMED' };
      {
        // Strip any previously imported blocks (old "📋" format or current "✈️" format)
        // Preserve only manually written notes (sections not starting with import labels)
        const strippedNotes = (booking.notes || '').split('\n\n')
          .filter(s => {
            const t = s.trim();
            if (t.startsWith('📋 Rooming List Remark:')) return false;
            if (t.startsWith('✈️ Transfers:')) return false;
            // Remove orphaned Arrival:/Departure: sub-sections left from previous imports
            if (/^(Arrival|Departure):\n\s+•/.test(t)) return false;
            return true;
          })
          .join('\n\n').trim();
        if (groupRemark) {
          const transferSection = `✈️ Transfers:\n${groupRemark}`;
          bookingUpdateData.notes = strippedNotes ? `${transferSection}\n\n${strippedNotes}` : transferSection;
        } else if (strippedNotes !== (booking.notes || '').trim()) {
          bookingUpdateData.notes = strippedNotes || null;
        }
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: bookingUpdateData
      });

      const summary = { updated: toUpdate.length, created: toCreate.length, deleted: toDeleteIds.length };

      // Auto-import flights: text (GDS/ISO) first, Vision for image-based flights (intl + domestic)
      try {
        const { flights: flightData, totalPax: pdfTotalPax, knownPnrCodes } = _self._parseFlightsFromText(_text);

        const textDetected  = flightData.filter(f => f.flightNumber);
        const textSuggested = flightData.filter(f => !f.flightNumber);

        const uzbekAirportSet = new Set(['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG', 'URG']);

        // Vision trigger: domestic missing OR international PAX incomplete
        const hasDomesticText = textDetected.some(f => f.type === 'DOMESTIC');
        const inboundPax  = textDetected.filter(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.arrival)   && f.pax > 0).reduce((s, f) => s + f.pax, 0);
        const outboundPax = textDetected.filter(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.departure) && f.pax > 0).reduce((s, f) => s + f.pax, 0);
        const detectedIntlPax = Math.max(inboundPax, outboundPax);
        const needsVision = false; // Vision AI disabled — requires explicit permission

        let visionFlights = [];

        // Combine: text-detected + Vision image-only flights.
        // Vision was instructed to skip known PNR codes (text blocks), so its PAX counts
        // represent image-only passengers — add them directly.
        //
        // Outbound rule:
        //   - If text already has outbound flights → only UPDATE existing ones (hallucination risk for new routes)
        //   - If text has NO outbound flights at all → allow Vision to CREATE new outbound flights
        //     (e.g. ER-01 where all outbound PNRs are image-only)
        const textHasOutbound = textDetected.some(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.departure) && !uzbekAirportSet.has(f.arrival));
        const combined = [...textDetected];
        for (const vf of visionFlights) {
          const paxToAdd = vf.pax || 0;
          if (paxToAdd <= 0) continue;
          const isOutbound = vf.type === 'INTERNATIONAL' && uzbekAirportSet.has(vf.departure) && !uzbekAirportSet.has(vf.arrival);
          const vfMin = vf.departureTime ? (() => { const m = vf.departureTime.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; })() : null;
          const existing = combined.find(f => {
            if (f.flightNumber !== vf.flightNumber || f.departure !== vf.departure || f.arrival !== vf.arrival) return false;
            if ((f.date || '') !== (vf.date || '')) return false;
            const fMin = f.departureTime ? (() => { const m = f.departureTime.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; })() : null;
            if (vfMin === null || fMin === null) return true;
            return Math.abs(fMin - vfMin) <= 20;
          });
          const parseDetails = (d) => !d ? [] : Array.isArray(d) ? d : (() => { try { return JSON.parse(d); } catch { return []; } })();
          const nKey = n => n.toUpperCase().replace(/\b(MRS?|MS|DR|PROF)\.?\b/g,'').replace(/\//g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean).sort().join(' ');
          const mergeNamesLocal = (a, b) => { const r=[...a]; for(const n of b){if(!r.some(x=>nKey(x)===nKey(n)))r.push(n);} return r; };
          if (existing) {
            // Merge paxDetails: combine existing + vision details, dedup by word-set key
            const merged = mergeNamesLocal(parseDetails(existing.paxDetails), parseDetails(vf.paxDetails));
            existing.paxDetails = merged.length > 0 ? JSON.stringify(merged) : null;
            existing.pax = merged.length > 0 ? merged.length : (existing.pax || 0) + paxToAdd;
          } else if (!isOutbound || !textHasOutbound) {
            // Add: inbound/domestic always; outbound only if text had no outbound at all
            const vd = parseDetails(vf.paxDetails);
            combined.push({ ...vf, paxDetails: vd.length > 0 ? JSON.stringify(vd) : null });
          }
        }

        // Keep blank suggestions only if Vision did NOT run (Vision handles image PNRs).
        // When Vision ran, trust it — blank placeholders with wrong PAX are misleading.
        if (!needsVision) {
          for (const s of textSuggested) {
            if (s.type === 'INTERNATIONAL') {
              const sArrIsUzbek = uzbekAirportSet.has(s.arrival);
              const covered = combined.some(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.arrival) === sArrIsUzbek);
              if (!covered) combined.push(s);
            } else if (s.type === 'DOMESTIC') {
              if (!combined.some(f => f.type === 'DOMESTIC')) combined.push(s);
            }
          }
        }

        if (combined.length > 0) {
          const existingIntl = await prisma.flight.count({ where: { bookingId: _bookingId, type: 'INTERNATIONAL' } });
          const existingDom  = await prisma.flight.count({ where: { bookingId: _bookingId, type: 'DOMESTIC' } });

          const toSave = combined.filter(f => {
            if (f.type === 'INTERNATIONAL') return existingIntl === 0;
            if (f.type === 'DOMESTIC')      return existingDom === 0;
            return false;
          });

          if (toSave.length > 0) {
            await prisma.flight.createMany({
              data: toSave.map((f, i) => ({
                bookingId: _bookingId,
                type: f.type || 'INTERNATIONAL',
                flightNumber: f.flightNumber || null,
                departure: f.departure,
                arrival: f.arrival,
                date: f.date ? new Date(f.date) : null,
                departureTime: f.departureTime || null,
                arrivalTime: f.arrivalTime || null,
                pax: f.pax || 0,
                price: 0,
                sortOrder: i
              }))
            });
            _debugLog(`✈️ ${toSave.length} flights auto-saved (bg) for booking ${_bookingId}`);
          }
        }
      } catch (flightErr) {
        _debugLog(`⚠️ Flight auto-import error: ${flightErr.message}`);
        // Non-fatal: tourist import still succeeded
      }

      return { bookingId: booking.id, summary };

    } catch (err) {
      console.error('❌ importRoomingListPdfForEmail error:', err.message);
      return null;
    }
  }

  /**
   * Detect cancelled tourist names in a PDF using pdfjs-dist.
   * Method 1: red-colored text (r>0.5, g<0.3, b<0.3)
   * Method 2: horizontal strikethrough line drawn over text (any color, incl. black)
   * Returns a Set of lowercase name fragments for cancelled tourists.
   */
  async _extractCancelledNamesFromPdf(pdfBuffer) {
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      _debugLog(`🔍 _extractCancelledNames: loading PDF (${pdfBuffer.length} bytes)`);
      const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
      _debugLog(`🔍 _extractCancelledNames: ${doc.numPages} page(s)`);

      const cancelledFragments = new Set();
      const OPS = pdfjsLib.OPS;
      _debugLog(`🔍 OPS.setFillRGBColor=${OPS.setFillRGBColor} setFillGray=${OPS.setFillGray} showText=${OPS.showText}`);

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const [textContent, opList] = await Promise.all([
          page.getTextContent(),
          page.getOperatorList(),
        ]);

        const items = textContent.items.filter(item => 'str' in item);
        _debugLog(`🔍 p${pageNum}: ${items.length} text items, ${opList.fnArray.length} ops`);

        const isRedColor = (r, g, b) =>
          r > 1 ? (r > 127 && g < 77 && b < 77) : (r > 0.5 && g < 0.3 && b < 0.3);

        // ── Method 1: Position-based color detection ──────────────────────
        // Track text matrix Y position to reliably match ops→items
        // (index-based alignment fails when some ops produce empty/whitespace items)
        let fillR = 0, fillG = 0, fillB = 0;
        let tmY = 0;
        const textOpsWithY = []; // { r, g, b, y }

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i];
          if (fn === OPS.setFillRGBColor) {
            fillR = args[0]; fillG = args[1]; fillB = args[2];
            if (isRedColor(fillR, fillG, fillB)) {
              _debugLog(`🔍 setFillRGBColor RED: r=${fillR.toFixed(2)} g=${fillG.toFixed(2)} b=${fillB.toFixed(2)}`);
            }
          } else if (fn === OPS.setFillGray) {
            fillR = fillG = fillB = args[0];
          } else if (fn === OPS.setTextMatrix) {
            tmY = args[5]; // f component = y position
          } else if (fn === OPS.moveText || fn === OPS.setLeadingMoveText) {
            tmY += args[1]; // ty component
          } else if (
            fn === OPS.showText || fn === OPS.showSpacedText ||
            fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText
          ) {
            textOpsWithY.push({ r: fillR, g: fillG, b: fillB, y: tmY });
          }
        }
        _debugLog(`🔍 p${pageNum}: ${textOpsWithY.length} text ops with positions`);

        // Build a map: Y position → is red (any text op at this Y is red)
        const redYSet = new Set();
        for (const op of textOpsWithY) {
          if (isRedColor(op.r, op.g, op.b)) {
            redYSet.add(Math.round(op.y * 10)); // round to 0.1 unit precision
          }
        }

        // For each text item, check if its Y matches a red text op Y
        for (const item of items) {
          const iy = item.transform[5];
          const iyKey = Math.round(iy * 10);
          // Check exact match or ±1 unit tolerance
          const isRed = redYSet.has(iyKey) || redYSet.has(iyKey + 10) || redYSet.has(iyKey - 10);
          if (isRed) {
            const str = (item.str || '').trim();
            if (str.length >= 3) {
              cancelledFragments.add(str.toLowerCase());
              _debugLog(`📄 Red text by Y-pos (p${pageNum} y=${iy.toFixed(1)}): "${str}"`);
            }
          }
        }

        // ── Method 2: Horizontal strikethrough line over text ─────────────
        // Collect horizontal line segments from path drawing ops
        const hLines = []; // { x1, x2, y }
        let pathMoveX = 0, pathMoveY = 0;
        let lastMoveX = 0, lastMoveY = 0;

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i];

          if (fn === OPS.moveTo) {
            lastMoveX = args[0]; lastMoveY = args[1];
          } else if (fn === OPS.lineTo) {
            const x2 = args[0], y2 = args[1];
            // Horizontal line: y difference < 1 pt
            if (Math.abs(y2 - lastMoveY) < 1.0) {
              hLines.push({
                x1: Math.min(lastMoveX, x2),
                x2: Math.max(lastMoveX, x2),
                y: (lastMoveY + y2) / 2,
              });
            }
            lastMoveX = x2; lastMoveY = y2;
          } else if (fn === OPS.constructPath) {
            // constructPath: args[0]=cmd array, args[1]=coord array
            const cmds = args[0];
            const coords = args[1];
            let ci = 0, mx = 0, my = 0;
            for (let c = 0; c < cmds.length; c++) {
              const cmd = cmds[c];
              if (cmd === OPS.moveTo) {
                mx = coords[ci++]; my = coords[ci++];
              } else if (cmd === OPS.lineTo) {
                const lx = coords[ci++], ly = coords[ci++];
                if (Math.abs(ly - my) < 1.0) {
                  hLines.push({ x1: Math.min(mx, lx), x2: Math.max(mx, lx), y: (my + ly) / 2 });
                }
                mx = lx; my = ly;
              } else if (cmd === OPS.curveTo) {
                ci += 6;
              } else if (cmd === OPS.rectangle) {
                ci += 4;
              }
            }
          }
        }

        // For each text item, check if any horizontal line passes through its middle
        for (const item of items) {
          const str = (item.str || '').trim();
          if (str.length < 3) continue;

          // item.transform: [a,b,c,d,tx,ty] — tx,ty = baseline position
          const tx = item.transform[4];
          const ty = item.transform[5];
          const w  = item.width;
          const h  = item.height || 10;

          // Strikethrough is roughly at 30–65% of ascent above baseline
          const yMin = ty + h * 0.25;
          const yMax = ty + h * 0.70;

          for (const line of hLines) {
            if (
              line.y >= yMin && line.y <= yMax &&         // passes through text vertically
              line.x1 <= tx + w * 0.6 &&                  // line starts before middle of text
              line.x2 >= tx + w * 0.4 &&                  // line ends after start of text
              (line.x2 - line.x1) >= w * 0.3              // line covers at least 30% of text width
            ) {
              cancelledFragments.add(str.toLowerCase());
              _debugLog(`📄 Strikethrough detected (p${pageNum}): "${str}" line y=${line.y.toFixed(1)} textY=${ty.toFixed(1)}-${(ty+h).toFixed(1)}`);
              break;
            }
          }
        }
      }

      _debugLog(`🔍 _extractCancelledNames done: ${cancelledFragments.size} cancelled fragment(s): [${[...cancelledFragments].join(', ')}]`);
      return cancelledFragments;
    } catch (err) {
      _debugLog('⚠️ _extractCancelledNamesFromPdf error:', err.message, err.stack?.split('\n')[1] || '');
      return new Set();
    }
  }

  /**
   * Import rooming list from Word (.docx) file — same logic as PDF but uses mammoth for text+images.
   */
  async importRoomingListDocxForEmail(fileBuffer, emailImport = null, bookingIdOverride = null) {
    try {
      const mammoth = require('mammoth');

      // Extract text from docx
      const textResult = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = textResult.value;

      _debugLog('📝 DOCX text preview:', text.slice(0, 800).replace(/\n/g, '|'));

      // Extract departure date (same patterns as PDF)
      const dateMatch = text.match(/(?:Date:|Datum:)\s*(\d{2})\.(\d{2})\.(\d{4})/i)
        || text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]/)
        || text.match(/(\d{2})\.(\d{2})\.(\d{4})/);

      let pdfEndDate = null;
      const dateRangeMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]\s*(\d{2})\.(\d{2})\.(\d{4})/);
      if (dateRangeMatch) {
        const [, , , , d2, m2, y2] = dateRangeMatch;
        pdfEndDate = new Date(`${y2}-${m2}-${d2}`);
      }

      let booking = null;
      let tourTypeCode;
      const fname = (emailImport?.attachmentName || '').toLowerCase();

      // Detect tour type from filename (works for both manual and email import)
      const fnIsZA2  = (fname.includes('turkmenistan') || fname.includes('turkmen')) &&
                       (fname.includes('usbekistan') || fname.includes('uzbekistan')) &&
                       (fname.includes('tadschikistan') || fname.includes('tajikistan')) &&
                       (fname.includes('kasachstan') || fname.includes('kazakhstan')) &&
                       (fname.includes('kirgistan') || fname.includes('kyrgyzstan'));
      const fnIsKAS2 = (fname.includes('kasachstan') || fname.includes('kazakhstan')) &&
                       (fname.includes('kirgistan') || fname.includes('kyrgyzstan')) &&
                       (fname.includes('usbekistan') || fname.includes('uzbekistan')) &&
                       !fname.includes('turkmenistan') && !fname.includes('tadschikistan');
      const fnIsCO2  = (fname.includes('comfortplus') || fname.includes('comfort')) &&
                       (fname.includes('usbekistan') || fname.includes('uzbekistan'));
      const fnIsER2  = (fname.includes('usbekistan') || fname.includes('uzbekistan')) &&
                       !fname.includes('comfortplus') && !fname.includes('comfort') &&
                       !fname.includes('kasachstan') && !fname.includes('kirgistan') &&
                       !fname.includes('tadschikistan');

      if (fnIsZA2)       tourTypeCode = 'ZA';
      else if (fnIsKAS2) tourTypeCode = 'KAS';
      else if (fnIsCO2)  tourTypeCode = 'CO';
      else if (fnIsER2)  tourTypeCode = 'ER';

      // Fallback: detect from text content
      if (!tourTypeCode) {
        const lower = text.toLowerCase();
        const hasUzbek    = lower.includes('usbekistan') || lower.includes('uzbekistan');
        const hasTurkmen  = lower.includes('turkmenistan') || lower.includes('turkmen');
        const hasKasach   = lower.includes('kasachstan') || lower.includes('kazakhstan');
        const hasKirgiz   = lower.includes('kirgistan') || lower.includes('kyrgyzstan');
        const hasTadschik = lower.includes('tadschikistan') || lower.includes('tajikistan');
        const hasComfort  = lower.includes('comfort plus') || lower.includes('comfortplus') || lower.includes('comfort');
        if (hasComfort && hasUzbek) tourTypeCode = 'CO';
        else if (hasKasach && hasKirgiz) tourTypeCode = 'KAS';
        else if (hasUzbek && hasTurkmen && hasTadschik && hasKasach && hasKirgiz) tourTypeCode = 'ZA';
        else if (lower.includes('erlebnisreisen') || lower.includes('erlebnis')) tourTypeCode = 'ER';
        else if (hasUzbek && !hasComfort && !hasKasach && !hasKirgiz && !hasTadschik) tourTypeCode = 'ER';
        else if (hasTurkmen && hasUzbek && !hasTadschik && !hasKasach && !hasKirgiz) tourTypeCode = 'ER';
      }
      _debugLog('📝 DOCX tourTypeCode:', tourTypeCode, '| filename:', fname);

      // If bookingId is provided directly (manual import), use it
      if (bookingIdOverride) {
        booking = await prisma.booking.findUnique({
          where: { id: bookingIdOverride },
          select: { id: true, bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true, notes: true }
        });
        if (!booking) return null;
      } else {
        // Email import: find booking by date
        if (!dateMatch) {
          _debugLog('📝 DOCX date not found');
          return null;
        }
        const [, d, m, y] = dateMatch;
        const departureDate = new Date(`${y}-${m}-${d}`);
        const from = new Date(departureDate); from.setDate(from.getDate() - 3);
        const to   = new Date(departureDate); to.setDate(to.getDate() + 3);

        if (tourTypeCode) {
          const tourType = await prisma.tourType.findFirst({ where: { code: tourTypeCode } });
          if (tourType) {
            booking = await prisma.booking.findFirst({
              where: { tourTypeId: tourType.id, departureDate: { gte: from, lte: to } },
              orderBy: { departureDate: 'asc' },
              select: { id: true, bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true, notes: true }
            });
          }
        }

        if (!booking) {
          const from1 = new Date(departureDate); from1.setDate(from1.getDate() - 1);
          const to1   = new Date(departureDate); to1.setDate(to1.getDate() + 1);
          const candidates = await prisma.booking.findMany({
            where: { departureDate: { gte: from1, lte: to1 } },
            orderBy: { departureDate: 'asc' },
            select: { id: true, bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true, notes: true }
          });
          if (candidates.length === 1) booking = candidates[0];
          else if (candidates.length > 1) {
            _debugLog(`📝 DOCX: ${candidates.length} bookings on ${d}.${m}.${y}, tour type not detected`);
            return null;
          }
        }
      }

      if (!booking) return null;

      // Parse tourists using the same function as PDF
      const { tourists: docxTourists, birthdaysMap, uzSectionStart, uzSectionEnd, groupRemark, touristSpecificRemarks, extraNightTourists } = this._parseTouristsFromText(text, tourTypeCode);
      if (docxTourists.length === 0) return null;

      const uzStart = uzSectionStart || (booking.departureDate ? new Date(booking.departureDate) : null);
      const uzEnd   = uzSectionEnd   || (booking.endDate ? new Date(booking.endDate) : (booking.arrivalDate ? new Date(booking.arrivalDate) : null));

      const getBirthdayRemark = (pdfT) => {
        if (!birthdaysMap.size) return null;
        const normN = (n) => n.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '').replace(/\s+/g, ' ').trim();
        const tNorm = normN(pdfT.fullName || '');
        const tLast  = tNorm.split(',')[0].trim();
        const tFirst = tNorm.includes(',') ? tNorm.split(',').slice(1).join(',').trim() : '';
        for (const [bName, bDate] of birthdaysMap.entries()) {
          const bNorm = normN(bName);
          let bLast, bFirst;
          if (bNorm.includes(',')) { bLast = bNorm.split(',')[0].trim(); bFirst = bNorm.split(',').slice(1).join(',').trim(); }
          else { const w = bNorm.split(' ').filter(Boolean); bLast = w.pop() || ''; bFirst = w.join(' '); }
          if (!bLast || !tLast || bLast !== tLast || tLast.length < 2) continue;
          if (bFirst && tFirst) {
            if (!tFirst.startsWith(bFirst) && !bFirst.startsWith(tFirst)) {
              const minLen = Math.min(5, Math.min(bFirst.length, tFirst.length));
              if (bFirst.substring(0, minLen) !== tFirst.substring(0, minLen)) continue;
            }
          }
          const parts = bDate.split('.');
          if (parts.length < 2) continue;
          if (uzStart && uzEnd) {
            const bdInTour = new Date(uzStart.getFullYear(), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            if (bdInTour < uzStart || bdInTour > uzEnd) continue;
          }
          return `Birthday: ${parts[0]}.${parts[1]}`;
        }
        return null;
      };

      const existingTourists = await prisma.tourist.findMany({ where: { bookingId: booking.id } });
      const touristTourStart = booking.departureDate ? new Date(booking.departureDate) : null;
      const touristCheckIn  = booking.departureDate ? (() => {
        const d = new Date(booking.departureDate);
        const offset = tourTypeCode === 'KAS' ? 14 : tourTypeCode === 'ZA' ? 4 : 1;
        d.setDate(d.getDate() + offset);
        return d;
      })() : null;
      const touristCheckOut = pdfEndDate || (booking.arrivalDate ? new Date(booking.arrivalDate) : null) || (booking.endDate ? new Date(booking.endDate) : null);

      const matchedIds = new Set();
      const toUpdate = [];
      const toCreate = [];

      const normalizeName = (n) => (n || '')
        .toLowerCase()
        .replace(/^(mr\.|mrs\.|ms\.)\s*/i, '')
        .replace(/\b(dr\.|prof\.|dipl\.|ing\.)\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Helper: find tourist-specific remark / extra night by full name match (last + first name)
      const makeNameLookupD = (map) => (fullName) => {
        if (!map.size) return null;
        const normN = (n) => n.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '').replace(/\b(dr\.|prof\.|dipl\.|ing\.)\s*/gi, '').replace(/\s+/g, ' ').trim();
        const tNorm = normN(fullName);
        const tLast  = tNorm.split(',')[0].trim();
        const tFirst = tNorm.includes(',') ? tNorm.split(',').slice(1).join(',').trim() : '';
        for (const [keyName, val] of map.entries()) {
          const kNorm = normN(keyName);
          let kLast, kFirst;
          if (kNorm.includes(',')) { kLast = kNorm.split(',')[0].trim(); kFirst = kNorm.split(',').slice(1).join(',').trim(); }
          else { const w = kNorm.split(' ').filter(Boolean); kLast = w.pop() || ''; kFirst = w.join(' '); }
          if (!kLast || !tLast || kLast !== tLast || tLast.length < 2) continue;
          if (kFirst && tFirst) {
            if (!tFirst.startsWith(kFirst) && !kFirst.startsWith(tFirst)) {
              const ml = Math.min(5, kFirst.length, tFirst.length);
              if (kFirst.substring(0, ml) !== tFirst.substring(0, ml)) continue;
            }
          }
          return val;
        }
        return null;
      };
      const getSpecificRemark = makeNameLookupD(touristSpecificRemarks);
      const getExtraNightInfo = makeNameLookupD(extraNightTourists);

      const mergeRemark = (existing, line) => {
        if (!line) return existing;
        const lines = (!existing || existing === '-') ? [] : existing.split('\n').filter(Boolean);
        if (!lines.some(l => l === line)) lines.push(line);
        return lines.join('\n');
      };

      for (const pdfT of docxTourists) {
        const birthdayRemark = getBirthdayRemark(pdfT);
        const specificRemark = getSpecificRemark(pdfT.fullName);
        const extraNight = getExtraNightInfo(pdfT.fullName);
        const extraNightRemark = extraNight ? `Extra night TAS: arrival ${extraNight.display}` : null;

        let effectiveCheckIn = touristCheckIn;
        let effectiveTourStart = touristTourStart;
        if (extraNight) {
          const year = extraNight.year || (booking.departureDate ? new Date(booking.departureDate).getFullYear() : new Date().getFullYear());
          effectiveCheckIn = new Date(year, extraNight.month - 1, extraNight.day);
          effectiveTourStart = new Date(effectiveCheckIn.getTime() - 86400000);
        }

        const pdfName = normalizeName(pdfT.fullName);
        // Step 1: exact normalized match
        let existing = existingTourists.find(t => normalizeName(t.fullName) === pdfName);
        // Step 2: fuzzy match — handles format mismatch between Excel ("First Last") and PDF ("Last, First")
        // Ensures passport/dateOfBirth from Excel is preserved when PDF is imported after Excel
        if (!existing) {
          const _n = (n) => n.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '').replace(/\s+/g, ' ').trim();
          const _parts = (norm) => {
            if (norm.includes(',')) return { last: norm.split(',')[0].trim(), first: norm.split(',').slice(1).join(',').trim() };
            const w = norm.split(' ').filter(Boolean); return { last: w.pop() || '', first: w.join(' ') };
          };
          const { last: pLast, first: pFirst } = _parts(_n(pdfT.fullName || ''));
          existing = existingTourists.find(t => {
            const { last: tLast, first: tFirst } = _parts(_n(t.fullName || ''));
            if (!pLast || !tLast || pLast !== tLast || tLast.length < 2) return false;
            if (pFirst && tFirst) {
              if (!tFirst.startsWith(pFirst) && !pFirst.startsWith(tFirst)) {
                const ml = Math.min(5, pFirst.length, tFirst.length);
                if (pFirst.substring(0, ml) !== tFirst.substring(0, ml)) return false;
              }
            }
            return true;
          });
        }

        if (existing) {
          matchedIds.add(existing.id);
          // Rebuild remarks from scratch on each import to avoid stale lines accumulating
          const isAutoLine = (l) =>
            /^(vegetarian|vegan|glutenfree)$/i.test(l) ||
            l.startsWith('Birthday:') ||
            l.startsWith('Allergie:') ||
            l.startsWith('Extra night TAS:') ||
            /Indiv\. arrival|Late arrival|Early arrival|Dom\. flight|Last night (in|cancelled)|Use group transfer|Organize transfer himself|Early return flight|Indiv\. departure|Late checkout|Early check-in|Room near /i.test(l) ||
            /earlier.+return flight|later.+return flight|return flight|organiz\w* transfer|transfer him\w*/i.test(l) ||
            /^\*?\s*PAX booked half double|no roommate found/i.test(l) ||
            l.endsWith('...') || l.includes('→') || l.includes('->');
          const existLines = (existing.remarks && existing.remarks !== '-')
            ? existing.remarks.split('\n').filter(Boolean)
            : [];
          const manualLines = existLines.filter(l => !isAutoLine(l));
          const newRemarkLines = [];
          if (pdfT.isVegetarian) newRemarkLines.push(pdfT.dietLabel || 'Vegetarian');
          if (pdfT.isGlutenfree) newRemarkLines.push('Glutenfree');
          if (pdfT.allergyLabel) newRemarkLines.push(pdfT.allergyLabel);
          if (birthdayRemark) newRemarkLines.push(birthdayRemark);
          if (specificRemark) newRemarkLines.push(specificRemark);
          if (extraNightRemark) newRemarkLines.push(extraNightRemark);
          for (const ml of manualLines) {
            if (!newRemarkLines.includes(ml)) newRemarkLines.push(ml);
          }
          // Always rebuild: if manualLines exist but no auto-fields, keep only manual; otherwise use new auto lines
          const updatedRemarks = newRemarkLines.length > 0 ? newRemarkLines.join('\n') : (manualLines.length > 0 ? manualLines.join('\n') : null);
          toUpdate.push({
            id: existing.id,
            data: {
              roomPreference: pdfT.roomPreference,
              accommodation: pdfT.accommodation,
              roomNumber: pdfT.roomNumber || null,
              tourStartDate: effectiveTourStart || null,
              checkInDate: effectiveCheckIn || null,
              checkOutDate: touristCheckOut || null,
              remarks: updatedRemarks
            }
          });
        } else {
          const newRemarks = [];
          if (pdfT.isVegetarian) newRemarks.push(pdfT.dietLabel || 'Vegetarian');
          if (pdfT.isGlutenfree) newRemarks.push('Glutenfree');
          if (pdfT.allergyLabel) newRemarks.push(pdfT.allergyLabel);
          if (birthdayRemark) newRemarks.push(birthdayRemark);
          if (specificRemark) newRemarks.push(specificRemark);
          if (extraNightRemark) newRemarks.push(extraNightRemark);
          toCreate.push({
            bookingId: booking.id,
            fullName: pdfT.fullName || '',
            firstName: '',
            lastName: '',
            gender: 'unknown',
            roomPreference: pdfT.roomPreference,
            accommodation: pdfT.accommodation,
            roomNumber: pdfT.roomNumber || null,
            ...(effectiveTourStart && { tourStartDate: effectiveTourStart }),
            ...(effectiveCheckIn && { checkInDate: effectiveCheckIn }),
            ...(touristCheckOut && { checkOutDate: touristCheckOut }),
            ...(newRemarks.length > 0 && { remarks: newRemarks.join('\n') })
          });
        }
      }

      const toDeleteIds = existingTourists.filter(t => !matchedIds.has(t.id)).map(t => t.id);

      await prisma.$transaction(async (tx) => {
        for (const { id, data } of toUpdate) await tx.tourist.update({ where: { id }, data });
        for (const data of toCreate) await tx.tourist.create({ data });
        if (toDeleteIds.length > 0) {
          await tx.accommodationRoomingList.deleteMany({ where: { touristId: { in: toDeleteIds } } });
          await tx.touristRoomAssignment.deleteMany({ where: { touristId: { in: toDeleteIds } } });
          await tx.tourist.deleteMany({ where: { id: { in: toDeleteIds } } });
        }
      });

      // Clear system notes that may have been stored as tourist remarks
      await prisma.tourist.updateMany({
        where: { bookingId: booking.id, OR: [{ remarks: { contains: 'PAX booked half double' } }, { remarks: { contains: 'no roommate found' } }] },
        data: { remarks: null }
      });

      const bookingUpdateData = { paxSource: 'WORD', emailImportedAt: new Date(), status: 'FINAL_CONFIRMED' };
      {
        const strippedNotes = (booking.notes || '').split('\n\n')
          .filter(s => {
            const t = s.trim();
            if (t.startsWith('📋 Rooming List Remark:')) return false;
            if (t.startsWith('✈️ Transfers:')) return false;
            // Remove orphaned Arrival:/Departure: sub-sections left from previous imports
            if (/^(Arrival|Departure):\n\s+•/.test(t)) return false;
            return true;
          })
          .join('\n\n').trim();
        if (groupRemark) {
          const transferSection = `✈️ Transfers:\n${groupRemark}`;
          bookingUpdateData.notes = strippedNotes ? `${transferSection}\n\n${strippedNotes}` : transferSection;
        } else if (strippedNotes !== (booking.notes || '').trim()) {
          bookingUpdateData.notes = strippedNotes || null;
        }
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: bookingUpdateData
      });

      const summary = { updated: toUpdate.length, created: toCreate.length, deleted: toDeleteIds.length };

      // Auto-import flights in background (non-blocking) so tourist import response is immediate
      const _self = this;
      const _bookingId = booking.id;
      const _text = text;
      const _fileBuffer = fileBuffer;
      setImmediate(async () => {
      // Auto-import flights from text + Vision (embedded images)
      try {
        const { flights: flightData, totalPax: pdfTotalPax, knownPnrCodes } = _self._parseFlightsFromText(_text);

        const textDetected  = flightData.filter(f => f.flightNumber);
        const textSuggested = flightData.filter(f => !f.flightNumber);

        const uzbekAirportSet = new Set(['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG', 'URG']);
        const hasDomesticText = textDetected.some(f => f.type === 'DOMESTIC');
        const inboundPax  = textDetected.filter(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.arrival)   && f.pax > 0).reduce((s, f) => s + f.pax, 0);
        const outboundPax = textDetected.filter(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.departure) && f.pax > 0).reduce((s, f) => s + f.pax, 0);
        const detectedIntlPax = Math.max(inboundPax, outboundPax);
        const needsVision = false; // Vision AI disabled — requires explicit permission

        let visionFlights = [];

        const textHasOutbound = textDetected.some(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.departure) && !uzbekAirportSet.has(f.arrival));
        const combined = [...textDetected];
        for (const vf of visionFlights) {
          const paxToAdd = vf.pax || 0;
          if (paxToAdd <= 0) continue;
          const isOutbound = vf.type === 'INTERNATIONAL' && uzbekAirportSet.has(vf.departure) && !uzbekAirportSet.has(vf.arrival);
          const vfMin = vf.departureTime ? (() => { const m = vf.departureTime.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; })() : null;
          const existing = combined.find(f => {
            if (f.flightNumber !== vf.flightNumber || f.departure !== vf.departure || f.arrival !== vf.arrival) return false;
            if ((f.date || '') !== (vf.date || '')) return false;
            const fMin = f.departureTime ? (() => { const m = f.departureTime.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1])*60+parseInt(m[2]) : null; })() : null;
            if (vfMin === null || fMin === null) return true;
            return Math.abs(fMin - vfMin) <= 20;
          });
          const parseDetails = (d) => !d ? [] : Array.isArray(d) ? d : (() => { try { return JSON.parse(d); } catch { return []; } })();
          const nKey = n => n.toUpperCase().replace(/\b(MRS?|MS|DR|PROF)\.?\b/g,'').replace(/\//g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean).sort().join(' ');
          const mergeNamesLocal = (a, b) => { const r=[...a]; for(const n of b){if(!r.some(x=>nKey(x)===nKey(n)))r.push(n);} return r; };
          if (existing) {
            const merged = mergeNamesLocal(parseDetails(existing.paxDetails), parseDetails(vf.paxDetails));
            existing.paxDetails = merged.length > 0 ? JSON.stringify(merged) : null;
            existing.pax = merged.length > 0 ? merged.length : (existing.pax || 0) + paxToAdd;
          } else if (!isOutbound || !textHasOutbound) {
            const vd = parseDetails(vf.paxDetails);
            combined.push({ ...vf, paxDetails: vd.length > 0 ? JSON.stringify(vd) : null });
          }
        }

        if (!needsVision) {
          for (const s of textSuggested) {
            if (s.type === 'INTERNATIONAL') {
              const sArrIsUzbek = uzbekAirportSet.has(s.arrival);
              const covered = combined.some(f => f.type === 'INTERNATIONAL' && uzbekAirportSet.has(f.arrival) === sArrIsUzbek);
              if (!covered) combined.push(s);
            } else if (s.type === 'DOMESTIC') {
              if (!combined.some(f => f.type === 'DOMESTIC')) combined.push(s);
            }
          }
        }

        if (combined.length > 0) {
          const existingIntl = await prisma.flight.count({ where: { bookingId: booking.id, type: 'INTERNATIONAL' } });
          const existingDom  = await prisma.flight.count({ where: { bookingId: booking.id, type: 'DOMESTIC' } });
          const toSave = combined.filter(f => {
            if (f.type === 'INTERNATIONAL') return existingIntl === 0;
            if (f.type === 'DOMESTIC')      return existingDom === 0;
            return false;
          });
          if (toSave.length > 0) {
            await prisma.flight.createMany({
              data: toSave.map((f, i) => ({
                bookingId: booking.id,
                type: f.type || 'INTERNATIONAL',
                flightNumber: f.flightNumber || null,
                departure: f.departure,
                arrival: f.arrival,
                date: f.date ? new Date(f.date) : null,
                departureTime: f.departureTime || null,
                arrivalTime: f.arrivalTime || null,
                pax: f.pax || 0,
                price: 0,
                sortOrder: i
              }))
            });
            _debugLog(`✈️ DOCX ${toSave.length} flights auto-saved for booking ${booking.id}`);
          }
        }
      } catch (flightErr) {
        _debugLog(`⚠️ DOCX flight auto-import error: ${flightErr.message}`);
      }
      }); // end setImmediate

      return { bookingId: booking.id, summary };

    } catch (err) {
      console.error('❌ importRoomingListDocxForEmail error:', err.message);
      return null;
    }
  }

  /**
   * Extract flights from pre-extracted images (for DOCX) — same Vision logic as _extractFlightsWithVision.
   * @param {Array<{base64: string, mediaType: string}>} images
   */
  async _extractFlightsWithVisionFromImages(images, knownPnrCodes = [], tourYear = null, tourDepartureDate = null) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const imageContents = images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.base64 }
      }));

      const prompt = `RESPOND WITH ONLY A JSON ARRAY. NO EXPLANATION. NO MARKDOWN. NO TEXT BEFORE OR AFTER THE ARRAY.

These are pages from a hotel rooming list Word document. The pages show flight booking screenshots (Amadeus booking confirmations). Each screenshot shows: flight number, route (e.g. IST - TAS), date, departure time, arrival time, and passenger names.

Uzbekistan airports: TAS (Tashkent), UGC (Urgench), SKD (Samarkand), BHK (Bukhara), FEG (Fergana), NVI (Navoi), KSQ (Karshi), NCU, TMJ, URG.

TASK: Go through EVERY PNR/booking block visible in the images one by one. For each block, extract the Uzbekistan-related flight segments and the passenger(s) in that block.

RULES:
1. Process each PNR block INDEPENDENTLY. One JSON entry per PNR block per flight segment.
2. Only include flight segments where departure OR arrival is a Uzbekistan airport.
3. Do NOT include connecting legs: if a booking shows MUC→IST→TAS, extract ONLY "IST→TAS".
4. DATE: Read the exact date shown on that specific FLIGHT ROW only. "14/03/2026" = 2026-03-14. Read month carefully: 03=March, 04=April.
5. pax = count of names you list for that flight.
6. HK1, HK2, SS, NN, FX, HK are booking status codes — NOT airports or passenger counts.
7. Read flight numbers with EXTRA care — double-check every digit.
8. Scan ALL PNR blocks — do NOT skip any block.
${knownPnrCodes.length > 0 ? `\nSKIP these PNR codes (already extracted from text): ${knownPnrCodes.join(', ')}` : ''}

OUTPUT FORMAT:
[
  {
    "flightNumber": "TK 368",
    "departure": "IST",
    "arrival": "TAS",
    "date": "2026-03-14",
    "departureTime": "01:45",
    "arrivalTime": "08:35",
    "pax": 4,
    "type": "INTERNATIONAL",
    "names": ["MUELLER/HANS MR", "MUELLER/ANNA MRS"]
  }
]

If no Uzbekistan-related flights found in the images, respond with exactly: []`;

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 8192,
        temperature: 0,
        system: 'You are a flight data extractor. You respond ONLY with a valid JSON array. No markdown, no explanation, no text outside the JSON array.',
        messages: [{ role: 'user', content: [...imageContents, { type: 'text', text: prompt }] }]
      });

      const raw = response.content[0].text.trim();
      _debugLog(`✈️ DOCX Vision response (first 300): ${raw.slice(0, 300)}`);

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(f => ({
            ...f,
            type: f.type || 'INTERNATIONAL',
            paxDetails: f.names && f.names.length > 0 ? JSON.stringify(f.names) : null
          }));
        }
      } catch (_) {}

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map(f => ({
          ...f,
          type: f.type || 'INTERNATIONAL',
          paxDetails: f.names && f.names.length > 0 ? JSON.stringify(f.names) : null
        }));
      } catch (e) {
        _debugLog(`✈️ DOCX Vision JSON parse error: ${e.message}`);
        return [];
      }
    } catch (err) {
      _debugLog(`✈️ DOCX Vision error: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse tourists from already-parsed PDF text.
   * Extracts name, room type, room number, and tour type (UZ/TM section).
   */
  _parseTouristsFromText(text, tourTypeCode) {
    const tourists = [];
    const birthdaysMap = new Map(); // name → "DD.MM.YYYY"
    const vegetariansList = []; // {name, label} — label is "Vegetarian" or "Vegan"
    const allergiesMap = new Map(); // name → allergy string (e.g. "Nuts")
    const glutenfreeList = []; // names of glutenfree tourists
    // Strip bullet/sub-bullet prefixes (•, ●, o, -, *) that Word/PDF may produce
    const stripBullet = (l) => l.trim()
      .replace(/^[•●◦▪▸\-\*]\s+/, '')  // main bullets
      .replace(/^o\s{2,}/, '')           // sub-bullets ("o   text")
      .trim();
    const lines = text.split('\n').map(stripBullet).filter(l => l)
      .filter(l => !/PAX booked half double|no roommate found/i.test(l));

    let currentRoomType = null;
    let currentAccommodation = 'Uzbekistan';
    let roomCounters = { DBL: 0, TWN: 0, SNGL: 0 };
    let roomPersonCount = 0;
    let currentRoomNumber = null;
    let inAdditionalInfo = false;
    let inBirthdaysSection = false;
    let inVegetariansSection = false;
    let inAllergiesSection = false;
    let inGlutenfreeSection = false;
    let inRemarkSection = false;
    const remarkLines = []; // group-level remark text
    const touristSpecificRemarks = new Map(); // lowercased name key → short remark string
    const extraNightTourists = new Map(); // lowercased name key → {display:'DD.MM', day, month, year}
    let inExtraGuestsSection = false;
    let extraNightCurrentDate = null;
    let currentRemarkTargets = []; // tourist names waiting for sub-bullet remark lines
    let currentRemarkCollected = []; // collected sub-bullet remark lines
    // UZ section date range extracted from "Tour: Uzbekistan DD.MM.YYYY – DD.MM.YYYY"
    let uzSectionStart = null; // Date object
    let uzSectionEnd   = null; // Date object

    // Smart shortener: extracts key info tags from long remark text
    const smartShorten = (combined) => {
      const tags = [];
      // Individual flights
      if (/individual.*flight|flight.*individual/i.test(combined)) tags.push('Indiv. flights');
      // Individual / late / early arrival
      if (/individual arrival/i.test(combined)) {
        const meetMatch = combined.match(/meet the group on (?:the\s+)?(\w+)/i);
        if (meetMatch) {
          const place = meetMatch[1].toLowerCase();
          const placeLabel = place.startsWith('bus') ? 'bus' : place.startsWith('hot') ? 'Hotel' : meetMatch[1];
          tags.push(`Indiv. arrival · meet group on ${placeLabel}`);
        } else {
          tags.push('Indiv. arrival');
        }
      } else if (/late arrival/i.test(combined)) tags.push('Late arrival');
      else if (/early arrival/i.test(combined)) tags.push('Early arrival');
      // Domestic flight with date
      const domFlight = combined.match(/(?:later\s+)?domestic flight[^0-9]*(\d{1,2})\.(\d{2})/i);
      if (domFlight) tags.push(`Dom. flight ${domFlight[1].padStart(2,'0')}.${domFlight[2]}`);
      else if (/domestic flight/i.test(combined)) tags.push('Dom. flight');
      // Last night cancelled (no refund detail, but include city if present)
      if (/last night.*cancel/i.test(combined)) {
        const cityMatch = combined.match(/last night in\s+([A-Z]{2,4})\b/i);
        tags.push(cityMatch ? `Last night in ${cityMatch[1].toUpperCase()} cancelled` : 'Last night cancelled');
      }
      // Earlier / later return flight with time
      const returnFlight = combined.match(/(?:earlier|later)\s+return\s+flight(?:[^0-9]*(\d{1,2})[:\.](\d{2})\s*(am|pm)?)?/i);
      if (returnFlight) {
        if (returnFlight[1]) {
          const h = returnFlight[1].padStart(2,'0'), m = returnFlight[2], ap = returnFlight[3] ? ` ${returnFlight[3]}` : '';
          tags.push(`Early return flight ${h}:${m}${ap}`);
        } else {
          tags.push('Early return flight');
        }
      }
      // Group transfer / organize airport transfer himself
      if (/organiz\w*\s+(?:\w+\s+)*transfer|transfer\s+him\w*/i.test(combined)) tags.push('Organize transfer himself');
      else if (/group\s+transfer/i.test(combined)) tags.push('Use group transfer');
      // Individual departure / late checkout / early check-in
      if (/individual departure/i.test(combined)) tags.push('Indiv. departure');
      if (/late check-?out/i.test(combined)) tags.push('Late checkout');
      if (/early check-?in/i.test(combined)) tags.push('Early check-in');
      // Room near
      const roomNear = combined.match(/room near\s+(\S+)/i);
      if (roomNear) tags.push(`Room near ${roomNear[1]}`);
      // Return tags if found, else fallback to first clause
      if (tags.length > 0) return tags.join(' · ');
      let short = combined.split(/→|->|\s*\(|\s+-\s+(?:will|pax)\b/i)[0].trim();
      short = short.replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();
      return short.length > 70 ? short.substring(0, 67) + '...' : short;
    };

    for (const line of lines) {
      // Skip system notes (room assignment notes, not tourist remarks)
      if (/PAX booked half double|no roommate found/i.test(line)) continue;

      const lower = line.toLowerCase();

      // Detect section (Uzbekistan / Turkmenistan)
      // Format 1 (old): "Tour: Uzbekistan ..." / "Tour: Turkmenistan ..."
      // Format 2 (new): "Incl. extension Turkmenistan:" separator line
      const isTurkmenSection = tourTypeCode === 'ER' && (
        lower.includes('turkmenistan') || lower.includes('turkmen')
      );
      if (lower.includes('tour:')) {
        if (isTurkmenSection) {
          currentAccommodation = 'Turkmenistan';
        } else {
          currentAccommodation = 'Uzbekistan';
          // Capture UZ section date range (first occurrence): "Tour: Uzbekistan 12.09.2026 – 22.09.2026"
          if (!uzSectionStart) {
            const dm = line.match(/(\d{2}\.\d{2}\.\d{4})\s*[-–—]+\s*(\d{2}\.\d{2}\.\d{4})/);
            if (dm) {
              const [d1, m1, y1] = dm[1].split('.');
              const [d2, m2, y2] = dm[2].split('.');
              uzSectionStart = new Date(parseInt(y1), parseInt(m1) - 1, parseInt(d1));
              uzSectionEnd   = new Date(parseInt(y2), parseInt(m2) - 1, parseInt(d2));
            }
          }
        }
        roomPersonCount = 0;
        inAdditionalInfo = false;
        continue;
      }

      // Format 2: "Incl. extension Turkmenistan:" → switch to Turkmenistan section
      // Only match lines with "incl." prefix — NOT "Extension Turkmenistan – 29.04.2026" header
      if (isTurkmenSection && (lower.includes('incl.') || lower.startsWith('incl '))) {
        currentAccommodation = 'Turkmenistan';
        currentRoomType = null;
        roomPersonCount = 0;
        inAdditionalInfo = false;
        continue;
      }

      // Room type headers — also reset inAdditionalInfo
      if (line === 'DOUBLE' || lower === 'double') {
        currentRoomType = 'DBL'; roomPersonCount = 0; inAdditionalInfo = false; continue;
      }
      if (line === 'TWIN' || lower === 'twin') {
        currentRoomType = 'TWN'; roomPersonCount = 0; inAdditionalInfo = false; continue;
      }
      if (line === 'SINGLE' || lower === 'single') {
        currentRoomType = 'SNGL'; roomPersonCount = 0; inAdditionalInfo = false; continue;
      }

      // Skip section separators and totals
      if (!currentRoomType) continue;
      if (/^(TOTAL|Flights|Date|Tour|\/\/|\*|___)/i.test(line)) continue;
      if (/^\d+\s+PAX/i.test(line)) continue;

      // "Additional information" section: parse vegetarians/birthdays, stop parsing tourists
      if (/^Additional/i.test(line)) {
        inAdditionalInfo = true; inBirthdaysSection = false; inVegetariansSection = false; continue;
      }
      if (inAdditionalInfo) {
        // Parse Vegetarians section
        if (/^Vegetarians?:/i.test(line)) {
          inVegetariansSection = true; inBirthdaysSection = false;
          const val = line.replace(/^Vegetarians?:/i, '').trim();
          if (val && val !== '//' && val !== '-') {
            // Support both "//" separator and comma-separated names (Mr. or Mr without dot)
            const parts = val.includes('//') ? val.split('//') : val.split(/,\s*(?=Mr\.?|Mrs\.?|Ms\.?)\s/i);
            parts.forEach(part => {
              part = part.trim();
              if (!part) return;
              // Extract label from parenthetical: (Vegan), (vegan), (vegetarisch), etc.
              const labelMatch = part.match(/\(([^)]+)\)/i);
              const label = labelMatch && /vegan/i.test(labelMatch[1]) ? 'Vegan' : 'Vegetarian';
              const cleanedName = part.replace(/\s*\([^)]*\)/g, '').trim();
              if (cleanedName) vegetariansList.push({ name: cleanedName, label });
            });
          }
          continue;
        }
        // Parse Birthdays section
        if (/^Birthdays:/i.test(line)) {
          inBirthdaysSection = true; inVegetariansSection = false; inAllergiesSection = false; inGlutenfreeSection = false;
          const val = line.replace(/^Birthdays:/i, '').trim();
          if (val && val !== '//' && val !== '-') {
            // Support both "/" and "//" separators
            val.split(/\s*\/+\s*/).forEach(entry => {
              entry = entry.trim();
              if (!entry) return;
              // Format C: "Mrs Jutta Melber (23.04.1961)" — date in parens
              const mC = entry.match(/^(.+?)\s*\((\d{2}\.\d{2}\.\d{4})\)$/);
              // Format A (new): "Mr Reiner Schulz, 15.04.1955" or "Mr. Last, First 15.04.1955"
              const mA = !mC && entry.match(/^(.+?)[,\s]+(\d{2}\.\d{2}\.\d{4})$/);
              // Format B (old): "DD.MM.YYYY Name"
              const mB = !mC && !mA && entry.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+)$/);
              if (mC) birthdaysMap.set(mC[1].trim(), mC[2]);
              else if (mA) birthdaysMap.set(mA[1].trim(), mA[2]);
              else if (mB) birthdaysMap.set(mB[2].trim(), mB[1]);
            });
          }
          continue;
        }
        // Parse Allergies section
        if (/^Allergies:/i.test(line)) {
          inAllergiesSection = true; inVegetariansSection = false; inBirthdaysSection = false; inGlutenfreeSection = false;
          const val = line.replace(/^Allergies:/i, '').trim();
          if (val && val !== '//' && val !== '-') {
            // "Mr. Zimmer, Dietmar Andreas: nuts"
            const colonIdx = val.lastIndexOf(':');
            if (colonIdx > 0) {
              const name = val.substring(0, colonIdx).trim();
              const allergy = val.substring(colonIdx + 1).trim();
              if (name && allergy) allergiesMap.set(name, allergy);
            }
          }
          continue;
        }

        // Parse Glutenfree section
        if (/^Glutenfree:/i.test(line)) {
          inGlutenfreeSection = true; inVegetariansSection = false; inBirthdaysSection = false; inAllergiesSection = false;
          const val = line.replace(/^Glutenfree:/i, '').trim();
          if (val && val !== '//' && val !== '-') {
            val.split(/\s*\/+\s*/).forEach(name => { name = name.trim(); if (name) glutenfreeList.push(name); });
          }
          continue;
        }

        // Switch section on known headers
        if (/^Remark:/i.test(line)) {
          inBirthdaysSection = false; inVegetariansSection = false; inRemarkSection = true;
          const remarkVal = line.replace(/^Remark:/i, '').trim();
          if (remarkVal) {
            // "Mr. & Mrs. Auerbach" — couple with same last name → set as remark targets
            const coupleMatch = remarkVal.match(/^(Mr\.|Mrs\.|Ms\.)\s*&\s*(Mr\.|Mrs\.|Ms\.)\s+([A-Za-zÄÖÜäöüß-]+)$/i);
            if (coupleMatch) {
              currentRemarkTargets = [];
              currentRemarkCollected = [];
              const lastName = coupleMatch[3];
              currentRemarkTargets = [`Mr. ${lastName}`, `Mrs. ${lastName}`];
            } else {
              remarkLines.push(remarkVal);
            }
          }
          continue;
        }
        if (/^(International\s+Flights|Flights)/i.test(line)) {
          inBirthdaysSection = false; inVegetariansSection = false; inRemarkSection = false;
        }
        if (inRemarkSection) {
          if (/^(International\s+Flights|Flights)/i.test(line)) {
            inRemarkSection = false; inExtraGuestsSection = false;
            // Flush any pending multi-line remark before leaving remark section
            if (currentRemarkTargets.length > 0 && currentRemarkCollected.length > 0) {
              const combined = currentRemarkCollected.join(' ').replace(/\s+/g, ' ').trim();
              const short = smartShorten(combined);
              for (const name of currentRemarkTargets) touristSpecificRemarks.set(name.toLowerCase(), short);
            }
            currentRemarkTargets = []; currentRemarkCollected = [];
          } else {
            // --- "additional night in TAS from DD.MM. for all PAX above" ---
            // "above" = all tourists in the Uzbekistan section (all tourists parsed so far)
            const extraAboveMatch = line.match(/additional night.*?from\s+(\d{1,2})\.(\d{2})\./i);
            if (extraAboveMatch && /for all.*pax above/i.test(line)) {
              const day = parseInt(extraAboveMatch[1]);
              const month = parseInt(extraAboveMatch[2]);
              const yearM = line.match(/(\d{4})/);
              const year = yearM ? parseInt(yearM[1]) : null;
              const info = { display: `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}`, day, month, year };
              // Apply to ALL Uzbekistan-section tourists (all parsed tourists if no TKM section)
              for (const t of tourists) {
                if (t.accommodation === 'Uzbekistan') {
                  extraNightTourists.set(t.fullName.toLowerCase(), info);
                }
              }
              // tourist-specific → do NOT add to remarkLines
              continue;
            }
            // --- "additional night in TAS from DD.MM. for these guests:" ---
            if (extraAboveMatch && /for these guests/i.test(line)) {
              const day = parseInt(extraAboveMatch[1]);
              const month = parseInt(extraAboveMatch[2]);
              const yearM = line.match(/(\d{4})/);
              const year = yearM ? parseInt(yearM[1]) : null;
              extraNightCurrentDate = { display: `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}`, day, month, year };
              inExtraGuestsSection = true;
              // do NOT add to remarkLines
              continue;
            }
            // --- collect guests under "for these guests:" ---
            if (inExtraGuestsSection) {
              const guestMatches = [...line.matchAll(/((?:Mr\.|Mrs\.|Ms\.)\s+[A-Za-zÄÖÜäöüß-]+,\s+[A-Za-zÄÖÜäöüß\s-]+?)(?=\s+and\s+(?:Mr\.|Mrs\.|Ms\.)|\s*\(|\s*$)/gi)];
              if (guestMatches.length > 0) {
                for (const gm of guestMatches) extraNightTourists.set(gm[1].trim().toLowerCase(), extraNightCurrentDate);
                continue; // tourist names → not in remarkLines
              } else {
                inExtraGuestsSection = false;
                // fall through to normal categorization below
              }
            }
            // Skip system notes (room assignment notes, not tourist remarks)
            if (/^\*?\s*PAX booked half double|no roommate found/i.test(line)) continue;

            // Helper: flush collected multi-line remark to all target tourists
            const flushRemarkContext = () => {
              if (currentRemarkTargets.length > 0 && currentRemarkCollected.length > 0) {
                const combined = currentRemarkCollected.join(' ').replace(/\s+/g, ' ').trim();
                const short = smartShorten(combined);
                for (const name of currentRemarkTargets) {
                  touristSpecificRemarks.set(name.toLowerCase(), short);
                }
              }
              currentRemarkTargets = [];
              currentRemarkCollected = [];
            };

            // --- "travel together" (two tourists, room nearby) ---
            const twoMatch = line.match(/^((?:Mr\.|Mrs\.|Ms\.)\s+[A-Za-zÄÖÜäöüß-]+,\s+[A-Za-zÄÖÜäöüß\s-]+?)\s+and\s+((?:Mr\.|Mrs\.|Ms\.)\s+[A-Za-zÄÖÜäöüß-]+,\s+[A-Za-zÄÖÜäöüß\s-]+?)\s+travel together/i);
            // --- two tourists joined with "&": "Mrs. X & Mrs. Y: remark (possibly empty, continued on next lines)" ---
            const ampMatch = !twoMatch && line.match(/^((?:Mr\.|Mrs\.|Ms\.)\s+[A-Za-zÄÖÜäöüß-]+,\s+[A-Za-zÄÖÜäöüß\s-]+?)\s*&\s*((?:Mr\.|Mrs\.|Ms\.)\s+[A-Za-zÄÖÜäöüß-]+,\s+[A-Za-zÄÖÜäöüß\s-]+?):\s*(.*)/i);
            // --- single tourist "Mr. Name, First: remark" (text may be empty → continued on next lines) ---
            const oneMatch = !twoMatch && !ampMatch && line.match(/^((?:Mr\.|Mrs\.|Ms\.)\s+[A-Za-zÄÖÜäöüß-]+,\s+[A-Za-zÄÖÜäöüß\s-]+?):\s*(.*)/i);

            if (twoMatch) {
              flushRemarkContext();
              const n1 = twoMatch[1].trim();
              const n2 = twoMatch[2].trim();
              const normN = (n) => n.replace(/^(?:Mr\.|Mrs\.|Ms\.)\s+/i, '').split(',')[0].trim();
              touristSpecificRemarks.set(n1.toLowerCase(), `Room near ${normN(n2)}`);
              touristSpecificRemarks.set(n2.toLowerCase(), `Room near ${normN(n1)}`);
            } else if (ampMatch) {
              flushRemarkContext();
              const n1 = ampMatch[1].trim();
              const n2 = ampMatch[2].trim();
              const inlineText = ampMatch[3].trim();
              currentRemarkTargets = [n1, n2];
              if (inlineText) currentRemarkCollected.push(inlineText);
              // tourist-specific → not in remarkLines
            } else if (oneMatch) {
              flushRemarkContext();
              const name = oneMatch[1].trim();
              const inlineText = oneMatch[2].trim();
              if (inlineText && !/PAX booked half double|no roommate found/i.test(inlineText)) {
                // Remark on same line — finalize immediately via smartShorten
                const short = smartShorten(inlineText);
                touristSpecificRemarks.set(name.toLowerCase(), short);
              } else {
                // Empty remark on header line → collect sub-bullet lines
                currentRemarkTargets = [name];
              }
            } else if (currentRemarkTargets.length > 0) {
              // Sub-bullet remark line belonging to current tourist(s) — skip system notes
              if (/PAX booked half double|no roommate found/i.test(line)) { /* skip */ }
              else currentRemarkCollected.push(line.trim());
            } else {
              // Only keep transfer-related lines in group notes
              const isTransfer =
                /airport transfer/i.test(line) ||
                /\d+\s*\.(Arrival|Departure|Ankunft|Abreise):/i.test(line) ||
                /transfer for \d+/i.test(line) ||
                /we need.*transfer/i.test(line);
              if (isTransfer) {
                const normalized = line.trim().toLowerCase().replace(/\s+/g, ' ');
                const isDuplicate = remarkLines.some(l => l.toLowerCase().replace(/\s+/g, ' ') === normalized);
                if (!isDuplicate) remarkLines.push(line.trim());
              }
            }
          }
          continue;
        }
        if (inVegetariansSection) {
          if (/^(Remark:|Birthdays:|Allergies:|Glutenfree:|International|Flights)/i.test(line)) {
            inVegetariansSection = false;
          } else if (/^(Mr\.?|Mrs\.?|Ms\.?)\s/i.test(line)) {
            vegetariansList.push({ name: line.trim(), label: 'Vegetarian' });
          }
        }
        if (inBirthdaysSection) {
          if (/^(Remark:|Vegetarians?:|Allergies:|Glutenfree:|International|Flights)/i.test(line)) {
            inBirthdaysSection = false;
          } else if (/^(Mr\.?|Mrs\.?|Ms\.?)\s/i.test(line)) {
            // "Mrs. Diermeier, Melanie Katrin    18.10.1980" or "Mr Reiner Schulz 15.04.1980"
            const bm = line.match(/^(.+?)[,\s]+(\d{2}\.\d{2}\.\d{4})$/);
            if (bm) birthdaysMap.set(bm[1].trim(), bm[2]);
          }
        }
        if (inAllergiesSection) {
          if (/^(Remark:|Birthdays:|Vegetarians?:|Glutenfree:|International|Flights)/i.test(line)) {
            inAllergiesSection = false;
          } else if (/^(Mr\.?|Mrs\.?|Ms\.?)\s/i.test(line)) {
            // "Mrs. Zimmer, Veronika Maria: nuts"
            const colonIdx = line.lastIndexOf(':');
            if (colonIdx > 0) {
              const name = line.substring(0, colonIdx).trim();
              const allergy = line.substring(colonIdx + 1).trim();
              if (name && allergy) allergiesMap.set(name, allergy);
            }
          }
        }
        if (inGlutenfreeSection) {
          if (/^(Remark:|Birthdays:|Vegetarians?:|Allergies:|International|Flights)/i.test(line)) {
            inGlutenfreeSection = false;
          } else if (/^(Mr\.?|Mrs\.?|Ms\.?)\s/i.test(line)) {
            glutenfreeList.push(line.trim());
          }
        }
        continue;
      }

      // Tourist name lines: must start with Mr./Mrs./Ms.
      if (/^(Mr\.|Mrs\.|Ms\.)/i.test(line)) {
        // Check for asterisk BEFORE stripping (asterisk = half double, no roommate → SNGL)
        const hasAsterisk = line.includes('*');

        // Normalize name: strip asterisk, DOB patterns like (17.09.1956), academic titles
        let fullName = line.trim().replace(/\*/g, '').trim();
        fullName = fullName.replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*/g, ' ').trim();
        fullName = fullName.replace(/\b(Dr\.|Prof\.|Dipl\.|Ing\.)\s*/g, '').trim();

        if (hasAsterisk) {
          // Find the tourist already added (same person appears twice: first without asterisk, then with)
          const normName = (n) => n.toLowerCase().replace(/[*\s]/g, '');
          const normalizedSearch = normName(fullName);
          const existing = tourists.find(t => normName(t.fullName) === normalizedSearch);
          if (existing) {
            // Update existing tourist: move from DBL/TWN to SNGL (no roommate)
            existing.roomPreference = 'SNGL';
            roomCounters.SNGL++;
            existing.roomNumber = `SNGL-${roomCounters.SNGL}`;
          } else {
            // Asterisked tourist appearing for the first time → add as SNGL directly
            roomCounters.SNGL++;
            tourists.push({
              fullName,
              roomPreference: 'SNGL',
              accommodation: currentAccommodation,
              roomNumber: `SNGL-${roomCounters.SNGL}`
            });
          }
          roomPersonCount++; // keep counter in sync
          continue;
        }

        roomPersonCount++;

        // Assign room number based on room type
        if (currentRoomType === 'DBL') {
          if (roomPersonCount % 2 === 1) {
            roomCounters.DBL++;
            currentRoomNumber = `DBL-${roomCounters.DBL}`;
          }
          // 2nd person in DBL gets same room number
        } else if (currentRoomType === 'TWN') {
          if (roomPersonCount % 2 === 1) {
            roomCounters.TWN++;
            currentRoomNumber = `TWN-${roomCounters.TWN}`;
          }
        } else {
          roomCounters.SNGL++;
          currentRoomNumber = `SNGL-${roomCounters.SNGL}`;
        }

        tourists.push({
          fullName,
          roomPreference: currentRoomType,
          accommodation: currentAccommodation,
          roomNumber: currentRoomNumber
        });
      }
    }

    // Flush any remaining multi-line remark context after loop ends
    if (currentRemarkTargets.length > 0 && currentRemarkCollected.length > 0) {
      const combined = currentRemarkCollected.join(' ').replace(/\s+/g, ' ').trim();
      const short = smartShorten(combined);
      for (const name of currentRemarkTargets) touristSpecificRemarks.set(name.toLowerCase(), short);
    }

    // Helper: check if PDF name matches tourist — supports "First Last" and "Last, First" formats
    // Tourist fullName is always "Last, First Middle" format in DB
    const nameMatchesTourist = (pdfName, tourist) => {
      const normN = (n) => n.toLowerCase()
        .replace(/^(mr\.|mrs\.|ms\.|mr\s|mrs\s)\s*/i, '')
        .replace(/\s+/g, ' ').trim();
      const nNorm = normN(pdfName);
      const tNorm = normN(tourist.fullName || '');

      // Extract last + first from PDF name
      let nLast, nFirst;
      if (nNorm.includes(',')) {
        nLast  = nNorm.split(',')[0].trim();
        nFirst = nNorm.split(',').slice(1).join(',').trim();
      } else {
        const words = nNorm.split(' ').filter(Boolean);
        nLast  = words.pop() || '';
        nFirst = words.join(' ');
      }

      // Extract last + first from tourist name (always "Last, First Middle")
      const tLast  = tNorm.split(',')[0].trim();
      const tFirst = tNorm.includes(',') ? tNorm.split(',').slice(1).join(',').trim() : '';

      if (!nLast || !tLast || nLast !== tLast || tLast.length < 2) return false;

      // Verify first name: tourist first names must START WITH pdf first name
      // e.g. pdf="friedrich", tourist="friedrich josef" → starts with ✅
      // e.g. pdf="dietmar andreas", tourist="dietmar andreas" → exact match ✅
      // Allow slight typo (e.g. "dietmer" vs "dietmar"): compare first 5 chars as fallback
      if (nFirst && tFirst) {
        if (!tFirst.startsWith(nFirst) && !nFirst.startsWith(tFirst)) {
          const minLen = Math.min(5, Math.min(nFirst.length, tFirst.length));
          if (nFirst.substring(0, minLen) !== tFirst.substring(0, minLen)) return false;
        }
      }

      return true;
    };

    // Match vegetariansList against tourists and mark them
    if (vegetariansList.length > 0) {
      for (const tourist of tourists) {
        const matched = vegetariansList.find(veg => nameMatchesTourist(veg.name, tourist));
        if (matched) {
          tourist.isVegetarian = true;
          tourist.dietLabel = matched.label; // "Vegetarian" or "Vegan"
        }
      }
    }

    // Match allergiesMap against tourists
    if (allergiesMap.size > 0) {
      for (const tourist of tourists) {
        for (const [name, allergy] of allergiesMap.entries()) {
          if (nameMatchesTourist(name, tourist)) {
            tourist.allergyLabel = `Allergie: ${allergy.charAt(0).toUpperCase() + allergy.slice(1)}`;
            break;
          }
        }
      }
    }

    // Match glutenfreeList against tourists
    if (glutenfreeList.length > 0) {
      for (const tourist of tourists) {
        if (glutenfreeList.some(name => nameMatchesTourist(name, tourist))) {
          tourist.isGlutenfree = true;
        }
      }
    }

    // Deduplicate tourists by normalized fullName (same person may appear in multiple sections)
    const seenNames = new Set();
    const uniqueTourists = tourists.filter(t => {
      const key = t.fullName.toLowerCase().replace(/\s/g, '');
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    const groupRemark = remarkLines.length > 0 ? this._formatTransferNotes(remarkLines) : null;
    return { tourists: uniqueTourists, birthdaysMap, uzSectionStart, uzSectionEnd, groupRemark, touristSpecificRemarks, extraNightTourists };
  }

  /**
   * Format raw transfer remark lines into a clean Arrival / Departure structure.
   */
  _formatTransferNotes(lines) {
    const arrivals = [];
    const departures = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const isArr = /\d+\s*\.Arrival:/i.test(line);
      const isDep = /\d+\s*\.Departure:/i.test(line);
      if (!isArr && !isDep) continue;
      if (/see remark/i.test(line)) continue; // skip reference lines

      // Extract PAX count
      const paxMatch = line.match(/transfer for\s*(\d+)\s*PAX/i);
      const pax = paxMatch ? paxMatch[1] : null;

      // Strip prefix and PAX suffix
      let flightPart = line
        .replace(/^\d+\s*\.(Arrival|Departure):\s*/i, '')
        .replace(/\s*[→>-]+\s*transfer for.*$/i, '')
        .trim();

      // Remove arrival time "– HH:MM (+1)" — keep only departure time
      flightPart = flightPart.replace(/\s*[–\-]\s*\d{1,2}:\d{2}(\s*\+\d+)?/g, '');
      // Normalize airport separator: IST-TAS → IST→TAS
      flightPart = flightPart.replace(/([A-Z]{3})-([A-Z]{3})/g, '$1→$2');
      // Clean up spaces
      flightPart = flightPart.replace(/\s+/g, ' ').replace(/\s*&\s*/g, ' & ').trim();

      const entry = pax ? `${flightPart} — ${pax} PAX` : flightPart;
      if (isArr) arrivals.push(entry);
      else departures.push(entry);
    }

    if (arrivals.length === 0 && departures.length === 0) {
      // Fallback: no flight lines found, join raw lines
      return lines.join('\n');
    }

    const parts = [];
    if (arrivals.length > 0) parts.push('Arrival:\n' + arrivals.map(a => `  • ${a}`).join('\n'));
    if (departures.length > 0) parts.push('Departure:\n' + departures.map(d => `  • ${d}`).join('\n'));
    return parts.join('\n\n');
  }

  /**
   * Parse flights from Final Rooming List PDF text (GDS format).
   * Returns array of flight objects ready for prisma.flight.createMany().
   *
   * GDS line format (Sabre/Amadeus):
   *   "6  LO 191 G 29MAR 7 WAWTAS HK4          2300 0800+1 *1A/E*"
   *   "5  LO 380 G 29MAR 7 FRAWAW HK4       1  2000 2145   *1A/E*"
   */

  /**
   * Use Claude Vision (Haiku → Sonnet fallback) to extract flights from PDF pages rendered as images.
   * Used when text parsing misses image-embedded flight tables.
   */
  async _extractFlightsWithVision(pdfBuffer, knownPnrCodes = [], tourYear = null, tourDepartureDate = null) {
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      const { createCanvas } = require('canvas');
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const data = new Uint8Array(pdfBuffer);
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      // Only render pages that contain embedded images (paintImageXObject op=85 or paintInlineImageXObject op=84).
      // Skipping text-only pages reduces Vision confusion and cost.
      const imageContents = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const ops = await page.getOperatorList();
        const imageOpCount = ops.fnArray.filter(op => op === 85 || op === 84).length;
        // Skip pages with only 1 embedded image — that's the header/logo present on every page.
        // Flight screenshot pages have 2+ embedded images (logo + PNR screenshot(s)).
        if (imageOpCount < 2) {
          _debugLog(`✈️ Vision: page ${pageNum} imageOps=${imageOpCount}, skipping (logo only)`);
          continue;
        }
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const base64 = canvas.toBuffer('image/png').toString('base64');
        imageContents.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } });
        _debugLog(`✈️ Vision: page ${pageNum} imageOps=${imageOpCount}, included`);
      }

      if (imageContents.length === 0) {
        _debugLog('✈️ Vision: no image pages found in PDF');
        return [];
      }

      const prompt = `RESPOND WITH ONLY A JSON ARRAY. NO EXPLANATION. NO MARKDOWN. NO TEXT BEFORE OR AFTER THE ARRAY.

These are pages from a hotel rooming list PDF. The pages show flight booking screenshots (Amadeus booking confirmations). Each screenshot shows: flight number, route (e.g. IST - TAS), date, departure time, arrival time, and passenger names.

Uzbekistan airports: TAS (Tashkent), UGC (Urgench), SKD (Samarkand), BHK (Bukhara), FEG (Fergana), NVI (Navoi), KSQ (Karshi), NCU, TMJ, URG.

TASK: Go through EVERY PNR/booking block visible in the images one by one. For each block, extract the Uzbekistan-related flight segments and the passenger(s) in that block.

RULES:
1. Process each PNR block INDEPENDENTLY. One JSON entry per PNR block per flight segment. It is OK to have MULTIPLE entries for the same flight number if different PNR blocks show the same flight — do NOT skip a block just because you already have an entry for that flight.
2. Only include flight segments where departure OR arrival is a Uzbekistan airport.
3. Do NOT include connecting legs: if a booking shows MUC→IST→TAS, extract ONLY "IST→TAS" (TK 368), not "MUC→IST".
4. DATE: Read the exact date shown on that specific FLIGHT ROW only. "14/03/2026" = 2026-03-14. "26 MAR 2026" = 2026-03-26. Read month carefully: 03=March, 04=April. IGNORE "Ticket Time Limit", "TKT Ausgestellt", "Issued", "payment deadline" dates — these are billing dates, NOT flight dates.
5. pax = count of names you list for that flight.
6. If a passenger name is unclear, write it as best you can read it.
7. HK1, HK2, SS, NN, FX, HK are booking status codes — NOT airports or passenger counts.
8. Read flight numbers with EXTRA care — double-check every digit (e.g. "368" not "361", "369" not "360"). The last digit is critical.
8. Scan ALL PNR blocks — including small ones at bottom of page, ones with codes like TMIF2T, S04R9P2, XG6DHR, etc. Do NOT skip any block.

OUTPUT FORMAT:
[
  {
    "flightNumber": "TK 368",
    "departure": "IST",
    "arrival": "TAS",
    "date": "2026-03-14",
    "departureTime": "01:45",
    "arrivalTime": "08:35",
    "pax": 4,
    "type": "INTERNATIONAL",
    "names": ["MUELLER/HANS MR", "MUELLER/ANNA MRS", "SCHMIDT/PETER MR", "BAUER/LISA MRS"]
  }
]

If no Uzbekistan-related flights found in the images, respond with exactly: []`;

      const callVision = async (model) => {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          temperature: 0,
          system: 'You are a flight data extractor. You respond ONLY with a valid JSON array. No markdown, no explanation, no text outside the JSON array.',
          messages: [{ role: 'user', content: [...imageContents, { type: 'text', text: prompt }] }]
        });
        const raw = response.content[0].text.trim();
        // Write full Vision response to temp file for debugging
        try { require('fs').writeFileSync('/tmp/vision_response.json', raw); } catch(_) {}
        _debugLog(`✈️ Vision response length=${raw.length}, TMIF2T=${raw.includes('TMIF2T')?'FOUND':'NOT_FOUND'}, starts: ${raw.slice(0, 200)}`);
        // Try direct parse first (pure JSON response)
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
        // Fallback: extract JSON array from markdown response
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          _debugLog(`✈️ Vision returned non-JSON, no array found`);
          return [];
        }
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          _debugLog(`✈️ Vision JSON parse error: ${e.message}`);
          return [];
        }
      };

      // Sonnet + temperature=0 = deterministik, har doim bir xil natija
      let flights = [];
      try {
        flights = await callVision('claude-sonnet-4-6');
      } catch (e) {
        _debugLog(`Vision Sonnet error: ${e.message}`);
      }

      // Filter out flights with invalid airport codes (GDS status codes like HK, HK1, HK2, HK4)
      const validIata = /^[A-Z]{3}$/;
      const gdsStatusCodes = new Set(['HK1','HK2','HK3','HK4','HK','SS','NN','UN','GK','HL']);
      const uzbekAirportsV = new Set(['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG', 'URG']);
      flights = flights.filter(f => {
        const depOk = validIata.test(f.departure) && !gdsStatusCodes.has(f.departure);
        const arrOk = validIata.test(f.arrival)   && !gdsStatusCodes.has(f.arrival);
        if (!depOk || !arrOk) {
          _debugLog(`⚠️ Vision: skipping invalid airport code: ${f.departure}→${f.arrival}`);
          return false;
        }
        // For INTERNATIONAL: only keep flights where exactly one airport is Uzbek (TAS, UGC, etc.)
        // This removes pure European connecting legs and pure domestic misclassified flights
        if (f.type === 'INTERNATIONAL') {
          const depUzbek = uzbekAirportsV.has(f.departure);
          const arrUzbek = uzbekAirportsV.has(f.arrival);
          if (!depUzbek && !arrUzbek) {
            _debugLog(`⚠️ Vision: skipping non-Uzbek international: ${f.departure}→${f.arrival}`);
            return false;
          }
        }
        return true;
      });

      // Convert Vision names array → paxDetails JSON string
      const parseArr = d => !d ? [] : Array.isArray(d) ? d : (() => { try { return JSON.parse(d); } catch { return []; } })();
      for (const f of flights) {
        const names = Array.isArray(f.names) ? f.names : [];
        f.paxDetails = names.length > 0 ? JSON.stringify(names) : null;
        if (names.length > 0) f.pax = names.length;
        delete f.names;
      }

      // Name normalization: strip titles, replace "/" with space, split into words, sort → dedup key
      // Handles both "LASTNAME/FIRSTNAME MRS" and "MRS FIRSTNAME LASTNAME" formats
      const nameKey = n => n.toUpperCase()
        .replace(/\b(MRS?|MS|DR|PROF)\.?\b/g, '')
        .replace(/\//g, ' ')
        .replace(/\s+/g, ' ').trim()
        .split(' ').filter(Boolean).sort().join(' ');

      const mergeNames = (a, b) => {
        const result = [...a];
        for (const name of b) {
          if (!result.some(r => nameKey(r) === nameKey(name))) result.push(name);
        }
        return result;
      };

      // Helper: convert "HH:MM" to minutes
      const toMinutes = t => {
        if (!t) return null;
        const m = t.match(/^(\d{1,2}):(\d{2})$/);
        return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
      };

      // STEP 1: Cross-year cleanup BEFORE merge
      // If a passenger appears in a non-tourYear flight → Vision misread their date
      // Remove them from tourYear flights and discard non-tourYear flights entirely
      if (tourYear) {
        const paxYears = new Map(); // nameKey → Set of years
        for (const f of flights) {
          const yr = f.date ? new Date(f.date).getFullYear() : null;
          if (!yr) continue;
          for (const name of parseArr(f.paxDetails)) {
            const key = nameKey(name);
            if (!paxYears.has(key)) paxYears.set(key, new Set());
            paxYears.get(key).add(yr);
          }
        }
        const wrongYearPax = new Set();
        for (const [key, years] of paxYears) {
          if ([...years].some(y => y !== tourYear)) wrongYearPax.add(key);
        }
        if (wrongYearPax.size > 0) {
          _debugLog(`✈️ Cross-year passengers removed: ${[...wrongYearPax].join(', ')}`);
          for (const f of flights) {
            const yr = f.date ? new Date(f.date).getFullYear() : null;
            if (yr !== tourYear) continue;
            const cleaned = parseArr(f.paxDetails).filter(n => !wrongYearPax.has(nameKey(n)));
            f.paxDetails = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
            f.pax = cleaned.length;
          }
        }
        // Remove all non-tourYear flights AND flights more than 90 days from tour departure
        flights = flights.filter(f => {
          const yr = f.date ? new Date(f.date).getFullYear() : null;
          if (yr && yr !== tourYear) { _debugLog(`✈️ Skipping non-tourYear: ${f.flightNumber} ${f.date}`); return false; }
          if (tourDepartureDate && f.date) {
            const diffDays = Math.abs((new Date(f.date) - tourDepartureDate) / 86400000);
            if (diffDays > 90) { _debugLog(`✈️ Skipping out-of-window: ${f.flightNumber} ${f.date} (${Math.round(diffDays)}d from tour)`); return false; }
          }
          return f.pax > 0 || !yr;
        });
      }

      // STEP 2: Merge entries with same flightNumber+route+date, departure time within 30 min
      // 30 min handles OCR errors (01:40 vs 01:45 = 5 min) AND same-flight different PNR blocks
      // Cross-year pax already removed, so no risk of merging wrong-year passengers
      const mergedList = [];
      for (const f of flights) {
        const fMin = toMinutes(f.departureTime);
        // Match if: same route + same date + time within 20 min
        // AND (same flight number OR same airline prefix — OCR may misread 368→361)
        const sameAirline = (a, b) => a && b && a.slice(0, 2) === b.slice(0, 2);
        const existing = mergedList.find(e =>
          e.departure === f.departure &&
          e.arrival === f.arrival &&
          (e.date || '') === (f.date || '') &&
          (e.flightNumber === f.flightNumber || sameAirline(e.flightNumber, f.flightNumber)) &&
          (() => {
            const eMin = toMinutes(e.departureTime);
            if (fMin === null || eMin === null) return true;
            return Math.abs(fMin - eMin) <= 20;
          })()
        );
        if (existing) {
          const combined = mergeNames(parseArr(existing.paxDetails), parseArr(f.paxDetails));
          existing.paxDetails = combined.length > 0 ? JSON.stringify(combined) : null;
          existing.pax = combined.length > 0 ? combined.length : (existing.pax || 0) + (f.pax || 0);
        } else {
          mergedList.push({ ...f });
        }
      }
      flights = mergedList;

      _debugLog(`✈️ Vision extracted ${flights.length} flights after merge`);
      return flights;
    } catch (e) {
      _debugLog(`⚠️ Vision extraction failed: ${e.message}`);
      return [];
    }
  }

  _parseFlightsFromText(text) {
    const intlIdx = text.indexOf('International Flights');
    if (intlIdx !== -1) {
      _debugLog(`✈️ PDF flight section (full): ${text.slice(intlIdx, intlIdx + 3000).replace(/\n/g, '|')}`);
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    const uzbekAirports = new Set(['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG', 'URG']);

    const dmyToIso = (s) => {
      const m = s && s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    };

    // Month abbrev → zero-padded number
    const MON = { JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12' };

    // PASS 1: parse groups to get totalPax and dates
    const groups = [];
    let curGroup = null;
    const tourDateRe = /(\d{2}\.\d{2}\.\d{4})\s*[–—\-]+\s*(\d{2}\.\d{2}\.\d{4})/;
    const totalRe = /TOTAL[^0-9]+(\d+)\s*PAX/i;

    for (const line of lines) {
      if (/^Final Rooming List$/i.test(line)) { curGroup = null; continue; }
      if (/^Tour:/i.test(line)) {
        const dm = line.match(tourDateRe);
        curGroup = { name: line, startDate: dm ? dm[1] : null, endDate: dm ? dm[2] : null, totalPax: 0 };
        groups.push(curGroup);
        continue;
      }
      if (curGroup) {
        const tm = line.match(totalRe);
        if (tm) { curGroup.totalPax = parseInt(tm[1], 10); continue; }
      }
    }

    const totalPax = groups.reduce((s, g) => s + (g.totalPax || 0), 0);
    if (totalPax === 0) return [];

    // Year from first tour group's start date (for DDMMM → YYYY-MM-DD conversion)
    const tourYear = (groups.length > 0 && groups[0].startDate)
      ? groups[0].startDate.slice(-4)
      : String(new Date().getFullYear());

    // Convert GDS date "29MAR" or "29MAR26" to ISO "YYYY-MM-DD"
    const gdsDateToIso = (s) => {
      const m = s && s.match(/^(\d{2})([A-Z]{3})(\d{2})?$/i);
      if (!m) return null;
      const mm = MON[m[2].toUpperCase()];
      if (!mm) return null;
      const yyyy = m[3] ? `20${m[3]}` : tourYear;
      return `${yyyy}-${mm}-${m[1]}`;
    };

    // PASS 2: parse PNR blocks using PASSENGER COUNT (NM: N), not HK/TK status codes.
    // This way we're independent of whatever status code the GDS uses.
    //
    // Block triggers:
    //   "RP/..."          → standard GDS block (NM: N found in header)
    //   "XXXXXX Name..."  → 6-char PNR + passenger name on same line (ISO-format block, 1 pax)
    //
    // Flight line formats:
    //   GDS:  "6  LO 191 G 29MAR 7 WAWTAS HK4   2300 0800"  (DDMMM date, HHMM times)
    //   ISO:  "LO 191 G 2026-03-29 WAWTAS TK 23:00 08:00"   (YYYY-MM-DD, HH:MM times)

    // GDS: don't care about status code — use \S+ to skip it
    const gdsFlightRe = /^\d+\s+([A-Z]{2})\s+(\d+)\s+[A-Z]\s+(\d{2}[A-Z]{3}(?:\d{2})?)\s+\d\s+([A-Z]{3})([A-Z]{3})\s+\S+\s+(?:\d\s+)*(\d{4})\s+(\d{4})/i;
    // ISO: any status (HK, TK, HL...) — use \S+ to skip it
    // NOTE: no ^ anchor — multiple flights can appear on one line, use matchAll
    const isoFlightRe = /([A-Z]{2})\s+(\d+)\s+[A-Z]\s+(\d{4}-\d{2}-\d{2})\s+([A-Z]{3})([A-Z]{3})\s+\S+\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})/gi;

    const flightPaxMap  = new Map();
    const flightInfoMap = new Map();

    let inPnrBlock  = false;
    let blockPax    = 0;   // passengers in the current PNR block (from NM: N or counted names)
    let blockFlights = []; // Uzbekistan-relevant flights found in current block
    let nmFound     = false; // true once NM: header found — don't count names separately
    let blockPnr    = '';   // current PNR code
    let blockNames  = [];   // passenger names collected in current block
    const knownPnrCodes = []; // 6-char PNR codes found in text (for Vision to skip)
    const flightPaxDetailsMap = new Map(); // key → [name strings]

    const flushBlock = () => {
      if (blockFlights.length > 0) {
        // If we couldn't determine PAX count, use 1 as fallback (don't lose flight info)
        const pax = blockPax > 0 ? blockPax : 1;
        for (const { key, info } of blockFlights) {
          flightPaxMap.set(key, (flightPaxMap.get(key) || 0) + pax);
          if (!flightInfoMap.has(key)) flightInfoMap.set(key, info);
          // Accumulate paxDetails as flat name strings
          const existing = flightPaxDetailsMap.get(key) || [];
          for (const name of blockNames) {
            if (!existing.includes(name)) existing.push(name);
          }
          flightPaxDetailsMap.set(key, existing);
        }
      }
      blockPax = 0;
      blockFlights = [];
      nmFound = false;
      blockPnr = '';
      blockNames = [];
    };

    for (const line of lines) {
      const isRpLine      = /^RP\//i.test(line);
      const isPnrCode6    = /^[A-Z0-9]{6}$/.test(line);        // "XGY97T" alone on line
      const isPnrNameLine = /^[A-Z0-9]{6}\s+\S/i.test(line);  // "XGY97T MRS GIULIA..." combined

      if (isRpLine || isPnrCode6 || isPnrNameLine) {
        flushBlock();
        inPnrBlock = true;
        // Store PNR code for Vision skip-list.
        // Filter out common room-type / header words that happen to be 6 chars.
        const ROOM_WORDS = new Set(['DOUBLE','SINGLE','TRIPLE','FAMILY','STUDIO','JUNIOR','DELUXE','SUITE ','GARDEN','PALACE','RESORT','BUDGET','LUXURY']);
        const code6 = isPnrCode6 ? line.trim() : line.trim().slice(0, 6).toUpperCase();
        if (!ROOM_WORDS.has(code6)) knownPnrCodes.push(code6);
        blockPnr = code6;
        if (isPnrNameLine) {
          blockPax = 1; // name+PNR on same line → 1 passenger
          blockNames.push(line.trim().slice(7).trim()); // name part after PNR code
        }
        continue;
      }
      if (!inPnrBlock) continue;

      // Passenger count from GDS header "NM: 4" — most reliable, use if found
      const nmM = line.match(/\bNM:\s*(\d+)/i);
      if (nmM) { blockPax = parseInt(nmM[1], 10); nmFound = true; continue; }

      // Collect passenger names — always, regardless of nmFound
      // NM: only controls PAX count (don't double-count); names are always needed for paxDetails
      {
        const isGdsName   = /^\d+\.[A-Z]+\/[A-Z]/i.test(line);
        const isSlashName = /^[A-Z]{2,}\/[A-Z]/i.test(line);
        const isTitleName = /^(MR|MRS|DR|MISS|PROF)\s+[A-Z]/i.test(line);
        if (isGdsName || isSlashName || isTitleName) {
          // Extract individual names from line (GDS puts multiple: "1.AAA/BBB MRS  2.CCC/DDD MR")
          const gdsMatches = [...line.matchAll(/\d+\.([A-Z]+\/[A-Z][A-Z\s]*(?:MR|MRS|MS|DR|MISS|PROF)?)/gi)];
          if (gdsMatches.length > 0) {
            for (const m of gdsMatches) blockNames.push(m[1].trim());
          } else {
            blockNames.push(line.trim());
          }
          // PAX count: only increment if NM: not found yet
          if (!nmFound) {
            const gdsCount = (line.match(/\d+\.[A-Z]+\/[A-Z]/gi) || []).length;
            blockPax += gdsCount > 0 ? gdsCount : 1;
          }
          continue;
        }
      }

      // Try GDS flight line
      const gm = line.match(gdsFlightRe);
      if (gm) {
        const [, airline, num, dateStr, dep, arr, depTime4, arrTime4] = gm;
        const depIsUzbek = uzbekAirports.has(dep);
        const arrIsUzbek = uzbekAirports.has(arr);
        const isIntl = (arrIsUzbek && !depIsUzbek) || (depIsUzbek && !arrIsUzbek);
        const isDom  = depIsUzbek && arrIsUzbek;
        if (isIntl || isDom) {
          const flightNumber = `${airline} ${num}`;
          const date = gdsDateToIso(dateStr);
          const key  = `${flightNumber}|${dep}|${arr}`;
          if (!blockFlights.some(f => f.key === key)) {
            blockFlights.push({ key, info: {
              flightNumber, departure: dep, arrival: arr, date,
              departureTime: `${depTime4.slice(0,2)}:${depTime4.slice(2,4)}`,
              arrivalTime:   `${arrTime4.slice(0,2)}:${arrTime4.slice(2,4)}`,
              type: isDom ? 'DOMESTIC' : 'INTERNATIONAL'
            }});
          }
        }
        continue;
      }

      // Try ISO flight line — multiple flights may appear on one line
      isoFlightRe.lastIndex = 0;
      for (const im of line.matchAll(isoFlightRe)) {
        const [, airline, num, date, dep, arr, depTime, arrTime] = im;
        const depIsUzbek = uzbekAirports.has(dep);
        const arrIsUzbek = uzbekAirports.has(arr);
        const isIntl = (arrIsUzbek && !depIsUzbek) || (depIsUzbek && !arrIsUzbek);
        const isDom  = depIsUzbek && arrIsUzbek;
        if (isIntl || isDom) {
          const flightNumber = `${airline} ${num}`;
          const key = `${flightNumber}|${dep}|${arr}`;
          if (!blockFlights.some(f => f.key === key)) {
            blockFlights.push({ key, info: {
              flightNumber, departure: dep, arrival: arr, date,
              departureTime: depTime, arrivalTime: arrTime,
              type: isDom ? 'DOMESTIC' : 'INTERNATIONAL'
            }});
          }
        }
      }
    }
    flushBlock(); // flush the last block

    const detected = [];
    for (const [key, pax] of flightPaxMap.entries()) {
      const details = flightPaxDetailsMap.get(key) || [];
      detected.push({ ...flightInfoMap.get(key), pax, paxDetails: details.length > 0 ? JSON.stringify(details) : null });
    }
    _debugLog(`✈️ Detected flights: ${JSON.stringify(detected.map(f => `${f.flightNumber} ${f.departure}→${f.arrival} PAX:${f.pax}`))}, totalPax=${totalPax}`);

    // PASS 3: if no international arrival/departure detected, add blank suggested flights
    const suggested = [];
    const hasIntlArrival  = detected.some(r => r.type === 'INTERNATIONAL' && uzbekAirports.has(r.arrival));
    const hasIntlDeparture = detected.some(r => r.type === 'INTERNATIONAL' && uzbekAirports.has(r.departure));

    if (!hasIntlArrival) {
      const startIso = groups.length > 0 ? dmyToIso(groups[0].startDate) : null;
      let arrDate = '';
      if (startIso) {
        const d = new Date(startIso); d.setDate(d.getDate() + 1);
        arrDate = d.toISOString().slice(0, 10);
      }
      suggested.push({ flightNumber: '', departure: 'IST', arrival: 'TAS', date: arrDate, departureTime: '', arrivalTime: '', pax: totalPax, type: 'INTERNATIONAL' });
    }

    if (!hasIntlDeparture) {
      const sortedByEnd = [...groups].filter(g => g.endDate).sort((a, b) => (dmyToIso(a.endDate) || '').localeCompare(dmyToIso(b.endDate) || ''));
      if (sortedByEnd.length > 0) {
        const uzGroup = sortedByEnd[0];
        suggested.push({ flightNumber: '', departure: 'TAS', arrival: 'IST', date: dmyToIso(uzGroup.endDate) || '', departureTime: '', arrivalTime: '', pax: uzGroup.totalPax, type: 'INTERNATIONAL' });
      }
    }

    return { flights: [...detected, ...suggested], totalPax, knownPnrCodes };
  }

  /**
   * Parse "Booking Overview Orient Insight.xlsx" Excel file
   * Columns: Reisename | Von | Bis | Mindestteilnehmerzahl | Maximalteilnehmerzahl | Gebuchte Pax
   * Returns rows: [{ reisename, departureDate, returnDate, pax }]
   */
  parseBookingOverviewExcel(fileBuffer) {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const rows = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Find header row containing "Reisename" and "pax"
      let headerRowIdx = -1;
      let reisIdx = -1, vonIdx = -1, bisIdx = -1, paxIdx = -1;

      for (let i = 0; i < Math.min(allRows.length, 5); i++) {
        const row = allRows[i].map(c => String(c).trim().toLowerCase());
        const ri = row.findIndex(h => h.includes('reisename') || h === 'reise');
        const vi = row.findIndex(h => h === 'von' || h.startsWith('von'));
        const bi = row.findIndex(h => h === 'bis' || h.startsWith('bis'));
        const pi = row.findIndex(h => h.includes('gebuchte pax') || (h.includes('pax') && !h.includes('mindest') && !h.includes('maximal')));
        if (ri >= 0 && pi >= 0) {
          headerRowIdx = i; reisIdx = ri; vonIdx = vi; bisIdx = bi; paxIdx = pi;
          break;
        }
      }

      if (headerRowIdx === -1) continue;

      const fmtDate = (val) => {
        if (!val && val !== 0) return '';
        if (val instanceof Date) {
          const d = val.getDate().toString().padStart(2, '0');
          const m = (val.getMonth() + 1).toString().padStart(2, '0');
          return `${d}.${m}.${val.getFullYear()}`;
        }
        // Excel serial number
        if (typeof val === 'number') {
          const d = new Date(Math.round((val - 25569) * 86400 * 1000));
          const dd = d.getUTCDate().toString().padStart(2, '0');
          const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
          return `${dd}.${mm}.${d.getUTCFullYear()}`;
        }
        return String(val).trim();
      };

      for (let i = headerRowIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

        const reisename = String(row[reisIdx] || '').trim();
        if (!reisename) continue;

        const vonStr = vonIdx >= 0 ? fmtDate(row[vonIdx]) : '';
        const bisStr = bisIdx >= 0 ? fmtDate(row[bisIdx]) : '';
        const pax = parseInt(row[paxIdx], 10);

        if (!vonStr || isNaN(pax) || pax < 0) continue;

        rows.push({ reisename, departureDate: vonStr, returnDate: bisStr, pax });
      }
    }

    return rows;
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
      return [];
    }


    // Parse data rows — skip any row that contains <th> cells (header rows)
    $(targetTable).find('tr').each((i, row) => {
      // Skip header rows (contain <th> cells)
      if ($(row).find('th').length > 0) return;

      const cells = $(row).find('td');
      if (cells.length === 0) return;

      // Guard: make sure we have enough cells
      const maxIdx = Math.max(reisIdx, vonIdx, bisIdx, paxIdx);
      if (cells.length <= maxIdx) return;

      const reisename = $(cells[reisIdx]).text().trim();
      const von = vonIdx >= 0 ? $(cells[vonIdx]).text().trim() : null;
      const bis = bisIdx >= 0 ? $(cells[bisIdx]).text().trim() : null;
      const paxText = $(cells[paxIdx]).text().trim();
      const pax = parseInt(paxText, 10);

      if (!reisename || isNaN(pax) || pax < 0) {
        return;
      }

      rows.push({ reisename, departureDate: von, returnDate: bis, pax });
    });

    return rows;
  }

  /**
   * Update booking pax fields from HTML table rows.
   * Priority: EMAIL_TABLE < EXCEL < PDF — never overrides higher-priority source.
   */
  async updateBookingsFromTableRows(rows, paxSource = 'EMAIL_TABLE') {
    let updated = 0;
    const ids = [];

    for (const row of rows) {
      try {
        const mapped = this.mapReisename(row.reisename);
        if (!mapped) {
          continue;
        }

        const { tourCode, paxField } = mapped;
        const tourType = await prisma.tourType.findFirst({ where: { code: tourCode } });
        if (!tourType) {
          continue;
        }

        // Parse departure date (DD.MM.YYYY)
        const departureDate = this.parseDateString(row.departureDate);
        if (!departureDate) {
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
          continue;
        }

        // Priority: PDF > EXCEL > BOOKING_OVERVIEW > EMAIL_TABLE
        // Never downgrade paxSource to a lower-priority value
        const PRIORITY = { 'PDF': 3, 'WORD': 3, 'EXCEL': 2, 'BOOKING_OVERVIEW': 1, 'EMAIL_TABLE': 0 };
        const currentPriority = PRIORITY[booking.paxSource] ?? 0;
        const newPriority = PRIORITY[paxSource] ?? 0;
        const effectivePaxSource = newPriority >= currentPriority ? paxSource : booking.paxSource;

        // Update paxField, then recalculate pax = paxUzbekistan + paxTurkmenistan
        const updatedBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: { [paxField]: row.pax, paxSource: effectivePaxSource },
          select: { paxUzbekistan: true, paxTurkmenistan: true }
        });
        const totalPax = (updatedBooking.paxUzbekistan || 0) + (updatedBooking.paxTurkmenistan || 0);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { pax: totalPax }
        });

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

    } catch (error) {
      console.error('❌ Failed to send notification:', error.message);
    }
  }
}

module.exports = new EmailImportProcessor();
