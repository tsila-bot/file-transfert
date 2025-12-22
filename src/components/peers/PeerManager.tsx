// components/peers/PeerManager.tsx

'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from '../../shared/hooks/useSocket';
import { usePeerStore, Peer } from '@/stores/peerStore';

export function PeerManager() {
    const { on, off, isConnected } = useSocket();
    const store = usePeerStore();

    // 🆕 Stocker le store dans une ref pour accès stable
    const storeRef = useRef(store);
    storeRef.current = store;

    useEffect(() => {
        console.log('🔍 PeerManager mounted');
        console.log('🔍 Socket connected?', isConnected());

        if (!isConnected()) {
            console.warn('⚠️ Socket not connected, waiting...');
            // 🆕 Attendre que le socket se connecte
            const checkInterval = setInterval(() => {
                if (isConnected()) {
                    console.log('✅ Socket connected, reloading component...');
                    clearInterval(checkInterval);
                    window.location.reload(); // Force un re-mount
                }
            }, 1000);

            return () => clearInterval(checkInterval);
        }

        console.log('✅ Setting up event listeners...');

        // 🆕 Handlers avec accès à storeRef (références stables)
        const handleOnlineUsers = (data: { users: Peer[] }) => {
            console.log('📋 Online users received:', data.users.length);
            console.log('📋 Raw data:', data);
            storeRef.current.clearPeers();
            data.users.forEach((user) => {
                storeRef.current.addPeer({
                    ...user,
                    connectedAt: new Date(user.connectedAt),
                });
            });
        };

        const handleUserOnline = (data: { userId: string; userName: string }) => {
            console.log('🟢 User online:', data.userName);
            storeRef.current.addPeer({
                userId: data.userId,
                userName: data.userName,
                status: 'available',
                connectedAt: new Date(),
            });
        };

        const handleUserOffline = (data: { userId: string }) => {
            console.log('🔴 User offline:', data.userId);
            storeRef.current.removePeer(data.userId);
        };

        const handleUserStatusChange = (data: {
            userId: string;
            status: Peer['status'];
        }) => {
            console.log('📊 User status change:', data.userId, data.status);
            storeRef.current.updatePeerStatus(data.userId, data.status);
        };

        // S'abonner aux événements
        on('online_users', handleOnlineUsers);
        on('user_online', handleUserOnline);
        on('user_offline', handleUserOffline);
        on('user_status_change', handleUserStatusChange);

        console.log('✅ All listeners registered');

        // Cleanup avec les MÊMES références de fonction
        return () => {
            console.log('🧹 Cleaning up listeners');
            off('online_users', handleOnlineUsers);
            off('user_online', handleUserOnline);
            off('user_offline', handleUserOffline);
            off('user_status_change', handleUserStatusChange);
        };
    }, [on, off, isConnected]); // 🆕 Seulement on, off, isConnected

    return null;
}