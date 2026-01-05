import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API для бронирований
export const bookingsApi = {
  getAll: (params) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.put(`/bookings/${id}`, data),
  delete: (id) => api.delete(`/bookings/${id}`),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  // Размещение в отелях
  getRooms: (bookingId) => api.get(`/bookings/${bookingId}/rooms`),
  addRoom: (bookingId, data) => api.post(`/bookings/${bookingId}/rooms`, data),
  updateRoom: (bookingId, roomId, data) => api.put(`/bookings/${bookingId}/rooms/${roomId}`, data),
  deleteRoom: (bookingId, roomId) => api.delete(`/bookings/${bookingId}/rooms/${roomId}`),
  checkRoomAvailability: (bookingId, params) => api.get(`/bookings/${bookingId}/rooms/availability`, { params }),
  // Rooming List
  getRoomingList: (bookingId) => api.get(`/bookings/${bookingId}/rooming-list`),
  // Hotel Requests
  getHotelRequests: (bookingId) => api.get(`/bookings/${bookingId}/hotel-requests`),
  getHotelRequest: (bookingId, hotelId) => api.get(`/bookings/${bookingId}/hotel-requests/${hotelId}`),
  // Cost Summary
  getCostSummary: (bookingId) => api.get(`/bookings/${bookingId}/cost-summary`),
  // Accommodations (новая структура размещения)
  getAccommodations: (bookingId) => api.get(`/bookings/${bookingId}/accommodations`),
  createAccommodation: (bookingId, data) => api.post(`/bookings/${bookingId}/accommodations`, data),
  updateAccommodation: (bookingId, accId, data) => api.put(`/bookings/${bookingId}/accommodations/${accId}`, data),
  deleteAccommodation: (bookingId, accId) => api.delete(`/bookings/${bookingId}/accommodations/${accId}`),
  // Справочник типов размещения
  getAccommodationRoomTypes: () => api.get('/bookings/accommodation-room-types')
};

// API для участников тура
export const participantsApi = {
  getAll: (bookingId) => api.get(`/bookings/${bookingId}/participants`),
  create: (bookingId, data) => api.post(`/bookings/${bookingId}/participants`, data),
  update: (bookingId, id, data) => api.put(`/bookings/${bookingId}/participants/${id}`, data),
  delete: (bookingId, id) => api.delete(`/bookings/${bookingId}/participants/${id}`),
  bulkCreate: (bookingId, participants) => api.post(`/bookings/${bookingId}/participants/bulk`, { participants }),
  // Import with preview
  importPreview: (bookingId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/bookings/${bookingId}/participants/import/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  import: (bookingId, participants) => api.post(`/bookings/${bookingId}/participants/import`, { participants }),
  // Export
  exportExcel: (bookingId) => api.get(`/bookings/${bookingId}/participants/export/excel`, { responseType: 'blob' }),
  exportPdf: (bookingId) => api.get(`/bookings/${bookingId}/participants/export/pdf`, { responseType: 'blob' }),
  // Room Assignments
  createAssignment: (bookingId, data) => api.post(`/bookings/${bookingId}/room-assignments`, data),
  updateAssignment: (bookingId, id, data) => api.put(`/bookings/${bookingId}/room-assignments/${id}`, data),
  deleteAssignment: (bookingId, id) => api.delete(`/bookings/${bookingId}/room-assignments/${id}`)
};

// API для гидов
export const guidesApi = {
  getAll: (includeInactive = false) => api.get('/guides', { params: { includeInactive } }),
  getById: (id) => api.get(`/guides/${id}`),
  create: (data) => api.post('/guides', data),
  update: (id, data) => api.put(`/guides/${id}`, data),
  delete: (id) => api.delete(`/guides/${id}`),
  getAlerts: () => api.get('/guides/alerts'),
  getPayments: (id, params) => api.get(`/guides/${id}/payments`, { params }),
  addPayment: (id, data) => api.post(`/guides/${id}/payments`, data)
};

// API для типов туров
export const tourTypesApi = {
  getAll: (includeInactive = false) => api.get('/tour-types', { params: { includeInactive } }),
  getById: (id) => api.get(`/tour-types/${id}`),
  create: (data) => api.post('/tour-types', data),
  update: (id, data) => api.put(`/tour-types/${id}`, data),
  delete: (id) => api.delete(`/tour-types/${id}`)
};

// API для импорта
export const importApi = {
  preview: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  execute: (filePath) => api.post('/import/execute', { filePath }),
  downloadTemplate: () => api.get('/import/template', { responseType: 'blob' })
};

// API для дашборда
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getUpcoming: (limit = 10) => api.get('/dashboard/upcoming', { params: { limit } }),
  getMonthly: (year) => api.get('/dashboard/monthly', { params: { year } }),
  getGuideWorkload: () => api.get('/dashboard/guide-workload')
};

// API для пользователей
export const usersApi = {
  getAll: () => api.get('/auth/users'),
  create: (data) => api.post('/auth/register', data),
  update: (id, data) => api.patch(`/auth/users/${id}`, data)
};

// API для городов
export const citiesApi = {
  getAll: (includeInactive = false) => api.get('/cities', { params: { includeInactive } }),
  getById: (id) => api.get(`/cities/${id}`),
  create: (data) => api.post('/cities', data),
  update: (id, data) => api.put(`/cities/${id}`, data),
  delete: (id) => api.delete(`/cities/${id}`)
};

// API для отелей
export const hotelsApi = {
  getAll: (params) => api.get('/hotels', { params }),
  getById: (id) => api.get(`/hotels/${id}`),
  create: (data) => api.post('/hotels', data),
  update: (id, data) => api.put(`/hotels/${id}`, data),
  delete: (id) => api.delete(`/hotels/${id}`),
  // Room Types
  getRoomTypes: (hotelId) => api.get(`/hotels/${hotelId}/room-types`),
  createRoomType: (hotelId, data) => api.post(`/hotels/${hotelId}/room-types`, data),
  updateRoomType: (hotelId, id, data) => api.put(`/hotels/${hotelId}/room-types/${id}`, data),
  deleteRoomType: (hotelId, id) => api.delete(`/hotels/${hotelId}/room-types/${id}`),
  // Images
  getImages: (hotelId) => api.get(`/hotels/${hotelId}/images`),
  uploadImage: (hotelId, formData) => api.post(`/hotels/${hotelId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateImage: (hotelId, imageId, data) => api.put(`/hotels/${hotelId}/images/${imageId}`, data),
  deleteImage: (hotelId, imageId) => api.delete(`/hotels/${hotelId}/images/${imageId}`),
  reorderImages: (hotelId, imageIds) => api.put(`/hotels/${hotelId}/images/reorder`, { imageIds }),
  // Seasonal Pricing
  getSeasonalPrices: (hotelId, roomTypeId) => api.get(`/hotels/${hotelId}/room-types/${roomTypeId}/seasonal-prices`),
  createSeasonalPrice: (hotelId, roomTypeId, data) => api.post(`/hotels/${hotelId}/room-types/${roomTypeId}/seasonal-prices`, data),
  updateSeasonalPrice: (hotelId, roomTypeId, id, data) => api.put(`/hotels/${hotelId}/room-types/${roomTypeId}/seasonal-prices/${id}`, data),
  deleteSeasonalPrice: (hotelId, roomTypeId, id) => api.delete(`/hotels/${hotelId}/room-types/${roomTypeId}/seasonal-prices/${id}`),
  getPriceForDate: (hotelId, roomTypeId, date) => api.get(`/hotels/${hotelId}/room-types/${roomTypeId}/price`, { params: { date } })
};

export default api;
