const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `import-${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Разрешены только Excel файлы (.xlsx, .xls)'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Парсинг даты в формате DD.MM.YYYY
function parseDate(dateValue) {
  if (!dateValue) return null;

  // Если это уже Date объект или число (Excel serial date)
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return date;
  }

  // Если строка в формате DD.MM.YYYY
  if (typeof dateValue === 'string') {
    const parts = dateValue.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  return null;
}

// Нормализация имени гида
function normalizeGuideName(name) {
  if (!name) return null;
  return name.toString().trim();
}

// POST /api/import/preview - Предпросмотр данных из Excel
router.post('/preview', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheets = {};

    workbook.SheetNames.forEach(sheetName => {
      // Пропускаем листы с именами гидов и служебные
      const skipSheets = ['Avaz aka', 'Zokir', 'Siroj', 'Ulugbek', 'Unbekannt', 'Reiseleiter', 'Rechn'];
      if (skipSheets.some(s => sheetName.includes(s))) return;

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (data.length > 1) {
        const headers = data[0];
        const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));

        sheets[sheetName] = {
          headers,
          rowCount: rows.length,
          sampleRows: rows.slice(0, 5)
        };
      }
    });

    res.json({
      fileName: req.file.originalname,
      filePath: req.file.path,
      sheets
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Ошибка чтения файла: ' + error.message });
  }
});

// POST /api/import/execute - Импорт данных из Excel
router.post('/execute', authenticate, requireAdmin, async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Файл не найден' });
    }

    const workbook = XLSX.readFile(filePath);
    const results = {
      tourTypes: { created: 0, existing: 0 },
      guides: { created: 0, existing: 0 },
      bookings: { created: 0, updated: 0, errors: [] }
    };

    // Листы туров для импорта
    const tourSheets = ['ER', 'CO', 'KAS', 'ZA'];
    const tourTypeColors = {
      'ER': '#3B82F6', // Blue
      'CO': '#10B981', // Green
      'KAS': '#F59E0B', // Amber
      'ZA': '#8B5CF6'  // Purple
    };

    // Создаём типы туров
    for (const code of tourSheets) {
      if (workbook.SheetNames.includes(code)) {
        const existing = await prisma.tourType.findUnique({ where: { code } });
        if (!existing) {
          await prisma.tourType.create({
            data: {
              code,
              name: `Тур ${code}`,
              color: tourTypeColors[code] || '#6B7280'
            }
          });
          results.tourTypes.created++;
        } else {
          results.tourTypes.existing++;
        }
      }
    }

    // Собираем всех гидов
    const guideNames = new Set();
    tourSheets.forEach(sheetName => {
      if (!workbook.SheetNames.includes(sheetName)) return;
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const headers = data[0];

      // Ищем колонку Reiseleiter
      const guideColIndex = headers.findIndex(h =>
        h && h.toString().toLowerCase().includes('reiseleiter')
      );

      if (guideColIndex !== -1) {
        data.slice(1).forEach(row => {
          const guideName = normalizeGuideName(row[guideColIndex]);
          if (guideName && guideName.toLowerCase() !== 'total') {
            guideNames.add(guideName);
          }
        });
      }
    });

    // Создаём гидов
    for (const name of guideNames) {
      const existing = await prisma.guide.findUnique({ where: { name } });
      if (!existing) {
        await prisma.guide.create({ data: { name } });
        results.guides.created++;
      } else {
        results.guides.existing++;
      }
    }

    // Получаем ID гидов и типов туров
    const guides = await prisma.guide.findMany();
    const guideMap = new Map(guides.map(g => [g.name, g.id]));

    const tourTypes = await prisma.tourType.findMany();
    const tourTypeMap = new Map(tourTypes.map(t => [t.code, t.id]));

    // Импортируем бронирования из каждого листа
    for (const sheetName of tourSheets) {
      if (!workbook.SheetNames.includes(sheetName)) continue;

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const headers = data[0].map(h => h ? h.toString().trim() : '');

      // Определяем индексы колонок
      const colIndexes = {
        bookingNumber: headers.findIndex(h => h.toLowerCase().includes('name der reise') || h.toLowerCase().includes('reise')),
        departure: headers.findIndex(h => h.toLowerCase().includes('depature') || h.toLowerCase().includes('ankunft')),
        arrival: headers.findIndex(h => h.toLowerCase() === 'ankunft'),
        end: headers.findIndex(h => h.toLowerCase().includes('abflug')),
        pax: headers.findIndex(h => h.toLowerCase() === 'pax'),
        uzbekistan: headers.findIndex(h => h.toLowerCase().includes('usbekista')),
        turkmenistan: headers.findIndex(h => h.toLowerCase().includes('turkmenis')),
        guide: headers.findIndex(h => h.toLowerCase().includes('reiseleiter')),
        trainTickets: headers.findIndex(h => h.toLowerCase().includes('жд') || h.toLowerCase().includes('билет')),
        avia: headers.findIndex(h => h.toLowerCase() === 'avia'),
        dbl: headers.findIndex(h => h.toLowerCase() === 'dbl'),
        twn: headers.findIndex(h => h.toLowerCase() === 'twn'),
        sngl: headers.findIndex(h => h.toLowerCase() === 'sngl'),
        total: headers.findIndex(h => h.toLowerCase() === 'total'),
        // ZA специфичные колонки
        olot: headers.findIndex(h => h.toLowerCase() === 'olot'),
        jartepa: headers.findIndex(h => h.toLowerCase() === 'jartepa'),
        oybek: headers.findIndex(h => h.toLowerCase() === 'oybek'),
        chernyaevka: headers.findIndex(h => h.toLowerCase() === 'chernyaevka')
      };

      // Обрабатываем строки
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const bookingNumber = row[colIndexes.bookingNumber]?.toString().trim();

        // Пропускаем пустые строки и строку Total
        if (!bookingNumber || bookingNumber.toLowerCase() === 'total') continue;

        try {
          const departureDate = parseDate(row[colIndexes.departure]);
          if (!departureDate) {
            results.bookings.errors.push(`${bookingNumber}: неверная дата`);
            continue;
          }

          const guideName = normalizeGuideName(row[colIndexes.guide]);
          const guideId = guideName ? guideMap.get(guideName) : null;

          const bookingData = {
            bookingNumber,
            tourTypeId: tourTypeMap.get(sheetName),
            departureDate,
            arrivalDate: parseDate(row[colIndexes.arrival]) || departureDate,
            endDate: parseDate(row[colIndexes.end]) || departureDate,
            pax: parseInt(row[colIndexes.pax]) || 0,
            paxUzbekistan: colIndexes.uzbekistan !== -1 ? parseInt(row[colIndexes.uzbekistan]) || null : null,
            paxTurkmenistan: colIndexes.turkmenistan !== -1 ? parseInt(row[colIndexes.turkmenistan]) || null : null,
            guideId,
            trainTickets: colIndexes.trainTickets !== -1 ? row[colIndexes.trainTickets]?.toString() || null : null,
            avia: colIndexes.avia !== -1 ? row[colIndexes.avia]?.toString() || null : null,
            roomsDbl: parseInt(row[colIndexes.dbl]) || 0,
            roomsTwn: parseInt(row[colIndexes.twn]) || 0,
            roomsSngl: parseInt(row[colIndexes.sngl]) || 0,
            roomsTotal: parseInt(row[colIndexes.total]) || 0,
            dateOlot: colIndexes.olot !== -1 ? parseDate(row[colIndexes.olot]) : null,
            dateJartepa: colIndexes.jartepa !== -1 ? parseDate(row[colIndexes.jartepa]) : null,
            dateOybek: colIndexes.oybek !== -1 ? parseDate(row[colIndexes.oybek]) : null,
            dateChernyaevka: colIndexes.chernyaevka !== -1 ? parseDate(row[colIndexes.chernyaevka]) : null,
            status: 'CONFIRMED'
          };

          // Upsert бронирования
          const existing = await prisma.booking.findUnique({
            where: { bookingNumber }
          });

          if (existing) {
            await prisma.booking.update({
              where: { bookingNumber },
              data: bookingData
            });
            results.bookings.updated++;
          } else {
            await prisma.booking.create({ data: bookingData });
            results.bookings.created++;
          }
        } catch (error) {
          results.bookings.errors.push(`${bookingNumber}: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: 'Импорт завершён',
      results
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Ошибка импорта: ' + error.message });
  }
});

// GET /api/import/template - Скачать шаблон Excel
router.get('/template', authenticate, (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const workbook = XLSX.utils.book_new();

  const templateData = [
    ['N', 'Name der Reise', 'Depature', 'Ankunft', 'Abflug', 'Pax', 'Usbekistan', 'Turkmenistan', 'Reiseleiter', 'ЖД Билеты', 'dbl', 'twn', 'sngl', 'total'],
    [1, 'ER-01', `01.03.${year}`, `02.03.${year}`, `10.03.${year}`, 10, 5, 5, 'Zokir', '', 3, 2, 0, 5]
  ];

  const sheet = XLSX.utils.aoa_to_sheet(templateData);
  XLSX.utils.book_append_sheet(workbook, sheet, 'ER');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=booking-template.xlsx');
  res.send(buffer);
});

module.exports = router;
