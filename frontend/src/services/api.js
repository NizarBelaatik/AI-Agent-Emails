// src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth tokens if needed
api.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,  // Automatically extract data
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error('Unauthorized access');
    }
    return Promise.reject(error.response?.data || error);
  }
);

// Source Database API
export const sourceAPI = {
  // Browse source recipients with filters
  browse: (params) => 
    api.get('/api/source/browse/', { params }),
  
  // Import recipients
  importRecipients: (data) => 
    api.post('/api/source/import/', data),
  
  // Get source stats
  getStats: () => 
    api.get('/api/source/stats/'),
};

// Recipients API
export const recipientsAPI = {
  // Get all imported recipients
  getRecipients: (params) => 
    api.get('/api/recipients/', { params }),
  
  // Get recipient by ID
  getRecipient: (id) => 
    api.get(`/api/recipients/${id}/`),
  
  // Delete recipient
  deleteRecipient: (id) => 
    api.delete(`/api/recipients/${id}/`),
  
  // Bulk delete
  bulkDelete: (ids) => 
    api.post('/api/recipients/bulk_delete/', { ids }),
  
  // Dashboard stats
  getDashboard: () => 
    api.get('/api/recipients/stats/'),
  
  // Sync with source
  sync: () => 
    api.post('/api/recipients/sync/'),
};

// Emails API
export const emailsAPI = {
  // Get all emails with filters
  getEmails: (params) => 
    api.get('/api/emails/', { params }),
  
  // Get email by ID
  getEmail: (id) => 
    api.get(`/api/emails/${id}/`),
  
  // Update email
  updateEmail: (id, data) => 
    api.patch(`/api/emails/${id}/`, data),
  
  // Delete email
  deleteEmail: (id) => 
    api.delete(`/api/emails/${id}/`),
  
  // Generate emails batch
  generateBatch: (data) => 
    api.post('/api/emails/generate/', data),
  
  // Email actions
  approveEmail: (id) => 
    api.post(`/api/emails/${id}/approve/`),
  
  rejectEmail: (id, reason) => 
    api.post(`/api/emails/${id}/reject/`, { reason }),
  
  // Send approved emails
  sendApproved: () => 
    api.post('/api/emails/send_approved/'),
  
  // Bulk actions
  bulkAction: (data) => 
    api.post('/api/emails/bulk_action/', data),
  
  // Get email stats
  getStats: () => 
    api.get('/api/emails/stats/'),
};

// Templates API
export const templatesAPI = {
  // Get all templates
  getTemplates: (params) => 
    api.get('/api/templates/', { params }),
  
  // Get template by ID
  getTemplate: (id) => 
    api.get(`/api/templates/${id}/`),
  
  // Create template
  createTemplate: (data) => 
    api.post('/api/templates/', data),
  
  // Update template
  updateTemplate: (id, data) => 
    api.patch(`/api/templates/${id}/`, data),
  
  // Delete template
  deleteTemplate: (id) => 
    api.delete(`/api/templates/${id}/`),
};

// Logs API
export const logsAPI = {
  // Get all logs
  getLogs: (params) => 
    api.get('/api/logs/', { params }),
  
  // Get log by ID
  getLog: (id) => 
    api.get(`/api/logs/${id}/`),
};

// Dashboard API
export const dashboardAPI = {
  getDashboard: () => 
    api.get('/api/dashboard/'),
};

// Health API
export const healthAPI = {
  check: () => 
    api.get('/api/health/'),
};


// Settings API
export const settingsAPI = {
  // Get all settings
  getSettings: () => 
    api.get('/api/settings/'),
  
  // Get system settings
  getSystemSettings: () => 
    api.get('/api/settings/system_settings/'),
  
  // Update setting
  updateSetting: (id, data) => 
    api.patch(`/api/settings/${id}/`, data),
  
  // Create setting
  createSetting: (data) => 
    api.post('/api/settings/', data),
};

export default api;

