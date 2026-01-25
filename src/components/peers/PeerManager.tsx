// components/peers/PeerManager.tsx

'use client';

import { useEffect } from 'react';
import { useSocket } from '../../shared/hooks/useSocket';
import { usePeerStore } from '@/stores/peerStore';

export function PeerManager() {
    const { useEventHandler, isConnected } = useSocket(); //  Récupérer isConnected
    const store = usePeerStore();

    //  Utiliser le handler avec cleanup automatique
    useEventHandler('online_users', (data: { users: any[] }) => {
        console.log('📋 Received online_users event:', data);

        if (!data || !data.users) {
            console.error('❌ Invalid data in online_users:', data);
            return;
        }

        const usersArray = Array.isArray(data.users)
            ? data.users
            : Object.values(data.users);

        console.log(`📋 Processing ${usersArray.length} users`);

        store.clearPeers();

        usersArray.forEach((user: any, index: number) => {
            if (!user || !user.userId || !user.userName) {
                console.warn(`⚠️ Invalid user at index ${index}:`, user);
                return;
            }

            store.addPeer({
                userId: user.userId,
                userName: user.userName,
                status: user.status || 'available',
                avatar: user.avatar || undefined,
                connectedAt: user.connectedAt
                    ? new Date(user.connectedAt)
                    : new Date(),
            });
        });

        console.log(`✅ Store updated with ${store.getOnlinePeers().length} peers`);
    });

    // ✅ Écouter la liste mise à jour des utilisateurs en ligne
    useEventHandler('online_users_updated', (data: { users: any[] }) => {
        console.log('📋 Received online_users_updated event:', data);

        if (!data || !data.users) {
            console.error('❌ Invalid data in online_users_updated:', data);
            return;
        }

        const usersArray = Array.isArray(data.users)
            ? data.users
            : Object.values(data.users);

        console.log(`📋 Processing ${usersArray.length} updated users`);

        store.clearPeers();

        usersArray.forEach((user: any, index: number) => {
            if (!user || !user.userId || !user.userName) {
                console.warn(`⚠️ Invalid user at index ${index}:`, user);
                return;
            }

            store.addPeer({
                userId: user.userId,
                userName: user.userName,
                status: user.status || 'available',
                avatar: user.avatar || undefined,
                connectedAt: user.connectedAt
                    ? new Date(user.connectedAt)
                    : new Date(),
            });
        });

        console.log(`✅ Store updated with ${store.getOnlinePeers().length} peers (from updated list)`);
    });

    useEventHandler('user_online', (data: { userId: string; userName: string }) => {
        console.log('🟢 User online event:', data);

        if (!data.userId || !data.userName) {
            console.error(' Invalid user_online data:', data);
            return;
        }

        const existing = store.getPeer(data.userId);
        if (existing) {
            console.log(`ℹ User ${data.userId} already in store`);
            return;
        }

        store.addPeer({
            userId: data.userId,
            userName: data.userName,
            status: 'available',
            connectedAt: new Date(),
        });

        console.log(` Added new user: ${data.userName}`);
    });

    useEventHandler('user_offline', (data: { userId: string }) => {
        console.log('🔴 User offline event:', data);

        if (!data.userId) {
            console.error(' Invalid user_offline data:', data);
            return;
        }

        store.removePeer(data.userId);
        console.log(` Removed user: ${data.userId}`);
    });

    useEventHandler('user_status_change', (data: {
        userId: string;
        status: 'available' | 'busy' | 'in_call' | 'transferring';
    }) => {
        console.log('User status change event:', data);

        if (!data.userId || !data.status) {
            console.error(' Invalid status_change data:', data);
            return;
        }

        store.updatePeerStatus(data.userId, data.status);
        console.log(` Updated status for ${data.userId} to ${data.status}`);
    });

    // 🔍 Debug UI
    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-black bg-opacity-75 text-white text-xs p-2 rounded-lg">
                <div>Socket: {isConnected() ? 'OUI' : 'NON '}</div> {/*  Utiliser isConnected() */}
                <div>Peers: {store.getOnlinePeers().length}</div>
            </div>
        </div>
    );
}