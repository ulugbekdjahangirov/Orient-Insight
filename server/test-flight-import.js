const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function createTestPdf() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Test PDF with multiple flight formats
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 40px; }
        h1 { text-align: center; font-size: 18px; }
        .section { margin: 20px 0; }
        .flights { margin: 20px 0; border: 1px solid #ccc; padding: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Final Rooming List</h1>
      <p>Tour: Uzbekistan</p>
      <p>Date: 15.02.2025 – 25.02.2025</p>

      <div class="section">
        <h3>DOUBLE</h3>
        <p>Mr. Schmidt, Hans</p>
        <p>Mrs. Schmidt, Anna</p>
        <p>Mr. Mueller, Peter</p>
        <p>Mrs. Mueller, Maria</p>
      </div>

      <div class="section">
        <h3>TWIN</h3>
        <p>Mr. Weber, Thomas</p>
        <p>Mrs. Weber, Petra</p>
      </div>

      <div class="section">
        <h3>SINGLE</h3>
        <p>Ms. Fischer, Lisa</p>
      </div>

      <div class="flights">
        <h3>Flight Information</h3>
        <table>
          <tr>
            <th>Flight</th>
            <th>Date</th>
            <th>Route</th>
            <th>Times</th>
          </tr>
          <tr>
            <td>TK 1884</td>
            <td>15FEB</td>
            <td>IST - TAS</td>
            <td>23:55 - 06:15</td>
          </tr>
          <tr>
            <td>TK 1883</td>
            <td>25FEB</td>
            <td>TAS - IST</td>
            <td>07:30 - 10:45</td>
          </tr>
          <tr>
            <td>HY 51</td>
            <td>18FEB</td>
            <td>TAS - SKD</td>
            <td>08:00 - 09:05</td>
          </tr>
          <tr>
            <td>HY 52</td>
            <td>20FEB</td>
            <td>BHK - TAS</td>
            <td>18:30 - 19:40</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <p>Additional Information:</p>
        <p>Remark: VIP Group - Special attention needed</p>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  const pdfPath = path.join(__dirname, 'test-rooming-list.pdf');
  await page.pdf({ path: pdfPath, format: 'A4' });
  await browser.close();

  console.log(`Test PDF created: ${pdfPath}`);
  return pdfPath;
}

createTestPdf().catch(console.error);
