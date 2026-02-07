import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Printer, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const GutschriftDocument = ({ booking, tourists }) => {
  const [gutschriftItems, setGutschriftItems] = useState([
    {
      id: 1,
      description: 'Usbekistan Teil',
      einzelpreis: 985,
      anzahl: 15,
      currency: 'USD'
    },
    {
      id: 2,
      description: 'EZ Zuschlag',
      einzelpreis: 240,
      anzahl: 7,
      currency: 'USD'
    },
    {
      id: 3,
      description: 'Zusatznacht DZ',
      einzelpreis: 75,
      anzahl: 2,
      currency: 'USD'
    },
    {
      id: 4,
      description: 'Extra Transfer nach Urgench',
      einzelpreis: 50,
      anzahl: 1,
      currency: 'USD'
    },
    {
      id: 5,
      description: 'Extra Transfer in Taschkent',
      einzelpreis: 40,
      anzahl: 2,
      currency: 'USD'
    },
    {
      id: 6,
      description: 'Stornogebühren für Mr Kleimann',
      einzelpreis: 980,
      anzahl: 1,
      currency: 'USD'
    }
  ]);

  const [rechnungNr, setRechnungNr] = useState('11/25');
  const [gutschriftNr, setGutschriftNr] = useState('02/25');
  const [bezahlteRechnung, setBezahlteRechnung] = useState(17880);

  // Calculate total
  const calculateTotal = () => {
    return gutschriftItems.reduce((sum, item) => {
      return sum + (item.einzelpreis * item.anzahl);
    }, 0);
  };

  // Calculate final amount (Total - Already Paid)
  const calculateGesamtbetrag = () => {
    return calculateTotal() - bezahlteRechnung;
  };

  // Generate PDF
  const generatePDF = () => {
    console.log('📄 Generating Gutschrift PDF...');

    try {
      const doc = new jsPDF();
      let yPos = 30;

      // Title "Gutschrift"
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Gutschrift', 105, yPos, { align: 'center' });
      yPos += 20;

      // Datum and Gutschrift Nr on the right
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Datum: ${format(new Date(), 'dd.MM.yyyy')}`, 195, yPos - 15, { align: 'right' });
      doc.text(`Gutschrift Nr.: ${gutschriftNr}`, 195, yPos - 8, { align: 'right' });

      // Reference to invoice
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Hiermit ist eine Gutschrift zu unserer Rechnung Nr: ${rechnungNr}`, 15, yPos);
      yPos += 15;

      // Gutschrift table
      const tableData = gutschriftItems.map((item, index) => [
        (index + 1).toString(),
        item.description,
        item.einzelpreis.toString(),
        item.anzahl.toString(),
        (item.einzelpreis * item.anzahl).toString(),
        item.currency
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['№', 'Beschreibung', 'Einzelpreis', 'Anzahl', 'Gesamtpreis', 'Währung']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'left', cellWidth: 75 },
          2: { halign: 'right', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 25 }
        }
      });

      yPos = doc.lastAutoTable.finalY;

      // TOTAL row
      autoTable(doc, {
        startY: yPos,
        body: [['', 'TOTAL', '', '', calculateTotal().toString(), 'USD']],
        theme: 'grid',
        styles: {
          fontSize: 11,
          cellPadding: 3,
          fontStyle: 'bold',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { halign: 'left', cellWidth: 75 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 25 }
        }
      });

      yPos = doc.lastAutoTable.finalY;

      // Already paid invoice row
      autoTable(doc, {
        startY: yPos,
        body: [['', `Bereits bezahlte Rechnung Nr. ${rechnungNr}`, '', '', bezahlteRechnung.toString(), 'USD']],
        theme: 'grid',
        styles: {
          fontSize: 11,
          cellPadding: 3,
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { halign: 'left', cellWidth: 75 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 25 }
        }
      });

      yPos = doc.lastAutoTable.finalY;

      // Final amount (Gesamtbetrag)
      autoTable(doc, {
        startY: yPos,
        body: [['', 'Gesamtbetrag:', '', '', calculateGesamtbetrag().toString(), 'USD']],
        theme: 'grid',
        styles: {
          fontSize: 12,
          cellPadding: 3,
          fontStyle: 'bold',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { halign: 'left', cellWidth: 75 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 25 }
        }
      });

      // Save PDF
      const filename = `Gutschrift_${gutschriftNr.replace('/', '-')}.pdf`;
      doc.save(filename);
      toast.success('Gutschrift PDF сақланди!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF экспорт хатолиги');
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Add new item
  const addItem = () => {
    const newItem = {
      id: Math.max(...gutschriftItems.map(i => i.id), 0) + 1,
      description: 'New Item',
      einzelpreis: 0,
      anzahl: 1,
      currency: 'USD'
    };
    setGutschriftItems([...gutschriftItems, newItem]);
  };

  // Delete item
  const deleteItem = (id) => {
    setGutschriftItems(gutschriftItems.filter(item => item.id !== id));
  };

  // Update item
  const updateItem = (id, field, value) => {
    setGutschriftItems(gutschriftItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Action buttons */}
        <div className="flex gap-3 justify-end print:hidden">
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Download className="w-5 h-5" />
            Скачать PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Printer className="w-5 h-5" />
            Печать
          </button>
        </div>

        {/* Document preview */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none border border-gray-100">
          <div className="p-16 print:p-12" style={{ minHeight: '297mm', fontFamily: 'Georgia, serif' }}>
            {/* Title and Header Info */}
            <div className="flex justify-between items-start mb-12">
              <h1 className="text-6xl font-bold text-emerald-600">
                Gutschrift
              </h1>
              <div className="text-right text-base">
                <div className="mb-2">
                  <span className="font-semibold">Datum:</span> {format(new Date(), 'dd.MM.yyyy')}
                </div>
                <div>
                  <span className="font-semibold">Gutschrift Nr.:</span>{' '}
                  <input
                    type="text"
                    value={gutschriftNr}
                    onChange={(e) => setGutschriftNr(e.target.value)}
                    className="w-20 border-b border-gray-400 focus:border-emerald-600 outline-none print:border-none font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Reference text */}
            <p className="text-base mb-10">
              Hiermit ist eine Gutschrift zu unserer Rechnung Nr:{' '}
              <span className="font-bold">
                <input
                  type="text"
                  value={rechnungNr}
                  onChange={(e) => setRechnungNr(e.target.value)}
                  className="w-16 border-b border-gray-400 focus:border-emerald-600 outline-none print:border-none font-bold"
                />
              </span>
            </p>

            {/* Gutschrift table with summary rows */}
            <div className="shadow-lg rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-emerald-100">
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">№</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Beschreibung</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Einzelpreis</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Anzahl</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Gesamtpreis</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Währung</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Item rows */}
                  {gutschriftItems.map((item, index) => (
                    <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors duration-150">
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-medium">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-900">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-gray-900 font-semibold">
                        <input
                          type="number"
                          value={item.einzelpreis}
                          onChange={(e) => updateItem(item.id, 'einzelpreis', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
                        <input
                          type="number"
                          value={item.anzahl}
                          onChange={(e) => updateItem(item.id, 'anzahl', parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:outline-none text-center focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-base">
                        {item.einzelpreis * item.anzahl}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">{item.currency}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center print:hidden">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* TOTAL row */}
                  <tr className="bg-blue-100">
                    <td className="border border-gray-300 px-4 py-3 text-center"></td>
                    <td className="border border-gray-300 px-4 py-3 font-bold text-gray-900 text-base">
                      TOTAL
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-lg">
                      {calculateTotal()}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                      USD
                    </td>
                    <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
                  </tr>

                  {/* Already paid invoice row */}
                  <tr className="bg-white">
                    <td className="border border-gray-300 px-4 py-3 text-center"></td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-900 text-sm">
                      Bereits bezahlte Rechnung Nr.{' '}
                      <input
                        type="text"
                        value={rechnungNr}
                        onChange={(e) => setRechnungNr(e.target.value)}
                        className="w-16 border-b border-gray-300 focus:border-emerald-500 outline-none print:border-none font-semibold"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-900">
                      <input
                        type="number"
                        value={bezahlteRechnung}
                        onChange={(e) => setBezahlteRechnung(parseFloat(e.target.value) || 0)}
                        className="w-full bg-yellow-100 border-none focus:outline-none text-right focus:bg-yellow-200 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">USD</td>
                    <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
                  </tr>

                  {/* Final amount row */}
                  <tr className="bg-emerald-100">
                    <td className="border border-gray-300 px-4 py-3 text-center"></td>
                    <td className="border border-gray-300 px-4 py-3 font-bold text-gray-900 text-base">
                      Gesamtbetrag:
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-lg">
                      {calculateGesamtbetrag()}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                      USD
                    </td>
                    <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
          .print\\:hidden {
            display: none !important;
          }
          input {
            border: none !important;
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GutschriftDocument;
