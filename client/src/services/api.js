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
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status })
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

export default api;
