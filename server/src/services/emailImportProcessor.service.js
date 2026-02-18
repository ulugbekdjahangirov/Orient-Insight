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

      // Determine file type and parse accordingly
      const isExcel = this.isExcelFile(emailImport.attachmentName, emailImport.attachmentType);

      let parsedData;
      if (isExcel) {
        console.log(`📊 Parsing Excel file: ${emailImport.attachmentName}`);
        parsedData = excelParser.parseAgenturdaten(fileBuffer);
      } else {
        console.log(`🔍 Parsing screenshot with Claude AI...`);
        parsedData = await claudeVision.parseBookingScreenshot(fileBuffer);
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
    const tourTypeCode = excelParser.extractTourType(parsedBooking.reisename);
    if (!tourTypeCode) {
      console.warn(`⚠️  Cannot determine tour type from: ${parsedBooking.reisename}`);
      return null;
    }

    const tourType = await prisma.tourType.findFirst({ where: { code: tourTypeCode } });
    if (!tourType) {
      console.warn(`⚠️  Unknown tour type code: ${tourTypeCode}`);
      return null;
    }

    // Parse departure date
    const departureDate = this.parseDateString(parsedBooking.departureDate);
    const endDate = this.parseDateString(parsedBooking.returnArrivalDate);

    // Find booking by tourType + departure date (within ±3 days tolerance)
    let booking = null;
    if (departureDate) {
      const from = new Date(departureDate);
      const to = new Date(departureDate);
      from.setDate(from.getDate() - 3);
      to.setDate(to.getDate() + 3);

      booking = await prisma.booking.findFirst({
        where: {
          tourTypeId: tourType.id,
          departureDate: { gte: from, lte: to }
        },
        orderBy: { departureDate: 'asc' }
      });
    }

    let action = 'updated';
    if (!booking) {
      // Create new booking from Excel data
      const bookingNumber = `${tourTypeCode}-EXCEL-${parsedBooking.departureDate || 'unknown'}`;
      booking = await prisma.booking.create({
        data: {
          bookingNumber,
          tourTypeId: tourType.id,
          departureDate,
          arrivalDate: departureDate,
          endDate,
          status: 'PENDING',
          pax: parsedBooking.tourists?.length || 0,
          roomsDbl: 0, roomsTwn: 0, roomsSngl: 0, roomsTotal: 0
        }
      });
      action = 'created';
      console.log(`✨ Created booking from Excel: ${bookingNumber}`);
    } else {
      console.log(`🔗 Matched booking: ${booking.bookingNumber}`);
    }

    // Import tourists
    if (parsedBooking.tourists && parsedBooking.tourists.length > 0) {
      let touristsAdded = 0;
      for (const t of parsedBooking.tourists) {
        // Check if tourist already exists in this booking
        const existingTourist = await prisma.tourist.findFirst({
          where: {
            bookingId: booking.id,
            lastName: t.lastName,
            firstName: t.firstName
          }
        });

        if (existingTourist) {
          // Update existing tourist with fresh data
          await prisma.tourist.update({
            where: { id: existingTourist.id },
            data: {
              gender: t.gender || existingTourist.gender,
              dateOfBirth: t.dateOfBirth ? this.parseDateString(t.dateOfBirth) : existingTourist.dateOfBirth,
              passportNumber: t.passport || existingTourist.passportNumber,
              passportExpiryDate: t.passportExpiry ? this.parseDateString(t.passportExpiry) : existingTourist.passportExpiryDate,
              country: t.nationality || existingTourist.country,
              roomPreference: t.roomType || existingTourist.roomPreference,
              remarks: t.remarks || existingTourist.remarks
            }
          });
        } else {
          // Create new tourist
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
              accommodation: 'Not assigned',
              remarks: [t.remarks, t.voyageOption].filter(Boolean).join('; ') || null,
              notes: t.vegetarian ? 'Vegetarian' : null
            }
          });
          touristsAdded++;
        }
      }

      // Update booking PAX count
      const totalTourists = await prisma.tourist.count({ where: { bookingId: booking.id } });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { pax: totalTourists }
      });

      console.log(`👥 Imported ${touristsAdded} new tourists for booking ${booking.bookingNumber} (total: ${totalTourists})`);
    }

    return { bookingId: booking.id, action };
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
