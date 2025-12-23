'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePeerStore } from '@/stores/peerStore';
import { useSocket } from '@/shared/hooks/useSocket';
import {
    Monitor,
    Smartphone,
    Signal,
    Users,
    AlertCircle,
    Loader2,
    Info,
    RefreshCw
} from 'lucide-react';
const statusConfig = {
    available: {
        color: 'bg-green-500',
        label: 'Disponible',
        dotColor: 'bg-green-500',
    },
    busy: {
        color: 'bg-amber-500',
        label: 'Occupé',
        dotColor: 'bg-amber-500',
    },
    in_call: {
        color: 'bg-blue-500',
        label: 'En appel',
        dotColor: 'bg-blue-500',
    },
    transferring: {
        color: 'bg-purple-500',
        label: 'En transfert',
        dotColor: 'bg-purple-500',
    },
};
export function PeerList() {
    const { peers, setActivePeer, activePeerId } = usePeerStore();
    const { emit, isConnected } = useSocket();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const onlinePeers = Array.from(peers.values());
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isConnected()) {
                setError('Non connecté au serveur');
            } else {
                setError(null);
            }
            setLoading(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, [isConnected]);
    const handleConnectPeer = (userId: string, userName: string) => {
        setActivePeer(userId);
        // TODO: Démarrer une connexion WebRTC
    };
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    // Loading State
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="mb-4"
                >
                    <Loader2 className="w-10 h-10 text-cyan-500" />
                </motion.div>
                <p className="font-bold text-slate-900 mb-1">Chargement des pairs</p>
                <p className="text-sm text-slate-500 font-medium">
                    {isConnected() ? '🟢 Connecté' : '🔴 Déconnecté'}
                </p>
            </div>
        );
    }
    // Error State
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="font-black text-slate-900 text-lg mb-2 tracking-tight">
                    Erreur de connexion
                </h3>
                <p className="text-slate-600 font-medium mb-6 text-center max-w-xs">
                    {error}
                </p>
                <button
                    onClick={() => emit('get_ice_servers')}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Réessayer
                </button>
            </div>
        );
    }
    // Empty State
    if (onlinePeers.length <= 1) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-900 text-lg mb-2 tracking-tight">
                    Aucun pair en ligne
                </h3>
                <p className="text-slate-600 font-medium text-center max-w-xs mb-4">
                    Connectez-vous depuis un autre appareil pour voir les utilisateurs ici.
                </p>
                <div className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {isConnected() ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
                </div>
            </div>
        );
    }
    // Peer List
    return (
        <div className="space-y-6 bg-red-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                        Pairs disponibles
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Users className="w-4 h-4" />
                        <span>
                            {onlinePeers.length} utilisateur{onlinePeers.length > 1 ? 's' : ''} en ligne
                        </span>
                    </div>
                </div>
                <div className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    CONNECTÉ
                </div>
            </div>
            {/* Peer Cards */}
            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                <AnimatePresence>
                    {onlinePeers.map((peer, index) => {
                        const statusInfo = statusConfig[peer.status];
                        const isActive = activePeerId === peer.userId;
                        return (
                            <motion.div
                                key={peer.userId}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ y: -2 }}
                                onClick={() => handleConnectPeer(peer.userId, peer.userName)}
                                className={`bg-white rounded-xl border p-5 cursor-pointer transition-all duration-200 relative overflow-hidden group ${isActive
                                    ? 'border-cyan-300 ring-2 ring-cyan-500/20'
                                    : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                                    }`}
                            >
                                {/* Status Indicator */}
                                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                                    <motion.div
                                        className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`}
                                        animate={
                                            peer.status === 'available'
                                                ? { scale: [1, 1.2, 1] }
                                                : {}
                                        }
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {statusInfo.label}
                                    </span>
                                </div>
                                <div className="flex items-start gap-4 mb-4">
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/20">
                                            {peer.avatar ? (
                                                <img
                                                    src={peer.avatar}
                                                    alt={peer.userName}
                                                    className="w-full h-full rounded-lg object-cover"
                                                />
                                            ) : (
                                                peer.userName.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">
                                            {peer.userName}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-0.5">
                                            {peer.status === 'available' ? (
                                                <Monitor className="w-3.5 h-3.5" />
                                            ) : (
                                                <Smartphone className="w-3.5 h-3.5" />
                                            )}
                                            <span className="font-medium">En ligne</span>
                                        </div>
                                    </div>
                                    {/* Time */}
                                    <div className="text-xs text-slate-400 font-medium">
                                        {formatTime(peer.connectedAt)}
                                    </div>
                                </div>
                                {/* Footer */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Peer ID Badge */}
                                        <div className="text-xs px-2 py-1 bg-slate-50 text-slate-500 rounded-md font-mono">
                                            {peer.userId.substring(0, 8)}
                                        </div>
                                    </div>
                                    {/* Connect Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConnectPeer(peer.userId, peer.userName);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-lg shadow-slate-900/20 transform translate-y-2 group-hover:translate-y-0 transition-transform"
                                    >
                                        Connecter
                                    </button>
                                </div>
                                {/* Background Decoration */}
                                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-full blur-xl pointer-events-none" />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
            {/* Debug Info (Dev Only) */}
            {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <summary className="text-xs font-bold text-slate-600 cursor-pointer flex items-center gap-2 hover:text-slate-900 transition-colors">
                        <Info className="w-3 h-3" />
                        Debug Info
                    </summary>
                    <div className="mt-3 space-y-1 text-xs text-slate-500 font-mono">
                        <div className="flex justify-between">
                            <span>Socket:</span>
                            <span className="font-bold">{isConnected() ? '✅ Connected' : '❌ Disconnected'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Peers:</span>
                            <span className="font-bold">{onlinePeers.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Updated:</span>
                            <span className="font-bold">{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </details>
            )}
        </div>
    );
}