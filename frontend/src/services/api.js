// src/services/api.js - FIXED INTERCEPTOR
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
});

// Remove the response interceptor that modifies the response
// Instead, handle errors only
api.interceptors.response.use(
  response => response,  // ← Return full response, not just data
  error => {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return Promise.reject(error.response?.data || { error: 'Network or server error' });
  }
);

export const dashboardAPI = {
  getStats: async () => {
    try {
      const response = await api.get('/email-generation/dashboard/stats/');
      return response.data;  // Extract data here
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },
  
  getGenerationQueue: async () => {
    try {
      const response = await api.get('/email-generation/queue/generation/');
      return response.data;
    } catch (error) {
      console.error('Error fetching generation queue:', error);
      return {
        pending: [],
        generating: [],
        stats: {
          total_in_queue: 0,
          pending_count: 0,
          generating_count: 0,
          estimated_time: '0 secondes',
        }
      };
    }
  },

  getSendingQueue: async () => {
    try {
      const response = await api.get('/email-generation/queue/sending/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  getEmailStatus: async (emailId = null, params = {}) => {
    try {
      const url = emailId 
        ? `/email-generation/emails/${emailId}/status/`
        : '/email-generation/emails/status/';
      const response = await api.get(url, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  regenerateEmail: async (recipientId, category) => {
    try {
      const response = await api.post('/email-generation/emails/generate/', {
        recipient_ids: [recipientId],
        category_name: category,
        force: true
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export const importerAPI = {
  browseSource: async (params = {}) => {
    try {
      const response = await api.get('/importer/browse-source/', { params });
      return response.data;  // Extract data here
    } catch (error) {
      console.error('Browse source error:', error);
      throw error;
    }
  },

  getSourceStats: async () => {
    try {
      const response = await api.get('/importer/source-stats/');
      return response.data;
    } catch (error) {
      console.error('Get source stats error:', error);
      throw error;
    }
  },

  importRecipients: async (data) => {
    try {
      const response = await api.post('/importer/import-recipients/', data);
      return response.data;
    } catch (error) {
      console.error('Import recipients error:', error);
      throw error;
    }
  },
  
  getImported: async (params = {}) => {
    try {
      const response = await api.get('/importer/imported/', { params });
      return response.data;
    } catch (error) {
      console.error('Get imported error:', error);
      throw error;
    }
  },
  
  getInvalidRecipients: async () => {
    try {
      const response = await api.get('/importer/invalid-recipients/');
      return response.data;
    } catch (error) {
      console.error('Get invalid recipients error:', error);
      throw error;
    }
  },
};

export const emailGenerationAPI = {
  getRecipients: async (params = {}) => {
    try {
      const response = await api.get('/email-generation/recipients/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getCategories: async () => {
    try {
      const response = await api.get('/email-generation/categories/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  generateTemplate: async (categoryId, data = {}) => {
    try {
      const response = await api.post(`/email-generation/templates/generate/${categoryId}/`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getTemplates: async () => {
    try {
      const response = await api.get('/email-generation/templates/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  startGeneration: async (data) => {
    try {
      const response = await api.post('/email-generation/start-generation/', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  generateEmails: async (payload) => {
    try {
      const response = await api.post('/email-generation/emails/generate/', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  getTaskStatus: async (taskId) => {
    try {
      const response = await api.get(`/email-generation/tasks/${taskId}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  getTasks: async () => {
    try {
      const response = await api.get('/email-generation/tasks/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  cancelTask: async (taskId) => {
    try {
      const response = await api.post(`/email-generation/tasks/${taskId}/cancel/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default api;