const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const gmailService = require('./gmail.service');
const claudeVision = require('./claudeVision.service');
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
      const imageBuffer = await fs.readFile(emailImport.attachmentUrl);

      // Parse with Claude Vision
      console.log(`🔍 Parsing screenshot with Claude AI...`);
      const parsedData = await claudeVision.parseBookingScreenshot(imageBuffer);

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
      await gmailService.markAsProcessed(emailImport.gmailMessageId);

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
   * Import bookings from parsed data
   */
  async importBookings(parsedBookings) {
    let created = 0;
    let updated = 0;
    const ids = [];

    for (const parsedBooking of parsedBookings) {
      try {
        const bookingData = claudeVision.transformToBookingData(parsedBooking);

        // Check if booking exists
        const existing = await prisma.booking.findFirst({
          where: { bookingNumber: bookingData.bookingNumber }
        });

        if (existing) {
          // Update existing booking
          await prisma.booking.update({
            where: { id: existing.id },
            data: {
              departureDate: bookingData.departureDate,
              arrivalDate: bookingData.arrivalDate,
              endDate: bookingData.endDate,
              avia: bookingData.avia
            }
          });
          updated++;
          ids.push(existing.id);
          console.log(`✏️  Updated booking: ${bookingData.bookingNumber}`);
        } else {
          // Create new booking
          const tourTypeCode = claudeVision.extractTourTypeCode(bookingData.bookingNumber);

          if (!tourTypeCode) {
            console.warn(`⚠️  Cannot extract tour type from: ${bookingData.bookingNumber}`);
            continue;
          }

          const tourType = await prisma.tourType.findFirst({
            where: { code: tourTypeCode }
          });

          if (!tourType) {
            console.warn(`⚠️  Unknown tour type: ${tourTypeCode}`);
            continue;
          }

          const newBooking = await prisma.booking.create({
            data: {
              ...bookingData,
              tourTypeId: tourType.id,
              status: 'PENDING',
              pax: 0, // Will be updated when tourists are imported
              roomsDbl: 0,
              roomsTwn: 0,
              roomsSngl: 0,
              roomsTotal: 0
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

      const html = type === 'SUCCESS' ? `
        <h2>Gmail Import Successful</h2>
        <p><strong>From:</strong> ${data.emailFrom}</p>
        <p><strong>Subject:</strong> ${data.emailSubject}</p>
        <p><strong>Bookings Created:</strong> ${data.bookingsCreated}</p>
        <p><strong>Bookings Updated:</strong> ${data.bookingsUpdated}</p>
        ${data.bookingIds && data.bookingIds.length > 0 ? `<p><strong>Booking IDs:</strong> ${data.bookingIds.join(', ')}</p>` : ''}
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-imports">View Details</a></p>
      ` : `
        <h2>Gmail Import Failed</h2>
        <p><strong>From:</strong> ${data.emailFrom}</p>
        <p><strong>Subject:</strong> ${data.emailSubject}</p>
        <p><strong>Error:</strong> ${data.errorMessage}</p>
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
