import { useState, useEffect, useRef } from 'react';
import { bookingsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Building2, Calendar, Users, FileText, Download, Printer,
  ChevronDown, ChevronRight, X, Loader2, FileSpreadsheet
} from 'lucide-react';

export default function HotelRequestPreview({ bookingId, booking, onClose }) {
  const [hotelRequests, setHotelRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [expandedHotels, setExpandedHotels] = useState({});
  const printRef = useRef(null);

  useEffect(() => {
    loadHotelRequests();
  }, [bookingId]);

  const loadHotelRequests = async () => {
    try {
      setLoading(true);
      const response = await bookingsApi.getHotelRequests(bookingId);
      setHotelRequests(response.data.hotelRequests || []);

      // Expand all by default
      const expanded = {};
      response.data.hotelRequests?.forEach(h => {
        expanded[h.hotel.id] = true;
      });
      setExpandedHotels(expanded);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const toggleHotel = (hotelId) => {
    setExpandedHotels(prev => ({ ...prev, [hotelId]: !prev[hotelId] }));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateShort = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const handlePrint = (hotelRequest) => {
    setSelectedHotel(hotelRequest);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const downloadExcel = async (hotelRequest) => {
    try {
      // Create CSV content for Excel
      const lines = [];
      const bookingNumber = hotelRequest.booking?.bookingNumber || booking?.bookingNumber || `#${bookingId}`;
      const country = hotelRequest.booking?.country || booking?.country || '';
      const tourName = hotelRequest.booking?.tourType?.name || booking?.tourType?.name || '';

      lines.push(['ЗАЯВКА НА РАЗМЕЩЕНИЕ']);
      lines.push([]);
      lines.push(['Отель:', hotelRequest.hotel.name]);
      lines.push(['Город:', hotelRequest.hotel.city?.name || '']);
      lines.push(['Группа:', bookingNumber]);
      lines.push(['Страна:', country]);
      lines.push(['Тур:', tourName]);
      lines.push(['Check-in:', formatDate(hotelRequest.checkIn)]);
      lines.push(['Check-out:', formatDate(hotelRequest.checkOut)]);
      lines.push(['Ночей:', hotelRequest.nights]);
      lines.push(['PAX:', hotelRequest.totalGuests]);
      lines.push([]);
      lines.push(['КОМНАТЫ']);
      lines.push(['Тип', 'Кол-во']);
      hotelRequest.roomSummary?.forEach(rs => {
        lines.push([rs.type, rs.quantity]);
      });
      lines.push(['ИТОГО:', hotelRequest.totalRooms || hotelRequest.roomSummary?.reduce((sum, rs) => sum + rs.quantity, 0)]);
      lines.push([]);
      lines.push(['ROOMING LIST']);
      lines.push(['№', 'Имя гостя', 'Тип номера', 'Check-in', 'Check-out', 'Ночей', 'Примечание']);

      hotelRequest.guests?.forEach((guest, idx) => {
        lines.push([
          idx + 1,
          guest.name,
          guest.roomType,
          formatDateShort(guest.checkIn),
          formatDateShort(guest.checkOut),
          guest.nights,
          guest.notes || ''
        ]);
      });

      if (hotelRequest.totalCost > 0) {
        lines.push([]);
        lines.push(['ИТОГО СТОИМОСТЬ:', `$${hotelRequest.totalCost.toLocaleString()}`]);
      }

      // Convert to CSV
      const csv = lines.map(row => row.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotel-request-${hotelRequest.hotel.name}-${bookingNumber}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel файл скачан');
    } catch (error) {
      toast.error('Ошибка экспорта');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (hotelRequests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Нет данных для формирования заявок</p>
        <p className="text-sm mt-2">Сначала добавьте номера во вкладке "Размещение"</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Заявки в отели ({hotelRequests.length})
          </h3>
        </div>
      </div>

      {/* Hotel Requests List */}
      <div className="space-y-4">
        {hotelRequests.map(hotelRequest => (
          <div
            key={hotelRequest.hotel.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Hotel Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleHotel(hotelRequest.hotel.id)}
            >
              <div className="flex items-center gap-3">
                {expandedHotels[hotelRequest.hotel.id] ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                <Building2 className="w-5 h-5 text-primary-600" />
                <div>
                  <span className="font-semibold text-gray-900">{hotelRequest.hotel.name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({hotelRequest.hotel.city?.name})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {formatDateShort(hotelRequest.checkIn)} - {formatDateShort(hotelRequest.checkOut)}
                </span>
                <span className="text-sm font-medium text-primary-600">
                  {hotelRequest.totalGuests} PAX
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handlePrint(hotelRequest)}
                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                    title="Печать"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => downloadExcel(hotelRequest)}
                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                    title="Скачать Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Hotel Request Preview */}
            {expandedHotels[hotelRequest.hotel.id] && (
              <div className="p-4">
                {/* Request Preview Card */}
                <div className="border border-gray-300 rounded-lg bg-white p-6 max-w-2xl mx-auto">
                  {/* Document Header */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">ЗАЯВКА</h2>
                    <p className="text-sm text-gray-600">Booking Request</p>
                  </div>

                  {/* Hotel Info */}
                  <div className="mb-6">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold text-primary-700">{hotelRequest.hotel.name}</h3>
                      {hotelRequest.hotel.city && (
                        <p className="text-sm text-gray-500">{hotelRequest.hotel.city.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="text-gray-500 w-24">Группа:</span>
                        <span className="font-medium">{hotelRequest.booking?.bookingNumber || booking?.bookingNumber || `#${bookingId}`}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-24">Страна:</span>
                        <span className="font-medium">{hotelRequest.booking?.country || booking?.country || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-24">Тур:</span>
                        <span className="font-medium">{hotelRequest.booking?.tourType?.name || booking?.tourType?.name || '-'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="text-gray-500 w-24">Check-in:</span>
                        <span className="font-medium">{formatDate(hotelRequest.checkIn)}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-24">Check-out:</span>
                        <span className="font-medium">{formatDate(hotelRequest.checkOut)}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-24">PAX:</span>
                        <span className="font-medium">{hotelRequest.totalGuests}</span>
                      </div>
                    </div>
                  </div>

                  {/* Room Summary */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Комнаты</h4>
                    <div className="flex flex-wrap gap-3">
                      {hotelRequest.roomSummary?.map((rs, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded">
                          <span className="font-medium">{rs.type}</span>
                          <span className="text-blue-500">×</span>
                          <span className="font-bold">{rs.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rooming List */}
                  {hotelRequest.guests?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                        Rooming List ({hotelRequest.guests.length} гостей)
                      </h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="py-2 pr-2 w-8">№</th>
                            <th className="py-2 pr-2">Имя</th>
                            <th className="py-2 pr-2 w-16">Номер</th>
                            <th className="py-2 pr-2 w-24">Даты</th>
                            <th className="py-2 w-12 text-center">Н.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotelRequest.guests.map((guest, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="py-1.5 pr-2 text-gray-400">{idx + 1}</td>
                              <td className="py-1.5 pr-2 font-medium">{guest.name}</td>
                              <td className="py-1.5 pr-2">
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {guest.roomType}
                                </span>
                              </td>
                              <td className="py-1.5 pr-2 text-gray-500 text-xs">
                                {formatDateShort(guest.checkIn)} - {formatDateShort(guest.checkOut)}
                              </td>
                              <td className="py-1.5 text-center">{guest.nights}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Total Cost */}
                  {hotelRequest.totalCost > 0 && (
                    <div className="mt-6 pt-4 border-t flex justify-between items-center">
                      <span className="text-gray-600">Итого стоимость:</span>
                      <span className="text-lg font-bold text-primary-600">
                        ${hotelRequest.totalCost.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
