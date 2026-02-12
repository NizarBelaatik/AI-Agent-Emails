// src/services/api.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, //30000,
});

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return Promise.reject(error.response?.data || { error: 'Network or server error' });
  }
);

export const importerAPI = {
  browseSource: (params = {}) =>
    api.get('/importer/browse-source/', { params }),

  getSourceStats: () =>
    api.get('/importer/source-stats/'),

  importRecipients: (data) =>
    api.post('/importer/import-recipients/', data),
  
  getImported: (params = {}) => 
    api.get('/importer/imported/', { params }),
};

export const emailGenerationAPI = {
  getRecipients: (params = {}) =>
    api.get('/email-generation/recipients/', { params }),

  getCategories: () =>
    api.get('/email-generation/categories/'),

  generateTemplate: (categoryId, data = {}) =>
    api.post(`/email-generation/templates/generate/${categoryId}/`, data),

  getTemplates: () =>
    api.get('/email-generation/templates/'),

  generateEmails: (data) =>
    api.post('/email-generation/emails/generate/', data),



  startGeneration: (data) => 
    api.post('/email-generation/start-generation/', data),
  
  getTaskStatus: (taskId) => 
    api.get(`/email-generation/tasks/${taskId}/status/`),

};


export default api;