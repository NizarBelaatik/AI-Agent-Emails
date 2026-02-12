// src/pages/Imported.jsx
import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Eye,
  X
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { importerAPI } from '../services/api';

const Imported = () => {
  const [recipients, setRecipients] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewRecipient, setPreviewRecipient] = useState(null);

  useEffect(() => {
    fetchImported();
  }, [pagination.page]);

  const fetchImported = async () => {
    setError(null);
    setLoading(true);

    try {
      const params = {
        page: pagination.page,
        page_size: pagination.pageSize,
      };

      console.log('[Imported] Fetching with params:', params);

      const response = await importerAPI.getImported(params);

      console.log('[Imported] Raw response:', response);

      // Standard DRF pagination format
      const data = Array.isArray(response.results) ? response.results : [];

      setRecipients(data);

      const total = response.count || data.length || 0;
      setPagination((prev) => ({
        ...prev,
        totalCount: total,
        totalPages: Math.ceil(total / pagination.pageSize) || 1,
      }));
    } catch (err) {
      console.error('[Imported] Fetch error:', err);
      setError('Failed to load imported recipients. Check console or try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Header
        title="Imported Recipients"
        description="All partners that have been successfully imported to the local database"
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600">Loading imported recipients...</p>
          </div>
        ) : recipients.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Database size={64} className="mx-auto mb-6 opacity-50" />
            <h3 className="text-xl font-medium mb-3">No imported recipients yet</h3>
            <p className="text-gray-600">
              Go back to the <strong>Import</strong> page and bring in some partners from the source database.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Imported At
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recipients.map((recipient) => (
                    <tr key={recipient.source_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {recipient.source_id}
                      </td>
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
                        {recipient.created_at
                          ? new Date(recipient.created_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setPreviewRecipient(recipient)}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="View details"
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
                Showing {recipients.length} of {pagination.totalCount.toLocaleString()} • Page {pagination.page} of{' '}
                {pagination.totalPages}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                >
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
              <h2 className="text-xl font-semibold">Imported Partner Details</h2>
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
                  <label className="block text-sm font-medium text-gray-500">Source ID</label>
                  <p className="mt-1 font-medium">{previewRecipient.source_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Imported At</label>
                  <p className="mt-1">
                    {previewRecipient.created_at
                      ? new Date(previewRecipient.created_at).toLocaleString()
                      : '—'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Name</label>
                  <p className="mt-1 font-medium">
                    {previewRecipient.name || previewRecipient.complete_name || '—'}
                  </p>
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

export default Imported;