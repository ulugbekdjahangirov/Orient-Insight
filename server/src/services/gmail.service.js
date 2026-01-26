const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
  }

  /**
   * Get OAuth URL for user authorization
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Handle OAuth callback and save tokens
   */
  async handleOAuthCallback(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    await this.saveTokens(tokens);
    return tokens;
  }

  /**
   * Load tokens from database
   */
  async loadTokens() {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'GMAIL_OAUTH_TOKENS' }
    });

    if (!setting) {
      throw new Error('Gmail not authenticated. Please authorize first.');
    }

    return JSON.parse(setting.value);
  }

  /**
   * Save tokens to database
   */
  async saveTokens(tokens) {
    await prisma.systemSetting.upsert({
      where: { key: 'GMAIL_OAUTH_TOKENS' },
      update: {
        value: JSON.stringify(tokens),
        encrypted: false
      },
      create: {
        key: 'GMAIL_OAUTH_TOKENS',
        value: JSON.stringify(tokens),
        encrypted: false
      }
    });
  }

  /**
   * Authenticate with Gmail API
   */
  async authenticate() {
    try {
      const tokens = await this.loadTokens();
      this.oauth2Client.setCredentials(tokens);

      // Check if token is expired
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        console.log('🔄 Refreshing expired Gmail token...');
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        await this.saveTokens(credentials);
        this.oauth2Client.setCredentials(credentials);
      }

      return true;
    } catch (error) {
      console.error('❌ Gmail authentication failed:', error.message);
      return false;
    }
  }

  /**
   * Check if Gmail is authenticated
   */
  async isAuthenticated() {
    try {
      await this.loadTokens();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch unread emails with attachments from whitelisted senders
   */
  async fetchUnreadEmails() {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Build search query
    const whitelist = await this.getWhitelist();
    const senderQuery = whitelist
      .map(email => `from:(${email})`)
      .join(' OR ');

    const query = `is:unread has:attachment (${senderQuery})`;

    console.log('📧 Gmail query:', query);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 10
    });

    return response.data.messages || [];
  }

  /**
   * Get email details including attachments
   */
  async getEmailDetails(messageId) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    return this.parseEmailMetadata(message.data);
  }

  /**
   * Parse email metadata from Gmail API response
   */
  parseEmailMetadata(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : null;
    };

    const subject = getHeader('Subject') || '(No Subject)';
    const from = getHeader('From') || 'unknown@example.com';
    const date = getHeader('Date') ? new Date(getHeader('Date')) : new Date();

    // Parse attachments
    const attachments = [];

    const extractAttachments = (part) => {
      if (part.filename && part.body && part.body.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId
        });
      }

      if (part.parts) {
        part.parts.forEach(extractAttachments);
      }
    };

    extractAttachments(message.payload);

    return {
      id: message.id,
      subject,
      from,
      date,
      attachments
    };
  }

  /**
   * Download attachment from Gmail
   */
  async downloadAttachment(messageId, attachmentId) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });

    return Buffer.from(attachment.data.data, 'base64');
  }

  /**
   * Mark email as processed (read + label)
   */
  async markAsProcessed(messageId) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    try {
      // Create "PROCESSED" label if it doesn't exist
      let processedLabel = await this.findOrCreateLabel('PROCESSED');

      // Mark as read and add label
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [processedLabel.id],
          removeLabelIds: ['UNREAD']
        }
      });

      console.log(`✅ Email ${messageId} marked as processed`);
    } catch (error) {
      console.error(`❌ Failed to mark email ${messageId} as processed:`, error.message);
    }
  }

  /**
   * Find or create a Gmail label
   */
  async findOrCreateLabel(labelName) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // List all labels
    const labels = await gmail.users.labels.list({ userId: 'me' });
    const existing = labels.data.labels.find(l => l.name === labelName);

    if (existing) {
      return existing;
    }

    // Create new label
    const newLabel = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });

    return newLabel.data;
  }

  /**
   * Get email whitelist from database
   */
  async getWhitelist() {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'GMAIL_SENDER_WHITELIST' }
    });

    if (!setting) {
      // Default whitelist
      return ['@orient-tours.de'];
    }

    return JSON.parse(setting.value);
  }
}

module.exports = new GmailService();
