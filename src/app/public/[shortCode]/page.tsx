'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { transferLinkAPI, TransferLink } from '@/core/services/api/transferLink.service';

export default function PublicLinkPage() {
  const params = useParams();
  const shortCode = params.shortCode as string;
  
  const [linkInfo, setLinkInfo] = useState<TransferLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Charger les infos du lien
  useEffect(() => {
    const fetchLinkInfo = async () => {
      try {
        setLoading(true);
        const info = await transferLinkAPI.getPublicTransferInfo(shortCode);
        
        // Vérifier si le lien a expiré
        if (info.expiresAt && new Date(info.expiresAt) < new Date()) {
          setError('Ce lien a expiré et n\'est plus accessible.');
          return;
        }

        // Vérifier si la limite de téléchargement est atteinte
        if (info.maxDownloads && info.downloads >= info.maxDownloads) {
          setError('Ce lien a atteint sa limite de téléchargements.');
          return;
        }

        setLinkInfo(info);
        
        // Vérifier si le lien est protégé par mot de passe
        if (info.password) {
          setPasswordRequired(true);
          setIsUnlocked(false);
        } else {
          setIsUnlocked(true);
        }
      } catch (err) {
        setError('Ce lien n\'existe pas ou n\'est pas accessible.');
        console.error('Erreur lors du chargement du lien:', err);
      } finally {
        setLoading(false);
      }
    };

    if (shortCode) {
      fetchLinkInfo();
    }
  }, [shortCode]);

  // Vérifier le mot de passe
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    try {
      const isValid = await transferLinkAPI.verifyTransferPassword(shortCode, password);
      
      if (isValid) {
        setIsUnlocked(true);
        setPassword('');
      } else {
        setPasswordError('Mot de passe incorrect.');
      }
    } catch (err) {
      setPasswordError('Erreur lors de la vérification du mot de passe.');
      console.error('Erreur:', err);
    }
  };

  // Télécharger le fichier
  const handleDownload = async () => {
    if (!linkInfo) return;

    try {
      setDownloading(true);

      // Utiliser la route de téléchargement direct qui gère les headers correctement
      window.location.href = `http://localhost:4000/api/public-links/${shortCode}/file`;
    } catch (err) {
      setError('Erreur lors du téléchargement du fichier.');
      console.error('Erreur:', err);
    } finally {
      setDownloading(false);
    }
  };

  // État de chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du lien...</p>
        </div>
      </div>
    );
  }

  // Erreur
  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  // Lien trouvé
  if (linkInfo) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            {/* Succès - Lien accessible */}
            {isUnlocked && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900">Lien accessible</h3>
                  <p className="text-green-700 text-sm">Vous pouvez maintenant télécharger le fichier.</p>
                </div>
              </div>
            )}

            {/* Informations du fichier */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-6">
                {linkInfo.fileName}
              </h1>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Taille du fichier</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {(linkInfo.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                {linkInfo.expiresAt && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Expire le</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {format(new Date(linkInfo.expiresAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                )}

                {linkInfo.maxDownloads && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Téléchargements</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {linkInfo.downloads} / {linkInfo.maxDownloads}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Partagé le</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {format(new Date(linkInfo.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>

            {/* Formulaire mot de passe */}
            {passwordRequired && !isUnlocked && (
              <div className="mb-8 p-6 border-2 border-yellow-200 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-yellow-600" />
                  <h2 className="text-lg font-semibold text-yellow-900">
                    Ce lien est protégé par mot de passe
                  </h2>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      placeholder="Entrez le mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {passwordError && (
                    <p className="text-sm text-red-600">{passwordError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition"
                  >
                    Vérifier
                  </button>
                </form>
              </div>
            )}

            {/* Bouton télécharger */}
            {isUnlocked && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {downloading ? 'Téléchargement en cours...' : 'Télécharger le fichier'}
              </button>
            )}

            {/* Avertissement limite */}
            {linkInfo.maxDownloads && linkInfo.downloads >= linkInfo.maxDownloads - 1 && (
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  ⚠️ <strong>Attention:</strong> Ce lien atteindra bientôt sa limite de téléchargements.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-600 text-sm">
            <p>Lien de partage de fichier</p>
            <p className="text-gray-500">Code d'accès: <code className="bg-gray-100 px-2 py-1 rounded">{shortCode}</code></p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
