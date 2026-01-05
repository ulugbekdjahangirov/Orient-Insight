import { useState, useEffect } from 'react';
import { bookingsApi, participantsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Building2, MapPin, Calendar, Bed, Users, Plus, Edit,
  Trash2, X, Save, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react';

export default function RoomingList({ bookingId, bookingRooms = [], participants = [], onUpdate }) {
  const [roomingData, setRoomingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedHotels, setExpandedHotels] = useState({});

  // Assignment modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [assignForm, setAssignForm] = useState({
    participantId: '',
    checkInDate: '',
    checkOutDate: '',
    extraNights: 0,
    notes: ''
  });

  useEffect(() => {
    loadRoomingList();
  }, [bookingId]);

  const loadRoomingList = async () => {
    try {
      setLoading(true);
      const response = await bookingsApi.getRoomingList(bookingId);
      setRoomingData(response.data);

      // Expand all hotels by default
      const expanded = {};
      response.data.roomingList?.forEach(h => {
        expanded[h.hotel.id] = true;
      });
      setExpandedHotels(expanded);
    } catch (error) {
      toast.error('Ошибка загрузки rooming list');
    } finally {
      setLoading(false);
    }
  };

  const toggleHotel = (hotelId) => {
    setExpandedHotels(prev => ({ ...prev, [hotelId]: !prev[hotelId] }));
  };

  const openAssignModal = (room) => {
    setSelectedRoom(room);
    setAssignForm({
      participantId: '',
      checkInDate: '',
      checkOutDate: '',
      extraNights: 0,
      notes: ''
    });
    setAssignModalOpen(true);
  };

  const saveAssignment = async () => {
    if (!assignForm.participantId) {
      toast.error('Выберите участника');
      return;
    }

    try {
      await participantsApi.createAssignment(bookingId, {
        participantId: parseInt(assignForm.participantId),
        bookingRoomId: selectedRoom.id,
        checkInDate: assignForm.checkInDate || null,
        checkOutDate: assignForm.checkOutDate || null,
        extraNights: parseInt(assignForm.extraNights) || 0,
        notes: assignForm.notes
      });
      toast.success('Участник назначен');
      setAssignModalOpen(false);
      loadRoomingList();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка назначения');
    }
  };

  const deleteAssignment = async (assignmentId) => {
    if (!confirm('Удалить назначение?')) return;

    try {
      await participantsApi.deleteAssignment(bookingId, assignmentId);
      toast.success('Назначение удалено');
      loadRoomingList();
      onUpdate?.();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!roomingData) {
    return <div className="text-center py-8 text-gray-500">Нет данных</div>;
  }

  const { roomingList, unassignedParticipants, totalParticipants, assignedCount } = roomingData;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bed className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Rooming List</h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            Назначено: <span className="font-medium text-gray-900">{assignedCount}</span> / {totalParticipants}
          </span>
          {unassignedParticipants?.length > 0 && (
            <span className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              {unassignedParticipants.length} без размещения
            </span>
          )}
        </div>
      </div>

      {/* Unassigned warning */}
      {unassignedParticipants?.length > 0 && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-700">
            <span className="font-medium">Без размещения:</span>{' '}
            {unassignedParticipants.map(p => p.fullName || `${p.lastName}, ${p.firstName}`).join(', ')}
          </p>
        </div>
      )}

      {/* Hotels */}
      {roomingList?.length > 0 ? (
        <div className="space-y-4">
          {roomingList.map(hotelGroup => (
            <div key={hotelGroup.hotel.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Hotel header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleHotel(hotelGroup.hotel.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedHotels[hotelGroup.hotel.id] ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <Building2 className="w-5 h-5 text-primary-600" />
                  <div>
                    <span className="font-semibold text-gray-900">{hotelGroup.hotel.name}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({hotelGroup.hotel.city?.name})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    {formatDate(hotelGroup.checkIn)} - {formatDate(hotelGroup.checkOut)}
                  </span>
                  <div className="flex gap-2">
                    {hotelGroup.roomSummary?.map(rs => (
                      <span key={rs.type} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {rs.type}: {rs.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Room allocations */}
              {expandedHotels[hotelGroup.hotel.id] && (
                <div className="p-4">
                  {hotelGroup.rooms?.map(room => (
                    <div key={room.id} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                            {room.roomType?.name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {room.quantity} ном. | {formatDate(room.checkInDate)} - {formatDate(room.checkOutDate)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); openAssignModal(room); }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded"
                        >
                          <Plus className="w-3 h-3" />
                          Назначить
                        </button>
                      </div>

                      {/* Guests in this room */}
                      {hotelGroup.guests?.filter(g => g.roomId === room.id).length > 0 ? (
                        <div className="ml-4 space-y-1">
                          {hotelGroup.guests.filter(g => g.roomId === room.id).map((guest, idx) => (
                            <div
                              key={guest.assignmentId}
                              className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-5 h-5 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full text-xs">
                                  {idx + 1}
                                </span>
                                <span className="font-medium">{guest.name}</span>
                                {guest.extraNights > 0 && (
                                  <span className="text-orange-600 text-xs">+{guest.extraNights} ночей</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500 text-xs">
                                  {formatDate(guest.checkIn)} - {formatDate(guest.checkOut)} ({guest.nights} н.)
                                </span>
                                <button
                                  onClick={() => deleteAssignment(guest.assignmentId)}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ml-4 py-2 px-3 bg-gray-50 rounded text-sm text-gray-500 italic">
                          Нет назначенных гостей
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Нет размещения в отелях. Сначала добавьте номера во вкладке "Размещение".
        </div>
      )}

      {/* Assignment Modal */}
      {assignModalOpen && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Назначить в номер
              </h2>
              <button onClick={() => setAssignModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium">{selectedRoom.roomType?.name}</div>
                <div className="text-gray-500">
                  {formatDate(selectedRoom.checkInDate)} - {formatDate(selectedRoom.checkOutDate)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Участник *</label>
                <select
                  value={assignForm.participantId}
                  onChange={(e) => setAssignForm({ ...assignForm, participantId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Выберите участника</option>
                  {unassignedParticipants?.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.fullName || `${p.lastName}, ${p.firstName}`}
                      {p.roomPreference && ` (${p.roomPreference})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-in (опц.)
                  </label>
                  <input
                    type="date"
                    value={assignForm.checkInDate}
                    onChange={(e) => setAssignForm({ ...assignForm, checkInDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-out (опц.)
                  </label>
                  <input
                    type="date"
                    value={assignForm.checkOutDate}
                    onChange={(e) => setAssignForm({ ...assignForm, checkOutDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Доп. ночи</label>
                <input
                  type="number"
                  value={assignForm.extraNights}
                  onChange={(e) => setAssignForm({ ...assignForm, extraNights: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                <input
                  type="text"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="3 Nights, Late checkout..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveAssignment}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Назначить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
