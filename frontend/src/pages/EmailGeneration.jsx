import React, { useState, useEffect } from 'react';
import {
  Search, Mail, CheckCircle2, XCircle, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, Eye, AlertCircle, 
  Filter, Layers
} from 'lucide-react';

import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { emailGenerationAPI } from '../services/api';

const EmailGeneration = () => {
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('auto');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    count: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);

  // Load recipients on mount + when page/search changes
  useEffect(() => {
    fetchRecipients();
  }, [pagination.page, search]);

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

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
      
      setRecipients(response.results || []);
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

  const fetchCategories = async () => {
    try {
      const response = await emailGenerationAPI.getCategories();
      setCategories(response || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
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
    
    if (!window.confirm(`Générer ${selected.size} email(s) avec ${categoryInfo} ?`)) return;

    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGenerationResult(null);

    try {
      const payload = {
        recipient_ids: Array.from(selected),
      };
      
      // Only add category_name if not auto-detection
      if (selectedCategory !== 'auto') {
        payload.category_name = selectedCategory;
      }

      const result = await emailGenerationAPI.generateEmails(payload);

      setGenerationResult(result);
      
      let successMessage = `✅ Succès !\n`;
      successMessage += `📧 Emails générés : ${result.generated}\n`;
      
      if (result.skipped) {
        successMessage += `⏭️ Déjà existants : ${result.skipped}\n`;
      }
      
      if (result.by_category && Object.keys(result.by_category).length > 0) {
        successMessage += `\n📊 Par catégorie :\n`;
        Object.entries(result.by_category).forEach(([cat, count]) => {
          successMessage += `   • ${cat}: ${count} email(s)\n`;
        });
      }

      setSuccess(successMessage);
      setSelected(new Set());
      fetchRecipients();
    } catch (err) {
      setError(err.error || 'Erreur lors de la génération');
      console.error(err);
    } finally {
      setGenerating(false);
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

  // Get unique categories from selected recipients
  const getSelectedCategories = () => {
    const selectedRecipients = recipients.filter(r => selected.has(r.id));
    const uniqueCategories = [...new Set(selectedRecipients.map(r => r.x_activitec || 'Général'))];
    return uniqueCategories;
  };

  const selectedCategories = getSelectedCategories();
  const hasMultipleCategories = selectedCategories.length > 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Header
        title="Génération d'emails"
        description="Sélectionnez les destinataires et générez des emails personnalisés"
      />

      <Card className="mb-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                Catégorie d'email
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
                  ⚠️ Destinataires avec {selectedCategories.length} activités différentes - des emails adaptés seront générés
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={toggleAll}
              disabled={recipients.length === 0 || loading}
            >
              {selected.size === recipients.length && recipients.length > 0
                ? 'Tout désélectionner'
                : 'Tout sélectionner (page)'}
            </Button>

            <Button variant="outline" onClick={fetchRecipients} disabled={loading}>
              <RefreshCw size={16} className="mr-2" />
              Actualiser
            </Button>

            {selected.size > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowCategoryBreakdown(!showCategoryBreakdown)}
              >
                <Filter size={16} className="mr-2" />
                Voir répartition
              </Button>
            )}

            <div className="ml-auto flex items-center gap-4">
              <div className="text-sm bg-gray-100 px-3 py-2 rounded-lg">
                <span className="text-gray-600">Sélectionnés :</span>
                <strong className="ml-1 text-indigo-700">{selected.size}</strong>
                {selected.size > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({selectedCategories.length} catégorie{selectedCategories.length > 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={selected.size === 0 || generating}
                loading={generating}
              >
                <Mail size={18} className="mr-2" />
                Générer les emails
              </Button>
            </div>
          </div>

          {showCategoryBreakdown && selected.size > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Répartition par activité des {selected.size} sélectionnés :
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map(cat => {
                  const count = recipients.filter(r => selected.has(r.id) && (r.x_activitec || 'Général') === cat).length;
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

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mb-4" />
            <p className="text-gray-600">Chargement des destinataires...</p>
          </div>
        ) : recipients.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Mail size={64} className="mx-auto mb-6 opacity-50" />
            <h3 className="text-xl font-medium">Aucun destinataire trouvé</h3>
            <p className="mt-2">Vérifiez que des partenaires ont été importés.</p>
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
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Email généré ?</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recipients.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center">
                          {r.name || r.complete_name || '—'}
                          {selected.has(r.id) && (
                            <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                              sélectionné
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{r.email || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{r.city || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs rounded-full ${
                          selected.has(r.id) && selectedCategory === 'auto'
                            ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {r.x_activitec || 'Général'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.has_generated_email ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            <CheckCircle2 size={14} className="mr-1" /> Généré
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800">
                            <XCircle size={14} className="mr-1" /> Non généré
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setPreview(r)}
                          className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50 transition-colors"
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

            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t gap-4">
              <div className="text-sm text-gray-600">
                Affichage {recipients.length} sur {pagination.count.toLocaleString()} • Page {pagination.page} / {pagination.totalPages}
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
      </Card>

      {preview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Détails du destinataire</h2>
              <button 
                onClick={() => setPreview(null)} 
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
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
                <div className="font-medium">
                  <span className="inline-flex px-2.5 py-1 text-xs rounded-full bg-gray-100">
                    {preview.x_activitec || 'Général'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Email généré ?</div>
                <div className="font-medium mt-1">
                  {preview.has_generated_email ? (
                    <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      <CheckCircle2 size={14} className="mr-1" /> Oui
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800">
                      <XCircle size={14} className="mr-1" /> Non
                    </span>
                  )}
                </div>
              </div>
              {preview.company_name && (
                <div>
                  <div className="text-sm text-gray-500">Entreprise</div>
                  <div className="font-medium">{preview.company_name}</div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailGeneration;