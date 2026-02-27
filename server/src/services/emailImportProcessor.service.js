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
      const isPdf = !isExcel && emailImport.attachmentName?.toLowerCase().endsWith('.pdf');

      // PDF: only process if filename contains "rooming list" — skip Laenderinfo, Erlebnisreise, etc.
      const isRoomingListPdf = isPdf && emailImport.attachmentName?.toLowerCase().includes('rooming list');
      if (isPdf && !isRoomingListPdf) {
        await prisma.emailImport.update({
          where: { id: emailImportId },
          data: {
            status: 'MANUAL_REVIEW',
            errorMessage: `PDF skipped (not a Rooming List): ${emailImport.attachmentName}`,
            retryCount: emailImport.retryCount,
            processedAt: new Date()
          }
        });
        return { created: 0, updated: 0, ids: [] };
      }

      // PDF Final Rooming List → import tourists directly
      if (isRoomingListPdf) {
        const pdfResult = await this.importRoomingListPdfForEmail(fileBuffer, emailImport);
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
          return { created: 0, updated: 1, ids: [pdfResult.bookingId] };
        }
        // PDF rooming list not recognized — mark for manual review, no Claude Vision
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

      // Extract departure date — supports "Date: DD.MM.YYYY", "DD.MM.YYYY – ...", or plain "DD.MM.YYYY"
      const dateMatch = text.match(/(?:Date:|Datum:)\s*(\d{2})\.(\d{2})\.(\d{4})/i)
        || text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–—\-]/)
        || text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!dateMatch) {
        _debugLog('📄 PDF date not found, text preview:', text.slice(0, 200).replace(/\n/g, '|'));
        return null;
      }
      const [, d, m, y] = dateMatch;
      const departureDate = new Date(`${y}-${m}-${d}`);

      // Find matching booking (±3 days tolerance)
      const from = new Date(departureDate); from.setDate(from.getDate() - 3);
      const to = new Date(departureDate); to.setDate(to.getDate() + 3);

      let booking = null;

      // Detect tour type — 1) from PDF filename, 2) from PDF text content
      _debugLog('📄 PDF text preview:', text.slice(0, 800).replace(/\n/g, '|'));
      const fname = (emailImport?.attachmentName || '').toLowerCase();
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
            orderBy: { departureDate: 'asc' }
          });
        }
      }

      // Try 2: date-only search — only if single candidate
      if (!booking) {
        const from1 = new Date(departureDate); from1.setDate(from1.getDate() - 1);
        const to1 = new Date(departureDate); to1.setDate(to1.getDate() + 1);
        const candidates = await prisma.booking.findMany({
          where: { departureDate: { gte: from1, lte: to1 } },
          orderBy: { departureDate: 'asc' }
        });
        if (candidates.length === 1) {
          booking = candidates[0];
        } else if (candidates.length > 1) {
          _debugLog(`📄 PDF: ${candidates.length} bookings on ${d}.${m}.${y}, tour type not detected. Candidates: ${candidates.map(b => b.bookingNumber).join(', ')}`);
          return null;
        }
      }

      if (!booking) {
        return null;
      }


      // Parse tourists directly from the already-parsed text (no second pdfParse call)
      // This avoids making an internal HTTP request (axios.post) which would cause
      // a second pdfParse + SQLite write lock contention with manual imports
      const pdfTourists = this._parseTouristsFromText(text, tourTypeCode);

      if (pdfTourists.length === 0) {
        return null;
      }

      // Get existing tourists for this booking
      const existingTourists = await prisma.tourist.findMany({
        where: { bookingId: booking.id }
      });

      const matchedIds = new Set();
      const toUpdate = [];
      const toCreate = [];

      for (const pdfT of pdfTourists) {
        // Normalize name for matching (strip Mr./Mrs./Ms. prefix)
        const pdfName = (pdfT.fullName || '').toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s*/i, '').trim();
        const existing = existingTourists.find(t => {
          const name = (t.fullName || '').toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s*/i, '').trim();
          return name === pdfName;
        });

        if (existing) {
          matchedIds.add(existing.id);
          toUpdate.push({
            id: existing.id,
            data: {
              roomPreference: pdfT.roomPreference,
              accommodation: pdfT.accommodation,
              roomNumber: pdfT.roomNumber || null
            }
          });
        } else {
          toCreate.push({
            bookingId: booking.id,
            fullName: pdfT.fullName || '',
            firstName: '',
            lastName: '',
            gender: 'unknown',
            roomPreference: pdfT.roomPreference,
            accommodation: pdfT.accommodation,
            roomNumber: pdfT.roomNumber || null
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

      // Mark paxSource as PDF
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paxSource: 'PDF' }
      });

      const summary = { updated: toUpdate.length, created: toCreate.length, deleted: toDeleteIds.length };

      // Auto-import flights: add international (IST↔TAS) if not present, domestic if not present
      try {
        const flightData = this._parseFlightsFromText(text);
        if (flightData.length > 0) {
          const existingIntl = await prisma.flight.count({ where: { bookingId: booking.id, type: 'INTERNATIONAL' } });
          const existingDom  = await prisma.flight.count({ where: { bookingId: booking.id, type: 'DOMESTIC' } });

          const toSave = flightData.filter(f => {
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
            _debugLog(`✈️ ${toSave.length} flights auto-saved for booking ${booking.id}`);
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
   * Parse tourists from already-parsed PDF text.
   * Extracts name, room type, room number, and tour type (UZ/TM section).
   */
  _parseTouristsFromText(text, tourTypeCode) {
    const tourists = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    let currentRoomType = null;
    let currentAccommodation = 'Uzbekistan';
    let roomCounters = { DBL: 0, TWN: 0, SNGL: 0 };
    let roomPersonCount = 0;
    let currentRoomNumber = null;

    for (const line of lines) {
      const lower = line.toLowerCase();

      // Detect section (Uzbekistan / Turkmenistan)
      if (lower.includes('tour:')) {
        if ((lower.includes('turkmenistan') || lower.includes('turkmen')) && tourTypeCode === 'ER') {
          currentAccommodation = 'Turkmenistan';
        } else {
          currentAccommodation = 'Uzbekistan';
        }
        roomPersonCount = 0;
        continue;
      }

      // Room type headers
      if (line === 'DOUBLE' || lower === 'double') {
        currentRoomType = 'DBL'; roomPersonCount = 0; continue;
      }
      if (line === 'TWIN' || lower === 'twin') {
        currentRoomType = 'TWN'; roomPersonCount = 0; continue;
      }
      if (line === 'SINGLE' || lower === 'single') {
        currentRoomType = 'SNGL'; roomPersonCount = 0; continue;
      }

      // Skip section separators and totals
      if (!currentRoomType) continue;
      if (/^(TOTAL|Additional|Flights|Remark|Date|Tour|\/\/|\*|___)/i.test(line)) continue;
      if (/^\d+\s+PAX/i.test(line)) continue;

      // Tourist name lines: must start with Mr./Mrs./Ms.
      if (/^(Mr\.|Mrs\.|Ms\.)/i.test(line)) {
        roomPersonCount++;

        // Assign room number
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
          fullName: line.trim(),
          roomPreference: currentRoomType,
          accommodation: currentAccommodation,
          roomNumber: currentRoomNumber
        });
      }
    }

    return tourists;
  }

  /**
   * Parse flights from Final Rooming List PDF text (GDS format).
   * Returns array of flight objects ready for prisma.flight.createMany().
   *
   * GDS line format (Sabre/Amadeus):
   *   "6  LO 191 G 29MAR 7 WAWTAS HK4          2300 0800+1 *1A/E*"
   *   "5  LO 380 G 29MAR 7 FRAWAW HK4       1  2000 2145   *1A/E*"
   */
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
    const isoFlightRe = /^([A-Z]{2})\s+(\d+)\s+[A-Z]\s+(\d{4}-\d{2}-\d{2})\s+([A-Z]{3})([A-Z]{3})\s+\S+\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})/i;

    const flightPaxMap  = new Map();
    const flightInfoMap = new Map();

    let inPnrBlock  = false;
    let blockPax    = 0;   // passengers in the current PNR block (from NM: N)
    let blockFlights = []; // Uzbekistan-relevant flights found in current block

    const flushBlock = () => {
      if (blockFlights.length > 0) {
        // If we couldn't determine PAX count, use 1 as fallback (don't lose flight info)
        const pax = blockPax > 0 ? blockPax : 1;
        for (const { key, info } of blockFlights) {
          flightPaxMap.set(key, (flightPaxMap.get(key) || 0) + pax);
          if (!flightInfoMap.has(key)) flightInfoMap.set(key, info);
        }
      }
      blockPax = 0;
      blockFlights = [];
    };

    for (const line of lines) {
      const isRpLine      = /^RP\//i.test(line);
      const isPnrCode6    = /^[A-Z0-9]{6}$/.test(line);        // "XGY97T" alone on line
      const isPnrNameLine = /^[A-Z0-9]{6}\s+\S/i.test(line);  // "XGY97T MRS GIULIA..." combined

      if (isRpLine || isPnrCode6 || isPnrNameLine) {
        flushBlock();
        inPnrBlock = true;
        if (isPnrNameLine) blockPax = 1; // name+PNR on same line → 1 passenger
        continue;
      }
      if (!inPnrBlock) continue;

      // Passenger count from GDS header "NM: 4" — most reliable, use if found
      const nmM = line.match(/\bNM:\s*(\d+)/i);
      if (nmM) { blockPax = parseInt(nmM[1], 10); continue; }

      // Count passenger name lines (only when NM: not yet found, i.e. blockPax still 0)
      if (blockPax === 0) {
        // Format 1 — GDS numbered:   "1.DRIEFHOLT/DOROTHEE MRS"  or "1.SCHMITT/HANS MR"
        // Format 2 — GDS unnumbered: "SCHMITT/HANS MR"
        // Format 3 — ISO title-first: "MRS GIULIA MARIA CZERWENKA"
        const isGdsName   = /^\d+\.[A-Z]+\/[A-Z]/i.test(line);
        const isSlashName = /^[A-Z]{2,}\/[A-Z]/i.test(line);
        const isTitleName = /^(MR|MRS|DR|MISS|PROF)\s+[A-Z]/i.test(line);
        if (isGdsName || isSlashName || isTitleName) {
          // Count how many names are on this line (GDS often puts multiple: "1.AAA MRS  2.BBB MR")
          const gdsCount = (line.match(/\d+\.[A-Z]+\/[A-Z]/gi) || []).length;
          blockPax += gdsCount > 0 ? gdsCount : 1;
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
          const key  = `${flightNumber}|${dep}|${arr}|${date}`;
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

      // Try ISO flight line
      const im = line.match(isoFlightRe);
      if (im) {
        const [, airline, num, date, dep, arr, depTime, arrTime] = im;
        const depIsUzbek = uzbekAirports.has(dep);
        const arrIsUzbek = uzbekAirports.has(arr);
        const isIntl = (arrIsUzbek && !depIsUzbek) || (depIsUzbek && !arrIsUzbek);
        const isDom  = depIsUzbek && arrIsUzbek;
        if (isIntl || isDom) {
          const flightNumber = `${airline} ${num}`;
          const key = `${flightNumber}|${dep}|${arr}|${date}`;
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
      detected.push({ ...flightInfoMap.get(key), pax });
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

    return [...detected, ...suggested];
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
  async updateBookingsFromTableRows(rows) {
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

        // Always update — last import wins.
        // Same-email case: EMAIL_TABLE runs sync first, EXCEL runs via setImmediate after → EXCEL naturally overrides.

        // Update paxField, then recalculate pax = paxUzbekistan + paxTurkmenistan
        const updatedBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: { [paxField]: row.pax, paxSource: 'EMAIL_TABLE' },
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
