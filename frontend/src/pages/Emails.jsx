// src/pages/Emails.jsx
import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Mail, CheckCircle, Clock,
  Send, Edit, Trash2, RefreshCw, Calendar,
  ChevronDown, Eye, XCircle, Archive
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { emailsAPI, templatesAPI } from '../services/api';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { color: 'bg-yellow-100 text-yellow-800', icon: Edit },
    approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    scheduled: { color: 'bg-blue-100 text-blue-800', icon: Clock },
    sent: { color: 'bg-purple-100 text-purple-800', icon: Send },
    failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
    rejected: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
    edited: { color: 'bg-indigo-100 text-indigo-800', icon: Edit },
    archived: { color: 'bg-gray-100 text-gray-800', icon: Archive },
  };

  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const EmailActions = ({ email, onAction }) => {
  const actions = {
    draft: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'Approve', icon: CheckCircle, action: 'approve', variant: 'success' },
      { label: 'Reject', icon: XCircle, action: 'reject', variant: 'danger' },
      { label: 'Edit', icon: Edit, action: 'edit', variant: 'outline' },
      { label: 'Regenerate', icon: RefreshCw, action: 'regenerate', variant: 'outline' },
    ],
    approved: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'Send', icon: Send, action: 'send', variant: 'primary' },
      { label: 'Schedule', icon: Calendar, action: 'schedule', variant: 'outline' },
      { label: 'Reject', icon: XCircle, action: 'reject', variant: 'danger' },
      { label: 'Regenerate', icon: RefreshCw, action: 'regenerate', variant: 'outline' },
    ],
    scheduled: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'Send Now', icon: Send, action: 'send', variant: 'primary' },
      { label: 'Cancel Schedule', icon: XCircle, action: 'cancelSchedule', variant: 'danger' },
    ],
    edited: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'Approve', icon: CheckCircle, action: 'approve', variant: 'success' },
      { label: 'Regenerate', icon: RefreshCw, action: 'regenerate', variant: 'outline' },
    ],
    rejected: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'Regenerate', icon: RefreshCw, action: 'regenerate', variant: 'outline' },
    ],
    failed: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'Retry', icon: RefreshCw, action: 'retry', variant: 'primary' },
    ],
    sent: [
      { label: 'Preview', icon: Eye, action: 'preview', variant: 'outline' },
      { label: 'View Details', icon: Eye, action: 'details', variant: 'outline' },
    ],
  };

  const emailActions = actions[email.status] || [];

  return (
    <div className="flex gap-2 flex-wrap">
      {emailActions.map((action) => (
        <Button
          key={action.action}
          size="sm"
          variant={action.variant}
          onClick={() => onAction(email.id, action.action)}
          className="text-xs"
        >
          <action.icon size={12} />
          {action.label}
        </Button>
      ))}
    </div>
  );
};

