// app/(dashboard)/profile/change-password/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usersAPI } from '@/core/services/api/users.service';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePassword = (password: string) => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Au moins 8 caractères');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Une majuscule');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Une minuscule');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Un chiffre');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Un caractère spécial');
    }

    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'newPassword') {
      validatePassword(value);
    }

    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier que les mots de passe correspondent
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    // Valider le nouveau mot de passe
    if (!validatePassword(formData.newPassword)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await usersAPI.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Erreur lors du changement de mot de passe'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Mot de passe modifié</h2>
          <p className="text-gray-600 mb-4">
            Votre mot de passe a été changé avec succès.
          </p>
          <p className="text-sm text-gray-500">
            Redirection vers le profil...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/profile"
          className="text-blue-600 hover:text-blue-700 flex items-center"
        >
          ← Retour au profil
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-6">Changer le mot de passe</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mot de passe actuel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe actuel
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    current: !prev.current,
                  }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.current ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    new: !prev.new,
                  }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.new ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {/* Exigences du mot de passe */}
            {formData.newPassword && passwordErrors.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="text-gray-600 mb-1">Requis :</p>
                <ul className="space-y-1">
                  {passwordErrors.map((err, index) => (
                    <li key={index} className="text-red-600 flex items-center">
                      <span className="mr-2">✗</span>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirmer le mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    confirm: !prev.confirm,
                  }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Bouton */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading || passwordErrors.length > 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600">
            💡 <strong>Astuce :</strong> Utilisez un gestionnaire de mots de passe
            pour créer et stocker des mots de passe forts.
          </p>
        </div>
      </div>
    </div>
  );
}