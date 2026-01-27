'use client';

import { useState } from 'react';
import { X, Loader } from 'lucide-react';

interface TeamModalProps {
  isOpen: boolean;
  title: string;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  initialData?: { name: string; description?: string };
}

export function TeamModal({
  isOpen,
  title,
  isLoading = false,
  onClose,
  onSubmit,
  initialData,
}: TeamModalProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Le nom de l\'équipe est requis');
      return;
    }

    try {
      setError(null);
      await onSubmit(formData);
      setFormData({ name: '', description: '' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de l'équipe *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Équipe Marketing"
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Décrivez le but de votre équipe..."
              rows={3}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 resize-none text-gray-900"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 font-medium text-gray-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {isLoading ? <Loader className="animate-spin" size={16} /> : null}
              {initialData ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
