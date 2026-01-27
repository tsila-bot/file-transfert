'use client';

import { useState } from 'react';
import { Settings, Copy, Check, LogOut } from 'lucide-react';
import type { Team } from '@/types/types';

interface TeamSettingsProps {
  team: Team;
  isAdmin?: boolean;
  inviteCode?: string;
  onUpdate?: (data: { name: string; description?: string }) => Promise<void>;
  onLeave?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function TeamSettings({
  team,
  isAdmin = false,
  inviteCode,
  onUpdate,
  onLeave,
  onDelete,
}: TeamSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdate) return;

    try {
      setIsLoading(true);
      await onUpdate(formData);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!onLeave || !confirm('Êtes-vous sûr de vouloir quitter cette équipe ?')) return;

    try {
      setIsLoading(true);
      await onLeave();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !onDelete ||
      !confirm('Êtes-vous sûr ? Cette action est irréversible.')
    )
      return;

    try {
      setIsLoading(true);
      await onDelete();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Paramètres de l'équipe</h3>
        </div>

        {!isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom</label>
              <p className="text-gray-900 font-semibold">{team.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <p className="text-gray-600">{team.description || 'Pas de description'}</p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Éditer
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isLoading}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 resize-none text-gray-900"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-gray-700"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Invite Code */}
      {inviteCode && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Code d'invitation</h4>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <code className="flex-1 font-mono text-sm text-gray-900">
              {inviteCode}
            </code>
            <button
              onClick={handleCopyInviteCode}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
              title="Copier le code"
            >
              {copied ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} className="text-gray-600" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Partagez ce code pour inviter d'autres personnes dans votre équipe
          </p>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h4 className="font-semibold text-red-900 mb-4">Zone dangereuse</h4>
        <div className="space-y-3">
          <button
            onClick={handleLeave}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          >
            <LogOut size={16} />
            Quitter l'équipe
          </button>

          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              Supprimer l'équipe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
