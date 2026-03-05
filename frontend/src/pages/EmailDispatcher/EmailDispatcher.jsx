// src/pages/EmailDispatcher.jsx
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
  const [replyToName, setReplyToName] = useState('BMM');
  
  // Filters
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  
  // Multi-select activity filters
  const [selectedMainActivities, setSelectedMainActivities] = useState([]);
  const [selectedSubActivities, setSelectedSubActivities] = useState(new Set());
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [subActivitySearchTerm, setSubActivitySearchTerm] = useState('');
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [showSubActivityDropdown, setShowSubActivityDropdown] = useState(false);
  
  // Category structures
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [availableSubActivities, setAvailableSubActivities] = useState([]);
  
  // Display options for recipients
  const [recipientDisplayOptions, setRecipientDisplayOptions] = useState({
    showAll: false,
    maxRows: 5000,
    pageSizeOptions: [50, 100, 250, 500, 1000, 2500, 5000]
  });
  
  // Sending settings
  const [sendSpeed, setSendSpeed] = useState(3600); // emails per hour
  const [useTimeWindow, setUseTimeWindow] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [batchName, setBatchName] = useState('');
  
  // Emails list - ensure it's always an array
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [loadingEmails, setLoadingEmails] = useState(false);
  
  // Display options for emails
  const [emailDisplayOptions, setEmailDisplayOptions] = useState({
    showAll: false,
    maxRows: 5000,
    pageSizeOptions: [50, 100, 250, 500, 1000, 2500, 5000]
  });
  
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

  const [emailPagination, setEmailPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });

  // Distribution settings
  const [distributionMethod, setDistributionMethod] = useState('spread');
  const [fixedDelaySeconds, setFixedDelaySeconds] = useState(1);

  // Update available sub-activities when main activities change
  useEffect(() => {
    if (selectedMainActivities.length > 0) {
      const subs = [];
      selectedMainActivities.forEach(mainCat => {
        const mainSubs = subCategories[mainCat] || [];
        subs.push(...mainSubs);
      });
      setAvailableSubActivities([...new Set(subs)]);
    } else {
      setAvailableSubActivities([]);
    }
  }, [selectedMainActivities, subCategories]);

  // Refetch when filters change
  useEffect(() => {
    fetchRecipients();
  }, [pagination.page, pagination.pageSize, search, selectedMainActivities, selectedSubActivities, cityFilter, recipientDisplayOptions.showAll]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchEmails();
    } else if (activeTab === 'sent') {
      fetchSentEmails();
    }
    if (activeTab === 'batches') {
      fetchBatches();
    }
    fetchStats();
    
    // Refresh every 10 seconds
    const interval = setInterval(() => {
      if (activeTab === 'pending') {
        fetchEmails();
      } else if (activeTab === 'sent') {
        fetchSentEmails();
      }
      fetchBatches();
      fetchStats();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [activeTab, emailPagination.page, emailPagination.pageSize, emailDisplayOptions.showAll]);

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    setError(null);
    try {
      const params = {
        search: search || undefined,
        x_activitec: selectedMainActivities.length > 0 ? selectedMainActivities.join(',') : undefined,
        sub_x_activitec: selectedSubActivities.size > 0 ? Array.from(selectedSubActivities).join(',') : undefined,
        city: cityFilter || undefined,
        page: recipientDisplayOptions.showAll ? 1 : pagination.page,
        page_size: recipientDisplayOptions.showAll ? recipientDisplayOptions.maxRows : pagination.pageSize,
      };
      
      const data = await emailDispatcherAPI.getAvailableRecipients(params);
      setRecipients(Array.isArray(data.results) ? data.results : []);
      setPagination(prev => ({
        ...prev,
        totalCount: data.count || 0,
        totalPages: recipientDisplayOptions.showAll 
          ? 1
          : Math.ceil((data.count || 0) / prev.pageSize) || 1,
      }));
    } catch (err) {
      console.error('Error fetching recipients:', err);
      setError('Erreur lors du chargement des destinataires');
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const fetchCategories = async () => {
    try {
      console.log('=== fetchCategories started ===');
      console.log('Calling API to get activities...');
      
      const data = await emailDispatcherAPI.getActivities();
      
      console.log('Raw API response:', data);
      console.log('Data type:', typeof data);
      console.log('Is array?', Array.isArray(data));
      
      if (data && typeof data === 'object') {
        console.log('Data keys:', Object.keys(data));
      }
      
      // Check if data has the new structure
      if (data && data.main_categories && data.sub_categories) {
        console.log('Using new structured data format');
        console.log('Main categories:', data.main_categories);
        console.log('Sub categories:', data.sub_categories);
        
        setMainCategories(data.main_categories || []);
        setSubCategories(data.sub_categories || {});
        setAllCategories(data.activities || []);
        
        console.log('State updated with structured data');
      } else if (Array.isArray(data)) {
        console.log('Using array format (fallback)');
        console.log('Activities array length:', data.length);
        console.log('First 10 activities:', data.slice(0, 10));
        
        setAllCategories(data);
        
        const mainCats = new Set();
        const subCatsByMain = {};
        
        data.forEach((cat, index) => {
          if (cat && typeof cat === 'string') {
            if (cat.includes('/')) {
              const [main, sub] = cat.split('/').map(s => s.trim());
              mainCats.add(main);
              
              if (!subCatsByMain[main]) {
                subCatsByMain[main] = [];
              }
              if (!subCatsByMain[main].includes(cat)) {
                subCatsByMain[main].push(cat);
              }
            } else {
              mainCats.add(cat);
              if (!subCatsByMain[cat]) {
                subCatsByMain[cat] = [];
              }
            }
          }
        });
        
        const mainCategoriesArray = Array.from(mainCats).sort();
        console.log('Parsed main categories:', mainCategoriesArray);
        console.log('Parsed sub categories:', subCatsByMain);
        
        setMainCategories(mainCategoriesArray);
        setSubCategories(subCatsByMain);
        
        console.log('State updated with parsed array data');
      } else {
        console.warn('Unexpected data format:', data);
        setAllCategories([]);
        setMainCategories([]);
        setSubCategories({});
      }
      
      console.log('=== fetchCategories completed ===');
    } catch (err) {
      console.error('ERROR in fetchCategories:', err);
      console.error('Error details:', err.message);
      console.error('Error stack:', err.stack);
      
      setAllCategories([]);
      setMainCategories([]);
      setSubCategories({});
    }
  };

  const fetchEmails = async () => {
    try {
      setLoadingEmails(true);
      const params = {
        page: emailDisplayOptions.showAll ? 1 : emailPagination.page,
        page_size: emailDisplayOptions.showAll ? emailDisplayOptions.maxRows : emailPagination.pageSize,
      };
      
      const data = await emailDispatcherAPI.getEmails(params);
      setEmails(Array.isArray(data.results) ? data.results : []);
      setEmailPagination(prev => ({
        ...prev,
        totalCount: data.count || 0,
        totalPages: emailDisplayOptions.showAll
          ? 1
          : Math.ceil((data.count || 0) / prev.pageSize) || 1,
      }));
    } catch (err) {
      console.error('Error fetching emails:', err);
      setEmails([]);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchSentEmails = async () => {
    try {
      setLoadingEmails(true);
      const params = {
        page: emailDisplayOptions.showAll ? 1 : emailPagination.page,
        page_size: emailDisplayOptions.showAll ? emailDisplayOptions.maxRows : emailPagination.pageSize,
      };
      
      const data = await emailDispatcherAPI.getSentEmails(params);
      setEmails(Array.isArray(data.results) ? data.results : []);
      setEmailPagination(prev => ({
        ...prev,
        totalCount: data.count || 0,
        totalPages: emailDisplayOptions.showAll
          ? 1
          : Math.ceil((data.count || 0) / prev.pageSize) || 1,
      }));
    } catch (err) {
      console.error('Error fetching sent emails:', err);
      setEmails([]);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const data = await emailDispatcherAPI.getBatches(10);
      const batchesArray = Array.isArray(data) ? data : [];
      setBatches(batchesArray);
      
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

  const clearAllFilters = () => {
    setSelectedMainActivities([]);
    setSelectedSubActivities(new Set());
    setCityFilter('');
    setSearch('');
    setPagination(prev => ({ ...prev, page: 1 }));
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
        body_html: bodyHtml,
        body_text: bodyText,
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
        
        setTimeout(() => {
          fetchEmails();
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

  const formatCategory = (category) => {
    if (!category) return 'Général';
    if (category.includes('/')) {
      const [main, sub] = category.split('/').map(s => s.trim());
      return (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-900">{main}</span>
          <span className="text-xs text-gray-500">{sub}</span>
        </div>
      );
    }
    return <span className="text-xs text-gray-700">{category}</span>;
  };

  const hasRecipients = Array.isArray(recipients) && recipients.length > 0;
  const hasEmails = Array.isArray(emails) && emails.length > 0;

  const toggleRecipientDisplayMode = (showAll) => {
    setRecipientDisplayOptions(prev => ({ ...prev, showAll }));
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchRecipients();
  };

  const changeRecipientPageSize = (newSize) => {
    setPagination(prev => ({ 
      ...prev, 
      pageSize: newSize,
      page: 1
    }));
    setRecipientDisplayOptions(prev => ({ ...prev, showAll: false }));
    fetchRecipients();
  };

  const toggleEmailDisplayMode = (showAll) => {
    setEmailDisplayOptions(prev => ({ ...prev, showAll }));
    setEmailPagination(prev => ({ ...prev, page: 1 }));
    if (activeTab === 'sent') {
      fetchSentEmails();
    } else {
      fetchEmails();
    }
  };

  const changeEmailPageSize = (newSize) => {
    setEmailPagination(prev => ({ 
      ...prev, 
      pageSize: newSize,
      page: 1
    }));
    setEmailDisplayOptions(prev => ({ ...prev, showAll: false }));
    if (activeTab === 'sent') {
      fetchSentEmails();
    } else {
      fetchEmails();
    }
  };

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
          <Card className="overflow-hidden border-0 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 400px)' }}>
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
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
            <div className="p-4 border-b bg-white">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Search box - takes 3 columns */}
                <div className="relative md:col-span-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email, entreprise..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
                
                {/* Main Activity Multi-Select with Search - takes 3 columns */}
                <div className="relative md:col-span-3">
                  <div 
                    className="w-full px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between bg-white"
                    onClick={() => setShowActivityDropdown(!showActivityDropdown)}
                  >
                    <span className="truncate">
                      {selectedMainActivities.length === 0 
                        ? 'Sélectionner activités principales' 
                        : `${selectedMainActivities.length} activité(s) principale(s) sélectionnée(s)`}
                    </span>
                    <ChevronDown size={18} className={`transform transition-transform ${showActivityDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {showActivityDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
                      {/* Search inside dropdown */}
                      <div className="p-2 border-b sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Rechercher activité..."
                            value={activitySearchTerm}
                            onChange={(e) => setActivitySearchTerm(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 border rounded-lg text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      
                      {/* Options list */}
                      <div className="overflow-y-auto max-h-60">
                        {mainCategories
                          .filter(cat => cat.toLowerCase().includes(activitySearchTerm.toLowerCase()))
                          .map(cat => (
                            <label 
                              key={cat} 
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedMainActivities.includes(cat)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const newSelected = [...selectedMainActivities, cat];
                                    setSelectedMainActivities(newSelected);
                                  } else {
                                    const newSelected = selectedMainActivities.filter(c => c !== cat);
                                    setSelectedMainActivities(newSelected);
                                  }
                                  setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="rounded border-gray-300 text-indigo-600"
                              />
                              <span className="text-sm">{cat}</span>
                              <span className="text-xs text-gray-500 ml-auto">
                                ({subCategories[cat]?.length || 0})
                              </span>
                            </label>
                          ))}
                          
                        {mainCategories.filter(cat => cat.toLowerCase().includes(activitySearchTerm.toLowerCase())).length === 0 && (
                          <div className="px-3 py-4 text-sm text-gray-500 text-center">
                            Aucune activité trouvée
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Sub Activity Multi-Select with Search - takes 3 columns */}
                <div className="relative md:col-span-3">
                  <div 
                    className={`w-full px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between bg-white ${
                      selectedMainActivities.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={() => selectedMainActivities.length > 0 && setShowSubActivityDropdown(!showSubActivityDropdown)}
                  >
                    <span className="truncate">
                      {selectedMainActivities.length === 0 
                        ? 'Sélectionnez d\'abord une activité principale'
                        : availableSubActivities.length === 0
                        ? 'Aucune sous-activité disponible'
                        : `${selectedSubActivities.size} sous-activité(s) sélectionnée(s)`}
                    </span>
                    {selectedMainActivities.length > 0 && (
                      <ChevronDown size={18} className={`transform transition-transform ${showSubActivityDropdown ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                  
                  {showSubActivityDropdown && selectedMainActivities.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
                      {/* Search inside dropdown */}
                      <div className="p-2 border-b sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Rechercher sous-activité..."
                            value={subActivitySearchTerm}
                            onChange={(e) => setSubActivitySearchTerm(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 border rounded-lg text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      
                      {/* Options list */}
                      <div className="overflow-y-auto max-h-60">
                        {/* Quick select all/none */}
                        {availableSubActivities.length > 0 && (
                          <div className="px-3 py-2 border-b bg-gray-50 flex gap-2 text-xs">
                            <button
                              onClick={() => {
                                setSelectedSubActivities(new Set(availableSubActivities));
                                setPagination(prev => ({ ...prev, page: 1 }));
                              }}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              Tout sélectionner
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => {
                                setSelectedSubActivities(new Set());
                                setPagination(prev => ({ ...prev, page: 1 }));
                              }}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              Tout désélectionner
                            </button>
                          </div>
                        )}
                        
                        {availableSubActivities
                          .filter(sub => sub.toLowerCase().includes(subActivitySearchTerm.toLowerCase()))
                          .map(sub => (
                            <label 
                              key={sub} 
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSubActivities.has(sub)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedSubActivities);
                                  if (e.target.checked) {
                                    newSet.add(sub);
                                  } else {
                                    newSet.delete(sub);
                                  }
                                  setSelectedSubActivities(newSet);
                                  setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="rounded border-gray-300 text-indigo-600"
                              />
                              <span className="text-sm">{sub.split('/').pop().trim()}</span>
                              <span className="text-xs text-gray-400 ml-2 truncate">{sub}</span>
                            </label>
                          ))}
                          
                        {availableSubActivities.filter(sub => sub.toLowerCase().includes(subActivitySearchTerm.toLowerCase())).length === 0 && (
                          <div className="px-3 py-4 text-sm text-gray-500 text-center">
                            Aucune sous-activité trouvée
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* City filter - takes 2 columns */}
                <div className="relative md:col-span-2">
                  <input
                    type="text"
                    placeholder="Ville..."
                    value={cityFilter}
                    onChange={(e) => {
                      setCityFilter(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                
                {/* Display Options Dropdown - takes 1 column */}
                <div className="md:col-span-1">
                  <select
                    value={recipientDisplayOptions.showAll ? 'all' : pagination.pageSize}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'all') {
                        toggleRecipientDisplayMode(true);
                      } else {
                        changeRecipientPageSize(parseInt(value));
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg bg-white cursor-pointer"
                  >
                    <optgroup label="Pages">
                      {recipientDisplayOptions.pageSizeOptions.map(size => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Mode spécial">
                      <option value="all">Tout</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Selected filters summary */}
              {(selectedMainActivities.length > 0 || selectedSubActivities.size > 0 || cityFilter || search) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
                  <Filter size={16} className="text-indigo-600" />
                  <span className="text-sm text-indigo-700 font-medium">Filtres actifs:</span>
                  
                  {search && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                      Recherche: {search}
                      <button
                        onClick={() => {
                          setSearch('');
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="hover:bg-indigo-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  
                  {selectedMainActivities.map(act => (
                    <span 
                      key={act}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs"
                    >
                      {act}
                      <button
                        onClick={() => {
                          const newSelected = selectedMainActivities.filter(a => a !== act);
                          setSelectedMainActivities(newSelected);
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="hover:bg-indigo-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  
                  {Array.from(selectedSubActivities).map(sub => (
                    <span 
                      key={sub}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs"
                    >
                      {sub.split('/').pop().trim()}
                      <button
                        onClick={() => {
                          const newSet = new Set(selectedSubActivities);
                          newSet.delete(sub);
                          setSelectedSubActivities(newSet);
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="hover:bg-indigo-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  
                  {cityFilter && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                      Ville: {cityFilter}
                      <button
                        onClick={() => {
                          setCityFilter('');
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="hover:bg-indigo-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  
                  <button
                    onClick={clearAllFilters}
                    className="ml-auto text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <X size={14} />
                    Effacer tout
                  </button>
                </div>
              )}

              {/* Show indicator when in "show all" mode */}
              {recipientDisplayOptions.showAll && (
                <div className="mt-3 flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
                  <Eye size={16} className="text-indigo-600" />
                  <span className="text-sm text-indigo-700">
                    Affichage de tous les résultats
                  </span>
                  <button
                    onClick={() => {
                      setRecipientDisplayOptions(prev => ({ ...prev, showAll: false }));
                      setPagination(prev => ({ ...prev, pageSize: 50, page: 1 }));
                      fetchRecipients();
                    }}
                    className="ml-2 p-1 hover:bg-indigo-200 rounded-lg transition-colors"
                    title="Revenir au mode paginé"
                  >
                    <X size={14} className="text-indigo-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Recipients Table */}
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
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
                      .filter(r => r && !r.already_used)
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
                            {formatCategory(r.x_activitec)}
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

            {/* Pagination - Only show when not in "show all" mode */}
            {!recipientDisplayOptions.showAll && (
              <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
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
            )}

            {/* Summary when showing all */}
            {recipientDisplayOptions.showAll && (
              <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-700">
                Affichage de <span className="font-medium">{recipients.filter(r => !r.already_used).length}</span> résultats sur{' '}
                <span className="font-medium">{pagination.totalCount.toLocaleString()}</span> au total
                {recipients.filter(r => !r.already_used).length >= recipientDisplayOptions.maxRows && (
                  <span className="ml-2 text-amber-600">
                    (limité à {recipientDisplayOptions.maxRows} lignes)
                  </span>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {/* PENDING TAB */}
      {activeTab === 'pending' && (
        <Card className="overflow-hidden border-0 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 300px)' }}>
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
              {/* Display Options Dropdown for emails */}
              <select
                value={emailDisplayOptions.showAll ? 'all' : emailPagination.pageSize}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    toggleEmailDisplayMode(true);
                  } else {
                    changeEmailPageSize(parseInt(value));
                  }
                }}
                className="px-3 py-2 border rounded-lg bg-white cursor-pointer text-sm"
              >
                <optgroup label="Pages">
                  {emailDisplayOptions.pageSizeOptions.map(size => (
                    <option key={size} value={size}>
                      {size} par page
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Mode spécial">
                  <option value="all">Tout afficher (max {emailDisplayOptions.maxRows})</option>
                </optgroup>
              </select>

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

          {/* Show indicator when in "show all" mode for emails */}
          {emailDisplayOptions.showAll && (
            <div className="p-4 border-b bg-indigo-50 flex items-center gap-2">
              <Eye size={16} className="text-indigo-600" />
              <span className="text-sm text-indigo-700">
                Affichage de tous les résultats
              </span>
              <button
                onClick={() => {
                  setEmailDisplayOptions(prev => ({ ...prev, showAll: false }));
                  setEmailPagination(prev => ({ ...prev, pageSize: 50, page: 1 }));
                  fetchEmails();
                }}
                className="ml-2 p-1 hover:bg-indigo-200 rounded-lg transition-colors"
                title="Revenir au mode paginé"
              >
                <X size={14} className="text-indigo-600" />
              </button>
            </div>
          )}

          {/* Scrollable Emails Table */}
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
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
                {loadingEmails ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin h-8 w-8 mx-auto text-indigo-600" />
                    </td>
                  </tr>
                ) : !hasEmails ? (
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

          {/* Pagination - Only show when not in "show all" mode */}
          {!emailDisplayOptions.showAll && (
            <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                {emails.filter(e => ['pending', 'queued'].includes(e.status)).length} sur {emailPagination.totalCount || 0} emails en attente
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={emailPagination.page === 1 || loadingEmails}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-4 py-2 text-sm">
                  Page {emailPagination.page} / {Math.max(emailPagination.totalPages, 1)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={emailPagination.page >= emailPagination.totalPages || loadingEmails}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Summary when showing all */}
          {emailDisplayOptions.showAll && (
            <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-700">
              Affichage de <span className="font-medium">{emails.filter(e => ['pending', 'queued'].includes(e.status)).length}</span> résultats sur{' '}
              <span className="font-medium">{emailPagination.totalCount.toLocaleString()}</span> au total
              {emails.length >= emailDisplayOptions.maxRows && (
                <span className="ml-2 text-amber-600">
                  (limité à {emailDisplayOptions.maxRows} lignes)
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      {/* SENT TAB */}
      {activeTab === 'sent' && (
        <Card className="overflow-hidden border-0 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 300px)' }}>
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold">Emails envoyés</h3>
            
            <select
              value={emailDisplayOptions.showAll ? 'all' : emailPagination.pageSize}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  toggleEmailDisplayMode(true);
                } else {
                  changeEmailPageSize(parseInt(value));
                }
              }}
              className="px-3 py-2 border rounded-lg bg-white cursor-pointer text-sm"
            >
              <optgroup label="Pages">
                {emailDisplayOptions.pageSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size} par page
                  </option>
                ))}
              </optgroup>
              <optgroup label="Mode spécial">
                <option value="all">Tout afficher (max {emailDisplayOptions.maxRows})</option>
              </optgroup>
            </select>
          </div>

          {/* Show indicator when in "show all" mode */}
          {emailDisplayOptions.showAll && (
            <div className="p-4 border-b bg-indigo-50 flex items-center gap-2">
              <Eye size={16} className="text-indigo-600" />
              <span className="text-sm text-indigo-700">
                Affichage de tous les résultats
              </span>
              <button
                onClick={() => {
                  setEmailDisplayOptions(prev => ({ ...prev, showAll: false }));
                  setEmailPagination(prev => ({ ...prev, pageSize: 50, page: 1 }));
                  fetchSentEmails();
                }}
                className="ml-2 p-1 hover:bg-indigo-200 rounded-lg transition-colors"
                title="Revenir au mode paginé"
              >
                <X size={14} className="text-indigo-600" />
              </button>
            </div>
          )}

          {/* Scrollable Sent Emails Table */}
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sujet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envoyé le</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingEmails ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin h-8 w-8 mx-auto text-indigo-600" />
                    </td>
                  </tr>
                ) : !hasEmails ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      Aucun email envoyé
                    </td>
                  </tr>
                ) : (
                  emails
                    .filter(e => e && e.status === 'sent')
                    .map(email => (
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

          {/* Pagination - Only show when not in "show all" mode */}
          {!emailDisplayOptions.showAll && (
            <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                {emails.filter(e => e.status === 'sent').length} sur {emailPagination.totalCount || 0} emails envoyés
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={emailPagination.page === 1 || loadingEmails}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-4 py-2 text-sm">
                  Page {emailPagination.page} / {Math.max(emailPagination.totalPages, 1)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={emailPagination.page >= emailPagination.totalPages || loadingEmails}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Summary when showing all */}
          {emailDisplayOptions.showAll && (
            <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-700">
              Affichage de <span className="font-medium">{emails.filter(e => e.status === 'sent').length}</span> résultats sur{' '}
              <span className="font-medium">{emailPagination.totalCount.toLocaleString()}</span> au total
              {emails.length >= emailDisplayOptions.maxRows && (
                <span className="ml-2 text-amber-600">
                  (limité à {emailDisplayOptions.maxRows} lignes)
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      {/* BATCHES TAB */}
      {activeTab === 'batches' && (
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold">Historique des envois</h3>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
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