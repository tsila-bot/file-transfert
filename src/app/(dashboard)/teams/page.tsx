'use client';

import { Users, Plus, Search, Loader, LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTeam } from '@/shared/hooks/useTeam';
import { TeamCard } from '@/components/groups/TeamCard';
import { TeamModal } from '@/components/groups/TeamModal';

export default function TeamsPage() {
  const {
    teams,
    loading,
    error,
    loadTeams,
    createTeam,
    deleteTeam,
    joinTeamByCode,
  } = useTeam();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Charger les groupes au montage
  useEffect(() => {
    loadTeams().catch((err) => {
      console.error('❌ Erreur chargement groupes:', err);
    });
  }, [loadTeams]);

  const filteredTeams = (teams || []).filter((team) =>
    team && team.name && (
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (team.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    )
  );

  const handleCreateTeam = async (data: { name: string; description?: string }) => {
    try {
      await createTeam(data);
      setShowCreateModal(false);
      // Recharger la liste complète pour s'assurer que les données sont à jour
      await loadTeams();
    } catch (err) {
      console.error('Erreur création équipe:', err);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!joinCode.trim()) {
      setJoinError('Le code d\'invitation est requis');
      return;
    }

    try {
      setJoinLoading(true);
      setJoinError(null);
      await joinTeamByCode(joinCode);
      setJoinCode('');
      setShowJoinModal(false);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Code invalide ou expiré');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette équipe ?')) return;
    await deleteTeam(teamId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groupes</h1>
          <p className="text-gray-500 mt-1">Gérez vos groupes et collaborez avec vos collègues</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
          >
            <LogIn size={20} />
            Rejoindre
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus size={20} />
            Créer un groupe
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Chercher un groupe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">⚠️ {error}</p>
          <button
            onClick={() => loadTeams()}
            className="mt-2 text-red-600 hover:text-red-700 font-medium text-sm"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (teams || []).length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-indigo-600" size={32} />
        </div>
      )}

      {/* Teams Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
              <Users className="mx-auto mb-4 text-gray-400" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {(teams || []).length === 0 ? 'Aucun groupe' : 'Aucun groupe trouvé'}
              </h3>
              <p className="text-gray-500">
                {(teams || []).length === 0
                  ? 'Créez un nouveau groupe ou rejoignez un groupe existant'
                  : 'Essayez une autre recherche'}
              </p>
            </div>
          ) : (
            filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onEdit={() => setShowCreateModal(true)}
                onDelete={handleDeleteTeam}
              />
            ))
          )}
        </div>
      )}

      {/* Create Team Modal */}
      <TeamModal
        isOpen={showCreateModal}
        title="Créer un groupe"
        isLoading={loading}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTeam}
      />

      {/* Join Team Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Rejoindre un groupe</h2>

            {joinError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{joinError}</p>
              </div>
            )}

            <form onSubmit={handleJoinTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code d'invitation
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC123"
                  disabled={joinLoading}
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 font-mono"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  disabled={joinLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {joinLoading ? <Loader className="animate-spin" size={16} /> : null}
                  Rejoindre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
