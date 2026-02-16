import { useState, useEffect } from 'react';
import { bookingsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  DollarSign, Building2, Users, TrendingUp, ChevronDown, ChevronRight,
  FileSpreadsheet, Loader2, PieChart
} from 'lucide-react';

export default function CostSummary({ bookingId, booking }) {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('hotel'); // 'hotel' | 'participant'

  useEffect(() => {
    loadCostSummary();
  }, [bookingId]);

  const loadCostSummary = async () => {
    try {
      setLoading(true);
      const response = await bookingsApi.getCostSummary(bookingId);
      setCostData(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки стоимости');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      const lines = [];
      lines.push(['РАСЧЁТ СТОИМОСТИ']);
      lines.push(['Бронирование:', booking?.bookingNumber || `#${bookingId}`]);
      lines.push(['Тур:', booking?.tourType?.name || '']);
      lines.push([]);

      // By Hotel
      lines.push(['ПО ОТЕЛЯМ']);
      lines.push(['Отель', 'Город', 'Номеров', 'Ночей', 'Стоимость']);
      costData?.byHotel?.forEach(h => {
        lines.push([h.hotelName, h.city, h.rooms, h.nights, h.subtotal]);
      });
      lines.push(['ИТОГО', '', '', '', costData?.totals?.cost || 0]);
      lines.push([]);

      // By Participant
      if (costData?.byParticipant?.length > 0) {
        lines.push(['ПО ТУРИСТАМ']);
        lines.push(['Турист', 'Ночей', 'Стоимость']);
        costData.byParticipant.forEach(p => {
          lines.push([p.name, p.totalNights, p.totalCost]);
        });
      }

      const csv = lines.map(row => row.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost-summary-${booking?.bookingNumber || bookingId}.csv`;
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

  if (!costData) {
    return (
      <div className="text-center py-12 text-gray-500">
        <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Нет данных для расчёта</p>
      </div>
    );
  }

  const { byHotel, byParticipant, totals } = costData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Расчёт стоимости</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('hotel')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewMode === 'hotel'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-1" />
              По отелям
            </button>
            <button
              onClick={() => setViewMode('participant')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewMode === 'participant'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              По туристам
            </button>
          </div>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Экспорт
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg md:rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Building2 className="w-4 h-4" />
            <span className="text-xs md:text-sm font-medium">Номеров</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-blue-900">{totals?.rooms || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg md:rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <PieChart className="w-4 h-4" />
            <span className="text-xs md:text-sm font-medium">Ночей</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-purple-900">{totals?.nights || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg md:rounded-xl p-3 md:p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs md:text-sm font-medium">Итого</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-green-900">
            ${(totals?.cost || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* By Hotel View */}
      {viewMode === 'hotel' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">Стоимость по отелям</h4>
          </div>
          {byHotel?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 bg-gray-50">
                    <th className="py-3 px-4">Отель</th>
                    <th className="py-3 px-4">Город</th>
                    <th className="py-3 px-4 text-center">Номеров</th>
                    <th className="py-3 px-4 text-center">Ночей</th>
                    <th className="py-3 px-4 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {byHotel.map((hotel, idx) => (
                    <tr key={hotel.hotelId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{hotel.hotelName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{hotel.city}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {hotel.rooms}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{hotel.nights}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        ${hotel.subtotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan="2" className="py-3 px-4 text-gray-700">ИТОГО</td>
                    <td className="py-3 px-4 text-center text-primary-600">{totals?.rooms || 0}</td>
                    <td className="py-3 px-4 text-center text-primary-600">{totals?.nights || 0}</td>
                    <td className="py-3 px-4 text-right text-lg text-primary-600">
                      ${(totals?.cost || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              Нет данных по отелям
            </div>
          )}
        </div>
      )}

      {/* By Participant View */}
      {viewMode === 'participant' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">Стоимость по туристам</h4>
          </div>
          {byParticipant?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 bg-gray-50">
                    <th className="py-3 px-4">Турист</th>
                    <th className="py-3 px-4 text-center">Ночей</th>
                    <th className="py-3 px-4 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {byParticipant.map((participant) => (
                    <tr key={participant.participantId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{participant.name}</span>
                        </div>
                        {participant.breakdown?.length > 0 && (
                          <div className="mt-1 text-xs text-gray-400">
                            {participant.breakdown.map((b, i) => (
                              <span key={i}>
                                {b.hotelName} ({b.nights}н.)
                                {i < participant.breakdown.length - 1 ? ' → ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">{participant.totalNights}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        ${participant.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="py-3 px-4 text-gray-700">
                      ИТОГО ({byParticipant.length} туристов)
                    </td>
                    <td className="py-3 px-4 text-center text-primary-600">
                      {byParticipant.reduce((sum, p) => sum + p.totalNights, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-lg text-primary-600">
                      ${byParticipant.reduce((sum, p) => sum + p.totalCost, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Нет назначенных туристов</p>
              <p className="text-sm mt-1">Добавьте туристов и назначьте их в номера</p>
            </div>
          )}
        </div>
      )}

      {/* Additional Cost Info */}
      {booking?.totalCost !== undefined && booking?.totalCost !== totals?.cost && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Сравнение с бюджетом</span>
          </div>
          <div className="mt-2 text-sm text-yellow-800">
            <div className="flex justify-between">
              <span>Бюджет бронирования:</span>
              <span className="font-medium">${(booking.totalCost || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Расчётная стоимость:</span>
              <span className="font-medium">${(totals?.cost || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-yellow-300 mt-2 pt-2">
              <span>Разница:</span>
              <span className={`font-bold ${(totals?.cost || 0) > (booking.totalCost || 0) ? 'text-red-600' : 'text-green-600'}`}>
                {(totals?.cost || 0) > (booking.totalCost || 0) ? '+' : ''}
                ${((totals?.cost || 0) - (booking.totalCost || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
