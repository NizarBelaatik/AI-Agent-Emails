// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, CheckCircle, Clock, AlertCircle, 
  TrendingUp, Calendar, Database 
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { sourceAPI, emailsAPI, recipientsAPI } from '../services/api';

const StatCard = ({ icon: Icon, label, value, change, color }) => (
  <Card className="hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <p className={`text-xs mt-1 ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change > 0 ? '↑' : '↓'} {Math.abs(change)}% from last week
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={color} size={24} />
      </div>
    </div>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    sourceRecipients: 0,
    importedRecipients: 0,
    totalEmails: 0,
    draftEmails: 0,
    approvedEmails: 0,
    scheduledEmails: 0,
    sentEmails: 0,
    failedEmails: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sourceStats, emailStats, recipientStats] = await Promise.all([
        sourceAPI.getStats(),
        emailsAPI.getDashboard(),
        recipientsAPI.getDashboard(),
      ]);

      setStats({
        sourceRecipients: sourceStats.data.total_recipients || 0,
        importedRecipients: recipientStats.data.total || 0,
        totalEmails: emailStats.data.total_emails || 0,
        draftEmails: emailStats.data.status_stats?.draft || 0,
        approvedEmails: emailStats.data.status_stats?.approved || 0,
        scheduledEmails: emailStats.data.status_stats?.scheduled || 0,
        sentEmails: emailStats.data.status_stats?.sent || 0,
        failedEmails: emailStats.data.status_stats?.failed || 0,
      });

      setRecentActivity(emailStats.data.recent_activity || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Import Recipients', path: '/import', icon: Database },
    { label: 'Generate Emails', path: '/generate', icon: Mail },
    { label: 'Review Drafts', path: '/emails?status=draft', icon: CheckCircle },
    { label: 'Schedule Emails', path: '/scheduled', icon: Calendar },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Dashboard"
        description="Overview of your email automation system"
      >
        <div className="flex gap-4 mb-6">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => window.location.href = action.path}
            >
              <action.icon size={16} />
              {action.label}
            </Button>
          ))}
        </div>
      </Header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Database}
          label="Source Recipients"
          value={stats.sourceRecipients.toLocaleString()}
          color="text-blue-600"
        />
        <StatCard
          icon={Users}
          label="Imported Recipients"
          value={stats.importedRecipients.toLocaleString()}
          color="text-green-600"
        />
        <StatCard
          icon={Mail}
          label="Total Emails"
          value={stats.totalEmails.toLocaleString()}
          color="text-purple-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Sent Today"
          value={stats.sentEmails.toLocaleString()}
          color="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Email Status */}
        <Card title="Email Status" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-700">Draft</span>
              </div>
              <span className="font-semibold">{stats.draftEmails}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700">Approved</span>
              </div>
              <span className="font-semibold">{stats.approvedEmails}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">Scheduled</span>
              </div>
              <span className="font-semibold">{stats.scheduledEmails}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-gray-700">Sent</span>
              </div>
              <span className="font-semibold">{stats.sentEmails}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-700">Failed</span>
              </div>
              <span className="font-semibold">{stats.failedEmails}</span>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity">
          <div className="space-y-4">
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.count} actions</p>
                </div>
                <TrendingUp size={16} className="text-green-600" />
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Quick Actions">
          <div className="space-y-3">
            <Button variant="primary" className="w-full justify-center">
              <Mail size={16} />
              Generate New Campaign
            </Button>
            <Button variant="outline" className="w-full justify-center">
              <Users size={16} />
              Import More Recipients
            </Button>
            <Button variant="outline" className="w-full justify-center">
              <Calendar size={16} />
              Schedule All Approved
            </Button>
          </div>
        </Card>

        <Card title="System Status">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">API Connection</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Email Service</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">LLM Service</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Ready
              </span>
            </div>
          </div>
        </Card>

        <Card title="Upcoming">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Scheduled Emails</p>
                <p className="text-xs text-gray-500">Next 24 hours</p>
              </div>
              <span className="text-xl font-bold">{stats.scheduledEmails}</span>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <Button variant="ghost" className="w-full justify-center text-sm">
                View All Scheduled
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;