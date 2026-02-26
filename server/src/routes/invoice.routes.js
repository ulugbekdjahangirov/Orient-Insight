const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/invoices - Get all invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const { bookingId, invoiceType, firma, invoiceNumber, year } = req.query;

    const where = {};
    if (bookingId) where.bookingId = parseInt(bookingId);
    if (invoiceType) where.invoiceType = invoiceType;
    if (firma) where.firma = firma;
    if (invoiceNumber) where.invoiceNumber = invoiceNumber;
    if (year) where.booking = { bookingYear: parseInt(year) };

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        booking: {
          include: {
            tourType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Ошибка получения счетов' });
  }
});

// GET /api/invoices/:id - Get invoice by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        booking: {
          include: {
            tourType: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Счет не найден' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Ошибка получения счета' });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      bookingId,
      invoiceType,
      firma,
      items,
      totalAmount,
      currency,
      notes
    } = req.body;

    if (!bookingId || !invoiceType) {
      return res.status(400).json({ error: 'bookingId и invoiceType обязательны' });
    }

    // Get the next invoice number (sequential per invoice type)
    let lastInvoice;
    if (invoiceType === 'Gutschrift') {
      // Gutschrift has its own separate numbering sequence
      lastInvoice = await prisma.invoice.findFirst({
        where: { invoiceType: 'Gutschrift' },
        orderBy: { id: 'desc' }
      });
    } else {
      // Rechnung and Neue Rechnung share the same numbering sequence
      lastInvoice = await prisma.invoice.findFirst({
        where: {
          invoiceType: { in: ['Rechnung', 'Neue Rechnung'] }
        },
        orderBy: { id: 'desc' }
      });
    }
    const invoiceNumber = lastInvoice ? (parseInt(lastInvoice.invoiceNumber) + 1).toString() : '1';

    const invoice = await prisma.invoice.create({
      data: {
        bookingId: parseInt(bookingId),
        invoiceNumber,
        invoiceType,
        firma: firma || null,
        items: items ? JSON.stringify(items) : null,
        totalAmount: totalAmount || 0,
        currency: currency || 'USD',
        notes: notes || null
      },
      include: {
        booking: {
          include: {
            tourType: true
          }
        }
      }
    });

    res.status(201).json({ invoice });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Ошибка создания счета' });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoiceType,
      firma,
      items,
      totalAmount,
      currency,
      notes
    } = req.body;

    const updateData = {};
    if (invoiceType !== undefined) updateData.invoiceType = invoiceType;
    if (firma !== undefined) updateData.firma = firma || null;
    if (items !== undefined) updateData.items = items ? JSON.stringify(items) : null;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (currency !== undefined) updateData.currency = currency;
    if (notes !== undefined) updateData.notes = notes || null;

    const invoice = await prisma.invoice.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        booking: {
          include: {
            tourType: true
          }
        }
      }
    });

    res.json({ invoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Ошибка обновления счета' });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.invoice.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Счет удален' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Ошибка удаления счета' });
  }
});

module.exports = router;
