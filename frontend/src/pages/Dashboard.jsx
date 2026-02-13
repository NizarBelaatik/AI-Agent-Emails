import React, { useState, useEffect } from 'react';
import {
  Users, Mail, Send, CheckCircle, Clock, AlertCircle,
  TrendingUp, Download, Calendar, Filter, RefreshCw,
  BarChart, PieChart, Activity, Zap, Target, Archive, Loader2
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { dashboardAPI } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const data = await dashboardAPI.getStats();
      setStats(data);
      
      const queue = await dashboardAPI.getGenerationQueue();
      setQueueData(queue);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Impossible de charger les données du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  // Default values if stats is null
  const safeStats = stats || {
    quick_stats: {
      total_recipients: 0,
      total_emails_generated: 0,
      total_emails_sent: 0,
      active_templates: 0,
    },
    today: {
      recipients_imported: 0,
      emails_generated: 0,
      emails_sent: 0,
      emails_failed: 0,
      emails_in_queue: 0,
      emails_ready: 0,
    },
    queue_status: {
      pending_generation: 0,
      generating: 0,
      ready_to_send: 0,
      sending: 0,
    },
    last_7_days: [],
    categories: [],
    recent_activity: [],
    performance: {
      avg_generation_time: 0,
      avg_sending_time: 0,
      success_rate: 100,
      peak_hours: [{ hour: 8 }],
    },
  };

  const safeQueueData = queueData || {
    pending: [],
    generating: [],
    stats: {
      total_in_queue: 0,
      pending_count: 0,
      generating_count: 0,
      estimated_time: '0 secondes',
    },
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Header
          title="Tableau de bord"
          description="Vue d'ensemble de votre activité email"
        />
        <Button variant="outline" onClick={handleRefresh} className="flex items-center gap-2">
          <RefreshCw size={16} />
          Actualiser
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm">Destinataires</p>
              <p className="text-3xl font-bold">{safeStats.quick_stats.total_recipients}</p>
              <p className="text-indigo-100 text-xs mt-2">
                +{safeStats.today.recipients_imported} aujourd'hui
              </p>
            </div>
            <Users size={48} className="opacity-50" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Emails générés</p>
              <p className="text-3xl font-bold">{safeStats.quick_stats.total_emails_generated}</p>
              <p className="text-green-100 text-xs mt-2">
                +{safeStats.today.emails_generated} aujourd'hui
              </p>
            </div>
            <Mail size={48} className="opacity-50" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Emails envoyés</p>
              <p className="text-3xl font-bold">{safeStats.quick_stats.total_emails_sent}</p>
              <p className="text-blue-100 text-xs mt-2">
                +{safeStats.today.emails_sent} aujourd'hui
              </p>
            </div>
            <Send size={48} className="opacity-50" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Templates actifs</p>
              <p className="text-3xl font-bold">{safeStats.quick_stats.active_templates}</p>
              <p className="text-purple-100 text-xs mt-2">
                {safeStats.categories?.length || 0} catégories
              </p>
            </div>
            <Target size={48} className="opacity-50" />
          </div>
        </Card>
      </div>

      {/* Queue Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="text-indigo-600" size={20} />
              File de génération
            </h3>
            <span className="text-sm text-gray-500">
              {safeQueueData.stats.total_in_queue} en attente
            </span>
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {safeQueueData.pending?.length > 0 ? (
              safeQueueData.pending.slice(0, 5).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <div>
                      <p className="font-medium">{item.recipient || 'Inconnu'}</p>
                      <p className="text-xs text-gray-500">{item.category || 'Général'}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    En attente
                  </span>
                </div>
              ))
            ) : safeQueueData.generating?.length > 0 ? (
              safeQueueData.generating.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin h-4 w-4 text-indigo-600" />
                    <div>
                      <p className="font-medium">{item.recipient || 'Inconnu'}</p>
                      <p className="text-xs text-gray-500">Génération en cours...</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucun email en attente</p>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => window.location.href = '/email-generation/queue'}
          >
            Voir toute la file
          </Button>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Send className="text-green-600" size={20} />
              Prêts à envoyer
            </h3>
            <span className="text-sm text-gray-500">
              {safeStats.queue_status.ready_to_send || 0} emails
            </span>
          </div>
          
          <div className="space-y-4">
            {safeStats.queue_status.ready_to_send > 0 ? (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Campagne prête</span>
                  <span className="text-2xl font-bold text-green-600">
                    {safeStats.queue_status.ready_to_send}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Emails générés et prêts à être envoyés
                </p>
                <Button variant="primary" className="mt-3 w-full">
                  <Send size={16} className="mr-2" />
                  Envoyer maintenant
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mail size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucun email prêt à envoyer</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Charts & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Last 7 Days Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Activité des 7 derniers jours</h3>
            <div className="flex gap-2">
              <Button 
                variant={dateRange === '7d' ? 'primary' : 'outline'} 
                size="sm"
                onClick={() => setDateRange('7d')}
              >
                7j
              </Button>
              <Button 
                variant={dateRange === '30d' ? 'primary' : 'outline'} 
                size="sm"
                onClick={() => setDateRange('30d')}
              >
                30j
              </Button>
            </div>
          </div>
          
          <div className="h-64">
            {safeStats.last_7_days?.length > 0 ? (
              <div className="flex h-full items-end justify-around">
                {safeStats.last_7_days.map((day) => {
                  const maxHeight = Math.max(...safeStats.last_7_days.map(d => d.generated), 1);
                  const height = maxHeight > 0 ? (day.generated / maxHeight) * 180 : 20;
                  return (
                    <div key={day.date} className="flex flex-col items-center w-16">
                      <div className="text-xs text-gray-500 mb-1">{day.day}</div>
                      <div 
                        className="w-8 bg-indigo-500 rounded-t transition-all duration-300"
                        style={{ height: `${Math.max(height, 4)}px` }}
                      />
                      <div className="text-xs mt-1 font-medium">{day.generated}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Aucune donnée disponible</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded"></div>
              <span>Générés</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Envoyés</span>
            </div>
          </div>
        </Card>

        {/* Categories Distribution */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Distribution par catégorie</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {safeStats.categories?.length > 0 ? (
              safeStats.categories.slice(0, 5).map((cat) => {
                const total = safeStats.quick_stats.total_emails_generated || 1;
                const percentage = total > 0 ? (cat.total / total) * 100 : 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[150px]">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.total}</span>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Aucune catégorie</p>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Aujourd'hui</span>
              <span className="font-medium">{safeStats.today.emails_generated} générés</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Taux de succès</span>
              <span className="font-medium text-green-600">{safeStats.performance.success_rate}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity size={20} className="text-indigo-600" />
            Activité récente
          </h3>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {safeStats.recent_activity?.length > 0 ? (
            safeStats.recent_activity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {activity.type === 'generation' && (
                    <Mail className="text-green-600" size={18} />
                  )}
                  {activity.type === 'sending' && (
                    <Send className="text-blue-600" size={18} />
                  )}
                  {activity.type === 'error' && (
                    <AlertCircle className="text-red-600" size={18} />
                  )}
                  <div>
                    <p className="font-medium text-sm">{activity.recipient || 'Inconnu'}</p>
                    <p className="text-xs text-gray-500">
                      {activity.category || 'Général'} • {new Date(activity.time).toLocaleTimeString('fr-FR')}
                    </p>
                    {activity.error && (
                      <p className="text-xs text-red-600 mt-1">{activity.error}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  activity.status === 'success' ? 'bg-green-100 text-green-800' :
                  activity.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {activity.status === 'success' ? 'Succès' : 
                   activity.status === 'failed' ? 'Échec' : activity.status}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity size={40} className="mx-auto mb-2 opacity-50" />
              <p>Aucune activité récente</p>
            </div>
          )}
        </div>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Zap size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Temps moyen de génération</p>
              <p className="text-2xl font-bold">{safeStats.performance.avg_generation_time || 0}s</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Send size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Temps moyen d'envoi</p>
              <p className="text-2xl font-bold">{safeStats.performance.avg_sending_time || 0}s</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Heure de pointe</p>
              <p className="text-2xl font-bold">
                {safeStats.performance.peak_hours?.[0]?.hour || '8'}:00
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;