import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Mail, CheckCircle2, XCircle, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, Eye, AlertCircle, 
  Filter, Layers, Clock, Download, X, Play, History, RotateCw, FileText,
  Users, Send, CheckCircle, Activity, Zap, Target, TrendingUp, BarChart, PieChart, Archive, Calendar,
  ChevronDown, ChevronUp
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { emailGenerationAPI, dashboardAPI } from '../services/api';

const POLL_INTERVAL = 2000; // 2 seconds for faster updates

const EmailGeneration = () => {
  const [recipients, setRecipients] = useState([]);
  const [generatedEmails, setGeneratedEmails] = useState([]);
  const [pendingEmails, setPendingEmails] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('auto');
  const [categoryFilter, setCategoryFilter] = useState(''); // For filtering tables
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    count: 0,
    totalPages: 1,
  });
  
  // Email preview
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailContent, setEmailContent] = useState(null);
  const [expandedEmailId, setExpandedEmailId] = useState(null); // For inline preview
  
  // Generation states
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTasks, setActiveTasks] = useState([]);
  const [taskProgress, setTaskProgress] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [recentTasks, setRecentTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('recipients'); // 'recipients', 'pending', 'generated'
  
  const pollIntervalsRef = useRef({});

  // Load data on mount + auto refresh
  useEffect(() => {
    fetchRecipients();
    fetchGeneratedEmails();
    fetchPendingEmails();
    fetchCategories();
    fetchRecentTasks();
    
    // Auto refresh every 5 seconds
    const refreshInterval = setInterval(() => {
      fetchGeneratedEmails();
      fetchPendingEmails();
    }, 5000);
    
    return () => {
      clearInterval(refreshInterval);
      Object.values(pollIntervalsRef.current).forEach(clearInterval);
    };
  }, [pagination.page, search, categoryFilter]); // Add categoryFilter to dependencies

  const fetchRecipients = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: search.trim() || undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
      };

      const response = await emailGenerationAPI.getRecipients(params);
      
      // Filter recipients by category if selected
      let results = response.results || [];
      if (categoryFilter) {
        results = results.filter(r => (r.x_activitec || 'Général') === categoryFilter);
      }
      
      // Enhance recipients with email status
      const enhancedResults = results.map(recipient => ({
        ...recipient,
        has_generated_email: generatedEmails.some(e => e.recipient_id === recipient.id),
        is_pending: pendingEmails.some(e => e.recipient_id === recipient.id),
        generated_email: generatedEmails.find(e => e.recipient_id === recipient.id)
      }));
      
      setRecipients(enhancedResults);
      setPagination(prev => ({
        ...prev,
        count: response.count || 0,
        totalPages: Math.ceil((response.count || 0) / prev.pageSize) || 1,
      }));
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.error || 'Erreur lors du chargement des destinataires');
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedEmails = async () => {
    try {
      const params = {
        page_size: 100,
        category: categoryFilter || undefined,
        status: 'ready' // Add this to specifically fetch ready emails
      };
      const response = await emailGenerationAPI.getEmailStatus(null, params);
      
      // Map the API response to match what the frontend expects
      const mappedEmails = (response.results || []).map(email => ({
        id: email.id,
        recipient_id: email.recipient?.id,
        recipient_name: email.recipient_name || email.recipient?.name || 'Inconnu',
        recipient_email: email.recipient_email || email.recipient?.email || '',
        subject: email.subject || '(Sans sujet)',
        category: email.category_name || email.category || 'Général',
        status: email.status,
        status_display: email.status_display || this.getStatusDisplayFrench(email.status),
        generated_at: email.generated_at,
        sent_at: email.sent_at,
        error_message: email.error_message,
        // Add any other fields you need
      }));
      
      setGeneratedEmails(mappedEmails);
    } catch (err) {
      console.error('Failed to fetch generated emails:', err);
    }
  };

  // Helper function to get French status display
  const getStatusDisplayFrench = (status) => {
    const statusMap = {
      'pending_generation': 'En attente',
      'generating': 'Génération...',
      'generated': 'Généré',
      'ready': 'Prêt à envoyer',
      'sending': 'Envoi...',
      'sent': 'Envoyé',
      'failed_generation': 'Échec',
      'failed_sending': 'Échec envoi',
      'cancelled': 'Annulé',
    };
    return statusMap[status] || status;
  };

  const fetchPendingEmails = async () => {
    try {
      const queue = await dashboardAPI.getGenerationQueue();
      let pending = queue.pending || [];
      if (categoryFilter) {
        pending = pending.filter(p => p.category === categoryFilter);
      }
      setPendingEmails(pending);
    } catch (err) {
      console.error('Failed to fetch pending emails:', err);
    }
  };

  const fetchEmailContent = async (emailId) => {
    try {
      const email = await emailGenerationAPI.getEmailStatus(emailId);
      setEmailContent(email);
      setShowEmailModal(true);
    } catch (err) {
      console.error('Failed to fetch email content:', err);
      setError('Impossible de charger le contenu de l\'email');
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await emailGenerationAPI.getCategories();
      setCategories(response || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchRecentTasks = async () => {
    try {
      const tasks = await emailGenerationAPI.getTasks();
      setRecentTasks(tasks || []);
      
      const active = tasks.filter(t => 
        ['PENDING', 'PROGRESS'].includes(t.status)
      );
      setActiveTasks(active.map(t => t.task_id));
      
      active.forEach(task => startPolling(task.task_id));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const startPolling = (taskId) => {
    if (pollIntervalsRef.current[taskId]) {
      clearInterval(pollIntervalsRef.current[taskId]);
    }
    
    pollIntervalsRef.current[taskId] = setInterval(() => {
      pollTaskStatus(taskId);
    }, POLL_INTERVAL);
  };

  const stopPolling = (taskId) => {
    if (pollIntervalsRef.current[taskId]) {
      clearInterval(pollIntervalsRef.current[taskId]);
      delete pollIntervalsRef.current[taskId];
    }
  };

  const pollTaskStatus = async (taskId) => {
    try {
      const response = await emailGenerationAPI.getTaskStatus(taskId);
      
      setTaskProgress(prev => ({
        ...prev,
        [taskId]: response
      }));
      
      if (response.status === 'SUCCESS') {
        stopPolling(taskId);
        setActiveTasks(prev => prev.filter(id => id !== taskId));
        
        // Refresh all data
        fetchRecipients();
        fetchGeneratedEmails();
        fetchPendingEmails();
        fetchRecentTasks();
        
        if (response.result) {
          setSuccess(`✅ ${response.result.generated} email(s) générés avec succès !`);
        }
        
      } else if (response.status === 'FAILURE' || response.status === 'CANCELLED') {
        stopPolling(taskId);
        setActiveTasks(prev => prev.filter(id => id !== taskId));
        setError(response.error || 'Erreur lors de la génération');
        fetchRecentTasks();
      }
      
    } catch (err) {
      console.error(`Polling error for task ${taskId}:`, err);
    }
  };

  const handleGenerate = async () => {
    if (selected.size === 0) {
      alert('Veuillez sélectionner au moins un destinataire');
      return;
    }

    const categoryInfo = selectedCategory === 'auto' 
      ? 'détection automatique par activité' 
      : `catégorie: ${selectedCategory}`;
    
    if (!window.confirm(
      `Générer ${selected.size} email(s) avec ${categoryInfo} ?`
    )) return;

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        recipient_ids: Array.from(selected),
      };
      
      if (selectedCategory !== 'auto') {
        payload.category_name = selectedCategory;
      }

      const response = await emailGenerationAPI.generateEmails(payload);
      
      if (response.task_id) {
        setActiveTasks(prev => [...prev, response.task_id]);
        startPolling(response.task_id);
        
        setSuccess(
          `✅ Génération démarrée pour ${selected.size} email(s) !\n` +
          `🆔 Tâche: ${response.task_id.slice(0, 8)}`
        );
        
        setSelected(new Set());
        fetchPendingEmails();
      }
      
    } catch (err) {
      setError(err.error || 'Erreur lors du démarrage de la génération');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (recipientId, category) => {
    if (!window.confirm('Voulez-vous régénérer cet email ?')) return;
    
    setGenerating(true);
    try {
      const payload = {
        recipient_ids: [recipientId],
        category_name: category,
        force: true
      };
      
      const response = await emailGenerationAPI.generateEmails(payload);
      
      if (response.task_id) {
        setSuccess(`✅ Régénération démarrée`);
        startPolling(response.task_id);
      }
    } catch (err) {
      setError('Erreur lors de la régénération');
    } finally {
      setGenerating(false);
    }
  };

  const cancelTask = async (taskId) => {
    if (!window.confirm('Voulez-vous annuler cette génération ?')) return;
    
    try {
      await emailGenerationAPI.cancelTask(taskId);
      stopPolling(taskId);
      setActiveTasks(prev => prev.filter(id => id !== taskId));
      fetchRecentTasks();
      fetchPendingEmails();
      setSuccess(`✅ Tâche ${taskId.slice(0, 8)} annulée`);
    } catch (err) {
      setError('Erreur lors de l\'annulation');
    }
  };

  const toggleAll = () => {
    if (selected.size === recipients.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recipients.map(r => r.id)));
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const changePage = (delta) => {
    const next = pagination.page + delta;
    if (next >= 1 && next <= pagination.totalPages) {
      setPagination(p => ({ ...p, page: next }));
    }
  };

  const getSelectedCategories = () => {
    const selectedRecipients = recipients.filter(r => selected.has(r.id));
    const uniqueCategories = [...new Set(selectedRecipients.map(r => r.x_activitec || 'Général'))];
    return uniqueCategories;
  };

  const selectedCategories = getSelectedCategories();
  const hasMultipleCategories = selectedCategories.length > 1;
  const hasActiveTasks = activeTasks.length > 0;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get unique categories for filter
  const allCategories = [...new Set([
    ...categories.map(c => c.name),
    ...recipients.map(r => r.x_activitec).filter(Boolean),
    ...generatedEmails.map(e => e.category).filter(Boolean),
    ...pendingEmails.map(e => e.category).filter(Boolean)
  ])];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Header
        title="Génération d'emails"
        description="Sélectionnez les destinataires et générez des emails personnalisés"
      />

      {/* Active Tasks Banner */}
      {hasActiveTasks && (
        <Card className="bg-indigo-50 border-indigo-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin h-5 w-5 text-indigo-600" />
              <span className="font-medium text-indigo-900">
                {activeTasks.length} génération(s) en cours
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTasksModal(true)}
            >
              <History size={16} className="mr-2" />
              Voir les tâches
            </Button>
          </div>
        </Card>
      )}

      {/* Main Controls Card */}
      <Card className="mb-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Recherche destinataires
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Nom, email, ville..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPagination(p => ({ ...p, page: 1 }));
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Layers size={16} className="inline mr-1" />
                Catégorie de génération
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="auto">🔍 Détection automatique (par activité)</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {hasMultipleCategories && selectedCategory === 'auto' && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠️ {selectedCategories.length} activités différentes - emails adaptés
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Filter size={16} className="inline mr-1" />
                Filtrer par catégorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPagination(p => ({ ...p, page: 1 }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Toutes les catégories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'recipients' ? 'primary' : 'outline'}
                onClick={() => setActiveTab('recipients')}
              >
                <Users size={16} className="mr-2" />
                Destinataires ({recipients.length})
              </Button>
              <Button
                variant={activeTab === 'pending' ? 'primary' : 'outline'}
                onClick={() => setActiveTab('pending')}
              >
                <Clock size={16} className="mr-2" />
                En attente ({pendingEmails.length})
              </Button>
              <Button
                variant={activeTab === 'generated' ? 'primary' : 'outline'}
                onClick={() => setActiveTab('generated')}
              >
                <Mail size={16} className="mr-2" />
                Générés ({generatedEmails.length})
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-4">
              {activeTab === 'recipients' && (
                <>
                  <div className="text-sm bg-gray-100 px-3 py-2 rounded-lg">
                    <span className="text-gray-600">Sélectionnés :</span>
                    <strong className="ml-1 text-indigo-700">{selected.size}</strong>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleGenerate}
                    disabled={selected.size === 0 || generating}
                    loading={generating}
                  >
                    <Mail size={18} className="mr-2" />
                    Générer ({selected.size})
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={fetchRecipients} disabled={loading}>
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </div>
          </div>

          {showCategoryBreakdown && selected.size > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Répartition par activité :
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map(cat => {
                  const count = recipients.filter(r => 
                    selected.has(r.id) && (r.x_activitec || 'Général') === cat
                  ).length;
                  return (
                    <span key={cat} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-gray-300 text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className="ml-2 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">
                        {count}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 whitespace-pre-line">
              {success}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-3">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Main Content - Dynamic Tabs */}
      <Card className="overflow-hidden">
        {activeTab === 'recipients' && (
          // RECIPIENTS TABLE
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mb-4" />
                <p className="text-gray-600">Chargement des destinataires...</p>
              </div>
            ) : recipients.length === 0 ? (
              <div className="text-center py-24 text-gray-500">
                <Mail size={64} className="mx-auto mb-6 opacity-50" />
                <h3 className="text-xl font-medium">Aucun destinataire trouvé</h3>
                <p className="mt-2">
                  {categoryFilter ? `Aucun destinataire dans la catégorie "${categoryFilter}"` : 'Vérifiez que des partenaires ont été importés.'}
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
                            checked={recipients.length > 0 && selected.size === recipients.length}
                            onChange={toggleAll}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Activité</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recipients.map(r => {
                        const hasEmail = r.has_generated_email;
                        const isPending = r.is_pending;
                        const email = r.generated_email;
                        
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleOne(r.id)}
                                disabled={hasEmail || isPending}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 font-medium">
                              <div className="flex items-center">
                                {r.name || r.complete_name || '—'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-600">{r.email || '—'}</td>
                            <td className="px-6 py-4 text-gray-600">{r.city || '—'}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                {r.x_activitec || 'Général'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {hasEmail ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                  <CheckCircle2 size={14} className="mr-1" /> Généré
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                  <Loader2 size={14} className="mr-1 animate-spin" /> En attente
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                  <XCircle size={14} className="mr-1" /> Non généré
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setPreview(r)}
                                  className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50"
                                  title="Voir détails"
                                >
                                  <Eye size={18} />
                                </button>
                                {hasEmail && email && (
                                  <>
                                    <button
                                      onClick={() => fetchEmailContent(email.id)}
                                      className="text-green-600 hover:text-green-900 p-2 rounded-full hover:bg-green-50"
                                      title="Voir l'email"
                                    >
                                      <FileText size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleRegenerate(r.id, r.x_activitec)}
                                      className="text-amber-600 hover:text-amber-900 p-2 rounded-full hover:bg-amber-50"
                                      title="Régénérer"
                                    >
                                      <RotateCw size={18} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t gap-4">
                  <div className="text-sm text-gray-600">
                    Affichage {recipients.length} sur {pagination.count.toLocaleString()}
                    {categoryFilter && ` dans "${categoryFilter}"`}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => changePage(-1)} 
                      disabled={pagination.page === 1 || loading}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="px-4 py-2 text-sm">
                      Page {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => changePage(1)} 
                      disabled={pagination.page >= pagination.totalPages || loading}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'pending' && (
          // PENDING EMAILS TABLE
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Emails en attente de génération</h3>
            {pendingEmails.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                <p>Aucun email en attente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingEmails.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <Loader2 className="animate-spin h-4 w-4 text-indigo-600" />
                      <div>
                        <p className="font-medium">{item.recipient}</p>
                        <p className="text-sm text-gray-500">{item.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{item.category}</span>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        En attente
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'generated' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Emails générés</h3>
            {generatedEmails.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Mail size={48} className="mx-auto mb-4 opacity-50" />
                <p>Aucun email généré</p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedEmails.map((email) => {
                  const isExpanded = expandedEmailId === email.id;
                  // Determine status display
                  const statusDisplay = email.status_display || 
                    (email.status === 'ready' ? 'Prêt à envoyer' : 
                    email.status === 'generated' ? 'Généré' : 
                    email.status || 'Inconnu');
                  
                  // Determine background color based on status
                  const bgColor = email.status === 'ready' ? 'bg-green-50' : 
                                email.status === 'generated' ? 'bg-blue-50' : 
                                'bg-gray-50';
                  
                  return (
                    <div key={email.id} className="border rounded-lg overflow-hidden">
                      <div className={`flex items-center justify-between p-4 ${bgColor} hover:bg-opacity-80 transition-colors`}>
                        <div className="flex items-center gap-4 flex-1">
                          {email.status === 'ready' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <Mail className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{email.recipient_name || email.recipient?.name}</p>
                            <p className="text-sm text-gray-600 line-clamp-1">{email.subject}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600 hidden md:inline">{email.category}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            email.status === 'ready' ? 'bg-green-100 text-green-800' :
                            email.status === 'generated' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {statusDisplay}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </Button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 border-t bg-white">
                          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                              <span className="text-gray-500">Destinataire:</span>
                              <span className="ml-2 font-medium">{email.recipient_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Email:</span>
                              <span className="ml-2">{email.recipient_email}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Catégorie:</span>
                              <span className="ml-2">{email.category}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Généré le:</span>
                              <span className="ml-2">{formatDate(email.generated_at)}</span>
                            </div>
                          </div>
                          
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium mb-2">Sujet:</p>
                            <p className="text-gray-700">{email.subject}</p>
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchEmailContent(email.id)}
                            >
                              <Eye size={16} className="mr-1" />
                              Voir le contenu complet
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRegenerate(email.recipient_id, email.category)}
                            >
                              <RotateCw size={16} className="mr-1" />
                              Régénérer
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Email Preview Modal */}
      {showEmailModal && emailContent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Mail className="text-indigo-600" size={20} />
                {emailContent.subject}
              </h2>
              <button 
                onClick={() => setShowEmailModal(false)} 
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="mb-4 pb-4 border-b">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Destinataire:</span>
                    <span className="ml-2 font-medium">{emailContent.recipient?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2">{emailContent.recipient?.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Catégorie:</span>
                    <span className="ml-2">{emailContent.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Généré le:</span>
                    <span className="ml-2">{formatDate(emailContent.generated_at)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Sujet:</h3>
                <p className="text-lg font-medium">{emailContent.subject}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Contenu:</h3>
                <div 
                  className="prose max-w-none border rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: emailContent.body_html || emailContent.body_preview }}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>
                Fermer
              </Button>
              <Button variant="primary">
                <Send size={16} className="mr-2" />
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks Modal */}
      {showTasksModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <History size={20} />
                Tâches de génération
              </h2>
              <button 
                onClick={() => setShowTasksModal(false)}
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {recentTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Aucune tâche récente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTasks.map(task => {
                    const isActive = ['PENDING', 'PROGRESS'].includes(task.status);
                    return (
                      <div key={task.task_id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              {isActive ? (
                                <Loader2 className="animate-spin h-4 w-4 text-indigo-600" />
                              ) : task.status === 'SUCCESS' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="font-medium">
                                Tâche {task.task_id?.slice(0, 8)}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                task.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                task.status === 'PROGRESS' ? 'bg-indigo-100 text-indigo-800' :
                                task.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">Destinataires:</span>
                                <span className="ml-2 font-medium">{task.total_recipients || 0}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Catégories:</span>
                                <span className="ml-2 font-medium">{task.total_categories || 0}</span>
                              </div>
                            </div>
                            {task.result && (
                              <div className="text-sm text-green-600">
                                ✓ {task.result.generated || 0} emails générés
                              </div>
                            )}
                          </div>
                          {isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelTask(task.task_id)}
                            >
                              <X size={14} className="mr-1" />
                              Annuler
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recipient Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Détails du destinataire</h2>
              <button 
                onClick={() => setPreview(null)} 
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500">Nom</div>
                <div className="font-medium">{preview.name || preview.complete_name || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <div className="font-medium break-all">{preview.email || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Ville</div>
                <div className="font-medium">{preview.city || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Activité</div>
                <div className="font-medium">{preview.x_activitec || 'Général'}</div>
              </div>
              {preview.company_name && (
                <div>
                  <div className="text-sm text-gray-500">Entreprise</div>
                  <div className="font-medium">{preview.company_name}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailGeneration;