"use client"
import React, { useCallback, useState, useMemo } from 'react'
import { Eye, EyeOff, Link2, UploadCloud, FileText, Lock, ShieldCheck, X, Check, ArrowRight, ArrowLeft, AlertCircle, StopCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
// Imports preserved from original code
import '@/core/P2P/receiveHandler'
import { getTransferManager } from '@/core/P2P/TransferManager'
import { useInitializeTransferStore, useTransferStore } from '@/stores/transferStore'
import { usePeerStore } from '@/stores/peerStore'
import ProgressBar from './ProgressBar'
import ChunkVisualization from './ChunkVisualization'
export default function TransferZone() {
    const router = useRouter()
    useInitializeTransferStore()
    const [, forceRerender] = useState(0)
    // Select the Map from the store (stable reference when unchanged),
    // then derive an array with useMemo to avoid returning a new array each render
    const transfersMap = useTransferStore((s) => s.transfers)
    const transfers = useMemo(() => Array.from(transfersMap.values()), [transfersMap])
    const [selectedPeer, setSelectedPeer] = useState<string | null>(null)
    const peerStore = usePeerStore()
    // Sync selectedPeer with global active selection
    React.useEffect(() => {
        const active = peerStore.activePeerIds.length > 0 ? peerStore.activePeerIds[0] : null
        setSelectedPeer(active)
    }, [peerStore.activePeerIds])
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [compress, setCompress] = useState(true)
    // État pour le dialog de mot de passe
    const [passwordDialog, setPasswordDialog] = useState<{ fileId: string; peerId: string; show: boolean }>({
        fileId: '',
        peerId: '',
        show: false,
    })
    const [passwordInput, setPasswordInput] = useState('')
    const [showPasswordDialog, setShowPasswordDialog] = useState(false)
    const [passwordDialogError, setPasswordDialogError] = useState('')
    const manager = getTransferManager()
    const [connectedPeers, setConnectedPeers] = useState(() => manager.getConnectedPeers())
    React.useEffect(() => {
        const refresh = () => setConnectedPeers(manager.getConnectedPeers())
        manager.on('peer:added', refresh)
        manager.on('peer:removed', refresh)
        return () => {
            try {
                manager.off('peer:added', refresh)
                manager.off('peer:removed', refresh)
            } catch { }
        }
    }, [manager])
    const onDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return
        const file = files[0]
        // Guard against directories or zero-byte entries
        if (file.size === 0) {
            console.warn('Dropped file has size 0 — it may be a directory or inaccessible file', file.name)
            alert('Fichier invalide ou vide. Veuillez sélectionner un fichier réel (non-dossier).')
            return
        }
        const targetPeer = selectedPeer ?? connectedPeers[0]?.peerId
        if (!targetPeer) {
            alert('Aucun pair connecté. Veuillez sélectionner un pair connecté.')
            return
        }
        // Check if peer's data channels are ready
        const connection = manager.getPeerConnection(targetPeer)
        if (!connection || !connection.areDataChannelsReady()) {
            alert('Connexion en cours d\'établissement. Veuillez patienter que les canaux de données soient prêts.')
            return
        }
        try {
            await manager.sendFile(file, targetPeer, {
                encrypt: true, // ✅ Chiffrement activé par défaut
                password: password || undefined,
            })
            forceRerender((v) => v + 1)
        } catch (err) {
            console.error('Failed to send file:', err)
            alert('Échec envoi fichier: ' + (err as Error).message)
        }
    }, [manager, password, selectedPeer, connectedPeers])
    const onFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size === 0) {
            console.warn('Selected file has size 0 — ignoring', file.name)
            alert('Fichier invalide ou vide. Veuillez sélectionner un fichier réel (non-dossier).')
            e.target.value = ''
            return
        }
        const targetPeer = selectedPeer ?? connectedPeers[0]?.peerId
        if (!targetPeer) {
            alert('Aucun pair connecté. Veuillez sélectionner un pair connecté.')
            return
        }
        // Check if peer's data channels are ready
        const connection = manager.getPeerConnection(targetPeer)
        if (!connection || !connection.areDataChannelsReady()) {
            alert('Connexion en cours d\'établissement. Veuillez patienter que les canaux de données soient prêts.')
            return
        }
        try {
            await manager.sendFile(file, targetPeer, {
                encrypt: true, // ✅ Chiffrement activé par défaut
                password: password || undefined,
            })
            forceRerender((v) => v + 1)
        } catch (err) {
            console.error('Failed to send file:', err)
            alert('Échec envoi fichier: ' + (err as Error).message)
        }
    }, [manager, password, selectedPeer, connectedPeers])
    // Fonction pour accepter un transfert (avec ou sans mot de passe)
    const handleAcceptTransfer = useCallback(
        async (fileId: string, peerId: string) => {
            const transfer = transfers.find((t) => t.id === fileId)
            // Si le transfert est protégé par mot de passe, afficher le dialog
            if (transfer?.metadata?.encrypted && transfer?.metadata?.passwordProtected) {
                setPasswordDialog({ fileId, peerId, show: true })
                setPasswordInput('')
                setPasswordDialogError('')
                return
            }
            // Sinon, accepter directement
            try {
                manager.acceptTransfer(fileId, peerId)
                forceRerender((v) => v + 1)
            } catch (err) {
                console.error('Failed to accept transfer', err)
                alert('Erreur: ' + (err as Error).message)
            }
        },
        [transfers, manager]
    )
    // Fonction pour soumettre le mot de passe
    const handleSubmitPassword = useCallback(
        async (fileId: string, peerId: string, password: string) => {
            if (!password.trim()) {
                setPasswordDialogError('Veuillez entrer un mot de passe')
                return
            }
            try {
                await manager.acceptTransferWithPassword(fileId, peerId, password)
                setPasswordDialog({ fileId: '', peerId: '', show: false })
                setPasswordInput('')
                setPasswordDialogError('')
                forceRerender((v) => v + 1)
            } catch (err) {
                console.error('Failed to accept transfer with password', err)
                setPasswordDialogError('Mot de passe incorrect ou erreur de déchiffrement')
            }
        },
        [manager]
    )
    // Fonction pour fermer le dialog
    const handleClosePasswordDialog = useCallback(() => {
        setPasswordDialog({ fileId: '', peerId: '', show: false })
        setPasswordInput('')
        setPasswordDialogError('')
    }, [])
    return (
        <div className="max-w-3xl mx-auto space-y-8 p-4">
            {/* Header Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <UploadCloud className="text-indigo-600" />
                            Transfert de fichiers
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Envoyez des fichiers de manière sécurisée en P2P</p>
                    </div>
                    
                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push('/liens-publics')}
                            className="px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-700 rounded-lg transition-all text-sm font-medium flex items-center gap-2 shadow-sm"
                        >
                            <Link2 size={16} />
                            <span className="hidden sm:inline">Lien public</span>
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/transfer-history')}
                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
                        >
                            <FileText size={16} />
                            <span className="hidden sm:inline">Historique</span>
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    {/* Peer Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Destinataire</label>
                        <div className="relative">
                            <select
                                value={selectedPeer ?? ''}
                                onChange={(e) => setSelectedPeer(e.target.value || null)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 pr-10 transition-shadow"
                            >
                                <option value="">-- Sélectionner un pair --</option>
                                {connectedPeers.map((p) => (
                                    <option key={p.peerId} value={p.peerId}>{p.peerName} ({p.peerId})</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>
                    {/* Drop Zone */}
                    <div
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50/30')
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50/30')
                        }}
                        onDrop={(e) => {
                            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50/30')
                            onDrop(e)
                        }}
                        className="group relative border-2 border-dashed border-slate-300 rounded-xl p-8 text-center transition-all duration-200 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer"
                    >
                        <input 
                            type="file" 
                            onChange={onFileInput}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            id="fileInput"
                        />
                        <div className="flex flex-col items-center justify-center gap-3 pointer-events-none">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                                <UploadCloud size={24} />
                            </div>
                            <div>
                                <p className="text-base font-medium text-slate-900">
                                    Glissez-déposez un fichier ici
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                    ou cliquez pour parcourir
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* Options */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Lock size={14} className="text-slate-400" />
                                Mot de passe (optionnel)
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Protéger le transfert..."
                                    className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-end pb-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={compress} 
                                        onChange={(e) => setCompress(e.target.checked)} 
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">Compression active</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            {/* Active Transfers Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 px-1">
                    <ActivityIcon />
                    Transferts en cours
                </h3>
                
                <div className="space-y-4">
                    <AnimatePresence>
                        {transfers.length === 0 && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400"
                            >
                                Aucun transfert actif
                            </motion.div>
                        )}
                        {transfers.map((t) => (
                            <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                            >
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${
                                                t.direction === 'send' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {t.direction === 'send' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-lg leading-tight">{t.fileName}</h4>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                    <span className="font-medium text-slate-700">{t.peerName}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{t.status}</span>
                                                    <span>•</span>
                                                    <span>{Math.round(t.fileSize / 1024 / 1024)} MB</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Status Badge */}
                                        <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                            t.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            t.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                            t.status === 'active' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {t.status === 'completed' ? 'Terminé' : 
                                             t.status === 'failed' ? 'Échec' : 
                                             t.status === 'active' ? 'En cours' : t.status}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <ProgressBar
                                            percentage={t.progress.percentage}
                                            speed={t.progress.speed}
                                            eta={t.progress.eta}
                                            bytesReceived={t.progress.bytesReceived}
                                            bytesTotal={t.progress.bytesTotal}
                                            status={t.status}
                                        />
                                        {/* Error Message */}
                                        {t.status === 'failed' && t.error && (
                                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-sm text-rose-700">
                                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                <span>{t.error}</span>
                                            </div>
                                        )}
                                        {/* Success Message */}
                                        {t.status === 'completed' && (
                                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2 text-sm text-emerald-700">
                                                <Check size={16} />
                                                <span>Transfert terminé avec succès</span>
                                            </div>
                                        )}
                                        {/* Action Buttons */}
                                        <div className="flex flex-wrap gap-2">
                                            {t.direction === 'receive' && t.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAcceptTransfer(t.id, t.peerId)}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                                    >
                                                        {t.metadata?.encrypted && t.metadata?.passwordProtected ? <Lock size={14} /> : <Check size={14} />}
                                                        Accepter
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            try {
                                                                manager.rejectTransfer(t.id, t.peerId, 'Refus manuel')
                                                                forceRerender((v) => v + 1)
                                                            } catch (err) {
                                                                console.error('Failed to reject transfer', err)
                                                                alert('Erreur: ' + (err as Error).message)
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                                    >
                                                        <X size={14} />
                                                        Refuser
                                                    </button>
                                                </>
                                            )}
                                            {t.direction === 'send' && (t.status === 'pending' || t.status === 'active') && (
                                                <button
                                                    onClick={() => {
                                                        try {
                                                            manager.cancelTransfer(t.id, t.peerId)
                                                            forceRerender((v) => v + 1)
                                                        } catch (err) {
                                                            console.error('Failed to cancel transfer', err)
                                                            alert('Erreur: ' + (err as Error).message)
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                                                >
                                                    <StopCircle size={14} />
                                                    Annuler
                                                </button>
                                            )}
                                        </div>
                                        {/* Chunk Visualization */}
                                        {(t.status === 'active' || t.status === 'paused') && (
                                            <div className="pt-2 border-t border-slate-100">
                                                <ChunkVisualization
                                                    received={t.progress.chunksReceived}
                                                    total={t.progress.chunksTotal}
                                                    status={t.status}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
            {/* Password Dialog */}
            <AnimatePresence>
                {passwordDialog.show && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            {/* Header avec gradient */}
                            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-8 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                                <div className="relative z-10 flex items-center gap-4 mb-2">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-inner">
                                        <ShieldCheck size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold">Accès sécurisé</h3>
                                        <p className="text-indigo-100 text-sm">Fichier chiffré</p>
                                    </div>
                                </div>
                            </div>
                            {/* Body */}
                            <div className="p-6">
                                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                                    Ce fichier est protégé par un mot de passe. Veuillez le saisir pour déchiffrer et télécharger le contenu.
                                </p>
                                {/* Error message */}
                                {passwordDialogError && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-700 flex items-start gap-2"
                                    >
                                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-medium">Accès refusé</p>
                                            <p className="text-rose-600 text-xs mt-0.5">{passwordDialogError}</p>
                                        </div>
                                    </motion.div>
                                )}
                                {/* Password input */}
                                <div className="relative flex items-center mb-6">
                                    <div className="absolute left-4 text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPasswordDialog ? 'text' : 'password'}
                                        placeholder="Mot de passe du fichier"
                                        value={passwordInput}
                                        onChange={(e) => {
                                            setPasswordInput(e.target.value)
                                            setPasswordDialogError('')
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSubmitPassword(passwordDialog.fileId, passwordDialog.peerId, passwordInput)
                                            }
                                        }}
                                        className="w-full px-4 py-3 pl-11 pr-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 text-base"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordDialog(!showPasswordDialog)}
                                        className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-200/50 rounded-lg"
                                    >
                                        {showPasswordDialog ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {/* Actions */}
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={handleClosePasswordDialog}
                                        className="px-5 py-2.5 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all duration-200 font-medium text-sm"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={() => handleSubmitPassword(passwordDialog.fileId, passwordDialog.peerId, passwordInput)}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5"
                                    >
                                        Déchiffrer & Accepter
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
function ActivityIcon() {
    return (
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
    )
}