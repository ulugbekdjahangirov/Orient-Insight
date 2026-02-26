const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const gmailService = require('../services/gmail.service');
const emailImportProcessor = require('../services/emailImportProcessor.service');
const fs = require('fs').promises;
const path = require('path');

/**
 * Poll Gmail for new booking emails
 */
async function pollGmailForBookings() {

  try {
    // Authenticate with Gmail
    const isAuthenticated = await gmailService.authenticate();
    if (!isAuthenticated) {
      return;
    }

    // Fetch unread emails with attachments
    const messages = await gmailService.fetchUnreadEmails();

    if (messages.length === 0) {
      return;
    }


    // Gmail returns newest-first — reverse so oldest is processed first,
    // newest is processed last → newest email's data always wins (last import wins)
    messages.reverse();

    for (const message of messages) {
      await processNewEmail(message.id);
    }

  } catch (error) {
    console.error('❌ Gmail polling error:', error.message);
  }
}

/**
 * Process a single new email
 */
async function processNewEmail(messageId) {
  try {
    // Check if already processed (check both exact messageId and composite key format)
    const existing = await prisma.emailImport.findFirst({
      where: {
        OR: [
          { gmailMessageId: messageId },
          { gmailMessageId: { startsWith: messageId + '::' } }
        ]
      }
    });

    if (existing) {
      return;
    }

    // Get email details
    const emailDetails = await gmailService.getEmailDetails(messageId);

    // Check sender whitelist
    const whitelist = await getEmailWhitelist();
    if (!isEmailAllowed(emailDetails.from, whitelist)) {
      await gmailService.markAsProcessed(messageId);
      return;
    }

    const uploadDir = path.join(__dirname, '../../uploads/gmail');
    await fs.mkdir(uploadDir, { recursive: true });

    // --- Check email body for HTML PAX table (Reisename / Gebuchte Pax) ---
    let bodyTableProcessed = false;
    try {
      const html = emailDetails.htmlBody;
      if (html && html.includes('Reisename') && html.includes('Pax')) {
        const bodyUniqueKey = `${messageId}::BODY_TABLE`;
        const existingBody = await prisma.emailImport.findFirst({
          where: { gmailMessageId: bodyUniqueKey }
        });
        if (!existingBody) {
          const htmlFilepath = path.join(uploadDir, `${Date.now()}-EMAIL_BODY.html`);
          await fs.writeFile(htmlFilepath, html, 'utf-8');

          const bodyImport = await prisma.emailImport.create({
            data: {
              gmailMessageId: bodyUniqueKey,
              emailSubject: emailDetails.subject,
              emailFrom: emailDetails.from,
              emailDate: emailDetails.date,
              attachmentName: 'EMAIL_BODY_TABLE',
              attachmentUrl: htmlFilepath,
              attachmentType: 'text/html',
              status: 'PENDING'
            }
          });

          // Process SYNCHRONOUSLY first so Excel attachment (if any) overrides after
          await emailImportProcessor.processEmailImport(bodyImport.id);
          bodyTableProcessed = true;
        } else {
          bodyTableProcessed = true;
        }
      }
    } catch (bodyErr) {
    }

    // --- Attachments ---
    const isExcelAttachment = (att) => {
      return att.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        || att.mimeType === 'application/vnd.ms-excel'
        || (att.filename && att.filename.toLowerCase().endsWith('.xlsx'))
        || (att.filename && att.filename.toLowerCase().endsWith('.xls'));
    };

    const isPdfAttachment = (att) => {
      return att.mimeType === 'application/pdf'
        || (att.filename && att.filename.toLowerCase().endsWith('.pdf'));
    };

    const excelAttachments = emailDetails.attachments.filter(isExcelAttachment);
    const pdfAttachments   = emailDetails.attachments.filter(isPdfAttachment);
    // Inline images (logos, signatures) are intentionally skipped
    const attachmentsToProcess = [...excelAttachments, ...pdfAttachments];

    if (attachmentsToProcess.length === 0 && !bodyTableProcessed) {
      await gmailService.markAsProcessed(messageId);
      return;
    }


    // Process each attachment
    for (const attachment of attachmentsToProcess) {
      const attachmentType = isExcelAttachment(attachment) ? 'excel' : 'image';

      // Download attachment
      const attachmentBuffer = await gmailService.downloadAttachment(messageId, attachment.attachmentId);

      // Save attachment to disk (unique per attachment)
      const timestamp = Date.now();
      const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}-${sanitizedFilename}`;
      const filepath = path.join(uploadDir, filename);
      await fs.writeFile(filepath, attachmentBuffer);


      // Create EmailImport record for this attachment
      // Use messageId+filename as unique key to avoid duplicate processing per attachment
      const uniqueKey = `${messageId}::${attachment.filename}`;
      const existingAtt = await prisma.emailImport.findFirst({
        where: { gmailMessageId: uniqueKey }
      });
      if (existingAtt) {
        continue;
      }

      const emailImport = await prisma.emailImport.create({
        data: {
          gmailMessageId: uniqueKey,
          emailSubject: emailDetails.subject,
          emailFrom: emailDetails.from,
          emailDate: emailDetails.date,
          attachmentName: attachment.filename,
          attachmentUrl: filepath,
          attachmentType: attachment.mimeType,
          status: 'PENDING'
        }
      });


      // Process import asynchronously
      setImmediate(() => {
        emailImportProcessor.processEmailImport(emailImport.id)
          .catch(err => console.error(`Failed to process import ${emailImport.id}:`, err));
      });
    }

    // Mark email as processed (add PROCESSED label, remove UNREAD)
    await gmailService.markAsProcessed(messageId);

  } catch (error) {
    console.error(`❌ Error processing email ${messageId}:`, error.message);
  }
}

/**
 * Get email whitelist from database
 */
async function getEmailWhitelist() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'GMAIL_SENDER_WHITELIST' }
  });

  if (!setting) {
    // Default whitelist
    return ['@world-insight.de'];
  }

  return JSON.parse(setting.value);
}

/**
 * Check if email is allowed by whitelist
 */
function isEmailAllowed(email, whitelist) {
  // Extract email address from "Name <email@example.com>" format
  const emailMatch = email.match(/<(.+?)>/);
  const cleanEmail = emailMatch ? emailMatch[1] : email;

  // Check exact email match
  if (whitelist.includes(cleanEmail)) {
    return true;
  }

  // Check domain match (e.g., @orient-tours.de)
  const domain = cleanEmail.split('@')[1];
  return whitelist.some(allowed => {
    if (allowed.startsWith('@')) {
      return domain === allowed.substring(1);
    }
    return false;
  });
}

/**
 * Start Gmail polling cron job
 */
function startGmailPolling() {
  // Check if polling is enabled
  const enabled = process.env.GMAIL_POLL_ENABLED !== 'false';

  if (!enabled) {
    return;
  }

  const interval = parseInt(process.env.GMAIL_POLL_INTERVAL || '5', 10);

  // Schedule job: every N minutes
  // Cron format: */5 * * * * = every 5 minutes
  const cronExpression = `*/${interval} * * * *`;

  cron.schedule(cronExpression, pollGmailForBookings);

  // Run immediately on startup
  setTimeout(() => {
    pollGmailForBookings().catch(err => {
      console.error('❌ Initial Gmail poll failed:', err.message);
    });
  }, 5000); // Wait 5 seconds after startup
}

module.exports = {
  startGmailPolling,
  pollGmailForBookings
};
