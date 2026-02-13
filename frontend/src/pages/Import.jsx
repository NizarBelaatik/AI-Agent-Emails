// src/pages/Import.jsx
import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Upload, Check,
  X, ChevronLeft, ChevronRight, Database, RefreshCw, Eye, Users,
  AlertCircle, Mail, AlertTriangle, CheckCircle2, Download, Clock
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { importerAPI } from '../services/api';

const Import = () => {
  const [recipients, setRecipients] = useState([]);
  const [validRecipients, setValidRecipients] = useState([]);
  const [invalidRecipients, setInvalidRecipients] = useState([]);
  const [importedRecipients, setImportedRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState(new Set());
  const [activeTab, setActiveTab] = useState('valid');
  const [filters, setFilters] = useState({
    search: '',
    x_activitec: '',
    active_only: true,
    has_email: true,
  });
  const [importedFilters, setImportedFilters] = useState({
    search: '',
    x_activitec: '',
    date_from: '',
    date_to: '',
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
  }, [filters, pagination.page]);

  useEffect(() => {
    if (activeTab === 'imported') {
      fetchImportedRecipients();
    }
  }, [activeTab, importedFilters, importedPagination.page]);

  const fetchRecipients = async () => {
    setErrorMessage(null);
    try {
      setLoading(true);
      const params = {
        search: filters.search || undefined,
        x_activitec: filters.x_activitec || undefined,
        active_only: filters.active_only,
        has_email: filters.has_email,
        page: pagination.page,
        page_size: pagination.pageSize,
      };

      console.log('[DEBUG] Fetching with params:', params);

      const data = await importerAPI.browseSource(params);
      
      console.log('[DEBUG] API response data:', data);

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

        // Extract unique categories from valid recipients only
        const uniqueCats = [...new Set(
          valid.map(r => r.x_activitec || '').filter(Boolean)
        )];
        setCategories(uniqueCats);
        
        // Clear selections when data changes
        setSelectedRecipients(new Set());
      } else {
        console.warn('[DEBUG] Invalid data format:', data);
        setErrorMessage('Format de données invalide du serveur');
        setValidRecipients([]);
        setInvalidRecipients([]);
      }
    } catch (error) {
      console.error('[DEBUG] Fetch failed:', error);
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
      const params = {
        search: importedFilters.search || undefined,
        x_activitec: importedFilters.x_activitec || undefined,
        date_from: importedFilters.date_from || undefined,
        date_to: importedFilters.date_to || undefined,
        page: importedPagination.page,
        page_size: importedPagination.pageSize,
      };

      const data = await importerAPI.getImported(params);
      
      if (data && Array.isArray(data.results)) {
        setImportedRecipients(data.results);
        
        setImportedPagination(prev => ({
          ...prev,
          totalCount: data.count || 0,
          totalPages: Math.ceil((data.count || 0) / prev.pageSize) || 1,
        }));

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
      console.log('[DEBUG] Stats response:', response);
      
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

    if (!window.confirm(`Importer ${validSelectedIds.length} destinataire(s) avec email valide ?`)) {
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);

      console.log('[DEBUG] Selected IDs:', validSelectedIds);

      const payload = {
        selected_ids: validSelectedIds,
        limit: 500,
        update_existing: true,
      };

      const result = await importerAPI.importRecipients(payload);
      console.log('[DEBUG] Import result:', result);

      if (result && result.success) {
        setImportResult(result);
        
        // Show success message
        let message = `✅ Import terminé !\n\n`;
        message += `📥 Importés : ${result.stats?.imported || 0}\n`;
        message += `🔄 Mis à jour : ${result.stats?.updated || 0}\n`;
        message += `❌ Échecs : ${result.stats?.failed || 0}\n`;
        
        if (result.stats?.invalid > 0) {
          message += `⚠️ Emails invalides ignorés : ${result.stats.invalid}\n`;
          setInvalidRecipients(prev => [...prev, ...(result.invalid_recipients || [])]);
        }

        alert(message);

        // Clear selections and refresh
        setSelectedRecipients(new Set());
        fetchRecipients();
        fetchStats();
        fetchImportedRecipients(); // Refresh imported list
      }
    } catch (err) {
      console.error('[DEBUG] Import failed:', err);
      alert(`Erreur d'import: ${err.error || err.message || 'Erreur inconnue'}`);
    } finally {
      setImporting(false);
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Header
        title="Import depuis la base source"
        description="Parcourez et importez les partenaires de votre base Odoo"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total dans source</p>
                <p className="text-3xl font-bold text-blue-800 mt-1">
                  {stats.total?.toLocaleString() || '0'}
                </p>
              </div>
              <Database className="text-blue-600" size={32} />
            </div>
          </Card>

          <Card className="bg-green-50 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Prêts à importer</p>
                <p className="text-3xl font-bold text-green-800 mt-1">
                  {stats.with_email?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-green-600 mt-1">Actifs + avec email</p>
              </div>
              <Check className="text-green-600" size={32} />
            </div>
          </Card>

          <Card className="bg-purple-50 border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Catégories</p>
                <p className="text-3xl font-bold text-purple-800 mt-1">
                  {categories.length}
                </p>
              </div>
              <Filter className="text-purple-600" size={32} />
            </div>
          </Card>

          <Card className="bg-amber-50 border border-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700">Importés</p>
                <p className="text-3xl font-bold text-amber-800 mt-1">
                  {importedRecipients.length}
                </p>
                <p className="text-xs text-amber-600 mt-1">Cette page</p>
              </div>
              <Download className="text-amber-600" size={32} />
            </div>
          </Card>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <Card className="mb-8 bg-green-50 border-green-200">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="text-green-600 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800">Import réussi !</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                <div>
                  <p className="text-sm text-green-700">Importés</p>
                  <p className="text-2xl font-bold text-green-800">
                    {importResult.stats?.imported || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Mis à jour</p>
                  <p className="text-2xl font-bold text-green-800">
                    {importResult.stats?.updated || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-red-700">Échecs</p>
                  <p className="text-2xl font-bold text-red-800">
                    {importResult.stats?.failed || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-yellow-700">Invalides</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {importResult.stats?.invalid || 0}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-green-600 hover:text-green-800"
            >
              <X size={20} />
            </button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'valid' ? 'primary' : 'outline'}
          onClick={() => {
            setActiveTab('valid');
            setSelectedRecipients(new Set());
          }}
        >
          <Mail size={16} className="mr-2" />
          À importer ({validRecipients.length})
        </Button>
        <Button
          variant={activeTab === 'invalid' ? 'primary' : 'outline'}
          onClick={() => {
            setActiveTab('invalid');
            setSelectedRecipients(new Set());
          }}
        >
          <AlertTriangle size={16} className="mr-2" />
          Invalides ({invalidRecipients.length})
        </Button>
        <Button
          variant={activeTab === 'imported' ? 'primary' : 'outline'}
          onClick={() => {
            setActiveTab('imported');
            setSelectedRecipients(new Set());
            fetchImportedRecipients();
          }}
        >
          <Download size={16} className="mr-2" />
          Importés ({importedPagination.totalCount})
        </Button>
      </div>

      {/* Filters for Source Tab */}
      {(activeTab === 'valid' || activeTab === 'invalid') && (
        <Card title="Filtres & Actions" className="mb-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Recherche
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Nom, email, ville..."
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Catégorie
                </label>
                <select
                  value={filters.x_activitec}
                  onChange={e => handleFilterChange('x_activitec', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Statut
                </label>
                <select
                  value={filters.active_only}
                  onChange={e => handleFilterChange('active_only', e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={true}>Actifs uniquement</option>
                  <option value={false}>Tous</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <select
                  value={filters.has_email}
                  onChange={e => handleFilterChange('has_email', e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={true}>Avec email</option>
                  <option value={false}>Tous</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {activeTab === 'valid' && (
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                  disabled={validRecipients.length === 0 || loading}
                >
                  {validRecipients.length > 0 && 
                   validRecipients.every(r => selectedRecipients.has(r.id))
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </Button>
              )}

              <Button variant="outline" onClick={fetchRecipients} disabled={loading}>
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>

              {activeTab === 'valid' && (
                <div className="ml-auto">
                  <Button
                    variant="primary"
                    onClick={handleImport}
                    disabled={selectedRecipients.size === 0 || importing}
                    loading={importing}
                  >
                    <Upload size={16} className="mr-2" />
                    Importer ({selectedRecipients.size})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Filters for Imported Tab */}
      {activeTab === 'imported' && (
        <Card title="Filtres des importés" className="mb-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Recherche
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Nom, email, ville..."
                    value={importedFilters.search}
                    onChange={e => handleImportedFilterChange('search', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Catégorie
                </label>
                <select
                  value={importedFilters.x_activitec}
                  onChange={e => handleImportedFilterChange('x_activitec', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Toutes les catégories</option>
                  {importedCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date début
                </label>
                <input
                  type="date"
                  value={importedFilters.date_from}
                  onChange={e => handleImportedFilterChange('date_from', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date fin
                </label>
                <input
                  type="date"
                  value={importedFilters.date_to}
                  onChange={e => handleImportedFilterChange('date_to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button variant="outline" onClick={fetchImportedRecipients} disabled={importedLoading}>
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
          <AlertCircle size={20} />
          {errorMessage}
        </div>
      )}

      {/* Valid Recipients Table */}
      {activeTab === 'valid' && (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">Chargement des partenaires...</p>
            </div>
          ) : validRecipients.length === 0 ? (
            <div className="text-center py-24 text-gray-500">
              <Mail size={64} className="mx-auto mb-6 opacity-50" />
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
                      <th className="px-6 py-4 w-12">
                        <input
                          type="checkbox"
                          checked={validRecipients.length > 0 && 
                                  validRecipients.every(r => selectedRecipients.has(r.id))}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validRecipients.map(recipient => (
                      <tr key={recipient.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.has(recipient.id)}
                            onChange={() => toggleSelectRecipient(recipient.id, true)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{recipient.id}</td>
                        <td className="px-6 py-4 font-medium">
                          {recipient.name || recipient.complete_name || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {recipient.email || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            {recipient.x_activitec || 'Général'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {recipient.city || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 text-xs rounded-full ${
                            recipient.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {recipient.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setPreviewRecipient(recipient)}
                            className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50"
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
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t bg-gray-50 gap-4">
                <div className="text-sm text-gray-700">
                  Affichage {validRecipients.length} emails valides • Page {pagination.page} / {pagination.totalPages}
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(pagination.page - 1)} 
                    disabled={pagination.page === 1 || loading}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(pagination.page + 1)} 
                    disabled={pagination.page >= pagination.totalPages || loading}
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
        <Card className="overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="text-yellow-600" size={20} />
              Destinataires avec emails invalides
            </h3>
            {invalidRecipients.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Aucun email invalide trouvé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invalidRecipients.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div className="flex items-center gap-4">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-medium">{item.name || item.complete_name || '—'}</p>
                        <p className="text-sm text-gray-600">{item.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        {item.invalid_reason || item.reason || 'Email invalide'}
                      </span>
                      <button
                        onClick={() => setPreviewRecipient(item)}
                        className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-yellow-100"
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
        <Card className="overflow-hidden">
          {importedLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">Chargement des importés...</p>
            </div>
          ) : importedRecipients.length === 0 ? (
            <div className="text-center py-24 text-gray-500">
              <Download size={64} className="mx-auto mb-6 opacity-50" />
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
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Importé le</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {importedRecipients.map(recipient => (
                      <tr key={recipient.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600">{recipient.id}</td>
                        <td className="px-6 py-4 font-medium">
                          {recipient.name || recipient.complete_name || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {recipient.email || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            {recipient.x_activitec || 'Général'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {recipient.city || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            {formatDate(recipient.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setPreviewRecipient(recipient)}
                            className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50"
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

              {/* Pagination for Imported */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t bg-gray-50 gap-4">
                <div className="text-sm text-gray-700">
                  Affichage {importedRecipients.length} sur {importedPagination.totalCount.toLocaleString()} importés
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleImportedPageChange(importedPagination.page - 1)} 
                    disabled={importedPagination.page === 1 || importedLoading}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="px-4 py-2 text-sm">
                    Page {importedPagination.page} / {importedPagination.totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleImportedPageChange(importedPagination.page + 1)} 
                    disabled={importedPagination.page >= importedPagination.totalPages || importedLoading}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Preview Modal */}
      {previewRecipient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Détails du partenaire</h2>
              <button
                onClick={() => setPreviewRecipient(null)}
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">ID</label>
                  <p className="mt-1 font-medium">{previewRecipient.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Importé le</label>
                  <p className="mt-1">{formatDate(previewRecipient.created_at)}</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Nom</label>
                  <p className="mt-1 font-medium">{previewRecipient.name || previewRecipient.complete_name || '—'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1">
                    {previewRecipient.email || '—'}
                    {previewRecipient.email && !validateEmail(previewRecipient.email).valid && (
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                        {previewRecipient.invalid_reason || 'Invalide'}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Catégorie</label>
                  <p className="mt-1">{previewRecipient.x_activitec || 'Général'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Ville</label>
                  <p className="mt-1">{previewRecipient.city || '—'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Téléphone</label>
                  <p className="mt-1">{previewRecipient.phone || previewRecipient.mobile || '—'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Type</label>
                  <p className="mt-1 font-medium">
                    {previewRecipient.is_company ? 'Entreprise' : 'Particulier'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <Button variant="outline" onClick={() => setPreviewRecipient(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Import;