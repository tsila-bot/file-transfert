'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
import Link from 'next/link';
import { useTeam } from '@/shared/hooks/useTeam';
import { TeamMembers } from '@/components/groups/TeamMembers';
import { TeamSettings } from '@/components/groups/TeamSettings';
import GroupChat from '@/components/groups/GroupChat';
import { useAuthStore } from '@/stores/authStore';

interface TeamDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { id: teamId } = use(params);
  const { user } = useAuthStore();
  const {
    currentTeam,
    members,
    loading,
    error,
    loadTeam,
    loadMembers,
    updateTeam,
    deleteTeam,
    leaveTeam,
    removeTeamMember,
    changeUserRole,
  } = useTeam();

  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'settings'>('chat');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Charger équipe et membres
  useEffect(() => {
    if (teamId) {
      loadTeam(teamId);
      loadMembers(teamId);
    }
  }, [teamId, loadTeam, loadMembers]);

  // Vérifier si user est admin
  const isAdmin = (members || []).some(
    (m) => m.userId === user?.id && m.role === 'ADMIN'
  );

  const handleUpdateTeam = async (data: { name: string; description?: string }) => {
    await updateTeam(teamId, data);
  };

  const handleDeleteTeam = async () => {
    setDeleteLoading(true);
    try {
      await deleteTeam(teamId);
      // Redirect
      window.location.href = '/teams';
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    await leaveTeam(teamId);
    window.location.href = '/teams';
  };

  const handleRemoveMember = async (userId: string) => {
    await removeTeamMember(teamId, userId);
  };

  const handleChangeRole = async (
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'GUEST'
  ) => {
    await changeUserRole(teamId, userId, role);
  };

  // Loading
  if (loading && !currentTeam) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  // Error
  if (error && !currentTeam) {
    return (
      <div className="space-y-6">
        <Link href="/teams" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
          <ArrowLeft size={18} />
          Retour aux équipes
        </Link>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">⚠️ {error}</p>
          <button
            onClick={() => {
              loadTeam(teamId);
              loadMembers(teamId);
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="space-y-6">
        <Link href="/teams" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
          <ArrowLeft size={18} />
          Retour aux équipes
        </Link>
        <p className="text-gray-500">Équipe non trouvée</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/teams" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4">
          <ArrowLeft size={18} />
          Retour aux équipes
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{currentTeam.name}</h1>
            <p className="text-gray-500 mt-2">
              {currentTeam.description || 'Pas de description'}
            </p>
          </div>
          <div className="w-16 h-16 bg-indigo-100 rounded-lg flex items-center justify-center overflow-hidden">
            {currentTeam.avatar ? (
              <img
                src={currentTeam.avatar}
                alt={currentTeam.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-8 h-8 text-indigo-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${
            activeTab === 'chat'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          💬 Chat
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Membres ({(members || []).length})
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Paramètres
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <GroupChat teamId={teamId} teamName={currentTeam?.name} />
        </div>
      )}

      {activeTab === 'members' && (
        <TeamMembers
          members={members}
          isAdmin={isAdmin}
          onRemoveMember={isAdmin ? handleRemoveMember : undefined}
          onChangeRole={isAdmin ? handleChangeRole : undefined}
        />
      )}

      {activeTab === 'settings' && isAdmin && (
        <>
          {console.log('Team data:', currentTeam)}
          <TeamSettings
            team={currentTeam}
            isAdmin={isAdmin}
            inviteCode={currentTeam.inviteCode}
            onUpdate={handleUpdateTeam}
            onLeave={handleLeaveTeam}
            onDelete={handleDeleteTeam}
          />
        </>
      )}

      {activeTab === 'settings' && !isAdmin && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Seuls les administrateurs peuvent accéder aux paramètres</p>
        </div>
      )}
    </div>
  );
}
