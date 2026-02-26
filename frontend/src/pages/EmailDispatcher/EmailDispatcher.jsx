import React, { useState, useEffect } from 'react';
import {
  Mail, Send, Clock, Calendar, Settings, AlertCircle,
  CheckCircle2, XCircle, Loader2, Eye, Search, RefreshCw,
  ChevronLeft, ChevronRight, Users, FileText, Filter,
  Plus, Play, Pause, X, Download, BarChart, Layers, ChevronDown
} from 'lucide-react';

import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import emailDispatcherAPI from '../../services/emailDispatcherAPI';
import api from '../../services/api';

const EmailDispatcher = () => {
  const [activeTab, setActiveTab] = useState('compose'); // compose, pending, sent, batches
  
  // Available recipients - ensure it's always an array
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState(new Set());
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  
  // Email content
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  
  // UI toggles
  const [showHtml, setShowHtml] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Sender info
  const [fromEmail, setFromEmail] = useState('contact@mail-bmm.ma');
  const [fromName, setFromName] = useState('BMM');
  const [replyTo, setReplyTo] = useState('contact@bmm.ma');
  const [replyToName, setReplyToName] = useState('Service Commercial');
  
  // Filters
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [activities, setActivities] = useState([]);
  
  // Sending settings
  const [sendSpeed, setSendSpeed] = useState(50); // emails per hour
  const [useTimeWindow, setUseTimeWindow] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [batchName, setBatchName] = useState('');
  
  // Emails list - ensure it's always an array
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [loadingEmails, setLoadingEmails] = useState(false);
  
  // Batches - ensure it's always an array
  const [batches, setBatches] = useState([]);
  const [activeBatch, setActiveBatch] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0, pending: 0, queued: 0,
    sending: 0, sent: 0, failed: 0, sent_today: 0
  });
  
  // UI state
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });

  // Load data on mount
  useEffect(() => {
    fetchRecipients();
    fetchActivities();
    fetchEmails();
    fetchBatches();
    fetchStats();
    
    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchEmails();
      fetchBatches();
      fetchStats();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchRecipients();
  }, [pagination.page, search, activityFilter, cityFilter]);

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    setError(null);
    try {
      const params = {
        search: search || undefined,
        x_activitec: activityFilter || undefined,
        city: cityFilter || undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
      };
      
      const data = await emailDispatcherAPI.getAvailableRecipients(params);
      // Ensure data.results is an array
      setRecipients(Array.isArray(data.results) ? data.results : []);
      setPagination(prev => ({
        ...prev,
        totalCount: data.count || 0,
        totalPages: Math.ceil((data.count || 0) / prev.pageSize) || 1,
      }));
    } catch (err) {
      console.error('Error fetching recipients:', err);
      setError('Erreur lors du chargement des destinataires');
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const data = await emailDispatcherAPI.getActivities();
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setActivities([]);
    }
  };

  const fetchEmails = async () => {
    try {
      const data = await emailDispatcherAPI.getEmails();
      setEmails(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      console.error('Error fetching emails:', err);
      setEmails([]);
    }
  };

  const fetchBatches = async () => {
    try {
      const data = await emailDispatcherAPI.getBatches(10);
      const batchesArray = Array.isArray(data) ? data : [];
      setBatches(batchesArray);
      
      // Check for active batch
      const active = batchesArray.find(b => b && b.status === 'sending');
      setActiveBatch(active || null);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setBatches([]);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await emailDispatcherAPI.getEmailStats();
      setStats(data || {
        total: 0, pending: 0, queued: 0,
        sending: 0, sent: 0, failed: 0, sent_today: 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const toggleAllRecipients = () => {
    if (!Array.isArray(recipients)) return;
    
    const availableRecipients = recipients.filter(r => r && !r.already_used);
    
    if (selectedRecipients.size === availableRecipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(availableRecipients.map(r => r.id).filter(Boolean)));
    }
  };

  const toggleRecipient = (id) => {
    if (!id) return;
    const newSet = new Set(selectedRecipients);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecipients(newSet);
  };

  const toggleAllEmails = () => {
    if (!Array.isArray(emails)) return;
    
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id).filter(Boolean)));
    }
  };

  const toggleEmail = (id) => {
    if (!id) return;
    const newSet = new Set(selectedEmails);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedEmails(newSet);
  };

  const handleCreateEmails = async () => {
    if (selectedRecipients.size === 0) {
      alert('Veuillez sélectionner au moins un destinataire');
      return;
    }
    
    if (!subject.trim()) {
      alert('Veuillez saisir un sujet');
      return;
    }
    
    if (!bodyText.trim()) {
      alert('Veuillez saisir le contenu texte de l\'email');
      return;
    }
    
    setCreating(true);
    setError(null);
    setSuccess(null);
    
    try {
      const data = {
        recipient_ids: Array.from(selectedRecipients),
        subject,
        body_html: bodyHtml, // Optional
        body_text: bodyText, // Required
        from_email: fromEmail,
        from_name: fromName,
        reply_to: replyTo,
        reply_to_name: replyToName,
        batch_name: batchName || `Campagne ${new Date().toLocaleString('fr-FR')}`,
      };
      
      const response = await emailDispatcherAPI.createEmails(data);
      
      if (response && response.success) {
        setSuccess(`${response.count || selectedRecipients.size} emails créés avec succès !`);
        setSelectedRecipients(new Set());
        setSubject('');
        setBodyText('');
        setBodyHtml('');
        
        // Wait a moment then refresh
        setTimeout(() => {
          fetchEmails();  // Refresh the email list
          fetchStats();
        }, 1000);
      } else {
        setError(response?.error || 'Erreur lors de la création');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleSendEmails = async () => {
    if (selectedEmails.size === 0) {
      alert('Veuillez sélectionner au moins un email');
      return;
    }
    
    const confirmMessage = useTimeWindow
      ? `Envoyer ${selectedEmails.size} email(s) entre ${startTime} et ${endTime} ?`
      : `Envoyer MAINTENANT ${selectedEmails.size} email(s) ?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    setSending(true);
    setError(null);
    setSuccess(null);
    
    try {
      const data = {
        email_ids: Array.from(selectedEmails),
        batch_name: batchName || `Envoi ${new Date().toLocaleString('fr-FR')}`,
        send_speed: Number(sendSpeed),
        use_time_window: useTimeWindow,
        start_time: useTimeWindow ? startTime : null,
        end_time: useTimeWindow ? endTime : null,
        distribution_method: distributionMethod,
        fixed_delay_seconds: fixedDelaySeconds,
      };
      
      const response = await emailDispatcherAPI.sendEmails(data);
      
      if (response && response.success) {
        setSuccess(`${response.message} (estimé: ${response.estimated_time})`);
        setSelectedEmails(new Set());
        if (response.batch) {
          setActiveBatch(response.batch);
        }
        fetchEmails();
        fetchBatches();
        fetchStats();
      } else {
        setError(response?.error || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const handleCancelBatch = async (batchId) => {
    if (!window.confirm('Voulez-vous annuler cet envoi ?')) return;
    
    try {
      const response = await emailDispatcherAPI.cancelBatch(batchId);
      if (response && response.success) {
        setSuccess('Envoi annulé');
        setActiveBatch(null);
        fetchBatches();
        fetchEmails();
        fetchStats();
      } else {
        setError(response?.error || 'Erreur lors de l\'annulation');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de l\'annulation');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock, label: 'En attente' },
      'queued': { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock, label: 'Dans la file' },
      'sending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Loader2, label: 'En cours' },
      'sent': { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2, label: 'Envoyé' },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Échoué' },
    };
    return badges[status] || badges.pending;
  };

  // Safely check if we have recipients
  const hasRecipients = Array.isArray(recipients) && recipients.length > 0;
  const hasEmails = Array.isArray(emails) && emails.length > 0;


  const [distributionMethod, setDistributionMethod] = useState('spread');
  const [fixedDelaySeconds, setFixedDelaySeconds] = useState(1);


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Header
        title="Envoi d'emails"
        description="Créez et envoyez des emails aux destinataires importés"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="bg-blue-50">
          <div className="flex items-center gap-3">
            <Mail className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-blue-600">Total</p>
              <p className="text-2xl font-bold text-blue-700">{stats.total || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-yellow-50">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-600" size={24} />
            <div>
              <p className="text-sm text-yellow-600">En attente</p>
              <p className="text-2xl font-bold text-yellow-700">{(stats.pending || 0) + (stats.queued || 0)}</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-600" size={24} />
            <div>
              <p className="text-sm text-green-600">Envoyés</p>
              <p className="text-2xl font-bold text-green-700">{stats.sent || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-purple-50">
          <div className="flex items-center gap-3">
            <Calendar className="text-purple-600" size={24} />
            <div>
              <p className="text-sm text-purple-600">Aujourd'hui</p>
              <p className="text-2xl font-bold text-purple-700">{stats.sent_today || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-red-50">
          <div className="flex items-center gap-3">
            <XCircle className="text-red-600" size={24} />
            <div>
              <p className="text-sm text-red-600">Échoués</p>
              <p className="text-2xl font-bold text-red-700">{stats.failed || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-indigo-50">
          <div className="flex items-center gap-3">
            <BarChart className="text-indigo-600" size={24} />
            <div>
              <p className="text-sm text-indigo-600">En cours</p>
              <p className="text-2xl font-bold text-indigo-700">{stats.sending || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Batch Progress */}
      {activeBatch && (
        <Card className="bg-indigo-50 border-indigo-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="animate-spin h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">{activeBatch.name || 'Envoi en cours'}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                  Envoi en cours...
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-indigo-700">Total</p>
                  <p className="text-xl font-bold text-indigo-900">{activeBatch.total_emails || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Envoyés</p>
                  <p className="text-xl font-bold text-green-600">{activeBatch.sent_count || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-red-700">Échoués</p>
                  <p className="text-xl font-bold text-red-600">{activeBatch.failed_count || 0}</p>
                </div>
              </div>

              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${activeBatch.progress || 0}%` }}
                />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelBatch(activeBatch.batch_id)}
              className="ml-4"
            >
              <X size={16} className="mr-1" />
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('compose')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'compose'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Plus size={16} className="inline mr-1" />
          Composer
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock size={16} className="inline mr-1" />
          En attente ({(stats.pending || 0) + (stats.queued || 0)})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'sent'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle2 size={16} className="inline mr-1" />
          Envoyés ({stats.sent || 0})
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers size={16} className="inline mr-1" />
          Lots ({Array.isArray(batches) ? batches.length : 0})
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* COMPOSE TAB */}
      {activeTab === 'compose' && (
        <>
          {/* Email Composition */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Composition de l'email</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    De (email)
                  </label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    De (nom)
                  </label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Répondre à (email)
                  </label>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Répondre à (nom)
                  </label>
                  <input
                    type="text"
                    value={replyToName}
                    onChange={(e) => setReplyToName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sujet
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Objet de l'email"
                />
              </div>
              
              {/* Text content - PRIMARY */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenu texte <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="Bonjour [Nom],

Nous souhaitons vous informer de nos dernières offres...

Cordialement,
L'équipe"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ce contenu sera envoyé à tous les destinataires. Utilisez [Nom] pour personnaliser.
                </p>
              </div>
              
              {/* HTML content - OPTIONAL with toggle */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHtml(!showHtml)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-gray-700">Version HTML (optionnelle)</span>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      {showHtml ? 'Masquer' : 'Afficher'}
                    </span>
                  </span>
                  <ChevronDown 
                    size={18} 
                    className={`text-gray-500 transform transition-transform ${showHtml ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {showHtml && (
                  <div className="p-4 border-t">
                    <textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      placeholder="<h1>Bonjour [Nom]</h1><p>...</p>"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Si fourni, la version HTML sera utilisée pour les clients qui la supportent.
                      La version texte sera toujours envoyée en fallback.
                    </p>
                  </div>
                )}
              </div>

              {/* Preview Section */}
              {bodyText && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Eye size={16} className="text-gray-600" />
                      <span className="text-gray-700">Aperçu</span>
                    </span>
                    <ChevronDown 
                      size={18} 
                      className={`text-gray-500 transform transition-transform ${showPreview ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  {showPreview && (
                    <div className="p-4 border-t bg-white">
                      <div className="mb-3 pb-3 border-b">
                        <p className="text-sm"><span className="font-medium">De:</span> {fromName} &lt;{fromEmail}&gt;</p>
                        <p className="text-sm"><span className="font-medium">Répondre à:</span> {replyToName} &lt;{replyTo}&gt;</p>
                        <p className="text-sm"><span className="font-medium">Sujet:</span> {subject}</p>
                      </div>
                      <div className="whitespace-pre-wrap font-sans text-sm">
                        {bodyText}
                      </div>
                      {bodyHtml && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs text-gray-500 mb-2">Version HTML (sera utilisée si supportée):</p>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Recipient Selection */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Sélectionner les destinataires</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={handleCreateEmails}
                  disabled={selectedRecipients.size === 0 || creating}
                  loading={creating}
                >
                  <Mail size={16} className="mr-2" />
                  Créer ({selectedRecipients.size}) emails
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              
              <select
                value={activityFilter}
                onChange={(e) => {
                  setActivityFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">Toutes activités</option>
                {Array.isArray(activities) && activities.map(act => (
                  <option key={act} value={act}>{act}</option>
                ))}
              </select>
              
              <input
                type="text"
                placeholder="Ville..."
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Recipients Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={hasRecipients && selectedRecipients.size === recipients.filter(r => !r.already_used).length}
                        onChange={toggleAllRecipients}
                        disabled={loadingRecipients || !hasRecipients || recipients.filter(r => !r.already_used).length === 0}
                        className="rounded border-gray-300 text-indigo-600"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingRecipients ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto text-indigo-600" />
                      </td>
                    </tr>
                  ) : !hasRecipients ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        Aucun destinataire trouvé
                      </td>
                    </tr>
                  ) : (
                    recipients
                      .filter(r => r && !r.already_used)  // ← Add this filter to exclude already used
                      .map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedRecipients.has(r.id)}
                              onChange={() => toggleRecipient(r.id)}
                              className="rounded border-gray-300 text-indigo-600"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium">{r.name || 'Inconnu'}</div>
                            {r.company_name && (
                              <div className="text-sm text-gray-500">{r.company_name}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-600">{r.email || '—'}</td>
                          <td className="px-6 py-4 text-gray-600">{r.city || '—'}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                              {r.x_activitec || 'Général'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-green-600">Disponible</span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
<div className="flex justify-between items-center px-6 py-4 border-t">
  <div className="text-sm text-gray-600">
    {recipients.filter(r => !r.already_used).length} sur {pagination.totalCount || 0} destinataires disponibles
  </div>
  <div className="flex gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
      disabled={pagination.page === 1 || loadingRecipients}
    >
      <ChevronLeft size={16} />
    </Button>
    <span className="px-4 py-2 text-sm">
      Page {pagination.page} / {Math.max(pagination.totalPages, 1)}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
      disabled={pagination.page >= pagination.totalPages || loadingRecipients}
    >
      <ChevronRight size={16} />
    </Button>
  </div>
</div>
          </Card>
        </>
      )}

      {/* PENDING TAB */}
      {activeTab === 'pending' && (
        <Card>
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedEmails.size} sélectionné(s)
              </span>
              <Button variant="outline" size="sm" onClick={toggleAllEmails} disabled={!hasEmails}>
                {selectedEmails.size === emails.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {/* Sending Settings */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={sendSpeed}
                  onChange={(e) => setSendSpeed(Number(e.target.value))}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={3600}>1/sec (3600/h) - Lent</option>
                  <option value={7200}>2/sec (7200/h) - Moyen</option>
                  <option value={10800}>3/sec (10800/h) - Standard</option>
                  <option value={14400}>4/sec (14400/h) - Rapide</option>
                  <option value={18000}>5/sec (18000/h) - Très rapide</option>
                  <option value={36000}>10/sec (36000/h) - Intensive</option>
                  <option value={72000}>20/sec (72000/h) - Turbo</option>
                  <option value={0}>Illimité (attention!)</option>
                </select>
                
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useTimeWindow}
                    onChange={(e) => setUseTimeWindow(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Programmer
                </label>
                
                {useTimeWindow && (
                  <>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="px-2 py-2 border rounded-lg text-sm"
                    />
                    <span>-</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="px-2 py-2 border rounded-lg text-sm"
                    />
                    
                    {/* Distribution method */}
                    <select
                      value={distributionMethod}
                      onChange={(e) => setDistributionMethod(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="spread">Étaler sur la période</option>
                      <option value="fixed_delay">Délai fixe</option>
                    </select>
                    
                    {distributionMethod === 'fixed_delay' && (
                      <input
                        type="number"
                        value={fixedDelaySeconds}
                        onChange={(e) => setFixedDelaySeconds(Number(e.target.value))}
                        min="1"
                        max="3600"
                        className="px-2 py-2 border rounded-lg text-sm w-20"
                        placeholder="sec"
                      />
                    )}
                  </>
                )}
                
                {/* Show estimate */}
                {selectedEmails.size > 0 && (
                  <span className="text-sm text-gray-600">
                    ~{Math.ceil(selectedEmails.size / (sendSpeed || 3600) * 60)} min
                  </span>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleSendEmails}
                disabled={selectedEmails.size === 0 || sending}
                loading={sending}
              >
                <Send size={16} className="mr-2" />
                Envoyer ({selectedEmails.size})
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={hasEmails && selectedEmails.size === emails.length}
                      onChange={toggleAllEmails}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sujet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créé le</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!hasEmails ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      Aucun email en attente
                    </td>
                  </tr>
                ) : (
                  emails.filter(e => e && ['pending', 'queued'].includes(e.status)).map(email => {
                    const badge = email ? getStatusBadge(email.status) : getStatusBadge('pending');
                    const Icon = badge.icon;
                    
                    return (
                      <tr key={email.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.id)}
                            onChange={() => toggleEmail(email.id)}
                            disabled={email.status !== 'pending' && email.status !== 'queued'}
                            className="rounded border-gray-300 text-indigo-600 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium">{email.recipient_name || 'Inconnu'}</td>
                        <td className="px-6 py-4 text-gray-600">{email.recipient_email || '—'}</td>
                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{email.subject || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${badge.bg} ${badge.text}`}>
                            <Icon size={12} className="mr-1" />
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {email.created_at ? new Date(email.created_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* SENT TAB */}
      {activeTab === 'sent' && (
        <Card>
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold">Emails envoyés</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sujet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envoyé le</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!hasEmails ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      Aucun email envoyé
                    </td>
                  </tr>
                ) : (
                  emails.filter(e => e && e.status === 'sent').map(email => (
                    <tr key={email.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{email.recipient_name || 'Inconnu'}</td>
                      <td className="px-6 py-4 text-gray-600">{email.recipient_email || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{email.subject || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {email.sent_at ? new Date(email.sent_at).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          <CheckCircle2 size={12} className="mr-1" />
                          Envoyé
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* BATCHES TAB */}
      {activeTab === 'batches' && (
        <Card>
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold">Historique des envois</h3>
          </div>
          <div className="divide-y">
            {!Array.isArray(batches) || batches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Aucun lot d'envoi
              </div>
            ) : (
              batches.map(batch => batch && (
                <div key={batch.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{batch.name || 'Lot sans nom'}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          batch.status === 'sending' ? 'bg-yellow-100 text-yellow-800' :
                          batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                          batch.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {batch.status === 'sending' ? 'En cours' :
                           batch.status === 'completed' ? 'Terminé' :
                           batch.status === 'cancelled' ? 'Annulé' :
                           batch.status || 'Inconnu'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Total:</span>
                          <span className="ml-2 font-medium">{batch.total_emails || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Envoyés:</span>
                          <span className="ml-2 font-medium text-green-600">{batch.sent_count || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Échoués:</span>
                          <span className="ml-2 font-medium text-red-600">{batch.failed_count || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Vitesse:</span>
                          <span className="ml-2 font-medium">{batch.send_speed || 0}/h</span>
                        </div>
                      </div>
                      
                      {batch.progress > 0 && batch.progress < 100 && (
                        <div className="mt-2 w-64 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${batch.progress}%` }}
                          />
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-500">
                        {batch.started_at && `Démarré: ${new Date(batch.started_at).toLocaleString('fr-FR')}`}
                        {batch.completed_at && ` - Terminé: ${new Date(batch.completed_at).toLocaleString('fr-FR')}`}
                      </div>
                    </div>
                    
                    {batch.status === 'sending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelBatch(batch.batch_id)}
                      >
                        <X size={14} className="mr-1" />
                        Annuler
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default EmailDispatcher;