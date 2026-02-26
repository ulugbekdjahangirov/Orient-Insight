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
   * Load tokens from database (decrypts if encrypted)
   */
  async loadTokens() {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'GMAIL_OAUTH_TOKENS' }
    });

    if (!setting) {
      throw new Error('Gmail not authenticated. Please authorize first.');
    }

    if (setting.encrypted) {
      const key = process.env.ENCRYPTION_KEY;
      if (!key) throw new Error('ENCRYPTION_KEY missing — cannot decrypt Gmail tokens');
      const crypto = require('crypto');
      const [ivHex, encrypted] = setting.value.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    }

    return JSON.parse(setting.value);
  }

  /**
   * Save tokens to database (encrypts with AES-256 if ENCRYPTION_KEY is set)
   */
  async saveTokens(tokens) {
    const key = process.env.ENCRYPTION_KEY;
    let valueToStore;
    let isEncrypted = false;

    if (key && key.length >= 32) {
      const crypto = require('crypto');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
      let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      valueToStore = iv.toString('hex') + ':' + encrypted;
      isEncrypted = true;
    } else {
      valueToStore = JSON.stringify(tokens);
    }

    await prisma.systemSetting.upsert({
      where: { key: 'GMAIL_OAUTH_TOKENS' },
      update: { value: valueToStore, encrypted: isEncrypted },
      create: { key: 'GMAIL_OAUTH_TOKENS', value: valueToStore, encrypted: isEncrypted }
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

    // No "has:attachment" filter — also pick up emails with only HTML body table
    const query = `-label:PROCESSED newer_than:7d (${senderQuery})`;


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
      attachments,
      htmlBody: this.extractHtmlBody(message.payload)
    };
  }

  /**
   * Recursively extract HTML body from email payload parts
   */
  extractHtmlBody(part) {
    if (!part) return null;
    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        const html = this.extractHtmlBody(subPart);
        if (html) return html;
      }
    }
    return null;
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
      return ['@world-insight.de'];
    }

    return JSON.parse(setting.value);
  }

  /**
   * Send email with optional PDF attachment via Gmail API
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - Email HTML body
   * @param {Array}  options.attachments - [{filename, mimeType, content (Buffer)}]
   */
  async sendEmail({ to, subject, html = '', attachments = [] }) {
    await this.authenticate();
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const boundary = `boundary_${Date.now()}`;
    const lines = [
      `From: Orient Insight <me>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(html).toString('base64'),
    ];

    for (const att of attachments) {
      // Split base64 into 76-char lines per MIME spec (RFC 2045)
      const b64 = att.content.toString('base64').match(/.{1,76}/g).join('\r\n');
      lines.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        b64
      );
    }

    lines.push(`--${boundary}--`);

    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  }
}

module.exports = new GmailService();
