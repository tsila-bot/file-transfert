// app/(dashboard)/dashboard/page.tsx

'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, File, X, Check, AlertCircle, Cloud, Loader } from 'lucide-react';
import { PeerManager } from '@/components/peers/PeerManager';
import { PeerList } from '@/components/peers/PeerList';

// Types TypeScript
type FileStatus = 'uploading' | 'success' | 'error';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: FileStatus;
  error?: string | null;
}

interface FileTypeInfo {
  color: string;
  icon: string;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Types de fichiers avec leurs couleurs et icônes
  const fileTypes: Record<string, FileTypeInfo> = {
    image: { color: 'bg-blue-100 text-blue-600', icon: '🖼️' },
    pdf: { color: 'bg-red-100 text-red-600', icon: '📄' },
    text: { color: 'bg-green-100 text-green-600', icon: '📝' },
    video: { color: 'bg-purple-100 text-purple-600', icon: '🎬' },
    audio: { color: 'bg-yellow-100 text-yellow-600', icon: '🎵' },
    archive: { color: 'bg-gray-100 text-gray-600', icon: '📦' },
    application: { color: 'bg-indigo-100 text-indigo-600', icon: '📎' },
    default: { color: 'bg-indigo-100 text-indigo-600', icon: '📎' }
  };

  // Simuler le transfert P2P
  const simulateP2PTransfer = (file: File, peerId: string | null) => {
    const fileType = file.type.split('/')[0] || 'default';
    const fileObj: FileItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: fileType,
      progress: 0,
      status: 'uploading',
      error: null
    };

    setFiles(prev => [...prev, fileObj]);

