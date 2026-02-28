import React, { useState, useImperativeHandle } from 'react';
import { format } from 'date-fns';
import { Download, Printer, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HotellisteDocument = React.forwardRef(function HotellisteDocument({ booking, tourists, accommodations, guide, onWorldInsightSend }, ref) {
  const [emergencyContacts, setEmergencyContacts] = useState([
    { name: 'Miliev Siroj', phone: '+998 97 928 28 14' },
    { name: 'Djahangirov Ulugbek', phone: '+998 93 348 42 08' }
  ]);

  // Calculate room breakdown from tourists (more accurate than stale booking fields)
  const calculateRoomBreakdown = () => {
    if (tourists && tourists.length > 0) {
      let dblT = 0, twnT = 0, snglT = 0;
      for (const t of tourists) {
        const pref = (t.roomPreference || '').toUpperCase();
        if (pref === 'DBL' || pref === 'DZ' || pref === 'DOUBLE') dblT++;
        else if (pref === 'TWN' || pref === 'TWIN') twnT++;
        else snglT++; // SNGL, EZ, SINGLE, or unknown
      }
      return {
        dbl: Math.floor(dblT / 2),
        twn: Math.ceil(twnT / 2),
        sgl: snglT + (dblT % 2), // odd DBL person gets single room
      };
    }
    // Fallback to booking fields if no tourists
    return {
      dbl: booking?.roomsDbl || 0,
      twn: booking?.roomsTwn || 0,
      sgl: booking?.roomsSngl || 0,
    };
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

  useImperativeHandle(ref, () => ({
    generateBlob: () => generatePDF(true)
  }));

  // Generate PDF
  const generatePDF = (returnBlob = false) => {

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

      // Save or return blob
      const filename = `Hotelliste_${booking?.bookingNumber || 'booking'}.pdf`;
      if (returnBlob) return doc.output('blob');
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
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Action buttons */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:justify-end print:hidden">
          <button
            onClick={() => generatePDF()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg font-semibold"
          >
            <Download className="w-5 h-5" />
            Скачать PDF
          </button>
          {onWorldInsightSend && (
            <button
              onClick={onWorldInsightSend}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all shadow-lg font-semibold"
              title="Hotelliste + Rechnung als eine E-Mail an World Insight senden"
            >
              <Mail className="w-5 h-5" />
              An World Insight senden
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all shadow-lg font-semibold"
          >
            <Printer className="w-5 h-5" />
            Печать
          </button>
        </div>

        {/* Document preview */}
        <div className="bg-white md:rounded-2xl shadow-md md:shadow-2xl overflow-hidden print:shadow-none print:rounded-none">
          <div className="p-4 md:p-16 print:p-12" style={{ fontFamily: 'Times New Roman, serif' }}>
            {/* Header */}
            <div className="space-y-3 md:space-y-4 mb-6 md:mb-10 border-b-2 border-gray-200 pb-5 md:pb-8">
              <div className="flex text-sm md:text-base">
                <div className="w-24 md:w-40 font-bold text-gray-700">Von:</div>
                <div className="text-gray-900">Orient Insight, Usbekistan</div>
              </div>

              <h1 className="text-xl md:text-3xl font-bold text-gray-900 my-2 md:my-4">Buchungsbestätigung</h1>

              <div className="space-y-2 md:space-y-3 text-sm md:text-base">
                <div className="flex">
                  <div className="w-24 md:w-40 font-bold text-gray-700">An:</div>
                  <div className="text-gray-900">World Insight</div>
                </div>
                <div className="flex">
                  <div className="w-24 md:w-40 font-bold text-gray-700">Datum:</div>
                  <div className="text-gray-900">{format(new Date(), 'dd-MMM-yy')}</div>
                </div>
                <div className="flex">
                  <div className="w-24 md:w-40 font-bold text-gray-700">Reisedatum:</div>
                  <div className="text-gray-900 text-xs md:text-base">{getTourDates()}</div>
                </div>
                <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-0">
                  <div className="w-24 md:w-40 font-bold text-gray-700">Pax</div>
                  <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-16">
                    <div className="text-gray-900 text-lg font-semibold">{tourists?.length || booking?.pax || 0}</div>
                    {/* Room breakdown table */}
                    <table className="border-collapse border-2 border-black shadow-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-2 border-black px-3 md:px-10 py-2 md:py-2.5 font-bold text-gray-900 text-xs md:text-sm">DOUBLE</th>
                          <th className="border-2 border-black px-3 md:px-10 py-2 md:py-2.5 font-bold text-gray-900 text-xs md:text-sm">TWIN</th>
                          <th className="border-2 border-black px-3 md:px-10 py-2 md:py-2.5 font-bold text-gray-900 text-xs md:text-sm">SINGLE</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="border-2 border-black px-3 md:px-10 py-2 md:py-2.5 text-center font-bold text-gray-900 text-sm md:text-base">{roomBreakdown.dbl}</td>
                          <td className="border-2 border-black px-3 md:px-10 py-2 md:py-2.5 text-center font-bold text-gray-900 text-sm md:text-base">{roomBreakdown.twn % 1 === 0 ? roomBreakdown.twn : roomBreakdown.twn.toFixed(1)}</td>
                          <td className="border-2 border-black px-3 md:px-10 py-2 md:py-2.5 text-center font-bold text-gray-900 text-sm md:text-base">{roomBreakdown.sgl}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <h2 className="text-base md:text-xl font-bold mt-4 md:mt-8 text-gray-900">Buchungsdetails:</h2>
            </div>

            {/* Hotels — mobile: cards, desktop: table */}
            <div className="mb-8 md:mb-12">
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {accommodations && accommodations.length > 0 ? accommodations.map((acc, idx) => (
                  <div key={acc.id} className="border-2 border-black rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b-2 border-black">
                      <span className="font-bold text-gray-900 text-sm">{acc.hotel?.city?.name || '-'}</span>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">OK</span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      <div className="font-semibold text-gray-900">{acc.hotel?.name || '-'}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="bg-blue-50 px-2 py-0.5 rounded">In: {acc.checkInDate ? format(new Date(acc.checkInDate), 'dd-MMM-yy') : '-'}</span>
                        <span>→</span>
                        <span className="bg-red-50 px-2 py-0.5 rounded">Out: {acc.checkOutDate ? format(new Date(acc.checkOutDate), 'dd-MMM-yy') : '-'}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="border-2 border-black px-4 py-8 text-center text-gray-500 italic rounded-xl">No hotels added yet</div>
                )}
              </div>
              {/* Desktop table */}
              <table className="hidden md:table w-full border-collapse border-2 border-black shadow-lg">
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
                    accommodations.map((acc) => (
                      <tr key={acc.id} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="border-2 border-black px-6 py-4 text-gray-900">{acc.hotel?.city?.name || '-'}</td>
                        <td className="border-2 border-black px-6 py-4 text-gray-900">{acc.hotel?.name || '-'}</td>
                        <td className="border-2 border-black px-6 py-4 text-center text-gray-900">{acc.checkInDate ? format(new Date(acc.checkInDate), 'dd-MMM-yy') : '-'}</td>
                        <td className="border-2 border-black px-6 py-4 text-center text-gray-900">{acc.checkOutDate ? format(new Date(acc.checkOutDate), 'dd-MMM-yy') : '-'}</td>
                        <td className="border-2 border-black px-6 py-4 text-center font-semibold text-green-600">OK</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="border-2 border-black px-6 py-12 text-center text-gray-500 italic">No hotels added yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Guide section */}
            {guide && (
              <div className="mb-6 md:mb-8">
                <div className="flex flex-col md:flex-row md:items-baseline md:gap-16 gap-2">
                  <div className="font-bold md:w-48 text-gray-900 text-sm md:text-base">Guide</div>
                  <div className="flex flex-col md:flex-row md:flex-1 gap-2 md:gap-16">
                    <div className="border-b-2 border-black pb-1 md:flex-1 text-gray-900 text-sm md:text-base">{guide.firstName} {guide.lastName}</div>
                    <div className="border-b-2 border-black pb-1 text-gray-900 text-sm md:text-base md:min-w-[200px]">{guide.phone || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Emergency contacts */}
            <div className="mb-8 md:mb-12">
              <div className="font-bold mb-3 md:mb-4 text-gray-900 text-sm md:text-base">Notfallnummer</div>
              {emergencyContacts.map((contact, idx) => (
                <div key={idx} className="flex flex-col md:flex-row md:items-baseline md:gap-16 gap-2 mb-3">
                  <div className="hidden md:block w-48"></div>
                  <div className="flex flex-col md:flex-row md:flex-1 gap-2 md:gap-16">
                    <div className="border-b-2 border-black pb-1 md:flex-1 text-gray-900 text-sm md:text-base">{contact.name}</div>
                    <div className="border-b-2 border-black pb-1 text-gray-900 text-sm md:text-base md:min-w-[200px]">{contact.phone}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-8 md:mt-16 text-gray-900 text-sm md:text-base border-t-2 border-gray-200 pt-6 md:pt-8">
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
});

export default HotellisteDocument;
