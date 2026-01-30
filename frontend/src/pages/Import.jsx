// src/pages/Import.jsx
import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Upload, Check, 
  X, ChevronLeft, ChevronRight, Database 
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
    category: '',
    subcategory: '',
    minDate: '',
    maxDate: '',
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
  const [selectionType, setSelectionType] = useState('selected'); // 'selected', 'filtered', 'all'

  useEffect(() => {
    fetchRecipients();
    fetchCategories();
  }, [filters, pagination.page]);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        page_size: pagination.pageSize,
      };
      
      const response = await sourceAPI.browseRecipients(params);
      const data = response.data;
      
      setRecipients(data.recipients || []);
      setPagination(data.pagination || pagination);
      setCategories(data.filters?.categories || []);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      alert('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await sourceAPI.getStats();
      // Extract categories from stats or recipients
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRecipients.size === recipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map(r => r.email)));
    }
  };

  const toggleSelectRecipient = (email) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedRecipients(newSelected);
  };

  const handleImport = async () => {
    if (selectedRecipients.size === 0) {
      alert('Please select recipients to import');
      return;
    }

    try {
      setImporting(true);
      
      let importData;
      if (selectionType === 'selected') {
        importData = {
          selection_type: 'selected',
          selected_emails: Array.from(selectedRecipients),
        };
      } else if (selectionType === 'filtered') {
        importData = {
          selection_type: 'filtered',
          filters: {
            category: filters.category,
            subcategory: filters.subcategory,
            search: filters.search,
          },
        };
      } else {
        importData = {
          selection_type: 'all',
          limit: 100,
        };
      }

      const response = await sourceAPI.importRecipients(importData);
      const result = response.data;

      alert(`Successfully imported ${result.total_imported} recipients`);
      
      // Clear selection
      setSelectedRecipients(new Set());
      
      // Refresh recipients
      fetchRecipients();
    } catch (error) {
      console.error('Error importing recipients:', error);
      alert('Failed to import recipients');
    } finally {
      setImporting(false);
    }
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

  const getCategoryOptions = () => {
    const uniqueCategories = [...new Set(categories.map(c => c.category))];
    return uniqueCategories.map(cat => ({
      value: cat,
      label: cat,
    }));
  };

  const getSubcategoryOptions = () => {
    if (!filters.category) return [];
    return categories
      .filter(c => c.category === filters.category)
      .map(c => ({
        value: c.subcategory,
        label: c.subcategory,
      }));
  };

  return (
    <div>
      <Header
        title="Import Recipients"
        description="Browse and import recipients from source database"
      />

      <div className="space-y-6">
        {/* Filters Card */}
        <Card title="Filters & Selection">
          <div className="space-y-6">
            {/* Selection Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Import Selection
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="selectionType"
                    value="selected"
                    checked={selectionType === 'selected'}
                    onChange={(e) => setSelectionType(e.target.value)}
                    className="mr-2"
                  />
                  <span>Selected Only ({selectedRecipients.size})</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="selectionType"
                    value="filtered"
                    checked={selectionType === 'filtered'}
                    onChange={(e) => setSelectionType(e.target.value)}
                    className="mr-2"
                  />
                  <span>All Matching Filters</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="selectionType"
                    value="all"
                    checked={selectionType === 'all'}
                    onChange={(e) => setSelectionType(e.target.value)}
                    className="mr-2"
                  />
                  <span>All Active Recipients</span>
                </label>
              </div>
            </div>

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
                    placeholder="Name, email, or company"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => {
                    handleFilterChange('category', e.target.value);
                    handleFilterChange('subcategory', '');
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {getCategoryOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcategory
                </label>
                <select
                  value={filters.subcategory}
                  onChange={(e) => handleFilterChange('subcategory', e.target.value)}
                  disabled={!filters.category}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">All Subcategories</option>
                  {getSubcategoryOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.minDate}
                    onChange={(e) => handleFilterChange('minDate', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={filters.maxDate}
                    onChange={(e) => handleFilterChange('maxDate', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {recipients.length} of {pagination.totalCount} recipients
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                >
                  {selectedRecipients.size === recipients.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importing}
                  disabled={selectionType === 'selected' && selectedRecipients.size === 0}
                >
                  <Upload size={16} />
                  Import {selectionType === 'selected' ? `(${selectedRecipients.size})` : ''}
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
                          checked={selectedRecipients.size === recipients.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Last Interaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((recipient) => (
                      <tr 
                        key={recipient.email}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.has(recipient.email)}
                            onChange={() => toggleSelectRecipient(recipient.email)}
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
                          <div className="text-gray-600">{recipient.company || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">{recipient.category}</span>
                            <span className="text-xs text-gray-500">{recipient.subcategory}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600">
                            {recipient.last_interaction || 'Never'}
                          </div>
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
    </div>
  );
};

export default Import;