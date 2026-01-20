'use client';

import { Users, Plus, Search } from 'lucide-react';
import { useState } from 'react';

interface Team {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  avatar?: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([
    {
      id: '1',
      name: 'Équipe A',
      description: 'Équipe de développement',
      memberCount: 5,
    },
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Équipes</h1>
          <p className="text-gray-500 mt-1">Gérez vos équipes et collaborez avec vos collègues</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2">
          <Plus size={20} />
          Créer une équipe
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Chercher une équipe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
            <Users className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune équipe trouvée</h3>
            <p className="text-gray-500">Créez une nouvelle équipe pour collaborer</p>
          </div>
        ) : (
          filteredTeams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="text-indigo-600" size={24} />
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                  ⋮
                </button>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">{team.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{team.description}</p>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">{team.memberCount} membres</p>
                <button className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
                  Voir
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
