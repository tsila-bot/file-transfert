// app/(dashboard)/profile/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usersAPI } from '@/core/services/api/users.service';
import { User } from '@/core/services/api/auth.service';

export default function ProfilePage() {
  const { user: authUser, refreshUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    avatar: '',
  });

  useEffect(() => {
    if (authUser) {
      setFormData({
        name: authUser.name,
        avatar: authUser.avatar || '',
      });
    }
  }, [authUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await usersAPI.updateProfile({
        name: formData.name,
        avatar: formData.avatar || null,
      });

      await refreshUser();
      setSuccess('Profil mis à jour avec succès');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  if (!authUser) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Mon Profil</h1>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-md">
          {success}
        </div>
      )}

      {/* Profil */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Informations personnelles</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              Modifier
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Avatar
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {formData.avatar ? (
                    <img
                      src={formData.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-gray-500">
                      {formData.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  name="avatar"
                  value={formData.avatar}
                  onChange={handleChange}
                  placeholder="URL de l'avatar"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Email (non modifiable) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Email
              </label>
              <input
                type="email"
                value={authUser.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 cursor-not-allowed"
              />
            </div>

            {/* Boutons */}
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: authUser.name,
                    avatar: authUser.avatar || '',
                  });
                }}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-md transition-colors font-medium text-gray-900"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {authUser.avatar ? (
                  <img
                    src={authUser.avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-gray-500">
                    {authUser.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{authUser.name}</p>
                <p className="text-gray-700">{authUser.email}</p>
              </div>
            </div>

            {/* Informations */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Rôle</p>
                <p className="font-medium text-gray-700">{authUser.role}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Membre depuis</p>
                <p className="font-medium text-gray-700">
                  {new Date(authUser.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Dernière connexion</p>
                <p className="font-medium text-gray-700">
                  {authUser.lastLoginAt
                    ? new Date(authUser.lastLoginAt).toLocaleDateString('fr-FR')
                    : 'Jamais'}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Statut</p>
                <p className="font-medium">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      authUser.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {authUser.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sécurité */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Sécurité</h2>
        <div className="space-y-3">
          <a
            href="/profile/change-password"
            className="block px-4 py-3 border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-900">Changer le mot de passe</p>
                <p className="text-sm text-gray-700">
                  Modifier votre mot de passe de connexion
                </p>
              </div>
              <span>→</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}