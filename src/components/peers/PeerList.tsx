// components/peers/PeerList.tsx

'use client';

import { usePeerStore } from '@/stores/peerStore';

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
    const { peers, setActivePeer } = usePeerStore();
    const onlinePeers = Array.from(peers.values());

    if (onlinePeers.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>Aucun utilisateur en ligne</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {onlinePeers.map((peer) => (
                <div
                    key={peer.userId}
                    className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setActivePeer(peer.userId)}
                >
                    <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                {peer.avatar ? (
                                    <img
                                        src={peer.avatar}
                                        alt={peer.userName}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="text-lg font-medium text-gray-600">
                                        {peer.userName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            {/* Indicateur de statut */}
                            <div
                                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColors[peer.status]
                                    }`}
                            />
                        </div>

                        {/* Infos */}
                        <div className="flex-1">
                            <p className="font-medium text-gray-900">{peer.userName}</p>
                            <p className="text-sm text-gray-500">{statusLabels[peer.status]}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                            <button
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Connecter P2P
                                }}
                            >
                                Connecter
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}