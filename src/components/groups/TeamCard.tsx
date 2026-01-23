import { Users, MoreVertical, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Team } from '@/types/types';

interface TeamCardProps {
  team: Team;
  onDelete?: (teamId: string) => void;
  onEdit?: (team: Team) => void;
}

export function TeamCard({ team, onDelete, onEdit }: TeamCardProps) {
  const memberCount = team.members?.length || 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center overflow-hidden">
          {team.avatar ? (
            <img src={team.avatar} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="text-indigo-600" size={24} />
          )}
        </div>

        <div className="relative group">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <MoreVertical size={16} className="text-gray-500" />
          </button>

          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {onEdit && (
              <button
                onClick={() => onEdit(team)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition"
              >
                Éditer
              </button>
            )}
            <Link
              href={`/teams/${team.id}`}
              className="block w-full text-left px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 border-b border-gray-100 transition"
            >
              <div className="flex items-center gap-2">
                <ExternalLink size={14} />
                Voir les détails
              </div>
            </Link>
            {onDelete && (
              <button
                onClick={() => onDelete(team.id)}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1">{team.name}</h3>
      <p className="text-sm text-gray-500 mb-4 line-clamp-2">
        {team.description || 'Pas de description'}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Users size={14} />
          <span>{memberCount} membre{memberCount > 1 ? 's' : ''}</span>
        </div>
        <Link
          href={`/teams/${team.id}`}
          className="text-indigo-600 hover:text-indigo-700 font-medium text-sm transition"
        >
          Accéder →
        </Link>
      </div>
    </div>
  );
}
