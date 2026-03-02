// src/pages/EmailSender/BatchDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, CheckCircle2, XCircle, Loader2,
  Clock, Calendar, Send, AlertCircle, BarChart
} from 'lucide-react';

import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { emailSenderAPI } from '../../services/api';

const BatchDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBatch();
    const interval = setInterval(fetchBatch, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchBatch = async () => {
    try {
      const data = await emailSenderAPI.getBatchStatus(id);
      setBatch(data.batch);
    } catch (err) {
      console.error('Failed to fetch batch:', err);
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium">Lot introuvable</h3>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <button
        onClick={() => navigate('/email-sender/send')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={18} className="mr-2" />
        Retour à l'envoi
      </button>

      <Header
        title={batch.name}
        description={`Détails du lot d'envoi`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-700 text-sm">Total</p>
              <p className="text-3xl font-bold text-indigo-900">{batch.total}</p>
            </div>
            <Mail className="text-indigo-600" size={32} />
          </div>
        </Card>

        <Card className="bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm">Envoyés</p>
              <p className="text-3xl font-bold text-green-900">{batch.sent}</p>
            </div>
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
        </Card>

        <Card className="bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-sm">Échoués</p>
              <p className="text-3xl font-bold text-red-900">{batch.failed}</p>
            </div>
            <XCircle className="text-red-600" size={32} />
          </div>
        </Card>

        <Card className="bg-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-700 text-sm">Progression</p>
              <p className="text-3xl font-bold text-purple-900">{batch.progress}%</p>
            </div>
            <BarChart className="text-purple-600" size={32} />
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Informations</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Statut</p>
            <p className="font-medium">
              <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                batch.status === 'sending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {batch.status === 'completed' ? 'Terminé' :
                 batch.status === 'sending' ? 'En cours' :
                 batch.status}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Vitesse</p>
            <p className="font-medium">{batch.speed} emails/heure</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Démarré le</p>
            <p className="font-medium">
              {new Date(batch.started_at).toLocaleString('fr-FR')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Terminé le</p>
            <p className="font-medium">
              {batch.completed_at ? new Date(batch.completed_at).toLocaleString('fr-FR') : '—'}
            </p>
          </div>
          {batch.use_time_window && (
            <>
              <div>
                <p className="text-sm text-gray-500">Fenêtre d'envoi</p>
                <p className="font-medium">{batch.start_time} - {batch.end_time}</p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BatchDetails;