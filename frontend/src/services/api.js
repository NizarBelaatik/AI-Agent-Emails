// src/services/api.js - FIXED INTERCEPTOR
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
//const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.39:8000';


//const API_BASE = 'http://django_backend:8000/api';
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

  getImportTaskStatus: async (taskId) => {
    try {
      const response = await api.get(`/importer/import-tasks/${taskId}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  cancelImportTask: async (taskId) => {
    try {
      const response = await api.post(`/importer/import-tasks/${taskId}/cancel/`);
      return response.data;
    } catch (error) {
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

  regenerateEmail: async (emailId, category) => {
    try {
      const response = await api.post(`/email-generation/emails/${emailId}/regenerate/`, {
        category_name: category
      });
      return response.data;
    } catch (error) {
      console.error('Error in regenerateEmail:', error);
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


   getEmailStatus: async (emailId = null, params = {}) => {
    try {
      let url = '/email-generation/emails/';
      if (emailId) {
        url = `/email-generation/emails/${emailId}/`;
      }
      
      const response = await api.get(url, { params });
      return response.data;
    } catch (error) {
      console.error('Error in getEmailStatus:', error);
      throw error;
    }
  },
  
  // Mark emails as ready for sending
  markEmailsReady: async (data) => {
    try {
      const response = await api.post('/email-generation/emails/mark-ready/', data);
      return response.data;
    } catch (error) {
      console.error('Error in markEmailsReady:', error);
      throw error;
    }
  },


  
};


export const emailSenderAPI = {
  // List ready emails (paginated, filterable)
  getReadyEmails: async (params = {}) => {
    try {
      const response = await api.get('/email-sender/emails/ready/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching ready emails:', error);
      return { results: [], total: 0, page: 1, page_size: 50 };
    }
  },

  // Start batch sending
  sendBatch: async (payload) => {
    try {
      const response = await api.post('/email-sender/send-batch/', payload);
      return response.data;
    } catch (error) {
      console.error('Error starting batch:', error);
      throw error;
    }
  },

  // Get live status of a batch
  getBatchStatus: async (batchId) => {
    try {
      const response = await api.get(`/email-sender/batches/${batchId}/`);
      return response.data;
    } catch (error) {
      console.error('Error getting batch status:', error);
      throw error;
    }
  },

  // List recent batches
  getBatches: async (params = {}) => {
    try {
      const response = await api.get('/email-sender/batches/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching batches:', error);
      return [];
    }
  },

  // Cancel batch
  cancelBatch: async (batchId) => {
    try {
      const response = await api.post(`/email-sender/batches/${batchId}/cancel/`);
      return response.data;
    } catch (error) {
      console.error('Error canceling batch:', error);
      throw error;
    }
  },

  // Retry failed emails in batch
  retryFailed: async (batchId) => {
    try {
      const response = await api.post(`/email-sender/batches/${batchId}/retry-failed/`);
      return response.data;
    } catch (error) {
      console.error('Error retrying failed emails:', error);
      throw error;
    }
  },

  // Sending dashboard stats
  getSendingStats: async () => {
    try {
      const response = await api.get('/email-sender/dashboard/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching sending stats:', error);
      return {
        ready: 0,
        sending: 0,
        sent_today: 0,
        failed_today: 0,
        active_batches: 0,
      };
    }
  },

  // Single email sending status
  getEmailStatus: async (emailId) => {
    try {
      const response = await api.get(`/email-sender/emails/${emailId}/status/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching email status:', error);
      throw error;
    }
  },
};






export default api;