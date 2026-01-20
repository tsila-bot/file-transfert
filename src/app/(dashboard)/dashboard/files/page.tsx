'use client';

import Link from 'next/link';
import { FaFileAlt, FaClock, FaArchive } from 'react-icons/fa';

export default function FilesLayout() {
  const categories = [
    {
      icon: FaClock,
      title: 'Fichiers récents',
      description: 'Fichiers que vous avez utilisés récemment',
      href: '/dashboard/files/recent',
      count: '24',
    },
    {
      icon: FaFileAlt,
      title: 'Fichiers partagés',
      description: 'Fichiers que vous avez partagés',
      href: '/dashboard/files/shared',
      count: '12',
    },
    {
      icon: FaArchive,
      title: 'Fichiers archivés',
      description: 'Fichiers archivés et restaurables',
      href: '/dashboard/files/archived',
      count: '3',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Mes Fichiers</h1>
        <p className="text-gray-600 mt-2">Organisez et gérez vos fichiers</p>
      </div>

      {/* Grille de catégories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              key={category.href}
              href={category.href}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-4">
                <Icon size={32} className="text-indigo-600 group-hover:scale-110 transition" />
                <span className="text-2xl font-bold text-gray-800">{category.count}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{category.title}</h3>
              <p className="text-gray-600 text-sm">{category.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Info section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-2">💾 Stockage</h3>
        <p className="text-blue-800 text-sm mb-4">Vous utilisez 2.5 GB de 10 GB disponibles</p>
        <div className="w-full bg-blue-200 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full" style={{ width: '25%' }}></div>
        </div>
      </div>
    </div>
  );
}
