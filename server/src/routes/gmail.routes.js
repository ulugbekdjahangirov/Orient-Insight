const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const gmailService = require('../services/gmail.service');
const { pollGmailForBookings } = require('../jobs/gmailPoller.job');
const emailImportProcessor = require('../services/emailImportProcessor.service');

// ============================================
// OAuth Routes
// ============================================

/**
 * POST /api/gmail/authorize - Get OAuth URL
 */
router.post('/authorize', authenticate, requireAdmin, async (req, res) => {
  try {
    const authUrl = gmailService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('❌ Failed to generate auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail/callback - OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect('/gmail-settings?auth=error&message=No code provided');
    }

    await gmailService.handleOAuthCallback(code);
    res.redirect('/gmail-settings?auth=success');
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.redirect('/gmail-settings?auth=error&message=' + encodeURIComponent(error.message));
  }
});

/**
 * GET /api/gmail/status - Check connection status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const isConnected = await gmailService.isAuthenticated();
    res.json({ connected: isConnected });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

/**
 * POST /api/gmail/disconnect - Disconnect Gmail
 */
router.post('/disconnect', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.systemSetting.delete({
      where: { key: 'GMAIL_OAUTH_TOKENS' }
    });
    res.json({ success: true, message: 'Gmail disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Polling Routes
// ============================================

/**
 * POST /api/gmail/poll - Manually trigger polling
 */
router.post('/poll', authenticate, requireAdmin, async (req, res) => {
  try {
    // Run polling in background
    pollGmailForBookings().catch(err => {
      console.error('❌ Manual poll failed:', err);
    });

    res.json({ success: true, message: 'Polling started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Email Import Routes
// ============================================

/**
 * GET /api/gmail/imports - List all imports (paginated)
 */
router.get('/imports', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, year } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (year) {
      const y = parseInt(year);
      where.createdAt = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }

    const [imports, total] = await Promise.all([
      prisma.emailImport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.emailImport.count({ where })
    ]);

    // Enrich imports with booking numbers (e.g., "ER-01", "CO-03")
    const enrichedImports = await Promise.all(imports.map(async (imp) => {
      if (!imp.bookingIds) return { ...imp, tourTypeCodes: null };

      // Parse booking IDs (can be comma-separated)
      const bookingIds = imp.bookingIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

      if (bookingIds.length === 0) return { ...imp, tourTypeCodes: null };

      // Fetch booking numbers for these bookings
      const bookings = await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { bookingNumber: true }
      });

      // Extract booking numbers (e.g., "ER-01, CO-03")
      const tourTypeCodes = bookings.map(b => b.bookingNumber).join(', ');

      return { ...imp, tourTypeCodes };
    }));

    res.json({
      imports: enrichedImports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch imports:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail/imports/:id - Get import details
 */
router.get('/imports/:id', authenticate, async (req, res) => {
  try {
    const emailImport = await prisma.emailImport.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!emailImport) {
      return res.status(404).json({ error: 'Import not found' });
    }

    res.json(emailImport);
  } catch (error) {
    console.error('❌ Failed to fetch import:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail/imports/:id/retry - Retry failed import
 */
router.post('/imports/:id/retry', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Reset status
    await prisma.emailImport.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
        retryCount: 0
      }
    });

    // Trigger reprocessing
    emailImportProcessor.processEmailImport(id).catch(err => {
      console.error(`❌ Retry failed for import ${id}:`, err);
    });

    res.json({ success: true, message: 'Import reprocessing started' });
  } catch (error) {
    console.error('❌ Failed to retry import:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/gmail/imports/bulk - Bulk delete imports
 * IMPORTANT: This route must come BEFORE /imports/:id to avoid matching "bulk" as an ID
 */
router.delete('/imports/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    // Build where clause
    const where = status ? { status } : {};

    // Get all matching imports
    const imports = await prisma.emailImport.findMany({ where });

    if (imports.length === 0) {
      return res.json({ success: true, deletedCount: 0, message: 'No imports to delete' });
    }

    // Delete all attachment files
    const fs = require('fs').promises;
    let filesDeleted = 0;
    for (const imp of imports) {
      if (imp.attachmentUrl) {
        try {
          await fs.unlink(imp.attachmentUrl);
          filesDeleted++;
        } catch (err) {
          console.warn('⚠️  Failed to delete attachment file:', err.message);
        }
      }
    }

    // Delete all records from database
    const result = await prisma.emailImport.deleteMany({ where });

    res.json({
      success: true,
      deletedCount: result.count,
      filesDeleted,
      message: `Deleted ${result.count} import(s) and ${filesDeleted} file(s)`
    });
  } catch (error) {
    console.error('❌ Failed to bulk delete imports:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/gmail/imports/:id - Delete import
 */
router.delete('/imports/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Get import to delete file
    const emailImport = await prisma.emailImport.findUnique({
      where: { id }
    });

    if (!emailImport) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Delete file if exists
    if (emailImport.attachmentUrl) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(emailImport.attachmentUrl);
      } catch (err) {
        console.warn('⚠️  Failed to delete attachment file:', err.message);
      }
    }

    // Delete from database
    await prisma.emailImport.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to delete import:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Settings Routes
// ============================================

/**
 * GET /api/gmail/settings - Get settings
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'GMAIL_SENDER_WHITELIST' }
    });

    const whitelist = setting ? JSON.parse(setting.value) : ['@world-insight.de'];

    res.json({ whitelist });
  } catch (error) {
    console.error('❌ Failed to fetch settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail/settings - Update settings
 */
router.post('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { whitelist } = req.body;

    if (!Array.isArray(whitelist)) {
      return res.status(400).json({ error: 'Whitelist must be an array' });
    }

    await prisma.systemSetting.upsert({
      where: { key: 'GMAIL_SENDER_WHITELIST' },
      update: { value: JSON.stringify(whitelist) },
      create: {
        key: 'GMAIL_SENDER_WHITELIST',
        value: JSON.stringify(whitelist),
        encrypted: false
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to update settings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
