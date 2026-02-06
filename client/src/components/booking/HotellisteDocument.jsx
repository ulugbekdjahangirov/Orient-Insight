import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HotellisteDocument = ({ booking, tourists, accommodations, guide }) => {
  const [emergencyContacts, setEmergencyContacts] = useState([
    { name: 'Miliev Siroj', phone: '+998 97 928 28 14' },
    { name: 'Djahangirov Ulugbek', phone: '+998 93 348 42 08' }
  ]);

  // Calculate room breakdown from booking (already calculated from Final List)
  const calculateRoomBreakdown = () => {
    // Use booking rooms which are calculated from Final List and stored in database
    const dbl = booking?.roomsDbl || 0;
    const twn = booking?.roomsTwn || 0;
    const sgl = booking?.roomsSngl || 0;

    console.log('📊 Room breakdown from booking:', { dbl, twn, sgl });
    console.log('👤 Guide object:', guide);

    return { dbl, twn, sgl };
  };

  const roomBreakdown = calculateRoomBreakdown();

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return format(date, 'dd-MMM-yy');
    } catch {
      return '-';
    }
  };

  // Get tour dates
  const getTourDates = () => {
    if (booking?.departureDate && booking?.endDate) {
      const start = format(new Date(booking.departureDate), 'dd.MM');
      const end = format(new Date(booking.endDate), 'dd.MM.yyyy');
      return `die Gruppe ${start}-${end} (Usbekistan Teil)`;
    }
    return '-';
  };

  // Generate PDF
  const generatePDF = () => {
    console.log('📄 Starting PDF generation...');
    console.log('Booking:', booking);
    console.log('Accommodations:', accommodations);
    console.log('Guide:', guide);

    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Header section
      doc.setFontSize(10);
      doc.text('Von:', 15, yPos);
      doc.text('Orient Insight, Usbekistan', 70, yPos);
      yPos += 15;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Buchungsbestätigung', 15, yPos);
      yPos += 15;

      // Booking details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      doc.text('An:', 15, yPos);
      doc.text('World Insight', 70, yPos);
      yPos += 7;

      doc.text('Datum:', 15, yPos);
      doc.text(format(new Date(), 'dd-MMM-yy'), 70, yPos);
      yPos += 7;

      doc.text('Reisedatum:', 15, yPos);
      doc.text(getTourDates(), 70, yPos);
      yPos += 7;

      doc.text('Pax:', 15, yPos);
      doc.text(String(tourists?.length || booking?.pax || 0), 70, yPos);
      yPos += 12;

      // Buchungsdetails header
      doc.setFont('helvetica', 'bold');
      doc.text('Buchungsdetails:', 15, yPos);
      yPos += 10;

      // Room breakdown table (aligned to right side)
      autoTable(doc, {
        startY: yPos - 10,
        margin: { left: 120 },
        head: [['DOUBLE', 'TWIN', 'SINGLE']],
        body: [[
          String(roomBreakdown.dbl),
          roomBreakdown.twn % 1 === 0 ? String(roomBreakdown.twn) : roomBreakdown.twn.toFixed(1),
          String(roomBreakdown.sgl)
        ]],
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 2,
          halign: 'center',
          fontStyle: 'bold'
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.5,
          lineColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // Hotels table
      const hotelRows = (accommodations || []).map(acc => [
        acc.hotel?.city?.name || '-',
        acc.hotel?.name || '-',
        acc.checkInDate ? format(new Date(acc.checkInDate), 'dd-MMM-yy') : '-',
        acc.checkOutDate ? format(new Date(acc.checkOutDate), 'dd-MMM-yy') : '-',
        'OK'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Städte', 'Hotels', 'Check in', 'Check out', 'Status']],
        body: hotelRows,
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
          halign: 'center'
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0]
        }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // Guide section
      if (guide) {
        doc.setFont('helvetica', 'bold');
        doc.text('Guide', 15, yPos);
        doc.setFont('helvetica', 'normal');

        // Draw underline
        const guideName = `${guide.firstName} ${guide.lastName}`;
        const guidePhone = guide.phone || '-';
        doc.text(guideName, 70, yPos);
        doc.text(guidePhone, 150, yPos);

        const textWidth1 = doc.getTextWidth(guideName);
        const textWidth2 = doc.getTextWidth(guidePhone);
        doc.line(70, yPos + 1, 70 + textWidth1, yPos + 1);
        doc.line(150, yPos + 1, 150 + textWidth2, yPos + 1);

        yPos += 12;
      }

      // Emergency contacts
      doc.setFont('helvetica', 'bold');
      doc.text('Notfallnummer', 15, yPos);
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      emergencyContacts.forEach(contact => {
        doc.text(contact.name, 70, yPos);
        doc.text(contact.phone, 150, yPos);

        const nameWidth = doc.getTextWidth(contact.name);
        const phoneWidth = doc.getTextWidth(contact.phone);
        doc.line(70, yPos + 1, 70 + nameWidth, yPos + 1);
        doc.line(150, yPos + 1, 150 + phoneWidth, yPos + 1);

        yPos += 7;
      });

      yPos += 10;

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.text('mit freundlichen Grüßen', 15, yPos);
      yPos += 7;
      doc.text('Orient Insight Team', 15, yPos);

      // Save PDF
      const filename = `Hotelliste_${booking?.bookingNumber || 'booking'}.pdf`;
      doc.save(filename);
      toast.success('PDF сақланди!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF экспорт хатолиги');
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Action buttons */}
        <div className="flex gap-3 justify-end print:hidden">
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
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
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none">
          <div className="p-16 print:p-12" style={{ minHeight: '297mm', fontFamily: 'Times New Roman, serif' }}>
            {/* Header */}
            <div className="space-y-4 mb-10 border-b-2 border-gray-200 pb-8">
              <div className="flex text-base">
                <div className="w-40 font-bold text-gray-700">Von:</div>
                <div className="text-gray-900">Orient Insight, Usbekistan</div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 my-4">Buchungsbestätigung</h1>

              <div className="space-y-3 text-base">
                <div className="flex">
                  <div className="w-40 font-bold text-gray-700">An:</div>
                  <div className="text-gray-900">World Insight</div>
                </div>
                <div className="flex">
                  <div className="w-40 font-bold text-gray-700">Datum:</div>
                  <div className="text-gray-900">{format(new Date(), 'dd-MMM-yy')}</div>
                </div>
                <div className="flex">
                  <div className="w-40 font-bold text-gray-700">Reisedatum:</div>
                  <div className="text-gray-900">{getTourDates()}</div>
                </div>
                <div className="flex items-start">
                  <div className="w-40 font-bold text-gray-700">Pax</div>
                  <div className="flex items-start gap-16">
                    <div className="text-gray-900 text-lg font-semibold">{tourists?.length || booking?.pax || 0}</div>

                    {/* Room breakdown table */}
                    <table className="border-collapse border-2 border-black shadow-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-2 border-black px-10 py-2.5 font-bold text-gray-900 text-sm">DOUBLE</th>
                          <th className="border-2 border-black px-10 py-2.5 font-bold text-gray-900 text-sm">TWIN</th>
                          <th className="border-2 border-black px-10 py-2.5 font-bold text-gray-900 text-sm">SINGLE</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="border-2 border-black px-10 py-2.5 text-center font-bold text-gray-900 text-base">
                            {roomBreakdown.dbl}
                          </td>
                          <td className="border-2 border-black px-10 py-2.5 text-center font-bold text-gray-900 text-base">
                            {roomBreakdown.twn % 1 === 0 ? roomBreakdown.twn : roomBreakdown.twn.toFixed(1)}
                          </td>
                          <td className="border-2 border-black px-10 py-2.5 text-center font-bold text-gray-900 text-base">
                            {roomBreakdown.sgl}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-bold mt-8 text-gray-900">Buchungsdetails:</h2>
            </div>

            {/* Hotels table */}
            <div className="mb-12">
              <table className="w-full border-collapse border-2 border-black shadow-lg">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-2 border-black px-6 py-4 text-left font-bold text-gray-900 text-base">Städte</th>
                    <th className="border-2 border-black px-6 py-4 text-left font-bold text-gray-900 text-base">Hotels</th>
                    <th className="border-2 border-black px-6 py-4 text-center font-bold text-gray-900 text-base">Check in</th>
                    <th className="border-2 border-black px-6 py-4 text-center font-bold text-gray-900 text-base">Check out</th>
                    <th className="border-2 border-black px-6 py-4 text-center font-bold text-gray-900 text-base">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accommodations && accommodations.length > 0 ? (
                    accommodations.map((acc, idx) => (
                      <tr key={acc.id} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="border-2 border-black px-6 py-4 text-gray-900">{acc.hotel?.city?.name || '-'}</td>
                        <td className="border-2 border-black px-6 py-4 text-gray-900">{acc.hotel?.name || '-'}</td>
                        <td className="border-2 border-black px-6 py-4 text-center text-gray-900">
                          {acc.checkInDate ? format(new Date(acc.checkInDate), 'dd-MMM-yy') : '-'}
                        </td>
                        <td className="border-2 border-black px-6 py-4 text-center text-gray-900">
                          {acc.checkOutDate ? format(new Date(acc.checkOutDate), 'dd-MMM-yy') : '-'}
                        </td>
                        <td className="border-2 border-black px-6 py-4 text-center font-semibold text-green-600">OK</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="border-2 border-black px-6 py-12 text-center text-gray-500 italic">
                        No hotels added yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Guide section */}
            {guide && (
              <div className="mb-8">
                <div className="flex items-baseline gap-16">
                  <div className="font-bold w-48 text-gray-900 text-base">Guide</div>
                  <div className="flex-1 border-b-2 border-black pb-1.5 text-gray-900 text-base">
                    {guide.firstName} {guide.lastName}
                  </div>
                  <div className="border-b-2 border-black pb-1.5 text-gray-900 text-base min-w-[200px]">
                    {guide.phone || '-'}
                  </div>
                </div>
              </div>
            )}

            {/* Emergency contacts */}
            <div className="mb-12">
              <div className="font-bold mb-4 text-gray-900 text-base">Notfallnummer</div>
              {emergencyContacts.map((contact, idx) => (
                <div key={idx} className="flex items-baseline gap-16 mb-3">
                  <div className="w-48"></div>
                  <div className="flex-1 border-b-2 border-black pb-1.5 text-gray-900 text-base">
                    {contact.name}
                  </div>
                  <div className="border-b-2 border-black pb-1.5 text-gray-900 text-base min-w-[200px]">
                    {contact.phone}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-16 text-gray-900 text-base border-t-2 border-gray-200 pt-8">
              <p className="mb-2">mit freundlichen Grüßen</p>
              <p className="font-semibold">Orient Insight Team</p>
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
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:p-12 {
            padding: 3rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HotellisteDocument;
