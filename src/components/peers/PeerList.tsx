// components/peers/PeerList.tsx

'use client';

import { useState, useEffect } from 'react';
import { usePeerStore } from '@/stores/peerStore';
import { useSocket } from '@/shared/hooks/useSocket';

const statusColors = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
    in_call: 'bg-blue-500',
    transferring: 'bg-purple-500',
};

const statusLabels = {
    available: 'Disponible',
    busy: 'Occupé',
    in_call: 'En appel',
    transferring: 'En transfert',
};

export function PeerList() {
    const { peers, setActivePeer, activePeerId } = usePeerStore();
    const { emit, isConnected } = useSocket();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const onlinePeers = Array.from(peers.values());

    // Déboguer quand la liste change
    useEffect(() => {
        console.log('🔄 PeerList updated - Online peers:', onlinePeers.length);
        console.log('📊 Peer IDs:', onlinePeers.map(p => p.userId));
    }, [onlinePeers]);

    // Vérifier la connexion socket
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
        console.log('🔗 Connecting to peer:', userId, userName);
        setActivePeer(userId);
        // TODO: Démarrer une connexion WebRTC
    };

    const handleTestConnection = () => {
        console.log('🧪 Testing connection...');
        emit('get_ice_servers');
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-600">Chargement des utilisateurs...</p>
                <p className="text-xs text-gray-500 mt-1">
                    Statut socket: {isConnected() ? '✅ Connecté' : '❌ Déconnecté'}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-500 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-600 mb-2">Erreur de connexion</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                    onClick={handleTestConnection}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    Tester la connexion
                </button>
            </div>
        );
    }

    if (onlinePeers.length === 0) {
        return (
            <div className="p-6 text-center">
                <div className="text-gray-400 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun utilisateur en ligne</h3>
                <p className="text-gray-500 mb-4">
                    Connectez-vous depuis un autre appareil pour voir les utilisateurs ici.
                </p>
                <div className="text-xs text-gray-400 space-y-1">
                    <p>Socket: {isConnected() ? '✅ Connecté' : '❌ Déconnecté'}</p>
                    <p>Votre ID est enregistré dans Redis</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* En-tête avec compteur */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Utilisateurs en ligne</h2>
                    <p className="text-sm text-gray-500">
                        {onlinePeers.length} utilisateur{onlinePeers.length > 1 ? 's' : ''} disponible{onlinePeers.length > 1 ? 's' : ''}
                    </p>
                </div>
                <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    {isConnected() ? '🟢 Connecté' : '🔴 Déconnecté'}
                </div>
            </div>

            {/* Liste des pairs */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {onlinePeers.map((peer) => (
                    <div
                        key={peer.userId}
                        className={`p-4 bg-white border rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200 ${activePeerId === peer.userId ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'
                            }`}
                        onClick={() => handleConnectPeer(peer.userId, peer.userName)}
                    >
                        <div className="flex items-center space-x-3">
                            {/* Avatar avec indicateur de statut */}
                            <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                    {peer.avatar ? (
                                        <img
                                            src={peer.avatar}
                                            alt={peer.userName}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xl font-bold text-gray-600">
                                            {peer.userName.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                {/* Indicateur de statut */}
                                <div
                                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${statusColors[peer.status]
                                        }`}
                                    title={statusLabels[peer.status]}
                                />
                            </div>

                            {/* Informations */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-gray-900 truncate">
                                            {peer.userName}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {statusLabels[peer.status]}
                                        </p>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {formatTime(peer.connectedAt)}
                                    </div>
                                </div>

                                {/* Badge ID utilisateur */}
                                <div className="mt-2">
                                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                        ID: {peer.userId.substring(0, 8)}...
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-2">
                                <button
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleConnectPeer(peer.userId, peer.userName);
                                    }}
                                    title="Démarrer une connexion P2P"
                                >
                                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Connecter
                                </button>
                                <button
                                    className="px-2 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('Peer details:', peer);
                                        // TODO: Ouvrir modal de détails
                                    }}
                                    title="Voir les détails"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Informations de débogage (seulement en développement) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <details>
                        <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                            🔍 Informations de débogage
                        </summary>
                        <div className="mt-2 text-xs space-y-1">
                            <p>Socket connecté: {isConnected() ? 'Oui' : 'Non'}</p>
                            <p>Nombre de pairs: {onlinePeers.length}</p>
                            <p>Dernière mise à jour: {new Date().toLocaleTimeString()}</p>
                            <div className="mt-2">
                                <button
                                    onClick={() => {
                                        console.log('📊 Dump complet du store:', peers);
                                        console.log('📊 Peers détaillés:', onlinePeers);
                                    }}
                                    className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                                >
                                    Log console
                                </button>
                            </div>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}