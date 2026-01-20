const XLSX = require('xlsx');
const fs = require('fs');

// Test Excel parsing logic
const testExcelPath = process.argv[2];

if (!testExcelPath) {
  console.log('Usage: node test_excel_parse.js <path-to-excel-file>');
  console.log('Example: node test_excel_parse.js "C:\\Users\\Asus\\Downloads\\test.xlsx"');
  process.exit(1);
}

if (!fs.existsSync(testExcelPath)) {
  console.error(`File not found: ${testExcelPath}`);
  process.exit(1);
}

console.log(`\nReading Excel file: ${testExcelPath}\n`);

const buffer = fs.readFileSync(testExcelPath);
const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
const sheetName = workbook.SheetNames[0];
const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false });

console.log(`Sheet: ${sheetName}`);
console.log(`Total rows: ${rawData.length}\n`);

// Show first 10 rows
console.log('First 10 rows:');
rawData.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i + 1}:`, row);
});

// Find header row
let headerRowIndex = -1;
for (let i = 0; i < rawData.length; i++) {
  const row = rawData[i];
  if (row && row.some(cell => String(cell).toLowerCase() === 'name')) {
    headerRowIndex = i;
    break;
  }
}

if (headerRowIndex >= 0) {
  console.log(`\n✓ Header row found at index ${headerRowIndex + 1}`);
  console.log(`Headers:`, rawData[headerRowIndex]);

  // Show first 3 data rows
  console.log(`\nFirst 3 data rows:`);
  for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 4, rawData.length); i++) {
    const row = rawData[i];
    const headers = rawData[headerRowIndex];
    const tourist = {};
    headers.forEach((header, index) => {
      tourist[header] = row[index];
    });
    console.log(`\nRow ${i + 1}:`, tourist);

    // Test gender extraction
    const name = String(tourist['Name'] || '').toLowerCase();
    let gender = 'Not provided';
    if (name.includes('mr.') && !name.includes('mrs.')) {
      gender = 'M';
    } else if (name.includes('mrs.') || name.includes('ms.')) {
      gender = 'F';
    }
    console.log(`  → Gender: ${gender}`);

    // Test vegetarian
    const vegCell = String(tourist['Veg.'] || tourist['Veg'] || '').trim().toLowerCase();
    const isVeg = vegCell === 'yes' || vegCell === 'ja' || vegCell === 'x';
    console.log(`  → Vegetarian: ${isVeg} (cell value: "${vegCell}")`);

    // Test room
    const rmValue = String(tourist['Rm'] || '').trim();
    console.log(`  → Room: ${rmValue}`);
  }
} else {
  console.log('\n✗ Header row not found');
}
