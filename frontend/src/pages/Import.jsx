import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Upload, Check,
  X, ChevronLeft, ChevronRight, Database, RefreshCw, Eye, Users
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { importerAPI } from '../services/api';

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
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchRecipients();
    fetchStats();
  }, [filters, pagination.page]);

  const fetchRecipients = async () => {
    setErrorMessage(null);
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        page_size: pagination.pageSize,
      };

      console.log('[DEBUG] Fetching with params:', params);

      const response = await importerAPI.browseSource(params);

      console.log('[DEBUG] Full API response:', response);

      let recipientsData = [];

      // Handle your nested format: results.success.data = array
      if (response.results && response.results.success && Array.isArray(response.results.data)) {
        recipientsData = response.results.data;
      } 
      // Or standard DRF if you change backend later
      else if (Array.isArray(response.results)) {
        recipientsData = response.results;
      } else {
        console.warn('[DEBUG] Invalid results format:', response.results);
        setErrorMessage('Invalid data format from server. Check console.');
        return;
      }

      setRecipients(recipientsData);

      const total = response.count || recipientsData.length || 0;
      setPagination(prev => ({
        ...prev,
        totalCount: total,
        totalPages: Math.ceil(total / pagination.pageSize) || 1,
      }));

      const uniqueCats = [...new Set(
        recipientsData.map(r => r.x_activitec || '').filter(Boolean)
      )];
      setCategories(uniqueCats);
    } catch (error) {
      console.error('[DEBUG] Fetch failed:', error);
      setErrorMessage('Failed to load data. Check console or server logs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await importerAPI.getSourceStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Stats fetch failed:', error);
    }
  };

  const handleImport = async () => {
    console.log('[DEBUG] Import button clicked! Selected count:', selectedRecipients.size);

    if (selectedRecipients.size === 0) {
      console.log('[DEBUG] No recipients selected');
      alert('Please select at least one recipient.');
      return;
    }

    if (!window.confirm(`Import ${selectedRecipients.size} recipient(s)?`)) {
      console.log('[DEBUG] User canceled import');
      return;
    }

    try {
      setImporting(true);
      console.log('[DEBUG] Starting import...');

      const selectedIds = Array.from(selectedRecipients);
      console.log('[DEBUG] Selected IDs:', selectedIds);

      const payload = {
        selected_ids: selectedIds,
        limit: 500,
        update_existing: true,
      };

      console.log('[DEBUG] Sending payload to backend:', payload);

      const result = await importerAPI.importRecipients(payload);

      console.log('[DEBUG] Import result from backend:', result);

      if (result.success) {
        alert(
          `Import completed!\n\n` +
          `Created: ${result.stats?.imported || 0}\n` +
          `Updated: ${result.stats?.updated || 0}\n` +
          `Failed: ${result.stats?.failed || 0}`
        );

        setSelectedRecipients(new Set());
        fetchRecipients();
        fetchStats();
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error from backend'));
      }
    } catch (err) {
      console.error('[DEBUG] Import failed with error:', err);
      alert('Import error: ' + (err.message || 'Check console for details'));
    } finally {
      setImporting(false);
      console.log('[DEBUG] Import process finished');
    }
  };

  const toggleSelectAll = () => {
    if (selectedRecipients.size === recipients.length && recipients.length > 0) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map(r => r.id)));
    }
  };

  const toggleSelectRecipient = (id) => {
    const newSet = new Set(selectedRecipients);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRecipients(newSet);
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Header
        title="Import from Source Database"
        description="Browse and import partners from your Odoo production database"
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total in Source</p>
                <p className="text-3xl font-bold text-blue-800 mt-1">{stats.total?.toLocaleString() || '0'}</p>
              </div>
              <Database className="text-blue-600" size={32} />
            </div>
          </Card>

          <Card className="bg-green-50 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Ready to Import</p>
                <p className="text-3xl font-bold text-green-800 mt-1">{stats.with_email?.toLocaleString() || '0'}</p>
                <p className="text-xs text-green-600 mt-1">Active + has email</p>
              </div>
              <Check className="text-green-600" size={32} />
            </div>
          </Card>

          <Card className="bg-purple-50 border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Visible Categories</p>
                <p className="text-3xl font-bold text-purple-800 mt-1">{categories.length}</p>
              </div>
              <Filter className="text-purple-600" size={32} />
            </div>
          </Card>

          <Card className="bg-amber-50 border border-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700">Selected</p>
                <p className="text-3xl font-bold text-amber-800 mt-1">{selectedRecipients.size}</p>
              </div>
              <Users className="text-amber-600" size={32} />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card title="Filters & Actions" className="mb-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Name, email, city..."
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={filters.x_activitec}
                onChange={e => handleFilterChange('x_activitec', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={filters.active_only}
                onChange={e => handleFilterChange('active_only', e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={true}>Active only</option>
                <option value={false}>All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <select
                value={filters.has_email}
                onChange={e => handleFilterChange('has_email', e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={true}>Has email</option>
                <option value={false}>All</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={toggleSelectAll}
              disabled={recipients.length === 0 || loading}
            >
              {selectedRecipients.size === recipients.length && recipients.length > 0
                ? 'Deselect All'
                : 'Select All on Page'}
            </Button>

            <Button variant="outline" onClick={fetchRecipients} disabled={loading}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>

            <div className="ml-auto">
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={selectedRecipients.size === 0}  // only disable if nothing selected
                loading={importing}
              >
                <Upload size={16} className="mr-2" />
                Import Selected ({selectedRecipients.size})
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Error */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600">Loading partners from source database...</p>
          </div>
        ) : recipients.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Database size={64} className="mx-auto mb-6 opacity-50" />
            <h3 className="text-xl font-medium mb-3">No partners found</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Try adjusting filters, or verify source database has active partners with email.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={recipients.length > 0 && selectedRecipients.size === recipients.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recipients.map(recipient => (
                    <tr key={recipient.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.has(recipient.id)}
                          onChange={() => toggleSelectRecipient(recipient.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{recipient.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {recipient.name || recipient.complete_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {recipient.email || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          {recipient.x_activitec || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {recipient.city || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          recipient.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {recipient.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setPreviewRecipient(recipient)}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t bg-gray-50 gap-4">
              <div className="text-sm text-gray-700">
                Showing {recipients.length} of {pagination.totalCount.toLocaleString()} • Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1 || loading}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || loading}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Preview Modal */}
      {previewRecipient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Partner Details</h2>
              <button
                onClick={() => setPreviewRecipient(null)}
                className="text-gray-500 hover:text-gray-800 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">ID</label>
                  <p className="mt-1 font-medium">{previewRecipient.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <p className="mt-1">
                    <span className={`inline-flex px-3 py-1 text-sm rounded-full ${
                      previewRecipient.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {previewRecipient.active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="mt-1 font-medium">{previewRecipient.name || previewRecipient.complete_name || '—'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1">{previewRecipient.email || '—'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Category</label>
                  <p className="mt-1">{previewRecipient.x_activitec || 'General'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">City</label>
                  <p className="mt-1">{previewRecipient.city || '—'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Type</label>
                  <p className="mt-1 font-medium">
                    {previewRecipient.is_company ? 'Company' : 'Individual'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <Button variant="outline" onClick={() => setPreviewRecipient(null)}>
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