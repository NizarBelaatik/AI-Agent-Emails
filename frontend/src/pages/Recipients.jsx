import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Trash2, RefreshCw, Eye, 
  Mail, ChevronLeft, ChevronRight, Users, CheckCircle,
  XCircle, Calendar, MapPin, Building
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { recipientsAPI, emailsAPI } from '../services/api';

const Recipients = () => {
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState(new Set());
  const [filters, setFilters] = useState({
    search: '',
    x_activitec: '',
    city: '',
    is_active: true,
    has_emails: 'all', // 'all', 'with', 'without'
  });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewRecipient, setPreviewRecipient] = useState(null);

  useEffect(() => {
    fetchRecipients();
    fetchStats();
  }, [filters]);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.x_activitec) params.x_activitec = filters.x_activitec;
      if (filters.city) params.city = filters.city;
      if (filters.is_active !== undefined) params.is_active = filters.is_active;
      
      const response = await recipientsAPI.getAll(params);
      let data = response.data;
      
      // Filter by email status if needed
      if (filters.has_emails === 'with') {
        data = data.filter(recipient => recipient.emails && recipient.emails.length > 0);
      } else if (filters.has_emails === 'without') {
        data = data.filter(recipient => !recipient.emails || recipient.emails.length === 0);
      }
      
      setRecipients(data);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      alert('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await recipientsAPI.getDashboard();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRecipients.size === recipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map(r => r.id)));
    }
  };

  const toggleSelectRecipient = (id) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecipients(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedRecipients.size === 0) {
      alert('Please select recipients to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedRecipients.size} recipients?`)) {
      return;
    }

    try {
      const response = await recipientsAPI.bulkDelete(Array.from(selectedRecipients));
      alert(`Successfully deleted ${response.data.deleted_count} recipients`);
      setSelectedRecipients(new Set());
      fetchRecipients();
      fetchStats();
    } catch (error) {
      console.error('Error deleting recipients:', error);
      alert('Failed to delete recipients');
    }
  };

  const handleSyncWithSource = async () => {
    try {
      const response = await recipientsAPI.syncWithSource();
      alert(`Synced with source: Updated ${response.data.updated}, Deactivated ${response.data.deactivated}`);
      fetchRecipients();
      fetchStats();
    } catch (error) {
      console.error('Error syncing with source:', error);
      alert('Failed to sync with source database');
    }
  };

  const generateEmailsForSelected = async () => {
    if (selectedRecipients.size === 0) {
      alert('Please select recipients to generate emails for');
      return;
    }

    const templateId = prompt('Enter template ID to use:', '1');
    if (!templateId) return;

    try {
      const response = await emailsAPI.generateBatch({
        recipient_ids: Array.from(selectedRecipients),
        template_id: templateId,
      });
      
      const successCount = response.data.summary?.success || 0;
      alert(`Generated ${successCount} emails successfully`);
      setSelectedRecipients(new Set());
    } catch (error) {
      console.error('Error generating emails:', error);
      alert('Failed to generate emails');
    }
  };

  const getUniqueValues = (key) => {
    return [...new Set(recipients.map(r => r[key]).filter(Boolean))];
  };

  return (
    <div>
      <Header
        title="Imported Recipients"
        description="Manage recipients imported from source database"
      />

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total Imported</p>
                <p className="text-2xl font-bold text-blue-800">{stats.total || 0}</p>
                <p className="text-xs text-blue-600">Recipients</p>
              </div>
              <Users className="text-blue-600" size={24} />
            </div>
          </Card>
          <Card className="bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Active</p>
                <p className="text-2xl font-bold text-green-800">{stats.active || 0}</p>
                <p className="text-xs text-green-600">Ready for emails</p>
              </div>
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </Card>
          <Card className="bg-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">With Emails</p>
                <p className="text-2xl font-bold text-purple-800">{stats.with_emails || 0}</p>
                <p className="text-xs text-purple-600">Already have emails</p>
              </div>
              <Mail className="text-purple-600" size={24} />
            </div>
          </Card>
          <Card className="bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Categories</p>
                <p className="text-2xl font-bold text-yellow-800">{stats.by_category?.length || 0}</p>
                <p className="text-xs text-yellow-600">Unique categories</p>
              </div>
              <Filter className="text-yellow-600" size={24} />
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        {/* Filters & Actions */}
        <Card title="Filters & Actions">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Name, email, or city"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  x_activitec
                </label>
                <select
                  value={filters.x_activitec}
                  onChange={(e) => setFilters({...filters, x_activitec: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {getUniqueValues('x_activitec').map((cat, index) => (
                    <option key={index} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => setFilters({...filters, city: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Cities</option>
                  {getUniqueValues('city').map((city, index) => (
                    <option key={index} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Status
                </label>
                <select
                  value={filters.has_emails}
                  onChange={(e) => setFilters({...filters, has_emails: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Recipients</option>
                  <option value="with">With Emails</option>
                  <option value="without">Without Emails</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                >
                  {selectedRecipients.size === recipients.length && recipients.length > 0 ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="outline"
                  onClick={fetchRecipients}
                >
                  <RefreshCw size={16} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSyncWithSource}
                >
                  Sync with Source
                </Button>
              </div>
              <div className="flex gap-3">
                <div className="text-sm text-gray-600">
                  {recipients.length} recipients
                </div>
                <Button
                  variant="primary"
                  onClick={generateEmailsForSelected}
                  disabled={selectedRecipients.size === 0}
                >
                  <Mail size={16} />
                  Generate Emails ({selectedRecipients.size})
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={selectedRecipients.size === 0}
                >
                  <Trash2 size={16} />
                  Delete ({selectedRecipients.size})
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Recipients Table */}
        <Card title="Recipients List">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading recipients...</p>
              </div>
            </div>
          ) : recipients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-600">No recipients found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your filters or <a href="/import" className="text-primary-600 hover:underline">import from source</a>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.size === recipients.length && recipients.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">City</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Emails</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Last Contact</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => (
                    <tr 
                      key={recipient.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.has(recipient.id)}
                          onChange={() => toggleSelectRecipient(recipient.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{recipient.full_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-600">{recipient.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {recipient.x_activitec || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin size={12} />
                          {recipient.city || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${recipient.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {recipient.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${recipient.emails?.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {recipient.emails?.length || 0} emails
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600">
                          {recipient.last_interaction ? new Date(recipient.last_interaction).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewRecipient(recipient)}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Navigate to generate page with this recipient
                              window.location.href = `/generate?recipient=${recipient.id}`;
                            }}
                          >
                            <Mail size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Recipients</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete {selectedRecipients.size} selected recipients?
                This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleBulkDelete}
                >
                  Delete {selectedRecipients.size} Recipients
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {previewRecipient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Recipient Details</h2>
              <button
                onClick={() => setPreviewRecipient(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">ID</label>
                    <p className="mt-1 font-mono">{previewRecipient.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Source ID</label>
                    <p className="mt-1 font-mono">{previewRecipient.source_id || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="mt-1 text-lg font-medium">{previewRecipient.full_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1">{previewRecipient.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">x_activitec</label>
                    <p className="mt-1">{previewRecipient.x_activitec || 'General'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">City</label>
                    <p className="mt-1">{previewRecipient.city || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Company</label>
                    <p className="mt-1">{previewRecipient.company ? 'Company' : 'Individual'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <p className={`mt-1 px-2 py-1 rounded text-xs inline-block ${previewRecipient.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {previewRecipient.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Generated Emails</label>
                  <div className="mt-2 space-y-2">
                    {previewRecipient.emails?.length > 0 ? (
                      previewRecipient.emails.slice(0, 5).map(email => (
                        <div key={email.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{email.subject}</span>
                          <span className={`px-2 py-1 rounded text-xs ${email.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {email.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No emails generated yet</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Imported</label>
                    <p className="mt-1">
                      {previewRecipient.imported_at ? new Date(previewRecipient.imported_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Last Contact</label>
                    <p className="mt-1">
                      {previewRecipient.last_interaction ? new Date(previewRecipient.last_interaction).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = `/generate?recipient=${previewRecipient.id}`;
                }}
              >
                <Mail size={16} />
                Generate Email
              </Button>
              <Button
                onClick={() => setPreviewRecipient(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recipients;