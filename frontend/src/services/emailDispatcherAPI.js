import api from './api';

const emailDispatcherAPI = {
  // Get available recipients from data_importer
  getAvailableRecipients: async (params = {}) => {
    try {
      const response = await api.get('/email-dispatcher/available-recipients/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching available recipients:', error);
      return { results: [], count: 0 };
    }
  },

  // Get all activities for filter
  getActivities: async () => {
    try {
      const response = await api.get('/email-dispatcher/activities/');
      return response.data;
    } catch (error) {
      console.error('Error fetching activities:', error);
      return [];
    }
  },

  // Create emails from selected recipients
  createEmails: async (data) => {
    try {
      const response = await api.post('/email-dispatcher/create-from-recipients/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating emails:', error);
      throw error;
    }
  },

  // Get all emails
  getEmails: async (params = {}) => {
    try {
      const response = await api.get('/email-dispatcher/emails/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching emails:', error);
      return { results: [], count: 0 };
    }
  },

  // Get email stats
  getEmailStats: async () => {
    try {
      const response = await api.get('/email-dispatcher/emails/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching email stats:', error);
      return {
        total: 0, pending: 0, queued: 0,
        sending: 0, sent: 0, failed: 0, sent_today: 0
      };
    }
  },

  // Send selected emails
  sendEmails: async (data) => {
    try {
      const response = await api.post('/email-dispatcher/send/', data);
      return response.data;
    } catch (error) {
      console.error('Error sending emails:', error);
      throw error;
    }
  },

  // Get all batches
  getBatches: async (limit = 20) => {
    try {
      const response = await api.get('/email-dispatcher/batches/', { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching batches:', error);
      return [];
    }
  },

  // Get batch details
  getBatch: async (batchId) => {
    try {
      const response = await api.get(`/email-dispatcher/batches/${batchId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batch:', error);
      throw error;
    }
  },

  // Cancel batch
  cancelBatch: async (batchId) => {
    try {
      const response = await api.post(`/email-dispatcher/batches/${batchId}/cancel/`);
      return response.data;
    } catch (error) {
      console.error('Error cancelling batch:', error);
      throw error;
    }
  },

  // Get sent emails
  getSentEmails: async (params = {}) => {
    try {
      const response = await api.get('/email-dispatcher/sent/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching sent emails:', error);
      return { results: [], count: 0 };
    }
  },
};

export default emailDispatcherAPI;