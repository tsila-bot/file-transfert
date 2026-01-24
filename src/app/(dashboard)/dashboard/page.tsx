// app/(dashboard)/dashboard/page.tsx

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import TransferZone from '@/components/transfer/TransferZone';
import { PeerList } from '@/components/peers/PeerList';
import { usePeerStore } from '@/stores/peerStore';
import { useAuthStore } from '@/stores/authStore';
import { Activity, MessageCircle, Phone, Users, Share2 } from 'lucide-react';
import { apiClient } from '@/core/services/api/client.service';
import { getSocketClient } from '@/lib/socket/SocketClient';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const peerStore = usePeerStore();
  const authStore = useAuthStore();
  const router = useRouter();
  const onlinePeers = peerStore.getOnlinePeers();
  
  const [stats, setStats] = useState({
    messages: 0,
    teams: 0,
    loading: true
  });

  // Charger les stats au démarrage
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const unreadResponse = await apiClient.get('/api/chat/unread-count');
        const unreadCount = unreadResponse.data?.data?.unreadCount || 0;

        const teamsResponse = await apiClient.get('/api/teams');
        const teams = teamsResponse.data?.teams || [];

        setStats({
          messages: unreadCount,
          teams: teams.length,
          loading: false
        });
      } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    if (authStore.user?.id) {
      fetchStats();
    }
  }, [authStore.user?.id]);

  // 🆕 Refetch le compteur quand le dashboard redevient visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Dashboard redevient visible - Refetch du compteur...');
        const fetchUnreadCount = async () => {
          try {
            const unreadResponse = await apiClient.get('/api/chat/unread-count');
            const unreadCount = unreadResponse.data?.data?.unreadCount || 0;
            setStats(prev => ({
              ...prev,
              messages: unreadCount
            }));
            console.log('✅ Compteur mis à jour au retour:', unreadCount);
          } catch (error) {
            console.error('❌ Erreur lors du refetch:', error);
          }
        };
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Écouter les changements en temps réel du compteur de messages
  useEffect(() => {
    let mounted = true;

    const setupSocketListeners = () => {
      const socketClient = getSocketClient();
      if (!socketClient) {
        console.warn('❌ Socket client not available');
        return null;
      }

      // ✅ HANDLER 1: Mises à jour directes du compteur
      const handleUnreadCountUpdated = (data: any) => {
        if (!mounted) return;
        console.log('📬 Compteur de messages mise à jour en temps réel:', data.unreadCount);
        setStats(prev => ({
          ...prev,
          messages: data.unreadCount
        }));
      };

      // ✅ HANDLER 2: Refetch après marquage comme lus
      const handleMessagesMarkedAsRead = async () => {
        if (!mounted) return;
        try {
          const unreadResponse = await apiClient.get('/api/chat/unread-count');
          const unreadCount = unreadResponse.data?.data?.unreadCount || 0;
          setStats(prev => ({
            ...prev,
            messages: unreadCount
          }));
        } catch (error) {
          console.error('❌ Erreur lors du refetch:', error);
        }
      };

      // ✅ HANDLER 3: Refetch quand nouveau message reçu
      const handleNewMessage = async () => {
        if (!mounted) return;
        try {
          const unreadResponse = await apiClient.get('/api/chat/unread-count');
          const unreadCount = unreadResponse.data?.data?.unreadCount || 0;
          setStats(prev => ({
            ...prev,
            messages: unreadCount
          }));
        } catch (error) {
          console.error('❌ Erreur lors du refetch:', error);
        }
      };

      // Enregistrer les listeners
      socketClient.on('unread_count_updated' as any, handleUnreadCountUpdated);
      socketClient.on('chat:messages_marked_as_read' as any, handleMessagesMarkedAsRead);
      socketClient.on('chat_message' as any, handleNewMessage);

      return () => {
        socketClient.off('unread_count_updated' as any, handleUnreadCountUpdated);
        socketClient.off('chat:messages_marked_as_read' as any, handleMessagesMarkedAsRead);
        socketClient.off('chat_message' as any, handleNewMessage);
      };
    };

    const cleanup = setupSocketListeners();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
        <p className="text-gray-500 mt-1">Bienvenue sur Tsilavina - Plateforme P2P de collaboration</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Utilisateurs en ligne</p>
              <p className="text-3xl font-bold text-gray-900">{onlinePeers.length}</p>
            </div>
            <Activity className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Messages</p>
              <p className="text-3xl font-bold text-gray-900">{stats.loading ? '-' : stats.messages}</p>
            </div>
            <MessageCircle className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Appels Actifs</p>
              <p className="text-3xl font-bold text-gray-900">0</p>
            </div>
            <Phone className="text-purple-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Groupes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.loading ? '-' : stats.teams}</p>
            </div>
            <Users className="text-indigo-600" size={32} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Transfer Zone */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Transfert de Fichiers</h2>
          <TransferZone />
        </div>

        {/* Right - Users Online */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Utilisateurs en ligne</h2>
          <div className="flex-1 overflow-y-auto">
            <PeerList />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/chat" className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition">
          <MessageCircle className="text-blue-600 mb-3" size={32} />
          <h3 className="font-semibold text-gray-900 mb-1">Chat</h3>
          <p className="text-sm text-gray-600">Envoyez des messages directs</p>
        </Link>

        <Link href="/calls" className="bg-purple-50 border border-purple-200 rounded-lg p-6 hover:bg-purple-100 transition">
          <Phone className="text-purple-600 mb-3" size={32} />
          <h3 className="font-semibold text-gray-900 mb-1">Appels Vidéo</h3>
          <p className="text-sm text-gray-600">Appelez vos contacts</p>
        </Link>

        <Link href="/teams" className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 hover:bg-indigo-100 transition">
          <Users className="text-indigo-600 mb-3" size={32} />
          <h3 className="font-semibold text-gray-900 mb-1">Groupes</h3>
          <p className="text-sm text-gray-600">Gérez vos groupes</p>
        </Link>

        <Link href="/contacts" className="bg-green-50 border border-green-200 rounded-lg p-6 hover:bg-green-100 transition">
          <Share2 className="text-green-600 mb-3" size={32} />
          <h3 className="font-semibold text-gray-900 mb-1">Contacts</h3>
          <p className="text-sm text-gray-600">Gérez vos contacts</p>
        </Link>
      </div>
    </div>
  );
}