// app/(dashboard)/dashboard/page.tsx

'use client';

import Link from 'next/link';
import TransferZone from '@/components/transfer/TransferZone';
import { PeerList } from '@/components/peers/PeerList';
import { usePeerStore } from '@/stores/peerStore';
import { Activity, MessageCircle, Phone, Users, Share2 } from 'lucide-react';

export default function DashboardPage() {
  const peerStore = usePeerStore();
  const onlinePeers = peerStore.getOnlinePeers();

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
              <p className="text-3xl font-bold text-gray-900">0</p>
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
              <p className="text-gray-500 text-sm">Équipes</p>
              <p className="text-3xl font-bold text-gray-900">1</p>
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
          <h3 className="font-semibold text-gray-900 mb-1">Équipes</h3>
          <p className="text-sm text-gray-600">Gérez vos équipes</p>
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