    if (!peerId) {
      // Si aucun pair n'est sélectionné
      setTimeout(() => {
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { 
                ...f, 
                progress: 100, 
                status: 'error',
                error: 'Sélectionnez un destinataire'
              }
            : f
        ));
      }, 500);
      return;
    }

    // Simulation de progression P2P
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5; // Progression variable
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Simuler un succès ou une erreur
        const success = Math.random() > 0.15; // 85% de succès
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id 
            ? { 
                ...f, 
                progress: 100, 
                status: success ? 'success' : 'error',
                error: success ? null : 'Échec de connexion P2P'
              }
            : f
        ));
      } else {
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, progress: Math.min(progress, 100) } : f
        ));
      }
    }, 300);
  };

  // Gérer la sélection de fichiers
  const handleFileSelect = (selectedFiles: FileList): void => {
    if (!selectedPeer) {
      alert('Veuillez d\'abord sélectionner un destinataire dans la liste des utilisateurs en ligne');
      return;
    }

    Array.from(selectedFiles).forEach(file => {
      simulateP2PTransfer(file, selectedPeer);
    });
  };

  // Gérer le drag & drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  // Gérer le clic sur la zone de dépôt
  const handleClick = (): void => {
    if (!selectedPeer) {
      alert('Veuillez d\'abord sélectionner un destinataire dans la liste des utilisateurs en ligne');
      return;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Gérer le changement d'input fichier
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  // Supprimer un fichier
  const removeFile = (id: string): void => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  // Formater la taille du fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Obtenir les infos du type de fichier
  const getFileTypeInfo = (type: string): FileTypeInfo => {
    return fileTypes[type] || fileTypes.default;
  };

  // Calculer les statistiques
  const totalFiles = files.length;
  const uploadedFiles = files.filter(f => f.status === 'success').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="p-6 pt-24"> {/* Augmenté le padding-top pour le header fixe */}
      {/* Gestionnaire de peers (invisible) */}
      <PeerManager />

      {/* Header fixe avec z-10 */}
      <div className="fixed top-0 left-0 right-0 bg-cyan-950 z-10 border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Dashboard P2P</h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-start gap-3 w-full mx-auto">
        {/* Liste des pairs en ligne - Gauche (sidebar fixe) */}
        <div className="lg:col-span-1 w-full lg:w-1/5 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Utilisateurs en ligne</h2>
            <div className="flex-1 overflow-y-auto">
              <PeerList 
              />
            </div>
            {selectedPeer && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 font-medium">
                  Destinataire sélectionné
                </p>
                <p className="text-xs text-blue-600 truncate">
                  {selectedPeer}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Zone principale de transfert (scrollable) */}
        <div className="lg:col-span-2 w-full lg:w-3/5 relative z-0">
          <div className="bg-white rounded-lg shadow p-6 h-auto flex flex-col">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-2 text-black">Transfert P2P</h2>
                <p className="text-gray-600 text-sm">
                  {selectedPeer 
                    ? `Transfert vers: ${selectedPeer}`
                    : 'Sélectionnez un destinataire à gauche'
                  }
                </p>
              </div>
              
              <div className="mt-4 lg:mt-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{totalFiles}</div>
                    <div className="text-xs text-gray-600">Fichiers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{uploadedFiles}</div>
                    <div className="text-xs text-gray-600">Terminés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{formatFileSize(totalSize)}</div>
                    <div className="text-xs text-gray-600">Total</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone de dépôt principale */}
            <div
              className={`border-3 border-dashed rounded-xl p-6 mb-6 text-center transition-all duration-300 flex flex-col justify-center ${
                isDragging 
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.02]' 
                  : !selectedPeer
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 cursor-pointer'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={selectedPeer ? handleDrop : (e) => e.preventDefault()}
              onClick={selectedPeer ? handleClick : undefined}
              role="button"
              tabIndex={selectedPeer ? 0 : -1}
              onKeyDown={(e) => {
                if (selectedPeer && (e.key === 'Enter' || e.key === ' ')) {
                  handleClick();
                }
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileChange}
                disabled={!selectedPeer}
                aria-label="Sélectionner des fichiers"
              />
              
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                    <Cloud className="w-10 h-10 text-blue-500" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {!selectedPeer 
                    ? 'Sélectionnez un destinataire' 
                    : isDragging 
                    ? 'Déposez les fichiers ici' 
                    : 'Glissez-déposez vos fichiers'
                  }
                </h3>
                
                <p className="text-gray-600 mb-4 max-w-md text-sm">
                  {!selectedPeer
                    ? 'Choisissez un utilisateur en ligne pour commencer le transfert'
                    : 'Transférez des fichiers directement vers l\'utilisateur sélectionné'
                  }
                </p>
                
                <button
                  type="button"
                  className={`px-5 py-2.5 font-medium rounded-lg transition-all duration-300 ${
                    !selectedPeer
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedPeer) handleClick();
                  }}
                  disabled={!selectedPeer}
                >
                  {!selectedPeer ? 'Sélectionnez un destinataire' : 'Parcourir les fichiers'}
                </button>
                
                <p className="text-xs text-gray-500 mt-4">
                  Formats supportés: JPG, PNG, PDF, DOC, MP4, MP3, ZIP
                </p>
              </div>
            </div>

            {/* Liste des fichiers (section scrollable) */}
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Transferts en cours</h3>
                {files.length > 0 && (
                  <button
                    onClick={() => setFiles([])}
                    className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                    Tout supprimer
                  </button>
                )}
              </div>

              {files.length === 0 ? (
                <div className="text-center py-8 flex flex-col justify-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <File className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-gray-500">Aucun transfert en cours</p>
                  <p className="text-sm text-gray-400">
                    {!selectedPeer 
                      ? 'Sélectionnez un destinataire' 
                      : 'Ajoutez des fichiers pour commencer'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2">
                  {files.map((file) => {
                    const typeInfo = getFileTypeInfo(file.type);
                    
                    return (
                      <div
                        key={file.id}
                        className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-all duration-200 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`w-10 h-10 rounded-lg ${typeInfo.color} flex items-center justify-center text-xl`}>
                              {typeInfo.icon}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-800 truncate text-sm" title={file.name}>
                                  {file.name}
                                </p>
                                <span className="text-xs text-gray-500 ml-2 shrink-0">
                                  {formatFileSize(file.size)}
                                </span>
                              </div>
                              
                              {/* Barre de progression */}
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    file.status === 'success'
                                      ? 'bg-green-500'
                                      : file.status === 'error'
                                      ? 'bg-red-500'
                                      : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                  }`}
                                  style={{ width: `${file.progress}%` }}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs font-medium ${
                                    file.status === 'success'
                                      ? 'text-green-600'
                                      : file.status === 'error'
                                      ? 'text-red-600'
                                      : 'text-blue-600'
                                  }`}>
                                    {file.status === 'uploading' && `${Math.round(file.progress)}%`}
                                    {file.status === 'success' && 'Terminé'}
                                    {file.status === 'error' && 'Échec'}
                                  </span>
                                  
                                  {file.status === 'uploading' && (
                                    <div className="flex items-center text-blue-600 text-xs">
                                      <Loader className="w-2.5 h-2.5 animate-spin mr-1" />
                                      P2P...
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {file.status === 'success' && (
                                    <Check className="w-4 h-4 text-green-500" />
                                  )}
                                  {file.status === 'error' && (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  <button
                                    onClick={() => removeFile(file.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
                                    aria-label={`Supprimer ${file.name}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              {file.error && (
                                <p className="text-xs text-red-500 mt-1 flex items-center">
                                  <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                                  <span className="truncate">{file.error}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panneau de droite - Informations (sidebar fixe) */}
        <div className="lg:col-span-1 w-full lg:w-1/5 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Informations</h2>
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-1">Transfert P2P</h3>
                <p className="text-sm text-blue-700">
                  Les fichiers sont transférés directement entre utilisateurs sans passer par un serveur.
                </p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <h3 className="font-medium text-green-800 mb-1">Sécurité</h3>
                <p className="text-sm text-green-700">
                  Connexion chiffrée de bout en bout. Vos fichiers restent privés.
                </p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <h3 className="font-medium text-purple-800 mb-1">Vitesse</h3>
                <p className="text-sm text-purple-700">
                  Transfert direct = Pas de limitation de vitesse serveur.
                </p>
              </div>
              
              {files.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <h3 className="font-medium text-gray-800 mb-2">Statistiques actives</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">En cours:</span>
                      <span className="font-medium text-blue-600">{uploadingFiles}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Terminés:</span>
                      <span className="font-medium text-green-600">{uploadedFiles}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taille totale:</span>
                      <span className="font-medium text-purple-600">{formatFileSize(totalSize)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {selectedPeer && (
              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800">
                  Prêt pour le transfert
                </p>
                <p className="text-xs text-green-700">
                  Connecté à: {selectedPeer}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}