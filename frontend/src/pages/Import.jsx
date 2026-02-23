
// src/pages/Import.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, Upload, Check,
  X, ChevronLeft, ChevronRight, Database, RefreshCw, Eye, Users,
  AlertCircle, Mail, AlertTriangle, CheckCircle2, Download, Clock,
  Loader2, BarChart, Globe, Phone, Building, MapPin, Calendar,
  Hash, CreditCard, FileText, UserCheck, UserX, Briefcase,
  ChevronDown, ChevronUp, Sliders, Home, Map, Tag, User,
  Shield, Award, DollarSign, Link, ExternalLink, Copy,
  Filter as FilterIcon, Layers, FileSpreadsheet, Plus, Minus,
  Settings, XCircle, CheckCircle, HelpCircle, Sparkles,
  Inbox, ArrowUpDown, MoreHorizontal, Trash2, Edit,
  PieChart, TrendingUp, Users2, Globe2
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { importerAPI } from '../services/api';

const POLL_INTERVAL = 2000; // 2 seconds

const Import = () => {
  const [recipients, setRecipients] = useState([]);
  const [validRecipients, setValidRecipients] = useState([]);
  const [invalidRecipients, setInvalidRecipients] = useState([]);
  const [importedRecipients, setImportedRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState(new Set());
  const [activeTab, setActiveTab] = useState('valid');
  
  // Advanced filters popout state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    sources: [],
    legal_forms: [],
    cities: [],
    countries: []
  });
  
  const [filters, setFilters] = useState({
    // Basic filters
    search: '',
    x_activitec: '',
    active_only: true,
    has_email: true,
    
    // Advanced filters
    x_source: '',
    x_forme_juridique: '',
    x_effectif: '',
    x_ice: '',
    x_rc: '',
    x_if: '',
    city: '',
    country_id: '',
    state_id: '',
    industry_id: '',
    is_company: '',
    has_phone: false,
    has_mobile: false,
    has_website: false,
    has_vat: false,
    
    // Date filters
    date_from: '',
    date_to: '',
    create_date_from: '',
    create_date_to: '',
    
    // Numeric filters
    min_id: '',
    max_id: '',
    supplier_rank: '',
    customer_rank: '',
    credit_limit_min: '',
    credit_limit_max: '',
  });
  
  const [importedFilters, setImportedFilters] = useState({
    search: '',
    x_activitec: '',
    x_source: '',
    x_forme_juridique: '',
    city: '',
    date_from: '',
    date_to: '',
    import_date_from: '',
    import_date_to: '',
    is_company: '',
    has_email: false,
    active_only: false,
    min_id: '',
    max_id: '',
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });
  
  const [importedPagination, setImportedPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });
  
  const [loading, setLoading] = useState(false);
  const [importedLoading, setImportedLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [importedCategories, setImportedCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [importResult, setImportResult] = useState(null);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: 'id',
    direction: 'desc'
  });
  
  // Import tracking
  const [activeImportTask, setActiveImportTask] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  
  const pollIntervalsRef = useRef({});

  // Email validation function
  const validateEmail = (email) => {
    if (!email) return { valid: false, reason: 'Email manquant' };
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Format invalide' };
    }
    
    // Block disposable emails
    const disposableDomains = [
      'yopmail.com', 'tempmail.com', 'mailinator.com', 'guerrillamail.com',
      '10minutemail.com', 'throwawaymail.com', 'fakeinbox.com', 'temp-mail.org',
      'trashmail.com', 'sharklasers.com', 'spambox.com', 'mailnator.com',
      'getnada.com', 'tempinbox.com', 'fakemailgenerator.com'
    ];
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(domain)) {
      return { valid: false, reason: 'Email jetable' };
    }
    
    return { valid: true, reason: 'Valide' };
  };

  // Split recipients into valid and invalid
  const splitRecipientsByValidity = (recipientsList) => {
    const valid = [];
    const invalid = [];
    
    recipientsList.forEach(recipient => {
      const validation = validateEmail(recipient.email);
      if (validation.valid) {
        valid.push(recipient);
      } else {
        invalid.push({
          ...recipient,
          invalid_reason: validation.reason
        });
      }
    });
    
    return { valid, invalid };
  };

  useEffect(() => {
    fetchRecipients();
    fetchStats();
    fetchInvalidRecipients();
  }, [filters, pagination.page, sortConfig]);

  useEffect(() => {
    if (activeTab === 'imported') {
      fetchImportedRecipients();
    }
  }, [activeTab, importedFilters, importedPagination.page]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollIntervalsRef.current).forEach(clearInterval);
    };
  }, []);

  const startPolling = (taskId) => {
    if (pollIntervalsRef.current[taskId]) {
      clearInterval(pollIntervalsRef.current[taskId]);
    }
    
    pollIntervalsRef.current[taskId] = setInterval(() => {
      pollImportTask(taskId);
    }, POLL_INTERVAL);
  };

  const stopPolling = (taskId) => {
    if (pollIntervalsRef.current[taskId]) {
      clearInterval(pollIntervalsRef.current[taskId]);
      delete pollIntervalsRef.current[taskId];
    }
  };

  const pollImportTask = async (taskId) => {
    try {
      const response = await importerAPI.getImportTaskStatus(taskId);
      
      setImportProgress(response);
      
      if (response.status === 'SUCCESS') {
        stopPolling(taskId);
        setActiveImportTask(null);
        setShowProgressModal(false);
        
        // Show success message with results
        let message = `✅ Import terminé !\n\n`;
        message += `📥 Importés : ${response.result?.imported || 0}\n`;
        message += `🔄 Mis à jour : ${response.result?.updated || 0}\n`;
        message += `❌ Échecs : ${response.result?.failed || 0}\n`;
        
        if (response.result?.invalid > 0) {
          message += `⚠️ Emails invalides : ${response.result.invalid}\n`;
          setInvalidRecipients(response.result.invalid_details || []);
        }
        
        alert(message);
        
        // Refresh all data
        fetchRecipients();
        fetchStats();
        fetchImportedRecipients();
        fetchInvalidRecipients();
        setSelectedRecipients(new Set());
        setImportResult(response.result);
        
      } else if (response.status === 'FAILURE') {
        stopPolling(taskId);
        setActiveImportTask(null);
        setShowProgressModal(false);
        setErrorMessage(response.error || 'Erreur lors de l\'import');
      }
      // Keep polling for PROGRESS and PENDING
      
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const fetchRecipients = async () => {
    setErrorMessage(null);
    try {
      setLoading(true);
      
      // Build params object with all filters
      const params = {
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortConfig.key,
        sort_direction: sortConfig.direction,
      };
      
      // Add all filters that have values
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value;
        }
      });

      const data = await importerAPI.browseSource(params);
      
      if (data && Array.isArray(data.results)) {
        setRecipients(data.results);
        
        // Split into valid and invalid
        const { valid, invalid } = splitRecipientsByValidity(data.results);
        setValidRecipients(valid);
        setInvalidRecipients(invalid);
        
        setPagination(prev => ({
          ...prev,
          totalCount: data.count || 0,
          totalPages: Math.ceil((data.count || 0) / prev.pageSize) || 1,
        }));

        // Update filter options from response
        if (data.filter_options) {
          setFilterOptions(data.filter_options);
        }

        // Extract unique categories from valid recipients only
        const uniqueCats = [...new Set(
          valid.map(r => r.x_activitec || '').filter(Boolean)
        )];
        setCategories(uniqueCats);
        
        // Clear selections when data changes
        setSelectedRecipients(new Set());
      } else {
        setErrorMessage('Format de données invalide du serveur');
        setValidRecipients([]);
        setInvalidRecipients([]);
      }
    } catch (error) {
      setErrorMessage(error.error || 'Erreur de chargement des données');
      setValidRecipients([]);
      setInvalidRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchImportedRecipients = async () => {
    try {
      setImportedLoading(true);
      
      // Build params object with all filters
      const params = {
        page: importedPagination.page,
        page_size: importedPagination.pageSize,
      };
      
      Object.entries(importedFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value;
        }
      });

      const data = await importerAPI.getImported(params);
      
      if (data && Array.isArray(data.results)) {
        setImportedRecipients(data.results);
        
        setImportedPagination(prev => ({
          ...prev,
          totalCount: data.count || 0,
          totalPages: Math.ceil((data.count || 0) / prev.pageSize) || 1,
        }));

        // Update filter options
        if (data.filter_options) {
          setImportedCategories(data.filter_options.categories || []);
        }

        // Extract unique categories
        const uniqueCats = [...new Set(
          data.results.map(r => r.x_activitec || '').filter(Boolean)
        )];
        setImportedCategories(uniqueCats);
      }
    } catch (error) {
      console.error('Failed to fetch imported recipients:', error);
    } finally {
      setImportedLoading(false);
    }
  };

  const fetchInvalidRecipients = async () => {
    try {
      const response = await importerAPI.getInvalidRecipients();
      if (response && response.success) {
        const existingIds = new Set(invalidRecipients.map(r => r.id));
        const newInvalid = (response.invalid_recipients || []).filter(
          r => !existingIds.has(r.id)
        );
        setInvalidRecipients(prev => [...prev, ...newInvalid]);
      }
    } catch (error) {
      console.error('Failed to fetch invalid recipients:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await importerAPI.getSourceStats();
      if (response && response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Stats fetch failed:', error);
    }
  };

  const handleImport = async () => {
    const validSelectedIds = Array.from(selectedRecipients);
    
    if (validSelectedIds.length === 0) {
      alert('Veuillez sélectionner au moins un destinataire avec un email valide');
      return;
    }

    if (!window.confirm(`Importer ${validSelectedIds.length} destinataire(s) avec email valide ?\n\n⏱️ L'import peut prendre quelques minutes.`)) {
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);
      setErrorMessage(null);

      const payload = {
        selected_ids: validSelectedIds,
        limit: 5000,
        update_existing: true,
      };

      const result = await importerAPI.importRecipients(payload);
      
      if (result && result.task_id) {
        setActiveImportTask(result.task_id);
        setShowProgressModal(true);
        startPolling(result.task_id);
        
        setImportProgress({
          status: 'PENDING',
          progress: 0,
          processed: 0,
          total: validSelectedIds.length
        });
        
        setSelectedRecipients(new Set());
      } else if (result && result.success) {
        // Fallback for synchronous response
        setImportResult(result);
        
        let message = `✅ Import terminé !\n\n`;
        message += `📥 Importés : ${result.stats?.imported || 0}\n`;
        message += `🔄 Mis à jour : ${result.stats?.updated || 0}\n`;
        message += `❌ Échecs : ${result.stats?.failed || 0}\n`;
        
        if (result.stats?.invalid > 0) {
          message += `⚠️ Emails invalides ignorés : ${result.stats.invalid}\n`;
          setInvalidRecipients(prev => [...prev, ...(result.invalid_recipients || [])]);
        }

        alert(message);

        setSelectedRecipients(new Set());
        fetchRecipients();
        fetchStats();
        fetchImportedRecipients();
      }
    } catch (err) {
      console.error('[DEBUG] Import failed:', err);
      setErrorMessage(err.error || err.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = async () => {
    if (!activeImportTask) return;
    
    if (!window.confirm('Voulez-vous annuler cet import ?')) return;
    
    try {
      await importerAPI.cancelImportTask(activeImportTask);
      stopPolling(activeImportTask);
      setActiveImportTask(null);
      setShowProgressModal(false);
      setImportProgress(null);
    } catch (err) {
      console.error('Failed to cancel import:', err);
    }
  };

  const toggleSelectAll = () => {
    if (activeTab === 'valid') {
      const currentValidIds = validRecipients.map(r => r.id);
      const allSelected = currentValidIds.every(id => selectedRecipients.has(id));
      
      if (allSelected) {
        const newSelected = new Set(selectedRecipients);
        currentValidIds.forEach(id => newSelected.delete(id));
        setSelectedRecipients(newSelected);
      } else {
        const newSelected = new Set(selectedRecipients);
        currentValidIds.forEach(id => newSelected.add(id));
        setSelectedRecipients(newSelected);
      }
    }
  };

  const toggleSelectRecipient = (id, isValid) => {
    if (!isValid) return;
    
    const newSet = new Set(selectedRecipients);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecipients(newSet);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
    setSelectedRecipients(new Set());
  };

  const handleImportedFilterChange = (key, value) => {
    setImportedFilters(prev => ({ ...prev, [key]: value }));
    setImportedPagination(prev => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      x_activitec: '',
      active_only: true,
      has_email: true,
      x_source: '',
      x_forme_juridique: '',
      x_effectif: '',
      x_ice: '',
      x_rc: '',
      x_if: '',
      city: '',
      country_id: '',
      state_id: '',
      industry_id: '',
      is_company: '',
      has_phone: false,
      has_mobile: false,
      has_website: false,
      has_vat: false,
      date_from: '',
      date_to: '',
      create_date_from: '',
      create_date_to: '',
      min_id: '',
      max_id: '',
      supplier_rank: '',
      customer_rank: '',
      credit_limit_min: '',
      credit_limit_max: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const resetImportedFilters = () => {
    setImportedFilters({
      search: '',
      x_activitec: '',
      x_source: '',
      x_forme_juridique: '',
      city: '',
      date_from: '',
      date_to: '',
      import_date_from: '',
      import_date_to: '',
      is_company: '',
      has_email: false,
      active_only: false,
      min_id: '',
      max_id: '',
    });
    setImportedPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      setSelectedRecipients(new Set());
    }
  };

  const handleImportedPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= importedPagination.totalPages) {
      setImportedPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone) => {
    if (!phone) return '—';
    return phone.length > 15 ? phone.substr(0, 15) + '...' : phone;
  };

  const countActiveFilters = () => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'active_only' && value === true) return false;
      if (key === 'has_email' && value === true) return false;
      return value !== '' && value !== false && value !== null && value !== undefined;
    }).length;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const activeFilterCount = countActiveFilters();

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="ml-1 text-indigo-600" />
      : <ChevronDown size={14} className="ml-1 text-indigo-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-20 shadow-sm">
        <div className="px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                Import depuis la base source
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Parcourez et importez les partenaires de votre base Odoo
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium flex items-center gap-2">
                <Sparkles size={16} />
                Mode avancé
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Import Banner */}
      {activeImportTask && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 sticky top-[73px] z-20 shadow-lg">
          <div className="px-6 py-3 max-w-7xl mx-auto flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Loader2 className="animate-spin h-5 w-5" />
                <div className="absolute inset-0 animate-ping">
                  <Loader2 className="h-5 w-5 opacity-30" />
                </div>
              </div>
              <div>
                <span className="font-medium">Import en cours...</span>
                {importProgress && (
                  <p className="text-sm text-indigo-100">
                    {importProgress.processed || 0} / {importProgress.total || 0} traités
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowProgressModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <BarChart size={16} className="mr-2" />
              Voir progression
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 font-medium">Total source</p>
                  <p className="text-3xl font-bold mt-1">
                    {stats.total?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Database size={24} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 font-medium">Prêts à importer</p>
                  <p className="text-3xl font-bold mt-1">
                    {stats.with_email?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-green-100 mt-1">Actifs + email valide</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Mail size={24} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 font-medium">Entreprises</p>
                  <p className="text-3xl font-bold mt-1">
                    {stats.companies?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-purple-100 mt-1">Particuliers: {stats.individuals?.toLocaleString() || '0'}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Building size={24} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 font-medium">Importés</p>
                  <p className="text-3xl font-bold mt-1">
                    {importedPagination.totalCount?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Download size={24} />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('valid')}
              className={`px-5 py-3 font-medium text-sm flex items-center gap-2 transition-all relative ${
                activeTab === 'valid' 
                  ? 'text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail size={18} />
              À importer
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'valid' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {validRecipients.length}
              </span>
              {activeTab === 'valid' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('invalid')}
              className={`px-5 py-3 font-medium text-sm flex items-center gap-2 transition-all relative ${
                activeTab === 'invalid' 
                  ? 'text-amber-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle size={18} />
              Invalides
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'invalid' 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {invalidRecipients.length}
              </span>
              {activeTab === 'invalid' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('imported');
                fetchImportedRecipients();
              }}
              className={`px-5 py-3 font-medium text-sm flex items-center gap-2 transition-all relative ${
                activeTab === 'imported' 
                  ? 'text-green-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Download size={18} />
              Importés
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'imported' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {importedPagination.totalCount}
              </span>
              {activeTab === 'imported' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        {(activeTab === 'valid' || activeTab === 'invalid') && (
          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, ville..."
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              <select
                value={filters.x_activitec}
                onChange={e => handleFilterChange('x_activitec', e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm min-w-[180px] bg-white"
              >
                <option value="">Toutes catégories</option>
                {filterOptions.categories?.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                <button
                  onClick={() => handleFilterChange('active_only', true)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filters.active_only === true
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Actifs
                </button>
                <button
                  onClick={() => handleFilterChange('active_only', false)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filters.active_only === false
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tous
                </button>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                <button
                  onClick={() => handleFilterChange('has_email', true)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filters.has_email === true
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Avec email
                </button>
                <button
                  onClick={() => handleFilterChange('has_email', false)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filters.has_email === false
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tous
                </button>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(true)}
                className="relative border-gray-300 hover:border-indigo-300 hover:bg-indigo-50"
              >
                <Sliders size={16} className="mr-2" />
                Filtres avancés
                {activeFilterCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={fetchRecipients}
                disabled={loading}
                className="border-gray-300"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>

              {activeTab === 'valid' && (
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={selectedRecipients.size === 0 || importing || activeImportTask}
                  loading={importing}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-md hover:shadow-lg transition-all"
                >
                  <Upload size={16} className="mr-2" />
                  Importer ({selectedRecipients.size})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Filters for Imported Tab */}
        {activeTab === 'imported' && (
          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={importedFilters.search}
                  onChange={e => handleImportedFilterChange('search', e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <select
                value={importedFilters.x_activitec}
                onChange={e => handleImportedFilterChange('x_activitec', e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="">Toutes catégories</option>
                {importedCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={importedFilters.import_date_from}
                  onChange={e => handleImportedFilterChange('import_date_from', e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Date début"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="date"
                  value={importedFilters.import_date_to}
                  onChange={e => handleImportedFilterChange('import_date_to', e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Date fin"
                />
              </div>

              <Button
                variant="outline"
                onClick={fetchImportedRecipients}
                disabled={importedLoading}
                className="border-gray-300"
              >
                <RefreshCw size={16} className={`mr-2 ${importedLoading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 animate-shake">
            <AlertCircle size={20} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Valid Recipients Table */}
        {activeTab === 'valid' && (
          <Card className="overflow-hidden border-0 shadow-xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Database className="h-6 w-6 text-indigo-600 opacity-50" />
                  </div>
                </div>
                <p className="text-gray-600 mt-4 font-medium">Chargement des partenaires...</p>
              </div>
            ) : validRecipients.length === 0 ? (
              <div className="text-center py-24 text-gray-500">
                <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail size={40} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-medium mb-3">Aucun email valide trouvé</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Ajustez vos filtres pour voir des destinataires avec des emails valides
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-4 w-12">
                          <input
                            type="checkbox"
                            checked={validRecipients.length > 0 && 
                                    validRecipients.every(r => selectedRecipients.has(r.id))}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center">
                            ID
                            <SortIcon columnKey="id" />
                          </div>
                        </th>
                        <th 
                          className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Nom
                            <SortIcon columnKey="name" />
                          </div>
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ville</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ICE</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {validRecipients.map((recipient, index) => (
                        <tr 
                          key={recipient.id} 
                          className={`hover:bg-indigo-50/50 transition-colors group ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedRecipients.has(recipient.id)}
                              onChange={() => toggleSelectRecipient(recipient.id, true)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap font-mono">#{recipient.id}</td>
                          <td className="px-4 py-4 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center text-indigo-700 font-semibold">
                                {recipient.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium">{recipient.name || recipient.complete_name || '—'}</p>
                                {recipient.is_company && (
                                  <span className="text-xs text-gray-500">Entreprise</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <Mail size={12} className="text-gray-400" />
                              {recipient.email || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {formatPhone(recipient.phone) || formatPhone(recipient.mobile) || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700 font-medium whitespace-nowrap border border-indigo-100">
                              {recipient.x_activitec || 'Général'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{recipient.city || '—'}</td>
                          <td className="px-4 py-4 text-sm text-gray-600 font-mono">{recipient.x_ice || '—'}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2.5 py-1 text-xs rounded-full font-medium whitespace-nowrap ${
                              recipient.active 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {recipient.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setPreviewRecipient(recipient)}
                                className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                title="Voir détails"
                              >
                                <Eye size={18} />
                              </button>
                              {recipient.email && (
                                <button
                                  onClick={() => copyToClipboard(recipient.email)}
                                  className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                  title="Copier l'email"
                                >
                                  <Copy size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                  <div className="text-sm text-gray-700">
                    Affichage <span className="font-medium">{validRecipients.length}</span> sur{' '}
                    <span className="font-medium">{pagination.totalCount.toLocaleString()}</span> résultats
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePageChange(pagination.page - 1)} 
                      disabled={pagination.page === 1 || loading}
                      className="border-gray-300"
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <div className="flex items-center gap-2">
                      {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                        const pageNum = pagination.page + i - 2;
                        if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              pagination.page === pageNum
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePageChange(pagination.page + 1)} 
                      disabled={pagination.page >= pagination.totalPages || loading}
                      className="border-gray-300"
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Invalid Recipients Table */}
        {activeTab === 'invalid' && (
          <Card className="overflow-hidden border-0 shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="text-amber-600" size={20} />
                </div>
                Destinataires avec emails invalides
              </h3>
              {invalidRecipients.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <p className="font-medium">Aucun email invalide trouvé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invalidRecipients.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200 hover:bg-amber-100/50 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name || item.complete_name || '—'}</p>
                          <p className="text-sm text-gray-600">{item.email || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full font-medium border border-amber-200">
                          {item.invalid_reason || 'Email invalide'}
                        </span>
                        <button
                          onClick={() => setPreviewRecipient(item)}
                          className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-amber-100 transition-colors opacity-0 group-hover:opacity-100"
                          title="Voir détails"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Imported Recipients Table */}
        {activeTab === 'imported' && (
          <Card className="overflow-hidden border-0 shadow-xl">
            {importedLoading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Download className="h-6 w-6 text-green-600 opacity-50" />
                  </div>
                </div>
                <p className="text-gray-600 mt-4 font-medium">Chargement des importés...</p>
              </div>
            ) : importedRecipients.length === 0 ? (
              <div className="text-center py-24 text-gray-500">
                <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Download size={40} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-medium mb-3">Aucun importé trouvé</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Aucun destinataire n'a encore été importé
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ville</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importé le</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {importedRecipients.map((recipient, index) => (
                        <tr 
                          key={recipient.id} 
                          className={`hover:bg-green-50/50 transition-colors group ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap font-mono">#{recipient.id}</td>
                          <td className="px-4 py-4 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center text-green-700 font-semibold">
                                {recipient.name?.charAt(0) || '?'}
                              </div>
                              <span>{recipient.name || recipient.complete_name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600">{recipient.email || '—'}</span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {formatPhone(recipient.phone) || formatPhone(recipient.mobile) || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-green-50 text-green-700 font-medium border border-green-200">
                              {recipient.x_activitec || 'Général'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{recipient.city || '—'}</td>
                          <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-gray-400" />
                              {formatDate(recipient.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2.5 py-1 text-xs rounded-full font-medium ${
                              recipient.active 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {recipient.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => setPreviewRecipient(recipient)}
                              className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
                              title="Voir détails"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                  <div className="text-sm text-gray-700">
                    Affichage <span className="font-medium">{importedRecipients.length}</span> sur{' '}
                    <span className="font-medium">{importedPagination.totalCount.toLocaleString()}</span> importés
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleImportedPageChange(importedPagination.page - 1)} 
                      disabled={importedPagination.page === 1 || importedLoading}
                      className="border-gray-300"
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <div className="flex items-center gap-2">
                      {[...Array(Math.min(5, importedPagination.totalPages))].map((_, i) => {
                        const pageNum = importedPagination.page + i - 2;
                        if (pageNum < 1 || pageNum > importedPagination.totalPages) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handleImportedPageChange(pageNum)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              importedPagination.page === pageNum
                                ? 'bg-green-600 text-white'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleImportedPageChange(importedPagination.page + 1)} 
                      disabled={importedPagination.page >= importedPagination.totalPages || importedLoading}
                      className="border-gray-300"
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}
      </div>

      {/* Advanced Filters Popout */}
      {showAdvancedFilters && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setShowAdvancedFilters(false)}
          />
          
          {/* Side Panel */}
          <div className="fixed right-0 top-0 h-full w-[520px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col animate-slide-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Sliders size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Filtres avancés</h2>
                  <p className="text-sm text-indigo-100">Affinez votre recherche</p>
                </div>
                {activeFilterCount > 0 && (
                  <span className="px-2.5 py-1 text-xs bg-white/20 rounded-full font-medium">
                    {activeFilterCount} actif{activeFilterCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAdvancedFilters(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-8">
                {/* Quick Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="flex-1 border-gray-300"
                  >
                    <XCircle size={16} className="mr-2" />
                    Réinitialiser
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      fetchRecipients();
                      setShowAdvancedFilters(false);
                    }}
                    className="flex-1 bg-indigo-600"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Appliquer
                  </Button>
                </div>

                {/* Company Information */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building size={16} className="text-indigo-600" />
                    Informations entreprise
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Source
                      </label>
                      <select
                        value={filters.x_source}
                        onChange={e => handleFilterChange('x_source', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      >
                        <option value="">Toutes les sources</option>
                        {filterOptions.sources?.map(source => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Forme juridique
                      </label>
                      <select
                        value={filters.x_forme_juridique}
                        onChange={e => handleFilterChange('x_forme_juridique', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      >
                        <option value="">Toutes</option>
                        {filterOptions.legal_forms?.map(form => (
                          <option key={form} value={form}>{form}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Effectif
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 10-50, 100-200"
                        value={filters.x_effectif}
                        onChange={e => handleFilterChange('x_effectif', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-indigo-600" />
                    Localisation
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Ville
                      </label>
                      <select
                        value={filters.city}
                        onChange={e => handleFilterChange('city', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      >
                        <option value="">Toutes les villes</option>
                        {filterOptions.cities?.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Pays
                      </label>
                      <select
                        value={filters.country_id}
                        onChange={e => handleFilterChange('country_id', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      >
                        <option value="">Tous les pays</option>
                        {filterOptions.countries?.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Phone size={16} className="text-indigo-600" />
                    Coordonnées
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={filters.has_phone}
                        onChange={e => handleFilterChange('has_phone', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Avec téléphone</span>
                        <p className="text-xs text-gray-500">Inclut uniquement les contacts avec numéro de téléphone</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={filters.has_mobile}
                        onChange={e => handleFilterChange('has_mobile', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Avec mobile</span>
                        <p className="text-xs text-gray-500">Inclut uniquement les contacts avec numéro de mobile</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={filters.has_website}
                        onChange={e => handleFilterChange('has_website', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Avec site web</span>
                        <p className="text-xs text-gray-500">Inclut uniquement les contacts avec site internet</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Identifiers */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    Identifiants
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        ICE
                      </label>
                      <input
                        type="text"
                        placeholder="Rechercher ICE"
                        value={filters.x_ice}
                        onChange={e => handleFilterChange('x_ice', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        RC
                      </label>
                      <input
                        type="text"
                        placeholder="Rechercher RC"
                        value={filters.x_rc}
                        onChange={e => handleFilterChange('x_rc', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        IF
                      </label>
                      <input
                        type="text"
                        placeholder="Rechercher IF"
                        value={filters.x_if}
                        onChange={e => handleFilterChange('x_if', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        TVA
                      </label>
                      <input
                        type="text"
                        placeholder="Rechercher TVA"
                        value={filters.vat}
                        onChange={e => handleFilterChange('vat', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Ranges */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-600" />
                    Dates
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Date de modification
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={filters.date_from}
                          onChange={e => handleFilterChange('date_from', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                          placeholder="Du"
                        />
                        <input
                          type="date"
                          value={filters.date_to}
                          onChange={e => handleFilterChange('date_to', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                          placeholder="Au"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Date de création
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={filters.create_date_from}
                          onChange={e => handleFilterChange('create_date_from', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                          placeholder="Du"
                        />
                        <input
                          type="date"
                          value={filters.create_date_to}
                          onChange={e => handleFilterChange('create_date_to', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                          placeholder="Au"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Numeric Ranges */}
                {/* Numeric Ranges */}
                <div className="bg-gray-50 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Hash size={16} className="text-indigo-600" />
                    Plages numériques
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        ID
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="ID min"
                          value={filters.min_id}
                          onChange={e => handleFilterChange('min_id', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="ID max"
                          value={filters.max_id}
                          onChange={e => handleFilterChange('max_id', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Crédit
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min"
                          value={filters.credit_limit_min}
                          onChange={e => handleFilterChange('credit_limit_min', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Max"
                          value={filters.credit_limit_max}
                          onChange={e => handleFilterChange('credit_limit_max', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {activeFilterCount > 0 && (
                  <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                    <h4 className="text-sm font-medium text-indigo-900 mb-3 flex items-center gap-2">
                      <Filter size={14} />
                      Filtres actifs
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(filters).map(([key, value]) => {
                        if (value && value !== '' && value !== false && key !== 'active_only' && key !== 'has_email') {
                          return (
                            <span key={key} className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-indigo-800 text-xs rounded-full border border-indigo-200 shadow-sm">
                              <span className="font-medium">{key}:</span> {value.toString()}
                              <button
                                onClick={() => handleFilterChange(key, '')}
                                className="hover:text-indigo-600 ml-1"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-300"
                  onClick={() => setShowAdvancedFilters(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-indigo-600"
                  onClick={() => {
                    fetchRecipients();
                    setShowAdvancedFilters(false);
                  }}
                >
                  Appliquer les filtres
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Progress Modal */}
      {showProgressModal && importProgress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                <div className="relative">
                  <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
                  <div className="absolute inset-0 animate-ping">
                    <Loader2 className="h-6 w-6 text-indigo-300 opacity-30" />
                  </div>
                </div>
                Import en cours
              </h2>
              <button
                onClick={() => setShowProgressModal(false)}
                className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Statut:</span>
                  <span className="font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {importProgress.status === 'PROGRESS' ? 'Traitement...' : 
                     importProgress.status === 'PENDING' ? 'En attente...' : 
                     importProgress.status}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progression:</span>
                    <span className="font-medium">
                      {importProgress.processed || 0} / {importProgress.total || 0}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 h-3 rounded-full transition-all duration-300 relative"
                      style={{ 
                        width: `${importProgress.total > 0 
                          ? ((importProgress.processed || 0) / importProgress.total) * 100 
                          : 0}%` 
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-indigo-50 p-4 rounded-xl">
                  <p className="text-sm text-indigo-700">
                    <span className="font-medium">{importProgress.processed || 0}</span> destinataires traités sur <span className="font-medium">{importProgress.total || 0}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-300"
                  onClick={() => setShowProgressModal(false)}
                >
                  Fermer
                </Button>
                <Button
                  variant="danger"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={cancelImport}
                >
                  Annuler l'import
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewRecipient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <User className="text-indigo-600" size={20} />
                </div>
                Détails du partenaire
              </h2>
              <button
                onClick={() => setPreviewRecipient(null)}
                className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="col-span-1 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <User size={14} className="text-indigo-600" />
                    </div>
                    Informations générales
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">ID</label>
                      <p className="font-medium font-mono mt-1">#{previewRecipient.id}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Nom</label>
                      <p className="font-medium mt-1">{previewRecipient.name || previewRecipient.complete_name || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Type</label>
                      <p className="mt-1">
                        <span className={`inline-flex px-3 py-1.5 text-xs rounded-full ${
                          previewRecipient.is_company 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {previewRecipient.is_company ? 'Entreprise' : 'Particulier'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Statut</label>
                      <p className="mt-1">
                        <span className={`inline-flex px-3 py-1.5 text-xs rounded-full ${
                          previewRecipient.active 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {previewRecipient.active ? 'Actif' : 'Inactif'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="col-span-1 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <Mail size={14} className="text-indigo-600" />
                    </div>
                    Coordonnées
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Email</label>
                      <p className="flex items-center gap-2 mt-1">
                        <span className="font-medium">{previewRecipient.email || '—'}</span>
                        {previewRecipient.email && !validateEmail(previewRecipient.email).valid && (
                          <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full border border-red-200">
                            {previewRecipient.invalid_reason || 'Invalide'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Téléphone</label>
                      <p className="font-medium mt-1">{previewRecipient.phone || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Mobile</label>
                      <p className="font-medium mt-1">{previewRecipient.mobile || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Site web</label>
                      <p className="font-medium mt-1">{previewRecipient.website || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="col-span-1 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <MapPin size={14} className="text-indigo-600" />
                    </div>
                    Localisation
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Adresse</label>
                      <p className="font-medium mt-1">{previewRecipient.street || '—'}</p>
                      {previewRecipient.street2 && <p className="font-medium mt-1">{previewRecipient.street2}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Code postal</label>
                      <p className="font-medium mt-1">{previewRecipient.zip || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Ville</label>
                      <p className="font-medium mt-1">{previewRecipient.city || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Pays</label>
                      <p className="font-medium mt-1">{previewRecipient.country_id || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Identifiers */}
                <div className="col-span-1 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <FileText size={14} className="text-indigo-600" />
                    </div>
                    Identifiants
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">ICE</label>
                      <p className="font-medium font-mono mt-1">{previewRecipient.x_ice || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">RC</label>
                      <p className="font-medium font-mono mt-1">{previewRecipient.x_rc || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">IF</label>
                      <p className="font-medium font-mono mt-1">{previewRecipient.x_if || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">TVA</label>
                      <p className="font-medium mt-1">{previewRecipient.vat || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Classification */}
                <div className="col-span-1 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <Tag size={14} className="text-indigo-600" />
                    </div>
                    Classification
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Catégorie</label>
                      <p className="font-medium mt-1">
                        <span className="inline-flex px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs border border-indigo-200">
                          {previewRecipient.x_activitec || 'Général'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Source</label>
                      <p className="font-medium mt-1">{previewRecipient.x_source || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Forme juridique</label>
                      <p className="font-medium mt-1">{previewRecipient.x_forme_juridique || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Effectif</label>
                      <p className="font-medium mt-1">{previewRecipient.x_effectif || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Capital</label>
                      <p className="font-medium mt-1">{previewRecipient.x_capital || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="col-span-1 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <Calendar size={14} className="text-indigo-600" />
                    </div>
                    Dates
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Création</label>
                      <p className="font-medium mt-1 flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        {formatDate(previewRecipient.create_date)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Import</label>
                      <p className="font-medium mt-1 flex items-center gap-2">
                        <Download size={14} className="text-gray-400" />
                        {formatDate(previewRecipient.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Comment */}
                {previewRecipient.comment && (
                  <div className="col-span-3 bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-100 rounded-lg">
                        <FileText size={14} className="text-indigo-600" />
                      </div>
                      Commentaire
                    </h3>
                    <p className="text-sm whitespace-pre-wrap bg-white p-4 rounded-lg border border-gray-100">
                      {previewRecipient.comment}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              {previewRecipient.email && (
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(previewRecipient.email)}
                  className="border-gray-300"
                >
                  <Copy size={16} className="mr-2" />
                  Copier email
                </Button>
              )}
              <Button variant="outline" onClick={() => setPreviewRecipient(null)} className="border-gray-300">
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add custom animations */}
      <style jsx>{`
        @keyframes slide-left {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        
        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Import;