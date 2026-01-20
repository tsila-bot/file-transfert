// app/(dashboard)/dashboard-old/page.tsx
// DEPRECATED: Use /dashboard/home instead

'use client';

import Link from 'next/link';
import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import TransferZone from '@/components/transfer/TransferZone';
import { usePeerStore } from '@/stores/peerStore';
import { Upload, File, X, Check, AlertCircle, Cloud, Loader } from 'lucide-react';
import { PeerManager } from '@/components/peers/PeerManager';
import { PeerList } from '@/components/peers/PeerList';

// Types TypeScript
type FileStatus = 'uploading' | 'success' | 'error';

// ✅ MODIFIÉ: Ajout de recipientId et recipientName
interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: FileStatus;
  error?: string | null;
  recipientId?: string; // ✅ NOUVEAU
  recipientName?: string; // ✅ NOUVEAU
}

interface FileTypeInfo {
  color: string;
  icon: string;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const peerStore = usePeerStore();

  // ✅ CHANGÉ: Utiliser activePeerIds au lieu de activePeerId
  const activePeerIds = peerStore.activePeerIds;
  const activePeers = peerStore.getActivePeers();
  const activePeerNames = activePeers.map((p) => p.userName).join(', ');

  // Types de fichiers avec leurs couleurs et icônes
  const fileTypes: Record<string, FileTypeInfo> = {
    image: { color: 'bg-blue-100 text-blue-600', icon: '🖼️' },
    pdf: { color: 'bg-red-100 text-red-600', icon: '📄' },
    text: { color: 'bg-green-100 text-green-600', icon: '📝' },
    video: { color: 'bg-purple-100 text-purple-600', icon: '🎬' },
    audio: { color: 'bg-yellow-100 text-yellow-600', icon: '🎵' },
    archive: { color: 'bg-gray-100 text-gray-600', icon: '📦' },
    application: { color: 'bg-indigo-100 text-indigo-600', icon: '📎' },
    default: { color: 'bg-indigo-100 text-indigo-600', icon: '📎' },
  };

  // ✅ MODIFIÉ: Accepte un array de peerIds
  const simulateP2PTransfer = (file: File, peerIds: string[]) => {
    if (peerIds.length === 0) {
      alert('Aucun destinataire sélectionné');
      return;
    }

    // ✅ CHANGÉ: Créer UN transfert par peer
    peerIds.forEach((peerId) => {
      const peer = peerStore.getPeer(peerId);
      const fileType = file.type.split('/')[0] || 'default';

      const fileObj: FileItem = {
        id: `${Date.now()}-${peerId}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: fileType,
        progress: 0,
        status: 'uploading',
        error: null,
        recipientId: peerId,
        recipientName: peer?.userName || 'Unknown',
      };

      setFiles((prev) => [...prev, fileObj]);

      // Simulation de progression P2P
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);

          const success = Math.random() > 0.15;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileObj.id
                ? {
                    ...f,
                    progress: 100,
                    status: success ? 'success' : 'error',
                    error: success ? null : `Échec vers ${peer?.userName}`,
                  }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileObj.id ? { ...f, progress: Math.min(progress, 100) } : f))
          );
        }
      }, 300);
    });
  };

  // ✅ MODIFIÉ: Vérifier activePeerIds.length
  const handleFileSelect = (selectedFiles: FileList): void => {
    if (activePeerIds.length === 0) {
      alert(
        'Veuillez sélectionner au moins un destinataire dans la liste des utilisateurs connectés'
      );
      return;
    }

    Array.from(selectedFiles).forEach((file) => {
      simulateP2PTransfer(file, activePeerIds);
    });
  };

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

  // ✅ MODIFIÉ: Vérifier activePeerIds.length
  const handleClick = (): void => {
    if (activePeerIds.length === 0) {
      alert(
        'Veuillez sélectionner au moins un destinataire dans la liste des utilisateurs connectés'
      );
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (id: string): void => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeInfo = (type: string): FileTypeInfo => {
    return fileTypes[type] || fileTypes.default;
  };

  const totalFiles = files.length;
  const uploadedFiles = files.filter((f) => f.status === 'success').length;
  const uploadingFiles = files.filter((f) => f.status === 'uploading').length;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="lg:col-span-2 w-full lg:w-3/5 relative z-0">
      <div className="bg-white rounded-lg shadow p-6 h-auto flex flex-col">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2 text-black">Transfert P2P</h2>
            <div className="mt-2">
              <Link href="/transfert" className="text-sm text-blue-600 hover:underline">
                Ouvrir la page Transfert
              </Link>
            </div>

            {/* ✅ MODIFIÉ: Affichage multi-destinataires */}
            <p className="text-gray-600 text-sm">
              {activePeerIds.length === 0 && 'Sélectionnez des destinataires à gauche'}
              {activePeerIds.length === 1 && `Transfert vers: ${activePeerNames}`}
              {activePeerIds.length > 1 &&
                `Transfert vers ${activePeerIds.length} destinataires: ${activePeerNames}`}
            </p>

            {/* ✅ NOUVEAU: Badge avec nombre de destinataires */}
            {activePeerIds.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {activePeerIds.length} destinataire{activePeerIds.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => peerStore.clearActivePeers()}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Tout désélectionner
                </button>
              </div>
            )}
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

        <div className="mb-6">
          <TransferZone />
        </div>

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
              {/* ✅ MODIFIÉ */}
              <p className="text-sm text-gray-400">
                {activePeerIds.length === 0
                  ? 'Sélectionnez des destinataires'
                  : 'Ajoutez des fichiers pour commencer'}
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
                        <div
                          className={`w-10 h-10 rounded-lg ${typeInfo.color} flex items-center justify-center text-xl`}
                        >
                          {typeInfo.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            {/* ✅ MODIFIÉ: Afficher le destinataire */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="font-medium text-gray-800 truncate text-sm"
                                title={file.name}
                              >
                                {file.name}
                              </p>
                              {file.recipientName && (
                                <p className="text-xs text-gray-500">→ {file.recipientName}</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 ml-2 shrink-0">
                              {formatFileSize(file.size)}
                            </span>
                          </div>

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
                              <span
                                className={`text-xs font-medium ${
                                  file.status === 'success'
                                    ? 'text-green-600'
                                    : file.status === 'error'
                                      ? 'text-red-600'
                                      : 'text-blue-600'
                                }`}
                              >
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
  );
}
