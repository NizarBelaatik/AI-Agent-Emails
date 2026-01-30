// src/pages/Scheduled.jsx
import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, Send, Edit, XCircle, 
  CheckCircle, AlertCircle, Filter, Search 
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { emailsAPI } from '../services/api';

const Scheduled = () => {
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [overdueEmails, setOverdueEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
  });

  useEffect(() => {
    fetchScheduledEmails();
  }, [filters]);

  const fetchScheduledEmails = async () => {
    try {
      setLoading(true);
      const response = await emailsAPI.getScheduled();
      setScheduledEmails(response.data.upcoming || []);
      setOverdueEmails(response.data.overdue || []);
    } catch (error) {
      console.error('Error fetching scheduled emails:', error);
      alert('Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNow = async (emailId) => {
    if (!confirm('Send this email now?')) return;
    
    try {
      await emailsAPI.sendEmail(emailId);
      alert('Email sent successfully');
      fetchScheduledEmails();
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    }
  };

  const handleCancelSchedule = async (emailId) => {
    if (!confirm('Cancel this scheduled email?')) return;
    
    try {
      await emailsAPI.updateEmail(emailId, { status: 'approved' });
      alert('Schedule cancelled');
      fetchScheduledEmails();
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      alert('Failed to cancel schedule');
    }
  };

  const handleSendAllOverdue = async () => {
    if (overdueEmails.length === 0) return;
    
    if (!confirm(`Send all ${overdueEmails.length} overdue emails?`)) return;
    
    try {
      const emailIds = overdueEmails.map(email => email.id);
      const response = await emailsAPI.sendBatch({
        email_ids: emailIds,
        type: 'selected'
      });
      alert(`Sent ${response.data.summary.success} overdue emails`);
      fetchScheduledEmails();
    } catch (error) {
      console.error('Error sending overdue emails:', error);
      alert('Failed to send overdue emails');
    }
  };

  const formatScheduleTime = (dateTime) => {
    const date = new Date(dateTime);
    const now = new Date();
    const diffHours = Math.floor((date - now) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((date - now) / (1000 * 60));
    
    if (diffMinutes < 0) {
      return `${Math.abs(diffMinutes)} minutes ago`;
    } else if (diffHours < 24) {
      return `In ${diffHours} hours`;
    } else {
      return date.toLocaleString();
    }
  };

  return (
    <div>
      <Header
        title="Scheduled Emails"
        description="Manage emails scheduled for future delivery"
      />

      <div className="space-y-6">
        {/* Overdue Emails */}
        {overdueEmails.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-600" size={24} />
                <div>
                  <h3 className="text-lg font-semibold text-red-900">
                    Overdue Emails ({overdueEmails.length})
                  </h3>
                  <p className="text-sm text-red-700">
                    These emails were scheduled but not sent
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                onClick={handleSendAllOverdue}
              >
                <Send size={16} />
                Send All Overdue
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-red-900">Recipient</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-red-900">Subject</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-red-900">Scheduled For</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-red-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueEmails.map((email) => (
                    <tr key={email.id} className="border-b border-red-100">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-red-900">{email.recipient_name}</div>
                          <div className="text-sm text-red-700">{email.recipient_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-red-900 truncate max-w-xs">
                          {email.subject}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-red-700">
                          {new Date(email.scheduled_for).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleSendNow(email.id)}
                          >
                            <Send size={12} />
                            Send Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelSchedule(email.id)}
                          >
                            <XCircle size={12} />
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Upcoming Scheduled */}
        <Card title={`Upcoming Scheduled (${scheduledEmails.length})`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading scheduled emails...</p>
              </div>
            </div>
          ) : scheduledEmails.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-600">No upcoming scheduled emails</p>
              <p className="text-sm text-gray-500 mt-1">
                Schedule emails from the email management page
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.href = '/emails'}
              >
                Go to Email Management
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Recipient</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Subject</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Scheduled For</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Time Until</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledEmails.map((email) => (
                      <tr key={email.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">{email.recipient_name}</div>
                            <div className="text-sm text-gray-500">{email.recipient_email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900 truncate max-w-xs">
                            {email.subject}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-700">
                            {new Date(email.scheduled_for).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-blue-600 font-medium">
                            {formatScheduleTime(email.scheduled_for)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleSendNow(email.id)}
                            >
                              <Send size={12} />
                              Send Now
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelSchedule(email.id)}
                            >
                              <XCircle size={12} />
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Quick Schedule */}
        <Card title="Quick Schedule">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Schedule Options</h4>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.location.href = '/emails?status=approved'}
                >
                  <Calendar size={16} />
                  Schedule Approved Emails
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    // Implement bulk schedule from approved
                  }}
                >
                  <Clock size={16} />
                  Schedule for Tomorrow 9 AM
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    // Implement bulk schedule
                  }}
                >
                  <Calendar size={16} />
                  Schedule Weekly Campaign
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Schedule Stats</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Scheduled</span>
                  <span className="font-medium">{scheduledEmails.length + overdueEmails.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next 24 Hours</span>
                  <span className="font-medium">
                    {scheduledEmails.filter(e => {
                      const time = new Date(e.scheduled_for);
                      const now = new Date();
                      return (time - now) < (24 * 60 * 60 * 1000);
                    }).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next Week</span>
                  <span className="font-medium">
                    {scheduledEmails.filter(e => {
                      const time = new Date(e.scheduled_for);
                      const now = new Date();
                      return (time - now) < (7 * 24 * 60 * 60 * 1000);
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Scheduled;