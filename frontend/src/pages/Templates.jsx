// src/pages/Templates.jsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Edit, Trash2, Copy, 
  Eye, Search, Filter, CheckCircle 
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { templatesAPI } from '../services/api';

const TemplateCard = ({ template, onAction }) => {
  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {template.category}
            </span>
            {template.subcategory && (
              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                {template.subcategory}
              </span>
            )}
          </div>
        </div>
        {template.is_active && (
          <CheckCircle className="text-green-500" size={20} />
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 line-clamp-3">
          {template.prompt_template.substring(0, 200)}...
        </p>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          Updated: {new Date(template.updated_at).toLocaleDateString()}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAction('preview', template.id)}
          >
            <Eye size={12} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAction('edit', template.id)}
          >
            <Edit size={12} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAction('duplicate', template.id)}
          >
            <Copy size={12} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAction('delete', template.id)}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
    </Card>
  );
};

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: '',
    subcategory: '',
    prompt_template: '',
    is_active: true,
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, [filters]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = { ...filters };
      const response = await templatesAPI.getTemplates(params);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      alert('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateAction = async (action, templateId) => {
    const template = templates.find(t => t.id === templateId);
    
    switch (action) {
      case 'preview':
        setSelectedTemplate(template);
        setShowPreviewModal(true);
        break;
      case 'edit':
        setSelectedTemplate(template);
        setNewTemplate({
          name: template.name,
          category: template.category,
          subcategory: template.subcategory,
          prompt_template: template.prompt_template,
          is_active: template.is_active,
        });
        setShowCreateModal(true);
        break;
      case 'duplicate':
        handleDuplicateTemplate(template);
        break;
      case 'delete':
        if (confirm('Are you sure you want to delete this template?')) {
          await handleDeleteTemplate(templateId);
        }
        break;
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.prompt_template.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (selectedTemplate) {
        // Update existing template
        await templatesAPI.updateTemplate(selectedTemplate.id, newTemplate);
        alert('Template updated successfully');
      } else {
        // Create new template
        await templatesAPI.createTemplate(newTemplate);
        alert('Template created successfully');
      }
      
      setShowCreateModal(false);
      setSelectedTemplate(null);
      setNewTemplate({
        name: '',
        category: '',
        subcategory: '',
        prompt_template: '',
        is_active: true,
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleDuplicateTemplate = async (template) => {
    try {
      await templatesAPI.createTemplate({
        ...template,
        name: `${template.name} (Copy)`,
      });
      alert('Template duplicated successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Failed to duplicate template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await templatesAPI.deleteTemplate(templateId);
      alert('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const getCategoryOptions = () => {
    const categories = [...new Set(templates.map(t => t.category))];
    return categories.map(cat => ({ value: cat, label: cat }));
  };

  return (
    <div>
      <Header
        title="Email Templates"
        description="Create and manage AI email templates"
      >
        <div className="flex gap-4 mb-6">
          <Button
            variant="primary"
            onClick={() => {
              setSelectedTemplate(null);
              setNewTemplate({
                name: '',
                category: '',
                subcategory: '',
                prompt_template: '',
                is_active: true,
              });
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            New Template
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search templates..."
              className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {getCategoryOptions().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Header>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading templates...</p>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-400" size={48} />
            <p className="mt-4 text-gray-600">No templates found</p>
            <p className="text-sm text-gray-500 mt-1">
              Create your first template to generate emails
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} />
              Create Template
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onAction={handleTemplateAction}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedTemplate ? 'Edit Template' : 'Create New Template'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                    placeholder="e.g., French Follow-up Template"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                    placeholder="e.g., Imprimerie & Arts graphiques"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory
                </label>
                <input
                  type="text"
                  value={newTemplate.subcategory}
                  onChange={(e) => setNewTemplate({...newTemplate, subcategory: e.target.value})}
                  placeholder="e.g., Imprimerie"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Template *
                  <span className="text-xs text-gray-500 ml-2">
                    Use placeholders: {'{name}'}, {'{company}'}, {'{category}'}, {'{subcategory}'}, {'{last_interaction}'}
                  </span>
                </label>
                <textarea
                  value={newTemplate.prompt_template}
                  onChange={(e) => setNewTemplate({...newTemplate, prompt_template: e.target.value})}
                  placeholder="Generate a professional French email..."
                  rows={12}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newTemplate.is_active}
                  onChange={(e) => setNewTemplate({...newTemplate, is_active: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Template is active
                </label>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateTemplate}
                >
                  {selectedTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Template Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">{selectedTemplate.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Subcategory</p>
                    <p className="font-medium">{selectedTemplate.subcategory || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">
                      {selectedTemplate.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Prompt Template</h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-6">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {selectedTemplate.prompt_template}
                  </pre>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewModal(false)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setSelectedTemplate(selectedTemplate);
                    setNewTemplate({
                      name: selectedTemplate.name,
                      category: selectedTemplate.category,
                      subcategory: selectedTemplate.subcategory,
                      prompt_template: selectedTemplate.prompt_template,
                      is_active: selectedTemplate.is_active,
                    });
                    setShowCreateModal(true);
                  }}
                >
                  <Edit size={16} />
                  Edit Template
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Templates;