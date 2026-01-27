'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
// Components
import TransferZone from '@/components/transfer/TransferZone';
import { PeerList } from '@/components/peers/PeerList';
// Stores
import { usePeerStore } from '@/stores/peerStore';
import { useAuthStore } from '@/stores/authStore';
// Icons
import { Activity, MessageCircle, Phone, Users, Share2, ArrowRight } from 'lucide-react';
// Services
import { apiClient } from '@/core/services/api/client.service';
import { getSocketClient } from '@/lib/socket/SocketClient';
// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
} as const;
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
    <motion.div 
      className="space-y-8 p-6 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tableau de Bord</h1>
          <p className="text-gray-500 mt-1 text-lg">Bienvenue sur Webdevin - Plateforme P2P de collaboration</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          Système opérationnel
        </div>
      </motion.div>
      {/* Stats Grid */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          title="Utilisateurs en ligne" 
          value={onlinePeers.length} 
          icon={Activity} 
          color="green" 
          loading={false}
        />
        <StatCard 
          title="Messages non lus" 
          value={stats.messages} 
          icon={MessageCircle} 
          color="blue" 
          loading={stats.loading}
        />
        <StatCard 
          title="Appels Actifs" 
          value={0} 
          icon={Phone} 
          color="purple" 
          loading={false}
        />
        <StatCard 
          title="Groupes" 
          value={stats.teams} 
          icon={Users} 
          color="indigo" 
          loading={stats.loading}
        />
      </motion.div>
      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left - Transfer Zone */}
        <motion.div 
          variants={itemVariants} 
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Transfert de Fichiers</h2>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">P2P Secure</span>
          </div>
          <div className="p-6">
            <TransferZone />
          </div>
        </motion.div>
        {/* Right - Users Online (Adaptive Height) */}
        <motion.div 
          variants={itemVariants} 
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col"
        >
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-gray-900">Utilisateurs en ligne</h2>
            <div className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
              {onlinePeers.length}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <PeerList />
          </div>
        </motion.div>
      </div>
      {/* Quick Links */}
      <motion.div variants={containerVariants}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 px-1">Accès Rapide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLinkCard 
            href="/chat" 
            title="Chat" 
            description="Messages directs" 
            icon={MessageCircle} 
            color="blue" 
          />
          <QuickLinkCard 
            href="/calls" 
            title="Appels Vidéo" 
            description="Appels vocaux et vidéo" 
            icon={Phone} 
            color="purple" 
          />
          <QuickLinkCard 
            href="/teams" 
            title="Groupes" 
            description="Espaces collaboratifs" 
            icon={Users} 
            color="indigo" 
          />
          <QuickLinkCard 
            href="/contacts" 
            title="Contacts" 
            description="Carnet d'adresses" 
            icon={Share2} 
            color="green" 
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
// --- Sub-components for cleaner code ---
function StatCard({ title, value, icon: Icon, color, loading }: { title: string, value: number | string, icon: any, color: string, loading: boolean }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  }[color] || 'bg-gray-50 text-gray-600';
  return (
    <motion.div 
      variants={itemVariants}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses} transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={24} strokeWidth={2} />
        </div>
      </div>
      {/* Decorative gradient background opacity */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 bg-${color}-500 pointer-events-none`} />
    </motion.div>
  );
}
function QuickLinkCard({ href, title, description, icon: Icon, color }: { href: string, title: string, description: string, icon: any, color: string }) {
  const colorStyles = {
    blue: 'hover:border-blue-200 hover:shadow-blue-100/50',
    purple: 'hover:border-purple-200 hover:shadow-purple-100/50',
    indigo: 'hover:border-indigo-200 hover:shadow-indigo-100/50',
    green: 'hover:border-green-200 hover:shadow-green-100/50',
  }[color] || 'hover:border-gray-200';
  const iconColor = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    green: 'text-green-600 bg-green-50',
  }[color] || 'text-gray-600 bg-gray-50';
  return (
    <Link href={href} className="block h-full">
      <motion.div 
        variants={itemVariants}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
        className={`h-full bg-white border border-gray-100 rounded-xl p-5 shadow-sm transition-all duration-300 ${colorStyles} group`}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${iconColor} transition-colors group-hover:bg-opacity-80`}>
            <Icon size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-transform group-hover:translate-x-1" />
            </div>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}