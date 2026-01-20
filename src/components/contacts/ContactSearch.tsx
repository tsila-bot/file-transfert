'use client';

import { useState, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';

interface ContactSearchProps {
  onSearch: (query: string) => void;
  onStatusFilter?: (status: string | null) => void;
  placeholder?: string;
  showFilters?: boolean;
}

export default function ContactSearch({
  onSearch,
  onStatusFilter,
  placeholder = 'Rechercher un contact...',
  showFilters = true,
}: ContactSearchProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
  }, [onSearch]);

  const handleFilterClick = useCallback(
    (filter: string | null) => {
      setActiveFilter(filter);
      onStatusFilter?.(filter);
    },
    [onStatusFilter]
  );

  return (
    <div className="w-full space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition"
            aria-label="Effacer la recherche"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 transition"
          >
            <Filter className="w-4 h-4" />
            {showAdvanced ? 'Masquer les filtres' : 'Afficher les filtres'}
          </button>

          {showAdvanced && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              {/* Status Filters */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFilterClick(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    activeFilter === null
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Tous
                </button>
                {['available', 'busy', 'in_call', 'offline'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleFilterClick(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition capitalize ${
                      activeFilter === status
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {status === 'available' && '✓ En ligne'}
                    {status === 'busy' && '⚠️ Occupé'}
                    {status === 'in_call' && '📞 En appel'}
                    {status === 'offline' && '✕ Hors ligne'}
                  </button>
                ))}
              </div>

              {/* Sort Options */}
              <div className="pt-2 border-t border-gray-200">
                <label className="text-xs font-medium text-gray-700">Trier par:</label>
                <select className="w-full mt-1 text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Nom (A-Z)</option>
                  <option>Statut (En ligne d'abord)</option>
                  <option>Récemment vu</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
