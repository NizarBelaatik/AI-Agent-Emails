// src/pages/Reports.jsx
import React, { useState, useEffect } from 'react';
import {
  BarChart, PieChart, TrendingUp, Calendar,
  Download, Filter, Users, Mail, CheckCircle,
  Clock, AlertCircle, DollarSign
} from 'lucide-react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { emailsAPI, recipientsAPI } from '../services/api';

const Reports = () => {
  const [stats, setStats] = useState({
    totalEmails: 0,
    sentEmails: 0,
    openedEmails: 0,
    clickedEmails: 0,
    bounceRate: 0,
    conversionRate: 0,
  });
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      // In a real app, you would have a reports API endpoint
      // For now, we'll simulate with existing data
      const [emailStats, recipientStats] = await Promise.all([
        emailsAPI.getDashboard(),
        recipientsAPI.getDashboard(),
      ]);

      // Simulate some stats (replace with actual API call)
      setStats({
        totalEmails: emailStats.data.total_emails || 0,
        sentEmails: emailStats.data.status_stats?.sent || 0,
        openedEmails: Math.floor((emailStats.data.status_stats?.sent || 0) * 0.65), // Simulated
        clickedEmails: Math.floor((emailStats.data.status_stats?.sent || 0) * 0.25), // Simulated
        bounceRate: 2.5, // Simulated
        conversionRate: 15, // Simulated
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, change, color }) => (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          {change !== undefined && (
            <p className={`text-xs mt-1 ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={color} size={24} />
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Reports & Analytics"
        description="Monitor email performance and campaign analytics"
      >
        <div className="flex gap-4 mb-6">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
            <option value="year">This year</option>
          </select>
          <Button variant="outline">
            <Filter size={16} />
            Filter
          </Button>
          <Button variant="outline">
            <Download size={16} />
            Export
          </Button>
        </div>
      </Header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Mail}
          label="Total Emails"
          value={stats.totalEmails}
          change={12}
          color="text-blue-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Sent Emails"
          value={stats.sentEmails}
          change={8}
          color="text-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Open Rate"
          value={stats.openedEmails}
          change={15}
          color="text-purple-600"
        />
        <StatCard
          icon={DollarSign}
          label="Conversion Rate"
          value={stats.conversionRate}
          change={-3}
          color="text-yellow-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Performance Chart */}
        <Card title="Email Performance" actions={
          <Button variant="ghost" size="sm">
            <Calendar size={14} />
            {timeRange}
          </Button>
        }>
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <BarChart className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">Performance chart will be displayed here</p>
              <p className="text-sm text-gray-500 mt-1">
                Showing data for {timeRange}
              </p>
            </div>
          </div>
        </Card>

        {/* Email Status Distribution */}
        <Card title="Email Status Distribution">
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <PieChart className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">Distribution chart will be displayed here</p>
              <p className="text-sm text-gray-500 mt-1">
                Breakdown by email status
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Delivery Stats">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Successful Deliveries</span>
              <span className="font-semibold">{stats.sentEmails}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Bounce Rate</span>
              <span className="font-semibold text-red-600">{stats.bounceRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Spam Complaints</span>
              <span className="font-semibold text-yellow-600">0.1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Unsubscribe Rate</span>
              <span className="font-semibold text-gray-600">0.5%</span>
            </div>
          </div>
        </Card>

        <Card title="Engagement Stats">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Open Rate</span>
              <span className="font-semibold text-green-600">
                {stats.totalEmails > 0 ? ((stats.openedEmails / stats.totalEmails) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Click Rate</span>
              <span className="font-semibold text-blue-600">
                {stats.totalEmails > 0 ? ((stats.clickedEmails / stats.totalEmails) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Click-to-Open Rate</span>
              <span className="font-semibold text-purple-600">38%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg. Time to Open</span>
              <span className="font-semibold">2.4 hours</span>
            </div>
          </div>
        </Card>

        <Card title="Campaign Performance">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Campaigns</span>
              <span className="font-semibold">12</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Campaigns</span>
              <span className="font-semibold text-green-600">3</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg. Campaign Size</span>
              <span className="font-semibold">245 emails</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Best Performing</span>
              <span className="font-semibold text-yellow-600">Q4 Newsletter</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card title="Recent Activity" className="mt-6">
        <div className="space-y-4">
          {[
            { action: 'Campaign "Winter Sale" sent', time: '2 hours ago', icon: Send, color: 'text-green-600' },
            { action: 'Template "French Follow-up" updated', time: '1 day ago', icon: Edit, color: 'text-blue-600' },
            { action: '500 recipients imported', time: '2 days ago', icon: Users, color: 'text-purple-600' },
            { action: 'Scheduled emails processed', time: '3 days ago', icon: Clock, color: 'text-yellow-600' },
            { action: 'System maintenance completed', time: '1 week ago', icon: CheckCircle, color: 'text-green-600' },
          ].map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icon className={activity.color} size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  View Details
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default Reports;