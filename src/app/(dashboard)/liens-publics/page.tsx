"use client"

import React from 'react'
import { Link2 } from 'lucide-react'
import CreatePublicLinkForm from '@/components/transfer/CreatePublicLinkForm'
import PublicLinksManager from '@/components/transfer/PublicLinksManager'

export default function LiensPublicsPage() {
  const [activeTab, setActiveTab] = React.useState<'create' | 'manage'>('manage')

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600 rounded-lg">
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Liens Publics</h1>
          </div>
          <p className="text-gray-600 ml-14">
            Créez et gérez des liens de partage public pour vos fichiers
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'manage'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            📋 Mes Liens
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            ➕ Créer un Lien
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-lg">
          {activeTab === 'manage' && (
            <div className="p-8">
              <PublicLinksManager />
            </div>
          )}

          {activeTab === 'create' && (
            <div className="p-8">
              <CreatePublicLinkForm onSuccess={() => setActiveTab('manage')} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
