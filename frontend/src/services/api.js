// src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// Source Database API
export const sourceAPI = {
  // Browse source recipients with filters
  browseRecipients: (params) => 
    api.get('/source/browse/', { params }),
  
  // Import recipients
  importRecipients: (data) => 
    api.post('/source/import_recipients/', data),
  
  // Get source stats
  getStats: () => 
    api.get('/source/stats/'),
};

// Recipients API
export const recipientsAPI = {
  // Get all imported recipients
  getRecipients: (params) => 
    api.get('/recipients/', { params }),
  
  // Get recipient by ID
  getRecipient: (id) => 
    api.get(`/recipients/${id}/`),
  
  // Delete recipient
  deleteRecipient: (id) => 
    api.delete(`/recipients/${id}/`),
  
  // Bulk delete
  bulkDelete: (ids) => 
    api.delete('/recipients/bulk_delete/', { data: { ids } }),
  
  // Dashboard stats
  getDashboard: () => 
    api.get('/recipients/dashboard/'),
};

// Emails API
export const emailsAPI = {
  // Get all emails with filters
  getEmails: (params) => 
    api.get('/emails/', { params }),
  
  // Get email by ID
  getEmail: (id) => 
    api.get(`/emails/${id}/`),
  
  // Update email
  updateEmail: (id, data) => 
    api.patch(`/emails/${id}/`, data),
  
  // Delete email
  deleteEmail: (id) => 
    api.delete(`/emails/${id}/`),
  
  // Generate emails batch
  generateBatch: (data) => 
    api.post('/emails/generate_batch/', data),
  
  // Email actions
  approveEmail: (id) => 
    api.post(`/emails/${id}/approve/`),
  
  rejectEmail: (id, reason) => 
    api.post(`/emails/${id}/reject/`, { reason }),
  
  regenerateEmail: (id, templateId) => 
    api.post(`/emails/${id}/regenerate/`, { template_id: templateId }),
  
  editEmailContent: (id, data) => 
    api.post(`/emails/${id}/edit_content/`, data),
  
  scheduleEmail: (id, scheduledFor) => 
    api.post(`/emails/${id}/schedule/`, { scheduled_for: scheduledFor }),
  
  sendEmail: (id) => 
    api.post(`/emails/${id}/send/`),
  
  // Bulk actions
  bulkAction: (data) => 
    api.post('/emails/bulk_action/', data),
  
  // Send batch
  sendBatch: (data) => 
    api.post('/emails/send_batch/', data),
  
  // Get scheduled emails
  getScheduled: () => 
    api.get('/emails/scheduled_emails/'),
  
  // Dashboard stats
  getDashboard: () => 
    api.get('/emails/dashboard/'),
};

// Templates API
export const templatesAPI = {
  // Get all templates
  getTemplates: (params) => 
    api.get('/templates/', { params }),
  
  // Get template by ID
  getTemplate: (id) => 
    api.get(`/templates/${id}/`),
  
  // Create template
  createTemplate: (data) => 
    api.post('/templates/', data),
  
  // Update template
  updateTemplate: (id, data) => 
    api.patch(`/templates/${id}/`, data),
  
  // Delete template
  deleteTemplate: (id) => 
    api.delete(`/templates/${id}/`),
  
  // Get by category
  getByCategory: (category) => 
    api.get(`/templates/by_category/?category=${category}`),
};

// Campaigns API
export const campaignsAPI = {
  // Get all campaigns
  getCampaigns: () => 
    api.get('/campaigns/'),
  
  // Get campaign by ID
  getCampaign: (id) => 
    api.get(`/campaigns/${id}/`),
  
  // Create campaign
  createCampaign: (data) => 
    api.post('/campaigns/', data),
  
  // Update campaign
  updateCampaign: (id, data) => 
    api.patch(`/campaigns/${id}/`, data),
  
  // Delete campaign
  deleteCampaign: (id) => 
    api.delete(`/campaigns/${id}/`),
  
  // Get campaign stats
  getCampaignStats: (id) => 
    api.get(`/campaigns/${id}/stats/`),
};

// Logs API
export const logsAPI = {
  // Get all logs
  getLogs: (params) => 
    api.get('/logs/', { params }),
  
  // Get log by ID
  getLog: (id) => 
    api.get(`/logs/${id}/`),
};

// Settings API
export const settingsAPI = {
  // Get all settings
  getSettings: () => 
    api.get('/settings/'),
  
  // Get system settings
  getSystemSettings: () => 
    api.get('/settings/system_settings/'),
  
  // Update setting
  updateSetting: (id, data) => 
    api.patch(`/settings/${id}/`, data),
  
  // Create setting
  createSetting: (data) => 
    api.post('/settings/', data),
};

// Scheduler API
export const schedulerAPI = {
  // Get scheduler status
  getStatus: () => 
    api.get('/scheduler/status/'),
  
  // Run scheduler
  runScheduler: () => 
    api.post('/scheduler/'),
};

export default api;