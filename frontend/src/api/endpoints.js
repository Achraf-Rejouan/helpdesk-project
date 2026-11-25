import api from './client'

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),
}

export const ticketsApi = {
  list: (params) => api.get('/tickets', { params }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (payload) => api.post('/tickets', payload),
  update: (id, payload) => api.put(`/tickets/${id}`, payload),
  remove: (id) => api.delete(`/tickets/${id}`),
  updateStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  assign: (id, technicianId) => api.patch(`/tickets/${id}/assign/${technicianId}`),
  unassign: (id) => api.patch(`/tickets/${id}/unassign`),
  byStatus: (status, params) => api.get(`/tickets/status/${status}`, { params }),
  byPriority: (priority, params) => api.get(`/tickets/priority/${priority}`, { params }),
  byCategory: (categoryId, params) => api.get(`/tickets/category/${categoryId}`, { params }),
  byTechnician: (technicianId, params) =>
    api.get(`/tickets/technician/${technicianId}`, { params }),
  byEmployee: (employeeId, params) =>
    api.get(`/tickets/employee/${employeeId}`, { params }),
  search: (keyword, params) => api.get('/tickets/search', { params: { ...params, keyword } }),
}

export const commentsApi = {
  listForTicket: (ticketId) => api.get(`/tickets/${ticketId}/comments`),
  create: (ticketId, content) => api.post(`/tickets/${ticketId}/comments`, { content }),
  update: (id, content) => api.put(`/comments/${id}`, { content }),
  remove: (id) => api.delete(`/comments/${id}`),
}

export const employeesApi = {
  list: () => api.get('/employees'),
  get: (id) => api.get(`/employees/${id}`),
  update: (id, payload) => api.put(`/employees/${id}`, payload),
  remove: (id) => api.delete(`/employees/${id}`),
}

export const techniciansApi = {
  list: () => api.get('/technicians'),
  available: () => api.get('/technicians/available'),
  get: (id) => api.get(`/technicians/${id}`),
  create: (payload) => api.post('/technicians', payload),
  update: (id, payload) => api.put(`/technicians/${id}`, payload),
  remove: (id) => api.delete(`/technicians/${id}`),
  bySpecialization: (keyword) =>
    api.get('/technicians/specialization', { params: { keyword } }),
}

export const categoriesApi = {
  list: () => api.get('/categories'),
  get: (id) => api.get(`/categories/${id}`),
  create: (payload) => api.post('/categories', payload),
  update: (id, payload) => api.put(`/categories/${id}`, payload),
  remove: (id) => api.delete(`/categories/${id}`),
}
