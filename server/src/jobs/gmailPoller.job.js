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
  console.log('🔍 Polling Gmail for new booking emails...');

  try {
    // Authenticate with Gmail
    const isAuthenticated = await gmailService.authenticate();
    if (!isAuthenticated) {
      console.log('⚠️  Gmail not authenticated. Please authorize first.');
      return;
    }

    // Fetch unread emails with attachments
    const messages = await gmailService.fetchUnreadEmails();

    if (messages.length === 0) {
      console.log('📭 No new booking emails found.');
      return;
    }

    console.log(`📬 Found ${messages.length} new emails`);

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
    // Check if already processed
    const existing = await prisma.emailImport.findUnique({
      where: { gmailMessageId: messageId }
    });

    if (existing) {
      console.log(`⏭️  Email ${messageId} already processed`);
      return;
    }

    // Get email details
    const emailDetails = await gmailService.getEmailDetails(messageId);

    // Check sender whitelist
    const whitelist = await getEmailWhitelist();
    if (!isEmailAllowed(emailDetails.from, whitelist)) {
      console.log(`🚫 Email from ${emailDetails.from} not in whitelist`);
      await gmailService.markAsProcessed(messageId);
      return;
    }

    // Find first image or PDF attachment
    const attachment = emailDetails.attachments.find(att =>
      att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf'
    );

    if (!attachment) {
      console.log(`⚠️  No image/PDF attachment in email ${messageId}`);
      await gmailService.markAsProcessed(messageId);
      return;
    }

    // Download attachment
    const attachmentBuffer = await gmailService.downloadAttachment(messageId, attachment.attachmentId);

    // Save attachment to disk
    const uploadDir = path.join(__dirname, '../../uploads/gmail');
    await fs.mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${sanitizedFilename}`;
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, attachmentBuffer);

    console.log(`💾 Saved attachment: ${filename}`);

    // Create EmailImport record
    const emailImport = await prisma.emailImport.create({
      data: {
        gmailMessageId: messageId,
        emailSubject: emailDetails.subject,
        emailFrom: emailDetails.from,
        emailDate: emailDetails.date,
        attachmentName: attachment.filename,
        attachmentUrl: filepath,
        attachmentType: attachment.mimeType,
        status: 'PENDING'
      }
    });

    console.log(`✅ Created EmailImport record ${emailImport.id}`);

    // Process import asynchronously
    setImmediate(() => {
      emailImportProcessor.processEmailImport(emailImport.id)
        .catch(err => console.error(`Failed to process import ${emailImport.id}:`, err));
    });

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
    return ['@orient-tours.de'];
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
    console.log('⏸️  Gmail polling disabled (GMAIL_POLL_ENABLED=false)');
    return;
  }

  const interval = parseInt(process.env.GMAIL_POLL_INTERVAL || '5', 10);

  // Schedule job: every N minutes
  // Cron format: */5 * * * * = every 5 minutes
  const cronExpression = `*/${interval} * * * *`;

  cron.schedule(cronExpression, pollGmailForBookings);
  console.log(`✅ Gmail polling started (every ${interval} minutes)`);

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
