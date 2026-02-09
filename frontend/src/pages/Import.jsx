import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Upload, Check, 
  X, ChevronLeft, ChevronRight, Database, RefreshCw, Eye, Users
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { sourceAPI } from '../services/api';

const Import = () => {
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState(new Set());
  const [filters, setFilters] = useState({
    search: '',
    x_activitec: '',
    active_only: true,
    has_email: true,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [previewRecipient, setPreviewRecipient] = useState(null);

  useEffect(() => {
    fetchRecipients();
    fetchStats();
  }, [filters, pagination.page]);

  // src/pages/Import.jsx (partial fix)
const fetchRecipients = async () => {
  try {
    setLoading(true);
    const params = {
      ...filters,
      page: pagination.page,
      page_size: pagination.pageSize,
    };
    
    const response = await sourceAPI.browse(params);
    // Now response is already the data object from axios interceptor
    if (response.success) {
      setRecipients(response.data || []);
      setPagination(prev => ({
        ...prev,
        totalCount: response.pagination?.total || 0,
        totalPages: response.pagination?.pages || 1
      }));
    } else {
      alert(response.error || 'Failed to load recipients');
    }
  } catch (error) {
    console.error('Error fetching recipients:', error);
    alert('Failed to load recipients from source database');
  } finally {
    setLoading(false);
  }
};

  const handleImport = async () => {
    if (selectedRecipients.size === 0) {
      alert('Please select recipients to import');
      return;
    }

    try {
      setImporting(true);
      
      // Convert Set to Array and prepare data
      const selectedIds = Array.from(selectedRecipients);
      
      console.log('Selected IDs for import:', selectedIds);
      console.log('Current filters:', filters);
      
      const importData = {
        ids: selectedIds,
        x_activitec: filters.x_activitec || '',
        limit: 100,
      };

      console.log('Sending import data:', importData);
      
      const response = await sourceAPI.importRecipients(importData);
      console.log('Import API response:', response);
      
      if (response.success) {
        alert(`Successfully imported ${response.total_imported || 0} recipients`);
        console.log('Import details:', response.imported);
        console.log('Import errors:', response.errors);
        
        // Clear selection
        setSelectedRecipients(new Set());
        
        // Refresh recipients
        fetchRecipients();
      } else {
        alert(response.error || 'Failed to import recipients');
      }
    } catch (error) {
      console.error('Error importing recipients:', error);
      console.error('Error details:', error.response || error);
      alert(error.error || error.message || 'Failed to import recipients');
    } finally {
      setImporting(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await sourceAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRecipients.size === recipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map(r => r.id || r.email)));
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const getUniqueCategories = () => {
    const uniqueCats = [...new Set(recipients
      .map(r => r.x_activitec)
      .filter(Boolean))];
    return uniqueCats;
  };

  // Preview recipient details
  const showPreview = (recipient) => {
    setPreviewRecipient(recipient);
  };

  return (
    <div>
      <Header
        title="Import from Source Database"
        description="Browse and import recipients from your production database"
      />

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Source Database</p>
                <p className="text-2xl font-bold text-blue-800">{stats.total_recipients || 0}</p>
                <p className="text-xs text-blue-600">Total recipients</p>
              </div>
              <Database className="text-blue-600" size={24} />
            </div>
          </Card>
          <Card className="bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Active with Email</p>
                <p className="text-2xl font-bold text-green-800">{stats.active_with_email || 0}</p>
                <p className="text-xs text-green-600">Ready for import</p>
              </div>
              <Check className="text-green-600" size={24} />
            </div>
          </Card>
          <Card className="bg-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Categories</p>
                <p className="text-2xl font-bold text-purple-800">{stats.categories_count || 0}</p>
                <p className="text-xs text-purple-600">Unique x_activitec</p>
              </div>
              <Filter className="text-purple-600" size={24} />
            </div>
          </Card>
          <Card className="bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Selected</p>
                <p className="text-2xl font-bold text-yellow-800">{selectedRecipients.size}</p>
                <p className="text-xs text-yellow-600">For import</p>
              </div>
              <Users className="text-yellow-600" size={24} />
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        {/* Filters Card */}
        <Card title="Filters & Selection">
          <div className="space-y-6">
            {/* Filters */}
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
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  x_activitec (Category)
                </label>
                <select
                  value={filters.x_activitec}
                  onChange={(e) => handleFilterChange('x_activitec', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {getUniqueCategories().map((cat, index) => (
                    <option key={index} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.active_only}
                  onChange={(e) => handleFilterChange('active_only', e.target.value === 'true')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="true">Active Only</option>
                  <option value="false">All Status</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Filter
                </label>
                <select
                  value={filters.has_email}
                  onChange={(e) => handleFilterChange('has_email', e.target.value === 'true')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="true">Has Email</option>
                  <option value="false">All Records</option>
                </select>
              </div>
            </div>

            {/* Actions */}
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
              </div>
              <div className="flex gap-3">
                <div className="text-sm text-gray-600">
                  Showing {recipients.length} of {pagination.totalCount} recipients
                </div>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importing}
                  disabled={selectedRecipients.size === 0}
                >
                  <Upload size={16} />
                  Import Selected ({selectedRecipients.size})
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Recipients Table */}
        <Card title="Source Database Recipients">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading recipients...</p>
              </div>
            </div>
          ) : recipients.length === 0 ? (
            <div className="text-center py-12">
              <Database className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-600">No recipients found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">x_activitec</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">City</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Active</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Last Update</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((recipient, index) => (
                      <tr 
                        key={recipient.id || index}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.has(recipient.id || recipient.email)}
                            onChange={() => toggleSelectRecipient(recipient.id || recipient.email)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-gray-600">
                          {recipient.id || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">
                            {recipient.name || recipient.complete_name || 'N/A'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-600">{recipient.email || 'No email'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {recipient.x_activitec || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-600">{recipient.city || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${recipient.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {recipient.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600">
                            {recipient.write_date ? new Date(recipient.write_date).toLocaleDateString() : 'Never'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => showPreview(recipient)}
                          >
                            <Eye size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "primary" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Preview Modal */}
      {previewRecipient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Recipient Preview</h2>
              <button
                onClick={() => setPreviewRecipient(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">ID</label>
                    <p className="mt-1">{previewRecipient.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Active</label>
                    <p className="mt-1">{previewRecipient.active ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="mt-1">{previewRecipient.name || previewRecipient.complete_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1">{previewRecipient.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Category (x_activitec)</label>
                    <p className="mt-1">{previewRecipient.x_activitec || 'General'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">City</label>
                    <p className="mt-1">{previewRecipient.city || '-'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Company</label>
                  <p className="mt-1">{previewRecipient.is_company ? 'Company' : 'Individual'}</p>
                </div>
                {previewRecipient.write_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="mt-1">{new Date(previewRecipient.write_date).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <Button
                onClick={() => setPreviewRecipient(null)}
                variant="outline"
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

export default Import;