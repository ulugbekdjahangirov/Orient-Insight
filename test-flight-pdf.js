const pdfParse = require('./node_modules/pdf-parse');
const fs = require('fs');

async function test() {
  const buf = fs.readFileSync('/tmp/test_rooming.pdf');
  const data = await pdfParse(buf);
  const text = data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  const uzbekAirports = new Set(['TAS', 'SKD', 'UGC', 'BHK', 'NCU', 'NVI', 'KSQ', 'TMJ', 'FEG', 'URG']);
  const pnrPattern = /^[A-Z0-9]{6}$/;
  const indivFlightPattern = /^([A-Z]{2})\s+(\d{2,4})\s+[A-Z]\s+(\d{4}-\d{2}-\d{2})\s+([A-Z]{3})([A-Z]{3})\s+[A-Z]{2}\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})/;

  const flightPaxMap = new Map();
  const flightInfoMap = new Map();
  let inPnrBlock = false;

  for (const line of lines) {
    if (pnrPattern.test(line)) { inPnrBlock = true; continue; }
    if (!inPnrBlock) continue;
    if (/^(DOUBLE|TWIN|SINGLE|Tour:|Date:|TOTAL|Final Rooming)/i.test(line)) { inPnrBlock = false; continue; }

    const m = line.match(indivFlightPattern);
    if (m) {
      const [, airline, num, date, dep, arr, depTime, arrTime] = m;
      const flightNumber = `${airline} ${num}`;
      const isIstTas = (dep === 'IST' && arr === 'TAS') || (dep === 'TAS' && arr === 'IST');
      const isDomestic = uzbekAirports.has(dep) && uzbekAirports.has(arr);
      if (!isIstTas && !isDomestic) continue;
      const key = `${flightNumber}|${dep}|${arr}|${date}`;
      flightPaxMap.set(key, (flightPaxMap.get(key) || 0) + 1);
      if (!flightInfoMap.has(key)) {
        flightInfoMap.set(key, { flightNumber, departure: dep, arrival: arr, date, departureTime: depTime, arrivalTime: arrTime, type: isIstTas ? 'INTERNATIONAL' : 'DOMESTIC' });
      }
    }
  }

  if (flightPaxMap.size === 0) {
    console.log('No flights found. Showing raw PDF lines near PNR blocks:');
    let show = false;
    for (const line of lines) {
      if (pnrPattern.test(line)) { show = true; console.log('PNR:', line); continue; }
      if (show) console.log('  ', line);
      if (show && /^(DOUBLE|TWIN|SINGLE|Tour:|Date:|TOTAL|Final)/i.test(line)) show = false;
    }
    return;
  }

  const result = [];
  for (const [key, pax] of flightPaxMap) {
    const info = flightInfoMap.get(key);
    result.push({ ...info, pax });
  }
  result.sort((a, b) => a.type === b.type ? a.date.localeCompare(b.date) : a.type === 'INTERNATIONAL' ? -1 : 1);

  console.log('\nDetected flights:');
  result.forEach(f => console.log(`  ${f.type.padEnd(14)} ${f.flightNumber.padEnd(8)} ${f.departure}→${f.arrival}  ${f.date}  ${f.departureTime}-${f.arrivalTime}  PAX: ${f.pax}`));
}

test().catch(console.error);
