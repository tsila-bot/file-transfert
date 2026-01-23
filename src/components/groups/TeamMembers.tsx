'use client';

import { User, Shield, UserMinus, MoreVertical } from 'lucide-react';
import type { TeamMember } from '@/types/types';

interface TeamMembersProps {
  members: TeamMember[];
  isAdmin?: boolean;
  onRemoveMember?: (userId: string) => void;
  onChangeRole?: (userId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') => void;
}

export function TeamMembers({
  members,
  isAdmin = false,
  onRemoveMember,
  onChangeRole,
}: TeamMembersProps) {
  const getRoleBadge = (role: string) => {
    const styles = {
      ADMIN: 'bg-purple-100 text-purple-700',
      MEMBER: 'bg-blue-100 text-blue-700',
      GUEST: 'bg-gray-100 text-gray-700',
    };
    return styles[role as keyof typeof styles] || styles.MEMBER;
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      ADMIN: 'Administrateur',
      MEMBER: 'Membre',
      GUEST: 'Invité',
    };
    return labels[role as keyof typeof labels] || role;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Membres ({(members || []).length})
        </h3>
      </div>

      {/* Members List */}
      <div className="divide-y divide-gray-200">
        {(members || []).length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <User size={32} className="mx-auto mb-2 opacity-50" />
            <p>Aucun membre</p>
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                  {member.user?.avatar ? (
                    <img
                      src={member.user.avatar}
                      alt={member.user.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="text-indigo-600" size={20} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {member.user?.name || 'Utilisateur inconnu'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {member.user?.email || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-4">
                {/* Role Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(member.role)}`}>
                  {getRoleLabel(member.role)}
                </span>

                {/* Actions */}
                {isAdmin && (
                  <div className="relative group">
                    <button className="p-2 hover:bg-gray-200 rounded-lg transition">
                      <MoreVertical size={16} className="text-gray-500" />
                    </button>

                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-50">
                      {onChangeRole && member.role !== 'ADMIN' && (
                        <button
                          onClick={() => onChangeRole(member.userId, 'ADMIN')}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                        >
                          <Shield size={14} />
                          Rendre Admin
                        </button>
                      )}
                      {onChangeRole && member.role === 'ADMIN' && (
                        <button
                          onClick={() => onChangeRole(member.userId, 'MEMBER')}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                        >
                          Retirer Admin
                        </button>
                      )}
                      {onRemoveMember && (
                        <button
                          onClick={() => onRemoveMember(member.userId)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <UserMinus size={14} />
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
