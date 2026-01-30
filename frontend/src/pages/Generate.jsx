// src/pages/Generate.jsx
import React, { useState, useEffect } from 'react';
import { 
  Mail, Filter, Users, FileText, CheckCircle, 
  AlertCircle, ChevronDown, ChevronUp 
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { recipientsAPI, templatesAPI, emailsAPI } from '../services/api';

const Generate = () => {
  const [recipients, setRecipients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    subcategory: '',
    search: '',
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectionType, setSelectionType] = useState('selected'); // 'selected', 'filtered', 'all'
  const [batchName, setBatchName] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchRecipients();
    fetchTemplates();
  }, [filters]);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const params = { ...filters };
      const response = await recipientsAPI.getRecipients(params);
      setRecipients(response.data || []);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      alert('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getTemplates();
      setTemplates(response.data || []);
      if (response.data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(response.data[0].id);
        setPreviewTemplate(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
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

  const handleGenerate = async () => {
    if (selectionType === 'selected' && selectedRecipients.size === 0) {
      alert('Please select recipients to generate emails for');
      return;
    }

    if (!selectedTemplate) {
      alert('Please select a template');
      return;
    }

    try {
      setGenerating(true);
      
      const generateData = {
        selection_type: selectionType,
        template_id: selectedTemplate,
        batch_name: batchName || `Batch ${new Date().toLocaleDateString()}`,
      };

      if (selectionType === 'selected') {
        generateData.selected_ids = Array.from(selectedRecipients);
      } else if (selectionType === 'filtered') {
        generateData.filters = filters;
      }

      const response = await emailsAPI.generateBatch(generateData);
      const result = response.data;

      alert(`Generated ${result.summary.success} emails successfully. ${result.summary.errors} errors.`);
      
      if (result.summary.success > 0) {
        // Clear selection
        setSelectedRecipients(new Set());
        setBatchName('');
        
        // Redirect to emails page
        window.location.href = '/emails?status=draft';
      }
    } catch (error) {
      console.error('Error generating emails:', error);
      alert('Failed to generate emails');
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === parseInt(templateId));
    setPreviewTemplate(template);
  };

  const getCategoryOptions = () => {
    const categories = [...new Set(recipients.map(r => r.category))];
    return categories.map(cat => ({ value: cat, label: cat }));
  };

  const getSubcategoryOptions = () => {
    if (!filters.category) return [];
    const subcategories = [...new Set(
      recipients
        .filter(r => r.category === filters.category)
        .map(r => r.subcategory)
    )];
    return subcategories.map(sub => ({ value: sub, label: sub }));
  };

  const selectedTemplateObj = templates.find(t => t.id === parseInt(selectedTemplate));

  return (
    <div>
      <Header
        title="Generate Emails"
        description="Generate personalized emails using AI templates"
      />

      <div className="space-y-6">
        {/* Template Selection */}
        <Card title="Template Selection">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a template...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Name (Optional)
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g., January Newsletter Campaign"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {selectedTemplateObj && (
              <div className="mt-4">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showPreview ? 'Hide Template Preview' : 'Show Template Preview'}
                </button>
                
                {showPreview && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900">{selectedTemplateObj.name}</h4>
                      <p className="text-sm text-gray-600">
                        {selectedTemplateObj.category} • {selectedTemplateObj.subcategory}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded border">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {selectedTemplateObj.prompt_template}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Recipient Selection */}
        <Card title="Recipient Selection">
          <div className="space-y-6">
            {/* Selection Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Generate For
              </label>
              <div className="flex gap-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="generateSelection"
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
                    name="generateSelection"
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
                    name="generateSelection"
                    value="all"
                    checked={selectionType === 'all'}
                    onChange={(e) => setSelectionType(e.target.value)}
                    className="mr-2"
                  />
                  <span>All Imported Recipients</span>
                </label>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => {
                    setFilters(prev => ({ 
                      ...prev, 
                      category: e.target.value,
                      subcategory: ''
                    }));
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
                  onChange={(e) => setFilters(prev => ({ ...prev, subcategory: e.target.value }))}
                  disabled={!filters.category}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
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
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Name or email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {recipients.length} recipients found
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                  disabled={selectionType !== 'selected'}
                >
                  {selectedRecipients.size === recipients.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={selectionType === 'selected' && selectedRecipients.size === 0}
                >
                  <Mail size={16} />
                  Generate Emails
                  {selectionType === 'selected' && ` (${selectedRecipients.size})`}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Recipients List */}
        <Card 
          title={`Recipients (${recipients.length})`}
          subtitle={`Selection: ${selectionType.charAt(0).toUpperCase() + selectionType.slice(1)}`}
        >
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
              <p className="text-sm text-gray-500 mt-1">Try importing recipients first</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.href = '/import'}
              >
                Go to Import
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.size === recipients.length}
                        onChange={toggleSelectAll}
                        disabled={selectionType !== 'selected'}
                        className="rounded border-gray-300 disabled:opacity-50"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
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
                          disabled={selectionType !== 'selected'}
                          className="rounded border-gray-300 disabled:opacity-50"
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
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Ready
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Generate;