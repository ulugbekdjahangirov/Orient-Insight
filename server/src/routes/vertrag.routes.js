const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');

const VERTRAG_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10pt;
      color: #000;
    }
    .page {
      display: flex;
      gap: 0;
      width: 100%;
      min-height: 100%;
    }
    .col {
      flex: 1;
      padding: 0 6mm 0 0;
      word-wrap: break-word;
    }
    .col-right {
      flex: 1;
      padding: 0 0 0 6mm;
      border-left: 1px solid #888;
    }
    h1 {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 2mm;
    }
    .subtitle {
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 4mm;
    }
    .section {
      margin-bottom: 3mm;
    }
    .section-title {
      font-weight: bold;
    }
    .indent {
      margin-left: 5mm;
    }
    .banking-title {
      font-weight: bold;
      text-align: center;
      margin: 4mm 0 2mm 0;
      font-size: 10pt;
    }
    .banking-block {
      font-size: 9.5pt;
      line-height: 1.5;
    }
    .banking-block .bold { font-weight: bold; }
    .page2 {
      page-break-before: always;
      display: flex;
      gap: 0;
      width: 100%;
    }
    .sig-block {
      margin-top: 6mm;
      font-size: 9.5pt;
    }
    .sig-line {
      border-top: 1px solid #000;
      margin-top: 16mm;
      padding-top: 1mm;
      font-size: 9pt;
    }
    .sig-title {
      font-weight: bold;
      text-decoration: underline;
      margin-top: 8mm;
    }
    .director-line {
      margin-top: 14mm;
      font-size: 9pt;
    }
    p { margin-bottom: 1.5mm; line-height: 1.45; }
  </style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">

  <!-- LEFT: English -->
  <div class="col">
    <h1>AMENDMENT # 1</h1>
    <div class="subtitle">to service agreement between WORLD<br>INSIGHT LLC &amp; ORIENT INSIGHT LLC</div>

    <div class="section">
      <p><span class="section-title">I.&nbsp;&nbsp;DATE.</span> This Amendment to Service Agreement #02 dated April 7, 2022 ("Amendment") has been agreed on March 14th 2026, by its Side(s).</p>
    </div>

    <div class="section">
      <p><span class="section-title">ORIGINAL AGREEMENT.</span> This Amendment hereby resolves, confirms, and amends the service agreement dated April 7, 2022&nbsp; for the entities known as <strong>WORLD INSIGHT</strong> LLC and &nbsp;<strong>ORIENT INSIGHT</strong> LLC ("Agreement").</p>
    </div>

    <div class="section">
      <p><span class="section-title">II.&nbsp;AMENDMENTS.</span> The Side(s) hereby amend the Agreement as follows:</p>
      <p class="indent"><span class="section-title">A)&nbsp;<u>Schedule # 1:</u></span></p>
      <p class="indent">1.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;The phrase "The contract is valid up to a maximum of 300,000 USD" shall be replaced with "The contract is valid up to a maximum of 400,000 USD".</p>
      <p class="indent">2.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Contract Term The term of the Agreement is extended until May 1, 2026, instead of the previously established date December 31, 2025.</p>
    </div>

    <div class="section">
      <p><span class="section-title">III.&nbsp;&nbsp;OTHER SECTIONS.</span> All other terms and conditions of the Agreement shall remain in full force and effect. The undersigned have duly executed this Amendment and, upon signature by the Sides, this Amendment shall be made part of the original Agreement.</p>
    </div>

    <div class="banking-title">ПОЧТОВЫЕ АДРЕСА, СРЕДСТВА СВЯЗИ И<br>БАНКОВСКИЙ РЕКВИЗИТЫ СТОРОН</div>
    <div class="banking-block">
      <p>LLC " ORIENT INSIGHT " Polvonariq MFY,<br>
      Mash'al Str. 334, Landkreis Payariq, 140 100 Samarkand,<br>
      Uzbekistan</p>
      <p><span class="bold">Beneficiary's Account:</span><br>
      20208840905364923001(USD)</p>
      <p><span class="bold">Beneficiary Bank:</span> PJSCB "ORIENT FINANS" SAMARKAND BRANCH,<br>
      SAMARKAND, UZBEKISTAN<br>
      MFO (BANK CODE) 01071</p>
      <p><span class="bold">S.W.I.F.T. CODE: ORFBUZ22</span></p>
      <p>Beneficiary's Bank correspondent:<br>
      National Bank of Uzbekistan</p>
      <p>Bank correspondent's account: 21002840200001071001<br>
      S.W.I.F.T. <u>CODE:NBFAUZ2X</u></p>
    </div>
  </div>

  <!-- RIGHT: Russian -->
  <div class="col-right">
    <h1>ДОПОЛНЕНИЕ № 1</h1>
    <div class="subtitle">к договору об обслуживании между<br><strong>WORLD INSIGHT LLC и ORIENT<br>INSIGHT LLC</strong></div>

    <div class="section">
      <p><span class="section-title">I. ДАТА.</span> Настоящая дополнение к Соглашению об оказании услуг № 02 от 7 апреля 2022 г. («Дополнение») была согласована ее Сторонами 14 марта 2026 года.</p>
    </div>

    <div class="section">
      <p><span class="section-title">II. ОРИГИНАЛ&nbsp;&nbsp;&nbsp;ДОГОВОРА.</span> <u>Настоящая</u> Дополнение настоящим разрешает, подтверждает и вносит поправки в соглашение об обслуживании от 7 апреля <u>2022&nbsp;&nbsp;для</u> организаций, известных как <strong>WORLD INSIGHT</strong> LLC и <strong>ORIENT INSIGHT</strong> LLC («Соглашение»).</p>
    </div>

    <div class="section">
      <p><span class="section-title">III. ПОПРАВКИ.</span> Настоящим Стороны вносят в Соглашение следующие изменения:</p>
      <p class="indent"><span class="section-title"><u>А) Приложение №1:</u></span></p>
      <p class="indent">1. Сумма договора Заменить фразу: «Договор действует макс. до 300 000 (USD) в <u>Доллар »</u> на «Договор действует макс. до 400 000 (USD) в Доллар».</p>
      <p class="indent">2. Срок действия договора.&nbsp;&nbsp;&nbsp;Срок действия Договора продлевается до 01 мая 2026 года вместо ранее установленной даты 31 декабря 2025 года.</p>
    </div>

    <div class="section">
      <p><span class="section-title">ДРУГИЕ РАЗДЕЛЫ.</span> Все остальные условия Соглашения остаются в полной силе. Нижеподписавшиеся должным образом подписали настоящую Дополнение, и после подписания Сторонами данное Дополнение становится частью первоначального Соглашения</p>
    </div>

    <div class="banking-title">LEGAL ADDRESSES, COMMUNICATIONS<br>AND BANKING DETAILS OF THE PARTIES</div>
    <div class="banking-block">
      <p>LLC " ORIENT INSIGHT " Polvonariq MFY,<br>
      Mash'al Str. 334, Landkreis Payariq, 140 100 Samarkand,<br>
      Uzbekistan</p>
      <p><span class="bold">Beneficiary's Account:</span><br>
      20208840905364923001(USD)</p>
      <p><span class="bold">Beneficiary Bank:</span> PJSCB "ORIENT FINANS" SAMARKAND BRANCH,<br>
      SAMARKAND, UZBEKISTAN<br>
      MFO (BANK CODE) 01071</p>
      <p><span class="bold">S.W.I.F.T. CODE: ORFBUZ22</span></p>
      <p>Beneficiary's Bank correspondent:<br>
      National Bank of Uzbekistan</p>
      <p>Bank correspondent's account: 21002840200001071001<br>
      S.W.I.F.T. <u>CODE:NBFAUZ2X</u></p>
    </div>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page2">

  <!-- LEFT: Customer side -->
  <div class="col">
    <div class="banking-block">
      <p><strong>WORLD INSIGHT LLC</strong></p>
      <p>WORLD INSIGHT Erlebnisreisen GmbH</p>
      <p>Alter Deutzer Postweg 99 51149 Köln</p>
      <p>Daten der Bank:</p>
      <p>USD-Konto <u>Kontonr</u>: 2238343 00</p>
      <p>IBAN: DE42370700600223834300</p>
      <p>BLZ: 37070060</p>
      <p>BIC/Swift: DEUTDEDKXXX</p>
      <p>Deutsche Bank Privat- und Geschäftskunden AG</p>
      <p>Firmenkunden</p>
      <p>An den Dominikanern 11-27</p>
      <p>50668 Köln</p>
    </div>

    <div class="sig-block">
      <div class="sig-title">Signature of the Parties / <u>Подписан Сторонами</u></div>
      <p style="margin-top:2mm;"><strong>От имени Заказчика/On behalf of the Customer<br>WORLD INSIGHT LLC</strong></p>
      <div class="sig-line"></div>
    </div>
  </div>

  <!-- RIGHT: Contractor side -->
  <div class="col-right">
    <div class="banking-block">
      <p><strong>LLC &quot; ORIENT INSIGHT &quot;</strong></p>
      <p>Polvonariq MFY, Mash'al Str. 334,<br>Landkreis Payariq, 140 100 Samarkand, Uzbekistan</p>
      <p><span class="bold">Beneficiary's Account:</span><br>20208840905364923001 (USD)</p>
      <p><span class="bold">Beneficiary Bank:</span> PJSCB "ORIENT FINANS" SAMARKAND BRANCH,<br>SAMARKAND, UZBEKISTAN<br>MFO (BANK CODE) 01071</p>
      <p><span class="bold">S.W.I.F.T. CODE: ORFBUZ22</span></p>
      <p>Beneficiary's Bank correspondent:<br>National Bank of Uzbekistan</p>
      <p>Bank correspondent's account: 21002840200001071001<br>S.W.I.F.T. <u>CODE: NBFAUZ2X</u></p>
    </div>

    <div class="sig-block">
      <div class="sig-title">Signature of the Parties / <u>Подписан Сторонами</u></div>
      <p style="margin-top:2mm;text-align:center;"><strong>От имени Исполнителя/ On behalf of the<br>Contractor<br>ООО « ORIENT INSIGHT »</strong></p>
      <div style="margin-top:14mm;">
        <div style="border-top:1px solid #000; padding-top:1mm; font-size:9pt;">____________________ /Director/</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;

// GET /api/vertrag/preview — HTML for Puppeteer
router.get('/preview', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(VERTRAG_HTML);
});

// GET /api/vertrag/pdf — generate and download PDF
router.get('/pdf', authenticate, async (req, res) => {
  let browser = null;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(VERTRAG_HTML, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Vertrag-Amendment-1-OrientInsight.pdf"');
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('Vertrag PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

module.exports = router;
