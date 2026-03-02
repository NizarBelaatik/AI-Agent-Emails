// src/pages/EmailSender/SendEmails.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Send, Clock, Calendar, Settings, AlertCircle,
  CheckCircle2, XCircle, Loader2, Eye, Search, RefreshCw,
  ChevronLeft, ChevronRight, BarChart, X
} from 'lucide-react';

import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { emailSenderAPI, emailGenerationAPI } from '../../services/api';

const SendEmails = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  // Sending settings
  const [sendSpeed, setSendSpeed] = useState(3600);
  const [useTimeWindow, setUseTimeWindow] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [batchName, setBatchName] = useState('');

  // Sending state
  const [sending, setSending] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 1,
  });

  useEffect(() => {
    fetchEmails();
    fetchCategories();
  }, [pagination.page, search, categoryFilter]);

  useEffect(() => {
    if (activeBatch) {
      const interval = setInterval(() => {
        fetchBatchStatus(activeBatch);
      }, 4000); // every 4 seconds
      return () => clearInterval(interval);
    }
  }, [activeBatch]);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: search || undefined,
        category: categoryFilter || undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
      };

      const data = await emailSenderAPI.getReadyEmails(params);
      setEmails(data.results || []);
      setPagination(prev => ({
        ...prev,
        totalCount: data.count || 0,
        totalPages: Math.ceil((data.count || 0) / prev.pageSize) || 1,
      }));
    } catch (err) {
      console.error('Failed to fetch ready emails:', err);
      setError('Erreur lors du chargement des emails prêts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await emailGenerationAPI.getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchBatchStatus = async (batchId) => {
    try {
      const data = await emailSenderAPI.getBatchStatus(batchId);
      if (data.success && data.batch) {
        setBatchStatus(data.batch);

        if (['completed', 'failed', 'cancelled'].includes(data.batch.status)) {
          setSending(false);
          setActiveBatch(null);
          fetchEmails(); // Refresh list
        }
      }
    } catch (err) {
      console.error('Failed to fetch batch status:', err);
    }
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      alert('Veuillez sélectionner au moins un email');
      return;
    }

    console.log('IDs sélectionnés :', Array.from(selected));
    console.log('Statuts des emails affichés :', emails.map(e => ({ id: e.id, status: e.status })));

    const confirmMessage = useTimeWindow
      ? `Envoyer ${selected.size} email(s) programmés entre ${startTime} et ${endTime} ?`
      : `Envoyer MAINTENANT ${selected.size} email(s) ?`;

    if (!window.confirm(confirmMessage)) return;

    setSending(true);
    setError(null);

    try {
      const payload = {
        email_ids: Array.from(selected).map(Number), // force en nombres
        send_speed: Number(sendSpeed),
        use_time_window: Boolean(useTimeWindow),
        start_time: useTimeWindow ? startTime : null,
        end_time: useTimeWindow ? endTime : null,
        batch_name: batchName.trim() || `Envoi du ${new Date().toLocaleString('fr-FR')}`,
      };

      console.log('Payload envoyé au backend :', payload);

      const response = await emailSenderAPI.sendBatch(payload);

      if (response.success && response.batch_id) {
        setActiveBatch(response.batch_id);
        setSelected(new Set());
        fetchBatchStatus(response.batch_id);
      } else {
        setError(response.error || 'Erreur serveur');
      }
    } catch (err) {
      console.error('Erreur complète :', err);
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const toggleAll = () => {
    if (selected.size === emails.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(emails.map(e => e.id)));
    }
  };

  const toggleOne = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'sent':             { bg: 'bg-green-100',  text: 'text-green-800', icon: CheckCircle2, label: 'Envoyé' },
      'failed_sending':   { bg: 'bg-red-100',    text: 'text-red-800',   icon: XCircle,      label: 'Échoué' },
      'sending':          { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Loader2,     label: 'En cours' },
      'ready':            { bg: 'bg-blue-100',   text: 'text-blue-800',  icon: Clock,        label: 'Prêt' },
      'generated':        { bg: 'bg-gray-100',   text: 'text-gray-800',  icon: Clock,        label: 'Généré' },
      'cancelled':        { bg: 'bg-purple-100', text: 'text-purple-800', icon: X,           label: 'Annulé' },
    };
    return statusMap[status] || statusMap.ready;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Header
        title="Envoi d'emails"
        description="Sélectionnez les emails prêts et lancez l'envoi via TurboSMTP"
      />

      {/* Active Batch Progress */}
      {batchStatus && (
        <Card className="bg-indigo-50 border-indigo-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {batchStatus.status === 'sending' ? (
                  <Loader2 className="animate-spin h-5 w-5 text-indigo-600" />
                ) : (
                  <BarChart className="h-5 w-5 text-indigo-600" />
                )}
                <h3 className="font-semibold text-indigo-900">{batchStatus.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  batchStatus.status === 'sending' ? 'bg-green-100 text-green-800' :
                  batchStatus.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  batchStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {batchStatus.status === 'sending' ? 'En cours' :
                   batchStatus.status === 'completed' ? 'Terminé' :
                   batchStatus.status === 'failed' ? 'Échec' :
                   batchStatus.status === 'cancelled' ? 'Annulé' :
                   batchStatus.status}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-3">
                <div>
                  <p className="text-xs text-indigo-700">Total</p>
                  <p className="text-xl font-bold text-indigo-900">{batchStatus.total}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Envoyés</p>
                  <p className="text-xl font-bold text-green-600">{batchStatus.sent}</p>
                </div>
                <div>
                  <p className="text-xs text-red-700">Échoués</p>
                  <p className="text-xl font-bold text-red-600">{batchStatus.failed}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-700">Progression</p>
                  <p className="text-xl font-bold text-indigo-900">{batchStatus.progress}%</p>
                </div>
              </div>

              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${batchStatus.progress}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => navigate(`/email-sender/batches/${batchStatus.task_id || batchStatus.id}`)}
              className="text-indigo-600 hover:text-indigo-900 p-2"
              title="Voir détails du batch"
            >
              <BarChart size={20} />
            </button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Nom, email, sujet..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={fetchEmails} disabled={loading}>
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>
      </Card>

      {/* Sending Configuration */}
        <Card>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} className="text-indigo-600" />
            Configuration d'envoi
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du lot (optionnel)
            </label>
            <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="ex: Campagne Mars 2025"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Vitesse d'envoi
            </label>
            <select
                value={sendSpeed}
                onChange={(e) => setSendSpeed(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
                <option value={3600}>Lent (~1/min)</option>
                <option value={7200}>Moyen (~2/min)</option>
                <option value={14400}>Rapide (~4/min)</option>
                <option value={0}>Illimité (attention !)</option>
            </select>
            </div>

            {/* New: Send mode selector */}
            <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Mode d'envoi</label>
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                <input
                    type="radio"
                    name="sendMode"
                    checked={!useTimeWindow}
                    onChange={() => setUseTimeWindow(false)}
                    className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Envoyer maintenant</span>
                </label>
                <label className="flex items-center gap-2">
                <input
                    type="radio"
                    name="sendMode"
                    checked={useTimeWindow}
                    onChange={() => setUseTimeWindow(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Programmer une fenêtre</span>
                </label>
            </div>
            </div>

            {/* Time window fields - only show if programmed */}
            {useTimeWindow && (
            <>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
                <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required={useTimeWindow} // browser validation
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">À</label>
                <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required={useTimeWindow}
                />
                </div>
            </>
            )}
        </div>
        </Card>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Emails Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selected.size} sélectionné(s)
            </span>
            <Button variant="outline" size="sm" onClick={toggleAll} disabled={loading || sending}>
              {selected.size === emails.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={handleSend}
            disabled={selected.size === 0 || sending || loading}
            loading={sending}
          >
            <Send size={16} className="mr-2" />
            Envoyer ({selected.size})
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12">
            <Mail size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">Aucun email prêt</h3>
            <p className="text-gray-500 mt-2">
              Générez ou marquez des emails comme prêts dans la section Génération
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={emails.length > 0 && selected.size === emails.length}
                        onChange={toggleAll}
                        disabled={sending}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinataire</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sujet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Généré le</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {emails.map(email => {
                    const badge = getStatusBadge(email.status);

                    return (
                      <tr key={email.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selected.has(email.id)}
                            onChange={() => toggleOne(email.id)}
                            disabled={sending || ['sent', 'sending', 'failed_sending'].includes(email.status)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium">{email.recipient_name || '—'}</div>
                            <div className="text-sm text-gray-500">{email.recipient_email || '—'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {email.subject || '(sans objet)'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            {email.category || 'Général'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {email.generated_at
                            ? new Date(email.generated_at).toLocaleDateString('fr-FR')
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          {badge && (
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs rounded-full ${badge.bg} ${badge.text}`}>
                              <badge.icon size={12} className="mr-1" />
                              {badge.label}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => window.open(`/email-generation/preview/${email.id}`, '_blank')}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                            title="Voir l'aperçu de l'email"
                            disabled={sending}
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <div className="text-sm text-gray-700">
                Affichage {emails.length} sur {pagination.totalCount.toLocaleString()} emails
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1 || loading || sending}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-4 py-2 text-sm">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages || loading || sending}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default SendEmails;