const Emails = () => {
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    subcategory: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [editingEmail, setEditingEmail] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null);
  const [scheduleData, setScheduleData] = useState({ scheduled_for: '' });

  useEffect(() => {
    fetchEmails();
    fetchTemplates();
  }, [filters]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const params = { ...filters };
      const response = await emailsAPI.getEmails(params);
      setEmails(response.data || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
      alert('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  const toggleSelectEmail = (id) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmails(newSelected);
  };

  const handleBulkAction = async (action) => {
    if (selectedEmails.size === 0) {
      alert('Please select emails to perform bulk action');
      return;
    }

    const emailIds = Array.from(selectedEmails);

    try {
      if (action === 'schedule') {
        const scheduledFor = prompt('Enter schedule date and time (YYYY-MM-DDTHH:MM:SS):');
        if (!scheduledFor) return;
        
        const response = await emailsAPI.bulkAction({
          email_ids: emailIds,
          action: 'schedule',
          data: { scheduled_for: scheduledFor }
        });
        alert(`Scheduled ${response.data.summary.success} emails`);
      } else if (action === 'send') {
        if (!confirm(`Send ${selectedEmails.size} emails?`)) return;
        
        const response = await emailsAPI.sendBatch({
          email_ids: emailIds,
          type: 'selected'
        });
        alert(`Sent ${response.data.summary.success} emails`);
      } else {
        const response = await emailsAPI.bulkAction({
          email_ids: emailIds,
          action: action
        });
        alert(`${action.charAt(0).toUpperCase() + action.slice(1)}d ${response.data.summary.success} emails`);
      }

      // Refresh emails
      fetchEmails();
      // Clear selection
      setSelectedEmails(new Set());
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('Failed to perform bulk action');
    }
  };

  const handleEmailAction = async (emailId, action) => {
    try {
      switch (action) {
        case 'approve':
          await emailsAPI.approveEmail(emailId);
          alert('Email approved successfully');
          break;
        case 'reject':
          const reason = prompt('Reason for rejection:');
          if (reason) {
            await emailsAPI.rejectEmail(emailId, reason);
            alert('Email rejected');
          }
          break;
        case 'send':
          await emailsAPI.sendEmail(emailId);
          alert('Email sent successfully');
          break;
        case 'schedule':
          const scheduledFor = prompt('Enter schedule date and time (YYYY-MM-DDTHH:MM:SS):');
          if (scheduledFor) {
            await emailsAPI.scheduleEmail(emailId, scheduledFor);
            alert('Email scheduled');
          }
          break;
        case 'edit':
          const email = emails.find(e => e.id === emailId);
          setEditingEmail(email);
          break;
        case 'preview':
          const preview = emails.find(e => e.id === emailId);
          setPreviewEmail(preview);
          break;
        case 'regenerate':
          const templateId = prompt('Enter template ID to regenerate:');
          if (templateId) {
            await emailsAPI.regenerateEmail(emailId, templateId);
            alert('Email regenerated');
          }
          break;
      }
      fetchEmails();
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Failed to perform action');
    }
  };

  const handleEditSubmit = async () => {
    if (!editingEmail) return;

    try {
      await emailsAPI.editEmailContent(editingEmail.id, {
        subject: editingEmail.subject,
        body_html: editingEmail.body_html,
        body_text: editingEmail.body_text,
      });
      alert('Email updated successfully');
      setEditingEmail(null);
      fetchEmails();
    } catch (error) {
      console.error('Error updating email:', error);
      alert('Failed to update email');
    }
  };

  const getCategoryOptions = () => {
    const categories = [...new Set(emails.map(e => e.recipient_category))];
    return categories.map(cat => ({ value: cat, label: cat }));
  };

  const getSubcategoryOptions = () => {
    if (!filters.category) return [];
    const subcategories = [...new Set(
      emails
        .filter(e => e.recipient_category === filters.category)
        .map(e => e.recipient_subcategory)
    )];
    return subcategories.map(sub => ({ value: sub, label: sub }));
  };

  const getStatusOptions = () => [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'approved', label: 'Approved' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'edited', label: 'Edited' },
  ];

  return (
    <div>
      <Header
        title="Email Management"
        description="Manage, edit, and send generated emails"
      />

      {/* Bulk Actions Bar */}
      {selectedEmails.size > 0 && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900">
                  {selectedEmails.size} email(s) selected
                </p>
                <p className="text-sm text-blue-700">
                  Choose an action to perform on all selected emails
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={bulkAction}
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAction(e.target.value);
                    setBulkAction('');
                  }
                }}
                className="border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Bulk Actions</option>
                <option value="approve">Approve Selected</option>
                <option value="reject">Reject Selected</option>
                <option value="send">Send Selected</option>
                <option value="schedule">Schedule Selected</option>
                <option value="archive">Archive Selected</option>
                <option value="delete">Delete Selected</option>
              </select>
              <Button
                variant="ghost"
                onClick={() => setSelectedEmails(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {/* Filters Card */}
        <Card>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {showFilters ? <ChevronDown size={16} /> : <Filter size={16} />}
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {getStatusOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Search emails..."
                      className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {emails.length} emails found
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                >
                  {selectedEmails.size === emails.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      status: '',
                      category: '',
                      subcategory: '',
                      search: '',
                      startDate: '',
                      endDate: '',
                    });
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Emails Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading emails...</p>
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-600">No emails found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or generate new emails</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.href = '/generate'}
              >
                Generate Emails
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
                        checked={selectedEmails.size === emails.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Recipient</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Subject</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Generated</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => (
                    <tr 
                      key={email.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedEmails.has(email.id)}
                          onChange={() => toggleSelectEmail(email.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{email.recipient_name}</div>
                          <div className="text-sm text-gray-500">{email.recipient_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 truncate max-w-xs">
                          {email.subject}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900">{email.recipient_category}</span>
                          <span className="text-xs text-gray-500">{email.recipient_subcategory}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={email.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600">
                          {new Date(email.generated_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <EmailActions 
                          email={email} 
                          onAction={handleEmailAction}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      {editingEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Email</h3>
              <button
                onClick={() => setEditingEmail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={editingEmail.subject}
                  onChange={(e) => setEditingEmail({...editingEmail, subject: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTML Content
                </label>
                <textarea
                  value={editingEmail.body_html}
                  onChange={(e) => setEditingEmail({...editingEmail, body_html: e.target.value})}
                  rows={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Content
                </label>
                <textarea
                  value={editingEmail.body_text}
                  onChange={(e) => setEditingEmail({...editingEmail, body_text: e.target.value})}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setEditingEmail(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleEditSubmit}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Email Preview</h3>
              <button
                onClick={() => setPreviewEmail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">To</p>
                    <p className="font-medium">{previewEmail.recipient_name} &lt;{previewEmail.recipient_email}&gt;</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium">{previewEmail.recipient_category} / {previewEmail.recipient_subcategory}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <StatusBadge status={previewEmail.status} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Generated</p>
                    <p className="font-medium">{new Date(previewEmail.generated_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Subject</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {previewEmail.subject}
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">HTML Preview</h4>
                <div 
                  className="bg-white border border-gray-200 rounded-lg p-6"
                  dangerouslySetInnerHTML={{ __html: previewEmail.body_html }}
                />
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Text Content</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono whitespace-pre-wrap text-sm">
                  {previewEmail.body_text}
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setPreviewEmail(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Emails;